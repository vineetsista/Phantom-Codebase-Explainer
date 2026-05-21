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

You are explaining the user's repo. Nothing else. Never describe:
  - What AI tools do, or how this video was generated
  - Phantom, narration, voiceover, "this video", "this explainer"
  - Any meta-commentary about your own process, fallbacks in the
    narration tool, or the way the explainer was assembled
If you find yourself drifting into "the narrator", "the AI", "this
video", or "the system" — stop and redirect to the actual code in the
repo.

Your job is to produce a script that makes a smart developer lean in and want to watch the whole thing. Not because it's flashy, but because every observation is specific, every claim is earned, and you sound like a human who actually knows what they're talking about.

Rules for your output:

1. OPEN WITH A CONCRETE HOOK based on something specific to THIS repo. Not "Welcome to..." Not "Today we'll explore..." Examples that work: "Most devs use navigator.onLine. Most devs are wrong, and this 73-line library is why." / "There's a comment from 2019 in here that aged badly, but the code it warns about is still load-bearing." / "This whole library exists because of one PR that got rejected from Node core six years ago." Make the first 8 seconds make a developer stop scrolling.

2. HAVE VOICE. A senior engineer reading code doesn't describe — they react. "Of course they used a singleton here." "This is the part where it gets weird." "They fought with this — you can tell from the second-pass refactor." Don't be over-the-top. Just sound like a person, not a manual.

3. SHOW SPECIFICS, don't tell categories. Bad: "the codebase uses several design patterns." Good: "they reach for the observer pattern in three places, and the third one is where it falls apart." Bad: "the project has good test coverage." Good: "the tests stub the network at the socket level — which is right, because half the bugs they'd otherwise catch are in the retry logic."

4. CONVERSATIONAL RHYTHM. Short sentences. Then a longer one with real content. Then a callback to something earlier. Read your output out loud — if it sounds like you're explaining to a friend at a bar, ship it. If it sounds like a manual, rewrite.

5. CLEAR ARC across the whole video, not disconnected scene blurbs. The intro states a tension or question. The architecture and code walkthrough scenes explore it. The summary resolves it with a specific takeaway the viewer can act on or remember.

6. SCENE TIMING: each scene's narration should be 15-35 seconds of natural speech. Aim for ~150 words per minute of speaking. Don't pad. Don't crush. If you don't have 15 seconds of real content for a scene, cut the scene from the output.

7. END WITH A POINT, not a summary. Not "and that's how is-online works." Closer to: "If you're checking online status in production, steal this. Not the library — the idea. Most reachability checks lie by default."

