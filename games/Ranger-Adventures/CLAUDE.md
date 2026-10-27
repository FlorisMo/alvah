# Working on Ranger van de Veluwe

Read in this order: [GOAL.md](GOAL.md) (the end goal) → [STATE.md](STATE.md) (what works
today) → [ARCHITECTURE.md](ARCHITECTURE.md) if present (where the code lives). The repo-root
`CLAUDE.md` (Alvah's site rules: no surnames, no trackers) also applies.

## Run it

```bash
cd games/Ranger-Adventures/app
npm install                                # once
npx vite --port <your-port> --strictPort   # play it yourself: http://localhost:<port>/?dev=1
RANGER_PORT=<your-port> npm run gate       # tsc + unit tests + browser @smoke (~0.5-2 min: slower when other agents load the machine)
RANGER_PORT=<your-port> npm run golden     # THE check: plays GOAL.md 1-8 like a player (~3-4 min)
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
  Chromium silently renders in software and the world crawls. Your own scripts need the
  same args. Local runs use at most 2 workers (each boots a world on the one GPU).
- **CI** (the deploy gate, `.github/workflows/deploy.yml`) runs `npm run e2e:smoke` only:
  headless Chromium on SwiftShader (software GL, no GPU), against the production build
  (`vite build` + `vite preview`, so the smoke opens `/?dev=1`). The game detects
  software GL and boots a **light mode** there: no MSAA, pixelRatio 1, the `laag` tier,
  no shadow pass, and a boot veil that lifts after at most ~2 s (the title is that light world)
  (`core/quality.ts`; `?light=1` shows it on your GPU, `?light=0` refuses it). A GPU
  never gets it. Before you push a change to boot, the title or the first walk, run it
  the CI way: `CI=1 RANGER_PORT=<port> npm run e2e:smoke` (1.5-4 min; stop your own
  server on that port first: CI mode always builds and serves a fresh one). A smoke that
  waits for the game to act counts rendered frames (`__ranger.frames()`), not seconds:
  under software GL every frame, and every Playwright click, is slow.
- `?dev=1` exposes `window.__ranger` (`app/src/core/devhook.ts`) for READING state:
  `screen`, `pos()`, `cam()`, `grounded()`, `vehicle()`, `markers()`, `nearId()`,
  `drawCalls()`, `tris()`, `frames()` (rendered frames), `renderMode()` (light mode +
  GL renderer), `playHint()`, `groundAt(x,z)` (the rendered terrain height),
  `seating(x,z,r)` (everything near a spot with its gap to the ground; the player's own
  ranger and roaming animals carry `moves`, so leave them out of any "did the world
  change?" compare), `screenOf(x,y,z)`.
  **Never use it to win or skip a step** (`winStep()` exists for old specs only) in
  anything that claims the game is playable.
- Fresh save = fresh browser context (localStorage key `alvah-ef-v1`). First boot:
  *Begin* → avatar creator → *Dit is mijn ranger* → world.
- Other suites: `npm run e2e` (everything; `--project=chromium` for the laptop engine
  only; ~22 min at 2 workers, the ten missions are most of it; several older specs still win through
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
never game-over · Dutch text at AVI M3/E3, ≤7 words per line, read-aloud on new strings in Benjamin's
recorded voice (record them with `npm run voice`, see below) ·
targets ≥56 px · <150 draw calls · laptop first, iPad must keep working · save data only
via `core/state.ts` + `core/persist.ts` under `alvah-ef-v1` · assets via `assetUrl` ·
no new runtime dependencies without Floris · no surnames · never print `.env.local`.

## Benjamin's voice: every spoken word

The mentor is **Benjamin** (he was Bram until 2026-10-27; the save key `geleerd.bram`
keeps the old name on purpose). Everything read aloud is Benjamin's recorded ElevenLabs
voice (id `squHBnETMVeVdrDpROKa`, `core/voice.ts#VOICE`), never the browser's voice and
never another ElevenLabs voice. How it works: ARCHITECTURE.md, "Benjamin's voice".

- **New or changed spoken words → record them in the same change.** Play them (or run
  the e2e specs) against the dev server, then from `app/`:
  `npm run voice` (dry run: what is missing, how many characters) and
  `npm run voice -- --go` (records into `public/voice/`). Commit the clips with the words.
  A sentence without a clip is said in the browser's robot voice: that is the bug to fix.
- The key is `ELEVENLABS_API_KEY` in `app/.env.local`; it is billed per character, so
  run the dry run first and tell Floris the count before recording thousands.
- Never test "is the voice talking" with `speechSynthesis`: ask `narrator.busy()`.

