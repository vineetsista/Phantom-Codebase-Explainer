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
import re
import shutil
import struct
import subprocess
import time
import wave
from pathlib import Path
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

# --- Voice tuning ----------------------------------------------------------
# Settings tuned for tech narration with Brian. Lower stability gives more
# emotional variation (the voice "leans in" on emphasis); style at 0.20 adds
# personality without going theatrical; speaker_boost cleans up sibilance at
# the higher gain that headphone listeners use.
_ELEVENLABS_DEFAULTS = {
    "stability": 0.40,
    "similarity_boost": 0.75,
    "style": 0.20,
    "use_speaker_boost": True,
}

# --- Tech jargon pronunciation map -----------------------------------------
# Most TTS engines (Brian included) get common acronyms wrong by default.
# These are spelled out the way an engineer says them aloud. Keep entries
# short and case-sensitive; the substitution is word-bounded so a longer
# identifier like "JSONSchema" or "API_KEY" doesn't get mangled.
#
# Order matters for overlapping cases (i18n before "in" — n/a here, but
# something to watch when extending).
_JARGON: dict[str, str] = {
    # ❌ Brian reads "npm" as "num". Force individual letters.
    "npm": "N P M",
    "URL": "U R L",
    "URLs": "U R Ls",
    "SQL": "sequel",       # industry convention
    "JSON": "Jason",
    "YAML": "yamel",
    "OAuth": "O auth",
    "i18n": "internationalization",
    "l10n": "localization",
    "k8s": "Kubernetes",
    "GCP": "G C P",
    "AWS": "A W S",
    "S3": "S three",
    "EC2": "E C two",
    "REST": "REST",        # already pronounced as a word
    "GraphQL": "graph Q L",
    "JWT": "J W T",
    "CLI": "C L I",
    "TLS": "T L S",
    "SSL": "S S L",
    "DNS": "D N S",
    "CDN": "C D N",
    "CI/CD": "C I C D",
    "CSS": "C S S",
    "HTML": "H T M L",
    "TS": "T S",
    "JS": "J S",
    "Postgres": "Postgress",  # otherwise reads as "Post-grease"
    "Redis": "Red-iss",
    "nginx": "engine X",
    "regex": "reg-ex",
    "AI": "A I",
    "LLM": "L L M",
    "GPT": "G P T",
}


def _preprocess_narration(text: str) -> str:
    """Apply jargon substitutions + insert ElevenLabs break tags between
    sentences so the cadence reads as natural speech rather than
    Wikipedia-bot prose."""
    if not text:
        return text

    # Sentence-level breaks: ". " → ". <break time=\"250ms\"/> "
    # The trailing space is preserved so the resulting text still parses
    # as natural prose for engines that ignore the tag.
    text = re.sub(
        r"(?<=[.!?])\s+(?=[A-Z\"'])",
        ' <break time="250ms"/> ',
        text,
    )

    # Jargon substitution. Use \b word boundaries so "api" inside
    # "diaphragm" isn't matched. Apply longest tokens first so "GraphQL"
    # beats "QL" when both could match (none do today, but cheap to be
    # safe).
    for token in sorted(_JARGON.keys(), key=len, reverse=True):
        replacement = _JARGON[token]
        # Word boundaries don't fire on "/" — match literally for tokens
        # that contain it (CI/CD).
        if any(ch in token for ch in "/"):
            pattern = re.escape(token)
        else:
            pattern = r"\b" + re.escape(token) + r"\b"
        text = re.sub(pattern, replacement, text)

    return text


