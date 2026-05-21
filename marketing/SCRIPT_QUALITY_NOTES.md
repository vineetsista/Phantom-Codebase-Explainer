# Script quality — notes on the senior-engineer voice prompt

The `SYSTEM_PROMPT` in `backend/services/script_generator.py` is the single
biggest lever on perceived video quality. Timing, voice, and visuals can all
be A+ and the video will still feel like a Wikipedia narration if the *words*
are dry.

## Current prompt — design intent

The prompt asks Claude to write as **a senior staff engineer recording a
walkthrough for other senior engineers they respect**. That framing is load-
bearing for three reasons:

1. **Specificity over categories.** Senior engineers don't describe; they
   react to specific code. The prompt explicitly bans "the codebase uses
   several design patterns" in favor of "they reach for the observer pattern
   in three places, and the third one is where it falls apart."

2. **Voice over neutrality.** Pure information is boring. Reactions
   (surprise, mild irritation, recognition) signal taste — which is what
   makes a developer trust the narrator.

3. **Hooks, not greetings.** The first 8 seconds are doing the work that
   would otherwise need a YouTube thumbnail. "Most devs use `navigator.onLine`.
   Most devs are wrong" beats "Welcome to is-online" every time.

## The revision pass

After the first script comes back, we scan each section's narration through
`_SLOP_PATTERNS` — a small list of AI tells (em-dash bingo, "delve", "let's
explore", "robust", parallel-three-item lists). If any pattern fires, the
section's narration goes back to Claude with `REVISION_PROMPT` for a targeted
rewrite. The system prompt isn't re-shown, just the slop heuristics — which
keeps the revision tightly scoped and cheap.

Heuristics are deliberately conservative. A false positive triggers a
re-roll, which costs ~$0.01 and tightens the line further; a false negative
ships slop. We prefer the false positives.

## When to tune

- A pattern that keeps slipping past the heuristics → add to `_SLOP_PATTERNS`.
- Claude consistently rewrites a pattern into something worse → relax the
  heuristic.
- Vocabulary that lands as slop in some domains but is correct in others
  (e.g. "leverage" inside a finance repo about leveraged positions) →
  context-aware filter; today the heuristic is global.

## What NOT to tune via the prompt

- The JSON schema. Schema changes belong in `_normalize()` so they stay
  enforced even when the model drifts.
- Section IDs. Hardcoded in `REQUIRED_SECTIONS` and matched in `Video.tsx`.
- Code/diagram visuals. Those come from `repo_analyzer.code_excerpt` and
  `diagram_generator`, not from Claude — overriding inside `_normalize`.

## Quick test loop

```bash
docker-compose up --build
# in a separate shell:
curl -X POST http://localhost:8000/api/v1/generate \
  -H 'Content-Type: application/json' \
  -d '{"repo_url":"https://github.com/sindresorhus/is-online"}'
# poll /api/v1/status/<job_id> until complete, then read script_data.
```

If the script reads like a manual, iterate on `SYSTEM_PROMPT` here, not
in the model code. The system prompt is the product.
