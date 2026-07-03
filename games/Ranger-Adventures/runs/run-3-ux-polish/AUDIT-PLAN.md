# Run 3 · Run A — the FABLE AUDIT (plan-only, changes NO game code)

> Master brief for the audit sittings. The tickable checklist is
> [AUDIT-LEDGER.md](AUDIT-LEDGER.md); Fable writes findings into
> [AUDIT-FINDINGS.md](AUDIT-FINDINGS.md). The supervisor is `audit-run-loop.sh`
> (model = `claude-fable-5`). START by reading [FINDINGS.md](FINDINGS.md) — it is
> why this run exists.

## 0. What this run is (and is NOT)

This is the **eyes** run. Run 2 shipped a huge avatar and a gliding capsule
because its gate proved *mechanics* ("position moved ≥2 m", "a clip named walk
exists") and never **looked at the screen**. Run A's only job is to LOOK: a cheap
scripted harness already captured a screenshot of every screen + key state on
both form factors (see below); you critique those images and turn Floris's
punch-list into an executable, verifiable plan.

- **You change NO game code.** Not one line under `app/src/**`. If you feel the
  urge to fix, write the fix down as a finding instead — Run B (Opus) executes it.
- **You only read pixels + state and write markdown** (AUDIT-FINDINGS.md,
  AUDIT-LEDGER.md ticks, and short notes here in §9).
- The design decisions are **yours** (camera distance, framing, control scheme
  feel). Don't wait to be told the "right" number — judge it from the image and
  the frozen contracts, and say what you'd change.

## 1. The evidence you judge

A model-free Playwright harness (`app/e2e-capture/`) boots the REAL game on the
dev server, walks the actual player flow, and writes:

- `audit-evidence/laptop/NN-<name>.png` — laptop viewport (1280×800, mouse +
  trackpad-wheel + keyboard).
- `audit-evidence/ipad/NN-<name>.png` — iPad (gen 7) landscape viewport + touch.
- `audit-evidence/annotations-<platform>.json` — per shot: the live dev-hook
  state (`screen`, `pos`, `cameraYaw`, `drawCalls`, `missionView`, `clip`) +
  a Dutch caption saying what to look for.
- `audit-evidence/index.html` — the contact sheet (laptop vs iPad side by side,
  bursts with per-frame Δpos + clip). Open it, or read the PNGs directly with
  your image tool.

**Regenerate anytime** (nothing depends on model output): from `app/`,
`npm run capture`. It is deterministic and cheap — never a reason to skip looking.

### What the stills CAN and CANNOT prove (design constraint)

- **CAN** (judge freely): framing, avatar scale, camera clipping, beauty, UI
  presence/layout, readable text, tap-target size, whether a HUD element exists.
- **CANNOT** from one frame: smoothness, input lag, motion comfort, and
  gliding-vs-walking. For the last one the harness gives a **burst** (walk-1..5,
  jeep-drive-1..4): the annotation prints Δpos between frames and the active
  `clip`. **pos moved while `clip` is null → the mesh is gliding** (that is the
  run-2 bug, data-backed, not a guess). Steering: jeep `heading`/`cameraYaw`
  unchanged across the drive burst while a turn key is held → steering is dead.
- **Genuinely needs Floris:** true latency + motion comfort → mark those
  `Verify by: needs Floris demo`. Never claim them fixed.

## 2. The punch-list you are grounded in (FINDINGS.md)

Every one of these MUST end up as a finding (confirm from the images, don't just
copy — say what the image shows):

1. Avatar enormous / camera clipped inside it (see world-entry + walk burst).
2. Everything glides — placeholder capsule, walk clip not driving the mesh.
3. Jeep does not steer; render drowned in blur/DOF.
4. No camera control on laptop — no trackpad zoom, no orbit (camera-attempt shots).
5. No "back / main menu" path (pause-hub shot).
6. Overall feels far from finished — decompose this into concrete, fixable items.

Then go BEYOND the list: anything the images reveal (ugly framing, unreadable
text, tiny targets, broken reduce-motion look, iPad joystick wrong size…).

## 3. The finding schema (write each into AUDIT-FINDINGS.md)

One block per finding, id `F-01`, `F-02`, … Most-severe first within each group.

```
### F-01 · <short title>
- **Defect:** what is wrong, as seen in the image (name the file).
- **Platform:** iPad | laptop | both
- **Evidence:** audit-evidence/<platform>/NN-<name>.png  (+ burst frames if relevant)
- **Severity:** blocker | major | minor | polish
- **Concrete fix:** the specific change Run B (Opus) should make. Be concrete
  (e.g. "raise camera to eye height ~1.6 m, pull back to ~4.5 m, aim at chest")
  but leave the exact tuning to the builder's screenshot-in-loop.
- **Verify by:** screenshot  |  E2E assert (`<dev-hook field or spec name>`)  |  needs Floris demo
- **Confidence:** high | med | low
- **Contract check:** does the fix risk a frozen contract (§5)? name it + how to stay safe, or "none".
```

## 4. The audit ledger (how the loop advances)

[AUDIT-LEDGER.md](AUDIT-LEDGER.md) has one `- [ ]` box per capture group plus a
synthesis box and a self-audit box. Each sitting: do the FIRST unchecked box —
look at every image in that group on BOTH platforms, write its findings into
AUDIT-FINDINGS.md, then tick the box (edit `[ ]`→`[x]`). Stop after 1–2 boxes so
the loop re-invokes you fresh. If the capture for a group is a GAP (harness
failed to reach it), that is itself a finding — record it and tick.

## 5. Frozen contracts (a fix that breaks one is not a fix)

Carry these from FINDINGS.md / WORLD-PLAN §3.4 into every "Concrete fix":

- **Motion-comfort camera law:** fixed FOV, roll 0, no head-bob / motion-blur /
  snap-rotate / FOV-kick / screen-shake; reduced-motion turns camera *moves*
  into cuts; locomotion itself always allowed. (A laptop orbit/zoom fix must be
  player-initiated + damped, and must respect this.)
- **Never-scary / never game-over**, calm-pose gate for animals.
- **≥56 px tap targets; <150 draw calls; pixelRatio ≤ 2; iPad-first.**
- Persistence ONLY via `state.ts`/`persist.ts` in `alvah-ef-v1` `ranger`
  namespace — **no new localStorage keys**.
- Reading M3/E3, ≤7 words per line, read-aloud on new strings.
- **No new dependencies** without Floris's OK. Assets via `assetUrl`. No
  surnames, no third-party runtime scripts. Never print `.env.local` values.

## 6. Deep self-audit (the LAST box — do it seriously)

After all groups are critiqued, write the **§ Self-audit** section in
AUDIT-FINDINGS.md answering, honestly:

1. **If every fix in this list lands, will the game LOOK right and CONTROL right
   on BOTH iPad and laptop?** Where are you unsure?
2. **What did the stills NOT cover** that could still be broken (a screen the
   harness never reached, a state not captured, a claim only a demo can settle)?
3. **Which findings are coupled** (fixing one changes another — e.g. camera
   distance vs avatar scale) so Run B sequences them right?
4. **Which items are `needs Floris demo`** and must NOT be marked "fixed" by any
   screenshot gate?
5. If you were the builder, **what order** would you do these in, and what is the
   single highest-leverage fix?

## 7. Hard prohibitions

- No edits under `app/src/**` (or anywhere in game code). Findings only.
- Never weaken or touch the frozen `e2e:smoke` suite, `playwright.config.ts`, or
  the `app/e2e/**` specs. The capture harness (`app/e2e-capture/**`) is yours to
  re-run, not to gut.
- Do not invent facts about the game — every finding cites a screenshot you
  actually looked at. If the harness didn't capture something, say so.
- Never print/log secret values. Never commit `.env.local` or `assets-gen/`.

## 8. Run B (Opus BUILD) — documented next step (NOT this run)

Run B works down the approved AUDIT-FINDINGS.md with a **screenshot-in-the-loop
gate**: for each finding it makes the fix, then RE-RUNS the same capture harness
(`npm run capture`) and only ticks when its own freshly captured image passes the
finding's visual criteria (and the named E2E assert is green). It reuses this
exact harness — that is why the harness is model-free and lives in the app. The
`needs Floris demo` items stay open for the on-device pass; they are never
self-certified. Run B's supervisor mirrors `audit-run-loop.sh` with model =
`opus` and the tick gated on build + `e2e:smoke` (via `ranger-run.mjs`).

**Visual-gate policy — HYBRID (Floris, 2026-07-03).** The builder does NOT grade
its own homework alone (that was run 2's trap). Each box: Opus makes the fix +
checks its OWN freshly captured screenshot against the finding's criteria; then
at every phase boundary an **independent Fable sitting re-judges** the phase's
screenshots and may re-open any box it thinks still fails. A finding is only
"fixed" when BOTH agree (and the E2E assert, if any, is green). `needs Floris
demo` items are never closed by either model — they wait for the on-device pass.

## 9. Audit findings log (append-only, one line per surprise)

- (add entries here as the audit learns things about the harness or the game)
- (A1) The laptop `reduce-motion` GAP is itself a symptom of finding F-01: the harness timed out waiting for "Dit is mijn ranger" — the very button the audit flags as below the fold. GAPs can be UX evidence, not just missing data.
- (A1) iPad PNGs are 2160×1620 = 1080×810 CSS at deviceScaleFactor 2 — divide raw-PNG pixel measurements by 2 before comparing against the ≥56 px contract (laptop PNGs are 1:1 at 1280×800).
- (A3) The run-2 glide signature (pos moves, clip null) is GONE — clip `walk` binds and the mesh articulates. The surviving glide is a ratio bug: PNG **mtimes give real burst timing** (laptop 21.2 m in ~6 s ≈ 3.5 m/s, iPad ≈ 2.7 m/s) on a ~1.1 s walk cycle → ~3–4 m per stride. On foot nearly matches the jeep (4.24 m/s).
- (A4) The "empty world" straight ahead is spawn ORIENTATION, not missing content: a cabin+signpost hub exists but sits behind the spawn camera — only visible in the yawed `09-controls-hud` shots, where the hut fits under the giant avatar's torso (best single scale-anchor image of the set).
- (A5) Hook telemetry is decoupled from the render while the camera is degenerate inside the avatar: cameraYaw moved 1.22→π and drawCalls 29→47 between frames 09→10 that are PIXEL-IDENTICAL (mean |Δ| 0.02/255). The planned "cameraYaw unchanged → controls absent" rule would have inverted the zoom verdict; A9's steering call must use veh.heading + tracker chip + pixel-diff, not cameraYaw alone (F-18).
- (A5) The natural orbit gesture routes into locomotion: after a 216 px drag the player pos moved 0.93 m and the mission tracker flipped "naar links"→"naar rechts" (shot 12) — a look-around attempt relocates the child (F-17). Also confirmed via zoom-crops: the frame-edge masses are smooth-shaded avatar geometry (trouser+boot sole), not rocks — F-07's scale evidence holds.
- (A6) `audit-evidence/` is **untracked in git** — a `npm run capture` re-run would irrecoverably overwrite the exact frames F-01.. cite (and the mtimes F-08's timing used). Do NOT re-run into this directory; archive/commit it before Run B starts re-capturing. (This is why the A6 sitting recorded the iPad GAP instead of re-running.)
- (A6) The iPad run died mid keyboard-walk to the board ("Target page… has been closed"), killing all three trailing scenes — and `walkTo` drives with `page.keyboard` on BOTH projects, so the touch platform's board approach never uses touch. Harness hardening (scene-isolated pages + touch walkTo + crash retry) is F-21 and must land EARLY in Run B or its board/mission fixes are unverifiable on iPad.
- (A6) Tooling: `audit-evidence/crop_tool.py` (pure-python, no deps) crops/upscales PNG regions and measures color-mask bboxes — how the 62 px button and 18 px link were measured. Reusable for later groups.
- (A7) Mission view strips the ENTIRE HUD — even the Pauze chip is gone (top-left corner empty in the crops). Only found by cropping the corner; at thumbnail scale the prompt bar reads as "two chips" when it is one 900 px bar with two type sizes. Zoom before judging any HUD claim. Re-check both facts on iPad once F-21's harness fix lands.
- (A8) A mask-measured "tap-target violation" on a text link can be wrong about the DOM: `.ra-text-btn` styles 16 px underlined text but carries `min-height: 56px` (missions.css:66) — the hit area complies while the LOOK fails. Check the CSS before calling a ≥56 breach (F-20 amended; F-28 framed as affordance, not contract). Also: pause is a DOM card over the live world — the dev hook stays `screen: "world"`, so pause-related asserts can't key on that field.
- (A9) The drive camera's yaw is real and slaved to the jeep (camYaw≡veh.heading+π in all 8 drive frames) while its POSITION stays at the standing avatar — so "yaw changed" proves nothing about a working drive cam, and 2 of 8 aliased burst frames happened to be the set's best world-content evidence (empty circling jeep + a never-documented helicopter). Under-sampled bursts can exonerate ("heading frozen" refuted) without convicting (input-causation needs a control condition the burst never captured).
- (A9) There is NO DOF/bloom/postprocess pass anywhere in src/render3d — the "blur" Floris saw is 10–30× magnified avatar textures at point-blank range. Grep the render tree before planning to remove an effect.
- (A10) The reduce-motion GAP's cause is NOT reduced motion: the scene re-boots with the first-run helper, but `avatarGemaakt` persisted from boot 1 makes `main.ts:90` skip the avatar-maker — the harness waited ~25 min for a button that never mounts. Any scene that re-boots must branch on persisted state exactly like the app does. (F-01's "off-screen button" corroboration was mechanism-wrong — amended.)
- (A10) Even a SUCCESSFUL reduce-motion still can't verify the policy: MotionMode.ts §1e is temporal (cuts-not-moves, secondary freeze, locomotion kept) and leaves the static look unchanged — RM verification needs burst pairs + (post-F-18) camera step-function asserts, not one frame. NB the in-game toggle's real UI label is "Rustige beweging" (Tweaks.ts:42), not the docs' "Verminder beweging" — E2E selectors beware.
- (A12) The capture never touches the touchscreen AT ALL: every locomotion driver is `page.keyboard` on BOTH projects (walk :127, jeep+steer :178-185, walkTo :260-261), boarding is keyboard Space (:173); the only pointer input in the whole run is the laptop camera block (:146-153). So the touch-FIRST platform has zero pixels proving the joystick, tap-to-walk or touch steering work — F-21's touch-walkTo fix must extend to ALL touch surfaces, not just the board leg.
