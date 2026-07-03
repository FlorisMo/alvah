#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Ranger van de Veluwe — Run 4 · Run C: the FABLE-DIRECTED EXPERIENCE supervisor
# (mirrors build-run-loop.sh, but the ROLES swap per VISION §12: FABLE is the ART
#  DIRECTOR — it proposes AND judges design/story/cohesion and may re-open OR
#  append cohesion boxes each phase — and OPUS is the BUILDER that writes the
#  TypeScript. Same supervisor-owns-capture split + hybrid two-judge gate as Run B.)
#
# The bash loop is the PERSISTENT supervisor; each sitting is one fresh headless
# `claude -p` resuming from RUN-C-LEDGER.md.
#   • a DIRECTION box (`- [ ] … DIRECTION · …`) → a FABLE sitting authors/commits
#     RUN-C-DIRECTION.md (the art-direction bible + felt-progress plan + ranked
#     Meshy asset list). This is the run's FIRST committed act (VISION §10). No
#     capture — there are no new pixels yet, this is the plan.
#   • a WORK box (`- [ ] Pn.m · …`)   → an OPUS sitting makes the code change,
#     the supervisor re-captures, then a second OPUS sitting grades its OWN fresh
#     screenshot against RUN-C-DIRECTION.md + the box's verify-by and ticks ONLY
#     on green (build + e2e:smoke are enforced mechanically by `ranger-run.mjs`).
#   • a GATE box (`- [ ] GATE-Pn · …`) → an independent FABLE (art-director)
#     sitting re-judges the phase's screenshots against the direction doc and
#     either ticks the GATE or RE-OPENS boxes AND/OR APPENDS new cohesion boxes.
#     This is the phase boundary and the SECOND judge of the hybrid gate.
#   • DEMO boxes (`- [ ] DEMO · …`)    → Floris-only (feel / audio / real-device /
#     iPad); the loop never spends a sitting on them.
#
# USAGE / CREDIT STOP (honest — Floris 2026-07-03): the weekly Claude usage % is
# NOT programmatically measurable, so Run C does NOT fake a "3% weekly" number. It
# RUNS UNTIL IT ACTUALLY HITS THE LIMIT and stops gracefully: after each sitting
# the supervisor scans THAT sitting's own output for a real usage-limit break and
# pauses cleanly (re-launch after the weekly window resets to continue). The
# pre-flight `node app/scripts/usage-guard.mjs` now enforces only what is REAL —
# the live Meshy credit balance vs a reserve (asset boxes) and an optional
# per-session wall-clock. Every stop is a clean NEEDS-FLORIS pause; nothing lost.
#
# COMMIT CADENCE (run-C delta, VISION §10): commit + push EVERY step (finer than
# Run B's per-phase) so any drift is bisectable — the supervisor commits whenever
# the ledger advances (a box ticked, re-opened, or a new cohesion box appended).
#
# PRE-REQ: Run B is FINISHED (this run starts after it). RUN-C-LEDGER.md exists;
#          its FIRST box writes RUN-C-DIRECTION.md.
#
# Usage (from the repo root):
#   bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh          # cap 200, effort xhigh
#   bash games/Ranger-Adventures/runs/run-4-experience/run-c-loop.sh 120      # custom cap
#   EFFORT=xhigh caffeinate -dimsu bash …/run-c-loop.sh                       # keep the Mac awake
# Watch it live in a second terminal:
#   tail -f games/Ranger-Adventures/runs/run-4-experience/RUN-C-LOOP.log
# ───────────────────────────────────────────────────────────────────────────
set -u

# repo root = five levels up from this script (…/runs/run-4-experience/ → repo).
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DIR="games/Ranger-Adventures/runs/run-4-experience"
LEDGER="$DIR/RUN-C-LEDGER.md"
LOG="$DIR/RUN-C-LOOP.log"
APP="games/Ranger-Adventures/app"

MAX_RUNS="${1:-200}"                        # safety cap — auto-stop after this many sittings
MODEL_OPUS="${MODEL_OPUS:-opus}"            # the BUILDER (writes the TypeScript) — 'opus' = latest Opus (4.8)
MODEL_FABLE="${MODEL_FABLE:-claude-fable-5}"  # the ART DIRECTOR (proposes + judges)
EFFORT="${EFFORT:-xhigh}"                    # ~8h open-ended run → xhigh balances quality vs throughput
STALL_LIMIT=2                                # WORK box: this many failed sittings → park to DEFERRED.md + continue (Floris "two loops"); DIRECTION/GATE still pauses
stall=0

