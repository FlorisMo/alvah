# Run 7 · REE lane: "Het reekalf in het gras", a different morning every time

> Lane lead's design, 2026-10-01. Base `run7/integration` @ 1941214 (run 6's result).
> Mission id `ree-niet-aanraken`. Read GOAL.md, STATE.md (2026-10-01), the game's
> CLAUDE.md, ARCHITECTURE.md (the adventure layer and the kit), `design/run6-missions.md`
> §4.2 and the run strategy (`state/STRATEGY.md`, run decisions 1-8) first.
> FOUNDATION's `state/foundation/design.md` is authoritative for the contract names
> (`k.play`, `k.level`/`k.knobs`, `k.discover`, `k.rare`, `k.mood`, the beat log, the dev
> seed); where it renames something, use its name. This file is the contract the builders
> build to and the lead reviews against. The final agent copies it to `design/run7-ree.md`.
> Screenshots of what I found: `state/ree/shots-design/1-8*.jpg`.

## 0. In one paragraph (player terms)

Today the reekalf is a lovely little story that is exactly the same every time: the doe at
the same bush, five metres of prints, the calf in the same spot in the middle of the picture
(found in 4-6 s), two "hands still" moments and a card in the same order, a pool two metres
ahead, a watch that holds one line for 16 s, and a small, far reunion. After this lane the
story stays (find the calf, leave it be, hide, watch the mother come back), but the
**place changes**: the doe lays her calf in one of three different stands of tall grass
round her copse, approached along a different trodden path, searched from a different
side, watched from a different hide. Inside the grass the calf lies in one of four spots,
never in the middle of the picture. The calm moments come in a different order, the pool
lies on the way in or on the way out, and the boy now does all five with his body
(the calf stands up wobbly and he keeps his hands still; the mother is back and he walks
quietly away himself). It grows with him: a practised ranger sees less of the calf among
more brown look-alikes, holds still longer while the calf tempts him twice, and waits out
a more careful mother. And there is always something to notice: a woodlark rising, a
buzzard, a cuckoo the doe turns her head to, a sapling a roebuck rubbed, and once in a
while twins.

## 1. What I found (scouted 2026-10-01, run7/integration @ 1941214, port 5530)

Four full plays at 1280×800 with real keys and clicks (my Playwright player walking by the
play hints, clicking the hint targets, answering the cards): three from fresh saves (one
with a child's mistakes: a click in the grass, a reach, "Pak het op", straight through the
pool, a step in the watch, "Blijf staan"), one from a practised save (zoeken 4.4, dagnacht
4.2, all four adventures done). Plus the frisling's search for comparison. Screenshots
looked at side by side.

**The same every play** (all four plays, to the centimetre):
- The calf lies at (−13.84, −36.15) (content `doel` 48, 60); in the search view its glimpse
  point is at (657, 352-363) px: 41-47 px from the centre of the screen. Found in 4-6 s
  (`search_seconds` 4, 6, 4, 6). Shot 1.
- The doe grazes at (−6.37, −34.81) and slips into the copse by the same gap; the opening
  look always frames her by the same juniper, the pool as a blue blob in the foreground
  (shot 8).
- The calm moments: `aai` (hands), `geur` (hands), `oppakken` (card), `modder` (feet, pool),
  `moeder` (card): same order, same staging every time.
- The walks: to the grass 4.9-6.7 m (~3 s), to the hide 9.5-11.2 m (~5 s) with the pool
  2.5 m ahead of him when the walk starts (shot 5). The owner's "1-2 s" is about right.
- The watch: 26-31 s, of which ~16 s on one line, "Daar is de moeder!" (shot 6). The
  reunion: the doe ~150 px tall inside the binocular vignette (shot 7).
- Beat timings (clean play): look 7 s · walk 5 s · she slips away 5-6 s · search 8-10 s ·
  fact · aai 7-9 s · geur 10-12 s · card 2-8 s · leave 3 s · hide walk 8-11 s · watch
  26-31 s · card 4-10 s · reunion 7 s. Whole play ≈ 2 min.

**Too easy**: the search (dead centre, the same spot; a returning child knows where to
click before the view settles). The hold moments: 4 s of nothing, identical every time.

**Too hard / unclear**: nothing blocks. Walking straight at the hide plashes into the pool
and walks him back out, again and again (by design; my walker that never turned took 46 s):
a child gets it after one or two, but the second plash should show the way round.

**Read instead of played**: `oppakken` and `moeder` are cards. The watch is watched, not
played (only a step key matters).

