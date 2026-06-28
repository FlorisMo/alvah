# Conclusions — META: teaching & tracking life-skills 7→21 (the architecture brief)

> **Source of truth — and the load-bearing one.** Distilled from [../research-prompts/06-meta-teaching-and-tracking-7-to-21.md](../research-prompts/06-meta-teaching-and-tracking-7-to-21.md)
> (intent) + [../research-results/result 6 META- teaching.md](../research-results/result%206%20META-%20teaching.md)
> (evidence). Confidence: **zeker** = solid, **waarschijnlijk** = plausible/weaker, **laag/onbekend**
> = little or no credible evidence.
>
> **This brief governs the architecture, not one area.** Its outputs ARE PLAN §3 (spiral/graduation),
> §4 (the two tracking models), §4b (AI-simulation + child safety), and §8 (guardrails) made rigorous.
> Five of its sections are **repo-wide binding constraints** on every other area:
> - **§3 the dual-track decision rule** — when a skill is Model A vs Model B.
> - **§4 the `alvah-life-v1` Model-B data shapes** — the evidence-record everything else writes to.
> - **§7 the motivation rulebook** — bounds how *every* area uses points/badges/streaks (it merges
>   with the area-4 motivation rules; treat as one constitution).
> - **§8 the transfer-honesty table** — bounds what we are *allowed to claim* per area.
> - **§9 the "measure without harming" charter** — operationalises the tov hard line; quote it into
>   PLAN §8.
>
> **Status:** v1, 23 Jun 2026.

---

## 1. Verdict — what the whole build must obey

1. **Run two tracking models, never one** (*zeker as a design call*). Model A (psychometric staircase)
   ONLY for the ~3 skills with a clean correctness signal (logic drills, mental math, probability
   calibration — plus sensory discrimination from area 10, and the EF games). Model B (private
   mastery/portfolio + spaced rehearsal) for *everything open-ended*. **The decision rule (§3) is
   binding: if there is no defensible right answer and fast repeatable response, never assign a number
   to the child.**
2. **Far-transfer is essentially zero when corrected** (*zeker — the most aggressively flagged finding
   in the set*). Sala & Gobet 2019 (233 studies): unbiased overall g̅ = **0.00**. "The lack of
   generalization of skills acquired by training is an invariant of human cognition." **For the macro-
   competencies the game is *scaffolding and motivation around real-world practice* — not the thing
   that builds the skill.** The only credible (small) real-life transfer is domain-matched: finance
   *behaviour* ≈0.10 SD, SEL behaviour ≈0.14–0.24 SD fading over time. The transfer table (§8) bounds
   every area's claims.
3. **Gamification is a genuine burnout risk over a decade** (*zeker on the mechanism, waarschijnlijk on
   durability*). Over-justification is real but *conditional* — the danger zone is **expected, tangible,
   engagement-contingent rewards layered on an already-loved activity** (d = −0.40). Informational/
   competence feedback *enhances* motivation (d = +0.33). Streaks drive retention *and* manufacture
   loss-anxiety (Duolingo had to build streak-freeze to undo their own harm). The rulebook (§7) is
   binding.