WORDS AND PHRASES THAT SCREAM AI — DO NOT USE THEM:
  leverage, robust, seamless, comprehensive, delve, essentially, in essence,
  at its core, under the hood, powered by, built on, facilitates, enables,
  utilize, moreover, furthermore, in conclusion, it's worth noting,
  often referred to as, the world of, navigating the, harness the power,
  cutting-edge, fascinating, embark on, dive into, let's explore,
  let's take a look, let's walk through, this video, this explainer,
  this walkthrough, AI-generated, our narrator, our AI, fallback (only
  use the word "fallback" if it refers to a literal fallback feature
  inside the user's code — never as a vague positive)

EM-DASHES are an AI tell. Use at most one per scene. Prefer periods.

Three-item parallel lists ("X, Y, and Z") are an AI tell when stacked.
Use two items, or four uneven ones, or restructure into separate
sentences.

EXAMPLE — BAD vs GOOD, SAME REPO (sindresorhus/is-online):

BAD intro narration:
  "Welcome to is-online, a comprehensive JavaScript library that
  leverages multiple connectivity checks to seamlessly determine if
  your device is online. Under the hood, it utilizes parallel HTTP
  requests, DNS lookups, and an Apple captive portal test — a robust
  approach that delivers reliable results across diverse environments."

Why it's bad: "comprehensive", "leverages", "seamlessly", "utilizes",
"under the hood", "robust", three-item parallel list, three em-dashes,
"diverse environments" is meaningless.

GOOD intro narration:
  "navigator.onLine lies. It tells you you're connected to a network,
  not that the internet exists. sindresorhus's is-online is 73 lines
  that solve the actual problem — by racing four real checks against
  the live internet and returning the first one that answers. Watch how
  it bets on the network."

Why it's good: opens with a specific technical claim, names the author,
quotes a number from the code, has a stance ("bets on the network"),
ends with momentum.

Return ONLY valid JSON (no prose, no code fences) with this exact structure:

{
  "title": "string — the actual title, not 'X overview'. Max 80 chars. No adverbs (no 'Reliably', 'Easily', etc.)",
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
REVISION_PROMPT = """The script you just wrote has lines that read like AI slop. Rewrite them as a senior engineer would.

The slop heuristics fired on these patterns:
- META TELLS — describing AI / narration / video / "fallback" used as a
  vague positive instead of a real feature in the user's code. This is
  the worst kind of slop. Eliminate.
- GENERIC POSITIVES — robust, seamless, comprehensive, leverages,
  utilizes, facilitates, enables, powered by, under the hood, at its
  core. Replace with a SPECIFIC observation about the actual code.
- THROAT-CLEARING — "let's explore", "delve into", "take a look", "in
  conclusion", "moreover", "furthermore", "it's worth noting".
- EM-DASH BINGO — more than one em-dash in a section. Use periods.
- THREE-ITEM PARALLEL LISTS — restructure into two items or unequal
  separate sentences.
- ADVERBS in the title or hook — "Reliably", "Easily", "Seamlessly".
  Cut them.

You will be told which patterns matched which sections. Rewrite each
flagged narration to be MORE specific to this repo and MORE
conversational. Same JSON shape, same section IDs, same approximate
duration. Return only the JSON — no commentary, no code fences."""


# Meta-AI tells — phrases that betray the narrator is an AI describing
# itself rather than the code. These are the most embarrassing slop and
# the user explicitly flagged them. The `fallback` regex deliberately
# only catches the meta uses (a free-floating "fallback" without a noun
# nearby like "fallback URL" or "fallback strategy" that would indicate
# the code itself has a fallback feature).
_META_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"\bAI[- ]generated\b", re.IGNORECASE),
    re.compile(r"\bour (?:AI|narrator|system)\b", re.IGNORECASE),
    re.compile(r"\bthis (?:video|explainer|walkthrough|narration)\b", re.IGNORECASE),
    re.compile(r"\bphantom\b(?! .*(?:library|engine|type))", re.IGNORECASE),
    re.compile(r"\bnarrator\b", re.IGNORECASE),
    re.compile(r"\bnarration\b", re.IGNORECASE),
    re.compile(r"\bvoiceover\b", re.IGNORECASE),
)

# Generic slop — words and phrases that read as AI on any topic.
_SLOP_PATTERNS: tuple[re.Pattern, ...] = (
    # Throat-clearing / academic transitions
    re.compile(r"\blet'?s (?:explore|dive into|take a look|walk through)\b", re.IGNORECASE),
    re.compile(r"\bdelv(?:e|ing)\b", re.IGNORECASE),
    re.compile(r"\bin conclusion\b", re.IGNORECASE),
    re.compile(r"\bin essence\b", re.IGNORECASE),
    re.compile(r"\bat its core\b", re.IGNORECASE),
    re.compile(r"\bunder the hood\b", re.IGNORECASE),
    re.compile(r"\bit'?s worth noting\b", re.IGNORECASE),
    re.compile(r"\boften referred to as\b", re.IGNORECASE),
    re.compile(r"\bmoreover\b", re.IGNORECASE),
    re.compile(r"\bfurthermore\b", re.IGNORECASE),
    re.compile(r"\bessentially\b", re.IGNORECASE),
    # Marketing-speak / vague positives
    re.compile(r"\brobust\b", re.IGNORECASE),
    re.compile(r"\bseamless(?:ly)?\b", re.IGNORECASE),
    re.compile(r"\bcomprehensive(?:ly)?\b", re.IGNORECASE),
    re.compile(r"\bleverag(?:e|es|ing|ed)\b", re.IGNORECASE),
    re.compile(r"\butilize(?:s|d|ing)?\b", re.IGNORECASE),
    re.compile(r"\bfacilitates?\b", re.IGNORECASE),
    re.compile(r"\benables?\b", re.IGNORECASE),
    re.compile(r"\bpowered by\b", re.IGNORECASE),
    re.compile(r"\bcutting[- ]edge\b", re.IGNORECASE),
    re.compile(r"\bfascinating\b", re.IGNORECASE),
    re.compile(r"\bthe world of\b", re.IGNORECASE),
    re.compile(r"\bembark on\b", re.IGNORECASE),
    re.compile(r"\bharness(?:es|ing)? the power\b", re.IGNORECASE),
    re.compile(r"\bnavigat(?:e|ing) the\b", re.IGNORECASE),
    # Em-dash overload (2+ in one section)
    re.compile(r"(?:.*—.*){2,}", re.DOTALL),
)

