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
import re
from typing import Any

from config import get_settings
from services.repo_analyzer import AnalysisResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior staff engineer recording a short video walkthrough of a codebase for an audience of other senior engineers you respect. You actually read the code — not just the README — and you have opinions.

Your job is to produce a script that makes a smart developer lean in and want to watch the whole thing. Not because it's flashy, but because every observation is specific, every claim is earned, and you sound like a human who actually knows what they're talking about.

Rules for your output:

1. OPEN WITH A CONCRETE HOOK based on something specific to THIS repo. Not "Welcome to..." Not "Today we'll explore..." Examples that work: "Most devs use navigator.onLine. Most devs are wrong, and this 73-line library is why." / "There's a comment from 2019 in here that aged badly, but the code it warns about is still load-bearing." / "This whole library exists because of one PR that got rejected from Node core six years ago." Make the first 8 seconds make a developer stop scrolling.

2. HAVE VOICE. A senior engineer reading code doesn't describe — they react. "Of course they used a singleton here." "This is the part where it gets weird." "They fought with this — you can tell from the second-pass refactor." Don't be over-the-top. Just sound like a person, not a manual.

3. SHOW SPECIFICS, don't tell categories. Bad: "the codebase uses several design patterns." Good: "they reach for the observer pattern in three places, and the third one is where it falls apart." Bad: "the project has good test coverage." Good: "the tests stub the network at the socket level — which is right, because half the bugs they'd otherwise catch are in the retry logic."

4. CONVERSATIONAL RHYTHM. Short sentences. Then a longer one with real content. Then a callback to something earlier. Read your output out loud — if it sounds like you're explaining to a friend at a bar, ship it. If it sounds like a manual, rewrite.

5. CLEAR ARC across the whole video, not disconnected scene blurbs. The intro states a tension or question. The architecture and code walkthrough scenes explore it. The summary resolves it with a specific takeaway the viewer can act on or remember.

6. SCENE TIMING: each scene's narration should be 15-35 seconds of natural speech. Aim for ~150 words per minute of speaking. Don't pad. Don't crush. If you don't have 15 seconds of real content for a scene, cut the scene from the output.

7. END WITH A POINT, not a summary. Not "and that's how is-online works." Closer to: "If you're checking online status in production, steal this. Not the library — the idea. Most reachability checks lie by default."

Return ONLY valid JSON (no prose, no code fences) with this exact structure:

{
  "title": "string — the actual title, not 'X overview'. Max 80 chars.",
  "hook": "string — single sentence, ~8 seconds spoken, makes a dev lean in",
  "sections": [
    {
      "id": "intro" | "architecture" | "code_walkthrough" | "summary",
      "narration": "string — the actual narration text, 15-35 seconds spoken (~38-90 words)",
      "duration_seconds": number,
      "visuals": {
        "type": "intro_card" | "architecture_diagram" | "code_highlight" | "key_takeaways",
        "data": {}
      }
    }
  ],
  "total_duration_seconds": number,
  "key_takeaways": ["string", "string", "string"]
}

You receive the full repo analysis as input. Use it. Quote actual file paths, actual function names, actual line numbers, actual decisions visible in the code. Generic narration that could apply to any codebase is failure.
"""

# Revision pass: ask Claude to fix lines that trigger the slop heuristics.
REVISION_PROMPT = """The script you just wrote has lines that read like AI slop. Tighten them.

Heuristics that fire:
- "Let's explore", "delve", "fascinating", "in conclusion", "the world of",
  "embark on", "navigate the", "harness the power"
- Three-item lists with parallel structure ("X, Y, and Z" three times in a row)
- Em-dash bingo (more than 2 em-dashes in a single section)
- Description without reaction: stating what code does without any opinion or surprise
- Generic claims that could apply to any codebase ("uses modern patterns", "well-organized")

For each section flagged below, rewrite the narration to be MORE specific
to this repo and MORE conversational. Same JSON shape, same section IDs,
same approximate duration. Return only the JSON — no commentary."""

# These are the AI-tell patterns we scan for. A section that matches any of
# these gets sent through the revision pass. Conservative on purpose — false
# positives just trigger a re-roll, which is cheap.
_SLOP_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"\blet'?s (?:explore|dive into|take a look)\b", re.IGNORECASE),
    re.compile(r"\bdelv(?:e|ing)\b", re.IGNORECASE),
    re.compile(r"\bfascinating\b", re.IGNORECASE),
    re.compile(r"\bin conclusion\b", re.IGNORECASE),
    re.compile(r"\bthe world of\b", re.IGNORECASE),
    re.compile(r"\bembark on\b", re.IGNORECASE),
    re.compile(r"\bharness(?:es|ing)? the power\b", re.IGNORECASE),
    re.compile(r"\bnavigat(?:e|ing) the\b", re.IGNORECASE),
    re.compile(r"\brobust\b", re.IGNORECASE),
    re.compile(r"\bseamless(?:ly)?\b", re.IGNORECASE),
    re.compile(r"\bleverag(?:e|es|ing)\b", re.IGNORECASE),
    re.compile(r"\bcutting[- ]edge\b", re.IGNORECASE),
    # 3+ em-dashes in a single section
    re.compile(r"(?:.*—.*){3,}", re.DOTALL),
)

REQUIRED_SECTIONS = ("intro", "architecture", "code_walkthrough", "summary")


def _slop_score(narration: str) -> list[str]:
    """Return the list of slop patterns that match the given narration. Empty
    list means clean."""
    if not narration:
        return []
    hits: list[str] = []
    for pattern in _SLOP_PATTERNS:
        if pattern.search(narration):
            hits.append(pattern.pattern)
    return hits


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
        max_tokens=3072,
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
    parsed = _extract_json(message)

    # Stop-slop / revision pass — only if heuristics actually trigger,
    # so we don't burn a second model call on every job.
    flagged = _flag_sloppy_sections(parsed)
    if flagged:
        logger.info(
            "Script first pass had %d sloppy sections (%s). Running revision pass.",
            len(flagged), ", ".join(s["id"] for s in flagged),
        )
        try:
            parsed = _revise_with_claude(client, parsed, flagged)
        except Exception as exc:
            # Revision is best-effort — if it fails, ship the first pass.
            logger.warning("Revision pass failed, shipping first-pass script: %s", exc)

    return _normalize(parsed, analysis)


def _extract_json(message: Any) -> dict[str, Any]:
    """Parse a Claude response that should be JSON. Tolerates accidental
    code-fence wrapping and leading/trailing prose."""
    text = "".join(
        block.text for block in message.content if getattr(block, "type", "") == "text"
    ).strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # If Claude added prose before the JSON, slice from the first { to the
    # last }. Safe because both characters are guaranteed in any valid JSON
    # object response.
    if not text.startswith("{"):
        first = text.find("{")
        last = text.rfind("}")
        if first >= 0 and last > first:
            text = text[first : last + 1]
    return json.loads(text)


def _flag_sloppy_sections(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the subset of sections whose narration matches any AI-tell
    heuristic. Empty list = clean script."""
    flagged: list[dict[str, Any]] = []
    for section in parsed.get("sections", []):
        hits = _slop_score(section.get("narration") or "")
        if hits:
            section_copy = dict(section)
            section_copy["_slop_hits"] = hits
            flagged.append(section_copy)
    return flagged


