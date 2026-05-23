# Phantom v8 — Bug Discovery Report (Phase 0)

Generated 2026-05-23 against the running docker-compose stack.

This is the ground-truth state of v7 after my last session. Several "shipped"
features were never actually exercised end-to-end and are silently broken.

## CRITICAL — blocks usage

### BUG-001: `next-auth` missing from frontend `node_modules`
- **Location**: `frontend/Dockerfile` + named volume `phantom_node_modules`.
- **Reproduce**: `docker exec phantom-frontend-1 ls node_modules/next-auth`.
- **Expected**: dir exists.
- **Actual**: `No such file or directory`. Every page that imports `next-auth`
  or `next-auth/react` (login, dashboard*) returned 500 with
  `Module not found: Can't resolve 'next-auth'`.
- **Root cause**: `/app/node_modules` is a docker named volume. The Dockerfile
  runs `npm install` at image-build time. When `next-auth` was added to
  `package.json` in a later session, the volume already had a stale tree, so
  `npm install` was skipped on container recreate.
- **Fix**: ran `npm install` inside the container manually. Long-term:
  Dockerfile should bake deps into the image *without* the named volume, or
  start with `npm ci` on every boot.
- **Status**: ✅ fixed during Phase 0 (deps installed in container).

### BUG-002: `<SessionProvider>` not in root layout
- **Location**: `frontend/src/app/layout.tsx`.
- **Reproduce**: `GET /login` after BUG-001 is fixed.
- **Expected**: login page renders.
- **Actual**: HTTP 500 — `[next-auth]: useSession must be wrapped in a
  <SessionProvider />`.
- **Root cause**: a `<SessionProvider>` was never added when next-auth was
  introduced. `getServerSession` works on server components, but the login
  page uses the client-side `useSession()` and crashes.
- **Status**: pending — Phase 1 fix.

### BUG-003: `videos` table schema is out of date with the SQLAlchemy model
- **Location**: postgres `public.videos`.
- **Reproduce**: `curl http://localhost:8000/api/v1/videos?limit=3` → 500.
- **Expected**: list of videos.
- **Actual**:
  ```
  sqlalchemy.exc.ProgrammingError: column videos.user_id does not exist
  ```
- **Missing columns**: `user_id`, `visibility`, `summary_data`,
  `quality_signals`, `intake_kind`, `intake_meta`.
- **Root cause**: `init_db()` runs `Base.metadata.create_all`, which only
  CREATES tables that don't exist. It doesn't ALTER existing tables when the
  model grows. Every v6/v7 column added to `Video` has been silently absent
  in the actual database.
- **Blast radius**: every list endpoint (`/api/v1/search`, `/trending`,
  `/videos`, dashboard history) and every owner-scoped endpoint
  (`/me/analytics`, ownership checks in social router). Almost the entire
  v7 surface is broken in any environment that didn't recreate the db
  volume.
- **Status**: pending — Phase 1 fix.

### BUG-004: `users` table missing `webhook_url` + `webhook_secret`
- **Location**: postgres `public.users`.
- **Reproduce**: `\d users` shows neither column; PATCH /api/v1/me with
  webhook_url errors.
- **Root cause**: same as BUG-003 — no migrations.
- **Status**: pending — Phase 1 fix.

### BUG-005: `/dashboard/favorites` directory exists but is empty (no `page.tsx`)
- **Location**: `frontend/src/app/dashboard/favorites/`.
- **Reproduce**: `GET /dashboard/favorites` → 404.
- **Root cause**: stub directory was created but the page was never written
  (the v7 session summary acknowledged it as pending).
- **Status**: pending — Phase 1 fix.

## HIGH

### BUG-006: Next.js dev server in Windows-bind-mount Docker doesn't pick up newly created route files
- **Location**: frontend container watcher (chokidar).
- **Reproduce**: create `src/app/foo/page.tsx`; visit `/foo`; observe 404
  while the file is clearly on disk.
- **Expected**: route registers automatically.
- **Actual**: `app-paths-manifest.json` never gets the new entry.
- **Workaround**: `docker restart phantom-frontend-1` after creating new
  routes. (Modifying existing files works fine.)
- **Status**: documented, no code fix (it's a Next/chokidar/Docker-Desktop
  interaction). Will note in CLAUDE.md.

### BUG-007: `/api/v1/favorites` proxy route missing on the frontend
- **Location**: `frontend/src/app/api/v1/favorites/`.
- **Reproduce**: directory doesn't exist; clicking the favorites tab in
  dashboard would 404 the data fetch.
- **Status**: pending — Phase 1 fix (paired with BUG-005).

## MEDIUM

### BUG-008: Named-volume node_modules makes new deps invisible after `package.json` updates
- **Location**: `frontend/docker-compose.yaml` (implied) + `Dockerfile`.
- **Reproduce**: add a dep to `package.json`, recreate container, deps still
  stale.
- **Status**: same workaround as BUG-001 (manual `npm install` in container).
- **Recommended longer-term fix**: drop the named volume in dev, accept the
  rebuild cost on dep changes. Defer to FOLLOWUP_v8.md.

### BUG-010: Curated showcase detail pages tried to play non-existent MP4s
- **Location**: `frontend/src/app/showcase/[slug]/page.tsx`.
- **Reproduce**: visit `/showcase/react` (or any of 8 curated slugs).
- **Expected**: video plays.
- **Actual**: `<video>` element shows "No supported source was found"
  because `/showcase/{slug}.mp4` 404s — those files were never produced.
- **Root cause**: the curated SHOWCASE_REPOS list promised content that
  doesn't exist on disk. Only `is-online-demo.mp4` is bundled.
- **Status**: ✅ fixed in commit `cbd7998` — detail page now looks up a
  real video via /api/v1/repo/{owner}/{name} and falls back to a
  "generate this" CTA when none exists.

### BUG-011 (CRITICAL): Celery worker not subscribed to v7 priority queues
- **Location**: `docker-compose.yml` worker command.
- **Reproduce**: queue any job → it stays at `queued` forever.
- **Expected**: worker picks it up within ~1s.
- **Actual**: jobs accumulate in `video.free` Redis list while the
  worker listens on the default `celery` queue.
- **Root cause**: v7 commit `ca64619` (cost-controls) routed jobs to
  `video.priority` / `video.free` queues via celery `task_routes`, but
  never updated the worker's command — it still ran with no `-Q`
  flag, so it only consumed the default `celery` queue. Result: every
  generation queued after that commit silently never started.
- **Status**: ✅ fixed in this commit. Worker now starts with
  `-Q video.priority,video.free`. Verified by queueing 6 jobs and
  watching them all transition out of `queued` within seconds of the
  worker restart.

## Not yet verified (Phase 0 incomplete because of CRITICAL bug cascade)

These checks fail today because of BUG-001/002/003 above. Will revisit
after the cascade clears in Phase 1:

- New intake URL formats (commit/file/gist/PR) end-to-end.
- Quality signals real values (not placeholders).
- Silent service degradation when Sentry/PostHog/Resend/R2/Stripe env vars
  are missing.
- All new backend endpoints (analytics, onboarding, share_tools).
- Per-page rendering of dashboard subroutes.
