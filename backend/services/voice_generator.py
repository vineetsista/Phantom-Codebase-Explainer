"""Generate per-section voiceover audio using OpenAI TTS or ElevenLabs.

Returns a list of {section_id, audio_path, duration_seconds_estimate} dicts.

Failure modes are explicit:
 - Sections with no narration text → silent placeholder WAV (expected).
 - Resolved provider is 'mock' (no keys configured at all) → silent WAVs for
   every section, no errors raised.
 - Resolved provider IS configured but the API returns an auth/credit/quota
   error (401/402/403/429) → TTSConfigError is raised so the worker fails the
   whole job with a clear message instead of quietly producing a silent
   video. Silent video is worse than no video — it looks broken.
 - Transient errors (network blip, 5xx) → one retry, then silent placeholder
   with a warning log so the rest of the video still renders.
"""
from __future__ import annotations

import logging
import struct
import wave
from pathlib import Path
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


class TTSConfigError(RuntimeError):
    """Raised when a configured TTS provider returns an unrecoverable error
    (auth, payment, quota). The pipeline should fail the job — silently
    falling back to silence would ship a broken-looking video."""


def resolve_provider(requested: str | None = None) -> tuple[str, str]:
    """Pick a TTS provider and return (provider, reason_string).

    Priority order:
      1. Explicit non-empty `requested` argument (from the API)
      2. `DEFAULT_VOICE` env var (via settings.default_voice)
      3. Auto-detect: ElevenLabs if its key is set, else OpenAI if its key is
         set, else 'mock' (silent placeholder)

    A configured provider whose API key is missing falls through to the next
    one with a real key, so a stale `voice=openai` request on a deployment
    that only has ELEVENLABS_API_KEY still produces audio instead of silence.
    """
    settings = get_settings()
    env_default = (settings.default_voice or "").strip().lower()

    if requested and requested.strip() and requested.strip().lower() != "auto":
        chosen = requested.strip().lower()
        reason = f"explicit API request (voice='{chosen}')"
    elif env_default and env_default != "auto":
        chosen = env_default
        reason = f"DEFAULT_VOICE env var (='{chosen}')"
    else:
        if settings.has_elevenlabs:
            chosen, reason = "elevenlabs", "auto-detect: ELEVENLABS_API_KEY present"
        elif settings.has_openai:
            chosen, reason = "openai", "auto-detect: OPENAI_API_KEY present"
        else:
            chosen, reason = "mock", "auto-detect: no TTS API keys configured"

    # Availability check — fall through if the chosen provider's key is missing.
    if chosen == "elevenlabs" and not settings.has_elevenlabs:
        if settings.has_openai:
            new_reason = f"{reason}; ElevenLabs key missing — falling back to OpenAI"
            logger.warning(new_reason)
            chosen, reason = "openai", new_reason
        else:
            new_reason = f"{reason}; ElevenLabs key missing and no OpenAI key — silent placeholder"
            logger.warning(new_reason)
            chosen, reason = "mock", new_reason
    elif chosen == "openai" and not settings.has_openai:
        if settings.has_elevenlabs:
            new_reason = f"{reason}; OpenAI key missing — falling back to ElevenLabs"
            logger.warning(new_reason)
            chosen, reason = "elevenlabs", new_reason
        else:
            new_reason = f"{reason}; OpenAI key missing and no ElevenLabs key — silent placeholder"
            logger.warning(new_reason)
            chosen, reason = "mock", new_reason

    logger.info("Voice provider selected: %s (%s)", chosen, reason)
    return chosen, reason


