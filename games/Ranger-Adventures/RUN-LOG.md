# Ranger van de Veluwe — Run Log (append-only)

One status block per run/step (BUILD-PLAN §9b).

---
**2026-07-03 12:31:35Z** · ticked: - [x] P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · F-21 · harden the capture harness [both]. In `app/e2e-capture/` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the iPad board/jeep/steer approach with touch (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. Verify by: shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).
▤ ledger: BUILD-LEDGER.md
▷ progress: ~3%
⚠ blocker: W7.5 NEEDS-FLORIS: iPad-acceptatie op het echte apparaat (alvah.nl/ranger achter de gate, nu live op ship-bundle 2.1.0-ship). Check hands-on: (1) lopen met de joystick EN tap-to-walk, (2) jeep in/uit + rijden, (3) één missie vanaf een wereld-marker spelen, (4) Deep Demo (?demo) doorlopen, (5) Verminder-beweging in BEIDE standen (aan: kalm/cuts, uit: volledig). Dit is de laatste open box; alle W0-W7.4 zijn groen en gedeployed. Kan niet autonoom — vereist jouw iPad.
```

---
**2026-07-03 13:12:10Z** · status

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · F-21 · harden the capture harness [both]. In `app/e2e-capture/` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the iPad board/jeep/steer approach with touch (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. Verify by: shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).
▤ ledger: BUILD-LEDGER.md
▷ progress: ~3%
⚠ blocker: Run B stalled on: P0.2 · **F-21 · harden the capture harness [both].** In `app/e2e-capture/**` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the **iPad** board/jeep/steer approach with **touch** (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. **Verify by:** shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-03 14:24:16Z** · status

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~3%
⚠ blocker: Run B stalled on: P0.3 · **F-34a · fix `boot()` for the returning player [laptop].** In `app/e2e-capture/**`: after "Begin", branch on persisted `avatarGemaakt` exactly like `main.ts:90` — wait for `screen
```

---
**2026-07-03 15:51:41Z** · ticked: - [x] P0.3 · F-34a · fix `boot()` for the returning player [laptop]. In `app/e2e-capture/`: after "Begin", branch on persisted `avatarGemaakt` exactly like `main.ts:90` — wait for `screen==='world'` when an avatar is persisted, only wait for the avatar-maker on a true first run (or clear the ranger namespace for a first-run RM boot). This is what killed the laptop reduce-motion capture in Run A. Verify by: shot — the laptop reduce-motion scene captures a PNG with no multi-minute stall.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~5%
⚠ blocker: Run B stalled on: P0.3 · **F-34a · fix `boot()` for the returning player [laptop].** In `app/e2e-capture/**`: after "Begin", branch on persisted `avatarGemaakt` exactly like `main.ts:90` — wait for `screen
```

---
**2026-07-03 15:52:14Z** · status

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~5%
```

---
**2026-07-03 16:00:50Z** · ticked: - [x] GATE-P0 · Fable re-judge — Phase 0 (does a full LAPTOP evidence set now EXIST). Re-capture (laptop), confirm the complete set exists (title→avatar→world→walk→controls→board→mission→pause→jeep→RM), and the P0.1 baseline is intact. iPad is demo-gated (P0.2 deferred). May re-open P0.x. Exit of Phase 0.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~8%
```

---
**2026-07-03 18:31:42Z** · status

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~8%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-03 22:53:26Z** · ticked: - [x] P1.1 · F-07 · normalize the avatar to ~1.7 m [both] (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. Verify by: shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~11%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-03 23:18:08Z** · ticked: - [x] P1.2 · F-05 ⊕ F-18 · rebuild the follow camera AND expose real pose fields [both] (land together per §3). Third-person boom with guaranteed clearance (eye ~1.6–1.8 m, boom ~4–5 m, min-clamp outside avatar radius + near plane, spherecast push-in, fade avatar if the boom collapses); read pose from the REAL render camera after the frame update — `cam.dist`, quaternion-derived yaw/pitch, same-frame `drawCalls`. Motion-comfort law: fixed FOV, roll 0, damped, no snap. Verify by: shot (world-entry shows ground + horizon + the whole ranger) + assert (`cam.dist` ≥ 3, avatar bbox inside frustum; 3 s idle → yaw/dist stable ±0.01).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~13%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-03 23:43:05Z** · ticked: - [x] P1.3 · F-09 · rotate the spawn toward the hub [both]. First frame after F-05 shows the hub (cabin, board, tree line); first stride goes toward content. Verify by: shot (≥1 landmark in the world-entry frame) + assert (world-entry `drawCalls` above a floor OR a landmark-in-frustum boolean).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~16%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 00:02:31Z** · ticked: - [x] P1.4 · F-08 · retune foot speed + tie stride to ground speed [both] +demo. Ground speed ≈1.6–2.0 m/s; walk-clip `playbackRate` ∝ ground speed (kills foot-slip); jeep stays clearly faster; expose ground speed (m/s). Verify by: assert (ground speed ∈ [1.4, 2.2] while `clip`=walk) + burst re-capture shot. Gait FEEL: needs Floris demo — never "fixed" here.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~18%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 00:21:11Z** · ticked: - [x] P1.5 · Re-check F-10 / F-12 / F-33 (re-checks, NOT fixes). Re-capture the walk/drive bursts; expect the gait to become judgeable (F-10), the half-screen shadow band to vanish (F-12) and the "blur" to resolve to crisp geometry (F-33). Spend fix effort ONLY on any that survive — if one does, open a new finding. Verify by: shot (fresh burst: gait readable, ground evenly lit, geometry crisp). F-10 gait quality also +demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~21%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 02:19:28Z** · ticked: - [x] GATE-P1 · Fable re-judge — Phase 1 (the first real look at the composed world). Re-capture; re-judge F-05/F-07/F-09/F-08 + the F-10/F-12/F-33 re-checks; triage the expected new world-look findings (biome density, prop placement, animal/piglet models, lighting) into the ledger before Phase 2. May re-open any P1 box.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~22%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 02:38:29Z** · ticked: - [x] P2.1 · F-16 · laptop wheel/trackpad dolly zoom [laptop] +demo. Player-initiated, damped dolly on the boom, clamped [F-05 min … ~8–10 m], fixed FOV (never a FOV zoom); under reduced-motion the zoom applies as an instant step. Reuse `cam.dist`. Verify by: assert (wheel changes `cam.dist` within both clamps, no FOV change) + zoom-in vs zoom-out shot pair visibly differs. Trackpad-pinch feel: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~24%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 03:27:35Z** · ticked: - [x] P2.2 · F-17 · laptop drag-orbit + click-vs-drag seam [laptop] +demo. Yaw free, pitch clamped (~−10°…+30°), damped, fixed FOV, roll 0, respect F-05's boom clamp. Pointer-layer discriminator (~6 px): drag → camera only (tap-to-walk suppressed); a clean click still walks. Assert BOTH sides (§3 tap-to-walk seam). Verify by: assert (drag changes real camera yaw while `pos` unchanged; a clean click still walks) + shot. Drag feel/damping: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~27%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 03:48:26Z** · ticked: - [x] P2.3 · F-30 · vehicle camera re-anchors on boarding [both] +demo. On "Stap in" the follow camera re-anchors to the JEEP (F-05 clearance rules; eye ~2.5–3.5 m over the hood), hands back on "Stap uit"; enter/exit are CUTS; yaw-follow damped, not hard-locked. Expose `cam.target` ("avatar"|"vehicle"); reuse `cam.dist`. Verify by: shot (a drive frame shows the jeep from behind with ground + horizon) + assert (`cam.target`="vehicle", `cam.dist` in range while `inVehicle`; consecutive drive frames differ in pixels). Drive feel/comfort: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~29%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 04:12:00Z** · ticked: - [x] P2.4 · F-31 · the ranger boards [both]. Parent the (F-07-normalized) avatar to the seat in a seated pose (real `sit`/`drive` clip, else static seated pose, else verifiably hidden); walk clip off while seated; `clip` never idle/walk in-vehicle. NB the fallback choice sets F-30/F-31's verify criterion (visible driver vs verifiably hidden). Verify by: shot (driver visible at the wheel — or verifiably hidden) + assert (avatar parented/hidden while `inVehicle`; `clip`=sit/none).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~32%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 04:44:10Z** · ticked: - [x] P2.5 · F-32 · steering asserts + comfort tuning [both] +demo. Control-condition asserts (laptop): 3 s no turn → unwrapped heading drift ≈ 0; hold one turn key 2 s → unwrapped heading monotonic by an expected range; consecutive drive frames differ in pixels (UNWRAP headings — wrapped yaw already lied once, F-18). Wire + assert iPad in-vehicle touch steering (needs P0.2). Comfort: cap turn rate ~0.6–0.9 rad/s (speed-scaled), ~1 s accel ramp, top speed clearly above foot speed. Verify by: assert (control-condition heading tests + pixel-diff). Steering feel + motion comfort: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~34%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 04:53:43Z** · ticked: - [x] GATE-P2 · Fable re-judge — Phase 2 (laptop camera control + the vehicle). Re-capture; re-judge F-16/F-17/F-30/F-31/F-32 from pixels + annotations. May re-open. Camera/steering FEEL stays demo-gated.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~37%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 05:21:55Z** · ticked: - [x] P3.1 · ONE ≥56 px chip token: F-02 + F-14 + F-20 + F-25(speaker) + F-28, with F-01 card-fit in the SAME change [both]. One shared min-height-56 visible-box token (padding, not font-inflation) for Begin / swatches / name chips / Pauze / board-exit / prompt-speaker / hub links; F-01 compacts the avatar card so bigger targets don't push the CTA off-fold (sticky "Dit is mijn ranger" footer). Verify by: assert (boundingBox ≥ 56 for each named control on both projects) + shot (F-01 CTA on-screen without scrolling; F-28 links now LOOK tappable).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~39%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 06:39:04Z** · ticked: - [x] P3.2 · ONE navigation model: F-27 + F-26 + F-20 [both]. Rule: every screen below the title has a visible ≥56 px way back. Hub gains "Naar het hoofdmenu" (→ `screen`="title", progress kept, gate not re-asked, no confirmation maze); Pauze stays visible + ≥56 px in-mission with a calm "Stop de missie" → world; board exit LOOKS ≥56. Verify by: assert (hoofdmenu → `screen`="title" then re-entry restores avatar+progress; Pauze visible + ≥56 while `missionView`="3d"; stop returns `screen`="world") + shot. Never-scary: leaving reads as neutral navigation.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~41%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 07:07:55Z** · ticked: - [x] P3.3 · ONE hint system: F-06 + F-15 + F-11-hint + F-13 tracker move [both] +demo. Sequence onboarding one hint at a time; ≤7-word lines; control hint persists until first successful use then fades; the 16-word toast becomes short transient(s); laptop help chip (≥56 px) re-shows hints; relocate the iPad tracker out of the joystick quadrant. One-time-hint flags via `state.ts` in the `alvah-ef-v1` ranger namespace (no new keys). Verify by: shot (single hint at entry, ≤7 words; iPad tracker not under the stick) + assert (hint-state field; joystick ∩ tracker boundingBox = ∅ on ipad). Read-aloud firing: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~44%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 08:07:55Z** · ticked: - [x] P3.1 · ONE ≥56 px chip token: F-02 + F-14 + F-20 + F-25(speaker) + F-28, with F-01 card-fit in the SAME change [both]. One shared min-height-56 visible-box token (padding, not font-inflation) for Begin / swatches / name chips / Pauze / board-exit / prompt-speaker / hub links; F-01 compacts the avatar card so bigger targets don't push the CTA off-fold (sticky "Dit is mijn ranger" footer). Verify by: assert (boundingBox ≥ 56 for each named control on both projects) + shot (F-01 CTA on-screen without scrolling; F-28 links now LOOK tappable). — RE-OPENED by the Phase-3 re-judge (2026-07-04): the prompt-speaker is the ONE control that missed the visible-box token — `.zoeken-speak` hits 56×56 but LOOKS like a bare ~20 px glyph floating on the prompt bar (no visible circle/chip at all; Run A's visible circle was ~46 px, so the affordance shrank). The F-20 addendum standard applies: make it LOOK ≥56, not just hit ≥56. Everything else in this box passes on the 09:08 set — fix ONLY the speaker's visible chip.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~44%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 08:19:36Z** · ticked: - [x] GATE-P3 · Fable re-judge — Phase 3 (chips, navigation, hints — both platforms). Re-capture; re-judge the token sizes, the back-paths and the hint sequencing. May re-open. Read-aloud stays demo-gated.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~46%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 08:30:47Z** · ticked: - [x] P4.1 · F-03 · title subtitle per-sentence lines [both]. Each sentence its own line, ≤7 words. Verify by: shot.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~49%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 08:47:31Z** · ticked: - [x] P4.2 · F-25 · mission prompt stacked, one type size [both] +demo. Two ≤7-word lines, same size (or show only the current step); couples with P3.1's speaker size. Verify by: shot (two stacked ≤7-word lines). Read-aloud on each step: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~51%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 09:09:21Z** · ticked: - [x] P4.3 · F-22 · occlusion-proof world / vehicle / POI labels [both]. DOM-projected screen-space overlays, or depth-test-off sprites + distance/behind-camera fade — must cover world, jeep and POI labels alike. Verify by: shot (label fully readable, including from an angle where geometry passes in front).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~54%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 09:29:42Z** · ticked: - [x] P4.4 · F-23 · one pictogram per mission card [both]. Flat in-repo vector (animal/biome silhouette), no new deps/pipeline; keep read-aloud on card focus. Verify by: shot (each card shows a distinct pictogram).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~56%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 09:44:12Z** · ticked: - [x] P4.5 · F-04 · ground + vary the title backdrop [both]. Soft blob shadows, mixed tree species/sizes, optionally one landmark prop (board/jeep). Stay well under 150 draw calls. Verify by: shot.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~59%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 10:12:09Z** · ticked: - [x] P4.6 · F-11 · world boundary rim + gentle stop [both]. Calm visible rim (heather berm / low fence / tree line), ease speed to zero (no hard wall), one ≤7-word hint with read-aloud when heading outward. Verify by: shot (rim visible at the edge) + assert (`pos` clamped at the boundary). Never-scary: gentle stop, no game-over.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~61%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 11:26:08Z** · ticked: - [x] P4.7 · F-29 · shared static scrim behind modals [both]. One ~35–50% dark rgba scrim (no backdrop-filter) behind pause / board / mission cards, applied as an instant state change. Verify by: shot (pause + board overlays show the same dimmed backdrop on both platforms).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~63%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 11:58:30Z** · ticked: - [x] P4.3 · F-22 · occlusion-proof world / vehicle / POI labels [both]. DOM-projected screen-space overlays, or depth-test-off sprites + distance/behind-camera fade — must cover world, jeep and POI labels alike. Verify by: shot (label fully readable, including from an angle where geometry passes in front). — RE-OPENED by the Phase-4 re-judge (2026-07-04): the occlusion mechanism itself is FIXED (chips render over the jeep roll cage / board, and sit correctly under the pause scrim), but every world-projected chip clips its final glyph at the chip's own right edge — zero right padding vs ~25 px left, so "Missiebord" reads "Missieborc" (27-board-affordance) and "Het stille zand" reads "Het stille zanc" (19-jeep-near AND 24-jeep-drive-4) — Run A's "…tille zanc…" symptom back via chip width/overflow instead of geometry. HUD tracker chips are unaffected. Fix the chip width/padding so the last letter renders whole, then re-shoot the same three frames.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~61%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 14:30:38Z** · ticked: - [x] P4.6 · F-11 · world boundary rim + gentle stop [both]. Calm visible rim (heather berm / low fence / tree line), ease speed to zero (no hard wall), one ≤7-word hint with read-aloud when heading outward. Verify by: shot (rim visible at the edge) + assert (`pos` clamped at the boundary). Never-scary: gentle stop, no game-over. — RE-OPENED by the Phase-4 re-judge (2026-07-04): rim, hint and clamp all pass (tree-line rim visible, "Hier stopt het bos." = 4 words, `atRim` true, dist 112.7 stable under bound 116) but in `32-boundary-rim.png` the RANGER IS NOWHERE IN FRAME — the boom sinks to `cam.y` ≈ 1.37 m (vs ~2.1 on walk frames) behind the rising berm and terrain fully occludes the avatar, while the devhook still reports `avatarInView`/`avatarScreen.onScreen` = true, opacity 1, heightFrac 0.34 (projection is not occlusion-aware). Bottom ⅔ of the frame is featureless murk; a child whose ranger silently vanishes at the world edge is exactly the "silently lost" this finding exists to prevent. Give the boom ground-height clearance at the rim (raise/pull the camera out of the hollow) AND make the avatar-visibility signal occlusion-aware so the assert can catch an empty frame; then re-shoot the rim.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~63%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 14:48:20Z** · ticked: - [x] GATE-P4 · Fable re-judge — Phase 4 (reading + world dressing). Re-capture; re-judge legibility, pictograms, backdrop, boundary, scrim. May re-open.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~66%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 15:05:09Z** · ticked: - [x] P5.1 · F-34b · capture RM through BOTH gates [both] (`app/e2e-capture/`). OS media (`emulateMedia reduce`) AND the in-game "Rustige beweging" toggle in Instellingen (real label — Tweaks.ts:42). Verify by: shot (RM PNGs exist on both platforms for both gates).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~68%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 15:31:01Z** · ticked: - [x] P5.2 · F-34c · make the RM world judgeable [both]. RM still vs normal world-entry (nothing structural differs), a short RM walk burst (locomotion STILL animates — keepLocomotion invariant), an idle frame pair (secondary motion frozen → near-zero pixel-diff at idle). Verify by: shot set + pixel-diff.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~71%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 15:56:05Z** · ticked: - [x] P5.3 · F-34d · durable cut-not-move assert [both] +demo. With F-05/F-18's pose fields: during any reframe under RM the camera pose is a step function (a cut), never interpolated; `.rm` body class present via both gates. Verify by: assert (step-function camera under RM; `.rm` via both gates). True motion comfort on-device: needs Floris demo.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~73%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 16:20:38Z** · ticked: - [x] P5.4 · Full both-platform re-capture + triage. One clean `npm run capture`; sweep the WHOLE flow for anything the phase gates missed; open findings for survivors. Verify by: shot (complete fresh set, both platforms).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 16:57:10Z** · ticked: - [x] P3.2 · ONE navigation model: F-27 + F-26 + F-20 [both]. Rule: every screen below the title has a visible ≥56 px way back. Hub gains "Naar het hoofdmenu" (→ `screen`="title", progress kept, gate not re-asked, no confirmation maze); Pauze stays visible + ≥56 px in-mission with a calm "Stop de missie" → world; board exit LOOKS ≥56. Verify by: assert (hoofdmenu → `screen`="title" then re-entry restores avatar+progress; Pauze visible + ≥56 while `missionView`="3d"; stop returns `screen`="world") + shot. Never-scary: leaving reads as neutral navigation. — RE-OPENED by the final Phase-5 re-judge (2026-07-04): the BOARD screen lost its visible way back — `.mb-back` still asserts 245×56 but its box sits at y=882 in the 800 px viewport (fresh `28-board-open`), fully below the fold, and the 10th mission card is cut mid-card at the frame's bottom edge; the child sees NO exit on this screen (the P4.4 pictogram cards grew the grid past the fold — the F-01 off-fold trap, now on the prikbord). Everything else in this box still passes on the 18:21 set (hoofdmenu round-trip with no gate re-ask, Pauze 96×56 in-mission, calm stop→world). Fix ONLY the board exit's visibility — keep `.mb-back` on-screen without scrolling (sticky footer like F-01's `.av-klaar`, or scroll the card grid INSIDE the panel), no tap target may shrink below 56 — then re-shoot 28.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~74%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 17:49:17Z** · ticked: - [x] P5.5 · rim prop floats at head height [both] (final Phase-5 re-judge triage, 2026-07-04: in fresh `42-boundary-rim` a purple faceted heather/rock clump hangs in MID-AIR beside the ranger's head — no ground contact at any believable depth; too large for a tree-line clump, too high for a near one — a rim-band prop left at the wrong height, in the hero frame of the world-edge moment). Seat rim-band props on the terrain (`heightAt`) or cull them from the rim hollow; re-check the other rim approach angles. Verify by: shot (fresh boundary-rim frame: every prop grounded; the whole solid ranger at the tree-line rim keeps P4.6's pass).

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 20:07:51Z** · ticked: - [x] DEFERRED · P3.2 · ONE navigation model: F-27 + F-26 + F-20 [both]. Rule: every screen below the title has a visible ≥56 px way back. Hub gains "Naar het hoofdmenu" (→ `screen`="title", progress kept, gate not re-asked, no confirmation maze); Pauze stays visible + ≥56 px in-mission with a calm "Stop de missie" → world; board exit LOOKS ≥56. Verify by: assert (hoofdmenu → `screen`="title" then re-entry restores avatar+progress; Pauze visible + ≥56 while `missionView`="3d"; stop returns `screen`="world") + shot. Never-scary: leaving reads as neutral navigation. — RE-OPENED by the final Phase-5 re-judge (2026-07-04): the BOARD screen lost its visible way back — `.mb-back` still asserts 245×56 but its box sits at y=882 in the 800 px viewport (fresh `28-board-open`), fully below the fold, and the 10th mission card is cut mid-card at the frame's bottom edge; the child sees NO exit on this screen (the P4.4 pictogram cards grew the grid past the fold — the F-01 off-fold trap, now on the prikbord). Everything else in this box still passes on the 18:21 set (hoofdmenu round-trip with no gate re-ask, Pauze 96×56 in-mission, calm stop→world). Fix ONLY the board exit's visibility — keep `.mb-back` on-screen without scrolling (sticky footer like F-01's `.av-klaar`, or scroll the card grid INSIDE the panel), no tap target may shrink below 56 — then re-shoot 28. — BOARD FIX CONFIRMED, then RE-OPENED AGAIN by the GATE-P5 re-judge (2026-07-04, 19:49 set): the board exit is genuinely fixed (`.mb-back` 245×56 at y=720, on-screen; all 10 cards whole in fresh `28-board-open`), and hoofdmenu round-trip / Pauze 96×56 in-mission / calm stop→world all pass — but the SAME off-fold trap sits on the INSTELLINGEN screen: in fresh `33-instellingen-rm` the panel has NO close/back affordance at the top, NO Pauze chip is visible while it is open, the 8th toggle ("Platte weergave") is cut mid-row at the frame's bottom edge, and `.tw-back` (111×56) measures at y=1404 in the 800 px viewport — the child sees NO exit on the settings screen without scrolling. Fix ONLY the Instellingen exit's visibility — keep `.tw-back` on-screen without scrolling (sticky footer like `.av-klaar`/the board fix, or scroll the toggle list INSIDE the panel), no tap target below 56 — then re-shoot 33.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 20:09:00Z** · ticked: - [x] GATE-P5 · Final Fable re-judge — the whole game, both platforms. Re-capture; re-judge every screenshot-closable box across all phases. May re-open anything. This is the last gate before the Floris demo. BUILD-COMPLETE when this ticks and every non-DEMO box above is `[x]`.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```

---
**2026-07-04 20:09:52Z** · status

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-04 20:19:31Z** · ticked: - [x] P0.1 · DIRECTION · write & commit RUN-C-DIRECTION.md (2) — the Fable art

```
✔ landed: P0.1 · DIRECTION · write & commit RUN-C-DIRECTION.md (2) — the Fable art
▶ phase:  Phase 0 · direction-first  (write the plan before any build — VISION §10)
→ next:   GATE-P0 · Fable seeds the cohesion ledger from the doc + current pixels.
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~2%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-04 20:38:06Z** · ticked: - [x] GATE-P0 · Fable seeds the cohesion ledger from the doc + current pixels.

```
✔ landed: GATE-P0 · Fable seeds the cohesion ledger from the doc + current pixels.
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   P1.0 · Frame the board face on approach + re-prove the proportion baseline [both] — F-19's follow-camera work: when the player enters the board's near-radius, gently damp-turn the follow camera (player-initiated by walking in; a CUT under reduced-motion) and/or angle the board face toward the natural hub approach, so the board FACE + papers and the whole ranger are in shot at believable scale; expose a board-in-frustum boolean on the dev hook (retry from Run B DEFERRED) · verify-by: fresh `22-board-affordance` shows the board face with papers readable AND the ranger fully in frame at believable proportion (assert: board-in-frustum true while `board.near`; `avatar.height` ∈ [1.5,2.0]; drawCalls <150)
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~3%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-04 21:05:51Z** · ticked: - [x] P1.0 · Frame the board face on approach + re-prove the proportion baseline [both] — F-19's follow-camera work: when the player enters the board's near-radius, gently damp-turn the follow camera (player-initiated by walking in; a CUT under reduced-motion) and/or angle the board face toward the natural hub approach, so the board FACE + papers and the whole ranger are in shot at believable scale; expose a board-in-frustum boolean on the dev hook (retry from Run B DEFERRED) · verify-by: fresh `22-board-affordance` shows the board face with papers readable AND the ranger fully in frame at believable proportion (assert: board-in-frustum true while `board.near`; `avatar.height` ∈ [1.5,2.0]; drawCalls <150)

```
✔ landed: P1.0 · Frame the board face on approach + re-prove the proportion baseline [both] — F-19's follow-camera work: when the player enters the board's near-radius, gently damp-turn the follow camera (player-initiated by walking in; a CUT under reduced-motion) and/or angle the board face toward the natural hub approach, so the board FACE + papers and the whole ranger are in shot at believable scale; expose a board-in-frustum boolean on the dev hook (retry from Run B DEFERRED) · verify-by: fresh `22-board-affordance` shows the board face with papers readable AND the ranger fully in frame at believable proportion (assert: board-in-frustum true while `board.near`; `avatar.height` ∈ [1.5,2.0]; drawCalls <150)
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~5%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-04 21:47:06Z** · ticked: - [x] P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~7%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-04 23:12:43Z** · ticked: - [x] P1.3 · Trees + world props to one fidelity [both]. Mixed species/sizes,

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   DEFERRED · P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~8%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-05 01:22:51Z** · ticked: - [x] P1.4 · Title screen on-style + grounded [both]. Golden-hour backdrop,

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   DEFERRED · P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~9%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-05 02:37:22Z** · ticked: - [x] P1.5 · Case-board (prikbord) + pause on-style [both]. The hub board and

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   DEFERRED · P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~11%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-05 04:02:13Z** · ticked: - [x] P1.6 · Each of the 5 game surfaces on-style (3D + 2D floor) [both].

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   DEFERRED · P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~13%
⚠ blocker: Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).
```

---
**2026-07-05 04:43:13Z** · status

```
✔ landed: P1.1 · Unify the lighting + sky to the golden-hour touchstone [both].
▶ phase:  Phase 1 · one naturalistic art direction across all screens  (VISION §13.1 — the cohesion + realism unifier; the single highest-impact lever)
→ next:   DEFERRED · P1.2 · Naturalistic terrain + ground materials [both]. Replace flat/
▤ ledger: RUN-C-LEDGER.md
▷ progress: ~9%
⚠ blocker: Run C paused by usage-guard: session wall-clock budget reached (513m ≥ 480m) — clean stop; re-launch to continue
```

---
**2026-07-05 09:13:56Z** · status

```
✔ landed: —
▶ phase:  Phase 0 · direction-first  (validate the reconciliation before any build)
→ next:   D0.1 · DIRECTION · validate + refine RUN-D-DIRECTION.md and this ledger
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~0%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-05 10:35:39Z** · ticked: - [x] D0.1 · DIRECTION · validate + refine RUN-D-DIRECTION.md and this ledger

```
✔ landed: D0.1 · DIRECTION · validate + refine RUN-D-DIRECTION.md and this ledger
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~3%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-05 12:42:21Z** · ticked: - [x] D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~6%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 14:44:52Z** · ticked: - [x] D1.1 · Capture frames wait for camera-settle; the zoom pair must provably differ [laptop] (D0.1 append, 2026-07-05 — fresh `12-camera-zoom-in` and `13-camera-zoom-out` are two IDENTICAL pre-settle void frames: shot 13's annotation holds `cam.dist` 1.67 against `zoom.dist` 9.5, so the eased dolly never moved before the snap; a pre-settle frame is no-evidence, direction doc §8.7). Harness-only (`app/e2e-capture/`), no game code: before every camera/zoom/orbit/reframe snap, wait until the eased `cam.dist` is within ~5% of its target (`zoom.dist` for the zoom pair) with a bounded timeout that GAPs honestly on failure; assert the zoom-in vs zoom-out `pixelHash` values differ. Verify by: fresh annotations show `cam.dist` ≈ `zoom.dist` on both zoom shots AND a differing `pixelHash` between them; no new GAP entries in the fresh set.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~7%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 15:17:17Z** · ticked: - [x] D1.2 · Locomotion foundation: one raycast ground-truth under every walkable surface [both] (research-derived, 2026-07-05 — see the Phase-1 preamble; D0.2 may re-rank) — replace/underpin the `heightAt` Y-write in the controller path (`render3d/CharacterController.ts` + World.ts:870/977) with a raycast-down ground-snap against the REAL rendered terrain + solid-prop meshes: cast from above the head, place the body at hit-point + foot offset, project the desired velocity along the face-normal slope tangent, clamp steep slopes (~45°) as unwalkable; use the installed `three-mesh-bvh` (MIT) if the per-frame raycasts get hot. NO physics engine unless the burst-asserts prove this path cannot pass (then cannon-es MIT before rapier — record why in RUN-D-PLAN.md §8). Expose `grounded` (boolean) + foot-clearance on the dev hook here — P1.5a asserts them across the wider world. Verify by: drive-assert (a spawn → slope walk burst holds `grounded`=true AND foot-clearance ≥0 every frame) + assert (drawCalls <150; build + e2e:smoke green; motion-comfort law untouched).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~9%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 15:51:00Z** · ticked: - [x] P1.5a · The ranger never sinks through the floor/terrain [both] +demo (builds on D1.2's ground-truth) — ground the character controller so the ranger stays ON the terrain + solid props everywhere he can walk (spawn, slopes, the dunes behind spawn, hub, the ven shore, every mission scene). D0.1 pixel proof (2026-07-05): fresh `45-ven-shore` shows him sunk to the NECK in the ven-bowl slope — the visual-terrain/`heightAt` disagreement reproduces ON LAPTOP, not only on Floris's device. Expose dev-hook `grounded` (boolean) + foot-clearance (ranger y minus terrain height). Extend the capture harness (app/e2e-capture/, allowed) to walk a burst across spawn → slope → dune → the ven-bowl shore. Verify by: drive-assert (`grounded`=true every frame of the walk burst AND foot-clearance ≥0 — never below terrain — across spawn/slope/dune/ven-shore) + shot (feet on the ground in the ven-shore frame too, no half-buried frame); drawCalls <150. +demo: Floris walks the real iPad over the dunes without falling through.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~10%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 19:20:02Z** · ticked: - [x] P1.5b · The jeep actually drives — it translates through the world, no stick-and-slide [both] +demo — pressing drive moves the jeep's WORLD POSITION forward along its heading with believable ground contact; no sliding-in-place, no snap. Ground contact per runs/animation-research.md §4.5: a 4-wheel-point raycast average (or a damped hover/spring toward target height), NEVER a hard per-frame Y-snap — that is the "magnetically welded" stick Floris felt. Expose the jeep's per-frame world-position delta on the dev hook (`vehicle().position` already exists as x/z). Extend the harness to drive a forward + held-turn burst. Verify by: drive-assert (`vehicle()` x/z displacement ≫0 and monotonic along heading across the drive burst, jeep stays grounded, heading changes smoothly with no wrap-jump) + shot (jeep visibly further along the track between frames). +demo: Floris drives on the real device and it moves naturally, not stuck.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~11%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 19:50:03Z** · ticked: - [x] P1.5c · The helicopter can be enabled in Instellingen AND entered [both] +demo — wire the whole path end-to-end: the `helikopter` toggle in Instellingen is reachable + tappable (≥56 px, on-screen — COUPLE with the Instellingen sticky-exit fix D3.10 so it isn't below the fold), turning it on makes `heliAvailable` true, the "🚁 Stap in de helikopter" affordance appears at a pad, and tapping it enters. NB `heli().available` is false under reduced-motion BY DESIGN (flight withheld, not calmed) — the harness scene must run with reduced-motion OFF. Extend the harness to open Instellingen → toggle helikopter on → walk to a pad → enter. Verify by: drive-assert (the helikopter toggle bounding-box inside the viewport + ≥56 px; after toggling on `heli().available`=true; at the pad `heli().near`=true; after the enter tap `heli().inHeli`=true) + shot (the toggle on-screen in Instellingen; the enter affordance at the pad). +demo: Floris turns it on in Settings and flies pad-to-pad on the real iPad.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~13%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 21:08:20Z** · ticked: - [x] D1.3 · Mission-entry camera lands above the terrain with the task in frame — all five game-3D scenes [both] (D0.2 append, 2026-07-05 — fresh player-path frames: simon-3D was shot from BELOW the terrain by the game's own mission-entry reframe (`cam.y` −1.29, up-tilt, `avatarScreen.visible` false while the ranger is plainly in frame); corsi-3D near-straight-down (pitch −1.05) framing bare ground instead of its route field; zoeken-3D framing the board's flank. The Run B camera law — the follow camera lands OUTSIDE terrain/props — extends UNDER it, and a below-ground or off-playfield frame is no-evidence, doc §8.7/§2.5). Fix the game's mission-entry camera (the §1e reframe in the mission path) so each mini-game's 3D entry lands above the terrain surface, inside the normal follow pitch band, with the scene's task staging (zoek-target, route field, call half-circle, encounter vignette, both wissel-bestemmingen) in frustum at the first playable beat; extend the capture harness (`app/e2e-capture/`) to assert camera-above-terrain + task-in-frustum per game-3D scene and GAP honestly on failure. Verify by: drive-assert (all five game-3D entries hold `cam.y` > terrain height at the camera's XZ AND the task-in-frustum boolean true) + shot (five player-path frames each showing the playfield — no under-ground, no backside, no void) + assert (drawCalls <150).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~14%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-10 22:41:34Z** · ticked: - [x] D1.1 · Capture frames wait for camera-settle; the zoom pair must provably differ [laptop] (D0.1 append, 2026-07-05 — fresh `12-camera-zoom-in` and `13-camera-zoom-out` are two IDENTICAL pre-settle void frames: shot 13's annotation holds `cam.dist` 1.67 against `zoom.dist` 9.5, so the eased dolly never moved before the snap; a pre-settle frame is no-evidence, direction doc §8.7). Harness-only (`app/e2e-capture/`), no game code: before every camera/zoom/orbit/reframe snap, wait until the eased `cam.dist` is within ~5% of its target (`zoom.dist` for the zoom pair) with a bounded timeout that GAPs honestly on failure; assert the zoom-in vs zoom-out `pixelHash` values differ. Verify by: fresh annotations show `cam.dist` ≈ `zoom.dist` on both zoom shots AND a differing `pixelHash` between them; no new GAP entries in the fresh set.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~14%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-11 00:53:04Z** · ticked: - [x] D1.5 · The follow camera never sits inside a prop: occluders fade on the walk path [both] (poort-append 2026-07-11 — fresh `09-walk-4` is a FULL-FRAME foliage void: the free-walk follow camera at z≈−51 sits INSIDE a tree crown (cam.y 3.59 IS above terrain 1.12, so the D1.3 law holds — but §2.5's OUTSIDE-props law has no free-walk enforcement) with HUD chips floating over raw leaf geometry and drawCalls 10 (nearly all culled), while the hook claims `avatarInView`=true and `avatarScreen.visible`=true — a hook-vs-pixel breach, doc §8.7; fresh `10-walk-5` is the same family: a sapling between lens and ranger swallows him to the head). Fix in game code, motion-comfort-first: FADE the canopy/prop that intersects the camera→avatar sightline (the existing `avatarOpacity` machinery is the in-repo precedent; an opacity fade is not a camera move, so no comfort-law risk) — do NOT auto-move the camera (orbit/zoom/reframe stays player-initiated per the frozen law); make `avatarScreen.visible` (or a new `cam.viewClear`) reflect a REAL cam→avatar clear-line test so the hook stops lying; extend the capture walk burst to sample that boolean every frame. Verify by: drive-assert (the spawn-south walk burst holds the clear-line boolean true every frame — no fully-occluded frame) + shot (fresh walk set: the ranger readable in EVERY walk frame, zero full-frame foliage voids) + assert (drawCalls <150; the RM pixel-freeze law unaffected).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~15%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-11 02:09:39Z** · ticked: - [x] D1.5 · The follow camera never sits inside a prop: occluders fade on the walk path [both] (poort-append 2026-07-11 — fresh `09-walk-4` is a FULL-FRAME foliage void: the free-walk follow camera at z≈−51 sits INSIDE a tree crown (cam.y 3.59 IS above terrain 1.12, so the D1.3 law holds — but §2.5's OUTSIDE-props law has no free-walk enforcement) with HUD chips floating over raw leaf geometry and drawCalls 10 (nearly all culled), while the hook claims `avatarInView`=true and `avatarScreen.visible`=true — a hook-vs-pixel breach, doc §8.7; fresh `10-walk-5` is the same family: a sapling between lens and ranger swallows him to the head). Fix in game code, motion-comfort-first: FADE the canopy/prop that intersects the camera→avatar sightline (the existing `avatarOpacity` machinery is the in-repo precedent; an opacity fade is not a camera move, so no comfort-law risk) — do NOT auto-move the camera (orbit/zoom/reframe stays player-initiated per the frozen law); make `avatarScreen.visible` (or a new `cam.viewClear`) reflect a REAL cam→avatar clear-line test so the hook stops lying; extend the capture walk burst to sample that boolean every frame. RE-OPENED at the poort-audit #2 (2026-07-11, fresh 02:53–03:34 capture): the machinery landed but is not yet TRUE — (1) the box's own view-clear spec FAILED in the audit capture: the fade fired (6 occluded frames) but `minFade` reached only 0.9621 against the ≤0.5 see-through assert (Opus's committed 02:5x self-verify honestly hit 0.16 with 11 occluded frames — the fade's slow ease is LOAD-FRAGILE: under the capture's throttled rAF the walk crosses the crown before the ease deepens, which a real player experiences as seconds of murk); (2) fresh `11-controls-hud` (the plain walk path, z≈−59) is a full-frame murk close-up while the hook holds `viewClear`=true + `canopyFade`=1 — the lens-INSIDE-crown case still lies at snap time (a frontface-only ray cast from inside a crown exits unhit); (3) `12-pause-hub` at the same spot seconds later holds `canopyFade` 0.16 yet the backdrop is STILL murk — fading one crown does not restore a readable frame when the lens sits inside foliage. Exact fix: make the fade attack effectively instant (occluder driven to ≤0.35 opacity within ~0.2 s of detection; the release may stay slow and gentle; under reduced-motion the fade may snap — an opacity fade is not a camera move), detect the lens-inside-crown case (double-sided raycast or point-in-volume test) and fade EVERY crown intersecting the near-lens sightline rather than only the first hit, and make `viewClear` report false while any sightline occluder still sits above 0.5 opacity so the hook matches pixels. Verify by (sharpened, audit #2): drive-assert (the D1.5 view-clear spec green INSIDE the full capture — `occludedFrames` ≥1 AND `minFade` ≤0.5, the assert stays HARD) + shot (the main-flow walk set INCLUDING the `controls-hud`/`pause-hub` spot at z≈−59: ranger + ground context readable in every frame, zero murk/void frames) + assert (on any walk shot with an occluder on the sightline the sampled `canopyFade` ≤0.5 at snap time; drawCalls <150; the RM pixel-freeze law unaffected).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~15%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-11 02:20:59Z** · ticked: - [x] D1.6 · The jeep capture group lands inside its budget — the world jeep shots return, zero GAP entries [laptop] (poort-append 2026-07-11 audit #2 — the fresh 02:53 capture's main flow is otherwise COMPLETE: intro 269 s/540, camera 100 s/240, board 87 s/420, boundary 84 s/510, all five game3d 49–63 s each, ven 66 s/510, 9 orphans pruned, burst subdirs all-fresh — but the `jeep` group overran its budget by ONE second (421 s vs 420 s) and GAPped, so the fresh set holds zero world jeep frames: P1.5b's shot leg survives on the p15b burst frames, but the Phase-6 P4.2/P4.5 world-jeep evidence starves, and "zero GAP entries" — the parked D1.4's bar — is unmet by exactly this one group). Harness-only (`app/e2e-capture/`): raise the jeep group's budget to its MEASURED headless runtime with honest headroom (it ran 421 s — give it ≥600 s) or cheapen the scene the D1.4 way (fresh-boot to the jeep instead of long walk-backs), keeping the group's world shots (approach/enter/straight/turn) and their outside-props framing. Verify by: `npm run capture` exits green with ZERO GAP entries in the fresh annotations; the jeep world shots present with the jeep visibly in frame and per-frame drawCalls <150; every PNG under `laptop/` incl. subdirs is capture-fresh.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~16%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-11 04:05:02Z** · ticked: - [x] D1.6 · The jeep capture group lands inside its budget — the world jeep shots return, zero GAP entries [laptop] (poort-append 2026-07-11 audit #2 — the fresh 02:53 capture's main flow is otherwise COMPLETE: intro 269 s/540, camera 100 s/240, board 87 s/420, boundary 84 s/510, all five game3d 49–63 s each, ven 66 s/510, 9 orphans pruned, burst subdirs all-fresh — but the `jeep` group overran its budget by ONE second (421 s vs 420 s) and GAPped, so the fresh set holds zero world jeep frames: P1.5b's shot leg survives on the p15b burst frames, but the Phase-6 P4.2/P4.5 world-jeep evidence starves, and "zero GAP entries" — the parked D1.4's bar — is unmet by exactly this one group). RE-OPENED at the poort-audit #3 (2026-07-11, fresh 04:22–05:09 capture): the budget raise was the WRONG branch of the box's OR — the `jeep` group GAPped the raised 720 s budget too (721 s, ZERO world jeep shots, third capture running). The +1 s signature (421/420 → 721/720) is the group-budget KILL granularity, not a near-miss: the sitting's "the body returns at ~421 s" premise misread a kill time as a completion time. Real cause (diagnosed at the audit): `walkTo`'s poll-correct-hold steering DIVERGES under full-capture load — arrow keys stay held between corrections while each poll's `page.evaluate` round-trips through a starved event loop (~2+ s late in the flow), so the uncorrected walk legs grow to several metres, LONGER than the `near` radius, and the ranger ORBITS the jeep without ever entering it — consuming ANY budget. Evidence triangle: the standalone `jeep-drive.spec.ts` walks the SAME approach on a fresh browser in ≤90 steps and passed all three audit captures; the main-flow group (300 steps, browser bloated by ~7 min of prior groups) has never arrived at 300/420/720 s; and the same loop family felled the heli spec THIS capture — `heli-enter.spec.ts` failed `at the pad heli().near is true` after its 240-step loop exhausted while its own `p15c-heli-01-at-pad.png` shows the ranger standing directly in front of the helicopter (the walk arrived in pixels and stopped just outside the radius; the game chain stays proven from audits #1+#2 and no heli game code changed, so P1.5c stays ticked — THIS box carries the spec's return to green). Harness-only (`app/e2e-capture/`), the fix is CONVERGENCE, not budget: steer the long approaches so they cannot orbit — (a) pulsed-key steering (hold keys ≤~400 ms per poll, then release before re-reading: an uncorrected leg can never exceed the near radius even when polls crawl), or (b) drive the approach with the game's own tik-om-te-lopen click-walk (F-17 — in-game per-frame steering immune to poll starvation; fresh `18-camera-click-walk` proves it live), or (c) an equivalent stop-on-radius scheme; apply the same to `heli-enter.spec.ts`'s 240-step walk; THEN lower the jeep budget to a converging body's honest measure. Plus the evidence-freshness cousin this capture exposed: the failed heli spec left `heli-enter-laptop.json` STALE (03:26) beside its fresh 04:58 PNGs — every burst spec must wipe/rewrite its JSON at start (or on assert-fail) so a failed leg can never masquerade as fresh evidence. Verify by: `npm run capture` exits green with ZERO GAP entries in the fresh annotations; the jeep world shots present (`jeep-near/in/drive-1..4/straight-1..2`) with the jeep visibly in frame and per-frame drawCalls <150; `heli-enter.spec.ts` green INSIDE the same run (`near`=true → `inHeli`=true with pad + in-flight shots); every PNG AND burst JSON under `laptop/` incl. subdirs is capture-fresh.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~16%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```

---
**2026-07-11 04:05:40Z** · status

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~16%
⚠ blocker: Run D paused by usage-guard: session wall-clock budget reached (514m ≥ 480m) — clean stop; re-launch to continue
```

---
**2026-07-11 05:26:16Z** · status

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~14%
⚠ blocker: Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.
```

---
**2026-07-11 06:25:57Z** · ticked: - [x] D1.5 · The follow camera never sits inside a prop: occluders fade on the walk path [both] (poort-append 2026-07-11 — fresh `09-walk-4` is a FULL-FRAME foliage void: the free-walk follow camera at z≈−51 sits INSIDE a tree crown (cam.y 3.59 IS above terrain 1.12, so the D1.3 law holds — but §2.5's OUTSIDE-props law has no free-walk enforcement) with HUD chips floating over raw leaf geometry and drawCalls 10 (nearly all culled), while the hook claims `avatarInView`=true and `avatarScreen.visible`=true — a hook-vs-pixel breach, doc §8.7; fresh `10-walk-5` is the same family: a sapling between lens and ranger swallows him to the head). Fix in game code, motion-comfort-first: FADE the canopy/prop that intersects the camera→avatar sightline (the existing `avatarOpacity` machinery is the in-repo precedent; an opacity fade is not a camera move, so no comfort-law risk) — do NOT auto-move the camera (orbit/zoom/reframe stays player-initiated per the frozen law); make `avatarScreen.visible` (or a new `cam.viewClear`) reflect a REAL cam→avatar clear-line test so the hook stops lying; extend the capture walk burst to sample that boolean every frame. RE-OPENED at the poort-audit #2 (2026-07-11, fresh 02:53–03:34 capture): the machinery landed but is not yet TRUE — (1) the box's own view-clear spec FAILED in the audit capture: the fade fired (6 occluded frames) but `minFade` reached only 0.9621 against the ≤0.5 see-through assert (Opus's committed 02:5x self-verify honestly hit 0.16 with 11 occluded frames — the fade's slow ease is LOAD-FRAGILE: under the capture's throttled rAF the walk crosses the crown before the ease deepens, which a real player experiences as seconds of murk); (2) fresh `11-controls-hud` (the plain walk path, z≈−59) is a full-frame murk close-up while the hook holds `viewClear`=true + `canopyFade`=1 — the lens-INSIDE-crown case still lies at snap time (a frontface-only ray cast from inside a crown exits unhit); (3) `12-pause-hub` at the same spot seconds later holds `canopyFade` 0.16 yet the backdrop is STILL murk — fading one crown does not restore a readable frame when the lens sits inside foliage. Exact fix: make the fade attack effectively instant (occluder driven to ≤0.35 opacity within ~0.2 s of detection; the release may stay slow and gentle; under reduced-motion the fade may snap — an opacity fade is not a camera move), detect the lens-inside-crown case (double-sided raycast or point-in-volume test) and fade EVERY crown intersecting the near-lens sightline rather than only the first hit, and make `viewClear` report false while any sightline occluder still sits above 0.5 opacity so the hook matches pixels. Verify by (sharpened, audit #2): drive-assert (the D1.5 view-clear spec green INSIDE the full capture — `occludedFrames` ≥1 AND `minFade` ≤0.5, the assert stays HARD) + shot (the main-flow walk set INCLUDING the `controls-hud`/`pause-hub` spot at z≈−59: ranger + ground context readable in every frame, zero murk/void frames) + assert (on any walk shot with an occluder on the sightline the sampled `canopyFade` ≤0.5 at snap time; drawCalls <150; the RM pixel-freeze law unaffected). RE-OPENED at the poort-audit #4 (2026-07-11, fresh 06:07–06:59 capture): the CROWN machinery holds — its spec ran green inside this capture too (minFade 0.04, occludedFrames 14, the bos walk readable) — but the box's own shot-leg is breached again at its own named spot: fresh `11-controls-hud` (pos z≈−60.4 — the duration-based walk drifted ~2.6 m south of audit-#3's pass spot) is a FULL-FRAME murk void with NO ranger while the hook claims `viewClear`=true + `canopyFade`=1 + `avatarScreen.visible`=true. The occluder is NOT a crown this time: cam.y 3.71 vs groundAtCam 1.45 at near-horizontal pitch with the frame filled edge-to-edge by a shadow-receiving surface = a TERRAIN dune face between lens and ranger — a class the crown fade + point-in-volume test cannot cover (terrain cannot be faded), and the clear-line hook does not test terrain, so it lies. Fix in game code, the same comfort-safe family as the D1.3 above-terrain law: extend the follow camera's EXISTING damped terrain-following so the WHOLE cam→avatar sightline clears the rendered terrain (sample the segment against the mesh; lift the boom smoothly / ride the crest until clear — this is follow-behaviour, not a player-initiated orbit; under RM the correction lands as a cut), and make `viewClear` + `avatarScreen.visible` test the SAME terrain+prop sightline so the hook can never claim clear over a murk frame. Second leg: kill/reset lingering occluder fades when a composed screen takes the camera — fresh `13-title-return` shows half-GHOSTED crowns on the title backdrop (the slow fade release carried into a composed hero screen). Harness leg (allowed): pin the `controls-hud`/`pause-hub` sample to a FIXED world spot (walk to coordinates, not for a duration) so this evidence stops wobbling between runs. Verify by (audit #4): drive-assert (the D1.5 view-clear spec green INSIDE the full capture AND the pinned-spot walk holds a terrain-inclusive `viewClear` that matches pixels every sampled frame) + shot (`11-controls-hud` + `12-pause-hub` at the pinned spot: ranger + ground context readable, ZERO murk/void frames; `13-title-return` crowns at full opacity) + assert (drawCalls <150; RM freeze pairs stay pixel-identical).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~15%
⚠ blocker: Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.
```

---
**2026-07-12 00:56:21Z** · ticked: - [x] D1.7 · The ranger renders after a title round-trip — no invisible avatar on the player path [both] (poort-append 2026-07-11 audit #4 — fresh `14-title-return-world` shows the hub with the ranger's SHADOW crisply cast on the ground and NO body: the shadow pass draws while the skinned mesh does not, and the hook claims `avatarOpacity` 1 + `avatarScreen.visible` true + clip 'idle' — a hook-vs-pixel breach, doc §8.7, on the REAL player path: Alvah taps back to the title and returns → an invisible ranger. Likely families, find the REAL cause, don't guess: the title→world transition's avatar fade-in reporting its TARGET opacity while the material still renders ~0 (the `avatarOpacity` ease machinery), a stuck/slow fade-in racing the snap, or stale skinned-mesh bounds/frustum-culling after the title reframe (the F-07 float/bounds family — the shadow-vs-body split is its signature). Game code: make the body visibly rendering within ~1 s of world re-entry (under RM: instantly), and make the hook report the RENDERED material opacity, never the target, so a snap can assert honestly. Verify by: shot (fresh `14-title-return-world`: the ranger's body visible at the hub, not only his shadow) + drive-assert (across the title→world return the rendered-opacity hook reaches ≥0.99 inside the settle window AND `avatarScreen.visible` matches pixels) + assert (drawCalls <150; the RM freeze pairs unaffected).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~16%
⚠ blocker: Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.
```

---
**2026-07-12 02:17:58Z** · ticked: - [x] P1.6a · Alvah is a CHILD: fix his height + set adult humans to 1.8 m [both] — Alvah is 8 and ≈ 1.2 m, not the ~1.7 m adult the code currently uses (`RANGER_STAND_HEIGHT` / `STAND_HEIGHT['ranger-alvah']` = 1.7 in [AnimalScale.ts](../../app/src/render3d/AnimalScale.ts) — fix to ~1.2 m child). Any mature human (the mature ranger/boswachter NPC) stands ~1.8 m, so Alvah must read a clear head-and-shoulders shorter beside one. Expose the mature-human height on the dev hook alongside `avatar.height`. THIS SUPERSEDES Run B's ~1.7 m target and the inherited `avatar.height ∈ [1.5,2.0]` assert — Alvah's band is now child-scale. SHARPENED at the 2026-07-11 poort-audit off fresh pixels + code: (1) the animal-rescale trap — `RANGER_STAND_HEIGHT` is ALSO the denominator of `ratioToRanger` (AnimalScale.ts:74), so naively writing 1.2 there would inflate EVERY animal ~42% relative to the world; introduce a separate `ADULT_REFERENCE_HEIGHT` (1.7–1.8) that keeps `ratioToRanger` + the frozen `app/e2e/` scale spec green untouched, and give the PLAYER rig its own ≈1.2 m child stand-height — animals must NOT rescale. (2) the adult reference exists staged: `ranger-warden-boa.glb` (public/models/) — seat the warden at a believable hub spot (bij de cabin of het missiebord) at ≈1.8 m as the on-path comparison adult. Poort-audit #2 (2026-07-11) makes this cheaper: the warden ALREADY stands in-world as a W3.3 scenic actor at a fixed spot near spawn (World.ts:331; he is the near-foreground adult in fresh `17-camera-orbit`) — reuse his existing spot if it reads believable (else move him bij de cabin/het bord as written), expose his height on the dev hook, and stage the pair shot from the spawn/orbit path the capture already walks. (3) The e2e-capture boot gates (`height > 0.5`/`> 1`) are already child-safe — no literal [1.5,2.0] band remains there; note the fresh annotations read `avatar.height` 1.6999 at idle but 1.7122 MID-WALK (the walk bob inflates the read ~+0.01) — sample the height assert at IDLE. Scale the rig, not the camera; keep animations + foot-on-ground (the D1.2 raycast ground-truth) intact. Poort-audit #3 (2026-07-11) adds two rig-height traps to the same rescale: World.ts's `CAM_LOOK_H = 1.1` (the walk look-at + the D1.5 chest-sightline aim — ~sternum on a 1.7 m adult but the FACE of a 1.2 m child: derive it from the rig height like `avatarTopY` already self-measures at load, World.ts:1804) and the idle look-at's hardcoded `+ 1.0` (World.ts:3679, ABOVE a 1.2 m child's sternum) — both must scale or the child gets framed like a hobbit under an adult lens and the D1.5 fade tests the wrong heights; and the warden reads GHOST-WHITE at range in fresh `p15b-jeep-01` (a distance/LOD fade) — stage the pair shot close enough that he reads solid. Poort-audit #4 (2026-07-11): land D1.7 (title-return invisible ranger — rendered-opacity hook + skinned-bounds truth) BEFORE this rescale: resizing the player rig re-measures `avatarTopY` and rebuilds the skinned-mesh bounds, exactly the machinery D1.7 repairs, and the pair-shot assert needs D1.7's rendered-opacity hook to prove the child rig actually RENDERS at snap (the warden ghost-fade + the invisible-ranger family would otherwise fake a pass). · verify-by: assert (idle `avatar.height` ∈ [1.1, 1.35]; the warden ∈ [1.7, 1.9]; Alvah < 0.75 × the warden; drawCalls <150) + shot (Alvah beside the warden at the hub reads unmistakably as a child next to an adult; the title frame + one d13-*-entry frame re-read at child scale — all currently show adult scale).

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~18%
⚠ blocker: Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.
```

---
**2026-07-12 02:44:45Z** · ticked: - [x] P1.6b · Alvah's face is Alvah's: blonde hair + blue eyes [both] +demo — the real Alvah is blonde, wavy-haired, blue-eyed (reference: `public/img/Alvah.jpg`); the current `ranger-alvah` model is dark-haired + green-eyed (`app/assets-gen/ranger-alvah.png`) — wrong. Make hair read blonde + wavy and eyes clear blue, keeping the calm never-scary stylized look + the green ranger jacket. If regenerating via Meshy: `node scripts/meshy-gen.mjs --only=ranger-alvah` with a prompt citing the reference (log the credit spend); else recolour the hair/iris materials in-repo (cheaper, no credits). Keep the avatar-creator + `alvah-ef-v1` persistence intact. Poort-audit note (2026-07-11): the judged surfaces are the fresh `01-title` (close range — the dark aubergine hair is unmistakable there today) AND any d13-*-entry frame (follow distance) — the blonde must read at BOTH ranges under the golden key (warm light shifts hue: aim for a read of blond, not oranje); if recolouring in-repo, swap the hair mesh material + iris texture and keep every avatar-creator option working. Poort-audit #2 (2026-07-11): fresh `02-avatar` shows the creator live with preset chips (Alvah · Bo · Robin · Sam · Veer) + huid/haar swatch rows — the fix must turn the ALVAH preset AND the shipped default blonde-wavy + blue-eyed so the creator PREVIEW and the world model both read blonde, while every other preset/swatch keeps working; the current preview is dark-aubergine. Poort-audit #3: fresh `15-camera-zoom-in` is the closest hair read in the whole set (fills the frame with the aubergine crown) — add it to the judged surfaces (title close-up · zoom-in · one d13-*-entry at follow distance). · verify-by: shot (title + world ranger: hair reads blonde, eyes read blue, resembles public/img/Alvah.jpg) + assert (drawCalls <150; calm never-scary pose). +demo: Floris confirms it looks like Alvah on the real iPad.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~19%
⚠ blocker: Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.
```
