# Run 6 · MISSIONS lane: four missions become real adventures in the world

> Lane lead's design, 2026-09-28. Branch `run6/missions`. Read GOAL.md, STATE.md,
> CLAUDE.md (game) and ARCHITECTURE.md first. This file is the contract the builders
> build to and the lead reviews against. Section 10 is the package plan.

## 0. In one paragraph (player terms)

Today a mission is a card, then three small exercises staged on a patch of ground in
front of the ranger, then a card. It works, but it feels like a quiz dropped into the
world: the piglet stands in plain sight at the marker and then you "search" for it, it
hides behind knee-high tufts, a trail of prints leads straight to it, the route home is
seven glowing stones, and the sow walks in from nowhere two metres away. After this run,
the four missions a child meets first (frisling, ree-niet-aanraken, wildcamera,
eekhoorn) are short adventures played IN the live world with the ranger's own body: you
hear a squeak you can place and follow small prints to a stand of bracken taller than a
piglet; you glimpse stripes between the stems and click; you lead the piglet home at a
calm walk (run and it hides) along the route its group rooted; you keep calm when the
sow looks up; and the family you could already see at its wallow takes it back. The five
brain-games stay the measured heart of each beat, with the same trial builders and the
same scores, and the 2D floors still exist. Each mission is 5-10 minutes for an
8-year-old, calm, never scary, no fail states.

## 1. What I found (scouted 2026-09-28, main at c9c0ab8, port 5361)

Played all four missions start to finish with real keys and clicks and looked at every
screenshot (`~/Code/alvah-run6/scratch/lead-missions/shots/<mission>/`); read the flow,
kit, stage, the five 3D engines, World, Progress, Markers, Fauna, Player, spawn, sound,
golden and missions.spec.

- **frisling**: the piglet stands visible in the marker ring, then "Zoek de big in het
  gras" asks you to find it. The hide is 0.3 m grass tufts and a small fern round a
  lying piglet, and the "Volg het spoor" prints end at the piglet: the search is solved
  before it starts. Corsi = seven mossy stones glowing on bare ground (no story, the
  ranger off screen). Rustkracht = five DOM questions in a row on a staged patch. The
  sow + 2 piglets start 2.4 m out and walk in over 2.6 s at the reunion: "out of
  nowhere". Whole mission ≈ 1 min for a bot, ~3 min for a child.
- **The frisling model reads as a domestic piglet**: cream-white with brown/black
  blotches (`piglet-zoom.png`), not a brown wild-boar piglet with cream lengthwise
  stripes. The "stripes glimpsed" search depends on fixing this.
- **ree-niet-aanraken**: the calf stands visible in the marker ring (again "search for
  what you see"); the doe walks in from 2.4 m at the end. Zoeken + five choices.
- **wildcamera**: a badger stands in daylight in the marker ring by the ven. No camera
  is ever hung. Simon = four animals on tree stumps in a row with name tags; wisselen =
  a signpost with arrows and a badger sett. The clue is an emoji card.
- **eekhoorn**: the squirrel is a speck at the marker; it never appears in the corsi
  (glowing stones again); simon = four animals on stumps.
- **Models**: boar, piglet, squirrel, badger, raven, frog, nightjar are STATIC meshes
  (procedural bob only). Roe deer, red deer, fox, wolf have walk/idle/graze clips. The
  ranger has idle/walk/run clips. Props we can use: fern, bramble, juniper, heather,
  foxglove, reeds, fallen-log, tree-stump, dead-snag, boulder, birch/oak/pine,
  badger-sett, wildlife-camera, snare-empty, acorn-cluster, broken-twig, anthill.
- **Audio**: recorded calls for ree, edelhert, eekhoorn, raaf, nachtzwaluw, gaai,
  groene-specht and more birds; wild boar and piglet are soft synths (a recorded boar
  read as a dinosaur to the child tester). Sound is not spatial (no panning).
- **Budget**: 30-75 draw calls in every mission frame (limit 150), 60 fps.
- **World**: no day/night (fixed golden hour); the heide quadrant is open heath with
  almost no trees; walking from spawn to the frisling marker takes 16 s at 1.8 m/s.
- **Mechanics that will bite** (section 9 lists them): `menuOpen()` treats any
  `.ra-overlay` as a menu and freezes the ranger; `beginActivity()` freezes walking,
  proximity AND the camera together; golden's step-6 loop only answers encounters of
  the step it is on and only clicks `Verder|Klaar`; `seating()` tags movers only from
  `ambientState()`; the reduced-motion test and the missiebord test assume the family
  stands at the marker.

## 2. The bar (what "awesome" means here)

1. **In the world, with the body.** Every mission has at least one beat where the
   ranger walks, follows or leads with his own keys/stick, and the exercises happen at
   real places in the open world, not on a patch conjured in front of him.
2. **Established before it matters.** Every animal that matters is somewhere in the
   world with a reason before it matters, and arrives by walking in from where it was.
   Nothing pops into existence. The family you reunite was visible from the marker.
3. **True scale.** Ranger 1.32 m (FEEL lane), adults 1.78-1.82 m, animals at the
   AnimalScale sizes. Cover that hides an animal is tall enough to really hide it:
   pijpenstrootje tussocks 0.5-0.9 m, bracken 0.9-1.3 m, old heather 0.5-0.8 m. Never a
   knee-high tuft round a piglet.
4. **Diegetic hints.** A squeak you can place (panned left/right, louder when near), a
   rustle, stripes glimpsed between stems, hoof prints, an animal looking where to go.
   The HUD arrow is the fallback, not the first cue.
5. **Every beat: one clear goal, feedback, payoff.** One short read-aloud line (≤7
   words, AVI M3/E3) plus an in-world cue; animal reactions + sound on every action; a
   felt payoff at the end that stays in the world.
6. **Calm and kind.** Fixed FOV, roll 0, no shake, no snap, at most one eased reframe
   per beat and never while the player walks; reduced motion = cuts. Nothing moves
   toward the camera; an animal may walk up beside the ranger at a calm pace and stops
   at ≥1.2 m. No fail states: a mistake has a gentle, recoverable consequence.
7. **The brain-game stays measurable.** Same trial builder, same pure run core, same
   `BeatSummary` as the 2D floor (section 6). Each `stappen[i]` is logged exactly once.
8. **Playable by golden** with real keys and clicks, through the extended hint channel
   (section 3.9).

## 3. The in-world adventure framework (built in package P1)

### 3.1 Two paths, one step list

`Mission.stappen` stays the canonical EF contract (which engines, which skins, in which
order). A mission gets an optional **adventure**: a script that plays those same steps
as beats in the live world.

- `runMission` (MissionFlow) plays the **adventure** when the mission has one and the 3D
  gates pass (world live, WebGL, not `force2d`, not reduced motion).
- Otherwise it plays the **classic path** exactly as today (2D floors; dagnacht 3D under
  reduced motion because it is `rmSafe`). The reduced-motion test in missions.spec keeps
  testing the classic path. (A later run may run the adventure under reduced motion with
  2D panels for zoeken/corsi; out of scope now, note it in STATE.md.)
- Both paths log one `BeatSummary` per `stappen[i]` via `store.logSession`, collect the
  veldnotities, and end in the same reunion line, reward, clue and world state.
- The six other missions have no adventure and keep the classic path unchanged
  (`e2e/missions.spec.ts` must stay green for them).

Order of steps may change in content (wildcamera becomes `[wisselen, simon]`), and the
adventure may interleave one step's trials with another beat (the frisling's rustkracht
choices come before and after its route), but never inside a running corsi/simon
sequence (section 6).

