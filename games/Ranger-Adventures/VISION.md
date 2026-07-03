# Ranger van de Veluwe — VISION (the "make it amazing" spec)

> **Status: DRAFT — we are writing this together.** Purpose: give a future
> autonomous polish/vision run (Fable-directed, Opus-built) a *target to
> converge toward*, so 8 hours of compute makes an aligned, excellent experience
> instead of undirected motion. Everything marked **🔲 DECISION** is Floris's to
> settle; everything marked **DRAFT** is my hypothesis for you to react to, not a
> conclusion. Nothing here overrides the frozen contracts (§11) — those are for
> Alvah's neurology and stay inviolable.

---

## 1. The core tension to resolve FIRST (before anything else)

There are two north stars in your message and they can quietly pull apart:

- **A · "The best possible experience *for Alvah*"** — calm, never-scary,
  motion-safe, tiny reading load, EF-training, personal. Therapeutic first.
- **B · "Blow people away / the ultimate showcase for what Fable can do"** —
  impressive to strangers, broadly appealing, demo-ready spectacle.

**These are not automatically the same game.** A "wow" showcase often reaches
for peril, spectacle, density, speed, surprise — the exact things Alvah's
profile forbids (motion-comfort, never-scary, ≤7-word lines). If B silently wins,
the run will erode the very contracts that make this *for* Alvah.

**My honest position (DRAFT):** the most impressive showcase is *not* generic
spectacle — it's **a deeply coherent, emotionally warm, accessible experience
built with obvious care for a real child.** "An AI built a complete, soulful,
therapeutic game world, tuned to one motion-sensitive dyslexic 8-year-old, all
aligned to one story" is a *more* stunning Fable demo than another flashy game.
So I'd frame it: **A is the north star; B is the byproduct of doing A superbly.**
But you decide — see the questions after this doc.

---

## 2. North star  ✅ DECIDED (Floris)
**Alvah first; the showcase is the byproduct of doing that superbly.** When
"amazing" and "best for Alvah" conflict, Alvah wins. The frozen contracts (§11)
are sacred — excellence is pursued *within* them. The Fable "wow" is proven by
**coherence, care, accessibility, and completeness**, never by spectacle that
breaks the calm/never-scary/reading contracts.

## 3. Who we're wowing  ✅ DECIDED (Floris): **AI/dev people + Alvah's world**
Two audiences, and they want *different proofs* — a productive tension to design
for consciously:
- **AI / dev people evaluating Fable** — wow = *"an AI autonomously built this
  complete, cohesive, soulful thing."* Served by craft, alignment, and a legible
  **story of how it was made** (keep great provenance: the run logs, the
  screen-by-screen ledger, this VISION doc — the making-of is part of the demo).
- **Alvah's world (school, therapists, family)** — wow = *"this is a serious,
  thoughtful, genuinely helpful experience for his profile."* Served by
  therapeutic credibility + real engagement + visible EF growth.
- **NOT chasing:** the anonymous general public / broad "2-minute stranger"
  appeal. Depth for two real audiences beats shallow universal reach.
- **Both are served by the same thing:** depth, coherence, care — *not*
  spectacle. This keeps §2 and §3 pulling the same direction.

---

## 4. The world & story spine  ✅ authorship DECIDED · DRAFT (premise)

**Authorship (Floris): honor the existing lore, extend where it makes sense.**
There is already story/world material in the game + docs — the run must build
ON it (respect the existing cast, missions, seasons, breinkracht framing), and
add only where it strengthens the whole. **Canon is now excavated — see §4a.**
The good news: the DRAFT premise below turned out to *already exist* in the code
(the `VERHAALBOOG_VELUWE` season arc). So we're refining a real spine, not
authoring one.

**The premise (confirmed live in §4a):** *You are the Veluwe's newest boswachter.
Across a calm year — Kraamtijd → Zomer → Bronst → Herstel — the park's animals
each need a small kindness, and a ranger with sharp "breinkracht" can help. No
villain-as-danger: the drama is care, discovery, growth. Three clues about the
(reformed) poacher lead to reporting to the warden; the heath and ven grow back.
The raven you rescue becomes your companion. Never a boss, never a fail.*

