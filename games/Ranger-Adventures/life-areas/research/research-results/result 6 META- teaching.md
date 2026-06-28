# Pedagogy & Measurement Architecture for a Long-Horizon (7→21) Single-Learner Educational Game

## TL;DR
- **Run two tracking models, not one.** Use a psychometric staircase (Model A) ONLY for the ~3 skills with a clean correctness signal (logic drills, mental math, probability calibration); use a private mastery/portfolio + spaced-rehearsal model (Model B) for everything open-ended (work, communication, inner work, creativity, ethics). The decision rule is: *Is there a defensible right answer and a fast, repeatable response?* If no, never assign a number to the child.
- **Be brutally honest about transfer (zeker):** far-transfer from any trained task to real-life competence is, when corrected for placebo and publication bias, statistically indistinguishable from zero (Sala & Gobet 2019: unbiased overall g̅ = 0.00 across 233 studies — "the lack of generalization of skills acquired by training is thus an invariant of human cognition"). For the macro-competencies the game should be treated as **scaffolding and motivation around real-world practice, not as the thing that builds the skill.** The only areas with credible (still small) transfer to real behaviour are domain-matched: financial *behaviour* ≈0.10 SD, SEL behaviour ≈0.14–0.24 SD fading over time.
- **Gamification is a real burnout risk for a decade-long single-player game.** The over-justification effect is real but bounded: tangible, expected, engagement-contingent rewards layered on an already-loved activity are the danger zone (Deci, Koestner & Ryan 1999: engagement-contingent rewards d = −0.40). Use informational/competence feedback (which *enhances* motivation, d = 0.33), make rewards unexpected or absent, and never gate an intrinsically interesting activity behind points. Streaks drive retention but manufacture anxiety and punish life — use gentle, forgiving variants only.

## Key Findings

### Q1 — Spiral curriculum & long-horizon design
- **Spiral curriculum (Bruner, 1960) is theoretically dominant but empirically thin (waarschijnlijk).** Multiple reviews note "no clear empirical evidence of the overall effects of the spiral curriculum on student learning" (Johnston 2012). It is hard to test because it is entangled with the constructivist delivery around it. It works best in *well-structured* domains (math, logic) and fits *ill-structured* domains (ethics, history, literary judgement) poorly — a network/web model suits those better (Efland; Ireland & Mouthaan 2020).
- **Mastery learning has stronger evidence than the spiral (zeker that it has a positive effect; the size is contested).** Bloom's "2-sigma" is largely a myth — the original figure came from two of Bloom's own students' dissertations, and the best modern meta-analyses put mastery learning alone at roughly d≈0.5, and tutoring at **0.37 SD** (Nickow, Oreopoulos & Quan 2020, NBER WP 27476 — "an overall pooled effect size estimate of 0.37 SD," ≈14 percentile points; **none of the 96 tutoring studies reviewed produced a two-sigma effect**). So: spiral for the *shape* of the decade; mastery rungs for *gating progress*.
- **What sustains a learner across years:** Duolingo is the canonical case — its retention engine is streaks, XP, leagues. Duolingo's own habit research found **"learners who reach a seven-day streak are 3.6 times more likely to complete their course than those who don't"** (an earlier stated figure was 2.4× more likely to continue the next day). But note: Duolingo's own PM concedes retention is the goal *because without return there is no learning* — i.e., the gamification sustains exposure, it does not itself teach. This is the key lesson and the key trap.

### Q2 — The two-track tracking question (core)
- **Portfolio/competency-based assessment can be valid and reliable, but only with heavy scaffolding (waarschijnlijk).** Medical-education portfolios reach usable reliability (phi≈0.86 in one dental study) ONLY with multiple subscales, several raters, trained assessors, and a strong rubric. With one rater (the parent) precision is "modest" at best. The dominant error source is the rubric itself (one study: 78% of variance came from the rubric, not the student).
- **Assessors anchor and confirm (zeker):** in competency portfolios, raters reached a judgement early and then "stuck to their initial judgments even when confronted with seemingly disconfirming evidence." A single-parent rater is structurally vulnerable to this.
- **Open Badges is a mature standard** (1EdTech Open Badges 3.0; JSON-LD, issuer/criteria/evidence/alignment metadata). Useful as a *data shape* for "evidence of demonstration," not as a motivator. Risk: badges become the goal ("badges as game elements" — SURF whitepaper) and corrode intrinsic interest.

