#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — Run 3 · Run B: the OPUS BUILD supervisor
# (mirrors audit-run-loop.sh, but MODEL=opus --effort max and the task is to
#  FIX the game, screenshot-in-the-loop, with a Fable RE-JUDGE at each phase.)
#
# The bash loop is the PERSISTENT supervisor; each sitting is one fresh headless
# run resuming from BUILD-LEDGER.md.
#   • a WORK box (`- [ ] Pn.m · …`)   → an OPUS sitting makes the fix, re-captures,
#     grades its own screenshot, and ticks ONLY on green (build + e2e:smoke are
#     enforced mechanically by `ranger-run.mjs tick`).
#   • a GATE box (`- [ ] GATE-Pn · …`) → an independent FABLE sitting re-judges
#     the phase's screenshots and may RE-OPEN any box. This IS the phase boundary.
#   • DEMO boxes (`- [ ] DEMO · …`)    → Floris-only; the loop never spends a
#     sitting on them. When the only unchecked boxes left are DEMO, it prints
#     BUILD-COMPLETE (build phases done; on-device demo pending).
#
# After a GATE box gets ticked (a phase closed) the supervisor commits+pushes
# that phase via `ranger-run.mjs commit`.
#
# PRE-REQ: none to start — Phase 0's FIRST box archives the Run A evidence before
#          any capture. (BUILD-LEDGER.md must exist.)
#
# Usage (from the repo root):
#   bash games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh          # cap 80, effort max
#   bash games/Ranger-Adventures/runs/run-3-ux-polish/build-run-loop.sh 40       # custom cap
#   EFFORT=max caffeinate -dimsu bash …/build-run-loop.sh                        # keep the Mac awake
# Watch it live in a second terminal:
#   tail -f games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-RUN-LOOP.log
# ───────────────────────────────────────────────────────────────────────────
set -u

# repo root = five levels up from this script (…/runs/run-3-ux-polish/ → repo).
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures/runs/run-3-ux-polish"
LEDGER="$DIR/BUILD-LEDGER.md"
LOG="$DIR/BUILD-RUN-LOOP.log"
APP="games/Ranger-Adventures/app"

MAX_RUNS="${1:-80}"                       # safety cap — auto-stop after this many sittings
MODEL_OPUS="${MODEL_OPUS:-opus}"          # the BUILDER (makes fixes)
MODEL_FABLE="${MODEL_FABLE:-claude-fable-5}"  # the independent phase RE-JUDGE (multimodal taste)
EFFORT="${EFFORT:-max}"                   # reasoning effort: low|medium|high|xhigh|max
STALL_LIMIT=3                             # consecutive sittings with no ledger change → pause
stall=0

# ranger-run.mjs selects the active ledger via RUN_LEDGER (relative to the game
# dir, .../Ranger-Adventures). Exported so tick/commit/status target BUILD-LEDGER.
export RUN_LEDGER="runs/run-3-ux-polish/BUILD-LEDGER.md"

# Run B SCOPE (Floris, 2026-07-03): automated verification is LAPTOP-ONLY —
# `npm run capture` only captures the laptop project (the iPad leg hangs the
# software renderer, F-21). iPad is verified on Floris's real device in the demo.
# Re-enable iPad auto-capture by setting CAPTURE_PROJECTS="laptop,ipad" here.
export CAPTURE_PROJECTS="${CAPTURE_PROJECTS:-laptop}"

# First unchecked WORK box. Skips Floris-only DEMO boxes AND DEFERRED boxes
# (e.g. iPad-only work parked until iPad capture is re-enabled) — filter FIRST,
# then take the first survivor, so a skipped box mid-list can't read as "done".
next_work_box() { grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null | grep -vE 'DEMO ·|DEFERRED' | head -1; }
# Any unchecked box at all (incl. DEMO) — to tell "all done" from "demo pending".
any_unchecked()  { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }
# Count of ticked GATE boxes — a rise means a phase just closed → commit.
gates_done() { grep -c -E '^[[:space:]]*-[[:space:]]*\[[xX]\].*GATE-' "$LEDGER" 2>/dev/null; }

if [ ! -f "$LEDGER" ]; then
  echo "✗ no BUILD-LEDGER.md at $LEDGER." | tee -a "$LOG"; exit 1
fi

# ── CAPTURE OWNERSHIP (the run-2 stall fix) ─────────────────────────────────
# The supervisor — NOT the model sittings — runs `npm run capture`. A `claude -p`
# sitting can't block for the whole capture, so it used to background it and
# yield, and the box never got graded → the loop stalled. Here the loop blocks on
# capture itself (it has no time limit), then hands the finished shots to a grade
# sitting. Model sittings NEVER run capture.
capture_now() {
  echo "  📸 supervisor runs capture (${CAPTURE_PROJECTS}) — $(date '+%T')" | tee -a "$LOG"
  if ( cd "$APP" && npm run capture ) >> "$LOG" 2>&1; then
    echo "  ✓ capture complete $(date '+%T')" | tee -a "$LOG"
  else
    echo "  ⚠ capture exited non-zero — grader may see partial/stale shots (will not tick)" | tee -a "$LOG"
  fi
}

