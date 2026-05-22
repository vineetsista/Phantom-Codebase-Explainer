# RepoX v6 — follow-up roadmap

Shipped this round (commits `1c85b89` → `2c8398a`):

- Video fixes: annotation card right-side preference + viewport-relative,
  HTTP/acronym phonetic spellings (no more "HT...TP" pauses), Antoni as
  default voice, end-of-arch sync drift fixed via decayed blend weight.
- **Phase 1** — Auth foundation. NextAuth + GitHub OAuth, `users` table,
  X-User-Id header trust model, `/api/v1/me` + `/api/v1/users/upsert`,
  quota enforcement on `/generate` gated behind REQUIRE_AUTH flag.
- **Phase 2** — Stripe billing scaffold. `/api/v1/billing/checkout`,
  `/portal`, `/webhook`. 503s gracefully when STRIPE_SECRET_KEY isn't
  set. Reusable `<Paywall>` component.
- **Phase 3** — Multi-format outputs (started). Written summary via
  Claude Haiku, `summary_data` JSON column on Video, GET
  `/api/v1/videos/{id}/summary`, `/video/[id]/summary` page, README
  badge SVG at `/api/badge/{owner}/{repo}.svg`.

What follows is the rest of the v6 brief, sequenced + sized + with
explicit "what's blocking this from being done" notes.

---

## Activation needed before any of this matters

These are the unblockers — without them, the work above is dormant code.

| Step | Effort | Notes |
|---|---|---|
| **Register GitHub OAuth app** at https://github.com/settings/applications/new with callback URL `http://localhost:3000/api/auth/callback/github` (dev) and the production URL. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. | XS | 5 minutes. |
| Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`. | XS | 30 seconds. |
| `npm install` in `/frontend` to pull in `next-auth@4.24.10`. | XS | One command. |
| `pip install stripe==11.1.0` in the backend container (or rebuild). | XS | One command. |
| **Drop + recreate the dev database** so the new `users` table + `videos.user_id` + `videos.visibility` + `videos.summary_data` columns get created. `init_db()` is CREATE-IF-NOT-EXISTS only. | S | Production needs a real Alembic migration before this rolls out — listed in Phase 12 below. |
| Set `REQUIRE_AUTH=1` in `.env` once OAuth is working to actually enforce sign-in. Until then, anonymous generations still go through (legacy behavior). | XS | Flip the flag. |
| (Optional for Phase 2 testing) Create Stripe test products, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`. | S | Stripe test mode is free. |

---

## Phase 3 leftovers (multi-format)