# ── FABLE → OPUS FALLBACK (Floris 2026-07-03) ────────────────────────────────
# The art-director role prefers Fable (taste + multimodal), but Fable tokens are
# a smaller pool than Opus. When a FABLE-role sitting (DIRECTION or GATE) hits a
# usage/model limit, we do NOT pause the whole run — we fall back to Opus
# (opus 4.8, same --effort xhigh) for the director role and CONTINUE, retrying
# that box on Opus next iteration. Self-correcting: if the whole account is out,
# the retried Opus sitting also hits the limit and THAT triggers the real stop
# (one extra cheap failed sitting, then a clean pause). Latch = fall back once.
# Manual path: launch with MODEL_FABLE=opus to run the director on Opus from the
# start (e.g. when you already know Fable is out).
FABLE_FELL_BACK=0

# ranger-run.mjs selects the active ledger via RUN_LEDGER (relative to the game
# dir, .../Ranger-Adventures). Exported so tick/commit/status/gate target RUN-C-LEDGER.
export RUN_LEDGER="runs/run-4-experience/RUN-C-LEDGER.md"

# Run C SCOPE: automated verification is LAPTOP-ONLY — `npm run capture` captures
# the laptop project only (the iPad leg hangs the software renderer, F-21, same as
# Run B). iPad is verified on Floris's real device in the DEMO section.
# Re-enable iPad auto-capture with CAPTURE_PROJECTS="laptop,ipad" once F-21 is fixed.
export CAPTURE_PROJECTS="${CAPTURE_PROJECTS:-laptop}"

# usage-guard input: the per-launch wall-clock start (for the optional session
# cap). The weekly-limit stop is the supervisor's per-sitting break-detection
# below, not the guard. See usage-guard.mjs for every knob.
export RUNC_LOOP_START_EPOCH="$(date +%s)"

# First unchecked WORK/DIRECTION/GATE box. Skips Floris-only DEMO + parked
# DEFERRED boxes FIRST, then takes the first survivor, so a skipped box mid-list
# can't read as "done".
next_work_box() { grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null | grep -vE 'DEMO ·|DEFERRED' | head -1; }
# Any unchecked box at all (incl. DEMO) — to tell "all done" from "demo pending".
any_unchecked()  { grep -m1 -E '^[[:space:]]*-[[:space:]]*\[ \]' "$LEDGER" 2>/dev/null; }
# Count of ticked boxes (any) — a rise means the ledger ADVANCED → commit that step.
ticks_done() { grep -c -E '^[[:space:]]*-[[:space:]]*\[[xX]\]' "$LEDGER" 2>/dev/null; }

if [ ! -f "$LEDGER" ]; then
  echo "✗ no RUN-C-LEDGER.md at $LEDGER." | tee -a "$LOG"; exit 1
fi

# ── PREFLIGHT: only after Run B is finished, and only one Run C at a time ─────
# Run B and Run C share the audit-evidence screenshot dir + the git repo, so they
# must never run at once. (Override with RUNC_SKIP_PREFLIGHT=1 if you know better.)
if [ -z "${RUNC_SKIP_PREFLIGHT:-}" ]; then
  if pgrep -f 'build-run-loop\.sh' >/dev/null 2>&1; then
    echo "✗ Run B (build-run-loop.sh) is STILL RUNNING — Run C must not start until it finishes (shared screenshots + git). Wait for BUILD-COMPLETE, or set RUNC_SKIP_PREFLIGHT=1 to override." | tee -a "$LOG"; exit 1
  fi
  BLEDGER="games/Ranger-Adventures/runs/run-3-ux-polish/BUILD-LEDGER.md"
  if [ -f "$BLEDGER" ] && grep -E '^[[:space:]]*-[[:space:]]*\[ \]' "$BLEDGER" | grep -vqE 'DEMO ·|DEFERRED'; then
    echo "✗ Run B still has unchecked build boxes ($BLEDGER) — Run C waits until Run B is done (or RUNC_SKIP_PREFLIGHT=1)." | tee -a "$LOG"; exit 1
  fi
fi
# Single-instance lock (atomic mkdir; auto-released on exit) — no double Run C.
LOCK="$DIR/.run-c.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "✗ another Run C appears to be running (lock exists: $LOCK). If it is not, remove it: rmdir $LOCK" | tee -a "$LOG"; exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# ── CAPTURE OWNERSHIP (the run-2 stall fix — carried verbatim) ───────────────
# The supervisor — NOT the model sittings — runs `npm run capture`. A `claude -p`
# sitting can't block for the whole capture, so it used to background it and
# yield, and the box never got graded → the loop stalled. Here the loop blocks on
# capture itself (it has no time limit), then hands the finished shots to a grade
# sitting. Model sittings NEVER run capture.
# NB: the capture output path is hardcoded in app/e2e-capture/** to
# ../runs/run-3-ux-polish/audit-evidence — Run C REUSES that shared evidence dir
# (Run B is finished; its frames are the baseline). Grade/gate sittings read there.
capture_now() {
  echo "  📸 supervisor runs capture (${CAPTURE_PROJECTS}) — $(date '+%T')" | tee -a "$LOG"
  if ( cd "$APP" && npm run capture ) >> "$LOG" 2>&1; then
    echo "  ✓ capture complete $(date '+%T')" | tee -a "$LOG"
  else
    echo "  ⚠ capture exited non-zero — grader may see partial/stale shots (will not tick)" | tee -a "$LOG"
  fi
}

