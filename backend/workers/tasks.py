from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from config import get_settings
from models import SessionLocal, Video, VideoStatus
from services import (
    diagram_generator,
    repo_analyzer,
    script_generator,
    video_assembler,
    voice_generator,
)
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _update(
    job_id: str,
    *,
    status: VideoStatus | None = None,
    progress: int | None = None,
    details: dict[str, Any] | None = None,
    **fields: Any,
) -> None:
    with SessionLocal() as db:
        video = db.get(Video, job_id)
        if not video:
            return
        if status is not None:
            video.status = status
        if progress is not None:
            video.progress = progress
        if details is not None:
            existing = video.status_details or {}
            existing.update(details)
            video.status_details = existing
        for key, value in fields.items():
            setattr(video, key, value)
        db.commit()


@celery_app.task(bind=True, name="phantom.generate_video")
def generate_video(self, job_id: str, repo_url: str, options: dict[str, Any]) -> dict[str, Any]:
    """End-to-end pipeline: analyze → script → diagram → voice → assemble."""
    settings = get_settings()
    voice_provider = options.get("voice") or settings.default_voice
    quality = options.get("quality") or settings.default_quality

    try:
        # Stage 1 — clone & analyze
        _update(
            job_id,
            status=VideoStatus.analyzing,
            progress=10,
            details={"stage": "Cloning repository"},
        )
        try:
            analysis = repo_analyzer.analyze(repo_url)
        except Exception as exc:
            logger.warning("Clone/analysis failed, using mock: %s", exc)
            analysis = repo_analyzer.mock_analysis(repo_url)

        _update(
            job_id,
            status=VideoStatus.analyzing,
            progress=25,
            details={
                "stage": "Analyzed repository",
                "summary": analysis.summary,
            },
            analysis_data=analysis.to_dict(),
            repo_name=analysis.repo.get("name", ""),
            repo_owner=analysis.repo.get("owner", ""),
            repo_description=analysis.repo.get("description", ""),
            repo_stars=int(analysis.repo.get("stars") or 0),
            repo_language=analysis.repo.get("primary_language") or "",
        )

        # Stage 2 — script
        _update(
            job_id,
            status=VideoStatus.scripting,
            progress=40,
            details={"stage": "Writing narration script"},
        )
        script = script_generator.generate(analysis)
        _update(
            job_id,
            status=VideoStatus.scripting,
            progress=55,
            details={"stage": "Script ready", "title": script.get("title", "")},
            script_data=script,
        )

        # Stage 3 — diagram
        _update(
            job_id,
            status=VideoStatus.diagramming,
            progress=62,
            details={"stage": "Drawing architecture diagram"},
        )
        diagram_path = (
            Path(settings.temp_dir) / job_id / "architecture.svg"
        )
        diagram_generator.generate(analysis, diagram_path)

        # Stage 4 — voiceover
        _update(
            job_id,
            status=VideoStatus.voiceover,
            progress=70,
            details={"stage": "Generating voiceover"},
            voice_provider=voice_provider,
        )
        audio_files = voice_generator.generate(script, job_id, provider=voice_provider)

        # Stage 5 — assemble
        _update(
            job_id,
            status=VideoStatus.rendering,
            progress=85,
            details={"stage": "Rendering video"},
        )
        output = video_assembler.assemble(
            job_id, script, audio_files, diagram_path
        )

        # Stage 6 — finalize
        _update(
            job_id,
            status=VideoStatus.complete,
            progress=100,
            details={"stage": "Complete"},
            video_url=f"/media/videos/{Path(output['video_path']).name}",
            thumbnail_url=f"/media/thumbnails/{Path(output['thumbnail_path']).name}",
            duration_seconds=output["duration_seconds"],
            video_quality=quality,
            completed_at=datetime.utcnow(),
        )
        return {"video_url": output["video_path"], "duration": output["duration_seconds"]}
    except Exception as exc:
        logger.exception("Generation failed for job %s", job_id)
        _update(
            job_id,
            status=VideoStatus.failed,
            error_message=str(exc),
            details={"stage": "Failed", "error": str(exc)},
        )
        raise