# ── OPUS · the FIX half (code change only — no capture, no tick) ─────────────
OPUS_FIX_PROMPT='You are the FIX half of one Ranger van de Veluwe RUN-3 BUILD sitting (Run B). You make the CODE CHANGE for ONE box. You do NOT screenshot and you do NOT tick — the supervisor runs the capture right after you, and a separate grade sitting judges it. Make the fix, then STOP.
1) Read runs/run-3-ux-polish/BUILD-PLAN.md (per-box gate §1, the LAPTOP-ONLY scope banner, phase order + coupling §3, frozen contracts §5, prohibitions §6), then BUILD-LEDGER.md, then the finding for the FIRST unchecked WORK box in AUDIT-FINDINGS.md. Reference: FINDINGS.md + root CLAUDE.md.
2) Take the FIRST unchecked WORK box (`- [ ] Pn.m …`, NOT a GATE/DEMO/DEFERRED box). Make the fix under app/src/** exactly as the finding’s Concrete fix says, honoring coupling/order in BUILD-PLAN §3 (scale F-07 before any camera work; F-05 ⊕ F-18 together; F-33/F-12/F-10 are re-checks not fixes). Expose any dev-hook field the finding’s assert needs; if the assert needs a new scene/input/idle-pair, extend the capture harness (app/e2e-capture/**). SCOPE IS LAPTOP-ONLY — make shared-code fixes for "both"/"iPad" findings but do not chase iPad pixels (iPad is demo-gated).
3) Do NOT run `npm run capture`. Do NOT tick any box. Do NOT commit. The supervisor captures next; a grade sitting decides the tick.
4) FROZEN CONTRACTS (a fix that breaks one is not a fix): motion-comfort camera law (fixed FOV, roll 0, no shake/snap; reduced-motion = cuts; locomotion always allowed), never-scary/never game-over, >=56 px targets, <150 draw calls, pixelRatio <=2, persistence ONLY via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (NO new localStorage keys), M3/E3 Dutch <=7 words + read-aloud on new strings, assets via assetUrl, no new deps without Floris, no surnames, never print .env.local.
5) NEVER touch/weaken app/e2e/**, the @smoke suite, or playwright.config.ts.
Make the code change for exactly ONE box, then STOP. If every WORK box is already checked, reply exactly: BUILD-COMPLETE.'

# ── OPUS · the GRADE half (judge the supervisor’s fresh shots, tick on green) ─
OPUS_GRADE_PROMPT='You are the GRADE half of one Ranger van de Veluwe RUN-3 BUILD sitting (Run B). The fix for the FIRST unchecked WORK box was just made, and the supervisor has ALREADY run a fresh LAPTOP `npm run capture` — the new PNGs + annotations are on disk. Judge them and tick ONLY on green. Do NOT run capture yourself.
1) Read BUILD-PLAN.md §1 + the LAPTOP-ONLY scope banner, BUILD-LEDGER.md, and the finding for the FIRST unchecked WORK box in AUDIT-FINDINGS.md.
2) LOOK with the Read tool at the fresh laptop PNG(s) for that finding under runs/run-3-ux-polish/audit-evidence/laptop/, and read annotations-laptop.json for the finding’s named field. Grade against the finding’s criterion. Pixels outrank the hook (F-18): if they disagree, trust the pixels. (iPad is demo-gated — do not expect iPad pixels.)
3) TICK ONLY ON GREEN. If the laptop screenshot AND the annotation assert both pass, tick: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<unique substring of the box text>" (this also refuses unless `npm run build` + the frozen `npm run e2e:smoke` are green). If the box is a +demo finding, tick it but EDIT the box text to append " — implemented, awaiting Floris demo (NOT fixed)". If the grade FAILS, do NOT tick: leave the box open, append one line to BUILD-PLAN §8 saying what still fails, and STOP (the loop retries the fix next iteration).
4) Do NOT commit (the supervisor commits per phase). NEVER touch app/e2e/**, the @smoke suite, or playwright.config.ts.
Grade this ONE box, then STOP.'

# ── FABLE · the phase-gate re-judge (may re-open boxes) ──────────────────────
FABLE_PROMPT='You are the INDEPENDENT phase RE-JUDGE of the Ranger van de Veluwe RUN-3 BUILD (Run B, HYBRID gate — BUILD-PLAN §2). You did NOT make these fixes; do not trust the builder’s self-grade. The supervisor has ALREADY run a fresh LAPTOP capture — the new PNGs + annotations are on disk. Do NOT run capture yourself. You LOOK and rule.
1) Read runs/run-3-ux-polish/BUILD-PLAN.md §2 (the hybrid gate) + the LAPTOP-ONLY scope banner, and BUILD-LEDGER.md. The FIRST unchecked box is a GATE-Pn box — it names the phase you are judging.
2) LOOK at every laptop screenshot for that phase’s findings (Read the PNGs under runs/run-3-ux-polish/audit-evidence/laptop/) and read annotations-laptop.json. Judge each phase finding against its criterion in AUDIT-FINDINGS.md — framing, avatar scale, camera clearance, >=56 px targets, legibility, back-paths, hint sequencing, etc. iPad is demo-gated — judge laptop pixels only.
3) RULE: for each phase WORK box genuinely fixed in the pixels, leave it ticked. For any that still FAILS, RE-OPEN it by editing its `- [x]` back to `- [ ]` in BUILD-LEDGER.md and append one line to BUILD-PLAN §8 saying what you still see wrong. A +demo box may stay "implemented, awaiting Floris demo" but must NOT be called "fixed" — never upgrade it. Only when you AGREE every non-demo box in the phase is truly fixed, tick the GATE box: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<GATE-Pn substring>".
4) On GATE-P1 additionally: this is the first real look at the composed world (Run A judged it through the giant-avatar keyhole). TRIAGE any new world-look defects you now see (biome density, prop placement, animal/piglet models, lighting) by adding new `- [ ]` boxes to Phase 1 before the GATE, and do NOT tick the GATE until they are addressed. On GATE-P5: re-judge the WHOLE game, every screenshot-closable box.
5) You change NO game code and never touch app/e2e/**, the @smoke suite, or playwright.config.ts. You only look, and edit BUILD-LEDGER.md ticks + BUILD-PLAN §8.
Do this ONE gate, then STOP. If the gate now passes you tick it; if you re-open boxes you leave the gate unticked so the builder redoes them.'

run_opus_fix() {
  claude -p "$OPUS_FIX_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus FIX sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_grade() {
  claude -p "$OPUS_GRADE_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus GRADE sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_fable() {
  claude -p "$FABLE_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable gate sitting exited non-zero (continuing)" | tee -a "$LOG"
}

echo "=== BUILD run loop started $(date '+%F %T') · cap ${MAX_RUNS} · build=${MODEL_OPUS} judge=${MODEL_FABLE} · effort ${EFFORT} ===" | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_work_box)"
  if [ -z "$box" ]; then
    if [ -n "$(any_unchecked)" ]; then
      echo "✅ BUILD-COMPLETE — all active build/gate boxes done. Only Floris-only DEMO + parked DEFERRED (iPad) boxes remain." | tee -a "$LOG"
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Build phases complete (laptop) — awaiting Floris on-device demo + iPad re-enable (DEMO/DEFERRED boxes in BUILD-LEDGER.md).") >> "$LOG" 2>&1
    else
      echo "🎉 BUILD-COMPLETE — every box in BUILD-LEDGER.md is checked (after $((i-1)) sittings)." | tee -a "$LOG"
    fi
    break
  fi

  clean_box="$(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')"
  gates_before="$(gates_done)"
  before="$(md5 -q "$LEDGER")"

  case "$box" in
    *GATE-*)
      echo "  ▷ PHASE GATE (capture → Fable re-judge): $clean_box" | tee -a "$LOG"
      capture_now
      run_fable ;;
    *)
      echo "  ▶ build box (fix → capture → grade): $clean_box" | tee -a "$LOG"
      run_opus_fix
      capture_now
      run_opus_grade ;;
  esac

  after="$(md5 -q "$LEDGER")"
  gates_after="$(gates_done)"

  # A phase just closed (a GATE box got ticked) → commit + push that phase.
  if [ "$gates_after" -gt "$gates_before" ]; then
    echo "  ✔ a phase gate closed — committing + pushing the phase." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run B: phase gate passed (Fable-agreed) — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ per-phase commit/push reported a problem — check app/logs/git-push.log" | tee -a "$LOG"
  fi

  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    echo "⛔ Ledger unchanged for $STALL_LIMIT sittings — pausing (NEEDS-FLORIS). A box is stuck; check $LOG and the fresh screenshots in $DIR/audit-evidence/." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run B stalled on: ${clean_box}. Check BUILD-RUN-LOOP.log + audit-evidence/.") >> "$LOG" 2>&1
    break
  fi
  sleep 5
done

echo "=== build loop ended $(date '+%F %T') ===" | tee -a "$LOG"
echo "Ledger:   $LEDGER" | tee -a "$LOG"
echo "Findings: $DIR/AUDIT-FINDINGS.md   ·   Fresh shots: $DIR/audit-evidence/" | tee -a "$LOG"
