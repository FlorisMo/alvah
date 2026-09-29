# Run 6 · lane FEEL — how the ranger, the jeep and the animals move, and how big everything is

> Lane design for "Ranger run 6" (2026-09-28). Written by the FEEL lead after playing the
> game on `main` (c9c0ab8) at 1280×800 with real keys, and measuring every model in the
> browser through the game's own `Models.prepModel`. It is the brief behind the four work
> packages below, and the checklist the lead reviews each package against. Read GOAL.md,
> STATE.md and CLAUDE.md first; their "Rules learned the hard way" and Alvah's contracts bind
> every line here.

Floris (Alvah's dad): *"We should be able to run, walking is very slow now. The car seems to
slow down sometimes. The car is bumped to the side by animals, seems a bit weird; they should
avoid being hit by the car and jump to the side. Not all ratios make sense between humans and
animals. Know that Alvah is an 8-year-old boy in real life, so his size should match that."*

Run decisions this lane builds on (not reopened): the ranger is 1.32 m, adults 1.78-1.82 m,
everything else true size relative to that · Shift = run, stick at its rim = run, a faster
walk, a calm camera while running · animals see the jeep coming and move off its path early,
the jeep is never shoved, a gentle stop if one can't get away, never a hit.

## 1. What the player will experience (the whole lane, in one breath)

Alvah's ranger is a real eight-year-old: a head and a half shorter than the warden, as tall
as a sow is long, looking up at a jeep he can just see out of and a cabin whose door a grown-up
walks through. The trees are grown pines, the brambles and bracken are big enough to swallow
a piglet. He walks briskly; holding Shift (or pushing the stick all the way) he runs, legs
pumping at his speed, footsteps quick, while the camera glides behind him exactly as calmly
as before. The jeep holds its speed: it slows only when something is really in its way, never
because an animal grazes 7 m to the side, never because he steers. A deer ahead lifts its head,
trots off the track and watches him pass; if an animal can't get out of the way the jeep rolls
to a soft stop in front of it. On foot the animals let him come close when he walks calmly and
move off when he runs at them. Nothing is ever shoved, nothing ever clips through anything.

## 2. What I found (baseline on main c9c0ab8, measured + looked at)

Scout scripts and screenshots live in the lead's scratch folder
`~/Code/alvah-run6/scratch/lead-feel/` (not in the repo): `measure.mjs` (every model's
rendered size through `prepModel`), `lineup.mjs` (side-by-side lineups on a 0.5 m grid),
`seat.mjs` (the ranger in the jeep / helicopter seat), `stride.mjs` (the walk/run clips),
`scout1.spec.ts` / `scout2.spec.ts` + `pw.config.ts` (play into the world, walk, drive with a
speed trace). Run a script from that folder with `RANGER_PORT=<port> node <script>`; the specs
with `npx playwright test --config ~/Code/alvah-run6/scratch/lead-feel/pw.config.ts` from `app/`.

### 2.1 Sizes (rendered height = what a screenshot shows, bind pose)

| model | table/target | renders | real reference | verdict |
|---|---|---|---|---|
| ranger-alvah (player) | 1.2 (skeleton) | **1.274**, soles 3.2 cm below y=0 | 1.32 (decision) | too small by 4 %, sinks |
| ranger-warden-boa | 1.8 (skeleton) | 1.831, soles 3.9 cm under | 1.80 | ok, sinks |
| figure-poacher | 1.8 | 1.846, soles 4.3 cm under | 1.78 | a touch tall, sinks |
| wildzwijn (sow, static) | 0.88 | 0.88 × 1.52 long | shoulder 0.75-0.85, length 1.3-1.6 | ok |
| frisling (static) | 0.28 | 0.28 × 0.48 | 0.25-0.35 × 0.5-0.6 | ok (0.30) |
| ree (rig) | 0.95 (skeleton) | 1.025 × 1.04 | shoulder 0.65-0.75, head up ~1.1 | slightly small |
| reekalf (ree rig) | 0.62 | 0.67 | fawn shoulder ~0.4 | ok |
| edelhert stag (rig) | 1.5 (skeleton) | **2.19** incl. antlers at bind pose; 1.72 in its idle clip at t=0.5 (head lowered) | shoulder 1.2-1.3, head ~1.9, antlers ~2.3 | ok at bind pose |
| vos / das / eekhoorn / raaf / wolf | 0.48/0.32/0.25/0.4/0.9 | 0.52/0.32/0.25/0.40/0.97 | — | ok |
| jeep | 1.9 | 1.9 × 3.65 × 1.87 | short-wheelbase 4×4 ~1.85 × 3.9 | ok; seated ranger's head shows at the window line (plausible) |
| helicopter | 2.6 | 2.6 × **4.4** long | light heli ~3.3 tall, 8-10 long | **toy-sized**; the pilot cannot be seen in it |
| cabin | 3.0 | 3.0; **door ≈ 1.3 m** | door ≥ 2.0 | **too small**: the warden could not go in |
| missiebord | 1.8 | 1.8 | ~1.8-2.0 | ok |
| trees (world) | pine 6.6 · oak 5.4 · birch 6.0 × s 0.85-1.29 | 5.6-8.5 m | Veluwe pines 15-25 m | **saplings next to him** |
| zoeken covers | bramble 0.55 · juniper 0.62 · fern 0.5 · heather 0.42 | — | bramble 0.9-1.2, juniper 1.5-3, bracken 1-1.8 | **"super small bushes"** (Alvah) |
| world plants | heather 0.3-0.6 · grass 0.45-0.8 · helmgras 0.6-1.05 · bracken 0.55-1.05 · lisdodde 1.3-1.8 | | | heather/grass ok, bracken low |
| dressing | fern 0.6 · juniper 1.1 · reeds 1.1 · foxglove 0.8 · mushrooms 0.35 | | 1.2 · 1.6-2.5 · 1.6 · 1.2 · 0.15 | small / mushrooms giant |

**Root cause of most size errors:** `Models.prepModel` sizes a *rigged* model by its
**skeleton** (`skinnedRenderBox`, bones only), so the head above the top bone and the soles
under the lowest bone are not counted: every rig renders ~6-8 % taller than its table value
and stands 1.5-4.3 cm *in* the ground. `spawn.standOnSoles` is the workaround that lifts the
mini-games' and markers' animals back out; the player, the warden, the poacher and the
roaming animals never got it. The mesh can be measured as it renders:
`SkinnedMesh.computeBoundingBox()` (three r184) applies the bone transforms per vertex, and
`measure.mjs` shows it matches the pixels (the ranger 1.274 m against the 0.5 m grid).
Second cause: the size table only covers animals; buildings, vehicles, trees and plants are
loose numbers at each call site (Stage.ts title, Dressing.ts, Forest.ts, Vehicles.ts,
Progress.ts, zoeken3d.ts), so nothing ever compared them with a child.

### 2.2 Walking

`Player.speed` = 1.8 m/s for keys, stick and tap-walk. No run exists, though the ranger GLB
carries a `run` clip (`idle, walk, run`; only idle+walk are wired in `PlayerRig`). The walk
clip is played at `timeScale = speed / 1.5` (`PlayerAnim.STRIDE_MATCH_SPEED`), but the clip's
own stride is much shorter: `stride.mjs` (rough, per planted foot) puts the walk clip's
natural ground speed at ~0.55-0.95 m/s and the run clip's at ~0.9-2.5 m/s at the 1.2 m size,
walk cycle 1.067 s, run cycle 0.667 s (17 % airborne). So today's feet already skate, and a
naive faster walk would skate worse or scurry. The follow camera trails a pivot with
τ = 0.15 s: the lag is v·τ (0.27 m walking; 0.63 m at 4.2 m/s), so running needs no camera
change, only a check.

### 2.3 The jeep "slows down sometimes" — measured causes (20 s drive trace, 100 ms samples)

1. **The calm rule** (`core/vehicle.calmSpeed`): within 8 m of *any* roaming animal the top
   speed is held to 2 m/s, even when the animal is beside or behind the jeep and nowhere near
   its path. Driving from the jeep's home toward the helipad the ree 5-8 m to the side held
   the jeep at 2.0 m/s for **~7 s** (`vehicle().nearAnimal` true from (26.8, 16.1) to (27.7, 32.8)).
2. **Steering cuts the gas:** `driveIntent` reads the fused, unit-clamped screen vector, so
   Up + Right is (0.71, 0.71) and the throttle drops to 0.71: **4.24 m/s while steering**
   with the keys (measured), back to 6 when the turn key lifts.
3. **The shove:** roaming animals are solid circles in `resolveBody` (`Vehicles.solids()` via
   `host.movers`), and they move on a fixed wander loop with no idea the jeep exists; an
   animal walking into the jeep's side pushes the jeep's whole body sideways.
4. **The rim:** pressed against the world edge the jeep grinds along it at ~0.1 m/s along its
   heading (measured at (51, 52)).
5. To verify (not seen in my drive): a keep-out zone or trunk contact drops the carried speed
   to `CONTACT_CREEP` 0.8 m/s and it takes the 1 s ramp to recover; `vehicleDt` clamps a frame
   to 0.1 s so a >100 ms hitch loses distance. Frame times in my drive: median 16.7 ms, p95
   18.4, max 18.7 (GPU unloaded) — measure the FIRST drive after boot and under load.
6. STATE.md "still open": `solids()` copies the whole obstacle list every frame. Likely cheap
   (a few hundred circles); fix only if a measurement shows it.

### 2.4 Animals

Four roamers (ree 26,26 · vos −30,−10 · eekhoorn −24,−24 · wildzwijn 10,36) trace a pure
function of time (`AmbientPaths.wanderAt`): a 4-leg loop with graze pauses. They have no
state, see nothing, and are not obstacles for the ranger (he walks through them) while being
solid for the jeep (they shove it). Ree/vos/edelhert/wolf rigs carry `walk, graze, idle` (no
run/trot); the boar, frisling, das and eekhoorn are static meshes with a procedural bob. None
of the roamers stands on its soles. Two birds glide overhead (out of scope).

## 3. Shared truths every package keeps

- **One scale truth** (package `scale`): every size a player sees comes from one table of
  RENDERED heights in metres, documented with its real-world reference; `prepModel` measures
  what renders. No call site invents a size.
- **The motion read** for other lanes: `World.rangerMotion()` and `WorldCtx.rangerMotion()`
  return `{ x, z, heading, speed, running }` live (speed = post-collision ground speed m/s;
  `running` = the run gait is on). `scale` adds it with `running: false`; `run` makes it true.
  The missions lane codes against this contract (their animals react to a running ranger).
- **A calm camera**: fixed FOV, roll 0, no bob, no shake, no snap; reduced motion = cuts.
  Nothing in this lane may add camera motion.
- **Never scary**: an animal that moves off is calm (a trot, a bound, a turn to look back),
  never a panic, never a squeal, never a fall. Never a hit, never a game-over.
- **Laptop first**, iPad works: every keyboard feature has a stick twin.
- **Tests**: pure maths in `core/` or pure modules get unit tests (`npm test`); the browser
  truth is played with real keys (golden steps 3-4 and the specs below). `window.__ranger`
  only reads.

## 4. Package `scale` — everything at true size next to a real 8-year-old

**Player terms.** Side by side the ranger reads as an 8-year-old boy: 1.32 m, a head and a
half under the warden (1.80) and the poacher (1.78); the sow's back at his belly, the ree's
head at his chin, the stag towering; he sits visibly behind the jeep's wheel and in the
helicopter's cockpit; the cabin door is taller than the warden; the forest is grown pines;
the bushes the missions use are big enough to hide the animal they hide. Everything stands on
its soles on the drawn ground.

**Mechanics / technical approach.**
1. `prepModel` measures what renders. For a model with skinned meshes: the union of each
   visible `SkinnedMesh.computeBoundingBox()` (bone-applied) in world space, at bind pose
   (pose-independent: the stag's idle clip lowers his head 20 %); static models keep the
   geometry box. Scale by HEIGHT (y) as today, then put the rendered soles at y = 0 and
   centre x/z on the same box. Cache the measure per GLB id (a 30k-vertex rig costs a few ms)
   if spawn-heavy scenes show it. Then delete the skinned half of `spawn.standOnSoles` (the
   workaround) in the same commit; the static-posture re-seat (`applyPosture` tips the boar's
   nose below its hooves after prep) stays, honestly named. `skinnedRenderBox` may stay for
   the far-from-origin/F-07 reasons documented in Models.ts, but every "how tall is it" read
   (dev hook `avatar()`, `actors()`, `Player.measureAvatar`) uses the same rendered measure.
   Pitfall: a hind is the stag rig with its antlers hidden; hide them BEFORE prep (a
   `SpawnOpts` flag), or the body is sized to the antler tips.
2. One table: grow `render3d/AnimalScale.ts` into the single scale module (keep the file or
   rename with all imports; THREE-free, unit-tested) holding RENDERED heights for: the player
   (1.32) and adults (warden 1.80, poacher 1.78); every animal + its young/sex variants
   (sow, frisling, ree, reekalf, stag, hind, calf, vos, vos-welp, das, eekhoorn, raaf, wolf,
   adder, heikikker, birds); vehicles (jeep, helicopter); buildings and props (cabin, board,
   bird-hide, boa-post, watchtower, ecoduct, signpost, fence, log, stump, boulder, mushrooms,
   foxglove, wildlife camera, badger sett); trees (pine/oak/birch base heights); plants and
   COVER (heather, pijpenstrootje, helmgras, bracken, bramble, juniper, reeds/lisdodde, fern).
   Each row: the value, the real range and a one-line source/reasoning. Starting values
   (verify each in a lineup; adjust inside the real range when a model's proportions demand):

   | group | values (m, rendered height) |
   |---|---|
   | people | ranger 1.32 · warden 1.80 · poacher 1.78 |
   | animals | sow 0.88 · frisling 0.30 · ree 1.10 · reekalf 0.62 · stag 2.25 (antlers) · hind 1.70 · calf 1.10 · vos 0.52 · vos-welp 0.30 · das 0.32 · eekhoorn 0.25 · raaf 0.42 · wolf 0.95 |
   | vehicles | jeep 1.90 · helicopter 3.3 (≈ 5.6 m long) |
   | buildings | cabin 4.5 (door ≥ 1.95) · missiebord 1.8 · bird-hide 3.0 · boa-post 3.3 (door ≥ 1.95) · watchtower 12 · signpost 1.7 |
   | props | fence 0.9 · log 0.6 · stump 0.6 · boulder 1.1 · mushrooms 0.18 · foxglove 1.2 · wildlife camera 0.3 (on its stake) |
   | trees (base; per-tree variety on top) | pine 12.5 · oak 10.5 · birch 11.5 |
   | plants / cover | heather 0.30-0.60 · pijpenstrootje 0.5-0.9 · helmgras 0.6-1.1 · bracken 0.9-1.6 · bramble 1.0 (0.9-1.2) · juniper 1.8 (1.5-2.5) · reeds/lisdodde 1.6 (1.4-2.0) · fern 1.1 |

   **Cover rule** (for the missions lane): a plant hides an animal when it is ≥ 1.2 × the
   animal's height and at least as wide as the animal is long; the table says which cover
   hides which animal (bramble/bracken/juniper hide a frisling, das, eekhoorn, vos; tall grass
   hides a lying reekalf; reeds hide a frog/duck).
3. Apply the table at every size call site: `Player` + `Stage` ranger; `Fauna` actors and
   roamers; `spawn.heightFor` / `PLAY_HEIGHT` (and so `Markers`, all engines); `Progress`
   tableau sizes (the sow's 0.8, the hind's 1.3, the calf, the fox cub); `Vehicles` (jeep,
   helicopter + everything tied to its size: `HELI_BODY` circles, `HELI_SEAT`, `PAD_RADIUS`
   so it still lands on its pad, the step-out side distance, the heli chase boom if the bigger
   body crowds it); `Dressing` (cabin + its collision box, landmarks, nature `SPEC`, plant
   field scale ranges); `Forest.TREE_BASE_H` (+ scatter/rim variety); the title (`Stage.ts`:
   sizes only). **Do not change a mini-game's hide logic** (zoeken3d's cover table, dagnacht's
   tufts): the missions lane rebuilds frisling/ree/wildcamera/eekhoorn on this table right
   after you; changing hides now risks golden step 6 (a bigger bush becomes the first thing a
   camera ray hits). Engines keep reading `heightFor`, which now returns the new values.
4. The follow camera reads the measured `avatarTopY`/`avatarRadius`, so it adapts; verify the
   walk framing (ranger ~22 % of screen height today), the jeep and heli chase, step-out, the
   cabin (bigger, still off the x≈0 spawn corridor and out of the +z spawn boom — move its
   centre further out if needed), and the crown fade with taller trees (`Crowns` scales with
   H; `Forest` LOD cache key includes the height).
5. The motion read (§3) with `running: false`, plus dev hook `motion()`.
6. Optional, if it helps you verify: make `showroom.html?scale=true` size every model through
   the game's own `prepModel` and the table (people, animals, vehicles, buildings, plants) so
   one URL is the lineup Floris can open. No other tooling.

**Bar (the lead checks every line).**
- Lineup screenshots (0.5 m grid) of people+animals, vehicles+buildings, plants+the animals
  they hide: the ranger 1.32 ± 0.02 m, warden 1.80 ± 0.02, poacher 1.78 ± 0.02, every model
  within its table value ± 3 % and its documented real range; every sole on y = 0 ± 1 cm.
- In the world (real keys, screenshots): the ranger beside the warden; beside the jeep and
  seated in it (head above the door line, hands at the wheel); seated in the helicopter and
  visible through the canopy from the chase camera; at the cabin door (door taller than the
  warden); beside the ree, the sow at the frisling marker, and a juniper/bracken; walking into
  the forest (grown trees, the view of him never blocked).
- `npm run gate`, `npm run golden` (8/8, no ✗), `npx playwright test e2e/missions.spec.ts`
  (15/15), `e2e/budgets.spec.ts`, `e2e/camera.spec.ts` and `e2e/camera-edges.spec.ts` green;
  draw calls < 150 at spawn and in the forest; the title screenshot still composed.
- `AnimalScale.test.ts` (or its successor) pins the new truths (child band, ratios, the
  cover rule) instead of the old 1.2.

## 5. Package `run` — a brisk walk and a real run

**Player terms.** Walking is brisk (≈ 2.2 m/s, was 1.8). Holding Shift he runs (≈ 4.2 m/s);
on the iPad pushing the stick to its rim runs (the ring shows it). He speeds up and slows down
over a third of a second, never pops. His legs match the ground: a walk that doesn't skate,
a run with both feet leaving the ground, quick light footsteps; backing up and turning on the
spot never run. The camera behaves exactly as when walking. Once, after his first metres, a
tip teaches it: "Houd Shift in om te rennen." (stick: "Duw de stick ver om te rennen.").

**Mechanics / technical approach.**
- Input: `attach-input` keeps a `run` flag for ShiftLeft/ShiftRight (cleared on blur; Shift
  alone never moves). Keys: forward speed = run if Shift else walk; Down = back-up at
  `BACK_SPEED` × walk, never runs; tank turn unchanged (90°/s). Stick: full walk at ~80 % of
  the travel, run once it reaches ~95 % (leave below ~88 %: hysteresis), the joystick ring
  highlights while running (thumb ≥ 56 px unchanged). Optional: Shift held on a tap-walk
  click runs to the target.
- Speed: a ramped ground speed (accelerate ~0.35 s walk→run, ~0.3 s back) feeds the step,
  the animation, the footsteps and `rangerMotion()`.
- Animation (`PlayerRig` + pure `PlayerAnim`): idle / walk / run blended by ground speed,
  phase-synced (both locomotion clips at one normalized cycle while they blend). Cadence from
  each clip's MEASURED natural speed (measure it properly from the planted foot; my rough
  numbers are in §2.2). If matching the ground needs a cadence that scurries (walk > ~3.6
  steps/s, run > ~4.6 steps/s), lengthen the stride instead: amplify the leg bones' swing
  about the clip's mean pose after `mixer.update` (a stride factor per gait), so the step
  grows rather than the legs blurring. Pick walk/run speeds inside walk 2.1-2.5 and run
  3.8-4.6 m/s where the legs look best.
- Footsteps: one per foot plant (from the clip phase, or a speed-dependent stride), running
  steps a touch brisker; the sound gate stays.
- Camera: nothing new. Verify at run speed: FOV fixed, roll 0, the ranger's on-screen height
  and position within ±4 % of walking, yaw rate ≤ 150°/s turning while running, no bob.
- Reduced motion: running allowed (locomotion is exempt), the camera cuts as today.
- `rangerMotion().running` true while the run gait is on; dev hook `motion()`.
- The tip joins the one-tip onboarding channel (`core/onboarding.ts`, ≤ 7 words, read-aloud,
  in the reading-norm test), shown once per save after he has walked ~15 m.

**Bar.**
- Real keys: ArrowUp 2 s walks 2.1-2.5 m/s steady; Shift+ArrowUp 2 s runs 3.8-4.6 m/s;
  releasing Shift eases back to walk; ArrowDown+Shift backs up at walk-back speed.
- Stick (touch emulation or mouse on the stick with "aan"): 60 % push walks, rim runs, the
  ring shows it.
- Feet: planted-foot slip ≤ 25 % of ground speed at steady walk and at steady run (a probe
  on the planted toe's world position over its stance); a 3-frame screenshot strip of walk
  and of run looked at (feet planted, both feet off the ground mid-run).
- Camera: screenshots walking vs running at the same spot look the same framing; `cam().fov`
  constant, roll 0; golden step 3's calm checks pass while running.
- `keyboard`, `joystick`, `anim`, `footsteps`, `camera`, `movement` specs updated and green;
  golden step 3 gains "Shift + ArrowUp runs" with its numbers; gate + golden green.

## 6. Package `jeep` — driving that holds its speed

**Player terms.** Full gas means full speed. Steering with the keys keeps the gas. An animal
beside the track changes nothing; one standing IN the track makes the jeep ease to a soft stop
a metre in front of it (the next package makes that rare: they step aside). The jeep is never
pushed sideways by anything that moves. Brushing a trunk it slides past without a jolt; at the
forest edge it curves along the tree line instead of grinding.

**Mechanics / technical approach.**
- Delete the calm rule (`calmSpeed`, `ANIMAL_SLOW_*`, `nearestAnimalDist` plumbing,
  `vehicleNearAnimal`) and its spec; the dev hook's `nearAnimal` becomes `yieldFor` (the
  animal it is braking for, or null).
- Animals leave `resolveBody`'s solids (the warden and poacher stay: they never move). A pure
  `yieldBrake` in `core/vehicle.ts`: the free distance along the jeep's swept path (both drive
  directions, half-width = body half-width + animal radius + 0.4 m) to the first animal in it,
  and the speed cap `√(2·a·(d − gap))` with a gentle a ≈ 3 m/s² and gap ≈ 1 m; resumes the
  ramp as soon as the path clears. Unit tests cover the cases e2e can't stage (an animal that
  cannot leave, reversing, a turning jeep).
