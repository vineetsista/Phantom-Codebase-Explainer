"""Content moderation — Haiku-powered classifier that decides whether
a README/repo is safe for Phantom to narrate.

We've seen abuse attempts where the README is a recruitment screed or
contains slurs / illegal content. Rather than playing whack-a-mole
with keyword lists, we ask Claude Haiku (cheap, fast) to classify the
README into one of three buckets:

  - allow     → normal codebase, narrate freely
  - soft_flag → flagged for human review (still narrated, marked on the
                video row so we can later sweep them)
  - block     → refuse to narrate; video transitions to 'failed' with
                a moderation error

Failure mode: when Claude is unavailable, default to ALLOW. We log a
warning so abuse can still be caught manually, but we don't block
generation for everyone on a Haiku outage.

Cost: Haiku at ~$0.25/M input + ~$1.25/M output. README excerpts are
capped at 4 KB; classification output is <100 tokens. So this costs
roughly $0.0015 per generation — negligible.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Literal, Optional

from config import get_settings

logger = logging.getLogger(__name__)

Verdict = Literal["allow", "soft_flag", "block"]


@dataclass
class ModerationResult:
    verdict: Verdict
    reason: str  # short human-readable reason from the classifier

    def to_dict(self) -> dict:
        return {"verdict": self.verdict, "reason": self.reason}


SYSTEM_PROMPT = """You are a content moderator for an AI tool that turns GitHub repos into narrated video walkthroughs.

Classify the README excerpt below into ONE of three verdicts:

- "allow": Normal code project (library, app, CLI, docs, etc.). Even joke / NSFL-by-name projects (e.g. "useless-machines", "garbage-collector") count as "allow" unless they cross the lines below.
- "soft_flag": Borderline — political-but-civil content, profanity in a non-targeted way, project that's a meme but contains real code. Allow but mark for review.
- "block": Genuinely unsafe to narrate: targeted slurs, doxxing material, instructions for violence, sexual content involving minors, malware specifically marketed as an attack tool (not security research), recruitment for hate movements.

Default to "allow" when uncertain. A boring or low-effort README is still "allow".

Output STRICT JSON only, no preamble:
{"verdict": "allow" | "soft_flag" | "block", "reason": "<one short sentence>"}"""


def classify_readme(readme_excerpt: str) -> ModerationResult:
    """Classify `readme_excerpt`. Empty input is auto-allowed."""
    text = (readme_excerpt or "").strip()
    if not text:
        return ModerationResult(verdict="allow", reason="empty readme — auto-allow")

    settings = get_settings()
    if not settings.has_claude:
        return ModerationResult(
            verdict="allow", reason="claude unavailable — auto-allow"
        )

    # Cap input — there's no useful signal beyond the first 4KB and we
    # don't want to pay for 100KB READMEs.
    snippet = text[:4000]

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": snippet}],
        )
        raw = message.content[0].text if message.content else ""
        parsed = _parse_verdict(raw)
        if parsed is None:
            logger.warning(
                "moderator: bad JSON from Haiku, defaulting allow. Raw=%r",
                raw[:200],
            )
            return ModerationResult(
                verdict="allow", reason="moderator parse error — auto-allow"
            )
        return parsed
    except Exception as exc:
        logger.warning("moderator: Haiku call failed (%s) — auto-allow", exc)
        return ModerationResult(
            verdict="allow", reason=f"moderator error: {exc}"
        )


def _parse_verdict(raw: str) -> Optional[ModerationResult]:
    if not raw:
        return None
    # Allow either a clean JSON object or one wrapped in markdown code fences.
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`").lstrip("json").strip()
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        return None
    verdict = data.get("verdict")
    if verdict not in ("allow", "soft_flag", "block"):
        return None
    reason = (data.get("reason") or "")[:200]
    return ModerationResult(verdict=verdict, reason=reason)
