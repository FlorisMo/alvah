#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — live run watcher
# A self-refreshing dashboard: the live status snapshot, ledger progress, and the
# tail of the loop log. Run it in a SECOND terminal next to run-loop.sh.
#
# Usage:  bash games/Ranger-Adventures/watch.sh        (Ctrl-C to stop watching)
# ───────────────────────────────────────────────────────────────────────────
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures"
# Run 2 (world-run-loop.sh) uses its own ledger + loop log; RUN_LEDGER env
# picks the run to watch (default: run 2 if its ledger exists, else run 1).
if [ -z "${RUN_LEDGER:-}" ] && [ -f "$DIR/WORLD-LEDGER.md" ]; then RUN_LEDGER="WORLD-LEDGER.md"; fi
LEDGER_FILE="$DIR/${RUN_LEDGER:-RUN-LEDGER.md}"
LOOP_LOG="$DIR/RUN-LOOP.log"
[ "${RUN_LEDGER:-}" = "WORLD-LEDGER.md" ] && LOOP_LOG="$DIR/WORLD-RUN-LOOP.log"

while true; do
  clear
  echo "═══════ Ranger van de Veluwe — run watcher · $(date '+%F %T') ═══════"
  echo
  if [ -f "$DIR/RUN-STATUS.md" ]; then
    sed -n '1,30p' "$DIR/RUN-STATUS.md"
  else
    echo "(no RUN-STATUS.md yet — the run hasn't written one)"
  fi
  echo
  echo "── ledger ($(basename "$LEDGER_FILE")) ─────────────────────────────"
  done=$(grep -cE '^[[:space:]]*-[[:space:]]*\[x\]' "$LEDGER_FILE" 2>/dev/null || echo 0)
  open=$(grep -cE '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER_FILE" 2>/dev/null || echo 0)
  echo "checked: $done    open: $open"
  echo
  echo "── loop log (last 12 lines) ────────────────────────────────────────"
  tail -n 12 "$LOOP_LOG" 2>/dev/null || echo "(no loop log yet)"
  echo
  echo "(refreshing every 5s · Ctrl-C to stop)"
  sleep 5
done
