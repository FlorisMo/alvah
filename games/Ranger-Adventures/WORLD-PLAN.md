# WORLD-PLAN — Ranger van de Veluwe, run 2: één immersieve 3D-wereld

> Master spec for the second autonomous run. The tickable checklist is
> [WORLD-LEDGER.md](WORLD-LEDGER.md); the supervisor is `world-run-loop.sh`.
> Run 1 (RUN-LEDGER.md, BUILD-PLAN.md) is DONE and archived — do not re-tick or
> edit those files. BUILD-PLAN §7 (already built) still applies. Where
> BUILD-PLAN §9 and this plan disagree, THIS PLAN WINS.
>
> Written 2026-07-02 after a full deep-read plus an empirical headless-browser
> session that reproduced Floris's complaints; hardened the same day by a
> three-way adversarial audit (outcome trace, mechanics dry-run,
> contracts/child-safety). Every claim in §1 was verified against the code or
> observed in a live browser.

## 0. Goal (what Floris asked for, 2026-07-02)

One immersive 3D experience: an open-world Veluwe you boot straight into and
walk around in, with the EF mini-games and biology content embedded in the
world where relevant. Alvah (8, dyslexic AVI M3/E3, motion-sensitive,
Pokémon fan) is the player. iPad touch is primary; a laptop with at least
arrow keys must also work — walking, and eventually the jeep and helicopter.

Product decisions taken by Floris this session (do NOT re-litigate):

1. **Inputs:** touch joystick + tap-to-walk on iPad; arrow keys (and WASD) on
   laptop. Vehicles (jeep, helicopter) drivable with the same inputs, later
   phases. The joystick supersedes the "touch-d-pad" of the locked design
   line `design/3d-animals-build-plan.md:714` by Floris's 2026-07-02
   decision; the WASD/arrows + single interact-prompt parts of that locked
   line stand.
2. **Camera:** rotating follow-cam that eases behind the ranger as he turns
   (damped, roll 0, fixed FOV). Reduced-motion falls back to the current
   fixed-bearing cam. A toggle in Instellingen keeps both testable on device.
3. **Animations:** keys restored; the run re-generates and rigs the ranger via
   Meshy (walk/idle clips). **Animals: CC0/CC-BY pre-animated packs
   (Quaternius e.a.) are the PRIMARY path** (Floris, 2026-07-02: don't wait
   on Anything World — whose key is in .env.local but was REJECTED with HTTP
   403 at preflight on 2026-07-02; their processing API needs an
   authorization email first). Improved procedural motion stays the fallback
   for animals without a credible pack match.
4. **New dependencies approved:** `@playwright/test` (dev-only browser test
   harness — mandatory) and Rapier (`@dimforge/rapier3d-compat`) — the latter
   only via the W5.4 spike gate, see §3.3. Nothing else without asking.
   CC0/CC-BY *assets* (models/animations/audio) are fine with a license log.
5. **Branch policy:** the run works directly on `main` — the live site is not
   in use, so branch isolation would only clutter. Every phase-boundary push
   deploys to alvah.nl behind the gate; that is intended.
6. **Accuracy:** a dedicated web-research pass per animal (W3.4a/b) grounds
   the visualization (sizes, coats, eye color, posture, gait character) and
   the biology facts in sourced reality — no invented facts.

## 1. Verified current state (2026-07-02, this session)

What actually happens today (reproduced headless with Playwright, Chromium):

- Boot: title card "Word boswachter" over a static backdrop of 7 primitive
  cone-pines → "Begin" → 2D avatar creator → 2D lodge with 10 mission cards.
  The walkable world sits behind ONE button ("Verken de Veluwe (3D)") among 9.
- In the world: a Meshy ranger stands on a 240×240 m procedural heightfield
  (4 biomes, instanced primitive vegetation). HUD hint: "tik op de grond om te
  lopen".
- **The only movement input in the entire app is canvas `pointerdown`**
  (`app/src/render3d/World.ts:125`, handler ~`:439`). Grep confirms zero
  keydown/keyup/Gamepad/touch-gesture listeners anywhere in `app/src`.
  Arrow keys and WASD do nothing.
- **Empirically, even tap-to-walk did not move the ranger** in the headless
  session (identical screenshots after ground taps at multiple points). The
  code path looks correct on paper (raycast → target → `resolveMove`), so the
  cause is unproven: candidates are a paused/throttled rAF loop, the world
  being in an activity/patrol state that drops taps (`World.ts:440`), or a
  headless artifact. W0.4 settles this with a red-first E2E test.
- Camera: fixed world-space offset (0, 3.4, 6.2), never rotates with the
  ranger (`World.ts:568-580` `placeCamera`) — reads as a diorama.
- The ranger GLB has **no skeleton** (0 skins, 0 clips) — he glides. 73 of 75
  staged models are static; animals move by procedural bob
  (`ProceduralMotion.ts`). Only ranger-warden-boa and figure-poacher carry one
  baked clip each.
- Mini-games: all five EF engines have parity-tested in-world 3D variants
  (`app/src/render3d/play/registry.ts`), but missions launched from the lodge
  cards run as **flat 2D DOM cards** (world==null → ViewMode '2d'). The 3D
  variants only trigger when a mission is started from inside the world by
  walking to its marker. Biology facts are 2D "Wist je dat" cards.
- Reduced-motion (OS setting OR in-game toggle) forces 4 of 5 mini-games to 2D
  and freezes all animal motion (`ViewMode.ts:52-56`, rmSafe flags). If
  Floris's Mac or the iPad has "Reduce Motion" on, the game looks broken/flat
  without any bug.
- Tests: 229 node:test unit tests pass (run:
  `node --experimental-strip-types --test 'src/**/*.test.ts'` in app/). The
  "229/229 E2E green" commit message was unit tests + curl; **no browser test
  ever existed**. CI (`.github/workflows/deploy.yml`) deploys with zero test
  gates.
- The draw-call/fps dev overlay renders in production top-right (Budgets.ts).
- Bundle: one 788 kB app.js (211 kB gzip), three.js inlined, no code split.
- Deploy chain works: app `vite build --mode site` → repo `public/ranger/`
  (gitignored) → Astro build → GitHub Pages → https://alvah.nl/ranger behind
  the client-side gate. `app/public/{models,audio,draco}` (~25 MB, 88 files)
  are git-TRACKED as the deploy payload.
- `app/.env.local` was missing from this fresh checkout but has been
  **RESTORED 2026-07-02** from VS Code local history (all keys, see §7).
  `app/assets-gen/` (~790 MB raw Meshy sources + the manifest with task/refine
  IDs) is **gone for good** — re-rigging the existing ranger mesh by refineId
  is impossible → regenerate (~30 cr) + rig (~5 cr). Because that manifest was
  also the generator's idempotency record, `meshy-gen.mjs` now carries a
  staged-model credit guard (skip anything already in `public/models/` unless
  `--only`/`--force`), patched 2026-07-02.

## 2. What already exists — do NOT rebuild

- 240×240 m procedural world: heightfield + 4 biomes + fen basin
  (`Biomes.ts`, pure + unit-tested), instanced vegetation, analytic collision
  (`CharacterController.resolveMove` — takes arbitrary per-frame wantX/wantZ),
  circular rim r=116, water line, wayfinding, patrol loop, biome-reactive
  ambience, proximity "Speel mee" mission entry, in-place 3D mini-games via
  `WorldCtx` + `beginActivity`/`endActivity`.
- 75 optimized GLBs (13 MB): 3 humans, 11 animals, 23 birds, 38 props incl.
  ranger-cabin, fire-watchtower, ecoduct, bird-hide, signpost, case-board,
  jeep, helicopter, real trees w/ seasonal variants. Manifest-driven loader
  with height-normalize + procedural fallback (`Models.ts`; `loadRig` +
  AnimationMixer path is wired and dormant).
- 5 EF engines as pure cores (2D + 3D views, frozen construct-parity contract,
  seeded parity tests), adaptive staircase (`skill.ts`), companion raaf,
  narrator + read-aloud, reading-level lint (`readlevel.ts`, M3/E3 ≤7 words),
  persistence in localStorage `alvah-ef-v1` namespace `ranger` (`persist.ts`).
- Asset pipeline scripts (gen/rig/optimize/audio, idempotent, retry-on-402)
  and the run plumbing (`ranger-run.mjs`: status/tick/assets/gate/commit —
  hardened 2026-07-02: mechanical tick gate, honest push, persistent
  `--blocker`, run-1 `run` guard).
- Motion-comfort law (`MotionMode.ts` + §1e in BUILD-PLAN): fixed FOV, roll 0,
  no head-bob/blur/snap/shake, reduced-motion = cuts not moves, never-scary
  calm-pose gate, never game-over. These are frozen contracts.

## 3. Technical decisions for run 2

### 3.1 Verification: the browser-proof contract (the core fix of this run)

Run 1's fatal flaw: every box self-verified with unit tests + `vite build`
only; no rendered frame or input event was ever checked. Result: "97% done,
229/229 green" while walking was broken. Run 2 changes the definition of done
— and enforces it **mechanically**, not on the honor system:

- W0 adds `@playwright/test` (devDependency of app/) + an `e2e/` suite.
- A dev-state hook `window.__ranger` (gated behind `import.meta.env.DEV` or
  `?dev=1`) exposes: `screen` (title/avatar/lodge/world/mission), ranger
  `pos()` {x,z}, `cameraYaw()`, `drawCalls()`, `missionView` ('2d'|'3d'|null —
  the resolved view mode of the active mission), `clip()` ({name, time} of
  the player's active animation action, null when procedural), `version`.
  E2E asserts against this hook (state, not pixels — headless SwiftShader
  renders slowly but deterministically enough for state asserts). Screenshots
  are saved as artifacts for human review, not asserted on.
- npm scripts in app/: `e2e` (full suite) and `e2e:smoke` (< 90 s wall time).
- **The smoke definition is STAGED to avoid a bootstrap deadlock** (movement
  is broken until W0.4): smoke v1 (W0.1–W0.3) = boot → canvas renders →
  reach `screen === 'world'` → zero pageerrors. **W0.4 upgrades smoke** to
  additionally assert tap-to-walk moves the ranger ≥ 2 m; from W0.4 onward
  that stronger smoke is **FROZEN** and may never be weakened again.
- **Ticking is gated mechanically:** `ranger-run.mjs tick` refuses to flip a
  box unless `npm run build` is green AND (once `app/e2e/` + the script
  exist) `npm run e2e:smoke` is green. `--force` exists ONLY for the
  graceful-degrade boxes W0.7 / W3.0 / W3.5. Boxes that add player-visible
  behavior must land their own E2E assert in the same sitting (the box's
  acceptance criterion names the assert).
- Playwright config: `reuseExistingServer: !process.env.CI` and an uncommon
  fixed port (e.g. 4199) so a vite dev server Floris has open never turns the
  suite red. `retries: 2` when `process.env.CI`. Movement asserts use
  `expect.poll` on `pos()`, never fixed sleeps (CI SwiftShader is ~10×
  slower).
- Browsers: `npx playwright install chromium` during W0.1 (macOS local);
  W0.8 adds the **webkit** project (iPad Safari is the primary device) for
  smoke + journey; CI installs with `--with-deps`.
- **Committed evidence:** bulk artifacts (playwright-report/, test-results/,
  e2e/__shots__/) stay gitignored (W0.1 adds the entries). Curated proof
  screenshots go in `games/Ranger-Adventures/qa-evidence-2/` (tracked, JPEG
  q80, < 5 MB total) — W7.3's report embeds from there, nowhere else.

### 3.2 Input & camera architecture

- New pure module `app/src/core/input.ts`: keyboard state (ArrowUp/Down/
  Left/Right + WASD) + virtual-joystick vector → one normalized move vector
  {x, z} in camera-relative space. Pure logic unit-tested; DOM listeners live
  in a thin `attachInput(canvas)` layer.
- `World.update` gains a velocity branch: when the input vector is non-zero it
  overrides target-seeking and feeds `resolveMove(rp.x, rp.z, wantX, wantZ,
  obstacles, limits)` directly (already handles collision/rim/water/terrain
  stick/facing). Tap-to-walk stays for iPad one-finger play.
- Joystick: bottom-left, ≥56 px thumb, pointer-events, coarse-pointer media
  query decides default visibility; also toggleable in Instellingen (persist
  via the existing GameState settings through state.ts/persist.ts — no new
  localStorage keys).
- Rotating follow-cam (per motion-comfort research C.1/C.2, which permits
  damped follow ROTATION and bans only non-player-initiated auto-rotation and
  snaps): yaw eases toward `ranger.rotation.y` with **frame-rate-independent
  exponential damping** `t = 1 − exp(−λ·dt)` (smooth-time ~0.2–0.3 s), and a
  **yaw-rate clamp ~120°/s** (a tap-to-walk 180° about-face must never
  whip-pan). Offset stays (distance 6.2, height 3.4); roll always 0; FOV
  fixed 55. **Precedence rule:** follow-yaw suspends while an activity
  reframe (`beginActivity`) owns the camera; resume damped (cut under
  reduced-motion). Follow-yaw responds only to input-driven facing changes.
  Reduced-motion → current fixed bearing with snap cuts. Toggle "Camera
  draait mee" (default aan) in Instellingen.
- Vehicles are arcade-kinematic (NO physics engine): same input vector, higher
  speed, turn-rate clamp, terrain stick. Comfort clauses (research C.3/C.4)
  bind: reduced-motion caps vehicle speed and widens turn easing; the
  helicopter needs damped vertical motion, an always-level horizon, a cockpit
  frame, and a gentle motion vignette while translating — and stays opt-in
  (default UIT).

### 3.3 Dependency rulings

| Dependency | Ruling |
|---|---|
| `@playwright/test` | APPROVED, mandatory, devDependency only. |
| `@dimforge/rapier3d-compat` | APPROVED but spike-gated (W5.4, moved late deliberately): run the spike ONLY if §10 records a real feel/determinism problem with the bespoke controller during W1–W5; otherwise skip-tick with a verdict note. The bespoke `resolveMove` already works; walking does not need physics. |
| `ecctrl` / `BVHEcctrl` (pmndrs) | REJECTED despite research recommendation: they require React Three Fiber; this app is vanilla TS + three.js and CLAUDE.md forbids new frameworks. The follow-cam + joystick they provide are re-implemented natively (small). |
| `ai4animationpy` (Floris's suggestion, checked 2026-07-02) | NOT for this run's runtime: Python 3.12 + PyTorch desktop framework (ECS renderer, mocap import, neural locomotion controllers), CC BY-NC 4.0, no web/JS runtime. Possible FUTURE offline use: synthesize quadruped gait clips and export BVH/GLB — revisit only if the CC0 pack route (W3.5) and improved procedural gaits both disappoint. |
| CC0/CC-BY animated asset packs (Quaternius, poly.pizza, Kenney) | APPROVED as assets, not dependencies. Primary path for animal animation (W3.5). Prefer CC0; CC-BY allowed with a visible credit line (same policy as the audio manifest). Every file gets a license-log entry. |
| Anything World | NOT scheduled. Key present in .env.local but REJECTED (HTTP 403, `anything-world.mjs --preflight`, 2026-07-02) — their processing API needs a prior authorization email to hello@anything.world. Revisit only if Floris gets the account enabled AND the CC0 route leaves gaps. |
| Anything else | Ask Floris first (CLAUDE.md). |

### 3.4 Frozen contracts that bind every box

- Motion comfort (§1e / `MotionMode.ts`): fixed FOV, roll 0, no head-bob/
  motion-blur/snap-rotate/FOV-kick/screen-shake; reduced-motion turns camera
  moves into cuts; locomotion itself always allowed.
- Construct parity: 3D mini-game variants keep the frozen trial builders and
  emit the same `BeatSummary` as their 2D twin; seeded parity test per view.
  The 2D floor stays always available.
- Never-scary / never game-over / mild consequences; calm-pose gate for every
  animal; no hunting/predation/death as central content.
- Reading: M3/E3, ≤7 words per sentence, one instruction per line, read-aloud
  on everything new; add new strings to the `readlevel.test.ts` corpus.
- ≥56 px tap targets, dual-channel feedback, no red/green-only signals.
- Draw calls < 150 (Budgets hook), pixelRatio ≤ 2, iPad-first.
- localStorage only inside `alvah-ef-v1` under the `ranger` namespace via
  `persist.ts`/`state.ts` settings. No new keys, no sessionStorage.
- Assets fetch through `core/assets.ts#assetUrl` (works at `/` and `/ranger/`).
- No surnames, no third-party runtime scripts/CDNs, robots stays Disallow.
- Never commit `.env.local` or `assets-gen/`. `app/public/{models,audio,draco}`
  ARE committed (deploy payload).
- **Secrets:** never print, cat, or log API key VALUES anywhere (tracked
  files, RUN-LOG, terminal output); log only presence + the masked prefix
  `test-meshy.mjs` already emits.
- Ranger game code lives in `games/Ranger-Adventures/app/**` — the strict ToV
  pre-commit hook does not scan it, but `src/pages/ranger/index.astro` IS
  scanned: avoid em-dashes/"hij of zij" there, and any sitting touching
  `src/pages/**` or `src/content/**` runs `npm run check:tov:strict` before
  committing. (W0.1 installs the hook path: `git config core.hooksPath
  .githooks` — it was NOT active on this machine.)

## 4. World map (target layout, extends current `Biomes.ts` sectors)

Coordinates are world meters; walkable rim r=116; ven basin center ~(46,-19).
Biome sectors are noise-warped compass quadrants (see `biomeAt`). Placements
must call `heightAt` for y and push collision circles for solid props.

- **Spawn clearing (center, r≈7, forced heide):** ranger-cabin (door faces
  spawn), case-board next to it (mission hub), signpost, tree-stump,
  campfire-free zone (never fire). Boot drops the player here.
- **Bos sector:** fire-watchtower (landmark, wayfinding beacon), bird-hide,
  nest-box trees, wildlife-camera props at mission spots, real pine/birch/oak
  GLB clusters near paths, mushrooms/dead-snag dressing.
- **Heide sector:** heather dressing, sheep-free open heath, ree + reekalf
  mission area, boulders.
- **Stuifzand sector (NE):** open sand, juniper bushes, "stille zand" mission,
  jeep parked at a sand track head.
- **Ven (SW basin):** reeds, frog mission, water shader, wooden-fence bits.
- **Rim/W:** ecoduct prop spanning a visual track, BOA post + helipad
  (helicopter phase), wooden fences.
- Sand paths connect: spawn ↔ watchtower ↔ ecoduct ↔ ven ↔ stuifzand ↔ spawn.

## 5. Phase specs + acceptance criteria

Every box in WORLD-LEDGER.md references these specs by ID. A box is DONE when:
its targeted unit test (where the plan names one) passes, `npm --prefix
games/Ranger-Adventures/app run build` is green, `npm run e2e:smoke` is green
(staged definition, §3.1), and the box's own acceptance assert exists in the
E2E suite where stated — `tick` enforces the build+smoke part mechanically.
Split anything bigger than one sitting into sub-boxes in the ledger first;
after splitting, replace the parent checkbox with plain text and always tick
with the full sub-id (e.g. `W2.4a`).

### W0 — Truth harness

- **W0.1** Playwright scaffold. `@playwright/test` devDep in app/;
  `app/playwright.config.ts` (chromium project; fixed uncommon port ~4199;
  `webServer` = vite dev; `reuseExistingServer: !process.env.CI`;
  `retries: 2` in CI; screenshots on failure + explicit artifact shots to
  `app/e2e/__shots__/`); `app/e2e/boot.spec.ts`: page loads, canvas present,
  zero pageerrors. npm scripts `e2e`, `e2e:smoke` (smoke v1 = boot only for
  now; W0.3 extends to world-reach, W0.4 to movement). `npx playwright
  install chromium`. **Append to `app/.gitignore`: `test-results/`,
  `playwright-report/`, `e2e/__shots__/`, `incoming/`.** Run `git config
  core.hooksPath .githooks` and verify it. Accept: `npm run e2e` green
  locally.
- **W0.2** Dev-state hook per §3.1 (`screen`, `pos()`, `cameraYaw()`,
  `drawCalls()`, `missionView`, `clip()`, `version`) gated
  `import.meta.env.DEV || ?dev=1`. Keep it out of the unit-test spine (no
  THREE imports in pure cores). Accept: E2E reads `screen === 'title'` on
  boot.
- **W0.3** Journey E2E: Begin → avatar "Dit is mijn ranger" → lodge →
  "Verken de Veluwe (3D)" → `screen === 'world'`; artifact screenshot at each
  step; fold world-reach into `e2e:smoke` (still smoke v1 — no movement
  assert yet). Accept: journey spec green.
- **W0.4** Movement red-first. Spec: tap ground 6 m from ranger →
  `expect.poll(pos)` delta ≥ 2 m. Write the test FIRST; if red (expected —
  this session's headless taps moved nothing), diagnose (rAF pause? activity
  guard `World.ts:440`? raycast miss? patrol state?) and fix. **Then upgrade
  `e2e:smoke` to include this assert — smoke is FROZEN from here on.**
  Accept: test green + one-paragraph root-cause note appended to §10.
- **W0.5** Budgets overlay gated on the **`?dev=1` query param ONLY** (NOT
  `import.meta.env.DEV` — E2E runs against the dev server, so a DEV gate
  would make the absent-assert impossible); `drawCalls()` stays available to
  E2E via the hook. Accept: E2E asserts overlay absent without flag; present
  with flag.
- **W0.6** CI gate. deploy.yml: a separate `test` job (unit tests +
  `e2e:smoke`) that `build` needs; `npx playwright install --with-deps
  chromium`; chromium launch args `['--enable-unsafe-swiftshader',
  '--use-angle=swiftshader']`; cache `~/.cache/ms-playwright` keyed on the
  @playwright/test version; the e2e job is skipped (paths filter) when a push
  touches neither `games/**` nor ranger-related files, so dossier-content
  pushes deploy ungated.
  **Land the e2e job as `continue-on-error: true` first; flip it to blocking
  only after ONE observed green run on ubuntu** (unit tests block
  unconditionally from the start). Accept: workflow updated + a push shows
  the test job green.
- **W0.7** Meshy balance probe (graceful-degrade; `tick --force` allowed).
  `.env.local` present: call the balance endpoint (see `test-meshy.mjs`), log
  remaining credits in §8 + RUN-LOG (masked key prefix only). If somehow
  absent: `ranger-run.mjs status --blocker="..."` and tick with --force.
  Baseline measured 2026-07-02: **7,615 credits**.
- **W0.8** WebKit project (iPad Safari engine): `npx playwright install
  webkit`; run smoke + journey specs on webkit (skip artifact screenshots
  there); document any WebKit-only failure in §10 and fix if in scope.
  Accept: webkit smoke green locally, OR — when local WebKit is a frozen
  build the OS cannot update (mac14-arm64, see §10) — graceful-degrade:
  webkit config landed forward-ready + `e2e:smoke` scoped to chromium
  (contract intact) + §10 verdict, tick with `--force`. CI-webkit on the
  Ubuntu runner is the optional follow-up when someone wants iPad-engine
  coverage in CI.

### W1 — Controls (the demo-critical phase)

- **W1.1** `core/input.ts` pure module + unit tests (vector math, key
  add/remove, camera-relative transform, normalization, wrap-around).
- **W1.2** Keyboard walking: arrows + WASD drive the velocity branch in
  `World.update` through `resolveMove`; tap-target cleared on key input.
  Accept: E2E `keyboard.down('ArrowUp')` → poll delta ≥ 2 m; collision still
  holds (walk into pine → slide, no clip-through — assert no NaN, pos inside
  rim).
- **W1.3** Virtual joystick `ui/Joystick.ts`: ≥56 px, bottom-left, pointer
  events, emits the same vector; visible on coarse pointers (media query) +
  Instellingen toggle (persist via state.ts settings — no new keys). Accept:
  E2E with touch emulation drags stick → moves.
- **W1.4** Interact key: Space/Enter triggers the current proximity action
  (the existing "Speel mee"/approach button). Accept: E2E walks to a marker,
  presses Space, mission briefing opens.
- **W1.5** Rotating follow-cam per §3.2 (dt-independent exp damping, yaw-rate
  clamp ~120°/s, activity-reframe precedence, reduced-motion fallback) +
  Instellingen toggle. Accept: unit test of the damped-yaw helper incl. ±π
  wrap AND dt-independence (30/60/120 fps same result) AND the rate clamp;
  E2E: walk a quarter-circle → `cameraYaw()` changed ≥ 45°; with
  reduced-motion emulated → yaw unchanged.
- **W1.6** Onboarding hint on first world entry: icon + "Loop met de
  pijltjes." / "Sleep de stick." (per device), read-aloud, dismiss on first
  movement, seen-flag via state.ts settings.

### W2 — World as the front door

- **W2.1** Boot straight into the world after title/avatar (first boot:
  avatar creator still first). **Interim affordance: a plain "Naar de hut"
  HUD button satisfies lodge-reachability until W2.2/W2.4 land.** `?demo`
  and `?sandbox` unchanged. Accept: E2E boot → `screen === 'world'` with ≤ 2
  clicks from title; Deep Demo spec still green.
- **W2.2** Cabin hub: place cabin + case-board at spawn (§4); approaching the
  case-board opens the mission board overlay WITHOUT `leaveWorld`; closing it
  returns to the world in-place. Accept: E2E opens board from world, starts a
  mission, **asserts `missionView === '3d'`** (reduced-motion off), world
  survives (screen back to 'world' after).
- **W2.3** Two-mission chain E2E: complete a zoeken-mission then walk to and
  start a second mission without any lodge visit. Accept: chain spec green +
  `BeatSummary` persisted for both + `missionView === '3d'` for both.
- **W2.4a** Pause/hub overlay shell: instellingen + badges reachable from the
  world without leaveWorld; "Terug naar de open plek" wording. Accept: E2E
  opens/closes overlay, world survives.
- **W2.4b** Prikbord + raaf-companion folded into the hub overlay; delete
  now-dead lodge-only flows; all unit tests green. End-of-W2 milestone:
  commit + push (the first coherent world-first build deploys live behind
  the gate).

### W3 — Alive (animations)

- **W3.0** Keys verified (graceful-degrade; `--force` allowed):
  `test-meshy.mjs` + `test-xeno.mjs` pass; balance logged (masked). If keys
  absent → `status --blocker=...`; continue with procedural fallbacks.
- **W3.1** Ranger regen + rig via Meshy (~35 cr): check the W0.7-logged
  balance FIRST — if < 100 cr, `status --blocker=...` and leave the box open.
  Run `node scripts/meshy-gen.mjs --only=ranger-alvah` **backgrounded with
  log polling** (the job exceeds the 10-min tool ceiling; never one
  foreground call), then `meshy-rig.mjs`, `optimize-animated.mjs`, stage,
  manifest `animated:true`. Alternative ingest: if Floris placed a Mixamo GLB
  at `app/incoming/ranger-alvah-rigged.glb`, use that instead. Accept: staged
  GLB has ≥1 skin + ≥2 clips (gltf-transform inspect).
- **W3.2** Player animation state machine (pure core + mixer wiring):
  idle/walk crossfade by speed; procedural bob fallback when clips missing;
  works under reduced-motion (locomotion is exempt). Accept: unit test of the
  state machine; E2E asserts `clip().name` is the walk clip while a key is
  held AND `clip().time` advances between two polls (proves the mixer runs);
  artifact screenshots while moving.
- **W3.3** Warden + poacher play their existing baked clips at their world
  spots.
- **W3.4a** Accuracy dossier, mammals (graceful-degrade; `--force` allowed if
  web tools are unavailable — never invent facts). Web-research each of the
  11 staged mammals (ree, edelhert if present, vos, das, eekhoorn, wild
  zwijn + frisling, adder, etc. per `public/models/manifest.json`): shoulder
  height/body length (numbers!), coat colors incl. seasonal variation, eye
  color, 2-3 unmistakable visual features, characteristic gait/posture, and
  1-2 kid-appropriate facts to feed W6.3. Write
  `research/animal-visual-accuracy.md` with per-claim source URLs + access
  dates. Accept: dossier committed, every mammal covered, zero unsourced
  claims.
- **W3.4b** Accuracy dossier, birds: same treatment for the ~10
  mission/audio-relevant birds of the 23 staged (raaf, nachtzwaluw, merel,
  roodborst, gaai, groene specht, koekoek, pimpelmees, winterkoning,
  zanglijster — adjust to actual mission usage). Same sourcing rules and
  acceptance.
- **W3.5** Animal animation via CC0/CC-BY packs (timeboxed; skip-tick with a
  §10 note for animals without a credible match). Source pre-animated
  quadruped GLBs from Quaternius / poly.pizza / Kenney for the flagship
  animals where a visual match exists (ree/edelhert → Deer/Stag, vos → Fox,
  wolf → Wolf; judge zwijn candidates honestly); prefer CC0, CC-BY with a
  visible credit line is allowed. Per model: license-log entry (like
  `public/audio/manifest.json`), scale per the W3.4a dossier, run
  `optimize-animated.mjs`, stage with `animated:true`. **Style-coherence
  check:** showroom screenshot of pack model next to the Meshy cast into
  `qa-evidence-2/`; if the style clash is jarring, prefer material/tint
  matching or keep the Meshy static + procedural motion for close-up roles —
  record the judgement in §10. Anything World is NOT used (see §3.3).
  Accept: ≥2 flagship animals staged with real walk/idle clips OR a §10
  verdict explaining why fewer.
- **W3.6** Ambient animal life: ree, eekhoorn, wild zwijn wander gentle loops
  — baked clips via the mixer where W3.5 staged them, improved
  ProceduralMotion gaits elsewhere (ground-hug, turn-in-place,
  pause-and-graze beats); 2 birds glide on spline loops overhead; calm-pose
  gate respected. Accept: E2E asserts ≥2 animals present in world scene +
  `drawCalls()` < 150; at least one animal's `clip()`-equivalent mixer runs
  if W3.5 staged clips.
- **W3.7** Apply the accuracy dossier: correct relative scale of every
  animal against the ranger (dossier numbers through the manifest/prepModel
  height path), coat tints and eye colors (eye recipe in
  `EyeMaterial.ts`/`Eyes.ts`), posture flags. Accept: per-animal
  before/after showroom screenshots; the 3-4 most-visible corrections
  curated into `qa-evidence-2/`; §10 notes anything the dossier contradicts
  in existing "Wist je dat" content (fix the strings via the readlevel
  corpus).

### W4 — Rich world

- **W4.1** Landmark props placed per §4 (watchtower, ecoduct, bird-hide, BOA
  post, signposts) + collision circles + wayfinding beacons. Accept: E2E
  walks spawn→watchtower via `pos()` waypoints; draw calls < 150.
- **W4.2** Nature dressing: real tree GLBs clustered near paths/POIs (keep
  instanced primitives as background filler), stumps/snags/boulders/
  mushrooms/reeds per biome. Budget check.
- **W4.3** Sand paths (§4 network) as terrain-hugging ribbons with vertex
  color or generated decal; wayfinding prefers paths visually.
- **W4.4** Ground detail: per-biome procedural albedo (canvas-generated, no
  external textures) or triplanar tint upgrade; keep gouache/golden-hour
  feel; before/after artifact screenshots + one curated pair in
  qa-evidence-2/.
- **W4.5** Golden-hour light + selective shadows: warm low sun screen-left,
  one shadow map for hero objects near camera (ranger + closest props),
  blob shadows for animals; static light (no day cycle this run). Budget!
- **W4.6** Sky + breath: richer gradient + drifting cloud shadows + existing
  wind wave tuned + a bird flyover ~12 s; all frozen under reduced-motion.
- **W4.7** Audio pass: re-encode ambient-heide < 1 MB; soft footsteps
  (surface-aware: sand/grass); biome crossfade tune; if keys present fetch
  4-6 extra bird calls with license log (skip cleanly without keys).
- **W4.8** Ven water: fresnel-tinted disc, waveless default, subtle ripple
  only when reduced-motion is off.

### W5 — Vehicles

- **W5.1** Jeep drivable: proximity "Stap in" (Space works), arcade kinematic
  (speed ≈ 6 m/s, turn-rate clamp ≈ 1.2 rad/s, terrain stick, same collision,
  wider camera: distance 9, height 4.5, same damping), "Stap uit" returns to
  walking. **Reduced-motion: top speed capped ~3 m/s and turn-rate halved
  (research C.3 vehicle clause).** Accept: E2E enters jeep, drives ≥ 10 m,
  exits; with reduced-motion emulated the same drive obeys the caps; comfort
  invariants hold (roll 0, FOV fixed).
- **W5.2** Jeep feel: soft engine loop (Web Audio synth or CC0), dust puffs
  (skipped under reduced-motion), auto-slow ≤ 2 m/s near animals (calm rule:
  animals never panic-flee).
- **W5.3** Helicopter (opt-in, Instellingen default UIT, persist via state.ts):
  helipads at BOA post + stuifzand; enter → climb/descend **exp-damped at
  ≤ 2 m/s** to fixed cruise height (~25 m), **level horizon ALWAYS**, damped
  yaw only (no pitch/roll), cockpit frame overlay as the level-horizon
  reference, **gentle motion vignette while translating (off at hover)** —
  per the LOCKED §1e helicopter clause (BUILD-PLAN:77). Descend at pads only.
  Reduced-motion → helicopter unavailable (a calm message explains). Accept:
  E2E enables toggle, flies pad-to-pad; asserts FOV constant + roll 0 +
  damped yaw during flight.
- **W5.4** Rapier spike (timeboxed one sitting; conditional): run ONLY if §10
  recorded a real feel/determinism problem with the bespoke controller during
  W1–W5; otherwise skip-tick with a verdict note. If run: prototype
  in-tree WITHOUT committing (revert with `git checkout -- .` after
  measuring; NO side branch — the run must end every sitting on `main`
  with a clean status); compare slope feel, seeded-replay determinism,
  bundle cost (~1.5 MB wasm), test ergonomics; verdict in §10 is the only
  durable artifact. Adopt only on a clear win.

### W6 — Diegetic missions + biology

- **W6.1** In-world mission entry friction audit: run all 5 missions from
  world markers under E2E, screenshot every beat, fix rough edges (prompt
  overlap, camera reframe jumps, unreachable markers).
- **W6.2a–d** rmSafe audit, ONE ENGINE PER BOX (a=corsi, b=simon, c=zoeken,
  d=wisselen): redesign the variant's motion to cuts-not-moves where honestly
  possible. **A flip of `rmSafe` requires ALL of:** (1) a reduced-motion E2E
  (`emulateMedia({reducedMotion:'reduce'})`) asserting zero camera
  translation/yaw via the hook during a full beat and secondary motion off;
  (2) a §10 entry naming every motion removed; (3) parity tests untouched
  (frozen trial builders). **Default when in doubt: KEEP `rmSafe:false`** —
  the 2D floor is a feature, not a failure (three of the four current
  rmSafe:false decisions were legibility judgments, not motion-avoidance).
  The user-facing force2d/Tweaks override stays as the manual escape hatch.
- **W6.3** Biology diegetic: "Wist je dat" beats become companion-raaf speech
  at the relevant world spot + collectible veldnotitie pinned to the
  case-board (persisted via the ranger namespace). Reading rules apply.
- **W6.4a** Perception slice "Ken je roep", engine half: staircase core
  (existing `skill.ts` pattern) over 4-6 bird calls with decoys; 2D floor +
  parity contract like the EF five; new strings in the readlevel corpus.
- **W6.4b** Perception slice, world half: sit-spot bench near the bird-hide,
  in-world 3D entry, audio wiring, wayfinding. Accept: E2E plays one full
  beat from the bench; `missionView === '3d'`.
- **W6.5** Tone gate: every new player-facing string through the readlevel
  corpus test; read-aloud wired; ≥56 px targets verified in E2E (bounding-box
  assert on new buttons).

### W7 — Performance + ship

- **W7.1** Code-split: three.js vendor chunk + lazy mission/demo chunks;
  `/ranger/app.js` entry name unchanged (site contract, `vite.config.ts`
  fixed output names). Accept: entry gzip < 120 kB, world interactive-time
  logged in E2E.
- **W7.2** Quality tiers: fps probe over first 5 s → pixelRatio/vegetation
  density step-down tier; hysteresis; persisted via state.ts settings (no
  new keys). E2E asserts hook exposes tier.
- **W7.3** Full green: unit + parity + full E2E (chromium AND webkit) +
  `build:site` + root astro build; write AUTO-QA-REPORT-2.md embedding ~15
  curated screenshots from `games/Ranger-Adventures/qa-evidence-2/` (tracked;
  raw artifacts stay ignored).
- **W7.4** Deploy + live check: commit + push;
  E2E against the real site build via root `astro build` + `astro preview`
  with a Playwright `context.addInitScript` that pre-seeds
  `sessionStorage.setItem('alvah-gate-v1','1')` (the gate only checks
  presence — documented as intentionally bypassable; never script the
  password); then curl https://alvah.nl/ranger/ 200 + app.js hash changed.
- **W7.5** NEEDS-FLORIS acceptance on iPad: walk (joystick + tap), drive the
  jeep, one full mission from a world marker, Deep Demo pass, Reduce-Motion
  both states. Checklist copied into RUN-STATUS on reaching this box.

## 6. Run mechanics (how the autonomous run executes)

- Supervisor: `bash games/Ranger-Adventures/world-run-loop.sh` (defaults:
  cap 120 sittings, model opus). It exports `RUN_LEDGER=WORLD-LEDGER.md` so
  `ranger-run.mjs status|tick|commit` operate on the new ledger. The run
  works **directly on `main`** (Floris, 2026-07-02: the site is not in use;
  branch isolation would only clutter) — every phase-boundary push deploys
  live behind the gate, and that is intended.
- Each sitting: read WORLD-PLAN.md (this file) + WORLD-LEDGER.md + BUILD-PLAN
  §7 + root CLAUDE.md; do the FIRST unchecked box; tick with
  `RUN_LEDGER=WORLD-LEDGER.md node games/Ranger-Adventures/app/scripts/
  ranger-run.mjs tick "W1.2"` — tick itself enforces build + e2e:smoke and
  refuses on red (`--force` only for W0.7/W3.0/W3.4a/W3.4b/W3.5); commit at
  phase boundaries and after W0.4/W1.2/W1.5/W2.1 with `... commit "<msg>"`;
  STOP after 1-2 boxes.
- Research boxes (W3.4a/b) use real web search/fetch and cite source URLs +
  access dates in the dossier. If web tools are unavailable in a sitting:
  `status --blocker=...` and move on — never invent facts.
- **Never** invoke `ranger-run.mjs run`, `npm run finish`, `npm run
  assets:all`, or unfiltered `assets`/`meshy-gen` — the assets-gen manifest
  is lost and an unfiltered pass would regenerate the shipped cast
  (~2,300 cr). `ranger-run.mjs run` refuses under RUN_LEDGER, and
  `meshy-gen.mjs` now skips staged models, but do not lean on the guards.
- Long single-asset Meshy jobs (W3.1, ~15 min) run **backgrounded** with log
  polling — never as one foreground call (10-min tool ceiling).
- Blockers: `ranger-run.mjs status --blocker="<text>"` persists a
  NEEDS-FLORIS flag across refreshes (side file in app/logs/); clear with
  `--blocker=none`.
- Stall rule: 3 consecutive sittings without a ledger change → loop pauses
  NEEDS-FLORIS (same as run 1).
- Watch live: `bash games/Ranger-Adventures/watch.sh` (auto-detects the run-2
  ledger + loop log; `RUN_LEDGER=RUN-LEDGER.md` to watch run 1's files).

## 7. NEEDS-FLORIS (before/at the start of the run)

1. ~~Restore `app/.env.local`~~ **DONE 2026-07-02**: recovered from VS Code
   local history (the old working copy at `~/Desktop/Alvah.nl/alvah` is gone,
   but the editor kept snapshots). All keys present: Meshy, xeno-canto,
   Freesound (incl. OAuth2 client), Anything World. File confirmed
   gitignored. Note: `app/assets-gen/` (raw sources + Meshy refine IDs) is
   NOT recoverable — the regen-then-rig path in W3.1 stands.
2. ~~Check Meshy subscription~~ **VERIFIED 2026-07-02: balance = 7,615
   credits** (live API query). The run needs ~35. W0.7 re-logs the balance at
   run start. Free Mixamo fallback stays documented: rig on mixamo.com and
   drop the result at `app/incoming/ranger-alvah-rigged.glb`.
3. ~~Anything World decision~~ **RESOLVED 2026-07-02**: the stored key is
   REJECTED (HTTP 403 at `anything-world.mjs --preflight`) — their processing
   API needs a prior authorization email. Per Floris's decision the run does
   not wait: animals animate via CC0/CC-BY packs (W3.5) + improved
   procedural motion. Only if you ever get the AW account enabled AND the
   pack route left gaps, tell the run to revisit.
4. **Check Reduce Motion / Verminder beweging** on BOTH your Mac (System
   Settings → Accessibility → Display) and the iPad (Instellingen →
   Toegankelijkheid → Beweging) before judging demos — it silently flattens
   the whole experience by design.
5. **Live-site policy**: the run pushes to `main`; every phase boundary
   deploys to alvah.nl behind the gate (your call, 2026-07-02: site not in
   use, no branch clutter).
6. **iPad acceptance** at W7.5.

## 8. Credits ledger (update as the run learns more)

| Item | Cost | Status |
|---|---|---|
| Meshy Ultra grant (run 1) | **7,575 cr — W3.0 re-log 2026-07-02** (7,615 prep → 7,595 W0.7 → 7,575 after W3.0's `test-meshy` preview generate; live API `openapi/v1/balance`, HTTP 200, key `msy_…`) | active; ~35 cr needed for W3.1 |
| Ranger regen + rig (W3.1) | ~30 + ~5 cr | keys restored — ready |
| Extra env props (only if needed in W4) | ~30 cr each | none planned — 38 props already staged |
| CC0/CC-BY animated animal packs (W3.5) | free (license log; CC-BY gets a credit line) | PRIMARY animal-animation path |
| Anything World | ~155 AW cr / $50 Micro | **key REJECTED (HTTP 403, preflight 2026-07-02)** — not scheduled |
| xeno-canto / Freesound | free keys | restored (verify in W3.0) |
| Playwright / Rapier | free (MIT/Apache) | approved |

## 9. What NOT to do (learned from run 1 + session findings + audit)

- Do not claim anything works without a browser assert. No "screenshot
  deferred". That convention is dead — and `tick` now refuses red gates.
- Never weaken the frozen (post-W0.4) e2e:smoke definition.
- Never run `ranger-run.mjs run` / `npm run finish` / `assets:all` /
  unfiltered generation (see §6 — mass-regen trap).
- Do not tear the world down for menus (`leaveWorld` only for explicit exits).
- Do not add React, CSS frameworks, analytics, CDNs, or new localStorage keys.
- Do not touch `reference/`, run-1 ledger files, or `src/pages`/`src/content`
  outside `src/pages/ranger/index.astro` (and mind the ToV hook there —
  §3.4).
- Do not print/log secret values, ever (§3.4).
- Do not regenerate the 75 staged models (they are good); generation is only
  for the rigged ranger (and props explicitly listed in a ledger box).
- Do not build the life-areas Engines 02-05 this run (Engine-01 slice W6.4
  only). AI-Simulation (Engine 04) stays build-blocked on privacy ruling.
- Do not "fix" reduced-motion by ignoring it. It is law; make 3D comfortable
  instead (W6.2), and keep `rmSafe:false` when in doubt.
- Do not end a sitting off `main` or with a dirty tree.
- Do not write a single unsourced claim into the accuracy dossier or the
  biology content — web research with URLs + dates, or a blocker.

## 10. Run findings log (append-only, one short entry per surprise)

- 2026-07-02 (prep session): plan hardened after a 3-auditor adversarial
  pass — staged smoke definition (bootstrap deadlock), mechanical tick gate,
  meshy-gen staged-model credit guard, branch isolation, persistent
  --blocker channel, honest push, helicopter/jeep comfort clauses, rmSafe
  flip guard, WebKit coverage, qa-evidence-2 policy. Meshy balance verified
  7,615 cr; .env.local recovered from VS Code local history.
- 2026-07-02 (W0.4, root cause): tap-to-walk was dead because the full-screen
  explore HUD swallowed every tap — the canvas received ZERO `pointerdown`
  events. The `.ra-overlay` HUD wrapper is styled `pointer-events:none`
  (missions.css) so taps fall through to the canvas, but it is a DIRECT child
  of `#ui`, and `#ui > * { pointer-events:auto }` (base.css) has higher
  specificity (an ID beats the `.ra-overlay` class), forcing the wrapper back
  to `auto`. So the raycast/`resolveMove` path was correct all along; the input
  never reached `World.onPointer`. NOT an rAF pause / activity guard / raycast
  miss (the prep session's candidates). Fix: an `.explore-overlay` class on the
  HUD wrapper + `#ui .explore-overlay { pointer-events:none }` (matches the ID
  specificity, adds a class → wins); controls stay `auto`. Red-first E2E
  `movement.spec.ts` (tap ground → `pos()` delta ≥ 2 m) now green and folded
  into `e2e:smoke` — the stronger smoke is FROZEN from here.
- 2026-07-02 (W0.6, CI gate): split into W0.6a (land) + W0.6b (flip to
  blocking) because the flip is gated on observing a real green ubuntu run.
  Paths-filter uses a plain `git diff HEAD^ HEAD` step (no third-party action,
  per CLAUDE.md) matching `games/`, `src/pages/ranger/`, `deploy.yml`; unit
  tests block every push, e2e:smoke runs only on ranger changes. SwiftShader
  args (`--enable-unsafe-swiftshader --use-angle=swiftshader`) live in
  playwright.config.ts gated on `process.env.CI` — three.js WebGL renders
  headlessly on the GPU-less runner. First ubuntu run (28589759505): test job
  green, e2e:smoke 4 passed in 54.5 s. W0.6b then removed continue-on-error.
- 2026-07-02 (W0.8, WebKit — BLOCKED, box left OPEN): `npx playwright install
  webkit` downloaded the FROZEN build (webkit v2251, mac14-arm64) with the
  warning that this OS no longer receives WebKit updates. It **bus-errors
  (Bus error:10) at launch** — confirmed both via the suite and a bare
  `webkit.launch()`, so it is the browser/OS, not our config. The Mac runs
  macOS 14.1 (Darwin 23.1.0). W0.8 is not a `--force`/graceful-degrade box, so
  it stays unticked with a persistent `--blocker`. Config landed anyway
  (forward-ready): a `webkit` project scoped `grep:/@smoke/` on
  `devices['iPad (gen 7) landscape']`, an `e2e:webkit` npm script, and
  `shot()` no-ops on webkit. To keep CI (chromium-only) and the tick gate
  safe, `e2e:smoke` is now scoped `--project=chromium` — this removes NO
  assertion (only chromium existed before), so the frozen smoke is intact.
- 2026-07-02 (W0.8 RESOLVED — operator decision, Floris): the OS update that
  would unfreeze local WebKit is blocked by disk space and is unrelated to the
  run, so W0.8 is reclassified as a **graceful-degrade** box (like W0.7). The
  config is landed forward-ready and the chromium smoke/tick gate is intact,
  so W0.8 is ticked with `--force` and the run proceeds to W1. iPad-Safari
  engine coverage in CI (add the webkit project to the Ubuntu job) is an
  OPTIONAL follow-up, not a blocker for the demo path.
  Chromium smoke still 4/4 green. Unblock path: update macOS, or move webkit
  smoke to CI ubuntu (webkit runs there). Proceeded to W1.1.
- 2026-07-02 (W0.7, Meshy balance probe): key valid, `openapi/v1/balance`
  HTTP 200 → **7,595 credits** (masked key `msy_…`, 40 chars). Down 20 cr
  from the 7,615 prep baseline — consistent with the prep-session
  `test-meshy.mjs` preview generate. Well above the ~35 cr W3.1 needs, so no
  blocker. Added a reusable `scripts/meshy-balance.mjs` (masked prefix +
  balance only, never the key value). Ticked with `--force` (graceful-degrade
  box, no player-visible change → no new E2E assert).
- 2026-07-02 (W1.2, keyboard walking): arrows + WASD now drive a velocity
  branch in `World.update`. The pure `input.ts` core (W1.1) stays DOM-free; the
  new thin `core/attach-input.ts` layer keeps a live held-key `Set` (window
  keydown/keyup, `preventDefault` on movement keys so arrows don't scroll,
  clears on blur so no stuck keys). Each frame `resolveInput(held, null,
  cameraYaw())` → world move; when non-zero it OVERRIDES tap-to-walk and drops
  the stale tap target so nothing resumes on key-release, then feeds the same
  `resolveMove` (collision/rim/water unchanged). Camera is still fixed-bearing
  (yaw ≈ 0), so ArrowUp = world −z = "into the screen" — the camera-relative
  transform already lines up for W1.5's rotating cam. New `keyboard.spec.ts`:
  hold ArrowUp → `pos()` delta ≥ 2 m + finite + inside rim (collision holds),
  plus a KeyW walk. Frozen `e2e:smoke` (tap-to-walk) untouched — the override is
  key-gated, so taps still work when no key is held. Not folded into smoke (it
  is the box's own assert, not a smoke upgrade).
- 2026-07-02 (W1.3, virtual joystick): the on-screen stick (`ui/Joystick.ts`,
  bottom-left, 132 px ring / 64 px thumb ≥56) emits the same `StickVector` the
  keyboard does — a new pure `joystickVector(dx,dy,radius)` in `input.ts` clamps
  the drag to the ring (saturate, never overshoot) and flips y (screen-up =
  forward). `World.setJoystick(() => js.vector())` fuses it with held keys at the
  one `resolveInput` call site (null while the thumb rests, so it never overrides
  the keyboard). Pointer-capture on the base means NO window listeners to leak;
  the HUD re-render disposes the old instance. Visibility = pure
  `joystickVisible(pref, coarsePointer)`: new `joystick: 'auto'|'aan'|'uit'`
  setting (default `auto` → shown on a coarse pointer), plus an Instellingen
  segmented control. GOTCHA fixed: the new Tweaks segmented group reused the
  `.tw-seg-opt` class, so the gevolgErnst click handler (`querySelectorAll(
  '.tw-seg-opt')`) would have cross-fired and written `gevolgErnst: undefined` on
  a joystick tap — both handlers are now scoped by their `[data-ernst]` /
  `[data-joy]` attribute. E2E `joystick.spec.ts` pre-seeds `joystick:'aan'` into
  the shared `alvah-ef-v1` blob (no new key) to show the stick on the desktop
  test pointer, drags the thumb forward → `pos()` delta ≥2 m, asserts thumb
  ≥56 px + rim/finite + stop-on-release. Frozen smoke untouched (own assert).
- 2026-07-02 (W1.4, interact key): Space/Enter now fire the current proximity
  action — the laptop twin of tapping the "Speel mee" prompt. A pure
  `isInteractKey(code)` (Space/Enter/NumpadEnter) joins `input.ts`; `attach-input.ts`
  gained an `onInteract` option that fires once per press (`e.repeat` filtered) and
  `preventDefault`s so Space never scrolls or re-activates a focused button. `World`
  routes it through a guarded `tryInteract()` (no-op unless `nearId` is set and no
  activity owns the world), calling a new `onInteract(missionId)` callback. The HUD
  handler mirrors the button click exactly — same `showBriefing(m, true)` — and adds
  a guard that the `.explore-prompt` is still on screen (the briefing card replaces
  the explore HUD via `card()`→`clearOverlays()`, so a second Space after it opens is
  a no-op) and that `approachId` still matches. Two new read-only dev-hook accessors
  (`nearId()`, `markers()`) let the E2E steer to the nearest marker with arrow keys
  (fixed bearing → world −z = ArrowUp) until proximity fires, then assert Space opens
  the "Ga op pad" briefing and the play prompt is gone. Frozen smoke untouched (own
  assert). Unit: `isInteractKey` disjoint-from-movement test. All 10 E2E green.
- 2026-07-02 (prep session, later): Floris decisions folded in — no branch
  isolation (run works on main; site not in use); CC0/CC-BY animated packs
  become the primary animal-animation path after the Anything World key was
  probed and REJECTED (HTTP 403 preflight); new per-animal web-accuracy
  dossier boxes (W3.4a/b) + apply box (W3.7) added, feeding both the
  visualization and the W6.3 biology facts.
- 2026-07-02 (W1.5, rotating follow-cam): the camera now eases behind the ranger
  as he turns. The yaw maths lives in a pure THREE-free `FollowCam.ts` (`dampedYaw`
  = shortest-arc ease by the SHARED `dampFactor` `1−exp(−dt/τ)`, τ=0.25 s, then a
  ±`maxRate·dt` clamp at ~120°/s) so the unit test pins wrap/dt-independence/clamp
  without a browser. `World` keeps a `followYaw` that chases `followTargetYaw` —
  the ranger's facing, updated ONLY on a moving frame, so a STANDING ranger never
  swings the view (the startup gotcha: init both to π = straight-behind, not to the
  idle `rotation.y=0`, or the cam whips 180° on boot). `placeCamera` rotates the
  fixed offset by `followYaw`: `cam = rp − (sin,cos)·dist`. KEY DECISION: `cameraYaw()`
  now returns `followYaw + π` DIRECTLY, not `camera.rotation.y` — the pitched
  camera's Euler couples yaw with pitch, so reading it back is unreliable off yaw 0;
  the derived value is exact and still reads 0 at the fixed bearing, so W1.2–W1.4
  are untouched. Reduced-motion OR the "Camera draait mee" toggle (Instellingen,
  default aan, read live via `setCameraFollow`) pins `followYaw=π` (the pre-W1.5
  fixed bearing) and cuts position; activity reframes already own the camera (update
  early-returns), and `endActivity` eases back (cut under reduced). GOTCHA fixed:
  `interact.spec` steered by mapping world-delta→fixed keys assuming a fixed bearing;
  with the rotating cam that spirals, so its steering now reads `cameraYaw()` and
  inverts `resolveInput`'s rotation each tick (the map is its own inverse). New
  `camera.spec.ts`: quarter-circle → yaw ≥45°; reduced-motion → yaw stays put while
  the ranger still walks ≥2 m. Frozen smoke untouched (own assert). All 12 E2E green.
- 2026-07-02 (W2.1, world as the front door): boot now drops straight into the
  walkable world after title→avatar instead of the lodge. A new exported
  `startWorld(ui, stage)` in Missions.ts mirrors `startLodge` (sets the module
  host/stage, unlocks audio inside the boot gesture) then calls the existing
  `startExplore` — no world rebuild, the whole free-roam path is reused. `main.ts`
  swaps the post-avatar target: returning players boot to world in 1 click from
  title, first-boot players still meet the avatar creator first (2 clicks, meets
  the ≤2 acceptance). `?demo`/`?sandbox` untouched (sandbox still returns to the
  lodge). The lodge is NOT deleted — it stays reachable via the explore HUD's
  existing "Terug naar de hut" pill (the interim affordance §W2.1 names; the
  in-world cabin hub replaces it in W2.2/W2.4). E2E: journey.spec rewritten to
  the ≤2-click front door and asserts the "Terug naar de hut" pill is present;
  the six world-reaching specs (movement/keyboard/interact/camera/joystick/
  onboarding) dropped their now-dead "Verken de Veluwe (3D)" click. Frozen smoke
  intact — movement.spec still owns the ≥2 m assert, only its navigation lost one
  click. 13/13 E2E + 261 unit green.
- 2026-07-02 (W1.6, onboarding hint — closes W1): first-world-entry hint copy
  lives in a pure `core/onboarding.ts` (device-aware `onboardHint`) so the HUD and
  the readlevel corpus test share ONE source of truth — Missions.ts is DOM/THREE-y
  and can't be imported by node:test, so the strings had to sit in a pure core. The
  hint text keys off `joystickVisible(pref, coarse)` (NOT bare coarse-pointer), so a
  player who forced the stick on/off gets the matching line. Dismiss-on-first-step is
  a small rAF watcher on `world.pos()` (≥0.6 m from the entry point) that seals the
  `wereldHintGezien` settings flag; the watcher is cancelled on HUD re-render (patrol
  resume) and on `leaveWorld`, so no loop outlives the world. Seen-flag is a new
  settings boolean (no new localStorage key — rides the `ranger` namespace). Not a
  user toggle, so no Instellingen row. New `onboarding.test.ts` (device branch +
  ≤7-word lint) + `onboarding.spec.ts` (hint shows → dismisses on the first step →
  flag persisted in the shared blob). Frozen smoke untouched (own assert).
- 2026-07-02 (W2.2, cabin hub / mission board): the spawn clearing now carries a
  ranger-cabin (solid prop, collision circle, walk-around) and a case-board hub.
  TWO nuances worth recording. (1) "Mission board" ≠ the existing prikbord: §4 calls
  the case-board the *mission hub*, and the acceptance is "start a mission → 3d", so
  I built a NEW `showMissionBoard()` overlay (the lodge's mission grid, world-first)
  rather than reusing `showCaseBoard` (which is the clue/prikbord board). Picking a
  card → `showBriefing(m, true)` → runMission's §1f branch resolves 3D in-place. (2)
  The case-board is kept OUT of the `markers` array on purpose: `interact.spec` walks
  to the NEAREST marker, and a sentinel board 4 m from spawn would become that
  nearest one and break the marker walk. Instead the World owns a dedicated hub path
  — `boardPos`/`nearBoard` proximity, a `setBoard({onNear,onOpen})` registration, a
  tap-to-walk raycast branch, and `tryInteract` firing the board before any mission
  `nearId`. The overlay opens via `card()` (swaps HUD DOM) but never calls
  `leaveWorld`, so the THREE scene stays live and `screen` stays 'world'; "Terug naar
  de open plek" rebuilds the explore HUD in-place. GOTCHA: the World only re-fires
  `onBoardNear` on a proximity CHANGE, so after closing the board while still standing
  at it the fresh HUD would miss the affordance — `showExploreHud` re-surfaces it by
  reading `world.boardState().near`, and `endActivity` resets `nearBoard` for the same
  reason. Props sit +x/+z of spawn so the movement smoke's forward (−z) corridor stays
  clear. New dev hook `board()` ({x,z,near}) lets the E2E steer to the hub; new
  `board.spec.ts` walks there, opens the board (asserts screen stays 'world'), closes
  it (HUD back, still 'world'), reopens and starts a mission (asserts
  `missionView === '3d'`, world still live). No unit test named for this box (pure UI
  wiring). 15 E2E + 261 unit green; frozen smoke untouched.
- 2026-07-02 (W2.3, two-mission chain): `chain.spec.ts` plays a FULL zoeken-mission
  (`ree-niet-aanraken` = zoeken + dagnacht) from the case-board, returns to patrol,
  then walks back and starts a SECOND mission (`frisling`) — all in-place, no
  `leaveWorld`, and (asserted) `screen` never becomes 'lodge'. Both resolve
  `missionView === '3d'` and both persist a `BeatSummary`, verified by reading the
  cumulative skill `trials` back out of the shared `alvah-ef-v1` blob (zoeken climbs
  once per mission, dagnacht once for mission 1). KEY DECISION: headless SwiftShader
  can't pixel-accurately raycast the 3D pick surfaces, so completion drives a NEW
  dev-only `__ranger.winStep()` hook instead of faking clicks. It is an INPUT-modality
  shortcut, not a state one: each running variant registers (via kit
  `registerActivityWin`) a closure that runs its OWN genuine success path — zoeken taps
  the target + advances past the wildcam card, dagnacht takes the calm choice on every
  encounter then `finish()`, corsi/simon/wisselen call their real `finish()` — so every
  asserted value (BeatSummary, screen flow, teardown, persistence) is real runtime
  state; pick-accuracy stays covered by the per-engine parity tests. The hook is gated
  with the rest of `__ranger` (DEV / `?dev=1`) and `Missions` calls kit
  `clearActivityWin()` in the step `finally` so no win closure outlives its activity.
  The chain only exercises zoeken + dagnacht (both robust, prompt-resolving); the other
  three wins are registered for the future W6.1 friction audit but not driven here.
  GOTCHA handled: the reward's back button is "Bekijk de wildcamera" (verhaalHaak clue)
  OR "Verder op patrouille", and an occasional world-beat ("Even verder lopen") sits
  between reward and patrol — the return-to-patrol helper handles all three. 16 E2E +
  261 unit green; frozen smoke untouched (own assert, not a smoke upgrade).
- 2026-07-02 (W2.4a, pause/hub shell): a "⏸ Pauze" pill on the explore HUD opens a
  light in-world menu (`showPauseHub`) over the LIVE world — instellingen + badges —
  built with `card()` only (no `leaveWorld`, no `setScreen`), so the THREE scene stays
  live and `screen` stays 'world' throughout. Both leaves return to THIS hub, not the
  lodge: `showTweaks(host, showPauseHub)` already takes a back callback, and `showBadges`
  grew an optional `(back, backLabel)` — the lodge caller (`showBadges()` → showLodge)
  and the demo caller (`showBadges(onBack)` → "Terug naar de demo") are unchanged; the
  hub passes `(showPauseHub, 'Terug')`. The hub's own back is the plan's "Terug naar de
  open plek" wording → `showExploreHud(activeExploreTitel())`, in-place. No new CSS
  (reuses `.reward .boot-card-ish .lodge-links .ra-pill .btn-start`); no new localStorage.
  The interim "‹ Terug naar de hut" pill still stands — W2.4b removes it with the dead
  lodge-only flows. New `pause.spec.ts` opens the hub, reaches Instellingen + badges,
  asserts `screen==='world'` and `pos()!=null` at each step, and closes back to the HUD.
  17 E2E + 261 unit green; frozen smoke untouched (own assert, not a smoke upgrade).
- 2026-07-02 (W3.0, keys verified — opens W3): both content keys live. Meshy
  `openapi/v1/balance` HTTP 200 → **7595 cr** (masked key `msy_…`, 40 chars);
  `test-meshy.mjs` AUTH/list HTTP 200 + a preview GENERATE HTTP 202 (result id
  returned) prove free/paid generation still works, so W3.1's ~35 cr regen+rig
  is de-risked. The preview generate cost **20 cr** (7595 → 7575, matching the
  W0.7 prep-session spend) — still far above W3.1's need, no blocker.
  `test-xeno.mjs` HTTP 200 → 21,183 NL bird recordings / 381 species (page-1
  licence spread mostly CC BY-NC-SA/ND — noted for the W4.7 audio pass, which
  must respect NC/ND). Freesound + Anything World keys are also present in
  `.env.local` (names only, never logged) but out of W3.0 scope. Graceful-degrade
  box, no player-visible change → no new E2E assert; ticked with `--force`.
- 2026-07-02 (W2.4b, prikbord + raaf folded in — CLOSES W2): the pause hub now
  carries the prikbord (`showCaseBoard(true)`) and the raaf-companion
  (`showCabin`) on top of instellingen + badges, so every lodge-only menu the
  world-first player could still want is reachable in-world with no `leaveWorld`
  (scene live, `screen` stays 'world'). DECISION on return targets: instellingen
  + badges bounce back to the hub (short, modal), but prikbord + raaf return to
  the open plek — their own flows commit real state (the arc `reportArc`, the
  raaf's bond growth) and reading cleaner as "back to playing" than back into a
  menu; reusing the untouched `fromWorld` prikbord path also keeps arc-commit
  intact (I deliberately did NOT route it through the demo-suppress `demoBack`
  arg). `showCabin` grew an optional third `label` arg (default "Terug naar de
  hut" → lodge unchanged; hub passes "Terug naar de open plek") so the raaf's
  back button reads right over the world. DEAD-FLOW cleanup: the interim
  "‹ Terug naar de hut" HUD pill is gone AND the standalone "📌 Prikbord" HUD
  pill is gone (folded into the hub) — so in normal play the lodge is no longer
  reachable at all (it survives only for `?sandbox` back + Deep Demo
  `backToLodge`, unchanged). GOTCHA: Deep Demo's `openFreeroam` still needs an
  in-world exit back to the tour (`worldExit` set), so the back pill is now
  CONDITIONAL — shown only when `worldExit` is set, relabelled "‹ Terug naar de
  rondleiding"; `exitWorld` is untouched. `journey.spec` swapped its old
  "Terug naar de hut" assertion for "Pauze pill present + no hut pill";
  `pause.spec` grew prikbord + raaf steps (open over the live world, world
  survives, return to the HUD). 16 E2E (chromium) + 261 unit green; frozen smoke
  untouched. Milestone: first coherent world-first build — committed + pushed.
- 2026-07-02 (W3.1, ranger regen + rig): the shotlist `ranger-alvah` prompt was
  ALREADY the rig-ready v3 pose (bare head, hands clear of the body, wide arm
  gap — the fix `regen-ranger.mjs` documented), so the plan's
  `meshy-gen.mjs --only=ranger-alvah` needed no prompt edit. Gen (preview→refine,
  ~6 min backgrounded) cost 30 cr; rig cost 5 cr (7525 → 7490, masked key
  `msy_…`). SURPRISE worth recording: the Meshy humanoid rig API returns the
  base rigged GLB (`model_urls.glb`) with only ONE short rest clip
  (`clip0|baselayer`, 0.30 s) — the walk/run animations live in SEPARATE per-clip
  GLBs under `basic_animations.{walking,running}_glb_url`, which `meshy-rig.mjs`
  records the KEY NAMES of but never downloads. So the raw rig staged alone would
  have 1 clip and fail W3.1's ≥2-clip bar. Fix: re-queried the rig task for the
  walk/run GLB urls, downloaded them (identical 26-node armature — verified 0
  node-name mismatches), and wrote `scripts/merge-ranger-clips.mjs` to transplant
  the walk + run clips onto the base rig (renaming the three to idle/walk/run for
  W3.2's state machine). `optimize-animated.mjs` then staged it rig-safe:
  8.9 MB → 414 kB, **1 skin + 3 clips**, tris 30703. The player still loads via
  `loadModel` (bind pose, no mixer) until W3.2, so smoke is unaffected — 4/4
  frozen green, build green. No E2E assert named for this box (its acceptance is
  the static gltf-inspect); W3.2 lands the `clip()` mixer assert.
- 2026-07-02 (W3.2, player animation state machine): the ranger now breathes
  standing and steps while walking. `loadRealRanger` swapped `loadModel` →
  `loadRig('ranger-alvah')` (same GLB, now WITH its baked idle/walk/run clips);
  a new `PlayerRig.ts` builds an AnimationMixer, keeps the idle + walk actions
  BOTH playing from frame one, and crossfades their `setEffectiveWeight` from the
  ranger's post-collision ground speed (`this.playerSpeed`, computed each frame in
  `World.update`). The blend maths is a pure THREE-free `PlayerAnim.ts`
  (`stepWalkWeight` — the SAME `dampFactor` the camera/position follow use, so the
  whole feel shares one dt-independence guarantee; `dominantGait` for the hook),
  unit-tested (6 tests: rest→idle, move→walk, <0.2 s to walk, sub-threshold stays
  idle, 30/60/120 fps identical, clamp). KEY CONTRACT CALL: locomotion is
  reduced-motion EXEMPT (§3.4), so the player mixer always advances with real dt —
  UNLIKE the per-marker ANIMAL mixers (`reduced ? 0 : dt`). Only the procedural-bob
  fallback (clips missing) holds still under reduced-motion. `clip()` wired through
  the existing `provideClip` hook → `world.playerClip()` (dominant gait name + its
  action time; null when procedural). New `anim.spec.ts`: waits for the rig to
  attach, asserts idle at rest, holds ArrowUp → `clip().name === 'walk'` AND
  `clip().time` advances between two polls (proves the mixer clock runs, not a
  frozen pose), then eases back to idle on release. Frozen smoke untouched (own
  assert). 267 unit (+6) + build green; anim + full smoke green.
- 2026-07-02 (W3.3, warden + poacher baked clips): the two story-arc humans now
  stand in the LIVE explore world playing their single baked clip. Both were
  infrastructure-ready (`animated:true`, 1 clip each in the manifest) but placed
  NOWHERE outside the Sandbox showroom — the arc only referenced them via case-board
  state, never as world characters. New `placeScenicActors()` in World.ts drops the
  warden (`ranger-warden-boa`) next to the case-board hub (the BOA you report to) and
  the poacher (`figure-poacher`) as a distant, calm figure off in the bos edge; each
  `loadRig` → `prepModel(1.7, adult height)` → `applyCalmPose` (never-scary bias) →
  a mixer playing the first idle/rest clip. DECISION: they are NOT markers and push NO
  collision — pure diegetic dressing, kept out of `markers` so they never pollute
  wayfinding or the "nearest mission" the E2E steers to (same reasoning as the W2.2
  case-board). Their clip is SECONDARY motion → advanced `reduced ? 0 : dt` in the same
  loop as the animal mixers (unlike the player's rm-EXEMPT locomotion). Both sit +z of
  spawn so the frozen movement smoke's −z corridor stays clear. New dev hook
  `actors()` ({id, clip}) mirrors `clip()`; `actors.spec.ts` asserts both humans are
  placed AND the warden's mixer clock advances with no input. 267 unit + build green;
  new spec + frozen smoke 4/4 green.
  FLAKINESS NOTE (not a regression): the two longest specs `pause.spec` +
  `chain.spec` fail intermittently in local serial back-to-back runs — VERIFIED to
  fail identically on the committed W3.1 baseline with W3.2 stashed, so it is a
  pre-existing local-env timing issue (world-HUD visibility timeout under load),
  NOT introduced here. Board + joystick specs also flaked under the parallel run
  but recovered serially. The tick gate (build + 4-spec frozen smoke) is green.
- 2026-07-02 (W3.4a, mammals accuracy dossier): web-researched all ELEVEN
  non-bird `animal`-category models (ree, edelhert, vos, wolf, das, eekhoorn,
  wild zwijn, frisling, adder, heikikker, heideblauwtje — the box title says
  "zoogdieren" but §5 explicitly scopes it to the manifest's animal category,
  which includes the reptile/amphibian/insect) into
  `research/animal-visual-accuracy.md`. Every numeric/factual claim carries a
  real source URL + access date 2026-07-02; primary sources are
  Zoogdiervereniging/`zodion.nl` (NL, Veluwe-relevant), Natuurmonumenten,
  Wolven in Nederland, Hoge Veluwe, Wikipedia (EN+NL), Woodland Trust, Wildlife
  Trusts, Mammal Society, Animal Diversity Web, NCBI/PMC. Web tools WERE
  available, so no facts were invented; the five honest bron-gaten (eekhoorn
  eye colour; frisling shoulder height / body length / eye colour; heikikker
  weight + eye colour; heideblauwtje weight + eye colour; plus ree/edelhert eye
  colour flagged lower-confidence as it rests on a general-deer source) are
  marked "geen bron gevonden" rather than filled. Two intentional practices:
  (1) where a NL source and the species-wide Wikipedia range disagreed on a
  measurement, BOTH ranges are listed with the NL one noted as locally
  representative; (2) the file opens with a schaal-referentie table so W3.7 can
  set relative scale directly. Feeds W3.5 (gait/posture match), W3.7 (scale,
  coat tints, eye recipe) and W6.3 (kid-facts). Research fan-out ran as 5
  parallel subagents (deer / canids / das+eekhoorn / boar+frisling /
  adder+heikikker+heideblauwtje). Docs-only, no code touched → no player-visible
  change and no E2E assert; ticked with `--force` (the §5 W3.4a allowance, same
  as W3.0). Build + frozen smoke unaffected.
- 2026-07-02 (W3.4b, birds accuracy dossier): web-researched SIXTEEN
  mission-/audio-relevant birds into a NEW sister file
  `research/bird-visual-accuracy.md` (W3.4a's mammal file said "Vogels staan
  apart in W3.4b", so birds got their own dossier rather than bloating the
  mammal one). Coverage was scoped from ACTUAL code usage, not the plan's
  illustrative list: grep of `src/**` ranked raaf (61 refs — companion + audio
  + missions), nachtzwaluw (36 — own stuifzand mission + audio + synth call),
  roodborsttapuit (7 — decoy bird in three missions) and buizerd (5) as the
  real mission birds; merel/gaai/koekoek/ekster/vink/tjiftjaf/koolmees appear
  in content; the rest come from the plan's named list + staged distinctive
  species (groene + grote bonte specht, pimpelmees, winterkoning, zanglijster,
  roodborst). Added a dedicated **Roep/zang** field to every bird because W6.4a
  ("Ken je roep") builds a vogelzang-staircase with decoys — the call
  descriptions are that box's raw material. Primary source is Vogelbescherming
  Nederland (`vogelbescherming.nl`), backed by Natuurpunt, Ravenwerkgroep NL,
  vogelskijken.nl, Natuurfotografie.nl and Wikipedia NL+EN for the fields the
  NL page omitted (gewicht, oogkleur, spanwijdte-uitschieters); NL-vs-species
  ranges both listed. Web tools WERE available so nothing was invented — three
  honest "geen bron gevonden" gaps (koolmees adult iris, winterkoning iris,
  zanglijster iris) plus lower-confidence eye-colour flags stay marked, not
  filled. The 5 staged birds with no mission/audio role yet
  (boomklever, goudhaantje, boomleeuwerik, houtduif, wilde-eend) are listed as
  explicitly out-of-scope rather than guessed at. Opens with a spanwijdte
  schaal-referentie table (largest→smallest) for W3.7. Feeds W3.6 (ambient
  bird life / gliding birds), W3.7 (scale + eye recipe), W6.3 (raaf kid-facts)
  and W6.4a/b (bird-call slice). Research fan-out ran as 5 parallel subagents
  (corvidae / nachtzwaluw+tapuit+buizerd / lijsters+roodborst /
  spechten+koekoek / mezen+winterkoning+vink). Docs-only, no code touched → no
  player-visible change and no E2E assert; ticked with `--force` (the §5 W3.4b
  allowance). Build + frozen smoke unaffected.
