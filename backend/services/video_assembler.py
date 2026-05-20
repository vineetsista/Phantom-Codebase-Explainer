"""Assemble the final MP4 from a script + audio + diagram.

Primary path: shell out to `npx remotion render` using the project's Remotion
compositions under /app/remotion. The composition reads a props JSON file
containing the script and audio paths.

Fallback path (used when Node/Remotion are unavailable): render a simple
slideshow with ffmpeg — diagram SVG → PNG cover frame, concatenated with the
audio track. Always produces a playable MP4 so the slice is demoable on a
machine without the Remotion toolchain installed.
"""
from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from config import get_settings

logger = logging.getLogger(__name__)


def assemble(
    job_id: str,
    script: dict[str, Any],
    audio_files: list[dict[str, Any]],
    diagram_svg_path: Path,
) -> dict[str, str]:
    """Return {'video_path': str, 'thumbnail_path': str, 'duration_seconds': int}."""
    settings = get_settings()
    output_dir = Path(settings.video_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir = Path(settings.thumbnail_output_dir)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    video_path = output_dir / f"{job_id}.mp4"
    thumbnail_path = thumb_dir / f"{job_id}.png"

    props_path = Path(settings.temp_dir) / job_id / "composition-props.json"
    props_path.parent.mkdir(parents=True, exist_ok=True)
    props_path.write_text(
        json.dumps(
            {
                "script": script,
                "audio": audio_files,
                "diagramSvgPath": str(diagram_svg_path),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    duration = sum(int(s.get("duration_seconds") or 10) for s in script.get("sections", []))

    used_remotion = False
    if _remotion_available(settings.remotion_project_dir):
        try:
            _render_with_remotion(
                settings.remotion_project_dir, props_path, video_path
            )
            used_remotion = True
        except Exception as exc:
            logger.warning("Remotion render failed, falling back to ffmpeg: %s", exc)

    if not used_remotion:
        _render_with_ffmpeg(diagram_svg_path, audio_files, video_path, duration)

    _extract_thumbnail(video_path, thumbnail_path)

    return {
        "video_path": str(video_path),
        "thumbnail_path": str(thumbnail_path),
        "duration_seconds": duration,
    }


def _remotion_available(remotion_dir: str) -> bool:
    if not shutil.which("npx"):
        return False
    project = Path(remotion_dir)
    if not (project / "package.json").exists():
        return False
    if not (project / "node_modules").exists():
        return False
    return True


def _render_with_remotion(
    remotion_dir: str, props_path: Path, video_path: Path
) -> None:
    cmd = [
        "npx",
        "remotion",
        "render",
        "src/index.ts",
        "PhantomVideo",
        str(video_path),
        f"--props={props_path}",
        "--codec=h264",
        "--image-format=jpeg",
        "--log=warn",
    ]
    logger.info("Running Remotion render: %s", " ".join(cmd))
    subprocess.run(cmd, cwd=remotion_dir, check=True, timeout=600)


def _render_with_ffmpeg(
    diagram_svg_path: Path,
    audio_files: list[dict[str, Any]],
    video_path: Path,
    duration: int,
) -> None:
    """Minimal fallback: convert the diagram SVG to a PNG and concat all
    audio segments under it. Single static frame for the whole video — not
    pretty, but provably playable end-to-end."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "Neither Remotion nor ffmpeg is available — cannot assemble video"
        )

    work = video_path.parent / f".{video_path.stem}-work"
    work.mkdir(parents=True, exist_ok=True)
    cover_png = work / "cover.png"

    # Convert SVG → PNG via ffmpeg (works for simple SVGs; ours is hand-rolled).
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(diagram_svg_path),
            "-vf",
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0A0A0B",
            str(cover_png),
        ],
        check=True,
        capture_output=True,
    )

    # Concatenate audio segments.
    audio_list = work / "audio-list.txt"
    audio_list.write_text(
        "\n".join(f"file '{Path(a['audio_path']).as_posix()}'" for a in audio_files),
        encoding="utf-8",
    )
    combined_audio = work / "combined.mp3"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(audio_list),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(combined_audio),
        ],
        check=True,
        capture_output=True,
    )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(cover_png),
            "-i",
            str(combined_audio),
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-shortest",
            "-t",
            str(max(duration, 5)),
            str(video_path),
        ],
        check=True,
        capture_output=True,
    )

    shutil.rmtree(work, ignore_errors=True)


def _extract_thumbnail(video_path: Path, thumbnail_path: Path) -> None:
    if not shutil.which("ffmpeg") or not video_path.exists():
        return
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(video_path),
                "-vf",
                "thumbnail,scale=1280:720",
                "-frames:v",
                "1",
                str(thumbnail_path),
            ],
            check=True,
            capture_output=True,
            timeout=30,
        )
    except Exception as exc:
        logger.warning("Thumbnail extraction failed: %s", exc)
