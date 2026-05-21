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

## (To be added as later problems uncover them.)
