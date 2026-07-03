#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# GUARDED AUTO-LAUNCHER — wait for Run B to finish CLEANLY, then start Run C.
#
# It launches Run C on ONE condition only: Run B has genuinely COMPLETED —
#   (a) build-run-loop.sh is no longer running, AND
#   (b) no active build boxes remain in BUILD-LEDGER.md (DEMO/DEFERRED excluded),
#   (c) BUILD-RUN-LOOP.log shows the BUILD-COMPLETE marker.
# Anything else — a NEEDS-FLORIS pause, a stall, a usage-limit stop, a crash, a
# Ctrl-C — is NOT a completion, so Run C is NOT launched.
#
# DEFAULT behaviour (STRICT=0): it WAITS through pauses and your restarts. Run B
# stalls on a stuck box fairly often; you fix/nudge and relaunch it. The watcher
# just keeps polling and only fires when Run B truly finishes — set-and-forget.
# So it is safe to start this now, even while Run B is paused.
#
# STRICT=1: the original "stop as well" behaviour — the moment Run B stops for a
# non-clean reason, the watcher prints why and EXITS (launches nothing). Use this
# if you'd rather babysit it and re-launch the watcher yourself after each Run B
# restart.
#
# Run C has its own preflight + single-instance lock underneath this, so an
# unfinished Run B or a double-launch is refused twice over.
#
# Usage (open a NEW terminal tab):
#   cd ~/Code/alvah
#   caffeinate -dimsu bash games/Ranger-Adventures/runs/run-4-experience/await-run-b-then-run-c.sh
# The single caffeinate keeps the Mac awake through the wait and (via exec) all
# of Run C. Ctrl-C the watcher any time — while it is only waiting, that launches
# nothing and changes nothing.
#
# Knobs (optional env): POLL=<seconds, default 30> · STRICT=<0|1, default 0> ·
#   EFFORT=<xhigh> · MODEL_FABLE=opus (run the art director on Opus from the
#   start). A first arg is passed through to Run C as its MAX_RUNS cap.
# ───────────────────────────────────────────────────────────────────────────
set -u

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"; cd "$ROOT"
RUNC="games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh"
BLEDGER="games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-LEDGER.md"
BLOG="games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-RUN-LOOP.log"
POLL="${POLL:-30}"
STRICT="${STRICT:-0}"

run_b_running() { pgrep -f 'build-run-loop\.sh' >/dev/null 2>&1; }
# true = at least one ACTIVE build box is still open (DEMO/DEFERRED are meant to stay open)
open_boxes()    { [ -f "$BLEDGER" ] && grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$BLEDGER" | grep -vqE 'DEMO ·|DEFERRED'; }
build_complete(){ [ -f "$BLOG" ] && tail -n 80 "$BLOG" | grep -q 'BUILD-COMPLETE'; }

echo "⏳ $(date '+%F %T') — watching Run B; will launch Run C only on a clean BUILD-COMPLETE. (poll ${POLL}s · STRICT=${STRICT} · Ctrl-C to cancel — launches nothing while waiting)"

while true; do
  if run_b_running; then
    :                                   # Run B is working — keep waiting
  elif open_boxes; then                 # stopped, but active boxes remain → NOT finished
    if [ "$STRICT" = "1" ]; then
      echo "✋ $(date '+%F %T') — Run B stopped with open boxes (pause / stall / usage-limit / crash) and STRICT=1 → exiting, launching nothing."
      echo "   What happened:  tail -n 30 $BLOG"
      exit 1
    fi
    # default: you will restart Run B — say so once per transition, then keep waiting
    if [ "${announced_pause:-}" != "1" ]; then
      echo "… $(date '+%F %T') — Run B is not running and still has open boxes (a pause / stall). Waiting for you to restart + finish it. (Not launching.)"
      announced_pause=1
    fi
  elif build_complete; then             # stopped + no open boxes + marker → CLEAN FINISH
    break
  else
    # stopped, no open boxes, but no BUILD-COMPLETE marker → ambiguous, never fire on this
    if [ "$STRICT" = "1" ]; then
      echo "✋ $(date '+%F %T') — Run B not running, no open boxes, but no BUILD-COMPLETE marker → not a clean finish (STRICT). Exiting."
      exit 1
    fi
  fi
  # reset the pause notice whenever Run B is alive again, so a later pause re-announces
  if run_b_running; then announced_pause=0; fi
  sleep "$POLL"
done

echo "✅ $(date '+%F %T') — Run B finished CLEANLY (not running · no active boxes · BUILD-COMPLETE)."
echo "🚀 Launching Run C now (it re-checks this itself before spending anything)…"
export EFFORT="${EFFORT:-xhigh}"
exec bash "$RUNC" "$@"
