# Engine 03 — Mastery / Portfolio (the Model-B workhorse)

> **What this folder is.** `research-game-set-up/` holds the small set of *reusable game engines*
> the whole 7→21 expansion is built from — the machinery layer **beneath** the life areas. Where
> [research/research-conclusions/](../research/research-conclusions/) says *what to teach per area*, these
> docs say *what to build once and reskin as data*. The thesis (from the five EF games): **a new
> mini-game is a record, not new code.** Read [../PLAN.md](../PLAN.md) and the architecture spine
> [research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
> first; doc 06 §3/§4/§7/§8/§9/§12 are repo-wide binding and this engine obeys them.
>
> **Confidence flags:** *zeker* = solid · *waarschijnlijk* = plausible/weaker · *laag* = thin.
> **Status:** v1, 28 Jun 2026. Engine 3 of 5 (staircase · predict-&-reveal · mastery/portfolio ·
> AI-simulation · taste/critique).

---

## 1. What it is

The **open-ended-capacity workhorse**: the engine for every skill that has *no defensible right answer
scored fast*, where the signal is **evidence of demonstration accumulating over time**, not a number.
It is three things welded into one engine:

1. **An evidence record** — the `alvah-life-v1` *evidence-of-demonstration* shape (doc 06 §4): a
   descriptive observation or artefact, never an aggregate score.
2. **Mastery rungs that UNLOCK, never average** — the reusable **5-rung spiral template** (doc 06 §5:
   enactive → iconic → guided → independent-sim → real/graduation). Rungs gate on observable "did X
   happen," they do not blend into a mean. For **ill-structured areas (ethics, inner work)** the strict
   ladder is replaced by a **network of revisitable themes** (doc 06 §5), not a linear climb.
3. **A spaced-rehearsal scheduler** — the resurfacing layer (doc 06 §6): a **concept layer** on
   expanding intervals and a **procedural layer** that is **trigger-based, not interval-based**, with
   decay-guard windows by rung.

**It absorbs two handoff candidates as its own parts, not separate engines.** The **capture /
"notice-&-name"** candidate is this engine's **input surface** — one low-friction capture verb across
all senses ("I notice / I wonder / it reminds me of", doc 07 §7), answerable by **talk, draw, or
photo**. **Spaced rehearsal** is this engine's **scheduler**. Both are parts of Engine 03.

**The hard constraint that defines this engine.** The **measure-without-harming charter** (doc 06 §9)
is enforced *in this engine's schema, not its UI*: inner-work and ethics records are **structurally
incapable of holding a quality rating** — no `self_rating`, no scored rubric, at most an
`engaged: true/false` flag used only to decide whether to resurface. *"Track the difficulty to present
next, not the worth of the child"* (doc 06 §1.5). And because the single-rater problem is unsolved by
design (one parent cannot reach research-grade reliability, doc 06 §13), **Model B is formative only —
its "levels" are never measurement.**

---

## 2. Which areas / mini-games it powers

Routes here by the dual-track rule (doc 06 §3): **no defensible fast-scored answer, or scoring needs
human judgement of meaning → Model B → this engine.** It is the busiest engine in the expansion.

| Area (conclusion doc) | Mini-game skins on this engine | Record sub-type |
|---|---|---|
| **Work & agency** ([03](../research/research-conclusions/03-agency-projects-deliberate-practice.md) §5) | **Scope-the-Restoration** · **Notice-and-Name** (the capture surface) · **Milestone-Marker** · **Definition-of-Done Gate** · **If-Then Ranger Cards** · **WIP-Limited Toolshed** · **Reserve Almanac** (the almanac *is* the reward) · **Itch Log** · **Re-scope Rescue** · **Season-Long Stewardship** (unlock-gated ~15–16) | portfolio + rungs |
| **Creativity & making** ([05](../research/research-conclusions/05-creativity-making-and-ethics.md) §5) | **Ten-Monster Sprint** · **The Keeper Pick** · **Three-Block Build** · **Ugly First Draft** (version history) · **Voice Statement** | portfolio (artefacts) |
| **Perception — awareness half** ([07](../research/research-conclusions/07-perception-and-the-senses.md) §5, §7) | **Slow-Look Journal** · **The Sit-Spot** · **Phenology Wheel** · **Soundscape Map** · the field-log half of **Read the Track** / **Ranger's Nose** | portfolio (capture) |
| **Communication** ([04](../research/research-conclusions/04-inner-work-communication-regulation.md) §5) | **The Angry Farmer** · **Listening Lantern** · **Steelman the Stranger** · **Repair the Rope Bridge** | **presence-only** |
| **Ethics** ([05](../research/research-conclusions/05-creativity-making-and-ethics.md) §5) | **Who's Affected?** · **Gut-then-Reasons** · **The Intervene Dial** · **Access vs. Habitat** · **Steel-Man the Other Ranger** · **Seasons Replay** | **reflection artefact, no morality score** |
| **Inner work + regulation** ([04](../research/research-conclusions/04-inner-work-communication-regulation.md) §5) | **Ranger Meets His Fear** · **Body Weather Vane** · **Two-Voices Bridge** · **Felt-Sense Sketchbook** · **Down-Shift Toolkit** · **Curiosity Compass** | **Model-B-lightest: presence/streak only** |
| **Health (habits)** ([04](../research/research-conclusions/04-inner-work-communication-regulation.md) §6) | **Fuel Garden** (sleep/movement/food as fuel) | presence-only |

**The boundary.** Anything with a clean fast-scored answer is Engine 01 (acuity) or 02 (calibration/
odds). Anything whose feedback is a *contestable* "which is better, and why" is Engine 05 (taste) —
which **stores its output here** but applies its own rubric loop. A scenario that needs a **generative
true reaction** runs on Engine 04 — which also **feeds its formative signal here**. This engine is the
**system of record**; 02/04/05 are producers that write into it.

---

## 3. The data-skin record (a mini-game is this record, not new code)

A Model-B mini-game is a **generator of evidence records** plus a **rung map** plus a **resurface
rule**. The record is the Open-Badges-3.0-aligned shape from doc 06 §4. **Two variants exist, and the
difference is enforced in the type:**

```jsonc
// VARIANT A — scoreable-context skills (work, creativity, perception-awareness)
{
  "evidence_id": "uuid",
  "engine": "mastery-portfolio",
  "competency": "work.scope-a-project",   // area.skill, for the spiral map
  "tracking": "B",                        // always B for this engine (doc 06 §3)
  "store": "alvah-life-v1",               // NEVER alvah-ef-v1 (kept strictly separate, doc 06 §4)
  "spiral_rung": 3,                        // see §4 / doc 06 §5 — computed, never shown as a verdict
  "date": "ISO-8601",
  "context": "real",                      // "real" | "sim" | "hybrid"
  "artifact": { "type": "photo", "ref": "local_uri" },  // audio|text|photo|video|note — talk/draw/photo
  "prompt": "what was attempted",
  "self_rating": { "scale": "emoji-3", "value": 2, "reward_linked": false },  // present ONLY in variant A
  "rubric_dimensions": [                   // DESCRIPTIVE, not numeric
    { "dim": "had a checkable done-state", "observed": true },
    { "dim": "milestone-1 reachable in week one", "observed": "partial" }
  ],
  "parent_note": "freeform, optional, never a score",
  "next_resurface_due": "ISO-8601",        // from §4 / doc 06 §6
  "private": true                          // never leaves device
}
```

```jsonc
// VARIANT B — inner-work & ethics (the charter, enforced in the TYPE, not the UI — doc 06 §9)
{
  "evidence_id": "uuid",
  "engine": "mastery-portfolio",
  "competency": "inner-work.notice-a-part",
  "tracking": "B",
  "store": "alvah-life-v1",
  "date": "ISO-8601",
  "engaged": true,                         // the ONLY signal — used solely to decide whether to resurface
  "artifact": { "type": "drawing", "ref": "local_uri" },   // optional, private; a Felt-Sense sketch
  "private": true
  // NO self_rating. NO rubric_dimensions. NO spiral_rung as a rating. NO quality field of any kind.
  // The schema makes a quality rating IMPOSSIBLE to store, not merely discouraged.
}
```

**The "level" is computed** (the highest rung with sufficient recent evidence, doc 06 §4) and used only
to seed difficulty and resurfacing — **never displayed as a rating of the child** (doc 06 §9.2). For
variant B there is no level at all, only "did he engage? resurface or not."

**Code map.** This engine **defines the new `alvah-life-v1` store** — a sibling of
[storage.js](../../../../src/scripts/storage.js)'s `alvah-ef-v1` (the EF store, keyed under
`exercises`), kept strictly separate so psychometric and mastery data never blend into one misleading
score (doc 06 §4). The **rung map** reuses the *shape* of [mijlpalen.js](../../../../src/scripts/mijlpalen.js)
`MIJLPALEN` / `isMilestoneReached` (mastery-anchored, unlock-on-evidence) but gates on **evidence
presence**, not a psychometric threshold. The **capture surface** and the **resurface scheduler** are
new modules (no EF equivalent). [celebration.js](../../../../src/scripts/celebration.js) is reused for
unlock moments. Schema doc: [../../../../docs/practice-games-schema.md](../../../../docs/practice-games-schema.md)
governs `alvah-ef-v1`; `alvah-life-v1` needs its own schema doc, of which doc 06 §4 is the first cut
(§10).

