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
  echo "── ledger ──────────────────────────────────────────────────────────"
  done=$(grep -cE '^[[:space:]]*-[[:space:]]*\[x\]' "$DIR/RUN-LEDGER.md" 2>/dev/null || echo 0)
  open=$(grep -cE '^[[:space:]]*-[[:space:]]*\[ \]' "$DIR/RUN-LEDGER.md" 2>/dev/null || echo 0)
  echo "checked: $done    open: $open"
  echo
  echo "── loop log (last 12 lines) ────────────────────────────────────────"
  tail -n 12 "$DIR/RUN-LOOP.log" 2>/dev/null || echo "(no loop log yet)"
  echo
  echo "(refreshing every 5s · Ctrl-C to stop)"
  sleep 5
done
