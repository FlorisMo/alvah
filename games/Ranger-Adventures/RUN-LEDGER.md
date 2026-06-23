# Ranger van de Veluwe — Run Ledger (the resumable checklist)

> **This is the single source of truth for "what's done / what's next."** The autonomous run ticks each box
> the moment a step is finished AND targeted-tested (BUILD-PLAN §9a/§9e). **A fresh thread resumes by reading
> this top-to-bottom and doing the first unchecked `[ ]`.** Keep `RUN-STATUS.md` (live snapshot) in sync.
> Rules: split a step that's larger than expected into sub-steps here first (§9d); audit after each stage
> (§9f); never advance on a failed audit. Approx weights in (parens) feed the ~% in RUN-STATUS.md.

## Phase 0–3 — spine, content, meta core  ✅ DONE (Jun 2026 pass)
- [x] Phase 0 scaffold (Vite+TS+Three, golden-hour stage, draw-call budget overlay)
- [x] Phase 1 spine + all 5 EF engines (2D views, ENGINE_VIEWS, skill/DDA, localStorage)
- [x] Phase 2 content — 10 missions, 5 engines × 4 landscapes, season/poacher arc as data
- [x] Phase 3 meta CORE — mission wrapper (lodge→briefing→play→fact→reward), breinkracht badges, knap-woord
- [x] Phase 3 remainder · case-board screen — verhaalboog clues derived from completed verhaalHaak-missions (data gate) + hopeful ontknoping; prikbord overlay reachable from the lodge (2)
- [x] Phase 3 remainder · companion+rehab STATE — `core/companion.ts` pure model (soort/fase/bond/kunstjes/meeOpMissie + rehab) + state.ts mutators (rescue→bondDelta→grow→mee, startRehab/releaseRehab) + persistence/migration; seeded unit test (1)
- [x] Phase 3 remainder · companion+rehab UI — CareRoutine care-skin feeds simon/dagnacht skill records (order=simon, over-handle=dagnacht); cabin/perch screen (rescue + daily care + opvang release) reachable from the lodge (1)
- [x] Phase 3 remainder · avatar creator UI + avatar state threaded through copy/voice (naam/huid/haar/outfit/iris; "Alvah" default injected into briefing/fact/reward + narrator) (1)

## Asset pipeline  ◑ IN PROGRESS
- [x] meshy-gen preview→refine + poly target; gltf-optimize (meshopt+WebP+DRACO); audio-fetch (xeno/Freesound, licence log); finalize watcher
- [x] Core cast generated (33/76 renders): 3 humanoids, 7 Meshy animals, 14 base props, 9 birds
- [x] Ranger rigged via Meshy API (proof); rigged GLB saved to assets-gen/animated/
- [x] Generate remaining renders · batch A — gameplay-critical cast: immersion/tracking props + core birds + fox/ree/edelhert/heideblauwtje (shotlist items 1–23) (3)
- [x] Generate remaining renders · batch B — story + vehicles + seasonal variants (shotlist items 24–37: ecoduct/boa-post/bird-hide/nest-box/snare/raven-nest, jeep/helicopter, oak/birch/heather autumn+winter, snow-mound) (2)
- [x] Generate remaining renders · batch C — finishing props + last birds (shotlist items 38–43: raaf-fledgling, anthill/foxglove/acorn-cluster, buizerd, wilde-eend) (1)
- [x] Rig the 2 remaining humanoids via Meshy API (warden, poacher) (1)
- [x] **Anything World pipeline · script** — `scripts/anything-world.mjs`: wire `ANYTHING_WORLD_API` (app/.env.local), preflight `/credits`, rig→animate→download to `assets-gen/animated/<id>.glb`, idempotent + manifest-recorded; AW-eligible cast = 8 quadrupeds + 23 birds; adder/heikikker/butterfly stay procedural; defensive field-probing for the experimental API (2)
- [ ] **Anything World pipeline · generation** — loop/Floris-owned external paid job (~31 models, ~2 AW runs). Needs source GLBs in `assets-gen/<id>.glb` (Meshy gen) + AW credits; NOT runnable in a sandboxed thread. Run: `node app/scripts/anything-world.mjs`. The loader "prefer animated GLB over procedural" lands in the procedural-fallback + optimize/stage boxes below (2) — **⏸ BLOCKER (sandbox): external paid AW job, not runnable in a sandboxed thread (only the 3 Meshy humanoid rigs exist in `assets-gen/animated/`). Loop/Floris owns this (§9c). The procedural-fallback box below makes the whole cast move + the game fully playable meanwhile; the mixer path is wired + dormant, ready to prefer the animated GLBs the moment they're staged.**
- [x] Procedural motion fallback for all animals; snake+frog procedural (slither/hop) (3)
  - [x] 29a · `render3d/ProceduralMotion.ts` — pure per-species gait recipes (breathe/hop/slither/flutter/paddle/still), `calmGate()` amplitude+speed clamp (never-scary §B / motion-comfort §C), `motionAt(recipe,t,phase)` deterministic delta; seeded unit test (bounds · slither-no-vertical · hop-arc-rests-never-frozen · still=identity) (1)
  - [x] 29b · wire into `World.ts` (replace ad-hoc idle bob with per-marker recipe by modelId; off under reduced-motion) + `Models.ts` "prefer animated GLB" hook (return clips; AnimationMixer when a rig exists, else procedural) (1)
  - [x] 29c · snake (adder) slither + frog (heikikker) hop + butterfly flutter verified against the §B AVOID lists; reduced-motion path checked (1)
    - **§9f AUDIT PASS** (build-green, 9/9 unit): adder = flat lateral weave, dy/rotZ/scaleY all 0 (no S-coil rear-up / no puff); frog = arc completes + rests each cycle, dy≥0 (never frozen mid-leap, never sinks), apex ≤0.16 m, airborne <50% of cycle (calm); squirrel/quadrupeds = slow breathe hz≤0.5 (no rapid tail-flick); raven/buizerd/nightjar = calm-perched breathe (no hackles/bill-up/gape modelled); butterfly flutter + duck paddle clamped by `calmGate()`. Reduced-motion freezes all secondary motion to REST (mixer `update(0)`); transform-only → zero draw-call impact. Never-scary + motion-comfort gates: PASS.
