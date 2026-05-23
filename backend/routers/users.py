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


def require_user(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: load the current user from the X-User-Id header.

    Returns the User row; raises 401 if header missing or 404 if user
    doesn't exist in the DB. Use as `user: User = Depends(require_user)`
    on protected endpoints.

    The header is set by the Next.js proxy after session validation. In
    development (where the frontend may not be configured), the backend
    can be hit directly with a manual X-User-Id header to test.
    """
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
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Same as require_user but returns None instead of raising — used
    for endpoints that work both authenticated and not (e.g. read-only
    video pages)."""
    if not x_user_id:
        return None
    return db.query(User).filter(User.id == x_user_id).one_or_none()


@router.get("/me")
def get_me(user: User = Depends(require_user)) -> dict:
    """Return the current logged-in user's profile + quota state."""
    return user.to_dict()


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
