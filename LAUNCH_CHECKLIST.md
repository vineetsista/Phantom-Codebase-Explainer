# LAUNCH_CHECKLIST.md

> A real, dated, sequenced checklist for getting Phantom from "code complete" to "people are using this." Work through it top to bottom.

---

## T-7 days · Quality bar

### Cross-browser + cross-device
- [ ] Landing page renders correctly on Chrome (Mac + Windows), Safari (Mac + iOS), Firefox (Mac + Windows), Edge
- [ ] Mobile: iPhone (Safari) + Android (Chrome) — generate full flow, watch a video
- [ ] Test the custom cursor disables itself on touch devices
- [ ] Confirm reduced-motion respect (toggle OS setting, reload, verify animations are suppressed)
- [ ] All keyboard shortcuts work (Tab through landing + generate, ? on player)

### Performance + Lighthouse
- [ ] `npm run build` produces no warnings
- [ ] Lighthouse on landing page: 95+ Performance, 100 Accessibility, 100 Best Practices, 100 SEO
- [ ] Lighthouse on `/generate`: 90+ Performance
- [ ] First Contentful Paint < 1.0s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] All fonts have `font-display: swap`
- [ ] Three.js Hero component lazy-loaded (verify via Network tab — confirm it loads only when in viewport)

### Animations + UX
- [ ] All animations smooth at 60fps (Chrome DevTools → Performance → record)
- [ ] No jank when scrolling through landing page
- [ ] Generation page progress bar animates smoothly, no jumps
- [ ] Page transitions work between routes

### Loading + error + empty states
- [ ] Generation page handles a job that 404s cleanly
- [ ] Video page handles a missing video URL
- [ ] Showcase page works when poster images are missing (gradient fallback)
- [ ] Hero input rejects malformed URLs with helpful error
- [ ] What does the page look like when JS is disabled? (At minimum, no broken layout — even if interactivity is gone)

### Pipeline
- [ ] Generate 8 showcase videos and drop into `/frontend/public/showcase/{slug}.mp4` and `-poster.jpg`
- [ ] Test full generation flow end-to-end with 5 different repos:
  - [ ] A tiny single-file repo
  - [ ] A medium TypeScript monorepo (~200 files)
  - [ ] A large Python project (~1000 files)
  - [ ] A Rust project
  - [ ] A polyglot project with 3+ languages
- [ ] Confirm graceful fallback: unset `ANTHROPIC_API_KEY` and verify pipeline still produces a video
- [ ] Confirm graceful fallback: unset `OPENAI_API_KEY` and verify pipeline still produces a video (silent)
- [ ] Confirm graceful fallback: remove `/app/remotion/node_modules` and verify ffmpeg slideshow path works

### Infrastructure
- [ ] Domain registered, DNS pointed to Vercel
- [ ] SSL working (visit `https://phantom.video` — green padlock, no mixed content)
- [ ] Cloudflare R2 bucket created, CDN URL working
- [ ] Postgres backups configured (Railway / Supabase — daily automated)
- [ ] Redis (Upstash) connected and tested under load
- [ ] Worker autoscaling verified (deploy 2 workers, send 10 concurrent jobs, watch them split)

### Analytics + observability
- [ ] PostHog (or Plausible) snippet installed in root layout
- [ ] Verify all events from `lib/analytics.ts` fire (test in PostHog Live Events)
- [ ] Sentry (or alternative) installed on frontend + backend
- [ ] `/admin/analytics` page password-protected, shows funnel metrics
- [ ] Health-check endpoint (`/healthz`) returning 200 from production

### Customer support
- [ ] Inbox set up: `hello@phantom.video` (forwards to your personal Gmail or a shared inbox)
- [ ] Auto-responder: "Got it — I read every email myself, will reply within 24 hours."
- [ ] Twitter account @usephantom created with bio + pinned tweet linking to phantom.video
- [ ] Status page (statuspage.io, or a one-page "All systems operational" you can manually update)

---

## T-1 day · Final pre-flight

