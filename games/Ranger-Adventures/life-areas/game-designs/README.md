# game-designs/ — the playable catalogue (one doc per area)

The layer between *what to teach* and *what to build once*:

- [../research/research-conclusions/](../research/research-conclusions/) — **what to teach per area**
  (research-derived, confidence-flagged; the source of truth on pedagogy and honesty lines).
- [../research-game-set-up/](../research-game-set-up/) — **the five engines** (machinery built once,
  reskinned as data: staircase · predict-&-reveal · mastery/portfolio · AI-sim · taste/critique).
- **This folder — the games themselves**: every mini-game worked out as a *card* (loop, engine,
  tracking model, 8→18 growth ladder, variation axes, flags), the gaps filled, and the cross-area
  quest layer that makes ten curricula feel like one game.

Read in this order:
1. [00-growth-model.md](00-growth-model.md) — the shared 8→18 machinery: the five bands, the ten
   growth levers, the authorship flip, session cadence, variation systems. Every card refers to it.
2. The ten area docs, `area-01` … `area-10` (numbered per [../PLAN.md](../PLAN.md) §2, *not* per the
   grouped conclusions docs — each header links its conclusions source):
   [logic & math](area-01-logic-math.md) · [epistemics](area-02-epistemics.md) ·
   [finance & value](area-03-finance-and-value.md) · [work & agency](area-04-work-and-agency.md) ·
   [communication](area-05-communication.md) · [internal work](area-06-internal-work.md) ·
   [creativity & making](area-07-creativity-and-making.md) · [ethics](area-08-ethics.md) ·
   [health & attention](area-09-health-and-attention.md) · [perception](area-10-perception-and-the-senses.md)
3. [11-expeditions.md](11-expeditions.md) — multi-area quests that compose the cards into stories,
   and carry the spaced-rehearsal resurfacing (doc 06 §6) inside fresh contexts.

## Provenance convention (keep the evidence chain honest)

Every game card carries a source tag:
- **`seed: NN §M`** — the game exists in conclusions doc NN, section M. Its research grounding,
  honesty lines and veto status live *there*; the card only adds the worked design (growth, variants).
- **`new — design hypothesis`** — invented in this layer to fill a gap. It is grounded in the cited
  conclusions where possible but has **no research pedigree of its own**; vet it like a `waarschijnlijk`
  claim, and check it against the relevant doc's honesty lines before building.

## Binding constraints (inherited, non-negotiable)

Everything in this folder obeys [doc 06](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
§3 (dual-track rule) / §4 (`alvah-life-v1` shapes) / §7 (motivation rulebook — no points/badges/streaks
by default, artefact-as-reward) / §8 (transfer honesty — *scaffold, don't claim transfer*) / §9
(measure-without-harming charter) / §12 (AI-sim tiering + rails), the anti-gambling bright line
([doc 02](../research/research-conclusions/02-finance-and-value.md) §6), the inner-work hard lines
([doc 04](../research/research-conclusions/04-inner-work-communication-regulation.md) §8), the ethics
age-gates ([doc 05](../research/research-conclusions/05-creativity-making-and-ethics.md) §8), and the
shared a11y floor (audio-first, ≥56px, dual-channel, reduced-motion, never gate on reading).

Game names here are working English names; in-game copy gets Dutch names at build time, tone-checked
per the EF pipeline (AVI-level, [tone-of-voice doc](../../../../docs/tone-of-voice-alvah-site-nl.md)).

## Status

v1, 2 Jul 2026. Design layer only — nothing here is built. Engine-04-dependent pieces stay
build-blocked on PLAN §7.6 (the privacy ruling); area 9 additionally awaits its standalone health
brief (doc 04 §6) and is flagged as the most hypothesis-heavy doc in the set.
