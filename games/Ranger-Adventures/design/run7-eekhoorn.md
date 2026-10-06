# Run 7 · EEKHOORN lane: "De verstopte nootjes", a different day in the squirrel's wood every time

> Lane lead's design, 2026-10-01. Base `run7/integration` @ 1941214 (run 6's result).
> Read GOAL.md, STATE.md (2026-10-01), CLAUDE.md, ARCHITECTURE.md (the adventure layer),
> design/run6-missions.md §4.4, the run's STRATEGY.md and **FOUNDATION's design
> (`state/foundation/design.md` §4: the run-7 contracts, §5.2: the span core)** first.
> This file is the contract my builders build to and I review against. Section 10 is the
> package plan. The final agent copies it to `design/run7-eekhoorn.md`.

## 0. In one paragraph (player terms)

Today the squirrel game is charming once and identical after that: the squirrel always
runs the same three pines, always hides round the same trunk, the moss patches lie in the
same pattern, the same jay, green woodpecker and raven sit on the same perches in a
picture that is pixel-for-pixel the same every play, the light is always the golden hour,
and the echo game is over after two calls. After this run, every visit is another day in
the squirrel's wood. It leads him a different way through the pines (left round the old
trees, along the middle, or right past the fallen wood), waits where he can see it, hides
round a different trunk, and when he finds it the camera shows it peeking at him, close.
In its glade it buries a first mouthful of acorns and forgets; he points them out; it runs
for a second mouthful, one more acorn this time if the first went well. Its neighbours
change from day to day (a great tit, a blackbird or a robin on the dead branch; a green
woodpecker, a drumming great spotted woodpecker or a nuthatch walking head-first down the
bark; a raven or a cuckoo on the snag), and the call-back game grows 2, 3, 4 calls while
the jay, the nut thief, backs off a step after every echo he gets right and flies away at
the end. Over weeks the squirrel buries longer rows and the choir starts longer. Each
visit he may find something for his field guide: the squirrel's nest, the gnawed pine
cones at its dining stump, the oak seedling where a forgotten acorn grew, and once in a
while a rare visitor: a dark-brown squirrel, or a young one hiding with ours. Calm,
never scary, no timers, no points.

## 1. What I found by playing (2026-10-01, 1941214, port 5550)

Played three times from fresh saves (one with a wrong pick and a wrong echo) and once from
a practised save (every breinkracht level 3.4), with real keys and mouse clicks at
1280×800 through the play hints, screenshots looked at side by side
(`state/eekhoorn/shots-design/`), and read eekhoorn.ts / .places.ts / .home.ts, squirrel*,
beats/route.ts, beats/callers*.ts, kit.ts, engines/corsi.ts + simon.ts, core/skill.ts.

**The same every play** (the timings of the three fresh plays agree within 3 s):
- The route: den on the home pine at the marker → dash 6.2 m to pine A (wait) → leap to B
  → leap to C (wait) → hide-and-seek round pine C → its glade. Same trees, same stubs, same
  direction (shot 1).
- The hide-and-seek tree (pine C) and its surroundings; only the side it starts on moves a
  little with where he stands.
- The corsi field: the seven moss cushions in the PRINT_SPOTS layout at one place, one
  look (PatchField seed 41); one route per beat.
- The neighbours and the callers' picture: jay on the store pine's stub, green woodpecker
  on its bark, raven on the snag, squirrel on its stump: **the CALLERS view is
  pixel-identical in all three plays** (shot 1, bottom row).
- The squirrel's own life (dash stops, idle plans) runs from a fixed seed (`seed: 11`).
- The light: the golden hour, always.
- The story beats and lines, in the same order with the same pauses.

**What varies today**: only the corsi route order and the simon callers
(`Math.random`), and those badly: the echo in play 3 was "gaai, gaai", the practised
play's 4-long echo used the green woodpecker three times running and never the squirrel.

**Too easy**: the echo (`simonLengte` = 2 at level 1: two calls, two clicks, ~7 s, done;
after it the level is 1.34 and the next play is two calls again); corsi 3 at level 1;
the follow and the hide-and-seek are play, not measured (fine as they are).
**Too abrupt**: a practised save (3.4) jumps straight to a 5-acorn route and a 2→3→4 echo.
**Too slow**: after recall the squirrel ferries each acorn to its store one by one:
**15 s** of watching at 5 acorns (practised play).
**Read instead of played**: nothing that is an answer: there are no cards in this
mission. The briefing (5 lines) and the two "Wist je dat?" facts are read (and read
aloud); every beat is walked or clicked.

