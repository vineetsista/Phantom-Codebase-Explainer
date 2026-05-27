from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import User, Video, VideoStatus, get_db
from routers.users import optional_user
from utils.intake import classify as classify_intake
from utils.rate_limit import check_rate_limit
from workers.tasks import generate_video

router = APIRouter(prefix="/api/v1", tags=["generate"])


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
    # Classify the URL. Handles plain repo URLs, commit URLs, file (blob)
    # URLs, gists, and PRs. validate_repo_url's host/IP checks run inside
    # the classifier's "repo" fallback, so blocked hosts still raise.
    try:
        intake = classify_intake(body.repo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    normalized_url = intake.repo_url

    # Rate limit. Per-IP for anonymous, per-user when authenticated.
    # Generate is expensive (~$0.18/render) so we cap aggressively.
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
            limit=100,
            window_seconds=3600,
        )

    owner, name = intake.owner, intake.name
    visibility = body.options.visibility or (
        user.default_visibility if user else None
    ) or "public"

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

    worker_options = body.options.model_dump()
    worker_options["intake_kind"] = intake.kind
    worker_options["intake_meta"] = intake_meta
    # The worker subscribes to both `video.priority` and `video.free`.
    # Without plans, everything goes on `video.free` — kept the routing
    # in place because the docker-compose `-Q` flag still references it.
    worker_options["queue"] = "video.free"

    generate_video.apply_async(
        args=[video.id, normalized_url, worker_options],
        queue="video.free",
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
    "which would I reach for" close."""
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

    visibility = body.options.visibility or (
        user.default_visibility if user else None
    ) or "public"

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

    worker_options = body.options.model_dump()
    worker_options["intake_kind"] = "compare"
    worker_options["intake_meta"] = intake_meta
    worker_options["queue"] = "video.free"

    generate_video.apply_async(
        args=[video.id, intake_a.repo_url, worker_options],
        queue="video.free",
    )

    return GenerateResponse(job_id=video.id, status=video.status.value)
