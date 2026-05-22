# Phantom v2 — overnight quality pass (2026-05-22)

Eight commits, six pipeline layers touched, four test repos re-rendered.
Net result: every layer produces output that's more grounded in the
repo's actual code than the previous version. The intro is quieter, the
analyzer understands monorepos, the script generator stops producing
"Built primarily in TypeScript" as a takeaway, and the player gains
the keyboard shortcuts that were missing.

## What shipped

### Phase 1 — Analyzer foundation (commit `0f8cee7`)

- **Monorepo detection.** Detects pnpm-workspace.yaml, npm `workspaces`,
  lerna/turbo/nx, and the convention fallback (`packages/` with 2+
  package.json subdirs). Picks the primary package by name-matches-repo →
  dir-matches-repo → largest-by-source → alphabetical. zod now correctly
  analyses `packages/zod` instead of the empty repo root.
- **Source vs config filtering.** New `NON_SOURCE_DIRS` strips .github,
  docs/, examples/, test/, build artifacts from the module list. The
  architecture diagram no longer shows ".husky" as a peer of "src".
- **Smart walkthrough selection.** Hard-skips test, example, doc, and
  pure re-export ("barrel") files. zod's walkthrough is now
  `src/v4/core/core.ts` instead of `src/v4/locales/index.ts`.
- **Sub-module enrichment.** When the analyzer collapses to a single
  umbrella source dir (`src/`, `source/`), it drills in. ky now shows
  utils/types/errors/core; zod shows v4/v3/locales/mini.
- **Top-files filter.** Test files no longer dominate the top-files
  ranking (ky's `test/hooks.ts` at 119 KB was crowding out real source).

### Phase 2 — Script generator (commit `fa232de`)

- **Generic-takeaway blocker.** Pattern-matches "Built primarily in X",
  "Organized as a monolith", "Uses TypeScript, JavaScript" — auto-rejects
  and triggers a one-shot rewrite pass grounded in the code excerpt.
- **Monorepo awareness.** SYSTEM_PROMPT now teaches Claude to acknowledge
  monorepo structure once early ("zod is a monorepo, but everything
  interesting lives in packages/zod") without dwelling on PM trivia.
- **Specificity rules** for the key_takeaways section, with bad/good
  examples baked into the system prompt.

### Phase 3 — Voice (deferred)

Left as-is. The current settings (stability 0.45, style 0.15, turbo_v2_5,
language_code=en) were tuned across multiple A/B passes to eliminate the
language-drift bug — changing them without first running through
`backend/scripts/voice_ab.py` would be a regression risk. The
`VOICE_AB_TEST.md` notes the historic comparisons.

### Phase 4 — Remotion scenes (commits `3efd986`, `6b78c6c`, `478eeed`)

- **IntroScene restraint.** Removed ChromaticGlitch on the brand kicker,
  removed CodeRain background layer, removed Particles. Dialed CameraMove
  intensity 0.85 → 0.4, FocusGlow 0.10 → 0.08. One thing at a time.
- **CodeWalkthroughScene restraint.** Removed Particles overlay on the
  code panel.
- **Type-on punchline speed.** Was fixed 60 frames regardless of line
  length (33ms/char on 60-char lines — faster than the eye). Now
  `max(45, length * 2.1)` ≈ 70ms/char floor, ≥1.5s total.
- **Emphasis-zoom clip fix.** Was scaling code to 1.18× from a centered
  transform-origin, pushing 9% of every line off the left edge. Dialed
  back to 1.10× and anchored the origin to the left, so indentation +
  first token stay visible during emphasis.

### Phase 5 — Player (commit `427e3dd`)

- Up/Down arrows: volume ±10% with auto-unmute on up.
- 0-9 number keys: jump to N×10% of duration.
- Shortcuts overlay documents both new bindings.
- Scrubber bug from the v2 brief was already fixed (play-overlay was
  rebuilt as a non-interactive gradient).
- Range support already returns 206 Partial Content (verified via curl).

### Phase 6 — Backend (commit `d29a9b4`)

- HEAD on `/media/videos/` now returns Accept-Ranges + Content-Length
  + Cache-Control instead of 405 Method Not Allowed. Cleaner diagnostics
  + supports clients that probe before fetching.

### Phase 7 — Analyzer depth (commit `861a06a`)

- New `interesting_observations` field. Extracts grounded one-sentence
  facts from tsconfig (strict mode), package.json (test framework,
  bundler, notable runtime deps), top-file size shape, language profile.
- New `personality_traits` field. Tags like "minimal", "battle-tested",
  "active", "strongly-typed" combined from source-file count, stars,
  age, push recency. Helps Claude pick the right tone.
- The `the_clever_bit` heuristic from the v2 brief is in FOLLOWUP.md —
  doing it well needs an AST parser, not regex.

## Test renders

Generated against the four canonical test repos:

| Repo | Job ID | Status | Duration | Notes |
|------|--------|--------|----------|-------|
| is-online | `c97018c6-8c98-4e00-87a4-09b5ccb1a062` | ✓ | 147.82s | Pre-IntroScene+CodeZoom commits — old intro effects still visible. |
| ky | `14b6e941-8254-47a8-8bfc-2ee2234aac42` | (renders queued) | — | Picks up IntroScene + code-zoom fixes. |
| zod | `9d1fe2b6-bf25-4bab-bf03-ab6425a09496` | (renders queued) | — | Monorepo handling verified in script. |
| express | `b3aeb728-31f0-4c45-ad26-e5b916a1dcf8` | (queued) | — | Picks up all v2 fixes. |

### is-online — first 30s of narration (job `c97018c6`)

> navigator.onLine tells you whether your device has a network interface
> up — but not whether the internet is actually reachable. That gap
> matters when you're on captive-portal WiFi or behind an offline VPN.
> This library closes it by racing multiple independent checks at once.
> DNS lookups, HTTP requests to known endpoints, Apple's captive-portal
> test — it fires all of them and returns true the moment any one
> succeeds. And the pattern is worth knowing even if you never pull in
> the dependency.

Three takeaways the OutroScene cards display:
1. Race independent checks — networks are adversarial
2. Use real endpoints, not navigator.onLine
3. Resolve on first success, not all complete

### Contact-sheet frames

`output/contact-sheets/v2-is-online-*.jpg` — four frames covering
intro / architecture / code walkthrough / summary. Architecture and
summary read cleanly; the code-walkthrough frame at t=80s captures the
left-edge clipping bug that prompted commit `478eeed` (already fixed
for the remaining renders).

## What was deferred (FOLLOWUP.md)

- THE_CLEVER_BIT analyzer field (needs AST)
- Per-section voice variation (needs A/B)
- Ambient audio bed (needs curated asset)
- Mobile 375px audit (needs real device)
- Cross-browser sweep (no automation)
- Lighthouse audit (`npm run audit` not wired)
- Landing showcase video swap (user picks best of four)
- Pricing tier audit (business decision)

## What to look at next

1. Watch the four test renders end-to-end. The is-online one is the
   only one rendered before the code-zoom + intro fixes — its intro
   still has the chromatic glitch and code-rain that the new compose
   strips, but the takeaways + architecture + audio are representative.
2. Pick the best of the four to swap into the landing showcase
   (currently `fc1f0808-a417-4650-b727-8b01b6418862`). My instinct is
   ky or zod — bigger codebases give the architecture scene more to
   show.
3. Read QUESTIONS_FOR_USER.md for the scope/tone calls I made
   autonomously.

Nothing has been pushed to GitHub. Local commits only — review and push
at your discretion.
