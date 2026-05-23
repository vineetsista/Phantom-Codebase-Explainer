"""Onboarding helpers — list the signed-in user's GitHub repos so the
welcome flow can offer "pick one of yours" without making the user
paste a URL.

We don't store these — every call hits GitHub fresh. Cached briefly
in Redis (5 min) to avoid hammering the API when a user clicks back
and forth on the picker.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from models import User
from routers.users import optional_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/me", tags=["onboarding"])


@router.get("/github-repos")
def my_github_repos(user: Optional[User] = Depends(optional_user)) -> dict:
    """Return the signed-in user's public repos, sorted by stars desc.
    Capped at 50 — we don't need pagination for an onboarding picker."""
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in first.")
    cache_key = f"github_repos:{user.github_username}"

    # Try cache first.
    r = _redis()
    if r is not None:
        try:
            cached = r.get(cache_key)
            if cached:
                return {"repos": json.loads(cached), "source": "cache"}
        except Exception as exc:
            logger.warning("repo cache get failed: %s", exc)

    # Fall through — hit GitHub.
    headers = {"Accept": "application/vnd.github+json"}
    # No token wired through here; we rely on the 60/hr unauthenticated
    # limit. Per-user this is fine for an onboarding picker; if it ever
    # becomes a bottleneck we can wire the GitHub OAuth token through
    # the session.
    try:
        with httpx.Client(timeout=20) as client:
            resp = client.get(
                f"https://api.github.com/users/{user.github_username}/repos",
                headers=headers,
                params={"sort": "stars", "per_page": 50, "type": "owner"},
            )
            resp.raise_for_status()
            data = resp.json() or []
    except Exception as exc:
        logger.warning("github_repos fetch failed for %s: %s", user.github_username, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub repos") from exc

    repos = [
        {
            "name": r.get("name"),
            "full_name": r.get("full_name"),
            "description": r.get("description"),
            "html_url": r.get("html_url"),
            "stargazers_count": r.get("stargazers_count", 0),
            "language": r.get("language"),
        }
        for r in data
        if not r.get("private") and not r.get("fork")
    ]
    repos.sort(key=lambda x: x["stargazers_count"], reverse=True)

    if r := _redis():
        try:
            r.setex(cache_key, 300, json.dumps(repos))
        except Exception as exc:
            logger.warning("repo cache set failed: %s", exc)

    return {"repos": repos, "source": "github"}


_redis_client = None


def _redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        from config import get_settings
        _redis_client = redis.from_url(
            get_settings().redis_url, decode_responses=True
        )
        _redis_client.ping()
        return _redis_client
    except Exception:
        _redis_client = None
        return None
