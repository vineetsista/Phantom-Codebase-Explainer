# Voice A/B test — v1 (Rachel default) vs v2 (Brian tuned)

Recorded as part of the Phantom v2 quality pass. Generate both and listen
side-by-side; the v2 settings are codified in `backend/services/voice_generator.py`
and `backend/config.py`.

## Configurations

### v1 — baseline
- **Voice:** Rachel (`21m00Tcm4TlvDq8ikWAM`) — ElevenLabs free default.
- **Model:** `eleven_turbo_v2`.
- **voice_settings:** `{stability: 0.5, similarity_boost: 0.75}`.
- **Preprocessing:** none. Raw narration sent to API.

### v2 — shipped
- **Voice:** Brian (`nPczCjzI2devNBz1zQrb`). Warmer male timbre, handles tech
  vocabulary without the over-articulation Rachel applies to acronyms.
- **Model:** `eleven_turbo_v2_5`. ~3× faster + cheaper than `multilingual_v2`
  at indistinguishable quality on our ~150 wpm narration.
- **voice_settings:**
  - `stability: 0.40` — lower than default; allows the voice to lean into
    emphasis instead of reading flat.
  - `similarity_boost: 0.75` — keeps the speaker's identity tight across
    long-form narration.
  - `style: 0.20` — small positive value adds personality without theatrics.
  - `use_speaker_boost: true` — cleans up sibilance for headphone listeners.
- **Preprocessing** (`_preprocess_narration`):
  - Sentence breaks: `". "` → `". <break time=\"250ms\"/> "` so the voice
    breathes between sentences instead of running them together.
  - Jargon table: 25+ entries that force natural pronunciation of common
    tech terms — `npm` → `N P M`, `JSON` → `Jason`, `SQL` → `sequel`,
    `OAuth` → `O auth`, etc. Easy to extend in `_JARGON` dict.
- **Retry policy:** 4 attempts with exponential backoff for 429s and 5xx,
  honoring `Retry-After` when present.

## Model trade-off

| | turbo_v2_5 | multilingual_v2 |
| --- | --- | --- |
| Latency | ~0.5 s / 100 chars | ~1.5 s / 100 chars |
| Cost | $0.30 / 1k chars | $0.90 / 1k chars |
| Quality | indistinguishable on tech narration | slightly better on long sentences with rhythm |
| Languages | English + dialects | 30+ |

**Verdict:** ship turbo_v2_5 (`eleven_turbo_v2_5`). The latency + cost win
matters for a freemium pipeline where most audiences are English-speaking
engineers; the quality gap is inaudible on the 15–35-second clips Phantom
produces. Override per-deployment via `ELEVENLABS_MODEL_ID` if you ever
ship a non-English variant.

## How to regenerate the A/B

```bash
# baseline.mp4
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM \
ELEVENLABS_MODEL_ID=eleven_turbo_v2 \
  docker-compose up worker --build

# improved.mp4 (the shipped config)
docker-compose up --build
```

Then queue the same repo twice (e.g. `sindresorhus/is-online`) and compare
both player tabs side-by-side. Listen specifically for:
- Acronym pronunciation — `npm`, `JSON`, `OAuth`
- Sentence-to-sentence pacing
- Emphasis on opinionated lines from Problem 3's script changes
