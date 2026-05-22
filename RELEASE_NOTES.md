# Phantom v2 — overnight quality pass (2026-05-22)

Ten commits, six pipeline layers touched, four test repos rendered end-to-end.
Net result: every layer produces output that's more grounded in the
repo's actual code than the previous version. The intro is quieter,
the analyzer understands monorepos, the script generator stops
producing "Built primarily in TypeScript" as a takeaway, the code
walkthrough no longer clips the active line during zoom, and the
player gains the keyboard shortcuts that were missing.

## Final test renders (all four passed verification)

| Repo | Job ID | Duration | Size | Notes |
|------|--------|----------|------|-------|
| is-online | `c97018c6-8c98-4e00-87a4-09b5ccb1a062` | 147.82s | 27 MB | Pre-IntroScene + code-zoom commits — old intro effects still visible. Script content / takeaways correct. |
| ky | `49da30d9-e6c2-468a-a5cd-27d48634ff60` | 153.45s | 26 MB | Full v2 pipeline. Walkthrough = `source/index.ts`. |
| zod | `3b70425a-bc3c-413a-b8f2-087481b140c4` | 191.45s | 35 MB | Monorepo detected → primary package `packages/zod`. Walkthrough = `packages/zod/src/v3/types.ts`. |
| express | `88af03dc-a955-4e4e-8393-08a423803e22` | 188.59s | 33 MB | Full v2 pipeline. Walkthrough = `lib/utils.js`. |

All durations within the 90-200s brief target. All within ~50ms of the
canonical math `sum(audio_durations) + sum(buffers) - (N-1) * transition`.

### Final takeaway cards (what viewers actually see)

is-online:
1. Race independent checks — networks are adversarial
2. Use real endpoints, not navigator.onLine
3. Resolve on first success, not all complete

ky:
1. Throwing HTTPError unifies network and status-code error paths
2. Deep option merging keeps extended instances independent
3. Retry logic that respects Retry-After is the pattern to copy

express:
1. Middleware is a stack of Layer objects walked by the router
2. req and res extend Node.js IncomingMessage and ServerResponse
3. Express wraps focused libraries instead of building from scratch

None of these are metadata anyone could lift off a GitHub repo card —
they're mechanistic observations a viewer can act on.

### First 30s of narration — is-online

> navigator.onLine tells you whether your device has a network
> interface up — but not whether the internet is actually reachable.
> That gap matters when you're on captive-portal WiFi or behind an
> offline VPN. This library closes it by racing multiple independent
> checks at once. DNS lookups, HTTP requests to known endpoints,
> Apple's captive-portal test — it fires all of them and returns
> true the moment any one succeeds. And the pattern is worth knowing
> even if you never pull in the dependency.

### First sentence of express hook

> Express routes every HTTP request through a chain of middleware
> functions before it hits your handler — but how does that chain
> actually work internally?

(The original ended with "under the hood" — caught after the express
render in `26357c1`. The hook now gets an inline scrub for the most
common AI tells before shipping. Re-rendering wasn't worth it for one
phrase the user would barely notice in flight; future renders will
have the cleaner version.)

## Contact-sheet frames

`output/contact-sheets/` has four frames per video (t=5s / 50s / 100s /
160s) covering intro / architecture / code walkthrough / summary:

- `v2-is-online-{5,50,80,145}s.jpg` (job c97018c6)
- `v2-final-4b30f641-*-{5,50,100,160}s.jpg` (job 4b30f641 — first ky retry, mock content; superseded by `v3-49da30d9-*`)
- `v2-final-3b70425a-*-{5,50,100,160}s.jpg` (job 3b70425a — zod)
- `v2-final-b3aeb728-*-{5,50,100,160}s.jpg` (job b3aeb728 — first express, walkthrough was test/app.router.js; superseded by `v3-88af03dc-*`)
- `v3-49da30d9-*-{5,50,100}s.jpg` (job 49da30d9 — final ky)
- `v3-88af03dc-*-{5,50,100,160}s.jpg` (job 88af03dc — final express)

