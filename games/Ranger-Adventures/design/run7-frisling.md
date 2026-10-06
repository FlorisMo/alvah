# Run 7 · FRISLING lane: "De verdwaalde frisling", a new way every play

> Lane lead's design, 2026-10-01. Base `run7/integration` (run 6 @ 1941214).
> Read first: games/Ranger-Adventures/GOAL.md, STATE.md (2026-10-01), CLAUDE.md,
> ARCHITECTURE.md (the adventure layer), design/run6-missions.md §3-§4.1, the run's
> STRATEGY.md, and **FOUNDATION's design `state/foundation/design.md` §4 (the run-7
> contracts) and §5 (adaptive)**: its names are authoritative and this file uses them
> (`Play` with `fork`/`note`, `k.knobs` → `ZoekKnobs`/`SpanKnobs`/`RustKnobs`,
> `rustPlan` + `slot` + `ChoiceRun.next()/nextIn(slot)`, `content/ontdekkingen.ts`,
> `k.discover`/`k.rare()`, `MoodId`, `Adventure.moods`, `prepare(world, mission, play)`,
> `offCentre`, `?dev=1&seed=N`, `__ranger.play()/history()`).
> Section 10 is the package plan; section 11 is what I check when I review.

## 0. In one paragraph (player terms)

Today the piglet lies in the same bracken stand, in the same spot, dead centre of the
search picture, and Alvah finds him in two seconds; the walk, the route field, the calm
moments and their order are the same every time. After this lane, every play of *De
verdwaalde frisling* is a different little expedition: the squeak comes from one of
**three ways** (across the sand trail into the meadow; south past the big stone to the
forest edge; north-east to a lone birch in the meadow), the piglet lies in a **different
nook** of that way's stand and never in the middle of the picture, the look-alikes sit
elsewhere, the family wallows, roots or scratches in a **different layout** at the mud,
and the **calm moments come in a different order at different places** (the piglet himself
may beg at your bag, the yearling may trot out to the field, the "go" moment may come
before the sow's stare). From the second package on there is **no answer card left in the
world**: he keeps his hands still, walks slowly with a tired piglet, keeps his feet still,
and walks on when the path is free. Small things to find (a woodlark that flies up singing,
the pigs' rubbing log, a nest of bitten bracken, and rarely a magpie riding on the sow's
back) fill his veldgids. Over weeks the same exercises get visibly harder through
FOUNDATION's knobs: less of the piglet shows, more look-alikes, fainter prints, longer
routes, longer and more tempting calm moments, a shorter wait before the path closes.

## 1. What I found by playing (scouted 2026-10-01, run7/integration @ 1941214, port 5520)

Four plays at 1280×800 with real keys and clicks: three from fresh saves (one with a
child's mistakes: a reach at the piglet, a wrong `dragen`/`voeren`/`pad` card, a run while
leading, a step during the sow's stare, a 15 s wait in the search) and one from a practised
save (skill levels 4.4, the four adventures done). Screenshots looked at side by side; seven
kept in `state/frisling/shots-design/`.

- **Same every play.** The stand (-25.7, 20.4) and the piglet's spot in it: the search hint
  sat at screen (649,381), (647,406), (648,378), (648,385): **8-22 px from the centre in all
  four plays** (`search-play1.jpg` vs `search-play3.jpg`: the same picture). The bot found
  him in 2-3 s. The follow (north, across the trail, ~34 m), the lead home (~31 m), the
  field and its view, the wallow view, the family's places, and the five calm moments in
  the same order at the same places: `aaien` (body) → `dragen` (card) → route → `voeren`
  (card) → `zeug` (body) → `pad` (card). Play time 159-197 s (perfect), 257 s (mistakes).
- **The practised save** changes only two things: 8 look-alikes instead of 5 and a route of
  6 instead of 3 patches. Glimpse, hint delay, prints, holds and cards are identical: more
  stuff, not a harder version of the same thing.
- **Too easy:** the search (centre, glimpse 0.18 that reads at once) and the cards
  (`voeren` is solved by matching the chip "Niet voeren", `dragen`/`pad` by reading).
- **Read instead of played:** three cards (`dragen`, `voeren`, `pad`): a question and two
  buttons while the animal stands still behind the card.
- **Open items confirmed.** The follow starts facing the family while the prints go north
  behind him. After a reach the piglet is a sliver under the fronds (`reach-sliver.jpg`).
  The stonechat is a dark stick with a dot on top from the search lens
  (`search-practised.jpg`, right of centre). The yearling's home spot is 1.6 m from the
  mossy log's centre and it roots in a 0.9 m circle round it, so it shuffles through the
  log (the run-6 playtests saw it). At "De moeder kijkt. Sta heel stil." the sow is ~80 px
  tall and very dark (`zeug-small.jpg`). The family at 13 m reads almost black from the
  marker (`marker-dark.jpg`; FOUNDATION's `moods` fix).
- **Geography** (dev reads of markers, obstacles, trees, roamers, paths): the marker
  (-15.6,-15.6) is NE of the wallow (-26,-24). North: the open meadow across the sand trail
  (free ground). West: the herstel marker (-35,-19.4) with its red deer, helipad B (-44,-26),
  the boa post (-56,-20) and the fox's roam loop (-42,-2) r 6 (crowded, and the future
  herstel home). South-east: the ree's home (marker (-15,-27.1), meadow (-13.7,-36.5), copse
  (-6,-38)). South: open heath to the forest edge, reached only between the family and the
  ree marker, with the big stone (-20,-28) in that 11 m gap (`south-corridor.jpg`).
- **Mechanics.** The home is built ONCE with the world (`FrislingHome`): the stand and its
  glimpse window (stems thinned for `LOST_SPOT`), decoys at content positions, ring prints
  pointing north, the field, the clearings. `Adventure.prepare` runs under the briefing card
  and is where a play is laid. Resident poses are static spec data; `Residents.lay` walks an
  animal home within 9 m and cuts beyond. The cut fence is solid only while it shows.
- **Also seen by FOUNDATION's scouting** (its §1, §10.14): the bot's lead walk once took
  139 s / 160 m for 31 m (the walk hint flips between the goal and "back to the piglet"),
  and a replay's walk from the wallow back to the marker got stuck on the cover/family.
  Both are this lane's to fix.

## 2. Three plays in a row (what Alvah experiences)

Play 1, golden hour (way **wei**; a fresh save's first play keeps the session's light):
one look at the family, the sow lying in the mud, three piglets rooting round her. He
turns: the squeak is behind him, across the sand trail; crisp little trotter prints lead
from the ring. In the meadow stand the piglet lies at the left back, side-on, stripes
between the fronds; a stonechat on a frond tip fools him once. Hands still while he
squeaks. The piglet sniffs his bag before they set off (hands still). The long walk home,
the family ahead; the route over the rooting field seen from its north-west; on the last
stretch the piglet is tired (walk slowly). At the mud: "Het pad is vrij. Loop maar." and
he walks on, then the sow looks up (feet still). Reunion.

Play 2, misty morning (way **steen**): the squeak comes from the south, beyond the family.
"Loop met een boog om de groep.": he passes them at a calm distance (the sow lifts her head
and watches him go), past the big stone, ~40 m to bracken and heather at the forest edge.
The piglet lies at the right front, head toward him. The tired piglet walks slowly at his
side (walk slowly); a short lead to the south rooting field, the cabin far behind it; the
yearling trots out to the field and noses his bag (hands still). At the mud the sow looks
first (feet still), then the path is free (walk on). A woodlark flies up singing.

Play 3, overcast (way **berk**): the squeak is north-east, by a lone birch in the meadow.
The piglet lies at the back right, tail toward him; the sow is scratching on the log, and
a magpie hops onto her back (rare: "Nieuw in je veldgids!"). The calm moments in a third
order.

Within one save no two consecutive plays share a way; nook, decoy layout, family layout,
calm order and (per play) the mood are drawn anew each time.

## 3. How it grows with him (over weeks)

FOUNDATION's level per breinkracht sets where a play starts; its pure cores adapt within
the play; the frisling maps `k.knobs(engine)` onto this world and invents no difficulty
number of its own (FOUNDATION §4.2, §5):

| breinkracht | first play (band 1) | practised play (band 4-5) |
|---|---|---|
| Speurkracht (zoeken) | `lookAlikes` 4 in the stand, `glimpse` 0.38 of his back shows, `hintAfterS` 10, the follow's prints clear (`trailClarity` 0.95, `trailLegs` 2: close together) | 6-7 look-alikes, glimpse 0.20-0.23, hint after 16-18 s, prints fainter and further apart |
| Geheugenkracht (corsi) | `SpanKnobs` start 3, 2 rounds (a second route after a clean first) | start 4-5, 3 rounds |
| Rustkracht (dagnacht) | `holdS` 3, `tempts` 1, `goWaitS` 9 (the path stays free a long while) | holdS 4.5-5, tempts 2-3 (a squeak, a nudge, a half step), goWaitS 5-6 |

Up is celebrated calmly by FOUNDATION's flow, down is silent, never below the floor. Every
beat goes into the history with its play's seed and variant (`va`, e.g.
`way:steen,nook:3,fam:log,rare:ekster`), so his growth can be read.

