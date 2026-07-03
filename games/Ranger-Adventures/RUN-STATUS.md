# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [BUILD-LEDGER.md](BUILD-LEDGER.md); this is the at-a-glance view.

- **Ledger:** BUILD-LEDGER.md
- **Phase:** Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
- **Progress:** ~3% (weighted by ledger items)
- **Just landed:** P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
- **Next up:** P0.2 · F-21 · harden the capture harness [both]. In `app/e2e-capture/` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the iPad board/jeep/steer approach with touch (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. Verify by: shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).
- **Last heartbeat:** 2026-07-03 13:12:10Z
- **Blocker:** Run B stalled on: P0.2 · **F-21 · harden the capture harness [both].** In `app/e2e-capture/**` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the **iPad** board/jeep/steer approach with **touch** (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. **Verify by:** shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).. Check BUILD-RUN-LOOP.log + audit-evidence/.


> **NEEDS-FLORIS:** Run B stalled on: P0.2 · **F-21 · harden the capture harness [both].** In `app/e2e-capture/**` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the **iPad** board/jeep/steer approach with **touch** (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. **Verify by:** shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).. Check BUILD-RUN-LOOP.log + audit-evidence/.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · F-21 · harden the capture harness [both]. In `app/e2e-capture/` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the iPad board/jeep/steer approach with touch (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. Verify by: shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).
▤ ledger: BUILD-LEDGER.md
▷ progress: ~3%
⚠ blocker: Run B stalled on: P0.2 · **F-21 · harden the capture harness [both].** In `app/e2e-capture/**` only: scene-isolated pages/contexts (re-seed the sessionStorage gate + ranger game state per scene group so one renderer death can't erase later scenes); drive the **iPad** board/jeep/steer approach with **touch** (tap-to-walk / joystick), keeping keyboard for the `laptop` project only; one crash-retry per scene. **Verify by:** shot — a capture run completes with board + mission + reduce-motion PNGs present on BOTH projects, iPad locomotion touch-driven (not `page.keyboard`).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```
