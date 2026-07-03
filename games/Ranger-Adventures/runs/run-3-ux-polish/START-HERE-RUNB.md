# Run 3 · Run B — start / watch / pause (for Floris)

Short version: **Run A (Fable) looked at the game and wrote the punch-list. Run B
(Opus) now FIXES it — one item at a time, checking its own screenshot each step,
and pausing at every phase so a second AI (Fable) re-checks the pictures before
anything counts as done.** You launch it, watch it, and pause it whenever you
like. Nothing is "fixed" on feel/comfort until YOU accept it on the iPad.

Everything runs from the repo. Open Terminal:

```bash
cd ~/Code/alvah
```

---

## 1. Launch Run B

One command. Leave it running; it keeps the Mac awake and works down the list on
its own.

```bash
cd ~/Code/alvah
EFFORT=max caffeinate -dimsu bash games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh
```

- `EFFORT=max` = the most careful builder (slower/pricier). Drop it for a faster
  default.
- `caffeinate -dimsu` keeps the Mac awake for the whole run.
- **The very FIRST thing it does is save a copy of Run A's screenshots** (into
  `audit-evidence-baseline-run-a/`) so the evidence Fable judged can never be
  lost when the builder takes fresh screenshots. Then it hardens the screenshot
  tool, then it starts fixing — biggest root cause first (the giant avatar).

You don't need a separate "take screenshots" step like Run A had — Run B takes
its own fresh screenshots after every fix.

---

## 2. Watch it live

In a second Terminal tab:

```bash
tail -f ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-RUN-LOOP.log
```

Two more ways to see progress any time:

- **The checklist** — ticked boxes = done. Open
  `games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-LEDGER.md`.
- **The fresh screenshots** — what the builder is actually seeing:
  ```bash
  open ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/index.html
  ```

**How the two-AI check works:** the builder (Opus) fixes an item and only ticks
it if its own fresh screenshot looks right AND the automatic tests stay green.
At the end of each *phase*, an independent Fable sitting re-takes the pictures
and re-judges them — and can **re-open** any box it thinks still looks wrong. A
box only stays done when both agree. Then that phase is committed and pushed.

---

## 3. Pause / resume

- **Pause:** press `Ctrl-C` in the tab running the loop. Fixes already ticked
  and committed are safe; a half-done item just isn't ticked yet.
- **Resume:** run the same `caffeinate … build-run-loop.sh` line again — it
  picks up at the first unticked box.

If the same item fails three sittings in a row, the loop **pauses itself** and
writes a "NEEDS-FLORIS" note in `RUN-STATUS.md` — that means a fix is stuck and
wants your eyes (check the log + the latest screenshots).

---

## 4. What "BUILD-COMPLETE" means

When the log prints **BUILD-COMPLETE**, every fixable item has passed both the
builder's screenshot and Fable's re-judge, on laptop and iPad-viewport, with the
tests green. That is as far as the *machines* can take it.

What is **deliberately NOT** auto-closed — the **DEMO** boxes at the bottom of
the checklist:

- **Motion comfort** — how the walking, driving and reduce-motion actually FEEL.
- **Input feel** — trackpad zoom/orbit, and the touch controls on real glass.
- **Audio** — whether the read-aloud voice actually fires.
- **Real Safari** — the iPad screenshots use the iPad size but Chrome's engine;
  only your real iPad shows true Safari.

These only YOU can sign off, by playing it on the iPad and the laptop. That is
the final gate — the same lesson as run 2's W7.5. Tell me what feels right or
wrong and we go another round.

---

## What each file is

| File | What it is |
|------|-----------|
| `AUDIT-FINDINGS.md` | The punch-list (34 items) Fable wrote in Run A — what Run B fixes. |
| `BUILD-PLAN.md` | The builder's brief: the per-item screenshot gate, the two-AI phase gate, the rules it must not break. |
| `BUILD-LEDGER.md` | **The checklist** — one box per fix, in phase order. Ticks = progress. |
| `build-run-loop.sh` | The loop that runs the builder (Opus) + the phase re-judge (Fable), sitting after sitting. |
| `BUILD-RUN-LOOP.log` | The live log you `tail -f`. |
| `audit-evidence/` | The builder's **fresh** screenshots (rebuilt every fix). |
| `audit-evidence-baseline-run-a/` | The frozen Run A screenshots, saved before Run B touched anything. |
