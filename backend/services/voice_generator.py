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
# Settings tuned for tech narration after a real-world bug: the previous
# config (stability 0.30 / style 0.35 / multilingual_v2) sometimes
# hallucinated a language switch mid-sentence. The fix is on three axes:
#
#   stability   0.30 → 0.45   (less wild variation, no drift mid-sentence)
#   style       0.35 → 0.15   (low style + language_code=en avoids the
#                              language-switching hallucination)
#   model       turbo_v2_5    (English-only — multilingual_v2 was the
#                              biggest contributor to language drift)
#
# similarity_boost stays at 0.80 to preserve Brian's identity across the
# tighter stability envelope. See VOICE_AB_TEST.md for prior comparisons.
_ELEVENLABS_DEFAULTS = {
    "stability": 0.45,
    "similarity_boost": 0.80,
    "style": 0.15,
    "use_speaker_boost": True,
}

# English-only model — multilingual_v2 was implicated in the language-
# switching bug. turbo_v2_5 is also faster + cheaper.
_ELEVENLABS_MODEL_FALLBACK = "eleven_turbo_v2_5"
_ELEVENLABS_LANGUAGE = "en"

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
    "HTTP": "H T T P",     # otherwise read as "h-t-t-p" with awkward break
    "HTTPS": "H T T P S",  # user reported pause mid-word; force consistent spell
    "TS": "T S",
    "JS": "J S",
    "Postgres": "Postgress",  # otherwise reads as "Post-grease"
    "Redis": "Red-iss",
    "nginx": "engine X",
    "regex": "reg-ex",
    "AI": "A I",
    "LLM": "L L M",
    "GPT": "G P T",
    # HTTP verbs — Brian spells them with weird mid-letter pauses
    # ("GE...T", "PO...ST"). Forcing explicit letter spacing makes the
    # cadence consistent.
    "GET": "G E T",
    "POST": "P O S T",
    "PUT": "P U T",
    "DELETE": "D E L E T E",
    "PATCH": "P A T C H",
    "HEAD": "H E A D",
    # npm package names with a single-letter prefix and a dash. Brian
    # reads them as portmanteau words ("panny" for p-any). Forcing a
    # comma + space makes it read as "p, any" with a clear pause.
    "p-any": "p, any",
    "p-timeout": "p, timeout",
    "p-throttle": "p, throttle",
    "p-limit": "p, limit",
    "p-map": "p, map",
    "p-queue": "p, queue",
    "p-retry": "p, retry",
    "p-cancelable": "p, cancelable",
}


