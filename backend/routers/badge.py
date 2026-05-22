"""README badge SVG endpoint.

Any maintainer can paste this into their README:

  [![Watch on Phantom](https://phantom.video/api/badge/owner/repo.svg)](
    https://phantom.video/repo/owner/repo
  )

The badge renders as a small inline image with a Phantom mark + "Watch
the video walkthrough" label + current view count. It's a viral
mechanic — every README in the wild is a permanent backlink.

Implementation note: the badge is fully server-rendered SVG with no
external assets so it works in any markdown renderer (GitHub renders
SVG; PyPI renders SVG; npm renders SVG). View counts pull from the most
recent video for that repo.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from models import Video, get_db

router = APIRouter(prefix="/api/badge", tags=["badge"])


_BADGE_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="20" role="img" aria-label="Watch on Phantom · {views} views">
  <title>Watch on Phantom · {views} views</title>
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a"><rect width="{width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#a)">
    <rect width="{left_w}" height="20" fill="#11111a"/>
    <rect x="{left_w}" width="{right_w}" height="20" fill="#00f0ff"/>
    <rect width="{width}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="{left_text_x}" y="15" fill="#000" fill-opacity=".3">{left_label}</text>
    <text x="{left_text_x}" y="14">{left_label}</text>
    <text x="{right_text_x}" y="15" fill="#000" fill-opacity=".3">{right_label}</text>
    <text x="{right_text_x}" y="14" fill="#0a0a0b">{right_label}</text>
  </g>
</svg>
"""


def _approx_text_width(text: str, font_size: int = 11) -> int:
    """Crude width estimator. Verdana 11px averages ~6.5px/char for
    lowercase, ~8.5px for uppercase + digits. Returns pixels."""
    width = 0.0
    for ch in text:
        if ch.isupper() or ch.isdigit():
            width += 7.5
        elif ch == " ":
            width += 4.0
        else:
            width += 6.5
    return int(width)


def _format_views(views: int) -> str:
    """1500 → '1.5K', 1_200_000 → '1.2M'."""
    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f}M"
    if views >= 1_000:
        return f"{views / 1_000:.1f}K"
    return str(views)


@router.get("/{owner}/{repo}.svg")
def render_badge(
    owner: str,
    repo: str,
    db: Session = Depends(get_db),
) -> Response:
    """Render the badge SVG for owner/repo. Looks up the most recent
    completed video for the repo and shows its view count; otherwise
    shows '0 views'."""
    video = (
        db.query(Video)
        .filter(Video.repo_owner == owner, Video.repo_name == repo)
        .order_by(Video.created_at.desc())
        .first()
    )
    views = video.view_count if video else 0

    left_label = "watch on phantom"
    right_label = f"{_format_views(views)} views"

    left_w = _approx_text_width(left_label) + 12
    right_w = _approx_text_width(right_label) + 12
    width = left_w + right_w

    svg = _BADGE_TEMPLATE.format(
        width=width,
        left_w=left_w,
        right_w=right_w,
        left_text_x=left_w // 2,
        right_text_x=left_w + right_w // 2,
        left_label=left_label,
        right_label=right_label,
        views=views,
    )

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            # Cache 5 min so view counts update reasonably fast without
            # hammering the DB. SVG is tiny so cache size isn't a concern.
            "Cache-Control": "public, max-age=300, s-maxage=300",
        },
    )