## 4. What he can discover here (rows in `content/ontdekkingen.ts`, frisling block)

FOUNDATION's free-roam surprises own the buzzard, the cuckoo, the woodpecker, the wren, the
robin, the blackbird, the stag and the badger (`wereld.*`); this home uses none of them, so
the veldgids never shows one animal twice.

| id | soort | naam / naamKnap | where, how it is seen | hint (≤ 7 words) |
|---|---|---|---|---|
| `frisling.frisling` | dier | het biggetje / de frisling | the hero: found in the search (recorded quietly when won, FOUNDATION §4.4) | "Wie heeft een pyjama met strepen?" |
| `frisling.zeug` | dier | het moederzwijn / de zeug | seen in the look at the family (on screen ≥ 1 s) | "Wie past op de biggen?" |
| `frisling.overloper` | dier | het jonge zwijn / de overloper | when it comes to him (voeren) or is seen at the wallow ≥ 1 s within 15 m | "Wie is de grote broer?" |
| `frisling.leeuwerik` | dier | de leeuwerik / de boomleeuwerik | flies up singing from the heather when he walks within ~3 m of a seeded spot on one of the walks (`play.fork('leeuwerik')`, ≈ 50 % of plays); seen in flight | "Soms vliegt er een vogel op." |
| `frisling.schuurboom` | spoor | de schuurboom / de malboom | the pigs' rubbing log at the wallow: mud smeared to pig height, a few bristles; seen when he walks within ~2.5 m, or sees the sow scratching on it (family layout `log`) ≥ 1 s | "Waar schuren de zwijnen hun rug?" |
| `frisling.nest` | vondst | het nest van varens / de worpketel | a low ring of bitten, brown fronds at the edge of one stand per way; seen when it is in a framed view at the stand, or he walks within ~2 m | "Een moeder maakt een nest. Waar?" |
| `frisling.ekster` | zeldzaam | de ekster op het zwijn | RARE (`k.rare()`, FOUNDATION's roll + pity: within ~3 plays): a magpie (`bird-ekster`) lands on the sow's back at the wallow and hops about picking bugs; seen on screen ≥ 40 px for ≥ 1 s | "Wie rijdt er mee op een zwijn?" |

Small surprises without a row (seeded forks, never during a measured beat): heath-blue
butterflies over the meadow, two piglets chasing round the mud after the reunion, the
yearling scratching on the log, a jay's screech from the forest edge on way **steen**
(`gaai.m4a`). The reveal waits for a quiet moment (FOUNDATION §4.4): never during the
search, the route, a hold or a card.

## 5. Technical approach

### 5.1 The play's variant (pure: `missions/frisling.vary.ts`, THREE-free, unit-tested)

```ts
export type WayId = 'wei' | 'steen' | 'berk';
export interface FrislingVariant {
  way: WayId;
  nook: number;          // WAYS[way].nooks index
  pose: 0 | 1 | 2;       // side-on / head toward the lens / tail toward the lens
  decoySpots: number[];  // per trial decoy, in trial order: WAYS[way].decoySpots index
  family: 0 | 1 | 2;     // FAMILY_LAYOUTS: 'modder' (sow lying in the wet core) / 'rand' (rooting round it) / 'boom' (scratching on the log)
  leeuwerik: number | null;  // index of the walk spot it flies up from, or none
}
export function frislingVariant(play: Play, lastWay: WayId | null, decoys: number): FrislingVariant
```

- Every decision from its own fork (`play.fork('way')`, `'nook'`, `'pose'`, `'decoys'`,
  `'family'`, `'leeuwerik'`) and noted (`play.note('way', v.way)` …). No `Math.random`.
- **No immediate repeat of the way:** `lastWay` = the `way:` in the `va` of the newest
  frisling entry of the history (`store.get().geschiedenis`, FOUNDATION §4.3); the pick
  excludes it. A first play may draw any way.
- The **calm order** is not drawn here: the trial builder draws it (5.5) and the script reads
  `rust.next()/nextIn(slot)`.
- `frisling.vary.test.ts` pins determinism, reachability of every value, the no-repeat rule,
  and a **seed table**: three seeds that draw `wei`, `steen` and `berk` on a fresh save
  (`?dev=1&seed=N`), listed in every builder report.

### 5.2 The three ways (`missions/frisling.places.ts`)

`FRISLING_PLACES` becomes a fixed part (marker, wallow, home, clue, the log) plus a `WAYS`
table. Each way holds: `stand` (centre + frame), `nooks` (≥ 5: u, v in the stand frame + a
yaw per pose), `decoySpots` (≥ 8, none on a nook), `follow` (points from the ring: start,
via…, the stand's approach), `coverApproach`, `searchView` (FrameSpec), `leadClumps`
(beside the way home), `field` (`'N' | 'S'`), `fieldApproach`, `fieldView`, `fieldSide`,
`wallowTalk`, `wallowGive`, `wallowView`, `nest` (5.9), `walkSpots` (the woodlark's).
Starting points (verify by looking at the world, then pin in tests):

| way | stand | the follow | lead home → field | wallow from | character |
|---|---|---|---|---|---|
| `wei` | today's (-25.7, 20.4) | today's: N across the trail, ~34 m | the N field, arriving at its **north-west** side (FIELD_FROM ≈ (-30,-6)), ~31 m | NE (today) | open meadow, the long lead |
| `steen` | ≈ (-24, -50): open heath at the southern forest edge; bracken, heather and two or three birch saplings (`Adventure.trees` or props) | S: from the ring via ≈ (-19,-25) and ≈ (-20.5,-29.5), just SW of the big stone; ≥ 6.5 m from the wallow centre, ≥ 4 m from the ree marker; ~40 m | a new **S field** ≈ (-33,-36) seen from its south-east, ~11 m; then ~12 m on to the wallow | SW | the long follow past the family, a short lead |
| `berk` | ≈ (-6, 18): meadow NE across the trail, ≥ 8 m from the signpost-west (-16,10) and the mushrooms (-11.5,8.5), off the NE path; a lone birch planted at its edge (`Adventure.trees`); bracken + bramble | NNE across the trail, ~35 m | the N field from its **north-east** side (today's FIELD_FROM (-20,-8)), ~32 m | NE | a different stand look, a different field side |

Every way passes (extend `frisling.places.test.ts`, one block per way): dry heath or the
dry meadow; inside the world (< 60 m from the origin); clear of the paths
(`distanceToNetwork` > `LANE_HALF` + r), the props, the trees (+2 m), the roamers' loops
(+2 m), every other marker (≥ 8 m), the ree's places and clearings (≥ 8 m), the herstel
marker (≥ 12 m: its future home), the helipads (≥ `PAD_RADIUS` + 6 m), the clue fence and
its prints (≥ 1.5 m), and no other home's ground (`World.playClear`). The follow is 25-42 m;
the lead ≥ 28 m on `wei`/`berk` and ≥ 10 m on `steen`; walking the lead the family is ahead
(±35°); ≥ 3 dive clumps beside each lead, both sides, never on it. No patch of the other
field shows in a field view. The two views of the N field (`wei` from the NW, `berk` from the
NE) are ≥ 45° apart, and each holds all seven patches (±35° from a lens 3 m behind its
approach). `__ranger.missionPlaces('frisling')` returns the fixed places plus this play's
way flattened in (`cover`, `coverApproach`, `field`, `fieldApproach`, `wallowTalk`, `home`),
so the specs' soft checks keep working.

**Budget.** Each stand is its own CoverField (3 draw calls) that rests by its distance from
its own spot (a longer reach than `env.detail`, so a 1 m tall stand never pops in open
view); each field is a PatchField under `env.detail`. Hard limits: draw calls < 150,
triangles < 1M at the marker, in the look, at each stand, each field and the wallow.

### 5.3 The stand per play (`prepare(world, mission, play)` / `unprepare`)

Under the briefing card (`prepare` gets the play: FOUNDATION §4.1/§4.5), the home:

1. computes the variant (5.1), keeps it (`home.variant`), and notes it on the play;
2. lays the piglet in `WAYS[way].nooks[nook]` with the pose's yaw (`Actor.place` + `lie`);
3. **resets the window**: every stem of that stand back to its built height (`h0`), then
   `openWindow(stems, lensFor(searchView).cam, backPoints(...), k.knobs('zoeken').glimpse)`
   for that nook, `refresh()`; the search beat's own re-open at search time stays (it
   settles the last stems for the real screen);
4. lays the look-alikes: the trial's decoys (`buildZoekenTrial(skin, knobs, rng)` from
   the play's fork: count and which ones) at `decoySpots[variant.decoySpots[i]]`. The
   dead-bracken decoys are 'dead' clumps built at every decoy spot of every stand and
   shown/hidden per play (`CoverField.showClump`); the birds and the butterfly move (their
   holder's position);
5. points the ring prints at the play's way;
6. lays the family layout (5.4).

`unprepare` (the briefing left without playing) and release (stop or won) restore the
defaults: the piglet at `wei`'s default nook (free roam squeaks from there, as today), the
default window, the content decoys, the ring prints north, the family's spec poses.

**Nooks are pinned** by the places test, every way × nook × pose: inside the stand behind
≥ 2 clump rows from its near edge; `offCentre(searchView frame, nook) ≥ 0.25` (FOUNDATION's
helper) and, with the lens computed (`Stage` fit with a fake ctx, as `env.lensFor` does),
projected ≥ 12 % inside every edge and below the objective line (y > 130 px at 1280×800);
the piglet's projected length 40-90 px at every nook (equally readable); after `openWindow`
`visibleShare` in `[glimpse·0.6, glimpse·1.6]` for every band's glimpse. Optional: a few
flattened empty "beds" in each stand (plain cover: never a miss).

### 5.4 The family's layouts at the wallow (package 1)

`FAMILY_LAYOUTS[0..2]` in `frisling.places.ts`, a pose per resident key: `modder` (the sow
lying in the wet core, piglets rooting at the rim, the yearling off to the far side),
`rand` (all rooting round the mud: today's, with the yearling moved off the log), `boom`
(the sow scratching her flank on the fallen log, the yearling and piglets on the other
side). Laid in `prepare` by a calm walk (≤ 9 m: `Residents` walks them; they are animals:
never a pop in view); the spec poses come back on release. Additive `Residents` support if
needed (e.g. `residents.lay(missionId, poses, { walk: true })`), listed. Pinned: every pose
inside 2.4 m of the wallow centre; every home spot and rooting circle ≥ 0.5 m from the log
box (except the scratching sow, who touches it); ≥ 2 m from the clue fence; a free lane from
the wallow to the marker (5.7).

### 5.5 The calm moments: order (FOUNDATION's rust plan) and stations

Content (`content/veluwe.ts`, frisling step 2): each encounter gets a `slot`, the skin a
`rustPlan` (FOUNDATION §5.4: slots in plan order, each slot's encounters shuffled by the
play's fork, a flip never first, the 2D floor plays the same order):

```
aaien: slot 'big'   ·  dragen, voeren: slot 'weg'   ·  zeug, pad: slot 'thuis'
rustPlan: [{ slot: 'big' }, { slot: 'weg' }, { slot: 'thuis' }]
```

That gives four orders: `aaien, (dragen|voeren)×2, (zeug|pad)×2`; the flip `pad` comes
either before or after the sow's stare. The script plays slot by slot with
`rust.nextIn(slot)` and stages each encounter at its **station**:

| slot | station | `dragen` | `voeren` | `zeug` | `pad` |
|---|---|---|---|---|---|
| big | at the stand, he lies | | | | (`aaien`: hands still, as today) |
| weg, 1st | s1: at the stand, the lead's start | walk slowly with him: the lead's first stretch | the **lost piglet** sniffs his bag, hungry | | |
| weg, 2nd | s2: the field, after the route | walk slowly with him: field → wallow | the **yearling** trots out from the wallow to the field | | |
| thuis, either order | s3: the wallow edge | | | the sow looks up (as today) | the path is free: he walks on to `wallowGive` |

Package 1 keeps the cards as cards and the body moments as body (`aaien` hands, `zeug`
feet), each at its station; package 2 turns `dragen`, `voeren` and `pad` into body moments
(5.6). The yearling at s2 stops ≥ 1.2 m from him and goes back after; when `pad` comes
first at s3, he walks on and the sow's stare follows at his new spot.

**If FOUNDATION's `rustPlan`/`slot`/`next()`/`nextIn()` are not on `run7/integration` when
package 1 starts**, the builder adds exactly that shape, additively and minimally
(`content/types.ts` `Encounter.slot`, `Skin.rustPlan`; `engines/dagnacht.ts`
`buildDagnachtTrial(skin, diff, rng?)`: no plan or no rng = content order; `beats/choice.ts`
`next()`/`nextIn(slot)`), with the 2D floor and the classic dagnacht building from the same
`play.fork('dagnacht')`, a parity unit test (same seed → same order in both paths), and lists
it, so FOUNDATION's `adaptive` lands on top without a behaviour change.

Way **steen** adds an UNMEASURED walk-round beat on the follow: "Loop met een boog om de
groep." while he passes the family; if he comes within ~5 m of the sow she lifts her head
and grunts softly and "Niet zo dichtbij. De moeder kijkt." shows once per approach; she
never moves toward him or the lens. No trial is logged for it.

### 5.6 The body answers (package 2)

All three keep the same `DagnachtRun` (one `choose(false)` per encounter however often he
errs, `choose(true)` once when done), the drawn order, and the cards on the 2D floor. Each
registers a play hint (a walk hint, or `null` while a perfect player keeps still).

- **`dragen` = walk slowly with him (PACE).** "Hij is moe. Loop rustig mee." The tired
  piglet trots at his side (lead `side`), his walk capped at the piglet's tired pace (~1.1
  m/s); the moment is a stretch of `max(8 m, holdS × 2 s of walking)` (or the rest of the way
  if shorter). A run (`isRunning`, Shift) is the impulse: `choose(false)` once; the piglet
  squeals and dives into a clump in his picture (the kit's lead dive), "Niet rennen. Hij is
  moe."; once he walked calmly back, "Hij is moe. Loop rustig mee." again from there.
  `tempts` temptations along the stretch (the family grunts ahead; a sibling squeaks from
  the field). Walked calmly: `choose(true)`, the uitleg line. Golden walks (never Shift):
  a walk hint to the stretch's end. Pure core `PaceCore` in `beats/hold-math.ts` (additive,
  unit-tested).
- **`voeren` = hands still while he begs (HANDS).** "Hij wil eten. Hou je handen stil."
  The begging animal (the piglet at s1, the yearling at s2) noses his bag, looks up, grunts
  or squeaks, shuffles a little closer (`tempts`; never under 1.2 m). A click on it is a hand
  with food: `choose(false)` once; it chews a crumb, wriggles closer eagerly ("Nu wil hij
  steeds meer. Dat is niet goed."), and the same moment comes back. Held (`holdS`): it loses
  interest and trots back (yearling) or lies down at his feet (piglet). `rust.still` with
  `hands`, as `aaien`; a click target ≥ 56 px.
- **`pad` = walk on (GO, the flip).** "Het pad is vrij. Loop maar." A walk hint to
  `wallowGive`; he walks on with the keys. Walking ≥ 1.5 m along the way within `goWaitS`
  (counted from the end of the line's read) is `choose(true)`; standing still past it is the
  stay-habit kept too long: `choose(false)` once, the group shuffles on (today's wrong),
  "Je wacht te lang.", and the moment comes back. Pure core `GoCore` in
  `beats/hold-math.ts` (additive, unit-tested): the mirror of `HoldCore`.

`aaien` (hands still at the lying piglet) and `zeug` (feet still while the sow stares)
stay, read `holdS`/`tempts` from the knobs, and FOUNDATION's in-beat `RustTempo`.

### 5.7 The follow, the lead and the way back (package 1)

- After the look at the family the ranger ends **facing the way the squeak comes from**
  (additive `k.look(at, line, hold, { face: heading })`: he turns while the lens is on the
  family; the lens glides back behind him that way; ≤ 90°/s, a cut under reduced motion).
- The **first three or four prints** from the ring are crisp (opacity 1, 1.15× size), then
  the knobs' `trailClarity`/`trailLegs`; the trail follows the way's `follow` points (a
  polyline), ending at the stand's edge, never at the piglet. The ring prints point the way.
- **The lead's walk hint never flip-flops**: find why the bot's piglet falls 20 m behind
  (`LEAD_WAIT_M`) or why the hint alternates, fix the root (e.g. the piglet's follow speed
  vs `LEAD_PACE`, a clump in its path), and pin it: golden and missions.spec walk each lead
  in ≤ 1.6× (its length / `LEAD_PACE`).
- **The way back to the marker is free**: from every `wallowTalk`/`wallowGive` and every
  family layout a straight lane to the marker keeps ≥ 1 m from cover clumps, the log and the
  animals; a replay from the wallow reaches the marker prompt in ≤ 25 s of walking.

### 5.8 Difficulty (package 3)

The frisling reads `k.knobs('zoeken' | 'corsi' | 'dagnacht')` and maps them; nothing else:

| knob | frisling use |
|---|---|
| `zoeken.lookAlikes` | the trial's decoys laid in the stand (5.3) |
| `zoeken.glimpse` | `openWindow(…, glimpse)` in prepare and in the search (replaces `SEARCH_GLIMPSE`) |
| `zoeken.hintAfterS` | `searchBeat({ hintAfter })` |
| `zoeken.trailLegs`, `trailClarity` | the follow's prints (spacing, clarity after the crisp first ones) and the squeak's interval (clearer = more often) |
| `corsi.start/max/rounds` | `routeBeat` (FOUNDATION's `SpanRun`); the field holds seven patches for any route |
| `dagnacht.holdS`, `tempts`, `goWaitS`, `slowmo` | `still` holds and temptations (aaien, voeren, zeug), the `PaceCore` stretch and its temptations, the `GoCore` window, the 2D card's slow-mo |

In-beat adaptation is FOUNDATION's cores', identical in the 2D floor.

### 5.9 Discoveries and surprises (package 2)

Rows (§4) in `content/ontdekkingen.ts`, frisling block. Events are frisling-owned dressing
and behaviour in `frisling.home.ts`/`frisling.ts`: the woodlark (`bird-boomleeuwerik`)
flushing from a seeded walk spot within ~3 m of him, rising on a low arc to settle 15-20 m
off, a soft trill (synth); the rubbing log's mud and bristles (a decal/tint on
`prop-fallen-log`; the `boom` layout's sow scratching on it); the bracken nest (a low ring of
bitten, rust-brown fronds: 'dead' clumps at one stand's edge per way, outside the search's
decoy spots, never clickable as a decoy); the magpie (`bird-ekster`) on the sow's back when
`k.rare()` is `frisling.ekster` (a procedural hop, 2 draw calls). A discovery is recorded
with `k.discover(id)` when the thing has been really seen (on screen ≥ 40 px, not occluded,
≥ 1 s, within its distance). Nothing of this plays during the search view, the route's
show/recall, a hold, or a card.

### 5.10 Moods

`frislingAdventure.moods = { perPlay: true }` (every play a new light, never the home's last),
with the wish to FOUNDATION that a save's **first** frisling play keeps the session's mood
(the golden hour on a fresh save), so a fresh-save golden sees today's light. Decision 1
binds: the search is equally readable in every mood (glimpse set by the knobs, never by the
mood); package 3 screenshots the search and the zeug moment in every mood that exists
(`?mood=`).

### 5.11 The run-6 open items

| item | fix | package |
|---|---|---|
| the follow starts facing the family, the first prints faint | 5.7 | 1 |
| the stonechat reads as a black stick from above | additive `decoys.ts` option (`perch`): the bird on a frond tip or a short dry seed head (≤ 0.75 m), a light stalk; reads as a bird from the search lens; the ree keeps its default | 1 |
| the yearling walks through the mossy log | every layout's yearling spot and rooting circle ≥ 0.5 m from the log box (P1); its walks to him and back go round the log via a places-table point, each segment ≥ 0.5 m from the box, per way and layout (P2) | 1 + 2 |
| after a reach the piglet is a sliver in the bracken | the scoot goes sideways inside the framed view (never deeper away from the lens), the fronds over him part (`partAt`) and stay parted; ≥ 40 % of his back visible from the aaien lens (`k.stats`) | 2 |
| at "De moeder kijkt. Sta heel stil." the sow is small and dark ~7 m off | the zeug view frames her ≥ 110 px tall at 1280×800 with him whole at the side (a closer side lens, or she steps 1-2 m to his side first, never at the lens); her darkness is FOUNDATION's `moods` fix | 2 |

## 6. Construct parity, per breinkracht

- **Speurkracht.** The same `buildZoekenTrial(skin, knobs, rng)`: the same seeded decoy set
  and count, the same glimpse (2D: `haze = 1 − glimpse`), the same hint delay, one find,
  the miss rule (a decoy is a miss; plain cover and an empty bed are not), the same
  `zoekSummary` logged once. What varies (way, nook, pose, decoy spots, mood) is pinned
  equal: every nook at the band's glimpse via `openWindow` (never per nook), the same
  on-screen size band, off centre, inside the edges. The follow (prints, squeak) is the
  separate spoor axis and never trims the decoys.
- **Geheugenkracht.** The same `SpanRun` (start, growth, replay, ease, rounds) fed by the
  same fork; seven look-alike patches in the `PRINT_SPOTS` layout scaled uniformly, all
  seven in one held view. Another field or side is a rotation of the same board (pinned:
  spacing ≥ 1.4 m, all in view, no other field's patch in the picture, the same on-screen
  size band).
- **Rustkracht.** The same five encounters, one flip (`pad`), one seeded order from the
  `rustPlan`, one `DagnachtRun`, played in that order by BOTH paths. A body moment maps
  onto `choose` exactly like a card: the first impulse in a moment (a click on the animal, a
  step, a run, a wait past `goWaitS`) is `choose(false)` once, the moment repeats until done
  (`choose(true)`). `{ trials: 5, correct: never-wronged, impulses, holdS }`.
- **Unmeasured beats** (the walk-round on `steen`, the lead's run → hide, discoveries,
  surprises) log nothing and never sit inside a measured beat.

## 7. Pitfalls

1. The home is built once; everything per play is laid in `prepare` and undone on
   release/unprepare. A stem thinned for one nook must get its `h0` back before the next
   nook's window opens.
2. The free-roam squeak (`lost` voice, `state: 'before'`) stays at the default nook (`wei`):
   keep the clearing test (not heard at spawn).
3. `frislingClearings()` is read at world build: both fields' patches are bare for good.
4. A stop on `steen` releases the piglet ~70 m from his default nook: `Residents.lay` cuts
   (> 9 m), out of his sight. "Speel nog eens" after a stop draws a new way.
5. The family re-lay must walk, never pop: they are 13 m from the marker, in view.
6. Golden and missions.spec play whatever the seed draws: every way must be golden-green;
   run missions.spec frisling on the three table seeds, and golden at least twice.
7. `wei` and `berk` share the N field (one board, laid once): re-pin its test for both sides.
8. ChoiceRun `ask(id)` throws out of order: with a `rustPlan` the script uses
   `next()`/`nextIn(slot)` (FOUNDATION §10.8).
9. Neighbours: the ree lane may move its calf's spots; the ADVENTURES lane will build the
   stuifzand and herstel homes. Their places tests must keep ≥ 8 m from `steen`'s trail and
   places, the S field and `berk` (≥ 14 m from the stuifzand marker today), and ours from
   theirs: read their places tables when they land.
10. The cut fence (after) stands SW of the wallow; solid only while shown; keep every way's
    walks ≥ 1.5 m from it anyway.
11. Don't edit `src/` while golden runs in the same worktree (Vite reload).
12. Body moments: no play hint while he keeps still (golden waits), walk hints for PACE and
    GO; missions.spec answers cards by `vraag` (none left in the world after package 2,
    still all five on the 2D floor).
13. Nothing committed but code and tests: screenshots and scripts stay in scratch; no video,
    no traces.

## 8. Shared files I expect to change (additive only; every builder lists theirs)

`adventure/kit.ts` (`look(..., { face })`), `adventure/decoys.ts` (`perch`),
`adventure/cover.ts` (a stand's own rest; reset to `h0`), `adventure/beats/choice.ts` +
`beats/hold-math.ts` (`PaceCore`, `GoCore`), `world/Residents.ts` (lay a play's poses), and
only if FOUNDATION has not landed them: `content/types.ts` (`slot`, `rustPlan`),
`engines/dagnacht.ts` (order from the rng), `beats/choice.ts` (`next`/`nextIn`), the 2D and
classic dagnacht views (the play's fork). `e2e/*`: soft checks only (the search hint ≥ 120 px
from the centre; the lead's time). Lane-owned: `render3d/adventure/missions/frisling.*`, the
frisling block of `content/veluwe.ts`, the frisling block of `content/ontdekkingen.ts`.

## 9. Copy (Dutch, ≤ 7 words a sentence, read aloud; plain / knap)

| key | plain | knap |
|---|---|---|
| boog | Loop met een boog om de groep. | Loop met een boog om de rotte. |
| teDichtbij | Niet zo dichtbij. De moeder kijkt. | Niet zo dichtbij. De zeug kijkt. |
| moe (P2) | Hij is moe. Loop rustig mee. | De frisling is moe. Loop rustig mee. |
| nietRennenMoe (P2) | Niet rennen. Hij is moe. | (same) |
| eten (P2) | Hij wil eten. Hou je handen stil. | (same) |
| padVrij (P2) | Het pad is vrij. Loop maar. | (same) |
| teLang (P2) | Je wacht te lang. | (same) |

Discovery names and hints: §4. Every string through `veluwe.test.ts`'s lint (and
FOUNDATION's for `ontdekkingen.ts`).

## 10. Package plan

| id | package | depends on | what the player gets |
|---|---|---|---|
| `ways` | Every play a new way | contracts | three ways, nooks never centred, decoys and the family re-laid, the calm moments in a drawn order at their stations, the follow facing the way with crisp first prints, the stonechat a bird, a lead and a way back the bot walks straight |
| `body` | The body answers and things to find | ways | no card left in the world (pace, hands, go), the reach / log / sow fixes, seven veldgids rows incl. a rare with pity, small surprises |
| `growth` | Harder as he grows | body, foundation:adaptive | the knobs mapped (glimpse, look-alikes, hint delay, prints, rounds, holds, temptations, go window), per-play moods checked |

Each package: golden ALL GREEN (its seed noted), missions.spec frisling green on the three
table seeds, `npm run gate` green, the 2D floor plays the same five cards in the drawn order
and logs the same summaries, every shared-file change listed, scratch cleaned.

## 11. What I check when reviewing (played by me, 1280×800, real keys and mouse)

Always: the gate's tail line, golden's table (ALL GREEN) and seed, missions.spec frisling on
the three seeds, screenshots I open myself, draw calls < 150 and triangles < 1M, no new
runtime dependency, no `Math.random` in the home (grep), save data only through
`core/state.ts`, every new line ≤ 7 words and read aloud, the 2D floor ("altijd 2D") plays
all five cards in the drawn order.

- `ways`: three plays in a row from one fresh save: three different ways, three nooks (the
  search hint ≥ 120 px from the centre each time), different calm orders, different family
  layouts; a stop on `steen` mid-follow then "Speel nog eens": a new way, nothing left over;
  the follow starts facing the squeak with crisp first prints; the stonechat reads as a
  bird; the lead and the walk back to the marker are straight.
- `body`: one play per order with a child's mistakes at each body moment: each mistake gets
  a calm reaction and the same moment back, logged once (the save: dagnacht 5 trials); no
  card in the world; the piglet stays visible after a reach; the yearling goes round the
  log; the sow ≥ 110 px; three fresh plays find the family rows and some of the others, the
  rare by the third play; a reload keeps them; a second sighting shows no reveal.
- `growth`: a fresh save's first play is easy to win (a clear glimpse, 4 look-alikes, a
  3-patch route, short holds, a long go window); a practised save (seeded band 4-5) shows
  the same exercises visibly harder side by side; the history holds level, seed and variant
  for each step; the search and the zeug moment readable in every mood.
