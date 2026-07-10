# Run 5 · Run D — the COHESION run (playability first, Fable plans + audits, Opus executes a phase)

> Master brief for the Run D sittings. The tickable checklist is
> [RUN-D-LEDGER.md](RUN-D-LEDGER.md); the single source of truth every sitting
> re-reads is **[RUN-D-DIRECTION.md](RUN-D-DIRECTION.md)** (inherited from Run C
> — the art direction stands; the Alvah child-height + blonde/blue corrections in
> its §2.4 are LAW). The locked spec above both is [VISION.md](../../VISION.md).
> The supervisor is `run-d-loop.sh`. START each sitting by re-reading
> RUN-D-DIRECTION.md, then this plan, then the ledger.
>
> Run D is the 2026-07-05 RECONCILIATION of Run C: same mandate ("make it
> excellent toward the VISION"), but (1) the ledger was re-verified box-by-box
> against fresh pixels + current code, (2) three real-device playability bugs and
> Alvah's true proportions/colours lead the run, and (3) the ROLES (rev 2,
> 2026-07-05): **Fable PLANS + AUDITS, Opus EXECUTES a whole phase** — Opus
> self-verifies + self-ticks each WORK box (build + e2e:smoke gate the tick
> mechanically); Fable audits at each phase gate, re-opens shortfalls, and
> defines the next steps. Quality control is per-phase, not per-box.

> **SCOPE — LAPTOP-ONLY automated verification (same as Run B/C).** The loop
> captures the **laptop** project only (`CAPTURE_PROJECTS=laptop`); the iPad leg
> hangs the software renderer (F-21). Grade every box on laptop pixels + asserts;
> make the shared-code change for "both"/"iPad" boxes; treat everything that
> needs **feel / audio / real device / real Safari / iPad pixels** as
> **demo-gated — Floris on the real device** (the DEMO section of the ledger).

## 0. What this run is (and is NOT)

Run D **repairs, deepens + unifies** the game that already exists (VISION §8)
toward one mechanically-true, naturalistic, coherent, felt experience. It does
NOT invent new mini-games or mechanics, does NOT rebuild from scratch, and never
trades away a frozen contract (§4) for spectacle. Priority: **(1) playability/
correctness — a game you fall through isn't worth polishing; (2) Alvah's truth —
child scale + his real colours; (3) the VISION §13 order — one naturalistic
world, realistic animals, felt progress, woven systems, polish.**

- **You change game code** under `app/src/**` and generate real assets — that is
  the job. Every change is gated on fresh capture evidence judged by an
  INDEPENDENT Fable sitting against RUN-D-DIRECTION.md, not on the fact that the
  code compiles, and not on the builder's own opinion.
- **You may extend + harden the capture harness** (`app/e2e-capture/**`) — it is
  the shared verification substrate, and Run D leans on it harder than any prior
  run: the Phase-1 playability boxes are verified by the harness **DRIVING the
  action** (walk a dune burst, drive the jeep, toggle + enter the heli) and
  asserting live dev-hook state across the burst. A static shot is NO evidence
  for a physics/interaction box (the Run-1 false-green lesson).
- **You never touch or weaken the frozen `app/e2e/**` specs, the `@smoke`
  suite, or `playwright.config.ts`.** They are the regression guard. (Unit tests
  in `src/**` are not frozen — update them honestly when a contract they pin
  legitimately changes, e.g. the Alvah child height.)
- **Capture output path stays** `runs/run-3-ux-polish/audit-evidence/`
  (hardcoded in the harness; the shared evidence dir for all runs).
- **Ground the work in the in-repo research** (`games/Ranger-Adventures/research/`
  plus `runs/animation-research.md`):
  **`runs/animation-research.md` (Floris's 2026-07-05 deep-research — FIRST
  READ for locomotion + animal animation; it SUPERSEDES older research where
  they conflict: raycast ground-snap over any physics engine §4; rigged CC0
  animated sources before Meshy regen §1; zero-credit rigging paths §2;
  spring bones for secondary motion §3; KIMODO + AI4Animation assessed and
  rejected as non-web/non-commercial)**,
  `3d-autonomous-sourcing-physics-world.md` §C for the Phase-1 character
  controller (three-mesh-bvh/BVHEcctrl or Rapier+ecctrl options — now the
  FALLBACK lens, not the first move),
  `animal-visual-accuracy.md` + `bird-visual-accuracy.md` for species realism,
  `veluwe-research.md` for biome ground truth, `3d-animal-animation-research.md`
  + `humans-full-animals-eyes-research.md` for rig/gait/gaze/eyes,
  `mini-game-research.md` for the EF grounding.

