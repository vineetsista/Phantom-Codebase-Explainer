# Questions for the user — overnight v2 quality pass

Decisions I made autonomously while you slept. Flagged here so you can override if any of these are wrong.

## Scope vs. realism

The 10-phase brief is genuinely several days of work for a careful pass. In one overnight run I prioritised by leverage:
1. **Phase 1 (analyzer)** — monorepo support + tighter filtering. Done substantively.
2. **Phase 2 (script generator)** — system prompt tightening + better validation. Done substantively.
3. **Phase 5 (player UX)** — investigate scrubber bug + add keyboard shortcuts. Done where verifiable.
4. **Phase 10 (verification)** — generate test videos and produce a contact sheet.

Skipped or partially deferred (moved to FOLLOWUP.md):
- Cross-browser sweep (no automation in this environment)
- 375px mobile test (DevTools emulation only, not real devices)
- Lighthouse audit (`npm run audit` not wired up)
- Ambient audio bed (no royalty-free asset to drop in — left as FOLLOWUP)
- Per-section voice variation (changing `style` mid-narration is risky, see voice_pipeline memory)

## Tone tension

The brief says "senior staff engineer with opinions." Your memory and recent commits (`258d5f8 fix: softer teacher tone`) say "great teacher, not opinionated, not harsh." I went with **specific teacher** — grounded observations, no manufactured hot takes, but more opinion than pure encyclopedia. If you wanted full opinionated-senior-engineer, the SYSTEM_PROMPT in `backend/services/script_generator.py` lines ~37-300 is where to dial it up.

## Other autonomous calls

- **No GitHub push.** Followed the brief.
- **No destructive Docker volume deletes.** Used `docker restart` only.
- **Test repos.** Used the four listed: is-online, ky, zod, express.

If any of these calls were wrong, the relevant code is annotated with the rationale in the commit message.
