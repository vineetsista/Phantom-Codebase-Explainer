"""Lifecycle email dispatcher (Resend).

Phantom sends a small handful of transactional emails:

  - welcome             — sent on signup (one-shot)
  - generation_complete — sent when a video finishes rendering, if the
                          user opted in (email_on_complete=True)
  - milestone           — first 100 views, etc.
  - first_video_followup — 24h after their first video if they
                          haven't generated a second (gentle nudge)

The Resend API is used because it's the simplest hosted option. When
RESEND_API_KEY is missing, the dispatcher is a logged no-op so
development doesn't accidentally email anyone.

We never include unsubscribe footers on transactional mail (this is
correct under CAN-SPAM since the user opted in to each category
explicitly via their settings), but we DO honor the per-user
email_on_complete / email_on_milestone toggles.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com/emails"
FROM = os.environ.get("RESEND_FROM", "Phantom <hello@phantom.video>")


@dataclass
class EmailResult:
    sent: bool
    reason: str
    message_id: Optional[str] = None


def _send(to: str, subject: str, html: str, text: str) -> EmailResult:
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        logger.info(
            "email_dispatcher: no RESEND_API_KEY — skipping send to %s (subject=%r)",
            to, subject,
        )
        return EmailResult(sent=False, reason="no_api_key")
    if not to or "@" not in to:
        return EmailResult(sent=False, reason="bad_recipient")
    try:
        resp = httpx.post(
            RESEND_API,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM,
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text,
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.warning(
                "email_dispatcher: Resend %d for %s — %s",
                resp.status_code, to, resp.text[:200],
            )
            return EmailResult(sent=False, reason=f"resend_{resp.status_code}")
        data = resp.json()
        return EmailResult(
            sent=True,
            reason="ok",
            message_id=data.get("id"),
        )
    except Exception as exc:
        logger.warning("email_dispatcher: send failed for %s: %s", to, exc)
        return EmailResult(sent=False, reason=str(exc))


# --- Public API ----------------------------------------------------------


def send_welcome(to: str, name: str) -> EmailResult:
    subject = "Welcome to Phantom"
    html = f"""\
<p>Hey {name or 'there'} —</p>
<p>You're in. Phantom turns any public GitHub repo into a short narrated video walkthrough. Drop a URL on the
home page and the first video lands in a couple of minutes.</p>
<p>Phantom is a portfolio project — open source on GitHub, free to use, no plans, no quotas.</p>
<p>If you reply to this email, it goes to a human.</p>
"""
    text = (
        f"Hey {name or 'there'} — welcome to Phantom. Drop a GitHub URL on the home page "
        "and the first video lands in a couple of minutes. Phantom is an open-source portfolio project — "
        "free to use, no plans, no quotas. Replies go to a human."
    )
    return _send(to, subject, html, text)


def send_generation_complete(to: str, video_id: str, repo: str) -> EmailResult:
    url = f"https://phantom.video/v/{video_id}"
    subject = f"Your Phantom video of {repo} is ready"
    html = f"""\
<p>Your walkthrough of <b>{repo}</b> is ready.</p>
<p><a href="{url}">Watch it →</a></p>
<p>You can also share the link directly — anyone with the URL can view (unless you marked the video private).</p>
"""
    text = f"Your walkthrough of {repo} is ready. Watch it: {url}"
    return _send(to, subject, html, text)


def send_first_video_followup(to: str, name: str) -> EmailResult:
    subject = "Quick question about your first Phantom video"
    html = f"""\
<p>Hey {name or 'there'} —</p>
<p>Your first Phantom video has been up for a day. What did you think? Was the narration in the right
ballpark? Was anything off about the architecture diagram or the file walkthrough?</p>
<p>Reply directly with anything — even a one-liner helps me decide what to fix next.</p>
<p>— Vineet</p>
"""
    text = (
        f"Hey {name or 'there'} — your first Phantom video has been up for a day. What did you think? "
        "Was the narration in the right ballpark? Reply with anything. — Vineet"
    )
    return _send(to, subject, html, text)


def send_milestone_100_views(to: str, video_id: str, repo: str) -> EmailResult:
    url = f"https://phantom.video/v/{video_id}"
    subject = f"Your video of {repo} just passed 100 views"
    html = f"""\
<p>Nice — your Phantom video of <b>{repo}</b> just passed 100 views.</p>
<p><a href="{url}">See the page →</a></p>
"""
    text = f"Your Phantom video of {repo} just passed 100 views. See it: {url}"
    return _send(to, subject, html, text)