### 3.2 A mission script = an async function over an AdventureKit

Recommended shape (the builder may refine names; keep it this simple):

```ts
// render3d/adventure/missions/frisling.ts
export const frislingAdventure: Adventure = {
  id: 'frisling',
  places: FRISLING_PLACES,            // authored world spots (3.4)
  residents: FRISLING_RESIDENTS,      // who lives here before/after (3.4)
  async play(k: AdventureKit): Promise<void> {
    await k.look('wallow', copy.kijk);                  // establishing look
    await k.walk({ to: 'cover', line: copy.volg, trail: {...}, squeak: {...} });
    const piglet = await k.search(0, { cover: 'cover', target: 'frisling' });  // logs zoeken
    const rust = k.choices(2);                            // opens the dagnacht run for step 2
    await rust.ask('aaien', {...});
    ...
  },
};
```

Every kit call is abortable (it races the mission's stop signal), speaks its line when
`voorlezen` is on, and cleans up after itself. The kit owns: the objective card and
chip, the camera mode, the ranger's input lock, actors, framing, spatial sound, the play
hint, and EF logging (via a callback into MissionFlow so logging stays in one place).
At the end the runner asserts (dev warning + unit test on a fake kit) that every step
index was logged exactly once.

### 3.3 World mission mode (additive API on `World`)

Today `beginActivity()` freezes walking, proximity, prompts and the camera together.
The adventure needs them separately:

```ts
world.setMissionMode(m: {
  missionId: string;
  input: 'free' | 'locked';     // keys/stick/tap-walk drive him, or only the kit does
  camera: 'follow' | 'held';    // the follow camera, or the kit owns the lens
} | null)                       // null = back to normal free roam
world.walkRangerTo(x, z, stop?)  // programmatic tap-walk (works while input is locked)
world.ranger()                   // { x, z, yaw, speed } live, every frame
world.setObjective(o | null)     // the chip points at a mission place: { x, z, arrow }
world.onFrame(fn)                // a per-frame tick inside World.update; returns an unsubscribe
world.residents                  // the Residents module (3.4)
world.missionCtx(host)           // WorldCtx + the above, for the kit
```

While mission mode is on: other markers, the missiebord, the bird bench, the jeep and
the helicopter offer no prompt and the interact key does nothing for them; the marker
labels stay hidden near the mission; the wayfinding chip shows the mission objective;
the world-EF "Onderweg" beat stays disarmed. Walking, the follow camera, fauna, sky and
residents stay live. `camera: 'held'` skips `cam.steer/cam.place`; releasing it hands
the lens back through the existing external-offset decay (no snap), or a cut under
reduced motion. `input: 'locked'` ignores keys/stick/pointer tap-walk but still walks a
`walkRangerTo` target; the canvas pointer then belongs to `pick3d`.

Keep `beginActivity/endActivity` for the classic path. Keep changes to `WorldCtx`
(`play/types.ts`) additive; the kit may extend it (`MissionCtx extends WorldCtx`).

For the whole adventure the dev hook says `screen = 'mission'` and `missionView = '3d'`,
walking beats included (golden reads `world` + `null` as "the mission ended"). An
adventure starts the same way from the marker prompt, from the missiebord
(`goToMission` brings the ranger to the marker first) and from "Speel nog eens".

### 3.4 Places and residents (who lives where, before and after)

**Places**: each adventure authors its world spots in one table (`marker`, `cover`,
`field`, `wallow`, `hide`, ...), as absolute world x/z chosen by looking at the world,
with a unit test that each is dry, inside the bound, clear of trunks/props/paths/other
markers (use the same rules as `World.playClear`) and at the right distances from each
other. The mission marker may move to its adventure's `marker` place: add an optional
`at?: {x, z}` to `WorldMarker` (additive) and keep golden's walk from spawn short
(≤ ~30 m). A dev-hook read `__ranger.missionPlaces(id)` exposes them to the tests.

**Residents** (`render3d/world/Residents.ts`, new): the animals that live at a mission's
home, placed when the world is built, in a **before** state (mission not done) or an
**after** state (done, also after a reload). They idle believably (rooting, grazing,
sitting on a trunk), rest in the fog far away like the other animals, are seated per
point on `terrain.y`, are listed as movers for the seating probe and the jeep (include
them in `ambientState()` or the movers visitor, so the FEEL lane's jeep avoidance sees
them), and carry a small home dressing (a wallow, a copse, a sett) that is built once.
The adventure **borrows** a resident group (`residents.borrow(id)` → live actors it can
move) and **returns** it in the after state (`residents.release(id, 'after')`). A stopped
mission returns it in the before state. The classic path's completion switches the
residents to after (a cut under reduced motion, a short calm walk-in otherwise). A
replay ("Speel nog eens") puts the residents back in the before state while the briefing
card covers the view, and in the after state again at its end.

`Progress.ts` keeps the ✓ flag at the marker for every mission, and keeps its tableaus
for the six missions without an adventure. A mission with residents drops its old
tableau (update `Progress.test.ts`).

**Marker look**: `TABLEAUS[id].hero` puts an animal in the marker ring. For an adventure
mission the marker shows what the story needs instead: frisling nothing in the ring (the
piglet is hidden, you hear it); ree nothing (the calf is hidden, its mother grazes at
the copse); wildcamera the camera trap lying on a stump; eekhoorn the squirrel, a
resident living on its oak by the marker. Add a marker look option (animal / prop /
none) without a procedural totem for "none".

### 3.5 Actors and behaviours (`render3d/adventure/actors.ts`)

An `Actor` wraps a `Spawned` model: position/yaw, seated on `groundY` every frame,
facing where it goes (turn-rate limited), procedural gait for static meshes (trot bob +
body sway scaled by speed; the existing `ProceduralMotion` recipes at rest), baked
clips for rigged ones (walk/idle/graze). Behaviours, each calm and interruptible:
`idle`, `root/graze` (head-down shuffles in a small circle), `walkTo(x, z, speed)`
(round obstacle circles and water, never through a trunk), `follow(ranger, gap)`,
`fleeTo(cover)` (a short trot away, never toward the camera), `hide` (duck into cover,
lie down with `lieDown`), `peek`, `lookAt`, `sniff`. Speeds: piglet trot ≤1.6 m/s,
sow walk ≤1.0 m/s, roe walk ≤1.2 m/s, squirrel dash ≤3 m/s in short bursts. A unit test
covers the pure parts (steering, gait, follow gap).

### 3.6 Framing (the camera during beats)

- Walk beats: the normal follow camera (the player steers). No kit camera moves.
- Framed beats (search, route, callers, aim, watching): one eased reframe to a pose that
  frames a world spot from a chosen side with the ranger in the lower corner of the
  picture where he fits, held for the beat, then released. Build it by extending
  `play/stage.ts` additively: a `Stage` option `anchor: {x, z, heading}` that skips the
  search in front of the ranger and fits the patch there (the fit maths, pitch, insets
  and clearance rules stay). Fixed FOV; no zoom (a "binocular" view is the lens moving
  closer plus a vignette, never an FOV change).
- Establishing looks (`k.look`): one eased turn toward a place and back, ≤ 2.5 s held,
  skippable with Space, a cut under reduced motion. At most one per mission.
- Never a reframe while the player walks; ≤ 90°/s turns (the existing `makeReframe`).

### 3.7 Cover at true scale (`render3d/adventure/cover.ts`)

A cover stand = a dense, INSTANCED patch of pijpenstrootje tussocks (0.5-0.9 m, green
leaves with straw tips; build from `grassTuftGeometry` with more, longer blades),
bracken fronds (0.9-1.3 m; instance the fern GLB's geometry, do not spawn one mesh per
fern) and a few heather clumps. ≤ 4 draw calls per stand. It supports: a clump that
rustles (per-instance sway for ~0.6 s), a clump that parts (stems lean away to show
what is under it), and a lying animal placed IN it with its back just glimpsable from
the framed view (use `lieDown`, `lyingHeight`, `backTop`). A pure helper computes, for a
given view, how much of the target shows (the tests assert "partly visible, never
fully covered, never fully open").

### 3.8 Spatial and extra sound (`core/sound.ts`, additive)

`Sound.callAt(id, x, z, listener)`: the call through a `StereoPannerNode` (pan from the
bearing relative to the camera, ±0.8 max) and a distance gain (full ≤3 m, soft at 15 m,
silent past ~25 m). Plus calm synths: `rustle()` (short band-passed noise),
`splash()`, `dig()`, `shutter()` (a soft camera click), `sniff()`. One call at a time
stays the rule; ambient squeaks every 4-6 s, never overlapping a spoken line (queue
behind the narrator).

### 3.9 The mission HUD and the test channel

**HUD** (`ui/flow/AdventureHud.ts`, new; the FLOW lane owns the shared look, so reuse
its card/chip/button classes and tokens): the Pauze chip (as today), an **objective
line** top-centre (one line ≤7 words + 🔊, read aloud once when it appears), the
**objective chip** (reuse the wayfinding chip; text first, arrow only when
`arrow: true`), and an **action prompt** bottom-centre for in-world actions ("Hang de
camera op"), a `.btn-start`-style button with class `adv-action` that Space/Enter press
(ui/keys.ts). While the player walks, nothing in this HUD may count as a menu:
`menuOpen()` must stay false (use `.explore-overlay` or exclude the new classes).
Choice cards (rustkracht) DO lock input while they are up.

**Play hints** (additive in `play/kit.ts`, `core/devhook.ts`, `e2e/golden-lib.ts`):
`PlayHint` gains `walk?: { x: number; z: number; r: number }`. A walk hint means "a
perfect player walks there now"; `probePlayHint` returns it with the world point, and
golden/missions.spec walk there with held arrow keys (`walkTo`) until the hint changes.
Click hints stay as they are. Action prompts need no hint: the test loop clicks a
visible `.adv-action` button like a player. A dev read `__ranger.adventure()` →
`{ mission, beat, stepsLogged }` helps tests and review (read-only, never to skip).

**Test loops** (golden step 6 and missions.spec `playSteps`) change additively:
(a0) a walk hint → `walkTo` with arrow keys; (a) click hints as today; (b) an
encounter card is answered by matching the question against the encounters of ANY step
of this mission (steps interleave); (c) `Verder|Klaar` cards and `.adv-action` buttons;
"won" = every step's trial count went up (not just `plan[idx]`). Golden adds soft
checks that carry this design's bar: at the marker the resident family is on screen
(`screenOf`); the search target's cover is at least 2× its lying height; the reunion
ends with the young within 2 m of its mother at the home place; the ranger ends ≤12 m
from the marker or the home place.

### 3.10 Stop, pause, cleanup

"Stop de missie" (Pauze) aborts the script at its next await: actors disposed, borrowed
residents returned in the before state, framing released, objective cleared, mission
mode off, the explore HUD back, the ranger left where he stands (as today). Pause holds
the ranger (menu gate) and the script's hint timers. A reload mid-mission restarts the
mission (no mid-mission save; persistence stays in `core/state.ts`/`persist.ts` only).
Walking far away is never a fail: the mission waits, the chip points back, a following
animal waits where it is and squeaks when he is within ~20 m again.

### 3.11 Files (P1 creates the framework; P2-P4 add a mission each)

```
app/src/render3d/adventure/types.ts        Adventure, AdventureKit, MissionCtx, places (THREE-free)
app/src/render3d/adventure/kit.ts          the kit: walk, look, search, route, choices, callers, aim, moment, fact, action
app/src/render3d/adventure/actors.ts       Actor + behaviours (+ actors.test.ts for the pure parts)
app/src/render3d/adventure/cover.ts        true-scale instanced cover stands (+ test for the visibility helper)
app/src/render3d/adventure/beats/*.ts      the in-world EF views: search (zoeken), route (corsi), choice (dagnacht);
                                           P3 adds aim (wisselen) + callers (simon), P4 may reuse callers
app/src/render3d/adventure/missions/*.ts   one script + places + residents per mission
app/src/render3d/world/Residents.ts        before/after world presences (+ test)
app/src/ui/flow/AdventureHud.ts            objective line, chip, action prompt
app/src/ui/flow/MissionFlow.ts             adventure vs classic branch; logging stays here
app/src/render3d/World.ts, world/Player.ts, world/Markers.ts, world/Progress.ts   additive mission-mode hooks
app/src/render3d/play/kit.ts, play/stage.ts, play/types.ts, core/devhook.ts         additive: walk hint, anchor, MissionCtx
app/src/core/sound.ts                      callAt + small synths (additive)
app/src/content/veluwe.ts, content/types.ts   adventure copy per mission (`avontuur` block), encounter order
app/e2e/golden.spec.ts, golden-lib.ts, missions.spec.ts   walk hints, cross-step answers, new soft checks
games/Ranger-Adventures/GOAL.md (step 6 wording), ARCHITECTURE.md (the adventure layer)
```

Copy lives in `veluwe.ts` (data), so `veluwe.test.ts` lints it: extend the test to walk
every string of the new `avontuur` blocks (≤7 words a sentence, plain lines without
jargon, knap lines with).

## 4. The four missions

Durations are for a child. Each table row is a beat: what he sees and does, the line,
the step it measures. Lines are drafts; the builder writes the final Dutch at AVI
M3/E3, ≤7 words, with plain and knap variants where a jargon word appears.

### 4.1 De verdwaalde frisling (flagship, golden mission 1) · 6-9 min

**World before**: the **rotte lives at a wallow** (zoel): the sow, a yearling and
three piglets root and wallow round a muddy hollow with a fallen log and a bracken rim,
**10-14 m from the marker**, visible from the marker and from the approach. Grunts are
heard (spatial) within ~15 m. The marker ring is empty: small piglet prints and a thin
squeak every ~5 s from a **stand of bracken and pijpenstrootje 7-10 m from the marker**,
the other way from the wallow. Between that stand and the wallow lies a **rooting
field**: seven look-alike patches of turned earth (the corsi spots), ~9 × 6 m.

*Where (a starting point; verify by looking, then pin in the places table)*: marker
F (-15.6, -15.6). Neighbours: the ree marker (-15, -27.1), the herstel marker
(-35, -19), the spawn→boa sand path at z ≈ -2..-4 here. A layout that fits: cover
stand ~(-20, -8) near the path, rooting field centred ~(-24, -16), wallow ~(-26, -24).
Keep every frisling place ≥ 8 m from the ree and herstel markers and leave the ground
north of the ree marker free for P2.

| # | Beat | What happens | Line (draft) | Measures |
|---|------|--------------|--------------|----------|
| 0 | Briefing | card; the text names the squeak and the group at the mud | "Hoor je dat? Er piept iets." … "Zijn groep is bij de modderpoel." | |
| 1 | Look | one calm look at the wallow: the family is there | "Daar is zijn groep." | |
| 2 | Follow the squeak (walk) | follow faint piglet prints + the panned squeak to the cover stand; the arrow shows only after ~20 s without progress | "Volg het gepiep." | zoeken spoor leg (difficulty only) |
| 3 | Find him (search) | framed view over the waist-high cover; the piglet lies flat, stripes glimpsed; decoys per trial (clumps, a stonechat on a stem, a butterfly on a foxglove, a nightjar); a miss: the clump rustles and parts, nothing there; after 2 misses or 14 s he squeaks and his stems quiver | "Waar is de big? Klik op hem." → "Daar is hij! Hij drukt zich plat." | **zoeken** |
| 4 | Fact | raaf card: stripes | | |
| 5 | Choice: aaien | he lies squeaking; wrong: he scoots deeper and hides, peeks out again | encounter 'aaien' | dagnacht 1/5 |
| 6 | Choice: dragen | he stands up, tired; wrong: squeal, trots off, comes back | encounter 'dragen' | dagnacht 2/5 |
| 7 | Lead him (walk) | he follows ~2 m behind; to the edge of the rooting field; **run and he hides** in the nearest clump (line once), walk calmly and he comes out | "Loop rustig. Hij loopt mee." / "Niet rennen. Dan schrikt hij." | (unmeasured calm) |
| 8 | The route (corsi) | framed view of the field; the patches light up one at a time with fresh prints (the group's route); then click them in order: the ranger walks there with the piglet, who sniffs; a wrong patch: he sniffs, "Hier niet. Kijk nog een keer.", the route shows again | "Kijk goed welke weg de groep liep…" → "Wijs de weg. Klik op de plekken." | **corsi** |
| 9 | Fact | raaf card: smell | | |
| 10 | Walk on (walk) | toward the wallow; the yearling trots out of the bracken toward the ranger's side | "Breng hem naar de modderpoel." | |
| 11 | Choice: voeren | the yearling sniffs at the bag (stops ≥1.2 m); wrong: it wriggles closer eagerly, never lunges; right: it trots back | encounter 'voeren' | dagnacht 3/5 |
| 12 | Choice: zeug | ~6 m from the wallow the sow lifts her head and looks; wrong: a firm grunt, she steps between (not toward the camera) | encounter 'zeug' | dagnacht 4/5 |
| 13 | Choice: pad (flip) | "Nu mag het wél": right = the ranger walks on along the path a few steps, giving room | encounter 'pad' | dagnacht 5/5 |
| 14 | Reunion | the piglet trots to the sow squeaking; she lowers her head, sniffs him, soft happy grunts; the piglets crowd round; one framed shot with the ranger in the foreground | "De moeder knort blij. Haar big is terug." | |
| 15 | Fact, reward, clue | raaf card 3/3, reward, the `spoor` clue (cut fence + big prints: show the cut fence and the boot prints by the wallow's path as world dressing when the clue drops) | | |

Content: reorder the frisling encounters to `aaien, dragen, voeren, zeug, pad`; rewrite
'voeren' for the yearling; keep the rules chips. The 2D path plays the same order.
**After**: the family (sow, yearling, four piglets) lives at the wallow; the ✓ flag at
the marker; the cover stand stays (a place, not a prop that vanishes).

**The piglet model** must read as a wild-boar piglet: warm brown with cream lengthwise
stripes (a procedural stripe pass on its material in `AnimalDress`/`Coat`, model space
along the body axis, calm and sourced from `research/`), for the residents and the
actor. The search depends on "stripes glimpsed".

### 4.2 Het reekalf in het gras · 5-7 min

**World before**: a small **copse** (a few birches/pines, junipers, bracken) at the
heath edge 20-25 m from the marker; the **doe grazes at its edge**. When the ranger comes
within ~15 m (free roam) she lifts her head and walks calmly into the copse; she comes
out again when he is gone. The marker ring is empty; a **meadow of tall grass** lies
6-10 m from it; a **hide** (a juniper + fallen log) 12-18 m further, facing the meadow
and the copse; a **wet pool** on the direct line from meadow to hide.

*Where (starting point)*: marker R (-15, -27.1); the heath meets the bos at x ≈ -3 on
this latitude, so a copse near ~(-3, -40) lets the doe come from the forest edge
(~18 m from R). Stay clear of the frisling places (south and west of R).

| # | Beat | What happens | Measures |
|---|------|--------------|----------|
| 0 | Briefing | "Een wandelaar belde. Er ligt een reekalf alleen." … "Niet aanraken." | |
| 1 | Walk | follow the doe's small slots (prints) to the meadow edge | zoeken spoor leg |
| 2 | Search | the spotted calf lies pressed flat in the tall grass (`lieDown` + `fawnSpots`); decoys per trial | **zoeken** |
| 3 | Fact | raaf: a calf smells of almost nothing | |
| 4-6 | Choices at the calf | 'aai', 'oppakken', 'geur'; wrong: the calf jumps up, bolts a few metres, lies down again (for 'geur': a short bark from the copse) | dagnacht 1-3/5 |
| 7 | Walk away quietly | objective: the hide; running: "Sst. Loop stil."; the pool lies across the way | |
| 8 | Choice: modder | at the pool's edge; right: the ranger walks round it (the objective route bends); wrong: a splash and ripples, "Plons! Dat maakt veel lawaai." | dagnacht 4/5 |
| 9 | Watch | at the hide: the lens moves toward the meadow, binocular vignette (no zoom). The doe steps out of the copse where she went in, looks round, walks to the calf; the calf stands; she noses it; it drinks | |
| 10 | Choice: moeder (flip) | "De moeder is terug. Het pad is vrij." right: walk quietly away | dagnacht 5/5 |
| 11 | Reunion, fact, reward | "De moeder is terug bij haar kalf." | |

**After**: doe and calf graze at the copse edge (residents after state).

### 4.3 De wildcamera · 6-9 min

Steps become **`[wisselen, simon]`** (content change; the 2D path follows). Simon
callers become nocturnal: **`['das', 'wildzwijn', 'ree', 'nachtzwaluw']`** (add a
fitting synth or recording where one is missing; update icons in `animalIcon.ts`).
Wisselen places become **"open plek" and "het bosje"** (the thicket where day animals
rest at night and the badger has its sett): update `regel` so `placeNames()` reads them.

**New capability (P3)**: a calm **day ↔ night** in `world/Sky.ts`: `setDaylight(k)`
(1 = the golden hour, 0 = a readable blue moonlit night: never pitch black, the animals
fully readable, no disembodied glowing eyes) crossfading hemisphere, sun, fog and dome
over ~2 s (a cut under reduced motion); restored on finish and on Stop.

**World before**: the marker (bos, by the ven) shows the camera trap lying on a stump.
A **wildwissel** (game trail: trodden line with deer, boar and badger prints) leads
8-15 m into the wood to a **crossing** where an **open glade** lies on one side and a
**thicket with the badger's sett** on the other, a sturdy **camera tree** between them.

*Where (starting point)*: marker W (15.6, -15.6) has the ven (24.5, -19) and ecoduct
(19.1, -24.4) markers within 10 m to the east; the open bos to the west and north-west
(x 0..12, z -20..-45) is free. A crossing near ~(6, -28) keeps ≥ 12 m from the ecoduct
and nachtronde (20.8, -34.2) markers. The marker may move a few metres west (`at`).

| # | Beat | What happens | Measures |
|---|------|--------------|----------|
| 0 | Briefing | "We hangen een wildcamera op." … "Zoek eerst een goed plekje." | |
| 1 | Walk | follow the wildwissel to the crossing | |
| 2 | Action | at the tree: action prompt "Hang de camera op" (Space or click); the ranger straps it on (~0.7 m), a soft click, the red light blinks | |
| 3 | Aim (wisselen) | framed: glade left, thicket right, camera tree between, both places named in the world. Each trial: "Nu komt het hert. Waar kijkt de camera?" (animal icon + name + ☀/🌙 tag) → click the glade or the thicket. Right: the camera turns, the animal walks into view there, shutter, a thumbnail joins the photo strip. Wrong: an empty photo, "Leeg. Het dier is daar nu niet.", try again. **The rule flip = day ↔ night**: the sky fades to night: "Het wordt nacht. Nu is het andersom!" (night animals out in the glade, day animals resting in the thicket) | **wisselen** |
| 4 | Listen (simon) | night; the four callers stand round the crossing (badger at its sett, boar by the bushes, roe at the glade edge, nightjar on a branch), all readable in moonlight. Each calls with its sound and a soft light-up, the camera blinks its IR light; echo = click them in order; the sequence grows; a wrong click replays | **simon** |
| 5 | Morning | the sky fades to day; the photo strip plays back (DOM card over the world); the last photo: a man setting a snare (the poacher, calm, from the side, grey) | |
| 6 | Action | walk to the spot by the trail: the empty snare lies there → "Haal de val weg" → it is gone | |
| 7 | Reunion line, reward, **camera clue** | "De camera bewaakt het bos." | |

**After**: the camera stays strapped to its tree; the badger shows at its sett at dusk
only if cheap (otherwise the sett alone).

### 4.4 De verstopte nootjes (eekhoorn) · 5-7 min

Steps stay **`[corsi, simon]`**. Simon callers become the squirrel's tree neighbours:
**`['eekhoorn', 'gaai', 'groene-specht', 'raaf']`** (recordings exist for all four;
the jay is the nut thief of the story; update `animalIcon.ts`).

**New capability (P4)**: lively **squirrel locomotion** for the static mesh: dash-stop-
dash on the ground, running up and round a trunk (body pitched to the bark, spiral
path), sitting up on a branch with the tail curled, leaping branch to branch or trunk
to trunk on a low arc, tail flicks when it calls, digging (little earth puffs). Fast but
short bursts, always readable, never toward the camera.

**World before**: the squirrel lives on its **oak by the marker** (the marker's look):
it runs up and down the trunk and chatters when the ranger comes near. A few trees
away (15-25 m) lies its **caching glade** under a big oak: seven look-alike small
mossy/leaf-litter patches (the corsi spots, ~4 × 3 m) and an acorn cluster by a stump;
round the glade a dead snag, a low branch, a trunk and a stump for the callers.

*Where (starting point)*: marker E (25.4, -41.9), with the vos marker (36, -46), the
nachtronde marker (20.8, -34.2) and the watchtower (37, -37) close by. The glade fits to
the west/north-west, ~(12, -50), inside the rim (bound 75 m).

| # | Beat | What happens | Measures |
|---|------|--------------|----------|
| 0 | Briefing | "De eekhoorn verstopt nootjes." … "Help hem onthouden." | |
| 1 | Follow (walk) | the squirrel leaps from tree to tree, waits on a branch until the ranger is within ~4 m, chatters, dashes on; 3-4 hops to the glade | |
| 2 | Watch + point (corsi) | framed over the glade floor. The squirrel takes an acorn and buries it at patch after patch (the show = its visits in order, one dig each); then runs up the oak: "Oei, hij weet het niet meer!" Recall: click the patches in order; he dashes to each right one and sniffs + flicks (found); a wrong one: he sniffs, finds nothing, "Kijk nog een keer." and the route shows again (the ranger's memory: the patches glow in order); when the whole route is right he digs them all up in a happy run and piles the acorns by the stump | **corsi** |
| 3 | Fact | raaf: forgotten nuts grow into trees | |
| 4 | Call back (simon) | framed, looking a little up: squirrel on the stump, jay on a low branch, woodpecker on a trunk, raven on the dead snag, all visible at once; the jay wants the acorns: "Roep ze na!"; listen (call + light-up + tail/wing flick), echo by clicking; growing sequence; at the end the jay flies off | **simon** |
| 5 | Payoff, fact, reward | the squirrel sits on its stump eating an acorn; "Alle nootjes terug." | |

**After**: the acorn store by the stump, the squirrel at home; the next visit shows a
tiny oak seedling at one forgotten patch.

## 5. Copy, sound and look rules for every beat

- One objective line at a time, ≤7 words, read aloud once, 🔊 repeats it. Device words
  via `deviceText` ("Klik"/"Tik").
- Plain lines never use jargon (frisling, rotte, zeug, overloper, reegeit, zoel ...);
  knap variants may.
- Every click gets feedback within a frame or two: a sound and a visible reaction.
- Never scary: calm animals, soft sounds, the sow's warning is a firm grunt, the night
  is blue and readable, the poacher is a calm grey figure seen from the side.
- Draw calls < 150 in every frame of every beat (golden samples it); cover instanced.

## 6. Construct hygiene (parity with the 2D floor, per engine)

The pure cores and builders in `engines/*` are not changed. Each in-world view:

- **zoeken** (`buildZoekenTrial`, `buildSpoor`, `scoreZoeken`): target and decoys from
  the trial laid on the cover stand (`patchLocal`); scored on the first click; the
  trail leads to the STAND, never to the target; hints only after 14 s or 2 misses;
  the view holds still during the search.
- **corsi** (`buildCorsiTrial`, `CorsiRun`): seven LOOK-ALIKE spots (no nameable
  landmarks: that would make it verbal) in the `PRINT_SPOTS` layout scaled uniformly;
  all seven visible in one held view during show and recall; the show starts after the
  camera settled, one spot at a time; recall right after the show; a wrong spot =
  `reshow` exactly as the core says. The ranger/animal walking to a clicked spot is
  feedback, not input.
- **dagnacht** (`buildDagnachtTrial`, `DagnachtRun`): two options in the DOM card,
  slots shuffled, the rules chips, "Nu mag het wél" on the flip, a wrong answer
  re-presents the same encounter. Trials may be spread over the mission (other beats
  between them) but keep the content order.
- **simon** (`buildSimonTrial`, `SimonRun`): four callers, distinct call + place, all
  visible during listen and echo; light-up + call together (playable muted); growing
  sequence; a wrong click replays the same sequence. No beat in between.
- **wisselen** (`buildWisselTrial`, `WisselRun`, `placeNames`, `regelAndersom`,
  `dagOfNacht`): both places visible and named the whole time; the rule shown in the
  card with icons; the flip cued in two channels (sky + card + spoken); the ranger
  never walks during sorting.

Each new view gets a small unit test of its pure mapping (trial → world layout) and
asserts it emits the core's `summary()` unchanged. The existing parity tests stay green.

## 7. What I will check when reviewing a package

Always: `RANGER_PORT=<p> npm run gate` tail line, `RANGER_PORT=<p> npm run golden`
table (ALL GREEN), the package's missions.spec tests, screenshots I open myself, and
the lane invariants: the other missions still pass; draw calls < 150; no new runtime
dependency; save data untouched; every new string read aloud.

Per mission (played myself from a fresh save at 1280×800 with keys and mouse):

- The animals that matter are visible in the world before the mission starts, and walk
  in from where they were. Nothing appears out of nowhere.
- The hiding animal is really hidden by cover at least twice its height, and partly
  visible (the stripes/spots glimpsed); no trail leads to the exact spot.
- Every beat shows one line and an in-world cue; I know what to do without the arrow.
- Walking beats use the follow camera; framed beats move the lens once, calmly.
- Every choice and click has a visible, audible reaction; mistakes are gentle and
  recoverable.
- The payoff happens in the world and stays after a reload.
- A full child-pace playthrough takes 5-10 minutes.

## 8. Shared contracts and the other lanes

- **FEEL** (sizes, Shift-to-run, jeep, animals dodging the jeep) lands `run6/scale-base`
  first: builders merge it before they start (if it is not there yet, start, and merge it
  the moment it appears). Never hard-code sizes: read `RANGER_STAND_HEIGHT`, `heightFor`,
  `standHeightFor`. "Running" = the ranger's ground speed above ~1.25× his walk speed,
  so the piglet mechanic works whatever speeds FEEL picks. Residents must be visible to
  FEEL's jeep avoidance (movers list).
- **FLOW** owns the shared screen look (cards, typography, transitions, reward and clue
  screens, the hub, everything before the first mission). This lane owns what happens
  after "Ga op pad", the mission's words, the marker's look in the world and the
  adventure HUD's behaviour (built from FLOW's classes). Touch `MissionFlow.showReward`
  / clue cards only additively (e.g. to pass the photo strip).
- Changes to `play/kit.ts`, `play/stage.ts`, `play/types.ts`, `MissionFlow.ts`,
  `World.ts`, content types: additive; every builder lists them in the report.

## 9. Pitfalls found while scouting

1. `menuOpen()` = any `.ra-overlay` without `.explore-overlay` → the ranger freezes. The
   objective line and chip must not count; `anchoredPrompt` cards do count.
2. `beginActivity()` couples walking, proximity, labels and the camera: do not reuse it
   for walk beats; add the separate mission mode.
3. `Player.walk` only runs when no activity and no menu: `walkRangerTo` during a locked
   framed beat needs its own gate (input ignored, target still walked).
4. Golden's loop answers encounters only for `stappen[idx]` and detects "won" only for
   `plan[idx]`; interleaved steps get it stuck. Fix the loop generically (3.9).
5. The seating probe tags movers from `ambientState()` only; residents that shuffle must
   be listed or `worldChange` counts them as the world reacting (or as restless).
6. The missions.spec reduced-motion and missiebord tests assume the family stands at the
   marker (≥3 things within 6 m, all within 4 m): point them at the home place via
   `__ranger.missionPlaces()`.
7. `Progress.test.ts` pins the frisling tableau; update it when residents replace it.
8. `spawnPlant` makes one mesh per plant: a real cover stand from it blows the
   draw-call budget. Instance.
9. The frisling/boar/squirrel are static meshes: all their motion is procedural; keep it
   calm and readable, freeze secondary motion under reduced motion.
10. A hidden `Stage` rule: `isClear` excludes other missions' markers within 1.2 m and
    finished tableaus; places must respect it or the stage refuses the spot.
11. Don't edit `src/` while `npm run golden` runs in the same worktree (Vite reload).
12. Each 3D engine calls `registerPlayHint`; the kit must clear the hint between beats
    (`clearPlayHint`) or golden clicks a stale target.
13. `stepForView` strips the fact from the skin; the adventure shows facts through
    MissionFlow's `showFact` so the veldnotitie collection stays in one place.

## 10. Package plan

| id | Package | Depends on | Runs |
|----|---------|------------|------|
| P1 `frisling` | The in-world adventure framework + the whole frisling adventure + golden/missions.spec for it + GOAL step 6 wording | none | first, alone |
| P2 `ree` | Het reekalf in het gras as an adventure (copse, doe resident, meadow, hide, watching) | P1 | parallel |
| P3 `wildcamera` | De wildcamera as an adventure + day/night sky + camera trap + snare | P1 | parallel |
| P4 `eekhoorn` | De verstopte nootjes as an adventure + squirrel locomotion + tree callers | P1 | parallel |

**P1 builds in milestones, golden green at each** (so a partial P1 is still a win):
M1 mission mode + kit skeleton + adventure HUD + walk hint + the generic test loops,
with the frisling adventure first running its three existing games at world places;
M2 residents + the wallow + the empty marker + the reunion at the wallow (kills "the
mother appears out of nowhere"); M3 cover kit + the search beat + the striped piglet
(kills "tiny bushes" and "the trail leads to him"); M4 the walk beats (spatial squeak,
prints, leading, hide-when-running); M5 the route beat (corsi field); M6 the choices
spread over the journey; M7 the look beat, facts, copy, budgets, unit tests, GOAL step 6
and ARCHITECTURE.md.

Priority if time runs short (run decision 5): P1 > P2 > P3 > P4. Each builder works in
its own worktree branched from `run6/missions` (after P1 is merged there), commits small
and often, and reports: what a player now experiences, commit shas, the tail line of
every check, screenshot paths in its scratch folder, shared contracts it changed,
known gaps.
