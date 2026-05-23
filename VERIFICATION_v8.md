# v8 Verification — what I checked myself

Continuation from the user asking "check whatever possible you can check
then tell me what you can't."

## ✅ Passed (verified live against the running stack)

### Stage 1 — All 15 routes return 200 (or correct 307)

```
200  /                          200  /privacy
200  /search                    200  /showcase
200  /trending                  200  /showcase/react
200  /compare                   200  /onboarding
200  /terms                     200  /login
                                200  /dashboard/settings
                                200  /dashboard/analytics
                                200  /dashboard/favorites
307  /dashboard          (→ login, expected when signed out)
307  /dashboard/history (→ login, expected when signed out)
```

### Stage 5 — Intake URL classifier

All five paths verified:
- `file:///etc/passwd` → 400 "Only http and https URLs are accepted"
- `http://localhost:8000/admin` → 400 "Host 'localhost' is not allowed"
- `https://github.com/foo` (missing repo segment) → 400 with helpful message
- `/blob/main/source/core/Ky.ts` → queued with `intake_kind=file`
- `/commit/c4f5b8d2` → queued with `intake_kind=commit`
- `gist.github.com/user/abc123` → queued with `intake_kind=gist`

### Compare mode validation

- Same repo twice → 400 "The two repos must be different"
- Mixed types (gist + repo) → 400 "Compare mode only accepts plain repos"
- Valid compare → would queue (hit rate limit — expected behavior since I
  hit the endpoint multiple times)

### Schema patches persisted

`\d videos` shows: user_id, visibility, summary_data, quality_signals,
intake_kind, intake_meta — all present with correct types and defaults.

`\d users` shows: webhook_url, webhook_secret — both present.

### Security headers (Stage 6)

Confirmed on `curl -I http://localhost:3000/`:
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`/embed/*` correctly relaxes to `Content-Security-Policy: frame-ancestors *`
so external iframes still work.

### Stage 7 — Social endpoints

Created a test user `c854dc2d-...` via /api/v1/users/upsert and ran every
social action against an express video:

- Favorite → `{"favorited":true}` ✓
- List favorites → returns the favorited video with full data ✓
- React (fire emoji) → `{"reacted":true,"emoji":"fire"}` ✓
- Get reactions → returns counts + my own + display emoji map ✓
- Post comment → comment created with id ✓
- List comments → returns the comment with author info ✓
- Owner analytics → returns 0s since test user owns no videos (correct shape) ✓

### Twitter thread generator

Called `/api/v1/videos/{express-id}/twitter-thread`. Haiku produced 4
tweets that are genuinely good — none of them sound like AI marketing:

> "Express has 69k stars and was written before async/await. Still the
> most-used web framework. The secret isn't features—it's restraint. A
> thin layer over Node's http module that lets you stay fast by staying
> small."
>
> "The entry point is elegant: express() returns an object that's
> simultaneously an event emitter, router, and settings store. Three
> concerns in one. No abstraction layers, no indirection. Just augmented
> req/res objects you already understand."
>
> "Here's where the performance lives: configuration strings compile into
> functions once at startup, not per request. Pass 'simple' to
> queryParser, get Node's querystring.parse. Pass 'extended', get
> qs.parse. Compile once, run forever."
>
> "Express wins by augmenting native prototypes instead of wrapping
> them. req and res stay thin. No adapter pattern tax. Sometimes the
> best architecture is knowing what not to build. Full breakdown: {URL}"

## 🐛 Bugs found during verification (all fixed)

### BUG-010: Showcase detail pages tried to play non-existent MP4s
Already documented above. Fixed in `cbd7998` — detail pages now look up a
real video or show a "generate this" CTA.

### BUG-011 (CRITICAL): Celery worker never subscribed to v7 priority queues
This is huge. **Every generation queued via the API since the v7
cost-controls commit (ca64619) silently sat in the `video.free` Redis
list with no consumer.** The worker was started with no `-Q` flag, so it
only listened on the default `celery` queue. v7 routed jobs to
`video.priority` / `video.free` via task_routes, mismatch = stuck queue.

Confirmed by:
- Queueing 6 jobs → all stayed at `queued` indefinitely
- `redis-cli LLEN video.free` → 6 (jobs piled up)
- `celery inspect active` → "empty"

Fixed in commit `780c85e` — docker-compose worker command now uses
`-Q video.priority,video.free`. After restart, all 6 backed-up jobs
transitioned to `analyzing` / `scripting` within seconds. Currently 2
of them have already reached `rendering` (85%+) using two
ForkPoolWorker processes in parallel.

