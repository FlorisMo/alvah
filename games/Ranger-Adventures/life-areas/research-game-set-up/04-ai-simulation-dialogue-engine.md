# Engine 04 — AI-Simulation / Dialogue (the one genuinely new machine)

> **What this folder is.** `research-game-set-up/` holds the small set of *reusable game engines*
> the whole 7→21 expansion is built from — the machinery layer **beneath** the life areas. Where
> [research/research-conclusions/](../research/research-conclusions/) says *what to teach per area*, these
> docs say *what to build once and reskin as data*. The thesis (from the five EF games): **a new
> mini-game is a record, not new code.** Read [../PLAN.md](../PLAN.md) and the architecture spine
> [research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md](../research/research-conclusions/06-meta-teaching-and-tracking-7-to-21.md)
> first; doc 06 §3/§4/§7/§8/§9/**§12** are repo-wide binding and this engine obeys them — §12 governs
> this engine specifically.
>
> **Confidence flags:** *zeker* = solid · *waarschijnlijk* = plausible/weaker · *laag* = thin.
> **Status:** v1, 28 Jun 2026. Engine 4 of 5 (staircase · predict-&-reveal · mastery/portfolio ·
> AI-simulation · taste/critique). **This is the only engine that is build-BLOCKED** until the PLAN
> §7.6 privacy ruling lands — everything else is scenarios-as-data on top of it.

---

## 1. What it is

A **single persona + situation + rubric generative engine** that gives the child a **true reaction** —
a character or coach that responds to what Alvah *actually* said, did, or made, not a scripted dialogue
tree (PLAN §4b). It is the one genuinely new piece of machinery the life areas add; the open-ended
capacities need *real* reactions (a farmer who answers what you actually said, a dilemma character that
pushes back on your actual reasoning), and a branching script cannot give that.

**Each scenario is DATA, not code** — a persona, a situation, and a rubric for what good looks like —
exactly the same data-skin thesis as the other four engines. **But the things that keep a child safe
are baked into the ENGINE, not the scenario data** (doc 06 §12b, PLAN §4b): a scenario author can write
a new farmer, but cannot write away a safety rail, a sensitivity tier, or the hand-off boundary. Three
constraints are welded into the engine:

1. **Child-safety rails** (doc 06 §12b) — stay in role · age-appropriate · **never frightening** (the
   [../../research/veluwe-research.md](../../research/veluwe-research.md) safety chart applies) · never
   give advice that should come from a parent or professional · **hand off gracefully when a topic gets
   too real** · guard against parasocial over-attachment.
2. **Sensitivity-tiering** (doc 06 §12a) — *where the data is allowed to go* is decided by the engine
   from the scenario's tier, not by the scenario author (§4).
3. **Provider-agnostic seam** (doc 06 §12a) — the model behind the character is swappable: on-device
   first where quality allows, cloud Claude only where the tier permits and Floris opts in.

**The evaluator bright line** (doc 06 §12c, the line we do not cross): an LLM may produce a
**formative, private signal feeding a Model-B mastery rung** (Engine 03) — **never a number that rates
who Alvah is.** An AI grading a child's emotional expression or moral reasoning is exactly the line we
do not cross (doc 04 §8, doc 05 §5).

---

## 2. Which areas / mini-games it powers

Routes here only when a skill needs a **generative true reaction** that a script cannot fake. It is a
*producer*: it never scores; it hands a formative record to Engine 03 and may source/serve foils to
Engine 05.

| Area (conclusion doc) | What the engine provides | Sensitivity tier |
|---|---|---|
| **Communication** ([04](../research/research-conclusions/04-inner-work-communication-regulation.md) §5) | **The Angry Farmer**, **Listening Lantern** — NVC and reflective listening *with a person who reacts*; anger = unmet need, answered live | **Lower** *if* the roleplay is the farmer's situation, **Highest** the moment it turns to Alvah's own feelings |
| **Ethics** ([05](../research/research-conclusions/05-creativity-making-and-ethics.md) §5, §7) | **The Intervene Dial**, **Access vs. Habitat**, **Reporting a Neighbour** — a dilemma character that **pushes back** on the child's reasoning, presenting multiple legitimate framings, never a house view | **Lower** (about a reserve dilemma, not his psyche) |
| **Creativity & making** ([05](../research/research-conclusions/05-creativity-making-and-ethics.md) §5–§6) | **Critique partner** reacting to a finished piece; **Spot the AI Slop** generating foils — the *true-reaction* half of taste (Engine 05 owns the rubric loop) | **Lower** (about a made thing) |
| **Work & agency** ([03](../research/research-conclusions/03-agency-projects-deliberate-practice.md) §5) | A **stakeholder reacting to a reserve proposal**; a coach critiquing a *finished* restoration — the feedback half of agency | **Lower** (about a proposal, not his psyche) |
| **Inner work** ([04](../research/research-conclusions/04-inner-work-communication-regulation.md) §5, §8) | AI-coach versions of Ranger-Meets-His-Fear, U-Turn Gate — **only** the most cautious, most private form | **Highest — on-device or parent-mediated ONLY, never to the cloud, any shape** |

**The boundary.** This engine is for *reactions*, not *scoring*. A defensible right/wrong reveal is
Engine 01/02. A rubric-applied "which is better" is Engine 05 (which may *source* its reactive foils
here). The mastery record of what happened is written by Engine 03. **The most ethically loaded routing
rule:** any scenario that touches **Alvah's own psyche / feelings / inner work** is **Highest
sensitivity** and **never goes to the cloud in any shape** (doc 06 §12a, doc 04 §5/§12, PLAN §4b) —
non-negotiable.

---

## 3. The data-skin record (a scenario is this record; the rails are NOT)

A scenario is a **persona + situation + rubric + a declared sensitivity tier**. The engine reads the
tier and applies routing and rails the author cannot override.

```jsonc
{
  "scenario_id": "angry-farmer-fence",
  "engine": "ai-sim",
  "area": "communication",                 // area.skill, for the spiral map
  "skill": "nvc.request-under-heat",
  "tracking": "B",                          // feeds Engine 03; this engine NEVER writes a score (§5)

  "sensitivity_tier": "lower",             // "highest" | "lower" — the ENGINE routes on this (§4)
                                           // "highest" => on-device/parent-mediated ONLY, never cloud

  "persona": {                             // the character — data
    "role": "worried sheep farmer",        // role only, NEVER a surname (CLAUDE.md rule 1)
    "carries": "fear a wolf will take lambs",
    "reacts_to": "whether the ranger names a feeling/need vs blames"
  },

  "situation": { "setup": "the fence by the heath is down again", "stakes": "low, recoverable" },

  "rubric": {                              // what "good" looks like — DESCRIPTIVE, feeds Model B
    "dimensions": [
      { "dim": "made a clear request (not a demand)", "observed_by": "ai-formative-note" },
      { "dim": "named a feeling or need", "observed_by": "ai-formative-note" }
    ],
    "produces": "formative-private-note"   // a Model-B note for Engine 03 — NEVER a number on the child
  },

  "age_gate": 12,                          // e.g. Reporting-a-Neighbour is 12+ (doc 05 §8)
  "co_play": false                         // heaviest dilemmas route to parent-present (doc 05 §8.co-play)

  // NOT IN THIS RECORD (engine-level, non-overridable): the safety rails, the hand-off boundary,
  // the provider/routing choice, transcript-retention policy, parasocial guards. Doc 06 §12b.
}
```

**Code map.** This engine is **new machinery** with no EF equivalent — a persona-runner over a
**provider-agnostic adapter** (on-device WebLLM/WebGPU first; cloud Claude behind the same interface,
using the latest Claude models, doc 06 §12a). Its **output is a formative record handed to Engine 03**
(`alvah-life-v1`, §3 of doc 03), never a score. The safety rails, hand-off detector, and routing are
engine modules, **not data**. It introduces the project's first server-touching path, so it is gated on
an explicit PLAN §7.6 decision and a new-dependency opt-in (CLAUDE.md: no new deps / client-side-only
without explicit instruction — see §10).

---

## 4. Difficulty & variation knobs

**Engine knobs (shared machinery):**
- **Sensitivity tier → routing** (doc 06 §12a) — the master knob. **Highest** (Alvah's psyche) ⇒
  on-device or parent-mediated *only*, never cloud, any shape. **Lower** (roleplay not about his
  psyche) ⇒ cloud Claude acceptable **only on Floris's explicit opt-in**, with no transcript retention
  beyond device, no names, safety rails on; **try on-device first** where quality allows.
- **Rail strictness by age** — age-appropriateness and the veluwe safety chart tighten for younger
  bands; the hand-off boundary is always on (§8).
- **Provider** — on-device vs cloud, swappable behind the seam; quality rises as small models improve,
  so on-device takes over more scenarios over time (doc 06 §12a).

**Content knobs (the per-area variety engine):**
- **Persona + situation** — a new character is a new record (worried farmer → curious visitor →
  frustrated ally → dilemma character). No new code.
- **Reactive depth** — from a character that reacts to one move, up to recursive perspective-taking
  ("what he thinks she thinks", doc 04 §3) and dilemmas that present *multiple legitimate framings*
  (doc 05 §7, the Intervene Dial — never a house view).
- **Age gate + co-play** — heavier scenarios (Reporting a Neighbour 12+, culling dilemmas 12+, doc 05
  §8) gate by age and route to **parent-present** sessions; sequence **agency before bleak facts**
  (doc 05 §8).

**Spawning a variant = a new scenario record.** The Angry Farmer → an ethics dilemma character is the
*same* engine with a new persona, situation, rubric, and tier. The rails, routing, and hand-off come
free from the engine.

---

## 5. Which tracking model it feeds

**Feeds Model B (Engine 03), never scores the child** (doc 06 §12c, PLAN §4b). The AI may produce a
**formative, private** observation that helps decide a mastery rung — "made a clear request: observed"
— written into `alvah-life-v1` by Engine 03 as a descriptive `rubric_dimensions` entry (doc 03 §3
variant A). For **inner-work scenarios it produces at most `engaged: true/false`** (doc 03 §3 variant
B) — the schema makes a quality rating impossible. **It never writes to `alvah-ef-v1`** and never emits
a number that rates who Alvah is. AI informs Model B; it does not measure the child.

---

## 6. Diegetic ranger framing

Deeply diegetic for communication and ethics (doc 04: communication "lives natively in-world";
doc 05: "the Veluwe is a natural ethics sandbox"): the farmers, visitors, a frustrated ally, a dilemma
neighbour are people the ranger actually talks to and reasons with. The character stays **in role**
(a rail, not a costume) and the fiction carries the stakes. For inner work the diegetic frame is
deliberately thin and private (doc 04 §5). The hand-off ("this is a people-thing, not a game-thing",
§8) is itself diegetic and **normalised**, so escalation never feels like failure (doc 04 §8).

---

## 7. Accessibility defaults (the shared floor, doc 06 §14)

- **Voice-first dialogue** — the child can **speak** to the character and hear it reply (TTS + speech
  input), so reading/typing never gates a conversation (doc 04 §10: "no spelling/typing required to
  express a feeling"; doc 05 §10: accept spoken/drawn/built responses).
- **Read-aloud everything, especially emotional content** (doc 04 §10); picture-first feeling
  vocabulary; consistent icons for the NVC steps so structure is learnable without reading.
- **Dual-channel feedback**, **≥56px targets**, **reduced-motion**, child-paced; no timed reading.
  Keep the *thinking* hard and the *reading* light (doc 05 §10).
- **Co-play accessibility** — parent-mediated mode is itself an accessibility and safety affordance for
  the heaviest content (doc 05 §8, doc 04 §7 co-regulation).

---

## 8. Honesty / anti-overclaim

- **Child-safety rails are mandatory in the engine** (doc 06 §12b, PLAN §4b): in role · age-appropriate
  · never frightening (veluwe chart) · never advice that should come from a parent/professional ·
  **hand off gracefully when a topic gets too real** · guard parasocial over-attachment.
- **NEVER CROSS THIS LINE** (doc 04 §8, mandatory, ships *before* any parts-work): trauma, abuse,
  "exiles"/unburdening, dissociation, flashbacks, **self-harm, suicidal thoughts, harm to others** →
  **hard stop, hand to a human** (caregiver + professional resources), never a game choice. Also barred:
  diagnosis or anything that rates the child, coercive emotion, polyvagal/neuro claims as fact, pressure
  to disclose feelings (reflection is always optional). The **"people-thing, not a game-thing"** motif
  ships first and is part of the engine's rails — *any* generative character hands off the moment a
  topic gets too real (doc 04 §8).
- **The evaluator bright line** (doc 06 §12c): formative private signal into Model B only; **never a
  score**. An AI grading moral reasoning or emotional expression is the line we do not cross (doc 05 §5,
  the no-morality-score rule; doc 04 §8).
- **Transfer is *laag/onbekend* for the areas this powers** (doc 06 §8): Communication/NVC *laag*
  (scaffold + motivation only); Ethics *laag* (reasoning ≠ conduct — target judgement, never claim
  behaviour, doc 05 §9); the feedback half of Work/Creativity scaffolds **real** making/projects. The
  AI makes practice *feel real*; it does not make the skill transfer.
- **Motivation rulebook (doc 06 §7).** Informational/competence framing in-character; no points/
  badges/streaks on conversation or reflection; **guard against parasocial over-attachment** as its own
  motivation harm (the character is a practice partner, not a friend to retain). Race your past self.

---

## 9. Clean-room source reuse

- **Within this repo:** the **output** path reuses Engine 03's `alvah-life-v1` writer and
  [celebration.js](../../../../src/scripts/celebration.js); the **dialogue/persona/rails/routing**
  layer is entirely new. The veluwe safety chart ([../../research/veluwe-research.md](../../research/veluwe-research.md))
  is the existing tone authority every persona is checked against.
- **External methodology (rewrite, never lift — CLAUDE.md clean-room, [feedback-clean-room]):** NVC's
  observation/feeling/need/request structure and IFS's parts framing are *methods*, rewritten generically
  for in-game personas (doc 04 §11: Rosenberg/Schwartz texts are reference-only, never lifted; re-ground
  feeling vocabulary in **Dutch** with a native check, never machine-translated — doc 04 §9). The
  Oostvaardersplassen dilemma (doc 05 §7) is sourced from journalism and rewritten; **present multiple
  legitimate framings, never a house view** (doc 05 §9). UNESCO/EU AI-literacy and child-safety
  frameworks are structuring references (doc 05 §11), not validated curricula.
- **Provider integration:** if cloud, use the latest Claude models behind a **swappable** seam (doc 06
  §12a); on-device WebLLM/WebGPU is the preferred path where quality allows. **No surnames** in any
  persona (roles only, CLAUDE.md rule 1).

---

## 10. Open decisions (tie to [../PLAN.md](../PLAN.md) §7)

1. **AI-simulation privacy (PLAN §7.6 — the big one, Floris's alone).** This is the only decision that
   touches a *founding* site rule (client-side only, CLAUDE.md rule 2). The recommendation is doc 06
   §12a's **sensitivity-tiering**: inner work / anything about Alvah's feelings **never to the cloud, any
   shape**; lower-sensitivity roleplay cloud-acceptable **only on explicit opt-in**, no transcript
   retention beyond device, no names, rails on, on-device tried first. **This engine is blocked until
   this lands** (doc 04 §5, doc 05 §12, doc 03 §11 all mark their AI-reaction skins blocked on it).
2. **New-dependency / new-capability opt-in** (CLAUDE.md: no new deps, client-side-only by default). A
   cloud-LLM seam or an on-device model download is a new capability requiring Floris's explicit
   instruction. Confirm the shape before any integration code.
3. **Provider-agnostic seam** (doc 06 §12a). Confirm the swappable interface so on-device can take over
   as small models improve; if cloud, latest Claude models, no-retention / no-train / no-PII + rails.
4. **The hand-off motif ships first** (doc 04 §8). Confirm sequencing: "people-thing, not a
   game-thing" and the §8 line are built and tested *before* any parts-work or heavy dilemma.
5. **Age-gates + co-play routing** (doc 05 §8, §12). Floris signs off the death/culling/harm gates and
   which dilemmas route to parent-present sessions; every persona is tone-checked against the veluwe
   safety chart before authoring.

---

*Next engine: `05-taste-critique-engine.md` — the judgement engine (the AI-era skill): judge-mode vs
make-mode, a shared intent/craft/surprise rubric, train on external/AI foils first then transfer to
self-critique. It stores to Engine 03 and may source reactive foils from this engine.*
