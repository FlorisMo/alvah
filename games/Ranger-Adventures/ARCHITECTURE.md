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
The story order (`WorldSession.storyOrder`) puts the missions with an entry first: the
wayfinding chip, Bram's next step and the missiebord's "Nu doen" follow it; the markers
keep the area's layout. A home's clearings are its own ground: no other mission's staged
patch is laid there (`World.playClear`).

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
                         frisling (the wallow), ree (the copse, the meadow, the hide),
                         wildcamera (the crossing, the glade, the thicket, the snare; its
                         trap photos in wildcamera.photos.ts) and eekhoorn (the pines, the
                         moss glade, the neighbours): the four missions met first
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
- *walking*: `await k.walk({ name, to, r, line, doel, lead, quiet, tick, via })` — the child
  walks himself; the chip names the goal in words, the arrow only after ~20 s without
  progress; with `lead` an actor follows (at his `side` if given, his walk capped at its
  `pace`); when he runs it dives into a clump in his picture, its line on every run, and
  stays there until he has walked calmly back to it (a run never gains a metre); with
  `quiet` running says its line; `tick` runs each frame of the walk (the ree's pool reads
  his feet there); `via` names the way a perfect player walks round something (golden's
  hint only). An `include` with `r` keeps both his shoulders in a framed view.
- *the animals' bodies*: a rigged model (the roe) plays its own walk/graze/idle clips, the
  procedural trot is for the static meshes (the boar, the piglet). `await k.walkRanger(x, z)` walks him
  (input locked) to a framed beat's spot.
- *beats*: `searchBeat(k, step, …)`, `routeBeat(k, step, …)`, `choiceRun(k, step).ask(id,
  { show, wrong, right, walks })` then `.done()` (`walks`: the wrong answer's reaction walks
  the ranger, so the card makes way first and its line follows); `.still(id, { line, hands |
  feet, tempt, wrong, right })` plays an encounter with the BODY instead of a card (keep your
  hands off the animal, or your feet still: a reach is the wrong answer, the same moment comes
  back; the pure core is `beats/hold-math.ts`); `.answer(id, goed)` answers the next
  encounter from what his feet did on a walk (the ree's pool: a boot in the water, or round
  it dry), the same `DagnachtRun` trial; `await k.fact(i)` shows the raaf's card. The 2D
  floor plays every encounter as a card, in the same content order.
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

## Run 7: variety, growth, discovery

Every play of a mission is drawn from **one seed**, so no two plays are alike and any play
can be replayed; each breinkracht reads its difficulty from **knobs** that the 2D floor and
the world share; what he sees and hears goes into his **veldgids**; and the world stands in
a **mood** (time of day, weather). The contract (design: `design/run7-foundation.md` §4):

```
core/play.ts         Play { seed, missionId, n, rng(), pick, shuffle, chance, between, int,
                     fork(label), note(k, v), variant }; newPlay, nextPlaySeed (?seed=N → the
                     page session's plays are N, N+1, …), compactVariant
core/skill.ts        knobsFor(engine, level) / knobsFromDifficulty: ZoekKnobs · SpanKnobs (corsi,
                     simon) · RustKnobs (dagnacht) · WisselKnobs; BeatSummary's optional span,
                     start, rounds, eased, misses, seconds, hinted, impulses, holdS, switches …
core/state.ts        save fields geschiedenis (BeatLog[], newest 400), ontdekt, zeldzaam,
                     gespeeld, sfeer; store.logBeat(e, summary, { missionId, view, play }),
                     level(e), knobs(e), discover(id), notePlay, rareEnd, noteSession;
                     hydrate(parsed): any older save loads, new fields defaulted
core/discover.ts     rollRare (a seeded chance, the pity rule: a rare within ~3 won plays)
content/ontdekkingen.ts  ONTDEKKINGEN: { id '<home>.<thing>', home, soort (dier · zeldzaam ·
                     spoor · vondst · foto), naam, naamKnap?, hint (≤ 7 words), model? | icon?,
                     stemming?, geholpen? } — one block per home, each lane writes its own
render3d/Moods.ts    MoodId (gouden-uur · ochtendnevel · zonnig · bewolkt · schemer), playMood
ui/hud/Reveal.ts     "Nieuw in je veldgids!" under the top chips, one at a time, read aloud,
                     only at a quiet moment (ui/hud/reveal-queue.ts: the pure rules)
```

**The flow** (`ui/flow/MissionFlow.ts`): every briefing draws a play (`drawPlay`: the
session's next seed, `n` = plays started + 1, the play's mood, the rare roll) BEFORE the
home's `prepare(world, mission, play)` runs under the card; "Ga op pad" counts it
(`gespeeld`) and plays it; "Nog even rondkijken" drops it. Every logged beat goes through
`store.logBeat` with its play and view: `'world'` (an adventure), `'stage'` (a classic 3D
engine) or `'2d'` (a floor); the hut's care game logs `'2d'` without a play. The 2D floors
and the classic stages draw their corsi route, simon callers and wissel queue from
`play.fork('<engine>')`, as the world's beats will (the same seed, the same trial). A won
mission records its helped animal (`geholpen`) quietly, and the home's rare counter moves.