**Readability (the open items, measured with the adventure's own `sightOf`)**:
- The first wait: after the den the squirrel dashes to pine A, **8.3 m from the marker
  ring**, and sits there ~20 px tall while he is still at the ring (shot 2). At the moment
  it runs on (he is within 2.2 m) it reads 39-41 px (`pijn-1_px` 41/39, `pijn-3_px` 39/35).
- A leap starts out of frame: leaving pine A it leaps sideways, at the picture's left edge
  (shot 3).
- **"Gevonden!" with the squirrel invisible**: in plays 1 and 2 the line came while the
  squirrel was a ~15 px dark knot at the trunk's edge (shot 5: I could not find it on the
  screenshot); `found_px` 49 counts its bounding box, tail and all.
- The den intro is fine (81 px, framed). The glade (corsi) view reads well (shot 6); the
  squirrel there is ~30 px, the spots are big and clear. The callers view reads (shot 7),
  except the raven: a black shape against the dark crowns.
- In one hide the trunk stood between the lens and the boy and covered half of him (play 3).

**Numbers**: whole mission 100-140 s for a perfect bot (~2.5 min for a child); max draw
calls 68-104 (the walk up past other homes), 37-44 in the framed beats; 0 page errors;
the walk hint at pine A re-issues 15-20 times while the squirrel sits its 1.2 s
(harmless, inflates test time).

## 2. The bar (what "done" means for this lane)

1. **Three plays in a row look and feel like three different days**: another way through
   the wood, another hide tree, another pattern of moss, other neighbours with other
   voices, another light; the familiar parts (the squirrel, its stump, its store, the
   story) stay, so it is still *his* squirrel.
2. **The echo grows and the squirrel buries more as he grows**, through FOUNDATION's knobs
   and span core only: never two calls and done; a practised save gets a visibly longer
   version of the same exercise.
3. **The squirrel is readable at every moment that matters**: at each wait, at each leap,
   and above all when it is found.
4. **Something to find on most visits**, a rare one within about three visits, all of it
   seen or heard in the world, never a prize.
5. Alvah's contracts unchanged; golden ALL GREEN; `missions.spec` eekhoorn green; the 2D
   floor ("altijd 2D", reduced motion) plays the same content with the same summaries.

## 3. Three plays in a row (what Alvah sees)

**Play 1** (fresh save, a misty morning). The squirrel sits on its stub by the marker; the
lens turns to it for one look ("Kijk, daar zit de eekhoorn!"). "Volg de eekhoorn." It runs
down and only ~5 m off, to a low stub on a pine **to the left**, beside the trunk against
the pale mist, flicks its tail and chatters until he is close; then two short hops on
(one a leap he sees all of), and it slips round **a thick old pine** to hide. He walks
round; when it is in his view the camera eases in: it peeks round the bark at him, close
and big: "Gevonden! Hij speelt verstoppertje." In the glade it fills its cheeks at the
store, buries 3 acorns, runs up its stump, "Oei, hij weet het niet meer!" He points them
out; it digs them up in one quick run. "Hij verstopt er nog meer." This time 4. Then the
neighbours: a **great tit** on the dead branch, a **green woodpecker** on the bark, a
**raven** on the snag. The jay glides down for the acorns; "Roep mee, dan gaat hij weg."
Two calls; he echoes them; the jay hops back a step. Three calls; it hops back again.
Four calls; it flies off. The squirrel eats an acorn on its stump.

**Play 2** ("Speel nog eens", a bright day). The squirrel leads **right**, past a fallen
trunk, to a pine whose low branch carries **its nest** ("Kijk, zijn nest!"), and hides
round a different pine where the ground drops away to the heath. The moss pattern in its
glade is mirrored. Its first mouthful is 4 now (he was clean last time). The neighbours
are a **blackbird** on the branch, a **nuthatch** walking head-first down the bark, and a
**cuckoo** on the snag: new voices, and he meets each one with a click before they call.

**Play 3** (overcast). The **middle** way again but not the same as play 1's. At the den a
**dark-brown squirrel** comes down the trunk above ours, the two spiral once round the
pine and the visitor bounds off: "Kijk, nog een eekhoorn!" (the rare, reveal at the next
walk). Pine cones drop "plof" from a pine he walks under. The neighbours: a **robin**, a
**great spotted woodpecker** drumming, the raven.

No two plays share their route, their neighbour trio or their light; each draw comes from
the play's seed, so `?dev=1&seed=N` replays a play exactly.

