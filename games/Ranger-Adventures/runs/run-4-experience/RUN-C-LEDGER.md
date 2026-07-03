# Run 4 · Run C — EXPERIENCE LEDGER (open-ended cohesion ledger)

> The supervisor (`run-c-loop.sh`) does the FIRST unchecked `- [ ]` box each
> sitting. A **DIRECTION** box is authored by the Fable art director; a **WORK**
> box (`- [ ] Pn.m …`) is built by Opus (`--effort xhigh`), the supervisor
> re-captures, and Opus grades its own fresh screenshot; a **GATE** box runs a
> fresh **Fable** art-director sitting that re-judges the phase against
> [RUN-C-DIRECTION.md](RUN-C-DIRECTION.md) and may **re-open** boxes (`[x]`→`[ ]`)
> **or APPEND new cohesion boxes**. Read [RUN-C-PLAN.md](RUN-C-PLAN.md) first
> (the per-box gate, the hybrid two-judge gate, asset discipline, frozen
> contracts). The locked spec is [VISION.md](../../VISION.md).
>
> **This ledger is OPEN-ENDED and a SEED.** Run C has no fixed finding list — it
> is "make it excellent toward the VISION." The boxes below are the starting
> punch-list in the VISION §13 priority order; the art director EXTENDS them as
> the composed world reveals gaps, converging to the "excellent per screen" bar
> (VISION §9). Phase order is the priority order, so an early stop still ships
> the best 20% first.
>
> **Tick rule (per box).** A WORK box is `[x]` ONLY when ALL hold: the fix's OWN
> fresh laptop `npm run capture` screenshot meets the box's verify-by AND the
> RUN-C-DIRECTION.md bar for that screen, the named annotation/E2E assert passes,
> and `npm run build` + `npm run e2e:smoke` are green (the last two enforced
> mechanically by `ranger-run.mjs tick`). At the phase `GATE`, the Fable art
> director must ALSO agree. **`+demo` boxes may reach "implemented — awaiting
> Floris demo", NEVER "accepted".**
>
> Legend: **shot** = own-screenshot gate · **assert** = annotation/E2E field ·
> **+demo** = has a feel/audio/device component no gate may self-certify ·
> **[laptop]/[both]** = platform · trailing **(N)** = progress weight.
>
> **SCOPE — LAPTOP-ONLY automated verification (same as Run B).** The loop
> captures the **laptop** project only (`CAPTURE_PROJECTS=laptop`); iPad hangs
> the software renderer (F-21). Make shared-code changes for "both"/"iPad" boxes;
> verify on laptop; the iPad/feel/audio/real-Safari verdict is Floris's in the
> DEMO section. Capture output lands in the shared
> `../runs/run-3-ux-polish/audit-evidence/` (Run B's final frames are the
> cohesion baseline).
>
> **NB on assets:** the full model cast is ALREADY staged in
> `app/public/models/*.glb` (all 5 flagships, the raven, the ranger). So Phase 2
> is **upgrade-for-realism** — `meshy-gen.mjs --only=<id>` regenerates a staged
> model (the staged-skip only applies to an unfiltered pass) — spread wisely by
> impact-per-credit per the direction doc's ranked list, each screenshot-judged
> before it replaces the current model.

---

## Phase 0 · direction-first  (write the plan before any build — VISION §10)

- [ ] P0.1 · **DIRECTION · write & commit RUN-C-DIRECTION.md** (2) — the Fable art
  director authors the single source of truth: the art-direction bible (one
  naturalistic Veluwe at golden hour + screen-by-screen look targets: title →
  world → case-board → each of the 5 games → pause), the felt-progress plan (how
  a completed mission visibly changes the world), the ranked Meshy asset list
  (impact-per-credit, with existing `asset-shotlist` ids + rough credit estimates
  + never-scary notes), and the per-screen "excellent" bar (VISION §9). **Verify
  by:** the doc exists and is committed as the run's first act; it covers all six
  screen groups + felt-progress + the ranked asset list + the frozen contracts.
- [ ] GATE-P0 · **Fable seeds the cohesion ledger from the doc + current pixels.**
  Capture the current (Run B final) state, read RUN-C-DIRECTION.md, and for EACH
  downstream phase (1–5) APPEND concrete `- [ ] Pn.m` cohesion boxes with
  verify-bys that operationalize the doc against what the current screenshots
  actually show. Do NOT tick this gate until each phase carries real, specific
  boxes (the seed boxes below are a floor, not a ceiling). **Exit of Phase 0.**

## Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)

- [ ] P1.1 · **Unify the lighting + sky to the golden-hour touchstone [both].**
  One warm naturalistic light/sky/fog model shared by title → world → board →
  games so no screen reads as a different game. **Verify by:** shot (title,
  world-entry and a mission frame share the same light/palette) + assert
  (`drawCalls` < 150, pixelRatio ≤ 2 unchanged).
- [ ] P1.2 · **Naturalistic terrain + ground materials [both].** Replace flat/
  stylized ground with believable heide · bos · stuifzand · ven materials + soft
  blob shadows so realistic animals will belong. **Verify by:** shot (each biome
  reads as real Veluwe ground) + assert (`drawCalls` < 150).
- [ ] P1.3 · **Trees + world props to one fidelity [both].** Mixed species/sizes,
  consistent material language with the staged prop cast; no low-poly outlier
  next to a realistic asset. **Verify by:** shot (tree line + props read as one
  world) + assert (draw-call budget held).
- [ ] P1.4 · **Title screen on-style + grounded [both].** Golden-hour backdrop,
  grounded avatar/props, per-sentence ≤7-word subtitle lines. **Verify by:** shot
  (title belongs to the same world as world-entry; subtitle lines ≤7 words).
- [ ] P1.5 · **Case-board (prikbord) + pause on-style [both].** The hub board and
  the pause overlay share the world's palette + one static scrim; legible,
  ≥56 px controls. **Verify by:** shot (board + pause read as the same world; no
  jarring UI skin) + assert (named controls ≥ 56 px).
- [ ] P1.6 · **Each of the 5 game surfaces on-style (3D + 2D floor) [both].**
  zoeken · corsi · simon · dagnacht · wisselen each read as the same naturalistic
  Veluwe (their diegetic ranger framings, VISION §5), 2D floor included; no
  bolted-on-puzzle look. **Verify by:** shot (all five, 3D + 2D floor, on-style)
  + assert (construct-parity intact, draw-call budget held).
- [ ] GATE-P1 · **Fable re-judge — does it read as ONE naturalistic world?** (2)
  Capture; judge cohesion across title → world → board → 5 games → pause against
  the doc. Re-open or append. May append new dressing boxes. **Exit of Phase 1.**

## Phase 2 · realistic animals  (VISION §13.2 — credits spread wisely, flagships + raven + ranger FIRST)

- [ ] P2.1 · **Upgrade the player ranger (Alvah) — `meshy-gen.mjs --only=ranger-alvah`** (2)
  [both] +demo. Regenerate to higher realism per the doc, optimize
  (gltf→optimize-animated, <150 draw calls), never-scary, screenshot-judge; keep
  the avatar-creator + `alvah-ef-v1` persistence intact. Log credit spend.
  **Verify by:** shot (ranger reads as a believable person, belongs in the world)
  + assert (avatar.height ∈ [1.5,2.0], draw-call budget held). **Face/feel: demo.**
- [ ] P2.2 · **Upgrade the raven companion — `meshy-gen.mjs --only=animal-raaf-raven` (+ `animal-raaf-fledgling`)** (2)
  [both]. Realistic + never-scary across the baby→jong→zelfstandig growth; the
  companion-care loop unchanged. **Verify by:** shot (raven reads as a real raven,
  calm) + assert (draw-call budget; companion state intact).
- [ ] P2.3 · **Flagship: edelhert — `meshy-gen.mjs --only=animal-edelhert-reddeer`** (2)
  [both]. Believable proportions/texture, calm-posed. **Verify by:** shot
  (looks-real AND belongs; reject+regenerate otherwise) + assert (draw calls).
- [ ] P2.4 · **Flagship: wildzwijn — `meshy-gen.mjs --only=animal-wildzwijn-boar`** (2)
  [both]. Realistic, never-scary (calm, not charging). **Verify by:** shot + assert.
- [ ] P2.5 · **Flagship: ree — `meshy-gen.mjs --only=animal-ree-roedeer`** [both].
  **Verify by:** shot (real roe deer, belongs) + assert (draw calls).