### Q3 — Spaced repetition / rehearsal for SKILLS not facts
- **The spacing effect is rock-solid for declarative knowledge (zeker)** and expanding intervals beat fixed intervals (Cepeda et al. meta-analysis). **BUT the evidence does NOT cleanly extend to procedural/skill learning.** One direct comparison found students "might only benefit from spaced learning when learning conceptual knowledge but not when learning procedural knowledge." For motor/procedural skills the picture is mixed.
- **Spacing and interleaving are mechanistically different (waarschijnlijk):** spacing = recovery from working-memory depletion; interleaving = discrimination between confusable categories (Chen et al. 2021 systematic review). Interleaving can *hurt* low-achievers in early learning who need initial blocked practice first.
- **Deliberate practice is real but oversold (zeker it's overstated):** Macnamara, Hambrick & Oswald (2014, *Psychological Science*) found deliberate practice "explained 26% of the variance in performance for games, 21% for music, 18% for sports, 4% for education, and less than 1% for professions" — far from Ericsson's "largely accounted for" claim. Critically, *individualised* feedback matters more than raw repetition.

### Q4 — Motivation that lasts a decade (be blunt)
- **The over-justification effect is real but conditional, and the field overclaims (zeker).** Deci, Koestner & Ryan's 1999 meta-analysis (128 studies, *Psychological Bulletin*) found "engagement-contingent, completion-contingent, and performance-contingent rewards significantly undermined free-choice intrinsic motivation (d = −0.40, −0.36, and −0.28, respectively)," *strongest for expected, tangible, engagement-contingent rewards on already-interesting tasks*. By contrast, positive feedback *enhanced* free-choice behaviour (d = 0.33) and self-reported interest (d = 0.31). The effect does NOT apply to: unexpected rewards, verbal praise/informational feedback, or boring tasks (where rewards help). Cameron & Pierce and others dispute the breadth; the honest position is the four-dial model (reward type, expectancy, contingency, baseline interest).
- **Gamification's long-term evidence is weaker than marketing suggests (waarschijnlijk).** Meta-analyses are mixed: some find effects persist or even grow over >6 months for motivation; others find the biggest effects in interventions of a week or less, implying novelty. A 2026 review explicitly flags an "immersion threshold" and links sustained high-intensity gamification to "motivational decline and burnout."
- **Streaks are powerful and double-edged:** they drive habit and retention but manufacture loss-aversion anxiety; per Duolingo retention data, "the introduction of the 'Streak Freeze' feature reduced churn by 21% for users at risk of breaking their streak," and using a Streak Freeze "lifts long-term retention by 10%" — i.e., they had to build forgiveness mechanics *specifically* to counter the harm of streak-breaking.

### Q5 — Transfer: the honest reckoning
- **Far-transfer is essentially zero when corrected (zeker).** Sala & Gobet's second-order meta-analysis (Model 3, k=233 across working-memory, video-game, music, chess, exergame training): near-transfer is real; "when placebo effects and publication bias were controlled for, the overall effect size and true variance equaled zero" (unbiased overall g̅ = 0.00). "The lack of generalization of skills acquired by training is thus an invariant of human cognition." Even *metacognitive-strategy* far-transfer was tiny and failed to replicate (Schuster 2020/2023).
- **Per-competency honest assessment:**
  - *Logic/math, calibration:* near-transfer to similar problems is real (zeker); far-transfer to "rationality in life" unproven.
  - *Finance:* Fernandes, Lynch & Netemeyer (2014, *Management Science*) — financial education explains ~0.1% of variance in financial behaviour and decays to negligible by ~20 months. Kaiser, Lusardi, Menkhoff & Urban (2022, *J. Financial Economics*) — larger: ~0.10 SD on behaviour, ~0.20 SD on knowledge, "at least three times as large" as Fernandes. Knowledge transfers better than behaviour. Net: small, real, decay-prone.
  - *Communication / NVC:* no large RCT, no meta-analytic effect size; positive signals from tiny/uncontrolled studies (Juncadella 2013 review; small RCTs with ≤2-month follow-up). Durability unproven.
  - *SEL broadly:* Durlak et al. 2011 (213 school-based universal programs, 270,034 K–12 students) — skills g=0.57, behaviour ~0.24 at post, with gains "that reflected an 11-percentile-point gain in achievement"; Taylor et al. 2017 follow-up — fades to behaviour ~0.14–0.17, academic ~0.32, still significant years out. This is the *strongest* case for durable (if attenuated) transfer.
  - *Creativity, ethics, inner work:* treat as scaffolding only — no credible game-to-life transfer evidence.

### Q6 — The graduation question
- **Scaffolding + fading is the right frame (zeker as a model, though "scaffolding" itself is loosely evidenced).** Cognitive apprenticeship (Collins, Brown & Newman 1989): model → coach → scaffold → fade, situated in authentic tasks. ZPD (Vygotsky) defines the moving target. Key failure mode: scaffolding that never fades produces dependency — a "Zone of No Development."
- **Transfer-appropriate processing (zeker):** memory/skill is best expressed when retrieval conditions match encoding conditions. Implication: a competency practised only in-game will be retrievable mostly in-game. To get real-world performance you must practise in real-world-shaped conditions — the argument FOR graduating to the real instrument.

### Q7 — Measuring without harming
- **Labelling is a documented risk (zeker the mechanism, waarschijnlijk the magnitude):** the Pygmalion/self-fulfilling-prophecy literature (Rosenthal & Jacobson 1968 onward) shows internalised labels — even positive ones — can foreclose identity. Reducing a child to a score for ethics/relationships/inner work risks exactly this.
- **SEL measurement is contested (zeker):** constructs are operationalised inconsistently, instruments are culturally loaded (Anglo-normative "optimal behaviour"), and identifiable data risks self-presentation gaming. Datafication-of-childhood critiques warn about converting a child's social actions into quantifiable, stored, surveilled data.
- **Children's self-assessment is systematically inflated and develops slowly (zeker):** a 2024 meta-analysis (Xia et al., *Child Development*) confirms children overestimate performance, decreasing with age; younger children's self-ratings are unreliable. Feedback alone often fails to correct kindergarteners' overconfidence.

### Q8 — Difficulty adaptation for un-scorable skills
- **You cannot run a clean staircase without a clean score (zeker).** Options for un-scorable skills: learner self-rating (unreliable in young children), parent input (rater bias), complexity ladders (robust), mastery rubrics (robust if well-built).
- **DDA + flow theory:** dynamic difficulty adjustment aims to keep the learner in the flow channel (challenge≈skill). But physiological/emotion-based DDA does NOT reliably beat simple performance-based adjustment in controlled studies — keep it simple.
- **Robust vs gameable:** complexity ladders and "show-the-work" evidence are hard to game; self-rating tied to rewards is trivially gamed by a child who wants the reward. Decouple any self-rating from rewards.

## Details / Required Outputs

### OUTPUT 1 — Recommended dual-track tracking architecture
**Decision rule (apply per skill):**
1. Is there a defensible correct answer? → if NO → Model B.
2. Can the learner produce many fast, independent responses? → if NO → Model B.
3. Does scoring require human judgement of context/meaning? → if YES → Model B.
4. Only if 1–2 = YES and 3 = NO → **Model A (psychometric staircase).**

Expected split: **Model A** = logic drills, mental math, probability calibration (and the existing EF mini-games). **Model B** = work/agency, communication, inner work (IFS), creativity/making, ethics, most of health/attention, and the *judgement* layers of finance and epistemics.

**Model B "evidence-of-demonstration" record (data shape, Open-Badges-aligned):**
```
{
  "evidence_id": uuid,
  "competency": "communication.request",
  "spiral_rung": 3,                      // see Output 2
  "date": ISO-8601,
  "context": "real" | "sim" | "hybrid",
  "artifact": { "type": "audio|text|photo|video|note", "ref": local_uri },
  "prompt": "what was attempted",
  "self_rating": { "scale": "emoji-3", "value": 2, "reward_linked": false },
  "parent_note": "freeform, optional, never a score",
  "rubric_dimensions": [                 // descriptive, not numeric
     { "dim": "made a clear ask", "observed": true },
     { "dim": "named a feeling/need", "observed": "partial" }
  ],
  "next_resurface_due": ISO-8601,        // from Output 3
  "private": true                        // never leaves device
}
```
Principle: store **descriptive observations and artifacts**, not aggregate scores. The "level" is the highest rung with sufficient recent evidence — computed, never displayed as a rating of the child.

### OUTPUT 2 — Spiral-design template (reusable for any of the 9 areas)
For each area define **5 rungs** crossing Bruner's three representations (enactive → iconic → symbolic) with mastery gating:
- **Rung 0 (age ~7, enactive):** do it once, concretely, with the parent, no abstraction. Gate: did it happen?
- **Rung 1 (iconic):** recognise/sort examples; name the move. Gate: reliable recognition.
- **Rung 2 (guided production):** perform with scaffolding/prompts. Gate: ≥3 demonstrations across ≥2 contexts.
- **Rung 3 (independent sim):** perform unprompted in-game. Gate: demonstrations without scaffolding.
- **Rung 4 (real-stakes / graduation):** perform in the real world, debriefed (see Output 6). Gate: real-world artifact + reflection.

Rules: each rung names the *same core idea* at higher complexity; never skip rungs to chase a reward; revisit lower rungs on a spaced schedule (Output 3). For ill-structured areas (ethics, inner work) replace strict rungs with a *network* of revisitable themes — do not force a linear ladder.

### OUTPUT 3 — Spaced-rehearsal scheduling model (for skills/practices)
Because spacing evidence is strong for *concepts* but weak for *procedures*, treat resurfacing as **"keep it warm + vary the context,"** not as memory optimisation.
- **Concept/declarative layer of a skill** (e.g., "what is an NVC request"): expanding intervals — 1d, 3d, 9d, 3w, 8w, then quarterly.
- **Procedural/practice layer** (e.g., "actually make a request"): trigger-based, not interval-based. Resurface when (a) a real-life opportunity is flagged by parent/learner, (b) the rung has had no evidence in N weeks (decay guard), or (c) interleave with a *related* practice to force discrimination.
- **Interleave** related practices (plan-a-project ↔ break-down-a-task) rather than massing one; but give *blocked* practice first for a brand-new skill (low-achiever caveat).
- Default decay-guard windows by rung: Rung 1 ~2 weeks, Rung 2 ~4 weeks, Rung 3 ~8 weeks, Rung 4 ~quarterly.

### OUTPUT 4 — Motivation-design rulebook (grounded in over-justification evidence)
**DO:**
- Use **informational/competence feedback** ("that was a hard one and you found the structure") — this *enhances* intrinsic motivation (positive feedback d = 0.33 free-choice, 0.31 interest; Deci et al. 1999).
- Make rewards **unexpected** (surprise unlocks) rather than announced-in-advance contingencies.
- Reward **effort/strategy/completion of hard things**, not engagement with things he already loves.
- Support **autonomy** (genuine choice of what/when), **competence** (right difficulty), **relatedness** (parent presence) — the SDT triad.
- Use **forgiving streaks** (streak-freeze, weekly not daily targets) if streaks are used at all.

**DON'T:**
- Don't put points/badges on an activity he already does for its own sake (creativity, inner work especially).
- Don't make rewards **expected + tangible + contingent on engagement** — the documented undermining zone (d = −0.40).
- Don't use leaderboards/competitive ranking for a single private learner — manufactures anxiety, no relatedness benefit.
- Don't let streak-loss punish real life (illness, holidays, hard days).
- Don't tie self-ratings to rewards (Output 8).

**Threshold to change course:** if the child starts asking "how many points" before deciding whether to do a loved activity, or stops the activity when points are removed — that is over-justification in action; strip the reward from that activity immediately.

### OUTPUT 5 — Transfer honesty table
| Competency | Best evidence game-practice → real life | Confidence | Treat game as… |
|---|---|---|---|
| Logic/math (scorable drills) | Near-transfer to similar problems real; "general reasoning" far-transfer ≈0 | zeker | Skill-builder (near) + scaffold (far) |
| Probability calibration | Calibration *can* improve with performance feedback (forecasting tournaments; Shell geologists), but needs many trials and can over/under-correct | waarschijnlijk | Skill-builder, real |
| Finance | ~0.1% behaviour variance, decays ~20mo (Fernandes 2014); ~0.10 SD behaviour / 0.20 SD knowledge (Kaiser 2022) | zeker (small) | Scaffold; graduate to real money fast |
| Communication/NVC | No large RCT, no meta-analytic d; tiny positive studies | onbekend/low | Scaffold + motivation only |
| Work/agency | No game-to-life transfer evidence; project skills are domain-specific | low | Scaffold around real projects |
| Inner work (IFS) | No transfer evidence in this context | low | Scaffold + reflection only |
| Creativity/making | No far-transfer; creativity is domain-specific | zeker (no far) | Scaffold + real making |
| Ethics | No game-to-life transfer evidence; ill-structured domain | low | Scaffold + real dilemmas |
| Health/attention | EF near-transfer real; far-transfer to "life attention" ≈0 | zeker | Skill-builder (near) only |
| SEL (broad) | Durlak 2011 skills g=0.57 / behaviour 0.24; fades to 0.14–0.17 at follow-up (Taylor 2017) | zeker (attenuated) | Strongest real-transfer case |

### OUTPUT 6 — Graduation decision framework + sim→real playbook
**Readiness signals (graduate an area to real stakes when ≥3 hold):**
1. Rung 3 reached (independent unprompted performance in-sim).
2. Stable across ≥2 different sim contexts (transfer-appropriate-processing guard).
3. Learner expresses wanting to "do it for real."
4. A low-risk real opportunity exists (real but recoverable stakes).
5. Parent can debrief without grading.

**Sim→real hand-off playbook:**
- Replace the simulated instrument with the **real instrument** (real small budget, real project board, real conversation) at the *earliest defensible point* — TAP says the sim won't transfer itself.
- Keep **fading scaffolds**: parent models once, coaches, then withdraws; the game becomes a *reflection/logging* surface, not the doing surface.
- Debrief every real attempt: what happened, what you'd change — store as a Rung-4 evidence record, never as a score.
- Watch for the dependency trap: if real-world performance only happens with the game open, scaffolding hasn't faded.

### OUTPUT 7 — "Measure without harming" charter
**Bright lines never to cross:**
1. **Never assign a number or grade to who he is** — especially ethics, inner work, relationships. Track *the difficulty the system should present next*, not *the worth of the child*.
2. **Never display a competence "level" as a verdict.** Internal difficulty state may exist; it is never shown as a rating of him.
3. **No labels.** Describe actions ("you made a clear request"), never traits ("you're a good communicator" / "bad at feelings").
4. **Local-only, private by default.** No server, no sharing, no profile that outlives the session without consent.
5. **Formative not summative.** All measurement exists to adapt difficulty and resurface practice — never to judge, rank, or report.
6. **Decouple self-rating from reward** so honesty isn't punished or gamed.
7. **The child can see and delete his own data.** Datafication critique demands the subject controls the record.
8. **Inner work and ethics are observed, never scored.** At most: "did he engage?" yes/no, used only to decide whether to resurface — never a quality rating.

### OUTPUT 8 — Adaptive difficulty for un-scorable skills (robust vs gameable)
- **Robust:** *complexity ladders* (the task objectively gets structurally harder — more parts, more ambiguity, longer horizon) and *rubric rungs* with observable "did X happen" gates. These don't depend on the child's honesty.
- **Semi-robust:** *parent input* (bias, but a second observer reduces single-rater anchoring).
- **Weak/gameable:** *child self-rating*, especially if tied to rewards — children systematically overestimate (Xia et al. 2024 meta-analysis) and will rate to get the reward.
- **Rule:** adapt difficulty primarily off *objective complexity completion* and *evidence presence*, use self-rating only as a *non-rewarded reflection signal*, and keep DDA simple (performance/complexity-based beats fancy physiological inference).

## Recommendations (staged)
1. **Now (age 8):** Keep Model A only for the genuinely scorable skills. Build Model B as a private evidence-log (Output 1 data shape). Default to enactive Rung 0–1 across the nine areas with the parent present. Use zero tangible expected rewards on loved activities.
2. **Trigger to expand Model B rigor:** once you have ~10 evidence records in an area, introduce its 5-rung spiral (Output 2) and decay-guard resurfacing (Output 3).
3. **Trigger to graduate an area:** when the Output-6 readiness signals fire (esp. Rung 3 + cross-context), swap in the real instrument and demote the game to reflection/logging.
4. **Continuous:** audit for over-justification (Output 4 threshold) and for any drift toward scoring-the-child (Output 7 bright lines).
5. **Re-evaluate yearly:** as the child's metacognition matures (self-assessment accuracy rises with age), you can weight his self-ratings slightly more — but never tie them to rewards.

**Benchmarks that change the plan:** if a domain shows the child performing in real life only with the game open → fading has failed, force graduation. If he games a self-rating → decouple it from any reward immediately. If he asks "how many points" before a loved activity → strip rewards from it.

## Caveats & open gaps
- **Single-rater problem is unsolved by design.** Portfolio validity depends on multiple trained raters; one parent cannot reach research-grade reliability. Accept Model B as *formative only* — never treat its "levels" as measurement.
- **Spacing for skills is genuinely under-evidenced.** The resurfacing model is a reasoned extrapolation, not a proven schedule. Treat intervals as starting guesses to tune by observation.
- **Transfer pessimism may be too strong for some areas, but the burden of proof is on transfer.** The honest default is "scaffold, don't claim transfer." Note one nuance: the Fernandes (2014) vs. Kaiser (2022) finance dispute is partly methodological — Fernandes reports % variance and emphasises decay; Kaiser reports SD units and calls the same-sized effects "economically meaningful." Both are right that behaviour effects are *small* (~0.10 SD) and that knowledge transfers better than behaviour.
- **Calibration training evidence is mixed:** it can over-correct into under-confidence, and one 2025 study found a scoring-rule feedback method did *not* improve calibration. Treat calibration as the one *promising* epistemics skill, not a sure thing.
- **Dyslexia note:** keep the scorable Model-A tasks low-text/audio-first; several cited assessment tools (e.g., GraSEF) were validated to work even with low reading skills, which is the design target here.
- **n=1 means no statistics.** None of the effect sizes cited apply to one child; they tell you where transfer is *plausible*, not what will happen for your son.

## Open-licensed / CC0 material for clean-room content rewrite
- **Open Badges 3.0 specification (1EdTech)** — open standard, JSON-LD; safe to adopt the *data schema* for evidence records.
- **CASEL SEL competency framework** — widely reproduced; useful as a structure (check licensing before verbatim copy).
- Several cited meta-analyses are **open-access / CC-BY** — e.g., Chen et al. 2021 (spacing/interleaving systematic review, *Educational Psychology Review*, CC-BY) and Sala & Gobet 2019 (*Collabra: Psychology*, open access) — usable for paraphrase with attribution.
- ERIC full-text PDFs (spiral curriculum reviews) are US-government-hosted and generally freely reusable.

---
*Confidence legend: **zeker** = well-established/robust evidence; **waarschijnlijk** = probable/likely but contested or thin; **low/onbekend** = little or no credible evidence. The two areas where the field most overclaims — far-transfer (Q5) and gamification durability (Q4) — are flagged most aggressively, per your instruction to prefer the truth over reassurance.*