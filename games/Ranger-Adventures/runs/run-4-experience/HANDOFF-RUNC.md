# HANDOFF — Run C (Ranger van de Veluwe): verify the setup, then stand by

You are a fresh thread with **no prior context**. Read this whole message first — it is self-contained. Your job has three parts, in this order of importance:

1. **Verify** that the Run C autonomous headless setup is correct and safe (read-only checks below).
2. **Launch nothing.** Do not start Run C until **both** are true: (a) Floris explicitly says "go", **and** (b) Run B has fully finished. Until then you touch nothing that runs.
3. **Stay available to Floris.** He is a non-developer parent. Answer in plain language (match his language; he is Dutch). Translate log lines, explain pauses, tell him what to do. No jargon dumps.

---

## The one line on Run C

> **Run C = the Fable-directed "make it beautiful and whole" run.** Fable is the **art director** (proposes the look/story and judges it); Opus is the **builder** (writes the code); reasoning effort **xhigh**; **screenshot-in-the-loop** (every change is judged on a fresh rendered picture, not just "it compiles"); the mandate is **deepen & unify the existing game toward the locked VISION** (no new mini-games, no rebuild); animals are made **realistic** using the full **~7,600 Meshy credits spread wisely** (flagships + raven + player ranger first); there are **NO live checkpoints** — the written direction doc + hard gates carry the weight; and it **stops itself near ~3% of the weekly Claude limit and when Meshy credits run low**, pausing cleanly rather than hard-blocking or overspending.

It is a deliberate mirror of the **proven** Run B machinery: `games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh` (the supervisor pattern) and `games/Ranger-Adventures/app/scripts/ranger-run.mjs` (tick/commit/status, mechanically gated on build + e2e:smoke). Run C swaps the roles (Fable directs, Opus builds), adds a direction-doc-first phase, commits every step, and adds the usage/credit stop gate.

---

## Orient yourself — read these first (all read-only)

- `games/Ranger-Adventures/VISION.md` — the locked spec of what "amazing" means here (Alvah first; realistic never-scary animals; deepen & unify; xeno-canto calls only; no live checkpoints; §11 frozen contracts; §13 priority order).
- `games/Ranger-Adventures/runs/run-4-experience/RUN-C-PLAN.md` — the rules of the run (per-box screenshot gate §1, two-judge gate §2, asset + usage discipline §3, frozen contracts §4, prohibitions §6, direction-doc-first §7).
- `games/Ranger-Adventures/runs/run-4-experience/RUN-C-LEDGER.md` — the open-ended cohesion checklist (39 boxes, VISION §13 priority order: P0 direction → P1 art → P2 realistic animals → P3 felt progress → P4 weave orphan systems → P5 deepen + final gate → DEMO section that only Floris can sign off).
- `games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh` — the supervisor loop you will (eventually) launch.
- `games/Ranger-Adventures/runs/run-4-experience/START-HERE-RUNC.md` — the plain-language card written for Floris. When he asks how something works, this is your reference to paraphrase from.
- `games/Ranger-Adventures/app/scripts/usage-guard.mjs` — the STOP/GO gate the loop runs before every iteration (weekly-usage proxy + live signal + wall-clock, and the real Meshy balance for asset boxes).
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
- Read-only shell only (`ls`, `grep`, `cat` of non-secret files, `bash -n`, `node --check`, `pgrep`). One safe exception: `node scripts/usage-guard.mjs --status` from `app/` is read-only (it prints a masked balance and always GOes, never counts a sitting) — you may run it to sanity-check the guard, but do not run a bare `usage-guard.mjs` (that counts a sitting) or `--reset` (that mutates state).
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

1. **BLOCKER — No code interlock against Run B running.** `run-c-loop.sh` has only a prose "PRE-REQ: Run B is finished" comment (near line 37); there is no preflight that actually checks Run B's process is gone / `BUILD-LEDGER` is clear, and no pidfile/flock to stop a double-launch of Run C. **Check:** `grep -n 'pgrep\|build-run-loop\|BUILD-COMPLETE\|flock\|pidfile' games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh`. If nothing guards it, **you are the interlock** — you must manually confirm Run B is finished (recipe below) before launch, or add a preflight to `run-c-loop.sh` first. This is the single most important thing to get right.

2. **MAJOR — Resume after a weekly-limit pause is fragile.** The guard's log-scan (`usage-guard.mjs`, `loopSignal()`, ~lines 156–169) reads the last ~4000 bytes of the append-only loop log with **no launch-boundary awareness**. A stale "usage limit reached" phrase from the paused session can sit in that tail and re-fire the STOP on the next relaunch — so after the weekly window resets, the run may refuse to auto-resume. **Check:** does `loopSignal()` slice from a launch marker/offset, or just `buf.slice(-4000)`? If it's the naive tail: **workaround** when relaunching after a weekly pause — first clear the log (`: > games/Ranger-Adventures/runs/run-4-experience/RUN-C-LOOP.log`) or set `RUNC_DISABLE_LOGSCAN=1` for that first relaunch. Real fix: scan only bytes written since the current `=== RUN C ... started ===` marker, or rotate the log per launch. Tell Floris this so a "stuck on restart" reads as expected, not broken.

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

## Honesty: is the "stops itself at ~3% weekly" a real measurement?

**No — it is a documented PROXY, not a real reading of your weekly Claude usage.** Be straight with Floris about this. Research (Claude Code docs, the API, `claude --help`) confirms there is **no** programmatic way to read your weekly remaining %: the rate-limit headers are minute-level only, a `claude usage` command does not exist, and the Admin usage API needs a key a personal Max plan doesn't have. So the weekly gate is an honest **three-layer estimate**:

1. **Live signal (real, reactive):** if a sitting actually prints a "usage limit reached"-type phrase into the log, the guard STOPs. This is the truest layer.
2. **Wall-clock backstop (real):** stops after ~8 hours per launch (`RUNC_TIME_BUDGET_SEC`).
3. **Sittings budget (proxy, coarse):** counts sittings in a rolling 7-day window (default 400) and stops when ~3% of that budget is left (≈ at 389/400). **The 400 is an arbitrary safety cap, not 3% of measured usage**, and because of the 2× undercount above it is looser than it reads.

So: "stops near 3% weekly" describes the **intent and margin**, not a precise fraction of your real limit. The load-bearing weekly protection is really the live signal + the 8-hour clock, with the sittings count as a rough cushion. The **Meshy credit** stop, by contrast, **is real** — it queries the live balance and holds a reserve before spending on an asset box. All stops are graceful pauses (a "NEEDS-FLORIS" note), never a hard crash. Tune the proxy to Floris's actual headroom via the `RUNC_*` env vars (lower `RUNC_WEEKLY_SITTINGS_BUDGET` if his Max plan is also used for claude.ai).

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