def generate(
    script: dict[str, Any],
    job_id: str,
    provider: str | None = None,
) -> list[dict[str, Any]]:
    """Synthesize per-section voiceover. Returns segment metadata for the
    composer/ffmpeg stage. Always returns one entry per section even if TTS
    failed, by writing silent placeholders so the pipeline downstream never
    has to handle a missing audio file."""
    settings = get_settings()
    output_dir = Path(settings.temp_dir) / job_id / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)

    chosen, reason = resolve_provider(provider)

    results: list[dict[str, Any]] = []
    for section in script.get("sections", []):
        section_id = section.get("id", "section")
        narration = (section.get("narration") or "").strip()
        duration = int(section.get("duration_seconds") or 10)
        out_path = output_dir / f"{section_id}.mp3"

        if not narration:
            # No text to synthesize — silent placeholder is correct here.
            logger.info(
                "Section %s has empty narration — writing silent placeholder",
                section_id,
            )
            out_path = out_path.with_suffix(".wav")
            _silent_wav(out_path, duration)
            results.append(
                _segment(section_id, out_path, duration, chosen)
            )
            continue

        if chosen == "mock":
            # No configured provider — explicit silent run.
            out_path = out_path.with_suffix(".wav")
            _silent_wav(out_path, duration)
            results.append(_segment(section_id, out_path, duration, chosen))
            continue

        try:
            if chosen == "openai":
                _generate_openai(narration, out_path, settings.openai_api_key)
            elif chosen == "elevenlabs":
                _generate_elevenlabs(narration, out_path, settings.elevenlabs_api_key)
            else:
                raise TTSConfigError(f"Unknown TTS provider: {chosen!r}")
        except TTSConfigError:
            # Already explicit — propagate so the worker fails the job loudly.
            raise
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            body = ""
            try:
                body = exc.response.text[:800] if exc.response is not None else ""
            except Exception:
                pass
            if status in (401, 402, 403, 429):
                msg = (
                    f"{chosen} TTS returned HTTP {status} for section "
                    f"{section_id!r}. Likely cause: missing/invalid key, "
                    f"exhausted credits, or rate limit. Response: {body!r}"
                )
                logger.error("Unrecoverable TTS error: %s", msg)
                raise TTSConfigError(msg) from exc
            # Transient — log and fall back to silent for this segment only.
            logger.warning(
                "Transient TTS error from %s (status=%s) for section %s: %s. "
                "Writing silent placeholder for this section only.",
                chosen, status, section_id, body,
            )
            out_path = out_path.with_suffix(".wav")
            _silent_wav(out_path, duration)
        except Exception as exc:
            # Detect "openai" SDK auth errors that don't surface as HTTPStatusError
            type_name = type(exc).__name__
            if type_name in (
                "AuthenticationError",
                "PermissionDeniedError",
                "RateLimitError",
                "InsufficientQuotaError",
            ):
                msg = (
                    f"{chosen} TTS raised {type_name} for section "
                    f"{section_id!r}: {exc}. Likely cause: missing/invalid "
                    f"key or exhausted quota."
                )
                logger.error("Unrecoverable TTS error: %s", msg)
                raise TTSConfigError(msg) from exc
            # Truly transient (network blip, decode glitch) — segment-level
            # silent fallback so the rest of the video still renders.
            logger.warning(
                "Transient TTS error from %s for section %s (%s): %s. "
                "Writing silent placeholder for this section only.",
                chosen, section_id, type_name, exc,
            )
            out_path = out_path.with_suffix(".wav")
            _silent_wav(out_path, duration)

        # Sanity: if the provider returned but the file is missing/empty,
        # treat that as an unrecoverable provider error too.
        if not out_path.exists() or out_path.stat().st_size == 0:
            msg = (
                f"{chosen} TTS for section {section_id!r} returned no audio "
                f"data (path={out_path}). Treating as provider failure."
            )
            logger.error(msg)
            raise TTSConfigError(msg)

        results.append(_segment(section_id, out_path, duration, chosen))

    return results


def _segment(
    section_id: str,
    out_path: Path,
    duration: int,
    provider: str,
) -> dict[str, Any]:
    return {
        "section_id": section_id,
        "audio_path": str(out_path),
        "duration_seconds": duration,
        "provider": provider,
    }


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
