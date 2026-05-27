from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    elevenlabs_api_key: str = ""
    github_token: str = ""

    database_url: str = "postgresql://phantom:phantom@db:5432/phantom"
    redis_url: str = "redis://redis:6379/0"

    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/0"

    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    secret_key: str = "dev-only-change-me"

    video_output_dir: str = "./output/videos"
    thumbnail_output_dir: str = "./output/thumbnails"
    temp_dir: str = "./output/temp"
    repos_dir: str = "./output/repos"
    max_repo_size_mb: int = 100
    default_voice: str = "openai"
    default_quality: str = "720p"
    # v6 — switched from Brian to Antoni per user request.
    # Brian: nPczCjzI2devNBz1zQrb  (previous default, warm male)
    # Antoni: ErXwobaYiN019PkySvjV  (younger, more energetic male)
    # Rachel: 21m00Tcm4TlvDq8ikWAM  (clear female)
    # Adam:   pNInz6obpgDQGcFmaJgB  (deep authoritative male)
    # Override per-deployment via DEFAULT_ELEVENLABS_VOICE_ID env var to
    # A/B test without changing code. The phonetic jargon dict applies
    # to whichever voice is selected.
    default_elevenlabs_voice_id: str = "ErXwobaYiN019PkySvjV"
    # Model choice: turbo_v2_5 is ~3x faster and 3x cheaper than multilingual
    # _v2 but slightly less expressive on rapid sentences. Turbo wins on our
    # ~150 wpm tech narration; flip to multilingual_v2 if you're cutting
    # longer-form pieces where rhythm matters more than throughput.
    elevenlabs_model_id: str = "eleven_turbo_v2_5"

    remotion_project_dir: str = "/app/remotion"

    @property
    def has_claude(self) -> bool:
        return bool(self.anthropic_api_key) and not self.anthropic_api_key.startswith("your_")

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key) and not self.openai_api_key.startswith("your_")

    @property
    def has_elevenlabs(self) -> bool:
        return bool(self.elevenlabs_api_key) and not self.elevenlabs_api_key.startswith("your_")

    def ensure_dirs(self) -> None:
        for path in (
            self.video_output_dir,
            self.thumbnail_output_dir,
            self.temp_dir,
            self.repos_dir,
        ):
            Path(path).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
