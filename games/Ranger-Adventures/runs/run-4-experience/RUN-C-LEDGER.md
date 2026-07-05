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

- [x] P0.1 · **DIRECTION · write & commit RUN-C-DIRECTION.md** (2) — the Fable art
  director authors the single source of truth: the art-direction bible (one
  naturalistic Veluwe at golden hour + screen-by-screen look targets: title →
  world → case-board → each of the 5 games → pause), the felt-progress plan (how
  a completed mission visibly changes the world), the ranked Meshy asset list
  (impact-per-credit, with existing `asset-shotlist` ids + rough credit estimates
  + never-scary notes), and the per-screen "excellent" bar (VISION §9). **Verify
  by:** the doc exists and is committed as the run's first act; it covers all six
  screen groups + felt-progress + the ranked asset list + the frozen contracts.
- [x] GATE-P0 · **Fable seeds the cohesion ledger from the doc + current pixels.**
  Capture the current (Run B final) state, read RUN-C-DIRECTION.md, and for EACH
  downstream phase (1–5) APPEND concrete `- [ ] Pn.m` cohesion boxes with
  verify-bys that operationalize the doc against what the current screenshots
  actually show. Do NOT tick this gate until each phase carries real, specific
  boxes (the seed boxes below are a floor, not a ceiling). **Exit of Phase 0.**

## Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)

- [x] P1.0 · Frame the board face on approach + re-prove the proportion baseline [both] — F-19's follow-camera work: when the player enters the board's near-radius, gently damp-turn the follow camera (player-initiated by walking in; a CUT under reduced-motion) and/or angle the board face toward the natural hub approach, so the board FACE + papers and the whole ranger are in shot at believable scale; expose a board-in-frustum boolean on the dev hook (retry from the Run B parked list) · verify-by: fresh `22-board-affordance` shows the board face with papers readable AND the ranger fully in frame at believable proportion (assert: board-in-frustum true while `board.near`; `avatar.height` ∈ [1.5,2.0]; drawCalls <150)
- [x] P1.1 · **Unify the lighting + sky to the golden-hour touchstone [both].**
  One warm naturalistic light/sky/fog model shared by title → world → board →
  games so no screen reads as a different game. **Verify by:** shot (title,
  world-entry and a mission frame share the same light/palette) + assert
  (`drawCalls` < 150, pixelRatio ≤ 2 unchanged).
- [ ] DEFERRED · P1.2 · **Naturalistic terrain + ground materials [both].** Replace flat/
  stylized ground with believable heide · bos · stuifzand · ven materials + soft
  blob shadows so realistic animals will belong. **Verify by:** shot (each biome
  reads as real Veluwe ground) + assert (`drawCalls` < 150).
- [ ] P1.3 · **Trees + world props to one fidelity [both].** Mixed species/sizes,
  consistent material language with the staged prop cast; no low-poly outlier
  next to a realistic asset. **Verify by:** shot (tree line + props read as one
  world) + assert (draw-call budget held).
- [x] P1.4 · **Title screen on-style + grounded [both].** Golden-hour backdrop,
  grounded avatar/props, per-sentence ≤7-word subtitle lines. **Verify by:** shot
  (title belongs to the same world as world-entry; subtitle lines ≤7 words).
- [x] P1.5 · **Case-board (prikbord) + pause on-style [both].** The hub board and
  the pause overlay share the world's palette + one static scrim; legible,
  ≥56 px controls. **Verify by:** shot (board + pause read as the same world; no
  jarring UI skin) + assert (named controls ≥ 56 px).
- [ ] P1.6 · **Each of the 5 game surfaces on-style (3D + 2D floor) [both].**
  zoeken · corsi · simon · dagnacht · wisselen each read as the same naturalistic
  Veluwe (their diegetic ranger framings, VISION §5), 2D floor included; no
  bolted-on-puzzle look. **Verify by:** shot (all five, 3D + 2D floor, on-style)
  + assert (construct-parity intact, draw-call budget held).
