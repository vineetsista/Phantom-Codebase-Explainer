<div align="center">

# Phantom

**The AI that understands codebases.**

Drop any GitHub URL. Get a cinematic AI-generated video walkthrough — architecture, key files, design decisions — narrated by AI.

[Live demo](https://phantom.video) · [Showcase](https://phantom.video/showcase) · [Launch checklist](LAUNCH_CHECKLIST.md) · [Deploy guide](DEPLOY.md)

![Next.js](https://img.shields.io/badge/Next.js-14-000?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![Celery](https://img.shields.io/badge/Celery-5.4-37814A?style=flat-square&logo=celery)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.5-D97757?style=flat-square&logo=anthropic)
![Remotion](https://img.shields.io/badge/Remotion-4.0-EE3A56?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/license-Apache_2.0-blue?style=flat-square)

</div>

---

## What this is

I lose a week every time I onboard onto a new codebase. The README is too high-level, the code is too low-level — there's nothing in the middle that explains the **shape** of the system.

Phantom is the middle. Paste a GitHub URL, get back a 2-5 minute narrated video that walks through:

- **Architecture** — auto-generated module diagrams from the actual file tree
- **Key files** — what they do, why they exist, where they fit
- **Design decisions** — patterns, conventions, the "why" the code doesn't tell you

The flagship product is **RepoX**. More products coming.

---

## How it works

```
┌──────────────────┐   POST /generate    ┌──────────────────┐
│  Next.js (web)   │ ──────────────────▶ │  FastAPI (API)   │
│  Landing + UX    │ ◀────── polling ──── │  Job + status    │
└──────────────────┘                      └────────┬─────────┘
        ▲                                          │ Celery task
        │ /media/videos/...                        ▼
        │                                ┌──────────────────┐
        │                                │  Celery worker   │
        │                                │  Analyzer → Claude
        │                                │   → TTS → Remotion
        │                                │   → ffmpeg fallback│
        │                                └────────┬─────────┘
        │                                          │
        └────────  static MP4 + thumb  ◀───── /app/output ───┘
```

**The six pipeline stages:**

1. **Clone & analyze** — shallow-clone the repo, walk the file tree, extract language stats, entry points, config files, module roles
2. **Script** — send the analysis to Claude (Sonnet 4.5) with a strict JSON schema; get back a narration script broken into typed scenes
3. **Diagram** — render an SVG architecture diagram from the extracted modules
4. **Voice** — synthesize per-section voiceover with OpenAI TTS (or ElevenLabs)
5. **Render** — Remotion composes the scenes from React components; ffmpeg mixes audio + video
6. **Finalize** — write the MP4, extract a thumbnail, mark the job complete

The frontend polls `/api/v1/status/{id}` every 1.5s and renders a **live terminal feed** of what the worker is doing — turns out watching a Celery task in real time feels surprisingly magical.

---

## Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion, React Three Fiber |
| **Backend** | FastAPI, SQLAlchemy 2, Pydantic, Celery, Postgres, Redis |
| **AI** | Anthropic Claude Sonnet 4.5 (narration), OpenAI TTS-1-HD (voice), ElevenLabs (premium voice) |
| **Video** | Remotion 4, ffmpeg fallback |
| **Infra** | Docker Compose locally · Vercel + Railway + Upstash + Supabase + Cloudflare R2 in prod |

---

## Local development

```bash
# 1. Set up
cp .env.example .env           # add any API keys you have
bash scripts/setup.sh          # builds containers + installs Remotion deps

# 2. Open
open http://localhost:3000
```

That's it. Paste a GitHub URL on the homepage and the pipeline runs.

### Manual run (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Worker (separate shell)
cd backend
celery -A workers.celery_app worker --loglevel=info --concurrency=2

# Frontend (separate shell)
cd frontend
npm install
npm run dev
```

You'll need Postgres + Redis running locally — easiest is to keep using the `db` / `redis` services from `docker-compose.yml`.

---

## Graceful degradation

The pipeline runs end-to-end **without paid API keys**. Drop into one of these states and the rest still works:

| Component | With key | Without key |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude writes the script | Deterministic mock script derived from the analysis |
| `OPENAI_API_KEY` | OpenAI TTS narration | Silent WAV stubs of the right duration |
| `ELEVENLABS_API_KEY` | ElevenLabs premium voice | Falls back to OpenAI, then silent |
| `GITHUB_TOKEN` | 5,000 req/hr | 60 req/hr public limit |
| Remotion installed | Animated React video scenes | ffmpeg slideshow of the SVG diagram + audio |

This isn't over-engineering — it means the system is demoable on a fresh `git clone` with zero setup. Which means contributors can run it. Which means bugs get reported. Which is the only thing that matters.

---

## API

```http
POST   /api/v1/generate          { repo_url, options? } → { job_id, status }
GET    /api/v1/status/{job_id}                            → { status, progress, details, video_url? }
GET    /api/v1/videos                                     → { videos: [...] }
GET    /api/v1/videos/{id}                                → { video: {...} }
DELETE /api/v1/videos/{id}                                → { success: true }
GET    /media/videos/{filename}.mp4                       → static MP4
GET    /media/thumbnails/{filename}.png                   → static thumbnail
```

---

## Roadmap

**Shipped**
- Full pipeline with Intro · Architecture · Code Walkthrough · Outro scenes
- Polished landing with R3F hero, custom video player with chapter markers
- Pre-rendered showcase gallery for React, Vue, FastAPI, Next.js, Tailwind, LangChain, Supabase, Bun
- Dynamic OG image generation for every video
- Graceful degradation across the entire pipeline

**Next**
- Private repo support (PAT handling, encryption at rest)
- Real dependency-graph extraction from import statements
- Data Flow + File Tree scenes
- Studio-tier template editor (custom intros, branding, white-label embeds)
- API access for DevRel teams + sponsored slots in the showcase

---

## Repo layout

```
phantom/
├── backend/                # FastAPI + Celery worker
│   ├── main.py
│   ├── routers/            # generate, status, videos
│   ├── services/           # analyzer, script_generator, voice_generator,
│   │                       # diagram_generator, video_assembler
│   ├── workers/            # Celery app + tasks
│   ├── models/             # SQLAlchemy
│   └── utils/              # GitHub client
├── frontend/               # Next.js 14 + Tailwind + Framer Motion + R3F
│   ├── src/app/            # App Router pages
│   ├── src/components/     # landing, generate, video, ui, shared, layout
│   ├── src/lib/            # api client, analytics, showcase data
│   └── remotion/           # Remotion compositions (separate package)
├── marketing/              # Launch content — tweet thread, Show HN, Reddit, dev.to
├── scripts/setup.sh        # One-shot local setup
├── docker-compose.yml      # Frontend + backend + worker + db + redis
├── LAUNCH_CHECKLIST.md     # Pre-launch QA + launch day sequencing
├── DEPLOY.md               # From git clone to production in 90 minutes
└── README.md
```

---

## Credits

Built by **Vineet Sista** in Columbus, Ohio.

Phantom uses [Claude](https://anthropic.com), [OpenAI](https://openai.com), [Remotion](https://remotion.dev), [Next.js](https://nextjs.org), [FastAPI](https://fastapi.tiangolo.com), and a lot of [ffmpeg](https://ffmpeg.org).

License: Apache 2.0
