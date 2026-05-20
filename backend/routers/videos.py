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