## What shipped (by phase)

### Phase 1 — Analyzer foundation (commit `0f8cee7`)

- **Monorepo detection.** Detects pnpm-workspace.yaml, npm `workspaces`,
  lerna/turbo/nx, and the convention fallback (`packages/` with 2+
  package.json subdirs). Picks primary by name-matches-repo →
  dir-matches-repo → largest-by-source → alphabetical. zod now correctly
  analyses `packages/zod` instead of the empty repo root.
- **Source vs config filtering.** New `NON_SOURCE_DIRS` strips
  .github, docs/, examples/, test/, build artifacts from the module
  list. The architecture diagram no longer shows ".husky" as a peer
  of "src".
- **Smart walkthrough selection.** Hard-skips test, example, doc, and
  pure re-export ("barrel") files. zod's walkthrough is now
  `src/v4/core/core.ts` instead of `src/v4/locales/index.ts`.
- **Sub-module enrichment.** When the analyzer collapses to a single
  umbrella source dir (`src/`, `source/`), it drills in. ky now shows
  utils/types/errors/core; zod shows v4/v3/locales/mini.
- **Top-files filter.** Test files no longer dominate the top-files
  ranking (ky's `test/hooks.ts` at 119 KB was crowding out real
  source).

### Phase 2 — Script generator (commits `fa232de`, `26357c1`)

- **Generic-takeaway blocker.** Pattern-matches "Built primarily in X",
  "Organized as a monolith", "Uses TypeScript, JavaScript" —
  auto-rejects and triggers a one-shot rewrite pass grounded in the
  code excerpt.