| Item | Effort | Notes |
|---|---|---|
| **Dynamic OG card with frame strip.** The current `/api/og` route returns a generic Phantom OG. Per-video OG with 4 frames extracted from the actual MP4 via ffmpeg. | M | Needs a new service that pulls `frames[0/30/60/90]%` out of the rendered MP4 + composes them into a 1200×630 PNG. Cache aggressively (frames don't change). |
| **Profile pages at `/@username`.** Loads user's public videos in a grid + view-count rollup + "Generate yours" CTA. | M | Routes only; relies on `users` + `videos.user_id`. Frontend page + API for `/api/v1/users/[username]/videos`. |
| **Repo pages at `/repo/[owner]/[name]`.** Backend API `/api/v1/repo/{owner}/{name}` already shipped. Need the frontend page that renders all videos for the repo + the written summary + clever-bit highlight + "generate fresh" CTA. | M | High SEO leverage — every analyzed repo becomes a permanent indexable page. |
| **Slug URLs for videos.** Today `/video/[id]` uses a UUID. Want `/video/[owner]/[repo]/[short-id]` too. | S | Adds rewrites in `next.config.js` + a slug column to `videos`. |
| **Embed customization wire-up.** EmbedModal already emits `theme/controls/autoplay/loop` query params but the embed page ignores them. (Already in FOLLOWUP.md.) | S | Read query params in `app/embed/[id]/page.tsx`. |

---

## Phase 4 — Smart code features

The strategic high-leverage phase: makes RepoX feel like an intelligence
tool, not a video generator.

| Item | Effort | Notes |
|---|---|---|
| **PR Explainer mode.** Paste a PR URL, get a 60-90s video about the diff. Fetch PR data via GitHub API, run a diff-aware analysis pass, generate a focused script. | L | New `services/pr_analyzer.py`. Sits beside `repo_analyzer.py`. PR mode counts as one quota unit. |
| **Language-aware analysis.** Detect framework (Django/Flask/FastAPI for Python; Next.js/Express/NestJS for TS) and pass `language_context` to script generator. | M | New field on `AnalysisResult`. Detection logic in `repo_analyzer.py`. Prompt change in `script_generator.py`. |
| **Quality + risk signals panel.** Bus factor, test density, doc coverage, dep freshness, activity level, license clarity, security red flags, TS strictness, estimated read time. Rendered below the video player. | L | Each signal computed in the analyzer. Display component on the video page. Most are simple aggregations of existing analyzer fields. |
| **"The Clever Bit" surfaced.** Already in analyzer as `the_clever_bit` (sort of — derived from `interesting_observations`). Make it explicit in summary + video + a video-page callout. | S | Mostly schema/prompt changes. Component exists in summary page. |

---

## Phase 5 — Distribution

| Item | Effort | Notes |
|---|---|---|
| **GitHub Action.** Separate repo in `actions/phantom-action`. Reads `PHANTOM_API_KEY` from secrets, POSTs to `/api/v1/generate`, comments on the release. | L | Needs `actions/` directory. Composite action in `action.yml`. Publish to Marketplace later. |
| **API keys.** `api_keys` table (user_id, key_hash, name, last_used, created_at). `/settings/api-keys` page. `Authorization: Bearer phk_...` accepted on `/api/v1/generate`. | M | Pro+ feature. Hash keys with bcrypt or just SHA-256 (prefix `phk_` makes them easy to recognize). |
| **Webhooks.** On generation complete, POST to a user-provided URL. Pro feature. Test endpoint that fires a sample. | M | `user.webhook_urls` JSON column. Async POST from worker. |

---

## Phase 6 — Dashboard

| Item | Effort | Notes |
|---|---|---|
| `/dashboard` home — usage card, quick generate, recent videos grid, suggestions. | M | Most data already accessible via existing API. |
| `/dashboard/history` — paginated list of user's videos, filterable by status/visibility/language/date. | M | Reuses `/api/v1/videos?user_id=...` with new query param. |
| `/dashboard/settings` — profile, default voice, default visibility, custom watermark, notification prefs, connected accounts, API keys, webhooks, billing link, danger zone. | L | All fields exist on `User` already; need PATCH `/api/v1/me` endpoint. |
| `/dashboard/favorites` — favorited videos. | S | Need `favorites` join table. |
| Collections (Pro only). | M | Named groups of videos, shareable. New `collections` + `collection_videos` tables. |

---

## Phase 7 — Public showcase upgrades

| Item | Effort | Notes |
|---|---|---|
| Dynamic showcase from most-viewed last 7d. | S | Pull from videos table with `view_count` ordering. |
| `/repo/[owner]/[repo]` page (see Phase 3 leftovers). | M | |
| `/search?q=...` full-text search across videos. | M | Postgres full-text search on `repo_name` + `repo_description` + `summary_data->>'tldr'`. |
| `/trending` — last-24h views weighted by recency. | S | Window function over `view_count` history (needs a view_count_log table for time-windowed counts — or accept "recent overall" as a proxy). |

---

## Phase 8 — New intake formats

| Item | Effort | Notes |
|---|---|---|
| Commit URLs (`/commit/sha`). | M | New analyzer mode. Reads diff via GitHub API. |
| File URLs (`/blob/branch/path`). | M | Just analyzes one file. Cheaper + faster. |
| Gist URLs. | S | Similar to file mode but reads from gist API. |
| Compare two repos (Pro+). | L | Side-by-side analysis pass. New Remotion scene composition. |

---

## Phase 9 — Social + viral

| Item | Effort | Notes |
|---|---|---|
| Emoji reactions. | M | New `reactions` table. |
| Share tracking. | S | Increment counter on share-button click. |
| Comments / discussion threads. | L | Tables, moderation, anti-spam, GDPR considerations. |
| "Generate yours" prominent CTA on others' videos. | XS | Just a button. |
| Twitter thread generator (Pro). | M | Claude Haiku from script. New `/api/v1/videos/{id}/twitter-thread`. |

---

## Phase 10 — Analytics + observability

| Item | Effort | Notes |
|---|---|---|
| Owner analytics on `/dashboard/videos/[id]/analytics`. | M | Pro feature. Needs view-tracking with timestamps + referrers. |
| PostHog event instrumentation. | S | Free tier. Snippet in root layout + events from `lib/analytics.ts`. |
| Sentry on backend + frontend. | S | Free tier. Add `@sentry/nextjs` + `sentry-sdk` to backend. |

---

## Phase 11 — Performance + cost

| Item | Effort | Notes |
|---|---|---|
| Analysis cache (7-day TTL on repo_url). | S | Skip Claude call when analysis exists. Big cost saver. |
| Tier-aware render quality. | S | Free → 720p, Pro → 1080p. Pass through to Remotion. |
| ElevenLabs character budget per user. | M | New `user.tts_characters_used_this_month` column. |
| Pro priority queue. | S | Celery queue with priority routing. |
| CDN for videos (Cloudflare R2). | M | DEPLOY.md has the plan. Swap `video_assembler.write_video` to upload to R2. |

---

## Phase 12 — Security + compliance

| Item | Effort | Notes |
|---|---|---|
| **Real rate limiting.** Redis-backed counters per IP + per user. | M | `slowapi` or hand-rolled. Critical before public launch. |
| **Input validation.** Only github.com / gitlab.com URLs. Block private IPs / localhost. Length limits. | S | Already partially done in `parse_github_url`. |
| **Content moderation.** Block obviously bad repos (hate speech in README). Claude Haiku classifier, ~200ms. | M | Cheap insurance. |
| **GDPR: delete + export.** `/dashboard/settings/danger-zone`. | M | Delete: cascading delete on `user_id`. Export: serialize all user-owned rows as JSON. |
| **Real ToS + Privacy Policy.** Termsfeed.com or similar generator. Link in footer. | S | Required before charging anyone. |
| **Alembic migrations.** Replace `init_db()` CREATE-IF-NOT-EXISTS with proper migrations so production schema changes don't lose data. | M | Auto-generate from current models. |

---

## Phase 13 — Onboarding + activation

| Item | Effort | Notes |
|---|---|---|
| Welcome flow after first signin. Pre-filled repo selector from user's public GitHub repos. | M | Use the OAuth token (already stored in JWT) to list repos. |
| Empty states with personality across dashboard / favorites / collections. | S | Pure copy + small illustrations. |
| Resend email integration. Welcome, first-video, near-limit, post-upgrade, win-back at 30 days. | M | Free tier covers 3K/month. Templates in `marketing/`. |

---

## Sequencing recommendation

Real-world priority if shipping to public users:

1. **Activation steps** (top of this doc) — unblocks everything.
2. **Phase 12 security basics** — rate limit + ToS + input validation. These must exist before `REQUIRE_AUTH=1` and public traffic.
3. **Pricing page wire-up** — connect the existing pricing tiers to actual Stripe Checkout (small, immediate revenue path).
4. **Phase 3 leftovers** — profile pages, repo pages, OG card with frames. Drives SEO + viral mechanics.
5. **Phase 6 dashboard** — gives signed-in users a real home.
6. **Phase 10 analytics + Sentry** — must-have before public traffic.
7. **Phase 11 cost controls** — analysis cache pays for itself immediately.
8. **Phase 4 smart features** — what makes RepoX defensibly worth $19/mo.
9. **Phase 5 GitHub Action + API keys** — distribution + Team-tier monetization.
10. **Phase 8 new intake formats** — broadens the surface.
11. **Phase 13 onboarding polish** — once you have actual users to onboard.
12. **Phase 7 public showcase + Phase 9 social** — needs network effects from existing users; don't build before there's traffic.

---

## What "done" looks like

When the user can run through this 20-step check from the prompt:

1. Open site in fresh incognito ✓
2. Sign in with GitHub
3. Complete welcome flow
4. Generate a video for is-online
5. Watch it
6. Share it
7. Check the written summary ✓ (Phase 3 shipped)
8. Check the quality signals panel
9. View profile at `/@username`
10. Generate two more videos
11. Try to generate a fourth — hit paywall ✓ (Phase 1 quota in place, needs UI surface)
12. Upgrade to Pro via Stripe test mode ✓ (Phase 2 ready, needs pricing page wire-up)
13. Verify Pro features unlock
14. Try PR URL + file URL
15. Try comparison mode
16. Create an API key
17. Use API programmatically
18. Owner analytics
19. Manage subscription via Customer Portal ✓ (Phase 2 ready, needs dashboard button)
20. Cancel + verify downgrade at period end ✓ (Phase 2 webhook handles this)

Marked ✓ where the backend / scaffold exists. The remaining work is
frontend wiring + new analyzer modes.
