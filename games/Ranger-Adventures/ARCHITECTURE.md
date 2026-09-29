# Architecture: where the code lives

> The map for `app/src/`. Read [GOAL.md](GOAL.md) and [STATE.md](STATE.md) first.
> Stack: vanilla three.js + Vite + TypeScript, no framework. Entry: `app/src/main.ts`.

## The big picture

```
main.ts ── title card ─► ui/Missions.ts (thin entry)
                            │
          ui/flow/WorldSession.ts   builds the World, runs free roam, returns from missions
          ui/flow/MissionFlow.ts    briefing → steps (mini-games) → reward → clue → back
          ui/hud/ExploreHud.ts      pill, waypoint chip, ONE proximity prompt, hints
          ui/hub/Hub.ts             pause, missiebord, sporenboek (clue board), badges
          ui/keys.ts                Enter/Space = the one visible primary button, Esc = back
          ui/dev/wireDevhook.ts     connects window.__ranger read-backs
                            │
render3d/World.ts  (≈700 lines) the composer: builds the world/ modules, calls update(dt),
                   exposes the public API the flow uses, and ctx() for the mini-games
   world/Terrain.ts     THE ground: mesh, terrain.y(x,z), biome, intersectRay. One truth.
   world/Dressing.ts    grass + wind, water, paths, cabin, landmarks, props, collision list
   world/Forest.ts      every tree: instanced real GLBs per distance level (Lod.ts), per-tree
                        occluder fade (only the crowns between camera and ranger fade); a home
                        tree's branch stub (TreeStub) is part of its tree: drawn and faded with it
   world/Progress.ts    lasting per-mission tableau at a finished marker (onMissionComplete)
   world/Fauna.ts       warden, poacher, roaming animals
   world/Markers.ts     mission markers, missiebord, sit-spot, proximity, wayfinding
   world/Vehicles.ts    jeep, helicopter + pads, dust
   world/Player.ts      the ranger rig, on-foot movement, footsteps
   world/CameraRig.ts   follow camera (told by the player's steering, never chasing), orbit,
                        clear-view search, occluder-fade decision, reframes
   RangerLook.ts        paints the avatar maker's choices onto the ranger GLB
   world/Sky.ts, Labels.ts, props.ts, DevReadback.ts
                            │
render3d/play/     the mini-game kit: stage.ts (a per-step staged patch), spawn.ts
                   (spawnModel/spawnPlant: the world's own GLB animals and plants),
                   kit.ts (pick3d, prompts, reframes, play-hint channel), types.ts (WorldCtx)
render3d/engines/  one 3D view per mini-game (zoeken, corsi, dagnacht, simon, wisselen, roep)
render3d/adventure/ run 6: a mission played IN the world as one adventure (see below)
   world/Residents.ts   the animals that live at a mission's home, before and after
engines/           the pure game logic (scoring, sequences, rules); no three.js; unit-tested
render2d/          the 2D floor per game (reduced motion / fallback)
content/veluwe.ts  missions, steps, animals, texts (Dutch, AVI M3/E3)
core/              state + persist (save data), input, vehicle/heli physics, skill, sound, …
```

## Rules of the road

- **Ground:** anything that stands on the ground uses `terrain.y(x, z)` (world coords).
  Nothing else may sample height. Mini-games get it as `ctx.groundY`.
- **A mini-game** is a 3D engine that receives a `WorldCtx` (`render3d/play/types.ts`) and
  stages real models with `ctx.spawnModel` / `ctx.spawnPlant` on a clear patch
  (`ctx.isClear`). It must call `registerPlayHint` with what a perfect player clicks next,
  so `npm run golden` can play it with the real mouse. Its pure rules live in `engines/`.
- **Each mission step** gets its own DOM host and its own scene group; the flow removes
  both when the step ends (finished or stopped), so a stop never leaks into the world.
- **Save data** only through `core/state.ts` + `core/persist.ts` (`alvah-ef-v1`).
- **Mission completion** is one event: the flow calls `world.onMissionComplete(id, { fresh })`
  (also on boot/reload for finished missions) so the world can show lasting progress.
- **Tests:** `engines/*` and `core/*` have fast unit tests (`npm test`); the browser truth
  is `npm run golden` (see [CLAUDE.md](CLAUDE.md)). `window.__ranger` is for reading state.

## The adventure layer (run 6)

