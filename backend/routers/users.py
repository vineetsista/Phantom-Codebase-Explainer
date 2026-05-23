"""User management — upsert from frontend GitHub OAuth, current-user lookup,
and the auth guard the generate router uses for quota enforcement.

The frontend is the source of truth for authentication: NextAuth handles
the GitHub OAuth flow and verifies sessions. The frontend then calls
POST /api/v1/users/upsert with the GitHub profile after a successful
login. Every subsequent backend call includes X-User-Id (set by the
Next.js proxy) which the backend trusts. This is acceptable for the MVP
because the only public entrypoint is the Next.js frontend; API key
auth (Phase 5) replaces the header trust model when programmatic access
ships.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from models import Plan, User, get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["users"])


class UpsertUserBody(BaseModel):
    github_id: str
    github_username: str
    email: Optional[str] = ""
    name: Optional[str] = ""
    avatar_url: Optional[str] = ""


@router.post("/users/upsert")
def upsert_user(body: UpsertUserBody, db: Session = Depends(get_db)) -> dict:
    """Called by the Next.js NextAuth callback after a GitHub login.

    Creates the user row if it doesn't exist; updates display fields if
    it does. Returns the user record so the frontend can stash plan +
    quota info in the session for paywall UI.
    """
    if not body.github_id or not body.github_username:
        raise HTTPException(status_code=400, detail="github_id and github_username required")

    user = db.query(User).filter(User.github_id == body.github_id).one_or_none()
    if user is None:
        user = User(
            github_id=body.github_id,
            github_username=body.github_username,
            email=body.email or "",
            name=body.name or body.github_username,
            avatar_url=body.avatar_url or "",
            plan=Plan.free,
        )
        db.add(user)
        logger.info("Created user %s (github=%s)", user.id, user.github_username)
        # v7h — welcome email. Best-effort; missing RESEND_API_KEY no-ops.
        try:
            from services import email_dispatcher
            if user.email:
                email_dispatcher.send_welcome(user.email, user.name or user.github_username)
        except Exception as exc:
            logger.warning("welcome email failed for %s: %s", user.github_username, exc)
    else:
        # Update display fields on each login — GitHub profiles change.
        user.github_username = body.github_username
        user.email = body.email or user.email
        user.name = body.name or user.name
        user.avatar_url = body.avatar_url or user.avatar_url
        logger.debug("Updated user %s on login", user.id)

    db.commit()
    db.refresh(user)
    return user.to_dict()


def _user_from_api_key(authorization: str, db: Session) -> Optional[User]:
    """If `authorization` is a Bearer phk_live_... token, look it up and
    return the owning user. Updates last_used_at on each hit. None on
    miss / revoked / malformed."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):].strip()
    if not token.startswith("phk_"):
        return None
    from datetime import datetime

    from models import ApiKey, hash_key
    digest = hash_key(token)
    key = db.query(ApiKey).filter(ApiKey.key_hash == digest).one_or_none()
    if key is None or key.revoked_at is not None:
        return None
    key.last_used_at = datetime.utcnow()
    db.commit()
    user = db.query(User).filter(User.id == key.user_id).one_or_none()
    return user


