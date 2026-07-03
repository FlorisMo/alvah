# Run 4 · Run C — the FABLE-DIRECTED EXPERIENCE run (make it excellent toward the VISION)

> Master brief for the Run C sittings. The tickable checklist is
> [RUN-C-LEDGER.md](RUN-C-LEDGER.md); the single source of truth every sitting
> re-reads is **[RUN-C-DIRECTION.md](RUN-C-DIRECTION.md)** — the run's own first
> deliverable (§7). The locked spec above both is
> [VISION.md](../../VISION.md). The supervisor is `run-c-loop.sh`
> (Opus `--effort xhigh` builds; a Fable art-director sitting directs + re-judges
> at each phase boundary). START each sitting by re-reading RUN-C-DIRECTION.md,
> then this plan, then the ledger.
>
> This is the **EXPERIENCE/POLISH** run: Run A was the eyes, Run B was the hands
> that fixed a fixed punch-list. Run C has **no fixed finding list** — it is an
> open "make it excellent toward the VISION" mandate, driven by a **cohesion
> ledger** the art director extends and re-opens, converging to the written
> "excellent per screen" bar (VISION §9) so "optimize until happy" actually ends.

> **SCOPE — LAPTOP-ONLY automated verification (same as Run B).** The loop
> captures the **laptop** project only (`CAPTURE_PROJECTS=laptop`, set by
> `run-c-loop.sh`); the iPad leg hangs the software renderer (F-21). So: grade
> every box on **laptop** pixels + asserts; make the shared-code change for
> "both"/"iPad" boxes; and treat everything that needs **feel / audio / real
> device / real Safari / iPad pixels** as **demo-gated — Floris on the real
> device** (the DEMO section of the ledger). This changes only *where* a box is
> verified, never the change itself.

## 0. What this run is (and is NOT)

Run C **deepens + unifies** the game that already exists (VISION §8) toward one
naturalistic, coherent, felt experience. It does NOT invent new mini-games or
mechanics, does NOT rebuild from scratch, and never trades away a frozen contract
(§4) for spectacle. "Amazing" is proven by **coherence, care, accessibility, and
completeness** — Alvah first; the Fable showcase is the byproduct of doing that
superbly (VISION §2/§3).

- **You change game code** under `app/src/**` and generate real assets — that is
  the job. But every change is gated on a fresh rendered screenshot judged
  against RUN-C-DIRECTION.md, not on the fact that the code compiles.
- **You may re-run and harden the capture harness** (`app/e2e-capture/**`) — it
  is the shared verification substrate. The capture output path is the shared
  `runs/run-3-ux-polish/audit-evidence/` dir (Run B is finished; its final frames
  are the baseline the direction doc measures cohesion against).
- **You never touch or weaken the frozen `app/e2e/**` specs, the `@smoke`
  suite, or `playwright.config.ts`.** They are the regression guard.
- **Ground the work in the in-repo research.** `games/Ranger-Adventures/research/`
  holds the dossiers the run already gathered — `animal-visual-accuracy.md` +
  `bird-visual-accuracy.md` (species realism reference for the Meshy prompts),
  `veluwe-research.md` (biome/light ground truth), `3d-animal-animation-research.md`
  + `humans-full-animals-eyes-research.md` (rig/gait/gaze), `voice-tts-readaloud-
  research.md`, `mini-game-research.md`. The direction doc + asset prompts **cite**
  these so realism is *sourced, never invented*.

## 1. The per-box gate (screenshot-in-the-loop)

For each WORK box, in order:

1. **Read the box's intent** against RUN-C-DIRECTION.md (the look / felt-progress
   / asset target for that screen or system) + the box's `verify-by`. Make the
   change under `app/src/**`.
2. **Expose what the assert needs.** If the verify-by references a dev-hook field
   or needs a new scene/input, add it to the dev hook and — if needed — extend
   the capture harness (`app/e2e-capture/**`, allowed) so its
   `annotations-<platform>.json` carries the evidence. Never edit the frozen
   `app/e2e/**` tree; a genuinely new spec goes in a NEW tree.
3. **Re-capture** — the SUPERVISOR runs `npm run capture` (you never do). It
   overwrites `runs/run-3-ux-polish/audit-evidence/` with fresh laptop PNGs +
   annotations.
4. **Grade your OWN fresh screenshot** against BOTH the box's verify-by AND the
   direction doc's bar for that screen — actually LOOK at the PNG with the Read
   tool — plus the box's named annotation field.
5. **Regression gate:** tick via `node scripts/ranger-run.mjs tick "<needle>"`
   — it refuses the tick unless `npm run build` AND the frozen `npm run
   e2e:smoke` are green. (`RUN_LEDGER=runs/run-4-experience/RUN-C-LEDGER.md` is
   exported by the supervisor.)