### Content + assets ready
- [ ] Launch tweet thread drafted in `marketing/launch-tweet-thread.md`, demo video attached natively
- [ ] Show HN post drafted in `marketing/show-hn-post.md`, NOT POSTED YET
- [ ] Reddit posts ready in `marketing/reddit-posts.md` for r/programming, r/MachineLearning, r/SideProject
- [ ] Product Hunt page set up (if launching there) — Notify subscribers, gallery uploaded
- [ ] dev.to article scheduled (post 2 days after launch — different audience, second wave)

### Pipeline sanity
- [ ] Generate a fresh video the night before. Watch it end-to-end. If there's any rough edge, fix it now or remove that feature from the launch story.
- [ ] Database backed up
- [ ] All env vars confirmed in production (Vercel + Railway dashboards)

### Soft launch
- [ ] DM 10-20 developer friends/contacts with: "Launching publicly tomorrow morning ET. Here's the link if you want to try it first. Brutally honest feedback welcome."
- [ ] Incorporate any bugs they find. Fix or document.

### Sleep
- [ ] Set alarm for 6:30 AM ET. Today's not the day to stay up late debugging.

---

## Launch day · Hour by hour

### 7:30 AM ET — pre-flight
- [ ] Coffee
- [ ] Open production site. Generate a video. Confirm everything works.
- [ ] Open Twitter, Reddit, HN, PostHog dashboard, Sentry. Keep all in tabs.

### 8:00 AM ET — Show HN
- [ ] Submit the post (don't ask for upvotes)
- [ ] Within 5 minutes, leave one substantive technical comment of your own
- [ ] Reply to every comment from here on out

### 9:00 AM ET — Twitter thread
- [ ] Post first tweet of the thread with demo video attached natively
- [ ] Post follow-ups in the same minute
- [ ] Pin the first tweet
- [ ] Quote-tweet HN link if it's getting traction

### 10:00 AM ET — Communities
- [ ] Post in 2-3 relevant Discords (Indie Hackers, Vercel, Anthropic developer community — wherever you're a real participant)
- [ ] Post in 1-2 relevant Slack workspaces

### 11:00 AM ET — Reddit
- [ ] Post r/programming variant (long technical writeup)
- [ ] Wait 24h, then post r/MachineLearning the next day, r/SideProject the day after

### All day — engagement
- [ ] Reply to every comment within 30 minutes for the first 4 hours
- [ ] Reply within 2 hours for the rest of the day
- [ ] If something breaks, post about it openly — "small fire, fixing now" beats silent panic
- [ ] Quote-tweet anyone who screenshots the product positively

### 6:00 PM ET — recap
- [ ] Post a results tweet: traffic, signups, anything funny that happened
- [ ] Tweet specific shoutouts to people who shared / commented
- [ ] Take a screenshot of the highest comment from HN, share it as social proof

### End of day
- [ ] Backup the database
- [ ] Note down the 3 most common questions you got (these go into the FAQ)
- [ ] Note down the 3 sharpest pieces of negative feedback (these go into the next sprint)

---

## T+1 week · Iterate

- [ ] Analyze funnel data: of N landing-page views, how many started a generation? Of those, how many shared? Of shared, how many returned?
- [ ] Reach out to 5 users who churned. "Saw you generated one video — anything we could've done better?"
- [ ] Reach out to 5 users who generated 3+ videos. "What would make you upgrade?"
- [ ] Pick the next feature based on what the data shows, not what your gut says
- [ ] Ship a small improvement and tweet about it. Momentum compounds.

---

## T+1 month · Inflection or pivot

- [ ] Total generations: target 1,000+
- [ ] Returning users: target 30%+
- [ ] Conversion to Pro: target 1-3%
- [ ] If you're hitting these — double down on growth (paid ads, partnerships, content)
- [ ] If you're missing — talk to users, find the wedge, iterate the positioning. Don't keep adding features hoping it'll change.

---

## Anti-checklist (don't do these on launch day)

- ❌ Don't post in 20 subreddits. Three is the limit.
- ❌ Don't run paid ads. Save that for week 2+ when you know the conversion rate.
- ❌ Don't ship a new feature. Whatever you have right now is what you launch with.
- ❌ Don't reply defensively to negative feedback. Thank them, then read it twice.
- ❌ Don't refresh the analytics dashboard every 30 seconds. Pick check-ins: every 2 hours.
