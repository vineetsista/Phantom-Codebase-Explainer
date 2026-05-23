# v7 follow-ups

Everything deferred from the v7 brief, organized so the next session
can pick up cleanly. Items map back to the phase numbers in the
original brief.

## Phase 4 leftovers

### PR Explainer mode (4.1)
- Detect `github.com/{owner}/{repo}/pull/{number}` URL pattern in
  `utils/url_validator.py` (currently the validator rejects nothing
  beyond `/owner/repo` — extending it is straightforward).
- New `services/pr_analyzer.py` that fetches PR data via GitHub API
  (title, body, diff, files changed, commits) and produces an analysis
  shaped like `AnalysisResult` but with `pr_context` field replacing
  `monorepo` / `key_files`.
- Script generator gets a new system prompt branch for PR mode — the
  arc shifts from "explain the codebase" to "explain the diff."
- Counts as one quota unit. ~60-90s video target.

### Quality signals: bus factor, dep freshness, activity, security (4.3 leftovers)
- **Bus factor**: walk `git log --format="%aE" --since="6 months ago"`,
  count distinct authors making >10% of commits.
- **Dep freshness**: for npm parse `package.json` + call npm registry
  for latest versions of each dep, compare. For pip parse
  `requirements.txt` + pypi.
- **Activity level**: `git log --format="%aI" --since="6 months ago" |
  wc -l` divided by 6 = commits/month.
- **Security signals**: regex scan for hardcoded secrets (AWS keys,
  GitHub PATs, generic high-entropy strings). For npm: `npm audit
  --json` parse.

All of these use the already-cloned repo — no extra API cost.
Implementation goes in `_extract_quality_signals()` next to the
existing signal computations.

## Phase 5 leftovers

### GitHub Action (5.2)
- Build under `actions/phantom-action/`. action.yml is a composite
  action; reads PHANTOM_API_KEY from secrets, POSTs to /api/v1/generate,
  polls /api/v1/status/{id} until complete, comments on the release.
- Publish to GitHub Marketplace (separate flow — needs verified
  publisher status on GitHub).

### Webhook config UI (5.3 leftover)
Backend already supports `User.webhook_url` + `webhook_secret`. The
`/dashboard/settings` page (Phase 6.3 deferred) is where this lands.
- Edit form for URL.
- "Generate secret" button.
- "Send test event" button that fires a `webhook.test` event.

## Phase 6 leftovers

### Settings page (6.3)
- `/dashboard/settings` with sections:
  - Profile: name, bio, custom_slug, avatar (read from GitHub).
  - Preferences: default voice, default visibility, custom watermark
    text (Pro).
  - Notifications: email_on_complete, email_on_milestone.
  - Connected accounts: show GitHub, allow disconnect.
  - API keys: link to /dashboard/api-keys.
  - Webhooks (Pro+): URL + secret.
  - Billing: link to Stripe Customer Portal.
  - Danger zone: download my data (Phase 12.4), delete account.
- Backend: PATCH /api/v1/me endpoint that accepts a partial profile +
  preferences body.

### Favorites + collections (6.4)
- `favorites` table (id, user_id, video_id, created_at).
- Heart button on video page; tracks user→video bookmark.
- `/dashboard/favorites` shows all favorited videos.
- Pro: `collections` (id, user_id, name, slug, public) + `collection_videos`
  (collection_id, video_id, order).
- Public collection at `/c/{username}/{slug}`.

## Phase 7 — Public showcase upgrades

### Dynamic showcase (7.1)
Currently `/showcase` is static 8 repos. Make it pull most-viewed
public videos from last 7d. Filter chips, language filter, search bar.

### Search (7.2)
`/search?q=...` using Postgres full-text search on
`videos.repo_name + repo_description + summary_data->>'tldr'`. Add a
GIN index on the concatenated tsvector.

### Trending feed (7.3)
`/trending` algorithm: views_last_24h × 3 + views_last_7d × 1, weighted
by recency. Requires a per-day view counter table (or rolling Redis
counter).

## Phase 8 — Intake formats

### Commit URLs (8.1)
- Detect `github.com/{owner}/{repo}/commit/{sha}` in url_validator.
- New analyzer mode `analyze_commit(owner, repo, sha)` that fetches
  the commit + diff via GitHub API.
- Script generator: ~60s commit-focused script.

### File URLs (8.2)
- Detect `github.com/{owner}/{repo}/blob/{branch}/{path}`.
- Skip clone + full analysis; just fetch the one file's content.
- ~60s walkthrough of that single file.

### Gist URLs (8.3)
- Detect `gist.github.com/{owner}/{gist_id}`.
- Fetch via GitHub Gist API.
- ~45s explainer.

### Compare two repos (8.4) — Pro only
- New `/generate/compare` route accepting two URLs.
- Analyze both, produce side-by-side comparison script.
- New Remotion composition mode for split-screen layout.
- ~120s video.

## Phase 9 — Social + viral

### Reactions (9.1)
- `reactions` table (id, user_id, video_id, emoji, created_at).
- Emoji picker on video page, limited set (✨ 🔥 🎯 💡 👀).
- Aggregate counts shown per emoji; top emoji surfaces on OG card.

### Comments (9.2)
- `comments` table (id, video_id, user_id, parent_id, body,
  created_at, edited_at).
