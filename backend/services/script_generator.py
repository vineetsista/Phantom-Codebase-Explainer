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
from typing import Any, Optional

from config import get_settings
from services.repo_analyzer import AnalysisResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are writing the narration for a 2-3 minute video about a code repository. The viewer is a working developer who has limited time. They COULD read the README themselves in 30 seconds. So your script has to give them something the README can't.

THE BAR. A senior engineer watching this video for 3 minutes should come away with:
  1. ONE non-obvious insight about HOW this code actually works that they
     wouldn't get from skimming the README
  2. ONE specific pattern, function, or design choice they could STEAL
     for their own work
  3. ONE concrete pitfall the code sidesteps that they'd otherwise
     stumble into
If your script only restates what the README says, you've failed. The
viewer's time was better spent on GitHub.

EVIDENCE-FIRST DISCIPLINE. The analyzer hands you the FULL TEXT of the 3-5
most-imported files in this repo (`key_files`), every exported symbol
with its line number and signature (`exports_index`), the comments that
explain WHY (`why_comments`), the substantive paragraphs from the README
(`readme_key_paragraphs`), and the changelog if it exists
(`changelog_excerpt`). USE THIS EVIDENCE.

  - Quote ACTUAL function names from `exports_index`.
  - When a `why_comments` entry reveals intent, lift the idea (not the
    literal text) into the narration: "they note that `Map` was used
    instead of `Object` because keys can be Symbols" — that's the kind
    of thing the README doesn't tell you.
  - When the README paragraph explains the motivation, paraphrase it
    once in the intro, but THEN go beyond it — surface something the
    README didn't say.
  - When the CHANGELOG shows a recent design pivot ("v4: parser is now
    streaming"), the script should land that as a takeaway.

You are explaining the user's repo. Nothing else. Never describe:
  - What AI tools do, or how this video was generated
  - Phantom, narration, voiceover, "this video", "this explainer"
  - Any meta-commentary about your own process

Your job is to produce a script that makes a developer feel they understand the codebase by the end. Not because it was entertaining, but because every observation was specific, every concept was explained, and the relationships between parts were made clear.

Rules for your output:

1. OPEN WITH A SHARP HOOK. Your hook is the first 8 seconds of the
   video. By the end of it, the viewer should be thinking "huh, I want
   to know more." Generic descriptive openers ("X is a library for…")
   are out. Required: every hook must do at least one of three things:

   (a) Quantify. A number that makes the repo concrete:
       "Express has 69,000 stars and was written before async/await
       existed."

   (b) Contrast. Set this repo against the obvious alternative:
       "Most schema validators force you to write validation logic,
       then duplicate it as TypeScript types. Zod inverts that."

   (c) Contradict. State a thing that sounds wrong but isn't:
       "The native fetch API has no built-in retry logic, no hooks,
       and no real timeout support. Ky wraps it in 13 kilobytes
       without pulling in a single dependency."

   Vague descriptive hooks ("This library handles HTTP requests
   elegantly", "Zod is a TypeScript-first schema validator") are
   FORBIDDEN. If the only way you can hook the viewer is by repeating
   the README's first sentence, the repo isn't interesting enough —
   find the interesting thing in `key_files` or `why_comments` and
   lead with that instead.

   AVOID harsh / accusatory hooks ("X lies", "X is broken", "X is
   wrong"). These read as opinions, not teaching. Reframe them as
   informational:
     BAD:  "navigator.onLine lies."
     GOOD: "navigator.onLine tells you you're on a network, not that the
            internet is reachable. This library closes that gap."

   AVOID provocative cold-takes about library authors or company
   choices. Stick to what the code does and why.

   Make the first 8 seconds make a developer want to learn more.

2. TEACH, DON'T REACT. Explain what each part does, why the author
   chose this approach, and what the viewer can take away. A great
   teacher describes the mechanism plainly, then layers in the
   "and here's why that matters" — not as a hot take, but as the
   payoff for understanding.

   "This is the part where it gets weird" is performative. "Here's
   why this approach works better than the obvious one" is teaching.

3. SHOW SPECIFICS, don't tell categories. Bad: "the codebase uses
   several design patterns." Good: "the observer pattern shows up in
   three places — let's walk through how it propagates state from the
   API client up to the React tree." Bad: "the project has good test
   coverage." Good: "the tests stub the network at the socket level
   so the retry logic is exercised under real failure conditions."

4. CONVERSATIONAL RHYTHM. Short sentences. Then a longer one with
   real content. Then a callback to something earlier. Read your
   output out loud — if it sounds like a teacher patiently explaining
   to a curious student, ship it. If it sounds like a hot take or a
   manual, rewrite.

5. CLEAR ARC across the whole video. The intro frames the question
   the library answers. The architecture and code walkthrough scenes
   explain how. The summary lands the takeaways the viewer should
   leave with.

6. SCENE TIMING: each scene's narration should be 15-35 seconds of
   natural speech. Aim for ~150 words per minute of speaking. Don't
   pad. Don't crush. If you don't have 15 seconds of real content
   for a scene, cut the scene from the output.

7. END WITH AN INFORMATIONAL TAKEAWAY, not a sales pitch. Not "and
   that's how is-online works." Closer to: "If you're checking
   network status in production, the pattern to copy is racing
   independent checks against real endpoints — that's what catches
   the failure modes navigator.onLine misses."

INFORMATIONAL DENSITY. Every sentence should EITHER explain a
mechanism (how something works), motivate a decision (why it was
chosen), or land a takeaway (what to remember). No sentences that
are pure colour ("they fought with this", "it's elegant"). Cut them.

8. SUMMARY MUST WALK THROUGH THE THREE KEY_TAKEAWAYS IN ORDER. The summary section's narration MUST explicitly mention each of the three key_takeaways, one at a time, in the same order they appear in the key_takeaways array. The on-screen cards reveal in sync with when each takeaway is spoken.

   Concretely:
   - First sentence of the summary narration introduces takeaway 1
   - Middle sentence(s) introduce takeaway 2
   - Closing sentence(s) introduce takeaway 3 + the "steal this idea" point

   Compose the narration as: "Three things to take away from this. First, [takeaway 1 paraphrased]. Then, [takeaway 2 paraphrased]. And the one to remember: [takeaway 3 paraphrased]." Or any equivalent structure that puts each takeaway in its own beat.

   The key_takeaways array MUST be three items. Each item should be the same idea the narration mentions at that point, phrased as a short 7-12 word card label.

   Bad summary narration (doesn't walk takeaways): "Most reachability checks lie by default. This library bets on the network in production. The diagnostics channel is a nice touch."

   Good summary narration (walks takeaways): "Three takeaways. First, race independent checks — networks are adversarial. Second, use real endpoints, not navigator.onLine. And the one to steal: return on first success, not after all checks complete."

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

NEVER REFERENCE SPECIFIC LINE NUMBERS. Do not say "line 48" or "on
line 12" or any absolute line number. The displayed code is a window;
the line numbers you see in the analysis input do not match what the
viewer sees in the video. Reference function names, variable names,
file paths, or structural concepts instead. "The fetchUrl helper
handles the timeout dance" beats "Line 48 wraps fetch with timeouts" —
the first is true regardless of where the code is rendered, the second
is wrong about half the time.

NEVER WRITE CODE SNIPPETS YOU DID NOT SEE IN THE INPUT. If a fact you
want to mention isn't supported by something in `top_files` or
`code_excerpt`, pick a different angle. Plausible-sounding code that
doesn't appear verbatim in the input is forbidden output.

MONOREPO HANDLING. If the input includes a `monorepo` field with
`is_monorepo: true`, acknowledge it once early in the script — usually as
a beat in the intro or the first sentence of the architecture section.
Example: "Zod is a monorepo, but the parts you care about live in
packages/zod." Don't dwell on it; the viewer wants the core insight, not
project-management trivia. The analyzer has already drilled into the
primary package — every file path, module name, and code excerpt you see
is from inside that package.

KEY TAKEAWAYS MUST BE SPECIFIC, NOT METADATA. The three key_takeaways
items appear on screen as cards. Each one must be a non-obvious
observation a viewer can act on. These are FORBIDDEN as takeaways
(they're just metadata anyone can read off the GitHub page):
  - "Built primarily in TypeScript"
  - "Organized as a monolith"
  - "Uses TypeScript, JavaScript, Shell"
  - "Has good test coverage"
  - "Open source under MIT"
GOOD takeaway examples (specific, mechanistic, steal-worthy):
  - "Schemas double as runtime validators and TypeScript types from one source"
  - "Errors carry structured paths so they map cleanly to form fields"
  - "Refinement runs after parsing, so transforms see the parsed value"

NEVER WRITE URLS, LONG DOMAIN NAMES, OR DEEP FILE PATHS INTO NARRATION.
These get read out loud character by character by the TTS and sound
terrible. Specifically forbidden in spoken text:
  - Full URLs (https://...)
  - Domain names with three or more dots ("o-o.myaddr.l.google.com",
    "api.fontshare.com")  → just say what the service IS ("Google's DNS",
    "the fonts CDN")
  - Deep file paths with multiple slashes ("src/services/foo/bar.js")
    → use just the basename or the function name
Short two-segment hosts that read as a single noun ("icanhazip dot com",
"github dot com") are fine; anything longer is not.

EXAMPLE — BAD vs GOOD, SAME REPO (sindresorhus/is-online):

BAD (too marketing, no teaching):
  "Welcome to is-online, a comprehensive JavaScript library that
  leverages multiple connectivity checks to seamlessly determine if
  your device is online."
Why it's bad: marketing language, no specifics, no teaching.

BAD (too accusatory, opinionated, performative):
  "navigator.onLine lies. It's broken. is-online fixes it."
Why it's bad: harsh, judgmental, doesn't explain HOW the standard API
falls short or WHAT this library does about it. The viewer learns
nothing concrete.

GOOD (informational, teaches WHAT + WHY):
  "navigator.onLine tells you whether your device has an active network
  connection, but not whether the internet is actually reachable. That
  matters in real conditions like captive-portal WiFi or fully offline
  VPNs. This library closes that gap by running real connectivity
  checks in parallel — DNS lookups, HTTP requests to known endpoints,
  Apple's captive-portal test — and returning the first one that
  succeeds. The pattern is worth knowing even if you don't pull in
  the dependency."

Why it's good: explains exactly what navigator.onLine returns, gives
real failure modes a developer might hit, describes the library's
approach concretely, and lands a takeaway ("the pattern is worth
knowing"). Authority comes from clarity, not confrontation.

ARCHITECTURE SECTION — TREAT IT AS A WHITEBOARD WALKTHROUGH:

The architecture scene constructs a diagram in real time as you speak.
Don't list modules — narrate a path through the system, starting at
the entry point and following dependencies outward. As you mention a
module, it appears on screen. As you describe a relationship, an arrow
draws.

For the architecture section, the JSON `visuals.data` must look like:

  {
    "modules": [
      { "id": "entry", "label": "index.js", "file_path": "index.js",
        "description": "Builder API entry — exports z.string, z.number, z.object that each return a schema instance.",
        "narration_start_seconds": 0.0 },
      { "id": "p-any", "label": "p-any", "file_path": "node_modules/p-any",
        "description": "Promise.any-style race that resolves on first success and only rejects when all checks fail.",
        "narration_start_seconds": 6.2 },
      ...
    ],
    "connections": [
      { "from": "entry", "to": "p-any", "narration_start_seconds": 6.2 },
      ...
    ],
    "data_flows": [
      { "path": ["entry", "router", "handler"], "narration_seconds": 14.0 }
    ]
  }

The `description` field is REQUIRED and should be 12-22 words. It's
displayed as a callout next to the module while the narrator is on
that module's beat. Write it as a concrete observation, not a generic
"this is the X module." Match the narration's framing — if the
narration calls something "the race", say "race" in the description.

Rules for this data:
- `narration_start_seconds` is the time, in seconds from the start of
  the architecture section's narration, when the module/connection
  first comes up. Be deliberate — the diagram constructs itself as you
  speak. Two-second resolution is fine.
- `id` must be unique within the section. Use short kebab-case slugs.
- `connections` from one module to another should match a moment in
  the narration where you describe that relationship.
- `data_flows` are optional — only include if the narration genuinely
  walks a path through the system ("request hits the router, then the
  middleware, then the handler"). The `path` is a list of module ids.

The narration for the architecture section MUST follow an arc: start
at the entry point, follow the data flow outward, end at the leaf
dependencies or the user-visible boundary. Not a flat list of modules.

CODE WALKTHROUGH SECTION — TEACH LIKE A HUMAN AT A WHITEBOARD:

CRITICAL DISCIPLINE: pick the highlighted lines FIRST, then write the
narration around them. The previous approach — writing narration
freehand and then trying to back-fill highlights from whatever's in the
code excerpt — produced videos where the narrator described "the parse
method" while the screen showed `export type ZodRawShape = ...`. That
desync is a hard fail.

The new process:
  1. Read the code excerpt. Identify 3-5 line numbers that capture the
     essential mechanism of this file. Prefer function/method
     declarations, the return statement that does the real work, a key
     conditional, an interesting type signature, or an obvious
     "punchline" line a senior engineer would point at.
  2. For each chosen line, write a one-sentence narration beat about
     EXACTLY THAT LINE'S CONTENT. Mention by name what's on that line —
     the function name, the operator, the literal — so the viewer
     hears it as they see the underline activate.
  3. Stitch those beats together with light connective tissue. The
     finished narration should still flow as one continuous thought.

When you finish, every concept named in the narration MUST exist in the
visible code excerpt. If you find yourself wanting to talk about a
"parse method" or a "Layer class" that isn't shown, either pick a
different file via the input's `top_files`, or pick different lines
within the current file that ARE shown. NEVER describe code the viewer
can't see.

The code panel auto-scrolls as you point at lines. You give one line
the punchline treatment — exactly ONE per scene — by marking it
`punchline: true`; that line types itself in character-by-character
as you speak the sentence about it. A few other lines can be marked
`emphasis: true` to trigger a zoom-in.

For the code_walkthrough section, the JSON `visuals.data` must look
like:

  {
    "code": "<the source code, verbatim from the input>",
    "path": "index.js",
    "language": "JavaScript",
    "highlights": [
      { "line_number": 8, "code": "<the exact line text>",
        "narration_start_seconds": 0.0,
        "emphasis": false, "punchline": false,
        "annotation": "diagnostics channel" },
      { "line_number": 23, "code": "<the exact line text>",
        "narration_start_seconds": 14.5,
        "emphasis": true, "punchline": false,
        "annotation": "wraps fetch with timeouts" },
      { "line_number": 48, "code": "<the exact line text>",
        "narration_start_seconds": 32.0,
        "emphasis": true, "punchline": true,
        "annotation": "this is the actual race",
        "cross_reference": { "to_file": "browser.js", "to_definition": "checkUrls", "to_line": 12 } }
    ]
  }

Rules:
- EXACTLY ONE highlight per scene has `punchline: true`. Pick the most
  important line — the one that, if a viewer remembered just one
  thing, would be enough.
- Multiple highlights can have `emphasis: true` (gets a zoom-in).
- `annotation` is 6-10 words pulled from your narration at that
  moment. Optional but encouraged.
- `cross_reference` is optional — include only when the narration
  says "this calls into X" or "defined in Y" and you have evidence
  for the target line in the input.
- `code` for each highlight must be the exact source line that
  appears in the input at that line number. No paraphrasing.

PRE-WRITE DRAFTING (DO THIS BEFORE WRITING NARRATION).

Before composing any section, write yourself a quick internal brief — DO
NOT include it in the JSON output, but use it to drive the narration:

  - **The non-obvious insight**: One sentence. What did you have to read
    the code to learn that the README didn't tell you?
  - **The stealable pattern**: One specific function, idiom, or data
    structure choice a reader could lift into their own code.
  - **The sidestepped trap**: What does this code defend against that
    most implementations get wrong?

If you can't fill all three with concrete evidence from `key_files` or
`why_comments`, the repo is too thin and you should weave a strong
takeaway into whichever you CAN fill. But never fabricate.

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
  "why_it_matters": "string — ONE sentence that ties the takeaways back to the hook and makes the viewer feel that watching was worth their time. Specific, not generic. Example: if the hook was 'navigator.onLine lies', why_it_matters could be 'If you're checking online status in production, you're probably lying to your users without knowing it.'",
  "key_takeaways": ["string", "string", "string"]
}

You receive the full repo analysis as input. Use it. Quote actual file paths, actual function names, actual line numbers, actual decisions visible in the code. Generic narration that could apply to any codebase is failure.
"""

# Spoken-word pass: final stage that smooths cadence for ear, not eye.
# Runs after stop-slop has done its job — the narration is already specific
# and opinionated, this just polishes the audio surface.
SPOKEN_WORD_PROMPT = """You are doing a spoken-word pass on a video narration script. Imagine you're a podcast editor — find places where the audio will sound clunky and fix them.

Specifically look for and fix:

1. HARD TOPIC TRANSITIONS. If a sentence ends one thought and the next starts a new topic cold, add a bridge word or rewrite to create a pivot. Example bad → good:
   BAD: "...and the result is two network requests. The library uses TypeScript."
   GOOD: "...and the result is two network requests. Worth noting — it's all written in TypeScript, which..."

2. REPETITIVE OPENINGS. If three sentences in a row start with the same word ("It's...", "It's...", "It's..." or "The...", "The...", "The..."), rewrite for variation.

3. SOFT-END → HARD-START cadence breaks. If a sentence trails off softly and the next starts with a stressed syllable, either soften the start or strengthen the previous end.

4. SENTENCES OVER 25 WORDS. Split, or add a comma where a natural breath would happen.

5. WRITING-NOT-SPEAKING phrases. Replace:
   - "Furthermore," → "Also,"
   - "It should be noted that..." → cut entirely or rewrite as a casual aside
   - "In order to..." → "to..."
   - "Utilize" → "use"
   - "Comprised of" → "made up of"

6. ACRONYMS that ElevenLabs will mispronounce. Spell phonetically if needed (NPM → "N P M", URL → "U R L", JSON → "Jason", SQL → "sequel", OAuth → "O auth"). The pipeline does this for known acronyms already, but if you see an unusual one, spell it out.

7. UNNECESSARY HEDGING. "Kind of," "sort of," "essentially," "basically" — kill them unless they are load-bearing for tone.

8. STITCHED-TOGETHER FEEL. Read each section out loud (in your head). Does it sound like one continuous thought from one person? Or like a chain of disconnected statements? Rewrite for flow.

Do NOT change the substance. Same facts, same opinions, same hook, same takeaways. Smooth the cadence.

Return the polished script in the same JSON format. Return only the JSON — no commentary, no code fences."""

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
    re.compile(r"\bbuilt on\b", re.IGNORECASE),
    # Wikipedia / encyclopedia-style sentence openers
    re.compile(r"(?:^|[.!?]\s)(?:Often referred to as|Known for|Renowned for|Notable for)\b"),
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
    # Empty intensifiers — adverbs that add no information. Caught only when
    # they precede another word so we don't trip on standalone "very" in
    # quoted text. Bias toward false positives — revision pass is cheap.
    re.compile(r"\b(?:very|really|extremely|quite|rather|fairly|pretty)\s+\w+", re.IGNORECASE),
    # Hedging — undermines authority of a senior engineer's voice
    re.compile(r"\b(?:kind of|sort of|basically|fundamentally)\b", re.IGNORECASE),
    # Em-dash overload (3+ in one section). Single em-dash mid-sentence is
    # fine; two is borderline; three or more reads as AI bingo.
    re.compile(r"(?:.*—.*){3,}", re.DOTALL),
)

# Title/hook only — adverbs. Body narration can use them sparingly.
_TITLE_ADVERB = re.compile(
    r"\b(?:Reliably|Easily|Seamlessly|Effortlessly|Quickly|Simply|Beautifully|Powerfully)\b",
)

# Hard rejects — patterns that are flat-out wrong, not just stylistically
# weak. The revision pass treats these as must-fix; if they survive 3 passes
# we strip them by hand before shipping.
_LINE_REFERENCE = re.compile(r"\bline\s+\d+\b", re.IGNORECASE)

REQUIRED_SECTIONS = ("intro", "architecture", "code_walkthrough", "summary")

# Takeaways that read as metadata, not insight. These are auto-rejected and
# trigger a revision pass — anything that could be lifted verbatim off a
# GitHub repo card is too thin to occupy one of the three summary slots.
_GENERIC_TAKEAWAY_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"^built (primarily |mainly )?in [A-Za-z+]+$", re.IGNORECASE),
    re.compile(r"^(written|coded) in [A-Za-z+]+$", re.IGNORECASE),
    re.compile(r"^organized as a? ?(monolith|library|framework|monorepo)$", re.IGNORECASE),
    re.compile(r"^uses?\s+[A-Za-z]+(,?\s+[A-Za-z+]+){1,3}\.?$", re.IGNORECASE),
    re.compile(r"^(has|with) (good |comprehensive |excellent )?test coverage", re.IGNORECASE),
    re.compile(r"^open source( under [A-Za-z 0-9]+)?\.?$", re.IGNORECASE),
    re.compile(r"^MIT licens(ed|e)\.?$", re.IGNORECASE),
    re.compile(r"^[\w\- ]+ is (an?|the) [\w\- ]+ library\.?$", re.IGNORECASE),
)


def _is_generic_takeaway(t: str) -> bool:
    t = (t or "").strip().rstrip(".!?")
    if not t or len(t) < 10:
        return True
    return any(p.search(t) for p in _GENERIC_TAKEAWAY_PATTERNS)


def _takeaway_anchor(takeaway: str) -> Optional[str]:
    """Pull a distinctive 2-3 word anchor from a takeaway for grep-style
    presence checks. Returns None if nothing distinctive can be extracted."""
    if not takeaway:
        return None
    # Drop stopwords + tokens shorter than 4 chars (less distinctive).
    stop = {
        "a", "an", "the", "is", "are", "was", "were", "to", "for", "of",
        "in", "on", "at", "by", "and", "or", "but", "with", "from", "as",
        "that", "this", "it", "be", "you", "your",
    }
    tokens = [
        w for w in re.findall(r"[A-Za-z][A-Za-z0-9_-]+", takeaway)
        if len(w) >= 4 and w.lower() not in stop
    ]
    return tokens[0].lower() if tokens else None




def _slop_score(narration: str) -> list[str]:
    """Return the list of slop patterns that match the given narration. Empty
    list means clean. Hard rejects (factually wrong, like line-number
    references) come first, then meta-AI tells, then generic slop."""
    if not narration:
        return []
    hits: list[str] = []
    if _LINE_REFERENCE.search(narration):
        hits.append("HARD: \\bline \\d+\\b — line numbers are unreliable, reference functions instead")
    for pattern in _META_PATTERNS:
        if pattern.search(narration):
            hits.append(f"META: {pattern.pattern}")
    for pattern in _SLOP_PATTERNS:
        if pattern.search(narration):
            hits.append(pattern.pattern)
    return hits


def _scrub_line_references(narration: str) -> str:
    """Last-resort scrub if line refs survive 3 revision passes. Tries to
    rewrite each match in a way that reads naturally rather than leaving
    a syntactic hole.

    Three patterns, ordered most-to-least specific:
      "Line N does X" / "Line N is X"  →  "That helper does X"  (capitalised)
      "on line N"                       →  ""  (drop the locative)
      bare "line N"                     →  "that helper"
    """
    # Locative "on line N" / "at line N" → drop entirely
    out = re.sub(
        r"\b(?:on|at)\s+line\s+\d+\b",
        "",
        narration,
        flags=re.IGNORECASE,
    )

    # Remaining "Line N" / "line N". A callback gives us the sentence-start
    # context Python's re can't express in a variable-width lookbehind.
    def _replace(match: re.Match[str]) -> str:
        prev = out[: match.start()].rstrip()
        sentence_start = not prev or prev[-1] in ".!?"
        return "That helper" if sentence_start else "that helper"

    out = re.sub(r"\bline\s+\d+\b", _replace, out, flags=re.IGNORECASE)

    # Collapse the double spaces / orphan punctuation left behind.
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\s+([,.;])", r"\1", out)
    return out.strip()


def generate(analysis: AnalysisResult) -> dict[str, Any]:
    settings = get_settings()
    if settings.has_claude:
        try:
            return _generate_with_claude(analysis, settings.anthropic_api_key)
        except Exception as exc:
            logger.warning("Claude script generation failed, falling back to mock: %s", exc)
    return _mock_script(analysis)


def _build_analysis_payload(analysis: AnalysisResult) -> str:
    """Build the JSON payload sent to Claude.

    The v4 analyzer emits MUCH more evidence than the prompt could
    swallow if naively serialized — 5 key files × 400 lines × 70 chars
    ~= 140 KB, plus exports, why-comments, README paragraphs, changelog.
    Stuffing everything into one prompt blows past 30 KB and dilutes
    Claude's attention.

    Strategy: trim each section to its highest-signal sub-fields, with
    explicit caps. The key file CODE is the single biggest payload —
    we send the first key file in full (it's the most-imported), and
    only the exports + signatures for the others. Claude can ask for
    more in a later turn if needed, but in practice the structured
    summary plus one full file is enough for the brief."""
    d = analysis.to_dict()

    # Trim key_files: full code for the top one, only metadata + exports
    # for the rest. This is the biggest token saving.
    key_files = d.get("key_files") or []
    trimmed_kf: list[dict] = []
    for i, kf in enumerate(key_files):
        if i == 0:
            trimmed_kf.append(kf)  # full
        else:
            trimmed_kf.append({
                "path": kf.get("path"),
                "language": kf.get("language"),
                "line_count": kf.get("line_count"),
                "in_degree": kf.get("in_degree"),
                "exports": kf.get("exports", [])[:20],
                # First 60 lines for context, not 400.
                "code_head": "\n".join(
                    (kf.get("code") or "").splitlines()[:60]
                ),
            })
    d["key_files"] = trimmed_kf

    # Trim config_files content — they're noisy and rarely useful.
    if d.get("config_files"):
        d["config_files"] = {
            k: (v[:1000] if isinstance(v, str) else v)
            for k, v in d["config_files"].items()
            if k in {"package.json", "Cargo.toml", "pyproject.toml", "tsconfig.json", "go.mod"}
        }

    # Trim README excerpt — readme_key_paragraphs already has the substance.
    if d.get("readme_excerpt"):
        d["readme_excerpt"] = d["readme_excerpt"][:1500]

    return json.dumps(d, default=str)[:36_000]


def _generate_with_claude(analysis: AnalysisResult, api_key: str) -> dict[str, Any]:
    # Import lazily so the worker boots even if the package is unavailable.
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    analysis_payload = _build_analysis_payload(analysis)
    logger.info("Script generator analysis payload size: %d chars", len(analysis_payload))

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=8192,
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

    # Generic-takeaway check. If any of the three key_takeaways reads like
    # metadata you could lift off the GitHub repo card, ask Claude for a
    # one-shot rewrite of the takeaways list (no need to regenerate the
    # whole script). Falls through silently on API failure.
    try:
        _enforce_specific_takeaways(client, parsed, analysis)
    except Exception as exc:
        logger.warning("Takeaway specificity pass failed: %s", exc)

    # Hook slop scrub. The hook is a top-level field (not part of any
    # section), so the per-section slop check below never sees it. AI tells
    # like "under the hood" were leaking through to the most attention-grabby
    # moment of the video. One inline regex sweep with explicit replacements
    # for the most common offenders.
    _scrub_hook_inline(parsed)

    # Code walkthrough cohesion check. If the narration discusses concepts
    # (function/identifier names) that don't appear in any highlight's
    # `code` text, the visual will desync from the audio (viewer hears
    # "parse method" while screen shows `ZodRawShape`). Detected by
    # extracting candidate identifiers from the narration and looking for
    # at least 2 of them in the highlights' code text. If too few match,
    # ask Claude for a single rewrite pass focused on this section.
    try:
        _enforce_code_narration_cohesion(client, parsed, analysis)
    except Exception as exc:
        logger.warning("Code-narration cohesion pass failed: %s", exc)

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

    # Final post-revision sweep. Anything still containing a hard-reject
    # pattern (line numbers Claude refused to give up) gets scrubbed by
    # hand so we never ship a misleading "line 48" in the audio.
    for section in parsed.get("sections", []):
        narration = section.get("narration") or ""
        if _LINE_REFERENCE.search(narration):
            scrubbed = _scrub_line_references(narration)
            logger.info(
                "Hard-scrubbing line refs in section %s: %r -> %r",
                section.get("id"), narration[:80], scrubbed[:80],
            )
            section["narration"] = scrubbed

    # Spoken-word pass — final polish for cadence. Runs even when the
    # stop-slop heuristics found nothing, because awkward sentence
    # transitions aren't pattern-matchable. One additional model call per
    # job. Skipped if it fails so we still ship.
    try:
        parsed = _spoken_word_pass(client, parsed)
        parsed["title"] = _scrub_title(parsed.get("title", ""))
        logger.info("Spoken-word pass complete")
    except Exception as exc:
        logger.warning("Spoken-word pass failed, shipping pre-pass script: %s", exc)

    return _normalize(parsed, analysis)


def _extract_identifiers(text: str) -> set[str]:
    """Pull camelCase / PascalCase / snake_case identifiers from text.
    Used to compare narration vocabulary against the code being shown."""
    if not text:
        return set()
    tokens: set[str] = set()
    # camelCase / PascalCase / lowercase identifiers, length >= 4
    for m in re.finditer(r"\b[A-Za-z][A-Za-z0-9_]{3,}\b", text):
        word = m.group(0)
        # Skip common English words — they're not load-bearing for
        # cohesion. Conservative list; we'd rather false-positive than
        # miss a real mismatch.
        if word.lower() in {
            "this", "that", "with", "from", "into", "when", "then", "what",
            "where", "which", "while", "they", "them", "their", "there",
            "have", "been", "will", "your", "yours", "ours", "each", "some",
            "code", "line", "file", "files", "type", "types", "method",
            "methods", "function", "functions", "return", "returns", "value",
            "values", "data", "object", "objects", "string", "strings",
            "number", "numbers", "array", "arrays", "input", "output",
            "step", "steps", "case", "cases", "logic", "system", "rules",
            "errors", "error", "result", "results", "first", "second",
            "third", "every", "another", "running", "based", "stays",
            "really", "happens", "above", "below", "after", "before",
            "those", "these", "without", "instead", "between", "through",
            "using", "uses", "look", "looks", "thing", "things",
        }:
            continue
        tokens.add(word)
    return tokens


def _enforce_code_narration_cohesion(
    client: Any, parsed: dict[str, Any], analysis: AnalysisResult
) -> None:
    """If the code_walkthrough narration mentions identifiers that don't
    appear in any highlight's code text, ask Claude for a one-shot rewrite
    of just the narration + highlights so they cohere.

    Heuristic: the narration should share at least 2 distinctive
    identifiers with the highlights' combined code text. Less than 2 →
    they're describing different things."""
    code_section = next(
        (s for s in parsed.get("sections", []) if s.get("id") == "code_walkthrough"),
        None,
    )
    if not code_section:
        return
    narration = code_section.get("narration") or ""
    visuals = (code_section.get("visuals") or {}).get("data") or {}
    highlights = visuals.get("highlights") or []
    if not highlights:
        return

    narration_idents = _extract_identifiers(narration)
    highlight_text = " ".join(
        (h.get("code") or "") + " " + (h.get("annotation") or "")
        for h in highlights
    )
    highlight_idents = _extract_identifiers(highlight_text)

    overlap = narration_idents & highlight_idents
    if len(overlap) >= 2:
        return  # cohesive enough

    logger.info(
        "Code-narration cohesion fail: %d shared identifiers (need ≥2). "
        "narration=%s vs highlights=%s. Triggering rewrite.",
        len(overlap),
        sorted(list(narration_idents))[:8],
        sorted(list(highlight_idents))[:8],
    )

    # Provide the FULL excerpt + current highlights, ask Claude to either
    # rewrite the narration to match the highlights OR repick highlights
    # to match the narration. Whichever yields better cohesion.
    excerpt = analysis.code_excerpt or {}
    code_text = excerpt.get("code") or ""
    system = (
        "The code walkthrough section's narration is describing concepts "
        "(identifiers, function names) that do NOT appear in any of the "
        "highlighted lines. The viewer will hear about one thing while "
        "the screen shows another. Fix this. Rewrite the section so that "
        "EVERY identifier and function name mentioned in the narration "
        "appears verbatim in at least one highlighted line's `code` text "
        "OR in its `annotation`. Pick the actual lines that contain what "
        "the narration discusses; if the lines you want aren't in the "
        "excerpt, pick DIFFERENT concepts that ARE shown. "
        "Return JSON of the form: "
        '{"narration": "...", "highlights": [{"line_number": int, '
        '"code": "exact line text", "narration_start_seconds": float, '
        '"emphasis": bool, "punchline": bool, "annotation": "6-10 words"}, '
        "...]}. EXACTLY ONE highlight has punchline=true. 3-5 highlights total."
    )
    msg = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        system=system,
        messages=[{
            "role": "user",
            "content": (
                "Current narration:\n" + narration + "\n\n"
                "Current highlights (these had no overlap with the narration):\n"
                + json.dumps(highlights, indent=2) + "\n\n"
                "Full code excerpt (you can pick any line 1.."
                + str(len(code_text.splitlines())) + "):\n```\n"
                + code_text + "\n```"
            ),
        }],
    )
    out = _extract_json(msg)
    new_narr = out.get("narration") or ""
    new_highlights = out.get("highlights") or []
    if not new_narr.strip() or not new_highlights:
        logger.warning("Cohesion rewrite returned malformed payload, keeping original")
        return

    # Validate the new highlights have ≥2 shared identifiers with the new
    # narration before accepting.
    new_h_text = " ".join(
        (h.get("code") or "") + " " + (h.get("annotation") or "")
        for h in new_highlights
    )
    new_overlap = _extract_identifiers(new_narr) & _extract_identifiers(new_h_text)
    if len(new_overlap) < 2:
        logger.warning(
            "Cohesion rewrite still has only %d shared idents; keeping original",
            len(new_overlap),
        )
        return

    code_section["narration"] = new_narr.strip()
    visuals["highlights"] = new_highlights
    logger.info(
        "Cohesion rewrite accepted: %d shared identifiers now (%s)",
        len(new_overlap), sorted(list(new_overlap))[:5],
    )


def _enforce_specific_takeaways(
    client: Any, parsed: dict[str, Any], analysis: AnalysisResult
) -> None:
    """If any of the three key_takeaways reads like generic metadata, ask
    Claude for a single replacement pass. Mutates `parsed` in place.

    Cheap (one API call, only fires when triggered) and high-leverage —
    generic takeaways were the user-reported "summary cards say nothing"
    failure mode."""
    takeaways = parsed.get("key_takeaways") or []
    bad_indices = [i for i, t in enumerate(takeaways) if _is_generic_takeaway(str(t))]
    if not bad_indices:
        return

    logger.info(
        "Generic takeaway(s) detected at index %s: %s",
        bad_indices, [takeaways[i] for i in bad_indices],
    )

    # Provide the model the analyzer payload AND the existing script so it
    # can produce takeaways grounded in real code observations.
    context = {
        "current_takeaways": takeaways,
        "bad_indices": bad_indices,
        "title": parsed.get("title", ""),
        "hook": parsed.get("hook", ""),
        "code_excerpt_path": (analysis.code_excerpt or {}).get("path", ""),
        "code_excerpt_first_lines": "\n".join(
            (analysis.code_excerpt or {}).get("code", "").splitlines()[:30]
        ),
        "module_names": [m.get("name") for m in analysis.modules[:8]],
    }
    system = (
        "You are sharpening the SUMMARY CARDS for a video about a code "
        "repository. The three key_takeaways must each be a SPECIFIC, "
        "NON-OBVIOUS observation about how this code actually works — "
        "the kind a viewer could STEAL and use in their own code. "
        "Forbidden: 'Built primarily in X', 'Organized as a monolith', "
        "'Uses TypeScript, JavaScript', 'Open source', any other "
        "metadata you could lift off a GitHub repo card. Required: a "
        "mechanism, a pattern, or a non-obvious design choice grounded "
        "in the code excerpt below. Each takeaway is 7-12 words. "
        "Return JSON: {\"key_takeaways\": [...3 strings...]}."
    )
    msg = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        system=system,
        messages=[{
            "role": "user",
            "content": (
                "Rewrite the takeaways flagged as generic. Return all three "
                "in the final array.\n\n```json\n"
                + json.dumps(context, indent=2)
                + "\n```"
            ),
        }],
    )
    out = _extract_json(msg)
    new_takeaways = out.get("key_takeaways") or []
    if (
        isinstance(new_takeaways, list)
        and len(new_takeaways) == 3
        and all(isinstance(t, str) and t.strip() for t in new_takeaways)
    ):
        parsed["key_takeaways"] = [t.strip() for t in new_takeaways]
        logger.info("Takeaways replaced: %s", parsed["key_takeaways"])
    else:
        logger.warning(
            "Takeaway rewrite returned malformed payload, keeping originals"
        )


def _spoken_word_pass(client: Any, parsed: dict[str, Any]) -> dict[str, Any]:
    """Send the current script back to Claude with the spoken-word prompt for
    a cadence/flow polish. Substance must not change — only phrasing."""
    sections_payload = [
        {"id": s.get("id"), "narration": s.get("narration", "")}
        for s in parsed.get("sections", [])
    ]
    payload = {
        "title": parsed.get("title", ""),
        "hook": parsed.get("hook", ""),
        "sections": sections_payload,
        "why_it_matters": parsed.get("why_it_matters", ""),
        "key_takeaways": parsed.get("key_takeaways", []),
    }
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        system=SPOKEN_WORD_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Polish this script for spoken cadence. Same facts and "
                    "opinions, smoother flow. Return JSON.\n\n```json\n"
                    + json.dumps(payload, indent=2)
                    + "\n```"
                ),
            }
        ],
    )
    polished = _extract_json(message)

    # Merge: replace narrations + title + hook + why_it_matters +
    # key_takeaways. Keep section-level visuals/duration intact.
    if isinstance(polished.get("title"), str) and polished["title"].strip():
        parsed["title"] = polished["title"].strip()
    if isinstance(polished.get("hook"), str) and polished["hook"].strip():
        parsed["hook"] = polished["hook"].strip()
    if isinstance(polished.get("why_it_matters"), str):
        parsed["why_it_matters"] = polished["why_it_matters"].strip()
    if isinstance(polished.get("key_takeaways"), list):
        parsed["key_takeaways"] = [
            str(t).strip() for t in polished["key_takeaways"] if str(t).strip()
        ]
    by_id = {s.get("id"): s.get("narration", "") for s in polished.get("sections", [])}
    for section in parsed.get("sections", []):
        sid = section.get("id")
        new_narr = by_id.get(sid, "").strip()
        if new_narr:
            section["narration"] = new_narr
    return parsed


def _locate_line_in_excerpt(needle: str, excerpt_lines: list[str]) -> Optional[int]:
    """Find a line of code in the excerpt. Returns 1-indexed line number,
    or None. Used as a fuzzy-match fallback when Claude returns a line of
    code but mis-attributes the line number — common when Claude has been
    reasoning about a trimmed snippet but the validator uses the full
    excerpt's indexing.

    Strategy: try exact match first, then prefix-match on a stripped
    version of the needle (in case Claude truncated)."""
    needle = (needle or "").strip()
    if len(needle) < 8:
        return None
    # Exact match first.
    for i, line in enumerate(excerpt_lines, start=1):
        if needle in line.strip():
            return i
    # Prefix match — Claude may have truncated.
    if len(needle) >= 20:
        prefix = needle[:20].strip()
        for i, line in enumerate(excerpt_lines, start=1):
            stripped = line.strip()
            if stripped.startswith(prefix):
                return i
    return None


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


def _scrub_hook_inline(parsed: dict[str, Any]) -> None:
    """The hook is the first thing the viewer hears. It was getting AI-tell
    phrases like 'under the hood' that the section-level slop check missed
    (the hook is a top-level field, not part of any section). Do a single
    targeted regex sweep over the hook with safe inline rewrites for the
    most common offenders. Anything not in REPLACEMENTS just gets flagged
    in logs so we know it slipped past."""
    hook = parsed.get("hook") or ""
    if not hook:
        return
    REPLACEMENTS: list[tuple[str, str]] = [
        (r"\bunder the hood\b", "internally"),
        (r"\bat its core\b", ""),
        (r"\bin essence\b", ""),
        (r"\bleverag(e|es|ing|ed)\b", "use"),
        (r"\butiliz(e|es|ing|ed)\b", "use"),
    ]
    new_hook = hook
    for pattern, replacement in REPLACEMENTS:
        new_hook = re.sub(pattern, replacement, new_hook, flags=re.IGNORECASE)
    new_hook = re.sub(r"\s{2,}", " ", new_hook).strip()
    new_hook = re.sub(r"\s+([,.;])", r"\1", new_hook)
    if new_hook != hook:
        logger.info("Scrubbed hook: %r -> %r", hook[:80], new_hook[:80])
        parsed["hook"] = new_hook


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

    # 3. Force the intro, architecture, and code_walkthrough scenes to use
    # the analyzer's real data. Narration is kept (Claude is allowed to
    # talk about whatever it likes); only the visual data is overwritten.
    # This is what keeps the GitHub stats / module list / code excerpt
    # honest no matter what Claude returns.
    repo = analysis.repo or {}
    intro = deduped.get("intro")
    if intro is not None:
        intro["visuals"] = {
            "type": "intro_card",
            "data": {
                "title": repo.get("name") or "Repository",
                "subtitle": repo.get("description") or "",
                "stars": int(repo.get("stars") or 0),
                "forks": int(repo.get("forks") or 0),
                "language": repo.get("primary_language") or "",
                "created_at": repo.get("created_at") or "",
                "pushed_at": repo.get("pushed_at") or "",
            },
        }

    arch = deduped.get("architecture")
    if arch is not None:
        # Accept Claude's progressive-reveal architecture schema when it's
        # well-formed (modules with id+label, connections referencing valid
        # ids). Otherwise fall back to the analyzer's flat module list so
        # the scene still has something to show.
        claude_data = (arch.get("visuals", {}) or {}).get("data", {}) or {}
        claude_modules = claude_data.get("modules")
        if (
            isinstance(claude_modules, list)
            and claude_modules
            and all(
                isinstance(m, dict) and m.get("id") and m.get("label")
                for m in claude_modules
            )
        ):
            # Sanitise: only keep connections whose endpoints are real ids.
            valid_ids = {m["id"] for m in claude_modules}
            claude_connections = [
                c for c in (claude_data.get("connections") or [])
                if isinstance(c, dict)
                and c.get("from") in valid_ids
                and c.get("to") in valid_ids
            ]
            claude_data_flows = [
                f for f in (claude_data.get("data_flows") or [])
                if isinstance(f, dict)
                and isinstance(f.get("path"), list)
                and all(p in valid_ids for p in f["path"])
            ]
            arch["visuals"] = {
                "type": "architecture_diagram",
                "data": {
                    "modules": claude_modules[:10],
                    "connections": claude_connections,
                    "data_flows": claude_data_flows,
                    "hint": analysis.architecture_hint,
                },
            }
        else:
            # Strip CI / editor / dependency directories. They show up as
            # modules because they're top-level dirs but they aren't the
            # codebase. Build a synthetic "entry -> dep" graph for repos
            # without enough top-level structure.
            non_code = {
                ".github", ".husky", ".vscode", ".idea", ".devcontainer",
                ".circleci", ".gitlab", "node_modules", "vendor", "dist",
                "build", "target", "out", "coverage", ".next", ".turbo",
                "venv", ".venv", "__pycache__",
            }
            raw_modules = [
                m for m in (analysis.modules or [])
                if m.get("name", "").lower() not in non_code
            ]
            modules = [
                {
                    "id": m["name"].lower().replace("/", "-"),
                    "label": m["name"],
                    "file_path": m.get("path") or m["name"],
                    "narration_start_seconds": i * 2.0,
                }
                for i, m in enumerate(raw_modules[:8])
            ]
            connections = []
            arch["visuals"] = {
                "type": "architecture_diagram",
                "data": {
                    "modules": modules,
                    "connections": connections,
                    "data_flows": [],
                    "hint": analysis.architecture_hint,
                },
            }

    code = deduped.get("code_walkthrough")
    if code is not None:
        excerpt = analysis.code_excerpt or {}
        code_text = excerpt.get("code", "")
        excerpt_lines = code_text.replace("\r", "").splitlines()
        claude_data = (code.get("visuals", {}) or {}).get("data", {}) or {}

        # Defense in depth on code body: log if Claude returned its own
        # `code` value that's not a substring of the analyzer excerpt.
        # The overwrite below makes the rendered code verbatim regardless.
        claude_code = claude_data.get("code")
        if claude_code and isinstance(claude_code, str) and claude_code.strip():
            if claude_code.strip() not in code_text.replace("\r", ""):
                logger.warning(
                    "code_walkthrough: Claude returned non-verbatim code "
                    "(len=%d). Overriding with analyzer excerpt (len=%d).",
                    len(claude_code), len(code_text),
                )

        # Validate Claude's highlights array. Each highlight's `code`
        # string must appear verbatim in the analyzer excerpt at the
        # claimed line number (or close to it — Claude sometimes off-by-
        # ones). Drop any highlight that fails. Enforce EXACTLY ONE
        # punchline; if Claude marked zero or multiple, fix it here.
        raw_highlights = claude_data.get("highlights") or []
        validated_highlights: list[dict[str, Any]] = []
        for h in raw_highlights:
            if not isinstance(h, dict):
                continue
            line_no = h.get("line_number")
            line_text = (h.get("code") or "").strip()
            if not isinstance(line_no, int) or line_no < 1:
                continue
            # The claimed line, if it exists. Otherwise we'll skip.
            if line_no > len(excerpt_lines):
                logger.info(
                    "Dropping highlight: line_number %d exceeds excerpt (%d lines)",
                    line_no, len(excerpt_lines),
                )
                continue
            actual = excerpt_lines[line_no - 1].strip()
            # FUZZY-LOCATE: if Claude's claimed line_number doesn't match
            # its claimed code text, but the code text DOES appear
            # elsewhere in the excerpt, use the actual location. v4
            # caught this: Claude was producing real code lines but with
            # line numbers off by 10-50, possibly because it was
            # reasoning about a trimmed copy of the file. Don't punish
            # Claude for getting the code right and the index wrong.
            if line_text and line_text not in actual and actual not in line_text:
                relocated = _locate_line_in_excerpt(line_text, excerpt_lines)
                if relocated is not None:
                    logger.info(
                        "Relocated highlight: Claude said L%d but %r is actually at L%d",
                        line_no, line_text[:40], relocated,
                    )
                    line_no = relocated
                    h["line_number"] = relocated
                    actual = excerpt_lines[line_no - 1].strip()

            # Blank / whitespace-only / decoration-only lines are never
            # useful highlights. The user reported v3 videos underlining
            # empty lines with no annotation, which looked broken.
            if not actual:
                logger.info(
                    "Dropping highlight: line %d is blank in excerpt",
                    line_no,
                )
                continue
            if actual in {"{", "}", "(", ")", "[", "]", ");", "});", "})", "});", ")", ";"}:
                logger.info(
                    "Dropping highlight: line %d is structural only (%r)",
                    line_no, actual,
                )
                continue
            # Comment-only lines are usually not the right highlight unless
            # Claude has an annotation that makes it relevant.
            comment_only = bool(
                re.match(r"^\s*(//|#|\*|/\*|\*/)", actual)
            )
            if comment_only and not (h.get("annotation") or "").strip():
                logger.info(
                    "Dropping highlight: line %d is comment-only and no annotation given",
                    line_no,
                )
                continue
            if not line_text:
                # No text supplied — accept and fill from the excerpt.
                h["code"] = actual
            elif line_text not in actual and actual not in line_text:
                # Hard mismatch even after relocation attempt. Drop.
                logger.warning(
                    "Dropping highlight: line %d text mismatch. "
                    "Claude=%r excerpt=%r",
                    line_no, line_text[:60], actual[:60],
                )
                continue
            else:
                h["code"] = actual
            validated_highlights.append(h)

        # Exactly one punchline. Promote the first emphasis line, or the
        # first highlight, if none was marked.
        punchlines = [h for h in validated_highlights if h.get("punchline")]
        if len(punchlines) > 1:
            # Keep the first, demote the rest to plain emphasis.
            for h in punchlines[1:]:
                h["punchline"] = False
                h["emphasis"] = True
        elif not punchlines and validated_highlights:
            promoted = next(
                (h for h in validated_highlights if h.get("emphasis")),
                validated_highlights[0],
            )
            promoted["punchline"] = True

        # If validation ate too many highlights, synthesize from the
        # heuristic so the scene still has structure.
        if len(validated_highlights) < 2:
            heuristic = _heuristic_highlight_lines(code_text)
            existing_lines = {h["line_number"] for h in validated_highlights}
            for i, ln in enumerate(heuristic):
                if ln in existing_lines:
                    continue
                validated_highlights.append({
                    "line_number": ln,
                    "code": excerpt_lines[ln - 1] if ln <= len(excerpt_lines) else "",
                    "narration_start_seconds": (i + 1) * 6.0,
                    "emphasis": i == 0,
                    "punchline": False,
                    "annotation": "",
                })
            # If we synthesised everything, the first one becomes the punchline.
            if validated_highlights and not any(h.get("punchline") for h in validated_highlights):
                validated_highlights[0]["punchline"] = True
                validated_highlights[0]["emphasis"] = True

        # Sanitize cross_references — keep only those with full required keys.
        for h in validated_highlights:
            xref = h.get("cross_reference")
            if not isinstance(xref, dict) or not xref.get("to_file"):
                h.pop("cross_reference", None)

        code["visuals"] = {
            "type": "code_highlight",
            "data": {
                "code": code_text,
                "path": excerpt.get("path", ""),
                "language": excerpt.get("language", ""),
                "highlights": validated_highlights,
                # Legacy field — keep for backwards compatibility with any
                # consumer that hasn't been upgraded.
                "highlight_lines": [h["line_number"] for h in validated_highlights],
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
    script.setdefault(
        "why_it_matters",
        f"If you're working with {analysis.repo.get('primary_language') or 'code'} in production, the patterns in this repo are worth stealing.",
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
                    "forks": repo.get("forks", 0),
                    "language": primary_lang,
                    "created_at": repo.get("created_at", ""),
                    "pushed_at": repo.get("pushed_at", ""),
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
    """Fallback takeaways when Claude isn't available. Tries to be at least
    a little specific by referencing the entry point and module count rather
    than the language metadata alone — the old defaults all failed the
    generic-takeaway check the script generator itself uses."""
    name = analysis.repo.get("name") or "this project"
    entry = (analysis.entry_points[:1] or [""])[0] or "the entry point"
    entry_basename = entry.rsplit("/", 1)[-1] if entry else "the entry"
    primary_module = (
        analysis.modules[0].get("name") if analysis.modules else "the source tree"
    )
    return [
        f"The entry point sits in {entry_basename}",
        f"Source flow runs through {primary_module}",
        f"{name} keeps its surface area small and focused",
    ]
