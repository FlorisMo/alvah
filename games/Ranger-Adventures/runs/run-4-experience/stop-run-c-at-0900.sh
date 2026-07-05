#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Watchdog — stop Run C at 09:00 today (2026-07-05) WITHOUT interrupting a sitting.
# Floris's rule: let the last sitting that STARTS before 09:00 fully finish, then
# kill the FIRST sitting that starts at/after 09:00 immediately so it does no work.
#
# How it knows: Run C's sittings are strictly sequential, and each one prints a
# "──────── sitting N/M ────────" line as it STARTS — AFTER the previous sitting
# has finished, been graded, and COMMITTED. So a rise in the sitting count = the
# previous (pre-09:00) sitting is safely done and the next (post-09:00) one just
# began. We wait until 09:00, snapshot the count, and kill the instant it rises.
#
# Safe before 09:00: it only sleeps. Worst failure = it doesn't kill and Floris
# stops Run C by hand. It cannot end the run early. Fully detached (nohup).
# Cancel it any time:  pkill -f stop-run-c-at-0900.sh
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(cd "$(dirname "$0")/../../../.." && pwd)"    # repo root (…/alvah)
DIR="games/Ranger-Adventures/runs/run-4-experience"
LOG="$DIR/RUN-C-LOOP.log"
LOCK="$DIR/.run-c.lock"
WLOG="$DIR/STOP-AT-0900.log"
DEADLINE_EPOCH="$(date -j -f "%Y-%m-%d %H:%M:%S" "2026-07-05 09:00:00" +%s)"

say()       { echo "$(date '+%F %T')  $*" | tee -a "$WLOG"; }
sittings()  { local n; n="$(grep -cE 'sitting [0-9]+/[0-9]+' "$LOG" 2>/dev/null)"; echo "${n:-0}"; }
loop_alive(){ pgrep -f 'run-c-loop\.sh' >/dev/null 2>&1; }

say "watchdog armed — will stop Run C at the first sitting starting ≥ 09:00 (deadline epoch $DEADLINE_EPOCH)."

# 1) sleep until 09:00 — bail out early if the run ends on its own first.
while [ "$(date +%s)" -lt "$DEADLINE_EPOCH" ]; do
  loop_alive || { say "Run C already ended before 09:00 — nothing to do. Exiting."; exit 0; }
  sleep 30
done

# 2) crossed 09:00 — baseline the count, then kill the moment a new sitting starts.
base="$(sittings)"
say "reached 09:00 — baseline sittings=$base. Letting the in-flight sitting finish; will kill the next to start."
while loop_alive; do
  now="$(sittings)"
  if [ "$now" -gt "$base" ]; then
    say "first post-09:00 sitting just started (#$now) — stopping Run C NOW."
    pkill -f 'run-c-loop\.sh'                 # the supervisor loop (wrapper + worker)
    pkill -f 'await-run-b-then-run-c\.sh'     # the launcher + its caffeinate wake-lock
    pkill -f 'Ranger van de Veluwe RUN C'     # the just-started sitting (claude -p)
    sleep 2
    pkill -9 -f 'run-c-loop\.sh' 2>/dev/null
    pkill -9 -f 'Ranger van de Veluwe RUN C' 2>/dev/null
    rmdir "$LOCK" 2>/dev/null && say "released $LOCK." || true
    say "Run C stopped. Last pre-09:00 sitting finished + committed; no post-09:00 work ran."
    exit 0
  fi
  sleep 3
done
say "Run C ended on its own after 09:00 before a new sitting started — no kill needed. Exiting."
