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
                        occluder fade (only the crowns between camera and ranger fade); a home
                        tree's branch stub (TreeStub) is part of its tree: drawn and faded with it
   world/Progress.ts    lasting per-mission tableau at a finished marker (onMissionComplete)
   world/Fauna.ts       Bram the warden (by the missiebord; turns to you when he speaks),
                        poacher, roaming animals
   world/Markers.ts     mission markers, missiebord, the hut's porch ring (once Bram told
                        about the young raaf), sit-spot, proximity, wayfinding
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
render3d/adventure/ run 6: a mission played IN the world as one adventure (see below)
   world/Residents.ts   the animals that live at a mission's home, before and after
engines/           the pure game logic (scoring, sequences, rules); no three.js; unit-tested
render2d/          the 2D floor per game (reduced motion / fallback)
content/veluwe.ts  missions, steps, animals, texts (Dutch, AVI M3/E3)
content/copy.ts    the copy deck: every word on the shared screens (HUD, cards, Pauze, hut,
                   Instellingen); screens.ts the title + maker, mentor.ts Bram + the lessons.
                   core/readlevel.test.ts lints all of it (≤7 words a sentence and a shown
                   line, no dash, no hype, no surname, one cast)
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
adventure/beats/         search.ts (zoeken), route.ts (corsi), choice.ts (rustkracht), aim.ts
                         (wisselen: aim a camera at one of two named places), callers.ts (simon:
                         animals at their own spots call, he calls back): the SAME trial builders
                         + pure runs as the 2D floor, played in the world (aim-math/callers-math:
                         the pure mapping, beats.test.ts); callers-glow.ts: a caller's warm light
                         in its own colours, its rim's shader on a material once however many
                         glows reach it (callers-glow.test.ts)
adventure/actors.ts      Actor: calm behaviours (idle, root, go, follow, look, sniff, lie) + a
                         procedural trot for static GLBs; actors-math.ts is the pure part
adventure/cover.ts       CoverField: instanced true-scale bracken, moor-grass, heather (3 draw
                         calls) that rustles and parts; cover-math.ts: line of sight, glimpse
adventure/decoys.ts      the zoeken look-alikes laid in a stand (dead bracken, a butterfly on a
                         foxglove, a stonechat, a nightjar): shared by the frisling and the ree
adventure/patches.ts     PatchField: look-alike rooting patches (corsi spots) + prints, or
                         mossy cushions in leaf litter (`look: 'moss'`, the squirrel's glade)
adventure/squirrel.ts    Squirrel (an Actor): the static squirrel mesh brought to life — dash-
                         stop-dash, spiral trunk runs, branch stubs, leaps, hiding round a
                         trunk, digging, an acorn in its mouth; squirrel-math.ts: the pure plans
                         (speeds, never at the lens, on the bark), squirrel.test.ts
adventure/places.ts      frames, headings, local↔world (pure)
adventure/missions/      one mission each: <id>.places.ts (pure, unit-tested: where it
                         happens), <id>.home.ts (the home's dressing), <id>.ts (the beats);
                         frisling (the wallow) and ree (the copse, the meadow, the hide)
world/Residents.ts       a home's animals: before/after state, spatial calls, borrow/release;
                         a `shy` resident slips into cover when he comes near (per state);
                         a home rests beyond 40-46 m, its small things (`env.detail(at)`:
                         look-alikes, route spots, prints) beyond 22-28 m of their own spot,
                         so a view over several homes stays under 150 draw calls
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
  blended hand-over; `await k.look(spot, line, hold, { turn })` is one calm look
  (binoculars) and back (`turn`: he ends facing it); `k.ui.watching(on)` draws a long
  watch through the glasses' two round lenses (the ree's hide; under the cards, no zoom).
- *walking*: `await k.walk({ name, to, r, line, doel, lead, quiet })` — the child walks
  himself; the chip names the goal in words, the arrow only after ~20 s without progress;
  with `lead` an actor follows (at his `side` if given, his walk capped at its `pace`) and
  hides when he runs; with `quiet` running says its line. An `include` with `r` keeps both
  his shoulders in a framed view.
- *the animals' bodies*: a rigged model (the roe) plays its own walk/graze/idle clips, the
  procedural trot is for the static meshes (the boar, the piglet). `await k.walkRanger(x, z)` walks him
  (input locked) to a framed beat's spot.
- *beats*: `searchBeat(k, step, …)`, `routeBeat(k, step, …)`, `choiceRun(k, step).ask(id,
  { show, wrong, right, walks })` then `.done()` (`walks`: the wrong answer's reaction walks
  the ranger, so the card makes way first and its line follows); `.still(id, { line, hands |
  feet, tempt, wrong, right })` plays an encounter with the BODY instead of a card (keep your
  hands off the animal, or your feet still: a reach is the wrong answer, the same moment comes
  back; the pure core is `beats/hold-math.ts`); `await k.fact(i)` shows the raaf's card.
- *the world*: `await k.act(label, line)` — one action button in the world (Space presses
  it); `k.daylight(k01, s)` turns the day (1 golden hour … 0 a readable blue night,
  world/Sky.ts + Daylight.ts; the end of the adventure hands the golden hour back);
  `k.ui.veil(text)` — time passes; `k.world.snapshot(cam, w, h, prepare)` — a photograph
  of the world through another camera (a camera trap's, taken inside a frame). A home may
  plant real forest trees (`Adventure.trees`) and keep a glade clear of them
  (`treeClearings`); the trees between a held lens and what it frames fade.
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
