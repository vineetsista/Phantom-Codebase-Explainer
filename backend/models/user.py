"""User account model.

Identity comes from GitHub OAuth (NextAuth on the frontend). The backend
trusts the frontend's session — every request is expected to include an
X-User-Id header set by the Next.js proxy after session validation.
This is acceptable because the only public entrypoint is the Next.js
frontend (or direct API access via hashed API keys).

This is a portfolio project, not a SaaS — there are no plans, no
quotas, no Stripe. Every feature is available to every signed-in
user.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # GitHub OAuth fields — id is the canonical identifier (numeric in
    # GitHub's universe; we store as string for forward-compat with other
    # providers later).
    github_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    github_username: Mapped[str] = mapped_column(String(255), default="", index=True)
    email: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(Text, default="")

    # Profile (editable by user from /dashboard/settings)
    bio: Mapped[str] = mapped_column(Text, default="")
    custom_slug: Mapped[str] = mapped_column(String(64), default="", index=True)

    # Default preferences (used when user generates without specifying)
    default_voice: Mapped[str] = mapped_column(String(32), default="antoni")
    default_visibility: Mapped[str] = mapped_column(String(16), default="public")
    custom_watermark: Mapped[str] = mapped_column(String(64), default="")

    # Settings flags
    email_on_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    email_on_milestone: Mapped[bool] = mapped_column(Boolean, default=True)

    # Webhook config — fires on generation events.
    # signing_secret is generated once on first config and shown to the
    # user so they can verify HMAC-SHA256 signatures.
    webhook_url: Mapped[str] = mapped_column(Text, default="")
    webhook_secret: Mapped[str] = mapped_column(String(64), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "github_id": self.github_id,
            "github_username": self.github_username,
            "email": self.email,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "custom_slug": self.custom_slug or self.github_username,
            "default_voice": self.default_voice,
            "default_visibility": self.default_visibility,
            "custom_watermark": self.custom_watermark,
            "email_on_complete": self.email_on_complete,
            "email_on_milestone": self.email_on_milestone,
            "webhook_url": self.webhook_url,
            "webhook_secret": self.webhook_secret,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
