from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Video, get_db

router = APIRouter(prefix="/api/v1", tags=["videos"])


@router.get("/videos")
def list_videos(db: Session = Depends(get_db), limit: int = 50) -> dict:
    stmt = select(Video).order_by(Video.created_at.desc()).limit(limit)
    videos = db.execute(stmt).scalars().all()
    return {"videos": [v.to_dict() for v in videos]}


@router.get("/videos/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)) -> dict:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.view_count = (video.view_count or 0) + 1
    db.commit()
    return {"video": video.to_dict()}


@router.delete("/videos/{video_id}")
def delete_video(video_id: str, db: Session = Depends(get_db)) -> dict:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    db.delete(video)
    db.commit()
    return {"success": True}


@router.get("/videos/{video_id}/summary")
def get_video_summary(video_id: str, db: Session = Depends(get_db)) -> dict:
    """v6 — written summary companion. Returns the Haiku-generated
    summary if it exists; otherwise 404 (frontend can fall back to a
    "Summary not yet generated" placeholder)."""
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.summary_data:
        raise HTTPException(status_code=404, detail="Summary not generated yet")
    return {
        "video_id": video.id,
        "repo_owner": video.repo_owner,
        "repo_name": video.repo_name,
        "summary": video.summary_data,
    }


@router.get("/repo/{owner}/{name}")
def get_videos_for_repo(owner: str, name: str, db: Session = Depends(get_db)) -> dict:
    """v6 — list all completed videos for owner/name. Powers the
    /repo/[owner]/[repo] page where every analyzed repo lives."""
    stmt = (
        select(Video)
        .where(Video.repo_owner == owner, Video.repo_name == name)
        .order_by(Video.created_at.desc())
    )
    videos = db.execute(stmt).scalars().all()
    return {"videos": [v.to_dict() for v in videos]}