# ── DEFER-AND-CONTINUE + NEEDS-FLORIS PARK (Floris 2026-07-04) ────────────────
# Run C's own parked-box list (mirrors Run B's). A WORK box the loop cannot close
# on its own — either it fails its own screenshot grade STALL_LIMIT sittings
# running, or a sitting prints "NEEDS-FLORIS: …" — is marked DEFERRED in the
# ledger (so next_work_box skips it) and appended here, and the loop moves on.
# Floris works this list as ONE batch later. DIRECTION/GATE boxes are NEVER parked
# (skipping one would break the run — a phase can't seal without its gate).
DEFERRED_LIST="$DIR/DEFERRED.md"
defer_first_work_box() {
  local why="$1"
  # mark the FIRST unchecked non-DEMO/non-DEFERRED box (the one just served + failed)
  awk '
    BEGIN { done = 0 }
    done == 0 && /^[[:space:]]*-[[:space:]]*\[ \]/ && $0 !~ /DEMO ·/ && $0 !~ /DEFERRED/ {
      sub(/\[ \][[:space:]]*/, "[ ] DEFERRED · ")
      done = 1
    }
    { print }
  ' "$LEDGER" > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"
  if [ ! -f "$DEFERRED_LIST" ]; then
    printf '# Run C — deferred boxes (auto-parked; Floris batch worklist)\n\nWORK boxes the autonomous Run C loop could not close on its own — either it failed its own screenshot gate %s sittings running, or a sitting flagged it needs Floris (a decision, a real device, an asset only Floris can supply, an on-device demo). Each stays parked so the run keeps making progress on everything else. Work these hands-on.\n\n' "$STALL_LIMIT" > "$DEFERRED_LIST"
  fi
  {
    printf -- '- **%s**\n' "$clean_box"
    printf -- '  - parked %s · %s\n' "$(date '+%F %T')" "$why"
    printf -- '  - evidence: RUN-C-LOOP.log around this time + runs/run-3-ux-polish/audit-evidence/laptop/\n'
  } >> "$DEFERRED_LIST"
}

