# HANDOFF — Run C (Ranger van de Veluwe): verify the setup, then stand by

You are a fresh thread with **no prior context**. Read this whole message first — it is self-contained. Your job has three parts, in this order of importance:

1. **Verify** that the Run C autonomous headless setup is correct and safe (read-only checks below).
2. **Launch nothing.** Do not start Run C until **both** are true: (a) Floris explicitly says "go", **and** (b) Run B has fully finished. Until then you touch nothing that runs.
3. **Stay available to Floris.** He is a non-developer parent. Answer in plain language (match his language; he is Dutch). Translate log lines, explain pauses, tell him what to do. No jargon dumps.

---

## The one line on Run C

> **Run C = the Fable-directed "make it beautiful and whole" run.** Fable is the **art director** (proposes the look/story and judges it); Opus is the **builder** (writes the code); reasoning effort **xhigh**; **screenshot-in-the-loop** (every change is judged on a fresh rendered picture, not just "it compiles"); the mandate is **deepen & unify the existing game toward the locked VISION** (no new mini-games, no rebuild); animals are made **realistic** using the full **~7,600 Meshy credits spread wisely** (flagships + raven + player ranger first); there are **NO live checkpoints** — the written direction doc + hard gates carry the weight; and it **runs until it actually hits the weekly Claude limit, then pauses cleanly** (re-launch after the window resets), plus it pauses new-asset work when Meshy credits run low — never a hard block or overspend.

It is a deliberate mirror of the **proven** Run B machinery: `games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh` (the supervisor pattern) and `games/Ranger-Adventures/app/scripts/ranger-run.mjs` (tick/commit/status, mechanically gated on build + e2e:smoke). Run C swaps the roles (Fable directs, Opus builds), adds a direction-doc-first phase, commits every step, and adds the usage/credit stop gate.

---

## Orient yourself — read these first (all read-only)

- `games/Ranger-Adventures/VISION.md` — the locked spec of what "amazing" means here (Alvah first; realistic never-scary animals; deepen & unify; xeno-canto calls only; no live checkpoints; §11 frozen contracts; §13 priority order).
- `games/Ranger-Adventures/runs/run-4-experience/RUN-C-PLAN.md` — the rules of the run (per-box screenshot gate §1, two-judge gate §2, asset + usage discipline §3, frozen contracts §4, prohibitions §6, direction-doc-first §7).
- `games/Ranger-Adventures/runs/run-4-experience/RUN-C-LEDGER.md` — the open-ended cohesion checklist (39 boxes, VISION §13 priority order: P0 direction → P1 art → P2 realistic animals → P3 felt progress → P4 weave orphan systems → P5 deepen + final gate → DEMO section that only Floris can sign off).
- `games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh` — the supervisor loop you will (eventually) launch.
- `games/Ranger-Adventures/runs/run-4-experience/START-HERE-RUNC.md` — the plain-language card written for Floris. When he asks how something works, this is your reference to paraphrase from.
- `games/Ranger-Adventures/app/scripts/usage-guard.mjs` — the pre-flight STOP/GO gate: enforces only what's REAL (the live Meshy balance vs a reserve for asset boxes + an optional session wall-clock). The weekly-limit stop is NOT here — the loop detects a real usage-limit break in each sitting's output and pauses (see the honesty section).
- Reference (the proven originals Run C mirrors): `games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh` and `games/Ranger-Adventures/app/scripts/ranger-run.mjs`.

---

## Ground truth right now: **Run B is LIVE**

At handoff time, Run B (the previous run) is still running headless in the background: `build-run-loop.sh` is an active process, and its `BUILD-LEDGER.md` still has ~35 unchecked boxes. **Run C and Run B share the same screenshot output folder** (`games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/`) and the same git repo, so running them at the same time would corrupt screenshots, double the Claude burn, and race on git. **This is why Run C must not start until Run B is completely done.**

---

## HARD SAFETY RULES (never violate while Run B is live)

