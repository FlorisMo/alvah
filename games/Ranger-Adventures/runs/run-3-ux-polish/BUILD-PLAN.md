# Run 3 · Run B — the OPUS BUILD (fixes the game, screenshot-in-the-loop)

> Master brief for the build sittings. The tickable checklist is
> [BUILD-LEDGER.md](BUILD-LEDGER.md); the punch-list it executes is
> [AUDIT-FINDINGS.md](AUDIT-FINDINGS.md) (Fable wrote it in Run A). The
> supervisor is `build-run-loop.sh` (Opus `--effort max`, with a Fable re-judge
> at each phase boundary). START by re-reading AUDIT-FINDINGS.md § Self-audit
> §5 (phase order) + §3 (coupling), then [FINDINGS.md](FINDINGS.md) (why run 3
> exists). This is the **hands** run — Run A was the eyes.

> **SCOPE — LAPTOP-ONLY automated verification (Floris, 2026-07-03).** The loop
> captures the **laptop** project only (`CAPTURE_PROJECTS=laptop`, set by
> `build-run-loop.sh`); the iPad leg hangs the software renderer before the
> jeep/board/mission/RM scenes (F-21) and re-stalls the loop. So: grade every
> finding on **laptop** pixels + asserts; make the shared-code fix for "both"
> findings; and treat **all iPad-specific / iPad-pixel verification** (F-13,
> iPad tap targets, touch steering, board-vs-joystick corner, real-Safari) as
> **demo-gated — Floris on the real device** (BUILD-LEDGER DEMO section).
> iPad auto-capture returns with `CAPTURE_PROJECTS=laptop,ipad` once the render
> hang is solved. This does not change any fix — only where it is *verified*.

## 0. What this run is (and is NOT)

Run A looked at the game and produced 34 findings. Run B **fixes them**, and —
this is the whole point — it does NOT grade its own homework the way run 2 did.
Run 2 shipped a giant avatar and a gliding capsule because its gate proved
*mechanics* ("position moved ≥2 m", "a clip named walk exists") and never looked
at the screen. Run B closes that with a **two-judge visual gate** (§8).

- **You change game code** under `app/src/**` — that is the job. But every fix
  is gated on a fresh rendered screenshot, not on the fact that the code
  compiles.
- **You may re-run and harden the capture harness** (`app/e2e-capture/**`) — it
  is the shared verification substrate.
- **You never touch or weaken the frozen `app/e2e/**` specs, the `@smoke`
  suite, or `playwright.config.ts`.** They are the regression guard.

## 1. The per-box gate (screenshot-in-the-loop)

For each work box, in order:

1. **Read the finding** in AUDIT-FINDINGS.md (defect, concrete fix, verify-by,
   contract-check). Make the fix under `app/src/**`.
2. **Expose what the assert needs.** Many verify-bys reference a dev-hook field
   (`avatar.height`, `cam.dist`, `cam.target`, ground speed, quaternion yaw,
   same-frame `drawCalls`). Add those to the dev hook as part of the fix, and —
   if the assert needs a new scene/input/idle-pair — extend the capture harness
   (`app/e2e-capture/**`, allowed) so its `annotations-<platform>.json` carries
   the evidence. This is how a finding's "E2E assert" is realised **without
   touching the frozen `app/e2e/**` tree**: the hardened capture harness writes
   the field, and you grade it. (If an assert is genuinely cleaner as a
   standalone spec, add a NEW file in a NEW tree — never edit `app/e2e/**`.)
3. **Re-capture:** from `app/`, `npm run capture`. This overwrites
   `audit-evidence/` with fresh PNGs + annotations for both platforms. (The Run
   A frames are safe — Phase 0 archived them to `audit-evidence-baseline-run-a/`.)
4. **Grade your OWN fresh screenshot** against the finding's visual criterion —
   actually LOOK at the PNG with the Read tool, on BOTH platforms where the
   finding says `both`. AND check the finding's named field/condition in
   `annotations-<platform>.json`.
5. **Regression gate:** tick via `node scripts/ranger-run.mjs tick "<needle>"`
   — it refuses the tick unless `npm run build` AND the frozen `npm run
   e2e:smoke` are green. (Set `RUN_LEDGER=runs/run-3-ux-polish/BUILD-LEDGER.md`
   — the supervisor exports it for you.)