6. **Tick ONLY if all pass** — own-screenshot + annotation assert + build +
   smoke + the direction-doc bar. If your own grade fails, DO NOT tick; leave the
   box open, note why in §8, and stop so the next sitting retries. A repeatedly
   failing box self-pauses the loop for Floris (stall guard) — that is correct.

The supervisor commits + pushes **every step** the ledger advances (a box
ticked, re-opened, or a new cohesion box appended), so drift is bisectable
commit-by-commit (VISION §10). You never commit inside a sitting.

## 2. The HYBRID two-judge gate (VISION §10/§12)

The builder does NOT certify its own excellence, and the director does not build.

- **Fable is the ART DIRECTOR.** It proposes the direction (§7), and at each
  phase `GATE-Pn` an **independent Fable sitting** re-judges that phase's fresh
  laptop pixels against RUN-C-DIRECTION.md. It either **ticks the GATE** (it
  agrees every non-demo box meets the bar) or **RE-OPENS** boxes (`[x]`→`[ ]`,
  gate left unticked) — and, because the ledger is open-ended, it MAY **APPEND
  new `- [ ] Pn.m` cohesion boxes** to the phase when the composed world reveals
  a gap the list missed.
- **Opus is the BUILDER.** It writes the TypeScript and grades its own fresh
  screenshot as the FIRST judge (tick on green only).
- **A change counts as "excellent" only when BOTH agree** — the builder's own
  capture AND the art director's re-judge — **and the E2E/smoke asserts are
  green.** No self-certification.
- **`needs-Floris-demo` items are never closed by either model.** They may reach
  "implemented — awaiting Floris demo"; the FEEL / AUDIO / real-Safari / on-iPad
  verdict is Floris's on-device call only (the DEMO section).
- **No re-litigating done work.** Once a screen passes a gate it is frozen unless
  a *later* screen forces a change — this prevents change-then-revert thrash
  (VISION §10).
- **Model fallback (Floris, 2026-07-03).** The art-director role prefers **Fable**
  (taste + multimodal). If Fable tokens run out mid-run, the supervisor
  **automatically falls back to Opus** (opus 4.8, `--effort xhigh`) for the
  director role and **continues** — it does *not* pause for that. (Launch with
  `MODEL_FABLE=opus` to run the director on Opus from the start.) A usage limit
  that then persists on Opus is the real account-wide stop and pauses the run.

## 3. Asset-generation discipline (spending real money autonomously needs rigor)

The full ~7,600 Meshy credits are authorized for realism (VISION §6), but
**spread wisely by impact-per-credit** — the ranked list lives in
RUN-C-DIRECTION.md (5 flagships + the raven companion + the player ranger FIRST,
then the other story animals, then world-naturalism assets). Every generated /
upgraded model clears the SAME bar as any other change before it is accepted:

1. **Generate ONLY what the box names**, ONLY via
   `node scripts/meshy-gen.mjs --only=<id>` (or `--limit=N`). NEVER an unfiltered
   `assets` / `assets:all` / `meshy-gen` / `ranger-run.mjs run` / `npm run
   finish` — that would re-buy the whole ~76-item cast. `meshy-gen` already
   guards via its manifest + a durable `public/models/` skip and stops cleanly on
   HTTP 402.
2. **Run it BACKGROUNDED with log polling** — Meshy jobs exceed the 10-min tool
   ceiling. NEVER print `.env.local`; use `scripts/meshy-balance.mjs` for the
   masked-prefix balance.
3. **Optimize** through the existing pipeline (`meshy-gen → gltf-optimize →
   optimize-animated`) so it meets the **<150 draw-call / perf budget**.
4. **Never-scary / calm-pose gate** — realistic ≠ menacing; no blood/gore,
   predators calm-posed, tense beats off-screen (`toonVeilig`).
5. **Screenshot judge** — a model that does not both **look real AND belong in
   the world** is *rejected and regenerated*, not kept.
6. **Log the credit spend** per model so "wisely spread" is auditable after the
   run.

**Usage / credit STOP (honest — Floris 2026-07-03).** The weekly Claude usage %
is **not** programmatically measurable, so Run C does **not** fake a "3% weekly"
number. Instead it **runs until it actually hits the limit**: after each sitting
the supervisor scans that sitting's own output for a real usage-limit break and
pauses gracefully (a NEEDS-FLORIS note; re-launch after the weekly window resets
and it continues from the next box — nothing lost). The pre-flight
`node app/scripts/usage-guard.mjs` enforces only what is **real**: the live Meshy
credit balance vs a reserve for **asset** boxes (layered on `meshy-gen`'s
reactive 402), and an optional per-session wall-clock. A pre-flight **interlock**
also refuses to start Run C while Run B is still running (shared screenshots +
git), and a single-instance lock blocks a double launch.

## 4. Frozen contracts — STILL inviolable (carried verbatim from Run A/B, VISION §11)

Excellence is pursued WITHIN these, never by trading them away:

- **Motion-comfort camera law:** fixed FOV, roll 0, no head-bob / motion-blur /
  snap-rotate / FOV-kick / screen-shake; reduced-motion turns camera *moves*
  into cuts; locomotion itself always allowed; any orbit/zoom/reframe is
  player-initiated + damped.
- **Never-scary / never game-over**, calm-pose gate for animals. Leaving/stopping
  reads as neutral navigation — no guilt copy.
- **≥56 px tap targets; <150 draw calls; pixelRatio ≤ 2; iPad-first.**
- Persistence ONLY via `state.ts`/`persist.ts` in the `alvah-ef-v1` `ranger`
  namespace — **no new localStorage keys** (one-time-hint flags included).
- Reading **M3/E3, ≤7 words per visual line, read-aloud on new strings**; one
  instruction per line.
- **Construct-parity + a 2D floor per mini-game** — the EF science stays intact.
- **Sound = real animal calls only (xeno-canto)**; calm/never-startle (no sudden
  loud cues); no ambient/music pass yet; assets via `assetUrl`.
- **New dependencies ARE authorized for Run C** (Floris, 2026-07-03) — the models
  may web-research open-source repos and `npm install` a well-licensed
  (MIT/Apache/CC0/BSD), self-contained library when it clearly raises
  realism/cohesion. **The perf/comfort contracts still bind every dep:** it must
  hold <150 draw calls · pixelRatio ≤2 · iPad-first, keep build + e2e:smoke
  green, add **no runtime network/telemetry/CDN/tracker calls** (client-side-only,
  no third-party runtime scripts — the site's privacy stance stays intact), and
  never trade away motion-comfort/never-scary. The `package.json` + lockfile
  change is committed with the step. No surnames. **Never print `.env.local`
  values.**

## 5. The verification substrate (what the asserts read)

The capture harness boots the real game and writes, per shot, the live dev-hook
state into `annotations-<platform>.json` (`screen`, `pos`, `cameraYaw`,
`drawCalls`, `missionView`, `clip`, `veh`, `board`, `vehicle`, plus Run B's
added pose fields `avatar.height`, `cam.dist`, `cam.target`, same-frame
`drawCalls`, ground speed). Run C ADDS fields/scenes where a felt-progress or
cohesion box needs new evidence. **Pixels are the court of appeal** — if the hook
and the render disagree, trust the pixels and fix the telemetry.

## 6. Hard prohibitions

- Do NOT touch/weaken `app/e2e/**`, the `@smoke` suite, or
  `playwright.config.ts`. New verification lives in the capture harness or a NEW
  separate tree.
- Do NOT invent new mini-games or mechanics, rebuild from scratch, or touch a
  frozen contract (§4).
- Do NOT run the unfiltered asset pipeline or `npm run finish` (§3). Generate
  only the model a box names, via `--only=`.
- Do NOT mark any +demo box "accepted" — "implemented — awaiting Floris demo" is
  its ceiling for any automated gate.
- Do NOT re-litigate a screen a prior gate already froze (§2) unless a later box
  forces it.
- Do NOT invent a pass. If your own screenshot fails the direction-doc bar, leave
  the box open and say so in §8. Honest red beats a false green.
- Never commit `.env.local` or `assets-gen/`; never print secret values.

## 7. Direction-doc-first (the guardrail that replaces the live checkpoint)

Floris chose full autonomy — **there are NO live checkpoints** (VISION §10). So
the automatic guardrails carry all the weight, and the load-bearing one is:

**The run's FIRST committed act is `RUN-C-DIRECTION.md`** (ledger box P0.1,
authored by the Fable art director): the art-direction bible (one naturalistic
Veluwe at golden hour, screen-by-screen look targets), the felt-progress plan
(exactly how a completed mission changes the world), the ranked Meshy asset list
(impact-per-credit), and the per-screen "excellent" bar (VISION §9) as the
terminator. Everything after converges to it. Even without a live gate this
externalizes the plan so drift is visible and reversible after the fact — Floris
can glance at commit 1 (~30–45 min in) and, if it aimed somewhere he'd hate,
catch it early at no cost to the run.

**The guardrails, together (there is no human in the loop):**
1. The committed **RUN-C-DIRECTION.md** — the single source of truth every
   sitting re-reads and converges to.
2. **Hard mechanical gates on every tick** — build + e2e:smoke; a contract-
   breaking change literally cannot tick.
3. **Two-judge agreement** — Fable + the builder's own screenshot — before
   anything counts as excellent.
4. **Commit + push every step** — nothing lost; any drift is bisectable.
5. **The usage/credit stop gate + stall guard** — the run pauses itself with
   NEEDS-FLORIS rather than burning past a wall or thrashing on a stuck box.
6. **The DEMO section** — feel/audio/real-device stay Floris's on-device call.

## 8. Run C log (append-only, one line per surprise / grade-fail / director note)

- (grade sittings append a line here when a box falls short of the direction doc;
  the art director appends a line when it re-opens a box or appends a new cohesion
  box — so the reasoning behind every re-open is traceable.)
