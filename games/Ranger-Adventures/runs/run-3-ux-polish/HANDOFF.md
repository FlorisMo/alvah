# Run 3 — handoff prompt for the next Opus setup thread

> Paste the block below into a fresh Opus thread in the alvah repo. It is a
> SETUP/PREP thread (interactive, like the run-2 prep), NOT the autonomous run
> itself. Its job: pressure-test the plan and build the scaffolding for a
> headless, Fable-driven **audit-only** run + a screenshot harness. It should
> leave the actual UX/design decisions to Fable.

---

You are setting up **run 3 (UX / polish)** of "Ranger van de Veluwe" in the alvah
repo (`/Users/florismoerkamp/Code/alvah`). The game lives in
`games/Ranger-Adventures/app` (vanilla three.js + Vite + TS, no React), deployed
to alvah.nl/ranger behind a client-side gate. This is an interactive SETUP
thread with Floris (a non-developer parent) — give complete copy-paste commands,
explain each in one line, lead with outcomes. Do NOT start fixing the game.

## 0. Orient (read, don't skim)
- `games/Ranger-Adventures/runs/run-3-ux-polish/FINDINGS.md` — why run 3 exists,
  the punch-list from Floris's play, the root cause, what stills can/can't prove,
  the agreed shape, and the frozen contracts. START HERE.
- `games/Ranger-Adventures/runs/run-2-world/WORLD-PLAN.md` — the master spec run
  2 built against (constraints, camera law, §10 findings). Reference only.
- root `CLAUDE.md` — repo rules (no surnames, no third-party scripts, gate, etc.).
- The run-2 tooling is archived under `runs/run-2-world/` (world-run-loop.sh,
  watch.sh) and `app/scripts/ranger-run.mjs` (the tick engine). NOTE: the moved
  `.sh` scripts have stale `dirname/../..` paths from when they lived at the
  top level — treat them as PATTERN references, not runnable in place.

## 1. Non-negotiables to carry forward
- **BOTH iPad (touch) AND laptop (mouse/trackpad/keyboard) are first-class.**
  Trackpad zoom + camera orbit on laptop is an explicit requirement. Every
  capture and every acceptance check happens on both form factors.
- **The lesson of run 2:** a mechanical gate that never LOOKS at the screen
  ships a huge avatar and a gliding capsule. Run 3's whole point is a
  **screenshot-in-the-loop visual gate**. Do not rebuild the mechanics-only gate.
- Preserve the frozen contracts (FINDINGS.md last section): motion-comfort
  camera law, never-scary/never game-over, ≥56 px, <150 draw calls,
  `alvah-ef-v1` ranger namespace only, no new deps without Floris's OK, never
  print `.env.local` values.
- **Honesty contract:** anything a screenshot cannot prove (smoothness, latency,
  motion comfort) must be flagged "needs Floris demo", never claimed as fixed.

## 2. First, audit the plan (don't just accept it)
Pressure-test the shape in FINDINGS.md §"agreed shape". Is audit→review→build
the right split? Is Fable-as-judge + Opus-as-builder right? What's the cheapest
way to capture screenshots (a plain Playwright script needs NO model to press the
shutter — reserve Fable's expensive multimodal judgement for the critique)? Are
walk-bursts enough to catch gliding, or do we need a short video/GIF the model
can step through? Bring Floris the improved plan before building scaffolding.

## 3. Build the scaffolding for a headless Fable AUDIT-ONLY run
Leave the design decisions to Fable — you build the machine, not the verdicts.
- **Screenshot/capture harness:** boots the real game (not sandbox), walks the
  actual player flow, and captures EVERY screen + key state (title, avatar,
  world entry, walking [burst of ≥3 frames], mission board, a mission, jeep
  in/out + driving [burst], hub/pause, Reduce-Motion both states) at BOTH an
  iPad viewport (touch) and a laptop viewport (mouse/trackpad/keyboard). Output
  a contact sheet into a run-3 evidence folder. Capture should be scripted /
  cheap — no expensive model needed to run it. Setting this up now is welcome.
- **Audit ledger / plan format:** a structure Fable fills where each finding
  carries: defect · evidence screenshot path · concrete fix · verification
  method (screenshot / E2E assert / needs-demo) · **platform (iPad/laptop/both)**
  · confidence. The audit run changes NO game code — it only produces this plan.
- **The autonomous loop + Fable run prompt:** mirror the run-2 supervisor
  pattern (a bash loop that re-invokes fresh headless sittings against a ledger),
  but the model is **Fable** (`--model claude-fable-5`) and the task is
  AUDIT-ONLY. End the run with a deep self-audit of the plan ("if every item is
  done, will visuals + controls on both platforms actually pass? what's
  missing?").
- Keep Run B (the Opus BUILD run that executes the approved plan with a
  screenshot-in-loop gate) as a documented next step; you don't have to build
  its full harness yet, but note how it reuses the capture harness.

## 4. Deliverables of THIS thread
1. The improved run-3 plan (reviewed with Floris).
2. A working screenshot/capture harness (both form factors) + a sample contact
   sheet so Floris can see what Fable will look at.
3. The audit ledger format + the Fable audit-run loop script + run prompt, ready
   to launch headless.
4. A one-paragraph "how to start / watch / pause the run" for Floris, with
   complete copy-paste commands from a fresh terminal.

Do the planning + scaffolding. Do NOT change game code or launch the full run
without Floris's go-ahead.