## 4. How it grows with him (over weeks)

All difficulty comes from FOUNDATION's `k.knobs('corsi')` / `k.knobs('simon')` (span core
`SpanRun`, design §5.2); this home never invents a difficulty number.

| his level (band) | squirrel's mouthfuls (corsi, 2 rounds) | the choir (simon) |
|---|---|---|
| 1 (first play) | 3, then 4 if clean (3 again if not) | 2 → 3 → 4 (3 rounds) |
| 2 | 3 → 4 | starts at 3, 3 rounds |
| 3 | 4 → 5 | 3 → 4 → 5 → 6 (4 rounds) |
| 4-5 | 4/5 → 5/6 | starts at 4 |
| 6 | 5 → 6 | starts at 5, up to 7 |

Corsi uses the skin's `rondes: 2` (two mouthfuls: the story's length; FOUNDATION §5.2
lets a skin set it, the 2D floor reads the same skin). What he notices: the squirrel
buries longer rows, the choir starts longer and grows further. A growth step gets the
reward card's calm line (FOUNDATION §5.8); an ease is silent. The beat log records each
beat with the play's seed and variant (`route:noord,veld:spiegel-u,buren:koolmees+boomklever+raaf`).

## 5. What he can discover here (the home's veldgids page) and small surprises

| id | kind | plain name (knap) | where / when it is seen | hint line (≤ 7 words) |
|---|---|---|---|---|
| `eekhoorn.eekhoorn` | dier | de eekhoorn (de rode eekhoorn) | the hero; recorded quietly when won (FOUNDATION §4.4) | Wie verstopt hier nootjes? |
| `eekhoorn.gaai` | dier | de gaai (de Vlaamse gaai) | the thief, every play | Wie wil de nootjes pikken? |
| `eekhoorn.groene-specht` | dier | de groene specht | a neighbour (stam slot) | Wie lacht er in het bos? |
| `eekhoorn.grote-bonte-specht` | dier | de bonte specht (de grote bonte specht) | a neighbour (stam slot) | Wie roffelt op een boom? |
| `eekhoorn.boomklever` | dier | de boomklever | a neighbour (stam slot), head-first down the bark | Wie loopt ondersteboven langs de boom? |
| `eekhoorn.nest` | vondst | het eekhoornnest (de kobel) | on one wait tree of the play's route | Waar slaapt de eekhoorn? |
| `eekhoorn.kale-kegels` | spoor | de kale dennenappels | its dining stump or log by the route | Wie heeft hier zitten smullen? |
| `eekhoorn.eikje` | vondst | het eikenboompje | in the glade on a later visit | Groeit er iets uit een nootje? |
| `eekhoorn.donkere-eekhoorn` | zeldzaam | de donkere eekhoorn | rare: at the den, a dark-brown visitor | Is elke eekhoorn rood? |
| `eekhoorn.jonge-eekhoorn` | zeldzaam | de jonge eekhoorn | rare: hiding with ours, shown when found | Wie verstopt zich nog meer? |

- The other neighbours (koolmees, merel, roodborst, raaf, koekoek) are recorded as
  `wereld.<id>` only when FOUNDATION's table has that row (they are free-roam birds too);
  no eekhoorn duplicates of them.
- **Neighbours are recorded quietly** (`{ quiet: true }`) in the meet beat: the meet itself
  is their reveal (light-up, call, "Dat is de boomklever."), and three new birds must not
  queue three cards at the reunion. The things he finds himself (nest, cones, seedling, the
  rares) get the calm reveal at the next quiet moment.