def probe_duration(path: Path | str) -> float | None:
    """Return the real duration of an audio file in seconds, or None if it
    cannot be measured. Uses ffprobe; falls back to wave for our silent
    placeholder WAVs (no ffmpeg dep at unit-test time)."""
    path = Path(path)
    if not path.is_file() or path.stat().st_size == 0:
        return None
    # Cheap WAV path — avoids spawning ffprobe for silent placeholders.
    if path.suffix.lower() == ".wav":
        try:
            with wave.open(str(path), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate() or 1
                return frames / float(rate)
        except (wave.Error, EOFError):
            pass
    if not shutil.which("ffprobe"):
        return None
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode != 0:
            logger.warning(
                "ffprobe failed for %s (exit=%d): %s",
                path, proc.returncode, (proc.stderr or "").strip()[:300],
            )
            return None
        value = (proc.stdout or "").strip()
        if not value:
            return None
        return float(value)
    except (subprocess.TimeoutExpired, ValueError) as exc:
        logger.warning("ffprobe error for %s: %s", path, exc)
        return None


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

        # Apply jargon + break preprocessing before sending to TTS. Logged
        # at debug so we can see exactly what the API received without
        # spamming INFO with every narration body.
        prepared = _preprocess_narration(narration)
        if prepared != narration:
            logger.debug(
                "section=%s narration_preprocessed (original=%d chars, prepared=%d chars)",
                section_id, len(narration), len(prepared),
            )

        try:
            if chosen == "openai":
                # OpenAI's TTS doesn't honor ElevenLabs <break> tags — strip
                # them but keep the punctuation cadence intact.
                openai_text = re.sub(r'<break[^/]*/>', "", prepared).strip()
                _generate_openai(openai_text, out_path, settings.openai_api_key)
            elif chosen == "elevenlabs":
                _generate_elevenlabs(
                    prepared,
                    out_path,
                    settings.elevenlabs_api_key,
                    voice_id=settings.default_elevenlabs_voice_id,
                    model_id=settings.elevenlabs_model_id,
                )
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
    # Probe the file we just wrote. If ffprobe is unavailable or the file is
    # the silent-WAV placeholder, fall back to the estimated duration.
    probed = probe_duration(out_path)
    actual = float(probed) if probed and probed > 0 else float(duration)
    return {
        "section_id": section_id,
        "audio_path": str(out_path),
        # `duration_seconds` is the original (estimated) value for backwards
        # compatibility with anything that already reads it.
        "duration_seconds": duration,
        # `audio_duration_seconds` is the SOURCE OF TRUTH for downstream scene
        # timing — millisecond-accurate via ffprobe.
        "audio_duration_seconds": round(actual, 3),
        "provider": provider,
    }


def apply_actual_durations(
    script: dict[str, Any],
    audio_files: list[dict[str, Any]],
) -> dict[str, Any]:
    """Mutate `script` in place so each section carries `audio_duration_seconds`
    derived from the matching audio segment. Also drops sections whose
    narration was empty (silent placeholder) so they don't appear as dead air
    in the final video.

    Returns the same script dict for convenience.
    """
    by_section = {a["section_id"]: a for a in audio_files}
    kept: list[dict[str, Any]] = []
    dropped: list[str] = []
    for section in script.get("sections", []):
        sid = section.get("id")
        narration = (section.get("narration") or "").strip()
        seg = by_section.get(sid)
        if not narration or not seg:
            dropped.append(sid or "<unknown>")
            continue
        audio_dur = seg.get("audio_duration_seconds") or seg.get("duration_seconds")
        section["audio_duration_seconds"] = round(float(audio_dur or 0.0), 3)
        kept.append(section)

    if dropped:
        logger.info(
            "apply_actual_durations: dropped %d empty-narration sections: %s",
            len(dropped), ", ".join(dropped),
        )
    script["sections"] = kept
    return script


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


def _generate_elevenlabs(
    text: str,
    out_path: Path,
    api_key: str,
    *,
    voice_id: str,
    model_id: str,
    max_attempts: int = 4,
) -> None:
    """Call ElevenLabs TTS with exponential-backoff retries on 429 (and 5xx).
    Caller still gets HTTPStatusError on auth errors (4xx other than 429)
    and on the final failed attempt."""
    import httpx

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    body = {
        "text": text,
        "model_id": model_id,
        "voice_settings": _ELEVENLABS_DEFAULTS,
    }

    attempt = 0
    delay = 1.0
    while True:
        attempt += 1
        response = httpx.post(
            url,
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json=body,
            timeout=60,
        )
        if response.status_code < 400:
            out_path.write_bytes(response.content)
            return

        retryable = response.status_code == 429 or response.status_code >= 500
        if not retryable or attempt >= max_attempts:
            response.raise_for_status()  # final — propagate to caller

        # Honor Retry-After when the API provides it; otherwise exponential.
        retry_after = response.headers.get("Retry-After")
        wait = float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit() else delay
        logger.warning(
            "ElevenLabs returned %d on attempt %d/%d, backing off %.1fs",
            response.status_code, attempt, max_attempts, wait,
        )
        time.sleep(wait)
        delay = min(delay * 2, 16.0)


def _silent_wav(path: Path, duration_seconds: int) -> None:
    """Write a silent mono PCM WAV of the requested duration."""
    framerate = 22050
    n_frames = max(1, duration_seconds) * framerate
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(struct.pack("<h", 0) * n_frames)
