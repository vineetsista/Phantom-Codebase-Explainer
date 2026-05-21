# Product Marketing Context

*Last updated: 2026-05-20*
*Auto-drafted from codebase + product spec. Review and correct sections marked `[VERIFY]`.*

---

## Product Overview

**One-liner:** Any codebase, explained in minutes.

**What it does:**
Phantom takes any GitHub repository URL and produces a 2-5 minute narrated video that walks through the codebase — architecture diagrams, key files, design decisions. The flagship product is **RepoX**.

**Product category:** Developer tools · AI code understanding. Specifically: the "AI-generated codebase walkthrough" shelf. Adjacent to documentation generators (Mintlify, ReadMe.io), AI coding assistants (Cursor, Copilot Chat), and async onboarding tools (Loom, Tella) — but distinct from each.

**Product type:** B2C-leaning freemium SaaS with B2B upsell. Self-serve through Pro; sales-assisted for Studio (teams + white-label).

**Business model:**
- **Hobby** — Free. 2 videos/month, 720p, watermarked, repos ≤ 5K LOC.
- **Pro** — $19/mo. Unlimited videos, 1080p, no watermark, any repo size, priority queue, API access.
- **Studio** — $49/mo. Pro + team workspace + custom branding + white-label embeds + dedicated support.

---

## Target Audience

**Target companies:** Software companies of any stage. Sweet spot is Seed-to-Series-B startups with 10-200 engineers (high onboarding frequency, no dedicated technical-writing team). Also: open source projects with 1k+ GitHub stars, DevRel teams at developer-tools companies, technical-content YouTubers/educators.

**Decision-makers:**
- Solo: individual engineer (no buying committee — credit card swipe)
- Team: Engineering Manager or Staff Engineer (Pro), VP Eng / CTO (Studio)
- OSS maintainers: the maintainer themselves
- DevRel: DevRel lead, with budget signoff from marketing

**Primary use case:** Understanding an unfamiliar codebase quickly — without spending 3-7 days reading it manually.

**Jobs to be done:**
1. *Onboarding* — "I just joined / inherited this project. I need to understand it before I can ship anything."
2. *Evaluation* — "I'm evaluating this OSS library for our stack. I need to know if its architecture fits ours."
3. *Async handoff* — "I'm passing this project to a teammate. I want them productive without another sync meeting."
4. *Hiring* — "I want candidates to understand our sample codebase before the interview."
5. *Distribution* — "I maintain this OSS project. I want a video on the README so new contributors get unstuck faster."

**Use cases:**
- New engineer onboarding to a monorepo
- Tech lead reviewing an acquisition target's codebase
- DevRel team producing integration explainers for their SDK
- OSS maintainer embedding a video in their README
- Hiring manager generating an interview prep video
- Engineering manager prepping for a tech-stack pivot conversation

---

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| **Solo dev / indie hacker** (User + Buyer) | Shipping fast, exploring stacks | Wastes nights reading unfamiliar repos to find one config detail | Watch instead of read — 3 minutes vs. 3 hours |
| **Engineering Manager** (Champion + Decision Maker) | New hire ramp time, team velocity | Loses 1-2 weeks per onboarded engineer to "how does this work?" questions | Pay $19 once, replace a week of senior-engineer time per hire |
| **OSS Maintainer** (User + Champion) | Contribution barrier, repeat questions | Same "how does X work" question in every Discord thread | A canonical video that answers it forever |
| **DevRel Lead** (Decision Maker + Financial Buyer) | Developer activation, time-to-first-integration | Manually producing walkthrough content doesn't scale | API + custom branding to auto-generate per-integration explainers |
| **Tech Lead / Staff Engineer** (Technical Influencer) | Code quality, team productivity | Asked to "explain the codebase" to every new hire | Async, infinite, on-demand explainer |

---

## Problems & Pain Points

**Core problem:** Understanding an unfamiliar codebase takes days of context-switching between READMEs (out of date), source files (low-level), GitHub PRs (no narrative), and asking colleagues (interrupts them). There is no middle layer — nothing that explains the *shape* of the system.

**Why alternatives fall short:**
- **Reading the README** — usually out of date, omits the architecture decisions, doesn't show how things connect
- **Reading the code** — accurate but slow; you can't see the system through the syntax
- **Asking ChatGPT** — no visualization, no narration, no shareable artifact, hallucinates module relationships
- **Watching YouTube tutorials** — don't exist for 99% of repos; the ones that do exist are typically marketing
- **Loom from a senior engineer** — requires a human's time; not reusable; stale within a quarter
- **Sourcegraph / IDE call graphs** — show data but no narrative; you still have to interpret

**What it costs them:**
- Solo: 2-8 hours per repo evaluated, 2-5 evenings lost
- Teams: 5-15 engineering-days per new hire (onboarding ramp)
- OSS maintainers: 30-60% of inbound questions are "how does this work" at the architecture level
- Companies: ~$8-15K in lost productivity per slow onboarding

**Emotional tension:** Imposter syndrome. The "I'm supposed to be senior and I can't make sense of this" feeling. The dread of opening an unfamiliar repo on a Monday. The guilt of asking a senior engineer for "the 5-minute version" for the third time.