def require_user(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: load the current user from EITHER the
    X-User-Id session header (set by the Next.js proxy after NextAuth
    session validation) OR an `Authorization: Bearer phk_...` API key
    header (Pro+ programmatic access).

    Bearer auth checked first so API keys take precedence over a
    cookie session — matches Stripe / GitHub conventions.
    """
    user = _user_from_api_key(authorization or "", db)
    if user is not None:
        return user

    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to generate videos.",
        )
    user = db.query(User).filter(User.id == x_user_id).one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid. Please sign in again.",
        )
    return user


def optional_user(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Same as require_user but returns None instead of raising — used
    for endpoints that work both authenticated and not. Honours API
    keys + session header in the same order as require_user."""
    user = _user_from_api_key(authorization or "", db)
    if user is not None:
        return user
    if not x_user_id:
        return None
    return db.query(User).filter(User.id == x_user_id).one_or_none()


@router.get("/me")
def get_me(user: User = Depends(require_user)) -> dict:
    """Return the current logged-in user's profile + quota state."""
    return user.to_dict()


class UpdateMeBody(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    custom_slug: Optional[str] = None
    default_voice: Optional[str] = None
    default_visibility: Optional[str] = None
    custom_watermark: Optional[str] = None
    email_on_complete: Optional[bool] = None
    email_on_milestone: Optional[bool] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None


@router.patch("/me")
def update_me(
    body: UpdateMeBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update the current user's profile + preferences. All fields
    optional — only provided keys are updated."""
    import re

    if body.name is not None:
        user.name = body.name.strip()[:120]
    if body.bio is not None:
        user.bio = body.bio.strip()[:280]
    if body.custom_slug is not None:
        slug = body.custom_slug.strip().lower()[:64]
        if slug and not re.match(r"^[a-z0-9][a-z0-9_-]*$", slug):
            raise HTTPException(
                status_code=400,
                detail="Slug must start with a letter or digit and contain only letters, digits, hyphens, and underscores.",
            )
        # Uniqueness check (skip if slug unchanged).
        if slug and slug != user.custom_slug:
            existing = (
                db.query(User)
                .filter(User.custom_slug == slug, User.id != user.id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=409, detail="That slug is taken.")
        user.custom_slug = slug
    if body.default_voice is not None and body.default_voice in {
        "antoni", "brian", "rachel", "adam", "elevenlabs", "openai"
    }:
        user.default_voice = body.default_voice
    if body.default_visibility is not None and body.default_visibility in {
        "public", "unlisted", "private"
    }:
        user.default_visibility = body.default_visibility
    if body.custom_watermark is not None:
        # Pro+ feature; free users can pass it through but it's ignored
        # at render time.
        user.custom_watermark = body.custom_watermark.strip()[:64]
    if body.email_on_complete is not None:
        user.email_on_complete = bool(body.email_on_complete)
    if body.email_on_milestone is not None:
        user.email_on_milestone = bool(body.email_on_milestone)
    if body.webhook_url is not None:
        wurl = body.webhook_url.strip()[:500]
        if wurl and not wurl.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Webhook URL must be http(s).")
        user.webhook_url = wurl
        # Auto-generate secret on first save.
        if wurl and not user.webhook_secret:
            import secrets
            user.webhook_secret = secrets.token_hex(32)
    db.commit()
    db.refresh(user)
    return user.to_dict()


@router.delete("/me")
def delete_me(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    """GDPR delete-account flow. Cascading delete across all owned data
    (videos, comments, favorites, reactions, collections, API keys).
    The cascade is explicit (not SQLAlchemy ON DELETE) so we have a
    clear audit trail in the worker logs."""
    from models import (
        ApiKey, Collection, CollectionVideo, Comment, Favorite,
        Reaction, Share, Video,
    )
    uid = user.id
    counts: dict[str, int] = {}
    # Order matters — child tables first.
    for model, name in [
        (Favorite, "favorites"),
        (Reaction, "reactions"),
        (Comment, "comments"),
        (CollectionVideo, "collection_videos"),
        (Collection, "collections"),
        (ApiKey, "api_keys"),
    ]:
        if model is CollectionVideo:
            # Need to delete by user's collection IDs.
            col_ids = [c.id for c in db.query(Collection).filter(Collection.user_id == uid).all()]
            if col_ids:
                deleted = (
                    db.query(CollectionVideo)
                    .filter(CollectionVideo.collection_id.in_(col_ids))
                    .delete(synchronize_session=False)
                )
                counts[name] = int(deleted or 0)
            else:
                counts[name] = 0
            continue
        deleted = db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
        counts[name] = int(deleted or 0)
    # Videos: keep the records but null out user_id so videos remain
    # accessible to anyone who has the URL (avoids breaking shares).
    counts["videos_anonymized"] = (
        db.query(Video).filter(Video.user_id == uid).update({"user_id": None})
    )
    # Shares: only video_id is referenced; no user_id column. Skip.
    db.delete(user)
    db.commit()
    logger.info("Deleted user %s with cascade counts: %s", uid, counts)
    return {"ok": True, "counts": counts}


@router.get("/me/export")
def export_me(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    """GDPR data export. Returns all of the user's data as a single
    JSON blob suitable for download."""
    from models import (
        ApiKey, Collection, Comment, Favorite, Reaction, Video,
    )
    uid = user.id
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "profile": user.to_dict(),
        "videos": [
            v.to_dict()
            for v in db.query(Video).filter(Video.user_id == uid).all()
        ],
        "comments": [
            c.to_dict()
            for c in db.query(Comment).filter(Comment.user_id == uid).all()
        ],
        "favorites": [
            {"video_id": f.video_id, "created_at": f.created_at.isoformat()}
            for f in db.query(Favorite).filter(Favorite.user_id == uid).all()
        ],
        "reactions": [
            {
                "video_id": r.video_id,
                "emoji": r.emoji.value if hasattr(r.emoji, "value") else r.emoji,
                "created_at": r.created_at.isoformat(),
            }
            for r in db.query(Reaction).filter(Reaction.user_id == uid).all()
        ],
        "collections": [
            {
                "id": c.id, "name": c.name, "slug": c.slug,
                "description": c.description, "public": c.public,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in db.query(Collection).filter(Collection.user_id == uid).all()
        ],
        "api_keys": [
            k.to_dict()
            for k in db.query(ApiKey).filter(ApiKey.user_id == uid).all()
        ],
    }


@router.get("/users/{slug}")
def get_user_profile(slug: str, db: Session = Depends(get_db)) -> dict:
    """v7 — public profile page data. `slug` matches either the user's
    custom_slug or their github_username (custom takes precedence)."""
    from models import Video

    user = (
        db.query(User)
        .filter((User.custom_slug == slug) | (User.github_username == slug))
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Public videos owned by this user, newest first.
    videos_q = (
        db.query(Video)
        .filter(Video.user_id == user.id, Video.visibility == "public")
        .order_by(Video.created_at.desc())
        .limit(48)
    )
    videos = [v.to_dict() for v in videos_q.all()]

    total_views = sum(int(v.get("view_count") or 0) for v in videos)
    return {
        "profile": {
            "id": user.id,
            "slug": user.custom_slug or user.github_username,
            "github_username": user.github_username,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "stats": {
            "video_count": len(videos),
            "total_views": total_views,
        },
        "videos": videos,
    }


def check_quota(user: User) -> None:
    """Raise 429 with a clear upgrade message if the user has hit the
    monthly limit. Resets monthly_video_count if the period has rolled
    over since last increment."""
    now = datetime.utcnow()
    # Reset on month boundary (simple — based on calendar month, not
    # 30-day rolling).
    if user.monthly_count_reset_at is None or (
        user.monthly_count_reset_at.year != now.year
        or user.monthly_count_reset_at.month != now.month
    ):
        user.monthly_video_count = 0
        user.monthly_count_reset_at = now

    if user.monthly_video_count >= user.plan_limit:
        plan_name = user.plan.value if isinstance(user.plan, Plan) else user.plan
        next_tier = "Pro" if plan_name == "free" else "Team"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You've used all {user.plan_limit} videos this month on the "
                f"{plan_name} plan. Upgrade to {next_tier} for "
                f"{30 if next_tier == 'Pro' else 200} videos/month."
            ),
        )


def increment_usage(user: User, db: Session) -> None:
    """Bump the monthly count + commit. Called when a generation
    successfully kicks off (not when it completes — we charge on
    queue admission so retries on transient failures don't double-bill).
    """
    user.monthly_video_count = (user.monthly_video_count or 0) + 1
    db.commit()