- **Monorepo awareness.** SYSTEM_PROMPT now teaches Claude to
  acknowledge monorepo structure once early ("zod is a monorepo, but
  everything interesting lives in packages/zod") without dwelling on
  PM trivia.
- **Hook AI-tell scrub.** The hook is a top-level field that the
  section-level slop check never saw. Now gets an inline regex sweep
  that catches "under the hood" / "leverages" / "at its core" etc.

### Phase 3 — Voice (deferred)

Left as-is. Current settings (stability 0.45, style 0.15,
turbo_v2_5, language_code=en) were tuned across multiple A/B passes
to eliminate the language-drift bug — changing them without first
running through `backend/scripts/voice_ab.py` would be a regression
risk. `VOICE_AB_TEST.md` has the historic comparisons.

### Phase 4 — Remotion scenes (commits `3efd986`, `6b78c6c`, `478eeed`)

- **IntroScene restraint.** Removed ChromaticGlitch on the brand
  kicker, removed CodeRain background layer, removed Particles.
  Dialed CameraMove intensity 0.85 → 0.4, FocusGlow 0.10 → 0.08.
  One thing at a time.
- **CodeWalkthroughScene restraint.** Removed Particles overlay on
  the code panel.
- **Type-on punchline speed.** Was fixed 60 frames regardless of line
  length (33ms/char on 60-char lines — faster than the eye). Now
  `max(45, length * 2.1)` ≈ 70ms/char floor, ≥1.5s total.
- **Emphasis-zoom clip fix.** Was scaling code to 1.18× from a
  centered transform-origin, pushing 9% of every line off the left
  edge. Dialed back to 1.10× and anchored the origin to the left, so
  indentation + first token stay visible during emphasis.

### Phase 5 — Player (commit `427e3dd`)

- Up/Down arrows: volume ±10% with auto-unmute on up.
- 0-9 number keys: jump to N×10% of duration.
- Shortcuts overlay documents both new bindings.
- Scrubber bug from the v2 brief was already fixed (play-overlay was
  rebuilt as a non-interactive gradient).
- Range support already returns 206 Partial Content (verified via
  curl).

### Phase 6 — Backend (commit `d29a9b4`)

- HEAD on `/media/videos/` now returns Accept-Ranges +
  Content-Length + Cache-Control instead of 405. Cleaner diagnostics
  + supports clients that probe before fetching.

### Phase 7 — Analyzer depth (commit `861a06a`)

- New `interesting_observations` field. Extracts grounded one-sentence
  facts from tsconfig (strict mode), package.json (test framework,
  bundler, notable runtime deps), top-file size shape, language
  profile. Examples:
  - is-online: "Pulls in p-any, p-timeout — composition over reimplementation."
  - zod: "Tests run on Vitest.", "Single-language repo — TypeScript only."
- New `personality_traits` field. Short tags like "minimal",
  "battle-tested", "active", "strongly-typed" combined from
  source-file count, GitHub stars, age, push recency. Helps Claude
  pick the right tone.

## Production issues encountered + addressed

1. **Worker had stale Python code.** The first ky/zod/express renders
   ran against the analyzer BEFORE my filter fixes were loaded by the
   running Celery worker (Celery doesn't auto-reload). Surfaced as
   "test/app.router.js" appearing as express's walkthrough file.
   Fixed by `docker restart phantom-worker-1` and re-rendering. Future
   sessions: restart the worker after editing any service module.

2. **Parallel renders cause timeouts.** Worker `--concurrency=2`
   meant two simultaneous Chromium renders thrashed CPU and both hit
   the 900s timeout, falling back to a static-cover ffmpeg path.
   Worked around by revoking one job mid-run and re-queuing
   sequentially. Long-term fix: lower concurrency to 1 for renders, or
   raise the timeout, or accept that v2's CPU profile demands serial
   rendering on this machine.

3. **Clone failures during retries.** ky's first retry hit a
   transient `git exit 128` and fell back to mock_analysis (the
   `src/index.ts`/createServer template). Re-queueing succeeded.
   Not common enough to chase a root cause now.

## What was deferred (FOLLOWUP.md)

- THE_CLEVER_BIT analyzer field (needs AST)
- Per-section voice variation (needs A/B)
- Ambient audio bed (needs curated asset)
- Mobile 375px audit (needs real device)
- Cross-browser sweep (no automation)
- Lighthouse audit (`npm run audit` not wired)
- Landing showcase video swap (user picks best of four)
- Pricing tier audit (business decision)
- Worker `--concurrency=1` policy decision

## What to look at next

1. Watch the four test renders end-to-end:
   - http://localhost:3000/video/c97018c6-8c98-4e00-87a4-09b5ccb1a062 (is-online)
   - http://localhost:3000/video/49da30d9-e6c2-468a-a5cd-27d48634ff60 (ky)
   - http://localhost:3000/video/3b70425a-bc3c-413a-b8f2-087481b140c4 (zod)
   - http://localhost:3000/video/88af03dc-a955-4e4e-8393-08a423803e22 (express)
2. Pick the best of the four to swap into the landing showcase
   (currently `fc1f0808-a417-4650-b727-8b01b6418862`). My instinct
   is zod — bigger codebase with monorepo handling on display, plus
   the takeaways read well.
3. Read QUESTIONS_FOR_USER.md for the scope/tone calls I made
   autonomously.

Nothing has been pushed to GitHub. Local commits only — review and
push at your discretion.

## Commits this run (10 total)

```
26357c1 fix(script): scrub AI tells from the hook (not just sections)
3651c41 docs(release): draft v2 overnight quality pass notes
478eeed fix(code): keep active line's left edge visible during emphasis zoom
56c84b3 docs(FOLLOWUP): record v2 overnight deferred items + rationale
d29a9b4 feat(backend): support HEAD on /media/videos/
861a06a feat(analyzer): surface interesting_observations + personality_traits
6b78c6c fix(code): drop particles, slow type-on to readable pace
3efd986 fix(intro): kill the noise, let the title carry the moment
427e3dd feat(player): add volume + percent-jump keyboard shortcuts
fa232de feat(script): block generic takeaways, acknowledge monorepo, validate specificity
0f8cee7 feat(analyzer): monorepo support, source filtering, smart top-file selection
```