# Title/hook only — adverbs. Body narration can use them sparingly.
_TITLE_ADVERB = re.compile(
    r"\b(?:Reliably|Easily|Seamlessly|Effortlessly|Quickly|Simply|Beautifully|Powerfully)\b",
)

REQUIRED_SECTIONS = ("intro", "architecture", "code_walkthrough", "summary")


def _slop_score(narration: str) -> list[str]:
    """Return the list of slop patterns that match the given narration. Empty
    list means clean. Meta-tells are listed first so the revision prompt
    knows which ones are the embarrassing ones."""
    if not narration:
        return []
    hits: list[str] = []
    for pattern in _META_PATTERNS:
        if pattern.search(narration):
            hits.append(f"META: {pattern.pattern}")
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

    # Strip title adverbs ("Reliably Check…", "Easily Build…") before any
    # revision pass. Cheap and deterministic — saves a round trip.
    parsed["title"] = _scrub_title(parsed.get("title", ""))

    # Up to 3 stop-slop / revision passes. Each pass is only invoked when
    # heuristics actually fire, so the typical job pays for at most one
    # extra model call. A pass that doesn't reduce the slop count gets
    # short-circuited — Claude isn't improving, we'd just be burning
    # tokens.
    last_count = 1 << 30
    for attempt in range(1, 4):
        flagged = _flag_sloppy_sections(parsed)
        if not flagged:
            if attempt > 1:
                logger.info("Stop-slop clean after %d revision pass(es)", attempt - 1)
            break
        if len(flagged) >= last_count:
            logger.info(
                "Revision pass %d didn't reduce slop (%d → %d). Shipping anyway.",
                attempt - 1, last_count, len(flagged),
            )
            break
        last_count = len(flagged)
        logger.info(
            "Script revision pass %d: %d sloppy section(s) — %s",
            attempt, len(flagged), ", ".join(s["id"] for s in flagged),
        )
        try:
            parsed = _revise_with_claude(client, parsed, flagged)
            parsed["title"] = _scrub_title(parsed.get("title", ""))
        except Exception as exc:
            logger.warning(
                "Revision pass %d failed, shipping previous version: %s",
                attempt, exc,
            )
            break

    return _normalize(parsed, analysis)