---

## 4. Difficulty & variation knobs

**Engine knobs (shared machinery):**
- **Spiral rung** (doc 06 §5) — the 5-rung template (0 enactive / 1 iconic-recognise / 2 guided
  production / 3 independent sim / 4 real-stakes-graduation). Each rung names the *same* core idea at
  higher complexity; **never skip a rung to chase a reward.** For ethics/inner-work, swap the ladder
  for a **network of revisitable themes** (doc 06 §5) — no forced linearity.
- **Adaptive difficulty without scoring** (doc 06 §10) — adapt off **objective complexity-completion +
  evidence presence**, which are robust to the child's honesty; use **complexity ladders** (more parts,
  more ambiguity, longer horizon) and **rubric rungs** with observable "did X happen" gates.
  Self-rating is a *non-rewarded reflection signal only* (gameable, doc 06 §10); keep DDA simple.
- **Resurface schedule** (doc 06 §6) — **concept layer:** expanding intervals (1d, 3d, 9d, 3w, 8w,
  then quarterly). **Procedural layer:** trigger-based — a real-life opportunity flagged, a decay-guard
  window elapsed with no evidence, or a related practice interleaving to force discrimination.
  **Decay-guard windows by rung:** Rung 1 ~2 wks · Rung 2 ~4 wks · Rung 3 ~8 wks · Rung 4 ~quarterly.
  Give **blocked practice first** for a brand-new skill before interleaving (the low-achiever caveat).

