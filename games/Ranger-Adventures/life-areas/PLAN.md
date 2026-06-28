# Life Areas — the long expansion plan (7 → 21)

> **What this is.** The master plan for growing *Ranger van de Veluwe* from a five-engine
> executive-function game into a long-horizon **life-skills** game Alvah can keep playing as he
> grows. It records the thesis, the ten areas, how each one deepens with age, how we track it
> without reducing him to a number, and which deep-research we still need. Read this after
> [../GAMEPLAN.md](../GAMEPLAN.md). The research briefs live in [research/](research/).
>
> **Status:** plan draft, June 2026. Nothing here is built yet. Several decisions are still
> Floris's to make — they are flagged **[needs veto]** and collected in §7.

---

## 1. The thesis (why this exists)

The executive-function game trains **micro-skills**: fast, automatic, lab-measurable abilities
(working memory, inhibition, flexibility). Useful, but they are the floor, not the building.

What Floris actually wants to grow is the set of capacities that **compound over a lifetime and
stay valuable in an era where AI does a lot of the easy cognitive work**. The bet is that as
generation gets cheap, the scarce and human things become *more* valuable, not less:

- **Agency** — deciding what is worth doing at all.
- **Judgment / taste** — telling good from bad, including good-from-bad AI output.
- **Epistemics** — knowing how you know, and how sure you should be.
- **Relating** — understanding yourself and other people.
- **Learning to learn** — getting better at getting better.

These are not subjects you finish. They are skills you can start at any age and keep practising,
with difficulty that grows with skill — exactly the shape the EF staircase already has, but
applied to much bigger, slower, more human competencies.

So the plan is **not** "add five more mini-games." It is: pick the life areas that matter most,
gather a vetted framework base for each (the way we did for EF), and grow each area as a **spiral**
the game can keep widening for a decade.

---

## 2. The ten areas

