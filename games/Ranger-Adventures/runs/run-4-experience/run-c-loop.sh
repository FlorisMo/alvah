#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — Run 4 · Run C: the FABLE-DIRECTED EXPERIENCE supervisor
# (mirrors build-run-loop.sh, but the ROLES swap per VISION §12: FABLE is the ART
#  DIRECTOR — it proposes AND judges design/story/cohesion and may re-open OR
#  append cohesion boxes each phase — and OPUS is the BUILDER that writes the
#  TypeScript. Same supervisor-owns-capture split + hybrid two-judge gate as Run B.)
#
# The bash loop is the PERSISTENT supervisor; each sitting is one fresh headless
# `claude -p` resuming from RUN-C-LEDGER.md.
#   • a DIRECTION box (`- [ ] … DIRECTION · …`) → a FABLE sitting authors/commits
#     RUN-C-DIRECTION.md (the art-direction bible + felt-progress plan + ranked
#     Meshy asset list). This is the run's FIRST committed act (VISION §10). No
#     capture — there are no new pixels yet, this is the plan.
#   • a WORK box (`- [ ] Pn.m · …`)   → an OPUS sitting makes the code change,
#     the supervisor re-captures, then a second OPUS sitting grades its OWN fresh
#     screenshot against RUN-C-DIRECTION.md + the box's verify-by and ticks ONLY
#     on green (build + e2e:smoke are enforced mechanically by `ranger-run.mjs`).
#   • a GATE box (`- [ ] GATE-Pn · …`) → an independent FABLE (art-director)
#     sitting re-judges the phase's screenshots against the direction doc and
#     either ticks the GATE or RE-OPENS boxes AND/OR APPENDS new cohesion boxes.
#     This is the phase boundary and the SECOND judge of the hybrid gate.
#   • DEMO boxes (`- [ ] DEMO · …`)    → Floris-only (feel / audio / real-device /
#     iPad); the loop never spends a sitting on them.
#
# USAGE / CREDIT STOP GATE (VISION §12, run-C delta 5): before EVERY iteration the
# supervisor runs `node app/scripts/usage-guard.mjs`. It prints GO / STOP and gates
# on (a) a weekly-Claude-usage PROXY (weekly % is not programmatically readable) +
# a live usage-limit signal in this log + a wall-clock backstop, and (b) — for
# asset-gen boxes — the live Meshy credit balance vs a reserve. On STOP the loop
# pauses cleanly with a NEEDS-FLORIS status; re-launching resumes.
#
# COMMIT CADENCE (run-C delta, VISION §10): commit + push EVERY step (finer than
# Run B's per-phase) so any drift is bisectable — the supervisor commits whenever
# the ledger advances (a box ticked, re-opened, or a new cohesion box appended).
#
# PRE-REQ: Run B is FINISHED (this run starts after it). RUN-C-LEDGER.md exists;
#          its FIRST box writes RUN-C-DIRECTION.md.
#
# Usage (from the repo root):
#   bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh          # cap 200, effort xhigh
#   bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh 120      # custom cap
#   EFFORT=xhigh caffeinate -dimsu bash …/run-c-loop.sh                       # keep the Mac awake
# Watch it live in a second terminal:
#   tail -f games/Ranger-Adventures/runs/run-4-experience/RUN-C-LOOP.log
# ───────────────────────────────────────────────────────────────────────────
set -u

# repo root = five levels up from this script (…/runs/run-4-experience/ → repo).
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures/runs/run-4-experience"
LEDGER="$DIR/RUN-C-LEDGER.md"
LOG="$DIR/RUN-C-LOOP.log"
APP="games/Ranger-Adventures/app"

MAX_RUNS="${1:-200}"                        # safety cap — auto-stop after this many sittings
MODEL_OPUS="${MODEL_OPUS:-opus}"            # the BUILDER (writes the TypeScript)
MODEL_FABLE="${MODEL_FABLE:-claude-fable-5}"  # the ART DIRECTOR (proposes + judges)
EFFORT="${EFFORT:-xhigh}"                    # ~8h open-ended run → xhigh balances quality vs throughput
STALL_LIMIT=3                                # consecutive sittings with no ledger change → pause
stall=0

# ranger-run.mjs selects the active ledger via RUN_LEDGER (relative to the game
# dir, .../Ranger-Adventures). Exported so tick/commit/status/gate target RUN-C-LEDGER.
export RUN_LEDGER="runs/run-4-experience/RUN-C-LEDGER.md"