6. **Tick ONLY if all pass** — own-screenshot + annotation assert + build +
   smoke. If your own grade fails, DO NOT tick; leave the box open, note why,
   and stop so the next sitting retries. A repeatedly-failing box self-pauses
   the loop for Floris (stall guard) — that is correct.

The supervisor commits + pushes once per phase (at the `GATE`), reusing
`ranger-run.mjs commit`. You do not commit inside a work sitting.

## 2. The HYBRID phase gate (AUDIT-PLAN §8, Floris 2026-07-03)

The builder does NOT close a phase alone. Each phase ends with a `GATE-Pn` box
run by an **independent Fable sitting** (`claude-fable-5`):

- Fable re-captures (a fresh set reflecting the whole phase), re-judges that
  phase's screenshots against every phase-finding's criterion, and either
  **ticks the GATE** (it agrees the phase's boxes are genuinely fixed) or
  **re-opens** one or more boxes (`[x]`→`[ ]`, gate left unticked) so the loop
  returns to Opus to redo them.
- **A finding is only "fixed" when BOTH agree** (builder's own capture AND
  Fable's re-judge) **and the E2E/smoke asserts are green.**
- **`needs-Floris-demo` items are never closed by either model.** They may reach
  "implemented — awaiting demo"; the FEEL/AUDIO/real-Safari verdict is Floris's
  on-device call only. The +demo findings are **F-06, F-08, F-10, F-15, F-16,
  F-17, F-25, F-30, F-32, F-34** (§ Self-audit §4). The DEMO section of the
  ledger is Floris-only; the supervisor pauses there with NEEDS-FLORIS.

## 3. Phase order (FROZEN — AUDIT-FINDINGS § Self-audit §5)

Do not resequence. Each phase ends with a both-platform re-capture + Fable
re-judge.

- **Phase 0 — protect + see (no game code):** archive the Run A evidence FIRST;
  F-21 harness hardening (scene-isolated pages, TOUCH-driven walkTo/steering on
  the iPad project, crash retry); F-34a `boot()` returning-player fix. Exit: a
  full both-platform capture set (board + mission + reduce-motion included, iPad
  driven by touch) exists.
- **Phase 1 — core (area A):** F-07 scale → F-05 camera + F-18 pose fields →
  F-09 spawn → F-08 speed/stride; re-check F-10/F-12/F-33; triage the expected
  new world-look findings before Phase 2.
- **Phase 2 — controls (B + C):** F-16 zoom, F-17 orbit (tap-to-walk seam
  asserted both ways); F-30 vehicle camera → F-31 boarding → F-32 steering
  asserts + comfort tuning.
- **Phase 3 — navigation + HUD (D + E + F):** one ≥56 px chip token
  (F-02/F-14/F-20/F-25/F-28 + F-01 card-fit); one navigation model
  (F-27/F-26/F-20); one hint system (F-06/F-15 + F-11-hint + F-13).
- **Phase 4 — reading + dressing (G + H):** F-03, F-25, F-22, F-23, F-04, F-11,
  F-29.
- **Phase 5 — RM + final sweep:** F-34b–d (both gates, burst pairs, cut-not-move
  assert), full re-capture, final Fable re-judge, then the Floris demo.

### Coupling rules (§ Self-audit §3 — respect them)

- **F-07 → F-05 → {F-08, F-09, F-16, F-17, F-19, F-24, F-30}.** Scale FIRST; no
  camera work before F-07 (F-05's clamp is defined off the avatar's radius,
  F-08's speed is giant-tuned). Anything tuned before the rescale is redone.
- **F-05 ⊕ F-18 land together** — the rebuilt rig must expose the REAL pose
  fields, or every downstream camera assert (F-16/F-17/F-30/F-32/F-34d) sits on
  telemetry that already lied once (pixel-identical frames, moving yaw).
- **F-33, F-12, F-10 are re-checks, not fixes** — expected to dissolve after
  F-07/F-05; spend fix effort only on survivors.
- **F-17 ↔ tap-to-walk seam** — the click-vs-drag discriminator must kill the
  orbit misfire WITHOUT breaking tap-to-walk; assert both sides.
- **F-30 reuses F-05's rig; F-31's fallback (visible driver vs hidden) sets
  F-30/F-31's verify criterion; F-32's asserts need F-30 + F-18 (+ P0.2 touch
  for iPad).**
- **One chip token: F-02 + F-14 + F-20 + F-25 + F-28, with F-01 in the same
  change** (bigger targets push the avatar card off-fold unless compaction ships
  with them).
- **One hint system: F-06 + F-15 (+ F-11 boundary hint + F-13 tracker move).**
- **One navigation model: F-27 + F-26 + F-20** — a rule, not three patches.
- **Substrate before gates: F-21 + F-34a + evidence archiving precede ALL
  re-captures** (`audit-evidence/` is git-ignored; the first capture destroys
  the frames the findings cite unless archived first).

## 4. The verification substrate (what the asserts read)

The capture harness boots the real game and writes, per shot, the live dev-hook
state into `annotations-<platform>.json`: `screen`, `pos`, `cameraYaw`,
`drawCalls`, `missionView`, `clip`, `veh` (heading/speed/inVehicle), `board`,
`vehicle`. Run B's fixes ADD fields (`avatar.height`, `cam.dist`, `cam.target`,
quaternion-derived yaw/pitch, same-frame `drawCalls`, ground speed) and, where
needed, ADD scenes/inputs (idle-stability pair, control-condition steering,
touch drive). You grade the finding's numeric criterion off those fields.

**Pixels are the court of appeal.** F-18 proved the hook can contradict the
render (yaw moved between pixel-identical frames). For every camera claim, the
screenshot outranks the field — if they disagree, trust the pixels and fix the
telemetry.

## 5. Frozen contracts (a fix that breaks one is NOT a fix)

Carry these into every change (FINDINGS.md / WORLD-PLAN §3.4 / root CLAUDE.md):

- **Motion-comfort camera law:** fixed FOV, roll 0, no head-bob / motion-blur /
  snap-rotate / FOV-kick / screen-shake; reduced-motion turns camera *moves*
  into cuts; locomotion itself always allowed. Any orbit/zoom/reframe must be
  player-initiated + damped.
- **Never-scary / never game-over**, calm-pose gate for animals. Leaving/stopping
  reads as neutral navigation — no "weet je het zeker?" guilt copy.
- **≥56 px tap targets; <150 draw calls; pixelRatio ≤ 2; iPad-first.**
- Persistence ONLY via `state.ts`/`persist.ts` in the `alvah-ef-v1` `ranger`
  namespace — **no new localStorage keys** (one-time-hint flags included).
- Reading M3/E3, ≤7 words per visual line, **read-aloud on new strings**.
- **No new dependencies** without Floris's OK. Assets via `assetUrl`
  (hand-drawn in-repo vectors need no pipeline). No surnames, no third-party
  runtime scripts. **Never print `.env.local` values.**

## 6. Hard prohibitions

- Do NOT touch/weaken `app/e2e/**`, the `@smoke` suite, or
  `playwright.config.ts`. New verification lives in the capture harness or a NEW
  separate tree.
- Do NOT resequence the phases or skip the F-07-first ordering (§3).
- Do NOT mark any +demo finding "fixed" — "implemented — awaiting demo" is its
  ceiling for any automated gate.
- Do NOT invent a pass. If your own screenshot fails the criterion, leave the
  box open and say so. Honest red beats a false green — that is the entire
  reason this run exists.
- Never commit `.env.local` or `assets-gen/`; never print secret values.

## 7. Build order recap + the single highest-leverage fix

**F-07 (normalize the avatar to ~1.7 m) is upstream of both blockers' geometry,
of F-08's speed, and of the murk behind F-12/F-19/F-24/F-29 and the whole F-33
"blur".** It converts five findings into re-checks and unveils the world every
later judgement needs. F-05 is the fix the player *feels* first; F-07 is the
root it hangs off. Land them as a pair, **scale first**, and re-capture before
touching anything else.

## 8. Run B log (append-only, one line per surprise)

- (add entries here as the build learns things about the harness, the engine, or a finding that turned out different once the murk cleared)
- **P0.1** — deliberately ran NO `npm run capture` (its verify-by is "nothing captured yet"; the first capture would overwrite the very frames F-01..F-34 cite — §3 substrate rule). Graded by folder-contents instead: baseline holds 22 laptop + 16 ipad + 18 crop PNGs + both annotations (byte-identical, `diff -rq` clean); source mtimes unchanged. Mirrored the existing `audit-evidence/*/` .gitignore rule onto `audit-evidence-baseline-run-a/*/` + its `index.html` so the supervisor's `git add -A` tracks only the annotations + README, not the ~56 heavy PNGs (honours the box's "git-add the annotations + a README").
