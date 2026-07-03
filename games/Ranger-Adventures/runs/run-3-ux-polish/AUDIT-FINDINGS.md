# Run 3 — Audit findings (the punch-list Fable produces, Floris reviews)

> Written by the Run A audit sittings (model `claude-fable-5`) from the
> `audit-evidence/` contact sheet. Schema + rules: [AUDIT-PLAN.md](AUDIT-PLAN.md)
> §3/§5. This is the INPUT to Run B (Opus build). **It is currently a template —
> the audit run fills it in.** Render it for review with:
> `node e2e-capture/… ` (see START-HERE.md) or just read it here.

## Punch-list at a glance (written by box A11)

34 findings, no duplicates (shared-root families are cross-referenced, not
merged — each row keeps its own assert). Severity order: 3 blockers,
21 major, 7 minor, 3 polish. Legend: **shot** = screenshot re-capture gate ·
**E2E** = named assert (dev hook / spec) · **+demo** = has a needs-Floris-demo
component that NO screenshot/E2E gate may self-certify. Platform "laptop
(both?)" = proven on laptop, shared code makes both near-certain, iPad pixels
missing (F-21).

| id | title | platform | severity | verify by | confidence |
|----|-------|----------|----------|-----------|------------|
| F-05 | Camera spawns inside avatar — world invisible | both | **blocker** | shot + E2E | high |
| F-07 | Avatar is a ~10–30× giant vs the world | both | **blocker** | shot + E2E | high |
| F-30 | Driving is blind — camera stays at standing avatar | both | **blocker** | shot + E2E +demo | high |
| F-01 | Avatar card clipped; confirm button below fold | both | major | shot + E2E | high |
| F-02 | Title/avatar tap targets under 56 px | both | major | E2E + shot | high |
| F-06 | Three hints at once; 16-word toast never dismisses | both | major | shot + E2E +demo | high |
| F-08 | Foot speed near jeep speed — guaranteed stride slip | both | major | E2E + shot +demo | high |
| F-09 | Spawn faces the void; hub sits behind player | both | major | shot + E2E | high |
| F-13 | iPad joystick covers the mission tracker | iPad | major | shot + E2E | high |
| F-14 | Pauze chip under 56 px | both | major | E2E + shot | high |
| F-16 | No laptop zoom — wheel/trackpad dead | laptop | major | E2E + shot +demo | high |
| F-17 | Drag misfires: moves player, flips view 180° | laptop | major | E2E + shot +demo | high |
| F-18 | Camera telemetry decoupled from the render | laptop (both?) | major | E2E | high |
| F-19 | At the board you can't see the board (edge-on murk) | laptop (both?) | major | shot + E2E | high |
| F-20 | Board exit looks like an 18 px dim text link | laptop (both?) | major | E2E + shot | high |
| F-21 | GAP: iPad board/mission/RM never captured; touch never driven | iPad | major | shot (harness fix) | high |
| F-24 | Mission plays as floating props in a dark void | laptop (both?) | major | shot + E2E | high |
| F-25 | Prompt: 11-word one-liner; speaker ~46 px | laptop (both?) | major | shot + E2E +demo | high |
| F-26 | In-mission NO exit — even Pauze vanishes | laptop (both?) | major | E2E + shot | high |
| F-27 | No main-menu/title path anywhere below the title | both | major | E2E + shot | high |
| F-31 | Jeep drives around EMPTY — ranger never boards | both | major | shot + E2E | high |
| F-32 | Steering unverifiable (not frozen; spin-top tuning) | both | major | E2E + shot +demo | high/low |
| F-33 | "Blur/DOF" is magnified textures — no effect exists | both | major | shot (post-fix) | high |
| F-34 | GAP: reduce-motion has zero pixels on both platforms | both | major | shot + E2E +demo | high |
| F-03 | Title subtitle wraps to an 8-word line | both | minor | shot | high |
| F-10 | GAP: gait + avatar looks unjudgeable until F-05/F-07 | both | minor | shot +demo | high |
| F-11 | No world boundary or turn-back cue | both | minor | shot + E2E | high |
| F-12 | Half-screen shadow band tracks the player | both | minor | shot | med |
| F-15 | Hint priority inverted; laptop steady-state HUD bare | both | minor | shot + E2E +demo | high |
| F-22 | World labels clipped by geometry (board/jeep/POI) | laptop (both?) | minor | shot | high |
| F-28 | Pause-hub links are 16 px fine print (affordance) | both | minor | shot | high |
| F-04 | Title backdrop bare — six identical cones | both | polish | shot | high |
| F-23 | Mission cards text-only — a wall of reading | both | polish | shot | high |
| F-29 | No scrim behind the pause card | both | polish | shot | high |

### Punch-list coverage (all six FINDINGS.md items land in findings)

1. **Avatar enormous / camera clipped inside it** → F-05 (camera inside mesh) + F-07 (giant scale); downstream re-checks F-09, F-10, F-12.
2. **Everything glides** → the run-2 null-clip signature is GONE (data, A3); the surviving glide is F-08 (speed/stride ratio → foot-slip), gated for re-judgement by F-10.
3. **Jeep does not steer; render drowned in blur/DOF** → F-30 (blind drive camera), F-31 (empty jeep), F-32 (steering unverifiable + comfort tuning), F-33 (the "DOF" does not exist — magnified textures).
4. **No camera control on laptop** → F-16 (zoom dead), F-17 (drag misfires into locomotion), F-18 (telemetry substrate for asserting any of it).
5. **No back / main-menu path** → F-27 (hub offers no title path — zero exits below title), F-26 (in-mission even Pauze vanishes), F-20 (board exit affordance).
6. **Feels far from finished** → decomposed into: F-04, F-06, F-09, F-11, F-12, F-13, F-15, F-19, F-22, F-23, F-24, F-25, F-28, F-29, F-31.

### Fix-areas (coupling view — the dedupe unit for Run B)

- **A · Scale + camera core** (do FIRST, in this order): F-07 → F-05 → F-18 → F-09; then re-check F-10, F-12, F-33 from fresh captures. Nearly every visual defect downstream of these.
- **B · Laptop camera controls** (after A): F-16, F-17.
- **C · Vehicle** (after A): F-30 → F-31 → F-32.
- **D · Exits / navigation**: F-27, F-26, F-20 — one navigation model: every screen below the title gets a visible ≥56 px way back.
- **E · HUD + hints**: F-06, F-15, F-13, F-14.
- **F · Tap-target / affordance token** (one shared change): F-02, F-14, F-20, F-25, F-28 all resolve through the same ≥56 px chip/button token; F-01 couples (card must still fit the fold).
- **G · Reading + labels**: F-03, F-25 (line length), F-22 (occlusion-proof labels), F-23 (pictograms).
- **H · World dressing**: F-04, F-11, F-29.
- **I · Verification substrate** (land EARLY, everything else's gate depends on it): F-21 (scene-isolated pages, touch walkTo, crash retry, archive evidence first), F-34 (returning-player boot + RM bursts + toggle path), F-18 (real cam pose fields, same-frame drawCalls).

_No merges were needed: candidate pairs (F-06/F-15 hint system, F-02/F-14 chip
sizes, F-10/F-21/F-34 GAPs, F-05/F-30 cameras) are distinct defects with
distinct asserts and are cross-referenced in place._

---

## Findings

_(Fable appends F-01, F-02, … here as it works down the ledger. One block per
finding, most-severe first, following the AUDIT-PLAN §3 schema.)_

_Engine caveat for every iPad finding: the `ipad` captures run the true iPad
viewport (1080×810, touch, dsf 2) on the **Chromium** engine — local WebKit is
broken on this Mac (WORLD-PLAN §10 / W0.8). Layout/scale conclusions hold;
true Safari rendering + feel stay on the Floris on-device pass._

---

_**Group A1 · Boot (title + avatar)** — looked at `laptop/01-title.png`,
`laptop/02-avatar.png`, `ipad/01-title.png`, `ipad/02-avatar.png`. Overall: the
title screen is calm, on-palette and readable — the best screen of the set. The
avatar-maker has real problems below._

### F-01 · Avatar-maker card clipped — confirm button below the fold
- **Defect:** On both platforms the avatar card is cut off at the bottom of the
  viewport mid-way through the "Haar" swatch row (`laptop/02-avatar.png` clips
  at the first Haar circle; `ipad/02-avatar.png` the same). The primary CTA
  **"Dit is mijn ranger" is not visible anywhere in the frame** — a first-run
  screen where an 8-year-old sees no way to finish and must discover that the
  card scrolls. Whatever else lives below the fold (any back-to-title link) is
  equally invisible. Corroborating data: the laptop `reduce-motion` capture
  died waiting 30 min for `getByRole('button', { name: 'Dit is mijn ranger' })`
  (GAP entry in `annotations-laptop.json`) — the button is off-screen enough to
  make even the harness's life hard.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/02-avatar.png, audit-evidence/ipad/02-avatar.png (+ the reduce-motion GAP entry in annotations-laptop.json)
- **Severity:** major
- **Concrete fix:** Make the avatar card fit the viewport at 1280×800 and
  1080×810: cap the card at ~100dvh minus margin, compact the layout (smaller
  portrait, tighter section spacing, Huid/Haar swatch rows side by side in
  landscape), and/or give the card an internal scroll area with a **sticky
  footer bar that always shows "Dit is mijn ranger"**. The button must be
  on-screen without scrolling on both target viewports.
- **Verify by:** screenshot (`02-avatar` on both platforms shows the button) + E2E assert (confirm-button boundingBox fully inside the viewport on both projects)
- **Confidence:** high
  _A10 addendum:_ the corroborating sentence about the reduce-motion GAP is
  mechanism-WRONG — that capture did not stall on a hard-to-reach button; boot
  2 never shows the avatar-maker at all (`main.ts:90` skips it once
  `avatarGemaakt` is persisted, and the harness's `boot()` waited for a button
  that never mounts — see F-34). F-01's own evidence (the clipped card in both
  `02-avatar.png` stills) is unaffected and stands.
- **Contract check:** ≥56 px targets — the sticky/compacted button must stay
  ≥56 px (couples with F-02); reading M3/E3 strings unchanged; no new
  localStorage keys needed. Safe.

### F-02 · Boot-screen tap targets under the 56 px contract on iPad
- **Defect:** Measured from the iPad PNGs (2160×1620 at dsf 2 → 1080×810 CSS):
  the title **"Begin" button is ~104×48 CSS px** (height under the 56 px
  minimum), the avatar **Huid/Haar swatches are ~48 px** circles, and the name
  chips (Alvah/Bo/Robin/Sam/Veer) are ~56 px tall — borderline. Laptop shares
  the components (Begin ~52 px tall at 1:1). The frozen contract is ≥56 px tap
  targets, iPad-first — and these are the first two screens the child touches.
- **Platform:** both (contract bites on iPad; components are shared)
- **Evidence:** audit-evidence/ipad/01-title.png, audit-evidence/ipad/02-avatar.png (laptop/01+02 for the same components)
- **Severity:** major
- **Concrete fix:** Raise every interactive control on title + avatar screens
  to ≥56 CSS px in its smallest dimension: Begin min-height 56 px, swatch
  diameter 56 px (selection ring drawn on top, not adding to hit area), name
  chips min-height 56 px, and the F-01 confirm button likewise. Do it together
  with the F-01 compaction so bigger targets don't push the card further off
  screen.