- [x] Optimize + stage every animated GLB; re-run finalize (1)

## Phase 4 — 3D world + in-world play  ◑ FIRST PASS done; immersion next
- [x] World first pass: procedural Veluwe, generated cast loaded, §1e damped-follow camera, tap-to-walk/walk-up-to-play
- [x] World build-out: THREE.Terrain biomes (heide/bos/stuifzand/ven), instanced vegetation/props, character controller (three-mesh-bvh), wayfinding + diegetic HUD (5)
  - [x] 38a · `render3d/Biomes.ts` — pure biome field: `biomeAt(x,z)` → heide|bos|stuifzand|ven (noise-warped sectors radiating from the lodge clearing, each guaranteed present), `heightAt(x,z)` continuous global relief + a smooth ven basin (no cliffs at sector boundaries), per-biome palette (ground/accent/vegetation kind). Seeded unit test (determinism · all 4 biomes present · no-cliff continuity · ven basin lowest · central clearing = heide) (2)
  - [x] 38b · Wire Biomes into `World.ts` — vertex-coloured ground by `biomeAt`, `heightAt` replaces local `groundY`, biome-aware scatter (pines→bos, heather→heide, marram/grass→stuifzand, reeds + a calm water plane→ven); markers anchored in their mission's `landschap` biome; keep draw calls < 150 (1)
    - **§9f AUDIT PASS** (build-green, Biomes 7/7 unit): four landschappen radiate from the lodge clearing as noise-warped sectors (test proves all 4 present, none warped away); relief is one continuous field (sum-of-sinusoids + a single Gaussian ven basin) — test asserts <0.5 m/m slope everywhere ⇒ **no cliff at any seam** (a wall would break never-scary); ven basin is the lowest ground + holds a **still** water plane (no waves → motion-comfort §1e); vegetation is biome-keyed + static (pines/heather/marram/reeds), only the animal markers move (procedural §29). Draw calls ≈ ground+water+4 instanced veg + ~10 markers ≈ **<45 (<150 ✓)**. Markers now anchored in their own `landschap` (mission biome via `m.landschap`). Never-scary + motion-comfort + tone gates: PASS. (Screenshot deferred to the Deep Demo capstone — the §5/§8b screenshot gate; no headless WebGL in-sandbox.)
  - [x] 38c · Character controller — kinematic capsule ground-follow + soft collision so the ranger can't walk through pines / into the ven / out of bounds (three-mesh-bvh or analytic clamp), tap-to-walk preserved, §1e camera untouched (1)
  - [x] 38d · Wayfinding + diegetic HUD — in-world marker labels + a calm direction/distance cue to the active mission (no minimap chrome), veldnotitie-style diegetic HUD; ≥56px, dual-channel, reduced-motion-safe (1)
    - **§9f AUDIT PASS** (World build-out complete · build-green · render3d 31/31 unit: Controller 8 + Wayfinding 8 + Biomes 7 + ProceduralMotion 9). **Controller** (`CharacterController.ts`, pure analytic clamp — NO new dep, deterministic + seed-tested): per-frame step is resolved by soft circular pushout around pine trunks (2 passes → slides, never stops dead = motion-comfort §1e), a circular world bound (no walking off the edge), and a no-wade predicate. **Bug caught + fixed in this audit:** the no-wade was a *global* height threshold, but `heightAt`'s dry rolling troughs reach ≈−2.2 m → that would have raised **invisible walls on dry land** (breaks never-scary). Fixed to a **ven-disc predicate** (inside the water circle AND below the surface only); added a regression test (`a dry trough … is NOT mistaken for water`). Facing follows the *actual* slid motion (natural turn, no snap). **Wayfinding** (`Wayfinding.ts`, pure): bearing is *relative to facing* (turn-left/ahead/right, never an absolute compass a child must rotate), cue is **dual-channel** (arrow glyph + M3/E3 words "naar links · 40 m" + the mission colour pip) rendered into a **veldnotitie strip** (no minimap chrome, ≥56px, `aria-live`, debounced so it only re-renders on word change; reduced-motion-safe = text swaps only, no transitions). **In-world labels** = camera-facing sprite name-tags (`depthWrite:false`). Draw calls ≈ ground+water+4 veg+ranger + per-marker ring/model/label ≈ **~55 (<150 ✓)**. Never-scary + motion-comfort + tone gates: PASS. (Screenshot deferred to the Deep Demo capstone — §5/§8b gate; no headless WebGL in-sandbox.)