- **Do NOT launch anything that runs:** no `run-c-loop.sh`, no `build-run-loop.sh`, no `claude -p`, no `npm run capture`, no dev/preview server.
- **Do NOT touch** anything under `games/Ranger-Adventures/app/src/**` or `app/e2e/**`, and never weaken `app/e2e/**`, the `@smoke` suite, or `playwright.config.ts` (the frozen regression guard).
- **Do NOT git commit or push.** Run B has uncommitted work in the tree; a `git add -A` would sweep it up. The orchestrating thread commits at the end.
- **NEVER print, cat, or echo any `.env.local`.** It holds the Meshy API key. You may say the key "lives in `app/.env.local`" and reference the masked 4-char prefix the guard prints — never the value.
- Read-only shell only (`ls`, `grep`, `cat` of non-secret files, `bash -n`, `node --check`, `pgrep`). Safe to run: `node scripts/usage-guard.mjs --status` from `app/` (read-only — prints a masked Meshy balance + `GO`, changes nothing). The guard no longer counts sittings and has no `--reset`.
- **You MAY edit only Run C's own files** if a fix is needed and Floris approves: `run-c-loop.sh`, `usage-guard.mjs`, `RUN-C-LEDGER.md`, `RUN-C-PLAN.md`, `START-HERE-RUNC.md`, and other files under `runs/run-4-experience/`. These are Run C-only and are **not** read by the live Run B, so editing them is safe. Everything else is off-limits while Run B runs.

---

## VERIFY CHECKLIST (all read-only)

Run these to confirm the setup. Group A is the load-bearing part — the audit found real defects there, so re-check whether they are still present (someone may have patched them since the audit). Report what you find to Floris in plain language.