4. **Spiral for the *shape* of the decade; mastery rungs for *gating progress*** (*spiral
   waarschijnlijk/thin; mastery zeker-positive, size contested*). Bruner's spiral is theoretically
   dominant but empirically thin and fits *ill-structured* domains (ethics, inner work) poorly — use a
   *network of revisitable themes* there, not a linear ladder. Mastery learning has the firmer
   evidence (~d≈0.5; tutoring 0.37 SD — and **Bloom's "2-sigma" is a myth**, no study reached it).
5. **You cannot reduce the child to a number — and the data model must make it impossible, not just
   discouraged** (*the values commitment*). The §9 charter's bright lines live in the *schema*: inner-
   work and ethics records are structurally incapable of holding a quality rating. "Track the
   difficulty to present next, not the worth of the child."

## 2. What this governs (design intent)

How all nine areas are taught, sequenced, tracked, and handed off to real life — the **pedagogy and
measurement architecture**, client-side, private, single learner, sometimes with a parent. No grades,
no classroom, no server. Everything below is reusable scaffolding the area docs plug into; where an
area doc (01–05, 07) and this doc disagree, **this doc wins on architecture**, the area doc wins on
content.

## 3. The dual-track decision rule (binding, apply per skill)

```
1. Is there a defensible correct answer?            → if NO  → Model B
2. Can the learner produce many fast, independent
   responses?                                        → if NO  → Model B
3. Does scoring require human judgement of
   context/meaning?                                  → if YES → Model B
4. Only if 1–2 = YES and 3 = NO                      → Model A (psychometric staircase)
```

**Expected split.** Model A: logic drills, mental math, probability calibration, sensory
discrimination/acuity (area 10), the existing EF mini-games. Model B: work/agency, communication,
inner work, creativity/making, ethics, most of health/attention, *and the judgement layers* of finance
and epistemics. (This matches every area doc's own tracking call — 01 Model A-heavy, 02 mixed, 03–05
Model B, 07 cleanly both.)

## 4. The `alvah-life-v1` Model-B data shape (the schema everything writes to)

Store **descriptive observations and artefacts, not aggregate scores.** Open-Badges-3.0-aligned
*evidence-of-demonstration* record:

```
{
  "evidence_id": uuid,
  "competency": "communication.request",      // area.skill
  "spiral_rung": 3,                            // see §5
  "date": ISO-8601,
  "context": "real" | "sim" | "hybrid",
  "artifact": { "type": "audio|text|photo|video|note", "ref": local_uri },
  "prompt": "what was attempted",
  "self_rating": { "scale": "emoji-3", "value": 2, "reward_linked": false },
  "parent_note": "freeform, optional, never a score",
  "rubric_dimensions": [                       // DESCRIPTIVE, not numeric
     { "dim": "made a clear ask", "observed": true },
     { "dim": "named a feeling/need", "observed": "partial" }
  ],
  "next_resurface_due": ISO-8601,              // from §6
  "private": true                              // never leaves device
}
```

**The "level" is computed (the highest rung with sufficient recent evidence), NEVER displayed as a
rating of the child.** For inner-work and ethics competencies, the record carries **no `self_rating`
and no scored rubric** — at most a `engaged: true/false` flag used only to decide whether to resurface
(the §9 bright line, enforced in the type, not the UI). This is the `alvah-life-v1` namespace PLAN §7.5
proposes — separate from `alvah-ef-v1` so psychometric and mastery data never blend into one misleading
score.

## 5. The reusable spiral-design template (any area, 5 rungs)

Cross Bruner's three representations (enactive → iconic → symbolic) with mastery gating:

| Rung | Age anchor | What it is | Gate |
|---|---|---|---|
| **0** | ~7, enactive | Do it once, concretely, with the parent, no abstraction | Did it happen? |
| **1** | iconic | Recognise/sort examples; name the move | Reliable recognition |
| **2** | guided production | Perform with scaffolding/prompts | ≥3 demonstrations across ≥2 contexts |
| **3** | independent sim | Perform unprompted in-game | Demonstrations without scaffolding |
| **4** | real-stakes / graduation | Perform in the real world, debriefed | Real-world artefact + reflection |

**Rules:** each rung names the *same core idea* at higher complexity; never skip a rung to chase a
reward; revisit lower rungs on the §6 spaced schedule. **For ill-structured areas (ethics, inner work)
replace the strict ladder with a *network* of revisitable themes** — don't force linearity. (Each area
doc's 7→21 table is the *content* of its rungs; this template is the *shape*.)

## 6. Spaced-rehearsal scheduling (keep-it-warm, not memory-optimisation)

Spacing is strong for *concepts*, weak/mixed for *procedures* — so treat resurfacing as **"keep it warm
+ vary the context,"** not as an optimisation of a memory curve.

- **Concept/declarative layer** ("what *is* an NVC request"): expanding intervals — 1d, 3d, 9d, 3w, 8w,
  then quarterly.
- **Procedural/practice layer** ("actually make a request"): **trigger-based, not interval-based** —
  resurface when (a) a real-life opportunity is flagged by parent/learner, (b) the rung has had no
  evidence in N weeks (decay guard), or (c) a *related* practice interleaves to force discrimination.
- **Interleave related practices** (plan-a-project ↔ break-down-a-task) — but **give blocked practice
  first for a brand-new skill** (the low-achiever caveat; interleaving early can hurt).
- **Default decay-guard windows by rung:** Rung 1 ~2 wks · Rung 2 ~4 wks · Rung 3 ~8 wks · Rung 4
  ~quarterly.

*Honesty: this schedule is a reasoned extrapolation, not a proven schedule (§10). Treat intervals as
starting guesses to tune by observation.*

## 7. The motivation rulebook (repo-wide — merges with area-4 §7)

This and [03-agency-projects-deliberate-practice.md](03-agency-projects-deliberate-practice.md) §7 are
**one constitution from two angles**; where they overlap they agree. Grounded in Deci/Koestner/Ryan
1999.

**DO:** use **informational/competence feedback** ("that was a hard one and you found the structure" —
*enhances* intrinsic motivation, d=+0.33) · make rewards **unexpected** (surprise unlocks, not
announced contingencies) · reward **effort/strategy/finishing hard things**, not engagement with things
he already loves · support the **SDT triad** (autonomy = real choice, competence = right difficulty,
relatedness = parent presence) · use **forgiving streaks** (streak-freeze, weekly not daily) *if at all*.

**DON'T:** put points/badges on an activity he already does for its own sake (**creativity, inner work
especially**) · make rewards **expected + tangible + engagement-contingent** (the −0.40 undermining
zone) · use **leaderboards/competitive ranking** for a single private learner (manufactures anxiety, no
relatedness benefit) · let **streak-loss punish real life** (illness, holidays, hard days) · **tie
self-ratings to rewards** (§11).

