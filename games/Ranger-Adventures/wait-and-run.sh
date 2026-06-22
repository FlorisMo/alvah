#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — hold-then-run gate
#
# Waits for another run to finish (default: the `unaya-run` agent), THEN starts
# our finish loop. While waiting this is just a sleeping bash loop (a few MB), so
# it never competes for RAM with the other run — the collision risk is avoided.
#
# Usage:
#   bash games/Ranger-Adventures/wait-and-run.sh                 # wait for unaya-run, then run (cap 160)
#   bash games/Ranger-Adventures/wait-and-run.sh "<pattern>" 80  # custom process pattern + run cap
# ───────────────────────────────────────────────────────────────────────────
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # alvah repo root
cd "$ROOT"
DIR="games/Ranger-Adventures"

PATTERN="${1:-claude -p /unaya-run}"   # what to wait for (matched against full command line)
MAX_RUNS="${2:-160}"                   # passed through to run-loop.sh
CHECK_EVERY=60                          # seconds between checks
DEBOUNCE=3                              # consecutive "gone" checks before we trust it's done
                                        # (unaya re-spawns per iteration; 3×60s of continuous
                                        #  absence clears its short inter-iteration gaps)

echo "⏳ Ranger run is HOLDING until [$PATTERN] finishes…"

# Sanity check: it must actually be running now, or we'd start instantly on a typo.
if ! pgrep -f "$PATTERN" >/dev/null 2>&1; then
  echo "⚠ Nothing matches [$PATTERN] right now."
  echo "  Either it already finished, or the pattern is wrong — NOT auto-starting."
  echo "  If the other run is truly done, start ours directly:"
  echo "      bash $DIR/run-loop.sh"
  exit 1
fi

empty=0
while true; do
  if pgrep -f "$PATTERN" >/dev/null 2>&1; then
    empty=0
    echo "  …still running ($(date '+%H:%M:%S')) — next check in ${CHECK_EVERY}s"
  else
    empty=$((empty + 1))
    echo "  …no longer running (${empty}/${DEBOUNCE}) ($(date '+%H:%M:%S'))"
    [ "$empty" -ge "$DEBOUNCE" ] && break
  fi
  sleep "$CHECK_EVERY"
done

echo "✅ [$PATTERN] finished — starting the Ranger run now ($(date '+%F %T'))."
exec bash "$DIR/run-loop.sh" "$MAX_RUNS"
