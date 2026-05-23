from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from config import get_settings
from models import SessionLocal, Video, VideoStatus
from services import (
    diagram_generator,
    frame_extractor,
    repo_analyzer,
    script_generator,
    summary_generator,
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
    # `options.voice` may be None (API didn't force a provider). Let the
    # voice_generator resolve from DEFAULT_VOICE then auto-detect.
    requested_voice = options.get("voice")
    quality = options.get("quality") or settings.default_quality
    logger.info(
        "generate_video start job=%s repo=%s voice_request=%s quality=%s",
        job_id, repo_url, requested_voice, quality,
    )

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

        # v6 — written summary via Haiku. Best-effort: a failure here
        # never blocks video generation. Stored on the same Video row
        # for the /video/[id]/summary page to read.
        try:
            summary = summary_generator.generate_summary(analysis)
            if summary:
                _update(job_id, summary_data=summary)
                logger.info("job=%s wrote summary_data (%d chars)",
                            job_id, len(summary.get("markdown", "")))
        except Exception as exc:
            logger.warning("summary generation failed (non-fatal): %s", exc)

        # v7 — quality signals snapshot. Read-only derivation from the
        # analysis. Render below the video player as a card panel.
        try:
            qs = analysis.quality_signals or {}
            if qs:
                _update(job_id, quality_signals=qs)
                logger.info("job=%s wrote %d quality signals", job_id, len(qs))
        except Exception as exc:
            logger.warning("quality_signals persist failed (non-fatal): %s", exc)

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
        resolved_voice, voice_reason = voice_generator.resolve_provider(requested_voice)
        _update(
            job_id,
            status=VideoStatus.voiceover,
            progress=70,
            details={
                "stage": "Generating voiceover",
                "voice_provider": resolved_voice,
                "voice_reason": voice_reason,
            },
            voice_provider=resolved_voice,
        )
        logger.info(
            "job=%s voice provider resolved: %s (%s)",
            job_id, resolved_voice, voice_reason,
        )
        audio_files = voice_generator.generate(script, job_id, provider=resolved_voice)
        logger.info(
            "job=%s voiceover produced %d segments",
            job_id, len(audio_files),
        )

        # Replace each section's estimated duration with the real audio
        # length (measured via ffprobe in voice_generator). Sections whose
        # narration was empty are dropped here, not silently rendered as
        # dead air. Per-section timing telemetry lands in the worker log so
        # we can spot drift between estimate and actual.
        SCENE_TRAILING_BUFFER_S = 1.0
        SCENE_TRANSITION_S = 0.3
        voice_generator.apply_actual_durations(script, audio_files)
        # Anchor each architecture module + each code highlight to the
        # actual moment its name is spoken (via ElevenLabs character-
        # level alignment). The script_generator's narration_start_seconds
        # are guesses; this overwrites them with truth.
        voice_generator.sync_visuals_to_alignment(script, audio_files)
        for section in script.get("sections", []):
            sid = section.get("id", "<unknown>")
            estimated = float(section.get("duration_seconds") or 0)
            actual = float(section.get("audio_duration_seconds") or 0)
            scene_dur = round(actual + SCENE_TRAILING_BUFFER_S, 3)
            logger.info(
                "job=%s section=%s estimated=%.2fs actual=%.2fs "
                "scene_duration=%.2fs transition_buffer=%.2fs",
                job_id, sid, estimated, actual, scene_dur, SCENE_TRAILING_BUFFER_S,
            )

        # Persist the corrected script (now carrying audio_duration_seconds
        # per section, empty sections removed) so the frontend chapter list
        # and any future re-render uses the truth, not the estimate.
        _update(
            job_id,
            details={"stage": "Voiceover complete", "sections": len(script.get("sections", []))},
            script_data=script,
        )

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

        # Stage 6 — finalize. The assembler mutated `script` in place to
        # add the canonical chapters list — re-persist script_data so the
        # frontend sees chapters alongside the completed video URL.
        _update(
            job_id,
            status=VideoStatus.complete,
            progress=100,
            details={"stage": "Complete"},
            script_data=script,
            video_url=f"/media/videos/{Path(output['video_path']).name}",
            thumbnail_url=f"/media/thumbnails/{Path(output['thumbnail_path']).name}",
            duration_seconds=output["duration_seconds"],
            video_quality=quality,
            completed_at=datetime.utcnow(),
        )

        # v7 — extract OG frames after the video is finalized. Best-effort:
        # never block the job's completion on this. The OG card composer
        # at /api/og?id=... reads them; if missing it falls back to a
        # repo-metadata-only card.
        try:
            frames_dir = Path(settings.video_output_dir).parent / "frames" / job_id
            frame_extractor.extract_frames(
                Path(output["video_path"]),
                frames_dir,
                float(output["duration_seconds"]),
            )
        except Exception as exc:
            logger.warning("Frame extraction failed (non-fatal): %s", exc)

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
