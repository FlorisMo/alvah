# Ranger Adventures

**"Ranger van de Veluwe"** — a story layer wrapping Alvah's five executive-function
mini-games as ranger missions on the Veluwe. Lives **outside** `src/` so the Astro
build never picks it up until it's deliberately integrated. The game is deployed to
alvah.nl/ranger behind the client-side gate.

## Layout

- **[app/](app/)** — the actual game (vanilla three.js + Vite + TS, no React). The
  live code. `app/scripts/ranger-run.mjs` is the shared run tick-engine.
- **[runs/](runs/)** — one folder per autonomous run:
  - **[runs/run-1-build/](runs/run-1-build/)** — ARCHIVE. First run (June 2026):
    procedural world + 5 EF mini-games, verified by unit tests only. Do not re-tick.
  - **[runs/run-2-world/](runs/run-2-world/)** — ARCHIVE. Second run (2026-07):
    one immersive 3D open world, W0–W7.4 built + deployed (`2.1.0-ship`). Verified
    mechanically (Playwright), which is exactly why the visuals/controls need run 3.
    Contains WORLD-PLAN, WORLD-LEDGER, the supervisor scripts, and `qa-evidence-2/`.
  - **[runs/run-3-ux-polish/](runs/run-3-ux-polish/)** — ACTIVE. The UX / look-and-feel
    / controls pass. **Start at [FINDINGS.md](runs/run-3-ux-polish/FINDINGS.md)**;
    the setup prompt for the next thread is [HANDOFF.md](runs/run-3-ux-polish/HANDOFF.md).
- **[docs/](docs/)** — cross-run reference: [GAMEPLAN.md](docs/GAMEPLAN.md) (master
  orientation), [DEMO-SANDBOX.md](docs/DEMO-SANDBOX.md), [SETUP-realism-keys.md](docs/SETUP-realism-keys.md).
- **[research/](research/)** — verified knowledge base (biology, EF science, 3D specs,
  animal-accuracy dossiers). Keep forever.
- **[design/](design/)** — brief, craft bible, handoff + UI mockups.
- **[prototype/](prototype/)** — the runnable Claude Design hand-off. ⚠️ holds private
  likeness photos; see GAMEPLAN §6 before committing.
- **design-mock-up/** — inbox for the next Claude Design export.
- **[life-areas/](life-areas/)** — separate sub-project (game-design catalogue). Not
  part of the Ranger run pipeline.

> Note: the archived run-1/run-2 `.sh` supervisor scripts assumed a top-level home;
> after this reorg their relative paths are stale — treat them as pattern references.
> The game (`app/`) and the tick-engine (`app/scripts/ranger-run.mjs`) are unaffected.
