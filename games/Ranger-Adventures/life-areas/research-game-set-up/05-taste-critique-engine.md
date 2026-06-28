# Engine 05 — Taste / Critique (the judgement engine, the AI-era skill)

> **What this folder is.** `research-game-set-up/` holds the small set of *reusable game engines*
> the whole 7→21 expansion is built from — the machinery layer **beneath** the life areas. Where
> [research/research-conclusions/](../research/research-conclusions/) says *what to teach per area*, these
> docs say *what to build once and reskin as data*. The thesis (from the five EF games): **a new
> mini-game is a record, not new code.** Read [../PLAN.md](../PLAN.md) and the architecture spine
> [research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
> first; doc 06 §3/§4/§7/§8/§9/§12 are repo-wide binding and this engine obeys them.
>
> **Confidence flags:** *zeker* = solid · *waarschijnlijk* = plausible/weaker · *laag* = thin.
> **Status:** v1, 28 Jun 2026. Engine 5 of 5 (staircase · predict-&-reveal · mastery/portfolio ·
> AI-simulation · taste/critique).

---

## 1. What it is

A **rubric-application loop**: take an artefact, apply a small **shared rubric** (intent / craft /
surprise), and articulate **"one strength + one what-if."** It is the judgement engine — *taste* — and
PLAN §1 names it the scarce AI-era skill: when generation is cheap, **evaluation is the human
bottleneck**. The defining design move (doc 05 §6) is to **separate JUDGE-mode from MAKE-mode**: never
critique during generation (it protects fluency and honours the divergent→convergent split), and train
the evaluation muscle as its own activity.

**Train on external / AI foils first, then transfer to self-critique** (doc 05 §6). Judging someone
else's (or an AI's) work is emotionally safer than judging your own, and it is **literally the same
muscle** as judging AI output. That is why this engine is shared across two areas the research flags as
*the same muscle*:

- **Creativity** — **Critique Cards** and **Spot the AI Slop**
  ([05-creativity-making-and-ethics.md](../research/research-conclusions/05-creativity-making-and-ethics.md)
  §5–§6): rate a piece on the rubric, one strength + one what-if; pick which AI option serves the intent
  and say why the others fail.
- **Epistemics** — **Spot the Confident Robot** / "evaluate the AI's answer"
  ([01-logic-math-epistemics.md](../research/research-conclusions/01-logic-math-epistemics.md) §5, doc 05
  §6 seam): **taste = epistemics applied to aesthetic / AI output.** Judging a maker's work and judging
  an AI's claim reuse one critique engine.

