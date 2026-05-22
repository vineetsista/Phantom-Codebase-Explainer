"""Generate a ~500-word written summary of a codebase using Claude Haiku.

Used as a complement to the video: the same analysis feeds both, but the
written summary is text-only, instantly readable, and SEO-indexable.
Cost: ~$0.002 per summary using Haiku ($0.25/MTok input, $1.25/MTok
output). At 1000 generations/month: ~$2/month.

Output schema (kept simple — frontend reads `markdown` directly):
{
  "title": str,
  "tldr": str,                   # 1-2 sentence elevator pitch
  "markdown": str,               # the body, formatted as markdown
  "clever_bit": str | None,      # the standout pattern
  "sections": [
    {"heading": str, "body": str}, ...
  ]
}
"""
from __future__ import annotations

import json
import logging
from typing import Any

from config import get_settings
from services.repo_analyzer import AnalysisResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are writing a 500-word written companion to a code video walkthrough.

The video is 2-3 minutes. The written version is for the developer who wants the same insight in 60 seconds of reading. Keep the same tone — clear, specific, non-obvious.

Required output schema (JSON only, no prose):

{
  "title": "Repo name — short subtitle",
  "tldr": "one or two sentences that capture the essence",
  "clever_bit": "the one specific pattern, idiom, or design choice that makes this codebase stand out — null if the repo is mundane",
  "sections": [
    {
      "heading": "What it is",
      "body": "2-3 sentence paragraph explaining the problem the repo solves and roughly how"
    },
    {
      "heading": "How it works",
      "body": "3-4 sentence paragraph naming actual modules / functions and the data flow between them"
    },
    {
      "heading": "What to steal",
      "body": "2-3 sentence paragraph about the pattern worth lifting into the reader's own code"
    },
    {
      "heading": "Watch out for",
      "body": "1-2 sentence paragraph about a non-obvious tradeoff or limitation"
    }
  ]
}

DISCIPLINE:
- Quote real function names, file paths, identifiers from the analysis input. Don't invent.
- If the analysis has why_comments or readme_key_paragraphs, lean on them.
- No marketing prose. "It's a robust framework" is forbidden. "It's the routing layer for Express. The Router.handle method walks a stack of Layer objects" is good.
- Section bodies stay under 60 words each.

Return only valid JSON. No code fences, no commentary."""


def generate_summary(analysis: AnalysisResult) -> dict[str, Any] | None:
    """Generate a written summary via Claude Haiku. Returns the structured
    dict above, or None if Claude isn't configured / call fails. Caller
    decides whether to render the summary."""
    settings = get_settings()
    if not settings.has_claude:
        logger.info("summary_generator: Claude not configured, skipping")
        return None

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=settings.anthropic_api_key)
    except ImportError:
        logger.warning("summary_generator: anthropic package unavailable")
        return None

    # Build a compact payload — Haiku has the same context window as
    # Sonnet but we want to keep latency + cost low.
    payload = {
        "repo": {
            "name": analysis.repo.get("name"),
            "description": analysis.repo.get("description"),
            "primary_language": analysis.repo.get("primary_language"),
            "stars": analysis.repo.get("stars"),
        },
        "interesting_observations": analysis.interesting_observations[:6],
        "personality_traits": analysis.personality_traits,
        "exports_index": (analysis.exports_index or [])[:20],
        "why_comments": (analysis.why_comments or [])[:8],
        "readme_key_paragraphs": (analysis.readme_key_paragraphs or [])[:3],
        # First key file's code head — gives Claude enough to identify
        # function names and pick the clever bit.
        "key_file_head": (
            "\n".join(
                ((analysis.key_files or [{}])[0].get("code") or "").splitlines()[:80]
            ) if analysis.key_files else ""
        ),
        "modules": analysis.modules[:6],
    }
    body_json = json.dumps(payload, default=str)[:12_000]

    try:
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    "Write the 500-word written summary for this repo. "
                    "Return JSON only.\n\n```json\n" + body_json + "\n```"
                ),
            }],
        )
    except Exception as exc:
        logger.warning("summary_generator: Haiku call failed: %s", exc)
        return None

    text = "".join(
        b.text for b in message.content if getattr(b, "type", "") == "text"
    ).strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    if not text.startswith("{"):
        first = text.find("{")
        last = text.rfind("}")
        if first >= 0 and last > first:
            text = text[first : last + 1]

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("summary_generator: malformed JSON: %s", exc)
        return None

    # Build the markdown rendering once so the frontend can show it
    # directly. Keeps the data shape simple.
    md_parts = [f"# {data.get('title', '')}\n"]
    tldr = (data.get("tldr") or "").strip()
    if tldr:
        md_parts.append(f"> {tldr}\n")
    clever = (data.get("clever_bit") or "").strip()
    if clever:
        md_parts.append(f"**The clever bit:** {clever}\n")
    for s in data.get("sections", []) or []:
        h = (s.get("heading") or "").strip()
        b = (s.get("body") or "").strip()
        if h and b:
            md_parts.append(f"## {h}\n\n{b}\n")
    data["markdown"] = "\n".join(md_parts).strip()
    return data