def _revise_with_claude(
    client: Any, original: dict[str, Any], flagged: list[dict[str, Any]]
) -> dict[str, Any]:
    """Ask Claude to rewrite the narration on flagged sections. Other
    sections pass through unchanged. The model only sees the flagged
    sections + their slop hits, not the whole script — keeps the revision
    focused."""
    payload = {
        "flagged_sections": [
            {
                "id": s["id"],
                "narration": s.get("narration", ""),
                "slop_patterns_matched": s["_slop_hits"],
            }
            for s in flagged
        ]
    }
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        system=REVISION_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "These sections triggered the slop heuristics. Rewrite "
                    "each section's narration. Return JSON of the form "
                    "{\"sections\": [{\"id\": \"...\", \"narration\": \"...\"}]}."
                    "\n\n```json\n" + json.dumps(payload, indent=2) + "\n```"
                ),
            }
        ],
    )
    revised = _extract_json(message)
    by_id = {s.get("id"): s.get("narration", "") for s in revised.get("sections", [])}
    for section in original.get("sections", []):
        if section.get("id") in by_id:
            new_narration = by_id[section["id"]].strip()
            if new_narration:
                section["narration"] = new_narration
    return original


def _normalize(script: dict[str, Any], analysis: AnalysisResult) -> dict[str, Any]:
    """Make sure required keys exist with sane defaults and the section list
    covers the scenes we know how to render."""
    sections = script.get("sections") or []
    seen = {s.get("id") for s in sections}
    for required in REQUIRED_SECTIONS:
        if required not in seen:
            sections.append(_default_section(required, analysis))

    # Always inject the analyzer's real code excerpt into code_walkthrough —
    # Claude isn't trusted to hand-write source code, so we override with the
    # excerpt actually read off disk.
    excerpt = analysis.code_excerpt or {}
    if excerpt.get("code"):
        for section in sections:
            if section.get("id") == "code_walkthrough":
                data = (section.setdefault("visuals", {}).setdefault("data", {}))
                if not data.get("code"):
                    data["code"] = excerpt.get("code", "")
                    data["path"] = excerpt.get("path", "")
                    data["language"] = excerpt.get("language", "")
                    data.setdefault(
                        "highlight_lines",
                        _heuristic_highlight_lines(excerpt.get("code", "")),
                    )
                if not data.get("files"):
                    data["files"] = analysis.top_files[:3]
                break

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
        excerpt = analysis.code_excerpt or {}
        return {
            "id": "code_walkthrough",
            "narration": (
                f"Here's a window into the code — {excerpt.get('path', top[0]['path'])}. "
                "Watch how the entry point wires the system together."
            ),
            "duration_seconds": 18,
            "visuals": {
                "type": "code_highlight",
                "data": {
                    "files": top,
                    "code": excerpt.get("code", ""),
                    "path": excerpt.get("path", ""),
                    "language": excerpt.get("language", ""),
                    "highlight_lines": _heuristic_highlight_lines(excerpt.get("code", "")),
                },
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


def _heuristic_highlight_lines(code: str) -> list[int]:
    """Pick 2–3 line numbers that are likely the most interesting — typically
    function/class definitions, exports, or top-level returns. Conservative
    on purpose; the scene draws a moving highlight box across these."""
    if not code:
        return []
    keywords = ("def ", "class ", "function ", "export ", "async ", "fn ", "func ")
    picks: list[int] = []
    for index, line in enumerate(code.splitlines()):
        stripped = line.lstrip()
        if any(stripped.startswith(k) for k in keywords):
            picks.append(index + 1)
        if len(picks) >= 3:
            break
    return picks


def _default_takeaways(analysis: AnalysisResult) -> list[str]:
    langs = ", ".join(list(analysis.languages.keys())[:3]) or "multiple languages"
    return [
        f"Built primarily in {analysis.repo.get('primary_language') or 'code'}",
        f"Organized as a {analysis.architecture_hint}",
        f"Uses {langs}",
    ]
