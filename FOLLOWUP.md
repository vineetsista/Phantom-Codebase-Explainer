# Phantom v2 — Follow-up items

Out-of-scope discoveries during the v2 quality pass. Each item links to where it surfaced.

## From Problem 0

- **Embed page does not honor query params yet.** `EmbedModal.tsx` generates URLs like
  `/embed/{id}?theme=...&controls=0&autoplay=1&loop=1`, but `frontend/src/app/embed/[id]/page.tsx`
  ignores them. Wire-up needed:
  - `autoplay=1` → pass `autoPlay` + `muted` to `<VideoPlayer>` (autoplay only works muted).
  - `controls=0` → suppress the custom control overlay (add a `hideControls` prop on `VideoPlayer`).
  - `loop=1` → pass `loop` to the underlying `<video>` element.
  - `theme=light` → blocked on a full light-mode design pass. Defer to Problem 5 or later.

- **No server-side rendering of the OG image / share preview.** The ShareModal renders a "live"
  OG card from React, but Twitter / LinkedIn unfurlers don't execute JS. Need a `/api/og/[id]`
  endpoint using `@vercel/og` to render a server-side PNG.

## From Problem 5 — deferred sub-features

The v2 brief listed ~15 sub-features for Problem 5. Shipped in this pass:
toast system, Cmd+K command palette, status page, use-cases page, page
transitions (existed already), navbar/footer links to the new pages.

Deferred — each is scope-shaped enough to warrant its own commit:

- **Inline regeneration with options** (voice / length / focus area).
  Pro-tier gated, needs the `/api/v1/generate` body to accept these new
  fields and a paywall component.
- **Embed customization wire-up.** `EmbedModal` already emits a URL with
  `theme=&controls=&autoplay=&loop=`, but the embed page ignores those.
  See the Problem 0 entry above — same TODO.
- **Trending repos sidebar** on the landing page. Needs a
  `/api/v1/videos?recent=1` endpoint that returns anonymized recent
  generations + an SSE or 30 s polling client.
- **Video chapter editor.** Pro-tier UI for renaming and reordering the
  generated chapter list. Edits persisted on the `Video.script_data`
  field; needs a `PATCH /api/v1/videos/{id}` route.
- **Comparison mode.** Side-by-side two-repo view. UX TBD — easiest
  version is `/compare?a={id}&b={id}` rendering two VideoPlayers in one
  grid; honest hard version is true synced playback.
- **API docs page** at `/docs/api`. Static MDX with curl/Python/JS/TS
  samples for `/api/v1/generate` and `/api/v1/status/{id}`.
- **Blog** at `/blog` with a "Why I built Phantom" post.
- **Newsletter signup** in the footer. Buttondown or ConvertKit free tier;
  the email field + POST handler is small but needs a real account.
- **Custom cursor refinement.** Component exists (`CursorFollower`); the
  upgrade (magnetic snap to buttons, text-cursor over copy) is a focused
  60-line rewrite I haven't done.
- **Loading skeletons everywhere.** Showcase + dashboard + generate
  pipeline all have ad-hoc loading states; consolidating to a Skeleton
  primitive + adding it to every fetch boundary is straightforward but
  page-by-page.
- **Better empty states** for dashboard / search / queue empty. Needs
  illustrations or at least a strong copy pass.
- **G then H / G then S / G then D chord keybindings.** Cmd+K covers
  most of the discovery surface; the vi-style chords are a power-user
  affordance that needs a key-buffer state machine.
- **404 page parody terminal.** Existing 404 is A-tier per the audit;
  the interactive terminal is a fun-to-have, not a should-have.
- **Dark/light mode toggle.** Listed as defer-able in the brief itself —
  blocked on a full light-mode design pass.
- **Customer logos** + Lighthouse pass + cross-browser sweep.

All of these are independently shippable. Pick by user impact, not by
order listed.


## From v4 craft pass

- **Architecture mini-map.** Top-right "you are here" mini-map of all
  modules + camera frustum. Shape: 240×140 rounded rect, scaled-down
  silhouette of placements with a pulsing dot on the active module.
- **Camera-language hints.** script_generator emits camera_direction
  hints (pull-back / push-in / pan / rotate) per narration beat;
  ArchitectureScene honours them instead of just tracking the active
  module's centre.
- **Code walkthrough "result bubbles".** Floating "→ value" bubbles
  after function-call lines. Adds highlights[].result_value to the
  schema; renderer pops a small bubble below the line.
- **Sound design.** The brief asked for an ambient pad at -32dB,
  whoosh SFX on scene transitions, ping on module activations, typing
  SFX during type-on punchline. Skipped this pass — needs curated
  royalty-free SFX assets (Linear / Stripe-style subtlety). When ready:
    - Drop SFX MP3s into `frontend/public/sfx/`
    - Reference them from a new `SoundDesign.tsx` Remotion component
      that uses `<Audio>` with absolute `from` placements (whoosh at
      each scene boundary computed from script.chapters)
    - Ambient pad as `<Audio src=...volume={0.04}>` wrapping the whole
      composition


## From v2 overnight quality pass (2026-05-22)

Phases substantively shipped: 1 (analyzer monorepo + filtering),
2 (script generator monorepo awareness + generic-takeaway block),
4 (intro/code scene restraint), 5 (volume + percent keyboard
shortcuts), 6 (HEAD support), 7 (interesting_observations +
personality_traits).

Deferred from the v2 brief because they need user judgment, real
hardware, or curated assets I don't have:

- **THE_CLEVER_BIT analyzer field** (Phase 7, bullet 2). The brief
  proposed heuristics — function with most call sites, recurring
  pattern across files, names like "retry/race/memoize." Doing this
  well needs a real AST parser per language, not regex; cheap version
  would catch about half the patterns and false-positive the rest.
  The new `interesting_observations` and walkthrough-file scoring
  already give the script generator enough hooks to feature the
  clever pattern naturally (zod's narration already lands on the
  parse-vs-validate trick).
- **Per-section voice variation** (Phase 3). The voice_pipeline memory
  is explicit about how carefully the current settings were tuned to
  avoid language drift; changing `style` mid-narration risks
  regressing on that. Worth A/B testing through `backend/scripts/voice_ab.py`
  before shipping.
- **Ambient audio bed** (Phase 4, last item). Needs a curated royalty-
  free pad asset. Same note as the sound-design section above.
- **Mobile 375px audit** (Phase 5, sub-bullet). DevTools emulation
  isn't a substitute for real touch hardware; deferred to a real
  device session.
- **Cross-browser sweep** (Phase 9). Chrome / Firefox / Safari on
  the same render. No automation available in this environment.
- **Lighthouse audit** (Phase 9). `npm run audit` not wired up.
- **Landing showcase video swap** (Phase 8). Requires picking the
  "best" of the four newly-generated test videos — a judgment call
  that belongs to the user, not me. The four new job IDs are listed
  in RELEASE_NOTES.md; pick whichever reads best after watching.
- **Pricing tier audit** (Phase 8). The brief proposed Free / Pro /
  Team tiers with specific limits and prices. I don't know the
  user's actual billing plan or what they can deliver; this is a
  business decision, not a code change.
