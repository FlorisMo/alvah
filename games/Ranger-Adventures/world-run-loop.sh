#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — run 2 supervisor: één immersieve 3D-wereld
# (WORLD-PLAN.md §6; mechanics inherited from run-loop.sh / BUILD-PLAN §9,
#  hardened after the 2026-07-02 adversarial audit)
#
# The bash loop is the PERSISTENT supervisor; each code step is one fresh
# headless Claude sitting resuming from WORLD-LEDGER.md. The run works
# directly on main (Floris, 2026-07-02: the live site is not in use, branch
# isolation would only clutter) — every phase-boundary push deploys to
# alvah.nl behind the gate. Loop ends when the ledger has no [ ] left, the
# safety cap is hit, or progress stalls.
#
# Usage (from anywhere):
#   bash games/Ranger-Adventures/world-run-loop.sh          # cap 120 sittings
#   bash games/Ranger-Adventures/world-run-loop.sh 40       # custom cap
#
# Keep the Mac awake for long runs:
#   caffeinate -dimsu bash games/Ranger-Adventures/world-run-loop.sh
# Watch it live in a second terminal:  bash games/Ranger-Adventures/watch.sh
# ───────────────────────────────────────────────────────────────────────────
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # alvah repo root
cd "$ROOT"
DIR="games/Ranger-Adventures"
export RUN_LEDGER="WORLD-LEDGER.md"           # ranger-run.mjs status/tick/commit target
LEDGER="$DIR/$RUN_LEDGER"
LOG="$DIR/WORLD-RUN-LOOP.log"

MAX_RUNS="${1:-120}"     # safety cap — auto-stop after this many sittings
MODEL="${MODEL:-opus}"   # Floris: many opus runs in a row (export MODEL= to inherit default)
STALL_LIMIT=3            # consecutive sittings with no ledger change → pause for Floris
stall=0

# First unchecked ledger line's text (empty when none remain).
next_box() { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }

PROMPT='Resume the autonomous "Ranger van de Veluwe" WORLD run (run 2: one immersive 3D open world). You work in the alvah repo on main; the game lives in games/Ranger-Adventures/ (outside src/).
1) Read games/Ranger-Adventures/WORLD-PLAN.md (the master spec — §5 has the acceptance criteria per box) and WORLD-LEDGER.md, plus BUILD-PLAN.md §7 (already built — do NOT rebuild) and the root CLAUDE.md. Do NOT touch RUN-LEDGER.md (run 1 archive). Where BUILD-PLAN §9 and WORLD-PLAN disagree, WORLD-PLAN wins.
2) Do the FIRST unchecked [ ] box in WORLD-LEDGER.md. If it is bigger than one sitting, split it into sub-boxes in the ledger first; when splitting, replace the parent checkbox with plain text and give sub-boxes ids like W2.4a — afterwards ALWAYS tick with the full sub-id. Timeboxed/gated boxes (W3.5 CC0 sourcing, W5.4 Rapier spike) must be resolved in one sitting: do the work OR tick with a written skip/verdict note in WORLD-PLAN.md §10 — never leave them half-open.
3) BROWSER-PROOF CONTRACT (WORLD-PLAN §3.1): ticking is gated mechanically — `ranger-run.mjs tick` refuses unless build + e2e:smoke are green. Smoke is STAGED: v1 (W0.1-W0.3) = boot → canvas renders → screen becomes world, zero pageerrors; W0.4 upgrades smoke to include the ≥2 m movement assert and from then on that stronger smoke is FROZEN — never weaken it. Boxes that change player-visible behavior must land their own E2E assert in the same sitting. Never write "screenshot deferred". --force on tick is allowed ONLY for W0.7, W3.0, W3.4a/b and W3.5.
4) HARD PROHIBITIONS: never invoke `ranger-run.mjs run`, `npm run finish`, `npm run assets:all`, or an unfiltered `ranger-run.mjs assets` / `meshy-gen.mjs` (assets-gen manifest is lost; an unfiltered pass would re-buy the whole cast). Asset generation only via `node scripts/meshy-gen.mjs --only=<id>` when a ledger box names it, run BACKGROUNDED with log polling (Meshy jobs exceed the 10-min tool ceiling). Never print, cat or log API key VALUES anywhere — log only presence + the masked prefix test-meshy.mjs emits. RESEARCH boxes (W3.4a/b): use real web search/fetch with source URLs + access dates; if web tools are unavailable in the sitting, set a --blocker and move on — NEVER invent facts.
5) Uphold the frozen research on every choice (WORLD-PLAN §3.4): motion-comfort camera law, never-scary calm-pose gate, never game-over, construct parity + 2D floor for every mini-game, M3/E3 reading with read-aloud, >=56px targets, <150 draw calls, persistence ONLY via state.ts/persist.ts inside alvah-ef-v1 (ranger namespace, no new keys), assets via assetUrl, no new deps beyond Playwright/Rapier (CC0/CC-BY assets are fine with a license log).
6) Mark the box done: RUN_LEDGER=WORLD-LEDGER.md node games/Ranger-Adventures/app/scripts/ranger-run.mjs tick "<the full W-id, e.g. W1.2>". When a box surprises you (root cause found, verdict reached, contract nuance), append one short entry to WORLD-PLAN.md §10.
7) Commit+push at each phase boundary and after the demo-critical boxes W0.4, W1.2, W1.5, W2.1: RUN_LEDGER=WORLD-LEDGER.md node games/Ranger-Adventures/app/scripts/ranger-run.mjs commit "<message>". Pushes go to main and deploy live behind the gate — that is intended (site not in use). Never commit .env.local, assets-gen/, node_modules, playwright-report, test-results or e2e/__shots__ (W0.1 adds them to app/.gitignore).
8) If a box is blocked on Floris, surface it: RUN_LEDGER=WORLD-LEDGER.md node games/Ranger-Adventures/app/scripts/ranger-run.mjs status --blocker="<what you need>" (clear later with --blocker=none). Tick the blocked box ONLY if the plan marks it graceful-degrade (W0.7, W3.0, W3.4a/b, W3.5); otherwise leave it open, work the NEXT box, and say so in the log.
Do one or two ledger boxes, then STOP so the loop re-invokes you fresh with a clean context. If every box is checked, reply exactly: RUN-COMPLETE.'

run_claude() {
  if [ -n "$MODEL" ]; then
    claude -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ claude sitting exited non-zero (continuing)" | tee -a "$LOG"
  else
    claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
      || echo "  ⚠ claude sitting exited non-zero (continuing)" | tee -a "$LOG"
  fi
}

echo "=== WORLD run loop started $(date '+%F %T') · cap ${MAX_RUNS} · model ${MODEL:-default} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_box)"
  if [ -z "$box" ]; then
    echo "✅ RUN-COMPLETE — no unchecked steps left (after $((i-1)) sittings)." | tee -a "$LOG"
    break
  fi
  echo "  ▶ next box: $(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')" | tee -a "$LOG"

  before="$(md5 -q "$LEDGER")"
  run_claude
  after="$(md5 -q "$LEDGER")"
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    echo "⛔ Ledger unchanged for $STALL_LIMIT sittings — pausing (NEEDS-FLORIS). Check $LOG and $DIR/RUN-STATUS.md." | tee -a "$LOG"
    break
  fi
  sleep 5
done

echo "=== loop ended $(date '+%F %T') ===" | tee -a "$LOG"
