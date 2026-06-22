#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — autonomous finish-run loop  (BUILD-PLAN §9)
#
# Each iteration is ONE fresh headless Claude run that resumes from RUN-LEDGER.md,
# does the first unchecked [ ] step, tests it, ticks it, and commits+pushes at
# phase boundaries. The loop keeps re-invoking a fresh agent (the resumable design)
# until the ledger has no [ ] left, or the safety cap is hit, or progress stalls.
#
# Usage (from anywhere):
#   bash games/Ranger-Adventures/run-loop.sh           # cap 160 runs
#   bash games/Ranger-Adventures/run-loop.sh 80        # custom cap
#
# Watch it live in a second terminal:  bash games/Ranger-Adventures/watch.sh
# ───────────────────────────────────────────────────────────────────────────
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # alvah repo root
cd "$ROOT"
DIR="games/Ranger-Adventures"
LEDGER="$DIR/RUN-LEDGER.md"
LOG="$DIR/RUN-LOOP.log"

MAX_RUNS="${1:-160}"     # safety cap — auto-stop after this many runs
MODEL=""                 # leave empty to inherit your default; set to "opus" to pin Opus
stall=0

PROMPT='Resume the autonomous "Ranger van de Veluwe" finish run. You are working in the alvah repo; the game lives in games/Ranger-Adventures/ (outside src/).
1) Read games/Ranger-Adventures/RUN-LEDGER.md and BUILD-PLAN.md sections 7 (already built — do NOT rebuild), 8 (run shape), 9 (operations contract), plus the root CLAUDE.md and your memory note project-ranger-adventures.
2) Do the FIRST unchecked [ ] box in RUN-LEDGER.md. If it is bigger than one sitting, split it into sub-steps in the ledger first (§9d).
3) Uphold the frozen research on every choice: never-scary (calm-pose gate, §1e AVOID lists), never game-over, mild consequences, M3/E3 reading, >=56px tap targets, dual-channel feedback, the motion-comfort camera, and construct-parity (each 3D engine ships its seeded parity test).
4) Targeted-test the step: its unit/parity test + `npm --prefix games/Ranger-Adventures/app run build` MUST stay green. Run the asset pipeline via `node games/Ranger-Adventures/app/scripts/ranger-run.mjs assets` when the next step is asset generation.
5) Mark it done: `node games/Ranger-Adventures/app/scripts/ranger-run.mjs tick "<unique words from the step>"`, which refreshes RUN-STATUS.md.
6) After every larger stage run the adversarial self-audit (§9f); do not advance on a fail.
7) Commit+push at each phase boundary: `node games/Ranger-Adventures/app/scripts/ranger-run.mjs commit "<message>"`. Never commit .env.local or git-ignored binaries.
Do one or two ledger steps, then STOP so the loop can re-invoke you fresh with a clean context. If every box is already checked, reply exactly: RUN-COMPLETE.'

echo "=== Ranger finish-run loop started $(date '+%F %T') · cap ${MAX_RUNS} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── run $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  # Done when no unchecked boxes remain.
  if ! grep -qE '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER"; then
    echo "✅ RUN-COMPLETE — no unchecked steps left (after $((i-1)) runs)." | tee -a "$LOG"
    break
  fi

  before="$(md5 -q "$LEDGER")"
  if [ -n "$MODEL" ]; then
    claude -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ run $i exited non-zero (continuing)" | tee -a "$LOG"
  else
    claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ run $i exited non-zero (continuing)" | tee -a "$LOG"
  fi
  after="$(md5 -q "$LEDGER")"

  # Stall guard: if the ledger hasn't changed for 3 runs straight, pause for Floris.
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge 3 ]; then
    echo "⛔ Ledger unchanged for 3 runs — pausing (NEEDS-FLORIS). Check $LOG and $DIR/RUN-STATUS.md." | tee -a "$LOG"
    break
  fi
  sleep 5
done

echo "=== loop ended $(date '+%F %T') ===" | tee -a "$LOG"
