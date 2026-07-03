#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — Run 3 · Run A: the FABLE AUDIT supervisor
# (mirrors run-2's world-run-loop.sh, but MODEL=claude-fable-5 and the task is
#  AUDIT-ONLY — it changes NO game code, it only writes findings.)
#
# The bash loop is the PERSISTENT supervisor; each sitting is one fresh headless
# Fable run resuming from AUDIT-LEDGER.md. A sitting looks at 1–2 capture groups,
# writes findings into AUDIT-FINDINGS.md, ticks the box, and stops. The loop ends
# when the ledger has no [ ] left, the cap is hit, or progress stalls.
#
# PRE-REQ: capture the evidence first (from app/):  npm run capture
#          (this loop critiques whatever is in audit-evidence/; re-run capture
#           anytime — it is model-free and cheap.)
#
# Usage (from the repo root):
#   bash games/Ranger-Adventures/runs/run-3-ux-polish/audit-run-loop.sh          # cap 30, effort high
#   bash games/Ranger-Adventures/runs/run-3-ux-polish/audit-run-loop.sh 12       # custom cap
#   EFFORT=max bash …/audit-run-loop.sh                                          # most careful critique
#   MODEL=opus EFFORT=max bash …/audit-run-loop.sh                               # swap the judge model
# Keep the Mac awake for a long run:  caffeinate -dimsu bash …/audit-run-loop.sh
# Watch it live in a second terminal: tail -f games/Ranger-Adventures/runs/run-3-ux-polish/AUDIT-RUN-LOOP.log
# ───────────────────────────────────────────────────────────────────────────
set -u

# repo root = five levels up from this script (…/runs/run-3-ux-polish/ → repo).
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures/runs/run-3-ux-polish"
LEDGER="$DIR/AUDIT-LEDGER.md"
LOG="$DIR/AUDIT-RUN-LOOP.log"

MAX_RUNS="${1:-30}"                 # safety cap — auto-stop after this many sittings
MODEL="${MODEL:-claude-fable-5}"    # the AUDIT judge (multimodal taste). Override with MODEL=…
EFFORT="${EFFORT:-high}"            # reasoning effort: low|medium|high|xhigh|max. EFFORT=max for the
                                    # most careful critique (slower/pricier); high is a good default.
STALL_LIMIT=3                       # consecutive sittings with no ledger change → pause
stall=0

# First unchecked ledger line (empty when none remain).
next_box() { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }

# Guard: the evidence must exist, else Fable has nothing to look at.
if ! ls "$DIR"/audit-evidence/annotations-*.json >/dev/null 2>&1; then
  echo "✗ no capture evidence in $DIR/audit-evidence/." | tee -a "$LOG"
  echo "  Run it first:  cd games/Ranger-Adventures/app && npm run capture" | tee -a "$LOG"
  exit 1
fi

PROMPT='You are one sitting of the Ranger van de Veluwe RUN-3 AUDIT (Run A). You are the EYES: you LOOK at screenshots and turn them into an executable, verifiable punch-list. You change NO game code.
1) Read games/Ranger-Adventures/runs/run-3-ux-polish/AUDIT-PLAN.md (your full brief — finding schema §3, frozen contracts §5, self-audit §6, prohibitions §7), then AUDIT-LEDGER.md, then FINDINGS.md (why this run exists). Reference: runs/run-2-world/WORLD-PLAN.md and root CLAUDE.md.
2) Do the FIRST unchecked [ ] box in AUDIT-LEDGER.md. LOOK at every screenshot in that capture group on BOTH platforms — read the PNGs under runs/run-3-ux-polish/audit-evidence/laptop/ and /ipad/ with your image tool, and read audit-evidence/annotations-<platform>.json for the live state (screen/pos/cameraYaw/drawCalls/missionView/clip) + the Dutch caption per shot. For walk/jeep bursts, use the per-frame Δpos + clip to judge gliding vs walking (pos moved while clip is null → gliding) and steering (heading/cameraYaw unchanged with a turn key held → dead steering).
3) Write findings into runs/run-3-ux-polish/AUDIT-FINDINGS.md using the §3 schema EXACTLY (id F-01…, defect, platform iPad/laptop/both, evidence screenshot path, severity, concrete fix, verify-by [screenshot | E2E assert(field/spec) | needs Floris demo], confidence, contract-check). Anything a still cannot prove (smoothness, latency, motion comfort) → verify-by = "needs Floris demo"; NEVER claim it fixed. Ground every finding in an image you actually looked at — do not invent.
4) Respect the frozen contracts in every "concrete fix" (AUDIT-PLAN §5): motion-comfort camera law, never-scary/never game-over, >=56px targets, <150 draw calls, alvah-ef-v1 ranger namespace (no new keys), M3/E3 reading + read-aloud, no new deps, assets via assetUrl, no surnames, never print .env.local values.
5) HARD PROHIBITIONS: edit NOTHING under app/src/** or any game code; do NOT touch app/e2e/** or playwright.config.ts or the frozen e2e:smoke suite. You may re-run the capture harness (cd games/Ranger-Adventures/app && npm run capture) if evidence is missing, but you build findings, not fixes.
6) Tick the box you finished by editing AUDIT-LEDGER.md ([ ]→[x]). If a group has no/partial capture (a GAP), record that as a finding and tick anyway — never block the loop. When something surprises you about the harness or the game, append one line to AUDIT-PLAN.md §9.
7) The last two boxes are A11 Synthesis (dedupe + severity-sort + the at-a-glance table + confirm all six FINDINGS.md punch-list items are covered) and A12 Deep self-audit (AUDIT-PLAN §6 — will it look+control right on both platforms, what is uncovered, coupled fixes, needs-demo items, build order).
Do one or two boxes, then STOP so the loop re-invokes you fresh with clean context. If every box is checked, reply exactly: AUDIT-COMPLETE.'

run_fable() {
  claude -p "$PROMPT" --model "$MODEL" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable sitting exited non-zero (continuing)" | tee -a "$LOG"
}

echo "=== AUDIT run loop started $(date '+%F %T') · cap ${MAX_RUNS} · model ${MODEL} · effort ${EFFORT} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_box)"
  if [ -z "$box" ]; then
    echo "✅ AUDIT-COMPLETE — no unchecked boxes left (after $((i-1)) sittings)." | tee -a "$LOG"
    break
  fi
  echo "  ▶ next box: $(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')" | tee -a "$LOG"

  before="$(md5 -q "$LEDGER")"
  run_fable
  after="$(md5 -q "$LEDGER")"
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    echo "⛔ Ledger unchanged for $STALL_LIMIT sittings — pausing (NEEDS-FLORIS). Check $LOG." | tee -a "$LOG"
    break
  fi
  sleep 5
done

echo "=== audit loop ended $(date '+%F %T') ===" | tee -a "$LOG"
echo "Findings: $DIR/AUDIT-FINDINGS.md" | tee -a "$LOG"