- [ ] P2.6 · **Flagship: das — `meshy-gen.mjs --only=animal-das-badger`** [both].
  **Verify by:** shot + assert.
- [ ] P2.7 · **Flagship: eekhoorn — `meshy-gen.mjs --only=animal-eekhoorn-squirrel`** [both].
  **Verify by:** shot + assert.
- [ ] P2.8 · **Other story animals, wisely spread — batch via
  `meshy-gen.mjs --only=<id>` per the doc's ranked list** (3) [both]. vos, adder
  (calm-posed), heikikker, nachtzwaluw, the story birds — regenerate ONLY those
  the doc ranks worth the credits, each screenshot-judged; STOP on the usage/
  Meshy reserve. Log spend per model. **Verify by:** shot (each accepted model
  looks-real AND belongs, never-scary) + assert (draw-call budget held).
- [ ] P2.9 · **World-naturalism assets ONLY if they buy real cohesion — per the
  doc, via `meshy-gen.mjs --only=<id>`** [both]. Upgrade the few props whose
  fidelity breaks the world; skip the rest. **Verify by:** shot (the upgraded prop
  removes a cohesion break) + assert (draw calls).
- [ ] GATE-P2 · **Fable re-judge — do the animals look REAL and BELONG?** (2)
  Capture; judge every regenerated model against the doc (realism + never-scary +
  belongs) and the credit spend log (wisely spread). Reject+re-open any that look
  wrong. **Exit of Phase 2.**

## Phase 3 · make progress FELT  (VISION §13.3 — the world reacts to completed missions; the single biggest "experience" lever)

- [ ] P3.1 · **A completed mission visibly changes the world [both].** Wire at
  least one concrete, calm world reaction per mission completion (an animal
  returns to a spot, a path/area heals, the season light shifts) driven from the
  existing mission-completion state — no new persistence keys. **Verify by:** shot
  (before/after a mission: the world frame visibly differs in the intended spot)
  + assert (reaction derives from mission state; no new `localStorage` keys).
- [ ] P3.2 · **The season arc is felt on the case-board [both].** Kraamtijd →
  Zomer → Bronst → Herstel progress reads on the prikbord (clues `spoor→camera→
  band`, veldnotities, the hopeful ontknoping) — calm, ≤7 words, read-aloud on new
  strings. **Verify by:** shot (the board shows season/arc progress that tracks
  completed missions) + assert (derived from `VERHAALBOOG_VELUWE` state).
- [ ] P3.3 · **Badges/breinkrachten feel earned, not bookkept [both].** The 5
  breinkracht badges + knap-woord badges read as a felt reward at the moment of
  earning (calm, on-style), not a silent counter. **Verify by:** shot (earning a
  badge shows a calm on-style moment) + assert (no contract/persistence change).
- [ ] GATE-P3 · **Fable re-judge — is progress FELT, not just badged?** (2)
  Capture a before/after mission pair; judge that the world + board + badges
  visibly react. Re-open or append. **Exit of Phase 3.**

## Phase 4 · weave the orphan systems into the season arc  (VISION §13.4 — raven · jeep/heli · worldbeats · the `roep` game)

- [ ] P4.1 · **The raven companion has a story role in the arc [both].** The
  rescue→care→friend loop threads INTO the season (it helps in a mission / marks a
  clue / reacts to progress), not parallel to it. **Verify by:** shot (the raven
  appears inside a story beat, calm) + assert (uses existing companion state).
- [ ] P4.2 · **Jeep + helicopter earn a diegetic role [both].** The drivable jeep
  (and heli) serve the ranger work (reach a far mission / a winterronde leg) with
  the motion-comfort camera law intact — no story-less joyride. **Verify by:** shot
  (a drive frame reads as purposeful ranger travel) + assert (camera law: fixed
  FOV, roll 0, damped; `cam.target`="vehicle"). **Drive feel: demo.**
- [ ] P4.3 · **Free-roam worldbeats point at the arc [both].** The calm free-roam
  beats nudge toward the next kindness rather than idling. **Verify by:** shot
  (a worldbeat gently surfaces the next mission/clue) + assert (no new keys).
- [ ] P4.4 · **Wire the built-but-unused `roep` (bird-call) engine into `simon`/
  the arc [both] +demo.** Use the existing call engine + xeno-canto audio in the
  dusk call-and-response framing (VISION §5/§7); calm, never-startle. **Verify
  by:** shot (the roep/simon beat is present and on-style) + assert (audio via
  `assetUrl`, construct-parity intact). **Call audio firing: demo.**
