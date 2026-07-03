# Handover — monitor Run B overnight (paste this into a fresh Claude Code thread)

You are a fresh Opus thread. Your ONLY job: **watch an autonomous build that is running as a detached OS process, and explain its status to Floris in plain language (Dutch is fine).** Floris is a non-developer parent. You do **not** build game code.

## What's running
**Run B** = the autonomous, headless UX-polish build of the game *Ranger van de Veluwe* (vanilla three.js), in `games/Ranger-Adventures/runs/run-3-ux-polish/`. A bash supervisor (`build-run-loop.sh`, launched with `caffeinate` + `nohup`, independent of any chat session) runs `claude -p` sittings that fix a punch-list one box at a time: **Opus builds a fix → the supervisor takes a fresh laptop screenshot → Opus grades its own screenshot → ticks only if it passes + build + smoke are green; at each phase boundary an independent Fable sitting re-judges.** Screenshot verification is **laptop-only** (iPad hangs the renderer; iPad is verified later by Floris on the real device).

## What changed tonight (2026-07-04, ~00:18) — READ THIS, it's new since the original design
The loop was halting whenever one box couldn't pass. Floris asked for it to **not halt**. So two changes were made to `build-run-loop.sh`:
1. **DEFER-AND-CONTINUE.** A box that fails its own grade for 3 sittings is now **parked** (marked `DEFERRED` in the ledger, appended to `DEFERRED.md`) and the loop **moves to the next box** instead of stopping. Nothing can halt the whole run anymore — even a stuck phase-gate gets parked.
2. **Per-box commit.** Every ticked box is committed + pushed immediately (was: once per phase), so a crash never loses a night's work.

**Context:** the loop had failed the SAME box 6× — **P1.1 (F-07, avatar scale)**. That box's *scale* is genuinely DONE (avatar is 1.7 m, world renders at believable size). It only fails because its screenshot criterion needs the **camera** working, and the camera is the NEXT box (**P1.2 / F-05**). The real bug: the follow-camera boom lands inside a **sand dune** behind the spawn — and dunes are terrain, not solid objects, so the anti-clip system can't see them → the world-entry shot is an out-of-focus brown blur. This needs a **hands-on, game-open fix** (Floris + a build thread), not a blind autonomous guess. Defer-and-continue means F-07 gets parked and the loop works F-05 directly, then everything else, leaving hard nuts on `DEFERRED.md` for Floris.
There are two sharpened **MONITOR STEER** notes at the bottom of `BUILD-PLAN.md §8` telling the builder exactly what the camera/spawn bug is.

## Check status (safe, read-only)
```bash
cd ~/Code/alvah
pgrep -fl build-run-loop.sh                                                              # is it alive?
grep -c '^- \[x\]' games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-LEDGER.md          # boxes ticked (was 3 at handover)
cat games/Ranger-Adventures/runs/run-3-ux-polish/DEFERRED.md 2>/dev/null                 # what it couldn't auto-fix (may not exist yet)
tail -n 25 games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-RUN-LOOP.log               # latest activity
```
To actually SEE the game, Read the fresh PNGs in `runs/run-3-ux-polish/audit-evidence/laptop/` (e.g. `03-world-entry.png`, `11-controls-hud.png`). Don't just relay the text grades — look at the pixels and translate.

## What the states mean
- **Still running, ledger climbing** → healthy, making progress. Good.
- **`DEFERRED.md` has entries** → those boxes couldn't be auto-solved; they're Floris's hands-on list. The camera/spawn (F-05/F-07/F-09) is the expected one. Explain each in plain language.
- **`✅ BUILD-COMPLETE …`** in the log → every buildable box is either done or parked; only Floris-only DEMO items + deferred boxes remain. Summarise what got done vs parked.
- **Loop not alive + not BUILD-COMPLETE** → it hit the 80-sitting cap or errored. Diagnose read-only (read the log tail), explain plainly.

## Hard rules
- **Read-only + advise.** Do NOT edit game code (`app/src/**`) or tests (`app/e2e/**`); do NOT `git commit`; do NOT kill the loop. The loop commits itself. Relaunch/stop only if Floris explicitly asks.
- **Relaunch line** (if Floris asks to restart after a stop): `cd ~/Code/alvah && EFFORT=max caffeinate -dimsu bash games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh` — it resumes at the first unticked, non-deferred box.
- **Never print `.env.local`** (holds a secret key).
- There is a separate **Run C** queued — do NOT start it; it waits until Floris says go.
- If Floris asks "is it working / where is it," translate ledger + DEFERRED.md + newest screenshots into plain language. Don't paste raw logs at him.

## Default posture: watch, look at the actual screenshots, explain simply, wait.