A mission with an entry in `render3d/adventure/registry.ts` is played **in the free world
with the ranger's own body** instead of as staged mini-game patches — when the world is
live and WebGL works, and neither "altijd 2D" nor reduced motion is on (those keep the
classic 2D floors, same content, same logging). `MissionFlow.runAdventure` runs it; the
adventure never touches save data: it logs each `Mission.stappen` step **exactly once**
through the flow's hooks (`log`, `fact`, `reunion`), so the EF contract is unchanged.

```
adventure/registry.ts    Adventure { id, home, clearings?, dressing?, bind?, prepare?, unprepare?, play(kit) }
adventure/kit.ts         AdventureKit: the only thing play() talks to
adventure/beats/         search.ts (zoeken), route.ts (corsi), choice.ts (rustkracht): the SAME
                         trial builders + pure runs as the 2D floor, played in the world
adventure/actors.ts      Actor: calm behaviours (idle, root, go, follow, look, sniff, lie) + a
                         procedural trot for static GLBs; actors-math.ts is the pure part
adventure/cover.ts       CoverField: instanced true-scale bracken, moor-grass, heather (3 draw
                         calls) that rustles and parts; cover-math.ts: line of sight, glimpse
adventure/patches.ts     PatchField: look-alike rooting patches (corsi spots) + prints, or
                         mossy cushions in leaf litter (`look: 'moss'`, the squirrel's glade)
adventure/squirrel.ts    Squirrel (an Actor): the static squirrel mesh brought to life — dash-
                         stop-dash, spiral trunk runs, branch stubs, leaps, hiding round a
                         trunk, digging, an acorn in its mouth; squirrel-math.ts: the pure plans
                         (speeds, never at the lens, on the bark), squirrel.test.ts
adventure/places.ts      frames, headings, local↔world (pure)
adventure/missions/      one mission each: <id>.places.ts (pure, unit-tested: where it
                         happens), <id>.home.ts (the home's dressing), <id>.ts (the beats)
world/Residents.ts       a home's animals: before/after state, spatial calls, borrow/release
ui/flow/AdventureHud.ts  the one objective line (read aloud once), the 👂 chip, action button
```

**The kit, in one screen** (`k` in `play(k)`):

- *where things are*: `k.ranger()` (x, z, heading, speed, running), `k.lensFor(frame)`,
  `k.ctx.groundY`, `k.world` (the World: `residents`, `camera`, `faceRanger`).
- *the animals*: `const fam = k.borrow()` → `fam.actors[key]` (Actors), `fam.dressing` (the
  home), `fam.voice(key, on)`; `k.reunion(async () => …)` marks the mission done and plays
  the reunion under its line; `k.dispose(state)` (the flow calls it) hands the home back.
- *the lens*: `await k.frame({ at, heading, halfW, halfD, pitchDeg, include }, { face })`
  holds a framed view (a Stage fit at a world anchor, the ranger's spot among `include`),
  eased, ≤ 90°/s, a cut under reduced motion; `k.free()` gives the follow camera back with a
  blended hand-over; `await k.look(spot, line)` is one calm look (binoculars) and back.
- *walking*: `await k.walk({ name, to, r, line, doel, lead })` — the child walks himself;
  the chip names the goal in words, the arrow only after ~20 s without progress; with
  `lead` an actor follows and hides when he runs. `await k.walkRanger(x, z)` walks him
  (input locked) to a framed beat's spot.
- *beats*: `searchBeat(k, step, …)`, `routeBeat(k, step, …)`, `choiceRun(k, step).ask(id,
  { show, wrong, right })` then `.done()`; `await k.fact(i)` shows the raaf's card.
- *plumbing*: `k.say(line)`, `k.wait(s)`, `k.until(fn, s)`, `k.onTick(fn)`, `k.own(obj)`,
  `k.check()` (throws `Aborted` when the child stopped the mission), `k.beat` and `k.stats`
  (read by `__ranger.adventure()` and golden), `k.hint(fn)` (golden's play hint: a 3D
  target to click or `{ walk: { x, z, r } }` to walk to).

**Rules**: a beat never pops an animal in view (the family lives at its home before and
after; `Residents.lay` walks them back or cuts out of view); one short line per beat
(≤ 7 words, read aloud once); every wrong answer gets a calm reaction in the world and the
same question again; `__ranger` reads only. `missions/<id>.places.ts` is chosen by
looking at the world and pinned by its test (dry heath, clear of paths, props, roamers and
the other markers).
