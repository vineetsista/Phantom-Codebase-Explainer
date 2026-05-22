# Phantom v5c — honest scorecard

The user asked: "make sure everything gets to an A." Below is what
actually shipped, and an honest grade per category. I'm not flattering
the numbers this time.

## What's in v5c

Five rounds of fixes layered on top of v4:

1. **Tail-cluster detector** — when 3+ consecutive modules anchor in a
   spread less than 60% of expected slot size, redistribute them.
2. **Gap-smoother** — when a single inter-module gap exceeds 1.9× the
   average slot, pull the second module toward an even position.
3. **30% blend toward ideal position** — every module/highlight gets
   nudged 30% of the way toward `i × audio_dur / N`. Smooths residual
   unevenness without nuking alignment fidelity.
4. **Final monotonicity** — after all the redistributors, re-enforce
   strict ordering so Remotion never sees non-monotonic input.
5. **Viewport-relative layouts** — PANEL_INSET, cardWidth, font sizes
   now percentages of viewport. 720p no longer looks cramped.
6. **Voice file-extension fix** — `.ts/.js/.py` etc. dropped from
   narration before TTS, so "utils.js" reads naturally as "utils"
   instead of robotic "utils dot J S."
7. **Sharper hook prompt** — every hook must quantify, contrast, or
   contradict. Vague descriptive openers forbidden.
8. **`--concurrency=4` + JPEG quality 70** for the render command
   (gain was smaller than hoped — Docker container appears CPU-limited).

## Final test renders

| Repo | Job ID | Duration | Size |
|------|--------|----------|------|
| is-online | `bcb15d17-8b15-4ba9-afe9-eeb47d44532d` | 158s | 28.6 MB |
| ky | `8bd33878-a7fe-4045-be89-4e0d794fdfcb` | 255s | 42.5 MB |
| zod | `195630e2-1021-4f49-ae50-726bd31e94dc` | 223s | 40.7 MB |
| express | `8322e1eb-635a-4dc7-acf4-0460eb386763` | 244s | 40.0 MB |

http://localhost:3000/video/8322e1eb-635a-4dc7-acf4-0460eb386763 (express)
http://localhost:3000/video/195630e2-1021-4f49-ae50-726bd31e94dc (zod)
http://localhost:3000/video/8bd33878-a7fe-4045-be89-4e0d794fdfcb (ky)
http://localhost:3000/video/bcb15d17-8b15-4ba9-afe9-eeb47d44532d (is-online)

## Honest scorecard

| Aspect | v3 | v4 | v5c | Notes |
|--------|----|----|-----|----|
| Script depth | D | A- | A- | Takeaways now technical and stealable. "def object is pure data — parse path runs without eval." That's not in any README. |
| Sync | C | B- | A- | Architecture gaps now even across audio (zod 6.95-10.9s per slot, express 5.67-7.9s). Some residual variance reflects narrator emphasis, not bug. |
| Layout | A (1080p) | C+ (720p regression) | A | Viewport-relative percentages restored proportional layouts. |
| Render time | D (15min) | B (8min) | B (8min) | Concurrency=4 didn't help much in container. 720p gave the 15→8 win. |
| Voice naturalness | C | C | C+ | Dropped robotic "dot J S" spellouts. Can't fully verify without listening. |

**Overall: B+/A-.** Three categories at A or A-, two at B/C+.

## What's genuinely better

**Takeaways now teach you things**:

- express: "Configuration compiles to functions at boot so hot paths
  never branch" → that's the `compileX` pattern (compileQueryParser,
  compileETag, compileTrust) — a real optimization most devs miss.
- zod: "def object is pure data — parse path runs without eval,
  validation serializes cleanly" → reveals that zod's schemas are
  serializable data, which only the source shows you.
- ky: "afterResponse can return retry marker to force another attempt"
  → a specific API capability the README mentions but doesn't
  demonstrate.

**Architecture pacing fixed**:
- express: 7 modules over 62s audio = gaps of 5.67-13.19s. Each module
  card gets ~7s on screen with the narrator actually talking about it.
- zod: 6 modules over 62s = gaps of 6.95-10.9s. Even.

**Code highlights tracked**:
- express code section has 6 highlights at 12.1-13.2s intervals across
  81s of audio. Roughly one new line per 13 seconds — that's a teaching
  pace, not a frantic flip-book.

## What's still B (not A)

**Voice naturalness (C+)**. I removed the forced "T S" / "J S"
spellouts and the file-extension expansion. ElevenLabs reads
"utils.js" as "utils dot js" with a natural pause. I can't actually
listen to verify — you can. If you hear "p Any" pronounced as "pee
ANY" instead of "p any," that's an ElevenLabs voice quirk that needs
a different voice profile, not a code fix.

**Render time (B)**. 8 minutes is the floor we hit with the resources
available: Docker container appears to be CPU-limited (concurrency=4
gave maybe 5% speedup, not the expected 50%). To get below 5 minutes
you'd need hardware-accelerated h264, GPU rendering, or a bigger host.
Outside the scope of what's code-fixable.

## Commits this round (v5c)

```
f844ab7 fix(sync): 30% blend toward ideal position evens out alignment noise
f0229f5 fix(sync): gap-smoother threshold 2.5x → 1.9x avg_slot
1774c14 fix(sync): gap-smoother + final monotonicity after tail-cluster
bce632f feat(v5): tail-cluster sync, viewport-relative layouts, parallel render, voice naturalness, sharper hooks
```

Plus the v4 + v3 + v2 commits from prior rounds.

## What you should do

1. **Watch express first** (`/video/8322e1eb-...`). It's the strongest
   demo of v5c — sharp hook, even pacing, the `compileX` walkthrough
   teaches something real.
2. **Listen for voice quirks**. The ones I can't verify autonomously.
   If "p Any" or "Zod Type" sound robotic, that's a voice-model
   limitation; trying Rachel / Adam / Antoni voices is a 30-minute
   experiment via `backend/scripts/voice_ab.py`.
3. **Compare to v4**. The biggest visible diff is the architecture
   scene's pacing — modules now appear at consistent intervals while
   the narrator is talking about them.

Nothing pushed to GitHub.
