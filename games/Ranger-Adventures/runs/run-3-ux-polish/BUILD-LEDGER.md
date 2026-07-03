# Run 3 · Run B — BUILD LEDGER (Opus works down this list)

> The supervisor (`build-run-loop.sh`) does the FIRST unchecked `- [ ]` **work**
> box each sitting (Opus, `--effort max`). At every phase boundary a `GATE-*`
> box runs a fresh **Fable** sitting that re-judges that phase's screenshots and
> may **re-open** any box (`[x]`→`[ ]`). Read [BUILD-PLAN.md](BUILD-PLAN.md)
> first — it defines the per-box gate, the HYBRID phase gate, and the frozen
> contracts. Phase order + coupling come from
> [AUDIT-FINDINGS.md](AUDIT-FINDINGS.md) § Self-audit §5/§3.
>
> **Tick rule (per box).** A box is ticked `[x]` ONLY when ALL hold: the fix's
> OWN fresh `npm run capture` screenshot passes the finding's visual criterion,
> the finding's named annotation/E2E assert passes, and `npm run build` +
> `npm run e2e:smoke` are green (the last two are enforced mechanically by
> `ranger-run.mjs tick`). At the phase `GATE`, an independent Fable sitting must
> also AGREE. **`needs-Floris-demo` boxes may reach "implemented — awaiting
> demo", NEVER "fixed"** — they carry that suffix and the DEMO section below is
> only closable by Floris.
>
> Legend on each box: **shot** = own-screenshot gate · **assert** =
> annotation/E2E field · **+demo** = has a demo-only component no gate may
> self-certify · **[iPad]/[laptop]/[both]** = platform.
>
> **SCOPE — LAPTOP-ONLY automated verification (Floris, 2026-07-03).** The
> Run B loop captures the **laptop** project only (`CAPTURE_PROJECTS=laptop`) —
> the iPad leg hangs the software renderer before the jeep/board/mission/RM
> scenes (F-21) and would re-stall the loop. **Every box is verified on laptop
> pixels + asserts. All iPad-specific and iPad-pixel verification** (F-13
> joystick-vs-tracker, iPad tap-target sizes, touch steering, the
> board-button-vs-joystick corner, real-Safari rendering) **is folded into the
> Floris on-device demo** — see the DEMO section. Where a box says "both" or
> "iPad", make the shared-code fix and verify it on laptop; the iPad verdict is
> Floris's. Boxes tagged **DEFERRED (iPad)** are skipped by the loop. Re-enable
> iPad auto-capture with `CAPTURE_PROJECTS=laptop,ipad` once the render hang is
> solved.

---

## Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)

