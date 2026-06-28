# Engine 02 — Predict-&-Reveal (belief → honest reveal → informational feedback)

> **What this folder is.** `research-game-set-up/` holds the small set of *reusable game engines*
> the whole 7→21 expansion is built from — the machinery layer **beneath** the life areas. Where
> [research/research-conclusions/](../research/research-conclusions/) says *what to teach per area*, these
> docs say *what to build once and reskin as data*. The thesis (from the five EF games): **a new
> mini-game is a record, not new code.** Read [../PLAN.md](../PLAN.md) and the architecture spine
> [research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
> first; doc 06 §3/§4/§7/§8/§9/§12 are repo-wide binding and this engine obeys them.
>
> **Confidence flags:** *zeker* = solid · *waarschijnlijk* = plausible/weaker · *laag* = thin.
> **Status:** v1, 28 Jun 2026. Engine 2 of 5 (staircase · predict-&-reveal · mastery/portfolio ·
> AI-simulation · taste/critique).

---

## 1. What it is

A **state-a-belief-then-see-the-truth loop**, run over many short trials. Each trial: the child
**commits to a prediction or a choice** (with how sure / why), the game gives an **honest reveal**,
and the feedback is **informational** (a map of how belief lined up with reality), never a bare
"you lost." It is distinct machinery from Engine 01 — the staircase searches for a difficulty
*threshold*; this engine measures and improves the **fit between confidence and outcome**, and the
**quality of a decision under known odds**. Both feed Model A, but they answer different questions:
*"how fine can he discriminate?"* (01) vs *"how well does he know what he knows, and choose under
risk?"* (02).

It carries **two rubrics in one engine** — the same trial skeleton, two scoring lenses:

- **(a) Confidence calibration** — the Brier-scored **"Sure-O-Meter"**
  ([01-logic-math-epistemics.md](../research/research-conclusions/01-logic-math-epistemics.md) §6).
  Answer, state confidence, watch a personal **calibration curve** build. The feedback is the curve
  ("when you said 4/5 sure you were right 7/10"), *never* the raw per-item Brier loss. Honesty is
  rewarded on a calibration meter kept **separate** from the knowledge meter, so being well-calibrated
  is a win even when wrong (doc 01 §6).
- **(b) Expected-value / transparent-odds decisions**
  ([02-finance-and-value.md](../research/research-conclusions/02-finance-and-value.md) §5–§6). Explicit
  odds on the table, **reason-before-act**, then the outcome is revealed and the EV/variance/ruin
  intuition is drawn out over repeated capped attempts.

**The anti-gambling bright line lives here** (doc 02 §6), and it is **global** — it binds the whole
game, but its natural home is this engine because this is the only engine that ever shows the child a
chance-laden outcome. No variable-ratio reinforcement, no near-miss display, no loot-box/jackpot
reveal, no loss-disguised-as-win, no double-or-nothing — *anywhere* (§8).

---

## 2. Which areas / mini-games it powers

Routes here when a skill is about **the relationship between a stated belief/choice and a revealed
outcome over many trials** — calibration and decision-under-odds — rather than raw discrimination
(that is Engine 01) or a contestable "which is better" (that is Engine 05).

| Area (conclusion doc) | Mini-game skins on this engine | Rubric |
|---|---|---|
| **Epistemics** ([01](../research/research-conclusions/01-logic-math-epistemics.md) §5–§6) | **Sure-O-Meter** (flagship calibration) · **Prediction Diary** (dated real predictions, Brier over time) | (a) calibration |
| **Finance** ([02](../research/research-conclusions/02-finance-and-value.md) §4–§6) | **Transparent-Odds Choice** ("70% of +10 else 0" vs "sure +6") · **Doubling Machine** (predict-then-reveal the curve) · **Ruin Island** (repeated favourable bets, a wipe-out ends the run — *explicitly anti-gambling*) | (b) EV / odds |
| **Work & agency** ([03](../research/research-conclusions/03-agency-projects-deliberate-practice.md) §5) | **Predict-Then-Check** ("done by Friday?" → reality, gently) — *reuses the Sure-O-Meter machinery, reskinned to effort/time estimation; doc 03 says explicitly "don't re-derive it"* | (a) calibration |
| **Logic & math** ([01](../research/research-conclusions/01-logic-math-epistemics.md) §5) | **Evidence Tipper** (intuitive Bayes — predict, see the counts shift, update) as a predict-reveal layer over a mostly-Model-B mechanic | (a) calibration |

**The boundary that keeps this engine clean.** A trial belongs here only if there is an **honest,
non-contestable reveal** the child predicted against. "Which call is this?" with a right answer →
Engine 01. "Which drawing is better?" (contestable) → Engine 05. "How sure were you, and were you
right?" / "good bet or not, given these odds?" → **here**. The **source-judgement** half of epistemics
("is this source trustworthy?") needs human judgement of meaning, so it is **Model B** and routes
through Engine 03 — this engine only owns the part that scores cleanly (doc 01 §10, doc 06 §3).

---

## 3. The data-skin record (a mini-game is this record, not new code)

A predict-&-reveal mini-game is fully described by an **item generator + an elicitation widget + a
reveal + a rubric**. The trial loop and scoring are shared code; only the item content and the rubric
flag are area-specific.

```jsonc
{
  "skin_id": "sure-o-meter-tracks",      // unique mini-game id
  "engine": "predict-reveal",
  "area": "epistemics",                  // area.skill, for the spiral map
  "skill": "calibration.binary",
  "tracking": "A",                       // Model A (doc 06 §3); see §5 for the one B-note exception
  "rubric": "calibration",               // "calibration" | "ev-decision"

  "item": {                              // how a trial is built — the area-specific part
    "kind": "claim-true-false",          // claim-true-false | which-option | quantity-predict | bet-choice
    "library_ref": "veluwe-field-claims",// curated pool of resolvable items
    "reveal": "deterministic-fact"       // the honest answer key; never a random payout
  },

  "elicitation": {                       // age-scaled confidence widget (doc 01 §6)
    "scale": "faces-3",                  // 7-9: faces-3 (sure/unsure/guessing)
                                         // 9-12: stars-5 · 12+: prob-slider (50-100 then 0-100)
    "reason_before_act": true            // EV skins must capture a reason BEFORE the reveal (doc 02 §6)
  },

  "odds": {                              // ONLY for rubric:"ev-decision" — omitted for calibration
    "visible": true,                     // odds ALWAYS shown (doc 02 §6 bright line)
    "capped_attempts": 5,                // capped / non-escalating
    "ruin_state": true                   // Ruin Island: a wipe-out is absorbing, taught explicitly
  },

  "feedback": {
    "mode": "calibration-curve",         // calibration-curve | ev-reveal — NEVER raw per-item loss
    "honesty_meter": true,               // calibration meter kept SEPARATE from knowledge meter
    "informational": true                // competence framing, never "you lost" (doc 06 §7)
  },

  "session": {                           // reuses scoring.js summary + progressie reliability gate
    "minTrials": 20,
    "summaryExtra": ["brierMean", "calibrationBins"]   // ev skins: ["evRegret","ruinEvents"]
  },

  "milestones": [                        // mastery-anchored, "2 of last 3 reliable sessions"
    { "id": "som-1", "drempel": "beter dan altijd-50%", "metric": "brierMean", "threshold": 0.25 }
  ]
}
```

**Code map.** The loop reuses [scoring.js](../../../../src/scripts/scoring.js) `summarize` for the
session roll-up (Brier mean and the per-confidence-bin hit-rate live in `summaryExtra`),
[progressie.js](../../../../src/scripts/progressie.js) `isReliableSession` for the reliability gate,
and [mijlpalen.js](../../../../src/scripts/mijlpalen.js) `MIJLPALEN` + `isMilestoneReached` (the
`tailHits` "2 of last 3" rule) for milestones. Item *difficulty* can optionally be staircased by
**borrowing Engine 01** ([staircase.js](../../../../src/scripts/staircase.js)) to pick harder claims
as calibration steadies — the two engines compose, they don't merge. Storage is the existing
**`alvah-ef-v1`** namespace ([../../../../docs/practice-games-schema.md](../../../../docs/practice-games-schema.md)),
a new key under `exercises`. **Brier scoring and the calibration curve are this engine's only genuinely
new code** beyond the EF modules; everything else is reuse.

---

## 4. Difficulty & variation knobs

**Engine knobs (shared machinery):**
- **Elicitation grain** — the single biggest age lever: faces-3 → stars-5 → probability slider
  (50–100% for two-option, full 0–100% later). Doc 01 §6 sets the bands; youngest skip numbers
  entirely (a "confidence jar" that fills, then "was the jar right?").
- **Scoring strictness** — Brier baseline to beat is **0.25** (always saying 50%); the personal-best
  target shrinks as calibration improves. Race your past self, never a leaderboard (§8).
- **For EV skins:** number of outcomes (single → multiple, doc 02 §5), spread/variance, and whether
  **ruin** is reachable (Ruin Island turns it on; the lesson is that reckless EV-chasing loses).
  Attempts stay **capped and non-escalating** at every difficulty (doc 02 §6).

**Content knobs (the per-area variety engine):**
- **Item domain** — the same calibration loop over bird-claims, track-claims, math facts, real-world
  dated predictions (Prediction Diary), or effort/time estimates (Predict-Then-Check). New domain =
  new `item.library_ref`, no new code.
- **Resolution horizon** — instant reveal (a claim that resolves now) vs delayed reveal (a dated
  prediction resolved next session; an effort estimate checked on Friday). Delayed-reveal items are
  the same record with a `reveal` that fires later.
- **Reason demand** — from "just predict" up to "state a reason before acting" (mandatory for EV,
  doc 02 §6) up to "predict, reason, then update on one piece of evidence" (Evidence Tipper).

**Spawning a variant = changing `item` + `rubric`.** Sure-O-Meter (epistemics) → Predict-Then-Check
(agency) is the *same* engine with `area:"work"`, `skill:"estimation.effort"`, and an item generator
that emits "will I finish X by when?" prompts. No new code (doc 03 §5).

---

## 5. Which tracking model it feeds

**Model A, mostly** (doc 06 §3 — defensible reveal + many fast trials + scoring that needs no human
judgement of meaning). It writes calibration and EV session summaries to **`alvah-ef-v1`**. The Brier
mean and the calibration curve are a **map of self-knowledge**, never a verdict on the child (doc 06
§9.2): the curve says "this confidence band was a bit too high," not "you are overconfident" (no
labels, doc 06 §9.3).

**The one Model-B exception.** The *source-judgement* layer of epistemics ("who is behind this claim,
should I trust it?") is human-judgement-laden and therefore **Model B** — when a predict-reveal skin
touches it (e.g. a Source Sleuth lateral-reading beat appended to a claim), that reflective artefact
is written by **Engine 03** to `alvah-life-v1`, not by this engine. Clean split: *calibration and odds
here (psychometric); judgement-of-meaning there (mastery).* The two stores never blend into one score
(doc 06 §4).

---

## 6. Diegetic ranger framing

Calibration is naturally diegetic in ranger work: *"is that really a wolf's track? how sure are you —
and were you right when we checked?"* The Sure-O-Meter rides on field investigations (doc 01 §5's
"what explains these signs?"). The reveal is the forest telling the truth, not a quiz marking the
child. For the finance/EV skins the framing is the reserve's grants and bets under **honest, posted
odds** — never a slot machine; the Doubling Machine is grains on a chessboard, Ruin Island is a parable
about staking too much (doc 02 §4–§5). Difficulty rises *in the fiction*: trickier claims, longer
horizons, bets where ruin is genuinely on the table.

---

## 7. Accessibility defaults (the shared floor, doc 06 §14)

- **Audio-first / low-text.** Predictions are tapped faces/stars/sliders; claims and odds are read
  aloud (TTS on everything). Reading load never gates the calibration (doc 01 §8: "decouple reading
  skill from reasoning score").
- **Dual-channel feedback** (colour + scale/sound), **≥56px targets**, **reduced-motion** honoured,
  spoken/tapped responses accepted.
- **No timed high-stakes.** Reaction time may be recorded as a signal but never gated on; EV math is
  intuition, never a timed arithmetic drill (doc 02 §9: "no timed arithmetic, unlimited penalty-free
  retries").
- **Number-safe** (doc 02 §9): space digits in long numbers, pair every numeral with a visual
  magnitude (a bar/stack), let the child manipulate quantities rather than type. First-ever session
  never counts (progressie's calibration-free zone).

---

## 8. Honesty / anti-overclaim

- **The anti-gambling bright line (doc 02 §6) — GLOBAL, baked into this engine.** Educational EV =
  **explicit odds · transparent outcomes · reason-before-act · capped/non-escalating attempts.**
  **VETO** variable-ratio reinforcement, near-miss displays, hidden odds, loss-disguised-as-win,
  double-or-nothing. This applies to the whole game, not just finance; it is the same commitment as the
  motivation rulebook's no-manufactured-compulsion (doc 06 §7, which subsumes it). Engine 01 already
  cites it; this engine *owns* it.
- **Calibration training is mixed** (doc 01 §1.2, *waarschijnlijk in kids*; doc 06 §8 marks
  probability calibration as "the promising one" but needing many trials and able to over/under-correct
  into under-confidence). Sell the Sure-O-Meter as a **skill-builder for calibration on these item
  types**, not "generally better judgement." Far-transfer ≈0 (doc 06 §8).
- **Finance behaviour-transfer is the weak link** (doc 02 §8, *zeker* it is small and decays): EV
  puzzles build *knowledge*; real money behaviour barely moves. No outcome promises — **graduate to
  real money fast** (doc 02 §7) rather than claiming the game transfers.
- **Kelly/EV math is adult-derived** — keep it to intuition for a child ("a good bet can still ruin you
  if you bet too much," doc 02 §5).
- **Motivation rulebook (doc 06 §7).** Informational/competence feedback only; the calibration curve is
  a map, not a grade; rewards unexpected and mastery-anchored; reuse the predictable-chord celebration
  ([celebration.js](../../../../src/scripts/celebration.js)). **Race your past self, not a leaderboard.**
  If Alvah asks "how many points?" before a loved skin, strip the reward (doc 06 §7 threshold).
- **n=1 means no statistics** (doc 06 §13). Brier=0.25 is a paradigm fact; the child's curve is a
  private adaptation signal, not a measurement of him.

---

## 9. Clean-room source reuse

- **Within this repo:** reuse [scoring.js](../../../../src/scripts/scoring.js),
  [progressie.js](../../../../src/scripts/progressie.js), [mijlpalen.js](../../../../src/scripts/mijlpalen.js),
  [skin.js](../../../../src/scripts/skin.js), [celebration.js](../../../../src/scripts/celebration.js),
  [storage.js](../../../../src/scripts/storage.js) directly; optionally borrow
  [staircase.js](../../../../src/scripts/staircase.js) for item-difficulty selection. The Brier scorer
  and calibration-curve renderer are the only new modules.
- **External methodology (rewrite, never lift — CLAUDE.md clean-room, [feedback-clean-room]):** the
  Brier score is a public formula (`(p − o)²`); proper-scoring-rule theory and natural-frequency framing
  (Gigerenzer) are *methods*, implement from the description. Lateral-reading / SIFT (Caulfield, CC BY
  4.0, doc 01 §9) is adaptable *with attribution* for the source-judgement beats. CFPB youth materials
  (US federal, public domain, doc 02 §10) are the clean-room base for the finance items; verify each
  item's rights notice.
- **Item libraries (data, not code):** field-claim/odds pools are curated per skin; no surnames in any
  in-game attribution (roles/Latin species names only, CLAUDE.md rule 1).

---

## 10. Open decisions (tie to [../PLAN.md](../PLAN.md) §7)

1. **Namespace** (PLAN §7.5). This engine writes Model-A calibration/EV data to `alvah-ef-v1`
   (psychometric), keeping `alvah-life-v1` for the Model-B source-judgement note (Engine 03). Recommend
   confirm — same *kind* of data as the EF staircase.
2. **Elicitation bands** (doc 01 §6). Confirm the faces-3 → stars-5 → prob-slider age cuts; low stakes,
   tunable by observation.
3. **"Spot the Confident Robot"** (doc 01 §10) — an in-game "AI" that hallucinates on purpose to be
   caught. It is part calibration (this engine) and part taste/critique (Engine 05, "evaluate the AI's
   answer"); it can be **fully scripted/local** (no cloud needed). Confirm it lives as a predict-reveal
   skin that *hands its critique half to Engine 05* — flagged experimental (doc 01 §1.4, evidence thin).
4. **Real-money graduation** (PLAN §7.4, doc 02 §7). The EV skins are sim; the Graduation Ledger is a
   parent-in-loop, no-cloud, no-chance Model-B mechanic (Engine 03). Confirm the readiness signals
   (Percent Forge gate cleared, chooses lower variance under ruin and says why).

---

*Next engine: `03-mastery-portfolio-engine.md` — the Model-B evidence-of-demonstration workhorse:
the `alvah-life-v1` record, mastery rungs that unlock, the 5-rung spiral, spaced-rehearsal resurfacing,
and the measure-without-harming charter enforced in the schema.*