# ── FABLE · the DIRECTION author (Phase 0 — writes RUN-C-DIRECTION.md) ────────
FABLE_DIRECTION_PROMPT='You are the ART DIRECTOR of Ranger van de Veluwe RUN C (Fable-directed EXPERIENCE/POLISH run). Your FIRST act — before any build — is to WRITE and TICK the direction doc (VISION §10). Do it, then STOP.
1) Read IN FULL: games/Ranger-Adventures/VISION.md (the locked vision — Alvah-first; realistic/naturalistic animals; deepen & unify the existing canon; xeno-canto calls only; NO live checkpoints so the doc + hard gates carry the weight), then runs/run-4-experience/RUN-C-PLAN.md and RUN-C-LEDGER.md. Excavate the live canon it names: app/src/content/veluwe.ts (VERHAALBOOG_VELUWE season arc, the 10 missions, the cast, veldnotities), app/src/core/companion.ts (the raven), the 5 EF engines + their story framings (VISION §5), design/ontwerp-brief.md, app/src/core/readlevel.ts. Read app/scripts/asset-shotlist.json for the existing asset ids. ALSO read the in-repo RESEARCH the run already gathered and GROUND your art direction + realistic-animal targets in it — games/Ranger-Adventures/research/: animal-visual-accuracy.md and bird-visual-accuracy.md (species proportions/markings/calm pose — the realism reference the Meshy prompts must cite), veluwe-research.md (biome/light/landscape ground truth), 3d-animal-animation-research.md and humans-full-animals-eyes-research.md (rig/gait/gaze/eye realism), voice-tts-readaloud-research.md (read-aloud), mini-game-research.md (EF grounding). Cite the specific research facts each art-direction + per-animal note relies on, so realism is SOURCED, never invented.
2) WRITE games/Ranger-Adventures/runs/run-4-experience/RUN-C-DIRECTION.md — the single source of truth every later sitting re-reads. It MUST contain: (a) the ART-DIRECTION BIBLE — one naturalistic Veluwe at golden hour, concrete palette/light/material/tree-and-terrain targets that make realistic animals BELONG (VISION §6), screen-by-screen look targets (title → world → case-board → each of the 5 games → pause) so nothing reads as a different game; (b) the FELT-PROGRESS plan — exactly how a completed mission visibly changes the world (VISION §4a gap #1 / §5); (c) the RANKED MESHY ASSET LIST — impact-per-credit order (5 flagships + raven + player ranger FIRST, then other story animals, then world-naturalism assets), each with an existing asset-shotlist id where one exists, a rough credit estimate, and the never-scary/calm-pose note; (d) the per-screen "excellent" bar (VISION §9) as the terminator, and the §13 priority order so an early stop still ships the best 20% first.
3) FROZEN CONTRACTS are inviolable and excellence is pursued WITHIN them (VISION §11): motion-comfort camera law, never-scary/never game-over, ≥56 px targets, <150 draw calls, pixelRatio ≤2, iPad-first, persistence only via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (no new keys), M3/E3 Dutch ≤7 words + read-aloud on new strings, construct-parity + 2D floor per game, assets via assetUrl, no surnames, never print .env.local. Write these into the doc as the guardrails. NOTE the ONE relaxation Floris authorized for Run C (2026-07-03): NEW DEPENDENCIES ARE ALLOWED — you MAY use web search + fetch to research open-source repos/libraries, and where a well-licensed (MIT/Apache/CC0/BSD) self-contained library clearly raises realism or cohesion, RECOMMEND it in the ranked plan (name it + why + license) for the builder to install. The frozen PERF/COMFORT contracts still bind any dep: it must hold <150 draw calls, pixelRatio ≤2, iPad-first, keep build + e2e:smoke green, add NO runtime network/telemetry/CDN calls (client-side-only, no third-party trackers), and never trade away motion-comfort/never-scary. A dep that cannot meet those is not worth it — say so.
4) TRIAGE THE RUN B CARRY-OVER (Floris 2026-07-04): read games/Ranger-Adventures/runs/run-3-ux-polish/DEFERRED.md — the boxes Run B parked because it could not crack them on its own (the avatar-scale / follow-camera / spawn-fade nut and any siblings). For EACH parked item, decide which Run C phase it belongs to and APPEND a retry box to that phase in RUN-C-LEDGER.md, in the exact box format: "- [ ] Pn.m · <what to fix> (retry from Run B DEFERRED) · verify-by: <one concrete laptop-screenshot criterion>". Put the scale/camera/spawn proportion work as an EARLY Phase 1 box (before the screen-specific look boxes) — the ranger must read at believable proportion before any screen can look right. These retries become first-class Run C boxes: Fable directs them and a fresh screenshot gates each, which is exactly the muscle Run B lacked. If DEFERRED.md is absent or empty, add one line to RUN-C-DIRECTION.md noting there was no Run B carry-over, and continue.
5) You change NO game code in this sitting. When the doc is complete AND the carry-over is filed, tick the DIRECTION box: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "RUN-C-DIRECTION" (build/e2e:smoke stay green for a docs-only change, so the tick passes). Do NOT commit (the supervisor commits this step). Then STOP.'