def _scrub_unspeakable(text: str) -> str:
    """Strip strings the narrator should not read aloud: URLs, long
    domain names, file paths, anything that turns into a string of
    spelled-out characters. The user reported these as 'big long
    links and other useless/random stuff that the audience doesn't
    want to hear.'

    Rules:
      - https?://... URLs are dropped entirely (with trailing punctuation
        repaired)
      - Bare domain names with 3+ dots (e.g. "o-o.myaddr.l.google.com")
        get shortened to their TLD-anchor segment ("Google's resolver")
        when context is recognisable; otherwise dropped
      - 2-dot domains stay (e.g. "captive.apple.com" reads acceptably)
      - File paths with 2+ slashes ("src/foo/bar.js") get reduced to the
        basename ("bar.js")
    """
    # Drop full URLs entirely, replacing with "the URL" if the surrounding
    # sentence needs a noun, else just remove.
    # First: "at https://..." → "at the endpoint"
    text = re.sub(
        r"\b(at|to|from|via|hits?|queries|fetch(?:es)?)\s+https?://\S+",
        r"\1 the endpoint",
        text,
        flags=re.IGNORECASE,
    )
    # Generic remaining URL → empty
    text = re.sub(r"https?://\S+", "", text)

    # Long DNS names with 3+ dots that aren't well-known short ones.
    # Replace with a generic stand-in based on TLD guess.
    def _replace_long_dns(match: re.Match[str]) -> str:
        host = match.group(0)
        # If it's a single short noun-like host (e.g. "icanhazip.com"),
        # leave it — ElevenLabs reads those reasonably as "icanhazip dot com"
        # Only nuke the gnarly multi-subdomain ones.
        parts = host.split(".")
        if len(parts) <= 2 and max(len(p) for p in parts) >= 4:
            return host
        # Guess the service from the domain root.
        root = parts[-2].lower() if len(parts) >= 2 else ""
        if root in {"google", "googleapis", "gstatic"}:
            return "Google's DNS"
        if root in {"opendns", "cisco"}:
            return "OpenDNS"
        if root in {"cloudflare", "one"}:
            return "Cloudflare"
        if root == "apple":
            return "Apple's captive portal"
        return "that endpoint"
    text = re.sub(
        r"\b[A-Za-z0-9][A-Za-z0-9\-]*(?:\.[A-Za-z0-9\-]+){2,}\b",
        _replace_long_dns,
        text,
    )

    # File paths with 2+ slashes: reduce to basename.
    # e.g. "src/services/voice_generator.py" → "voice_generator.py"
    text = re.sub(
        r"\b(?:[A-Za-z0-9_\-]+/){2,}([A-Za-z0-9_\-]+\.[A-Za-z]{1,5})\b",
        r"\1",
        text,
    )

    # Clean up orphan commas and double spaces left behind.
    text = re.sub(r"\s+([,.;])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text


def _stutter_proof(text: str) -> str:
    """Normalisation pass that eliminates the inputs known to trigger
    ElevenLabs stutters / mispronunciations / weird emphasis.

    Run BEFORE the punctuation-break + jargon passes so subsequent
    regex doesn't have to handle e.g. ".." or repeated whitespace.
    """
    # Strip URLs / long DNS / deep paths FIRST so we don't waste subsequent
    # passes on stuff the narrator shouldn't read at all.
    text = _scrub_unspeakable(text)

    # Collapse repeated punctuation. ElevenLabs hiccups on ".." or "?!"
    # and treats it as an emphatic stutter.
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"!{2,}", "!", text)
    text = re.sub(r"\?{2,}", "?", text)
    text = re.sub(r"[!?]{2,}", "?", text)

    # Stumble words — "the the", "a a" — usually slips from Claude when
    # it edits a sentence. Collapse them.
    text = re.sub(r"\b(the|a|an|is|of|to|and|or|in|on)\s+\1\b", r"\1", text, flags=re.IGNORECASE)

    # Spell out symbols that ElevenLabs reads inconsistently.
    text = re.sub(r"\s*&\s*", " and ", text)
    text = re.sub(r"(\w)@(\w)", r"\1 at \2", text)
    # "/" between words is read awkwardly; replace with "or" only when
    # it's clearly a word/word separator (not a path).
    text = re.sub(r"(\b\w{2,})\s*/\s*(\w{2,}\b)", r"\1 or \2", text)

    # Collapse weird whitespace.
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def _preprocess_narration(text: str) -> str:
    """Apply jargon substitutions + insert ElevenLabs break tags between
    sentences so the cadence reads as natural speech rather than
    Wikipedia-bot prose."""
    if not text:
        return text

    # Stutter-proof pass first — eliminates ".."  / "the the" / "X/Y"
    # before any other transform runs.
    text = _stutter_proof(text)

    # Punctuation-aware breaks. ElevenLabs respects the `<break>` tag and
    # treats it as a pause of the requested length. The prior version
    # inserted a single 250ms break only between sentences — too uniform,
    # and the result still read flat. Vary by punctuation context:
    #
    #   end of paragraph (.!? followed by \n\n or end-of-text)  → 500ms
    #   sentence ending mid-paragraph (.!? + space + capital)   → 350ms
    #   colon before an explanation                              → 250ms
    #   em-dash                                                  → 200ms
    #   semicolon                                                → 200ms
    #   comma                                                    → 150ms
    #
    # Order matters: paragraph-end first (more specific) before mid-sentence
    # period.
    text = re.sub(
        r"([.!?])(\n{2,}|\s*$)",
        r'\1 <break time="500ms"/>\2',
        text,
    )
    text = re.sub(
        r"(?<=[.!?])\s+(?=[A-Z\"'])",
        ' <break time="350ms"/> ',
        text,
    )
    text = re.sub(
        r"(?<=:)\s+(?=[A-Za-z\"'])",
        ' <break time="250ms"/> ',
        text,
    )
    text = re.sub(
        r"\s*—\s*",
        r' <break time="200ms"/> ',
        text,
    )
    text = re.sub(
        r"(?<=;)\s+",
        ' <break time="200ms"/> ',
        text,
    )
    text = re.sub(
        r"(?<=,)\s+(?=[A-Za-z\"'])",
        ' <break time="150ms"/> ',
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

        alignment: dict[str, Any] | None = None
        try:
            if chosen == "openai":
                # OpenAI's TTS doesn't honor ElevenLabs <break> tags — strip
                # them but keep the punctuation cadence intact.
                openai_text = re.sub(r'<break[^/]*/>', "", prepared).strip()
                _generate_openai(openai_text, out_path, settings.openai_api_key)
            elif chosen == "elevenlabs":
                alignment = _generate_elevenlabs(
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

        results.append(_segment(section_id, out_path, duration, chosen, alignment))

    return results


def _segment(
    section_id: str,
    out_path: Path,
    duration: int,
    provider: str,
    alignment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # Probe the file we just wrote. If ffprobe is unavailable or the file is
    # the silent-WAV placeholder, fall back to the estimated duration.
    probed = probe_duration(out_path)
    actual = float(probed) if probed and probed > 0 else float(duration)
    return {
        "section_id": section_id,
        "audio_path": str(out_path),
        # Optional per-character alignment from ElevenLabs with-timestamps.
        # The worker uses this to relocate narration_start_seconds on each
        # architecture module + each code highlight to the moment its name
        # is actually spoken.
        "alignment": alignment,
        # `duration_seconds` is the original (estimated) value for backwards
        # compatibility with anything that already reads it.
        "duration_seconds": duration,
        # `audio_duration_seconds` is the SOURCE OF TRUTH for downstream scene
        # timing — millisecond-accurate via ffprobe.
        "audio_duration_seconds": round(actual, 3),
        "provider": provider,
    }


def find_phrase_time(
    alignment: dict[str, Any] | None, phrase: str
) -> float | None:
    """Locate `phrase` in the per-character alignment data and return the
    start time (in seconds) of its first character. Case- and
    whitespace-insensitive match against the concatenated characters.

    Returns None when alignment is missing, when the phrase isn't found,
    or when the phrase is too short to be reliable (<= 2 chars).
    """
    if not alignment or not phrase or len(phrase.strip()) <= 2:
        return None
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    if not chars or len(chars) != len(starts):
        return None
    haystack = "".join(chars).lower()
    needle = phrase.lower()
    idx = haystack.find(needle)
    if idx < 0:
        # Try collapsing whitespace + punctuation for a fuzzier match —
        # narration sometimes splits identifiers with spaces ("apple Check")
        # while the script's module label is one word ("appleCheck").
        squashed_h = re.sub(r"[^a-z0-9]+", "", haystack)
        squashed_n = re.sub(r"[^a-z0-9]+", "", needle)
        if not squashed_n:
            return None
        squashed_idx = squashed_h.find(squashed_n)
        if squashed_idx < 0:
            return None
        # Map the squashed index back to the original character index.
        kept = 0
        for i, ch in enumerate(haystack):
            if re.match(r"[a-z0-9]", ch):
                if kept == squashed_idx:
                    idx = i
                    break
                kept += 1
        if idx < 0:
            return None
    try:
        return float(starts[idx])
    except (IndexError, ValueError, TypeError):
        return None


def _label_search_candidates(label: str, file_path: str = "") -> list[str]:
    """Build a ranked list of phrases to try when looking for `label` in
    alignment text. Ordered by specificity (most distinctive first).

    Handles the v2 sync bugs:
      - Parenthetical suffixes: "ZodType (base class)" → "ZodType"
      - File extensions read aloud: "types.ts" → "types dot T S"
      - CamelCase split: "fetchExtras" → "fetch Extras"
      - Multi-word labels: "parse method" → also try "parse"
      - dotted paths: "lib/utils.js" → "utils"
    """
    candidates: list[str] = []
    if not label:
        return candidates

    # 1. Full label as-is (rare match for compound labels but kept for completeness)
    candidates.append(label)

    # 2. Strip parenthetical suffix — narrators rarely say "(base class)"
    no_paren = re.sub(r"\s*\([^)]*\)\s*", "", label).strip()
    if no_paren and no_paren != label:
        candidates.append(no_paren)

    base = no_paren or label

    # 3. CamelCase split for the base
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", base)
    if spaced != base:
        candidates.append(spaced)

    # 4. If base ends with a file extension, apply the TTS jargon expansion.
    #    `_preprocess_narration` turns ".ts" into " dot T S" before sending to
    #    ElevenLabs, so the alignment characters contain the spelled-out
    #    version, not the original literal. Search for both.
    ext_match = re.match(r"^(.+?)\.([a-zA-Z]{1,5})$", base)
    if ext_match:
        stem, ext = ext_match.group(1), ext_match.group(2)
        # "types.ts" → search for "types dot T S" (uppercase spelled)
        spelled = stem + " dot " + " ".join(ext.upper())
        candidates.append(spelled)
        # Also: just the stem alone if it's distinctive (>=4 chars).
        if len(stem) >= 4:
            candidates.append(stem)

    # 5. Significant word from a multi-word label: "parse method" → "parse"
    words = [w for w in re.split(r"\W+", base) if len(w) >= 4]
    for w in words:
        if w not in candidates and not any(w in c for c in candidates):
            candidates.append(w)

    # 6. File path basename as last-resort distinctive token
    if file_path:
        fp_base = file_path.rsplit("/", 1)[-1]
        if fp_base and fp_base not in candidates:
            # Apply same dot expansion
            fp_match = re.match(r"^(.+?)\.([a-zA-Z]{1,5})$", fp_base)
            if fp_match:
                stem, ext = fp_match.group(1), fp_match.group(2)
                if len(stem) >= 4 and stem not in candidates:
                    candidates.append(stem)

    # Dedup while preserving order, drop anything shorter than 3 chars.
    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        c = c.strip()
        if len(c) < 3 or c.lower() in seen:
            continue
        seen.add(c.lower())
        out.append(c)
    return out


def sync_visuals_to_alignment(
    script: dict[str, Any], audio_files: list[dict[str, Any]]
) -> dict[str, Any]:
    """Rewrite `narration_start_seconds` on every visual element where we
    have alignment data — so architecture modules pop up when their name
    is actually spoken, and code highlights tick over when their target
    function/line content lands in the audio.

    Search keys per element:
      - Architecture module:        label, then file_path
      - Code walkthrough highlight: code (line text — distinctive),
                                    fallback to annotation
    """
    align_by_section = {
        a["section_id"]: a.get("alignment")
        for a in audio_files
        if a.get("alignment")
    }
    if not align_by_section:
        return script

    for section in script.get("sections", []):
        sid = section.get("id")
        alignment = align_by_section.get(sid)
        if not alignment:
            continue
        data = (section.get("visuals", {}) or {}).get("data", {}) or {}

        if sid == "architecture":
            modules = data.get("modules") or []
            connections = data.get("connections") or []
            module_times: dict[str, float] = {}

            taken: set[float] = set()
            for i, m in enumerate(modules):
                label = (m.get("label") or m.get("id") or "").strip()
                file_path = m.get("file_path") or ""
                candidates = _label_search_candidates(label, file_path)

                # Each module must anchor to a UNIQUE timestamp (within 0.5s)
                # — module A and module B can't both be 'first mentioned' at
                # exactly the same moment. Look forward through alignment for
                # the next un-taken match. Earlier modules in the list have
                # priority (narration follows reading order).
                t: float | None = None
                for phrase in candidates:
                    if len(phrase.strip()) < 3:
                        continue
                    cand = find_phrase_time(alignment, phrase)
                    if cand is None:
                        continue
                    # If a previously-anchored module sits within 0.5s of
                    # this timestamp, assume this is the wrong match.
                    if any(abs(cand - tk) < 0.5 for tk in taken):
                        continue
                    # Also: an anchor for module i shouldn't predate the
                    # anchor for module i-1 by more than 2s (narration is
                    # linear). Reject early-occurring matches that would
                    # break module ordering.
                    prior_max = max(taken) if taken else -10.0
                    if cand < prior_max - 2.0:
                        continue
                    t = cand
                    break

                if t is not None:
                    m["narration_start_seconds"] = round(t, 2)
                    module_times[m.get("id") or ""] = t
                    taken.add(round(t, 2))
                # Otherwise leave for the fallback distribution below.

            # A connection lights up when its destination module is first
            # mentioned — that's the moment the narration "draws the arrow."
            for c in connections:
                tgt = c.get("to")
                if tgt in module_times:
                    c["narration_start_seconds"] = round(module_times[tgt], 2)
            logger.info(
                "Sync architecture: %d/%d modules anchored to alignment data (unique timestamps enforced)",
                len(module_times), len(modules),
            )

            # Fallback for unanchored modules: distribute them PROPORTIONALLY
            # between the surrounding anchored modules. Narration is linear,
            # so an unanchored module between anchored neighbours at t=4s and
            # t=24s should land somewhere between them — not at whatever
            # Claude originally guessed (which the user saw out of sync by
            # 6-10 seconds in the zod render).
            #
            # Algorithm: scan modules in order. For each unanchored run,
            # interpolate between the last anchored timestamp and the next
            # anchored timestamp (or the audio end for trailing tails).
            audio_dur = 0.0
            for a in audio_files:
                if a.get("section_id") == sid:
                    audio_dur = float(a.get("audio_duration_seconds") or 0.0)
                    break

            anchored_idx = [i for i, m in enumerate(modules)
                            if (m.get("id") or "") in module_times]

            for i, m in enumerate(modules):
                if (m.get("id") or "") in module_times:
                    continue
                # Find surrounding anchored neighbours.
                left = max((j for j in anchored_idx if j < i), default=None)
                right = min((j for j in anchored_idx if j > i), default=None)

                if left is None and right is None:
                    # No anchors at all — fall back to even distribution
                    # across the audio, leaving 0.5s at start/end.
                    if audio_dur > 0 and len(modules) > 0:
                        slot = (audio_dur - 1.0) / max(1, len(modules))
                        interp = 0.5 + i * slot
                    else:
                        interp = float(m.get("narration_start_seconds") or i * 3.0)
                elif left is None:
                    # Module before the first anchor — slot evenly from 0 to it.
                    right_t = float(modules[right]["narration_start_seconds"])
                    gap_count = right + 1  # i==0..right share this range
                    interp = right_t * (i + 1) / max(1, gap_count + 1)
                elif right is None:
                    # Module after the last anchor — slot evenly from it
                    # to the audio end.
                    left_t = float(modules[left]["narration_start_seconds"])
                    end_t = audio_dur or (left_t + (len(modules) - left) * 3.0)
                    gap_count = len(modules) - left  # i==left+1..end
                    fraction = (i - left) / max(1, gap_count)
                    interp = left_t + (end_t - left_t) * fraction
                else:
                    left_t = float(modules[left]["narration_start_seconds"])
                    right_t = float(modules[right]["narration_start_seconds"])
                    gap_count = right - left
                    fraction = (i - left) / max(1, gap_count)
                    interp = left_t + (right_t - left_t) * fraction

                interp = round(max(0.0, interp), 2)
                logger.info(
                    "Architecture fallback: %s narration_start %s -> %.2fs (interpolated)",
                    m.get("label"), m.get("narration_start_seconds"), interp,
                )
                m["narration_start_seconds"] = interp

        elif sid == "code_walkthrough":
            highlights = data.get("highlights") or []
            anchored = 0
            for h in highlights:
                code = (h.get("code") or "").strip()
                annotation = h.get("annotation") or ""
                # The code line itself is usually distinctive enough to find
                # in the audio. Fall back to the annotation if not.
                t = None
                if len(code) >= 8:
                    # Use the first 3-5 tokens as a search anchor — the whole
                    # line is unlikely to be quoted verbatim in narration.
                    snippet = " ".join(code.split()[:4])
                    t = find_phrase_time(alignment, snippet)
                if t is None and annotation:
                    t = find_phrase_time(alignment, annotation.split()[0] if annotation else "")
                if t is not None:
                    h["narration_start_seconds"] = round(t, 2)
                    anchored += 1
            logger.info(
                "Sync code_walkthrough: %d/%d highlights anchored to alignment data",
                anchored, len(highlights),
            )

        elif sid == "summary":
            # Anchor each key_takeaway card to the moment its content is
            # first mentioned in the audio. Two-pronged match: try the
            # full takeaway string, then a 2-3 word distinctive anchor.
            takeaways = script.get("key_takeaways") or []
            if takeaways:
                takeaway_times: list[float | None] = []
                for tk in takeaways:
                    tk_str = str(tk or "")
                    if not tk_str:
                        takeaway_times.append(None)
                        continue
                    # Try first significant noun-bearing phrase. Pull
                    # the first 3 substantive words (skip articles).
                    tokens = [w for w in re.split(r"\W+", tk_str) if w and w.lower() not in {"a", "an", "the", "to", "for", "and", "or", "of", "in"}]
                    anchor = " ".join(tokens[:3]) if tokens else tk_str
                    t = find_phrase_time(alignment, anchor)
                    if t is None and tokens:
                        # Fall back to a single distinctive word
                        for w in tokens:
                            if len(w) >= 5:
                                t = find_phrase_time(alignment, w)
                                if t is not None:
                                    break
                    takeaway_times.append(t)
                script["takeaway_seconds"] = [
                    round(t, 2) if t is not None else None for t in takeaway_times
                ]
                anchored = sum(1 for t in takeaway_times if t is not None)
                logger.info(
                    "Sync summary: %d/%d takeaways anchored to alignment",
                    anchored, len(takeaways),
                )

    return script


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
) -> dict[str, Any] | None:
    """Call ElevenLabs TTS with-timestamps so we capture word-level
    alignment alongside the audio. Returns the `alignment` dict from the
    response (or None if alignment couldn't be obtained). Caller still
    gets HTTPStatusError on auth errors (4xx other than 429) and on the
    final failed attempt."""
    import base64
    import httpx

    # Force the English-only model regardless of what config says — the
    # language-switching bug only happens with multilingual_v2. If the user
    # really wants multilingual, they can override _ELEVENLABS_MODEL_FALLBACK
    # in code, but the config default isn't sufficient guarantee.
    effective_model = model_id if "multilingual" not in model_id else _ELEVENLABS_MODEL_FALLBACK
    if effective_model != model_id:
        logger.warning(
            "Overriding requested model %s -> %s to avoid language drift",
            model_id, effective_model,
        )

    # `with-timestamps` returns JSON with base64 audio + per-character
    # timing. Used to sync architecture-module reveals + code-line
    # highlights to the actual moment each name is spoken. Falls back to
    # the plain endpoint if the timestamps variant errors (older API
    # versions, restricted plans).
    url_ts = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    url_plain = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    body = {
        "text": text,
        "model_id": effective_model,
        "voice_settings": _ELEVENLABS_DEFAULTS,
        # Explicit language code stops the voice from "drifting" into Spanish
        # / French / German mid-sentence — a known issue with English-leaning
        # voices on multilingual models. Honored only by multilingual models;
        # safe to pass on turbo_v2_5 (ignored).
        "language_code": _ELEVENLABS_LANGUAGE,
    }

    attempt = 0
    delay = 1.0
    while True:
        attempt += 1
        response = httpx.post(
            url_ts,
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=body,
            timeout=60,
        )
        if response.status_code < 400:
            payload = response.json()
            audio_b64 = payload.get("audio_base64") or ""
            if audio_b64:
                out_path.write_bytes(base64.b64decode(audio_b64))
                # Prefer normalized_alignment when present — it accounts for
                # our `<break>` preprocessing (SSML tags removed from the
                # character stream so timings line up with spoken phonemes).
                alignment = (
                    payload.get("normalized_alignment")
                    or payload.get("alignment")
                )
                return alignment if isinstance(alignment, dict) else None
            # No audio in JSON — unexpected. Fall through to retry logic.
            logger.warning(
                "ElevenLabs with-timestamps returned 200 but no audio_base64"
            )

        # If the with-timestamps endpoint specifically fails 400/404 (older
        # plans / regional restrictions), retry once against the plain
        # endpoint so we still get audio without alignment.
        if response.status_code in (400, 404):
            logger.warning(
                "with-timestamps unavailable (HTTP %d) — falling back to plain endpoint",
                response.status_code,
            )
            plain = httpx.post(
                url_plain,
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json=body,
                timeout=60,
            )
            plain.raise_for_status()
            out_path.write_bytes(plain.content)
            return None

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
