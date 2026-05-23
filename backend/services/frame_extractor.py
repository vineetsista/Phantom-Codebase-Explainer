"""Extract 4 representative frames from a finished MP4 for OG card use.

Runs after the main pipeline finalizes. Best-effort — a failure here
never blocks the video from being marked complete. Frames are saved to
{output}/frames/{job_id}/{0..3}.jpg at 320x180 (16:9 thumb-sized).

The OG card composer in /api/og?id=... reads these frames and lays them
out as a horizontal strip below the metadata.

Frame positions: 15%, 40%, 65%, 90% of duration. The 15% catches the
end of intro, 40% lands in architecture, 65% lands in code walkthrough,
90% catches the outro takeaway cards.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

FRAME_POSITIONS = (0.15, 0.40, 0.65, 0.90)
FRAME_WIDTH = 320
FRAME_HEIGHT = 180


def extract_frames(video_path: Path, out_dir: Path, duration_seconds: float) -> list[Path]:
    """Extract 4 frames from `video_path` into `out_dir`. Returns the list
    of paths actually written (empty list on total failure)."""
    if not shutil.which("ffmpeg"):
        logger.warning("frame_extractor: ffmpeg not on PATH; skipping")
        return []
    if not video_path.is_file() or duration_seconds <= 0:
        return []

    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for i, pos in enumerate(FRAME_POSITIONS):
        t = max(0.5, min(duration_seconds - 0.5, duration_seconds * pos))
        out = out_dir / f"{i}.jpg"
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{t:.2f}",
            "-i", str(video_path),
            "-vframes", "1",
            "-vf", f"scale={FRAME_WIDTH}:{FRAME_HEIGHT}:force_original_aspect_ratio=cover,crop={FRAME_WIDTH}:{FRAME_HEIGHT}",
            "-q:v", "3",
            "-loglevel", "error",
            str(out),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            if proc.returncode == 0 and out.is_file() and out.stat().st_size > 0:
                paths.append(out)
            else:
                logger.warning(
                    "frame_extractor: ffmpeg failed at t=%.2fs: %s",
                    t, (proc.stderr or "")[:200],
                )
        except subprocess.TimeoutExpired:
            logger.warning("frame_extractor: ffmpeg timed out at t=%.2fs", t)
    logger.info(
        "frame_extractor: extracted %d/%d frames for %s",
        len(paths), len(FRAME_POSITIONS), video_path.name,
    )
    return paths
