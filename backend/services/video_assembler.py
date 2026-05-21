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


MUSIC_REL_PATH = "music/ambient.mp3"


def _detect_music_src(remotion_project_dir: str) -> str | None:
    """If the brand ambient bed exists under the shared frontend public/ folder
    (one level up from the Remotion package), pass its relative path to the
    composition so MusicBed can render it. Falls back to no music if absent."""
    public_dir = Path(remotion_project_dir).parent / "public"
    if (public_dir / MUSIC_REL_PATH).is_file():
        return MUSIC_REL_PATH
    return None


def assemble(
    job_id: str,
    script: dict[str, Any],
    audio_files: list[dict[str, Any]],
    diagram_svg_path: Path,
) -> dict[str, str]:
    """Return {'video_path': str, 'thumbnail_path': str, 'duration_seconds': int}."""
    logger.info(
        "assemble start job=%s sections=%d audio_segments=%d diagram=%s",
        job_id, len(script.get("sections", [])), len(audio_files), diagram_svg_path,
    )

    settings = get_settings()
    output_dir = Path(settings.video_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir = Path(settings.thumbnail_output_dir)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    video_path = output_dir / f"{job_id}.mp4"
    thumbnail_path = thumb_dir / f"{job_id}.png"

    music_src = _detect_music_src(settings.remotion_project_dir)
    logger.info("assemble job=%s music_src=%s", job_id, music_src)

    # Remotion's renderer can't load `file://` URIs — it explicitly rejects
    # anything not http/https in `@remotion/renderer/.../download-file.js`.
    # Copy each per-job audio file into the shared publicDir so the scenes
    # can reference them via `staticFile("jobs/<id>/audio/intro.mp3")`, which
    # resolves to a localhost URL the bundled Chromium can fetch.
    public_dir = Path(settings.remotion_project_dir).parent / "public"
    public_audio_dir = public_dir / "jobs" / job_id / "audio"
    public_audio_dir.mkdir(parents=True, exist_ok=True)

    audio_for_props: list[dict[str, Any]] = []
    for entry in audio_files:
        copy = dict(entry)
        raw = entry.get("audio_path", "")
        if raw:
            src_path = Path(raw).resolve()
            if src_path.is_file():
                dst_path = public_audio_dir / src_path.name
                try:
                    shutil.copyfile(src_path, dst_path)
                except OSError as exc:
                    logger.warning(
                        "assemble job=%s failed to copy %s → %s: %s",
                        job_id, src_path, dst_path, exc,
                    )
                    dst_path = src_path
                # staticFile() resolves relative paths under publicDir → URL.
                rel = f"jobs/{job_id}/audio/{src_path.name}"
                copy["audio_path"] = rel
            else:
                logger.warning(
                    "assemble job=%s referenced audio missing on disk: %s",
                    job_id, src_path,
                )
                copy["audio_path"] = ""
        audio_for_props.append(copy)

    abs_diagram = str(Path(diagram_svg_path).resolve()) if diagram_svg_path else ""

    props_path = Path(settings.temp_dir) / job_id / "composition-props.json"
    props_path.parent.mkdir(parents=True, exist_ok=True)
    props_path.write_text(
        json.dumps(
            {
                "script": script,
                "audio": audio_for_props,
                "diagramSvgPath": abs_diagram,
                "musicSrc": music_src,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info(
        "assemble job=%s props written to %s (audio_count=%d, public_audio_dir=%s)",
        job_id, props_path.resolve(), len(audio_for_props), public_audio_dir,
    )

    duration = sum(int(s.get("duration_seconds") or 10) for s in script.get("sections", []))
    logger.info("assemble job=%s total_duration_seconds=%d", job_id, duration)

    used_remotion = False
    if _remotion_available(settings.remotion_project_dir):
        logger.info("assemble job=%s attempting Remotion render", job_id)
        try:
            _render_with_remotion(
                settings.remotion_project_dir, props_path, video_path
            )
            used_remotion = True
            logger.info("assemble job=%s Remotion render succeeded", job_id)
        except Exception as exc:
            logger.warning(
                "assemble job=%s Remotion render failed, falling back to ffmpeg: %s",
                job_id, exc,
            )

    if not used_remotion:
        logger.info("assemble job=%s rendering with ffmpeg fallback path", job_id)
        _render_with_ffmpeg(diagram_svg_path, audio_files, video_path, duration)

    if not video_path.exists() or video_path.stat().st_size == 0:
        raise RuntimeError(
            f"Video render finished but {video_path} is missing or empty"
        )
    logger.info(
        "assemble job=%s wrote video=%s (%d bytes)",
        job_id, video_path, video_path.stat().st_size,
    )

    _extract_thumbnail(video_path, thumbnail_path)
    if thumbnail_path.exists():
        logger.info(
            "assemble job=%s wrote thumbnail=%s (%d bytes)",
            job_id, thumbnail_path, thumbnail_path.stat().st_size,
        )

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
    # Remotion's CLI is invoked with cwd=remotion_dir; the props file and the
    # output video live under the worker's working tree, not under
    # remotion_dir. Pass absolute paths so the CLI doesn't try to resolve
    # them relative to /app/remotion.
    abs_props = props_path.resolve()
    abs_video = video_path.resolve()
    abs_video.parent.mkdir(parents=True, exist_ok=True)

    # The CLI's resolution of publicDir from remotion.config.ts has been
    # inconsistent in some builds — the bundle came up with no `public/`
    # subdirectory even when Config.setPublicDir was set. Passing it
    # explicitly on the CLI is the durable fix.
    public_dir = (Path(remotion_dir).parent / "public").resolve()

    cmd = [
        "npx",
        "remotion",
        "render",
        "src/index.ts",
        "PhantomVideo",
        str(abs_video),
        f"--props={abs_props}",
        f"--public-dir={public_dir}",
        "--codec=h264",
        "--image-format=jpeg",
        "--log=warn",
    ]
    logger.info("Running Remotion render: %s", " ".join(cmd))
    proc = subprocess.run(
        cmd,
        cwd=remotion_dir,
        timeout=900,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"remotion render exited {proc.returncode}\n"
            f"stdout: {proc.stdout[-2000:]}\n"
            f"stderr: {proc.stderr[-2000:]}"
        )
    if not abs_video.is_file() or abs_video.stat().st_size == 0:
        raise RuntimeError(
            f"remotion render reported success but {abs_video} is missing or empty"
        )


def _run_ffmpeg(cmd: list[str], step: str) -> subprocess.CompletedProcess:
    """Run an ffmpeg subprocess. On non-zero exit, surface the last few KB of
    stderr in the raised RuntimeError so the failure is debuggable from the
    Celery logs without re-running."""
    logger.info("ffmpeg [%s] %s", step, " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = (proc.stderr or "")[-3000:]
        logger.error(
            "ffmpeg [%s] failed exit=%d\nstderr (tail):\n%s",
            step, proc.returncode, tail,
        )
        raise RuntimeError(
            f"ffmpeg [{step}] exited {proc.returncode}: {tail.strip() or '<no stderr>'}"
        )
    return proc


def _prepare_audio_segments(
    audio_files: list[dict[str, Any]],
    work: Path,
) -> list[Path]:
    """Validate every audio segment exists and is non-empty. Replace anything
    missing or zero-byte with a silent MP3 of the right duration so the
    downstream `ffmpeg -f concat` always has real input."""
    work.mkdir(parents=True, exist_ok=True)
    prepared: list[Path] = []

    for index, entry in enumerate(audio_files):
        section_id = entry.get("section_id", f"section-{index}")
        duration = max(1, int(entry.get("duration_seconds") or 10))
        raw_path = Path(entry.get("audio_path", ""))

        if raw_path.is_file() and raw_path.stat().st_size > 0:
            logger.info(
                "audio segment %s ok (path=%s size=%d)",
                section_id, raw_path, raw_path.stat().st_size,
            )
            prepared.append(raw_path)
            continue

        # Missing or empty — synthesize a silent placeholder.
        placeholder = work / f"silent-{section_id}.mp3"
        logger.warning(
            "audio segment %s missing/empty (raw=%s exists=%s size=%d) — "
            "generating %ds silent placeholder at %s",
            section_id,
            raw_path,
            raw_path.exists(),
            raw_path.stat().st_size if raw_path.exists() else 0,
            duration,
            placeholder,
        )
        _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-f", "lavfi",
                "-i", f"anullsrc=channel_layout=mono:sample_rate=22050",
                "-t", str(duration),
                "-c:a", "libmp3lame",
                "-q:a", "9",
                str(placeholder),
            ],
            step=f"silent-{section_id}",
        )
        if not placeholder.is_file() or placeholder.stat().st_size == 0:
            raise RuntimeError(
                f"Failed to synthesize silent placeholder for section {section_id}"
            )
        prepared.append(placeholder)

    if not prepared:
        # Edge case — script had zero sections. Render at least a 5s silent
        # bed so the static-frame video still has audio.
        placeholder = work / "silent-fallback.mp3"
        logger.warning(
            "no audio segments provided to assembler — writing 5s silent fallback"
        )
        _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-f", "lavfi",
                "-i", "anullsrc=channel_layout=mono:sample_rate=22050",
                "-t", "5",
                "-c:a", "libmp3lame",
                "-q:a", "9",
                str(placeholder),
            ],
            step="silent-fallback",
        )
        prepared.append(placeholder)

    return prepared


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
    logger.info("ffmpeg fallback: rasterizing diagram %s → %s", diagram_svg_path, cover_png)
    if not diagram_svg_path.is_file():
        raise RuntimeError(
            f"Diagram SVG missing at {diagram_svg_path} — cannot build cover frame"
        )
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i", str(diagram_svg_path),
            "-vf",
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0A0A0B",
            str(cover_png),
        ],
        step="svg-to-png",
    )

    # Validate + repair audio segments before the concat step.
    logger.info("ffmpeg fallback: validating %d audio segments", len(audio_files))
    prepared_paths = _prepare_audio_segments(audio_files, work / "audio")

    # Write the concat manifest with ABSOLUTE paths. ffmpeg's concat demuxer
    # resolves relative entries against the manifest file's parent directory
    # (not the ffmpeg CWD), so a relative entry like 'output/temp/.../x.wav'
    # gets looked up at '<manifest_dir>/output/temp/.../x.wav' — almost never
    # what we want. Resolve to absolute up front and keep this simple.
    audio_list = work / "audio-list.txt"
    audio_list.write_text(
        "\n".join(
            "file '{}'".format(p.resolve().as_posix().replace("'", "'\\''"))
            for p in prepared_paths
        ),
        encoding="utf-8",
    )
    logger.info(
        "ffmpeg fallback: concat manifest %s lists %d files (first=%s)",
        audio_list,
        len(prepared_paths),
        prepared_paths[0].resolve() if prepared_paths else "<none>",
    )

    combined_audio = work / "combined.mp3"
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(audio_list),
            "-c:a", "libmp3lame",
            "-q:a", "4",
            str(combined_audio),
        ],
        step="audio-concat",
    )
    if not combined_audio.is_file() or combined_audio.stat().st_size == 0:
        raise RuntimeError(
            f"audio concat finished but {combined_audio} is missing or empty"
        )
    logger.info(
        "ffmpeg fallback: combined audio %s (%d bytes)",
        combined_audio, combined_audio.stat().st_size,
    )

    logger.info(
        "ffmpeg fallback: muxing video duration=%ds → %s",
        max(duration, 5), video_path,
    )
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-loop", "1",
            "-i", str(cover_png),
            "-i", str(combined_audio),
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            "-t", str(max(duration, 5)),
            str(video_path),
        ],
        step="mux-video",
    )

    if not video_path.is_file() or video_path.stat().st_size == 0:
        raise RuntimeError(
            f"final mux finished but {video_path} is missing or empty"
        )

    shutil.rmtree(work, ignore_errors=True)


def _extract_thumbnail(video_path: Path, thumbnail_path: Path) -> None:
    if not shutil.which("ffmpeg") or not video_path.exists():
        return
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", str(video_path),
                "-vf", "thumbnail,scale=1280:720",
                "-frames:v", "1",
                str(thumbnail_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            logger.warning(
                "Thumbnail extraction returned %d, stderr tail:\n%s",
                proc.returncode, (proc.stderr or "")[-2000:],
            )
    except Exception as exc:
        logger.warning("Thumbnail extraction failed: %s", exc)
