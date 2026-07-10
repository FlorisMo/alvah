#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — Run 5 · Run D: the RECONCILED COHESION supervisor
# (mirrors run-c-loop.sh; the rhythm CHANGED per Floris 2026-07-05 (rev 2):
#  FABLE PLANS + AUDITS, OPUS EXECUTES A WHOLE PHASE. Fable defines the next
#  precise actions; Opus then builds every WORK box of the phase across as many
#  sittings as it takes, self-verifying + self-ticking (build + e2e:smoke are
#  enforced MECHANICALLY by `ranger-run.mjs tick`, so a broken build cannot
#  tick); at the phase GATE an independent Fable AUDIT re-checks the whole phase
#  off ONE fresh capture, surfaces fixes/issues, RE-OPENS anything short, and
#  precisely DEFINES the next steps. Quality control moved from per-box to
#  per-phase. Same supervisor-owns-capture split as Run B/C.)
#
# The bash loop is the PERSISTENT supervisor; each sitting is one fresh headless
# `claude -p` resuming from RUN-D-LEDGER.md.
#   • a DIRECTION box (`- [ ] … DIRECTION · …`) → a FABLE PLAN sitting captures,
#     then defines/refines the next precise actions on RUN-D-DIRECTION.md + the
#     ledger.
#   • a WORK box (`- [ ] Pn.m / Dn.m …`)  → an OPUS BUILD sitting makes the code
#     change, self-verifies (build + e2e:smoke, and the focused harness scene
#     where it can), and TICKS it itself. NO per-box capture, NO per-box Fable
#     grade — the phase AUDIT is the checkpoint.
#   • a GATE box (`- [ ] GATE-Dn · …`) → the supervisor captures, then a fresh
#     FABLE AUDIT sitting re-judges the whole phase, ticks / re-opens / appends,
#     and defines the next phase's boxes precisely.
#   • DEMO boxes (`- [ ] DEMO · …`)    → Floris-only; the loop never spends a
#     sitting on them.
#
# PROVEN MACHINERY KEPT FROM RUN B/C: defer-and-continue (a WORK box stuck
# STALL_LIMIT sittings is parked to DEFERRED.md and the loop moves on),
# NEEDS-FLORIS park, per-step commit+push, usage-guard preflight (Meshy reserve
# + wall-clock), per-sitting usage-limit detection with a clean pause, laptop-
# only capture, single-instance lock, Fable→Opus fallback (latched, once).
#
# Usage (from the repo root):
#   bash games/Ranger-Adventures/runs/run-5-cohesion/run-d-loop.sh          # cap 200, effort xhigh
#   bash games/Ranger-Adventures/runs/run-5-cohesion/run-d-loop.sh 120      # custom cap
#   EFFORT=max caffeinate -dimsu nohup bash …/run-d-loop.sh &               # detached + Mac awake
# Watch the CLEAN per-session feed (session N/max + one line per session):
#   tail -f games/Ranger-Adventures/runs/run-5-cohesion/RUN-D-PROGRESS.log
# Watch the FULL debug log (verbose — model output, capture, git):
#   tail -f games/Ranger-Adventures/runs/run-5-cohesion/RUN-D-LOOP.log
# ───────────────────────────────────────────────────────────────────────────
set -u

# repo root = four levels up from this script (…/runs/run-5-cohesion/ → repo).
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures/runs/run-5-cohesion"
LEDGER="$DIR/RUN-D-LEDGER.md"
LOG="$DIR/RUN-D-LOOP.log"                      # full verbose debug log
PROGRESS="$DIR/RUN-D-PROGRESS.log"             # clean per-session feed for Floris
APP="games/Ranger-Adventures/app"