- [ ] GATE-P4 · **Fable re-judge — are the orphan systems now inside one story?**
  (2) Capture; judge that raven/jeep/heli/worldbeats/roep read as part of the
  season arc, not parallel toys. Re-open or append. **Exit of Phase 4.**

## Phase 5 · deepen scene/mission + xeno-canto call polish + final re-judge  (VISION §13.5)

- [ ] P5.1 · **Deepen the 10 missions' scene dressing + beats [both].** Per the
  doc, add calm naturalistic dressing + clearer diegetic staging to the mission
  scenes (briefing → task → reunion), ≤7 words, read-aloud on new strings, no new
  mechanics. **Verify by:** shot (missions read richer + on-style; reading intact).
- [ ] P5.2 · **Xeno-canto call polish across the animals [both] +demo.** Deepen +
  balance the per-animal `geluid` (real CC recordings via the existing
  `audio-fetch` pipeline); calm levels, never a sudden loud cue; assets via
  `assetUrl`. **Verify by:** assert (each targeted animal has a mapped call;
  levels within the calm ceiling). **Audio quality on-device: demo.**
- [ ] P5.3 · **Reduce-motion sweep across the new work [both] +demo.** Everything
  Run C added respects the motion-comfort law under both RM gates (OS media +
  the in-game "Rustige beweging" toggle): camera moves become cuts, secondary
  motion freezes at idle, locomotion still animates. **Verify by:** shot set +
  pixel-diff (idle near-zero) + assert (`.rm` via both gates). **On-device: demo.**
- [ ] P5.4 · **Full re-capture + triage.** One clean `npm run capture`; sweep the
  WHOLE flow for anything the phase gates missed; append boxes for survivors.
  **Verify by:** shot (complete fresh laptop set).
- [ ] GATE-P5 · **FINAL Fable re-judge — the whole game against the direction doc.**
  (3) Capture; re-judge every screenshot-closable box across all phases —
  cohesion across all screens, realism + never-scary of all animals, felt
  progress, the woven systems, reading + calls. May re-open anything. This is the
  last gate before the Floris demo. **RUN-C-COMPLETE when this ticks and every
  non-DEMO box above is `[x]`.**

---

## Demo acceptance  (Floris ONLY — no screenshot/E2E gate may tick these)

> These are the `+demo` components. Their build boxes above may reach
> "implemented — awaiting Floris demo"; the FEEL/AUDIO/real-device verdicts live
> only here. The supervisor pauses at these with NEEDS-FLORIS — it never spends a
> sitting on them.

- [ ] DEMO · **Realism + never-scary on the real iPad** — do the regenerated
  animals + ranger look real, belong, and never scary on real glass? Floris
  accepts on-device.
- [ ] DEMO · **Felt progress feels good** — does a completed mission changing the
  world land as rewarding + calm (not busy/startling)? Floris accepts on-device.
- [ ] DEMO · **Motion comfort** — the woven jeep/heli travel, any new camera
  moves, and reduce-motion on the real iPad. Floris accepts on-device.
- [ ] DEMO · **Audio** — xeno-canto calls + read-aloud on new/changed strings
  fire, calm and never-startle. Floris confirms audio on-device.
- [ ] DEMO · **Real Safari** — every iPad conclusion carries the Chromium engine
  caveat; the on-device WebKit pass is the only real-Safari evidence. Floris
  accepts on iPad.
- [ ] DEMO · **iPad platform (whole)** — because Run C auto-verifies on laptop
  only, ALL iPad pixels are Floris's on-device sign-off: layout/scale, ≥56 px
  targets, touch controls, and that the new art/animals/felt-progress look right
  on the real device.

## Notes
- Re-run the capture anytime from `app/`: `npm run capture` (rebuilds the shared
  `runs/run-3-ux-polish/audit-evidence/`).
- Phase order = the VISION §13 priority order, so an early stop (usage/credits)
  still ships the highest-impact work first. Do not resequence phases.
- The ledger is a SEED — the Fable art director appends concrete boxes at GATE-P0
  and re-opens/extends at every later gate. Convergence target = VISION §9.