- **Verify by:** E2E assert (boundingBox ≥56 px for Begin, each swatch, each chip, confirm button, on the `ipad` project) + screenshot
- **Confidence:** high (screenshot-proportional measurement, ±4 px; Begin and swatches are clearly under)
- **Contract check:** this fix *enforces* the ≥56 px contract; UI is DOM (no
  draw-call cost); must not regress F-01 fits-on-screen. Safe.

### F-03 · Title subtitle wraps to an 8-word line (reading contract)
- **Defect:** The subtitle renders as "Help de dieren van de Veluwe. Kies een /
  missie en train je breinkracht." — the first visual line is 8 words and the
  second sentence is split mid-phrase. For the M3/E3 dyslexia-friendly reading
  contract (≤7 words per line) the visual line is the unit that counts, and
  this is the very first text Alvah reads.
- **Platform:** both (identical wrap in both shots)
- **Evidence:** audit-evidence/laptop/01-title.png, audit-evidence/ipad/01-title.png
- **Severity:** minor
- **Concrete fix:** Break per sentence — render each sentence as its own line
  ("Help de dieren van de Veluwe." = 6 words / "Kies een missie en train je
  breinkracht." = 7 words) with a `<br>` or per-sentence block spans; check the
  same pattern on any other multi-sentence UI string.
- **Verify by:** screenshot
- **Confidence:** high
- **Contract check:** enforces the reading contract; strings themselves unchanged (read-aloud untouched). Safe.

### F-04 · Title backdrop is bare — six identical cones, no grounding
- **Defect:** The title backdrop is six copies of the same dark cone conifer on
  a flat two-tone ground, no shadows (trees read as floating), nothing that
  says "Veluwe" — no heather, sand path, mission board or jeep silhouette. The
  mood (warm sky, calm palette) is right, but the emptiness is the first taste
  of punch-list #6 "feels far from finished".
- **Platform:** both
- **Evidence:** audit-evidence/laptop/01-title.png, audit-evidence/ipad/01-title.png
- **Severity:** polish
- **Concrete fix:** Ground and vary the vignette cheaply: soft blob shadows
  under trees, mix the tree species/sizes that already exist in the world
  assets, and optionally place one recognizable prop (mission board or parked
  jeep) in the mid-ground. Title sits at 16 draw calls — huge headroom under
  the 150 budget.
- **Verify by:** screenshot
- **Confidence:** high
- **Contract check:** <150 draw calls (currently 16, keep well under); calm/never-scary vignette only; assets via `assetUrl`. Safe.

---

_**Group A2 · Wereld / world-entry** — looked at `laptop/03-world-entry.png`,
`ipad/03-world-entry.png`. Punch-list #1 confirmed, and it is worse than
"you see only feet". One good thing: the walk hint is correctly
platform-aware ("Loop met de pijltjes." on laptop, "Sleep de stick om te
lopen." on iPad)._

### F-05 · Camera spawns INSIDE the avatar — the world is not visible at all
- **Defect:** On both platforms the entire first world frame is the unlit,
  out-of-focus **inside of the avatar mesh**: a dark brown/red smear edge to
  edge, no ground, no sky, no tree anywhere in frame. The annotations prove a
  world is being rendered behind it (drawCalls 69 laptop / 35 iPad, pos (0,0),
  cameraYaw 0) — the player just cannot see it. This is Floris's #1 finding,
  confirmed: the follow camera sits at zero-ish distance inside the character
  geometry. Note the frame is also uniformly soft/blurry — consistent with the
  blur/DOF Floris reports on the jeep (#3); the A9 group will pin that down
  separately. From these frames the avatar's own scale cannot be judged (it
  occludes everything); the A3 walk burst covers that.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/03-world-entry.png, audit-evidence/ipad/03-world-entry.png
- **Severity:** blocker
- **Concrete fix:** Rebuild the third-person follow camera with guaranteed
  clearance: eye height ≈1.6–1.8 m, boom ≈4–5 m behind the ranger, pitch a few
  degrees down aiming at chest height (exact numbers are the builder's
  screenshot-in-loop tuning). Add the two safety rails that make it impossible
  to regress: (1) clamp minimum boom distance to outside the avatar's bounding
  radius + camera near plane (~0.2 m), with a spherecast so terrain/props push
  the camera in smoothly instead of clipping; (2) if the boom ever collapses
  below the clamp, fade the avatar out rather than render its interior. Expose
  the camera-to-avatar distance on the dev hook so it is assertable forever.
- **Verify by:** screenshot (world-entry shows ground + horizon + the whole
  ranger at a sane size) + E2E assert (new dev-hook field, e.g. `cam.dist ≥ 3`
  and avatar bounding box fully inside the view frustum at world entry)
- **Confidence:** high
- **Contract check:** motion-comfort camera law — the new rig must keep fixed
  FOV, roll 0, damped follow, no snap-rotate; reduced-motion state turns
  camera *moves* into cuts (locomotion stays). The fix as specified respects
  it; any added orbit/zoom (F-laptop-camera, A5) must stay player-initiated +
  damped.

### F-06 · First world frame stacks three hints; top toast is a 16-word line
- **Defect:** At world entry three text messages appear simultaneously: the top
  toast "Tik op een dier om mee te spelen — of tik op de grond om te lopen."
  (**16 words on one visual line** — the reading contract is ≤7 words per
  line), a center walk hint, and the bottom-left mission tracker ("De
  verdwaalde frisling · naar links · 22 m"). Three competing messages at the
  same moment is cognitive overload for the EF audience, and the toast's em
  dash + length make it the hardest possible first sentence. On iPad the
  tracker text additionally sits on the rim of the joystick circle (overlap —
  A4 will size it precisely). **A3/A4 follow-up:** the toast never dismisses —
  it is still on screen in every captured world frame through
  `09-controls-hud`, 16+ seconds and ~24 m of walking later, on both platforms
  (see the walk burst + controls-hud shots). The hardest sentence is also a
  permanent one.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/03-world-entry.png, audit-evidence/ipad/03-world-entry.png
- **Severity:** major
- **Concrete fix:** Sequence the onboarding: show ONE hint at a time (walk hint
  first; the tap-an-animal toast only after the first successful walk; tracker
  appears after the toast dismisses). Rewrite the toast as two short lines /
  two sequential toasts, each ≤7 words at M3/E3 (e.g. "Tik op de grond om te
  lopen." then "Tik op een dier om te spelen."), keep read-aloud on each new
  string. Whether read-aloud actually fires here is not provable from a still
  — flag for the demo.
- **Verify by:** screenshot (single hint at entry, ≤7-word lines) + E2E assert
  (hint sequencing state) — read-aloud firing: needs Floris demo
- **Confidence:** high
- **Contract check:** reading M3/E3 ≤7 words + read-aloud on new strings — the
  fix enforces both; hint copy changes must go through the read-aloud path; no
  new persistence keys (one-time-hint flags must live inside the existing
  `alvah-ef-v1` ranger namespace via `state.ts`). Safe if so.

---

_**Group A3 · Lopen (walk burst)** — looked at `laptop/04..08-walk-1..5.png`,
`ipad/04..08-walk-1..5.png` plus the per-frame `pos`/`clip` data in both
annotation files and the PNG mtimes (real inter-frame timing). Headline: the
run-2 glide **signature** is gone — clip `walk` is bound and advancing in every
burst frame, and the visible leg fragments change pose between frames, so the
mesh is genuinely animated. What the burst actually exposes is the avatar's
colossal scale, a ground speed near jeep speed, and a spawn that points at
nothing. `walk-1` on both platforms repeats the F-05 interior-of-the-mesh view._

### F-07 · Avatar is a giant — boots taller than trees, the cabin fits under its torso
- **Defect:** Every walk frame shows the avatar's legs/boots at building scale:
  in `laptop/06-walk-3.png` a single boot (dark sole rim visible) fills the
  right half of the frame and dwarfs the full-grown conifers on the horizon;
  in `ipad/06-walk-3.png` a conifer stands at the boot's base and reaches only
  a fraction of its height; and in `laptop/09-controls-hud.png` +
  `ipad/09-controls-hud.png` (camera yawed back) the ranger hut, a signpost
  and trees all sit UNDER the avatar's torso, which spans the top of the frame
  like a bridge — one leg is wider than the hut is tall. The exact factor
  can't be measured from stills, but it is on the order of 10–30× too large
  relative to the world. This is the other half of punch-list #1 (F-05 is the
  camera; this is the mesh), and it silently drives F-08 (giant-tuned speed),
  F-09/F-11 (world feels tiny/empty) and probably F-12 (half-screen shadow).
- **Platform:** both
- **Evidence:** audit-evidence/laptop/06-walk-3.png, laptop/07-walk-4.png, ipad/06-walk-3.png, laptop/09-controls-hud.png, ipad/09-controls-hud.png
- **Severity:** blocker
- **Concrete fix:** Normalize the rigged ranger to human size in world units —
  target ≈1.7 m standing height at import/normalization (scale the loaded
  GLTF scene or its wrapper group; do NOT compensate via camera). Trees/hut
  then read as 2–4× the ranger, which is right. Expose the avatar's world
  bounding-box height on the dev hook (e.g. `avatar.height`) so scale is
  assertable forever. Sequence: this lands BEFORE the F-05 camera retune and
  the F-08 speed retune (both depend on final scale).
- **Verify by:** screenshot (ranger next to tree/hut at believable proportion) + E2E assert (`avatar.height` ∈ [1.5, 2.0])
- **Confidence:** high
- **Contract check:** none directly; keep draw calls unchanged; coupled to
  F-05 (camera boom) and F-08 (speed) — retune those after scaling. Safe.

### F-08 · On foot the ranger moves at near-jeep speed on a ~1.1 s walk cycle — guaranteed foot-slip
- **Defect:** Data, not pixels. From the annotations plus PNG mtimes: laptop
  covered 21.2 m from walk-1 (11:06:35) to walk-5 (11:06:41) ≈ **3.5 m/s**;
  iPad 19.0 m over ~7 s ≈ **2.7 m/s**. A human walk is ≈1.4 m/s; the game's
  own jeep reports `veh.speed` 4.24 m/s — on foot you do 65–85% of jeep speed.
  Meanwhile the `clip.time` values show the walk cycle loops in ~1.1 s, so one
  stride cycle covers ≈3–3.9 m (a real stride cycle is ~1.5 m): even with the
  clip correctly bound, the feet must slide ~2.5× per stride. This is the
  surviving core of punch-list #2 "everything glides" — and it exists because
  the F-07 giant needs this speed to look normal at its scale.
- **Platform:** both
- **Evidence:** audit-evidence/annotations-laptop.json + annotations-ipad.json walk-1..5 `pos`/`clip` (+ PNG mtimes for Δt); images laptop/05..08-walk, ipad/05..08-walk
- **Severity:** major
- **Concrete fix:** After F-07: retune on-foot ground speed to ≈1.6–2.0 m/s
  and tie the walk-clip `playbackRate` to actual ground speed so
  distance-per-cycle ≈ the clip's authored stride (kills foot-slip at any
  speed). Keep the jeep clearly faster — speed is the jeep's reason to exist.
  Expose ground speed (m/s) on the dev hook.
- **Verify by:** E2E assert (dev-hook ground speed ∈ [1.4, 2.2] while `clip` = walk) + burst re-capture screenshot; true gait feel: needs Floris demo
- **Confidence:** high (timing bounds are coarse, but the conclusion holds at either end)
- **Contract check:** motion-comfort law — speed retune is locomotion (always
  allowed); do not add FOV-kick/head-bob for "feel". Safe.

### F-09 · Spawn faces the void — the hub (cabin, signpost) is behind the player
- **Defect:** The spawn camera looks down −z, and holding forward (the first
  input any child gives) walks 20+ m into a featureless plain: by
  `laptop/06-walk-3.png` the frame is empty ground plus three distant cones,
  and draw calls collapse 51→13 across the burst (the renderer is drawing
  almost nothing). Yet `*/09-controls-hud.png` — same session, camera yawed
  ~1 rad back — reveals a log cabin, signpost, mixed trees and rocks: the
  world HAS a hub cluster, it just sits behind/beside the spawn orientation.
  The "empty game" first impression is spawn facing, not missing content. The
  tracker corroborates: it points "naar rechts/links" from the first frame —
  the mission target is never ahead of you at spawn.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/06-walk-3.png, laptop/08-walk-5.png, ipad/08-walk-5.png (void ahead); laptop/09-controls-hud.png, ipad/09-controls-hud.png (hub behind); drawCalls series in both annotation files
- **Severity:** major
- **Concrete fix:** Rotate the spawn (player yaw + follow camera) so the
  first frame after F-05 lands shows the hub — cabin, mission board, a tree
  line — and the first stride goes TOWARD content; or move the hub into the
  current sightline. One-value change plus screenshot iteration.
- **Verify by:** screenshot (post-F-05 world-entry shows ≥1 landmark in frame) + E2E assert (drawCalls at world entry above a floor, or a dev-hook landmark-in-frustum boolean)
- **Confidence:** high
- **Contract check:** reduced-motion — initial orientation set before first
  render is a cut, not a camera move. Safe.

### F-10 · GAP: walk gait and the avatar's full appearance are unjudgeable from every current capture
- **Defect:** No frame on either platform shows the whole ranger: the camera
  is inside the mesh (`walk-1`, = F-05) or at ankle height between giant legs
  (`walk-2..5`, = F-07). So A3's real questions — does the walk cycle READ as
  walking, and does the rigged ranger look good — cannot be answered yet.
  What can be said: the run-2 glide signature (pos moves while `clip` is
  null) is **gone** — `clip` = walk, time advancing, in all 10 burst frames —
  and the visible geometry is a red uniform leg with a dark boot sole (the
  rigged ranger), not run-2's green capsule, changing pose frame to frame.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/04..08-walk-*.png, ipad/04..08-walk-*.png + `clip` fields in both annotation files
- **Severity:** minor (bookkeeping — but it gates closing punch-list #2)
- **Concrete fix:** No code of its own. After F-07 + F-05 land, re-run
  `npm run capture` and re-judge the walk burst with the ranger fully in
  frame: gait readable, no foot-slip (per F-08), appearance acceptable.
- **Verify by:** screenshot (fresh burst after camera/scale fixes) — animation quality and comfort: needs Floris demo
- **Confidence:** high (that it is currently unjudgeable)
- **Contract check:** none.

### F-11 · No world boundary or turn-back cue — forward walking ends in a silent void
- **Defect:** `laptop/08-walk-5.png` / `ipad/08-walk-5.png`: after ~20 m the
  world is a featureless plain with 2–3 distant cones and haze; nothing marks
  the edge of the playable area (no fence, heather ridge, tree line, stream)
  and no hint suggests turning back. Draw calls at 13 confirm there is
  effectively nothing left to render. An 8-year-old who keeps pushing forward
  is silently lost; the tracker chip does keep pointing home-ward, but it is
  small text partly hidden under the iPad joystick (F-13).
- **Platform:** both
- **Evidence:** audit-evidence/laptop/08-walk-5.png, ipad/08-walk-5.png (+ drawCalls 13 in annotations)
- **Severity:** minor
- **Concrete fix:** Give the world a calm visible rim (heather berm / low
  fence / tree line), ease speed to zero approaching it (no hard invisible
  wall jolt), and show one short hint (≤7 words, e.g. "Hier stopt het bos.")
  with read-aloud when the player heads outward past the last content.
- **Verify by:** screenshot (rim visible at the edge) + E2E assert (pos clamped at boundary on the dev hook)
- **Confidence:** high
- **Contract check:** never-scary (calm edge, gentle stop, no game-over);
  reading ≤7 words + read-aloud for the new string; any one-time-hint flag in
  the existing `alvah-ef-v1` ranger namespace. Safe if so.

### F-12 · A vertical half-screen darkening band tracks the player through the whole burst
- **Defect:** In every moving frame on both platforms the ground splits into
  a dark half and a light half along a soft vertical boundary that stays near
  screen center across ~20 m of travel (`laptop/05..08-walk`,
  `ipad/05..08-walk`) — it even cuts across the sand path. Because it tracks
  the camera it is not biome texture; most plausibly it is the F-07 giant's
  blob/directional shadow (sun low from frame right) or a shadow-camera edge.
  Half of every frame looks unlit and murky.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/05-walk-2.png, laptop/06-walk-3.png, ipad/07-walk-4.png, ipad/08-walk-5.png
- **Severity:** minor
- **Concrete fix:** Re-capture after F-07 — a 1.7 m ranger's shadow cannot
  darken half the world, so this may self-resolve. If the band persists,
  inspect the shadow setup (blob-shadow scale, shadow-camera frustum, fog)
  and fix; stay <150 draw calls, no new deps.
- **Verify by:** screenshot (burst re-capture: ground evenly lit apart from believable prop shadows)
- **Confidence:** med (band is unmistakable; its cause is inferred)
- **Contract check:** none (shadow tweak must not add dependencies).

---

_**Group A4 · Besturing / controls HUD** — looked at
`laptop/09-controls-hud.png`, `ipad/09-controls-hud.png` (with the walk burst
as steady-state HUD reference). iPad: joystick present, ≈100+ CSS px (≥56 ✓),
persistent, correct corner — but it collides with the tracker chip. Laptop:
correctly no joystick; steady-state shows no control affordance at all.
Answers to the annotation's questions: tap-to-walk is only communicated via
the F-06 toast; the Pauze chip is under the 56 px contract on both._

### F-13 · iPad joystick and mission tracker fight for the same corner — the chip renders under the stick
- **Defect:** On every iPad world frame the translucent joystick base sits ON
  the mission-tracker chip: in `ipad/04-walk-1.png` and
  `ipad/09-controls-hud.png` the white thumb disc covers the start of both
  text lines — "De verdwaalde frisling / naar links · 17 m" is partially
  unreadable, and during play the child's actual thumb sits exactly on the
  mission text. The joystick itself is right (size, persistence, corner); the
  tracker is in its footprint.
- **Platform:** iPad
- **Evidence:** audit-evidence/ipad/04-walk-1.png, ipad/09-controls-hud.png (also visible in ipad/05..08-walk)
- **Severity:** major
- **Concrete fix:** Move the tracker chip out of the joystick quadrant —
  bottom-right, or top-left under the Pauze chip — and keep it non-overlapping
  at 1080×810 landscape. If the chip is tappable it must also become ≥56 px
  tall (currently ~40); if not tappable, keep it clearly a label.
- **Verify by:** screenshot + E2E assert (joystick and tracker boundingBoxes do not intersect on the ipad project)
- **Confidence:** high
- **Contract check:** ≥56 px if interactive; iPad-first. Safe.

### F-14 · Pauze chip is under the 56 px tap-target contract on both platforms
- **Defect:** Measured screenshot-proportionally: the Pauze chip — the ONLY
  always-present interactive control in the world HUD — is ≈36–40 CSS px tall
  on iPad (`ipad/09-controls-hud.png`, raw ~76 px at dsf 2) and ≈28–32 px on
  laptop (`laptop/09-controls-hud.png`). Both are ~30–45% under the frozen
  ≥56 px contract. Same chip style as the F-02 title/avatar targets; this is
  the in-world instance.
- **Platform:** both
- **Evidence:** audit-evidence/ipad/09-controls-hud.png, laptop/09-controls-hud.png
- **Severity:** major
- **Concrete fix:** Raise the shared HUD-chip style to min-height 56 px
  (padding, not font-inflation alone) — one token so F-02's fix and this one
  are the same change; apply to every interactive HUD element in the same
  pass.
- **Verify by:** E2E assert (Pauze boundingBox height ≥56 on both projects) + screenshot
- **Confidence:** high (that it is under; ±4 px on the exact number)
- **Contract check:** enforces the ≥56 px contract. Safe.

### F-15 · Hint priority is inverted: the useful control hint vanishes, the 16-word toast stays forever; laptop steady-state shows no controls
- **Defect:** At world entry each platform shows the right control hint
  ("Loop met de pijltjes." / "Sleep de stick om te lopen." — see
  `*/03-world-entry.png`), but it is gone by walk-1 — while the 16-word
  tap-toast (F-06) is still on screen 16+ s and ~24 m later in
  `*/09-controls-hud.png`. Steady-state laptop HUD is Pauze + toast + tracker:
  nothing tells the player which keys work, that the jeep can be entered, or
  (once A5's camera controls exist) how to zoom/orbit.
- **Platform:** both (laptop worst)
- **Evidence:** audit-evidence/laptop/09-controls-hud.png, ipad/09-controls-hud.png (vs the hint in laptop/03-world-entry.png, ipad/03-world-entry.png)
- **Severity:** minor
- **Concrete fix:** Flip the persistence: the control hint stays until the
  first successful use of that control (then fades); the toast becomes a
  short transient per F-06's sequencing. On laptop add a small persistent
  help chip (≥56 px, e.g. "?") that re-shows the control hints on demand —
  hint copy ≤7 words per line with read-aloud.
- **Verify by:** screenshot (entry vs post-walk HUD states) + E2E assert (hint-state field on the dev hook) — read-aloud firing: needs Floris demo
- **Confidence:** high
- **Contract check:** reading M3/E3 ≤7 words + read-aloud on new strings;
  hint flags via `state.ts` in the existing `alvah-ef-v1` ranger namespace;
  new chip ≥56 px. Safe if so.

_**Group A5 · Laptop-camera (zoom + orbit attempts)** — looked at
`laptop/09-controls-hud.png` (baseline), `laptop/10-camera-zoom-in.png`,
`laptop/11-camera-zoom-out.png`, `laptop/12-camera-orbit.png`, plus the harness
inputs (`app/e2e-capture/capture.spec.ts:146-154`: wheel −800 → shot 10, wheel
+1400 → shot 11, then a 216 px rightward mouse-drag → shot 12) and a real
pixel-diff of the frames (pure-Python PNG decode, mean |Δ| per channel).
Verdicts are pixel-proven, not hook-inferred — which turned out to matter (see
F-18). iPad has no shots in this group by design: punch-list #4 is a laptop
ask; whether iPad should also get pinch-zoom is Floris's call, noted in F-16.
Bonus: the zoomed crops confirm A3/A4's mass-identification — the red-brown
shapes framing these frames are smooth-shaded avatar geometry (trouser leg +
boot sole with a rim seam), unlike every faceted low-poly world prop, so F-07's
evidence chain holds._

### F-16 · Laptop has no camera zoom — trackpad/scroll input changes nothing at all
- **Defect:** Punch-list #4 (zoom half), confirmed beyond doubt. The harness
  scrolled the wheel over the canvas center in both directions (−800 for
  zoom-in, then +1400 for zoom-out); the resulting frames are **pixel-identical**
  to each other and to the pre-input baseline: 09 vs 10 mean |Δ| = 0.02/255
  with 0.0% of pixels above noise, 10 vs 11 = 0.01/255 with 0.0%. State agrees
  (pos and yaw byte-identical between 10 and 11). There is no zoom on laptop —
  and there is also **no camera-distance field on the dev hook**, so a zoom
  can't even be asserted today (couples with F-05's proposed `cam.dist`).
- **Platform:** laptop
- **Evidence:** audit-evidence/laptop/10-camera-zoom-in.png,
  laptop/11-camera-zoom-out.png (pixel-identical pair; laptop/09-controls-hud.png
  as pre-input baseline)
- **Severity:** major
- **Concrete fix:** Wheel/trackpad-pinch **dolly** zoom on the follow boom:
  player-initiated, damped, clamped between F-05's minimum (just outside the
  avatar's bounding radius + near plane) and ~8–10 m; never a FOV zoom (fixed
  FOV is law). Under Verminder-beweging the zoom applies as an instant step
  (camera moves become cuts), still player-initiated. Expose `cam.dist` on the
  dev hook (same field F-05 needs). Sequence AFTER F-07 (scale) + F-05 (boom
  rebuild) — tuning zoom against the current inside-the-mesh rig is wasted
  work. Decide with Floris whether iPad gets pinch-zoom too (not captured, not
  in the punch-list).
- **Verify by:** E2E assert (wheel event on laptop project changes `cam.dist`,
  respecting both clamps; no FOV change) + screenshot pair (zoomed-in vs
  zoomed-out framing visibly differs); trackpad pinch feel: needs Floris demo
- **Confidence:** high
- **Contract check:** motion-comfort camera law — player-initiated, damped,
  fixed FOV, reduced-motion steps as cuts, exactly as specified above. Safe if
  so; no new deps needed.

### F-17 · Laptop drag does not orbit — it relocates the player and flips the view 180°
- **Defect:** Punch-list #4 (orbit half), confirmed and sharpened: the natural
  look-around gesture actively misfires. A 216 px rightward drag from canvas
  center produced (a) a **player position change of 0.93 m** (z −24.62 →
  −25.56; a camera control must never move the player), (b) a **~180° facing
  flip** — the mission tracker switches "naar links · 18 m" → "naar rechts ·
  18 m" between shots 11 and 12 with the target distance unchanged, 83% of
  pixels changed (mean |Δ| 58/255) and drawCalls collapsed 47 → 13 (the view
  now faces the F-09 void), and (c) the camera again wedged against avatar
  geometry (leg/boot masses frame both edges of shot 12). Most plausible
  mechanism: the drag's pointer-up lands in the tap-to-walk path; whatever the
  mechanism, a child trying to look around gets teleport-turned instead —
  worse than the control simply being absent.
- **Platform:** laptop
- **Evidence:** audit-evidence/laptop/12-camera-orbit.png vs
  laptop/11-camera-zoom-out.png (tracker flip readable in both; pos/yaw/
  drawCalls in annotations-laptop.json)
- **Severity:** major
- **Concrete fix:** Add player-initiated **drag-orbit**: yaw free, pitch
  clamped (~−10°…+30°), damped, fixed FOV, roll 0, respecting F-05's boom
  min-clamp/spherecast. Discriminate click vs drag at the pointer layer: total
  pointer movement beyond a small threshold (~6 px) → camera drag only,
  tap-to-walk suppressed; a clean click still walks. Under Verminder-beweging
  the orbit applies as stepped cuts. Sequence AFTER F-07 + F-05.
- **Verify by:** E2E assert (drag changes the real camera yaw ~proportionally
  while `pos` stays unchanged; a clean click still walks — see F-18 for which
  yaw field to trust) + screenshot; drag feel/damping: needs Floris demo
- **Confidence:** high
- **Contract check:** motion-comfort camera law — player-initiated, damped, no
  snap-rotate, reduced-motion cuts; no new deps. Safe if so.

### F-18 · Dev-hook camera telemetry is decoupled from the render — yaw and drawCalls moved between pixel-identical frames
- **Defect:** A verification-substrate defect, found because A5's verdicts were
  pixel-diffed instead of hook-read. Between shots 09 → 10 the only inputs were
  a mouse-move to canvas center and a wheel scroll, yet the hook reported
  **cameraYaw 1.2235 → π and drawCalls 29 → 47 — while the two frames are
  pixel-identical** (mean |Δ| 0.02/255, 0.0% of pixels above noise; 10 → 11
  then holds π/47 and is again identical). At least one of these transitions is
  false telemetry: the render provably did not change. Likely cause: the yaw is
  derived from a boom/target vector that is degenerate while the camera sits
  inside the avatar (F-05) — atan2 of a near-zero vector — and drawCalls is
  sampled at an inconsistent moment. Consequences: (1) the ledger's planned A5
  inference rule "cameraYaw unchanged → controls absent" would have concluded
  the *opposite* here (yaw DID change, controls do NOT exist); (2) A9's
  steering method "heading/cameraYaw unchanged with turn held → dead steering"
  can lie in either direction — that verdict must lean on `veh.heading`, the
  tracker chip and pixels, not cameraYaw alone; (3) any Run B camera gate built
  on today's fields inherits the run-2 trap (trusting state over pixels); (4)
  one-shot drawCalls samples are noisy (±18 between identical frames), so
  <150-budget asserts should sample max-over-N-frames on a same-frame counter.
- **Platform:** laptop (measured); the same hook serves iPad — assume both
  until proven otherwise.
- **Evidence:** audit-evidence/laptop/09-controls-hud.png vs
  laptop/10-camera-zoom-in.png vs laptop/11-camera-zoom-out.png (pixel-identical
  triple) + the cameraYaw/drawCalls series in annotations-laptop.json
- **Severity:** major
- **Concrete fix:** As part of the F-05 camera rebuild, expose the REAL render
  camera on the dev hook, read from the camera object after the frame update:
  world position, yaw/pitch derived from its quaternion, and boom length
  (`cam.dist` — same field F-16 needs); make drawCalls a same-frame sample
  (renderer.info immediately after render). Add a self-consistency E2E: 3 s of
  no input → yaw/dist stable within ±0.01; and the capture harness keeps
  pixel-diff as the court of appeal for every camera assert.
- **Verify by:** E2E assert (new pose fields stable at idle; F-16/F-17/A9
  asserts consume them) — this finding is itself about making camera claims
  assertable.
- **Confidence:** high that the telemetry contradicts the pixels (measured);
  med on the degenerate-boom explanation.
- **Contract check:** dev-hook-only change, no gameplay surface; keeps the
  <150 draw-call contract *more* honest (same-frame counter, max-over-N
  sampling). Safe.

---

_**Group A6 · Missiebord** — looked at `laptop/20-board-affordance.png`,
`laptop/21-board-open.png` + measured crops (`crops/a6-*.png`, made with
`audit-evidence/crop_tool.py`). **iPad has NO board captures** — the iPad run
crashed before this scene (see F-21). Two genuine positives to keep: the
"Bekijk het missiebord" affordance button measures **270×62 CSS px (≥56 ✓)**,
amber on dark, 3-word Dutch — the first control in the whole set that clearly
passes the tap-target contract; and the open board overlay is the
best-designed surface captured so far (calm 3-column card grid, big serif
titles ≤5 words, biome tags, readable skill chips, generous spacing). The
findings below are about the 3D approach moment, the way back out, and the
missing iPad half. The overlay's blurred backdrop is avatar-interior murk —
that is F-05/F-07, not a new defect._

### F-19 · At the board you cannot see the board — edge-on sliver in avatar murk
- **Defect:** In `laptop/20-board-affordance.png` the player stands at the
  mission board (annotation: pos (4.70, 3.35), `board.near` true, affordance
  shown) but the scene is unreadable: ~85% of the frame is the dark red-brown
  avatar-interior/close-up murk (F-05/F-07), and the board model itself
  appears **almost exactly edge-on** — a thin vertical sliver (~40–90 px wide)
  showing the side profile of the plank, with the white mission papers and red
  scribbles visible only as fragments around its edge (see
  `crops/a6-afford-label.png`). The board's face — the one moment that should
  sell "a ranger's mission board in the forest" — is never presented; all
  actual content arrives via the DOM overlay. The interaction radius triggers
  from any approach angle, so an arbitrary arrival (a real child's, or the
  harness's) can always land on this edge-on view; it is a real state, not a
  harness artifact.
- **Platform:** laptop (proven); iPad state unknown — no capture (F-21)
- **Evidence:** audit-evidence/laptop/20-board-affordance.png,
  audit-evidence/crops/a6-afford-label.png
- **Severity:** major
- **Concrete fix:** After F-07 (scale) + F-05 (camera boom): when the player
  enters the board's near-radius, gently frame the board — damp-turn the
  follow camera so the board's face and the ranger are both in shot (walking
  into the radius is the player-initiated trigger; under Verminder-beweging
  the reframe is a cut, not a move). Alternatively (or additionally) place the
  board so its face points at the natural approach path from the hub. Expose
  `board.near` framing on the dev hook (board-in-frustum boolean) so the shot
  is assertable.
- **Verify by:** screenshot (re-capture: board face + papers readable in the
  affordance shot) + E2E assert (board-in-frustum dev-hook boolean while
  `board.near`)
- **Confidence:** high
- **Contract check:** motion-comfort camera law — the reframe must be damped,
  fixed FOV, roll 0, and become a cut under reduced-motion; it is
  player-initiated (walking there). Safe if so.

### F-20 · The only way out of the open board is an ~18 px dim text link
- **Defect:** In `laptop/21-board-open.png` the sole visible exit from the
  mission-board overlay is "Terug naar de open plek" — an underlined text
  link, **~18 CSS px tall** (measured in `crops/a6-open-terug2.png`), dim
  mid-green on the dark backdrop, bottom-center. There is no X, no top back
  button, no other route back to the world. This is the board's instance of
  punch-list #5 ("no back path") and a direct ≥56 px tap-target violation on
  what is functionally a primary navigation control — on the screen an
  8-year-old will open more than any other. (The string itself is fine: 5
  words, M3-friendly.)
- **Platform:** laptop (proven); the overlay is shared code so almost
  certainly both — iPad unproven (F-21)
- **Evidence:** audit-evidence/laptop/21-board-open.png,
  audit-evidence/crops/a6-open-terug2.png
- **Severity:** major
- **Concrete fix:** Promote the exit to a real button ≥56 px tall with the
  same high-contrast treatment as "Bekijk het missiebord" (amber or outlined
  chip style), keep the ≤7-word label, and share the fix with the F-02/F-14
  HUD-chip min-height token so every interactive chip lands ≥56 px in one
  change. Keep it read-aloud wired if the string changes.
- **Verify by:** E2E assert (exit-control boundingBox ≥56 px on both
  projects) + screenshot
- **Confidence:** high
  _A8 addendum:_ the exit is a `.ra-text-btn`, and that class carries
  `min-height: 56px` (app/src/ui/missions.css:66) — the invisible HIT area
  may already meet the contract's letter. The defect stands as an
  **affordance** failure (it looks like an 18 px dim link); the fix is
  unchanged: make it LOOK ≥56 px, not just hit ≥56 px.
- **Contract check:** enforces ≥56 px; reading ≤7 words unchanged; no new
  keys. Safe.

### F-21 · GAP: iPad has ZERO evidence for board, mission and reduce-motion — the capture run dies before them
- **Defect:** `annotations-ipad.json` records `mission-board`, `mission-3d`
  and `reduce-motion` as GAP entries: the page/browser **closed mid-scene**
  ("Error: keyboard.up: Target page, context or browser has been closed")
  during the keyboard-walk toward the board, and every scene after it got
  nothing. Consequences: (1) the game's three most content-critical surfaces
  (mission select, actual mission play, comfort mode) have **no evidence on
  the primary, iPad-first platform** — card-grid layout at 1080×810, the
  bottom-center "Bekijk het missiebord" button vs the bottom-left joystick
  (possible collision), and every ≥56 px measurement there are all unproven;
  (2) the harness reaches the board via **keyboard locomotion on the touch
  platform** (`capture.spec.ts:251–285` `walkTo` uses `page.keyboard.down`),
  so even a successful iPad capture would not exercise touch controls for
  this leg; (3) the crash mechanism (headless GPU-less Chromium at dsf 2,
  2160×1620 canvas, one long-lived page for the whole flow — likely WebGL
  context loss/renderer OOM) will hit Run B's screenshot-in-loop gate too:
  board/mission fixes would be unverifiable on iPad until the harness is
  hardened.
- **Platform:** iPad
- **Evidence:** audit-evidence/annotations-ipad.json (GAP entries for
  mission-board, mission-3d, reduce-motion; no `ipad/*board*.png` exists)
- **Severity:** major (verification substrate — it gates every iPad verdict
  on the board/mission/comfort screens)
- **Concrete fix:** Harden the capture harness EARLY in Run B, before any
  board/mission fix is verified: (a) isolate scene groups in fresh pages/
  contexts (re-seed sessionStorage gate + game state per group) so one
  renderer death cannot erase all later scenes; (b) drive the iPad board
  approach with touch (tap-to-walk / joystick), keeping keyboard only for the
  laptop project; (c) add one retry per scene on page-crash. Then re-capture
  and give the iPad board/mission shots the same A6/A7 judgement laptop got.
  This touches only `app/e2e-capture/**` (allowed — it is not game code and
  not the frozen e2e suite).
- **Verify by:** screenshot (ipad board-affordance/board-open/mission-3d/
  reduce-motion PNGs exist in the next capture run) — then their content gets
  judged per F-19/F-20/A7/A10 criteria
- **Confidence:** high (the GAP itself is recorded data; the OOM/context-loss
  mechanism is med)
- **Contract check:** none for the harness change itself; the frozen
  `e2e:smoke` suite and `app/e2e/**` stay untouched (the capture harness is a
  separate tree).

### F-22 · The board's world-space label is cut off mid-word by scene geometry
- **Defect:** In `laptop/20-board-affordance.png` the floating "● Missiebord"
  label chip is **clipped mid-glyph** — the chip's rounded left side renders
  normally but its right side terminates in a hard vertical cut exactly where
  a nearer mesh surface begins (`crops/a6-afford-label.png` shows the last
  letters half-eaten). That pattern means the label lives in the 3D scene and
  is depth-occluded by geometry (here: the giant avatar's leg — F-07 makes
  this constant), so the one string that names the object is unreadable at
  the exact moment it matters.
- **Platform:** laptop (proven); same renderer path on iPad — unproven (F-21)
- **Evidence:** audit-evidence/laptop/20-board-affordance.png,
  audit-evidence/crops/a6-afford-label.png
- **Severity:** minor (the DOM affordance button carries the interaction; the
  label is discovery/reading support)
- **Concrete fix:** Make world labels occlusion-proof: render them as
  DOM-projected overlays (screen-space, like the HUD) or as sprites with
  depth-test off plus a distance/behind-camera fade. Re-check after F-07 —
  a normal-sized avatar removes the constant occluder, but props/trees can
  still occlude labels, so the occlusion-proof rendering is worth doing
  regardless.
- **Verify by:** screenshot (label fully readable in the re-captured
  affordance shot, including from an angle where geometry passes in front)
- **Confidence:** high that it is clipped in the shot; med on the
  depth-occlusion mechanism (DOM overlays cannot be occluded by canvas
  content, which is what makes in-scene rendering the parsimonious read).
  _A7 addendum:_ recurs identically in-mission —
  `laptop/22-mission-3d.png` shows the same label clipped mid-word again.
  _A9 addendum:_ two more instances at the vehicle area — the jeep's label
  "● Het s…" is clipped by avatar murk (`laptop/14-jeep-near.png`), and
  mid-drive a POI chip reading "…tille zanc…" (almost certainly "Stille
  zandverstuiving") is eaten on both sides by geometry
  (`crops/a9-pillar-label.png`, from `ipad/16-jeep-drive-4.png`). The
  occlusion-proof label fix must cover world, vehicle AND POI labels alike.
- **Contract check:** reading M3/E3 — a label that can vanish behind geometry
  fails "readable"; the fix restores it. No draw-call risk worth naming. Safe.

### F-23 · Mission cards are text-only — a wall of ten reading tasks for a dyslexic player
- **Defect:** The open board (`laptop/21-board-open.png`) presents ten
  visually identical white cards: small-caps biome tag, serif title, 1–2
  skill chips — no image, icon or pictogram anywhere (`crops/a6-open-card.png`
  confirms at full size). Titles are short (≤5 words ✓) and type is clean,
  but for the actual player — 8 years old, dyslexic — choosing a mission
  means reading ten cards; nothing lets him recognize "the frog one" or "the
  jeep one" at a glance. The screen is well-crafted typography that
  under-serves its audience.
- **Platform:** both (shared overlay; iPad rendering unproven — F-21)
- **Evidence:** audit-evidence/laptop/21-board-open.png,
  audit-evidence/crops/a6-open-card.png
- **Severity:** polish
- **Concrete fix:** Add one simple pictogram per card (animal/biome
  silhouette — flat vector in the existing palette, drawn in-repo, no new
  deps or asset pipeline needed), sized ~48–64 px, left of or above the
  title; keep read-aloud on card focus/tap so hearing the title remains an
  option. Optionally color-tint the card header band per biome to aid
  scanning.
- **Verify by:** screenshot (each card shows a distinct pictogram)
- **Confidence:** high (the image proves text-only; the audience need is from
  the project brief, not pixels)
- **Contract check:** reading M3/E3 + read-aloud (supports it); no new deps
  (hand-drawn SVG/canvas shapes only); assets via `assetUrl` if files are
  added. Safe.

---

_**Group A7 · Missie (3D in-place)** — looked at `laptop/22-mission-3d.png` +
measured crops (`crops/a7-*.png`). Annotation: `screen: "mission"`,
`missionView: "3d"`, drawCalls 71, mission "De verdwaalde frisling"
(prompt: zoek de big). **iPad: no capture — F-21 GAP.** One real positive:
the prompt bar has a **read-aloud speaker button** — the M3/E3 read-aloud
contract has a visible affordance in missions. Everything else below. The
board's floating label is clipped mid-word here too (recorded as an addendum
on F-22, not a new finding)._

### F-24 · The mission plays as floating props in a dark void — board from behind, no ground, bottom fifth pure black
- **Defect:** `laptop/22-mission-3d.png`: the actual gameplay moment renders
  as disembodied objects in the F-05 avatar-murk. The mission board is seen
  from BEHIND (two planks with paper showing through the gaps — the mission
  started from wherever the player happened to stand, camera never reframed);
  three low-poly bushes and the pale piglet blob float against dark brown
  nothing; no ground plane, horizon or grass field is visible anywhere
  (`crops/a7-content.png`), and the bottom ~160 px of the frame is uniform
  near-black with no UI in it (`crops/a7-bottom.png`). "Zoek de big in het
  gras" plays in a scene that contains no visible gras. The piglet itself
  cannot be fairly judged in this light/framing — re-judge its model after
  the camera/scale fixes land.
- **Platform:** laptop (proven); iPad unproven (F-21)
- **Evidence:** audit-evidence/laptop/22-mission-3d.png,
  audit-evidence/crops/a7-content.png, audit-evidence/crops/a7-bottom.png
- **Severity:** major (it is the core play moment; mostly a downstream view of
  F-05/F-07, but missions need their OWN framing fix and re-verify)
- **Concrete fix:** After F-07 + F-05: give mission start a composed framing
  **cut** (reduced-motion law explicitly prefers cuts) that shows the play
  area — target props (grass patch + hiding spots), the ranger, and enough
  ground/horizon for spatial context; aim the follow camera at the mission
  area centroid, not wherever the player last looked. Expose a
  mission-target-in-frustum boolean on the dev hook so the framing is
  assertable. Then re-capture and re-judge the scene content (piglet model,
  prop layout) which today is unjudgeable.
- **Verify by:** screenshot (re-captured mission-3d shows ground + board face
  or play area + piglet in a lit, composed frame) + E2E assert
  (mission-target-in-frustum at mission start)
- **Confidence:** high
- **Contract check:** motion-comfort camera law — use a CUT at mission start
  (compliant by definition), no pan/zoom flourish; never-scary — the dark
  void frame is itself borderline unsettling, the fix removes it. Safe.

### F-25 · Mission prompt: two sentences in two type sizes on ONE ~900 px line; speaker button under 56 px
- **Defect:** The prompt renders as a single wide bar (x≈192–1090, ~65 px
  tall) containing BOTH sentences side by side on one visual line: "Zoek de
  big in het gras." in large type, then "Volg het spoor naar de schuilplek."
  in visibly smaller type (`crops/a7-prompt-mid.png` shows both sizes
  meeting mid-bar), then the read-aloud speaker. That is an 11-word visual
  line — the M3/E3 contract is ≤7 words per line, and the size mix makes the
  second (actionable) instruction the harder one to read. The speaker
  button's visible tap circle measures **~46 px** (`crops/a7-prompt-right.png`)
  — under the ≥56 px contract on the one control this player depends on most.
- **Platform:** laptop (proven); shared mission UI so almost certainly both —
  iPad unproven (F-21)
- **Evidence:** audit-evidence/laptop/22-mission-3d.png,
  audit-evidence/crops/a7-prompt-left.png, crops/a7-prompt-mid.png,
  crops/a7-prompt-right.png
- **Severity:** major
- **Concrete fix:** Stack the prompt: sentence 1 (goal, 5 words) on line one,
  sentence 2 (current step, 6 words) on line two — same type size, each ≤7
  words; or show only the current step and reveal the goal via the board/
  pause. Give the speaker a ≥56 px hit area (padding may be invisible, but
  the visible circle should also grow — it is the affordance) and wire it
  into the same min-size token as F-02/F-14/F-20. Read-aloud must keep
  firing on each new step string — that behavior is not provable from a
  still.
- **Verify by:** screenshot (two stacked ≤7-word lines, one size) + E2E
  assert (speaker boundingBox ≥56 px, both projects) — read-aloud audio
  itself: needs Floris demo
- **Confidence:** high
- **Contract check:** enforces reading M3/E3 ≤7 words/line + read-aloud;
  enforces ≥56 px. Safe.

### F-26 · In a mission there is NO way out — Pauze chip and all navigation vanish
- **Defect:** During mission play the HUD is stripped: the top-left corner
  where Pauze lives in the world view is empty murk
  (`crops/a7-topleft.png` — nothing left of the prompt bar's rounded corner
  at x≈192), the bottom strip has no UI (`crops/a7-bottom.png`), and no
  stop/back control exists anywhere in the frame. Once an 8-year-old starts
  a mission there is no visible way to pause, stop or return to the world —
  punch-list #5 at its sharpest (the world view at least shows Pauze). A
  child who is stuck, tired or uncomfortable has no self-serve exit; that is
  precisely the frustration the never-scary/never-game-over philosophy
  exists to prevent.
- **Platform:** laptop (proven); shared mission shell so almost certainly
  both — iPad unproven (F-21)
- **Evidence:** audit-evidence/laptop/22-mission-3d.png,
  audit-evidence/crops/a7-topleft.png, audit-evidence/crops/a7-bottom.png
- **Severity:** major
- **Concrete fix:** Keep the Pauze chip visible (top-left, ≥56 px per F-14)
  during `screen: "mission"`, and give the pause hub a calm "Stop de missie"
  action that returns to the world with progress kept (never punitive, no
  confirmation maze — one tap to pause, one to stop). Couple with A8's
  pause-hub findings so the hub actually offers the route. Expose
  `screen`/`missionView` transitions on the dev hook (already present) for
  the assert.
- **Verify by:** E2E assert (Pauze visible + ≥56 px while
  `missionView: "3d"`; activating stop returns `screen` to "world") +
  screenshot
- **Confidence:** high
- **Contract check:** never-scary/never-game-over — stopping must never read
  as failure (no "weet je het zeker?" guilt copy; calm wording, progress
  kept); ≥56 px; any "mission stopped" string ≤7 words + read-aloud. Safe if
  so.

---

_**Group A8 · Pauze / menu** — looked at `laptop/13-pause-hub.png`,
`ipad/10-pause-hub.png` + measured crops (`crops/a8-card-laptop.png`,
`crops/a8-card-ipad.png`). Positives worth keeping: the hub exists and is
identical on both platforms; **"Terug naar de open plek" is a proper primary
button at 294×62 CSS px (≥56 ✓**, same style as A6's affordance button); every
string is ≤7 words at M3 ("Wat wil je doen?" 4 words, links 3–4 words); and
`showPauseHub()` stops the narrator on open (read-only code look). NB the
annotation reports `screen: "world"` while paused — the hub is a DOM card over
the live world; there is no pause state on the dev hook (F-27's assert needs a
real screen transition, not this field). Backdrop bonus:
`ipad/10-pause-hub.png` is another strong F-07 scale anchor — cabin, signpost
and full-grown trees all fit UNDER the avatar's torso, which bridges the top of
the frame._

### F-27 · The pause hub is the "back" moment but offers NO main-menu / title path
- **Defect:** Punch-list #5, confirmed as structural. The hub's complete option
  set, identical in both shots: "Open het prikbord (0/3)", "Vang je raaf op",
  "Bekijk je breinkracht-badges", "Instellingen", and the amber "Terug naar de
  open plek" (= resume). **Nothing navigates out of the world** — no
  "Hoofdmenu", no route back to the title screen (so no way to revisit the
  avatar-maker either) short of reloading the browser tab. A read-only look at
  the code confirms the screenshots: `showPauseHub()`
  (app/src/ui/Missions.ts:991) wires exactly these five leaves and its own
  comment says "Every leaf stays in the world (card()-only, no
  leaveWorld/setScreen)"; "hoofdmenu"/title appears nowhere in the file. Combined
  with F-26 (in-mission even the Pauze chip vanishes), the game currently has
  **zero exits anywhere below the title screen**.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/13-pause-hub.png,
  audit-evidence/ipad/10-pause-hub.png, audit-evidence/crops/a8-card-laptop.png
  (+ read-only corroboration: app/src/ui/Missions.ts `showPauseHub`)
- **Severity:** major
- **Concrete fix:** Add one action to the hub: "Naar het hoofdmenu" (3 words)
  that returns to the title screen — one tap, calm, **no "weet je het zeker?"
  confirmation maze**, progress kept automatically (state.ts already persists
  write-through; if reassurance copy is wanted: "Je spullen blijven bewaard.",
  4 words). Style it per F-28's promoted buttons (≥56 px visible). The
  sessionStorage gate must not re-ask the password on the title round-trip.
- **Verify by:** E2E assert (activating the action moves the dev-hook `screen`
  to "title"; re-entering the world restores the same avatar + progress) +
  screenshot (hub shows the action on both platforms)
- **Confidence:** high
- **Contract check:** never-scary / never-game-over — leaving must read as
  neutral navigation, never as failure or loss; persistence stays in the
  existing `alvah-ef-v1` ranger namespace (no new keys needed); new strings
  ≤7 words + read-aloud. Safe if so.

### F-28 · The hub's four destinations are 16 px fine print — buttons that don't look like buttons
- **Defect:** The four navigation actions render as underlined text links:
  visible affordance measured **136×16 CSS px** (laptop) and ~141×15 CSS px
  (iPad, 283×30 raw at dsf 2) — sitting above a 294×62 resume button. Nuance
  Run B must know: the ≥56 px contract is NOT technically violated —
  `.ra-text-btn` carries `min-height: 56px` (app/src/ui/missions.css:66), so
  the invisible hit area complies; what fails is the **affordance**. For this
  player (8, dyslexic) the whole meta-navigation (case board, companion,
  badges, settings) is presented as four fine-print reading tasks in a 2×2
  scatter: nothing looks tappable, and finding "Instellingen" means reading
  all four.
- **Platform:** both
- **Evidence:** audit-evidence/crops/a8-card-laptop.png,
  audit-evidence/crops/a8-card-ipad.png (mask-measured); app/src/ui/missions.css:58-67
  (read-only)
- **Severity:** minor
- **Concrete fix:** Restyle the four links as chip/outline buttons whose
  VISIBLE box is ≥56 px tall (so the child sees what the hit area already is),
  with clear separation, each carrying a small flat pictogram (pin board /
  raven / badge / gear — same in-repo vector approach as F-23) so recognition
  doesn't require reading. Share the chip token with F-02/F-14/F-20 so all
  chip fixes are one change.
- **Verify by:** screenshot (four button-shaped, icon-carrying targets; visible
  box ≈ hit box) — the DOM box already passes ≥56, so no new E2E assert needed
- **Confidence:** high
- **Contract check:** enforces the ≥56 px *spirit*; reading M3/E3 (pictograms
  reduce reading load); no new deps (in-repo vectors). Safe.

### F-29 · No scrim behind the pause card — the modal floats on raw, murky world pixels
- **Defect:** The pause card sits directly on the live world render with no
  dim/scrim — unlike the A6 board overlay (dark backdrop): inconsistent modal
  treatment. What leaks through is the run's worst imagery: on laptop the F-09
  void plus avatar-interior masses on both frame edges and the F-12 shadow
  band across the bottom half; on iPad the F-07 giant's torso bridging the top
  with red leg-masses either side. A pause surface for an EF-profile child
  should mute the world behind it; today the background competes with (and is
  uglier than) the card.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/13-pause-hub.png,
  audit-evidence/ipad/10-pause-hub.png
- **Severity:** polish
- **Concrete fix:** One shared modal treatment for pause/board/mission cards:
  a static ~35–50% dark scrim (plain rgba overlay, no backdrop-filter) that
  appears as an instant state change (a cut — reduced-motion-safe by
  construction). The murk behind it also shrinks when F-05/F-07/F-09/F-12
  land; the scrim makes modal focus independent of world state.
- **Verify by:** screenshot (pause + board overlays show the same dimmed
  backdrop on both platforms)
- **Confidence:** high
- **Contract check:** motion-comfort — static dim only, no blur/parallax
  animation; DOM-only (draw calls unaffected). Safe.

---

_**Group A9 · Jeep** — looked at all 12 shots (`laptop/14..19`, `ipad/11..16`)
plus the `veh`/`cameraYaw` series in both annotation files, PNG mtimes for real
burst timing, and 4 measured crops (`crops/a9-*.png`). The harness holds
ArrowUp+ArrowLeft for the whole burst (capture.spec.ts:178-185). Genuine
positives: the **jeep model is very good** (orange roof, roll cage, spare
wheel — `crops/a9-jeep-close.png`), and next to it stands a **helicopter on a
landing pad** (`crops/a9-heli.png`) — handsome, never mentioned in any doc, the
set's nicest world-content discovery; "🚙 Stap in de jeep" measures 297×56 CSS
px and "Stap uit" 162×56 — both exactly meet the ≥56 contract, and Stap-in
carries a speaker icon (read-aloud affordance ✓); the mission tracker keeps
updating while driving. The bad news is structural: driving is blind (F-30),
the ranger never visibly boards (F-31), steering is unverifiable-yet-not-frozen
(F-32), and the famous "blur/DOF" turns out not to exist as an effect (F-33).
Two more clipped world labels recorded as an F-22 addendum._

### F-30 · Driving is blind — the camera stays at the standing giant avatar; only its yaw is slaved to the jeep
- **Defect:** The drive camera never re-anchors to the vehicle. Data:
  `cameraYaw ≡ veh.heading + π` within 0.06 rad in **all 8 drive frames on
  both platforms** — the yaw is hard-slaved to the jeep's heading. But the
  camera's *position* stays at/inside the giant avatar mesh left standing at
  the boarding spot: 6 of 8 drive frames are featureless close-up murk edge to
  edge (`laptop/16,18,19`, `ipad/13,15` — laptop/16 and 19 are near-uniform
  brown with only HUD visible), and the two clear frames (`ipad/14,16`) show
  the jeep **from the outside, ~15–20 m away**, with the avatar's leg pillar
  at frame-left — the view of someone standing beside the road, not driving.
  iPad's `11-jeep-near` is 100% murk too: on the touch platform even the
  walk-up and the "Stap in de jeep" tap happen against a blank brown screen.
  This is what Floris's "the jeep does not steer" felt like from the seat:
  nothing visible ever responds, because nothing is visible.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/16-jeep-drive-1.png,
  laptop/18-jeep-drive-3.png, laptop/19-jeep-drive-4.png,
  ipad/11-jeep-near.png, ipad/13-jeep-drive-1.png (murk);
  ipad/14-jeep-drive-2.png, ipad/16-jeep-drive-4.png (jeep seen from outside);
  cameraYaw/veh.heading series in both annotations files
- **Severity:** blocker
- **Concrete fix:** Give the vehicle its own camera state: on "Stap in" the
  follow camera re-anchors to the JEEP (boom behind it with F-05's clearance
  rules — min distance outside the jeep's bounding radius + near plane,
  spherecast; eye ≈2.5–3.5 m, aimed over the hood at the horizon), on
  "Stap uit" it hands back to the avatar rig. Enter/exit reframes are CUTS
  (reduced-motion law prefers them; use them for everyone). Yaw-follow while
  driving must be damped/lagged, not hard-locked — see F-32's turn-rate note,
  a hard heading-lock at the observed turn rate would whip the whole world
  around. Sequence AFTER F-07 (scale) + F-05 (camera rebuild); this is then
  mostly re-targeting the same rig. Expose `cam.target` ("avatar"|"vehicle")
  and reuse `cam.dist` on the dev hook.
- **Verify by:** screenshot (a re-captured drive frame shows the jeep from
  behind with ground + horizon) + E2E assert (`cam.target` = "vehicle" and
  `cam.dist` in range while `veh.inVehicle`; pixel-diff between consecutive
  drive frames is non-trivial) — drive feel/comfort: needs Floris demo
- **Confidence:** high
- **Contract check:** motion-comfort camera law — damped follow, fixed FOV,
  roll 0, enter/exit as cuts, no shake/snap. The fix as specified respects it.

### F-31 · The ranger never boards — the jeep drives around EMPTY while the giant stays standing
- **Defect:** `crops/a9-jeep-close.png` (from `ipad/16-jeep-drive-4.png`)
  shows the mid-drive jeep with a plainly **empty seat** (open roll cage,
  steering wheel, no figure). In both clear drive frames the avatar's leg
  pillar stands at frame-left while the jeep circles the grass. The data
  agrees: while `inVehicle`, `pos` tracks the moving vehicle (snaps to exactly
  (16.00, 14.00) at entry on both platforms, then moves with the drive), yet
  the rendered avatar stays planted at the boarding spot, and `clip` remains
  **"idle"** in every in-vehicle frame — there is no sit/drive pose at all.
  For the child the story on screen is: your ranger does NOT get in; the jeep
  leaves without you while the HUD claims you are driving.
- **Platform:** both
- **Evidence:** audit-evidence/crops/a9-jeep-close.png,
  ipad/14-jeep-drive-2.png, ipad/16-jeep-drive-4.png (standing leg + empty
  jeep), laptop/17-jeep-drive-2.png (giant boot mid-drive), `clip`/`pos`
  fields in both annotations files
- **Severity:** major
- **Concrete fix:** On enter, parent the (F-07-normalized) avatar to the
  jeep's seat node in a seated pose — a real `sit`/`drive` clip if the rig has
  one, else a static seated pose; acceptable fallback is hiding the avatar
  while `inVehicle` (the cabin mostly hides a driver anyway). Restore beside
  the door on exit. Keep the walk clip off while seated.
- **Verify by:** screenshot (driver visible at the wheel in the re-captured
  drive frames — or verifiably hidden if that fallback is chosen) + E2E assert
  (avatar parented/hidden while `inVehicle`; `clip` = sit/none, never idle/walk)
- **Confidence:** high
- **Contract check:** none at risk (never-scary unaffected; no new keys; no
  new deps if the pose is authored from existing bones). Safe.

### F-32 · Steering: "heading frozen" is data-refuted — but steering is unverifiable, imperceptible, and if real, tuned like a spin-top
- **Defect:** Punch-list #3 said the jeep "stays at a fixed heading". The data
  says otherwise: with ArrowUp+ArrowLeft held ~19 s, `veh.heading` moved
  substantially between every consecutive sample on both platforms (wrapped
  jumps of 2.2–3.3 rad per 3.5–4.75 s interval — PNG mtimes), the tracker
  bearing cycled naar rechts → recht vooruit → naar links with distance
  oscillating 35–47 m, and the four sampled positions stay inside a ~10×10 m
  box despite ~80 m of path at the constant 4.2426 m/s — the jeep
  demonstrably turns continuously and goes nowhere: it drives doughnuts.
  What the evidence CANNOT establish: (a) that the turning is **caused** by
  the held ArrowLeft — the burst never varied its input, so an
  always-circling jeep would produce identical data (no control condition);
  (b) that any other steering input works — **iPad touch steering has zero
  evidence** (the harness drives iPad with the keyboard, F-21's flaw); (c)
  that a player could perceive any of it — F-30's blindness hides the
  turning entirely. Also visible in the data: speed sits at max (exactly
  √18 = 4.2426) from the very first drive sample — no acceleration ramp —
  and the implied turn rate (radians per second, with possible whole extra
  turns aliased away between samples) is a spin-top: far too hot for a
  motion-sensitive child once F-30 makes the camera actually follow it.
- **Platform:** both (iPad touch steering: GAP)
- **Evidence:** `veh.heading`/`pos`/`speed` series in both annotations files
  + PNG mtimes for Δt; tracker chips readable in laptop/16..19-jeep-drive-*.png,
  ipad/13..16-jeep-drive-*.png
- **Severity:** major
- **Concrete fix:** Verification-first, then tuning. (1) With F-30's camera
  landed, add control-condition E2E asserts (laptop project): drive 3 s with
  NO turn key → unwrapped heading drift ≈ 0; hold one turn key 2 s →
  unwrapped heading changes monotonically in one direction by an expected
  range; consecutive drive frames differ in pixels. **Unwrap headings before
  comparing** — wrapped yaw already inverted one audit rule (F-18). (2) Wire
  and assert iPad in-vehicle touch steering (joystick x-axis) once F-21's
  touch harness exists. (3) Tune for comfort: cap turn rate ≈0.6–0.9 rad/s at
  full speed (speed-scaled), add a ~1 s acceleration ramp, keep top speed
  clearly above foot speed (the jeep's reason to exist, per F-08).
- **Verify by:** E2E assert (control-condition heading tests + pixel-diff) +
  burst re-capture screenshots; steering feel and motion comfort: needs
  Floris demo
- **Confidence:** high on "not frozen + confined circling" (measured); low on
  input-causation either way — that is precisely what the new asserts settle
- **Contract check:** motion-comfort — turn-rate cap and accel ramp are
  locomotion tuning (always allowed); camera consequences live in F-30. Safe.

### F-33 · The "drowned in blur/DOF" render is neither blur nor DOF — it is the giant's own magnified textures (no postprocess pass exists)
- **Defect:** A diagnosis that retargets punch-list #3's render half.
  Read-only greps of `src/render3d/` find **no DOF, bokeh, bloom or any
  postprocessing pass**; the only blurs in the codebase are DOM
  `backdrop-filter` on HUD chips, and scene fog is ordinary linear distance
  fog (near 16–22 m, far 64–90 m — the pleasant horizon haze). The "blurry"
  frames are the F-07 giant's low-res textures **magnified 10–30×** and seen
  from centimeters away (the white speckled band across `*/12/15-jeep-in` is
  one stretched texture detail; the smooth murk gradients in the drive frames
  are magnified texels, not focus falloff), while genuinely distant grass in
  the SAME frames stays sharp. Consequence for Run B: there is no blur effect
  to find and remove — the symptom dissolves when F-07 (scale) and
  F-05/F-30 (camera outside the geometry) land. Do not spend a box hunting a
  DOF pass that isn't there.
- **Platform:** both
- **Evidence:** audit-evidence/laptop/15-jeep-in.png, ipad/12-jeep-in.png
  (sharp far grass + soft near mass in one frame), laptop/16,19-jeep-drive,
  ipad/13-jeep-drive-1.png (uniform magnified-texture murk); read-only grep
  of app/src/render3d (no postprocess), app/src/render3d/World.ts:338 (fog)
- **Severity:** major (as de-risking: it closes a whole phantom fix branch)
- **Concrete fix:** None of its own. Close this finding when the re-captured
  walk/drive frames after F-05/F-07/F-30 show crisp geometry; only if any
  soft-focus look survives that re-capture, investigate materials (texture
  filtering) — not postprocessing.
- **Verify by:** screenshot (post-fix re-capture: walk + drive frames crisp)
- **Confidence:** high that no postprocess blur exists (code tree searched);
  med-high that magnification explains all observed softness
- **Contract check:** none.

---

_**Group A10 · Reduce-Motion wereld** — there is NOTHING to look at: no
`reduce-motion-world` PNG exists on either platform (double GAP). This sitting
instead pinned down WHY each capture died (read-only look at
`app/e2e-capture/capture.spec.ts` + `app/src/main.ts`) and what a re-capture
must show. The reduced-motion FEATURE is not absent in code:
`core/reduced-motion.ts` dual-gates the OS query ∪ the in-game toggle — whose
actual UI label is **"Rustige beweging"** (Tweaks.ts:42), not the docs'
"Verminder beweging" — and `render3d/MotionMode.ts` encodes the §1e policy
(camera cuts-not-moves, secondary motion frozen, locomotion/expression/gaze
kept) with unit tests. What is zero is VISUAL evidence — and "mechanics
proven, pixels never looked at" is exactly the run-2 trap this audit exists
to close. The A10 ledger question ("does the RM world still look good?")
stays OPEN._

### F-34 · GAP: reduce-motion has zero pixels on BOTH platforms — and the scene's design couldn't prove the policy even on success
- **Defect:** The one capture group covering the motion-comfort contract — for
  a motion-sensitive 8-year-old, THE accessibility feature — produced no image
  on either platform. **Laptop:** the reduce-motion scene is the only one that
  re-boots (`capture.spec.ts:214-220`: emulateMedia → `boot(page)`), and
  `boot()` (:231-236) replays the FIRST-RUN flow — but boot 1 persisted
  `avatarGemaakt`, and `main.ts:90` sends a returning player STRAIGHT into the
  world on "Begin": the avatar-maker never mounts, so the helper's click on
  "Dit is mijn ranger" waited ~25 min for a button that can never exist
  (annotations-laptop.json GAP: "Test timeout of 1800000ms exceeded… waiting
  for getByRole('button', { name: 'Dit is mijn ranger' })"). A deterministic
  harness bug, independent of reduced motion — the page was very likely
  sitting in a working RM world the whole time; the harness never pressed the
  shutter. **iPad:** the page had already died two scenes earlier (F-21's
  crash) — its GAP note reads `page.emulateMedia: Target page … has been
  closed`. These are **independent kill conditions**: fixing F-21's crash
  alone would not save this scene — iPad boot 2 would then stall on the same
  `boot()` bug. **Design gap even on success:** the scene snaps ONE still, but
  the coded policy (`MotionMode.ts` §1e) is inherently TEMPORAL and leaves the
  static look unchanged — a correct RM frame should look near-identical to the
  normal world, so a single still can neither pass nor fail the contract; it
  can only catch gross breakage (flat/black/missing world). It also only
  exercises the OS media-query gate, never the in-game "Rustige beweging"
  toggle the child will actually use.
- **Platform:** both
- **Evidence:** audit-evidence/annotations-laptop.json (GAP "reduce-motion":
  timeout waiting for 'Dit is mijn ranger'), audit-evidence/annotations-ipad.json
  (GAP "reduce-motion": dead page); no `*/reduce-motion-world.png` exists in
  either platform directory. Read-only code corroboration:
  app/e2e-capture/capture.spec.ts:214-236, app/src/main.ts:90,
  app/src/render3d/MotionMode.ts, app/src/core/reduced-motion.ts,
  app/src/ui/Tweaks.ts:42.
- **Severity:** major (verification substrate: the motion-comfort law — a
  frozen contract, and the reason this player's profile is in every doc — has
  zero visual verification anywhere)
- **Concrete fix:** Fold into F-21's early-Run-B harness hardening, plus this
  scene's own repairs: (a) fix `boot()` for the returning-player path — after
  "Begin", wait for `screen == 'world'` directly and only wait for the
  avatar-maker when no avatar is persisted (mirror `main.ts:90`), or clear the
  ranger namespace first if a true first-run RM boot is wanted; (b) capture RM
  through BOTH gates: `emulateMedia({reducedMotion:'reduce'})` (OS gate) and,
  as a second state, flip "Rustige beweging" in Instellingen (in-game gate —
  incidentally the set's only capture of the Tweaks/settings UI); the ∪-merge
  is unit-tested so one visual state per platform is acceptable if time-boxed,
  but the toggle path is the one Floris will use on the iPad; (c) make the
  scene judgeable: the RM still (compare against normal world-entry — nothing
  structural may differ), a short walk burst under RM (locomotion must STILL
  animate — keepLocomotion is a §1e invariant), and one idle frame pair
  (secondary motion frozen → near-zero pixel-diff at idle); (d) once F-05/F-18
  land the real `cam` pose fields, add the durable E2E assert: during any
  reframe under RM the camera pose is a step function (cut), never
  interpolated. Then re-judge this group from the new pixels.
- **Verify by:** screenshot (RM stills + bursts exist on both platforms and
  pass the criteria above) + E2E assert (`.rm` body class present via both
  gates; post-F-18 cut-not-move camera assert) — true motion comfort: needs
  Floris demo
- **Confidence:** high (both GAPs are recorded data; the `boot()` mechanism is
  code-confirmed and deterministic)
- **Contract check:** the harness fix touches only `app/e2e-capture/**`
  (allowed — frozen `e2e:smoke` + `app/e2e/**` untouched); the criteria it
  encodes enforce the motion-comfort law (cuts-not-moves, secondary freeze,
  locomotion kept). No game code, no new localStorage keys, no new deps.

<!--
### F-01 · <short title>
- **Defect:**
- **Platform:** iPad | laptop | both
- **Evidence:** audit-evidence/<platform>/NN-<name>.png
- **Severity:** blocker | major | minor | polish
- **Concrete fix:**
- **Verify by:** screenshot | E2E assert (`<field/spec>`) | needs Floris demo
- **Confidence:** high | med | low
- **Contract check:** none | <contract> + how to stay safe
-->

---

## § Self-audit (filled by box A12 — AUDIT-PLAN §6)

_Written by the A12 sitting after re-reading all 34 findings, the A11
synthesis, every §9 log entry, and one final read-only check of
`app/e2e-capture/capture.spec.ts` for the touch-evidence claim in §2 below.
No game code touched._

### 1 · If every fix lands, will it LOOK and CONTROL right on both platforms?

**Laptop — yes for everything captured, with one structural caveat.** Every
laptop surface the harness reached was judged from real pixels, and fix-areas
A–H collectively answer everything found: the world becomes visible
(F-05/F-07/F-09), the camera obeys the player (F-16/F-17), driving is watchable
and steerable (F-30..F-32), every screen below the title gets a way back
(F-20/F-26/F-27), and the HUD/reading layer meets the contracts (F-01..F-03,
F-06, F-13..F-15, F-22..F-25, F-28). The caveat: **this audit judged the game
through a keyhole.** Nearly every world frame is murk from inside or beside the
giant — nobody, including this audit, has ever seen this world composed at eye
height. When F-07+F-05 land, ~90% of the screen is revealed for the first
time, and what appears (biome density, prop placement, the piglet and other
animal models, gait read, lighting) has never been judged. Expect a second,
smaller findings round out of the phase-1 re-capture — §8's hybrid gate exists
precisely for it. This list is sufficient for "not broken"; it is a **lower
bound** for "looks finished" (punch-list #6).

**iPad — yes for the five surfaces that have pixels; extrapolated for the
rest.** Title, avatar, world-entry, walk burst, HUD, pause and the jeep
exterior were judged on iPad pixels and their fixes carry directly. Board,
mission and reduce-motion have ZERO iPad evidence (F-21), so every
"laptop (both?)" row is shared-code inference: near-certain the same defects
exist there, NOT certain no additional ones do (the board-button-vs-joystick
corner collision named in F-21 is exactly the kind of iPad-only layout defect
no still has ever shown). The engine caveat compounds it: all "iPad" pixels
are Chromium with touch viewport + dsf 2, not WebKit — real Safari
rendering/memory behavior stays untested until the on-device pass.

**Controls:** the *scheme* will be right on both platforms (inputs exist,
misfires fixed, every control pinned by an assert); the *feel* — damping,
latency, motion comfort — is demo-gated by design (§4).

**Ranked residual risks after a full green Run B:** (1) the phase-1 reveal
uncovers new world-look defects — likely, budgeted for; (2) an iPad-only
layout defect on board/mission surfaces — F-21's re-capture closes it;
(3) real-Safari divergence — only the demo closes it; (4) feel/comfort
tuning misses for this specific child — only the demo closes it.

### 2 · What the stills did NOT cover (could still be broken)

**Never captured at all — unknown territory, not merely unverified:**

1. **Touch input, anywhere in the run.** Verified in `capture.spec.ts` this
   sitting: every locomotion driver is `page.keyboard` on BOTH projects (walk
   burst :127, jeep burst + steer :178-185, `walkTo` :260-261) and jeep
   boarding is `keyboard.press('Space')` (:173); the only pointer input in the
   whole capture is the laptop camera block (:146-153). **The joystick was
   never dragged, tap-to-walk never tapped, touch steering never touched** —
   zero captured evidence that any canvas touch control works on the
   touch-first platform. (Generalizes the A6/§9 note; the F-21 fix must cover
   ALL touch surfaces, not just the board leg.)
2. **iPad board / mission / reduce-motion** — F-21/F-34, already findings.
3. **The pause hub's four destinations.** Prikbord, raaf, badges and
   **Instellingen** were never opened. Instellingen matters doubly: it hosts
   the "Rustige beweging" toggle F-34's re-capture depends on, and its layout
   (chip sizes, line lengths) is unjudged.
4. **Mission variety and the 2D floor.** One mission ("De verdwaalde
   frisling"), one view (`missionView: "3d"`), zero completions. The 2D
   mini-game floor — a frozen run-2 contract surface — plus reward/completion
   moments and never-game-over behavior on failure states: no pixels.
5. **Animals and the calm-pose gate.** The F-06 toast promises "Tik op een
   dier"; no frame shows a tappable animal, an encounter, or calm-pose
   compliance. The piglet appears only as an unjudgeable blob in murk (F-24).
6. **The helicopter** (A9 discovery) — undocumented content standing in the
   world; enterable or decorative? Never approached.
7. **Returning-player boot.** Everything captured is first-run flow (the one
   returning-player boot, RM's boot 2, died on the F-34a bug). Whether a
   returning player re-gets the F-06 hint stack, and what world-entry looks
   like with persisted state: unknown.
8. **Quality tiers** (run-2 W7.2): FpsProbe stepping and the persisted-laag
   light boot were never captured in either state.
9. **Portrait / resize.** iPad portrait orientation and laptop window resize:
   no evidence.

**Inherently beyond stills (known-unknowns by design):**

- **Everything temporal:** screen transitions, the mission-start cut, pause
  open/close, hint sequencing timing, and the whole cuts-not-moves RM law —
  F-18's step-function asserts + F-34's burst pairs are the planned coverage;
  until those land, no camera-motion claim is verifiable at all.
- **Audio:** read-aloud firing, narrator behavior, spel-tonen — invisible to
  the harness; only the speaker *affordances* were verified.
- **Long-session stability:** the iPad harness crash (F-21, plausibly renderer
  memory at dsf 2) is weak evidence the game itself may degrade over long
  sessions — unproven either way.
- **True latency + motion comfort** — the demo gate (§4).

### 3 · Coupled findings (sequencing constraints Run B must respect)

- **F-07 → F-05 → {F-08, F-09, F-16, F-17, F-19, F-24, F-30}.** Scale first:
  F-05's minimum-boom clamp is defined off the avatar's bounding radius,
  F-08's speed is giant-tuned, and any camera or framing tuned before the
  rescale is redone after it. No camera work before F-07.
- **F-05 ⊕ F-18 land together.** The rebuilt rig must expose the real pose
  fields (`cam.dist`, quaternion-derived yaw/pitch, same-frame drawCalls) or
  every downstream camera assert (F-16/F-17/F-30/F-32/F-34d) is built on the
  telemetry that already lied once (pixel-identical frames, moving yaw).
- **F-33, F-12, F-10 are re-checks, not fixes.** Expected to dissolve/become
  judgeable after F-07/F-05 — re-capture and re-judge; spend fix effort only
  if they survive.
- **F-17 ↔ tap-to-walk seam.** The click-vs-drag discriminator must kill the
  orbit misfire WITHOUT breaking tap-to-walk — one pointer-layer change,
  assert both sides.
- **F-30 reuses F-05's rig** (re-target avatar→vehicle). **F-31's fallback
  choice changes F-30/F-31's verify criterion** (visible driver vs verifiably
  hidden). **F-32's asserts need F-30 + F-18, and for iPad also F-21's touch
  harness.**
- **One chip token: F-02 + F-14 + F-20 + F-25 + F-28** — a single ≥56 px
  visible-box token; **F-01 lands in the same change** (bigger targets push
  the avatar card further off-fold unless the compaction comes with them).
- **One hint system: F-06 + F-15** (+ F-11's boundary hint joins it, + F-13's
  tracker relocation shares the HUD-layout pass) — design the sequencing model
  once; one-time-hint flags via `state.ts` in the ranger namespace.
- **One navigation model: F-27 + F-26 + F-20** — "every screen below the title
  has a visible ≥56 px way back" implemented as a rule, not three patches.
- **Substrate before gates: F-21 + F-34a + evidence archiving precede ALL
  re-captures.** `audit-evidence/` is untracked in git (§9 A6): Run B's FIRST
  act must be archiving/committing the current evidence, or its first
  `npm run capture` destroys every frame this document cites.

### 4 · needs-Floris-demo items — never auto-closed by any screenshot/E2E gate

The +demo rows: **F-06, F-08, F-10, F-15, F-16, F-17, F-25, F-30, F-32,
F-34.** Grouped for the demo session:

- **Motion comfort (the load-bearing group for this child):** walk gait feel
  (F-08/F-10), drive camera + steering feel (F-30/F-32), reduce-motion on the
  real device (F-34).
- **Input feel:** trackpad zoom/orbit damping (F-16/F-17); joystick,
  tap-to-walk and touch steering on real glass (zero touch evidence exists —
  §2 item 1).
- **Audio:** read-aloud firing on new/changed strings (F-06/F-15/F-25).
- **Real Safari:** every iPad conclusion carries the Chromium engine caveat;
  the on-device pass is the only WebKit evidence there will be.

Rule for Run B: these items may reach **"implemented — awaiting demo"**,
never "fixed". Neither Opus's own capture nor a Fable re-judge outranks this;
it is W7.5's lesson codified.

### 5 · Build order + the single highest-leverage fix

Recommended phases — each ends with a both-platform re-capture and an
independent Fable re-judge per §8's hybrid gate:

- **Phase 0 — protect + see (no game code):** archive/commit
  `audit-evidence/`; F-21 harness hardening (scene-isolated pages, TOUCH-driven
  walkTo/steering on the iPad project, crash retry); F-34a `boot()`
  returning-player fix. Exit: a complete capture set (board + mission + RM
  included) exists on both platforms, with iPad driven by touch.
- **Phase 1 — the core (area A):** F-07 scale → F-05 camera + F-18 pose
  fields → F-09 spawn → F-08 speed/stride. Re-capture; re-judge F-10/F-12/
  F-33; triage the expected new world-look findings before going on.
- **Phase 2 — controls (B + C):** F-16 zoom + F-17 orbit (tap-to-walk seam
  asserted both ways); F-30 vehicle camera → F-31 boarding → F-32 steering
  asserts + comfort tuning.
- **Phase 3 — navigation + HUD (D + E + F):** the chip/affordance token
  (F-02/F-14/F-20/F-25/F-28) + F-01 card fit in one change; the navigation
  model (F-27/F-26); hint sequencing (F-06/F-15) + F-13 tracker move.
- **Phase 4 — reading + dressing (G + H):** F-03, F-22, F-23, F-04, F-11,
  F-29.
- **Phase 5 — RM + final sweep:** F-34b–d (both RM gates, burst pairs,
  cut-not-move assert), full both-platform re-capture, Fable re-judge of the
  whole set, then the Floris demo (§4) as the only closer of +demo items.

**The single highest-leverage fix: F-07 — normalize the avatar to ~1.7 m.**
One scale change sits upstream of both blockers' geometry (F-05's clamp is
relative to the avatar's radius), of F-08's speed retune, and of the murk that
constitutes F-12, F-19, F-24, F-29's backdrop and the entire F-33 "blur" — it
converts five findings into mere re-checks and unveils the world every later
judgement needs. F-05 is the fix the player *feels* first; F-07 is the root it
hangs off. Land them as a pair, scale first, and re-capture before touching
anything else.