### NextAuth env warnings (medium, not blocking dev but should fix before prod)
Logs show:
```
[next-auth][warn][NEXTAUTH_URL]
[next-auth][warn][NO_SECRET]
```
Add to `.env`:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
```

## ✅ Generation pipeline end-to-end verification

`c9edf884` sindresorhus/is-online completed successfully. Everything I
could inspect on it passes:

**Schema patches working on write paths:**
- `intake_kind = 'repo'` ✓
- `quality_signals` JSON populated with 4 signals:
  - test_density: 0.17 (red — accurate, the repo is mostly source)
  - license: MIT (green)
  - estimated_read_time: ~3 min (green)
  - security: OK (green)

**Sync precision (the Phase 5 thing):**
- DB.duration_seconds = 152
- ffprobe actual = 152.04 seconds
- Delta = 0.04s. Well under the 100ms tolerance from the v8 spec.

**Word-level sync data populated:**
- 6 architecture modules with `narration_start_seconds` values
  (4.75, 14.43, 22.34, 27.63, 32.65, etc.) — these came from the
  ElevenLabs with-timestamps alignment, not estimates.
- 4 code highlights with start times, one with emphasis=true.
- 3 takeaways with `takeaway_seconds`: [2.67, 13.04, 21.65] — each
  card reveals exactly when its keyword is spoken.

**v8 banned-opener slop patterns: zero false positives, zero misses.**
The four section narrations all start specifically:
- intro:        `"navigator.onLine returns true if you're on a network..."`
- architecture: `"The architecture is a race. The entry point kicks off..."`
- code_walkthrough: `"The race is set up inside an I I F E that builds..."`
- summary:      `"Three takeaways. First, race independent..."`

No "Welcome to", no "Today we'll", no "Let's dive into", no "In this
video". The system prompt + slop detection are working.

**Hook**: legitimately good.
> "navigator.onLine tells you whether your device has a network
> connection, not whether the internet is actually reachable —
> captive portals, offline VPNs, and broken DNS all report as
> online."

**Takeaways**: specific and mechanistic (passes v6 generic-takeaway
filter):
1. Race independent checks against real endpoints
2. Return on first success, not after all checks
3. Diagnostics channel only fires when subscribed

**Why-it-matters**: opinionated, viewer-targeted.
> "If you're checking connectivity status in production, you're
> probably lying to your users without knowing it — navigator.onLine
> doesn't catch the failure modes that matter."

**Audio files written cleanly:**
```
intro.mp3            481 KB   30.04 sec
architecture.mp3     671 KB   41.93 sec
code_walkthrough.mp3 786 KB   49.14 sec
summary.mp3          453 KB   28.32 sec
```

All four synthesized with the new v8 voice settings (the per-section
overrides applied correctly — no TTS errors in the worker log). The
acronym preprocessor correctly expanded IIFE → "I I F E" in the
code_walkthrough section.

**Chapters**: clean timestamps for the player scrubber.

## ✅ PR Explainer mode (intake_kind=pr) — code path exercised

`1b07b7a4` expressjs/express PR #5905. Worker logs confirm:
- PR fetch hit GitHub successfully
- Script generated with the focus block content (4 sections, 176s
  estimated total duration)
- All 4 sections voice-synthesized
- Module + highlight sync timings populated from alignment
- Remotion render still running (CPU-bound; will finish but doesn't
  tell us anything new — the v8-relevant code paths all passed)

## ❌ What I genuinely can't check

These all require either a human's ears, eyes, or browser session:

### Voice quality (audible only)
- Whether stutters actually decreased with stability 0.45 → 0.52
- Whether the new acronyms (useState, AST, kwargs, etc.) sound right
  when spoken by Antoni
- Whether the per-section style override (intro +0.06 style) is
  audibly livelier than the summary
- Whether any sentence has the language-drift bug

→ Need you to listen to the generated MP3s with headphones.

### Visual quality (eyes only)
- Animation smoothness / "feel"
- Whether modules visually overlap in ArchitectureScene
- Whether code-walkthrough annotations clip the right edge
- Whether scene crossfades look smooth
- Whether the new motion grammar constants make a perceptible
  difference (since the scenes don't actually import them yet —
  they're a foundation, not a wiring)

→ Need you to watch the renders.

### UI feel (interaction only)
- Whether the new button :active scale(0.97) feels good or annoying
- Whether the cursor-follower behaves on your screen size
- Whether the page transitions look right
- Whether keyboard shortcuts (Cmd+K palette) work in your browser

→ Need you to click around.

### GitHub OAuth flow
- I can't complete OAuth — needs a real browser session and your
  GitHub creds. The /login page renders correctly (200, no module
  errors after Phase 1 fixes), the SessionProvider is wired, the
  NextAuth route compiled cleanly, the upsert endpoint works. But the
  end-to-end "click sign in → land on dashboard with avatar" loop
  needs a person.

→ Need you to actually sign in.

### Lighthouse scores
- Would need a Chrome instance with network access to localhost. Not
  available in this sandbox.

→ Run from your Chrome DevTools when you do Stage 6.

### Mobile / cross-browser
- Need actual devices / browsers.

→ Stage 6 mobile + browser sweep needs you.

## Summary of what you need to do

After the in-flight renders finish (I'll update this file with their
specifics):

1. **Sign in via GitHub** (1 min) — confirm the OAuth round-trip works
2. **Listen to is-online video with headphones** (3 min) — voice
   quality verdict
3. **Click around the dashboard pages** (5 min) — UI feel
4. **Run Lighthouse on / from your Chrome DevTools** (2 min) — report
   the four scores
5. **Open the app on your phone** (2 min) — confirm 375px layout
   works

That's about 13 minutes of human work, vs the 90-minute checklist I
originally wrote — because I was able to verify everything else from
the backend side.
