# DEPLOY.md

> Get Phantom from `git clone` to a live production URL in under 90 minutes. Costs ~$0/month at the start, scaling roughly linearly with usage.

---

## Architecture in one paragraph

Vercel hosts the Next.js frontend on the edge. Railway runs the FastAPI backend and a Celery worker as two separate services. Supabase provides managed Postgres. Upstash provides serverless Redis. Cloudflare R2 stores generated MP4s. Anthropic + OpenAI provide the LLM + TTS APIs.

Total monthly cost at 1,000 videos/month: ~$45 (most of it OpenAI TTS). Free tier of every other service covers it.

---

## Domain

1. Register a domain — recommended candidates in priority order:
   - `phantom.video` (premium TLD, ~$50/year)
   - `usephantom.com` (~$12/year)
   - `phantomcode.io` (~$30/year)
   - `repophantom.com` (~$12/year)
2. Point DNS to Vercel:
   - `A` record: `@` → `76.76.21.21`
   - `CNAME` record: `www` → `cname.vercel-dns.com`
3. Vercel issues an SSL cert automatically within ~30 seconds of DNS propagating.

---

## Step 1 — Cloudflare R2 (video storage)

R2 has no egress fees, which matters because each generated video gets downloaded multiple times.

```bash
# Sign up for Cloudflare (free), enable R2 from the dashboard
# Create bucket: phantom-videos
# Create an R2 API token with read+write
```

Save these env vars for later:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=phantom-videos
R2_PUBLIC_URL=https://pub-XXXX.r2.dev   # or your custom subdomain
```

Optional but recommended: connect `cdn.phantom.video` to the R2 bucket for cleaner URLs.

> **Note for the vertical slice as built today:** the backend writes videos to the local filesystem under `/app/output/videos`. Swapping to R2 is a small change in `backend/services/video_assembler.py` — replace the local write with `boto3.client("s3").upload_file(...)` pointed at the R2 endpoint and store the returned URL in `videos.video_url`.

---

## Step 2 — Supabase Postgres

1. Create a project at supabase.com (free tier: 500MB DB, plenty for the first 10k users).
2. Get the connection string:
   - Project Settings → Database → Connection string → URI (pooler mode)
3. Save as `DATABASE_URL`.

The pipeline runs `init_db()` on startup which creates the tables. No migrations needed for v1.

---

## Step 3 — Upstash Redis

1. Create a Redis database at upstash.com (free tier: 10k commands/day, fine for early traffic).
2. Copy the TLS connection string.
3. Save as both `REDIS_URL` and `CELERY_BROKER_URL` + `CELERY_RESULT_BACKEND`.

---

## Step 4 — Railway (backend + worker)

Railway is the simplest place to run the Python + Node + ffmpeg stack as a stateful pair of services.

1. New project → Deploy from GitHub → select the repo.
2. Add **two services**:

### Service A: API
- Root directory: `/backend`
- Build command: (auto-detected from `Dockerfile`)
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Healthcheck path: `/healthz`

### Service B: Worker
- Root directory: `/backend`
- Same Dockerfile
- Start command: `celery -A workers.celery_app worker --loglevel=info --concurrency=2`
- No healthcheck (workers aren't HTTP-facing)

### Env vars (set on both services)

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=               # optional
GITHUB_TOKEN=ghp_...              # optional but recommended (5000 req/hr vs 60)
DATABASE_URL=postgresql://...     # from Supabase
REDIS_URL=rediss://...            # from Upstash (note: rediss:// for TLS)
CELERY_BROKER_URL=rediss://...
CELERY_RESULT_BACKEND=rediss://...
APP_URL=https://phantom.video
API_URL=https://api.phantom.video
SECRET_KEY=                       # generate with `openssl rand -hex 32`
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=phantom-videos
R2_PUBLIC_URL=https://cdn.phantom.video
VIDEO_OUTPUT_DIR=/tmp/videos
THUMBNAIL_OUTPUT_DIR=/tmp/thumbnails
TEMP_DIR=/tmp/phantom
REPOS_DIR=/tmp/repos
MAX_REPO_SIZE_MB=100
DEFAULT_VOICE=openai
DEFAULT_QUALITY=720p
```

### Custom domain

