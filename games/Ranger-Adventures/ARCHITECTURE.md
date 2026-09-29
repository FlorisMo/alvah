# Architecture: where the code lives

> The map for `app/src/`. Read [GOAL.md](GOAL.md) and [STATE.md](STATE.md) first.
> Stack: vanilla three.js + Vite + TypeScript, no framework. Entry: `app/src/main.ts`.

## The big picture

```
main.ts ── boot veil + Stage (renderer, loop) ─► ui/Missions.ts → WorldSession.bootWorld:
                            the ONE world, built at boot, shown as the title and the ranger
                            maker (world/Presenter.ts), never torn down
                            │
          ui/flow/WorldSession.ts   builds the World, runs free roam, returns from missions
          ui/flow/MissionFlow.ts    briefing → steps (mini-games) → reward → clue → back
          ui/hud/ExploreHud.ts      pill, waypoint chip, ONE proximity prompt, the "?" card
          ui/hud/Lessons.ts         the first minute: Bram's beats + the lessons, one at a time
                                    (rules: core/lessons.ts; words: content/mentor.ts)
          ui/hud/Speaker.ts         Bram's speaker strip: one line at a time, read aloud
          ui/hub/Hub.ts             pause, missiebord, sporenboek (clue board), badges
          ui/keys.ts                Enter/Space = the one visible primary button, Esc = back
          ui/dev/wireDevhook.ts     connects window.__ranger read-backs
                            │
render3d/World.ts  (≈700 lines) the composer: builds the world/ modules, calls update(dt),
                   exposes the public API the flow uses, and ctx() for the mini-games
   world/Terrain.ts     THE ground: mesh, terrain.y(x,z), biome, intersectRay. One truth.
   world/Dressing.ts    grass + wind, water, paths, cabin, landmarks, props, collision list
   world/Forest.ts      every tree: instanced real GLBs per distance level (Lod.ts), per-tree
                        occluder fade (only the crowns between camera and ranger fade)
   world/Progress.ts    lasting per-mission tableau at a finished marker (onMissionComplete)
   world/Fauna.ts       Bram the warden (by the missiebord; turns to you when he speaks),
                        poacher, roaming animals
   world/Markers.ts     mission markers, missiebord, sit-spot, proximity, wayfinding
   world/Vehicles.ts    jeep, helicopter + pads, dust
   world/Player.ts      the ranger rig, on-foot movement, footsteps
   world/CameraRig.ts   follow camera (told by the player's steering, never chasing), orbit,
                        clear-view search, occluder-fade decision, reframes, the hand-over
                        from a presented shot
   world/Presenter.ts   the title and the maker as shots of the spawn clearing (the world
                        frozen like an activity), glides between them, the ranger's turns
   RangerLook.ts        paints the avatar maker's choices onto the ranger GLB
   world/Labels.ts      the name-tags: only the next mission / board / near ones, hidden
                        behind buildings, never overlapping, faded at the screen edge
   world/Sky.ts, props.ts, DevReadback.ts
                            │
render3d/play/     the mini-game kit: stage.ts (a per-step staged patch), spawn.ts
                   (spawnModel/spawnPlant: the world's own GLB animals and plants),
                   kit.ts (pick3d, prompts, reframes, play-hint channel), types.ts (WorldCtx)
render3d/engines/  one 3D view per mini-game (zoeken, corsi, dagnacht, simon, wisselen, roep)
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
