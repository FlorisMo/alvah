# Run 4 · Run C — start / watch / pause (for Floris)

Short version: **Run C makes the game beautiful and whole.** A Fable "art
director" AI writes the look-and-feel plan first, then an Opus "builder" AI works
down the list — unifying the art, making the animals realistic, making progress
*felt*, and weaving the loose pieces into one story. It checks its own screenshot
every step, and pauses at every phase so the art director re-checks the pictures
before anything counts as done. It **stops itself** near your weekly Claude limit
and when Meshy credits run low, so it never hard-blocks or overspends. Nothing is
"done" on feel/comfort/sound until **you** accept it on the iPad.

> **START THIS ONLY AFTER RUN B HAS FINISHED.** Run C reuses the same screenshot
> folder as Run B, so let Run B fully complete (its log prints `BUILD-COMPLETE`)
> before launching this. If Run B is still going, wait.

Everything runs from the repo. Open Terminal:

```bash
cd ~/Code/alvah
```

---

## 1. Launch Run C

One command. Leave it running; it keeps the Mac awake and works down the list on
its own.

```bash
cd ~/Code/alvah
EFFORT=xhigh caffeinate -dimsu bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh
```

- `EFFORT=xhigh` = a careful builder tuned for a long (~8 hour) run. This is the
  default for Run C; you don't have to type it, but it's shown so you know.
- `caffeinate -dimsu` keeps the Mac awake for the whole run.
- **The very FIRST thing it does is write `RUN-C-DIRECTION.md`** — the art
  director's plan for how the whole game should look and feel, plus the ranked
  list of which animals get new 3D models first. It commits that immediately.
  **Glance at that file ~30–45 minutes in** (see below). If it aimed somewhere
  you'd hate, we catch it in commit 1 instead of hour 8. You don't have to — the
  run keeps going either way.

It takes its own fresh screenshots after every change; you don't run a separate
screenshot step.

---

## 2. Watch it live

In a second Terminal tab:

```bash
tail -f ~/Code/alvah/games/Ranger-Adventures/runs/run-4-experience/RUN-C-LOOP.log
```

Other ways to see progress any time:

- **The plan** — read the art director's bible once it lands:
  `games/Ranger-Adventures/runs/run-4-experience/RUN-C-DIRECTION.md`.
- **The checklist** — ticked boxes = done:
  `games/Ranger-Adventures/runs/run-4-experience/RUN-C-LEDGER.md`.
- **The status card** — a one-glance snapshot the run keeps fresh:
  `games/Ranger-Adventures/RUN-STATUS.md` (phase · ~% · what's next · any
  blocker).
- **The fresh screenshots** — what the builder is actually seeing:
  ```bash
  open ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/index.html
  ```
  (Run C reuses that folder — Run B's final pictures are the starting point it
  improves on.)

**How the two-AI check works:** the builder (Opus) makes one change and only
ticks it if its own fresh screenshot matches the plan AND the automatic tests
stay green. At the end of each *phase*, the Fable art director re-takes the
pictures, re-judges them, and can **re-open** any box — or **add new ones** it
thinks the world still needs. A box only stays done when both agree. Every step
that moves the checklist is committed and pushed, so nothing is ever lost.

---

## 3. Pause / resume

- **Pause:** press `Ctrl-C` in the tab running the loop. Everything ticked is
  already committed and safe; a half-done item just isn't ticked yet.
- **Resume:** run the same `caffeinate … run-c-loop.sh` line again — it picks up
  at the first unticked box.

**It also pauses itself, on purpose, in three cases** (each writes a
"NEEDS-FLORIS" note in `RUN-STATUS.md`):

1. **Near your weekly Claude limit.** It can't read your exact remaining %
   (Anthropic doesn't expose that), so it uses an honest safety estimate plus a
   live "limit reached" signal and an ~8-hour clock. It stops *before* hitting a
   wall. Re-launch after your weekly window resets and it continues.
2. **Low Meshy credits.** Before making a new 3D animal it checks your Meshy
   balance; if it's below a small reserve it pauses the animal work (the other
   work can still continue on a re-launch). Top up credits, then re-launch.
3. **A stuck item.** If the same box fails three sittings in a row, it pauses so
   a fix that's genuinely stuck gets your eyes (check the log + the latest
   screenshots).

---

## 4. What "RUN-C-COMPLETE" means

When the log prints **RUN-C-COMPLETE**, every buildable item has passed both the
builder's screenshot and the art director's re-judge, on the laptop, with the
tests green. That is as far as the *machines* can take it.

What is **deliberately NOT** auto-closed — the **DEMO** boxes at the bottom of
the checklist, which only **you** can sign off by playing it:

- **Realism + never-scary on the iPad** — do the new animals look real, belong,
  and never scary on real glass?
- **Felt progress** — does finishing a mission changing the world feel rewarding
  and calm?
- **Motion comfort** — how the driving, any new camera moves, and reduce-motion
  actually feel.
- **Audio** — whether the real bird/animal calls and the read-aloud voice fire,
  calm and never startling.
- **Real Safari / iPad** — the screenshots use the iPad size but Chrome's engine;
  only your real iPad shows true Safari.

Play it on the iPad and the laptop, tell me what feels right or wrong, and we go
another round. That final gate is always yours — the same lesson as before.

---

## What each file is

| File | What it is |
|------|-----------|
| `VISION.md` (one level up) | The locked spec — what "amazing" means here (Alvah first). |
| `RUN-C-DIRECTION.md` | **The plan** — the art director's look-and-feel bible + ranked animal list. Written first, then everything converges to it. |
| `RUN-C-PLAN.md` | The rules of the run: the per-item screenshot gate, the two-AI phase gate, the asset + usage discipline, the frozen contracts. |
| `RUN-C-LEDGER.md` | **The checklist** — one box per improvement, in priority order. Open-ended: the art director adds boxes as it goes. |
| `run-c-loop.sh` | The loop that runs the builder (Opus) + the art director (Fable), sitting after sitting, with the usage/credit stop. |
| `RUN-C-LOOP.log` | The live log you `tail -f`. |
| `RUN-C-USAGE-GUARD.log` | The usage/credit guard's own audit trail (what it checked, and why it stopped). |
| `../run-3-ux-polish/audit-evidence/` | The **fresh** screenshots (shared with Run B; rebuilt every change). |

> The stop-gate lives at `games/Ranger-Adventures/app/scripts/usage-guard.mjs`.
> It never prints your API keys — only a masked 4-character prefix.
