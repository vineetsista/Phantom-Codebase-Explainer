# Phantom — 30-second demo script

**Runtime target:** 28-30 seconds
**Format:** 1080p vertical-safe (works on Twitter, LinkedIn, landing-page hero, Product Hunt gallery)
**Tone:** Punchy. Dev-shaped. Zero marketing voice.
**Audio:** Optional ambient bed at 8% volume. The video has to work fully muted with captions.

---

## Shot-by-shot

### [0:00 – 0:03] — The pain (relatable hook)
- **Visual:** Tight screen capture of a developer scrolling through an unfamiliar repo on GitHub. Cursor moves fast, scroll wheel blur, brief flashes of opening files.
- **On-screen caption (bone, Clash Display 700, bottom-third):**
  > "spent days trying to understand a new codebase?"
- **Audio:** Subtle ambient pad starts.

### [0:03 – 0:06] — The pivot
- **Visual:** Hard cut to black for 4 frames. Phantom logo draws itself in (the icon mark scales from 0 with the cyan glow). Then a smash cut to the Phantom landing page hero.
- **On-screen caption:**
  > "we built a faster way."

### [0:06 – 0:11] — The action
- **Visual:** Screen recording of the user pasting a real GitHub URL (`https://github.com/vercel/next.js`) into the hero input field. The cursor clicks Generate. Cut to the generation page split-screen as the pipeline kicks off — pipeline stages animating in, live terminal feed streaming text on the right.
- **On-screen caption (cyan, JetBrains Mono):**
  > `phantom · analyzing next.js…`

### [0:11 – 0:18] — The build
- **Visual:** Speed-ramped (3-4× real time) cut through the pipeline. Quick beats: stage indicator flashing to active, terminal lines streaming ("Found 1,847 files", "Detected: TypeScript 89%", "Architecture: monorepo with microservices"), the architecture diagram boxes popping in one by one, voiceover waveform pulsing.
- **No caption.** Let the motion carry it.

### [0:18 – 0:25] — The reveal
- **Visual:** Hard cut to the finished video playing inside Phantom's custom player. We see the animated architecture diagram, then a quick montage cut showing each scene type (code walkthrough, data flow, summary cards). The corner timecode reads `00:03:14`.
- **On-screen caption:**
  > "any repo. cinematic video. three minutes."

### [0:25 – 0:30] — The CTA
- **Visual:** Pull back to the landing page hero with the URL input pulsing cyan, cursor hovering over Generate.
- **On-screen caption (large, centered):**
  > **phantom.video**
  > first video free
- **Audio:** Ambient pad ducks. One soft synth note on the logo settle.

---

## Caption pack (for autoplay-muted feeds)

Use these as overlaid text tracks in addition to the captions baked into the cut, so platform-side caption rendering still works:

1. `Spent days trying to understand a new codebase?`
2. `We built a faster way.`
3. `Paste any GitHub URL. Get a cinematic video walkthrough.`
4. `Architecture + code + narration — in minutes.`
5. `phantom.video · first video free`

## Recording notes

- Capture at 60fps so the speed-ramp section stays smooth.
- The terminal feed text should be real — record it generating a real repo, then trim. Don't fake the output. People can tell.
- The cursor should be a custom large cursor (Pluralsight Cursor or similar) so it reads on small screens.
- Render in two cuts: 9:16 vertical (for TikTok / Reels / Shorts) and 16:9 landscape (for Twitter / LinkedIn / landing-page hero).
- Final encode: H.264, ~6 Mbps, 1080p. Keep the file under 25MB so Twitter doesn't recompress aggressively.

## Variations

- **5-second teaser:** First 3 seconds + caption #5. Used as a follow-up tweet or a story sticker.
- **60-second deep version:** Same beats, but linger on the generation page (people LOVE watching the live feed) and show two different repos getting analyzed back-to-back.