## 1. The build-and-tick gate (rev 2 — Fable plans, Opus executes a phase)

**Rhythm change (Floris 2026-07-05, rev 2).** Quality control moved from
per-box to per-phase. Fable defines the next precise actions; Opus then
executes every WORK box of a phase across as many sittings as it takes,
self-verifying and self-ticking; Fable AUDITS at the phase gate. There is no
per-box capture and no per-box Fable grade — the mechanical build + e2e:smoke
gate holds each tick honest between audits, and the phase AUDIT is where the
work is really proven.

For each WORK box, in one Opus sitting:

1. **OPUS BUILD sitting** reads the box's intent against RUN-D-DIRECTION.md +
   the box's verify-by, and makes the change under `app/src/**`. It exposes any
   dev-hook field the verify-by names and extends the capture harness
   (`app/e2e-capture/**`, allowed) when the verify-by needs a new
   scene/drive-burst — so the phase AUDIT can see it.
2. **Self-verify** as far as possible WITHOUT the ~35-min capture: `npm run
   build`, `npm run e2e:smoke`, and — for a harness / drive-assert box — the
   box's focused Playwright scene to read its burst annotations.
3. **Opus ticks its OWN box:** `node scripts/ranger-run.mjs tick "<needle>"` —
   it refuses unless `npm run build` AND the frozen `npm run e2e:smoke` are
   green (`RUN_LEDGER=runs/run-5-cohesion/RUN-D-LEDGER.md` is exported by the
   supervisor), so a broken build cannot tick. A `+demo` box's text gets
   " — implemented, awaiting Floris demo (NOT accepted)" appended at tick time.
4. If Opus cannot make the verify-by hold this sitting: leave the box open and
   STOP (the loop retries once, then parks the box to DEFERRED.md and continues
   — defer-and-continue). A box that needs a human/login prints
   `NEEDS-FLORIS: …` and is parked.

The supervisor commits + pushes **every step** the ledger advances, so drift is
bisectable commit-by-commit (VISION §10). Sittings never commit. The honesty
contract still binds: **Opus must not tick a box it does not believe meets the
verify-by** — a false tick just returns at the audit and wastes a sitting;
honest red beats a false green.

## 2. The plan → execute → audit rhythm (rev 2)

- **Fable PLANS.** A `DIRECTION` box (and, in practice, every `GATE-Dn` audit)
  is where Fable defines the next precise actions: it refines
  RUN-D-DIRECTION.md (never weakening the frozen contracts or the §2.4 Alvah
  corrections), sharpens vague verify-bys so Opus can execute without guessing,
  and appends concrete boxes.
- **Opus EXECUTES.** It writes the TypeScript for every WORK box of the phase,
  self-verifies, and self-ticks. It builds honestly, knowing the audit checks
  its work.
- **Fable AUDITS at each phase `GATE-Dn`.** The supervisor captures once; a
  fresh independent Fable sitting re-checks the whole phase SCEPTICALLY against
  RUN-D-DIRECTION.md (it did not build it, and Opus self-ticked, so it does not
  trust the tick): it ticks the gate, RE-OPENS boxes (`[x]`→`[ ]`) with a
  precise fix line in §8, APPENDS new `- [ ] Dn.m` fix boxes, and defines the
  next phase's steps. The ledger is open-ended, converging to the doc's
  "excellent per screen" bar. A missing/GAP frame is not a pass; a
  player-unreachable frame is no evidence.
- **`+demo` items are never closed by any model.** Ceiling: "implemented —
  awaiting Floris demo". The verdict is Floris's on the real iPad (DEMO section).
- **No re-litigating done work** — once a phase passes its audit it is frozen
  unless a later box forces it.