**Open story questions (let's answer these):**
- Is the arc a **year/seasons** cycle, a **journey across the park**, or a
  **"heal the Veluwe" restoration** story? (DRAFT leans: seasons + restoration.)
- What is Alvah's *role and growth* — from apprentice to trusted ranger? Does he
  earn a title/badge that means something at the end?
- What's the emotional throughline in one sentence? (DRAFT: *"small kindnesses,
  done with a clear mind, bring a whole forest back to life."*)
- How personal to Alvah? (his name/avatar are in; do we weave in real touches —
  his interests, a nod to his own world — or keep it shareable/universal?)

## 4a. CURRENT CANON — what already exists (build ON this)

> Excavated from the live code, 2026-07-03. The story is **not** a blank page —
> a coherent, data-driven one-season spine is already wired. The run's job is to
> **deepen + unify** this, not replace it.

- **Premise (live):** you are the Veluwe's newest **boswachter**; EF skills are
  reframed as **"breinkrachten"** hidden inside real ranger work. One 240×240 m
  open 3D Veluwe, 4 biomes (heide · bos · stuifzand · ven), a spawn clearing with
  the **ranger-cabin + case-board (prikbord)** hub. `app/src/content/veluwe.ts`,
  `app/src/main.ts:56`.
- **The season spine EXISTS (`VERHAALBOOG_VELUWE`, veluwe.ts:642):** 4 chapters —
  **Kraamtijd (lente) · Zomer · Bronst (herfst) · Herstel (winter).** Three clues
  (`spoor` → `camera` → `band`) drop from tagged missions and point to **de
  stroper**; report to the **BOA/warden** → hopeful ontknoping: *"De stroper
  stopt. De heide en het ven groeien terug."* Fully derived from mission
  completion.
- **Cast (live):** ranger/player (default **Alvah**, customizable), the
  **warden/BOA** (mentor, by the report board), the **reformed poacher** (gentle,
  calm-posed, never-scary), the **raven companion** (rescue→care→friend, grows
  baby→jong→zelfstandig, can fly with you). 13 story animals + 5 flagships
  (wildzwijn, ree, edelhert, eekhoorn, das). `core/companion.ts`, `veluwe.ts`.
- **10 wired missions** (veluwe.ts) with real voiced briefings, per-choice
  consequence text, reunion lines, and collectible **veldnotities** ("wist je
  dat" facts) pinned to the case-board. Season finale = mission 10 "De
  winterronde".
- **Meta systems (live):** breinkracht-badges (5) + knap-woord badges,
  veldnotitie board, companion-care loop, case-board/clue resolution, avatar
  creator, calm free-roam "worldbeats".
- **Tone (enforced):** AVI **M3/E3, ≤7 words/line**, one instruction per line,
  read-aloud on everything new; nuchter, no hype, no "held/kanjer" talk;
  `toonVeilig` per animal, every tense beat one short non-graphic sentence.
  `core/readlevel.ts`, `design/ontwerp-brief.md`.

### The real opportunity = the GAPS (what's built but NOT woven into the one story)
This is where "deepen & unify" earns its keep — and it's the highest-leverage,
lowest-risk work for the run:
1. **Progress isn't *felt*** — the arc/badges are derived bookkeeping; the *world*
   barely reacts to a completed mission. (Cohesion glue — VISION §5.)
2. **Orphan systems run parallel to the season arc, not inside it:** the **raven
   companion**, the **jeep + helicopter** (drivable but zero story role), the
   **free-roam worldbeats**, and the built-but-unused **`roep` (bird-call)
   engine** and staged **wolf** model. Thread these into the season.
3. **Art/visual cohesion** across title → world → board → 5 games → pause is not
   yet one world (Run B is fixing the worst; Run C makes it *beautiful + unified*).
4. **Sound** — largely tones + read-aloud today; no unifying soundscape.
5. **3 stub areas** (Wadden/Biesbosch/Duinen) — out of scope (that's *expansion*,
   which we ruled out); the run stays inside the Veluwe.

## 5. How the 5 EF mini-games map to the story (CANON framings — keep these)

They already read as ranger tasks (not bolted-on puzzles), with construct-parity
3D variants + a 2D floor each. **Use the real framings below — do not re-theme:**

| Engine | Breinkracht | EF construct | Diegetic ranger task (as built) |
|---|---|---|---|
| **zoeken** | Speurkracht | sustained attention / visual search | find the animal that hides ("drukt zich") in grass/reeds/sand |
| **corsi** | Geheugenkracht | visuospatial sequence memory | remember + re-point the route the herd/eekhoorn walked (footprints) |
| **simon** | Echokracht | audio-visual working memory | animals call a growing sequence at dusk — call it back ("doe ze na") |
| **dagnacht** | Rustkracht | inhibition (Stroop-like) | resist the impulse (aai/pak/voer), keep the ranger-rule; wrong = recoverable |
| **wisselen** | Wisselkracht | cognitive flexibility / set-shift | sort day-animal→open plek, night-animal→het hol; the sign flips "Nu andersom!" |

**The cohesion question (DRAFT: yes):** completing a game/mission should visibly
*change the world* — an animal returns to a spot, a path/clue opens on the board,
the season light shifts — so progress is *felt*, not just badged. This is #1 in
the gaps list and likely the single biggest "amazing experience" lever.

## 6. Art direction & mood  ✅ DECIDED (Floris): **realistic — "the more real the better"**
The animals should read as **real, recognizable species** — believable
proportions, textures, and behavior — **never cartoony**. Warm, natural Veluwe
light. Constraint that stays absolute: **never-scary** — realistic ≠ menacing;
no blood/gore, predators stay calm-posed, tense beats stay off-screen (the
existing `toonVeilig` / calm-pose gates hold). This is *also* an Alvah win: real
animals = he's learning real nature, not mascots.

**Two tensions the run MUST resolve consciously (or it will drift):**
- **Realistic animals vs. a low-poly world = a cohesion risk.** Realistic
  animals dropped into a stylized low-poly forest look like two games. So the
  direction is **naturalistic throughout** — the *whole* Veluwe (terrain, trees,
  light, sky) leans believable/warm so the animals belong. One world, one
  fidelity. **DRAFT touchstone:** *a warm, naturalistic Veluwe at golden hour —
  real animals in a real-feeling forest, calm and storybook-warm, not clinical.*
- **Realism vs. the iPad performance budget (hard ceiling).** <150 draw calls,
  pixelRatio ≤2, iPad-first. Realism must come from **good models, textures,
  light and framing — NOT polygon count or effects.** The run gets
  "real-feeling" *within* the budget; it may never trade the performance/motion
  contracts for fidelity.
- **✅ asset spend DECIDED (Floris): the full ~7,600 Meshy credits are
  authorized for realism** ("not using them for anything else"), but **spread
  wisely / prioritized** — do not exhaust them on a few models. Allocation
  principle = **impact per credit**: most-seen first (the 5 flagships +
  the raven companion + the player ranger), then the other story animals, then
  world-naturalism assets only if they buy real cohesion. The direction doc
  (§10) writes the ranked asset list before generation starts.

### 6a. Asset-generation discipline (spending real money autonomously needs rigor)
Every generated/upgraded model must clear the SAME screenshot-in-the-loop bar as
any other change before it's accepted — no blind shipping:
1. runs through the existing pipeline (`meshy-gen → gltf-optimize →
   optimize-animated`) so it meets the **<150 draw-call / perf budget**;
2. passes the **never-scary / calm-pose** gate (realistic ≠ menacing);
3. a screenshot judge confirms it **looks real AND belongs in the world** — a
   model that looks wrong is *rejected and regenerated*, not kept;
4. credit-out is handled by the existing retry-then-pause (ranger-run.mjs), so a
   drained balance pauses gracefully with NEEDS-FLORIS, never a hard crash;
5. spend is logged per model so "wisely spread" is auditable after the run.

## 7. Sound & music  ✅ DECIDED (Floris): **real animal calls only (xeno-canto) — no music yet**
In scope: **real animal-call audio via xeno-canto** (Creative-Commons recordings;
the pipeline already exists — `scripts/audio-fetch.mjs`, the audio manifest, the
per-animal `geluid`). Deepen + polish these — they pair perfectly with the
realism direction and with the `simon`/`roep` games. **Out of scope for now:**
ambient soundscape + musical motifs (later pass). Calm/never-startle rule holds
(no sudden loud cues); no new runtime deps; assets via `assetUrl`.

## 8. Scope — what the run may and may NOT do  ✅ DECIDED (Floris): **deepen & unify**
The run **deepens + unifies what exists** — it does NOT invent new mini-games or
mechanics, and never rebuilds-from-scratch or touches the frozen contracts
without your OK.
- **DRAFT in-scope:** unify art direction; wire the story spine through existing
  screens; make each of the 5 games feel diegetic + beautiful; world dressing,
  transitions, sound, cohesion, the "make progress felt" glue.
- **DRAFT out-of-scope (needs you):** brand-new mini-games, major new mechanics,
  anything touching the frozen contracts, real spending on asset generation
  without your OK.

## 9. The "excellent per screen" bar (the terminator for "until it's happy")
"Optimize until really happy" has no natural end. We need a written bar so the
run *converges*. **DRAFT bar — a screen/game is "done" when:**
1. it's on-story and on-style (belongs to the same world as its neighbors),
2. one clear action, calm, legible (passes the reading + tap-target contracts),
3. progress/consequence is *felt* (the world reacts),
4. both Fable *and* a second judgment agree it's excellent,
5. it passes the frozen contracts + build + smoke,
6. nothing that needs *feel/audio/device* is marked done without your demo.

## 10. Guardrails against drift  ✅ (Floris: "let it run" — NO live gates)
You chose full autonomy (no live checkpoints). That's fine, but it removes the
human safety valve, so the *automatic* guardrails carry all the weight:
- **Direction-first, written + committed.** The run's FIRST act is to write a
  short `RUN-C-DIRECTION.md` (the art-direction bible + the "felt-progress" plan
  + screen-by-screen cohesion targets) and commit it. Even without a live gate,
  this externalizes the plan so drift is *visible and reversible* after the fact,
  and everything after converges to it. (This replaces the checkpoint you
  declined.)
- **No re-litigating done work** — once a screen passes the §9 bar, it's frozen
  unless a later screen forces a change; prevents change-then-revert thrash.
- **Commit + push every step** — nothing lost; any drift is bisectable and
  revertible commit-by-commit.
- **Frozen contracts hard-gated on every tick** (build + e2e:smoke), same as
  Run B — the run literally cannot tick a change that breaks them.
- **Two-judge agreement** (Fable + an independent second look) before anything
  counts as excellent — no self-certification.
- **This VISION doc + RUN-C-DIRECTION.md are the single source of truth** the run
  re-reads each sitting.
- **Because there's no live gate:** I'd still glance at the committed direction
  doc when it lands (~30–45 min in) — not to gate the run, just so if it aimed
  somewhere you'd hate, we catch it in commit 3 instead of hour 8. Costs you
  nothing; the run keeps going.

## 11. Frozen contracts — STILL inviolable (carried from Run A/B)
Motion-comfort camera law (fixed FOV, roll 0, no shake/snap; reduced-motion =
cuts) · never-scary / never game-over · ≥56 px targets · <150 draw calls ·
pixelRatio ≤2 · iPad-first · persistence only via `state.ts`/`persist.ts` in the
`alvah-ef-v1` ranger namespace (no new keys) · M3/E3 Dutch ≤7 words + read-aloud
on new strings · construct-parity + 2D floor per mini-game · no new deps without
Floris · assets via `assetUrl` · no surnames · never print `.env.local`.
**Excellence is pursued WITHIN these, never by trading them away.**

## 12. Run C mechanics (how we'd actually run it)
- **Fable = art director** (proposes + judges design/story/cohesion) · **Opus =
  builder** (writes the TypeScript). Same screenshot-in-the-loop + hybrid gate as
  Run B, but with an open "make it excellent toward this VISION" mandate and a
  **cohesion ledger** (screen-by-screen, game-by-game).
- **Time/limit box:** runs ~8h *or* until your usage limit pauses it gracefully
  (it can't read a token count — it stops on the limit and can resume when the
  window resets). Wall-clock cap + iteration cap as backstops.
- **Priority order** so an early stop still ships the best 20% first (§13).

## 13. Priority order if it runs out early  ✅ DRAFT ranking (post-canon)
If usage/credits stop it early, land the highest-impact first:
1. **One naturalistic art direction across all screens** (the cohesion + realism
   unifier — §6). Nothing reads as "a different game" than its neighbor.
2. **Realistic animals**, credits spread wisely — flagships + raven + player
   first, then the rest (§6/§6a).
3. **Make progress FELT** — the world reacts to completed missions (§4a gap #1;
   the single biggest "experience" lever).
4. **Weave the orphan systems into the season arc** — raven, jeep/heli,
   worldbeats, the `roep` game (§4a gap #2).
5. **Deepen scene/mission polish + xeno-canto call polish** (§7).

---

## 14. Open decisions log
- ✅ North star — **Alvah first, showcase as byproduct** (§2)
- ✅ Wow-for-whom — **AI/dev people + Alvah's world** (§3)
- ✅ Story authorship — **honor + extend existing canon** (§4/§4a)
- ✅ Scope — **deepen & unify (no expansion/rebuild)** (§8)
- ✅ Art direction — **realistic/naturalistic, "more real the better", never-scary** (§6)
- ✅ Asset spend — **full ~7,600 Meshy credits, spread wisely** (§6/§6a)
- ✅ Sound — **xeno-canto real animal calls only; no music yet** (§7)
- ✅ Live checkpoints — **none ("let it run"); automatic guardrails + direction-doc instead** (§10)
- ✅ EF→story mapping — **canon framings kept as-is** (§5)
- ◑ "Excellent" bar — my DRAFT stands (§9); refine into RUN-C-DIRECTION.md at run start
- ◑ Arc/throughline — spine confirmed (§4a); the run deepens it, doesn't rewrite

**Status: vision essentially LOCKED.** Remaining ◑ items become the run's own
first deliverable (`RUN-C-DIRECTION.md`, §10). Run C starts after Run B finishes.
