# Cold email templates

Three audiences. Each template is short, personal, and asks for one specific thing. **Never copy-paste these into a bulk sender.** Send them individually, one at a time, with the recipient's name and a real reference to their work.

**Subject line discipline:** Keep it under 50 characters, lowercase, conversational. "quick question" beats "Phantom: AI-Powered Codebase Intelligence Platform" every time.

---

## 1. Open source maintainers

**Target:** Maintainers of repos with 1k-30k stars. Sweet spot — big enough to have onboarding pain, small enough to actually read DMs.

**Subject:** quick experiment with {{repo-name}}

```
Hi {{name}} —

I'm Vineet. I built Phantom (phantom.video) — it generates a 3-minute narrated video walkthrough from any GitHub repo. Architecture, key files, design decisions.

I generated one for {{repo-name}} last night as a test:
{{video-link}}

Three thoughts before I sent this:

1. Take it down whenever you want. I'll never use a project's name without permission past today.
2. If you find it useful — for new contributors, for your README, for talks — I'd love to give you a permanent free Pro account. No catch.
3. If it gets something wrong (it will get *something* wrong), I'd genuinely love to know. Hard cases are how this gets better.

Either way, thanks for {{specific reference to a recent commit, RFC, or design choice in the project}}.

— Vineet
```

**Why this works:**
- Acknowledges that you're sending unsolicited content about their project — disarms the "this is creepy" reaction
- Gives them a real way to opt out
- Offers something valuable (free Pro) without making it transactional
- The specific reference at the end proves you actually use/follow their work

**Don't:**
- Send to maintainers of huge projects (React, Vue, Postgres) — they get 200 of these a week
- Promise to write a blog post about them in exchange for an RT — comes across as transactional
- Send without having actually generated the video first

---

## 2. DevRel teams at developer-tool companies

**Target:** DevRel leads at companies whose products developers integrate into codebases (Sentry, Vercel, Supabase, Stripe, etc.) Their job is to help engineers understand new things — Phantom is a tool that helps them do that.

**Subject:** a tool for the "how does X work?" question

```
Hi {{name}} —

I lead engineering at Phantom. We built a tool that generates a narrated video walkthrough from any GitHub repo (phantom.video). Architecture, key files, design decisions — usually 3 minutes.

The reason I'm writing: developers integrating {{company}} into their codebases hit "how does X work?" constantly. Right now the answer is your docs + a Loom recording from a sales engineer when the deal's big enough.

Two ways this might be useful for your team:

1. **Codebase explainers for your own SDKs.** We generated one for {{company-sdk-repo}} — feel free to use it as a reference: {{link}}
2. **API access at Studio tier.** Your DevRel team scripts video generation for the open-source repos that integrate with you. Customers who ask "how do I integrate X with Y" get an automatic video.

If either is interesting, happy to set you up with a free trial of the API. 15 mins on a call to see if it fits?

— Vineet
hello@phantom.video
```

**Why this works:**
- Opens with their pain (the "how does X work?" question), not your product
- Provides concrete evidence (the actual demo video)
- Asks for 15 minutes, not 30 or 60 — easier to say yes to
- Ends with a clear contact, not a calendly link (links feel sales-y in first email)

---

## 3. YouTube tech educators

**Target:** Channels in the 10k-200k subscriber range covering code reviews, codebase walkthroughs, or "let's read X" content. ThePrimeagen-adjacent. They produce the manual version of what Phantom automates.

**Subject:** could be useful for your "let's read X" videos

```
Hi {{name}} —

Vineet here. I built phantom.video — it generates narrated video walkthroughs of GitHub repos. Architecture diagrams, code walkthroughs, the design decisions.

I noticed you do {{specific video they made — "the LangChain deep dive last month", "the Bun walkthrough"}}. Phantom does the same kind of thing but automated, and the output's the kind of B-roll that could slot into your editing.

A few ideas I had:

1. Use the auto-generated architecture diagrams as cuts in your manual videos. Faster than building them in Figma.
2. Generate a Phantom video as a "first pass" for your script — see what the AI surfaces, then go deeper on the parts that interest you.
3. Sponsor slot when you do a "AI tools for devs" round-up. Happy to give you a custom referral code if you ever do.

Not pitching anything specific — would just love to put it in your hands and see if it's useful.

Want me to generate one for a repo you're planning to cover next? Free, no strings.

— Vineet
```

**Why this works:**
- References their actual work
- Gives them three different framings — they'll latch onto whichever matches how they think about it
- "Want me to generate one for X" is a low-friction ask that makes the next reply easy
- No mention of price or tiers — the ask is for them to try it, not buy it

---

## Cadence and follow-up

- **Send 5-10 of these per day max.** Quality > volume.
- **Track responses in a sheet.** Replied / didn't reply / asked for more info / no thanks.
- **One follow-up only.** 5 days after the first email, send a short:
  > "Hey, no worries if this isn't a fit — just wanted to make sure it didn't get buried. Open to revisit if anything changes."
  Then drop it. Three follow-ups is harassment.
- **What "success" looks like:** Reply rate of 15-25% is healthy. Conversion (free trial to paid / partnership) of 5-10% of replies is the realistic ceiling.
