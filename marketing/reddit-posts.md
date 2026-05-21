# Reddit launch posts

Three variants, each tailored to the subreddit's culture. r/programming hates self-promo. r/MachineLearning wants technical depth. r/SideProject is the most forgiving but the smallest audience.

**Universal rules:**
- Read the subreddit's rules before posting. Some require flair, some forbid links in the title.
- Don't post all three on the same day. Stagger 24-48 hours apart so you're not seen as spamming.
- If a post gets removed, message the mods. Do NOT repost without permission.

---

## 1. r/programming

**Title:**
> I built a tool that turns any GitHub repo into a 3-minute narrated video walkthrough. Here's how.

**Body:**

```
I lose about a week every time I onboard onto a new codebase. The README is too high-level, the code is too low-level, there's nothing in the middle that explains the *shape* of the system.

So I built Phantom. You paste a GitHub URL, and it produces a 2-5 minute video that walks through the architecture, key files, and design choices.

The technical writeup, since this sub doesn't tolerate marketing fluff:

ARCHITECTURE
- Next.js 14 frontend, FastAPI backend, Celery worker pool
- Postgres for job state, Redis as the Celery broker
- Remotion (React-based programmatic video) for rendering
- ffmpeg fallback for hosts without Node

PIPELINE
1. Shallow-clone the repo (depth=1, single branch)
2. Walk file tree → language stats, entry points, config files, module roles
3. Send the structured analysis to Claude (Sonnet 4.5) with a strict JSON output schema for the narration script
4. Generate per-section voiceover with OpenAI tts-1-hd
5. Render the scenes — Remotion compositions read the script JSON as props
6. ffmpeg concatenates audio + video tracks

WHAT I LEARNED
- The architecture-diagram layout was harder than the LLM call. A bad force-directed layout makes the output feel cheap; I ended up with a deterministic grid with bezier connectors.
- Pre-flight the LLM's JSON output. Even with a strict schema, ~3% of responses had escape character issues. Always have a deterministic fallback.
- For repos with no README, the LLM hallucinates. The fix was system-prompting Claude to acknowledge uncertainty rather than guess.

WHAT I HAVEN'T SOLVED
- Real dependency-graph extraction from imports (currently structural from the file tree)
- Private repo support (PAT handling, encryption at rest — next week)

Source: github.com/vineetsista/Phantom
Try it: phantom.video (one free video without signup so you can see what comes out)

Curious what edge cases this falls apart on. If you have a repo it gets wrong, reply with the link.
```

**Why this works for r/programming:**
- Title leads with what was built, not "I made"
- The body is 90% technical writeup, 10% link
- "Source:" before "try it:" — open source first, product second
- Ends with a request for negative feedback, which signals you're not just here to market

---

## 2. r/MachineLearning

**Title:**
> [P] Phantom: pipeline for turning GitHub repos into narrated explainer videos (Claude + OpenAI TTS + Remotion)

**Flair:** `[P] Project`

**Body:**

```
Built a pipeline that takes a public GitHub URL and produces a 2-5 minute narrated video walkthrough of the codebase. Sharing the architecture in case it's useful for anyone working in similar territory.

PIPELINE
1. Repo analyzer: shallow clone, walk file tree, language stats, entry-point detection, config-file extraction, module role inference
2. Script generator: prompts Claude Sonnet 4.5 with a strict JSON schema, expects narration broken into typed scene sections (intro, architecture, code_walkthrough, summary)
3. TTS: OpenAI tts-1-hd, per-section synthesis, mp3 output
4. Video composition: Remotion (React-based programmatic video), one component per scene type, consumes script JSON as props
5. Final mux: ffmpeg

INTERESTING TECHNICAL CHOICES
- Strict JSON output from Claude is enforced via schema injection in the system prompt + a normalization step that fills missing required sections with deterministic defaults. ~3% of LLM calls return malformed JSON we silently repair; <1% fall through to the full mock script.
- Architecture-diagram layout is hand-rolled grid + bezier connectors rather than force-directed. Force-directed layouts looked good in 60% of cases and terrible in the other 40%; determinism trades best-case quality for consistent floor.
- I send the analyzer's full output (file tree, top files, config excerpts) into a single Claude call rather than chunking. The full dict is ~12-18kB after truncation — fits comfortably in context and avoids chunking artifacts in the narration.

THINGS I HAVEN'T SOLVED
- Better module-role inference. Currently I use a small role-hint dict ("services" → "Business services") which is brittle. Would love to swap this for a small classifier.
- The analyzer doesn't read source code to extract data flow. Adds latency + cost; trying to figure out whether the quality bump justifies it.
- Audio quality from tts-1-hd is fine but not great. The natural pause between sentences is wrong for narration-over-animation. Considering switching to ElevenLabs for the premium tier and accepting the cost increase.

Code: github.com/vineetsista/Phantom (Apache 2.0)
Try it: phantom.video

Would love feedback on the architecture, especially from anyone who's built LLM-orchestrated pipelines with strict output schemas.
```

**Why this works for r/MachineLearning:**
- `[P]` tag is required for projects
- Heavy technical body, no marketing
- The "things I haven't solved" section signals technical honesty
- Specific asks for feedback at the end — give people a reason to comment

---

## 3. r/SideProject

**Title:**
> Phantom — paste any GitHub URL, get a narrated video explainer. Launched today.

**Body:**

```
Hi all 👋

Spent the last six weeks building this — Phantom takes a GitHub URL and produces a 2-5 minute narrated video walkthrough of the codebase. Architecture, key files, design decisions.

Stack: Next.js, FastAPI, Celery, Claude API, OpenAI TTS, Remotion, ffmpeg. Cost per video: ~$0.18 all-in.

WHAT I'D LOVE FEEDBACK ON
- The landing page. Did the hero make sense in the first 3 seconds? Where did your attention go?
- The generation page — is the live progress feed satisfying to watch or does it feel like fluff?
- Pricing. $0 / $19 / $49 — does that feel right for what you'd get?

Live: phantom.video (first video is free, no signup)

Happy to share what I learned if anyone's building something adjacent. Also happy to swap feedback on your projects in the comments.
```

**Why this works for r/SideProject:**
- Short and honest
- Specific feedback asks instead of "let me know what you think"
- Offers something in return ("swap feedback on your projects")
- No technical-flex for an audience that mostly wants to share their own work
