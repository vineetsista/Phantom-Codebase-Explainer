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