**Why it is its own engine, not a composition.** The rubric-application loop is reused across **≥3
areas** (creativity, epistemics, and the feedback half of work), and — crucially — it **often runs with
pre-curated foils and no LLM at all** (doc 05 §6: train on others' work first). It is not "Engine 04
minus the persona": a curated set of two drawings and the intent/craft/surprise rubric needs no
generation. When it *does* want a live reaction, it **sources foils from Engine 04**; when it produces
a verdict, it **stores to Engine 03**. It is a distinct loop that composes with both.

**Process/task language only, never person-praise.** "The way you reworked the bridge made it sturdier"
— never "you're so creative." Person-praise crosses the **no-labels line** (doc 06 §9.3; doc 05 §6:
Mueller & Dweck, Kluger & DeNisi — ego-directed feedback *harms*).

---

## 2. Which areas / mini-games it powers

Routes here when the feedback is a **contestable "which is better / what works and what doesn't, and
why,"** applied through a shared rubric — *not* a defensible right/wrong reveal (Engine 01/02) and *not*
a free generative reaction (Engine 04, which this engine may call).

| Area (conclusion doc) | Mini-game skins on this engine | Foil source |
|---|---|---|
| **Creativity & making** ([05](../research/research-conclusions/05-creativity-making-and-ethics.md) §5–§6) | **Critique Cards** (flagship — intent/craft/surprise, one strength + one what-if) · **Spot the AI Slop** (pick which serves the intent, say why others fail; older = repair the best) · the **Keeper Pick** justification layer | Pre-curated exemplars first; AI foils via Engine 04 (on opt-in) |
| **Epistemics** ([01](../research/research-conclusions/01-logic-math-epistemics.md) §5) | **Spot the Confident Robot** (flag the confident-but-wrong "AI" claim, pick a check) — *the critique half; its calibration half is Engine 02* | Scripted/local foils; AI via Engine 04 |
| **Work & agency** ([03](../research/research-conclusions/03-agency-projects-deliberate-practice.md) §5) | Critiquing a **finished restoration** against its stated intent (the evaluation half of the feedback loop) | Own portfolio artefacts; reactive critique via Engine 04 |
| **Perception — taste strand** ([07](../research/research-conclusions/07-perception-and-the-senses.md) §2) | Aesthetic discrimination that is *contestable* ("which composition reads better?") — distinct from acuity, which is Engine 01 | Curated pairs |

**The boundary that keeps this engine clean.** Discrimination with a **defensible** answer ("which call
is this?") is Engine 01. A **contestable** "which is better / more trustworthy?" is **here** (doc 01 §2
draws exactly this line: "the better drawing / the more trustworthy source → taste, Engine 05"). The
calibration/odds part of "evaluate the AI" is Engine 02; the **judgement-of-quality** part is here.
**Spot the Confident Robot is shared:** Engine 02 owns "how sure were you, were you right" (calibration),
Engine 05 owns "is this answer actually any good, and how would you check" (critique).

---

## 3. The data-skin record (a mini-game is this record, not new code)

A critique mini-game is an **artefact source + the shared rubric + a verdict prompt + a mode**. The
rubric and the loop are shared code; the artefacts and mode are the variety.

```jsonc
{
  "skin_id": "critique-cards-sketches",
  "engine": "taste-critique",
  "area": "creativity",                    // area.skill, for the spiral map
  "skill": "taste.apply-rubric",
  "tracking": "B",                         // Model B; written via Engine 03 to alvah-life-v1 (§5)

  "mode": "judge-external",                // judge-external | judge-ai | self-critique (the transfer order)

  "artefact_source": {
    "kind": "curated-pair",                // curated-pair | curated-set | ai-generated | own-portfolio
    "library_ref": "ranger-poster-foils",  // pre-curated foils need NO LLM (doc 05 §6)
    "ai_seam": null                        // or { "engine": "ai-sim", "tier": "lower" } to source live foils
  },

  "rubric": {                              // the SMALL shared rubric — consistency is what improves (doc 05 §6)
    "dimensions": ["intent", "craft", "surprise"],
    "verdict": "one-strength-one-whatif",  // always pair a strength with a what-if (never pure praise/deficit)
    "language": "process-task-only"        // NEVER person-praise — crosses the no-labels line (doc 06 §9.3)
  },

  "stores_to": {                           // output is a Model-B record handed to Engine 03
    "engine": "mastery-portfolio",
    "artifact": "critique-note",           // the note + the rising-standards portfolio view
    "scored": false                        // standards-over-time, NEVER a quality score on the child
  }
}
```

**Code map.** The rubric loop and the rising-standards portfolio view are **new** but small; the
**output** reuses Engine 03's `alvah-life-v1` writer (doc 03 §3 variant A: `rubric_dimensions` as
*descriptive*, `self_rating` non-reward-linked). When `ai_seam` is set it calls **Engine 04** for live
foils/reactions (lower-sensitivity only, on opt-in). With `artefact_source.kind: "curated-pair"` it runs
**fully local, no LLM** (doc 05 §6). [celebration.js](../../../../src/scripts/celebration.js) marks
portfolio milestones (standards visibly rising). No new dependency for the curated-foil path.

---

## 4. Difficulty & variation knobs

**Engine knobs (shared machinery):**
- **Mode progression** — **judge-external → judge-ai → self-critique** (doc 05 §6, the transfer order).
  Self-critique is the *last* and hardest mode; external foils come first because they are emotionally
  safer (doc 05 §6).
- **Rubric grain** — the rubric stays *small* (intent/craft/surprise); the lever is how many criteria
  are in play and how concrete (doc 05 §5: criteria count rises with age, the Keeper Pick justifies
  against 2 concrete criteria young, more later).