# progress() — one clean line to the terminal (stdout) AND the progress feed AND
# the debug log. This is the human-readable "session N/max + short update" feed.
progress() { printf '%s\n' "$*" | tee -a "$PROGRESS"; printf '%s\n' "$*" >> "$LOG"; }
# short, human label for a box (strip markdown, first ~72 chars).
box_label() { printf '%s' "$1" | sed -E 's/\*\*//g; s/`//g' | cut -c1-72; }
# total real boxes (checked + unchecked) and just the checked ones — for "N/T".
total_boxes() { grep -c -E '^[[:space:]]*-[[:space:]]*\[[ xX]\]' "$LEDGER" 2>/dev/null; }

MAX_RUNS="${1:-200}"                          # safety cap — auto-stop after this many sittings
MODEL_OPUS="${MODEL_OPUS:-opus}"              # the BUILDER (writes the TypeScript)
MODEL_FABLE="${MODEL_FABLE:-claude-fable-5}"  # the VERIFIER + ART DIRECTOR (grades every box, judges gates)
EFFORT="${EFFORT:-xhigh}"
STALL_LIMIT=2                                 # WORK box: this many failed sittings → park to DEFERRED.md + continue; DIRECTION/GATE still pauses
stall=0

# ── FABLE → OPUS FALLBACK (carried from Run C) ────────────────────────────────
# A usage/model limit on a FABLE-role sitting (DIRECTION, GATE or per-box GRADE)
# does not pause the run — fall back to Opus for the verifier/director role ONCE
# and continue. A limit that then persists on Opus is the real account-wide stop.
FABLE_FELL_BACK=0

# ranger-run.mjs selects the active ledger via RUN_LEDGER (relative to the game
# dir, .../Ranger-Adventures). Exported so tick/commit/status target RUN-D-LEDGER.
export RUN_LEDGER="runs/run-5-cohesion/RUN-D-LEDGER.md"

# LAPTOP-ONLY automated capture (iPad hangs the software renderer, F-21).
export CAPTURE_PROJECTS="${CAPTURE_PROJECTS:-laptop}"

# usage-guard inputs (the guard's env names are RUNC_* — shared machinery).
export RUNC_LOOP_START_EPOCH="$(date +%s)"
export RUNC_GUARD_LOG="${RUNC_GUARD_LOG:-$DIR/RUN-D-USAGE-GUARD.log}"

# First unchecked WORK/DIRECTION/GATE box. Skips Floris-only DEMO + parked
# DEFERRED boxes FIRST, then takes the first survivor.
next_work_box() { grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null | grep -vE 'DEMO ·|DEFERRED' | head -1; }
any_unchecked()  { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }
ticks_done() { grep -c -E '^[[:space:]]*-[[:space:]]*\[[xX]\]' "$LEDGER" 2>/dev/null; }

if [ ! -f "$LEDGER" ]; then
  echo "✗ no RUN-D-LEDGER.md at $LEDGER." | tee -a "$LOG"; exit 1
fi

# ── PREFLIGHT: no other run loop may share the screenshots + git ─────────────
if [ -z "${RUND_SKIP_PREFLIGHT:-}" ]; then
  if pgrep -f 'build-run-loop\.sh|run-c-loop\.sh' >/dev/null 2>&1; then
    echo "✗ another run loop (Run B/C) is STILL RUNNING — Run D must not start (shared screenshots + git). Set RUND_SKIP_PREFLIGHT=1 only if you know better." | tee -a "$LOG"; exit 1
  fi
fi
# Single-instance lock (atomic mkdir; auto-released on exit) — no double Run D.
LOCK="$DIR/.run-d.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "✗ another Run D appears to be running (lock exists: $LOCK). If it is not, remove it: rmdir $LOCK" | tee -a "$LOG"; exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# ── CAPTURE OWNERSHIP (the run-2 stall fix — carried verbatim) ───────────────
# The supervisor — NOT the model sittings — runs `npm run capture` (~25–30 min,
# past any sitting's tool ceiling). Output path is hardcoded in app/e2e-capture
# to ../runs/run-3-ux-polish/audit-evidence — the shared evidence dir.
capture_now() {
  echo "  📸 supervisor runs capture (${CAPTURE_PROJECTS}) — $(date '+%T')" | tee -a "$LOG"
  if ( cd "$APP" && npm run capture ) >> "$LOG" 2>&1; then
    echo "  ✓ capture complete $(date '+%T')" | tee -a "$LOG"
  else
    echo "  ⚠ capture exited non-zero — grader may see partial/stale shots (will not tick)" | tee -a "$LOG"
  fi
}