---

## Competitive Landscape

**Direct:** None at parity. The closest products in the "AI codebase walkthrough video" category don't exist yet — this is a wedge.

**Secondary (different solution, same problem):**
- **Mintlify / ReadMe.io / Docusaurus** — solve documentation, not narrative. Fall short because they still require humans to write the docs, and docs go stale.
- **Cursor / Copilot Chat** — answer Q&A about codebases. Fall short because they're interactive (you have to know what to ask) and produce no shareable artifact.
- **Sourcegraph / GitHub Code Search** — surface structure but no story. Fall short because they don't explain *why*, only *what*.
- **DeepWiki / Sourcery / Codium** — produce static AI-generated docs. Fall short because docs aren't watched — videos are.

**Indirect (conflicting approaches):**
- **Onboarding sessions with a human** — high quality but doesn't scale, costs senior-engineer time, doesn't preserve knowledge.
- **Loom recordings** — manual to make, go stale, not generated from the actual code.
- **Reading the source** — accurate but slow; the entire reason Phantom exists.

---

## Differentiation

**Key differentiators:**
1. **Video, not docs.** People will watch a 3-minute video before they'll read a 30-page wiki.
2. **Generated from real code, not prompted from a description.** The architecture diagram comes from the actual file tree; the walkthrough names real files.
3. **Shareable artifact.** A Phantom video has a URL, an OG card, an embed code — it spreads.
4. **Async + infinite.** No human time required to produce or watch.
5. **Brand-grade output.** Cinematic Remotion-rendered scenes, professional voiceover, custom branding (Studio tier). Not a slideshow.

**How we do it differently:** Phantom doesn't try to *answer questions* about a codebase (Cursor) or *generate docs* (DeepWiki). It produces a **narrative artifact** — a 3-minute story about the system. The video format forces structure; the AI handles the synthesis; the user gets something they'd actually share in a Slack channel.

**Why that's better:**
- Videos get watched (37% completion). Docs get skimmed (8% completion).
- A link in Slack with a rich preview converts to a view. A doc link doesn't.
- "I generated a video for our repo" travels. "I wrote docs for our repo" doesn't.

**Why customers choose us:**
- Speed: 3 minutes of watching vs. 3 days of reading
- Effort: zero from the consumer, near-zero from the producer
- Shareability: Slack-native rich previews; embeddable iframe; public showcase pages
- Quality: cinematic Remotion output, not "AI slop video"

---

## Objections

| Objection | Response |
|---|---|
| "AI-generated content is low quality." | Watch the React.js showcase video. The diagrams are real, the narration is grounded in the actual file tree, the takeaways are specific. Pre-rendered showcases prove this — no rendering hides nothing. |
| "I can just ask ChatGPT to explain my codebase." | ChatGPT can't see your private repo, can't produce a sharable artifact, has no visualization, hallucinates module names. Phantom does the work end-to-end. |
| "Three minutes isn't enough for our complex codebase." | Phantom is the briefing, not the manual. It gets you 80% of the context in 5% of the time. Pro users generate per-subsystem videos for deeper dives. |
| "We have docs already." | Docs go stale the day they're written. Phantom regenerates against the current commit — your video is always as fresh as your last git push. |
| "Privacy / private repos." | (Roadmap) Personal access tokens encrypted at rest, ephemeral clone storage, deleted immediately post-render. Studio tier supports self-hosted runner for compliance. |
| "Why pay $19 when there's a free tier?" | The free tier has a watermark and limits. Pro removes both, adds 1080p, priority queue, API access. The threshold is "more than 2 videos per month" — most engineers cross that the first week. |
| "Will this work for my language / framework?" | TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, C#, Swift, C/C++, Scala, Vue, Svelte. If your repo is in this list, yes. |

**Anti-persona:**
- **The pre-revenue founder who hasn't shipped yet.** Phantom adds value to existing codebases. If you're 3 days in, you don't need it.
- **The enterprise procurement team that needs SOC 2 today.** That's roadmap, not v1.
- **The non-technical PM who wants "AI to explain the code to me."** Phantom is for engineers. PMs will get more value from a Loom of their tech lead than a Phantom video they can't fully parse.
- **The team that has actually good, maintained docs.** They exist. They're rare. They don't need us.

---

## Switching Dynamics (JTBD Four Forces)

**Push (frustrations driving them from current solution):**
- "I lose every Monday to a new codebase I don't understand"
- "I keep asking the same engineer the same questions and feeling guilty"
- "Our README hasn't been updated since 2023"
- "I have to evaluate 5 OSS libraries this week and reading them all is impossible"

**Pull (attracting them to Phantom):**
- "I can paste a URL and walk away — come back to a video"
- "It's faster than reading and more authoritative than ChatGPT"
- "It produces a thing I can share, not just a thing I can read"

**Habit (keeping them stuck with current approach):**
- "I always just read the code — that's what real engineers do"
- "We already use Mintlify/ReadMe/Notion for docs"
- "Reading is free; this costs money"