**The camera** (the owner: "the ree search camera hangs too high"): the search lens is at
pitch 38°, 3.4 m over the ground, 2.25 m behind him: we look down on the top of his blond
head and one shoulder, which fill the lower right (avatar `heightFrac` 0.23), and the tall
grass fills the picture edge to edge, so it reads as a carpet with a head in it (shot 1).
The frisling's search (shot 2) reads better: a compact stand with open heath round it,
the boy small in a lower corner seen from behind. The close view by the calf is worse:
pitch 52°, his head ~250 px wide over a third of the picture (shot 4).

**The practised save** looked the same: the same spot, the same glimpse (`glimpse` 0.4),
8 look-alikes instead of 5 (hard to notice), the same holds and watch (shot 3). Today the
only difference is the decoy count and fainter prints.

## 2. The bar (what "done" means for this lane)

1. **Three plays in a row feel like three different mornings**: a different stand of grass
   reached along a different path, a different hide picture, the calf somewhere else,
   the calm moments in a different order. Measured: the search screenshots of three
   consecutive plays in one save differ in layout and spot.
2. **The calf is never in the middle of the picture**: its glimpse point outside the
   central box (|dx| ≥ 160 px or |dy| ≥ 110 px from (640, 400) at 1280×800), never under
   the objective line (y ≥ 120 px), ≥ 90 px from the screen's edges.
3. **The search reads like the frisling's**: the boy whole, small, seen from behind in a
   lower corner on open heath; the grass reads tall, with its rim and the heath and the
   copse beyond.
4. **Every rustkracht moment is played with the body**; the 2D floor still asks them as
   cards.
5. **It grows with him and the exercise stays the same exercise**, measured the same way.
6. **There is always something to notice**, never pressure.
7. Alvah's contracts (STRATEGY): calm camera, never scary, ≤ 7 words a line read aloud,
   ≥ 56 px targets, < 150 draw calls and < 1M triangles in every beat, laptop first, iPad
   touch works, save data only via `core/state.ts`, golden green, every beat playable by
   the play hints with real keys and clicks.

## 3. Three plays in a row (after all three packages)

**Monday, play 1 (fresh save, misty morning).** At the ring he sees the doe grazing out on
the heath north of her copse. One look, "Kijk. Daar eet de moeder." Her slots run west
along a worn path, then bend south round the tall grass (~12 m). Halfway a woodlark flutters
up out of the heather and hangs singing in the air. As he sets off the doe lifts her head
and walks into the copse through the gap on its west side. At the grass the lens settles
low behind him: a stand of pijpenstrootje with heath round it, the copse beyond. The calf
lies in the back-right part of the grass, a bit of its spotted back between the stems
among five look-alikes. Found. Then, by the calf: it stands up on wobbly legs and totters
toward him, peeping ("Het kalf staat op. Handen thuis."); it lies down again. It peeps at
his boots (hands still). It stretches its nose to his hand (hands still). He walks away
quietly; a pool lies across the way to the hide under the birches; round it. The watch:
the bracken stirs, the doe steps out, stops, listens; a cuckoo calls and she turns her head
to it; two bites of grass; she walks to the grass and calls softly; the calf comes out to
her. "Mama is terug. Loop stil weg." He walks away himself, turns at the path, and through
his glasses sees the calf drinking at her flank, big in the picture.

**Tuesday, play 2 (same save, bright day).** The doe grazes by the copse's south corner.
Her path runs south past the first stand to a second stand of tall grass below the copse
(~15 m), and there is a wet pool right on her path: "Op je pad ligt een natte poel." —
round it (the calm moment that came fourth yesterday is the first today). He searches from
the north-west; the calf lies front-left. By the calf the moments come as: nose, peep,
wobbly stand. He sneaks round the grass to a hide under the first trees of the forest and
watches her come out of the copse's south gap and cross the heath from the right. A buzzard
circles while he walks. At the reunion a second calf rises from the bracken: "Kijk! Een
tweeling!" (the rare one, never pressured).

**Wednesday, play 3 (golden hour).** The third stand, west of the others, searched from its
north side; the hide looks back toward the copse with the forest behind. A roebuck's rubbed
sapling stands near the path. His zoeken level has climbed: the calf shows less of its back
and there are more rust-brown look-alikes; the calf tempts him twice in each hold.

Thursday the first stand comes back, but searched from its north, with the calf in another
spot, the pool on the way out and another light. Over a few weeks: the holds lengthen from
4 to ~7 s, the doe pauses to listen up to three times in the watch, the calf shows a third
of what it showed in week one, and his veldgids fills up: woodlark, buzzard, cuckoo, the
rubbed sapling, and (once) the twins.

## 4. What changes every play (all drawn from `k.play`, construct-neutral)

