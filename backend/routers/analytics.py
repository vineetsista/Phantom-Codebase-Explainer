"""Owner analytics — aggregate stats for a signed-in user's videos.

Powers the /dashboard/analytics page. Returns:
  - Total videos generated + by status
  - Total views across all videos + per-video breakdown
  - View count by day (last 30 days) from VideoView rows
  - Top videos by views
  - Engagement: total favorites, reactions, comments
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import Comment, Favorite, Reaction, User, Video, VideoView, get_db
from routers.users import optional_user

router = APIRouter(prefix="/api/v1", tags=["analytics"])


@router.get("/me/analytics")
def owner_analytics(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),
) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in first.")

    videos = db.execute(
        select(Video).where(Video.user_id == user.id)
    ).scalars().all()
    if not videos:
        return {
            "total_videos": 0,
            "total_views": 0,
            "by_status": {},
            "top_videos": [],
            "views_by_day": [],
            "engagement": {"favorites": 0, "reactions": 0, "comments": 0},
        }

    video_ids = [v.id for v in videos]
    by_status: dict[str, int] = {}
    total_views = 0
    for v in videos:
        status_key = v.status.value if hasattr(v.status, "value") else str(v.status)
        by_status[status_key] = by_status.get(status_key, 0) + 1
        total_views += v.view_count or 0

    top_videos = sorted(
        videos, key=lambda v: v.view_count or 0, reverse=True
    )[:10]

    # Views-by-day from VideoView rows (last 30 days).
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    views_by_day_rows = db.execute(
        select(
            func.date(VideoView.created_at).label("day"),
            func.count(VideoView.id).label("n"),
        )
        .where(VideoView.video_id.in_(video_ids), VideoView.created_at >= cutoff)
        .group_by("day")
        .order_by("day")
    ).all()
    views_by_day = [{"day": str(d), "views": int(n)} for d, n in views_by_day_rows]

    # Engagement counts.
    fav_count = db.execute(
        select(func.count(Favorite.id)).where(Favorite.video_id.in_(video_ids))
    ).scalar_one()
    react_count = db.execute(
        select(func.count(Reaction.id)).where(Reaction.video_id.in_(video_ids))
    ).scalar_one()
    comment_count = db.execute(
        select(func.count(Comment.id)).where(
            Comment.video_id.in_(video_ids), Comment.deleted.is_(False)
        )
    ).scalar_one()

    return {
        "total_videos": len(videos),
        "total_views": total_views,
        "by_status": by_status,
        "top_videos": [
            {
                "id": v.id,
                "repo_owner": v.repo_owner,
                "repo_name": v.repo_name,
                "view_count": v.view_count or 0,
                "duration_seconds": v.duration_seconds,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in top_videos
        ],
        "views_by_day": views_by_day,
        "engagement": {
            "favorites": int(fav_count or 0),
            "reactions": int(react_count or 0),
            "comments": int(comment_count or 0),
        },
    }
