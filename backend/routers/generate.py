import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import User, Video, VideoStatus, get_db
from routers.users import check_quota, increment_usage, optional_user
from utils.intake import classify as classify_intake
from utils.rate_limit import check_rate_limit
from workers.tasks import generate_video

router = APIRouter(prefix="/api/v1", tags=["generate"])

# Feature flag: when False, /generate accepts anonymous requests (legacy
# behavior). When True, signin is required and quotas enforced. Set
# REQUIRE_AUTH=1 in the environment to flip on. Default False so v5c
# rendering keeps working during the v6 rollout.
REQUIRE_AUTH = os.environ.get("REQUIRE_AUTH", "0") == "1"


class GenerateOptions(BaseModel):
    # None means "let the worker decide" — falls through to DEFAULT_VOICE env
    # var, then to auto-detect based on which API keys are configured.
    voice: Optional[Literal["openai", "elevenlabs"]] = None
    quality: Literal["720p", "1080p"] = "720p"
    visibility: Optional[Literal["public", "unlisted", "private"]] = None


class GenerateRequest(BaseModel):
    repo_url: str
    options: GenerateOptions = Field(default_factory=GenerateOptions)


class GenerateResponse(BaseModel):
    job_id: str
    status: str


@router.post("/generate", response_model=GenerateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_generation(
    body: GenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),
) -> GenerateResponse:
    # v7d — classify the URL. Handles plain repo URLs, commit URLs,
    # file (blob) URLs, gists, and PRs. validate_repo_url's host/IP
    # checks run inside the classifier's "repo" fallback, so blocked
    # hosts still raise. We pin the actual repo target via
    # intake.repo_url so the rest of the pipeline still gets a normal
    # GitHub repo URL.
    try:
        intake = classify_intake(body.repo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    normalized_url = intake.repo_url

    # v7 — rate limit. Per-IP for anonymous, per-user when authenticated.
    # Generate is expensive (~$0.18/render) so we cap aggressively. Both
    # limits enforced — a logged-in user from one IP still gets capped.
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    check_rate_limit(
        key=f"generate:ip:{client_ip}",
        limit=10 if user is None else 30,
        window_seconds=3600,
    )
    if user is not None:
        check_rate_limit(
            key=f"generate:user:{user.id}",
            limit=100,  # never more than 100/hr per user, regardless of plan
            window_seconds=3600,
        )

    owner, name = intake.owner, intake.name

    # Auth + quota check — gated behind REQUIRE_AUTH flag so dev / v5c
    # rendering doesn't break before the frontend OAuth ships.
    if REQUIRE_AUTH:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in to generate videos.",
            )
        check_quota(user)
        # Free tier locks visibility to public, voice to default.
        from models.user import Plan
        is_free = (user.plan == Plan.free if isinstance(user.plan, Plan)
                   else user.plan == "free")
        visibility = (
            "public" if is_free
            else (body.options.visibility or user.default_visibility or "public")
        )
    else:
        visibility = body.options.visibility or "public"

    intake_meta = {
        k: v for k, v in {
            "commit_sha": intake.commit_sha,
            "file_path": intake.file_path,
            "file_ref": intake.file_ref,
            "gist_id": intake.gist_id,
            "pr_number": intake.pr_number,
            "focus_label": intake.focus_label,
        }.items() if v is not None
    }

    video = Video(
        repo_url=normalized_url,
        repo_owner=owner,
        repo_name=name,
        status=VideoStatus.queued,
        progress=0,
        status_details={"stage": "Queued"},
        voice_provider=body.options.voice or "",
        video_quality=body.options.quality,
        user_id=user.id if user else None,
        visibility=visibility,
        intake_kind=intake.kind,
        intake_meta=intake_meta or None,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Charge quota at queue admission so transient render failures don't
    # double-bill on retry.
    if REQUIRE_AUTH and user is not None:
        increment_usage(user, db)

    worker_options = body.options.model_dump()
    worker_options["intake_kind"] = intake.kind
    worker_options["intake_meta"] = intake_meta

    # v7f — priority queue. Free → 'video.free', Pro/Team → 'video.priority'.
    # When REQUIRE_AUTH is off (dev / v5c legacy), everything goes on
    # 'video.free' since anonymous = free-tier by default.
    queue = "video.free"
    if user is not None:
        from models.user import Plan
        plan = user.plan if isinstance(user.plan, Plan) else None
        if plan in (Plan.pro, Plan.team):
            queue = "video.priority"
    worker_options["queue"] = queue

    # v7f — tier-aware render quality. Free tier locked to 720p
    # regardless of what they sent in `options.quality`. Pro / Team get
    # whatever they asked for.
    if user is None or (hasattr(user, "plan") and str(user.plan).endswith("free")):
        worker_options["quality"] = "720p"

    generate_video.apply_async(
        args=[video.id, normalized_url, worker_options],
        queue=queue,
    )

    return GenerateResponse(job_id=video.id, status=video.status.value)


# --- Compare two repos ----------------------------------------------------


class CompareRequest(BaseModel):
    repo_url_a: str
    repo_url_b: str
    options: GenerateOptions = Field(default_factory=GenerateOptions)


@router.post(
    "/generate/compare",
    response_model=GenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_compare(
    body: CompareRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),
) -> GenerateResponse:
    """Compare-two-repos mode. Queues a single Video row that walks two
    codebases side by side: shared concepts, divergent choices, and a
    "which would I reach for" close. Counts as 2x quota since the
    analyzer + script pipeline runs twice."""
    try:
        intake_a = classify_intake(body.repo_url_a)
        intake_b = classify_intake(body.repo_url_b)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if intake_a.kind != "repo" or intake_b.kind != "repo":
        raise HTTPException(
            status_code=400,
            detail="Compare mode only accepts plain repo URLs (no commits/files/gists).",
        )

    if intake_a.repo_url == intake_b.repo_url:
        raise HTTPException(
            status_code=400, detail="The two repos must be different."
        )

    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    check_rate_limit(
        key=f"generate:ip:{client_ip}",
        limit=5 if user is None else 15,  # half of /generate; compare is 2x cost
        window_seconds=3600,
    )

    if REQUIRE_AUTH:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in to generate comparisons.",
            )
        # Comparisons cost 2x quota — burn two units.
        check_quota(user)
        check_quota(user)
        visibility = body.options.visibility or user.default_visibility or "public"
    else:
        visibility = body.options.visibility or "public"

    intake_meta = {
        "compared_repo_url": intake_b.repo_url,
        "compared_owner": intake_b.owner,
        "compared_name": intake_b.name,
        "focus_label": f"{intake_a.name} vs {intake_b.name}",
    }
    video = Video(
        repo_url=intake_a.repo_url,
        repo_owner=intake_a.owner,
        repo_name=f"{intake_a.name}-vs-{intake_b.name}",
        status=VideoStatus.queued,
        progress=0,
        status_details={"stage": "Queued (compare mode)"},
        voice_provider=body.options.voice or "",
        video_quality=body.options.quality,
        user_id=user.id if user else None,
        visibility=visibility,
        intake_kind="compare",
        intake_meta=intake_meta,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    if REQUIRE_AUTH and user is not None:
        increment_usage(user, db)
        increment_usage(user, db)

    worker_options = body.options.model_dump()
    worker_options["intake_kind"] = "compare"
    worker_options["intake_meta"] = intake_meta

    queue = "video.free"
    if user is not None:
        from models.user import Plan
        plan = user.plan if isinstance(user.plan, Plan) else None
        if plan in (Plan.pro, Plan.team):
            queue = "video.priority"
    worker_options["queue"] = queue
    if user is None or (hasattr(user, "plan") and str(user.plan).endswith("free")):
        worker_options["quality"] = "720p"

    generate_video.apply_async(
        args=[video.id, intake_a.repo_url, worker_options],
        queue=queue,
    )

    return GenerateResponse(job_id=video.id, status=video.status.value)
