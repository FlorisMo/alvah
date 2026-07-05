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