- **Rares** come from `k.rare()` (FOUNDATION's seeded roll + pity: within ~3 plays). Both are
  staged in a HELD frame where a squirrel is big (≥ 60 px): the dark one in the den look,
  the young one in the found view.
- **Small surprises** (P3, seeded, at most one per play, only during a walk): a pine cone
  drops "plof" beside his path; the jay buries an acorn of its own ahead of him and flies
  up; a drum roll from the glade when the great spotted woodpecker is today's neighbour.
- Never: counters, streaks, timers, "kom morgen terug", or a discovery as a reward for
  winning.

## 6. Technical approach

### 6.1 The play's draws (all from `k.play`, FOUNDATION §4.1)

Every choice comes from its own fork and is noted (`k.play.note(key, value)`), so adding a
draw never reshuffles another and a test can pin "seed 7 → route zuid":

| fork | draws | note key | never twice in a row |
|---|---|---|---|
| `route` | one of 3 routes (6.2) | `route` | yes: not the last eekhoorn play's route |
| `veld` | one of 4 field symmetries (6.4) + the PatchField look seed | `veld` | yes |
| `buren` | one bird per slot (6.5) | `buren` | at least one slot differs from last play |
| `squirrel` | the Squirrel actor's life stream (`reseed`) | — | — |
| `cosmetic` | nut spin, earth puffs (today `Math.random` in eekhoorn.home.ts) | — | — |
| `nest`, `kegels` (P2) | which wait tree carries the nest; which dining spot | `nest`, `kegels` | — |
| `antics`, `den`, `verrassing`, `verstop2`, `einde` (P3) | 6.8 | same | — |

"The last play's X" is read from the newest beat-log entry of mission `eekhoorn` (its `va`
string, FOUNDATION §4.3) through a pure helper `lastVariant(history, 'eekhoorn')` in
`eekhoorn.places.ts` (tested); FOUNDATION may expose its own read: then use that. A fresh
save draws freely. **No `Math.random` anywhere in `missions/eekhoorn.*`** (a grep in review).

The draws that change the world before the mission (the neighbours on their perches) are
laid in `prepare(world, mission, play)` under the briefing card; the rest are drawn at the
start of `play()` from the same play.

### 6.2 Routes: three ways through the wood (P1)

`eekhoorn.places.ts` gains `ROUTES: Record<'midden' | 'noord' | 'zuid', Route>`:

```ts
interface Route {
  id: 'midden' | 'noord' | 'zuid';
  /** the hops in order from the home pine: a dash over the ground or a leap, and whether it waits there */
  hops: { tree: HomeTree; how: 'dash' | 'leap'; wait: boolean }[];
  /** the tree it plays hide-and-seek round (its last wait) */
  hide: HomeTree;
}
```

- `HOME_TREES` = the home pine + every route's trees + the glade oak + the store pine; the
  forest plants them all (they stand in every play; only the squirrel's way changes).
- **Zones** (world x/z; the builder chooses each tree by looking at the world and pins it):
  - `midden`: today's line (pines A (20.5, −48.6), B (17.0, −48.2), C (15.6, −51.0)), with a
    new first wait so it is near the ring (below).
  - `noord`: a west/north arc, roughly (21.5, −45) → (18, −44.5) → (14.5, −46.5) → hide
    near (11.5, −51.5); the walk into the glade comes from the north.
  - `zuid`: an east/south arc, roughly (24.2, −47.6) → (22.6, −51.6) → (21.4, −55) → hide
    near (21.6, −58.3); the walk into the glade comes from the east.
  - All: in `bos`, ≥ 8 m from every other marker (nachtronde (20.8, −34.2), vos (35.8, −45.6)),
    off the sand paths, outside the glade's tree clearing ((12.0, −60.1) r 7) and the lens
    room ((16.97, −55.34) r 4.2), clear of the scatter trees ((14.4, −39.3), (6.9, −41.9),
    (29.8, −47.7), (31.9, −48.7)).
- **The readable follow** (each rule a places test, per route):
  - the **first wait ≤ 6.0 m** from the marker (today 8.3 m); every later wait ≤ 6.5 m from
    the one before; the whole way 14-26 m; 2-3 waits; 0-2 leaps;
  - a **wait stub sits beside its trunk** as he comes: its heading 45-75° off the line back
    to where he comes from (left and right alternate along a route), so the squirrel's
    outline is against the wood behind, not against its own dark bark; low (`WAIT_H`
    0.9-1.2 m); the existing tests (in the lens over his shoulder, a child walking straight
    at it is right at it) hold for every wait of every route;
  - a **leap** only between trunks ≤ 3.6 m apart, **forward**: within ±45° of the direction
    from the wait before it to the leap's landing tree, never toward the lens; no other
    home trunk within 1 m of a leap's line;
  - the next wait is never hidden by a trunk from the spot he sees the previous one from.
- `introView(me)` (the den look) chooses its side by the route's first wait (today by
  `PINE_A`).
- At runtime: before it runs on from a wait, the squirrel waits (≤ 3 s) until it is
  inside the middle 80% of his picture (`sightOf(...).glimpse` and `|x| ≤ 0.8`), so a
  leap or dash always **starts in his view**; a stat `leap_out` counts leap frames whose
  first 0.3 s were outside it (want 0).
- New stats per wait: `<wait>_arrive_px` (when it sits down) and `<wait>_px` (when it sets
  off, exists). Targets: arrive ≥ 22 px, set off ≥ 40 px.

### 6.3 Hide-and-seek per route and the found view (P1)

- `HIDE_TREE`, `HIDE_AVOID`, `hideFrom`, `hideStart`, `hideShift`, `roundStep`, `wayTo`
  take the route's hide tree as an argument (today they hard-code `HOME_TREES[3]` and
  `STUMP`); `eekhoornTreeClear()` and `eekhoornClearings()` keep a 4.6 m tree-free ring and
  a 4.2 m fern-free ring round **every** hide tree. The existing hide tests run for each of
  the three hide trees.
