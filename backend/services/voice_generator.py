"""Generate per-section voiceover audio using OpenAI TTS or ElevenLabs.

Returns a list of {section_id, audio_path, duration_seconds_estimate} dicts.
When no API key is available, generates silent WAV stubs of the appropriate
duration so the video pipeline can still concatenate audio + video.
"""
from __future__ import annotations

import logging
import struct
import wave
from pathlib import Path
from typing import Any

from config import get_settings

logger = logging.getLogger(__name__)


def generate(
    script: dict[str, Any], job_id: str, provider: str = "openai"
) -> list[dict[str, Any]]:
    settings = get_settings()
    output_dir = Path(settings.temp_dir) / job_id / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)

    chosen = provider
    if chosen == "elevenlabs" and not settings.has_elevenlabs:
        chosen = "openai"
    if chosen == "openai" and not settings.has_openai:
        chosen = "mock"

    results: list[dict[str, Any]] = []
    for section in script.get("sections", []):
        section_id = section.get("id", "section")
        narration = (section.get("narration") or "").strip()
        duration = int(section.get("duration_seconds") or 10)
        out_path = output_dir / f"{section_id}.mp3"

        try:
            if chosen == "openai" and narration:
                _generate_openai(narration, out_path, settings.openai_api_key)
            elif chosen == "elevenlabs" and narration:
                _generate_elevenlabs(narration, out_path, settings.elevenlabs_api_key)
            else:
                _silent_wav(out_path.with_suffix(".wav"), duration)
                out_path = out_path.with_suffix(".wav")
        except Exception as exc:
            logger.warning(
                "TTS failed for section %s, writing silent fallback: %s", section_id, exc
            )
            _silent_wav(out_path.with_suffix(".wav"), duration)
            out_path = out_path.with_suffix(".wav")

        results.append(
            {
                "section_id": section_id,
                "audio_path": str(out_path),
                "duration_seconds": duration,
            }
        )
    return results


def _generate_openai(text: str, out_path: Path, api_key: str) -> None:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.audio.speech.create(
        model="tts-1-hd",
        voice="nova",
        input=text,
        response_format="mp3",
    )
    # The SDK exposes either .stream_to_file or .read() depending on version.
    if hasattr(response, "stream_to_file"):
        response.stream_to_file(str(out_path))
    else:
        with open(out_path, "wb") as fp:
            fp.write(response.read())


def _generate_elevenlabs(text: str, out_path: Path, api_key: str) -> None:
    import httpx

    voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel — ElevenLabs default
    response = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "model_id": "eleven_turbo_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=60,
    )
    response.raise_for_status()
    out_path.write_bytes(response.content)


def _silent_wav(path: Path, duration_seconds: int) -> None:
    """Write a silent mono PCM WAV of the requested duration."""
    framerate = 22050
    n_frames = max(1, duration_seconds) * framerate
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(struct.pack("<h", 0) * n_frames)
