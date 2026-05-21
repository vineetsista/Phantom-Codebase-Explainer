# Building Phantom: How I made an AI that turns any GitHub repo into a video explainer

> A 1,500-word technical writeup for dev.to and Hashnode. Post date: same week as Show HN. Goes deeper than the HN post — this is the long-form version for the audience that wants the full architecture.

---

I lose a week every time I onboard onto a new codebase. The README is too high-level. The code is too low-level. There's nothing in the middle that explains the *shape* of the system — the architecture, the entry points, how data moves between modules.

So I built **Phantom**. You paste a GitHub URL, and it produces a 2-5 minute narrated video that walks through the architecture, key files, and design decisions. Here's how.

## The pipeline

The whole thing is one async job orchestrated by Celery. Six stages, fully observable from the frontend via polling:

1. **Clone & analyze** — shallow-clone the repo, walk the file tree, extract language stats, entry points, config files, and module roles.
2. **Script** — send the analysis to Claude (Sonnet 4.5) with a strict JSON schema. Get back a narration script broken into typed scenes.
3. **Diagram** — render an SVG architecture diagram from the extracted modules.
4. **Voice** — synthesize per-section voiceover audio with OpenAI TTS (or ElevenLabs).
5. **Render** — Remotion composes the scenes from React components. ffmpeg mixes audio + video.
6. **Finalize** — write the MP4 to disk, extract a thumbnail, mark the job complete.

The frontend polls `/api/v1/status/{job_id}` every 1.5 seconds and renders a live terminal feed of what the worker is doing. Watching a Celery task in real time turns out to feel surprisingly magical.

## The hard parts

### The architecture diagram layout

The first version used a force-directed layout (D3-flavored). It looked great in maybe 60% of cases — for the other 40%, the boxes overlapped, the connections crossed, and the whole thing felt cheap. There's no UX recovery from a bad architecture diagram in a 3-minute video.

I tried four other layout algorithms before giving up and writing a deterministic grid layout with bezier connectors. The worst case is now "fine" instead of "embarrassing." For a product where the first impression is the *only* impression, that trade is worth it.

```python
# Final layout — deterministic grid with auto-fit columns
cols = min(4, max(2, len(modules)))
rows = max(1, (len(modules) + cols - 1) // cols)
# ... then bezier arcs between adjacent centers
```

### Getting Claude to return reliable JSON

I send the analyzer's full output (file tree, top files, config excerpts) into a single Claude call with a strict JSON schema in the system prompt. Even with the schema, ~3% of responses had escape character issues, mostly inside long narration strings.

The fix wasn't smarter prompting — it was a normalization layer that fills missing required sections with deterministic defaults derived from the analysis. Now even a malformed Claude response produces a valid script, just a worse one.

```python
def _normalize(script, analysis):
    sections = script.get("sections") or []
    seen = {s.get("id") for s in sections}
    for required in REQUIRED_SECTIONS:
        if required not in seen:
            sections.append(_default_section(required, analysis))
    # ... fill in defaults for hook, title, takeaways
    return script
```

This is the pattern I'd recommend for any production LLM pipeline: don't bet on the model returning what you asked for, build a safety net under it.

### Graceful degradation

The whole pipeline runs without paid API keys. If `ANTHROPIC_API_KEY` is missing, the script generator falls back to a deterministic script built from the analysis. If `OPENAI_API_KEY` is missing, the voice generator writes silent WAVs of the correct duration. If Remotion isn't installed, the video assembler falls back to an ffmpeg slideshow of the SVG diagram + audio.

This sounds like over-engineering. It's not. It makes the whole thing demoable on a fresh `git clone` with zero setup, which makes contribution and debugging dramatically easier.

### Remotion vs. raw ffmpeg

Remotion is React for video. You write a component, it renders frames, ffmpeg concatenates them into an MP4. The benefit: every scene is JSX you can develop with hot-reload in `remotion preview`. The drawback: it needs a Node toolchain in your worker container.

I went with Remotion as the primary path and kept ffmpeg as the fallback. The trade-off is that production video quality requires installing the toolchain, but the system never *requires* it to function.

```typescript
// Each scene is a React component that reads the script as props
export const ArchitectureScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // ... spring-based reveal animations per box, bezier arcs that draw themselves
};
```

## The stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion, React Three Fiber for the 3D hero element
- **Backend**: FastAPI, SQLAlchemy 2.0, Celery, Postgres, Redis
- **Video**: Remotion 4 (React-based programmatic video), ffmpeg fallback
- **AI**: Anthropic Claude (Sonnet 4.5) for narration, OpenAI TTS-1-HD for voice
- **Storage**: Cloudflare R2 for generated videos (no egress fees), Postgres for job state
- **Hosting**: Vercel (frontend), Railway (backend + worker), Upstash (Redis), Supabase (Postgres)

Total cost per generated video, all-in: about $0.18. The free tier (2 videos/month, watermarked) is sustainable.

## What I shipped vs. what I cut

I'd been sitting on this idea for about 18 months before I finally built it. The hardest decision wasn't the tech — it was deciding what to *not* build.

**Shipped:**
- Full pipeline, four scene types (Intro, Architecture, Code Walkthrough, Outro)
- Polished landing page with R3F hero, custom video player with chapter markers
- Pre-rendered showcase gallery for React, Vue, FastAPI, Next.js, Tailwind, LangChain, Supabase, Bun

**Cut from v1:**
- Real dependency-graph extraction from imports (currently structural from the file tree)
- A 3D animated data-flow scene (the static version is fine for now)
- Private repo support (next week)
- Auth, Stripe, dashboards — running it manually for the first N users to learn what breaks

The cuts hurt. But the alternative was launching three months later with no signal on whether anyone actually wanted it.

## What surprised me

Three things I didn't expect:

1. **People use it for technical interviews.** Hiring managers send candidates a Phantom video of a sample codebase. Candidates show up already understanding the stack. I thought the audience was developers onboarding to new jobs — turns out the equally large audience is companies onboarding *into* new candidates.

2. **The terminal feed on the generation page is the favorite feature.** It's the simplest thing in the entire app — a polling loop that appends new lines as the Celery task progresses. People love watching it. The pipeline already exists; making its progress visible is what makes it feel alive.

3. **Cost is dominated by TTS, not the LLM.** I expected the Claude calls to be the budget killer. They're ~10% of the per-video cost. TTS-1-HD is the rest. ElevenLabs would 5× that — which is why it's gated behind the Pro tier.

## What's next

- Private repo support with PAT encryption at rest
- Real dependency-graph extraction from import statements (the hard part: doing it for 12+ languages)
- A template editor for Studio-tier customers who want their own brand on the videos
- An API so DevRel teams can auto-generate explainers when someone integrates with their SDK

## Try it

Live at [phantom.video](https://phantom.video). First video is free, no signup. If you find a repo it gets wrong, message me — that's how it gets better.

Source code: [github.com/vineetsista/Phantom](https://github.com/vineetsista/Phantom) (Apache 2.0).

---

*If you build something with this stack — Celery + Claude + Remotion is a surprisingly underused combination — I'd love to see what you make. Find me on Twitter [@usephantom](https://twitter.com/usephantom).*