**Content knobs (the per-area variety engine):**
- **Capture modality** — talk / draw / photo / note; the same "I notice / I wonder / reminds me of"
  verb over any sense or any project (doc 07 §7). New modality = a field on `artifact.type`.
- **Scaffolding fade** — younger picks from pre-scoped options; older scopes from scratch and defends
  the cut (doc 03 §5, Scope-the-Restoration). The Help-Fade Mentor fades on *demonstrated independence*,
  not a clock (doc 03 §5/§8).
- **Complexity of the artefact** — a one-step task → a 2–3 step plan → a project with milestones → a
  season-long stewardship (unlock-gated ~15–16; long-horizon ownership earlier produces abandoned
  goals, not agency — doc 03 §1–§2).

**Spawning a variant = a new competency + rung map + resurface rule.** Scope-the-Restoration (work) →
Slow-Look Journal (perception-awareness) is the *same* engine with a different competency, a capture
modality, and a portfolio view. No new code.

---

## 5. Which tracking model it feeds

**Model B, always** — this engine *is* the definition of Model B (doc 06 §3). It writes
evidence-of-demonstration records to the **new `alvah-life-v1`** store, kept **strictly separate** from
`alvah-ef-v1` so psychometric (Engine 01/02) and mastery data never blend into one misleading score
(doc 06 §4, PLAN §4). It also **receives** formative signals from Engine 04 (AI-sim) and Engine 05
(taste) — those engines never write a score; they hand this engine a descriptive record, and even then
**AI informs Model B, it never scores the child** (doc 06 §12c). The portfolio *is* the progress: the
Reserve Almanac, the rising-standards critique notebook, the phenology wheel filling over seasons
(doc 03 §5, doc 05 §6, doc 07 §7).