- Threaded one level deep. Basic markdown (bold, italic, code, links).
- Author edits/deletes own comments; video owner deletes any on
  their video.

### Share tracking (9.3)
- Track share-button clicks: `shares` table (id, video_id, channel,
  ip_hash, created_at). Channels: twitter, linkedin, discord, slack,
  copy.
- Surfaced in owner analytics.

### Twitter thread generator (9.4) — Pro
- `/api/v1/videos/{id}/twitter-thread` returns a 5-tweet thread via
  Haiku from `script_data` + `summary_data`.
- "Copy thread" button in video player.

## Phase 10 — Observability

### Owner analytics (10.1)
- `/dashboard/videos/{id}/analytics` (Pro+ only).
- Total views, last-7d, last-30d.
- Watch-time distribution (sent by player via beacon at 25/50/75/100%).
- Drop-off chart (frame at which viewers leave).
- Referrer breakdown (track via URL `?ref=` + Referer header).
- Embed performance (track via Origin header on embedded plays).
- Geographic distribution (Cloudflare CF-IPCountry header).

### PostHog (10.2)
- `npm install posthog-js`. Snippet in `app/layout.tsx`.
- `NEXT_PUBLIC_POSTHOG_KEY` env var.
- Instrument events from `lib/analytics.ts`:
  - signup_completed
  - first_video_generated
  - free_tier_limit_hit
  - upgrade_to_pro_started / completed
  - subscription_cancelled
  - video_shared
  - embed_code_copied
  - api_key_created

### Sentry (10.3)
- Frontend: `@sentry/nextjs` + DSN.
- Backend: `sentry-sdk[fastapi]` + DSN.
- Auto-capture unhandled exceptions; add user context where session
  available.

## Phase 11 — Performance + cost

### Analysis cache (11.1)
- Cache `AnalysisResult.to_dict()` in Redis keyed by
  `analysis:{owner}/{repo}:{commit_sha}`, TTL 7 days.
- On generation: try cache hit first. Saves the Claude analyzer call
  (largest cost line).

### Tier-based quality (11.2)
- Pass `quality` from request → through to Remotion render command.
- Free: 720p/24fps. Pro: 1080p/30fps. Team: 1080p/30fps + multi-aspect
  export.

### ElevenLabs char budget (11.3)
- New `User.tts_chars_this_month` + reset alongside video count.
- Estimate chars before TTS call (sum of all section narrations × 1.1
  for SSML overhead). Block if would exceed.
- Free 10k/mo. Pro 100k. Team 500k.

### Queue priority (11.4)
- Two Celery queues: `phantom-default` (free) + `phantom-priority`
  (pro). Pro generations route to priority. Workers pull from
  priority first.
- Show queue position to free users.

### Cloudflare R2 CDN (11.5)
- `boto3` client targeting R2. Backend uploads finished MP4 to
  R2 bucket after assemble.
- DB stores `video_url` as full R2 CDN URL.
- Delete local file after successful upload.

## Phase 12 — Security leftovers

### Content moderation (12.3)
- Before generation, fetch README. Haiku classifier:
  > "Does this README contain hate speech, slurs, calls to violence,
  > or sexually explicit content? Respond yes/no + one-sentence reason."
- If yes, refuse generation. Log flagged repos for review.
- ~$0.0001/call.

### GDPR (12.4)
- `/dashboard/settings/danger-zone` with:
  - "Download my data" — exports user row + videos + comments +
    favorites + collections as a single JSON blob.
  - "Delete account" — cascading delete with email confirmation.

### Real ToS + Privacy Policy (12.5)
- Generate base templates from termsfeed.com or similar.
- Customize for Phantom's specifics: video generation, GitHub OAuth,
  Stripe billing, third-party AI providers (Anthropic, ElevenLabs,
  OpenAI).
- `/legal/terms` and `/legal/privacy` server-rendered pages.
- Link in footer.
- Signup form checkbox requiring acceptance.

## Phase 13 — Onboarding

### Welcome flow (13.1)
- After first GitHub signin, redirect to `/onboarding`.
- Step 1: Welcome + 30-second pitch.
- Step 2: Pick a repo. Use GitHub OAuth token to fetch user's public
  repos (`GET /user/repos?visibility=public`). Show top 8 by stars.
- Step 3: One-click generate.
- Step 4: While generating, show "Here's what's happening" educational
  copy about the pipeline.
- Step 5: Celebration screen on completion with share buttons.

### Empty states with personality (13.2)
Replace generic "no data" copy across:
- Dashboard with 0 videos: "Pick a repo, any repo. Even better — pick
  your own. ↓" (already shipped this in dashboard home).
- Favorites: "Hearts mean something. Find one worth keeping."
- Collections: "Curate your taste in code."
- History: "This is where your generated videos live."
- Search empty: "Nothing yet. Be the first to generate this."
- Comments: "Be the first to react."

### Lifecycle emails (13.3)
- Resend SDK + templates under `emails/templates/`.
- Welcome (signup): "Generate your first video"
- First-complete: "Your first video is ready"
- 80% quota: "You've used X of Y this month"
- Quota hit: "Upgrade to keep generating"
- Post-upgrade: "Welcome to Pro"
- 30-day inactive: "Haven't seen you in a while"

Free tier: 3K/mo emails.