- **Verdict demand** — from "pick one strength + one what-if" up to "rewrite/repair the best option"
  (Spot the AI Slop, older band, doc 05 §5) up to articulating a **personal quality bar** (portfolio
  curation, 18–21, doc 05 §3).

**Content knobs (the per-area variety engine):**
- **Artefact domain** — sketches, posters, AI text/images, a finished restoration, a confident "AI"
  claim, a composition. New domain = a new `library_ref`, no new code.
- **Foil closeness** — far-apart options (one clearly serves the intent) → near-tie options where the
  judgement is genuinely hard. The strongest difficulty lever, like foil-confusability in Engine 01.
- **Live vs curated** — curated foils (no LLM) → live AI foils via Engine 04 (on opt-in, lower
  sensitivity). The reaction depth rises with the seam.

**Spawning a variant = changing `artefact_source` + `mode`.** Critique Cards (creativity, judge-
external) → Spot the Confident Robot (epistemics, judge-ai) is the *same* rubric loop over different
artefacts with `mode: "judge-ai"`. No new code (doc 05 §6 names them one muscle).

---

## 5. Which tracking model it feeds

**Model B** (doc 06 §3 — the judgement is contestable, needs human meaning, no fast right/wrong score).
It does not own a store; it **writes through Engine 03** to `alvah-life-v1`: critique notes plus a
**rising-standards portfolio** that lets the child *see their standards rise over time* — intrinsically
motivating and the dodge against "everyone's a genius" inflation (doc 05 §6). The portfolio shows
**standards rising, never a quality score on the child** (doc 05 §6, doc 06 §9). When it sources live
foils from Engine 04, that engine's output is also formative-only and never scores the child (doc 06
§12c). Clean split: the *taste loop* here, the *system of record* in Engine 03, the *true reaction* in
Engine 04.

---

## 6. Diegetic ranger framing

Diegetic where the artefact is a ranger thing: critiquing **reserve posters, signage, restoration
designs** against their intent ("does this sign actually tell visitors to keep dogs leashed?"); judging
which of two trail layouts reads better. Spot the AI Slop is the ranger checking AI-drafted material
before it goes up. Spot the Confident Robot is the ranger doubting a too-clean claim in the field
(doc 01 §5: "is this really a wolf's track?"). The rubric is invisible scaffolding; the child experiences
"this one works better and here's why," not "you scored the poster 3/5." Standards rising = the
reserve's materials visibly getting better over seasons (the Engine 03 almanac logic).

---

## 7. Accessibility defaults (the shared floor, doc 06 §14)

- **Audio-first / low-text, accept spoken/drawn/built responses** (doc 05 §10) — the critique can be
  **spoken** ("say what works and one what-if"), never gated on typing or reading speed. Keep the
  *thinking* hard and the *reading* light (doc 05 §10).
- **Visual perception is a strength to lean on** (doc 07 §10) — judging images plays to a dyslexic
  child's strengths; the load to minimise is decoding *text*, not looking at artefacts.
- **Dual-channel feedback**, **≥56px targets**, **reduced-motion**, child-paced; consistent icons for
  the three rubric dimensions so the structure is learnable without reading.
- **Failure is safe and iterative** (doc 05 §7) — critique lands on a *draft*, never the child; older
  learners shift toward peer/self-critique as they detect and discount empty praise (doc 05 §7).

---

## 8. Honesty / anti-overclaim

- **No person-praise / no labels** (doc 06 §9.3; doc 05 §6–§7). Process/task language only; **>⅓ of
  feedback interventions *decrease* performance when they turn attention to the self** (Kluger & DeNisi,
  doc 05 §5). Pair a strength with a what-if; avoid both pure praise (inflation) and pure deficit
  (discouragement). This is the same commitment as the agency brief's ban on person-praise (doc 03 §7).
- **Taste is trainable but the evidence is design-education observation, not RCTs** (*waarschijnlijk*,
  doc 05 §1.2). What aesthetic-education studies actually improve is **consistency of judgement** —
  build for that, not for "we taught taste."