- Add `api.phantom.video` as a custom domain on the API service.
- DNS: `CNAME api → <railway-generated-domain>`

---

## Step 5 — Vercel (frontend)

1. Import the repo on vercel.com → choose `/frontend` as the root directory.
2. Framework preset: Next.js (auto-detected).
3. Env vars:
   ```
   NEXT_PUBLIC_API_URL=https://api.phantom.video
   NEXT_PUBLIC_APP_URL=https://phantom.video
   NEXT_PUBLIC_POSTHOG_KEY=phc_...   # optional
   ```
4. Add `phantom.video` as a custom domain. DNS is already pointed (Step 0).

The `next.config.js` `rewrites` rule proxies `/media/*` to `NEXT_PUBLIC_API_URL/media/*`, so videos and thumbnails appear same-origin to the browser.

---

## Step 6 — Sentry (errors)

1. Sign up at sentry.io (free tier: 5k events/month).
2. Add the Next.js integration to the frontend (`npx @sentry/wizard@latest -i nextjs`).
3. Add the Python integration to the backend:
   ```python
   # backend/main.py
   import sentry_sdk
   sentry_sdk.init(dsn=os.environ["SENTRY_DSN"], traces_sample_rate=0.1)
   ```
4. Add `SENTRY_DSN` to Railway env.

---

## Step 7 — PostHog (analytics)

1. Sign up at posthog.com (free tier: 1M events/month).
2. Add the snippet to `frontend/src/app/layout.tsx`:
   ```tsx
   <Script
     id="posthog"
     dangerouslySetInnerHTML={{ __html: `!function(t,e){...}` }}  // standard PostHog snippet
   />
   ```
3. The `lib/analytics.ts` helper auto-detects `window.posthog` — no further wiring needed.

---

## Step 8 — Status + uptime

- **Uptime monitoring:** UptimeRobot (free) pinging `https://api.phantom.video/healthz` every 5 minutes.
- **Status page:** Linked from the footer. Use `status.phantom.video` via Statuspage.io free tier, or a simple Next.js page you update manually.

---

## Step 9 — First deploy

```bash
git push origin main
```

- Vercel builds and deploys the frontend automatically (~90 seconds)
- Railway builds the API + worker (~3 minutes for the first build, ~30 seconds after)
- Hit `https://phantom.video/healthz` to confirm the API is responding
- Hit `https://phantom.video` and generate one video end-to-end as a smoke test

---

## Monitoring + alerting recommendations

| Metric | Tool | Alert threshold |
|---|---|---|
| API 5xx rate | Sentry | > 1% over 5 min |
| Worker job failures | Sentry | > 5% over 15 min |
| Postgres connection count | Supabase dashboard | > 80% of pool |
| Redis memory usage | Upstash dashboard | > 80% |
| R2 spend | Cloudflare dashboard | > $10/month |
| OpenAI cost | OpenAI dashboard | > $50/month (set hard cap) |
| Uptime | UptimeRobot | < 99.5% |

---

## When you hit scale

The first bottleneck will be Celery concurrency — single repo analysis is CPU-bound by the file walk + diff parse. Scale horizontally by adding more Railway worker instances; the broker handles distribution.

Second bottleneck: Postgres connection pool. Add PgBouncer (Supabase has it built in — switch your connection string to the pooler endpoint).

Third bottleneck: TTS cost. At 100k videos/month, you're spending $1,500-2,000/month on OpenAI TTS. That's when you negotiate volume pricing or move to a self-hosted TTS model.

---

## Cost ceiling at 1,000 videos/month

| Service | Cost |
|---|---|
| Vercel (frontend) | $0 (Hobby) |
| Railway (API + worker) | ~$10 (~512MB RAM each, low CPU) |
| Supabase (Postgres) | $0 (free tier) |
| Upstash (Redis) | $0 (free tier) |
| Cloudflare R2 (storage + CDN) | ~$2 |
| Anthropic Claude | ~$8 (Sonnet, ~5k tokens per video) |
| OpenAI TTS | ~$20 (~2k chars per video × 1k videos × $15/1M chars) |
| Domain | ~$4/month amortized |
| **Total** | **~$44/month** |

At 10,000 videos/month: ~$280/month. At 100k: ~$2,600/month. Pro tier at $19/month from 5% of users would cover it 10× over.
