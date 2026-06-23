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
- [ ] Optimize + stage every animated GLB; re-run finalize (1)

## Phase 4 — 3D world + in-world play  ◑ FIRST PASS done; immersion next
- [x] World first pass: procedural Veluwe, generated cast loaded, §1e damped-follow camera, tap-to-walk/walk-up-to-play
- [ ] World build-out: THREE.Terrain biomes (heide/bos/stuifzand/ven), instanced vegetation/props, character controller (three-mesh-bvh), wayfinding + diegetic HUD (5)
- [ ] 3D play harness: `render3d/engines/`, `WorldCtx`, `ViewMode` resolver, shared kit (pick3d/highlight3d/anchoredPrompt/spoorTrail/reframe) (3)
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