- [ ] 3D play harness: `render3d/engines/`, `WorldCtx`, `ViewMode` resolver, shared kit (pick3d/highlight3d/anchoredPrompt/spoorTrail/reframe) (3)
  - [x] 45a · Harness contracts + `ViewMode` resolver (pure) — `render3d/play/ViewMode.ts` (`resolveViewMode(req)→'2d'|'3d'`: 3D only when scene live AND WebGL-capable AND engine has a green 3D variant AND not force-2D AND motion-ok-or-rmSafe; else the 2D floor) + `render3d/play/types.ts` (`WorldCtx`, the `Play3dFn` contract, the `Play3dEngine` registry shape). Seeded unit test (reduced-motion→2d unless rmSafe · no-WebGL→2d · engine-not-ready→2d · force2d→2d · all-go→3d · deterministic) (1)
  - [x] 45b · Shared 3D interaction kit `render3d/play/kit.ts` — pick3d (raycast + ≥56px projected hit-sphere sizing), highlight3d (emissive colour + scale pulse, static under reduced-motion), anchoredPrompt (reuse the accessible DOM card), spoorTrail (instanced clue meshes along a spline), reframe/cut (§1e damped move or hard cut). Pure geometry helpers (hit-sphere world-radius for a target px, spline sampling) carry a unit test; build-green (1)
  - [x] 45c · In-place mission flow — build `WorldCtx` from the live `World`, branch `runMission` once on `resolveViewMode` (3D plays in-place, world stays loaded, no `leaveWorld`; else today's 2D path), proven with one diegetic engine adapter; 2D fallback unchanged; build-green (per-engine parity tests land in the Phase-II variant boxes) (1)
    - **§9f AUDIT PASS** (3D play harness COMPLETE · build-green tsc+vite · render3d 19/19 unit ViewMode+kit-math). `World.ctx()/beginActivity()/endActivity()` expose the live scene/camera/raycaster/canvas as a `WorldCtx` and freeze the world in-place (movement·walk-taps·proximity·wayfinding·§1e follow all pause so the activity's reframe owns the camera; `endActivity` snaps the follow back behind the ranger). `Missions.runMission` makes the **single §1f branch** on `resolveViewMode` (sceneLive=`!!world` · `WEBGL_OK` probed once · `REGISTRY_3D` · force2d=false until the Phase-6 Tweak) inside a `try/finally` so the world is never left frozen on a throw. **2D floor unchanged:** lodge-launched missions (world null → 2D), every engine without a shipped variant (corsi/simon/dagnacht/wisselen → `variantFor` undefined → 2D), and no-WebGL → 2D. First diegetic adapter **`render3d/engines/zoeken3d.ts`** is construct-faithful — reuses the frozen `buildZoekenTrial`, emits the identical `{trials:1,correct}` (correct=first-tap), changing only spatial layout (target+decoys on the heath patch) + input (raycast picks). Never-scary/motion-comfort: target "drukt zich" (still), dual-channel `Highlight3d` (emissive colour + calm scale breath, freezes under reduced-motion), §1e damped `makeReframe` (cuts under reduced-motion; dt-clamped), `rmSafe:false` ⇒ resolver serves the 2D floor under reduced-motion (no 3D camera move there); ≥56px `pick3d` hit-spheres (`visible:false` → 0 draw-call cost); all words + read-aloud in the accessible DOM card. Draw calls ≈ World ~55 + ~11 visible activity meshes ≈ **~66 (<150 ✓)**. The zoeken **seeded parity test** + tracking enrichment land in the Phase-II zoeken box (52). Never-scary + motion-comfort + tone + construct-parity gates: PASS. (Screenshot deferred to the Deep Demo capstone — no headless WebGL in-sandbox.)
- [ ] Diegetic variant: dagnacht (+ seeded parity test) (2)
- [ ] Diegetic variant: corsi (+ parity test) (2)
- [ ] Diegetic variant: simon (+ parity test) (2)
- [ ] Diegetic variant: zoeken (+ parity test) + tracking enrichment (spoor→kijker→wildcamera→case-board) (3)
- [ ] Diegetic variant: wisselen (+ parity test) (2)
- [ ] Immersion layer: veldnotitie entry, continuous patrol, case-board wiring, light world-EF seasoning (3)
- [ ] **AUDIT** (§9f): construct-parity all green, never-scary/motion-comfort/tone, <150 draw calls, screenshots

## Phase 5 — expression, eyes, reduced-motion
- [ ] Eye shader (catchlight/clearcoat/parallax; per-species pupil; dusk eyeshine list) (2)
- [ ] ARKit-subset face system (data-driven emotion recipes) + animal calm-pose set (3)
- [ ] Full 3D reduced-motion mode (per-view cuts-not-moves) (2)
- [ ] **AUDIT** (§C.5 QA checklist)

## Phase 6 — accessibility + audio + Tweaks
- [ ] M3/E3 copy pass; read-aloud + karaoke word-clock (iOS-safe) (3)
- [ ] ≥56px / dual-channel audit; Tweaks panel wired; ambient audio layer (2)
- [ ] **AUDIT** (a11y + tone word-lint)

## Phase 8 — Astro integration → alvah.nl/ranger  (now in run scope, §9g)
- [ ] Re-wrap app under `/ranger` route behind the access gate (`alvah-gate-v1`); robots Disallow; no trackers (3)
- [ ] Migrate localStorage `ranger-mvp-state` → `alvah-ef-v1`; reuse `src/scripts/` where it fits (2)
- [ ] Demo-skip options: jump to any area/mission/engine, skip briefings, fast-forward the arc (2)
- [ ] Deploy — **direct commit + push to main after every phase** (Floris approved; auto-deploys via the Astro GitHub Action); robots stays Disallow (1)
- [ ] **AUDIT** + full end-to-end pass + complete unit run (the ONLY full E2E, §9e)

## Capstone
- [ ] Deep Demo built (boot→avatar→free-roam→meet realistic ranger+animals→hear voice→play 5 engines in-world→arc+companion+badges) (2)
- [ ] Auto-QA report (draw calls, a11y, persistence, tone lint) + screenshots → Floris review (1)

## Human tail (post-demo, non-blocking — NOT the run's job)
- [ ] 4 morph-creatures (adder slither, frog hop + metamorphosis, antler morph) — Blender
- [ ] Alvah's exact-face likeness preset — Blender
- [ ] 10-min iPad/Alvah playtest (motion-comfort, real-word feel, difficulty) → fine-tune list
