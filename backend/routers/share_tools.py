"""Share tools — turn a finished video into shareable text.

For now: Twitter thread generator. Pulls the script + summary off a
finished Video row, asks Haiku for a 4-tweet thread (hook + three
beats + URL), returns the result as JSON.

Cached on the Video row's `share_thread` field if we want to extend
the model later — current implementation regenerates on demand so the
thread tracks any changes to the script.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import get_settings
from models import User, Video, get_db
from routers.users import optional_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["share"])

SYSTEM_PROMPT = """You write tight Twitter/X threads for developer tools.

Given a script summary of an AI-generated codebase walkthrough, write a 4-tweet thread that promotes the video.

Rules:
- 4 tweets total. Each tweet under 270 characters.
- Tweet 1: the hook. State the most surprising / specific thing about the codebase. No "I just generated a video of...". No "Today I'm sharing...".
- Tweets 2-3: two concrete beats from the script (mechanisms, design choices, or insights). Lean technical.
- Tweet 4: short close + the video URL placeholder `{URL}`.
- No hashtags. No emoji. No "thread 🧵". No "Watch the full breakdown".
- Write like the most-followed senior eng on the timeline, not a marketer.

Output JSON only, no preamble:
{"tweets": ["tweet 1", "tweet 2", "tweet 3", "tweet 4"]}"""


@router.get("/videos/{video_id}/twitter-thread")
def twitter_thread(
    video_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),
) -> dict:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Anyone can share a public video; private videos need to be your own.
    if video.visibility == "private":
        if user is None or video.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not your video.")

    script = video.script_data or {}
    summary = (video.summary_data or {}).get("markdown", "")
    if not script:
        raise HTTPException(
            status_code=400,
            detail="This video doesn't have a script yet — try again once it finishes.",
        )

    settings = get_settings()
    if not settings.has_claude:
        return {"tweets": _stub_thread(video, script), "source": "stub"}

    prompt = (
        f"Repo: {video.repo_owner}/{video.repo_name}\n"
        f"Title: {script.get('title', '')}\n"
        f"Hook: {script.get('hook', '')}\n\n"
        f"Sections:\n"
        + "\n".join(
            f"- {s.get('title', '')}: {(s.get('narration') or '')[:240]}"
            for s in script.get("sections", [])[:6]
        )
        + f"\n\nSummary (if available):\n{summary[:1500]}"
    )

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else ""
        tweets = _parse_tweets(raw)
        if not tweets:
            logger.warning("twitter_thread: bad Haiku JSON, falling back. Raw=%r", raw[:200])
            return {"tweets": _stub_thread(video, script), "source": "stub"}
        return {"tweets": tweets, "source": "haiku"}
    except Exception as exc:
        logger.warning("twitter_thread failed: %s", exc)
        return {"tweets": _stub_thread(video, script), "source": "stub"}


def _parse_tweets(raw: str) -> list[str]:
    import json
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`").lstrip("json").strip()
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        return []
    tw = data.get("tweets")
    if not isinstance(tw, list) or not all(isinstance(t, str) for t in tw):
        return []
    # Clamp to 4 tweets, 280 chars each.
    return [t.strip()[:280] for t in tw[:4]]


def _stub_thread(video: Video, script: dict) -> list[str]:
    title = (script.get("title") or video.repo_name).strip()
    return [
        f"Just generated a Phantom walkthrough of {video.repo_owner}/{video.repo_name}.",
        f"The video covers {title.lower()} — architecture, key files, and the cleverness inside.",
        "Three minutes. AI narrated. Worth the watch if you've ever wondered how this thing actually works.",
        "Watch it here: {URL}",
    ]