- [ ] P1.7 · Piglet + gras props must read as what the prompt names [both] — F-24 residue: give the frisling a readable young-boar silhouette (ears + snout + legs + the goudgele "pyjama"-strepen per de direction doc §2.4; CALM pose per never-scary) and make "het gras" props read as grass tufts, not rock lumps; add F-24's mission-target-in-frustum boolean at mission start (retry from the Run B parked list) · verify-by: fresh `24-mission-3d` shows the piglet recognizably a striped young boar beside props that read as gras (assert: mission-target-in-frustum at mission start; drawCalls <150)
- [ ] P1.8 · Soften the drifting cloud-shadow layer [both] — reduce cloud-shadow opacity and/or feather the edge so terrain stays readable inside a passing shadow; keep the calm drift (its reduce-motion freeze stays a Phase 5 concern) (retry from the Run B parked list) · verify-by: fresh walk + drive bursts (`09-walk-4`/`10-walk-5`/`21-jeep-drive-4`) show dark masses as soft passing clouds with ground detail still visible inside them
- [ ] P1.9 · Instellingen exit on-screen without scrolling [both] — the last off-fold trap of Run B's navigation law (P3.2 residue): keep `.tw-back` (≥56 px) visible without scrolling (sticky footer like `.av-klaar`/the board fix, or scroll the toggle list INSIDE the panel); no toggle row cut mid-row; no tap target below 56 px (retry from the Run B parked list) · verify-by: fresh `33-instellingen-rm` shows `.tw-back` fully on-screen in the 800 px viewport with all toggle rows whole (assert: `.tw-back` ≥56 px and its bounding box inside the viewport) — P0-gate note (2026-07-04, 22:26 set): still live, `.tw-back` asserts at y=1404 in the 800 px viewport; P1-gate note (2026-07-05): the fresh set has NO instellingen frame at all — the reduce-motion-toggle scene GAPs (`.explore-pause` resolves but its click times out 10 s), so restore that capture scene with this fix
- [ ] P1.10 · **Capture coverage for the five game surfaces + stale-frame hygiene [laptop]** (director append at the P0 gate, 2026-07-04) — the P1 gate/P1.6 cannot be judged from the current set: the fresh capture holds ONE mission frame (`29-mission-3d`, zoeken) and NO frames of corsi · simon · dagnacht · wisselen nor any 2D floor; the evidence dir also keeps orphan PNGs from older shot-numbering runs (stale `15-pause-hub`/`32-boundary-rim` beside fresh `16-pause-hub`/`42-boundary-rim`) that can mislead a judge into grading an old frame. Extend `app/e2e-capture/**` (allowed) to shoot each of the 5 games in 3D AND its 2D floor, and make capture remove orphan PNGs not in the fresh annotations. **Verify by:** fresh set contains named frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
- [ ] P1.11 · **ONE label language: world POI chips + HUD hints on-style and legible [both]** (director append at the P0 gate, 2026-07-04) — fresh `14-camera-orbit` shows mission POI markers ("De oversteek", "De wildcamera"…) as tiny charcoal chips floating mid-air over the tree line: unreadable at gameplay distance for a dyslexic reader and foreign to the doc's warm-paper overlay language (§3); the HUD hint/tracker chips carry the same dark-chip style; P1-gate note (2026-07-05): the same tiny dark chips also label the game scenes (`das`/`wild zwijn`/`ree`/`raaf` in simon, `open plek`/`Bordje`/`het hol` in wisselen) — one warm language everywhere. Restyle world markers + HUD chips into the one warm panel language with a legibility floor (hide labels beyond their readable range or grow them; leesletter-vriendelijk), give world markers a visible anchor to their spot, keep any tappable marker ≥56 px. **Verify by:** shot (fresh orbit + walk frames: every visible label legible + on-style, none floating unanchored) + assert (tappable markers ≥56 px; drawCalls <150).
- [ ] P1.12 · **The hub clearing composed as the cosy heart [both]** (director append at the P0 gate, 2026-07-04) — fresh `13-camera-zoom-out`/`03-world-entry` show props dropped on a flat lawn: cabin, board, jeep+heli, warden, orphan fence segments and tents scattered with no connecting ground language. Compose the clearing per doc §3.2: a dirt path linking cabin porch → prikbord → jeep track, props clustered purposefully, no orphan prop alone in the grass field. **Verify by:** shot (fresh `03-world-entry` + a zoom-out frame read as one composed place — a path visibly links cabin/board/jeep) + assert (drawCalls <150).
- [ ] P1.13 · **Close framing never buries the ranger [both]** (director append at the P0 gate, 2026-07-04) — fresh `12-camera-zoom-in` and `39-reduce-motion-reframe-before` show the ranger cut at the waist by the near terrain: a half-buried read (hands splayed over a ground bulge, no legs or ground contact in frame). The player-initiated zoom/reframe must land so the whole ranger keeps ground contact in frame (feet visible, or at minimum knees + contact shadow) — never swallowed by a terrain rise between camera and subject. **Verify by:** shot (fresh 12 + 39 show the ranger's ground contact) + assert (`avatar.height` ∈ [1.5,2.0] unchanged; `cam.target`="avatar").
- [ ] P1.14 · **Mission spotlight = golden tint, never near-black [both]** (director append at the P0 gate, 2026-07-04) — fresh `29-mission-3d` vignettes the zoeken scene with a near-black surround; doc §2.1's law is "tint, never darkness" (never-scary; golden hour everywhere). Rework the mission focus treatment as a warm dusk/golden grade with readable surroundings. **Verify by:** shot (fresh mission frame: surround readable and warm, no near-black frame edges) + assert (drawCalls <150).
- [ ] P1.15 · **The game-3D scenes stage the STAGED cast — never the photo-billboard ring [both]** (director append at the P1 gate, 2026-07-05) — fresh `40–44 game3d-*` frames ring every game with flat photo-sprite billboards on a bare tan void: a WOLF sprite in corsi/simon/dagnacht/wisselen (the wolf is story-gated and may never appear as a casual distractor — never-scary + canon), a coiled adder scaled like a boulder (canon: ~55–60 cm, at the ranger's feet), a ghost-white human cutout, and the ranger himself as a flat 2D sprite. Replace the billboard cast with the staged GLB models at canon scale (hide species a scene doesn't need), seat every subject on real dressed ground per the direction doc §3.4–3.8, and point the capture at the SAME 3D surface the player actually reaches in a mission — `29-mission-3d` differs structurally from the `?sandbox` route, so today's game-3D evidence may not even be the shipped screen. **Verify by:** fresh five-game 3D frames from the player-reachable mission path show only staged 3D models at canon scale (no photo billboards, no wolf, adder a ground-level coil) + assert (drawCalls <150).
- [ ] GATE-P1 · **Fable re-judge — does it read as ONE naturalistic world?** (2)
  Capture; judge cohesion across title → world → board → 5 games → pause against
  the doc. Re-open or append. May append new dressing boxes. **Exit of Phase 1.**

## Phase 1.5 · playability first — correctness before more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)

> Floris hit these in a real-device demo. They are PHYSICS/INTERACTION bugs a
> screenshot gate cannot see (the Run-1 false-green trap) — so each is verified by
> the capture harness DRIVING the action and asserting real dev-hook state, NOT by
> a static shot, and each ALSO carries a +demo Floris must confirm on the real iPad.
> READ FIRST: research/3d-autonomous-sourcing-physics-world.md §C (character
> controller — three-mesh-bvh/BVHEcctrl or Rapier+ecctrl). Prefer an in-repo fix;
> a NEW well-licensed (MIT/Apache/CC0/BSD) self-contained dep IS authorized (Run C
> contract) where it clearly fixes the controller and holds the budget, and
> web-search/fetch for the current best fit is allowed. Every fix still holds <150
> draw calls, pixelRatio ≤2, iPad-first, build + e2e:smoke green, motion-comfort +
> never-scary, no runtime network/telemetry/CDN, no new localStorage keys.

- [ ] P1.5a · **The ranger never sinks through the floor/terrain [both] +demo** — ground the character controller so the ranger stays ON the terrain + solid props everywhere he can walk (spawn, slopes, the dunes behind spawn, hub, every mission scene). Expose dev-hook `grounded` (boolean) + foot-clearance (ranger y minus terrain height). Extend the capture harness (app/e2e-capture/**, allowed) to walk a burst across spawn → slope → dune. **Verify by:** assert (`grounded`=true every frame of the walk burst AND foot-clearance ≥0 — never below terrain — across spawn/slope/dune) + shot (feet on the ground, no half-buried frame); drawCalls <150. +demo: Floris walks the real iPad over the dunes without falling through.
- [ ] P1.5b · **The jeep actually drives — it translates through the world, no stick-and-slide [both] +demo** — pressing drive moves the jeep's WORLD POSITION forward along its heading with believable ground contact; no sliding-in-place, no snap. Expose the jeep's per-frame world-position delta on the dev hook (`vehicle().position` already exists). Extend the harness to drive a forward + held-turn burst. **Verify by:** assert (`vehicle().position` displacement ≫0 and monotonic along heading across the drive burst, jeep stays grounded, heading changes smoothly with no wrap-jump) + shot (jeep visibly further along the track between frames). +demo: Floris drives on the real device and it moves naturally, not stuck.
- [ ] P1.5c · **The helicopter can be enabled in Instellingen AND entered [both] +demo** — wire the whole path end-to-end: the `helikopter` toggle in Instellingen is reachable + tappable (≥56 px, on-screen — COUPLE with P1.9's off-fold fix so it isn't below the fold), turning it on makes `heliAvailable` true, the "🚁 Stap in de helikopter" affordance appears at a pad, and tapping it enters. Extend the harness to open Instellingen → toggle helikopter on → walk to a pad → enter. **Verify by:** assert (the helikopter toggle bounding-box inside the viewport + ≥56 px; after toggling on `heli().available`=true; at the pad `heli().near`=true; after the enter tap `heli().inHeli`=true) + shot (the toggle on-screen in Instellingen; the enter affordance at the pad). +demo: Floris turns it on in Settings and flies pad-to-pad on the real iPad.

## Phase 1.6 · Alvah is Alvah — child proportions + his real face  (Floris 2026-07-05: he's dwarfed by the mature ranger, and wrong-coloured)

- [ ] P1.6a · **Alvah is a CHILD: fix his height + set adult humans to 1.8 m [both]** — Alvah is 8 and ≈ **1.2 m**, not the ~1.7 m adult the code currently uses (`RANGER_STAND_HEIGHT` / `STAND_HEIGHT['ranger-alvah']` = 1.7 in [AnimalScale.ts](../../app/src/render3d/AnimalScale.ts) — fix to ~1.2 m child). Any mature human (the mature ranger/boswachter NPC) stands ~**1.8 m**, so Alvah must read a clear head-and-shoulders shorter beside one. Expose the mature-human height on the dev hook alongside `avatar.height`. THIS SUPERSEDES Run B's ~1.7 m target and the inherited `avatar.height ∈ [1.5,2.0]` assert — Alvah's band is now child-scale. Scale the rig, not the camera; keep animations + foot-on-ground intact. · verify-by: assert (`avatar.height` ∈ [1.1, 1.35]; the mature human ∈ [1.7, 1.9]; Alvah < 0.75 × the adult) + shot (Alvah beside the mature ranger reads unmistakably as a child next to an adult); drawCalls <150.
- [ ] P1.6b · **Alvah's face is Alvah's: blonde hair + blue eyes [both] +demo** — the real Alvah is **blonde, wavy-haired, blue-eyed** (reference: `public/img/Alvah.jpg`); the current `ranger-alvah` model is dark-haired + green-eyed (`app/assets-gen/ranger-alvah.png`) — wrong. Make hair read blonde + wavy and eyes clear blue, keeping the calm never-scary stylized look + the green ranger jacket. If regenerating via Meshy: `node scripts/meshy-gen.mjs --only=ranger-alvah` with a prompt citing the reference (log the credit spend); else recolour the hair/iris materials in-repo (cheaper, no credits). Keep the avatar-creator + `alvah-ef-v1` persistence intact. · verify-by: shot (title + world ranger: hair reads blonde, eyes read blue, resembles public/img/Alvah.jpg) + assert (drawCalls <150; calm never-scary pose). +demo: Floris confirms it looks like Alvah on the real iPad.

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
- [ ] P2.10 · **Species must read at gameplay distance, grounded [both]** (director append at the P0 gate, 2026-07-04) — in the fresh set every world animal is a featureless dark blob at follow distance (`19-jeep-near`, `23-jeep-drive-3`); a regenerated flagship that only reads in close-up fails the world. For each upgraded animal: the §2.4 must-read silhouette + palette read AT the follow-camera distance under the golden key (material/fill response tuned), the canon scale order held, and a soft blob shadow grounding it (3d-animal §A6). **Verify by:** shot (an overworld frame per accepted animal at follow distance where the species is identifiable) + assert (drawCalls <150).
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
- [ ] P3.4 · **Before/after evidence pair in the capture [laptop]** (director append at the P0 gate, 2026-07-04) — the P3 gate needs pixels no current scene provides: extend `app/e2e-capture/**` to drive ONE mission to completion (or inject its completion state via the dev hook) and shoot the SAME world spot + the board before and after at the same camera pose, plus the badge-earn moment (P3.3's evidence). **Verify by:** fresh set contains a paired before/after frame set + a badge-moment frame, with annotations showing the reaction derives from mission state (no new persistence keys).
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
- [ ] P4.5 · **Vehicles parked diegetically — the heli has no home [both]** (director append at the P0 gate, 2026-07-04) — fresh `13-camera-zoom-out`/`19-jeep-near` show the helicopter dumped on the hub lawn right behind the missiebord, and `25-jeep-straight-1` shows it loose in the stuifzand beside the jeep: vehicles read as dropped props, not ranger equipment. Give each a believable home that serves P4.2's diegetic role — the jeep on a two-track by the cabin, the heli on a marked ranger helipad (hub edge or a far station) — both seated on terrain, neither crowding the board/cabin sightline. **Verify by:** shot (fresh hub + far frames: each vehicle at its home spot, grounded, board approach uncluttered) + assert (vehicle interactions unchanged; drawCalls <150).
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
- [ ] P5.5 · **Mission-beat frames in the capture: briefing → task → reunion [laptop]** (director append at the P0 gate, 2026-07-04) — P5.1/the final P5 gate cannot judge mission dressing from one entry frame: extend `app/e2e-capture/**` to walk missie 1 (frisling) through its briefing, task and reunion beats and shoot each. **Verify by:** fresh set contains the three beat frames with annotations (`screen`/`missionView` correct per beat; drawCalls <150).
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
- **Wording rule for box authors (art director, 2026-07-05).** The supervisor
  dispatches on a box's FIRST physical line: a work box whose first line contains
  `GATE-`, `DIRECTION` or the word `DEFERRED` is misrouted to a gate/direction
  sitting or invisibly skipped (this silently skipped P1.7–P1.9 and served P1.10
  as a phase gate on 2026-07-05). Write `P0-gate append`, `direction doc`,
  `parked list` instead. Only real gate boxes start `GATE-Pn`; only the parked
  marker `[ ] DEFERRED ·` carries DEFERRED; only Floris boxes carry `DEMO ·`.
