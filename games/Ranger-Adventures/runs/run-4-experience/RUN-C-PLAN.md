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
- 2026-07-04 · art director (P0.1): RUN-C-DIRECTION.md authored; Run B DEFERRED
  triaged into 4 Phase-1 retry boxes — P1.0 (F-19 board-face framing + proportion
  baseline, placed FIRST: proportion must read before any look box), P1.7 (F-24
  frisling/gras readability), P1.8 (cloud-shadow softening), P1.9 (Instellingen
  off-fold exit). Note: Run B's avatar-scale core (F-07) was already cracked
  (avatar 1.7 m per HANDOFF-MONITOR); only the F-19 camera-framing piece survived
  to DEFERRED, so P1.0 re-proves proportion in the same gated frame.
- 2026-07-04 · art director (GATE-P0, fresh 22:2x laptop set): P0.1 stands (the
  doc is committed and complete). Seeded 9 pixel-anchored cohesion boxes across
  phases 1–5 — P1.10 (capture blind spot: 4 of 5 games + all 2D floors never
  shot; stale orphan PNGs from older numbering runs sit beside fresh frames and
  can mislead a judge), P1.11 (POI markers are tiny charcoal chips floating
  mid-air in `14-camera-orbit` — unreadable for a dyslexic reader, off the §3
  one-overlay-language), P1.12 (hub reads as a prop-drop, not the doc's cosy
  heart: no path links cabin/board/jeep, orphan fences), P1.13 (`12-camera-
  zoom-in` + `39-reduce-motion-reframe-before` cut the ranger at the waist —
  half-buried read), P1.14 (mission vignette near-black vs §2.1 "tint, never
  darkness"), P2.10 (world animals are featureless dark blobs at follow
  distance in `19`/`23` — flagships must read at gameplay range, not only
  close-up), P3.4 (no before/after pair exists for GATE-P3 to judge felt
  progress), P4.5 (heli dumped on the hub lawn behind the missiebord / loose in
  the stuifzand — vehicles without homes), P5.5 (no briefing/task/reunion beat
  frames for mission-dressing judgment). Also noted on P1.9: still live in the
  fresh set (`.tw-back` at y=1404). Direction doc §3 refined: world labels +
  HUD chips count as UI and bind to the one warm language + a legibility floor.
  GATE-P0 ticked — every downstream phase now carries concrete boxes.