def _scrub_title(title: str) -> str:
    """Strip adverbs from titles. Single-pass regex; preserves the rest."""
    cleaned = _TITLE_ADVERB.sub("", title or "")
    # Collapse the doubled spaces that the substitution leaves behind.
    return re.sub(r"\s{2,}", " ", cleaned).strip()


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
    """Reshape Claude's output into the strict schema the renderer requires.

    Critical invariants (each backed by a real failure we hit in production):
      - Each REQUIRED_SECTIONS id appears at most once. Claude has been seen
        emitting two `architecture` sections in the same script.
      - Sections render in canonical order: intro → architecture →
        code_walkthrough → summary. Claude's order is otherwise wherever it
        feels like.
      - Architecture's `visuals.data.modules` comes from the analyzer, not
        from Claude. Claude has been seen producing `{nodes, edges}` which
        the ArchitectureScene component does not read, leaving the scene
        empty below its header.
      - Code walkthrough's `visuals.data.code` comes from the analyzer for
        the same reason — we don't trust the model to hand-write source.
      - If a scene has no real data to render (e.g. architecture with zero
        modules for a single-file library), the scene is dropped from the
        timeline entirely. An empty header is worse than no scene.
    """
    raw_sections = script.get("sections") or []

    # 1. Dedupe by id (keep first occurrence). Sections with missing ids are
    # discarded — every renderable scene must declare its kind.
    deduped: dict[str, dict[str, Any]] = {}
    for section in raw_sections:
        sid = section.get("id")
        if not sid or sid in deduped:
            continue
        deduped[sid] = section

    # 2. Make sure every required scene has a section, even if Claude omitted
    # one. The defaults are deliberately spare — Claude's revision pass and
    # _normalize's data injection below are what make them watchable.
    for required in REQUIRED_SECTIONS:
        if required not in deduped:
            deduped[required] = _default_section(required, analysis)

    # 3. Force the architecture and code_walkthrough scenes to use the
    # analyzer's real data. Narration is kept (Claude is allowed to talk
    # about whatever it likes); only the visual data is overwritten.
    arch = deduped.get("architecture")
    if arch is not None:
        # Strip CI / editor / dependency directories. They show up as modules
        # because they're top-level dirs but they aren't the codebase. A repo
        # whose only "module" is `.github` is a repo with no architecture
        # diagram to show.
        non_code = {
            ".github", ".husky", ".vscode", ".idea", ".devcontainer",
            ".circleci", ".gitlab", "node_modules", "vendor", "dist",
            "build", "target", "out", "coverage", ".next", ".turbo",
            "venv", ".venv", "__pycache__",
        }
        modules = [
            m for m in (analysis.modules or [])
            if m.get("name", "").lower() not in non_code
        ]
        arch["visuals"] = {
            "type": "architecture_diagram",
            "data": {
                "modules": modules[:8],
                "hint": analysis.architecture_hint,
            },
        }

    code = deduped.get("code_walkthrough")
    if code is not None:
        excerpt = analysis.code_excerpt or {}
        code_text = excerpt.get("code", "")
        code["visuals"] = {
            "type": "code_highlight",
            "data": {
                "code": code_text,
                "path": excerpt.get("path", ""),
                "language": excerpt.get("language", ""),
                "highlight_lines": _heuristic_highlight_lines(code_text),
                "files": analysis.top_files[:3],
            },
        }

    # 4. Drop scenes that have nothing to render. A single-file library has
    # no meaningful architecture diagram; one module rendered alone looks
    # broken. Require at least two real modules before showing the scene.
    if arch is not None and len(arch["visuals"]["data"]["modules"]) < 2:
        logger.info(
            "Dropping architecture scene — only %d real modules after filtering",
            len(arch["visuals"]["data"]["modules"]),
        )
        del deduped["architecture"]
    if code is not None and not code["visuals"]["data"]["code"]:
        logger.info("Dropping code_walkthrough scene — analyzer found no excerpt")
        del deduped["code_walkthrough"]

    # 5. Re-order into canonical sequence. Non-required scenes (rare) are
    # appended after the required ones in Claude's original order.
    ordered: list[dict[str, Any]] = []
    for required in REQUIRED_SECTIONS:
        if required in deduped:
            ordered.append(deduped.pop(required))
    ordered.extend(deduped.values())

    script["sections"] = ordered
    script.setdefault("title", _default_title(analysis))
    script.setdefault("hook", _default_hook(analysis))
    script.setdefault(
        "key_takeaways",
        _default_takeaways(analysis),
    )
    script["total_duration_seconds"] = sum(
        int(s.get("duration_seconds") or 10) for s in ordered
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