- **Model fallback:** if Fable hits a usage/model limit on a PLAN/AUDIT sitting,
  the supervisor falls back to Opus for the planner/auditor role ONCE and
  continues (launch with `MODEL_FABLE=opus` to start that way). A limit that
  then persists on Opus is the real account-wide stop and pauses the run.

## 3. Asset-generation discipline (real money, autonomous — carried from Run C)

~7,600 Meshy credits are authorized (VISION §6), **spread wisely by
impact-per-credit** — the ranked list is RUN-D-DIRECTION.md §5 (player ranger +
raven + 5 flagships first; plan ≈600–1,100 cr total, large reserve). Every
generated model clears the same bar as any change:

1. **Generate ONLY what the box names**, ONLY via
   `node scripts/meshy-gen.mjs --only=<id>` (or `--limit=N`). NEVER an
   unfiltered `assets` / `assets:all` / `meshy-gen` / `ranger-run.mjs run` /
   `npm run finish` — that would re-buy the whole ~76-item cast.
2. **Run it BACKGROUNDED with log polling** — Meshy jobs exceed the 10-min tool
   ceiling. NEVER print `.env.local`; use `scripts/meshy-balance.mjs` for the
   masked balance.
3. **Optimize** through the existing pipeline (`meshy-gen → gltf-optimize →
   optimize-animated`) to the <150 draw-call / perf budget.
4. **Never-scary / calm-pose gate** — realistic ≠ menacing.
5. **Fable judge** — a model that does not both look real AND belong is
   rejected + regenerated, not kept.
6. **Log the credit spend** per model. The usage-guard's `--asset` preflight
   pauses new-asset work when the balance is under the reserve.
7. **The regenerated ranger must keep Alvah's truth** — child ≈1.2 m
   proportions, blonde wavy hair, blue eyes (direction doc §2.4).

**Usage / time STOP (honest):** the weekly Claude usage % is not measurable, so
the run stops when a sitting actually hits the limit (detected in that
sitting's own output → clean NEEDS-FLORIS pause; re-launch after the window
resets and it continues from the next box). The pre-flight
`node app/scripts/usage-guard.mjs` enforces what is real: the Meshy balance vs
reserve for asset boxes, and the per-session wall-clock
(`RUNC_TIME_BUDGET_SEC`, default 8h). A single-instance lock + a
no-other-run-loops preflight prevent double launches.

## 4. Frozen contracts — STILL inviolable (carried verbatim; VISION §11)

- **Motion-comfort camera law:** fixed FOV, roll 0, no head-bob / motion-blur /
  snap-rotate / FOV-kick / screen-shake; reduced-motion turns camera *moves*
  into cuts; locomotion itself always allowed; any orbit/zoom/reframe is
  player-initiated + damped.
- **Never-scary / never game-over**, calm-pose gate for animals; the wolf is
  story-gated and may never appear as a casual distractor. Leaving/stopping
  reads as neutral navigation — no guilt copy.
- **≥56 px tap targets; <150 draw calls; pixelRatio ≤ 2; iPad-first.**
- Persistence ONLY via `state.ts`/`persist.ts` in the `alvah-ef-v1` `ranger`
  namespace — **no new localStorage keys** (one-time-hint flags included).
- Reading **AVI M3/E3, ≤7 words per visual line, read-aloud on new strings**;
  one instruction per line.
- **Construct-parity + a 2D floor per mini-game** — the EF science stays intact.
- **Sound = real animal calls only (xeno-canto)**; calm/never-startle; no
  ambient/music pass yet; assets via `assetUrl`.
- **NEW DEPENDENCIES ARE AUTHORIZED** (Floris 2026-07-03, carried): the models
  may web-research and `npm install` a well-licensed (MIT/Apache/CC0/BSD),
  self-contained library where it clearly fixes playability or raises
  realism/cohesion — the §C character-controller options are pre-researched.
  Every dep still binds to the contracts: <150 draw calls, pixelRatio ≤2,
  iPad-first, build + e2e:smoke green, **zero runtime
  network/telemetry/CDN/tracker calls**, never trades away
  motion-comfort/never-scary. Lockfile committed with the step.
- No surnames. **Never print `.env.local` values. Never commit `assets-gen/`.**

## 5. The verification substrate (what the asserts read)

