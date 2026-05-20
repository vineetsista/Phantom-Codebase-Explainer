# Product Hunt — launch day copy

PH rewards: a clear tagline, a short description, a visual gallery, and the maker showing up in the comments.

---

## Name
**Phantom**

## Tagline (60 chars max)
> Any codebase. Explained in minutes.

(Alternates if the slot fills up: "Turn any GitHub repo into a video walkthrough." · "The AI that understands codebases.")

## Description (260 chars max)
> Paste any GitHub URL → get a cinematic AI-generated video that walks you through the architecture, key files, and design decisions. Built for engineers onboarding to new codebases, technical interviews, and open source maintainers. First video free.

---

## Gallery image specs

PH gives you up to 8 gallery slots. Use them deliberately. Order matters — the first 4 show in the preview.

1. **Hero shot (1270×760, .png).** The landing page hero rendered at full quality. Capture the moment the URL input is focused and the cyan glow is at peak. This is your single most important asset.
2. **Generation page in motion (1270×760, animated .gif, <5MB).** Pipeline stages on the left, terminal feed streaming on the right. 8-second loop. Compress aggressively — PH limits GIF size.
3. **The output video itself (.mp4 or YouTube embed).** Use the React.js showcase — most recognizable to PH's audience.
4. **Architecture diagram still (1270×760).** A clean screenshot of one of the Remotion Architecture scenes. Shows what people are actually buying.
5. **Bento grid section of the landing page.** Communicates the feature set without a wall of text.
6. **Showcase gallery page.** Builds credibility — "they've already done this for the projects you know."
7. **Pricing section.** Show the tiers up-front. PH visitors expect to know the cost.
8. **Tweet / social proof screenshot.** If you have early reactions from your private beta, drop one here. If not, skip — never use a fake testimonial.

---

## Maker comment (post when the product goes live, ~12:01 AM PT)

```
Hey Hunters 👋

I'm Vineet — I built Phantom because I kept losing the first 3 days at every new job trying to understand someone else's codebase.

The pitch: drop any public GitHub URL, get back a 2-5 minute narrated video that walks through the architecture, key files, and the design decisions behind them. Claude writes the narration from a structured analysis; OpenAI TTS narrates it; Remotion renders animated scenes from React components; ffmpeg stitches it all together.

A few things I'm proud of:
• The output is real — no slides, no templates. Architecture diagrams are built from the actual file tree.
• It gracefully degrades — even without paid API keys, the pipeline produces a playable video. Helps debugging.
• Cost per video is ~$0.18 all-in. Free tier is sustainable.

What it's not (yet):
• Private repo support — shipping next week.
• A real dependency graph from imports — currently it's structural.

Free tier is real — first video is free, no signup. Pro is $19/mo for unlimited.

I'll be in the comments all day. Brutal honesty welcome.
```

---

## Hunter selection

If you don't already know a hunter with a strong following, **launch yourself**. Hunter clout is not what it used to be — what matters is your own pre-launch list. Don't burn three weeks chasing a hunter.

## Pre-launch checklist (T-7 days)

- Add a "Coming soon to Product Hunt" widget to the landing page footer.
- Tweet "launching on PH next Tuesday" with a Notify link. Aim for 100+ subscribers.
- DM 50 friends/colleagues with: "I'm launching Phantom on PH next Tuesday at 12:01 AM PT. If it's useful, an upvote would help a lot. Here's the link: [Notify URL]."
- Schedule the launch for 12:01 AM PT (PH resets at midnight Pacific — first hour decides the day).

## Launch day cadence

- **12:01 AM PT:** Product goes live. Post maker comment. Tweet "we're live on PH" with link.
- **8:00 AM PT:** Reply to every comment from the night.
- **All day:** Respond within 30 minutes to every comment and every DM.
- **End of day:** Tweet results recap. Thank people who helped.
