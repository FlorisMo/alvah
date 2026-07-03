# Run 3 — UX / polish: findings that kick it off

> Written 2026-07-03 from Floris's first hands-on test of the shipped run-2
> build (`2.1.0-ship`, live at alvah.nl/ranger behind the gate). This is the
> input for run 3. Nothing here is code yet — run 3 turns it into a plan
> (Fable audit) and then fixes (Opus build).

## Platform — READ THIS FIRST (it keeps getting forgotten)

**The game targets BOTH the iPad AND the laptop. Both are first-class.**

- **iPad:** touch — virtual joystick + tap-to-walk, ≥56 px targets, the frozen
  motion-comfort rules, Reduce-Motion in both states.
- **Laptop:** mouse + **trackpad** + keyboard. This means a real desktop
  camera: **trackpad/scroll to zoom in-out, drag/trackpad to orbit the
  camera.** Right now there is no camera control at all on laptop, and Floris
  wants it. Do not treat the laptop as an afterthought or a "dev-only" view.

Every audit capture and every acceptance check in run 3 must be done on **both**
form factors (iPad viewport + touch, laptop viewport + mouse/trackpad/keyboard).

## What run 2 actually delivered

All 54 boxes W0–W7.4 built and deployed live (only W7.5, the on-device
acceptance, stayed open — that is this test). The *world* looks decent: low-poly
trees, a mission board, a genuinely nice jeep model, biome ground. The
*plumbing* works: you can move, missions load, the jeep exists, Reduce-Motion
downgrades. So run 3 is not a rebuild — it is a **look-and-feel / controls
polish pass** on a working skeleton.

## The punch-list from Floris's play (the real problems)

1. **Avatar is enormous / camera clipped inside it — you see only feet.** The
   walk camera sits *inside* the character geometry. This is the #1 issue and
   it is in the run's OWN "evidence" (`runs/run-2-world/qa-evidence-2/
   w32-ranger-walking.jpg` and `app/e2e/__shots__/anim-walking.png` both show
   the camera looking at the inside of a dark shape). The run certified this
   frame as green.
2. **Everything glides.** The moving figure is a placeholder **capsule** (green
   body + ball head — see `w21`/`camera-after-quarter-circle`), and the real
   rigged walk clip is not driving the mesh. No walk cycle → it slides.
3. **The jeep does not turn / steer.** It stays at a fixed heading while
   driving. (The jeep *model* is good; the render is drowned in blur/DOF — see
   `w51-jeep.jpg` — and steering is dead.)
4. **No camera control on laptop.** Cannot zoom in/out, cannot orbit. Floris
   explicitly wants trackpad zoom + orbit.
5. **No navigation to go back / to a main menu.** There is a Pauze button but no
   clear "back / main menu" path.
6. **Overall it feels very far from finished.**

## The root cause (why an autonomous run shipped this)

The run-2 gate proved **mechanics, not looks**: "position moved ≥2 m", "a clip
named walk exists", "draw calls < 150". None of those can see a huge avatar, a
gliding capsule, or a dead steering wheel. The run *did* capture screenshots but
treated them as checkbox artifacts — it never **looked at them and judged them**.
(Tell-tale: `app/qa-evidence-2/` was left empty; the curated stills that do
exist show the broken framing and were passed anyway.)

**Implication for run 3:** switching to a smarter/newer model does NOT fix this
by itself. A model only catches "the avatar is huge" if the harness forces it to
LOOK at a screenshot of the real play camera and critique it. The leverage is
~80% harness design (screenshot-in-the-loop), ~20% model.

## What stills can and cannot prove (design constraint for the harness)

- **Can** prove from a single frame: framing, avatar scale, camera clipping,
  visual beauty, UI presence/layout, readable text, target size.
- **Cannot** prove from a single frame: smoothness, input lag, motion comfort,
  and **gliding vs walking** (one frame can't tell a slide from a stride).
- **Mitigation that closes most of the gap without playtesting:** capture a
  **short burst of frames** during a walk (e.g. 3 frames over ~1 s) so the model
  can see "legs unchanged across frames while position changed → gliding".
- **What genuinely still needs Floris:** true latency + motion comfort. That is
  the iPad+laptop demo gate — keep it, and have the plan flag every item that
  needs it rather than claim it's solved.

## The agreed shape of run 3

1. **Run A — Audit (Fable, plan-only, changes NO game code):** cheap/scripted
   capture of every screen + key states + walk-bursts, on **both** form
   factors → Fable critiques each image → a punch-list where every item has:
   defect · evidence screenshot · concrete fix · how we'll verify (screenshot /
   E2E / needs-demo) · **platform (iPad / laptop / both)** · confidence. Ends
   with a deep self-audit of that list ("if all of this is done, will it look
   and feel right? what's missing?").
2. **Floris reviews the punch-list** (readable page, not raw markdown).
3. **Run B — Build (Opus):** works the approved list, screenshot-in-loop,
   ticks only when its own captured image passes the visual criteria.
4. **Floris demos on iPad AND laptop** → feedback → next round.

Fable is a good fit for the *taste/judgement* role (multimodal, design sense).
Opus is the *engineer* for the fixes. Leave the actual design decisions to Fable
— do not over-prescribe the "right" camera distance etc. in advance.

## Frozen contracts that still hold (do not break while polishing)

Motion-comfort camera law (fixed FOV, roll 0, no shake/snap), never-scary /
never game-over, construct parity + 2D floor per mini-game, M3/E3 Dutch ≤7 words
+ read-aloud, ≥56 px targets, <150 draw calls, persistence ONLY via
state.ts/persist.ts under `alvah-ef-v1` (ranger namespace, no new keys), assets
via assetUrl, no new deps without explicit approval. Keys live in
`app/.env.local` (never print values); Meshy balance was 7,615 credits (a UX
pass likely needs none).