- 2026-07-04 · grade (P1.1) FAIL, left open: the shared golden-hour rig landed on
  title/world/board/jeep (all sky = 253,229,205, lum≈233; drawCalls 12–66 <150;
  pixelRatio capped ≤2) — but the verify-by's THIRD leg, "a mission frame shares
  the same light/palette," fails: fresh `29-mission-3d` (and `30-mission-stopped`)
  have a desaturated grey sky (185,185,179 — no warm tint) and near-black
  vignetted corners (lum 27–47) over a muddy-green scene, so the mission still
  "reads as a different game" (doc §2.1: one shared IBL across all 5 games). Extend
  the unified rig INTO the mission/zoeken scene (this overlaps P1.14's de-vignette)
  before P1.1 can go green.
- 2026-07-05 · grade (P1.2) FAIL, left open: the per-biome two-tone ground landed
  (bos reads darker litter/moss, stuifzand paler sand; drawCalls 12–73 <150,
  pixelRatio ≤2) — but "each biome reads as real Veluwe ground" is NOT demonstrated.
  Computing `biomeAt` over every captured pos: the fresh set covers heide/bos/
  stuifzand only — the ven is in ZERO frames (player never reaches VEN_CENTER 46,-19;
  farthest frame `26-jeep-straight-2` 39,8 = stuifzand), so §2.2's most distinctive
  biome (dark still water + reeds + golden reflections) is unverifiable. And the
  heide hub (`03-world-entry`/`04-world-idle`/`29-mission-3d`) still reads as a flat
  warm-brown slab with no heath signature (two-tone barely visible up close). Extend
  the capture harness to frame the ven (and deepen the heide read) before P1.2 can
  go green.
- 2026-07-05 · grade (P1.2) FAIL again, left open: the harness now reaches the ven —
  `VEN_SHORE_R=26` forces `biomeAt`→`ven` at `43-ven-shore` (27,-10) and `26-jeep-
  straight-2` (27.8,-7.6), drawCalls 38/42 (<150) — but the PIXELS still show no ven:
  both frames render flat warm-brown/tan sand with the Vogelkijkhut prop + a
  watchtower and ZERO dark water / reeds / moss banks / golden reflections. The player
  stands ~21 m from VEN_CENTER, just past the 20 m water disc, and the camera faces the
  hide, not the water — so §2.2's water/reeds/reflection read is STILL undemonstrated
  (pixels outrank the hook: biome=ven, frame is not a ven). Heide hub `03-world-entry`
  also still a flat warm-brown slab with no purple-heather signature; bos floor shows no
  needle/leaf litter. Fixes (builder, not Floris): steer the ven capture camera onto the
  water disc AND render visible still-water + reed fringe + moss bank there; make the
  heather mats read on the heide hub before P1.2 can go green.
- 2026-07-05 · grade (P1.4) FAIL, left open: the title's async "dress with the real world"
  swap never lands in the captured frame — `01-title.png` still shows the PRIMITIVE backdrop
  (low-poly cone trees, a bare brown box where the log cabin should be, purple crystal rocks)
  at drawCalls 12 and NO ranger, with `avatar: null`. So `dressTitleReal()`'s GLB swap
  (prop-pine/oak/birch + prop-case-board + prop-ranger-cabin + the ranger-alvah rig) did not
  complete before snap: `whenIdle` + the heavy decode don't finish inside the capture's
  15 s `waitForFunction(avatar>1)`, which is `.catch`-swallowed so the snap fires ranger-less.
  The change's OWN new assert (main.ts `provideAvatar(titleAvatar())` → title `avatar.height`
  ∈ [1.5,2.0]) is therefore unmet (null). By contrast `03-world-entry` is drawCalls 57 with
  the real log cabin + missiebord + grounded ranger (avatar 1.7), so the title does NOT
  "belong to the same world as world-entry" and misses §3.1 ("the world seen calmly, same
  terrain materials, with the grounded ranger avatar"). Only the ≤7-word subtitle leg passes
  (6 / 7 words). Fix (builder, not Floris): make the title actually render the real props +
  grounded ranger before the snap — force/await the dress instead of parking it behind
  `whenIdle`, and gate the capture snap on `titleAvatar()>1` (raise geometry/drawCall parity
  toward world-entry) rather than swallowing the wait — before P1.4 can go green.
- 2026-07-05 · grade (P1.4) VISUAL PASS but tick REFUSED (e2e:smoke RED), left open: the
  dress now lands in the pixels — fresh `01-title.png` shows the real log cabin + prikbord +
  mixed realistic trees + a grounded ranger under the warm golden sky (avatar.height 1.70 ∈
  [1.5,2.0], drawCalls 24, subtitle ≤7 words: 6/7), belonging to the same world as
  `03-world-entry`; the §3.1 bar is met. BUT the frozen `npm run e2e:smoke` is deterministically
  RED (confirmed on a clean re-run): `journey` (Begin→avatar→world) and `movement` (tap-to-walk)
  both time out at 30 s, while the two boot-only tests pass — an earlier run in the same log
  passed all 4 in 19.8 s. Cause: the title dress is no longer parked behind `whenIdle`; it kicks
  off concurrent cabin/board/tree/ranger GLB decodes at EVERY boot, starving the main thread
  through the Begin→world→movement path. Fix (builder, not Floris — no device/decision/asset
  needed): keep the dressed title for capture but stop the title decodes from competing with the
  real Begin→world flow — gate the eager `dressTitleReal()` on a capture/dev flag, or
  cancel/deprioritize the title loads the moment the player navigates away — before P1.4 can go
  green. Do NOT touch `app/e2e/**` (frozen regression guard).
- 2026-07-05 · grade (P1.5) FAIL, left open: the warm-world half landed — the shared
  `--modal-scrim` warmed to `rgba(28,21,11,0.5)` reads as a warm golden-dusk dim on both fresh
  frames (`16-pause-hub` = warm cream pause panel over a warm tint; `28-board-open` = the
  mission-PICK board's warm cream cards + `mb-back` chip, same warm scrim), on-style per §2.1/§3.
  BUT the box's OWN named subject is unverified: the prikbord (the clue/veldnotitie detective
  board, DIRECTION §3.3) with the newly-restyled `.cb-back` ≥56px `.ra-chip` was NEVER captured.
  The new `caseboard`/`Prikbord` group is appended LAST in `capture.spec.ts` (after the `ven`
  group), and `ven` exhausts the 30-min test timeout (annotations end on a `ven` GAP:
  "Test timeout of 1800000ms exceeded"), so `caseboard` never ran — no Prikbord PNG on disk and
  ZERO `.cb-back` measurement in `annotations-laptop.json`. So the verify-by's shot leg (the
  prikbord reads as the same warm world) AND its assert leg (named control ≥56 px) both have no
  evidence; `28-board-open` is the mission-PICK board (`mb-back`), a different screen, not the
  prikbord (`cb-back`). Fix (builder, not Floris — capture-ordering only): move the `caseboard`
  group BEFORE the timeout-prone `ven` group (or bound `ven`'s per-group timeout / isolate it) in
  `app/e2e-capture/**` so the prikbord frame actually renders inside the test budget and the
  `.cb-back` ≥56px assert exists — before P1.5 can go green. Do NOT touch `app/e2e/**`.
- 2026-07-05 · grade (P1.6) FAIL, left open: the five 2D floors landed on-style — fresh
  `35-floor-zoeken`…`39-floor-wisselen` all read as ONE warm golden-hour Veluwe (warm terrain
  surround + cream §3 instruction panel + read-aloud `.zoeken-speak` 56×56; drawCalls 61 <150;
  simon/wisselen no longer the old dark-blue night), a real cohesion win over the bolted-on-puzzle
  look. BUT the verify-by's "shot (all five, **3D** + 2D floor, on-style)" leg is met for only ONE
  game: only zoeken's 3D is captured (`29-mission-3d`, screen=mission/3d, dc 33) and only
  `zoeken3d.ts` was touched among the five 3D engines — `corsi3d`/`simon3d`/`dagnacht3d`/`wisselen3d`
  were neither brought onto the §2.1 golden-hour rig nor captured (ZERO corsi/simon/dagnacht/wisselen
  3D frames in `annotations-laptop.json`; the harness deliberately used `?flat` to shoot 2D-only), so
  §3.5–3.8's distinct 3D stagings (footprints on terrain · clearing-halfcircle · encounter-plaat ·
  open plek/hol) stay undemonstrated — the P1.10 3D blind spot persists. Minor: all five floor frames
  report `screen=title` (dev-hook not updated to the 2D-floor scene) — pixels pass, hook is stale.
  Fix (builder, not Floris — no device/decision/asset): bring the other four games' 3D engines onto
  the golden-hour rig AND extend `app/e2e-capture/**` to shoot each game's 3D surface (overlaps P1.10)
  so all five 3D + 2D read as one world — before P1.6 can go green. Do NOT touch `app/e2e/**`.
