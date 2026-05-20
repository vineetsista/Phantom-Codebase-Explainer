import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import get_settings
from models import init_db
from routers import generate, status, videos

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("phantom.api")


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

# Serve generated MP4s and thumbnails so the frontend can <video src=...>
Path(settings.video_output_dir).mkdir(parents=True, exist_ok=True)
Path(settings.thumbnail_output_dir).mkdir(parents=True, exist_ok=True)
app.mount(
    "/media/videos",
    StaticFiles(directory=settings.video_output_dir),
    name="videos",
)
app.mount(
    "/media/thumbnails",
    StaticFiles(directory=settings.thumbnail_output_dir),
    name="thumbnails",
)


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
def healthz() -> dict:
    return {"status": "ok"}