- Keys drive from the tank axes (throttle = Up/Down, steer = Left/Right, both ±1) so Up+Right
  keeps full throttle; the stick keeps "push where you want to go", and at its rim a diagonal
  keeps full throttle too. The speed-scaled steer (`comfortSteer`) keeps the calm turn circle.
- The rim: like a keep-out zone, the forest edge bends the jeep along it (a tangent steer
  inside the last ~8 m while heading outward); held straight into it, it slows smoothly to a
  stop, never grinds.
- Contacts: verify zones never touch the body (the bend keeps it off); a glancing trunk
  contact keeps most of its speed; measure `vehicleDt` hitches on the first drive after boot
  and under load (shader compiles, forest bake) and remove the cause if one shows. The
  per-frame copy of the collision list goes only if a measurement shows a cost.

**Bar.**
- Real keys (trace at 100 ms): from the jeep's home, W 3 s reaches 6 m/s within ~1.1 s and
  holds it; W+D held keeps ≥ 5.7 m/s through the turn; driving past the ree (ambient, off the
  track) never drops below 5.7 m/s; no sample's position steps sideways relative to its
  heading by more than the steering explains (no shove), measured over a pass near the ree
  and the boar.
- An animal in the path → a smooth stop ≥ 0.8 m before it, never contact (unit tests + one
  e2e where the jeep is driven at a grazing roamer).