- 2026-07-05 · art director (P1-gate sitting, fresh 06:29 laptop set) — SUPERVISOR MISROUTE FOUND +
  FIXED IN THE LEDGER TEXT: `run-c-loop.sh` picks and routes boxes by grepping a box's FIRST line, so
  work boxes whose text contained "GATE-P0 append"/"retry from Run B DEFERRED"/"RUN-C-DIRECTION §2.4"
  were being served as phase gates (this sitting was served P1.10 as a "gate") or invisibly skipped
  (P1.7–P1.9 never ran). Reworded all poisoned box lines (no supervisor-script change — it is running)
  and added a wording rule to the ledger Notes so future appends stay routable. Then the REAL phase-1
  re-judge on the fresh pixels: P1.0 STANDS (27-board-affordance: board face + papers presented, ranger
  whole in frame at believable scale; near+inFrustum true, avatar 1.70, dc 45). P1.1 STANDS (title/
  world-entry/mission 29 share the warm key; dc 24/52/25). P1.4 STANDS (title = real cabin/board/trees/
  grounded ranger, subtitles 5+7 words). P1.5 STANDS (pause + prikbord one warm overlay language;
  `.ph-back`/`.mb-back`/`.cb-back` all ≥56 px on-screen — the previously-missing prikbord evidence now
  exists as 34-caseboard). P1.3 RE-OPENED: the "heather" props are glossy faceted PURPLE CRYSTAL
  polyhedra (unmistakable at close range in 13-camera-zoom-out, scattered through 01-title/14-orbit) —
  they read as gemstones beside the realistic cabin/board GLBs; the tree cast itself (birch/oak/pine,
  mixed sizes in 14/45) is fine — fix the prop leg (matte heather mats per doc §2.2, or seat the staged
  `prop-heather-shrub`). P1.6 RE-OPENED: the four newly-shot 3D surfaces (41–44) are a bare tan void
  ringed with flat PHOTO-SPRITE billboards — wolf sprites in corsi/simon/dagnacht/wisselen (story-gated
  animal, never-scary breach), a boulder-sized coiled adder (canon ~55–60 cm), a ghost-white human
  cutout, the ranger himself a 2D sprite — and the staging is primitives on a void ("reekalf in het
  gras" = a cream egg on bare dirt, "open plek"/"het hol" = disc + dome), nothing like doc §3.4–3.8;
  ALSO an evidence-validity hole: the game3d group shoots `/?sandbox`, not the mission path the player
  reaches (29-mission-3d differs structurally), so the shipped 3D surfaces for corsi/simon/dagnacht/
  wisselen remain unproven — appended P1.15 for the billboard cast + representative capture. Side
  notes: the reduce-motion-toggle scene GAPs (`.explore-pause` resolves, click times out 10 s — no
  instellingen frame in the fresh set at all; noted on P1.9); 45-ven-shore still shows ZERO water/reeds
  (the parked P1.2 stays real for Floris's batch); P1.11's scope now names the game-scene label chips;
  the fresh 2D floors (35–39) are genuinely on-style — good work, kept. GATE-P1 NOT ticked: open boxes
  remain (P1.3, P1.6, P1.7–P1.15).