The capture harness boots the real game and writes, per shot, the live dev-hook
state into `annotations-laptop.json` (`screen`, `pos`, `cameraYaw`, `drawCalls`,
`missionView`, `clip`, `board`, `vehicle`, `heli`, `avatar.height`, `cam.*`,
ground speed, …). Run D ADDS: `grounded` + foot-clearance (P1.5a), per-frame
drive-burst deltas (P1.5b), the Instellingen-toggle → pad → enter chain
(P1.5c), the mature-human height (P1.6a), and per-box scenes as verify-bys
demand. **Physics boxes assert the WHOLE burst, not one frame. Pixels are the
court of appeal for looks; burst annotations are the court of appeal for
motion. A capture frame counts as evidence only when it shows the surface the
player actually reaches** (the Run C sandbox lesson — direction doc §8.7).

## 6. Hard prohibitions

- Do NOT touch/weaken `app/e2e/**`, the `@smoke` suite, or
  `playwright.config.ts`.
- Do NOT invent new mini-games or mechanics, rebuild from scratch, or touch a
  frozen contract (§4).
- Do NOT run the unfiltered asset pipeline or `npm run finish` (§3).
- Do NOT mark any +demo box "accepted".
- Do NOT re-litigate a screen a prior gate froze (§2) unless a later box forces
  it.
- Do NOT invent a pass. Honest red beats a false green.
- Never commit `.env.local` or `assets-gen/`; never print secret values.
- Box wording rule (supervisor dispatch): see the ledger header. First lines of
  work boxes must not contain `GATE-`, `DIRECTION`, `DEFERRED`, or `DEMO ·`;
  asset boxes must name `meshy` in the first line.

## 7. Direction-doc-first (no live checkpoints — the guardrails carry the weight)

RUN-D-DIRECTION.md exists at launch (inherited from Run C). The run's FIRST
sitting (D0.1) is the Fable art director validating + refining it and the
reconciled ledger against fresh pixels — committed as the first act, so drift
is visible and reversible from commit 1. The guardrails together: the committed
direction doc · hard mechanical gates on every tick (build + e2e:smoke) ·
independent Fable AUDIT of every phase at its gate (re-opens shortfalls,
defines the next steps) · commit + push every step · usage/credit stop + stall
guard (defer-and-continue) · the DEMO section for everything feel/audio/device.

## 8. Run D log (append-only, one line per surprise / grade-fail / director note)

- (grade sittings append a line here when a box falls short; the art director
  appends a line when it re-opens a box or appends a new one — so the reasoning
  behind every re-open is traceable.)