- At the rim: curves along it at speed; head-on, a stop without a crawl; screenshots.
- `vehicle.spec` updated (calm-rule test replaced), golden step 4 records top speed held and
  no shove; gate + golden + `heli.spec` green.

## 7. Package `wildlife` — animals that see you coming

**Player terms.** The roaming animals notice things. When the jeep comes their way a deer
lifts its head, turns and trots (or bounds) calmly off the track, stops a little way off and
watches the jeep pass, then drifts back to its grazing. A boar trots aside with its tail up, a
fox lopes off, a squirrel scampers. On foot Alvah can walk up close to a grazing deer if he
walks calmly: it looks up at a few metres and steps away when he gets closer; if he runs at
it, it trots off early. They never walk through him, the jeep, the people or a tree; they
never panic.

**Mechanics / technical approach.**
- A pure `core/wildlife.ts` (THREE-free, unit-tested): per-species temperament (alert and
  flight distances for a walking ranger, a running ranger and the jeep, trot/bound speed,
  turn rate, whether it bounds) and one decision function: animal state + threats (the jeep's
  pose, velocity and body; the ranger's position, speed and `running`) → mode
  (`roam` · `alert` · `away` · `yield` · `return`) + where to go. The jeep threat is its
  swept path over the next ~2.5 s (so at 6 m/s an animal starts moving ~15 m out) plus a
  clearance; the escape side is the side it is already on (dead centre: away from the jeep's
  turn), toward open ground (no trunk, water, rim or marker zone). Exported for the missions
  lane (their staged animals can react to a running ranger with the same rules).
- `Fauna` gives each roamer state: its own loop clock (paused while it is away, so it resumes
  where it left off), an away position, a mode, a velocity. Animals turn and move along their
  facing (never strafe); trot = the baked walk clip at a higher rate (ree, vos) or a faster
  procedural gait (boar, squirrel); the ree may bound (a low 0.3-0.4 m arc). Alert = head up,
  facing the threat. Return = walk back to the loop point and resume. All still frozen under
  reduced motion (secondary motion), and then the jeep's brake is what keeps them safe.
- The ranger never walks through a roamer: the roamers' circles join his move resolution as
  soft obstacles (pooled, no per-frame garbage).
- Audit the four wander loops against every solid (trunks, junipers, boulders, markers, pads):
  move a home if its loop crosses one. The roamers stand on their soles (from `scale`).
- Dev hook: `ambient()` adds `mode` and `speed`; the jeep's `yieldFor` shows when the brake
  had to act.

**Bar.**
- Real keys, driving straight at the ree: it goes `alert`/`yield` while the jeep is still
  ≥ 10 m away, the jeep body never comes within 0.8 m of it, the jeep keeps ≥ 5 m/s (it did
  not need to brake), the ree is back in `roam` within ~15 s; screenshot strip of it trotting
  off (calm, facing where it goes, feet on the ground).
- The same past the boar and the fox.
- On foot walking at the ree: it looks up at ~5-6 m, steps away at ~3-4 m, never lets him
  closer than ~1.5 m; running at it: it trots off from ~8 m; he never passes through it.
- Nothing faces backwards, slides sideways, floats or sinks; draw calls unchanged.
- New `e2e/wildlife.spec.ts` (real keys) + unit tests for `core/wildlife.ts`; `vehicle.spec`,
  golden, gate green.

## 8. Order, dependencies, other lanes

`scale` → `run` → `jeep` → `wildlife`, one at a time, each branched from the lane head.
`scale` lands first and focused: the missions lane waits for it (`run6/scale-base`).

Touch points with other lanes (merge carefully, say so in the report):
- **missions** builds frisling/ree/wildcamera/eekhoorn on `scale`'s table and cover rule and
  the `rangerMotion()` read; it owns zoeken3d/dagnacht3d hides, `Progress` reunions and
  `Markers`. FEEL changes only sizes there.
- **flow** (first screens) owns the title composition and onboarding; `scale` changes the
  title's sizes only, `run` adds one onboarding tip string. If the bigger cabin or trees
  crowd the title, `scale` adjusts positions minimally and reports it.
- golden: FEEL edits steps 3-4 only.

## 9. Review kit (how the lead reviews a package, cold)

1. Read the builder's report (commits, the tail line of every check).
2. `~/Code/alvah-run6/mkwt.sh review-<id> <their branch> <their branch>` (or read their
   worktree), start vite on the lead port, run `npm run gate` and `npm run golden`, and the
   package's specs.
3. Play it: `scout1.spec.ts` (walk + jeep trace) and `scout2.spec.ts` (title, spawn, cabin,
   grove) from the scratch folder; for `scale` also `lineup.mjs` (update its heights to the
   new table: people/animals, world, buildings, plants) and `seat.mjs` (pass the new ranger
   and heli heights). Open every screenshot.
4. Check each line of the package's bar above; anything not met goes back with the number.