**Threshold to change course (audit continuously):** if the child asks *"how many points?"* before
deciding to do a loved activity, or **stops** the activity when points are removed — that is
over-justification in action; **strip the reward from that activity immediately.**

**This subsumes the area-3 anti-gambling bright line** ([02-finance-and-value.md](02-finance-and-value.md)
§6: no variable-ratio / near-miss / loot-box / loss-disguised-as-win). Neither manufactured compulsion
nor manufactured extrinsic drive — one rule, repo-wide.

## 8. The transfer-honesty table (binding — what we may claim)

| Competency | Best game→real-life evidence | Confidence | Treat the game as… |
|---|---|---|---|
| Logic/math (scorable drills) | Near-transfer to similar problems real; "general reasoning" far-transfer ≈0 | zeker | Skill-builder (near) + scaffold (far) |
| Probability calibration | Can improve with feedback (forecasting tournaments) but needs many trials; can over/under-correct | waarschijnlijk | Skill-builder, real (the promising one) |
| Finance | ~0.1% behaviour variance, decays ~20mo (Fernandes); ~0.10 SD behaviour / 0.20 knowledge (Kaiser) | zeker (small) | Scaffold; **graduate to real money fast** |
| Communication / NVC | No large RCT, no meta-analytic d; tiny positive studies | laag/onbekend | Scaffold + motivation only |
| Work / agency | No game-to-life evidence; project skills are domain-specific | laag | Scaffold around **real** projects |
| Inner work (IFS) | No transfer evidence in this context | laag | Scaffold + reflection only |
| Creativity / making | No far-transfer; creativity is domain-specific | zeker (no far) | Scaffold + **real** making |
| Ethics | No game-to-life evidence; ill-structured domain | laag | Scaffold + **real** dilemmas |
| Health / attention | EF near-transfer real; far-transfer to "life attention" ≈0 | zeker | Skill-builder (near) only |
| Perception (area 10) | Discrimination trainable but **narrow/stimulus-specific**; "general observation" ≈0 | zeker | Skill-builder (specific) + habit/value (general) |
| SEL (broad) | Durlak skills g=0.57 / behaviour 0.24; fades to 0.14–0.17 (Taylor) | zeker (attenuated) | **Strongest** real-transfer case |

**The default sentence for the whole project: "scaffold, don't claim transfer."** The burden of proof
is on transfer, and for most areas it isn't met.

## 9. The "measure without harming" charter (quote into PLAN §8)

**Bright lines never to cross:**
1. **Never assign a number or grade to who he is** — especially ethics, inner work, relationships.
   Track *the difficulty to present next*, not *the worth of the child*.
2. **Never display a competence "level" as a verdict.** An internal difficulty state may exist; it is
   never shown as a rating of him.