# Run C SCOPE: automated verification is LAPTOP-ONLY — `npm run capture` captures
# the laptop project only (the iPad leg hangs the software renderer, F-21, same as
# Run B). iPad is verified on Floris's real device in the DEMO section.
# Re-enable iPad auto-capture with CAPTURE_PROJECTS="laptop,ipad" once F-21 is fixed.
export CAPTURE_PROJECTS="${CAPTURE_PROJECTS:-laptop}"

# usage-guard inputs: the per-launch wall-clock start + this log to scan for a
# live Claude usage-limit signal. (State + audit files default under app/logs and
# this run dir; see usage-guard.mjs for every knob.)
export RUNC_LOOP_START_EPOCH="$(date +%s)"
export RUNC_LOOP_LOG="$ROOT/$LOG"

# First unchecked WORK/DIRECTION/GATE box. Skips Floris-only DEMO + parked
# DEFERRED boxes FIRST, then takes the first survivor, so a skipped box mid-list
# can't read as "done".
next_work_box() { grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null | grep -vE 'DEMO ·|DEFERRED' | head -1; }
# Any unchecked box at all (incl. DEMO) — to tell "all done" from "demo pending".
any_unchecked()  { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }
# Count of ticked boxes (any) — a rise means the ledger ADVANCED → commit that step.
ticks_done() { grep -c -E '^[[:space:]]*-[[:space:]]*\[[xX]\]' "$LEDGER" 2>/dev/null; }

if [ ! -f "$LEDGER" ]; then
  echo "✗ no RUN-C-LEDGER.md at $LEDGER." | tee -a "$LOG"; exit 1
fi

# ── CAPTURE OWNERSHIP (the run-2 stall fix — carried verbatim) ───────────────
# The supervisor — NOT the model sittings — runs `npm run capture`. A `claude -p`
# sitting can't block for the whole capture, so it used to background it and
# yield, and the box never got graded → the loop stalled. Here the loop blocks on
# capture itself (it has no time limit), then hands the finished shots to a grade
# sitting. Model sittings NEVER run capture.
# NB: the capture output path is hardcoded in app/e2e-capture/** to
# ../runs/run-3-ux-polish/audit-evidence — Run C REUSES that shared evidence dir
# (Run B is finished; its frames are the baseline). Grade/gate sittings read there.
capture_now() {
  echo "  📸 supervisor runs capture (${CAPTURE_PROJECTS}) — $(date '+%T')" | tee -a "$LOG"
  if ( cd "$APP" && npm run capture ) >> "$LOG" 2>&1; then
    echo "  ✓ capture complete $(date '+%T')" | tee -a "$LOG"
  else
    echo "  ⚠ capture exited non-zero — grader may see partial/stale shots (will not tick)" | tee -a "$LOG"
  fi
}

# ── FABLE · the DIRECTION author (Phase 0 — writes RUN-C-DIRECTION.md) ────────
FABLE_DIRECTION_PROMPT='You are the ART DIRECTOR of Ranger van de Veluwe RUN C (Fable-directed EXPERIENCE/POLISH run). Your FIRST act — before any build — is to WRITE and TICK the direction doc (VISION §10). Do it, then STOP.
1) Read IN FULL: games/Ranger-Adventures/VISION.md (the locked vision — Alvah-first; realistic/naturalistic animals; deepen & unify the existing canon; xeno-canto calls only; NO live checkpoints so the doc + hard gates carry the weight), then runs/run-4-experience/RUN-C-PLAN.md and RUN-C-LEDGER.md. Excavate the live canon it names: app/src/content/veluwe.ts (VERHAALBOOG_VELUWE season arc, the 10 missions, the cast, veldnotities), app/src/core/companion.ts (the raven), the 5 EF engines + their story framings (VISION §5), design/ontwerp-brief.md, app/src/core/readlevel.ts. Read app/scripts/asset-shotlist.json for the existing asset ids.
2) WRITE games/Ranger-Adventures/runs/run-4-experience/RUN-C-DIRECTION.md — the single source of truth every later sitting re-reads. It MUST contain: (a) the ART-DIRECTION BIBLE — one naturalistic Veluwe at golden hour, concrete palette/light/material/tree-and-terrain targets that make realistic animals BELONG (VISION §6), screen-by-screen look targets (title → world → case-board → each of the 5 games → pause) so nothing reads as a different game; (b) the FELT-PROGRESS plan — exactly how a completed mission visibly changes the world (VISION §4a gap #1 / §5); (c) the RANKED MESHY ASSET LIST — impact-per-credit order (5 flagships + raven + player ranger FIRST, then other story animals, then world-naturalism assets), each with an existing asset-shotlist id where one exists, a rough credit estimate, and the never-scary/calm-pose note; (d) the per-screen "excellent" bar (VISION §9) as the terminator, and the §13 priority order so an early stop still ships the best 20% first.
3) FROZEN CONTRACTS are inviolable and excellence is pursued WITHIN them (VISION §11): motion-comfort camera law, never-scary/never game-over, ≥56 px targets, <150 draw calls, pixelRatio ≤2, iPad-first, persistence only via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (no new keys), M3/E3 Dutch ≤7 words + read-aloud on new strings, construct-parity + 2D floor per game, assets via assetUrl, no new deps without Floris, no surnames, never print .env.local. Write these into the doc as the guardrails.
4) You change NO game code in this sitting. When the doc is complete, tick the DIRECTION box: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "RUN-C-DIRECTION" (build/e2e:smoke stay green for a docs-only change, so the tick passes). Do NOT commit (the supervisor commits this step). Then STOP.'

