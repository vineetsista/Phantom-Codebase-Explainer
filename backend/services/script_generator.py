"""Generate a structured video narration script from a repo analysis.

Uses Claude when ANTHROPIC_API_KEY is configured; otherwise produces a
deterministic mock script derived from the analysis so the rest of the
pipeline still runs.

Output schema (saved verbatim to videos.script_data):

    {
      "title": str,
      "hook": str,
      "total_duration_seconds": int,
      "sections": [
        {
          "id": "intro" | "architecture" | "code_walkthrough" |
                "data_flow" | "file_tree" | "summary",
          "narration": str,
          "duration_seconds": int,
          "visuals": {"type": str, "data": dict},
        }
      ],
      "key_takeaways": [str, ...],
    }
"""
from __future__ import annotations

import json
import logging
from typing import Any

from config import get_settings
from services.repo_analyzer import AnalysisResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior software engineer creating a short video explainer script for a codebase.

Given the analysis data the user provides, write a narration script that:
1. Opens with a one-sentence hook about what this project does.
2. Explains the high-level architecture in plain English.
3. Walks through the most important code paths or modules.
4. Highlights design decisions or patterns worth noticing.
5. Summarizes key takeaways.

Respond with ONLY valid JSON, no prose, matching this exact schema:

{
  "title": "string (the video title, max 80 chars)",
  "hook": "string (one compelling sentence)",
  "sections": [
    {
      "id": "intro" | "architecture" | "code_walkthrough" | "summary",
      "narration": "string (1-3 sentences of voiceover script)",
      "duration_seconds": number (5-40),
      "visuals": {
        "type": "intro_card" | "architecture_diagram" | "code_highlight" | "key_takeaways",
        "data": {}
      }
    }
  ],
  "total_duration_seconds": number,
  "key_takeaways": ["string", "string", "string"]
}

Keep total duration between 90 and 240 seconds. Be concrete — every sentence
should teach something specific. Do not use filler words.
"""

REQUIRED_SECTIONS = ("intro", "architecture", "code_walkthrough", "summary")


def generate(analysis: AnalysisResult) -> dict[str, Any]:
    settings = get_settings()
    if settings.has_claude:
        try:
            return _generate_with_claude(analysis, settings.anthropic_api_key)
        except Exception as exc:
            logger.warning("Claude script generation failed, falling back to mock: %s", exc)
    return _mock_script(analysis)


def _generate_with_claude(analysis: AnalysisResult, api_key: str) -> dict[str, Any]:
    # Import lazily so the worker boots even if the package is unavailable.
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    analysis_payload = json.dumps(analysis.to_dict(), default=str)[:18_000]

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Here is the codebase analysis. Generate the script JSON.\n\n"
                    f"```json\n{analysis_payload}\n```"
                ),
            }
        ],
    )
    text = "".join(
        block.text for block in message.content if getattr(block, "type", "") == "text"
    ).strip()
    # Tolerate accidental code-fence wrapping.
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    parsed = json.loads(text)
    return _normalize(parsed, analysis)


def _normalize(script: dict[str, Any], analysis: AnalysisResult) -> dict[str, Any]:
    """Make sure required keys exist with sane defaults and the section list
    covers the scenes we know how to render."""
    sections = script.get("sections") or []
    seen = {s.get("id") for s in sections}
    for required in REQUIRED_SECTIONS:
        if required not in seen:
            sections.append(_default_section(required, analysis))

    script["sections"] = sections
    script.setdefault("title", _default_title(analysis))
    script.setdefault("hook", _default_hook(analysis))
    script.setdefault(
        "key_takeaways",
        _default_takeaways(analysis),
    )
    script["total_duration_seconds"] = sum(
        int(s.get("duration_seconds") or 10) for s in sections
    )
    return script


def _mock_script(analysis: AnalysisResult) -> dict[str, Any]:
    return _normalize(
        {
            "sections": [
                _default_section(name, analysis) for name in REQUIRED_SECTIONS
            ],
        },
        analysis,
    )


def _default_section(section_id: str, analysis: AnalysisResult) -> dict[str, Any]:
    repo = analysis.repo
    name = repo.get("name", "this repo")
    primary_lang = repo.get("primary_language") or "code"

    if section_id == "intro":
        return {
            "id": "intro",
            "narration": (
                f"{name} is a {primary_lang} project with {analysis.file_count} "
                f"files. " + _default_hook(analysis)
            ),
            "duration_seconds": 8,
            "visuals": {
                "type": "intro_card",
                "data": {
                    "title": name,
                    "subtitle": repo.get("description") or "Codebase explainer",
                    "stars": repo.get("stars", 0),
                    "language": primary_lang,
                },
            },
        }
    if section_id == "architecture":
        modules = analysis.modules[:6] or [
            {"name": "src", "role": "Source", "description": "Primary source tree"}
        ]
        return {
            "id": "architecture",
            "narration": (
                f"The codebase is organized as a {analysis.architecture_hint}. "
                f"The main modules are {', '.join(m['name'] for m in modules)}, "
                "each playing a distinct role in the system."
            ),
            "duration_seconds": 22,
            "visuals": {
                "type": "architecture_diagram",
                "data": {"modules": modules, "hint": analysis.architecture_hint},
            },
        }
    if section_id == "code_walkthrough":
        top = analysis.top_files[:3]
        if not top:
            top = [{"path": "src/index.ts", "language": "TypeScript", "bytes": 0}]
        return {
            "id": "code_walkthrough",
            "narration": (
                "The biggest source files give us a window into the project's complexity: "
                f"{', '.join(f['path'] for f in top)}. These are where the core logic lives."
            ),
            "duration_seconds": 18,
            "visuals": {
                "type": "code_highlight",
                "data": {"files": top},
            },
        }
    # summary
    return {
        "id": "summary",
        "narration": (
            f"To recap: {name} is a {analysis.architecture_hint} written primarily in "
            f"{primary_lang}. Now you know its shape — dive in with confidence."
        ),
        "duration_seconds": 10,
        "visuals": {
            "type": "key_takeaways",
            "data": {"takeaways": _default_takeaways(analysis)},
        },
    }


def _default_title(analysis: AnalysisResult) -> str:
    return f"{analysis.repo.get('name', 'Repository')} — Codebase Explainer"


def _default_hook(analysis: AnalysisResult) -> str:
    desc = (analysis.repo.get("description") or "").strip()
    if desc:
        return desc if desc.endswith(".") else desc + "."
    return "Here's how this project is put together."


def _default_takeaways(analysis: AnalysisResult) -> list[str]:
    langs = ", ".join(list(analysis.languages.keys())[:3]) or "multiple languages"
    return [
        f"Built primarily in {analysis.repo.get('primary_language') or 'code'}",
        f"Organized as a {analysis.architecture_hint}",
        f"Uses {langs}",
    ]
