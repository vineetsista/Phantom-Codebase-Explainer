"""ElevenLabs character budget tracker.

ElevenLabs charges per character. We track usage in a Redis monthly
counter so we can:
  - Soft-warn when the budget is 80% consumed (log, no behaviour change).
  - Hard-cap at 100%: callers consult `should_use_elevenlabs()` and the
    voice generator falls through to OpenAI TTS (which is dramatically
    cheaper).

Counters are keyed by `elevenlabs:chars:YYYYMM` with a 60-day TTL so old
months evaporate without manual cleanup.

Budget is settable via env var ELEVENLABS_MONTHLY_CHAR_BUDGET; defaults
to 1_000_000 (roughly $300/mo on the Creator tier).

Fail-open: if Redis is unavailable, we don't know the budget so we
allow ElevenLabs — better to overshoot the budget by a few thousand
characters than to silently downgrade everyone to OpenAI for an outage.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_BUDGET = 1_000_000

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        from config import get_settings
        _redis_client = redis.from_url(
            get_settings().redis_url, decode_responses=True
        )
        _redis_client.ping()
        return _redis_client
    except Exception as exc:
        logger.warning("char_budget: Redis unavailable: %s", exc)
        _redis_client = None
        return None


def _budget() -> int:
    raw = os.environ.get("ELEVENLABS_MONTHLY_CHAR_BUDGET")
    try:
        return int(raw) if raw else DEFAULT_BUDGET
    except ValueError:
        return DEFAULT_BUDGET


def _month_key() -> str:
    return datetime.now(timezone.utc).strftime("elevenlabs:chars:%Y%m")


def current_usage() -> Optional[int]:
    """Return chars used this month, or None if Redis is unavailable."""
    r = _get_redis()
    if r is None:
        return None
    try:
        v = r.get(_month_key())
        return int(v or 0)
    except Exception as exc:
        logger.warning("char_budget get failed: %s", exc)
        return None


def record_usage(chars: int) -> None:
    """Record `chars` characters consumed by an ElevenLabs synthesis call."""
    if chars <= 0:
        return
    r = _get_redis()
    if r is None:
        return
    try:
        key = _month_key()
        new_total = r.incrby(key, chars)
        r.expire(key, 60 * 24 * 3600)
        budget = _budget()
        if new_total >= budget:
            logger.error(
                "char_budget: month over budget — used %s / %s",
                f"{new_total:,}", f"{budget:,}",
            )
        elif new_total >= int(budget * 0.8):
            logger.warning(
                "char_budget: 80%% consumed — %s / %s",
                f"{new_total:,}", f"{budget:,}",
            )
    except Exception as exc:
        logger.warning("char_budget record failed: %s", exc)


def should_use_elevenlabs(estimated_chars: int = 0) -> bool:
    """Return True if `estimated_chars` more chars would still fit in
    the monthly budget. When Redis is unavailable, returns True
    (fail-open — better to overshoot a bit than to silently downgrade
    everyone)."""
    used = current_usage()
    if used is None:
        return True
    return (used + estimated_chars) < _budget()
