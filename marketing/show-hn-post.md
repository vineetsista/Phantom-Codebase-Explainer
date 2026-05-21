# Show HN post

HN hates marketing voice and rewards technical honesty. The opener says exactly what the thing does in one sentence. The body explains how it works. No hype, no superlatives, no "revolutionary".

---

## Title (80 chars max)

> Show HN: Phantom – turn any GitHub repo into a narrated video explainer

(Alternate: "Show HN: Phantom – I built an AI that explains codebases as videos")

---

## Post body

```
Hey HN — I'm Vineet.

Phantom takes a public GitHub URL and produces a 2-5 minute narrated video that walks you through the codebase: architecture, key files, design choices.

Live demo: https://phantom.video (first video is free, no signup)
Source: https://github.com/vineetsista/Phantom

How it works under the hood:

1. Shallow-clone the repo into ephemeral storage.
2. Walk the file tree — language stats, entry points, config files, module roles. Extension + filename + config-file heuristics across 12+ languages (no AST parsing yet — that's next).
3. Send the structured analysis to Claude (Sonnet 4.5) with a strict JSON schema. Claude returns the narration script broken into scenes — intro, architecture, code walkthrough, summary.
4. Generate per-section voiceover with OpenAI TTS (or ElevenLabs for the premium voice).
5. Render the scenes with Remotion (React-based programmatic video). Each scene is a React component that reads the script JSON as props and animates with Framer Motion patterns.
6. ffmpeg stitches the audio + video, extracts a thumbnail.

Things I learned building this:

- The hardest problem was not the AI — it was the *layout* of the architecture diagram. A bad force-directed layout makes the whole video feel cheap. I ended up with a deterministic grid + bezier connectors that consistently looks intentional.
- Pixel-perfect Remotion scenes are slow to iterate. I built a `RemotionRoot` with a preview script so I can hot-reload scenes against realistic data without re-running the full pipeline.
- For repos with no README and no obvious architecture, the analysis is shaky. I added explicit prompts that force Claude to acknowledge uncertainty rather than confidently make things up — "here's what the structure suggests" beats "here's how it works" when the codebase doesn't actually tell you.
- Cost per video, all-in (OpenAI + Anthropic + storage): about $0.18. Free tier is sustainable.

What's intentionally not there yet:

- Private repo support (next week — needs PAT handling + secret encryption).
- An actual force-directed dependency graph from real imports — currently it's structural from the file tree.
- Real auth and Stripe — running it manually for the first N users to learn what breaks.

Stack: Next.js 14, FastAPI, Celery, Postgres, Redis, Remotion, ffmpeg. Hosted on Vercel + Railway + Upstash + Cloudflare R2.

Happy to answer anything — especially curious about edge cases. If you find a repo it gets wrong, reply with the link and I'll dig in.
```

---

## Submission notes

- **Time of day:** Submit between 8:00 AM and 9:30 AM ET. The HN front page is competitive and the early morning window is when you can ride the wave longest.
- **Day of week:** Tuesday or Wednesday > Thursday. Avoid Friday and weekends.
- **First comment:** Within 5 minutes, leave a comment with the technical detail you almost included but cut — adds depth and signals you're paying attention. Something like: "Posted this without a section on the analyzer's fallback path. If Claude returns malformed JSON we fall back to a deterministic script generator that derives the narration from the analysis dict — means the pipeline still produces a video even if the LLM call fails."
- **Respond to everything for the first 4 hours.** Don't be defensive. If someone says "this won't work for X" — say "you're probably right, here's what we tried." HN respects honesty.
- **Don't ask for upvotes.** Don't tweet "hey HN go upvote my post". Quickest way to get flagged.
- **If it gets removed or flagged for "marketing":** email hn@ycombinator.com once, politely, with the actual technical content. If it's substantive, dang usually puts it back.
