# Deep-research brief 6 — META: teaching & tracking life-skills in a game, ages 7 → 21

> **Cross-cutting.** This brief does not cover a single life area; it decides *how* all nine are
> taught, sequenced, tracked, and eventually handed off to real life. It governs the architecture,
> so **run it first** (or alongside the first area brief). Paste the block into Claude Web **deep
> research**.

---

## PASTE THIS INTO DEEP RESEARCH

**Context.** I am building a long-horizon educational game for my son (currently 8, Dutch, dyslexic)
that he can keep playing and growing with from roughly **age 7 to 21**. It already trains executive
functions with adaptive, psychometric mini-games (reaction time, accuracy, an adaptive staircase). I
am now expanding it to nine broader life areas: logic/math, epistemics, finance, work/agency,
communication, internal work (IFS-based), creativity/making, ethics, and health/attention. These
broader areas are **macro-competencies** — slow, contextual, judgement-based — not lab tasks with a
clean score. I need to decide how to teach and *track* them honestly, over a decade, without
reducing my child to a number. This brief is about the **pedagogy and measurement architecture**,
not the content of any one area.

**Audience:** me (parent/designer). Everything client-side, private, single learner, sometimes with
a parent. No grades, no classroom, no server.

**Research questions — go deep:**

1. **Spiral curriculum & long-horizon design.** The evidence on spiral curricula (Bruner) and
   "revisit the same concept deeper" vs mastery-learning vs other long-range structures. How do you
   design a *single* learning experience that genuinely serves both a 7-year-old and a 17-year-old
   on the same competency? What real programs/games have sustained a learner across many years, and
   what made them work or fail?
2. **The two-track tracking question — the core of this brief.** I want **two tracking models side
   by side**: (A) *psychometric* (adaptive staircase, RT/accuracy) for the few skills that score
   cleanly — logic drills, calibration, mental math; and (B) *mastery / portfolio / spaced-rehearsal*
   for the open-ended capacities — work, communication, inner work, creativity, ethics. For Model B,
   research: how do you credibly track demonstration-over-time of an open-ended competency? What do
   mastery-based grading, competency-based education, e-portfolios, and badge/micro-credential
   systems get right and wrong? How do you avoid gaming the metric and avoid false precision?
3. **Spaced repetition / spaced rehearsal for *skills* (not facts).** Spacing and interleaving are
   well-evidenced for knowledge; what is known about spacing the *rehearsal of skills and
   reflective practices*? How would a game decide when to resurface "practise an NVC request" or
   "plan a project"?
4. **Motivation that lasts a decade.** Self-Determination Theory (autonomy/competence/relatedness),
   intrinsic vs extrinsic motivation, and the **over-justification effect** — when do points,
   badges, streaks, and rewards *corrode* the very intrinsic motivation a multi-year game depends
   on? What does the long-term evidence say about gamification that sustains vs gamification that
   burns out? I want to avoid building a Skinner box.
5. **Transfer — the honest reckoning.** My EF research already taught me near-transfer is real and
   far-transfer is largely unproven. Apply that lens here: for which of these macro-competencies is
   there *any* credible evidence that practising-in-a-game transfers to real life, and for which
   should I assume the game is, at best, *scaffolding and motivation* around real-world practice?
   I would much rather know this than be sold transfer that isn't there.
6. **The graduation question (decide-per-area, but I need the decision framework).** When should a
   game *stop* simulating a competency and instead scaffold the *real* instrument (a real budget, a
   real project board, real conversations debriefed)? What signals indicate a learner is ready to
   graduate an area to real stakes? How have successful programs handled the sim→real hand-off?
7. **Measuring without harming.** Critical value: I will **never reduce my child to a score**,
   especially for inner work, ethics, and relationships. What does research/ethics say about
   tracking children's social-emotional or character development — the risks of surveillance,
   labelling, self-objectification, and gaming — and how to keep measurement *formative and private*
   rather than judgemental? How do I track *enough* to adapt difficulty without ever rating *who he
   is*?
8. **Difficulty adaptation for un-scorable skills.** The EF staircase adapts on accuracy/RT. How do
   you adapt difficulty for a competency with no clean score — learner self-rating, parent input,
   complexity ladders, mastery rubrics? What is robust vs easily-gamed by a kid who just wants the
   reward?

**Honesty constraints:**
- Tag **zeker** / **waarschijnlijk**. Be especially blunt on **transfer** (Q5) and on **gamification
  burnout** (Q4) — these fields overclaim and I want the real picture.
- Surface the **risks** of tracking children's inner/social development, not just the methods.

**Required output format (this one is architectural, so be concrete):**
- A **recommended dual-track tracking architecture**: exactly when to use Model A (psychometric) vs
  Model B (mastery/portfolio), with a decision rule I can apply per skill, and concrete data shapes
  for Model B (what an "evidence of demonstration" record should contain).
- A **spiral-design template**: a reusable structure for laying out any one of my nine areas as a
  7→21 spiral with mastery rungs.
- A **spaced-rehearsal scheduling model** for skills/practices (when to resurface what).
- A **motivation-design rulebook**: do / don't for points, badges, streaks, rewards over a multi-year
  horizon, grounded in the over-justification evidence.
- A **transfer honesty table**: per competency type, the best current evidence that game-practice
  transfers, with confidence flags — and where to treat the game as scaffolding only.
- A **graduation decision framework**: the readiness signals + a sim→real hand-off playbook.
- A **"measure without harming" charter**: concrete rules for formative, private, non-judgemental
  tracking of a child, with the bright lines never to cross.
- **Open-gaps / caveats** and **sources** (cite; flag CC0/open material for clean-room rewrite).

---

## Notes for us (not for the prompt)
- This brief's output becomes PLAN §4 (tracking) and §3 (spiral/graduation) made rigorous, and the
  `alvah-life-v1` schema (Model B data shapes) flows from Q2.
- Its motivation-design rulebook and transfer table are **repo-wide constraints** — they bound how
  *every* area uses rewards and what we're allowed to claim. Treat as binding once it returns.
- The "measure without harming" charter operationalises the tov hard line; it should be quoted into
  PLAN §8 once we have it.