- 2026-07-05 D0.1 (Fable art director): ledger validated against the fresh 12:19 capture — every open Phase-1/2/3 box re-confirmed in pixels; the five reconciliation cuts (P1.0/P1.1/P1.4/P1.5/P1.14 + the 2D floors 35–39) re-verified on-style in fresh frames and stay cut; no open box is already met; phase order confirmed (playability → Alvah → cohesion → realism → felt progress).
- 2026-07-05 D0.1: the 12:19 `npm run capture` exited PASSED while the reduce-motion-toggle scene GAPped (`.explore-pause` click timeout, empty shot idx 32, zero fresh Instellingen frame) — Playwright-green ≠ complete; D1.0's "all groups complete" is the operative bar, and D3.10's missing capture scene is confirmed live.
- 2026-07-05 D0.1: fresh `45-ven-shore` shows the P1.5a sink ON LAPTOP — the ranger neck-deep in the ven-bowl slope; P1.5a's walk burst extended to include the ven shore (the bug is not device-only, it lives where visual terrain and `heightAt` disagree, as the Phase-1 preamble hypothesized).
- 2026-07-05 D0.1: `12/13-camera-zoom-*` are IDENTICAL pre-settle voids (annotation `cam.dist` 1.67 vs `zoom.dist` 9.5, `avatarOpacity` ≈ 0) → appended D1.1 (settle-wait + pixelHash-differ, harness-only); D3.13 stays open on the same frames (ranger invisible over a featureless gradient).
- 2026-07-05 D0.1: fresh `29-mission-3d` opens with the camera buried against the missiebord's BACKSIDE (`avatarInView` false, no gras/frisling in frame) — D3.8's mission-target-in-frustum assert is exactly the gate that must catch this; a board-backside frame is no-evidence for the mission scene.
- 2026-07-05 D0.1: `26-jeep-straight-2` shows "Stap uit" with the jeep fully hidden behind a tree canopy — P1.5b's shot leg requires the jeep visibly in frame; the follow cam must land OUTSIDE props (doc §2.5). NB the laptop `veh`/`pos` annotations show the jeep DOES translate (z 8.7→−53.4 on the straight burst) — Floris's stick-and-slide is input/device-side, which is why P1.5b is drive-assert + demo.
- 2026-07-05 D0.1: `33-boundary-rim` shows the ranger shadowless at ~70 m while `06-walk-1` near spawn has the long soft shadow → appended D3.14 (grounding shadow across the walkable range; skinned shadow pass dies at range though the frustum follows, World.ts:3064).
- 2026-07-05 D0.1: the frozen e2e pins `fov = 55` (vehicle.spec.ts:144, heli.spec.ts:132) — direction doc §2.5 refined to record the pin; the ~35–45° research lens is OUT of reach this run and no box may chase it (a builder chasing it would break the frozen suite).
- 2026-07-05 D0.1: the story-gated WOLF sprite appears in ALL FIVE fresh game3d frames (sandbox ring, confirmed `/?sandbox` at capture.spec.ts:806) — D3.4–D3.7's "no wolf / staged GLBs" legs are never-scary-critical, and D1.0's player-path re-point is what makes those five frames judgeable at all.
- 2026-07-05 (rev 2 rhythm change, Floris): quality control moved from per-box to per-phase. The supervisor (run-d-loop.sh) now runs WORK boxes as OPUS BUILD sittings that self-verify (build + e2e:smoke, focused harness scene) and self-tick — no per-box capture, no per-box Fable grade. Fable PLANS at DIRECTION boxes and AUDITS the whole phase at each GATE-Dn off one fresh capture (re-opens shortfalls, appends concrete fix boxes, defines the next steps). §1/§2 here + the ledger header + direction §intro rewritten to match. The mechanical build+e2e:smoke tick gate is unchanged, so a broken build still cannot tick. Fable→Opus fallback now covers the plan/audit role.
- 2026-07-05 (pause-window integration, Fable planner sitting with Floris): Floris's animation/physics deep-research landed as `runs/animation-research.md` and was folded into the run docs — D0.2 appended (Fable ranks the research-derived work), D1.2 (raycast ground-truth) + D4.0a/D4.0b (rigged-CC0-first sourcing + zero-credit rigging) + P5.6 (spring bones) appended, the Phase-1 preamble + Phase-4 sourcing order + P1.5a/b + P2.1 rewritten off the kinematic/Meshy-only assumption. Deps installed in app/: `three-mesh-bvh` (MIT) + `@pixiv/three-vrm-springbone` (MIT); cannon-es deliberately NOT installed (shelf option). KIMODO + AI4Animation assessed and rejected (not mobile-Safari-feasible; AI4Animation non-commercial). Mixamo (human re-rig path) needs a free Adobe ID = Floris login — boxes that hit it print NEEDS-FLORIS.
- 2026-07-05 D0.2 (Fable art director): animation-research read in full and adopted whole — no verdict overruled. Ranking of the research-derived boxes: D1.2 KEPT as the Phase-1 locomotion foundation (fresh `39-ven-shore` buries the ranger to his hair on the ven slope again — the `heightAt`/mesh divergence is current); D4.0a KEPT leading Phase 4, SHARPENED with an audition-at-follow-distance rule (one in-world frame per sourced species judged against doc §2.4 must-reads + §2.3 one-fidelity BEFORE any cast swap — Quaternius covers deer/stag/fox but its flat-shaded style is a §2.3 risk to judge on pixels, not assume; the free wolf stays story-gated OUT); D4.0b KEPT (raaf/das/zwijn/frisling have no CC0 animated source — zero-credit rig paths are their only non-spend route); P5.6 KEPT in Phase 7 (needs Phase-4 rigs first). Nothing parked. Foot-IK + cannon-es stay shelf options exactly as the research says. Phase-1 preamble + Phase-4 sourcing order read coherently against the ledger and the doc. Doc refined: §2.2 one-ground-truth (rendered mesh), §2.4 clips-outrank-bob + audition rule, §2.5 never-under-terrain, §8.7 no-evidence extensions, §5 note validated, §9 D0.2 record.
- 2026-07-05 D0.2: the 13:54–14:27 capture (in-flight D1.0 edits) proves the player-path re-point + 72-orphan prune WORK — and that the billboard/wolf ring was SANDBOX-ONLY: the three captured player-path game-3D frames show primitives on bare ground instead (zoeken: cream-egg frisling + blob-gras beside the board; corsi: no route field at all; simon: dark lumps with name-chips). D3.4–D3.8 evidence lines updated; fix targets unchanged.
- 2026-07-05 D0.2: the fresh run still ran 32.7 min and GAPped board (~300s cap), game-3d (~600s cap — dagnacht + wisselen 3D frames missing on the winStep-advance path) and reduce-motion-toggle (same `.explore-pause` timeout as 12:19, so no Instellingen frame exists) — D1.0 stays the first work box; the zoom pair now pixel-differs (progress) but still shoots pre-settle (`cam.dist` 4.07 vs `zoom.dist` 9.5) — D1.1 confirmed needed.
- 2026-07-05 D0.2: NEW gap → D1.3 appended (Phase 1): simon-3D was shot from UNDER the terrain by the game's own mission-entry reframe (`cam.y` −1.29, up-tilt, `avatarScreen.visible` false while the ranger is plainly in frame) and corsi-3D near-straight-down off its playfield — the camera-outside-terrain law extends UNDER it. Also: the dev-hook visibility booleans disagree with pixels in BOTH directions (fresh `39-ven-shore` claims visible=true while the ranger is buried) — hooks are asserts, pixels are the court (doc §8.7).
- 2026-07-05 D0.2: jeep straight-burst annotations again prove real translation (x 14.5→28.8 / z 12.7→−20.8, unwrapped heading stable ≈17.58 — no doughnut) while the `26-jeep-straight-2` SHOT contains no jeep at all — P1.5b's shot leg (vehicle visibly in frame) is doing real work; keep drive-assert + shot + demo as written.
- 2026-07-05 D1.0 grade (independent Fable verify, fresh 15:21–15:57 capture): FAIL — verify-by legs 1+2 unmet: the game-3d group GAPped its ~840s budget AGAIN (explicit GAP entry in annotations) and only 1 of 5 player-path game-3D frames was even attempted — `game3d-zoeken` died mid-shot on the browser-closed protocol error the box's (a) retry must absorb (ok:false, pixelHash null, `49-game3d-zoeken.png` referenced in annotations but ABSENT on disk); corsi/simon/dagnacht/wisselen 3D frames wholly missing. Green for the record: zero orphan PNGs (the prune works), all five 2D floors present, every recorded drawCalls <150, and the long-GAPping Instellingen (`33-instellingen-rm`) + reduce-motion-toggle + board groups now complete. Fix focus: bound/isolate game-3d PER GAME with the shot-level newPage/browser-crash retry, and never write a `file` field for a shot that produced no PNG.
- 2026-07-05 D1.0 grade #2 (independent Fable verify, fresh 16:15–16:52 capture): FAIL — legs 1+2 still unmet: FIVE explicit GAP entries — `game3d-zoeken` + `game3d-wisselen` died on a `locator.waitFor` 15s timeout the shot-level retry does not absorb, `game3d-simon` overran its ~240s per-game budget, and `jeep` + `board` (complete at 15:21) both overran ~300s — a run-over-run flake regression; only 2 of 5 player-path game-3D frames landed (corsi + dagnacht, both true mission-path frames) and the run took ~37 min against the ~30-min budget. Real progress for the record: per-game game-3d isolation works (GAPs are per-game now), phantom `file` fields fixed (GAP entries carry `file:""`, zero orphans, 39 PNGs ↔ 39 annotated shots), all five 2D floors present, every recorded drawCalls <150 (max 61). Fix focus: absorb the waitFor-timeout family in the retry (not only newPage/browser-crash), and stabilize jeep/board group timing so completeness is deterministic, not luck. NB shots 11–15 share ONE pixelHash (a featureless void frame; avatarOpacity ≈ 0) — D1.1/D3.13 evidence, not this box's legs.
