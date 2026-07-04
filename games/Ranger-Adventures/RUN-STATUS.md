# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [BUILD-LEDGER.md](BUILD-LEDGER.md); this is the at-a-glance view.

- **Ledger:** BUILD-LEDGER.md
- **Phase:** Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
- **Progress:** ~76% (weighted by ledger items)
- **Just landed:** P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
- **Next up:** P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
- **Last heartbeat:** 2026-07-04 20:09:00Z
- **Blocker:** Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.


> **NEEDS-FLORIS:** Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.

```
✔ landed: P0.1 · Archive the Run A evidence BEFORE any new capture. `audit-evidence/{laptop,ipad,crops}/*.png` + `annotations-*.json` are git-IGNORED and the first `npm run capture` overwrites them (§3 substrate rule; §9 A6). Copy the whole current `audit-evidence/` to `audit-evidence-baseline-run-a/` and git-add the annotations + a README so the frames F-01..F-34 cite survive. Verify by: the baseline folder holds the Run A PNGs + both annotations; nothing captured yet.
▶ phase:  Phase 0 · protect + see  (NO game code — `app/e2e-capture/**` + copies only)
→ next:   P0.2 · DEFERRED (iPad) · F-21 · harden the capture harness. Parked while Run B is laptop-only (the iPad software-render hang is exactly F-21's own suspected cause). The scene-isolation + crash-retry parts already landed in `app/e2e-capture/capture.spec.ts` and help the laptop run too; the iPad touch-driving + a real fix for the render hang wait until `CAPTURE_PROJECTS=laptop,ipad` is re-enabled. Until then iPad is verified in the Floris demo. Loop skips this box.
▤ ledger: BUILD-LEDGER.md
▷ progress: ~76%
⚠ blocker: Run B stalled on: P1.1 · **F-07 · normalize the avatar to ~1.7 m [both]** (highest-leverage fix — lands FIRST; F-05's clamp + F-08's speed depend on final scale). Scale the loaded rig/wrapper, NOT the camera; expose `avatar.height` on the dev hook. **Verify by:** shot (ranger reads believable next to tree/hut) + assert (`avatar.height` ∈ [1.5, 2.0]).. Check BUILD-RUN-LOOP.log + audit-evidence/.
```
