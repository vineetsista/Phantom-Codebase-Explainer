from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import Video, VideoStatus, get_db
from utils.github_client import parse_github_url
from workers.tasks import generate_video

router = APIRouter(prefix="/api/v1", tags=["generate"])


class GenerateOptions(BaseModel):
    voice: str = Field(default="openai", pattern=r"^(openai|elevenlabs)$")
    quality: str = Field(default="720p", pattern=r"^(720p|1080p)$")


class GenerateRequest(BaseModel):
    repo_url: str
    options: GenerateOptions = Field(default_factory=GenerateOptions)


class GenerateResponse(BaseModel):
    job_id: str
    status: str


@router.post("/generate", response_model=GenerateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_generation(body: GenerateRequest, db: Session = Depends(get_db)) -> GenerateResponse:
    try:
        owner, name = parse_github_url(body.repo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    video = Video(
        repo_url=body.repo_url,
        repo_owner=owner,
        repo_name=name,
        status=VideoStatus.queued,
        progress=0,
        status_details={"stage": "Queued"},
        voice_provider=body.options.voice,
        video_quality=body.options.quality,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    generate_video.delay(video.id, body.repo_url, body.options.model_dump())

    return GenerateResponse(job_id=video.id, status=video.status.value)