Kept as separate areas (Floris's call), expanded past the original five with the additions that
survived the critique. Three of them — **Work, Communication, Internal work** — share one spine in
Floris's own world (the Holacracy/IFS *tension loop*: notice → articulate → act). They stay
separate areas, but their **research is grouped** because they share a literature (see §6).

| # | Area | One line | Kind | AI-era reason it matters |
|---|---|---|---|---|
| 1 | **Logic & math** | Reasoning that is *valid*, not just confident | Subject | The machine is fluent and often wrong; structure beats fluency |
| 2 | **Epistemics** | How do you know it is true, and how sure are you | Capacity | The defining skill against confident nonsense, deepfakes, persuasion |
| 3 | **Finance & value** | Budgets, compounding, risk, expected value | Subject | Compounding and delayed gratification are leverage AI does not grant you |
| 4 | **Work & agency** | Define a project, set a target, finish it | Capacity | Deciding *what* to do is the part that stays human |
| 5 | **Communication** | Say the true thing without a fight | Capacity | The bottleneck on every collaboration, human or machine |
| 6 | **Internal work** | Know your parts; lead them (IFS) | Capacity | Regulation and self-knowledge are irreducible and untrainable by proxy |
| 7 | **Creativity & making** | Have an idea worth having, and build it | Capacity | When output is cheap, original intent and taste are the scarce goods |
| 8 | **Ethics** | What is worth doing, and what you owe others | Capacity | Agency without a values keel is just optimisation |
| 9 | **Health & attention** | The body and focus everything else runs on | Substrate | Sleep, movement, and attention are the substrate EF and learning sit on |
| 10 | **Perception & the senses** | See, hear, feel at higher resolution — and notice you are | Capacity | Perception is irreducibly embodied; AI cannot perceive reality *for* you. Rich sensory contact is the ground for taste, observation, and presence |

> **Note on overlap.** Epistemics and Logic share the probability/critical-thinking spine. Finance
> reuses Logic's expected-value and probability. Health overlaps Internal work via interoception and
> nervous-system regulation. **Perception** overlaps both: its *interoceptive* strand (awareness of
> bodily sensation) links straight into Internal work's regulation, and high-resolution observation
> is the raw input to Epistemics (good seeing) and Creativity (taste). These overlaps are a feature:
> a concept learned once (e.g. "expected value", or "attend to one signal") is reused across areas,
> which is exactly how the game stays economical.

---

## 3. How an area grows 7 → 21 (the spiral model)

Every area is a **spiral curriculum** (Bruner): the *same* core idea is revisited at increasing
depth, never "done." We do not just turn up a difficulty number; we change what the skill *is* at
each rung. A worked example for one area, to make the shape concrete — the rest are sketched in §5.

**Finance & value, across the years:**

| Age band | Rung | What it actually is |
|---|---|---|
| 7–9 | Wants vs needs; saving toward a goal | Wait two weeks for the bigger reward; see the jar fill |
| 9–11 | A budget with trade-offs | A fixed reserve budget; spend on X means not on Y |
| 11–13 | Compounding, intuitively | Watch a small amount double; "interest on interest" felt, not formula'd |
| 13–15 | Risk & expected value | A bet with known odds; why the sure-thing isn't always best |
| 15–18 | Investing basics; inflation | Index vs single stock; why money sitting still shrinks |
| 18–21 | A real portfolio with real (or real-feeling) stakes | The game has dissolved into a real tool with a reflection layer |

The two universal mechanisms across all areas:

1. **Spiral, not staircase.** The concept recurs; the framing matures. A 7-year-old and a
   16-year-old can both meet "expected value," at radically different depth.
2. **Graduation ramp.** At some point the game *should stop being a game* for an area and become
   scaffolding around the real instrument (a real budget, a real project board, a real
   conversation he debriefs). **When** that happens is decided per area later (§7) — but the plan
   assumes it happens, so we never build a 21-year-old's finance lesson as a cartoon.

---

## 4. The two tracking models (side by side)

EF tracking is **psychometric**: adaptive staircase, reaction time, accuracy, summarised into
`alvah-ef-v1` ([../../../docs/practice-games-schema.md](../../../docs/practice-games-schema.md)).
That model is right for micro-skills and **wrong for most of these areas** — you cannot staircase
"communicated a need without blaming." So we run two models at once:

**Model A — Psychometric (keep for what fits).** Logic drills, mental-math fluency, probability
calibration, expected-value puzzles. These have clean right/wrong and reaction-time signals; they
plug straight into the existing staircase + `scoring.js`. Areas 1, 2 (partly), 3 (partly).

**Model B — Mastery / portfolio / spaced-rehearsal (new).** For the open-ended capacities (Work,
Communication, Internal work, Creativity, Ethics, most of Health). The signal is **evidence of
demonstration over time**, not a score:

- **Mastery rungs** — a skill is "shown" when Alvah demonstrates it in-world or in life, not when
  he answers fast. Rungs unlock; they do not average.
- **Portfolio** — artefacts pile up: a project he finished, a hard conversation he debriefed, a
  thing he made. The collection *is* the progress.
- **Spaced rehearsal** — capacities decay without use; the game resurfaces them on a spacing
  schedule rather than grinding them in one session.

**Hard line on Model B (from the tone-of-voice doc).** "Oordelen zijn voor het getal, niet voor het
kind." We never score *who Alvah is*. Internal work especially is tracked as *light, in-world,
private reflection* — never a dashboard, never a number that rates his feelings. See §8.

The schema gets a sibling namespace (proposed `alvah-life-v1`) so psychometric EF data and mastery
life-area data never get blended into a single misleading "score."

---

## 4b. AI-driven simulation — the "true reactions" layer (new pillar)

The open-ended capacities cannot be taught with scripted dialogue trees. A farmer who only says one
of three canned lines, an ethics dilemma reduced to three buttons, a maker-critique that is a lookup
table — none of these give the *true reaction* that makes practice real. To teach Communication,
Ethics, Internal work, and the feedback half of Work and Creativity, the game needs **generative
simulation**: an LLM-driven character or coach that responds to what Alvah *actually* said, did, or
made.

**This stays one engine, reused everywhere — so the architecture thesis holds.** A single
**simulation/dialogue engine** is built once; each scenario is *data*: a persona (the worried
farmer, the curious visitor), a situation, and a rubric for what good looks like. New scenario =
data record, not code — the same "data skin" logic as the five EF engines. It powers NVC practice
with a person who reacts (Communication), dilemmas that push back (Ethics), a coach that reflects
parts without leading (Internal work, most carefully), critique of a finished thing (Creativity,
Work), and dynamic "what if" situations (Logic, Finance).

**The privacy fork — this collides with our client-side rule and must be decided.** CLAUDE.md rule 2:
*"alle data blijft client-side; niets gaat naar een server."* True AI reactions, done the easy way,
send a child's words — including inner-work content — to someone's server. Three viable shapes:

| Shape | True-reaction quality | Privacy | Feasibility |
|---|---|---|---|
| **Cloud LLM** (latest Claude via API) | Highest | Data leaves device → breaks the client-side rule as written | API cost; needs no-retention / no-train / no-PII + safety rails |
| **On-device LLM** (WebLLM/WebGPU, small open model) | Lower, improving fast | Fully client-side; nothing leaves the iPad | Large model download; tablet performance unproven |
| **Parent-mediated** (AI helps Floris, who roleplays) | High, plus human warmth | No child↔server link | Needs Floris present; does not scale to solo play |

**Recommendation: tier by sensitivity, do not pick one shape for everything.**
- **Inner work, and anything about Alvah's own feelings → never to the cloud.** On-device or
  parent-mediated only. This is the tov hard line plus a child's most private data; not negotiable
  to a server.
- **Lower-sensitivity roleplay** (farmer negotiation, maker critique, a dilemma that is not about
  Alvah's own psyche) → cloud Claude acceptable *if* Floris opts in, with no transcript retention
  beyond the device, no names, and child-safety system rails. Try on-device first where quality allows.
- **Provider-agnostic seam.** If cloud, use the latest Claude models, but keep the integration
  swappable so on-device can take over as small models improve.

**Child-safety rails (mandatory in any shape).** A generative character talking to an 8-year-old
needs hard constraints baked into the *engine*, not the scenario data: stay in role,
age-appropriate, never frightening (the [../research/veluwe-research.md](../research/veluwe-research.md)
safety chart applies), never give advice that should come from a parent or professional, and hand
off gracefully when a topic gets too real (the same "never cross this line" boundary as brief 4).

**AI for tracking — careful.** It is tempting to let the model *score* a conversation or reflection.
Allowed only as a *formative, private* signal feeding Model B (mastery rungs) — never a number that
rates who Alvah is (§8). An AI grading a child's emotional expression is exactly the line we do not
cross.

---

## 5. The ten areas in detail

Each entry: **what it is · why (AI-era) · framework menu · diegetic fit · spiral rungs · tracking.**
Framework menus mark `✓` lean-toward, `✗` avoid, `?` **[needs veto]**. The diegetic tag answers
"mix per area." Graduation is "decide later" everywhere per §3.

### 1. Logic & math
- **What:** valid reasoning — and/or/not, if-then, cause vs correlation — plus number sense scaling
  into arithmetic, algebra, and beyond. Math is *part* of this, not the whole of it.
- **Why:** the machine is fluent and frequently wrong. The defence is structure: knowing when a
  conclusion actually follows.
- **Frameworks:** ✓ informal logic / argument mapping, ✓ computational thinking (decompose,
  pattern, abstract, algorithm — CS Unplugged style), ✓ number sense before procedure (Jo Boaler /
  concrete-pictorial-abstract). ? formal-logic notation, how early.
- **Diegetic:** **mix** — track-reading and "what explains these signs?" inference is in-world;
  pure math drills are a meta practice screen.
- **Spiral:** sorting/sequencing → if-then rules → simple proofs/"why must this be true" →
  probability → algebraic abstraction → formal argument.
- **Tracking:** Model A (drills, fluency, calibration).

### 2. Epistemics  *(new)*
- **What:** how you know a thing, how confident to be, how to update. Sources, evidence, base
  rates, "what would change my mind."
- **Why:** *the* AI-era skill. Confident nonsense is now free and infinite. Calibration and
  source-sense are the immune system.
- **Frameworks:** ✓ calibration / confidence ("how sure, 1–5?"), ✓ Bayesian-flavoured updating
  (intuitive, not formulae), ✓ steelmanning before disagreeing, ✓ spotting common fallacies. ✗
  "just trust the expert" framing; the point is to evaluate, not defer.
- **Diegetic:** **mix** — "is this track really a wolf's?" investigations in-world; explicit
  "how-sure-am-I" calibration as a light meta layer.
- **Spiral:** "how do you know?" as a habit → guessing with confidence → checking a source →
  noticing when a claim is too clean → calibration scoring → evaluating an AI's answer.
- **Tracking:** Model A for calibration (it scores beautifully); Model B for source-judgement.

### 3. Finance & value
- **What:** wants vs needs, budgeting, saving, compounding, risk, expected value, investing,
  inflation. The worked spiral is in §3.
- **Why:** compounding and delayed gratification are real leverage, and they are *not* things AI
  does for you. Money sense is agency made concrete.
- **Frameworks:** ✓ delayed gratification framed as a *skill that pays*, not a virtue test, ✓
  expected value / risk (shared with Logic), ✓ index-fund-first investing basics. ✗ get-rich
  framing, ✗ gambling-shaped reward loops in the game itself.
- **Diegetic:** **mix** — the reserve has a budget and grants (in-world); compounding/EV are clean
  meta puzzles.
- **Spiral:** see §3.
- **Tracking:** Model A for the puzzles; Model B (portfolio) for "ran a real budget."

### 4. Work & agency
- **What:** turn a vague urge into a defined project — scope, milestones, a done-state — and
  actually finish. Setting goals and targets, then hitting them.
- **Why:** deciding *what* to do, and seeing it through, is the part that stays human when
  execution gets cheap.
- **Frameworks:** ✓ Holacracy/Sociocracy **tension → proposal** loop (Floris's world; Nestr), ✓
  deliberate practice as the meta-skill (Ericsson), ✓ visible kanban / "definition of done," ✓
  light goal-setting (kid-scale OKR-ish). ? how much GTD structure for a child.
- **Diegetic:** **diegetic-leaning** — restoration projects on the reserve have scope, milestones,
  and a finish; the ranger plans and ships them.
- **Spiral:** one-step task → multi-step plan → project with a milestone → goal with a target →
  managing several at once → running a real project board for his own life.
- **Tracking:** Model B (portfolio of finished projects; mastery rungs for planning behaviours).

### 5. Communication
- **What:** say the true and needed thing without starting a fight; listen so the other person
  feels got.
- **Why:** the bottleneck on every collaboration — and the thing that decides whether agency lands
  or backfires.
- **Frameworks:** ✓ Nonviolent Communication (observation/feeling/need/request — Rosenberg), ✓
  active listening / reflecting back, ✓ the Holacracy "express a tension without blame" move, ✓
  perspective-taking ("what is the farmer carrying into this?"). ✗ scripted manipulation /
  "persuasion technique" framing.
- **Diegetic:** **diegetic-leaning** — farmers, visitors, a frustrated colleague, even a poacher
  are conversations the ranger navigates.
- **Spiral:** name a feeling → ask vs grab → "I" statements → NVC request → repair after conflict →
  hard conversation with stakes.
- **Tracking:** Model B (mastery rungs; debrief artefacts). Never a "social score."

### 6. Internal work
- **What:** notice your parts, get curious about what they protect, lead from a calm centre (IFS).
  The framing Floris already uses for the whole site.
- **Why:** self-regulation and self-knowledge cannot be outsourced. They are the keel under
  agency, communication, and learning.
- **Frameworks:** ✓ **IFS** (parts, Self, protectors — Schwartz), ✓ NVC feelings/needs (shared
  with Communication), ✓ interoception / nervous-system naming (shared with Health), ✓ Focusing
  (Gendlin, the felt sense). ✗ **CBT** (Floris's explicit dislike — no thought-records, no
  "challenge the irrational thought"), ✗ positive-thinking / affirmations.
- **Diegetic:** **mix, leaning meta-and-private** — the ranger meeting his own fear before a storm
  can be in-world; but the reflective layer about *Alvah's* inner life stays light, private, and
  unscored (§8).
- **Spiral:** name the feeling → "a part of me feels…" → curiosity before judgement → who is
  driving right now → unblending → leading a part with Self.
- **Tracking:** Model B at its lightest — presence/streak of reflection at most, **never** a rating
  of his inner states.

### 7. Creativity & making  *(new)*
- **What:** generate ideas worth having, and build them — art, music, stories, inventions, code.
- **Why:** when generation is cheap, *taste* and *original intent* are the scarce goods. The human
  question becomes "what is worth making," which AI cannot answer for you.
- **Frameworks:** ✓ divergent-then-convergent (make many, then choose), ✓ constraints-breed-
  creativity, ✓ iteration / "ugly first draft," ✓ taste as a trainable sense (critique, not just
  produce). ✗ "everyone's a genius" praise inflation that kills real feedback.
- **Diegetic:** **mix** — design a real solution for the reserve (in-world); open maker challenges
  as a meta studio.
- **Spiral:** free play → finish one thing → iterate on feedback → original brief → develop a
  personal style → make something others value.
- **Tracking:** Model B (portfolio is the literal point).

### 8. Ethics  *(new)*
- **What:** what is worth doing, what you owe other people and creatures, how to weigh competing
  goods. Not rules to obey — judgement to develop.
- **Why:** agency without a values keel is just optimisation, and AI will happily optimise the
  wrong thing very efficiently.
- **Frameworks:** ✓ care/consequences/fairness lenses held *together* (not one dogma), ✓ moral
  imagination / "who is affected," ✓ values as chosen and revisited. ✗ single-doctrine moralising,
  ✗ obedience-as-virtue framing.
- **Diegetic:** **diegetic-leaning** — ranger dilemmas are genuinely ethical (cull vs let-suffer,
  tourist access vs habitat, report a neighbour). The Veluwe is a natural ethics sandbox.
- **Spiral:** fair/unfair → who is affected → competing goods → "what would I want as a rule" →
  values I choose → acting on them under pressure.
- **Tracking:** Model B (reflection artefacts; no "morality score").

### 9. Health & attention  *(new)*
- **What:** the body and focus everything else runs on — sleep, movement, food, and *attention as a
  trainable thing*.
- **Why:** EF and all learning physically sit on this substrate. Cheap, infinite, engineered
  distraction is the AI-era headwind; protecting attention is a survival skill.
- **Frameworks:** ✓ attention-as-trainable (single-tasking, focus reps — extends the EF work), ✓
  sleep/movement/food basics framed as *fuel for the things he wants*, ✓ interoception (shared with
  Internal work). ✗ body-shaming, ✗ calorie/weight framing for a child.
- **Diegetic:** **mix** — the ranger needs rest and food to do hard work (in-world); attention reps
  extend the existing EF engines; real-life habits are a light meta layer.
- **Spiral:** notice tired/hungry/wired → rest helps the next try → protect one focused block →
  longer focus → design your own day → manage energy across a week.
- **Tracking:** Model A for attention reps (they extend EF); Model B (light) for habits.

### 10. Perception & the senses  *(new)*
- **What:** training the senses — sight, hearing, smell, touch, taste — toward higher *resolution*,
  and **becoming aware that you are perceiving** at all. Includes **interoception**: awareness of
  bodily sensation, the bridge into Internal work. The skill is both raw discrimination ("which call
  was that?") and mindful, present contact with what is actually here.
- **Why:** perception is irreducibly embodied — AI cannot perceive reality *for* you. Rich sensory
  contact is the ground beneath taste (Creativity), careful observation (Epistemics), and presence
  (Internal work). In a screen-mediated, AI-narrated era, first-hand high-resolution perception is
  the antidote to living entirely through someone else's representation.
- **Frameworks:** ✓ **perceptual learning** (Gibson — discrimination training: experts literally see/
  hear finer distinctions), ✓ naturalist observation / nature-journaling ("sit spot", slow looking),
  ✓ deep/active listening & soundscape awareness, ✓ drawing-as-seeing (learning to *look*), ✓
  **interoception** practices (shared with Internal work / Health). ✗ anything that pathologises
  sensory difference; ✗ "sensory overload as failure" framing.
- **Diegetic:** **strongly diegetic** — the best fit of any area. A ranger reads tracks and scat,
  identifies birds by call, feels the weather turning, notices what changed since yesterday. The
  whole sensing curriculum lives natively in ranger work.
- **Spiral:** name what you see/hear right now → spot-the-difference in nature → identify by sound →
  read a track and infer → discrimination ladders (taste/smell/sound) + drawing-as-seeing →
  interoceptive granularity → chosen perceptual expertise (birds, music, taste) under noise.
- **Tracking:** **both, cleanly.** Model A for discrimination/acuity — these are textbook
  psychophysics (2AFC, just-noticeable-difference, adaptive threshold staircase: the *same* engine
  as the EF games). Model B for observation/awareness (a nature-journal / "what I noticed" portfolio).
  Interoceptive awareness stays Model-B-light and private, like Internal work (§8).

---

## 6. Research we still need (grouped — see [research/](research/))

Same discipline as the EF research: clean-room (rewrite, never lift), confidence-flagged
(*zeker* / *waarschijnlijk*), honest about evidence (no brain-training overclaims), and ending in
*buildable* deliverables (framework menus, kid→adult progressions, game-mechanic seeds, tracking
suggestions). Ten areas, **seven briefs** — grouped where the literature is shared, to keep the
number of deep-research prompts down without going shallow.

**The [research/](research/) pipeline has three stages** (one folder each):

1. **[research/research-prompts/](research/research-prompts/)** — the seven paste-ready deep-research
   briefs (below). These are the *inputs*.
2. **[research/research-results/](research/research-results/)** — the raw Claude Web deep-research
   *outputs* land here, one per brief, unedited.
3. **[research/research-conclusions/](research/research-conclusions/)** — the *source-of-truth* docs
   we distil from the results: vetted, confidence-flagged, and **added to over time** as we build.
   This is what the build reads from — the equivalent of [../research/](../research/) for the EF game.

| Brief | File (in `research-prompts/`) | Covers areas | Why grouped |
|---|---|---|---|
| 1 | [01-reasoning-math-epistemics.md](research/research-prompts/01-reasoning-math-epistemics.md) | Logic & math + Epistemics | Share the critical-thinking / probability / calibration spine |
| 2 | [02-money-and-value.md](research/research-prompts/02-money-and-value.md) | Finance & value | Reuses brief 1's probability/EV; own kid-pedagogy literature |
| 3 | [03-agency-projects-deliberate-practice.md](research/research-prompts/03-agency-projects-deliberate-practice.md) | Work & agency | Self-management / goal / deliberate-practice literature |
| 4 | [04-inner-work-communication-regulation.md](research/research-prompts/04-inner-work-communication-regulation.md) | Internal work + Communication + Health (regulation/attention) | Shared IFS / NVC / interoception spine; **explicitly CBT-free** |
| 5 | [05-creativity-making-and-ethics.md](research/research-prompts/05-creativity-making-and-ethics.md) | Creativity & making + Ethics | Both are "what is worth making/doing" — generativity + values |
| 6 | [06-meta-teaching-and-tracking-7-to-21.md](research/research-prompts/06-meta-teaching-and-tracking-7-to-21.md) | **Cross-cutting** | The pedagogy + the two-track tracking model + the graduation question. Governs architecture; must come back first or alongside |
| 7 | [07-perception-and-the-senses.md](research/research-prompts/07-perception-and-the-senses.md) | Perception & the senses | Perceptual-learning + interoception literature; the most diegetic area, splits cleanly across both tracking models |

Health's *physical* side (sleep/movement/food) rides along in brief 4 as a smaller appended
section, since its regulation/attention/interoception core shares that brief's literature. If the
returned research is thin on it, we spin a short standalone brief later.

**Interoception is shared between briefs 4 and 7.** Brief 4 owns its *regulation/therapeutic* use
(noticing arousal to calm it — the Internal-work side). Brief 7 owns it as a *perceptual* skill
(raising resolution on bodily signal — the sensing side). Each brief cross-references the other so
we don't re-derive it.

**Suggested order:** run **brief 6 first** (it decides how everything is taught and tracked), then
the area briefs in whatever order matches the area we build first (§7).

---

## 7. Open decisions (Floris's to make)

Mirrors [../GAMEPLAN.md](../GAMEPLAN.md) §7. None of these block writing the research briefs; they
block *building*.

1. **Framework vetoes [needs veto].** Each area's menu in §5 has `?` items and `✗` items. CBT is
   already out. Confirm the rest — especially: how early formal logic (1), how much GTD for a kid
   (4), and whether any spiritual/religious framing belongs in Internal work or Ethics (6, 8).
2. **Diegetic tags [needs veto].** §5 proposes mix/diegetic/meta per area. Confirm, especially the
   Internal-work boundary (how much of his inner life is ever surfaced in-world vs kept private).
3. **First area to build.** Don't boil the ocean. Candidates: Finance (concrete, motivating, clean
   to track) or Work/agency (closest to your existing world and the EF spine). Pick one.
4. **Graduation per area.** Deferred by design, but brief 6 will surface the *signals* that tell us
   an area is ready to hand off to a real tool. Decide per area when those signals show.
5. **Tracking namespace.** Confirm a separate `alvah-life-v1` store (recommended) vs extending
   `alvah-ef-v1`. Keeping them separate prevents a misleading blended "score."
6. **AI-simulation privacy shape [the big one].** §4b needs a ruling: cloud / on-device /
   parent-mediated, and the sensitivity tiering. This is the only decision that touches a *founding*
   site rule (client-side only, CLAUDE.md rule 2), so it is yours alone. My recommendation: tier by
   sensitivity, inner-work never to the cloud. Resolving this gates any area whose practice depends
   on true reactions (Communication, Ethics, the feedback half of Work/Creativity).

---

## 8. Guardrails (non-negotiable, inherited)

- **Never reduce the child to a number.** Model B is evidence and reflection, not rating. Internal
  work and Ethics are *never* scored as a judgement of who Alvah is (tov doc; CLAUDE.md ethos).
- **No CBT** in Internal work. IFS + NVC + interoception/Focusing instead.
- **Privacy-first, client-side only — by default.** Same as the site and the EF games: no server,
  no tracking, one local store; reflection artefacts stay on-device. The *only* candidate exception
  is the §4b AI-simulation layer, and only by an explicit §7 decision — never silently. Inner-work
  content never leaves the device under any shape.
- **AI characters are safety-railed.** Any generative character facing Alvah obeys the §4b rails
  (in-role, age-appropriate, never frightening, hands off when too real). AI may inform Model B but
  never scores who he is.
- **No surnames of real people** in any content or framework attribution-as-content (CLAUDE.md
  rule 1). Citing public framework authors in *planning docs* is fine; in-game content uses roles.
- **Accessibility stays non-negotiable** — AVI-level copy, read-aloud, ≥56px targets,
  dual-channel feedback, reduced-motion (carried from EF + the kid-visibility memory).
- **The architecture thesis holds:** new area = data + (occasionally) one new engine, not a rebuild.
  Reuse the render-agnostic spine, the staircase, and the celebration/milestone pipeline.

---

## 9. How this connects to what exists

- **EF stays the floor.** These ten areas sit *on top of* the five EF engines, which keep running
  as-is. Health/attention literally extends them.
- **Same vehicle.** The ranger and the Veluwe are the wrapper for the diegetic parts. The reserve
  already implies a budget, projects, conversations, dilemmas, and a ranger with feelings — the
  fiction was carrying these areas all along.
- **Same pipeline, second store.** Reuse `staircase.js` / `scoring.js` / `mijlpalen.js` /
  `celebration.js`; add `alvah-life-v1` for Model B so the two tracking models never blur.
- **One major new engine.** The §4b simulation/dialogue engine is the one genuinely new piece of
  machinery these areas add; everything else is scenarios-as-data on top of it. Building it well
  once (with its safety rails) unlocks Communication, Ethics, and the feedback half of Work/Creativity.
- **Research-first, as always.** Nothing gets built from vibes. Each area waits for its
  confidence-flagged research, distilled into engines and data — the exact path the EF work took.