| what | how it varies | package |
|---|---|---|
| The layout ("plek") | one of THREE layouts: a stand of tall grass + the side it is searched from + the doe's trodden path (wissel) to it + the copse gap she uses + the hide. Never one of the last two plays' layouts (read from the beat history), so three plays in a row are three layouts | P1 |
| Where the calf lies | one of 4 candidate spots in the stand (the content's `doelen`, trial coordinates 0..100, the same relative spot in every stand): front-left, front-right, back-left, back-right of the picture, never the middle; the zoeken trial's target | P1 |
| Where the doe grazes | one of two graze spots per layout (both seen from the ring) | P1 |
| The pool | on her path (`modder` is the first calm moment) or on his way to the hide (the fourth) | P1 |
| The calm moments' order | the three at the calf (`aai`, `geur`, `oppakken`) in any of 6 orders; `modder` first or fourth; `moeder` (the flip) always last | P1 |
| The watch | which of her small acts come and when (stop and listen, look round, bites of grass, a look at the hide), and what she listens to (a rustle, a cuckoo, a jay, a woodpecker); the number of listening pauses is the level's, not the seed's | P2 |
| Discoveries and surprises | 1-2 of the four small ones per play (woodlark, buzzard, cuckoo, rubbed sapling), the rare twins by `k.rare` | P3 |
| The light | the ree's moods: misty morning (most likely), bright day, overcast, golden hour; never dusk or night (a calf flat in grass must read the same) | P3 |

Not varied (they are difficulty, decision 1): the stand's search size, the lens distance and
angle relative to the stand, how much of the calf shows, the number of look-alikes, hold
times, how often the doe pauses, hint timing. Those move only with the level (§6.5).

## 5. The beats, as they become

| # | Beat | Now | After (package) |
|---|---|---|---|
| 0 | Briefing | the same card | the same card; under it the play is laid: the calf in its spot, the trial's look-alikes in the drawn stand, the pool moved, the glimpse window opened (P1) |
| 1 | Look | the doe by the same juniper | the doe at the drawn graze spot; nothing in the look's foreground (P1) |
| 2 | Walk: follow her slots | 5-6 m, straight | 10-18 m along the layout's wissel, bending once; the doe slips into the copse by the layout's gap; `modder` here when the pool is on her path (P1); a woodlark or a buzzard sometimes (P3) |
| 3 | Search (zoeken) | dead centre, same spot, high lens | the drawn stand from the drawn side, a lower lens, the calf in one of 4 spots off-centre (P1); its glimpse, the look-alikes and the hint by the level (P2) |
| 4 | Fact | raaf | the same |
| 5-7 | By the calf (rustkracht ×3) | hands, hands, card | three body moments in the drawn order: `aai` it peeps at his boots (hands still), `geur` it stretches its nose to his hand (hands still), `oppakken` it stands up wobbly and totters toward him (hands still); a lower close view (P1); hold length and temptations by the level, a step up after a clean hold, silently down after a reach (P2) |
| 8 | Walk to the hide | ~10 m, pool 2.5 m ahead | 12-18 m round the stand; the pool here when it was not on her path; the second plash shows the way round (P1) |
| 9 | Watch | one line ~16 s | her small acts drawn from a pool, a line every 4-5 s, 1-3 listening pauses by the level, a step in a pause makes her freeze and stare (P2); a cuckoo sometimes (P3) |
| 10 | `moeder` (the flip) | card | his feet: "Mama is terug. Loop stil weg." He walks away to the path himself; staying put or walking closer is the old rule (wrong): she steps back toward the copse and the line comes back (P2) |
| 11 | Reunion | small and far | from the path he turns and looks through his glasses: the doe ≥ 280 px tall, side-on, the calf drinking at her flank; the twins on a rare play (P2, P3) |
| 12 | Fact, reward | raaf | the same; the family walks to its home spot at the copse |

## 6. Technical approach

### 6.1 The play record (P1, pure: `missions/ree.variety.ts`, THREE-free, unit-tested)

```ts
export type ReeLayoutId = 'A' | 'B' | 'C';
export type CalfMoment = 'aai' | 'geur' | 'oppakken';
export interface ReePlay {
  layout: ReeLayoutId;
  spot: number;                 // index into the content's doelen (= the zoeken trial's target)
  graze: 0 | 1;                 // which of the layout's two graze spots the doe is at
  pool: 'in' | 'out';           // on her path (modder first) or on his way to the hide (modder 4th)
  calf: readonly CalfMoment[];  // the three calf moments, in play order
  order: readonly string[];     // the five encounter ids in play order (moeder last)
  variant: string;              // compact, logged with every beat: 'B2-in-gao'
}
export function drawReePlay(play: PlayRng, lastVariants: readonly string[], spot?: number): ReePlay;
export function reeOrder(pool: 'in' | 'out', calf: readonly CalfMoment[]): string[];
```

`PlayRng` is the contracts' `k.play` (`rng, pick, shuffle, chance, between`). The layout
excludes the layouts of the last two variants (fewer than two in the history: plain draw).
The spot is the trial's target when FOUNDATION's zoeken builder draws it (pass it in);
otherwise `drawReePlay` draws it. Tests: every seed gives a valid play (five ids, each once,
`moeder` last, the calf trio contiguous, `modder` first or fourth); the same seed and history
give the same play; over 3 draws with history the three layouts differ; across 300 seeds
every layout, spot, pool and order occurs. The test file also pins a small table of seeds a
reviewer can type (`?dev=1&seed=N` → layout, spot, pool) for each layout × pool.

### 6.2 Layouts (P1: `missions/ree.places.ts` becomes a table)

```ts
export interface ReeLayout {
  id: ReeLayoutId;
  chip: string;                      // the walk chip's goal words ("Het hoge gras", ...)
  stand: Frame;                      // the grass stand's frame, v away from the searcher
  wissel: readonly Spot[];           // her trodden path, ring → stand (10-18 m, one bend)
  search: Place;                     // where he stands to search: open heath, outside the fringe
  gap: Spot; bed: Spot & { yaw };    // the copse gap she uses, her bed behind it (out of sight)
  graze: readonly [GrazeSpot, GrazeSpot];
  meet: Spot;                        // where mother and calf meet (open heath, out of the grass)
  pools: { in: PoolSpec; out: PoolSpec };
  hide: Place; hideBush; hideLog;    // the hide (a juniper + a log, or the forest's edge)
  wayOut: Place;                     // P2: where he walks to for `moeder`, ≤ 12 m from marker or home
  views: { search; calf(spot); leave(at); watch; reunion };
}
export const REE_LAYOUTS: Readonly<Record<ReeLayoutId, ReeLayout>>;
```

Chosen by looking at the world and pinned by tests. The heath round the home (from
`Biomes.biomeAt`, `Paths.distanceToNetwork`, 2 m cells; `.` heath, `T` forest, `v` the ven's
25 m, `=` a sand path; M the ree marker, m today's stand, c the copse, p the pool, h the
hide, g the wildcamera's glade, w the frisling's wallow, F/H/W other markers):

```
   x: -52 ............................................... +12
 -58                    .......TTTTTTT
 -54              .............TTTTTTT
 -50           ................TTTTTTT
 -46        ...................TTTTTTT
 -42      .....................TTTTTTT
 -38    ....................c..TTTTTTT
 -36   .................m......TTTTTTT
 -32  .........................TTTTTTT
 -30  ....................p....TgTTTTT
 -28 ..................MM......TTTTTTT
 -26 ......................h...TTTTTTT
 -24 vv...........w............TTTTTTT
 -20 =vvvv...HH................TTTTTTT
 -16 =====vv...........F.......TTTTTTT
```

Open heath runs from x −46 to −2 between z −58 and −24; the forest edge is at x ≈ −2.
Starting points:

- **A** — today's stand (centre (−13.7, −36.5)), today's west gap and hide (−7.5, −26.5).
  Its wissel is lengthened to ≥ 10 m: from the ring west, then south-east into the stand's
  north-west rim, so he searches from the north-west and the copse stands in the backdrop.
- **B** — a new stand south of the copse (≈ (−8, −47.5)); a new south gap in the copse's
  bracken (≈ (−6.5, −42.3)); her way runs north→south across the hide's view; the hide at
  the forest's edge east of her way (≈ (−1.5, −46), a juniper under the first trees, the
  home's `treeClearings` keep its spot free) looking west over open heath. Its wissel runs
  west of A's stand (≈ (−18.5, −33) → (−17, −42)) to the stand's west rim.
- **C** — a new stand south-west (≈ (−18, −45)), searched from its north; the doe comes
  from the south gap across ~10 m of open heath; the hide on the far side of her way.
  If C cannot pass the tests and the backdrop rule, C searches A's or B's stand from its
  opposite side (≥ 120° apart) with its own hide; never two layouts with the same search
  picture or the same watch picture.

Rules every layout must pass (generalise today's `ree.places.test.ts` over
`Object.values(REE_LAYOUTS)` and add the new ones):
- every place dry heath, ≥ 8 m from other markers, ≥ 6 m from every frisling place, off the
  paths and props and roamers, ≥ 25 m from the ven, the marker ring open (2.5 m);
- the three stands the same search size (halfW 2.4, halfD 2.0 + fringe) and ≥ 4 m apart rim
  to rim; no wissel through another stand, a pool's water or a solid;
- the search stand ≥ 0.8 m outside the outermost fringe tussock (he stands on open heath);
- the hide 12-18 m walking from the search stand; it looks ACROSS her way (|cos| < 0.5),
  the gap and the meet spot both in the watch, her bed hidden from the hide and the stand;
- the watch's and the reunion's backdrop is heath and forest: never the cabin, the
  clearing, the jeep or the wildcamera's glade (checked by screenshot in review; in the
  test as "the view's heading points away from (0, 0) by ≥ 100°" and away from the
  wildcamera home);