# ── OPUS · the FIX half (code change only — no capture, no tick) ─────────────
OPUS_FIX_PROMPT='You are the FIX half of one Ranger van de Veluwe RUN C EXPERIENCE sitting. You are the BUILDER; Fable is the art director. You make the CODE CHANGE for ONE box toward RUN-C-DIRECTION.md. You do NOT screenshot and you do NOT tick — the supervisor runs the capture right after you, and a separate grade sitting judges it. Make the change, then STOP.
1) Read runs/run-4-experience/RUN-C-DIRECTION.md (the art-direction bible + felt-progress plan + ranked asset list — the single source of truth), then RUN-C-PLAN.md (the per-box screenshot gate §1, the hybrid two-judge gate §2, asset discipline §3, frozen contracts §4), then RUN-C-LEDGER.md. Reference the live canon (app/src/content/veluwe.ts, core/companion.ts, the 5 engines) + root CLAUDE.md.
2) Take the FIRST unchecked WORK box (`- [ ] Pn.m …`, NOT a DIRECTION/GATE/DEMO/DEFERRED box). Make the change under app/src/** so that screen/system converges to the direction doc. Expose any dev-hook field the box’s verify-by needs; if the assert needs a new scene/input, extend the capture harness (app/e2e-capture/**) — never the frozen app/e2e/** tree. SCOPE IS LAPTOP-ONLY — make shared-code fixes for "both"/"iPad" boxes but do not chase iPad pixels (iPad is demo-gated).
3) ASSET boxes: generate ONLY the model(s) the box names, ONLY via `node scripts/meshy-gen.mjs --only=<id>` (or `--limit=N`). NEVER an unfiltered assets / meshy-gen / assets:all / ranger-run.mjs run / npm run finish (that would re-buy the whole ~76-item cast). Meshy jobs exceed the 10-min tool ceiling → run them BACKGROUNDED and poll the log; never print .env.local (use scripts/meshy-balance.mjs for the masked balance). Every generated model must clear the SAME bar as any change: pipeline (meshy-gen → gltf-optimize → optimize-animated, <150 draw calls), the never-scary/calm-pose gate, and the screenshot judge (looks-real AND belongs → accept; else reject + regenerate). Log the credit spend for the box.
4) Do NOT run `npm run capture`. Do NOT tick any box. Do NOT commit. The supervisor captures next; a grade sitting decides the tick; the supervisor commits the step.
5) FROZEN CONTRACTS (a change that breaks one is not a fix): motion-comfort camera law (fixed FOV, roll 0, no shake/snap; reduced-motion = cuts; locomotion always allowed), never-scary/never game-over + calm-pose gate, ≥56 px targets, <150 draw calls, pixelRatio ≤2, persistence ONLY via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (NO new localStorage keys), M3/E3 Dutch ≤7 words + read-aloud on new strings, construct-parity + 2D floor per game, assets via assetUrl, no new deps without Floris, no surnames, never print .env.local.
6) NEVER touch/weaken app/e2e/**, the @smoke suite, or playwright.config.ts. Do NOT re-litigate a screen a prior GATE already passed unless THIS box forces it.
Make the change for exactly ONE box, then STOP. If every WORK box is already checked, reply exactly: RUN-C-COMPLETE.'

# ── OPUS · the GRADE half (judge the supervisor’s fresh shots, tick on green) ─
OPUS_GRADE_PROMPT='You are the GRADE half of one Ranger van de Veluwe RUN C EXPERIENCE sitting. The change for the FIRST unchecked WORK box was just made, and the supervisor has ALREADY run a fresh LAPTOP `npm run capture` — the new PNGs + annotations are on disk. Judge them against RUN-C-DIRECTION.md and tick ONLY on green. Do NOT run capture yourself.
1) Read RUN-C-DIRECTION.md (the look/felt-progress/asset targets), RUN-C-PLAN.md §1, and RUN-C-LEDGER.md. Identify the FIRST unchecked WORK box and its verify-by.
2) LOOK with the Read tool at the fresh laptop PNG(s) for that box under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ (the capture harness’s output path — Run C reuses it), and read annotations-laptop.json for the box’s named field. Grade against BOTH the box’s verify-by AND the direction doc’s bar for that screen (on-style + on-story + progress-felt where the box claims it). Pixels outrank the hook: if they disagree, trust the pixels. For an ASSET box, the model must look REAL and BELONG in the world (reject + regenerate if not) and pass the never-scary/calm-pose gate.
3) TICK ONLY ON GREEN. If the laptop screenshot AND the annotation assert both pass AND it meets the direction doc’s bar, tick: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<unique substring of the box text>" (this also refuses unless `npm run build` + the frozen `npm run e2e:smoke` are green). If the box has a +demo component (feel/audio/real-device), tick it but EDIT the box text to append " — implemented, awaiting Floris demo (NOT accepted)". If the grade FAILS, do NOT tick: leave the box open, append one line to RUN-C-PLAN §8 saying what still falls short of the direction doc, and STOP (the loop retries next iteration).
4) Do NOT commit (the supervisor commits the step). NEVER touch app/e2e/**, the @smoke suite, or playwright.config.ts.
Grade this ONE box, then STOP.'

# ── FABLE · the phase-gate re-judge / director (may re-open OR append boxes) ──
FABLE_GATE_PROMPT='You are the ART DIRECTOR and INDEPENDENT phase RE-JUDGE of Ranger van de Veluwe RUN C (hybrid gate — RUN-C-PLAN §2). You did NOT make these changes; do not trust the builder’s self-grade. The supervisor has ALREADY run a fresh LAPTOP capture — the new PNGs + annotations are on disk. Do NOT run capture yourself. You LOOK, rule, and DIRECT.
1) Read RUN-C-DIRECTION.md (your art-direction bible — you may refine it if a screen taught you something, but do not thrash a screen a prior gate already froze), RUN-C-PLAN §2, and RUN-C-LEDGER.md. The FIRST unchecked box is a GATE-Pn box — it names the phase you are judging.
2) LOOK at every laptop screenshot for that phase under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ (Read the PNGs) and read annotations-laptop.json. Judge each phase box against BOTH its verify-by AND the direction doc — cohesion (does it read as ONE naturalistic world?), realism + never-scary of any new animals, felt-progress (does the world visibly react?), legibility + ≥56 px targets, motion-comfort. iPad is demo-gated — judge laptop pixels only.
3) RULE + DIRECT: for each phase box genuinely excellent in the pixels, leave it ticked. For any that still falls short, RE-OPEN it (`- [x]` → `- [ ]`) and append one line to RUN-C-PLAN §8 saying what you see wrong vs the doc. As the DIRECTOR you MAY ALSO APPEND new `- [ ] Pn.m · …` cohesion boxes to this phase (with a verify-by) when the composed world reveals a gap the punch-list missed — the ledger is OPEN-ENDED, converging to the doc’s "excellent per screen" bar, not a fixed list. A +demo box may stay "implemented — awaiting Floris demo" but is NEVER "accepted". Only when you AGREE every non-demo box in the phase meets the bar AND no open box remains, tick the GATE: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<GATE-Pn substring>".
4) On the FINAL gate (GATE-P5): re-judge the WHOLE game against the direction doc — every screenshot-closable box, cohesion across all screens, all five games. This is the last gate before the Floris demo.
5) You change NO game code and never touch app/e2e/**, the @smoke suite, or playwright.config.ts. You only look, edit RUN-C-LEDGER.md ticks/boxes + RUN-C-PLAN §8, and (allowed) refine RUN-C-DIRECTION.md.
Do this ONE gate, then STOP. If it passes you tick it; if you re-open/append boxes you leave the gate unticked so the builder does the work.'

run_fable_direction() {
  claude -p "$FABLE_DIRECTION_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable DIRECTION sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_fix() {
  claude -p "$OPUS_FIX_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus FIX sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_grade() {
  claude -p "$OPUS_GRADE_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus GRADE sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_fable_gate() {
  claude -p "$FABLE_GATE_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable GATE sitting exited non-zero (continuing)" | tee -a "$LOG"
}

echo "=== RUN C experience loop started $(date '+%F %T') · cap ${MAX_RUNS} · build=${MODEL_OPUS} direct/judge=${MODEL_FABLE} · effort ${EFFORT} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_work_box)"
  if [ -z "$box" ]; then
    if [ -n "$(any_unchecked)" ]; then
      echo "✅ RUN-C-COMPLETE — all active experience/gate boxes done. Only Floris-only DEMO + parked DEFERRED (iPad) boxes remain." | tee -a "$LOG"
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C experience phases complete (laptop) — awaiting Floris on-device demo (feel/audio/real-Safari/iPad) + iPad re-enable (DEMO/DEFERRED boxes in RUN-C-LEDGER.md).") >> "$LOG" 2>&1
    else
      echo "🎉 RUN-C-COMPLETE — every box in RUN-C-LEDGER.md is checked (after $((i-1)) sittings)." | tee -a "$LOG"
    fi
    break
  fi

  clean_box="$(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')"

  # ── USAGE / CREDIT STOP GATE (top of every iteration, before any spend) ─────
  # Pass --asset only when the next box generates a Meshy model, so a low balance
  # never blocks the credit-free art-direction / cohesion / reading work.
  guard_flags=""
  case "$box" in
    *[Mm]eshy*|*asset-gen*|*[Gg]enereer*|*[Gg]enerate*model*|*flagship*model*) guard_flags="--asset" ;;
  esac
  guard_out="$( (cd "$APP" && node scripts/usage-guard.mjs $guard_flags) 2>&1 )"; guard_rc=$?
  printf '%s\n' "$guard_out" >> "$LOG"
  if [ "$guard_rc" -ne 0 ]; then
    reason="$(printf '%s\n' "$guard_out" | grep -m1 '^STOP:' | sed 's/^STOP:[[:space:]]*//')"
    [ -z "$reason" ] && reason="usage-guard requested STOP (see RUN-C-USAGE-GUARD.log)"
    echo "⛔ usage-guard STOP — pausing (NEEDS-FLORIS): ${reason}" | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C paused by usage-guard: ${reason}") >> "$LOG" 2>&1
    break
  fi

  ticks_before="$(ticks_done)"
  before="$(md5 -q "$LEDGER")"

  case "$box" in
    *DIRECTION*)
      echo "  ✍ DIRECTION box (Fable authors RUN-C-DIRECTION.md): $clean_box" | tee -a "$LOG"
      run_fable_direction ;;
    *GATE-*)
      echo "  ▷ PHASE GATE (capture → Fable art-director re-judge): $clean_box" | tee -a "$LOG"
      capture_now
      run_fable_gate ;;
    *)
      echo "  ▶ experience box (fix → capture → grade): $clean_box" | tee -a "$LOG"
      run_opus_fix
      capture_now
      run_opus_grade ;;
  esac

  after="$(md5 -q "$LEDGER")"
  ticks_after="$(ticks_done)"

  # COMMIT EVERY STEP (VISION §10): the ledger advanced (a box ticked, re-opened,
  # or a new cohesion box appended) → commit + push that step so drift is bisectable.
  if [ "$before" != "$after" ]; then
    echo "  ✔ ledger advanced (ticks ${ticks_before}→${ticks_after}) — committing + pushing this step." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run C: ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ per-step commit/push reported a problem — check app/logs/git-push.log" | tee -a "$LOG"
  fi

  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    echo "⛔ Ledger unchanged for $STALL_LIMIT sittings — pausing (NEEDS-FLORIS). A box is stuck; check $LOG and the fresh screenshots." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C stalled on: ${clean_box}. Check RUN-C-LOOP.log + runs/run-3-ux-polish/audit-evidence/.") >> "$LOG" 2>&1
    break
  fi
  sleep 5
done

echo "=== Run C experience loop ended $(date '+%F %T') ===" | tee -a "$LOG"
echo "Ledger:    $LEDGER" | tee -a "$LOG"
echo "Direction: $DIR/RUN-C-DIRECTION.md   ·   Fresh shots: games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/" | tee -a "$LOG"
