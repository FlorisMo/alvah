# Engine 01 — the Adaptive Staircase (Model-A workhorse)

> **What this folder is.** `research-game-set-up/` holds the small set of *reusable game engines*
> the whole 7→21 expansion is built from — the machinery layer **beneath** the life areas. Where
> [research/research-conclusions/](../research/research-conclusions/) says *what to teach per area*, these
> docs say *what to build once and reskin as data*. The thesis (from the five EF games): **a new
> mini-game is a record, not new code.** Read [../PLAN.md](../PLAN.md) and the architecture spine
> [research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
> first; doc 06 §3/§4/§7/§8/§9/§12 are repo-wide binding and this engine obeys them.
>
> **Confidence flags:** *zeker* = solid · *waarschijnlijk* = plausible/weaker · *laag* = thin.
> **Status:** v1, 28 Jun 2026. Engine 1 of 5 (staircase · predict-&-reveal · mastery/portfolio ·
> AI-simulation · taste/critique).

---

## 1. What it is

A **single adaptive-difficulty state machine** that finds the level where Alvah gets things right
about as often as is useful for learning, and tracks it over sessions. It is the engine the five EF
games already run on — [../../staircase.js](../../../../src/scripts/staircase.js) +
[scoring.js](../../../../src/scripts/scoring.js) + [progressie.js](../../../../src/scripts/progressie.js)
+ [mijlpalen.js](../../../../src/scripts/mijlpalen.js) — generalised so that **any skill with a
defensible right/wrong answer and many fast independent trials** can be a data-skin on top of it.

It is the textbook **psychophysical staircase** (a difficulty knob, a correctness signal, a rule that
steps the knob, reversals that pin the threshold). Perception doc 07 §6 says explicitly that its
Model-A engine *is the same 3-down/1-up adaptive staircase the EF games already use* — so this engine
is mostly **"point the existing machine at new stimuli,"** not new machinery (*zeker*).

**The one real code change.** The existing [staircase.js](../../../../src/scripts/staircase.js) is
**2-down/1-up** (steps up after 2 correct in a row → converges to ~70.7% correct). Perception
psychophysics wants **3-down/1-up** (→ 79.4%, doc 07 §6). So the reuse is: **parametrise `nDown`**
(default 2 to keep every existing EF game byte-identical; pass `nDown: 3` for psychophysics skins).
Nothing else in the module changes. This is the honest scope of "reuse."

---

## 2. Which areas / mini-games it powers

The dual-track decision rule (doc 06 §3) routes a skill to Model A **only if** (1) there is a
defensible correct answer, (2) the learner can produce many fast independent responses, and (3)
scoring needs no human judgement of meaning. Everything that passes that test is a staircase skin:

| Area (conclusion doc) | Mini-game skins that ride this engine | Note |
|---|---|---|
| **Perception** ([07](../research/research-conclusions/07-perception-and-the-senses.md) §6) | Name That Call · Pitch Path (flagship JND) · What Changed Since Yesterday · Read the Track · Match the Texture · Rhythm of the Forest · Spot the Hidden Animal · Spectrogram Detective | The home turf — textbook 2AFC psychophysics; reuses the EF staircase directly |
| **Logic & math** ([01](../research/research-conclusions/01-logic-math-epistemics.md)) | Sort-and-Rule (recognition) · If-Then Machines · Number-Bond Builder · Humane Fact Dojo (fluency, *un-timed*) | The scorable drill layer; Model-A part of a mostly Model-B area |
| **Finance** ([02](../research/research-conclusions/02-finance-and-value.md)) | Percent Forge (the fluency **gate** before compounding/EV) | Percent fluency is a clean right/wrong drill; the *EV/odds* parts go to Engine 02, not here |
| **Health & attention** ([PLAN §5.9](../PLAN.md)) | Attention reps that extend the existing EF games | Literally the EF engine continuing |

**The boundary that keeps this engine clean.** Discrimination with a *defensible* answer ("which call
is this?", "which print is the fox?") lives **here**. Discrimination where the "better" answer is
*contestable* ("which of these is the better drawing / the more trustworthy source?") is **taste**, and
goes to Engine 05. The "spot-the-difference / read-the-sign" candidate from the handoff **collapses into
this engine** as a stimulus-library variation mode (§4), exactly as the handoff invited — it is not a
sixth engine.

---

## 3. The data-skin record (a mini-game is this record, not new code)

A staircase mini-game is fully described by a **stimulus generator + a comparison rule + staircase
params**. Everything below is data; the engine code is shared.

```jsonc
{
  "skin_id": "name-that-call",           // unique mini-game id
  "engine": "staircase",
  "area": "perception",                  // area.skill, for the spiral map
  "skill": "auditory.species-id",
  "tracking": "A",                       // always A for this engine (doc 06 §3)

  "stimulus": {                          // how a trial is built — the only area-specific part
    "kind": "audio-2afc",                // audio-2afc | image-diff | match-to-sample | numeric ...
    "library_ref": "veluwe-birdcalls",   // curated pool (see §8 clean-room)
    "dimension": "species-confusability",// the axis difficulty moves along
    "distractors": "same-genus"          // how foils are chosen at a given level
  },

  "response": { "format": "2afc", "choices": 2 },   // 2afc is the workhorse (bias-immune, kid-legible)

  "staircase": {
    "nDown": 3, "nUp": 1,                // 3-down/1-up → 79.4% (doc 07 §6). EF default = 2-down → 70.7%
    "min": 1, "max": 9,
    "start": 3,
    "minReversals": 3                    // session-level = median of last 3 reversals (progressie.js)
  },

  "session": {                           // reuses scoring.js summary + progressie reliability gate
    "minTrials": 24,                     // span-games use 6; discrimination uses ≥24
    "reliableMaxIIV": 0.6,               // doc: isReliableSession()
    "summaryExtra": ["thresholdLevel"]   // per-skin extra fields on top of accuracy/RT/IIV
  },

  "milestones": [                        // mastery-anchored, fixed, "2 of last 3 reliable sessions"
    { "id": "ntc-1", "dier": "koolmees", "drempel": "5 soorten uit elkaar", "metric": "thresholdLevel", "threshold": 5 }
  ]
}
```

The fields map 1:1 onto code that exists: `staircase` → [staircase.js](../../../../src/scripts/staircase.js)
(`create`/`onTrial`), `session` → [scoring.js](../../../../src/scripts/scoring.js) `summarize` +
[progressie.js](../../../../src/scripts/progressie.js) `isReliableSession`/`computeSessionLevel`,
`milestones` → [mijlpalen.js](../../../../src/scripts/mijlpalen.js) `MIJLPALEN` shape and
`isMilestoneReached` (the `tailHits` "2 of last 3" rule). Storage is the **existing `alvah-ef-v1`**
namespace ([../../../../docs/practice-games-schema.md](../../../../docs/practice-games-schema.md)) — a
new game is a new key under `exercises`, not a new store. **This engine never touches `alvah-life-v1`**
(that is Model B, Engine 03).

---

## 4. Difficulty & variation knobs (how we make it harder and spawn variants)

Two layers of knobs. The **engine knobs** are the same for every skin; the **stimulus knobs** are where
an area earns its variety.

**Engine knobs (shared machinery):**
- `nDown` — convergence target. 2-down → 70.7% (gentle, EF default); 3-down → 79.4% (psychophysics).
  *waarschijnlijk* that 79.4% suits discrimination, ~70% suits effortful EF — tune per skin.
- `min`/`max`/`start` — the level range and warm-up seed (`seedLevel` starts one step below
  `currentLevel`, doc progressie §A).
- step size — currently ±1 level; a variant can use a *larger first step then shrink* (a coarse-to-fine
  staircase) for skins with a wide range. *waarschijnlijk* worth it only for fine acuity (Pitch Path).

**Stimulus knobs (the per-area variety engine):**
- **Stimulus dimension** — the physical axis: pitch interval in semitones, image % difference, clip
  length, odorant dilution, texture grit, number magnitude.
- **Confusability of foils** — same-genus vs different-family birds; fox-vs-badger vs fox-vs-deer
  prints; near-miss vs far-miss numbers. This is usually the *strongest* difficulty lever.
- **Degradation / noise** — background noise on a recording, shorter exposure, partial/eroded sign,
  motion blur. Maps to doc 07's "noise" and "exposure duration" knobs.
- **Choice count** — 2AFC → 3 → 4 alternatives (doc 07: "2AFC then 3, 4").
- **Age-band ladder** (doc 07 §spiral): 7–8 coarse categories → 9–11 a *pattern library* (curated
  chunks, the expertise model) → 11–13 fine discrimination → 14–17 rapid chunking under time/noise.
  The "pattern-library + spaced exposure" expertise model is this engine fed by a **curated stimulus
  pool that grows**, with re-exposure scheduled by Engine 03's spaced-rehearsal layer.

**Spawning a variant = changing `stimulus` + `staircase` params.** Name That Call → Spectrogram
Detective is the *same* engine with `stimulus.kind: "match-to-sample"` over spectrogram images and a
harder foil pool. No new code.

---

## 5. Which tracking model it feeds

**Model A, always** (doc 06 §3 — this engine is the *definition* of a Model-A skill: defensible answer
+ fast trials + no human judgement). It writes psychometric session summaries to `alvah-ef-v1`. The
"level" it computes is an **internal difficulty state to seed the next session**, never shown as a
verdict on Alvah (doc 06 §9.2). A skin may *also* drop a Model-B portfolio artefact for the *awareness*
half of its area (e.g. Read the Track's field log, doc 07) — but that artefact is written by **Engine
03**, not this one. Clean split: acuity here, "what I noticed" there.

---

## 6. Diegetic ranger framing

Strongly diegetic where the area is perception (doc 07 calls it "the best fit of any area"): the ranger
*reads tracks, names birds by call, feels the weather turn, spots what changed since yesterday.* The
staircase is invisible — Alvah experiences "the calls are getting trickier to tell apart," not "level
6." Difficulty rises *in the fiction*: more similar species arrive, the light fades, the recording has
more wind in it. For the pure drill skins (mental-math fluency, percent), framing is a lighter "ranger
training ground" meta screen, consistent with the EF games' existing presentation.

---

## 7. Accessibility defaults (the shared floor, doc 06 §14)

- **Audio-first / low-text.** Doc 06 §14 names the design target explicitly: Model-A tasks stay
  low-text so reading load never gates the skill. 2AFC with two tappable choices is the dyslexia-safe
  core loop. Cornell's screen-reader-accessible *Bird Song Basics* is doc 07's north-star.
- **Dual-channel feedback** (colour + scale/sound), **≥56px targets**, **reduced-motion** honoured,
  **TTS on everything**, spoken/tapped responses — carried from the EF games and the kid-visibility
  memory.
- **No timed high-stakes** for the math/fluency skins (doc 01: Humane Fact Dojo is "*not* timed/
  high-stakes"). Reaction time may be *recorded* (it is a learning signal) but never *gated on*.
- **Short sessions, generous wins, child-paced** (doc 07 §accessibility); first-ever session never
  counts (progressie's calibration-free zone).

---

## 8. Honesty / anti-overclaim (bake into the engine, not the marketing)

- **Discrimination gains are narrow and stimulus-specific** (doc 07 §9, *zeker*). Training one
  discrimination buys *that* discrimination; there is **no good evidence** it makes Alvah "generally
  more observant." Every Model-A skin is a **skill-builder for the specific skill** (doc 06 §8 transfer
  table) — breadth is sold as *habit and value* (Engine 03), never as a trained general trait.
- **n=1 means no statistics** (doc 06 §13). The 79.4%/70.7% convergence points are paradigm facts; the
  *level Alvah reaches* is a private difficulty state, not a measurement of him.
- **Race your past self, not a leaderboard.** Personal-best trajectory only; no ranking (a single
  private learner — doc 06 §7). The EF milestone design already obeys this.
- **Motivation rulebook (doc 06 §7).** Feedback is **informational/competence** ("those two calls are
  really close and you found the difference"), rewards are **unexpected** and **mastery-anchored**, not
  announced point contingencies. Reuse the existing predictable-chord celebration
  ([celebration.js](../../../../src/scripts/celebration.js)) — **no variable-ratio reward, no
  near-miss, no streak punishment** (the anti-gambling bright line, doc 02 §6, is global). If Alvah
  asks "how many points?" before playing a loved skin, strip the reward (doc 06 §7 threshold).

---

## 9. Clean-room source reuse

- **Within this repo:** reuse the EF modules *directly* — they are ours
  ([staircase.js](../../../../src/scripts/staircase.js), [scoring.js](../../../../src/scripts/scoring.js),
  [progressie.js](../../../../src/scripts/progressie.js), [mijlpalen.js](../../../../src/scripts/mijlpalen.js),
  [skin.js](../../../../src/scripts/skin.js), [celebration.js](../../../../src/scripts/celebration.js)).
  The only change is parametrising `nDown` (§1).
- **External methodology** (rewrite, never lift — CLAUDE.md clean-room, [feedback-clean-room]):
  the staircase paradigm itself (Levitt 1971 transformed up-down; 3-down/1-up → 79.4%) is a *method*,
  not copyrightable code — implement from the description, as the existing module already did
  (`staircase.js` header credits the jsPsych paradigm but is an own implementation). QUEST (Watson &
  Pelli 1983) is an *optional* trial-economy upgrade for fine-acuity skins; **skip PSI** (doc 07 §6).
- **Stimulus libraries** (the data, not code): birdcall/soundscape assets reuse the EF game's
  xeno-canto / Freesound pipeline — **check per-recording CC licence**, no surnames in attribution
  shown in-game (roles/Latin species names only). Photo/track/texture pools are curated per skin.

---

## 10. Open decisions (tie to [../PLAN.md](../PLAN.md) §7)

1. **`nDown` per skin** *(engine detail, low stakes).* Confirm default stays 2 for EF parity and
   psychophysics skins opt into 3. Recommend yes.
2. **QUEST for fine-acuity skins** *(waarschijnlijk).* Worth the extra code only if a skin (Pitch Path)
   needs far fewer trials per session for a tired child. Defer until that skin is built.
3. **Stimulus-library sourcing & licences** (PLAN §7 build prerequisite). Birdcall/photo pools need a
   licence pass before any perception skin ships; no new dependency, but an asset-provenance note like
   the EF audio pipeline.
4. **Namespace confirmation** (PLAN §7.5). This engine writes to `alvah-ef-v1` (psychometric). Confirm
   that perception Model-A data lives there too — recommended, since it is the same *kind* of data —
   keeping `alvah-life-v1` strictly for Model-B mastery (Engine 03). The two stores never blend into one
   score (doc 06 §4).

---

*Next engine: `02-predict-and-reveal-engine.md` — calibration (Brier-scored Sure-O-Meter) + expected-
value / transparent-odds decisions, with the anti-gambling bright line baked in. Stop here for review.*
</content>
</invoke>
