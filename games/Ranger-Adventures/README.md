# Ranger Adventures

New, larger game — **"Ranger van de Veluwe"**: a story layer that wraps Alvah's five executive-function
mini-games as ranger missions on the Veluwe. Lives **outside** `src/` so the Astro build never picks it
up until it's deliberately integrated.

**Start with [GAMEPLAN.md](GAMEPLAN.md)** — the master orientation: what the game is, what was handed
over, what we keep, and how it integrates later. Then **[BUILD-PLAN.md](BUILD-PLAN.md)** — the
executable roadmap toward an autonomous build run (resolved decisions, phases, gap analysis).

## Folders
- **[research/](research/)** — verified knowledge base (biology, EF science, 3D specs). Keep forever.
- **[design/](design/)** — brief, gameplan, craft bible, build plan, handoff + UI mockups.
- **[prototype/](prototype/)** — the runnable Claude Design hand-off (code). Kept intact & runnable.
- **design-mock-up/** — inbox: drop the next Claude Design export here, then sort it per GAMEPLAN §3.

> Integration into the site stack (Astro + vanilla CSS, reusing `src/scripts/`) is a later, deliberate
> step — see GAMEPLAN §5 and root `CLAUDE.md`. ⚠️ `prototype/` holds private likeness photos; see
> GAMEPLAN §6 before committing.