- **Transfer is the recurring weakness** (doc 06 §8): creativity has **no far-transfer** (*zeker*) and
  is **domain-specific** (breadth won't carry across media, doc 05 §3); the AI-evaluation muscle is
  *waarschijnlijk* and AI-hallucination detection has **essentially no efficacy evidence** (doc 01 §1.4
  / §7 — even trained adults detect at ~55%). Keep **Spot the Confident Robot flagged experimental**;
  the evidenced backbone is lateral reading on web sources (doc 01 §7). Build the habit; never claim a
  general "good taste / good judgement" trait.
- **Growth-mindset is near-null on average** (doc 05 §5/§9) — use process-praise *narrowly*; it is
  shakier for adolescents who discount it. **No fourth-grade slump as fact** — scaffold harder at the
  ~12–13 *seventh*-grade dip (doc 05 §9).
- **Motivation rulebook (doc 06 §7).** The rising-standards portfolio *is* the reward (informational/
  competence, like the agency almanac); no points/badges/streaks on critique; **race your past self**,
  no leaderboard. If Alvah asks "how many points?" before a loved making/critique activity, strip the
  reward (doc 06 §7; creativity is the area the rulebook protects *most*).
- **n=1** (doc 06 §13): the portfolio shows *this child's* standards moving; it is not a measurement.

---

## 9. Clean-room source reuse

- **Within this repo:** the **output** reuses Engine 03's `alvah-life-v1` writer and
  [celebration.js](../../../../src/scripts/celebration.js); live foils reuse **Engine 04** (lower
  sensitivity, on opt-in). The rubric loop and portfolio view are new, small modules.
- **External methodology (rewrite, never lift — CLAUDE.md clean-room, [feedback-clean-room]):** the
  intent/craft/surprise rubric and the divergent→convergent / judge-vs-make separation are *methods*
  rewritten from aesthetic- and creativity-education sources (doc 05 §11: Project Zero thinking routines
  are CC-style adaptable with attribution, doc 07 §11; Mueller & Dweck / Kluger & DeNisi are
  reference-only evidence anchors, never lifted). Lateral-reading / SIFT (Caulfield, CC BY 4.0, doc 01
  §9) underpins the "evaluate the AI" beats.
- **Foil libraries (data, not code):** curated exemplar/foil pools per skin — **check each asset's
  licence** (CC per item); AI-generated foils come from Engine 04 under its rails. **No surnames** in
  any in-game artefact or attribution (roles/first-names only, CLAUDE.md rule 1).

---

## 10. Open decisions (tie to [../PLAN.md](../PLAN.md) §7)

1. **`alvah-life-v1` namespace** (PLAN §7.5). This engine writes through Engine 03; confirm the
   critique-note + rising-standards-portfolio shape as a Model-B record that **cannot hold a quality
   score on the child** (doc 05 §12, doc 06 §4). Recommend confirm.
2. **AI-sourced foils depend on PLAN §7.6** (Engine 04). The **curated-foil path needs no LLM and is
   buildable now**; live AI foils (Spot the AI Slop with generated options) are **lower-sensitivity**
   (about a made thing, not Alvah's psyche) → cloud-acceptable on Floris's opt-in + rails (doc 05 §12).
   Confirm the AI **never scores** — it only serves foils / reactions (doc 06 §12c).
3. **Spot the Confident Robot is flagged experimental** (doc 01 §1.4, §10). Confirm it ships as a
   local/scripted skin first (no cloud), splitting cleanly: calibration half → Engine 02, critique half
   → here.
4. **Rubric stability** (doc 05 §6). Confirm the rubric stays *small and shared* (intent/craft/surprise)
   across areas so the muscle is one muscle; resist per-area rubric sprawl.

---

*This is the last of the five engines. The layer beneath the ten areas is now specified:
**01 staircase** (acuity, Model A) · **02 predict-&-reveal** (calibration + odds, Model A) ·
**03 mastery/portfolio** (evidence-of-demonstration, Model B, the system of record) ·
**04 AI-simulation** (true reactions, feeds 03, the one new machine, build-blocked on PLAN §7.6) ·
**05 taste/critique** (judgement, stores to 03, sources foils from 04). Next step is not another
engine but the **build phase**: stand up the first area's first mini-game as a vertical slice on one of
these engines. See the handoff at the end of this run for the recommended first slice (Perception-on-01
or Finance-on-02 reuse the most existing code).*