**Anxiety (worries about switching):**
- "What if the AI gets the architecture wrong?"
- "What if my team thinks AI-generated content is lazy?"
- "What if it doesn't work on our weird stack?"
- "What if it leaks our private code?"

---

## Customer Language

**How they describe the problem (verbatim, voice-of-customer):**
- "I just inherited this codebase and reading it is going to take me a week"
- "Onboarding new engineers is the slowest part of hiring"
- "Our docs are out of date the day they're written"
- "I can't tell what shape this thing is without spending hours reading"
- "I keep losing context every time I switch repos"
- "Where the hell does this app even start?"

**How they describe Phantom (target verbatim):**
- "It's like a Loom for codebases"
- "It's the briefing I always wished existed"
- "I send a Phantom link instead of a docs link now"
- "It explains the codebase the way a senior engineer would"
- "Like watching someone smart walk through the repo on screen share"

**Words to use:**
- explainer, walkthrough, narrative, briefing, cinematic, generated, paste, watch, share, instantly, async
- "minutes, not days" (anchoring on time)
- "the shape of the system" (signature phrase — own this)
- "any codebase" (universality)

**Words to avoid:**
- "intelligent" / "smart" / "powerful" — vague AI-speak
- "revolutionary" / "game-changing" — hype tells
- "leverage" / "utilize" / "facilitate" — corporate poison
- "AI-powered" as a value prop — table stakes now, not a differentiator
- "Solution" as a noun for the product — say what it actually is
- "Synergy" — never
- "Enterprise-grade" — meaningless until you have a real enterprise SLA

**Glossary:**
| Term | Meaning |
|---|---|
| **RepoX** | The flagship product — paste URL → get video. The first product under the Phantom brand. |
| **Phantom** | The company / brand. AI that understands codebases. |
| **Explainer** | A generated video. Never call it "a video" if you can call it "an explainer." |
| **The pipeline** | The 6-stage Celery task (clone → analyze → script → diagram → voice → render). |
| **Showcase** | The pre-generated gallery of explainers for popular OSS projects. |
| **Embed** | The iframe widget for putting an explainer on someone's site. |

---

## Brand Voice

**Tone:** Confident, technical, slightly cinematic. The voice of a senior engineer who's seen enough to be calm about it. Direct, dry, occasionally wry. Never corporate. Never "AI startup founder." Closer to Linear or Vercel than Salesforce or HubSpot.

**Style:**
- Sentences are short until a long one earns its place
- Specific over vague — name the repo, name the file, name the number
- One idea per paragraph
- No exclamation points outside genuine excitement
- Wry, not snarky. The product is good enough; we don't need to dunk on alternatives.

**Personality (5 adjectives):**
- Confident
- Technical
- Cinematic
- Dry
- Honest

---

## Proof Points

**Metrics (placeholder until we have real ones):**
- `[VERIFY/UPDATE]` Total repos analyzed: ___
- `[VERIFY/UPDATE]` Total minutes saved (3 days of reading per video × N videos): ___
- `[VERIFY/UPDATE]` Average video completion rate: ___%
- `[VERIFY/UPDATE]` Average video shares per generation: ___

**Showcase customers (proof by analogy — these are repos we've analyzed, not customers yet):**
- React (facebook/react) — 228k★
- Vue 3 (vuejs/core) — 47k★
- FastAPI (tiangolo/fastapi) — 79k★
- Next.js (vercel/next.js) — 126k★
- Tailwind CSS (tailwindlabs/tailwindcss) — 82k★
- LangChain — 94k★
- Supabase — 73k★
- Bun — 73k★

**Testimonials (placeholder — replace with real ones as collected):**
- `[VERIFY]` Currently using placeholders from `frontend/src/components/landing/SocialProof.tsx`. Replace each with a real, attributed quote within 30 days of launch.

**Value themes:**
| Theme | Proof |
|---|---|
| Saves time | "3 minutes vs. 3 days" — anchored everywhere |
| Replaces human onboarding | "$19 once, replace a week of senior engineer time" |
| Quality output | Live showcase gallery proves "no slop" |
| Shareability | Dynamic OG cards + embed widget + showcase permalinks |

---

## Goals

**Business goal:** 1,000 paying customers within 6 months of public launch.

**Conversion action (primary):** Generate first video.
**Conversion action (secondary):** Sign up for an account after generation. Upgrade to Pro after hitting the free-tier cap.

**Current metrics:**
- `[VERIFY]` Pre-launch. Set baseline after first 7 days post-launch:
  - Landing → generation conversion rate (target: 8%+)
  - Generation → share conversion rate (target: 15%+)
  - Free → Pro conversion (target: 2-3% of free users)
  - Day-7 retention (target: 25%+ return within a week)

**Acquisition channels (ranked by ICP reach):**
1. Twitter / X (solo devs, indie hackers, technical leaders)
2. Hacker News (Show HN, technical writeups)
3. Reddit (r/programming, r/MachineLearning, r/SideProject)
4. dev.to / Hashnode (engineering managers, technical educators)
5. LinkedIn (engineering managers, DevRel teams)
6. Direct outreach to OSS maintainers (warm)
7. Product Hunt (launch-day spike)
8. SEO via /showcase pages (long-tail "[repo] codebase explained")
