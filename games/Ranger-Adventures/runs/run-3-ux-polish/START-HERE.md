# Run 3 — start / watch / pause (for Floris)

Short version: **Run 3 has two runs.** Run A (Fable) *looks* at the game and
writes a punch-list. You read it. Run B (Opus) *fixes* the list, checking its own
screenshots as it goes. This page is the copy-paste for Run A. Nothing here
touches the live site or the game code — Run A only produces a report.

Everything runs from the repo. Open Terminal and start with:

```bash
cd ~/Code/alvah
```

---

## 1. Capture the screenshots (cheap, no AI — ~10–15 min)

This boots the real game and takes a screenshot of every screen on a **laptop**
frame and an **iPad** frame. It writes them to a folder; it does not judge them.

```bash
cd ~/Code/alvah/games/Ranger-Adventures/app
npm run capture
```

When it finishes it prints the path to a **contact sheet**. Open it to see
exactly what Fable will look at:

```bash
open ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/index.html
```

> Re-run `npm run capture` any time — it always rebuilds from the live game.
> The iPad frames use the iPad *size + touch* but the Chrome engine (real Safari
> bus-errors on this Mac), so the true iPad look is still your on-device check.

---

## 2. Run the audit (Fable looks + writes the punch-list)

In a **new** Terminal tab (leave nothing else running), from the repo root:

```bash
cd ~/Code/alvah
EFFORT=max caffeinate -dimsu bash games/Ranger-Adventures/runs/run-3-ux-polish/audit-run-loop.sh
```

- `EFFORT=max` = the most careful critique (slower/pricier). Drop it for the
  `high` default, or use `EFFORT=xhigh` for something in between.
- `caffeinate -dimsu` keeps the Mac awake for the whole run.
- It loops fresh Fable sittings, each looking at a screen group and adding
  findings, until the checklist is done (or it stalls — then it pauses itself).

**Watch it live** in a second tab:

```bash
tail -f ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/AUDIT-RUN-LOOP.log
```

**Pause it:** press `Ctrl-C` in the tab running the loop. **Resume:** run the
same `caffeinate … audit-run-loop.sh` line again — it picks up at the first
unchecked box.

---

## 3. Read the punch-list

When the loop prints `AUDIT-COMPLETE`, the findings are here:

```bash
open ~/Code/alvah/games/Ranger-Adventures/runs/run-3-ux-polish/AUDIT-FINDINGS.md
```

Each finding says: what's wrong · which device · the screenshot · how bad · the
concrete fix · **how we'll prove it's fixed** (a screenshot, an automated check,
or "needs Floris demo" for things only you can feel — smoothness, comfort). The
top of the file has a one-glance table, and the last section is Fable's honest
self-audit ("if all this is done, will it actually be good? what's still
unproven?").

**Then tell me** what you want changed or reprioritised, and we launch **Run B**
(Opus) to actually fix the list — checking its own screenshots each step, and
leaving the "needs Floris demo" items for you to accept on the iPad.

---

## What each file is

| File | What it is |
|------|-----------|
| `FINDINGS.md` | Why run 3 exists — your play-test punch-list + the plan. |
| `AUDIT-PLAN.md` | Fable's brief: what to look at, the finding format, the rules. |
| `AUDIT-LEDGER.md` | The checklist Fable works down (one screen group per box). |
| `AUDIT-FINDINGS.md` | **The report you read.** Filled in by the audit run. |
| `audit-run-loop.sh` | The loop that runs Fable, sitting after sitting. |
| `audit-evidence/` | The screenshots + the contact sheet (rebuilt by `npm run capture`). |
| `../../app/e2e-capture/` | The capture harness (shared with Run B). |
```
