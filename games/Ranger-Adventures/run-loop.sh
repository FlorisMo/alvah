#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — autonomous finish-run loop  (BUILD-PLAN §9)
#
# The bash loop is the PERSISTENT supervisor; each code step is one fresh headless
# Claude run resuming from RUN-LEDGER.md. Two job kinds, handled differently:
#
#   • CODE steps  → a `claude -p` sitting builds the step, tests it, ticks it,
#                   commits at phase boundaries, then stops for a clean context.
#   • ASSET-GEN   → Meshy render generation is pure tooling (no LLM) and runs for
#                   HOURS. It must NOT live inside an ephemeral agent sitting (that
#                   orphans + kills it when the sitting ends). So the LOOP runs the
#                   pipeline itself, synchronously — it persists across the whole run
#                   — then a short agent sitting verifies + ticks + audits + commits.
#
# Loop ends when the ledger has no [ ] left, the safety cap is hit, or progress
# stalls on CODE steps (asset-gen iterations never count as a stall).
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
ORCH="$DIR/app/scripts/ranger-run.mjs"

MAX_RUNS="${1:-160}"     # safety cap — auto-stop after this many runs
MODEL=""                 # leave empty to inherit your default; set to "opus" to pin Opus
STALL_LIMIT=3            # consecutive CODE runs with no ledger change → pause for Floris
stall=0

# First unchecked ledger line's text (empty when none remain).
next_box() { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }
# An asset-GENERATION box (Meshy renders) → the loop runs the pipeline itself.
is_gen_box() { printf '%s' "$1" | grep -qiE 'generate remaining renders|shotlist items'; }

PROMPT='Resume the autonomous "Ranger van de Veluwe" finish run. You are working in the alvah repo; the game lives in games/Ranger-Adventures/ (outside src/).
1) Read games/Ranger-Adventures/RUN-LEDGER.md and BUILD-PLAN.md sections 7 (already built — do NOT rebuild), 8 (run shape), 9 (operations contract), plus the root CLAUDE.md and your memory note project-ranger-adventures.
2) Do the FIRST unchecked [ ] box in RUN-LEDGER.md. If it is bigger than one sitting, split it into sub-steps in the ledger first (§9d). NOTE: Meshy render-generation boxes are run by the loop itself BEFORE it calls you — if the next box is "Generate remaining renders ...", the GLBs should already be generated + optimized into app/public/models/; your job is only to verify the manifest/count, run the build gate, tick the box, run the §9f cast audit, and commit. Do NOT launch a long background generation job yourself.
3) Uphold the frozen research on every choice: never-scary (calm-pose gate, §1e AVOID lists), never game-over, mild consequences, M3/E3 reading, >=56px tap targets, dual-channel feedback, the motion-comfort camera, and construct-parity (each 3D engine ships its seeded parity test).
4) Targeted-test the step: its unit/parity test + `npm --prefix games/Ranger-Adventures/app run build` MUST stay green.
5) Mark it done: `node games/Ranger-Adventures/app/scripts/ranger-run.mjs tick "<unique words from the step>"`, which refreshes RUN-STATUS.md.
6) After every larger stage run the adversarial self-audit (§9f); do not advance on a fail.
7) Commit+push at each phase boundary: `node games/Ranger-Adventures/app/scripts/ranger-run.mjs commit "<message>"`. Never commit .env.local or git-ignored binaries.
Do one or two ledger steps, then STOP so the loop can re-invoke you fresh with a clean context. If every box is already checked, reply exactly: RUN-COMPLETE.'

run_claude() {
  if [ -n "$MODEL" ]; then
    claude -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ claude run exited non-zero (continuing)" | tee -a "$LOG"
  else
    claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ claude run exited non-zero (continuing)" | tee -a "$LOG"
  fi
}

echo "=== Ranger finish-run loop started $(date '+%F %T') · cap ${MAX_RUNS} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── run $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_box)"
  if [ -z "$box" ]; then
    echo "✅ RUN-COMPLETE — no unchecked steps left (after $((i-1)) runs)." | tee -a "$LOG"
    break
  fi

  before="$(md5 -q "$LEDGER")"

  if is_gen_box "$box"; then
    # ── ASSET-GENERATION phase: the loop runs the Meshy pipeline directly. ──
    # Idempotent (skips finished assets via manifest), retries on credit-out (§9c),
    # then optimizes + stages + fetches audio. Blocks for as long as it takes — the
    # loop persists, so nothing gets orphaned. Then the agent verifies + ticks.
    echo "  ▶ asset-generation box detected — loop runs the pipeline (gen→opt→audio, may take 1–3h)…" | tee -a "$LOG"
    node "$ORCH" assets >> "$LOG" 2>&1 \
      || echo "  ⚠ asset pipeline exited non-zero (agent will assess)" | tee -a "$LOG"
    echo "  ✓ asset pipeline pass done — handing to agent to verify + tick." | tee -a "$LOG"
    run_claude
    stall=0           # real external work happened this iteration — never a stall
    sleep 5
    continue
  fi

  # ── CODE step: one fresh agent sitting. ──
  run_claude
  after="$(md5 -q "$LEDGER")"
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    echo "⛔ Ledger unchanged for $STALL_LIMIT code runs — pausing (NEEDS-FLORIS). Check $LOG and $DIR/RUN-STATUS.md." | tee -a "$LOG"
    break
  fi
  sleep 5
done

echo "=== loop ended $(date '+%F %T') ===" | tee -a "$LOG"
