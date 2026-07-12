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

> **WATCHING THE RUN (Floris's terminal view).** The supervisor writes TWO logs:
> `RUN-D-PROGRESS.log` is the **clean per-session feed** — one banner + one
> result line per sitting, showing `SESSIE N/max`, `vakjes af: N/total`, what
> ran (Opus bouwt / Fable plant / Fable audit), and the outcome
> (✔ af / ↻ bijgewerkt / 🙋 geparkeerd / ⛔ gepauzeerd) + the next box. Watch it
> with `tail -f runs/run-5-cohesion/RUN-D-PROGRESS.log`. `RUN-D-LOOP.log` is the
> **full verbose debug log** (model output, capture, git) for when something
> needs digging into. Every launch appends a "RUN D gestart … · max N sessies"
> banner so a fresh tail is self-orienting.

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
- 2026-07-11 GATE-D1 audit (independent Fable, fresh 23:10–00:01 capture, 10/10 specs green): the phase's MECHANICAL CORE IS TRUE — D1.2 (21/21 samples grounded, clearance 0, analyticGap 0→2.71 m proves the raycast ground-truth is live and diverging from the old `heightAt`), P1.5a (32/32 grounded across spawn→relief→ven-shore, divergence zone crossed at gap 2.07 m, fresh ven frames + `36-ven-shore` show feet-on-ground everywhere — the neck-deep burial is gone), P1.5b (real translation: ~50 m monotonic straight leg at constant heading, full-circle turn with smooth unwrapped heading 0→7.12 rad, |clearance| < 6e-5; the jeep visibly at three different world spots and IN frame each time), P1.5c (toggle 420×64 px on-screen → available → near → inHeli all true; pad affordance + in-flight frames confirm), D1.3 (all five mission entries: cam.y 2.5–3.6 m over ground 0.03–0.22 m, taskInView=true, pitch −0.45…−0.67, five d13 player-path frames show the playfield — simon's under-terrain shot and corsi's straight-down framing genuinely fixed). These five stay ticked; P1.5a/b/c remain +demo-capped. GATE-D1 NOT ticked: D1.1 re-opened + D1.4/D1.5 appended (below).
- 2026-07-11 GATE-D1: D1.1 RE-OPENED — verify-by unmet in the audit capture: the `camera-attempts` scene GAPped ("camera boom never settled within 6000 ms", last cam.dist 4.854 vs zoom target 9.5 — the headless-throttled ease the D1.3 sitting measured at ~13× slower), so ZERO zoom frames exist, the pixelHash-differ assert never ran, and the fresh set carries five new GAP entries against the box's "no new GAP entries" leg. Opus's 16:45 self-verify capture (0 GAPs then) was real but did not survive the fuller run. Exact fix: give the camera scene's settle the same ~20 s bounded best-effort backstop `settleMissionCam` got (capture.spec.ts), THEN snap both zoom shots; keep the pixelHash-differ assert HARD (a best-effort settle must never excuse two identical pre-settle frames).
- 2026-07-11 GATE-D1: D1.4 APPENDED (harness) — the audit capture's main flow ran 39.6 min and GAPped five groups (camera-attempts · jeep · board deels · boundary · game3d-simon), which starves the NEXT audits: D3.13 needs the zoom/orbit frames, D3.14 the boundary-rim frame, P4.x the world jeep shots; and the orphan-prune skips burst subdirs, leaving stale 17:0x PNGs beside fresh 23:5x ones in `d12-ground-burst/` + `p15a-ven-burst/` (mixed-vintage evidence). Supersedes the parked D1.0 residue with current evidence; verify-by = zero GAP entries + subdir prune.
- 2026-07-11 GATE-D1: D1.5 APPENDED (game) — fresh `09-walk-4` is a full-frame foliage VOID: the free-walk follow camera sits INSIDE a tree crown on the plain spawn-south walk (cam.y 3.59 above terrain 1.12 — the D1.3 above-terrain law holds, but §2.5's outside-props law has no free-walk enforcement) while the hook claims `avatarInView`/`avatarScreen.visible`=true — a hook-vs-pixel breach (doc §8.7); `10-walk-5` same family (sapling swallows the ranger). Direction: FADE the occluder (opacity — not a camera move, comfort-safe), never auto-move the camera; make the visibility hook a real clear-line test; assert it across the walk burst.
- 2026-07-11 GATE-D1 (Phase-2 sharpening): P1.6a now names the `ratioToRanger` rescale trap (AnimalScale.ts:74 divides animal heights by `RANGER_STAND_HEIGHT` — writing 1.2 there would inflate every animal ~42%; split off an `ADULT_REFERENCE_HEIGHT`), the staged `ranger-warden-boa.glb` as the on-path comparison adult (seat at the hub), and idle-sampling for the height assert (fresh annotations read 1.6999 idle / 1.7122 mid-walk — the bob inflates). P1.6b now names its judged surfaces (`01-title` close-up + a d13-*-entry at follow distance, both currently dark-haired) and the golden-key hue caution (blond, not oranje). D3.2's evidence updated: the newest `36-ven-shore` frames NO water at all (the P1.5a waterline-stop halts ~21 m out facing bushes) — the box must steer the shot onto the water disc.
- 2026-07-11 GATE-D1 audit #2 (independent Fable, fresh 02:53–03:34 capture, 11/12 specs green): the phase's mechanical core RE-CONFIRMED frame by frame, no regression — D1.2 21/21 grounded at clearance 0 (analyticGap →2.75 m), P1.5a 29/29 grounded spawn→vogelkijkhut→ven-shore with `reached`=true at 13.7 m from ven-center, P1.5b full-circle turn (unwrapped heading 0→7.17 rad, smooth) + ~55 m monotonic straight leg with the jeep visibly at three world spots in the p15b frames, P1.5c toggle 420×64 px on-screen → available → near → inHeli with pad + in-flight frames, D1.3 all five entries above terrain with the task staging in frustum (wisselen's `avatarScreen.visible`=false is honest — the ranger genuinely stands behind the board). Frozen `app/e2e/**` verified untouched by Run D.
- 2026-07-11 GATE-D1 audit #2: D1.1 ruled MET and stays ticked — the zoom pair now provably settles (harness asserts the HORIZONTAL boom vs the dolly target: 1.61≈1.61 m on the min-clamp, 9.50≈9.50 m on the max; the annotation honestly documents cam.dist's fixed ~1.5 m eye-height offset) and the pair pixel-differs; the camera group completed in 100 s/240. The one residual GAP in the fresh set (`jeep`, 421 s vs 420 s) is unrelated to camera-settle and is routed to the new D1.6, not held against D1.1 — its own §8 re-open line (settle backstop + hard pixelHash assert) is exactly what landed.
- 2026-07-11 GATE-D1 audit #2: D1.5 RE-OPENED — the fade machinery landed but fails its own court: the view-clear spec FAILED in the audit capture (occludedFrames 6, minFade 0.9621 vs the ≤0.5 see-through assert — Opus's committed self-verify honestly hit 0.16/11 frames, so the tick was honest but the fade's slow ease is load-fragile and player-visible), fresh `11-controls-hud` (z≈−59 on the plain walk) is a full-frame murk close-up while the hook holds `viewClear`=true + `canopyFade`=1 (the lens-INSIDE-crown case: a frontface-only ray from inside a crown exits unhit — the hook still lies at snap time), and `12-pause-hub` at the same spot shows canopyFade 0.16 with the backdrop STILL murk (fading one crown is not enough when the lens sits inside foliage). Exact fix in the box: near-instant fade attack (≤0.35 opacity in ~0.2 s, slow release, RM may snap), lens-inside-crown detection + fade every sightline crown, `viewClear` false while any sightline occluder is >0.5 opacity. Direction doc §2.5 extended with the fade-effectiveness law.
- 2026-07-11 GATE-D1 audit #2: D1.6 appended (harness) — the ONLY incomplete group left is `jeep` (GAP at 421 s vs its 420 s budget, zero world jeep frames in the fresh set); everything else the parked D1.4 wanted verifiably landed in this capture (all other groups well inside budget, 9 orphans pruned, burst subdirs all-fresh) — DEFERRED.md annotated: D1.6 carries the residue in the loop. Fresh-pixel notes for later phases: `34-boundary-rim` now shows a soft grounding shadow under the ranger at ~70 m (D3.14's rim leg — judge at GATE-D3), the ven water is still never in frame (D3.2 stands), corsi's route DISCS now exist on the player path (D3.4 evidence updated: was "no route field at all"), and the fresh zoom-in frame shows feet + contact shadow + readable ground (D3.13's want, pending the Phase-2 child band).
- 2026-07-11 GATE-D1 audit #3 (independent Fable, fresh 04:22–05:09 capture, 11/12 specs green): D1.5 ruled MET and stays closed — its view-clear spec ran green INSIDE the full capture (minFade 0.04 vs the ≤0.5 assert, occludedFrames 15; the fade attacks to near-invisible within one sample and the new lens-inside-crown point-in-volume test kills the frontface blind spot), and the pixels confirm at the exact conviction spots: `09-walk-4`/`10-walk-5` (audit-#1's voids) show a readable ranger in context, `11-controls-hud` (audit-#2's murk-with-lying-hook) shows him clear to the horizon with buildings visible, `12-pause-hub` holds canopyFade 0.04 sampled at snap over a readable backdrop; RM freeze pairs pixel-identical (toggle-world/idle-hold + reframe-cut/settled share hashes); drawCalls max 100. Mechanical core re-verified third audit running: D1.2 21/21 grounded clearance 0 (analyticGap →2.74 m), P1.5a 28/28 + reached, P1.5b heading 0→7.23 rad smooth + 49.7 m straight at 0.000 rad drift + jeep at three world spots in frame, D1.3 five-for-five above terrain with task in frustum. Frozen `app/e2e/**` verified untouched. One look note for GATE-D3: inside the bos the 0.04-ghosted crowns read a little skeletal — the sanctioned trade (never lose the ranger), judge the LOOK there.
- 2026-07-11 GATE-D1 audit #3: D1.6 RE-OPENED — verify-by unmet: the `jeep` group GAPped the RAISED 720 s budget at 721 s (zero world jeep shots, THIRD capture running). Diagnosis: the +1 s pattern (421/420 → 721/720) is the budget-kill granularity, not a near-miss — Opus's "the body returns at ~421 s" premise misread a kill time as a completion time, so the budget raise could never fix it. The walk-to-jeep poll-correct-hold loop DIVERGES under full-capture load (keys held between polls whose evaluates take ~2+ s late in the flow → uncorrected multi-metre legs > the `near` radius → the ranger orbits the jeep, consuming any budget), while the standalone jeep-drive spec walks the same approach on a fresh browser in ≤90 steps and passes every audit. Exact fix in the box: convergence-safe approach steering (pulsed keys ≤~400 ms per poll, or the game's own F-17 click-to-walk), the same for the heli spec's 240-step loop, burst JSONs wiped/rewritten at spec start (the failed heli spec left `heli-enter-laptop.json` stale at 03:26 beside fresh 04:58 PNGs — mixed-vintage evidence), then lower the jeep budget honestly.
- 2026-07-11 GATE-D1 audit #3: P1.5c ruled STILL TICKED despite its spec failing this capture (`at the pad heli().near is true` → false) — the failure is the harness walk loop, not the game: `p15c-heli-01-at-pad.png` shows the ranger standing directly in front of the parked helicopter (the walk arrived in pixels and exhausted its 240 steps just outside the near radius), the full toggle→available→near→inHeli chain was proven at audits #1+#2, and no heli game code changed since (the only game-code commit in between is D1.5's camera-fade, which does not run in-vehicle and touches no locomotion). The spec's return to green inside a full capture is carried by the re-opened D1.6 and re-checked at the gate. Phase-2 sharpening off fresh pixels: P1.6a now names the `CAM_LOOK_H = 1.1` + idle look-at `+1.0` adult-height constants that must scale with the child rig (avatarTopY already self-measures at load, World.ts:1804) and the warden's ghost-white distance fade (`p15b-jeep-01`) for the pair-shot staging; P1.6b adds `15-camera-zoom-in` as the closest judged hair surface.
- 2026-07-11 GATE-D1 audit #4 (independent Fable, fresh 06:07–06:59 capture, 11/12 specs green, capture exited NON-ZERO on the heli spec): the mechanical core held a FOURTH time — D1.2 21/21 grounded clearance 0 (analyticGap →2.75 m), P1.5a 29/29 + reached with feet+shadow in every ven frame, P1.5b spec green AND the jeep group COMPLETE for the first time in four captures (367 s/540 — the pulsed-walk convergence fix WORKS for the jeep): all eight world shots landed with the jeep visibly in frame at distinct spots (heide + markers + bosrand + beside the vogelkijkhut after the ~36 m straight leg — the old canopy-hidden straight-2 shot is fixed), D1.3 five-for-five above terrain with the task staged in frustum (main-flow + d13 frames agree), D1.1 zoom pair settled on both clamps and pixel-differed, RM freeze/cut pairs pixelDiff ratio 0, drawCalls max 77. Frozen `app/e2e/**` untouched (commit ec047ac is harness+docs only). The gate did NOT tick — two re-opens + one append below.
- 2026-07-11 GATE-D1 audit #4: D1.5 RE-OPENED — its crown machinery is real (view-clear spec green inside the capture: minFade 0.04, occludedFrames 14) but the verify-by's shot-leg failed at its own named spot: fresh `11-controls-hud` (z≈−60.4; the duration-based walk drifted ~2.6 m south of audit-#3's pass position) is a full-frame murk void with NO ranger while the hook claims viewClear=true + canopyFade=1 + visible=true. Geometry convicts a TERRAIN dune face between lens and ranger (cam.y 3.71 vs groundAtCam 1.45, near-horizontal pitch, frame filled edge-to-edge by a shadow-receiving surface) — terrain cannot be faded and the clear-line hook does not test it. Exact fix in the box: extend the follow camera's existing damped terrain-following to clear the WHOLE cam→avatar sightline (boom-lift/crest-ride, comfort-safe, RM=cut), make viewClear/avatarScreen.visible test the same terrain+prop line, reset lingering fades on composed screens (fresh `13-title-return` shows half-ghosted crowns on the title), and pin the controls-hud/pause-hub sample to fixed world coordinates so the evidence stops wobbling.
- 2026-07-11 GATE-D1 audit #4: D1.6 RE-OPENED — the jeep half is PROVEN and frozen; the rest failed: (1) `heli-enter.spec.ts` failed its FOURTH capture, now by non-convergence (pulsed branch (a): ~6.5 min for ~33 m on a fresh isolated page, test-timeout mid-poll, only the Instellingen frame; the JSON wipe worked so no stale evidence — but a failed walk leaves NO step trace). Directed to branch (b): the game's own click-walk (F-17, proven live in `18-camera-click-walk`) + a no-progress watchdog + incremental step-flush so failure leaves evidence. (2) The pulsed walkTo REGRESSED the board group: it accepts a STALE near (mid-pulse the walk-target crosses the 2.4 m ring, the rAF-lagged flag reads true at the post-release poll) — fresh `27-board-affordance` snapped at 2.87 m from the board with board.near=FALSE (audit #3: 0.97 m inside), the affordance never rendered, and mission-board + mission-3d GAPped (the ONLY two GAP entries; both were ok:true in audit #3). Fix: confirmed-near (re-read after release+settle; only return on a confirmed radius hit) for every walkTo caller. (3) `28-mission-stopped` passed VACUOUSLY (no mission ever ran; press() no-ops on absent controls; screen==='world' held from the start) — the scene must assert its precondition or GAP; §8.7 extended with the vacuous-pass lesson.
- 2026-07-11 GATE-D1 audit #4: D1.7 APPENDED (game) — fresh `14-title-return-world` shows the hub with the ranger's shadow crisply cast and NO body (shadow pass draws, skinned mesh does not) while the hook claims avatarOpacity 1 + visible + clip idle: an invisible ranger on the REAL player path (title round-trip), hook-vs-pixel breach. Candidate causes named (target-vs-rendered opacity in the avatarOpacity ease; a stuck/slow fade-in racing the snap; stale skinned-mesh bounds after the title reframe — the F-07 family's shadow-vs-body split signature); the box demands the real cause, a rendered-opacity hook, and body-visible within ~1 s of re-entry (RM: instant). Phase-2 sharpened: P1.6a now sequences AFTER D1.7 (the child-rig rescale rebuilds exactly the bounds/opacity machinery D1.7 repairs, and the pair shot needs the rendered-opacity hook to assert honestly).
- 2026-07-12 GATE-D2 audit (independent Fable, fresh 04:46–05:33 capture): PHASE 2 PASSES — GATE-D2 TICKED. P1.6a met on every leg: idle `avatar.height` 1.19999 ∈ [1.1,1.35] across all world annotations, warden 1.8 live on the hook per burst sample, ratio 0.667 < 0.75, drawCalls max 73; the pair pixels are unmistakable (`p16a-child-vs-adult` + `p16a-childscale-04` face-on solid warden + `16-camera-orbit` near-foreground adult vs tiny child at the cabin); code inspection confirms the trap-avoidance the box demanded (`ADULT_REFERENCE_HEIGHT` 1.8 split from `RANGER_STAND_HEIGHT` 1.2 so `ratioToRanger` anchors on the adult — animals NOT rescaled; `camLookH`/`camIdleLookH` derive from the self-measured `avatarTopY`); RM freeze pairs pixelDiff ratio 0 through the rescale. P1.6b met on every judged surface: `01-title` (close, wavy pale-blond, calm), `14-camera-zoom-in` (crown fills frame, blond not oranje), all five d13 entries (follow distance), face-on `38-reduce-motion-reframe-before` (blue eyes + yellow shirt + green jacket) and the `02-avatar` creator (preview blonde + round blue irises; presets Alvah·Bo·Robin·Sam·Veer + huid/haar rows live, blonde haar swatch selected) — stays +demo-capped for Floris.
- 2026-07-12 GATE-D2: Phase-1 spot-verification (gate shelved by Floris, so recorded here, not re-litigated): D1.7 PROVEN in pixels (`13-title-return-world` shows the BODY at the hub; d17 burst renderedOpacity 1 with the body visible in every return frame — the shadow-only conviction frame is fixed). D1.5's crown+reset machinery PROVEN (walk set readable incl. the audit-#1 conviction spots; `12-title-return` crowns at FULL opacity; view-clear spec green inside the capture, minFade 0.04) — but its TERRAIN-leg evidence at the pinned controls-hud spot is MISSING: the scene crashed on `ReferenceError: tx is not defined` in the new pinned-walk harness code (one of only two GAPs). Ruling: D1.5 stays ticked (game machinery + spec + 5-frame walk set + title reset all hold); the crash-fix + the returning controls-hud frame are new box D3.15, and GATE-D3 re-courts the terrain leg on that frame. Mechanical core held a FIFTH time: D1.2 21/21 clearance 0 (analyticGap →2.74), P1.5a 24/24 + reached (minDistToVen 14.4 m), P1.5b real translation (x −55.9→16.0 / z 9.4→34.9) with ALL EIGHT world jeep shots in frame, board-affordance near=TRUE at 1.6 m (audit-#4's stale-near regression fixed in pixels + hook), mission-3d a REAL mission before a non-vacuous mission-stopped, zoom pair settled + differing, fov 55 everywhere. Heli spec failed its FIFTH capture (only the Instellingen frame; JSON honestly wiped, no step trace) — stays with parked D1.6 (Floris hands-on batch); P1.5c remains proven from audits #1+#2.
- 2026-07-12 GATE-D2: three appends off fresh pixels — D3.15 (harness, narrow: the `tx` crash + game3d-corsi's board-open timeout; explicitly NOT the parked heli scope), D3.16 (game: fresh `18-jeep-near` is a void frame — follow cam at pitch −1.17 / dist 1.93, ranger swallowed by a speckled bird model while `viewClear`=true and `visible`=false: the sightline test must cover ALL occluder classes, the vehicle-approach camera must hold the follow pitch band, and the marker ring must not fill the frame at close range), D3.17 (game: `d17-titlereturn-17` catches the title showing the LOW-LOD stand-in world — cone pines, faceted oak, no cabin — under load; composed screens get a fidelity-readiness gate). Phase-3 sharpenings: D3.2 (third capture with zero water pixels — walk to the P1.5a shore waypoint AND aim at the disc), D3.6 (the board dominates `50-game3d-dagnacht` — the animal must be the subject), D3.9 (the cloud layer is a HARD diagonal boundary in fresh walk frames — feather is the law), D3.10 (live measurement: `.tw-back` at y=1480 in the 800 px viewport — below the fold today), D3.13 (grounding half met; residue = min-zoom looks DOWN on the child's crown from the old adult eye-height — scale close-zoom eye-height with the rig), D3.14 (evidence appears ALREADY MET at child scale — rim/ven/walk shadows all present; Opus may verify + tick without new work). No frozen contract and no §2.4 Alvah correction was touched; frozen `app/e2e/**` verified untouched (last e2e commits are pre-Run-D W7.x).