**The kit adds** (`k` in `play(k)`, all additive):

- `k.play` — this play's variety. Draw every choice from its own fork and note it:
  `const spot = k.play.fork('hide').pick(SPOTS); k.play.note('hide', spot.id)`. A home never
  calls `Math.random`; a fork's stream depends only on the seed and its label.
- `k.level(e)` / `k.knobs(e)` — where a breinkracht starts and the knobs its beat reads (the
  same knobs as its 2D floor). Map them onto the world (more fronds part for a bigger
  `glimpse`); never invent a difficulty number in a home.
- `k.discover(id, { quiet? })` — he really saw it (on screen, big enough, long enough) or
  heard it: recorded at once, a new one gets one calm reveal at the next quiet beat (a walk,
  a look, the ending). Returns whether it was new. `k.rare()` — this play's rare visitor for
  the home (rolled at the briefing), or null: show it, and discover it once he saw it.
- `k.mood` — the mood this play stands in (`world.mood()`: the session's and the one on
  screen; `Adventure.moods: { allow, perPlay }` lets a home ask for its own light); the end
  of the play hands the session's mood back.

**A home's recipe** (each game lane): (1) choose places by looking at the world and pin each
variant in `<id>.places.ts` + its test: dry, clear (`World.playClear`), inside its home, the
target partly visible from the framed view, and off centre (`offCentre(frame, p) ≥ 0.25`,
`adventure/places.ts`); (2) draw every choice from a fork of `k.play` and note it, laying
this play's version in `prepare(world, mission, play)`; (3) build trials from
`k.knobs(engine)` and the play's fork; (4) `k.discover(id)` when the thing was really seen or
heard, show `k.rare()` when set; (5) add the home's rows to `content/ontdekkingen.ts` (≥ 4,
≥ 1 `zeldzaam`); (6) optionally `moods` on the Adventure.

**Difficulty that grows** (package `adaptive`, design §5): the level (1-6) of each
breinkracht picks a ROW of its knob table (`KNOB_TABLES`, `knobsFor(engine, level)`, band =
`floor(level)`); a finished beat is judged by its own engine (`judgeBeat`: easy +1.0, fine
+0.34, steady 0, hard −0.5 silently) and never drops under `best − 1`. The span engines
(simon, corsi) are judged by what he echoed CLEANLY: easy = round 1 clean and a clean echo
past the start; fine = round 1 clean, or past the start after a slip in round 1; steady = a
slip, then back to the start but not past it; hard = never a clean echo of the start length
(a first-round slip is not a drop). A summary without
the engine's own fields (the hut's care game) keeps the old ±0.34 staircase. A level that
crosses a whole number marks the engine for the reward card's calm "Je … groeit." Inside a
beat the pure cores adapt, identically on the 2D floor, the classic stage and the world:

```
engines/span.ts      SpanRun<T>(knobs, next): ROUNDS for simon and corsi (SimonRun, CorsiRun
                     wrap it): clean → one longer (the same calls plus one for simon, a fresh
                     route for corsi), rescued → as long, 1st wrong → replay, 2nd → a fresh one
                     one shorter (silent 'ease'); always ends on his own echo. skin.rondes caps
                     the rounds for a story
engines/zoeken.ts    buildZoekenTrial(skin, knobs, rng): which look-alikes (count = lookAlikes),
                     the 2D layout (never within 15 % of the centre), haze = 1 − glimpse;
                     zoekSummary({ misses, seconds, hinted })
engines/dagnacht.ts  buildDagnachtTrial(skin, diff, rng) + rustOrder: skin.rustPlan [{ slot,
                     pick?, shuffle? }] over Encounter.slot (a flip never first, ≥ 1 kept, two
                     only from band 4); no plan = content order. ChoiceRun.next() / nextIn(slot)
beats/hold-math.ts   RustTempo: holdS from the band, −0.5 s after a reach (≥ 2.5), +0.5 s after
                     two clean holds (≤ band + 1), seeded temptations (never in the first 1.1 s)
engines/wisselen.ts  buildWisselTrial(skin, knobs, rng): sorts (skin.trials caps), flipEvery,
                     flips (a turn back to day from band 4, its gap one longer after a switch
                     error); summary { sorts, right first time, switches, switchErrors }
core/growth.ts       growthSummary(history, skill, now): the grown-ups' Groei panel (Instellingen)
```

A home reads `k.knobs(e)` (the beats do so by default: `searchBeat`'s `glimpse` and
`hintAfter`, `routeBeat`/`callersBeat` rounds, `choice.still`'s hold) and never invents a
number; the views' parity is pinned per engine in `render3d/engines/*.parity.test.ts`.

**Dev and tests** (read-only): `?dev=1&seed=N` replays a session's plays; `__ranger.play()`,
`history()`, `skills()`, `discoveries()`, `mood()`. Golden and `missions.spec` note each
play's seed and end a hard failure with `replay: /?dev=1&seed=<n>`.