# ── DEFER-AND-CONTINUE + NEEDS-FLORIS PARK (carried from Run C) ───────────────
DEFERRED_LIST="$DIR/DEFERRED.md"
defer_first_work_box() {
  local why="$1"
  awk '
    BEGIN { done = 0 }
    done == 0 && /^[[:space:]]*-[[:space:]]*\[ \]/ && $0 !~ /DEMO ·/ && $0 !~ /DEFERRED/ {
      sub(/\[ \][[:space:]]*/, "[ ] DEFERRED · ")
      done = 1
    }
    { print }
  ' "$LEDGER" > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"
  if [ ! -f "$DEFERRED_LIST" ]; then
    printf '# Run D — deferred boxes (auto-parked; Floris batch worklist)\n\nWORK boxes the autonomous Run D loop could not close on its own — either it failed the independent Fable grade %s sittings running, or a sitting flagged it needs Floris. Each stays parked so the run keeps moving. Work these hands-on.\n\n' "$STALL_LIMIT" > "$DEFERRED_LIST"
  fi
  {
    printf -- '- **%s**\n' "$clean_box"
    printf -- '  - parked %s · %s\n' "$(date '+%F %T')" "$why"
    printf -- '  - evidence: RUN-D-LOOP.log around this time + runs/run-3-ux-polish/audit-evidence/laptop/\n'
  } >> "$DEFERRED_LIST"
}

# ── FABLE · the DIRECTION validator (D0.1 — first act) ────────────────────────
FABLE_DIRECTION_PROMPT='You are the ART DIRECTOR of Ranger van de Veluwe RUN D (the reconciled cohesion run: Opus builds, you verify). Your FIRST act — before any build — is to VALIDATE + refine the inherited direction doc and the reconciled ledger. Do it, then STOP.
1) Read IN FULL: games/Ranger-Adventures/VISION.md (locked), then runs/run-5-cohesion/RUN-D-DIRECTION.md (inherited from Run C — the art bible; its §2.4 Alvah corrections — child ≈1.2 m, blonde wavy hair + blue eyes per public/img/Alvah.jpg — are LAW), RUN-D-PLAN.md, and RUN-D-LEDGER.md (the 2026-07-05 reconciliation: playability first, then Alvah, then cohesion/realism/felt-progress). Then LOOK at the freshest laptop capture under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ (Read the PNGs) + annotations-laptop.json.
2) VALIDATE: for each ledger phase, confirm its boxes are real and specific against what the pixels actually show. If the reconciliation missed a gap, APPEND a concrete "- [ ] Dn.m · <what> · verify-by: <one laptop criterion>" box to the right phase. If a box is already met in the pixels, say so in RUN-D-PLAN.md §8 (do NOT tick work boxes yourself in this sitting — the per-box loop proves them properly). You may refine RUN-D-DIRECTION.md where a screen taught Run C something, but never weaken the frozen contracts or the Alvah corrections.
3) WORDING RULE for any box you append (supervisor dispatch): the FIRST line of a work box must not contain "GATE-", "DIRECTION" or "DEFERRED"; only real gate boxes start "GATE-Dn"; an asset box must name "meshy" in its first line.
4) You change NO game code. When done, tick the direction box: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "validate + refine RUN-D-DIRECTION" (build/e2e:smoke stay green for a docs-only change). Do NOT commit (the supervisor commits). Then STOP.'