3. **No labels.** Describe *actions* ("you made a clear request"), never *traits* ("you're a good
   communicator" / "bad at feelings"). The Pygmalion literature shows even positive labels foreclose
   identity.
4. **Local-only, private by default.** No server, no sharing, no profile outliving the session without
   consent.
5. **Formative not summative.** All measurement exists to adapt difficulty and resurface practice —
   never to judge, rank, or report.
6. **Decouple self-rating from reward** so honesty isn't punished or gamed.
7. **The child can see and delete his own data.** The subject controls the record.
8. **Inner work and ethics are observed, never scored.** At most "did he engage?" yes/no, used only to
   decide whether to resurface — never a quality rating.

This is the schema-level enforcement of the tov hard line and of areas 4 (§9) and 5 (no morality score).

## 10. Adaptive difficulty for un-scorable skills (robust vs gameable)

- **Robust:** **complexity ladders** (the task objectively gets structurally harder — more parts, more
  ambiguity, longer horizon) and **rubric rungs** with observable "did X happen" gates. These don't
  depend on the child's honesty.
- **Semi-robust:** **parent input** (rater bias, but a second observer reduces single-rater anchoring).
- **Weak/gameable:** **child self-rating**, *especially if tied to rewards* — children systematically
  overestimate (Xia 2024) and will rate to get the reward.
- **Rule:** adapt difficulty primarily off **objective complexity-completion + evidence presence**; use
  self-rating only as a *non-rewarded* reflection signal; **keep DDA simple** — performance/complexity-
  based beats fancy physiological/emotion inference (which doesn't reliably beat it in studies).

## 11. Graduation decision framework (feeds PLAN §7.4, every area)

**Readiness — graduate an area to real stakes when ≥3 hold:** (1) Rung 3 reached (independent
unprompted in-sim); (2) stable across ≥2 different sim contexts (transfer-appropriate-processing guard);
(3) learner *wants* to "do it for real"; (4) a low-risk real opportunity exists (recoverable stakes);
(5) the parent can debrief *without grading*.

**Sim→real playbook:** replace the simulated instrument with the **real** one at the *earliest
defensible point* (transfer-appropriate processing says the sim won't transfer itself — a skill
practised only in-game is retrievable mostly in-game) · keep **fading scaffolds** (parent models once,
coaches, withdraws; the game becomes a *reflection/logging* surface, not the doing surface) · **debrief
every real attempt** as a Rung-4 evidence record, never a score · **watch the dependency trap** — if
real-world performance only happens with the game open, scaffolding hasn't faded → force graduation.

## 12. AI-simulation architecture & child safety (PLAN §4b made rigorous)

The open-ended capacities need *true reactions* — an LLM-driven character/coach that responds to what
Alvah actually said/did/made, not a scripted tree. **One engine, reused everywhere** (persona +
situation + rubric = data, not code). Three decisions:

**(a) Local vs cloud vs parent-mediated — tier by data sensitivity (the §7.6 ruling this supports):**

| Sensitivity | Example | Shape |
|---|---|---|
| **Highest — Alvah's own psyche** | Inner work; any reflection on his feelings | **On-device or parent-mediated ONLY. Never to the cloud, any shape.** Non-negotiable. |
| **Lower — roleplay not about his psyche** | Farmer negotiation, maker critique, a dilemma character | Cloud Claude acceptable **only on Floris's explicit opt-in**, with no transcript retention beyond device, no names, child-safety rails. Try on-device first where quality allows. |

On-device LLM quality (WebLLM/WebGPU) is **lower but improving fast** — keep the integration **swappable**
(provider-agnostic seam) so on-device takes over as small models improve. If cloud, use the latest Claude
models.

**(b) Child-safety rails — mandatory in the *engine*, not the scenario data:** stay in role ·
age-appropriate · never frightening (the [../../../research/veluwe-research.md](../../../research/veluwe-research.md)
safety chart applies) · never give advice that should come from a parent/professional · **hand off
gracefully when a topic gets too real** (the same "people-thing, not a game-thing" boundary as
[04-inner-work-communication-regulation.md](04-inner-work-communication-regulation.md) §8). Guard against
parasocial over-attachment.

**(c) AI as evaluator — the bright line:** an LLM may produce a *formative, private* signal feeding a
Model-B mastery rung — **never a number that rates who Alvah is.** An AI grading a child's emotional
expression or moral reasoning is exactly the line we do not cross (§9; areas 4 & 5). AI informs Model B;
it never scores the child.

## 13. Honesty lines — what we must NOT claim or do

- **Far-transfer ≈ 0 when corrected** (Sala & Gobet). The single most over-promised claim. "Practise in
  the game → generally better at X in life" is unsupported for the macro-competencies. Say "scaffold."
- **Single-rater problem is unsolved by design.** Portfolio validity needs multiple trained raters; one
  parent cannot reach research-grade reliability (raters anchor and confirm early; ~78% of variance can
  come from the rubric). **Accept Model B as *formative only* — never treat its "levels" as measurement.**
- **Spacing-for-skills is genuinely under-evidenced** — §6 is a reasoned guess, not a proven schedule.
- **Gamification durability is weaker than marketed** — biggest effects in studies ≤1 week (novelty); a
  2026 review flags an "immersion threshold" and burnout. Streaks need forgiveness mechanics to not harm.
- **Bloom's 2-sigma is a myth**; **deliberate practice is oversold** (4% of variance in education, <1% in
  professions); **calibration training is mixed** (can over-correct into under-confidence).
- **n=1 means no statistics.** None of the cited effect sizes apply to one child — they say where transfer
  is *plausible*, not what will happen for Alvah. Treat all of it as design priors, not predictions.

## 14. Accessibility (architecture-level)

Keep the scorable **Model-A tasks low-text / audio-first** (several validated assessment tools, e.g.
GraSEF, were built to work even with low reading skill — exactly this design target). The dyslexia line
is the same across every area and lives at the architecture level: ≥56px targets, dual-channel feedback,
reduced-motion, TTS on everything, spoken/drawn/built responses accepted, never gate a skill behind
reading load. (Each area doc restates the area-specific a11y; this is the shared floor.)

## 15. Sources we can legally adapt (clean-room — rewrite, never lift)

- **Open standard / openly licensed (clean-room friendly):** **Open Badges 3.0 (1EdTech)** — open
  JSON-LD standard; safe to adopt the *data schema* for evidence records (the §4 shape derives from it).
  **CASEL SEL competency framework** — widely reproduced structure (check licence before verbatim).
  **Chen et al. 2021** (spacing/interleaving systematic review, *Educational Psychology Review*, CC-BY)
  and **Sala & Gobet 2019** (*Collabra: Psychology*, open access) — paraphrase with attribution. ERIC
  full-text PDFs (spiral-curriculum reviews) — US-gov-hosted, generally freely reusable.
- **Reference / evidence only (copyrighted — ideas + figures, not text):** Bruner 1960 (spiral);
  Nickow/Oreopoulos/Quan 2020 (tutoring 0.37 SD); Deci/Koestner/Ryan 1999 (over-justification);
  Macnamara/Hambrick/Oswald 2014 (deliberate practice); Fernandes 2014 vs Kaiser 2022 (finance transfer
  dispute); Durlak 2011 + Taylor 2017 (SEL transfer + decay); Xia 2024 (children's self-assessment
  inflation); Cepeda et al. (spacing); Collins/Brown/Newman 1989 (cognitive apprenticeship); Rosenthal
  & Jacobson 1968 (Pygmalion/labelling); Duolingo habit/streak data (company blog — cite, don't lift).

## 16. Open decisions / to confirm (ties to PLAN §7)

- **§7.5 tracking namespace:** confirm `alvah-life-v1` as a *separate* store (recommended; the §4 shape
  is the first cut). This brief formalises it — areas 3–5 and 7 all wrote "brief 6 formalises this."
- **§7.6 AI-simulation privacy (the big one):** the §12 sensitivity-tiering is the recommendation —
  inner work never to the cloud; lower-sensitivity roleplay cloud-acceptable on opt-in + rails. This is
  the only decision touching a *founding* site rule (client-side only, CLAUDE.md rule 2); Floris's alone.
- **§7.4 graduation:** the §11 framework gives the *signals*; the *when* stays per-area. Finance graduates
  fast (transfer evidence + real-money lever); inner work/ethics may never "graduate" in the same sense.
- **Quote the §9 charter into PLAN §8** and **encode §3/§4/§9 into the engine** before any area ships —
  the bright lines must live in the schema, not the guidelines.
- **Confirm the motivation rulebook (§7) is binding repo-wide** — it bounds every area's reward design
  and merges with area-4 §7 as one constitution.
