from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import Video, get_db

router = APIRouter(prefix="/api/v1", tags=["status"])


@router.get("/status/{job_id}")
def get_status(job_id: str, db: Session = Depends(get_db)) -> dict:
    video = db.get(Video, job_id)
    if not video:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": video.id,
        "status": video.status.value,
        "progress": video.progress,
        "details": video.status_details or {},
        "error": video.error_message or None,
        "video_url": video.video_url or None,
        "thumbnail_url": video.thumbnail_url or None,
        "repo_name": video.repo_name,
        "repo_owner": video.repo_owner,
    }
