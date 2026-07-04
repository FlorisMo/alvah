# Run B — deferred boxes (auto-parked after 3 failed sittings)

Boxes the autonomous loop could not pass on its own. Each needs a hands-on look (usually a live-in-browser fix). The scale/camera/spawn ones are the known hard nut.

- **P1.6 · **F-19 · frame the board face on approach [both]** (GATE-P1 triage — ORPHAN: no ledger box owned F-19; its murk half dissolved with F-07/F-05, its framing half is re-proven in fresh pixels: `22-board-affordance` shows the board edge-on at the frame's left edge, face + papers never presented). When the player enters the board's near-radius, gently damp-turn the follow camera so the board's FACE and the ranger are both in shot (player-initiated by walking in; a CUT under reduced-motion), and/or angle the board face toward the natural hub approach. Expose a board-in-frustum boolean on the dev hook. **Verify by:** shot (affordance moment shows the board face + papers readable) + assert (board-in-frustum true while `board.near`).**
  - parked 2026-07-04 03:04:10 · failed its own screenshot grade 3 sittings running
  - evidence: BUILD-RUN-LOOP.log around this time + audit-evidence/laptop/