---

## 6. Diegetic ranger framing

Strongly diegetic for the work/perception/ethics strands: the ranger **scopes restorations, marks
milestones along a trail, keeps a field journal, faces genuine dilemmas.** The portfolio is the reserve
itself getting visibly better (before/after almanac, doc 03 §5). For inner work the framing leans
**meta-and-private** (doc 04 §5): a lantern lights to show *that* he paused, never *how* he felt; the
reflective layer about Alvah's own inner life stays light, private, unscored (PLAN §8). Capture is
diegetic wandering ("tap anything that bugs you"); resurfacing is the season turning ("the heather's
out — go smell it", doc 07 §7). Wonder is the reward, not a gold star (doc 07 §7.7).

---

## 7. Accessibility defaults (the shared floor, doc 06 §14)

- **Audio-first / low-text, and especially read-aloud for emotional content** (doc 04 §10) — never gate
  inner/relational learning behind reading fluency. Capture is by **voice note, drawing, or photo**, not
  typing (doc 03 §9, doc 07 §10); "speak out loud what you see."
- **Binary done-states (checkbox, not essay)**, one decision at a time, pre-filled templates; the WIP
  limit doubles as a cognitive-load limit (doc 03 §9).
- **Picture-first feeling vocabulary** for the inner-work skins (knot, spark, fog before words,
  doc 04 §10); consistent icons for the three body-states and the NVC steps so structure is learnable
  without reading.
- **Dual-channel feedback**, **≥56px targets**, **reduced-motion**, TTS on everything. Short, frequent,
  *optional* prompts beat long mandatory sessions (doc 07 §7.5). No reward system that adds a second
  thing to track (doc 03 §9).

---

## 8. Honesty / anti-overclaim

- **The measure-without-harming charter (doc 06 §9) is enforced in the schema** (§3 variant B): no
  number or grade on who he is; no level shown as a verdict; **no labels** (describe actions, never
  traits — doc 06 §9.3); local-only and private; formative not summative; self-rating decoupled from
  reward; the child can see and delete his own data; **inner work and ethics are observed, never
  scored** (at most `engaged: yes/no`). For ethics specifically: **no "morality score," ever** (doc 05
  header, §7). For inner work: *"Oordelen zijn voor het getal, niet voor het kind"* (doc 04 §2, §5).
- **Single-rater problem is unsolved → Model B is formative only** (doc 06 §13). One parent cannot reach
  research-grade reliability; the "levels" this engine computes are adaptation signals, **never
  measurement**. Say so.
- **Transfer is the recurring weakness** (doc 06 §8 table — *scaffold, don't claim transfer*): Work
  *laag* (no game-to-life evidence; scaffold around real projects); Communication/NVC *laag* (scaffold +
  motivation only); Inner work *laag* (scaffold + reflection only); Creativity *zeker no far-transfer*
  (scaffold + real making); Ethics *laag* (scaffold + real dilemmas); Perception-awareness sold as
  *habit and value*, never a trained trait (doc 07 §9). The portfolio builds **habits and enjoyment**,
  not a proven general capacity.
- **Spacing-for-skills is under-evidenced** (doc 06 §6, §13) — the resurface schedule is a reasoned
  guess, not a proven curve; treat intervals as starting points to tune by observation.
- **Motivation rulebook (doc 06 §7, doc 03 §7 — one constitution).** Default **no points/badges/
  streaks**; **reward the artefact, not the activity** (the almanac is the reward); any badge is
  *informational* and ideally *retires a scaffold*; **no leaderboards** for a single learner; **no
  punishing streaks** (a gentle progress map, forgiving). Strip rewards that crowd out a loved activity
  (creativity and inner work *especially*, doc 06 §7). The world always honours promised rewards
  (doc 02 §1.3). Threshold: if he asks "how many points?" before a loved activity, strip the reward.

---

## 9. Clean-room source reuse

- **Within this repo:** reuse [mijlpalen.js](../../../../src/scripts/mijlpalen.js) (rung-map shape),
  [celebration.js](../../../../src/scripts/celebration.js), [skin.js](../../../../src/scripts/skin.js),
  and the [storage.js](../../../../src/scripts/storage.js) load/save/export pattern — but the
  `alvah-life-v1` store, the capture surface, and the resurface scheduler are **new** (no EF
  equivalent). The export/delete path (`exportJSON`/`clearAll`) satisfies "the child can see and delete
  his data" (doc 06 §9.7).
- **External methodology (rewrite, never lift — CLAUDE.md clean-room, [feedback-clean-room]):**
  **Open Badges 3.0 (1EdTech)** is an open JSON-LD standard — safe to adopt the *evidence-record data
  schema* (the §3 shape derives from it, doc 06 §15). **CASEL** competency structure and the spiral/
  spacing literature (Chen et al. 2021 CC-BY; Sala & Gobet 2019 open access — doc 06 §15) are
  paraphrased with attribution. Panadero 2017 (CC-BY, SRL models) and WCAG 2.x inform the rung and
  a11y design. Trademark caution (doc 03 §9): "GTD," "Weekly Review," "Mind Like Water" are registered
  marks — rewrite the capture/next-action/done workflow generically, **drop governance vocabulary
  entirely** for the child (doc 03 §4).
- **No surnames** in any in-game content (roles/first-names only); citing framework authors in this
  planning doc is fine (CLAUDE.md rule 1). Artefact assets are the child's own; nothing third-party is
  bundled.

---

## 10. Open decisions (tie to [../PLAN.md](../PLAN.md) §7)

1. **`alvah-life-v1` namespace** (PLAN §7.5 — the big schema decision for engines 3/4/5). Confirm a
   **separate** store; doc 06 §4 is the first cut. This engine **defines** it, so it needs its own
   schema doc alongside [../../../../docs/practice-games-schema.md](../../../../docs/practice-games-schema.md)
   before any Model-B area ships, with the charter's bright lines encoded in the *type* (variant B).
   Recommend confirm.
2. **The charter encoded before any inner-work/ethics skin ships** (doc 06 §16, doc 04 §5). The
   inability to store a quality rating must live in the schema, not the UI — verify in code review.
3. **Resurface intervals** (doc 06 §6, §10). The decay-guard windows are starting guesses; confirm we
   tune by observation and keep DDA simple (complexity/evidence-based, not physiological inference).
4. **Diegetic boundary for inner work** (PLAN §7.2, doc 04 §12). How much of Alvah's *own* inner life
   is ever surfaced in-world vs kept private? Default here is **private-by-default**; Floris confirms.
5. **Capture-as-input across senses** — confirm the one-verb capture surface ("I notice / I wonder /
   reminds me of", doc 07 §7) is the shared front door for work-capture *and* perception-awareness, so
   it is built once.

---

*Next engine: `04-ai-simulation-dialogue-engine.md` — the one genuinely new piece of machinery: a
single persona+situation+rubric generative engine with child-safety rails, sensitivity-tiering, and a
provider-agnostic seam baked in. It feeds this engine (Model B), never scores the child.*
