import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Generator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from models import init_db
from routers import api_keys, badge, billing, generate, social, status, users, videos

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("phantom.api")


# v7g — Sentry init. Enabled when SENTRY_DSN is set; silent otherwise.
# Done at module import time so any error during FastAPI startup
# (database connection failures, etc.) is captured. sentry-sdk is an
# optional dep — if it's not installed we just warn and continue.
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    try:
        import sentry_sdk  # type: ignore
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration  # type: ignore

        sentry_sdk.init(
            dsn=_sentry_dsn,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
            profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
            send_default_pii=False,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        )
        logger.info("Sentry initialized")
    except Exception as exc:
        logger.warning("Sentry init failed (%s) — continuing without", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Phantom API")
    init_db()
    yield
    logger.info("Shutting down Phantom API")


app = FastAPI(
    title="Phantom API",
    description="Codebase intelligence — generate animated explainers from any GitHub repo.",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router)
app.include_router(status.router)
app.include_router(videos.router)
app.include_router(users.router)
app.include_router(billing.router)
app.include_router(badge.router)
app.include_router(api_keys.router)
app.include_router(social.router)

# Serve generated MP4s and thumbnails so the frontend can <video src=...>
Path(settings.video_output_dir).mkdir(parents=True, exist_ok=True)
Path(settings.thumbnail_output_dir).mkdir(parents=True, exist_ok=True)


# --- Range-aware video serving ------------------------------------------------
# FastAPI's StaticFiles mount returns HTTP 200 with the full body for every
# request, even when the client sends a Range header. Browsers REQUIRE 206
# Partial Content responses to enable timeline seeking on <video> — without
# them the only thing that works is sequential playback from frame 0. That's
# the "scrubber doesn't work" bug.
#
# Implementing the protocol by hand because StaticFiles can't be subclassed
# cleanly to add Range support and the FileResponse helper doesn't honor
# Range either. The handler below:
#   - Parses Range: bytes=START-END (single-range only, which covers every
#     real <video> client in practice)
#   - Returns 206 with Content-Range, Content-Length, and the requested
#     byte window streamed in 64 KB chunks
#   - Returns 200 + full body when no Range header is present
#   - Returns 416 Range Not Satisfiable when the range is malformed or
#     beyond the file end
_RANGE_RE = re.compile(r"^bytes=(\d+)-(\d*)$")
_CHUNK = 64 * 1024


def _iter_file(path: Path, start: int, end: int) -> Generator[bytes, None, None]:
    """Stream `path` from byte `start` to byte `end` inclusive."""
    remaining = end - start + 1
    with open(path, "rb") as fp:
        fp.seek(start)
        while remaining > 0:
            data = fp.read(min(_CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@app.head("/media/videos/{filename:path}")
async def head_video(filename: str) -> StreamingResponse:
    """HEAD support — some clients (curl -I, link previewers) probe before
    fetching. Returning 405 made our Range diagnostics noisier than they
    needed to be."""
    base = Path(settings.video_output_dir).resolve()
    target = (base / filename).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    file_size = target.stat().st_size
    return StreamingResponse(
        iter(()),
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get("/media/videos/{filename:path}")
async def serve_video(filename: str, request: Request) -> StreamingResponse:
    """Range-aware MP4 server. Required for HTML5 <video> timeline seeking."""
    # Reject any path that tries to escape the videos directory. `..` and
    # absolute paths both get rejected via the resolve-vs-resolve check.
    base = Path(settings.video_output_dir).resolve()
    target = (base / filename).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    file_size = target.stat().st_size
    range_header = request.headers.get("range") or request.headers.get("Range")

    if not range_header:
        # No Range request — serve the whole file as 200. Browser will
        # still buffer linearly but seeking is enabled by the moov atom
        # being at the front of the file.
        return StreamingResponse(
            _iter_file(target, 0, file_size - 1),
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "public, max-age=3600",
            },
        )

    match = _RANGE_RE.match(range_header.strip())
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range")
    start = int(match.group(1))
    end_str = match.group(2)
    end = int(end_str) if end_str else file_size - 1
    if start > end or start >= file_size:
        raise HTTPException(
            status_code=416,
            detail=f"Range {start}-{end} not satisfiable for file of {file_size} bytes",
        )
    end = min(end, file_size - 1)
    content_length = end - start + 1

    return StreamingResponse(
        _iter_file(target, start, end),
        status_code=206,
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
            "Cache-Control": "public, max-age=3600",
        },
    )


# Thumbnails — small PNGs, no Range needed.
app.mount(
    "/media/thumbnails",
    StaticFiles(directory=settings.thumbnail_output_dir),
    name="thumbnails",
)

# v7 — per-video OG frames (4 JPGs per job under frames/{job_id}/).
# Same parent dir as videos. Mount as static so the OG card endpoint can
# fetch them via HTTP without going through the FastAPI router.
_frames_dir = Path(settings.video_output_dir).parent / "frames"
_frames_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media/frames", StaticFiles(directory=str(_frames_dir)), name="frames")


@app.get("/")
def root() -> dict:
    return {
        "name": "Phantom API",
        "version": "0.1.0",
        "claude_configured": settings.has_claude,
        "openai_configured": settings.has_openai,
        "elevenlabs_configured": settings.has_elevenlabs,
    }


@app.get("/healthz")
@app.get("/health")
def health() -> dict:
    """Health check. Mounted at /healthz (Kubernetes-style) and /health
    (Railway / Render / Fly default)."""
    return {"status": "ok"}