- [x] P0.1 · **Archive the Run A evidence BEFORE any new capture.** `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. **Verify by:** the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
- [ ] P0.2 · **DEFERRED (iPad) · F-21 · harden the capture harness.** Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. **Loop skips this box.**
- [x] P0.3 · **F-34a · fix `boot()` for the returning player [laptop].** In `app/e2e-capture/**`: after "Begin", branch on persisted `avatarGemaakt` exactly like `main.ts:90` — wait for `screen==='world'` when an avatar is persisted, only wait for the avatar-maker on a true first run (or clear the ranger namespace for a first-run RM boot). This is what killed the laptop reduce-motion capture in Run A. **Verify by:** shot — the laptop reduce-motion scene captures a PNG with no multi-minute stall.
- [x] GATE-P0 · **Fable re-judge — Phase 0 (does a full LAPTOP evidence set now EXIST).** Re-capture (laptop), confirm the complete set exists (title→avatar→world→walk→controls→board→mission→pause→jeep→RM), and the P0.1 baseline is intact. iPad is demo-gated (P0.2 deferred). May re-open P0.x. **Exit of Phase 0.**

## Phase 1 · the core — area A  (order: F-07 → F-05⊕F-18 → F-09 → F-08)

- [x] P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).
- [x] P1.2 · **F-05 ⊕ F-18 · rebuild the follow camera AND expose real pose fields [both]** (land together per §3). Third-person boom with guaranteed clearance (eye ~1.6–1.8 m, boom ~4–5 m, min-clamp outside avatar radius + near plane, spherecast push-in, fade avatar if the boom collapses); read pose from the REAL render camera after the frame update — `cam.dist`, quaternion-derived yaw/pitch, same-frame `drawCalls`. Motion-comfort law: fixed FOV, roll 0, damped, no snap. **Verify by:** shot (world-entry shows ground + horizon + the whole ranger) + assert (`cam.dist` ≥ 3, avatar bbox inside frustum; 3 s idle → yaw/dist stable ±0.01).
- [x] P1.3 · **F-09 · rotate the spawn toward the hub [both].** First frame after F-05 shows the hub (cabin, board, tree line); first stride goes toward content. **Verify by:** shot (≥1 landmark in the world-entry frame) + assert (world-entry `drawCalls` above a floor OR a landmark-in-frustum boolean).
- [ ] P1.4 · **F-08 · retune foot speed + tie stride to ground speed [both] +demo.** Ground speed ≈1.6–2.0 m/s; walk-clip `playbackRate` ∝ ground speed (kills foot-slip); jeep stays clearly faster; expose ground speed (m/s). **Verify by:** assert (ground speed ∈ [1.4, 2.2] while `clip`=walk) + burst re-capture shot. **Gait FEEL: needs Floris demo — never "fixed" here.**
- [ ] P1.5 · **Re-check F-10 / F-12 / F-33 (re-checks, NOT fixes).** Re-capture the walk/drive bursts; expect the gait to become judgeable (F-10), the half-screen shadow band to vanish (F-12) and the "blur" to resolve to crisp geometry (F-33). Spend fix effort ONLY on any that survive — if one does, open a new finding. **Verify by:** shot (fresh burst: gait readable, ground evenly lit, geometry crisp). F-10 gait quality also **+demo**.
- [ ] GATE-P1 · **Fable re-judge — Phase 1 (the first real look at the composed world).** Re-capture; re-judge F-05/F-07/F-09/F-08 + the F-10/F-12/F-33 re-checks; **triage the expected new world-look findings** (biome density, prop placement, animal/piglet models, lighting) into the ledger before Phase 2. May re-open any P1 box.

## Phase 2 · controls — areas B + C

- [ ] P2.1 · **F-16 · laptop wheel/trackpad dolly zoom [laptop] +demo.** Player-initiated, damped dolly on the boom, clamped [F-05 min … ~8–10 m], fixed FOV (never a FOV zoom); under reduced-motion the zoom applies as an instant step. Reuse `cam.dist`. **Verify by:** assert (wheel changes `cam.dist` within both clamps, no FOV change) + zoom-in vs zoom-out shot pair visibly differs. **Trackpad-pinch feel: needs Floris demo.**
- [ ] P2.2 · **F-17 · laptop drag-orbit + click-vs-drag seam [laptop] +demo.** Yaw free, pitch clamped (~−10°…+30°), damped, fixed FOV, roll 0, respect F-05's boom clamp. Pointer-layer discriminator (~6 px): drag → camera only (tap-to-walk suppressed); a clean click still walks. Assert BOTH sides (§3 tap-to-walk seam). **Verify by:** assert (drag changes real camera yaw while `pos` unchanged; a clean click still walks) + shot. **Drag feel/damping: needs Floris demo.**
- [ ] P2.3 · **F-30 · vehicle camera re-anchors on boarding [both] +demo.** On "Stap in" the follow camera re-anchors to the JEEP (F-05 clearance rules; eye ~2.5–3.5 m over the hood), hands back on "Stap uit"; enter/exit are CUTS; yaw-follow damped, not hard-locked. Expose `cam.target` ("avatar"|"vehicle"); reuse `cam.dist`. **Verify by:** shot (a drive frame shows the jeep from behind with ground + horizon) + assert (`cam.target`="vehicle", `cam.dist` in range while `inVehicle`; consecutive drive frames differ in pixels). **Drive feel/comfort: needs Floris demo.**
- [ ] P2.4 · **F-31 · the ranger boards [both].** Parent the (F-07-normalized) avatar to the seat in a seated pose (real `sit`/`drive` clip, else static seated pose, else verifiably hidden); walk clip off while seated; `clip` never idle/walk in-vehicle. NB the fallback choice sets F-30/F-31's verify criterion (visible driver vs verifiably hidden). **Verify by:** shot (driver visible at the wheel — or verifiably hidden) + assert (avatar parented/hidden while `inVehicle`; `clip`=sit/none).
- [ ] P2.5 · **F-32 · steering asserts + comfort tuning [both] +demo.** Control-condition asserts (laptop): 3 s no turn → unwrapped heading drift ≈ 0; hold one turn key 2 s → unwrapped heading monotonic by an expected range; consecutive drive frames differ in pixels (UNWRAP headings — wrapped yaw already lied once, F-18). Wire + assert iPad in-vehicle **touch** steering (needs P0.2). Comfort: cap turn rate ~0.6–0.9 rad/s (speed-scaled), ~1 s accel ramp, top speed clearly above foot speed. **Verify by:** assert (control-condition heading tests + pixel-diff). **Steering feel + motion comfort: needs Floris demo.**
- [ ] GATE-P2 · **Fable re-judge — Phase 2 (laptop camera control + the vehicle).** Re-capture; re-judge F-16/F-17/F-30/F-31/F-32 from pixels + annotations. May re-open. Camera/steering FEEL stays demo-gated.

## Phase 3 · navigation + HUD — areas D + E + F

- [ ] P3.1 · **ONE ≥56 px chip token: F-02 + F-14 + F-20 + F-25(speaker) + F-28, with F-01 card-fit in the SAME change [both].** One shared min-height-56 visible-box token (padding, not font-inflation) for Begin / swatches / name chips / Pauze / board-exit / prompt-speaker / hub links; F-01 compacts the avatar card so bigger targets don't push the CTA off-fold (sticky "Dit is mijn ranger" footer). **Verify by:** assert (boundingBox ≥ 56 for each named control on both projects) + shot (F-01 CTA on-screen without scrolling; F-28 links now LOOK tappable).
- [ ] P3.2 · **ONE navigation model: F-27 + F-26 + F-20 [both].** Rule: every screen below the title has a visible ≥56 px way back. Hub gains "Naar het hoofdmenu" (→ `screen`="title", progress kept, gate not re-asked, no confirmation maze); Pauze stays visible + ≥56 px in-mission with a calm "Stop de missie" → world; board exit LOOKS ≥56. **Verify by:** assert (hoofdmenu → `screen`="title" then re-entry restores avatar+progress; Pauze visible + ≥56 while `missionView`="3d"; stop returns `screen`="world") + shot. Never-scary: leaving reads as neutral navigation.
- [ ] P3.3 · **ONE hint system: F-06 + F-15 + F-11-hint + F-13 tracker move [both] +demo.** Sequence onboarding one hint at a time; ≤7-word lines; control hint persists until first successful use then fades; the 16-word toast becomes short transient(s); laptop help chip (≥56 px) re-shows hints; relocate the iPad tracker out of the joystick quadrant. One-time-hint flags via `state.ts` in the `alvah-ef-v1` ranger namespace (no new keys). **Verify by:** shot (single hint at entry, ≤7 words; iPad tracker not under the stick) + assert (hint-state field; joystick ∩ tracker boundingBox = ∅ on ipad). **Read-aloud firing: needs Floris demo.**
- [ ] GATE-P3 · **Fable re-judge — Phase 3 (chips, navigation, hints — both platforms).** Re-capture; re-judge the token sizes, the back-paths and the hint sequencing. May re-open. Read-aloud stays demo-gated.

## Phase 4 · reading + dressing — areas G + H

- [ ] P4.1 · **F-03 · title subtitle per-sentence lines [both].** Each sentence its own line, ≤7 words. **Verify by:** shot.
- [ ] P4.2 · **F-25 · mission prompt stacked, one type size [both] +demo.** Two ≤7-word lines, same size (or show only the current step); couples with P3.1's speaker size. **Verify by:** shot (two stacked ≤7-word lines). **Read-aloud on each step: needs Floris demo.**
- [ ] P4.3 · **F-22 · occlusion-proof world / vehicle / POI labels [both].** DOM-projected screen-space overlays, or depth-test-off sprites + distance/behind-camera fade — must cover world, jeep and POI labels alike. **Verify by:** shot (label fully readable, including from an angle where geometry passes in front).
- [ ] P4.4 · **F-23 · one pictogram per mission card [both].** Flat in-repo vector (animal/biome silhouette), no new deps/pipeline; keep read-aloud on card focus. **Verify by:** shot (each card shows a distinct pictogram).
- [ ] P4.5 · **F-04 · ground + vary the title backdrop [both].** Soft blob shadows, mixed tree species/sizes, optionally one landmark prop (board/jeep). Stay well under 150 draw calls. **Verify by:** shot.
- [ ] P4.6 · **F-11 · world boundary rim + gentle stop [both].** Calm visible rim (heather berm / low fence / tree line), ease speed to zero (no hard wall), one ≤7-word hint with read-aloud when heading outward. **Verify by:** shot (rim visible at the edge) + assert (`pos` clamped at the boundary). Never-scary: gentle stop, no game-over.
- [ ] P4.7 · **F-29 · shared static scrim behind modals [both].** One ~35–50% dark rgba scrim (no backdrop-filter) behind pause / board / mission cards, applied as an instant state change. **Verify by:** shot (pause + board overlays show the same dimmed backdrop on both platforms).
- [ ] GATE-P4 · **Fable re-judge — Phase 4 (reading + world dressing).** Re-capture; re-judge legibility, pictograms, backdrop, boundary, scrim. May re-open.

## Phase 5 · reduce-motion + final sweep

- [ ] P5.1 · **F-34b · capture RM through BOTH gates [both]** (`app/e2e-capture/**`). OS media (`emulateMedia reduce`) AND the in-game "**Rustige beweging**" toggle in Instellingen (real label — Tweaks.ts:42). **Verify by:** shot (RM PNGs exist on both platforms for both gates).
- [ ] P5.2 · **F-34c · make the RM world judgeable [both].** RM still vs normal world-entry (nothing structural differs), a short RM walk burst (locomotion STILL animates — keepLocomotion invariant), an idle frame pair (secondary motion frozen → near-zero pixel-diff at idle). **Verify by:** shot set + pixel-diff.
- [ ] P5.3 · **F-34d · durable cut-not-move assert [both] +demo.** With F-05/F-18's pose fields: during any reframe under RM the camera pose is a step function (a cut), never interpolated; `.rm` body class present via both gates. **Verify by:** assert (step-function camera under RM; `.rm` via both gates). **True motion comfort on-device: needs Floris demo.**
- [ ] P5.4 · **Full both-platform re-capture + triage.** One clean `npm run capture`; sweep the WHOLE flow for anything the phase gates missed; open findings for survivors. **Verify by:** shot (complete fresh set, both platforms).
- [ ] GATE-P5 · **Final Fable re-judge — the whole game, both platforms.** Re-capture; re-judge every screenshot-closable box across all phases. May re-open anything. This is the last gate before the Floris demo. **BUILD-COMPLETE when this ticks and every non-DEMO box above is `[x]`.**

---

## Demo acceptance  (Floris ONLY — no screenshot/E2E gate may tick these)

> These are the +demo components. Their build boxes above may reach "implemented
> — awaiting demo"; the FEEL/AUDIO/real-Safari verdicts live only here. The
> supervisor pauses at these with NEEDS-FLORIS — it never spends a sitting on
> them. This is W7.5's lesson codified (AUDIT-FINDINGS § Self-audit §4).

- [ ] DEMO · **Motion comfort** — walk gait feel (F-08/F-10), drive camera + steering feel (F-30/F-32), reduce-motion on the real iPad (F-34). Floris accepts on-device.
- [ ] DEMO · **Input feel** — trackpad zoom/orbit damping (F-16/F-17); joystick, tap-to-walk and touch steering on real glass (zero touch evidence exists in Run A). Floris accepts on-device.
- [ ] DEMO · **Audio** — read-aloud firing on new/changed strings (F-06/F-15/F-25). Floris confirms audio on-device.
- [ ] DEMO · **Real Safari** — every iPad conclusion carries the Chromium engine caveat; the on-device WebKit pass is the only real-Safari evidence. Floris accepts on iPad.
- [ ] DEMO · **iPad platform (whole)** — because Run B auto-verifies on laptop only, ALL iPad pixels are Floris's on-device sign-off: layout/scale at 1080×810, ≥56 px tap targets, the joystick-vs-tracker corner (F-13), tap-to-walk + touch steering, and that board/mission/reduce-motion look right on the real device. Shared-code fixes are laptop-proven; this box confirms them on glass.

## Notes
- Re-run the capture anytime from `app/`: `npm run capture` (rebuilds `audit-evidence/`; the Run A baseline lives in `audit-evidence-baseline-run-a/`).
- Phase order + coupling are FROZEN by AUDIT-FINDINGS § Self-audit §5/§3 — do not resequence (scale before camera before speed; F-05 ⊕ F-18 together; F-33/F-12/F-10 are re-checks).