# ── OPUS · the FIX half (code change only — no capture, no tick) ─────────────
OPUS_FIX_PROMPT='You are the FIX half of one Ranger van de Veluwe RUN C EXPERIENCE sitting. You are the BUILDER; Fable is the art director. You make the CODE CHANGE for ONE box toward RUN-C-DIRECTION.md. You do NOT screenshot and you do NOT tick — the supervisor runs the capture right after you, and a separate grade sitting judges it. Make the change, then STOP.
1) Read runs/run-4-experience/RUN-C-DIRECTION.md (the art-direction bible + felt-progress plan + ranked asset list — the single source of truth), then RUN-C-PLAN.md (the per-box screenshot gate §1, the hybrid two-judge gate §2, asset discipline §3, frozen contracts §4), then RUN-C-LEDGER.md. Reference the live canon (app/src/content/veluwe.ts, core/companion.ts, the 5 engines) + root CLAUDE.md.
2) Take the FIRST unchecked WORK box (`- [ ] Pn.m …`, NOT a DIRECTION/GATE/DEMO/DEFERRED box). Make the change under app/src/** so that screen/system converges to the direction doc. Expose any dev-hook field the box’s verify-by needs; if the assert needs a new scene/input, extend the capture harness (app/e2e-capture/**) — never the frozen app/e2e/** tree. SCOPE IS LAPTOP-ONLY — make shared-code fixes for "both"/"iPad" boxes but do not chase iPad pixels (iPad is demo-gated). NEW DEPENDENCIES ARE AUTHORIZED for Run C (Floris 2026-07-03): you MAY web-search/fetch to find an open-source solution and `npm install` a well-licensed (MIT/Apache/CC0/BSD), self-contained library — ideally one RUN-C-DIRECTION.md recommends — when it clearly raises realism/cohesion. Guardrails that still bind every dep: keep build + e2e:smoke green, hold <150 draw calls + pixelRatio ≤2 + iPad-first, add NO runtime network/telemetry/CDN/tracker calls (client-side-only), let the supervisor commit the package.json + lockfile with the step, and never trade away a motion-comfort/never-scary contract. If a dep cannot meet those, do not add it — solve it in-repo.
3) ASSET boxes: generate ONLY the model(s) the box names, ONLY via `node scripts/meshy-gen.mjs --only=<id>` (or `--limit=N`). NEVER an unfiltered assets / meshy-gen / assets:all / ranger-run.mjs run / npm run finish (that would re-buy the whole ~76-item cast). Meshy jobs exceed the 10-min tool ceiling → run them BACKGROUNDED and poll the log; never print .env.local (use scripts/meshy-balance.mjs for the masked balance). Every generated model must clear the SAME bar as any change: pipeline (meshy-gen → gltf-optimize → optimize-animated, <150 draw calls), the never-scary/calm-pose gate, and the screenshot judge (looks-real AND belongs → accept; else reject + regenerate). Log the credit spend for the box.
4) Do NOT run `npm run capture`. Do NOT tick any box. Do NOT commit. The supervisor captures next; a grade sitting decides the tick; the supervisor commits the step.
5) FROZEN CONTRACTS (a change that breaks one is not a fix): motion-comfort camera law (fixed FOV, roll 0, no shake/snap; reduced-motion = cuts; locomotion always allowed), never-scary/never game-over + calm-pose gate, ≥56 px targets, <150 draw calls, pixelRatio ≤2, persistence ONLY via state.ts/persist.ts in the alvah-ef-v1 ranger namespace (NO new localStorage keys), M3/E3 Dutch ≤7 words + read-aloud on new strings, construct-parity + 2D floor per game, assets via assetUrl (new deps ALLOWED per step 2 + its guardrails), no surnames, never print .env.local.
6) NEVER touch/weaken app/e2e/**, the @smoke suite, or playwright.config.ts. Do NOT re-litigate a screen a prior GATE already passed unless THIS box forces it.
7) NEEDS-FLORIS ESCAPE (Floris 2026-07-04): if this box genuinely CANNOT be done autonomously — it needs a human decision, a physical iPad/real-device check, an asset only Floris can supply, or an on-device demo — do NOT fake progress or thrash. Print, as your FINAL line and nothing after it, exactly: NEEDS-FLORIS: <one concrete line on what you need from Floris> — then STOP without changing code. The supervisor parks the box to the deferred worklist and moves on to the next box.
Make the change for exactly ONE box, then STOP. If every WORK box is already checked, reply exactly: RUN-C-COMPLETE.'

# ── OPUS · the GRADE half (judge the supervisor’s fresh shots, tick on green) ─
OPUS_GRADE_PROMPT='You are the GRADE half of one Ranger van de Veluwe RUN C EXPERIENCE sitting. The change for the FIRST unchecked WORK box was just made, and the supervisor has ALREADY run a fresh LAPTOP `npm run capture` — the new PNGs + annotations are on disk. Judge them against RUN-C-DIRECTION.md and tick ONLY on green. Do NOT run capture yourself.
1) Read RUN-C-DIRECTION.md (the look/felt-progress/asset targets), RUN-C-PLAN.md §1, and RUN-C-LEDGER.md. Identify the FIRST unchecked WORK box and its verify-by.
2) LOOK with the Read tool at the fresh laptop PNG(s) for that box under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ (the capture harness’s output path — Run C reuses it), and read annotations-laptop.json for the box’s named field. Grade against BOTH the box’s verify-by AND the direction doc’s bar for that screen (on-style + on-story + progress-felt where the box claims it). Pixels outrank the hook: if they disagree, trust the pixels. For an ASSET box, the model must look REAL and BELONG in the world (reject + regenerate if not) and pass the never-scary/calm-pose gate.
3) TICK ONLY ON GREEN. If the laptop screenshot AND the annotation assert both pass AND it meets the direction doc’s bar, tick: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<unique substring of the box text>" (this also refuses unless `npm run build` + the frozen `npm run e2e:smoke` are green). If the box has a +demo component (feel/audio/real-device), tick it but EDIT the box text to append " — implemented, awaiting Floris demo (NOT accepted)". If the grade FAILS, do NOT tick: leave the box open, append one line to RUN-C-PLAN §8 saying what still falls short of the direction doc, and STOP (the loop retries next iteration).
4) Do NOT commit (the supervisor commits the step). NEVER touch app/e2e/**, the @smoke suite, or playwright.config.ts.
5) NEEDS-FLORIS ESCAPE (Floris 2026-07-04): if this box keeps failing because it genuinely needs Floris — a human decision, a real-device/iPad check, an asset only Floris can supply, or an on-device demo — do NOT loop forever. Print, as your FINAL line and nothing after it, exactly: NEEDS-FLORIS: <one concrete line on what you need from Floris> — then STOP. The supervisor parks the box for Floris and continues with the next box.
Grade this ONE box, then STOP.'

# ── FABLE · the phase-gate re-judge / director (may re-open OR append boxes) ──
FABLE_GATE_PROMPT='You are the ART DIRECTOR and INDEPENDENT phase RE-JUDGE of Ranger van de Veluwe RUN C (hybrid gate — RUN-C-PLAN §2). You did NOT make these changes; do not trust the builder’s self-grade. The supervisor has ALREADY run a fresh LAPTOP capture — the new PNGs + annotations are on disk. Do NOT run capture yourself. You LOOK, rule, and DIRECT.
1) Read RUN-C-DIRECTION.md (your art-direction bible — you may refine it if a screen taught you something, but do not thrash a screen a prior gate already froze), RUN-C-PLAN §2, and RUN-C-LEDGER.md. The FIRST unchecked box is a GATE-Pn box — it names the phase you are judging.
2) LOOK at every laptop screenshot for that phase under games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/laptop/ (Read the PNGs) and read annotations-laptop.json. Judge each phase box against BOTH its verify-by AND the direction doc — cohesion (does it read as ONE naturalistic world?), realism + never-scary of any new animals, felt-progress (does the world visibly react?), legibility + ≥56 px targets, motion-comfort. iPad is demo-gated — judge laptop pixels only.
3) RULE + DIRECT: for each phase box genuinely excellent in the pixels, leave it ticked. For any that still falls short, RE-OPEN it (`- [x]` → `- [ ]`) and append one line to RUN-C-PLAN §8 saying what you see wrong vs the doc. As the DIRECTOR you MAY ALSO APPEND new `- [ ] Pn.m · …` cohesion boxes to this phase (with a verify-by) when the composed world reveals a gap the punch-list missed — the ledger is OPEN-ENDED, converging to the doc’s "excellent per screen" bar, not a fixed list. A +demo box may stay "implemented — awaiting Floris demo" but is NEVER "accepted". Only when you AGREE every non-demo box in the phase meets the bar AND no open box remains, tick the GATE: cd games/Ranger-Adventures/app && node scripts/ranger-run.mjs tick "<GATE-Pn substring>".
4) On the FINAL gate (GATE-P5): re-judge the WHOLE game against the direction doc — every screenshot-closable box, cohesion across all screens, all five games. This is the last gate before the Floris demo.
5) You change NO game code and never touch app/e2e/**, the @smoke suite, or playwright.config.ts. You only look, edit RUN-C-LEDGER.md ticks/boxes + RUN-C-PLAN §8, and (allowed) refine RUN-C-DIRECTION.md.
Do this ONE gate, then STOP. If it passes you tick it; if you re-open/append boxes you leave the gate unticked so the builder does the work.'

run_fable_direction() {
  claude -p "$FABLE_DIRECTION_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable DIRECTION sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_fix() {
  claude -p "$OPUS_FIX_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus FIX sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_opus_grade() {
  claude -p "$OPUS_GRADE_PROMPT" --model "$MODEL_OPUS" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ opus GRADE sitting exited non-zero (continuing)" | tee -a "$LOG"
}
run_fable_gate() {
  claude -p "$FABLE_GATE_PROMPT" --model "$MODEL_FABLE" --effort "$EFFORT" --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "  ⚠ fable GATE sitting exited non-zero (continuing)" | tee -a "$LOG"
}

echo "=== RUN C experience loop started $(date '+%F %T') · cap ${MAX_RUNS} · build=${MODEL_OPUS} direct/judge=${MODEL_FABLE} · effort ${EFFORT} ===" | tee -a "$LOG"
echo "    mode: DEFER-AND-CONTINUE — a WORK box stuck ${STALL_LIMIT} sittings OR one that prints NEEDS-FLORIS is parked to ${DEFERRED_LIST} and the loop moves on; a stuck DIRECTION/GATE still pauses. Every ledger advance is committed+pushed." | tee -a "$LOG"

for i in $(seq 1 "$MAX_RUNS"); do
  echo "──────── sitting $i/$MAX_RUNS  $(date '+%F %T') ────────" | tee -a "$LOG"

  box="$(next_work_box)"
  if [ -z "$box" ]; then
    if [ -n "$(any_unchecked)" ]; then
      echo "✅ RUN-C-COMPLETE — all active experience/gate boxes done. Only Floris-only DEMO + parked DEFERRED (iPad) boxes remain." | tee -a "$LOG"
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C experience phases complete (laptop) — awaiting Floris on-device demo (feel/audio/real-Safari/iPad) + iPad re-enable (DEMO/DEFERRED boxes in RUN-C-LEDGER.md).") >> "$LOG" 2>&1
    else
      echo "🎉 RUN-C-COMPLETE — every box in RUN-C-LEDGER.md is checked (after $((i-1)) sittings)." | tee -a "$LOG"
    fi
    break
  fi

  clean_box="$(printf '%s' "$box" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')"

  # ── USAGE / CREDIT STOP GATE (top of every iteration, before any spend) ─────
  # Pass --asset only when the next box generates a Meshy model, so a low balance
  # never blocks the credit-free art-direction / cohesion / reading work.
  guard_flags=""
  case "$box" in
    *[Mm]eshy*|*asset-gen*|*[Gg]enereer*|*[Gg]enerate*model*|*flagship*model*) guard_flags="--asset" ;;
  esac
  guard_out="$( (cd "$APP" && node scripts/usage-guard.mjs $guard_flags) 2>&1 )"; guard_rc=$?
  printf '%s\n' "$guard_out" >> "$LOG"
  if [ "$guard_rc" -ne 0 ]; then
    reason="$(printf '%s\n' "$guard_out" | grep -m1 '^STOP:' | sed 's/^STOP:[[:space:]]*//')"
    [ -z "$reason" ] && reason="usage-guard requested STOP (see RUN-C-USAGE-GUARD.log)"
    echo "⛔ usage-guard STOP — pausing (NEEDS-FLORIS): ${reason}" | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C paused by usage-guard: ${reason}") >> "$LOG" 2>&1
    break
  fi

  ticks_before="$(ticks_done)"
  before="$(md5 -q "$LEDGER")"
  log_off="$(wc -c < "$LOG" 2>/dev/null | tr -d ' ' || echo 0)"; [ -z "$log_off" ] && log_off=0

  role="opus"
  case "$box" in
    *DIRECTION*)
      role="fable"
      echo "  ✍ DIRECTION box (art director authors RUN-C-DIRECTION.md · model=${MODEL_FABLE}): $clean_box" | tee -a "$LOG"
      run_fable_direction ;;
    *GATE-*)
      role="fable"
      echo "  ▷ PHASE GATE (capture → art-director re-judge · model=${MODEL_FABLE}): $clean_box" | tee -a "$LOG"
      capture_now
      run_fable_gate ;;
    *)
      echo "  ▶ experience box (fix → capture → grade · build=${MODEL_OPUS}): $clean_box" | tee -a "$LOG"
      run_opus_fix
      capture_now
      run_opus_grade ;;
  esac

  after="$(md5 -q "$LEDGER")"
  ticks_after="$(ticks_done)"

  # ── USAGE-LIMIT DETECTION on THIS sitting's own fresh output ─────────────────
  # We cannot predict the weekly limit, so we detect it in THIS sitting's own
  # output. A hit on the FABLE role falls back to Opus (below); a hit on Opus (or
  # after the fallback latch) is the real weekly stop → pause gracefully.
  sitting_out="$(tail -c "+$((log_off + 1))" "$LOG" 2>/dev/null)"
  hit_limit=0
  if printf '%s' "$sitting_out" | grep -qiE 'usage limit reached|weekly limit|claude usage limit|limit will reset|resets? (at|on)|rate.?limit(ed|ing)?|429 too many|too many requests'; then
    hit_limit=1
  fi

  # ── FABLE → OPUS FALLBACK: a limit on the art-director (Fable) role does NOT
  # stop the run — switch the director role to Opus (opus 4.8) and retry this box
  # next iteration. Only once (latch); afterwards a limit is the real stop below.
  if [ "$hit_limit" -eq 1 ] && [ "$role" = "fable" ] && [ "$FABLE_FELL_BACK" -eq 0 ] && [ "$MODEL_FABLE" != "$MODEL_OPUS" ]; then
    echo "⚠ Art-director (Fable, ${MODEL_FABLE}) hit a usage/model limit → falling back to Opus (${MODEL_OPUS}, effort ${EFFORT}) for the director role and continuing. Retrying this box on Opus." | tee -a "$LOG"
    MODEL_FABLE="$MODEL_OPUS"; FABLE_FELL_BACK=1
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C: Fable tokens exhausted — art-director role switched to Opus (opus 4.8, xhigh). Run continues; no pause.") >> "$LOG" 2>&1
    stall=0
    sleep 5
    continue
  fi

  # ── "ACCEPT THE BREAK": stop cleanly on a REAL Claude usage-limit hit ────────
  # Nothing is lost; re-launch after the weekly window resets and it continues.
  if [ "$hit_limit" -eq 1 ]; then
    echo "⛔ Hit the Claude usage limit — pausing (NEEDS-FLORIS). Nothing lost; re-launch after your weekly window resets to continue from the next box." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C paused: hit the Claude usage limit. Re-launch after the weekly window resets to continue.") >> "$LOG" 2>&1
    break
  fi

  # COMMIT EVERY STEP (VISION §10): the ledger advanced (a box ticked, re-opened,
  # or a new cohesion box appended) → commit + push that step so drift is bisectable.
  if [ "$before" != "$after" ]; then
    echo "  ✔ ledger advanced (ticks ${ticks_before}→${ticks_after}) — committing + pushing this step." | tee -a "$LOG"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run C: ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ per-step commit/push reported a problem — check app/logs/git-push.log" | tee -a "$LOG"
  fi

  # Only WORK boxes are parked-and-continued; a stuck DIRECTION/GATE is a real halt
  # (skipping it would break the run — a phase can't seal without its gate).
  is_work_box=1
  case "$box" in *DIRECTION*|*GATE-*) is_work_box=0 ;; esac

  # ── NEEDS-FLORIS PARK: a WORK sitting that printed "NEEDS-FLORIS: <reason>" is
  # parked to DEFERRED.md (tagged) and the loop moves on — Floris gets ONE batched
  # worklist instead of a dead-stopped run. Detected in THIS sitting's own output.
  if [ "$is_work_box" -eq 1 ] && printf '%s\n' "$sitting_out" | grep -qE '^NEEDS-FLORIS:'; then
    nf_reason="$(printf '%s\n' "$sitting_out" | grep -m1 -E '^NEEDS-FLORIS:' | sed 's/^NEEDS-FLORIS:[[:space:]]*//')"
    [ -z "$nf_reason" ] && nf_reason="a sitting flagged it needs Floris (no reason given)"
    echo "🙋 '${clean_box}' NEEDS FLORIS — parking to ${DEFERRED_LIST} and moving on (not a halt): ${nf_reason}" | tee -a "$LOG"
    defer_first_work_box "NEEDS FLORIS · ${nf_reason}"
    (cd "$APP" && node scripts/ranger-run.mjs commit "Run C: parked (needs Floris) — ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
      || echo "  ⚠ needs-Floris park commit/push problem (continuing)" | tee -a "$LOG"
    stall=0; sleep 5; continue
  fi

  # ── STALL → DEFER-AND-CONTINUE: a WORK box that failed its own screenshot grade
  # STALL_LIMIT sittings running is parked and the loop moves on. A stuck
  # DIRECTION/GATE box still pauses (NEEDS-FLORIS) — it cannot be skipped.
  if [ "$before" = "$after" ]; then stall=$((stall + 1)); else stall=0; fi
  if [ "$stall" -ge "$STALL_LIMIT" ]; then
    if [ "$is_work_box" -eq 1 ]; then
      echo "⏭  '${clean_box}' unpassed for $STALL_LIMIT sittings — DEFERRING it to ${DEFERRED_LIST} and moving on (not a halt)." | tee -a "$LOG"
      defer_first_work_box "failed its own screenshot grade $STALL_LIMIT sittings running"
      (cd "$APP" && node scripts/ranger-run.mjs commit "Run C: deferred stuck box — ${clean_box} — $(date '+%F %T')") >> "$LOG" 2>&1 \
        || echo "  ⚠ deferred-box commit/push problem (continuing)" | tee -a "$LOG"
      stall=0
    else
      echo "⛔ Ledger unchanged for $STALL_LIMIT sittings on a DIRECTION/GATE box — pausing (NEEDS-FLORIS). Check $LOG and the fresh screenshots." | tee -a "$LOG"
      (cd "$APP" && node scripts/ranger-run.mjs status --blocker="Run C stalled on: ${clean_box}. Check RUN-C-LOOP.log + runs/run-3-ux-polish/audit-evidence/.") >> "$LOG" 2>&1
      break
    fi
  fi
  sleep 5
done

echo "=== Run C experience loop ended $(date '+%F %T') ===" | tee -a "$LOG"
echo "Ledger:    $LEDGER" | tee -a "$LOG"
echo "Direction: $DIR/RUN-C-DIRECTION.md   ·   Fresh shots: games/Ranger-Adventures/runs/run-3-ux-polish/audit-evidence/" | tee -a "$LOG"