# ── OPUS · the BUILD sitting (writes the code, self-verifies, TICKS its box) ──
OPUS_BUILD_PROMPT='You are an Opus BUILD sitting for Ranger van de Veluwe RUN D. In this run FABLE PLANS + AUDITS and YOU EXECUTE: you build ONE box, self-verify it, TICK it, then STOP. There is NO per-box Fable grade — instead an independent Fable AUDIT at the end of each phase (the GATE box) re-checks your whole phase off a fresh capture and will RE-OPEN anything short. So build HONESTLY: a false tick just comes back to you at the audit and wastes a sitting. Honest red beats a false green.
1) Read runs/run-5-cohesion/RUN-D-DIRECTION.md (the art bible — §2.4 Alvah corrections are LAW), then RUN-D-PLAN.md (§1 build-and-tick gate, §2 plan/audit rhythm, §3 asset discipline, §4 frozen contracts), then RUN-D-LEDGER.md. Reference the live canon (app/src/content/veluwe.ts, core/companion.ts, the 5 engines) + root CLAUDE.md.
2) Take the FIRST unchecked WORK box (NOT a DIRECTION/GATE/DEMO/DEFERRED box). Make the change under app/src/** so it MEETS the box'"'"'s verify-by and converges to the direction doc. Expose any dev-hook field the verify-by names; extend the capture harness (app/e2e-capture/**, allowed) when the verify-by needs a new scene or DRIVE-BURST so the phase AUDIT can see it — the Phase-1 playability boxes are proven by the harness DRIVING the action (walk the dune burst, drive the jeep, toggle+enter the heli) and asserting live dev-hook state ACROSS the burst; a static shot is NO evidence for a physics box. Never touch the frozen app/e2e/** tree. SCOPE IS LAPTOP-ONLY — make shared-code fixes for "both"/"iPad" boxes; iPad is demo-gated. For the Phase-1 controller work READ runs/animation-research.md §4 FIRST (raycast ground-snap; NO physics engine unless burst evidence forces it, then cannon-es before rapier); NEW well-licensed (MIT/Apache/CC0/BSD) self-contained dependencies ARE authorized (web search + fetch allowed) when they clearly fix playability or raise realism/cohesion — every dep still holds <150 draw calls, pixelRatio ≤2, iPad-first, build + e2e:smoke green, ZERO runtime network/telemetry/CDN calls, and never trades away motion-comfort/never-scary. If a dep cannot meet those, solve it in-repo.
3) ASSET boxes: generate ONLY the model(s) the box names, ONLY via `node scripts/meshy-gen.mjs --only=<id>`. NEVER an unfiltered assets / meshy-gen / assets:all / ranger-run.mjs run / npm run finish. Meshy jobs exceed the 10-min tool ceiling → run them BACKGROUNDED and poll the log; never print .env.local (use scripts/meshy-balance.mjs for the masked balance). Pipeline-optimize (meshy-gen → gltf-optimize → optimize-animated), never-scary/calm-pose, log the credit spend. Per runs/animation-research.md, TRY D4.0a'"'"'s rigged CC0 sources (Quaternius/poly.pizza) BEFORE spending credits. The regenerated ranger must keep child ≈1.2 m proportions + blonde wavy hair + blue eyes + its baked idle/walk clips.
4) FROZEN CONTRACTS (a change that breaks one is not done): motion-comfort camera law (fixed FOV, roll 0, no shake/snap; reduced-motion = cuts; locomotion always allowed), never-scary/never game-over + calm-pose gate (the wolf is story-gated — never a casual distractor), ≥56 px targets, <150 draw calls, pixelRatio ≤2, persistence ONLY via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (NO new localStorage keys), AVI M3/E3 Dutch ≤7 words + read-aloud on new strings, construct-parity + 2D floor per game, assets via assetUrl, no surnames, never print .env.local.
5) SELF-VERIFY, then TICK. Verify as far as you can WITHOUT the full ~35-min capture: run `npm run build`; run `npm run e2e:smoke`; for a harness / drive-assert box you MAY run its focused Playwright scene to read the burst annotations before ticking. When the verify-by holds, TICK it yourself: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<unique substring of the box text>" — the tick MECHANICALLY refuses unless `npm run build` + the frozen `npm run e2e:smoke` are green, so a broken build cannot tick. If the box carries a +demo component, after ticking EDIT the box text to append " — implemented, awaiting Floris demo (NOT accepted)". Do NOT commit (the supervisor commits every step). If you genuinely cannot make the verify-by hold this sitting, leave the box unticked and STOP — the loop retries once, then parks it to DEFERRED.md.
6) NEVER touch/weaken app/e2e/**, the @smoke suite, or playwright.config.ts. (Unit tests in src/** are not frozen — update them honestly when a pinned value legitimately changes, e.g. the Alvah child height.) Do NOT re-litigate a screen a prior AUDIT froze unless THIS box forces it.
7) NEEDS-FLORIS ESCAPE: if this box genuinely CANNOT be done autonomously (a human decision, a physical device, a login/asset only Floris can supply — e.g. a Mixamo Adobe ID, or a Meshy in-app rig that needs a browser login), print as your FINAL line exactly: NEEDS-FLORIS: <one concrete line> — then STOP without ticking.
Build + tick exactly ONE box, then STOP. If every WORK box is already checked, reply exactly: RUN-D-COMPLETE.'

# ── FABLE · the phase AUDIT / director (surfaces fixes, defines next steps) ───
FABLE_GATE_PROMPT='You are the ART DIRECTOR and INDEPENDENT phase AUDITOR of Ranger van de Veluwe RUN D. Opus has just EXECUTED this whole phase across several sittings, self-ticking each box; you did NOT build any of it. The supervisor has ALREADY run a fresh LAPTOP capture. Do NOT run capture yourself. Your job: AUDIT the finished phase off the fresh pixels, surface the concrete fixes + issues Opus missed or self-passed too generously, and DEFINE the next steps precisely. You LOOK, rule, and DIRECT.
1) Read runs/run-5-cohesion/RUN-D-DIRECTION.md (you may refine it, never weakening the frozen contracts or the §2.4 Alvah corrections), RUN-D-PLAN.md §2, and RUN-D-LEDGER.md. The FIRST unchecked box is a GATE-Dn box — it names the phase you audit.
2) LOOK with the Read tool at EVERY laptop frame for that phase under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ + annotations-laptop.json. Because Opus self-ticked WITHOUT an independent grade, audit each phase box SCEPTICALLY against its verify-by AND the direction doc — do not trust the tick: mechanical truth for Phase 1 (re-read the drive-burst annotations — grounded every frame, real jeep displacement, the heli toggle→available→near→inHeli chain), Alvah'"'"'s truth for Phase 2 (child scale beside the adult; blonde + blue vs public/img/Alvah.jpg), cohesion/realism/never-scary/felt-progress/legibility/motion-comfort elsewhere. A frame from a route the player cannot reach is NO evidence; a missing/GAP frame is NOT a pass.
3) RULE + DIRECT (this is where Fable steers the run): leave genuinely-excellent boxes ticked; RE-OPEN any that fall short (`- [x]` → `- [ ]`) with one precise line in RUN-D-PLAN.md §8 naming the exact fix Opus must make; APPEND new "- [ ] Dn.m · …" boxes with a CONCRETE, testable verify-by for every fix/issue the composed phase reveals (honour the ledger wording rule: no GATE-/DIRECTION/DEFERRED in a work box'"'"'s first line; asset boxes name meshy). Then SHARPEN the NEXT phase: read its boxes against what the pixels now show and tighten any vague verify-by so Opus can execute it without guessing. A +demo box may stay "implemented — awaiting Floris demo" but is NEVER "accepted". Only when every non-demo box in THIS phase truly meets the bar AND no open box remains in it, tick the GATE: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<GATE-Dn substring>".
4) On the FINAL gate (GATE-D7): audit the WHOLE game — every screenshot-closable box across all phases + a re-run of the Phase-1 drive-asserts. This is the last gate before the Floris demo.
5) You change NO game code and never touch app/e2e/**, the @smoke suite, or playwright.config.ts.
Do this ONE gate, then STOP.'

run_fable_direction() {
  claude -p "$FABLE_DIRECTION_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable DIRECTION sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_build() {
  claude -p "$OPUS_BUILD_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus BUILD sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_fable_gate() {
  claude -p "$FABLE_GATE_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable GATE sitting exited non-zero (continuing)" | tee -a "$LOG"
}

echo "=== RUN D cohesion loop started $(date '+%F %T') · cap ${MAX_RUNS} · build=${MODEL_OPUS} plan/audit=${MODEL_FABLE} · effort ${EFFORT} ===" | tee -a "$LOG"
echo "    mode: FABLE PLANS + AUDITS · OPUS EXECUTES A WHOLE PHASE (self-verifies + self-ticks per box; build + e2e:smoke gate the tick mechanically; NO per-box capture/grade). Fable audits at each phase GATE off one fresh capture: re-opens shortfalls + defines the next steps. DEFER-AND-CONTINUE — a WORK box stuck ${STALL_LIMIT} sittings OR one that prints NEEDS-FLORIS is parked to ${DEFERRED_LIST}; a stuck DIRECTION/GATE pauses. Every ledger advance is committed+pushed." | tee -a "$LOG"
progress ""
progress "═══════════ RUN D gestart $(date '+%F %T') · max ${MAX_RUNS} sessies ═══════════"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_work_box)"
  if [ -z "$box" ]; then
    if [ -n "$(any_unchecked)" ]; then
      echo "✅ RUN-D-COMPLETE — all active boxes done. Only Floris-only DEMO + parked DEFERRED boxes remain." | tee -a "$LOG"
      progress "🎉 KLAAR (sessie ${i}/${MAX_RUNS}) — alle actieve vakjes af. Alleen Floris-DEMO + geparkeerde vakjes resten."
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run D phases complete (laptop) — awaiting Floris on-device demo (playability/feel/audio/real-Safari/iPad) + the DEFERRED batch (see runs/run-5-cohesion/).") >> "$LOG" 2>&1
    else
      echo "🎉 RUN-D-COMPLETE — every box in RUN-D-LEDGER.md is checked (after $((i-1)) sittings)." | tee -a "$LOG"
      progress "🎉 KLAAR — elk vakje in de lijst is afgevinkt (na $((i-1)) sessies)."
    fi
    break
  fi

  clean_box="$(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')"

  # ── USAGE / CREDIT STOP GATE (top of every iteration, before any spend) ─────
  guard_flags=""
  case "$box" in
    *[Mm]eshy*|*asset-gen*|*[Gg]enereer*|*[Gg]enerate*model*|*flagship*model*) guard_flags="--asset" ;;
  esac
  guard_out="$( (cd "$APP" && node scripts/usage-guard.mjs $guard_flags) 2>&1 )"; guard_rc=$?
  printf '%s\n' "$guard_out" >> "$LOG"
  if [ "$guard_rc" -ne 0 ]; then
    reason="$(printf '%s\n' "$guard_out" | grep -m1 '^STOP:' | sed 's/^STOP:[[:space:]]*//')"
    [ -z "$reason" ] && reason="usage-guard requested STOP (see RUN-D-USAGE-GUARD.log)"
    echo "⛔ usage-guard STOP — pausing (NEEDS-FLORIS): ${reason}" | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run D paused by usage-guard: ${reason}") >> "$LOG" 2>&1
    break
  fi

  ticks_before="$(ticks_done)"
  before="$(md5 -q "$LEDGER")"
  log_off="$(wc -c < "$LOG" 2>/dev/null | tr -d ' ' || echo 0)"; [ -z "$log_off" ] && log_off=0
  total_now="$(total_boxes)"

  # ── CLEAN per-session banner (session N/max · boxes done · what runs now) ─────
  progress ""
  progress "┌── SESSIE ${i}/${MAX_RUNS} · $(date '+%H:%M') · vakjes af: ${ticks_before}/${total_now}"

  role="opus"
  case "$box" in
    *DIRECTION*)
      role="fable"
      progress "│  ✍ Fable PLANT: $(box_label "$clean_box")"
      echo "  ✍ PLAN box (Fable captures → defines the next precise actions · model=${MODEL_FABLE}): $clean_box" | tee -a "$LOG"
      capture_now
      run_fable_direction ;;
    *GATE-*)
      role="fable"
      progress "│  ▷ Fable AUDIT van de fase: $(box_label "$clean_box")"
      echo "  ▷ PHASE AUDIT (capture → Fable audits the phase, surfaces fixes/issues, defines next steps · model=${MODEL_FABLE}): $clean_box" | tee -a "$LOG"
      capture_now
      run_fable_gate ;;
    *)
      role="opus"    # Opus executes + self-ticks; the phase AUDIT is the checkpoint (no per-box capture/grade)
      progress "│  ▶ Opus BOUWT: $(box_label "$clean_box")"
      echo "  ▶ build box (opus builds + self-verifies + self-ticks · build=${MODEL_OPUS}): $clean_box" | tee -a "$LOG"
      run_opus_build ;;
  esac

  after="$(md5 -q "$LEDGER")"
  ticks_after="$(ticks_done)"

  # ── USAGE-LIMIT DETECTION on THIS sitting's own fresh output ─────────────────
  sitting_out="$(tail -c "+$((log_off + 1))" "$LOG" 2>/dev/null)"
  hit_limit=0
  if printf '%s' "$sitting_out" | grep -qiE 'usage limit reached|weekly limit|claude usage limit|limit will reset|resets? (at|on)|rate.?limit(ed|ing)?|429 too many|too many requests'; then
    hit_limit=1
  fi

  # ── FABLE → OPUS FALLBACK (latched, once) ────────────────────────────────────
  if [ "$hit_limit" -eq 1 ] && [ "$role" = "fable" ] && [ "$FABLE_FELL_BACK" -eq 0 ] && [ "$MODEL_FABLE" != "$MODEL_OPUS" ]; then
    echo "⚠ Verifier/director (Fable, ${MODEL_FABLE}) hit a usage/model limit → falling back to Opus (${MODEL_OPUS}, effort ${EFFORT}) for that role and continuing. Retrying this box on Opus." | tee -a "$LOG"
    progress "└── ⚠ Fable-limiet geraakt → rol overgeschakeld naar Opus; sessie wordt opnieuw geprobeerd."
    MODEL_FABLE="$MODEL_OPUS"; FABLE_FELL_BACK=1
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run D: Fable tokens exhausted — verifier/director role switched to Opus. Run continues; no pause.") >> "$LOG" 2>&1
    stall=0
    sleep 5
    continue
  fi

  # ── "ACCEPT THE BREAK": stop cleanly on a REAL Claude usage-limit hit ────────
  if [ "$hit_limit" -eq 1 ]; then
    echo "⛔ Hit the Claude usage limit — pausing (NEEDS-FLORIS). Nothing lost; re-launch after your weekly window resets to continue from the next box." | tee -a "$LOG"
    progress "└── ⛔ Claude-gebruikslimiet geraakt — GEPAUZEERD. Niets kwijt; herstart na reset van je venster."
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run D paused: hit the Claude usage limit. Re-launch after the weekly window resets to continue.") >> "$LOG" 2>&1
    break
  fi

  # COMMIT EVERY STEP: the ledger advanced → commit + push so drift is bisectable.
  if [ "$before" != "$after" ]; then
    echo "  ✔ ledger advanced (ticks ${ticks_before}→${ticks_after}) — committing + pushing this step." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run D: ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ per-step commit/push reported a problem — check app/logs/git-push.log" | tee -a "$LOG"
  fi

  # Only WORK boxes are parked-and-continued; a stuck DIRECTION/GATE is a real halt.
  is_work_box=1
  case "$box" in *DIRECTION*|*GATE-*) is_work_box=0 ;; esac
  parked=0

  # ── NEEDS-FLORIS PARK ────────────────────────────────────────────────────────
  if [ "$is_work_box" -eq 1 ] && printf '%s\n' "$sitting_out" | grep -qE '^NEEDS-FLORIS:'; then
    nf_reason="$(printf '%s\n' "$sitting_out" | grep -m1 -E '^NEEDS-FLORIS:' | sed 's/^NEEDS-FLORIS:[[:space:]]*//')"
    [ -z "$nf_reason" ] && nf_reason="a sitting flagged it needs Floris (no reason given)"
    echo "🙋 '${clean_box}' NEEDS FLORIS — parking to ${DEFERRED_LIST} and moving on (not a halt): ${nf_reason}" | tee -a "$LOG"
    progress "└── 🙋 GEPARKEERD — heeft Floris nodig: ${nf_reason}"
    defer_first_work_box "NEEDS FLORIS · ${nf_reason}"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run D: parked (needs Floris) — ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ needs-Floris park commit/push problem (continuing)" | tee -a "$LOG"
    stall=0; sleep 5; continue
  fi

  # ── STALL → DEFER-AND-CONTINUE ───────────────────────────────────────────────
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    if [ "$is_work_box" -eq 1 ]; then
      echo "⏭  '${clean_box}' unpassed for $STALL_LIMIT sittings — DEFERRING it to ${DEFERRED_LIST} and moving on (not a halt)." | tee -a "$LOG"
      progress "└── ⏭ GEPARKEERD — ${STALL_LIMIT}× niet gelukt; loop gaat door naar het volgende vakje."
      defer_first_work_box "failed the independent Fable grade $STALL_LIMIT sittings running"
      (cd "$APP" && node scripts/ranger-run.mjs commit "Run D: deferred stuck box — ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
        || echo "  ⚠ deferred-box commit/push problem (continuing)" | tee -a "$LOG"
      stall=0; parked=1
    else
      echo "⛔ Ledger unchanged for $STALL_LIMIT sittings on a DIRECTION/GATE box — pausing (NEEDS-FLORIS). Check $LOG and the fresh screenshots." | tee -a "$LOG"
      progress "└── ⛔ GEPAUZEERD — een PLAN/AUDIT-sessie liep ${STALL_LIMIT}× vast. Check de logs + screenshots."
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run D stalled on: ${clean_box}. Check RUN-D-LOOP.log + runs/run-3-ux-polish/audit-evidence/.") >> "$LOG" 2>&1
      break
    fi
  fi

  # ── CLEAN per-session result line (skip when a branch already printed one) ───
  if [ "$parked" -eq 0 ]; then
    ticks_after="$(ticks_done)"; total_now="$(total_boxes)"
    next_box="$(next_work_box)"
    next_short="$(box_label "$(printf '%s' "$next_box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')")"
    [ -z "$next_short" ] && next_short="— (geen open vakje meer)"
    if [ "$before" != "$after" ] && [ "$ticks_after" -gt "$ticks_before" ]; then
      progress "└── ✔ AF (+$((ticks_after - ticks_before))) · vakjes af: ${ticks_after}/${total_now} · volgende: ${next_short}"
    elif [ "$before" != "$after" ]; then
      progress "└── ↻ BIJGEWERKT (audit/plan: vakjes heropend of toegevoegd) · vakjes af: ${ticks_after}/${total_now} · volgende: ${next_short}"
    else
      progress "└── · nog niet af (poging ${stall}/${STALL_LIMIT}) · vakjes af: ${ticks_after}/${total_now} · volgende: ${next_short}"
    fi
  fi
  sleep 5
done

echo "=== Run D cohesion loop ended $(date '+%F %T') ===" | tee -a "$LOG"
echo "Ledger:    $LEDGER" | tee -a "$LOG"
echo "Direction: $DIR/RUN-D-DIRECTION.md   ·   Fresh shots: games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/" | tee -a "$LOG"
progress "═══════════ RUN D gestopt $(date '+%F %T') · vakjes af: $(ticks_done)/$(total_boxes) ═══════════"
