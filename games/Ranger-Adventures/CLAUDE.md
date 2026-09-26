# Working on Ranger van de Veluwe

Read in this order: [GOAL.md](GOAL.md) (the end goal) → [STATE.md](STATE.md) (what works
today) → [ARCHITECTURE.md](ARCHITECTURE.md) if present (where the code lives). The repo-root
`CLAUDE.md` (Alvah's site rules: no surnames, no trackers) also applies.

## Run it

```bash
cd games/Ranger-Adventures/app
npm install                                  # once
npx vite --port <your-port> --strictPort     # http://localhost:<port>/?dev=1
npx tsc --noEmit && npm test                 # typecheck + unit tests (seconds)
RANGER_PORT=<your-port> npm run e2e:smoke    # browser smoke
```

- **Pick your own port** and pass it as `RANGER_PORT` to every Playwright command. The
  configs reuse a server that is already running on their port, so a shared port tests
  somebody else's code.
- Headless Chromium needs the real GPU or the world crawls:
  `args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']`.
- `?dev=1` exposes `window.__ranger` (see `app/src/core/devhook.ts`): read state with it
  (screen, pos, grounded, vehicle, markers ...). **Never use it to win or skip a step** in
  anything that claims the game is playable.
- Fresh save = fresh browser context (localStorage key `alvah-ef-v1`). First boot:
  *Begin* → avatar creator → *Dit is mijn ranger* → world.

## Rules learned the hard way (five earlier runs failed on these)

1. **Play it.** Judge by what a player sees and does: real keys, real mouse clicks,
   screenshots you actually look at. Dev-hook numbers are supporting evidence, not proof.
2. **Fix at the root, and delete the workarounds in the same commit.** The mirrored
   terrain survived for weeks because each consumer got its own offset.
3. **Test where the player really goes** (the mission marker on a slope), not a flat
   test spot or a `?sandbox` shortcut.
4. **No tooling or process work unless it serves the golden path.** Earlier runs spent
   their time on capture harnesses and ledgers while the game stayed unplayable.
5. **Parallel work:** one git worktree and one port per agent; commit small and often on
   your own branch; screenshots go in a scratch folder outside the repo, never committed.
6. **STATE.md is written by hand after playing**, with the date and how you verified it.
   Never auto-generate it.

## Alvah's contracts (never trade these away)

Calm camera (fixed FOV, roll 0, no shake/snap; reduced-motion = cuts) · never scary,
never game-over · Dutch text at AVI M3/E3, ≤7 words per line, read-aloud on new strings ·
targets ≥56 px · <150 draw calls · laptop first, iPad must keep working · save data only
via `core/state.ts` + `core/persist.ts` under `alvah-ef-v1` · assets via `assetUrl` ·
no new runtime dependencies without Floris · no surnames · never print `.env.local`.
