# Run 5 · Run D — the COHESION run (playability first, Opus builds, Fable verifies)

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
> Alvah's true proportions/colours lead the run, and (3) the ROLES tighten:
> **Opus builds, Fable verifies — every box, not only the phase gates.**

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
- **Ground the work in the in-repo research** (`games/Ranger-Adventures/research/`):
  `3d-autonomous-sourcing-physics-world.md` §C for the Phase-1 character
  controller (three-mesh-bvh/BVHEcctrl or Rapier+ecctrl options),
  `animal-visual-accuracy.md` + `bird-visual-accuracy.md` for species realism,
  `veluwe-research.md` for biome ground truth, `3d-animal-animation-research.md`
  + `humans-full-animals-eyes-research.md` for rig/gait/gaze/eyes,
  `mini-game-research.md` for the EF grounding.

## 1. The per-box gate (evidence-in-the-loop)

For each WORK box, in order:

1. **OPUS FIX sitting** reads the box's intent against RUN-D-DIRECTION.md + the
   box's verify-by, and makes the change under `app/src/**`. It exposes any
   dev-hook field the verify-by needs and extends the capture harness
   (`app/e2e-capture/**`, allowed) when the assert needs a new scene/drive-burst.
   It does NOT capture, does NOT tick, does NOT commit.
2. **The SUPERVISOR runs `npm run capture`** (model sittings never do — the
   capture takes ~25–30 min and would blow a sitting's tool ceiling).
3. **FABLE GRADE sitting** (independent — it did not build) LOOKS at the fresh
   PNGs with the Read tool, reads `annotations-laptop.json` for the box's named
   fields (for drive-assert boxes: the per-frame burst values, not one sample),
   and grades against BOTH the box's verify-by AND the direction doc's bar.
   Pixels outrank the hook; for physics boxes the burst annotations outrank a
   single pretty frame.
4. **Tick ONLY on green:** `node scripts/ranger-run.mjs tick "<needle>"` — it
   refuses unless `npm run build` AND the frozen `npm run e2e:smoke` are green
   (`RUN_LEDGER=runs/run-5-cohesion/RUN-D-LEDGER.md` is exported by the
   supervisor). A `+demo` box's text gets " — implemented, awaiting Floris demo
   (NOT accepted)" appended at tick time.
5. If the grade FAILS: leave the box open, append one line to §8 below saying
   what falls short, and STOP (the loop retries once, then parks the box to
   DEFERRED.md and continues — defer-and-continue).

The supervisor commits + pushes **every step** the ledger advances, so drift is
bisectable commit-by-commit (VISION §10). Sittings never commit.

## 2. The two-judge gate (tightened for Run D)

- **Opus is the BUILDER.** It writes the TypeScript. It does not grade.
- **Fable is the VERIFIER and ART DIRECTOR.** An independent Fable sitting
  grades EVERY box's fresh evidence (per-box), and at each phase `GATE-Dn` a
  fresh Fable sitting re-judges the whole phase against RUN-D-DIRECTION.md — it
  ticks the gate, RE-OPENS boxes (`[x]`→`[ ]`), or APPENDS new `- [ ] Dn.m`
  boxes (the ledger is open-ended, converging to the doc's "excellent per
  screen" bar).
- **A change counts only when the evidence AND Fable agree** — no
  self-certification anywhere in the loop.
- **`+demo` items are never closed by any model.** Ceiling: "implemented —
  awaiting Floris demo". The verdict is Floris's on the real iPad (DEMO section).
- **No re-litigating done work** — once a screen passes a gate it is frozen
  unless a later box forces it.
- **Model fallback:** if Fable hits a usage/model limit, the supervisor falls
  back to Opus for the verifier/director role ONCE and continues (launch with
  `MODEL_FABLE=opus` to start that way). A limit that then persists on Opus is
  the real account-wide stop and pauses the run.

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
independent Fable verification of every box · commit + push every step ·
usage/credit stop + stall guard (defer-and-continue) · the DEMO section for
everything feel/audio/device.

## 8. Run D log (append-only, one line per surprise / grade-fail / director note)

- (grade sittings append a line here when a box falls short; the art director
  appends a line when it re-opens a box or appends a new one — so the reasoning
  behind every re-open is traceable.)
