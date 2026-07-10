# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [RUN-D-LEDGER.md](RUN-D-LEDGER.md); this is the at-a-glance view.

- **Ledger:** RUN-D-LEDGER.md
- **Phase:** Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
- **Progress:** ~13% (weighted by ledger items)
- **Just landed:** D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
- **Next up:** DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
- **Last heartbeat:** 2026-07-10 19:50:03Z
- **Blocker:** Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.


> **NEEDS-FLORIS:** Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.

```
✔ landed: D0.2 · DIRECTION · validate + refine RUN-D-DIRECTION.md + this ledger against the animation/physics deep-research
▶ phase:  Phase 1 · PLAYABILITY FIRST — correctness before any more polish  (Floris demo 2026-07-05: sank through floor · jeep sticks-and-slides · cannot enter heli)
→ next:   DEFERRED · D1.0 · Capture harness fit for Run D: green inside its budget + honest evidence [laptop] (from Run C P1.10/P1.15 capture legs; re-verified 2026-07-05: the "audit capture flow" test timed out at its 30-min cap at 11:27 — the `ven` group + a transient newPage protocol error — and the `40–44 game3d-*` frames shoot `/?sandbox`, NOT the mission path the player reaches, while orphan PNGs from older shot-numbering runs still sit beside fresh ones under `laptop/`). This box is harness-only (`app/e2e-capture/`), no game code, and lands FIRST because every Phase-1 drive-burst box adds scenes to this harness: (a) bound/isolate the slow groups so the whole capture finishes green inside the budget, with a retry on the newPage protocol error; (b) shoot each of the 5 games' 3D surface on the player-reachable mission path (not the sandbox), keeping the five 2D-floor frames; (c) make capture REMOVE orphan PNGs not present in the fresh annotations. Verify by: `npm run capture` exits green with all groups complete; fresh set contains named player-path frames for all five games ×{3D, 2D floor} with per-frame `drawCalls` <150; every PNG under `laptop/` matches a shot in `annotations-laptop.json`.
▤ ledger: RUN-D-LEDGER.md
▷ progress: ~13%
⚠ blocker: Run C gereconcilieerd naar Run D (2026-07-05). Launch: run-d-loop.sh — zie runs/run-5-cohesion/.
```
