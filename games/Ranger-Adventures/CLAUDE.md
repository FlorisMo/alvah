# Working on Ranger van de Veluwe

Read in this order: [GOAL.md](GOAL.md) (the end goal) → [STATE.md](STATE.md) (what works
today) → [ARCHITECTURE.md](ARCHITECTURE.md) if present (where the code lives). The repo-root
`CLAUDE.md` (Alvah's site rules: no surnames, no trackers) also applies.

## Run it

```bash
cd games/Ranger-Adventures/app
npm install                                # once
npx vite --port <your-port> --strictPort   # play it yourself: http://localhost:<port>/?dev=1
RANGER_PORT=<your-port> npm run gate       # tsc + unit tests + browser @smoke (~1 min)
RANGER_PORT=<your-port> npm run golden     # THE check: plays GOAL.md 1-8 like a player (~2-3 min)
```

- **`npm run golden`** (`app/e2e/golden.spec.ts`) plays the golden path with a fresh save
  at 1280×800: mouse on *Begin*, the maker's swatches, arrow keys to walk, W to drive the
  jeep, on foot to the HUD's mission marker, and every mini-game step with the REAL mouse.
  It ends with a table `step | result | note`: `✗✗` = the player is blocked there (the run
  stopped), `✗` = a quality failure (the run went on), with the measured numbers. The
  screenshot of every step is in `app/test-results/golden/NN-<step>.png` (+ `SUMMARY.txt`):
  **look at them** (the next Playwright run, e.g. `npm run gate`, clears `test-results/`).
  A step counts as working only when golden passes AND its screenshot looks right. Don't
  edit `src/` while it runs: Vite reloads the page and golden stops ("reloaded by itself").
- **3D mini-games must say where a perfect player clicks next**: each engine calls
  `registerPlayHint(() => ({ id, target }))` (`src/render3d/play/kit.ts`) with the object
  to click now, or `null` while it takes no input (a sequence being shown). Golden clicks
  its projected centre with `page.mouse.click` and checks it is on screen, the first thing
  a camera ray hits, and standing on the rendered ground. No hint = golden stops at that
  game. Choice rounds with DOM buttons need no hint: golden clicks the option marked
  `goed` in the content, found by the question on screen.
- **Pick your own port** and pass it as `RANGER_PORT` to every Playwright command. The
  configs reuse a server that is already running on their port (and start one if none
  is), so a shared port tests somebody else's code.
- Local Playwright runs get the real-GPU args from `playwright.config.ts`
  (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`); without them headless
  Chromium silently renders in software and the world crawls. CI keeps SwiftShader and
  runs `npm run e2e:smoke` only. Your own scripts need the same args.
- `?dev=1` exposes `window.__ranger` (`app/src/core/devhook.ts`) for READING state:
  `screen`, `pos()`, `cam()`, `grounded()`, `vehicle()`, `markers()`, `nearId()`,
  `drawCalls()`, `tris()`, `playHint()`, `groundAt(x,z)` (the rendered terrain height),
  `seating(x,z,r)` (everything near a spot with its gap to the ground; the player's own
  ranger and roaming animals carry `moves`, so leave them out of any "did the world
  change?" compare), `screenOf(x,y,z)`.
  **Never use it to win or skip a step** (`winStep()` exists for old specs only) in
  anything that claims the game is playable.
- Fresh save = fresh browser context (localStorage key `alvah-ef-v1`). First boot:
  *Begin* → avatar creator → *Dit is mijn ranger* → world.
- Other suites: `npm run e2e` (everything, slow; several older specs still win through
  `winStep()`), `npm run e2e:webkit` (the iPad engine, smoke only),
  `npm run e2e:preview` (the shipped build, after a root `npm run build`).

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