- **The found view** (new, pure `foundView(tree, sqAng, me)` in places.ts): when found, he
  stops (`lockFollow`, as today), and the lens eases (≤ 90°/s, 1.2-1.4 s; a cut under
  reduced motion) to a held view on HIS side of the tree: the lens 2.4-2.8 m from the
  squirrel at about its height (`HIDE.h` 1.05 m + 0.2), turned 25-35° off the line from him
  to it so his head is not in front, `include` his spot (h 1.32, r 0.25) at the picture's
  side, the squirrel ≥ 0.25 of the half-width off the centre (FOUNDATION's `offCentre`).
  In it the squirrel peeks its head round the bark, then comes out onto the near face of
  the trunk, flicks its tail and chatters; **"Gevonden! Hij speelt verstoppertje." is said
  once the lens has settled and it is out** (`found_px` ≥ 60, the stat measured then).
  Then it pours down the bark, pops up in front of him (today's pop), and runs off toward
  the glade; `k.free()` hands the follow camera back. This is the beat's one reframe.
- The trunk covering the boy (play 3): with each hide tree, check that the walk round it
  never leaves the trunk between the follow lens and more than a third of him for long
  (the rig's fade); if it does, move the hide tree's clear ring or its `OUT_R`.

### 6.4 The glade: four patterns of moss, two mouthfuls (P1)

- **Field symmetry** (`veld` fork): `gladeSpots(sym)` maps each PRINT_SPOTS spot through one
  of `'recht' | 'spiegel-u' | 'spiegel-v' | 'om'` (identity, mirror left-right `u → −u`,
  mirror front-back `v → −v`, both = 180°) around the layout's own centre, then scales and
  places it as today (`SPOT_SCALE` 0.05, `SPOTS_AT`). All four are congruent with the
  2D floor's layout (the same inter-spot distances), so the exercise is the same; the
  field stays inside `GLADE_VIEW`, every spot ≥ 0.7 m from the stump and the heap, all
  seven in the view at every symmetry (a places test per symmetry). `PatchField`'s `seed`
  comes from the `veld` fork (each cushion's look changes too).
- **Two mouthfuls** (corsi rounds): the skin gets `rondes: 2` (content/veluwe.ts, the
  corsi step of MISSIE_EEKHOORN); FOUNDATION's `routeBeat` runs `SpanRun` rounds. The
  eekhoorn passes (shared beat, additive options, see 6.9):
  - `visitEach: true`: **every round's first show** is the squirrel's visits (today only
    the first show): it takes acorns from the store (`carry(true)`), dashes to each spot of
    the round and digs one in (the spot glows from its arrival through the dig, as today).
    **≤ 2.0 s per spot** (dash ≤ 1.0 s, dig 0.8 s, 0.2 s). A replay or an ease (after a
    wrong pick) is the spots glowing in order with today's timings ("Hier niet. Kijk nog
    een keer." either way: an ease is silent).
  - `between(round, spots)`: after a round's recall, the squirrel's **quick sweep**: it
    dashes to each found spot, digs the acorn up (0.35 s), and dumps them all at the store
    once (cheeks full; the heap grows one cluster per round): ≤ 1.0 s per acorn + 1.5 s;
    then "Hij verstopt er nog meer." (new copy line, read aloud) and the next show.
  - After the last round: "Alle nootjes gevonden!" and the same quick sweep (replaces
    today's 15 s one-by-one ferrying).
  - The picked feedback stays: it dashes to a right spot, sniffs, flicks its tail (here!);
    at a wrong spot it sniffs and shakes its head.

### 6.5 The neighbours, the thief and the growing echo (P1)

**The jay is the thief, not a caller.** It waits on the glade oak's low stub before the
mission (out of the corsi and callers views), glides down by the heap when "Kijk, de gaai
wil de nootjes!" (into the picture from its side, never toward the lens), and **backs off a
step after every round he echoes**: `JAY_RETREAT` (places.ts, pinned): ground by the heap →
0.6 m back on the leaf litter → onto the snag's root → flies off after the last round
("De gaai vliegt weg."). It moves only between rounds (never during listening or echoing),
with one short jay call; it is not a click target.

**The callers = the squirrel on its stump + three neighbours in three slots**, each slot
drawn from its pool (`buren` fork):

| slot | perch (today's, pinned) | pool (call: family) |
|---|---|---|
| `tak` | the dead stub of the store pine, 1.75 m, sitting upright | koolmees (synth "ti-ta": pomp), merel (recording: fluit), roodborst (recording: zang) |
| `stam` | the store pine's bark, 1.2 m, side-on to the lens (today's woodpecker) | groene-specht (recording: lach), grote-bonte-specht (NEW synth drum: roffel), boomklever (NEW synth rising whistle "tuuit" ×3: fluitje; it clings head-down) |
| `top` | the snag's top, 1.75 m (today's raven) | raaf (recording: kras), koekoek (recording: koe-koek) |

- 18 trios; the pair koolmees + boomklever is excluded (two short repeated tit-like notes);
  every trio's four call families are distinct (a pure `NEIGHBOURS` table + `drawNeighbours
  (fork, last)` in places.ts and a test that enumerates all trios). At least one slot
  differs from the last play's trio.
- New birds: `AnimalScale.SIZE` rows for `boomklever` (h ≈ 0.14), `grote-bonte-specht`
  (≈ 0.23), `roodborst` (≈ 0.14) with their real sizes and a `why`; each model looked at
  close: a perch block in the GLB is cut with `clipBelow` as for the green woodpecker; each
  sets `userData.perch` (the hint probe); colours readable in every allowed mood. New synth
  motifs in `core/sound.ts` `CALLS` for `grote-bonte-specht` and `boomklever` (additive).
- `EekhoornHome.setNeighbours(trio)` lays the play's birds in `prepare` (under the card,
  the glade is ~20 m from the marker): spawns the three (lazily, at most 4 birds at once
  with the jay), disposes the others; free roam before any play shows koolmees + groene
  specht + raaf; after a play its trio stays.
- **The meet beat** ("Wie woont hier? Tik op elk dier.") meets the three neighbours (one
  click each: light-up, call, "Dat is de boomklever."); new lines `isKoolmees`, `isMerel`,
  `isRoodborst`, `isBonteSpecht` (knap: "Dat is de grote bonte specht."), `isBoomklever`,
  `isKoekoek` (≤ 7 words, read aloud); each recorded quietly (P2).
- **The echo** (`callersBeat(k, 1, { callers, dieren, between, ... })`): FOUNDATION's
  `SpanRun` rounds from the knobs; `dieren` = the world's four (the squirrel + the trio);
  `between(round, of)` plays the jay's retreat. **Each call snippet is held to 0.6-1.2 s in
  this beat** (a cap passed to `Sound.callAt` / `callDur`, additive), so a blackbird's long
  song and a great tit's short pump give the same listening tempo whichever trio came.

### 6.6 Moods (P1)

`moods: { allow: ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt'], perPlay: true }` on the
Adventure (no `schemer`: a red squirrel is in its drey by dusk). The follow waits, the
glade field and the callers are checked in all four (screenshots per mood). If FOUNDATION's
`dressAnimal` lands (moods), the home's own raven darkening (`#35343a` + emissive in
`eekhoorn.home.ts bird()`) and its feather glow go **in the same commit**: one root.

### 6.7 Discoveries and rares (P2)

- Rows of section 5 in `content/ontdekkingen.ts` (the eekhoorn block).
- A small `seenFor(k, target, id, { px: 40, secs: 1, within })` helper in eekhoorn.ts: while
  the target's bounding box is on screen ≥ `px` tall, inside the picture, not behind a home
  trunk (the adventure's `lineClear`), accumulate time; at `secs` → `k.discover(id)` once.
- **The nest** (`nest` fork): on one wait tree of the play's route, 2.1-2.5 m up on the side
  he comes from; a procedural drey (a rough ball of twigs and dry leaves, ≈ 0.45 m, one
  mesh, ≤ 800 tris, part of the home's group, its look seeded). At that wait the squirrel
  first runs up into it and peeks out, then comes down to its stub: "Kijk, zijn nest!"
  (new line); discovered when seen.
- **The gnawed cones** (`kegels` fork): on one of 2 dining spots per route (a stump or a log
  end by the way), 6-10 cone cores and loose scales, instanced (≤ 2 draw calls); discovered
  when he is within 5 m and it is in view ≥ 1 s at ≥ 30 px across.
- **The seedling** (`eekhoorn.eikje`): today's after-visit seedling (`SEEDLING_AT`),
  discovered when he is within 6 m of it and it is in view ≥ 1 s in free roam: the home
  needs a recorder outside a mission, so `DressingEnv` gets an optional `discover?(id)`
  wired by `world/Residents.ts` to the same record-and-reveal as `k.discover` (additive).
- **Rare: the dark squirrel** (`k.rare()?.id === 'eekhoorn.donkere-eekhoorn'`): a second
  `Squirrel` made by the home for this play only (disposed after), coat a dark chocolate
  brown with a lighter belly, still brown (not black) in every allowed mood (FOUNDATION's
  luma floor on its own pixels: p10 ≥ 22, median ≥ 40). In the den look it comes down the
  trunk above ours, they spiral once round the pine (≤ 1.6 s, never toward the lens), it
  bounds off away from the route; "Kijk, nog een eekhoorn!"; discovered in the held view.
- **Rare: the young squirrel**: in the found view a young one (0.7× size, the same coat)
  peeks round the bark beside ours: "Gevonden! En nog een kleintje!" (the found line of
  that play); then it runs up out of view and is removed; discovered in the held view.
- The neighbours recorded quietly in the meet beat (5).

### 6.8 The squirrel's day: antics and surprises (P3)

- **Antics at each wait** (`antics` fork, none twice within a play): kijken (today), poetsen
  (grooms its tail through its paws), knabbelen (holds a cone, scales fall), zonnen (flat
  along the branch, legs dangling: only `zonnig` / `gouden-uur`), mopperen (tail flicks,
  foot stamps, a chatter burst). Each 1.5-3 s, played while he comes; it still runs on as
  soon as he is close.
- **The den** (`den` fork): on its stub (today), head-down on the trunk, nibbling at the
  pine's foot, or a spiral run up the trunk as he arrives.
- **One surprise per play at most** (`verrassing` fork, ~2 in 3 plays, only during a walk,
  never during a framed or measured beat): `denappel` (a cone drops "plof" 1-2 m beside his
  path from a pine he passes under and bounces once), `gaai` (the jay on the ground ahead
  pushes an acorn into the moss, looks at him, flies up to the glade oak: "De gaai verstopt
  ook nootjes!"), `roffel` (when today's `stam` bird is the great spotted woodpecker: a drum
  roll from the glade during the last walk).
- **A second hide** (`verstop2` fork, ~1 in 3 plays): after the found view it dashes to a
  close second pine and hides once more ("Nog een keer!"), a short one (`HIDE.most` 1).
- **The ending** (`einde` fork): eats an acorn (today), or buries one last acorn by the stump
  and pats it down, or grooms on its stump with its tail curled.

### 6.9 Shared files (additive only; every change listed in the builder's report)

| file | change | default keeps today |
|---|---|---|
| `adventure/beats/route.ts` | `visitEach?: boolean`, `between?(round, spots): Promise<void>` | yes |
| `adventure/beats/callers.ts` | `dieren?: readonly string[]`, `between?(round, of): Promise<void>`, `callCap?: [min, max]` | yes |
| `core/sound.ts` | `CALLS` rows `grote-bonte-specht`, `boomklever`; an optional max length on `callAt` / `callDur` | yes |
| `render3d/AnimalScale.ts` | `SIZE` rows `boomklever`, `grote-bonte-specht`, `roodborst` | yes |
| `adventure/squirrel.ts` | `reseed(seed)`; coat tint + scale options (P2); antic plans (P3) | yes |
| `world/Residents.ts` | `DressingEnv.discover?(id)` (P2) | yes |
| `content/ontdekkingen.ts` | the eekhoorn block (P2) | — |
| `content/veluwe.ts` | MISSIE_EEKHOORN only: `rondes: 2`, new `avontuur` lines | (lane-owned) |

`callersBeat` is shared with the wildcamera lane (its P1 also adds options there, e.g. a
`roepPool`): keep each option independent; the lander merges.

## 7. Construct parity (why the world and the 2D floor still measure the same thing)

- **Geheugenkracht (corsi)**: the same `SpanRun` and the same seeded `next` (FOUNDATION),
  the same knobs, `rondes: 2` from the same skin in both. The world's seven look-alike moss
  spots are the PRINT_SPOTS layout scaled uniformly under one of four congruent symmetries
  (the same distances, the same configuration as the 2D field). The world's first show of
  each round is the squirrel's visits (≤ 2.0 s per spot against the 2D floor's 0.8 + 0.35
  s): the deviation run 6 accepted, now capped; replays and eases use the 2D timings. The
  sweep between rounds is feedback, never input. One summary, logged once (`k.log`).
- **Echokracht (simon)**: the same `SpanRun` with the appending `next` from the play's
  fork, the same knobs and rounds. Four callers in both (the world: the squirrel and the
  drawn trio, four distinct call families at four distinct places, all in view the whole
  beat; the 2D floor: the content four `['eekhoorn','gaai','groene-specht','raaf']`, which
  stay as they are). Calls clamped 0.6-1.2 s, so the listening tempo does not depend on
  which birds came; light-up with each call (plays muted). The jay is not a caller and moves
  only between rounds. One summary, logged once.
- Variety (route, hide tree, field symmetry, neighbours, mood, nest, rares, antics,
  surprises) only changes *where* and *what it looks like*, never a knob.

## 8. Pitfalls (found while scouting; builders read these)

1. Pine C, its neighbours and the stump are hard-coded in the hide logic (`HIDE_TREE =
   HOME_TREES[3]`, `HIDE_AVOID`, `roundStep(TREE.c, …)`, `hideStart(…, STUMP)`) and the den
   look aims by `PINE_A`: generalize, do not copy per route.
2. `EekhoornHome` uses `Math.random` (nut spin, earth puffs) and the squirrel actor a fixed
   `seed: 11`: both from the play.
3. Today's simon supplier repeats freely ("gaai, gaai"; the woodpecker three times
   running): FOUNDATION's `next` fixes it; check a 4-6 long echo in the world uses the
   squirrel and every neighbour.
4. The walk hint at a wait re-issues every ~0.2 s while the squirrel sits its 1.2 s: harmless
   but slow in tests; keep `SIT` and the hint as they are unless a test times out.
5. The callers' hint probe checks each target sits on its perch (`userData.perch`,
   `bottomGap`): every new bird sets it (`perchOf`).
6. The raven is darkened by the home itself (#35343a + emissive): once FOUNDATION's
   `dressAnimal` lands, one root, delete the home's.
7. The CALLERS view must keep all four callers and the jay inside the picture, none behind
   a trunk, each ≥ 56 px as a click target, at every trio (a places test per trio and slot).
8. The jay's new waiting perch (the glade oak's stub, `g(8.0, 2.6)`) must stay out of
   `GLADE_VIEW` near the spots (no bird sitting in the corsi picture's middle).
9. `GLADE_VIEW` cuts the boy at the left edge to his head and shoulders: a mirrored field
   must not make that worse.
10. Golden plays the frisling only; the eekhoorn's real-input check is
    `npx playwright test e2e/missions.spec.ts --grep "verstopte"` (with `RANGER_PORT`).
11. With `perPlay` moods a fresh-save test sees a drawn mood here (not the golden hour):
    a failing run prints its seed (`?dev=1&seed=N` replays it).
12. Do not edit `src/` while golden or missions.spec runs in the same worktree.

## 9. What I will check when reviewing a package

Always: `RANGER_PORT=<p> npm run gate` tail; `RANGER_PORT=<p> npm run golden` table (ALL
GREEN); `npx playwright test e2e/missions.spec.ts --grep "verstopte"` (and the 2D floor
under "altijd 2D"); the unit tests it adds; draw calls < 150; no `Math.random` in
`missions/eekhoorn.*`; every new string ≤ 7 words and read aloud; the shared-file list.
Then I play it myself, **three plays in a row** (fresh save, then "Speel nog eens" twice)
and once from a practised save (levels 3.4 seeded), at 1280×800 with real keys and mouse,
and look at my screenshots side by side: if two plays look alike, it is not done.

## 10. Package plan

| id | what the player gets | depends on |
|---|---|---|
| `ek-variety` | **the named complaints**: three ways through the wood, three hide trees, four moss patterns, 18 neighbour trios, a light per play; the echo grows 2 → 3 → 4 while the jay backs off; two mouthfuls of acorns; the readable follow (first wait near, leaps in view) and the found view | contracts (implied), `foundation:adaptive` |
| `ek-finds` | the reason to come back: the home's veldgids rows, the nest, the gnawed cones, the seedling found later, the two rares staged where they read, neighbours recorded | `ek-variety` |
| `ek-day` | the squirrel's personality: antics at each wait, the den's opening, one small surprise per play, a second hide now and then, three endings | `ek-finds` |

Priority if time runs short: `ek-variety` (the owner's complaints) > `ek-finds` > `ek-day`.