### Baseline (should pass cleanly)
- **Syntax:** `bash -n games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh` and `node --check games/Ranger-Adventures/app/scripts/usage-guard.mjs` — both silent = OK.
- **Box selection skips DEMO/DEFERRED:** `grep -E '^\s*-\s*\[ \]' games/Ranger-Adventures/runs/run-4-experience/RUN-C-LEDGER.md | grep -vE 'DEMO ·|DEFERRED' | head -1` — the first survivor should be **P0.1 · DIRECTION** (the run's first act writes `RUN-C-DIRECTION.md`).
- **Roles + effort:** in `run-c-loop.sh`, `MODEL_FABLE` = `claude-fable-5` (art director), `MODEL_OPUS` = `opus` (builder), `EFFORT` default `xhigh`. Confirm the dispatch `case` routes `*DIRECTION*` → Fable author, `*GATE-*` → capture + Fable re-judge, else → Opus fix → capture → grade.
- **Frozen contracts carried verbatim:** `RUN-C-PLAN.md §4` and the in-loop prompts list the motion-comfort camera law, never-scary/never-game-over, ≥56 px targets, <150 draw calls, pixelRatio ≤2, `alvah-ef-v1` namespace with no new keys, M3/E3 ≤7-word Dutch + read-aloud, construct-parity + 2D floor, xeno-canto-only audio, no new deps, no surnames, never print `.env.local`.
- **Tick is mechanically gated:** confirm ticks go through `ranger-run.mjs tick` (which refuses unless `npm run build` + `npm run e2e:smoke` pass) with no `--force` bypass; no unfiltered asset pipeline / `npm run finish`.
- **Secret hygiene:** `git ls-files games/Ranger-Adventures/app/.env.local` returns nothing (untracked + gitignored); `grep -rn "env.local" games/Ranger-Adventures/app/scripts/usage-guard.mjs` shows it only ever reads the key and prints a masked 4-char prefix.
- **Guard fail-safe posture (optional):** `node games/Ranger-Adventures/app/scripts/usage-guard.mjs --status` (run from `app/`) prints a status line + `GO` and a masked Meshy balance. Corrupt/missing state → fresh state, no crash; any internal error → STOP (pause, don't spend).

### A. MUST-CONFIRM before any launch (the audit's blocker + majors)

These fail **safe** (they over-stop or leave WIP, they don't overspend or crash), but each one bites the "run long, unattended, overnight" goal. Re-check each; if still present, either fix it in the Run C-only file (with Floris's OK) or tell Floris plainly and treat it as a launch caveat. **Do not launch with an unaddressed blocker.**

1. **RESOLVED (2026-07-03) — Run B interlock now enforced in code.** `run-c-loop.sh` has a PREFLIGHT that refuses to start if `build-run-loop.sh` is running OR `BUILD-LEDGER.md` still has unchecked non-DEMO/DEFERRED boxes, plus a single-instance `mkdir` lock (`.run-c.lock`) against a double launch. **Confirm:** `grep -n 'PREFLIGHT\|pgrep\|RUNC_SKIP_PREFLIGHT\|run-c.lock' games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh` shows the guard. Still confirm Run B is done yourself before saying go (belt and suspenders; recipe below). Override exists (`RUNC_SKIP_PREFLIGHT=1`) but you should never need it.

2. **RESOLVED (2026-07-03) — the fragile log-scan is gone.** The old proxy's guard-side log-scan was removed. The weekly stop is now **per-sitting break-detection in the loop**: after each sitting the supervisor scans only *that sitting's own fresh output* (from a byte offset captured before the sitting) for a real usage-limit phrase, so a stale phrase from a paused session can NOT re-fire on relaunch. No `RUNC_DISABLE_LOGSCAN` needed. **Confirm:** `grep -n 'ACCEPT THE BREAK\|log_off\|usage limit' games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh`.

3. **MAJOR — A low-Meshy STOP strands the credit-free back half.** In `run-c-loop.sh` (~lines 189–195) **any** guard STOP `break`s the whole loop. So if credits run low on the first P2 asset box, the loop stops and P3/P4/P5 (felt-progress, cohesion, reading — mostly credit-free) never run on relaunch. **Check:** does an `--asset` STOP defer/skip the asset box and continue, or break everything? If it breaks: **mitigation without code** — when it pauses on low Meshy, top up credits then relaunch; or Floris can temporarily mark the P2 asset boxes `DEFERRED` so the loop proceeds to P3+. Real fix: on an `--asset` STOP, defer that box and continue; only a Claude/weekly/wall STOP should halt the whole run.

4. **MAJOR — "Commit every step" only covers ticked steps.** The commit at ~line 220 fires only when the ledger's md5 changes. A fix sitting that changes `app/src/**` but fails its grade (no tick) leaves that code **uncommitted** — up to 3 retries of WIP can pile up and be lost on a crash/reboot. **Check:** does the loop ever commit on a non-advancing / stall-pause / STOP-break sitting? If not: acceptable if Floris knows the risk is "a crash loses at most a few sittings of un-ticked (red) work"; the real fix is to commit WIP even when the ledger didn't advance.

5. **MAJOR — The Meshy-reserve pre-check misses P2.8 and P2.9.** The `--asset` flag is set by matching the box's **first line only** (`head -1`), but the `meshy-gen.mjs` token for the two batch boxes P2.8/P2.9 sits on their **second** ledger line, so those two boxes run the guard **without** `--asset` and skip the pre-flight balance STOP. **Check:** confirm which boxes get `--asset` (P2.1–P2.7 do; P2.8/P2.9 don't). Not an overspend hole — `meshy-gen.mjs` still stops reactively on HTTP 402 at true zero — but it defeats a named safety gate for the two widest-spending boxes. One-line fix: broaden the `case` in `run-c-loop.sh` (e.g. add `*story animals*|*World-naturalism*`) or match the `P2.` box-id prefix, or move the `meshy-gen.mjs` token onto the checkbox line in `RUN-C-LEDGER.md`.

### B. Hardening notes (minors — mention to Floris, none block launch on the default config)

- **Meshy reserve fails *open* if the balance endpoint is unreachable** (a `null` read → GO). Documented as defense-in-depth on top of the reactive 402; the 50-credit reserve is a soft buffer, not a hard "never spend past 50" guarantee.
- **`RUNC_WEEKLY_STOP_PCT` isn't clamped to [0,100]** — a negative override would remove the margin. Default (3) is safe; only misconfiguration bites.
- **Partial-strip fail-open** — if someone disables both budgets but leaves log-scan on with a clean log, the guard GOes unbounded. Defaults keep the 400-sitting budget on, so not a live risk.
- **The weekly proxy undercounts ~2×** — it counts one "sitting" per loop iteration, but a work iteration makes **two** `claude -p` calls (fix + grade). So "400 sittings" ≈ ~800 real calls; the live-signal + 8h wall-clock are the real backstops.
- **Fable's judgement of real-money spend is post-hoc** — Opus self-grades each asset before it ticks (credits already spent); Fable re-judges the batch only at GATE-P2, so a rejected model costs more credits to redo.
- **No logical convergence terminator** — Fable may keep appending cohesion boxes; the run otherwise ends only at MAX_RUNS=200 / 400 sittings / 8h wall-clock.
- **The final RUN-C-COMPLETE status card isn't committed** (the loop breaks before the commit step) — cosmetic; the preceding GATE-P5 tick was committed.
- **`md5 -q`** is macOS/BSD-only — fine on this Mac (matches the reference loop), would need `md5sum` on Linux.

---

## Honesty: how the weekly-limit stop actually works (no fake number)

**Run C does NOT predict your weekly usage — because it's not measurable.**
Research (Claude Code docs, the API, `claude --help`) confirms there is no
programmatic way to read your weekly remaining %: rate-limit headers are
minute-level only, `claude usage` doesn't exist, and the Admin usage API needs a
key a personal Max plan lacks. An earlier draft faked a "3% weekly" number from a
sittings count; **that was removed (2026-07-03, Floris's call) in favour of
honesty.** Now it works like this — three layers, all real:

1. **Per-sitting break-detection (the weekly stop):** after each sitting the loop
   scans *that sitting's own fresh output* for a real usage-limit phrase ("usage
   limit reached", "limit will reset", rate-limit / 429…). On a hit it pauses
   cleanly with a NEEDS-FLORIS note. Everything ticked before it is already
   committed; re-launch after the weekly window resets and it continues from the
   next box.
2. **Session wall-clock (real, optional):** an ~8h per-launch cap
   (`RUNC_TIME_BUDGET_SEC`; set 0 to disable) so an unattended run doesn't go
   forever if you have huge headroom. Re-launch to continue.
3. **Meshy credits (real):** the guard queries your live balance and holds a
   reserve before an asset box spends.

Be straight with Floris about the trade-off: this stops **cleanly when it
reaches** the limit, not *before* it. So the one in-flight sitting at the moment
the limit hits can fail and lose its un-ticked work — but that's at most a single
sitting, and the pause message says exactly what happened. All stops are graceful
pauses, never a hard crash.

---

## The "only after Run B finishes" gate — how to check

Before you even consider launching, confirm **all three** agree that Run B is done:

```bash
cd ~/Code/alvah
# 1) No Run B process is running — must print NOTHING:
pgrep -fl build-run-loop.sh
# 2) No unchecked build boxes left (excluding Floris-only DEMO/DEFERRED) — must print NOTHING:
grep -E '^\s*-\s*\[ \]' games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-LEDGER.md | grep -vE 'DEMO ·|DEFERRED'
# 3) The log says it finished — look for BUILD-COMPLETE:
tail -n 20 games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-RUN-LOOP.log
```

If any of the three still shows Run B alive or unfinished, **do not launch** — tell Floris "Run B is still going, we wait." Also confirm no other `run-c-loop.sh` is already running (`pgrep -fl run-c-loop.sh` prints nothing).

---

## Launch / watch / pause (ONLY after Floris says "go" AND Run B is confirmed done)

**Launch** (one command; keeps the Mac awake; `xhigh` is the tuned default for the ~8h run):
```bash
cd ~/Code/alvah
EFFORT=xhigh caffeinate -dimsu bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh
```

**Watch it live** (second Terminal tab):
```bash
tail -f ~/Code/alvah/games/Ranger-Adventures/runs/run-4-experience/RUN-C-LOOP.log
```

**Pause:** press `Ctrl-C` in the loop tab. Everything ticked is already committed; a half-done item just isn't ticked. **Resume:** run the same launch line again — it picks up at the first unticked box. (If it paused on the weekly limit and refuses to resume, see MUST-CONFIRM #2: clear the log or set `RUNC_DISABLE_LOGSCAN=1` for the first relaunch.)

The very first thing the run does is write and commit `RUN-C-DIRECTION.md` (the art director's plan + ranked animal list). Floris should glance at it ~30–45 min in — if it aimed somewhere he'd hate, that's the cheap moment to catch it. The run keeps going either way.

---

## Talking to Floris (he is not a developer)

- Explain in plain language; match his language (Dutch is fine). Paraphrase from `START-HERE-RUNC.md`; don't paste raw logs at him.
- If he asks "is it working / where is it," translate the current ledger + status: `games/Ranger-Adventures/RUN-STATUS.md` (one-glance card), `RUN-C-LEDGER.md` (ticked = done), `RUN-C-LOOP.log` (live).
- A **NEEDS-FLORIS** pause means one of three calm things: near the weekly Claude limit (relaunch after it resets), low Meshy credits (top up, relaunch), or a stuck item three sittings in a row (he can show you the log + latest screenshots). None of these is a crash.
- **RUN-C-COMPLETE** means every buildable item passed both the builder's screenshot and the art director's re-judge, on the laptop, tests green — as far as the machines can take it. The **DEMO** boxes (realism/never-scary on the real iPad, felt progress, motion comfort, audio, real Safari) are his to accept by playing it; no gate can tick those.
- Never share secrets, never launch on your own initiative, never touch `app/src`/`app/e2e`, never commit — the same rules above apply for the whole time you're standing by.

**Your default posture: verify, report plainly, and wait. The only thing that starts Run C is Floris saying "go" with Run B confirmed finished.**
