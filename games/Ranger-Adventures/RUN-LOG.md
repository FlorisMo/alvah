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