- both pools on their way (the straight line runs through the water, the hint's `via` round
  it stays dry), ≥ 3 m from both ends;
- the family's after-home (`places.home`) ≤ 9 m from every layout's meet (they walk there
  after the reunion, never a cut), and every `wayOut` ≤ 12 m from the marker or the home.

`REE_PLACES` (the kit's `places`, `__ranger.missionPlaces`) keeps `marker` and `home` and
lists every layout's points under prefixed names (`A.search`, `B.hide` ...) so
`parkJeepOutOf` keeps the jeep out of all of them. `reeClearings()` covers every stand, every
pool candidate, every wissel strip and every hide (World.playClear keeps other missions'
staged games off them). `REE_HOME.spread` lists the stands and hides (Residents keeps a far
part drawn while he is near it).

### 6.3 The calf's spots and the glimpse (P1)

- Content: the ree's zoeken skin gets `doelen` (4 candidate targets, trial coordinates;
  e.g. near (30, 38), (70, 36), (32, 70), (70, 72), tuned by the projection test below) and
  keeps `doel` (= `doelen[0]`, for anything that reads it). Move or replace distractors so
  every distractor is ≥ 0.6 m (in every stand, through `patchLocal`) from every candidate.
- Each stand gets the same ring of tussocks (today's 5, one arching over the rump) round
  EVERY candidate spot, so the cover never marks the real one.
- Under the briefing card (`prepare`): stems settle back to their built heights, the calf
  is laid at the drawn spot (lying, yaw side-on to the searcher ± 0.3), the trial's
  look-alikes move to the drawn stand (one set of models, moved; the rust-brown 'bush'
  clumps exist in every stand as cover), and the glimpse window opens for THIS layout's
  search lens (`openWindow`, min share from the level in P2; 0.35 in P1).
- A unit test per (layout, spot) fits the real `Stage` (play/stage.ts) with a fake ctx
  (`PerspectiveCamera(55, 1.6)`, a 1280×800 canvas rect / `spec.viewport`, `groundY =
  Biomes.heightAt`, `isClear = () => true`) and asserts: the calf's back centre projects
  outside the central box, below the objective line, ≥ 90 px from the edges; its projected
  back length within ±30 % of the median over all (layout, spot) (equal readability); the
  spot inside its stand, dry, clear of the decoys, no juniper or trunk on the line to it.
  If `Stage` cannot be built in node, a pure pinhole approximation in `ree.places.ts` with
  the same numbers, confirmed once in the browser.
- The search beat's `stats.glimpse` stays within [0.25, 0.6] (missions.spec soft check).

### 6.4 The lens (P1, the owner's fix)

`views.search` per layout, starting point: pitch 30° (28-32), `halfW` 3.0 and `halfD` 2.5
(slightly larger than the stand so its rim and a band of heath show), `insetTop` 110,
`insetBottom` 30, `include` his spot with `r` 0.25, the heading offset ±0.45 rad (he stands
lower-left in some layouts, lower-right in others). Targets, read with `__ranger.cam()` and
`screenOf` at 1280×800 and confirmed by screenshot next to the frisling's search (shot 2):
lens 2.4-3.0 m above the ground under it (today 3.4); ≥ 3.5 m from his head (today ~3.0);
avatar `heightFrac` 0.14-0.20 (today 0.23), whole, in a lower corner (|ndc x| ≥ 0.45,
ndc y ≤ −0.45), on open ground; the far rim of the grass and the copse or forest edge
visible below the line. Check that the glimpse window does not read as a lane cut toward
the calf; if it does, prefer the stems at the sides (the window is opened for this lens
only, while the view holds still).

`views.calf(spot)`: pitch 34-40° (today 52°), the boy beside the calf and never over it, his
head ≤ 18 % of the picture height, the calf ≥ 140 px long, its stand-up spot and its bolt
spot inside the picture with the card's room below.

### 6.5 Growth (P2, depends on `foundation:adaptive`)

Read with `k.knobs('zoeken')` / `k.knobs('dagnacht')` (FOUNDATION's names; the same knob
values the 2D floors read). The ree needs these in-world knobs (FOUNDATION defines them in
the pure layer; the values here are what I will review against):

| breinkracht | knob (in-world meaning) | level 1 → level 6 | within the beat |
|---|---|---|---|
| zoeken | how much of the calf's back shows (`openWindow` min share) | 0.45 → 0.20 | — |
| zoeken | look-alikes in the stand (`afleiders + 2`, content grows to 10, two more rust-brown 'bush') | 5 → 10 | — |
| zoeken | first hint (the calf peeps where it lies, stems quiver) after | 14 s or 2 misses → 24 s or 3 misses | each miss brings it sooner (never under 5 s), silently |
| zoeken | her slots on the wissel (`buildSpoor`) | clear, unbroken → faint, with gaps | — |
| dagnacht | hold seconds of a hands moment (`HOLD_S` base; voorlezen off −0.5) | 4 → 7 | +0.5 s after a clean hold, −0.5 s after a reach (silent), never under the level's floor |
| dagnacht | temptations in a hold | 1 → 3 (2 from level 3) | — |
| dagnacht | the calf's wobbly steps toward him in `oppakken` | 1 → 3 | — |
| dagnacht | watch: stillness she needs after a step (`STILL_S`) | 2.2 → 3.5 s | — |
| dagnacht | watch: listening pauses (she stops, head up, toward the hide) | 1 → 3 | — |
| dagnacht | `moeder`: seconds standing still before it counts as "Blijf staan" | 9 → 6 | — |

A fresh save's first play is the level-1 row (easy to win). Up may be celebrated by
FOUNDATION's reward (never by the ree); down is always silent. Every logged beat passes
the play's `variant` (and FOUNDATION adds level, score, seed) to the bounded history.

### 6.6 The body moments (P1: `oppakken`; P2: `moeder`)

- `oppakken` (P1): `rust.still('oppakken', { hands: () => calf.body, line: "Het kalf staat op. Handen thuis.", show: the calf gets up (lie(false)) and totters 1 wobbly step toward him (P2: the knob's count), stopping ≥ 0.9 m from his boots, peeping; tempt: it peeps and lifts its head to him; wrong (a click on it): it startles, bolts 1.5 m sideways (never at him, never at the lens) and drops in the grass, the content's gevolg; right: it lies down again where it stands })`. The 2D floor keeps the card.
- `aai` and `geur`: today's `still` moments, unchanged in kind; each now framed where the
  calf lies (it may have bolted).
- `modder`: today's `rust.answer` on whichever walk the pool lies on. New: the second
  plash shows the chip's arrow and the way round (the walk's `via` as the chip's goal).
- `moeder` (P2, the flip): a new additive body moment `ChoiceRun.go(id, { line, from,
  family, away, waitS, wrong, right })` in `beats/choice.ts`, its pure core `GoCore` in
  `beats/hold-math.ts` (+ tests in `hold.test.ts`): after the line is read the clock runs;
  RIGHT when he has walked `away` m (default 4) from where he stood and is farther from the
  family than he was, at a walk; WRONG (`choose(false)`, marked once) when he stays within
  1 m of his spot for `waitS` s ("Blijf staan": the old rule) or comes 1.5 m closer to the
  family; running gets "Sst. Loop stil." and counts as neither. A walk hint to the layout's
  `wayOut` while it runs (golden walks it). If the frisling lane has landed an equivalent
  "go" moment for its `pad` flip first, reuse it instead of adding a second one.

### 6.7 The watch and the reunion (P2)

A pure watch script (`ree.variety.ts`: `watchScript(play, knobs) → WatchEvent[]`) drawn from
the seed: her way out (rustle, step out), 1-3 listening pauses (by the level), 1-2 bites of
grass, a look round, the call, the calf rising. A line every 4-5 s from small pools (each
≤ 7 words, read aloud once), e.g. "Hoor je dat?", "Daar is de moeder!", "Ze luistert. Sta
heel stil.", "Ze eet een hapje gras.", "Ze kijkt naar het gras.", "Ze roept zacht.", "Daar
komt het kalf!", "Ze ruikt aan haar kalf." In a listening pause she stops, lifts her head and
turns it toward a cue (a rustle, P3: the cuckoo, a jay, a woodpecker) or the hide; a step key
or a tap on the world then makes her freeze and stare at the hide ("Sta stil. Anders schrikt
ze."), and she goes on once he has been still `STILL_S`. The watch lasts ~25-35 s.

After `moeder`: at the way out he is turned toward the family (`faceRanger`), and one framed
view (`k.frame(views.reunion)`, eased, a cut under reduced motion; `k.ui.watching(true)`)
holds them from ~6-7 m of lens distance: the doe side-on, ≥ 280 px tall, the calf drinking
at her flank on the lens's side (`drinkSpot`), the reunion caption over it, ~5 s. Then the
fact. After the mission the family walks to `places.home` at the copse (≤ 9 m).

### 6.8 Discoveries, surprises, light (P3, contracts only)

Rows for FOUNDATION's discoveries table (id · plain name · knap name · kind · home · hint):

| id | plain | knap | kind | hint (≤ 7 words) | how he discovers it (doing, not reading) |
|---|---|---|---|---|---|
| `ree-boomleeuwerik` | Boomleeuwerik | Boomleeuwerik | dier | Een vogel zingt hoog boven de hei. | on a walk beat, a woodlark (bird-boomleeuwerik) flutters up from the heather 6-10 m ahead in his picture, rises singing (a new synth motif `boomleeuwerik` in core/sound.ts CALLS, additive), hangs ~4 s, drops; discovered once it was on screen ≥ 1.5 s |
| `ree-buizerd` | Buizerd | Buizerd | dier | Kijk eens hoog in de lucht. | a buzzard (bird-buizerd) circles high over the heath while he walks to the hide; on screen ≥ 1.5 s |
| `ree-koekoek` | Koekoek | Koekoek | dier | Luister goed als je stil wacht. | in the watch the cuckoo calls (koekoek.m4a) as one listening pause's cue and the doe turns her head to it; heard |
| `ree-veegsporen` | Schuurplek van de bok | Veegsporen | spoor | Kijk goed naar de jonge boompjes. | a young birch (~1.3 m) by the copse or a wissel with its bark rubbed pale at 0.3-0.8 m and a few hanging strips, at one of 2-3 sapling spots; discovered when he walks within 2.5 m (an optional detour, never on the hint's way) |
| `ree-tweeling` | Twee kalfjes | Tweeling | zeldzaam | Soms heeft een ree twee kalfjes. | `k.rare('ree-niet-aanraken')` (seeded chance + pity ≤ 3 plays): at the reunion a second calf rises from the bracken by the gap and joins its mother: "Kijk! Een tweeling!" |

Each play draws 1-2 of the four small ones (preferring ones not yet discovered; a pure
function of seed + discovered set), plus the rare roll. `k.discover` gives the calm reveal
once. Surprises never happen during the search, a hold or a listening pause (construct
neutrality); only on walks and between the watch's events. If FOUNDATION's table also lists a
mission's own animals, add `ree-reekalf` (found in the search) and `ree-moeder` (seen in the
watch). The ree's moods (through the contracts): misty morning ×2, bright day, overcast,
golden hour; never dusk or night; the session's mood comes back at the end. Every mood is
checked by screenshot in the search (the calf's glimpse reads the same) and the watch.

## 7. Construct parity, per breinkracht

**zoeken (Speurkracht).** One trial per play, built by the SAME `buildZoekenTrial` the 2D
`ZoekenView` uses (FOUNDATION's seeded form: the target among the skin's `doelen`, the level's
decoys), laid on the drawn stand by the 3D zoeken's own `patchLocal`, scored on the first
click by `scoreZoeken` (a decoy click is a miss, plain cover is not), `{ trials: 1, correct }`
logged once. The layout only chooses WHICH stand the trial is laid on: every stand has the
same size, the same lens distance and angle relative to its frame, the same tussock rings,
and the same visible share for the calf (the level's knob, opened by `openWindow` for that
lens); the projected size of every (layout, spot) is pinned within ±30 %; nothing moves
during the search except the level's hints. Her trail (`buildSpoor`, a separate axis) never
trims the decoys and ends at the stand's rim, never at the calf.

**dagnacht (Rustkracht).** The SAME `buildDagnachtTrial` encounters (all five, each once)
and the SAME `DagnachtRun`; only the ORDER is drawn (the three at the calf shuffled,
`modder` first or fourth, the flip `moeder` always last: four "don't" moments then the
switch, as in content). Each body moment maps onto `choose`: a reach (a click on the calf),
a boot in the pool, staying put or walking closer after the flip → `choose(false)` once;
a full hold, a dry way round, a calm walk away → `choose(true)`. The summary `{ trials: 5,
correct }` is what the 2D floor logs for the same answers; the 2D floor asks the same five
as cards (in the trial's order when the builder is seeded, else content order). Hold
seconds, temptations, stillness and the go-wait come from the level, never from the seed.

**corsi, simon, wisselen**: not in this mission.

## 8. Pitfalls (found while scouting)

1. `prepare` runs under the briefing card BEFORE `play()`: the play (seed) must exist there
   (ask FOUNDATION to pass `k.play` to `Adventure.prepare`, or to draw it before the card).
   Fallback: lay the variant at the start of `play()` (the calf hidden in tall grass: a cut
   nobody sees; the doe WALKS to her graze spot, never a cut).
2. The calf is a resident with a static `before` pose: after a play or a stop it is laid
   back there (a cut if far). Keep the calf's current spot in the home and lay it there
   (an additive Residents override, e.g. `residents.repose(missionId, key, pose)`), so a
   stop never pops it; a standing calf after a stop lies down where it is first.
3. `ReeHome` opens the glimpse window once at world build for one spot and one lens; with
   variants it must settle the stems back and open a new window per play, under the card.
4. The 5-tussock ring round the calf marks its spot: build it round every candidate.
5. Content distractor d1 (22, 42) is 10.6 units from a natural front-left candidate; every
   distractor must clear every candidate in metres in every stand (test it).
6. `choiceRun` builds its own trial from `k.steps` with no seed: the order needs the play
   (FOUNDATION's seeded builder, or an additive `choiceRun(k, step, { order })`).
7. The search lens's `include` keeps him whole at the bottom edge; with `insetBottom` 12 and
   the fringe tussocks round his feet the picture becomes "a head in grass". Stand him on
   open heath and give the fit room (`insetBottom` ~30, `include.r`).
8. The look from the ring frames the pool as a blurry blob in the foreground (shot 8):
   pools and props stay out of every look's foreground.
9. The `calf:leave` swing passes a frame of grass seen from above with no boy in it.
10. Triangles: 926k in the walk to the hide looking north over the clearing (STATE: up to
    0.99M where homes overlap). New stands and hides must keep every beat < 1M (read
    `__ranger.tris()` in each beat of each layout) and < 150 draw calls.
11. The hide's watch turn sweeps past the wildcamera's glade (its roe must never be the deer
    in his glasses): new hides look away from the wildcamera home.
12. The ree adventure is covered only by the generic missions.spec test (golden plays the
    frisling): add ree soft checks (calf off-centre, glimpse, lens numbers, walk lengths) to
    missions.spec additively, and run the test with two different seeds.
13. Don't edit `src/` while golden runs in the same worktree (Vite reload).
14. The play hints: the hands moments take no hint (golden waits them out); the `go` moment
    needs a walk hint to `wayOut`; the pool's `via` must exist for both pool positions.

## 9. Requests to FOUNDATION (the lead of FOUNDATION decides; in my plan's risks)

1. Pass the play (`k.play`) to `Adventure.prepare` (the ree lays its variant under the card).
2. A seeded zoeken trial: the target drawn among `skin.doelen` with the play's rng (same in
   2D), the decoys the level's count. A seeded dagnacht trial order, or a way for a mission
   to give its order (the ree's `reeOrder`) so the 2D floor asks the cards in the same order.
3. The in-world knobs of §6.5 (names yours), incl. the within-beat step for hold seconds.
4. A read of the mission's last variants from the beat history (the ree's layout never
   repeats one of the last two).
5. A home may restrict its moods (the ree: no dusk, no night).
6. The discoveries table takes the ree's five rows (§6.8); `k.rare` with the pity rule.

## 10. Package plan

| id | package | depends on | what the player gets |
|---|---|---|---|
| `ree-variety` | Three mornings | contracts (implied) | three layouts, four calf spots never in the middle, the lower search lens and close view, the pool on the way in or out, the calm moments in a drawn order with `oppakken` played with the hands, longer walks, the seed replays a play |
| `ree-growth` | It grows with him, and he walks away himself | `ree-variety`, `foundation:adaptive` | the level's glimpse, look-alikes, hints, holds, temptations, watch pauses; `moeder` played with the feet; a watch with small acts and changing lines; the reunion big, through his glasses |
| `ree-discover` | Something to notice | `ree-growth` | five discoveries (one rare, the twins), small surprises on the walks, the ree's moods |

Every package keeps golden green and the ree's missions.spec test green (with two
different seeds), plays with real keys and clicks through the play hints, keeps the 2D floor
working (same content, same summaries), lists every shared-file change, and keeps < 150
draw calls and < 1M triangles in every beat of every layout.

**What I check in every review** (played myself at 1280×800, real keys and clicks): three
plays in a row in one save, then a seeded replay; the search screenshots side by side (and
next to the frisling's); the calf's hint point off-centre in each; every body moment once
right and once wrong; the 2D floor once ("altijd 2D"); a stop mid-search and mid-calf
(nothing pops, the family goes home); `npm run gate` tail, `npm run golden` table,
`npx playwright test e2e/missions.spec.ts --grep reekalf` tail; draw calls and triangles
in each beat.
