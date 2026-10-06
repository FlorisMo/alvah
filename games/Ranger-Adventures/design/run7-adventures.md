# Run 7 · NEW ADVENTURES lane: the ven, then the ecoduct and the drift sand

> Lane lead's design, 2026-10-01. Base `run7/integration` @ 1941214 (run 6's result).
> Read GOAL.md, STATE.md (2026-10-01), CLAUDE.md, ARCHITECTURE.md and
> `design/run6-missions.md` first, then the run's STRATEGY.md and FOUNDATION's design
> (`state/foundation/design.md`, section 4 is the contract this lane codes against). This
> file is the contract the builders build to and the lead reviews against. Section 10 is
> the package plan. The final agent copies it to `design/run7-adventures.md`.

## 0. In one paragraph (player terms)

Today the six missions after the four adventures are a quiz on a patch of dirt. "De kikker
in het ven" is played in 16 seconds by a bot: a bright green frog sits in plain sight on
bare ground next to a cattail, footprints lead straight to it, and then three cards ask
what to do about an adder, a soft bank and a dry path. It is not even at the water: the
stage is laid in the wood beside the wildcamera's thicket. After this lane, the ven is a
walk round the water with your own feet. You hear the heikikkers calling from the far bank
and see little rings on the water where they sit. You follow the sound along the sunny
north bank, and when you run they fall silent: stand still, and they call again. On the
way an adder basks on the warm sand of the path (keep your distance until it slides into
the heather), a carpet of bright green veenmos lies across the bank (walk round it, or your
boots sink), and the dry path is free again (walk on). At the bay where the frogs are, you
stand still and listen, and then search the edge of the water: a brown frog, dead still
between the sedge and the moss, among clumps of moss that look just like it. You wait, and
he sings for you; the whole ven answers; he plops back into the water. Every play the frogs
sit in another bay, the adder and the soft moss lie at other spots and come in another
order, the light is different, and sometimes there is something new to see: a duck with
her ducklings, a dragonfly over the reeds, a heideblauwtje on the heather, and once in a
while a frog that is bright sky blue. The ecoduct and the drift sand follow the same way.

## 1. What I found (scouted 2026-10-01 on 1941214, port 5560, fresh saves)

Played with real keys and mouse through `e2e/missions.spec.ts` and my own Playwright
scripts (fresh saves, 1280×800, real-GPU args), screenshots looked at: the ven (×2), the
ecoduct, the drift sand, the frisling and the ree (the bar, beat by beat), the story order
(seeded saves), the whole ven shore from eight vantage points, the north bank close up, the
ecoduct's mouth and the drift sand.

**The ven today (classic path)**
- Played in **16 s** by the bot: one click finds the frog, three card answers.
- The zoeken stage is laid in the **bos beside the wildcamera's thicket**, not at the water
  (its pink ring shows in the picture). The frog is **bright green, in plain sight** on bare
  dirt next to a cattail; a trail of prints leads straight to it. Found in 1 click.
- Rustkracht = three cards in content order (adder → soft edge → dry path), the adder
  staged on a sand patch with a "Aaien / Hou afstand" card: **read, not played**. The flip
  ("Het droge pad is vrij") is always last.
- The marker ring holds a small frog (marker look 'animal'), 9 m from the wildcamera marker
  and 8 m from the ecoduct marker; the bird hide (vogelkijkhut, 26,-11) stands 8 m north.
- Same every play: the frog's spot, the decoys, the order, the light.

**The ven itself (the world)**
- Water disc radius 20 round (46,-19), a regular belt of world cattails (lisdodde,
  `Dressing.scatterGlbPlants`, rings 9-20 m out where the ground is within -0.3..+1.0 m of
  the water) and **bare brown dirt** all round. No moss, no sedge, no cottongrass, no
  heather on the banks: it reads as a pond in a dirt yard.
- The **north bank** (between the bird hide and the east) is open, sunny (it faces south)
  and empty: the right place for an adder to bask and for frogs to call. Measured: the
  ground there is ~1 m above the water at 20 m out and meets the water only at **12-14 m**
  from the centre (θ 125° → 50°): a broad sloping bank, the cattails standing on it. The
  ranger can walk down to where the ground is ≥ 0.15 m above the water (World's `blocked`).
- The **south bank** is in the forest, marshy (at water level out to 31 m) and crowded
  (watchtower 37,-37; the eekhoorn, vos and nachtronde markers). The **east bank** is quiet
  but 60 m round from the marker.
- Standing at the water's edge among the world cattails, the follow camera sinks into them:
  giant dark-brown spikes fill the picture. **The world's reed belt ignores the homes'
  clearings** (only `gridSpots` checks them), so it would stand inside any bay we lay out.
- A roaming roe (Fauna, home (44,12), loop r 6) grazes just north of the north bank; it
  renders black at 20 m (FOUNDATION's named fix).
- The way north from the marker passes **west of the bird hide** (the trail node 22.5,-10.5)
  and the "Ken je roep" bench (22,-6.5): there is no room between the hide and the water.

**Next missions, by playing the story order** (seeded saves; the wayfinding chip names the
next one): after the four adventures → **De kikker in het ven** (31 m); + ven →
**De oversteek** (ecoduct); + ecoduct → **Het stille zand** (stuifzand); + stuifzand →
**De nachtronde**; then vos, herstel. Today `storyOrder` puts the adventures first **in the
order of `AREA_VELUWE.missies`**, so making the ven an adventure would put it BEFORE the
eekhoorn (array: frisling, ree, wildcamera, ven, ecoduct, stuifzand, nachtronde, eekhoorn, ...):
the order must follow the registry instead.

**De oversteek today**: the marker stands in the bos by the ven (19,-24), **55 m from the
real ecoduct** (landmark -70,6 on the west rim). Corsi = seven mossy stones on bare dirt that
glow in order (3 clicks); then three cards (the flip "Het ecoduct is vrij" FIRST, then an
adder and a puddle "on the ecoduct": the same three ideas as the ven). 26 s. The ecoduct
landmark itself is a green vegetated hump with dark arches, solid (box 15.5 × 15.6 m); from
its east mouth (-58,3) a child does not read it as a bridge; nothing crosses it.

**Het stille zand today**: the nightjar sits **in plain sight** (and near black) between
heather clumps, prints straight to it: 1 click. Wisselen = a signpost and an animal on a
stump whose name tag carries its answer ("🌙 Nacht-dier"): **read, not played**. 29 s.
The drift sand (8..28, 18..34) is pale, flat and bare: a few junipers (24,20)(16,30), a
boulder (30,26), dry grass tufts; the roaming boar's loop (10,36) r 6 north of it.

**The bar** (frisling ~2-2.5 min, ree ~1.5-2 min, played via missions.spec, beat shots
looked at): one line per beat, the follow camera on walks, one calm framed move per framed
beat, the animal established before it matters, body moments instead of cards, the
family visible before and after. The two dark boars and the black roe roamer are the named
render fix (FOUNDATION), not this lane's.

**Too easy / too hard / read instead of played**: all three later missions are too easy
(found in one click, cards whose right answer is obvious) and read instead of played (cards,
category chips). Nothing is too hard. Nothing varies except the classic corsi route and the
wisselen queue (`Math.random`).

## 2. The bar for a new adventure (what "as good as the frisling" means here)

1. **In the world, with the body**: 2-3 minutes for a child; at least three things he does
   with his feet or hands (a walk with a twist, a keep-still or keep-away, a go); no card
   left in the world (the 2D floor still asks them as cards).
2. **At the real place**: the ven at the water, the ecoduct at the ecoduct, the nightjar on
   the drift sand. The home is dressed so the place reads (moss, sedge, sand bed, dunes).
3. **Established before it matters**: the frogs are heard before the mission, the animals
   that cross come from somewhere, nothing pops into view (things a play lays out are laid
   under the briefing card, out of view).
4. **Different every play** (decision 1): at least four independent draws per play from
   `k.play` forks (where the animal is, which station holds what, the order, which animals
   come, the light), each pinned by a unit test, none of them changing a knob.
5. **Grows with him** (decision 2): every difficulty number comes from `k.knobs(engine)`;
   the home maps knobs onto the world and never invents its own.
6. **Something to discover** (decision 3): ≥ 4 discovery rows per home, ≥ 1 `zeldzaam`,
   recorded only when really seen or heard.
7. **Measured the same as the 2D floor**: same builders, same cores, same summaries.
8. **Playable by golden's player** (missions.spec): every beat registers a walk hint, a
   click hint or null (keep still); golden itself untouched.
9. Alvah's contracts: calm camera, never scary, ≤ 7 words a line read aloud, ≥ 56 px
   targets, < 150 draw calls, laptop first, iPad works, save only via core/state.ts.

## 3. De kikker in het ven: what it is like to play

### 3.1 The home (always there, before and after)

The **north bank** of the ven becomes a wet-heath shore: a narrow trodden **shore path**
along the top of the bank (~19-20 m from the centre, dry), **heather** on the land side of
it, and down the slope to the water three **bays**: small coves where the world's cattails
give way to **pijpenstrootje/sedge tussocks, white cotton-grass tufts, cushions of
veenmos** (bright green, ochre, a little red) and a few cattails at the water line. The
heikikkers live in the bays: in free roam you hear their soft, bubbling call ("woog woog")
when you are within ~20 m of a bay, and little rings spread on the water where one calls.
After the mission one frog sits in plain view on a moss cushion at the middle bay, calling.

```
                  heather · · · · · · · · · · · · · · · · · · · · · · ·
   bird hide   ═══ shore path ═════ S1 ═══════ S2 ═══════════════════════  (dry, r≈19-20)
   (26,-11)      \      bay A          bay B          bay C       (water line r≈12-14)
   marker ○       \       ~~~            ~~~             ~~~
   (24.5,-19)      ~~~~~~~~~~~~~~~~~~~ the ven ~~~~~~~~~~~~~~~~~~~~~~~
```
(S1, S2: the two stations where this play's adder and soft moss lie.)

### 3.2 One play, beat by beat (~2-2.5 min)

| # | Beat | What he sees and does | Line (draft, plain) | Measures |
|---|------|------------------------|---------------------|----------|
| 0 | Briefing | Bram's card; under it the play is laid (bay, stations, adder) | "Bij het ven roepen de kikkers." "Eén zit verstopt bij het water." "Kun jij hem vinden?" "Kijk goed waar je loopt." | |
| 1 | Look | one calm look across the water at this play's bay: rings where the frogs call, their call | "Hoor je de kikkers?" | |
| 2 | Follow (walk) | he walks round the hide onto the north bank toward the sound; the chip says "De kikkers" with an ear; **running silences them** ("Sst. Nu zijn ze stil."), standing still ~1.2 s and they call again; at `trailLegs` points they fall silent by themselves: "Sta stil. Luister." and answer when he is still | "Loop naar de kikkers." | zoeken trail (knobs only) |
| 3 | Station 1 | this play's first rustkracht moment (adder, soft moss, see 3.3) | | dagnacht 1/3 |
| 4 | Walk on | along the shore path | | |
| 5 | Station 2 | the second moment; the dry path (the flip) comes right after the first or the second | | dagnacht 2-3/3 |
| 6 | At the bay | he stops above the cove: "Sta stil. Luister." the frog he will find calls once, rings by it | | |
| 7 | Search | the lens holds over the cove: the frog dead still at the water line between sedge and moss; look-alike moss clods, a butterfly on cotton-grass, a stonechat on a reed; click him | "Waar zit de kikker? Klik op hem." / miss: "Hier niet. Zoek verder." / hint: "Luister. Hij roept." | **zoeken** |
| 8 | Fact | the raaf: he sits still so birds don't see him | | |
| 9 | He sings | closer, the frog on the moss: "Sta stil. Hij gaat zingen." He keeps still ~1.5 s: the frog's throat pulses, three soft calls; frogs answer from the other bays (rings across the water) | | (unmeasured) |
| 10 | Reunion | the frog leaps into the water (plons, rings); the line over the world | "De kikker plonst terug het ven in." | |
| 11 | Fact, reward | the raaf: what a ven is; the reward | | |

The search is the climax, not the start: the rustkracht moments are the way to the frog.

### 3.3 The three body moments (no card in the world; the 2D floor keeps the cards)

All three use the SAME `DagnachtRun` trial (one `choose(false)` per encounter however often
he errs, `choose(true)` once), in the trial's order (see 3.4).

- **`adder-ven`, keep your distance (FEET, a room hold)**: "Een adder ligt in de zon." The
  walk to this station ends ~6 m before her; one calm framed shot from the side (him and
  the coiled adder on the warm sand of the path) while the line is read, then the follow
  camera back and his feet free. He may wait, or walk round on the heather side, as long as
  he stays **≥ 3 m** from her: "Hou afstand. Wacht even." The hold wants `knobs.holdS`
  seconds (FOUNDATION's in-beat tempo adjusts it) with `knobs.tempts` temptations at seeded
  moments (never in the first 1.1 s): the frogs call from just beyond her; she lifts her head
  and flicks her tongue; (P2) a dragonfly settles on a reed by the path. Within 4 m she lifts
  her head (a cue, no impulse); **within 2.6 m** = the impulse: she raises her head and
  hisses softly, "De adder schrikt. Hou afstand.", he takes two calm steps back (input locked
  a moment), and the same moment comes back. Held: "Rustig zo. Je laat hem met rust." and she
  slides off the path into the heather (1.5 s, then hidden). Golden: null hint (keeps still).
- **`modder-ven`, walk round the soft moss (FEET, a walk choice)**: a carpet of bright green
  veenmos with a wet sheen lies across the path and down to the water. Coming within ~5 m:
  "De rand van het ven is zacht." His walk goes on (follow camera): **a boot in it** = the
  impulse: a squelch, brown water wells up round his boots, the moss quakes, "Je zakt weg in
  de modder. Loop eromheen.", he steps back out (input locked a moment) and walks on himself;
  **past it dry on the heather side** = right: "Goed. Je loopt om het natte stuk heen." The
  moss quivers when he is within 1.5 m of it (the cue that it is soft). Golden: the walk's
  `via` round the heather side. This is the ree pool's mechanic (`rust.answer` on a walk) on
  purpose (one construct, one way to play it), but the moss looks and behaves nothing like
  the pool.
- **`pad-ven`, walk on (FEET, GO, the flip)**: right after the moment before it: "Het droge
  pad is vrij. Loop maar door." Walking ≥ 3 m on along the path within `knobs.goWaitS` =
  right ("Precies. Hier mag je gewoon doorlopen."); standing still past it = the impulse
  held too long (the old rule): the frogs fall silent, "Dit pad is veilig. Loop maar door.",
  the moment again. Golden: a walk hint 4 m on along the path.

### 3.4 Three plays in a row (what changes, all from `k.play` forks)

| draw | fork | choices | pinned by |
|---|---|---|---|
| the bay the frogs call from | `bay` | A, B, C | `ven.places.test.ts` |
| where in the bay the frog sits | `spot` | 2 authored spots per bay (6 searches) | test: dry water line, partly visible, off centre |
| the order of the three moments | the trial's own (`rustPlan`) | [adder, pad, modder], [adder, modder, pad], [modder, pad, adder], [modder, adder, pad] (flip never first) | engine test + `venLayout` test |
| which station holds the adder / the moss | follows the order (1st danger at S1, 2nd at S2) | 2 kinds × 2 stations per bay route | test per (bay, station, kind) |
| the adder's exact spot and coil turn | `adder` | ± 1.2 m along the path, yaw | test at both extremes |
| the decoy slots | the zoeken trial's seeded decoy set → the bay's authored decoy slots | ≥ 8 slots per bay | test |
| the light | `k.mood` (session; all five allowed) | | FOUNDATION's moods spec + this lane's search check in all five |
| (P2) ducks, dragonflies, butterfly, feather, rare | `life`, `k.rare()` | see 3.6 | |

So play 1 (seed A): misty morning; the frogs call from bay B; the adder lies at S1, the dry
path straight after her, the soft moss at S2; the frog sits on the left of the cove. Play 2
("Speel nog eens", seed A+1): same light (the session's); the frogs call from bay C, far
along the bank; the soft moss comes first, then the adder, then "Het pad is vrij" at the
end; the frog sits at the right edge of the cove under a tuft of cotton-grass; a duck with
five ducklings paddles past. Play 3: bay A, close to the hide; adder first and the moss
right after; the dry path last; a dragonfly; the frog that answers his singing frog is
bright blue ("Een blauwe kikker!"), a new page in the veldgids.

### 3.5 How it grows with him (FOUNDATION's knobs, mapped; never this lane's own numbers)

| knob (`k.knobs`) | in the ven |
|---|---|
| `zoeken.lookAlikes` | how many decoys the cove lays (moss clods, the butterfly, the stonechat; content decoys `r1-r5` = moss clods, `v1`, `b1`), from the trial's seeded set |
| `zoeken.glimpse` | how much of the frog shows through the sedge from the search's lens (`openWindow` for this play's spot, under the card) |
| `zoeken.hintAfterS` | seconds before he calls and the sedge over him quivers |
| `zoeken.trailLegs` | how many listening stops on the follow (2 at band 1 → 5) |
| `zoeken.trailClarity` | how loud and how often the chorus calls and how big its rings (clear: three calls and big rings; faint: one call, small rings) |
| `dagnacht.holdS`, `tempts` | the adder's hold and its temptations |
| `dagnacht.goWaitS` | the dry path's window before "Je wacht te lang" |
| `dagnacht.slowmo` | the adder's and the frog's reactions a little slower (band < 3) |

What he notices over weeks: more moss clods and less of the frog showing, the frogs call
less often and he stops to listen more, the adder takes longer to go and tempts him more, the
dry path wants him to go sooner. Up is celebrated on the reward card (FOUNDATION); down is
silent.

### 3.6 What he can discover (package P2; rows in `content/ontdekkingen.ts`, block `ven`)

| id | soort | plain name | when it is recorded | hint line (≤ 7 words) |
|---|---|---|---|---|
| `ven.heikikker` | dier | de kikker | quietly when the mission is won (the hero) | Wie zingt er bij het water? |
| `ven.adder` | dier | de slang | seen in her moment (≥ 40 px, ≥ 1 s) | Wie ligt er in de zon? |
| `ven.eend` | dier | de eend met jongen | the duck family seen on the water | Wie zwemt er met kleintjes? |
| `ven.libel` | dier | de libel | a dragonfly seen over the reeds (daylight moods, seeded chance ~0.5) | Wie vliegt er over het water? |
| `ven.heideblauwtje` | dier | het blauwe vlindertje | on the heather by the path (sunny moods, ~0.5) | Wie zit er op de hei? |
| `ven.veer` | vondst | een veer | a duck's feather on the bank, one of 3 spots (~0.4) | Wat ligt er op de oever? |
| `ven.blauwe-kikker` | zeldzaam | de blauwe kikker | `k.rare()` → one of the answering frogs at the end is sky blue, seen | Soms is een kikker heel even blauw. |

The rare comes from FOUNDATION's roll (seeded chance + pity: within ~3 plays of the ven).
Small surprises in the home (P2): a frog plops into the water as he passes a reed edge
(1-2 per play, seeded), a duck up-ends to feed, a duckling hurries after its mother.
(Research note: the blue colour belongs to a few spring days; the world shows no season,
the veldgids line says "heel even", the owner asked for it.)

## 4. De oversteek (the ecoduct): what it is like to play (package P3)

**Where**: at the REAL ecoduct (landmark (-70, 6), a solid box obstacle ~15.5 × 15.6 m,
rot ≈ 1.66 rad; its east face near x ≈ -62; the trail node 'ecoduct' (-60, 4) in front of
it; grove trees (-63,18.5), (-66,-6.5), (-70.5,18.5) and a fern prop (-61,4) beside it). The
marker moves east of its mouth (`marker.at` ≈ (-50, 6): ≥ 8 m from the fox's loop (-42,-2)
r 6, ~30 m from the herstel marker, ~27 m from the BOA post). The home: a raked **sand bed**
(zandbed, ~4 × 3 m, ≈ (-59, 6), clear of the fern) on the ground where the animals come
down past the ecoduct's end, with 7 look-alike patches of tracks (the corsi spots,
`PRINT_SPOTS` scaled uniformly), and ~5 m east of it a low wooden **wildlife screen**
(kijkscherm: a few planks with a slit, ≈ (-54.5, 5)) the ranger watches from. Look at the
ecoduct from every side first (the helicopter view helps): the model reads as a green hump
with dark arches, and its deck is NOT walkable ground (actors seat on `terrain.y`), so the
animals never walk on the deck: they come from behind its end (out of view, beyond the rim
side) down its flank's foot onto the sand bed, along trails dressed so it reads "over the
bridge". Rangers really rake sand beds on ecoducts to read who crossed: that is the story.

**Briefing**: "Een ecoduct is een brug voor dieren." "Wie steekt er vanavond over?" "Kijk
stil achter het scherm." "Onthoud welke weg ze lopen."

| # | Beat | What he sees and does | Measures |
|---|------|------------------------|----------|
| 1 | Look | one calm look at the green deck of the ecoduct | |
| 2 | Walk | quietly to the screen (~10 m; `quiet`: running gets "Sst. Loop stil.") | |
| 3 | Body: `stil` (FEET still) | behind the screen: "Er komt iets aan. Sta stil." The play's first group comes down off the deck; a step key or a tap = they stop, the lead animal lifts its head and stares at the screen; held = they come on | dagnacht |
| 4 | Route (corsi) | the lead animal crosses the sand bed spot by spot (each spot it treads lights its prints softly), the group after it, into the heath. "Welke weg liepen ze? Wijs het aan." He clicks the spots in order; a right spot: its prints glow; a wrong one: "Kijk nog een keer." and the route shows again (glow). Round 2: the second group crosses with a new route (one longer when round 1 was clean: `SpanRun`) | **corsi** |
| 5 | Fact | the raaf: thousands of animals cross here | |
| 6 | Body: `roep` (HANDS still) | the last animal stops by the screen and looks at him: "Hij kijkt naar je. Roep hem niet." A click on it = calling it: it startles, trots off a few metres, stops, comes back; held = it walks on | dagnacht |
| 7 | Body: `opzij` (GO, the flip) | a group waits at the mouth: the screen's trail is theirs: "Ze willen over. Ga maar opzij." Walking ≥ 4 m off their trail within `goWaitS` = right; waiting = "Je wacht te lang. Ze lopen terug.", again | dagnacht |
| 8 | Reunion | they cross past him into the heath: "De dieren staken veilig over." | |

Variety: which groups cross (`groups` fork: red deer (2-3), boar sow + piglets, roe doe +
calf, a fox alone; two groups a play), the corsi routes (the play's fork), the order of the
three moments (`rustPlan`, flip never first), which side the screen's slit faces (2
screens? no: one screen, the groups come down the left or right trail), the light (`moods:
{ allow: ['ochtendnevel', 'gouden-uur', 'bewolkt', 'schemer'] }`: animals cross at dawn and
dusk). Knobs: `corsi.start/max/rounds` (rounds = groups; ≥ 2), `dagnacht.holdS/tempts/
goWaitS`. Discoveries (≥ 4 + 1 rare): `ecoduct.edelhert`, `ecoduct.wildzwijn`, `ecoduct.ree`,
`ecoduct.vos`, `ecoduct.sporen` (spoor: the prints in the sand bed), rare `ecoduct.das` (a
badger trundles over at dusk/mist, seeded + pity). Content: the ecoduct's encounters are
re-themed to the crossing (`stil`, `roep`, `opzij`; the 2D cards follow; the old adder and
puddle cards went to the ven, where they belong). The old "Het ecoduct is vrij" flip first
in content order is gone (FOUNDATION's flip-never-first).

## 5. Het stille zand (the drift sand): what it is like to play (package P4)

**Where**: on the drift sand north-east of the spawn clearing, round its marker (8.3,20.4)
and east of it (≈ 10..28, 18..30), clear of the boar's loop (10,36 r 6: keep ≥ 8 m), the
stuifzand trail (spawn → (20,24): `distanceToNetwork` > LANE_HALF + 0.6), the junipers
(24,20) and (16,30) (r 1), the boulder (30,26) and the row of solids at (30.6..33.9,
17.2..19.1). Starting points: three nest spots ≈ (12.5,25), (18.5,27.5), (27,27) (≥ 6 m
apart, each ≥ 3 m beyond the trail's end node (20,24)); the guard place by the juniper (24,20): its burrow under the juniper's south side,
the open sand ~5 m west of it, the ranger's stand ~4 m south of the pair; the tyre tracks
come in from the north-east rim and pass ≤ 4 m from each nest spot (two routes). The home: low sand ripples (decals), dead pine twigs, pine cones and
bark pieces on the sand (the nightjar's look-alikes), buntgras tufts, a juniper with a
rabbit burrow under it ("het hol"), and the **tyre tracks of a car** across the sand (the
season's 'band' clue: "Een auto reed weg bij het ven."; they are there before the mission,
the story finds them).

**Briefing**: "Er reed een auto over het zand." "Daar broedt een vogel." "Hij lijkt precies
op het zand." "Zoek hem, maar loop voorzichtig."

| # | Beat | What he sees and does | Measures |
|---|------|------------------------|----------|
| 1 | Look | the tyre tracks over the pale sand | |
| 2 | Follow (walk) | he walks along the tracks (the `spoor`: they are the trail; `trailLegs/trailClarity` thin them out); near the nest a nightjar **flushes** up from the sand, flutters low dragging a wing ("Hij doet alsof hij gewond is.") and lands 8-10 m away: the other parent sits on the eggs near where it rose | zoeken trail |
| 3 | Search | the lens holds over the sand: the nightjar pressed flat on the bare sand among dead twigs, cones and bark (the look-alikes, the knobs' count); click it | **zoeken** |
| 4 | Fact | her feathers look like dead leaves | |
| 5 | Guard at dusk (wisselen) | he stands by the juniper, the open sand on one side, the burrow on the other; animals come past the nest one at a time (a roe, a squirrel, a badger, a boar, a nightjar...): "Waar gaat de ree heen?" He clicks the place; right: it walks there and settles; wrong: it stops, looks, and turns back, "Daar hoort hij nu niet." After `flipEvery` sorts the evening falls (the light turns, the nightjar churrs): "Het wordt avond. Nu is het andersom!" | **wisselen** |
| 6 | Reunion | the nightjar settles on her eggs; the male churrs in the dusk: "De nachtzwaluw blijft rustig op het nest." | |

The wisselen beat is the existing `aimBeat` (beats/aim.ts) with a drift-sand `AimWorld`:
`look` = he turns to the place and points, `photo` = the animal walks there and settles,
`empty` = it stops and turns back, `turn` = the light to dusk (`k.daylight` part way, or
`world.setMood('schemer')`); its card is the animal's picture and the question, the rule in
icons, **no answer tag on the animal** (today's "🌙 Nacht-dier" chip reads the answer: the
tag goes; the rule stays). Variety: the nest spot (3, pinned), the tracks' route (2), the
flush direction, the animal queue (the play's fork), the flip moment (knobs), the light.
Discoveries: `stuifzand.nachtzwaluw` (hero), `stuifzand.boomleeuwerik` (the woodlark singing
over the sand: model exists), `stuifzand.konijnenhol` (spoor), `stuifzand.mierenhoop`
(spoor, anthill prop), `stuifzand.eieren` (vondst: when she shifts, two marbled eggs seen),
rare `stuifzand.nachtzwaluw-vlucht` (the male's wing-clap display flight at dusk).

## 6. Technical approach (the ven; P3 and P4 follow the same recipe)

### 6.1 Files (lane-owned unless marked shared)

```
app/src/render3d/adventure/missions/ven.places.ts       pure: the places, the bays, the stations, the
                                                         layout of a play (venLayout), the knob maps
app/src/render3d/adventure/missions/ven.places.test.ts  the pins (6.4)
app/src/render3d/adventure/missions/ven.home.ts         THREE: the north bank dressing, the bays' cover,
                                                         the moss clods, the shore path, the soft-moss
                                                         carpets, the frogs' rings, (P2) ducks, dragonflies
app/src/render3d/adventure/missions/ven.ts              the script (the beats)
app/src/render3d/adventure/missions/ven.listen.ts       pure: the chorus core (ListenCore) + its test
app/src/render3d/adventure/registry.ts                  shared, additive: `ven: venAdventure` (after eekhoorn)
app/src/content/veluwe.ts (MISSIE_VEN block)            lane-owned: avontuur copy, slots + rustPlan, briefing
app/src/content/ontdekkingen.ts (block ven)             P2: the ven's discovery rows
app/src/ui/flow/WorldSession.ts                         shared, additive: storyOrder by registry order
app/src/render3d/world/Dressing.ts                      shared, additive: the reed belt skips homes' clearings
app/src/render3d/adventure/beats/choice.ts (+hold-math) shared, additive: `still(..., { room })`; `go` if absent
app/src/core/sound.ts                                   shared, additive: synths 'heikikker', 'adder' (+ 'eend' P2)
app/src/render3d/world/Residents.ts                     shared, additive only if absent: lay a play's pose
app/src/render3d/Coat.ts                                shared (FOUNDATION's dressing), additive: heikikker tint
```

### 6.2 The script (ven.ts), in kit calls

```ts
export const venAdventure: Adventure = {
  id: 'ven', home: VEN_HOME, clearings: venClearings(), dressing: (env) => new VenHome(env),
  prepare(world, mission, play) {          // under the briefing card
    const lay = venLayout(play, mission.stappen[1].skin, store.knobs('dagnacht'));  // pure: bay, spot, order, stations
    (world.residents.dressing('ven') as VenHome).lay(lay, trialDecoys(...));        // moss carpets, adder, decoys, glimpse window
  },
  unprepare(world) { (world.residents.dressing('ven') as VenHome).lay(null); },
  async play(k) { await story(k); },
};
```
- `venLayout(play, skin, diff)` builds the dagnacht trial with **the same builder and fork
  `ChoiceRun` uses** (read `beats/choice.ts` on integration: e.g. `buildDagnachtTrial(skin,
  diff, play.fork('dagnacht'))`), so the world's stations follow the trial's order; a unit
  test asserts `venLayout(...).order` equals `new ChoiceRun(fakeKit, 1).trial` ids for seeds
  1..30.
- Story order: `look` → walk legs with the listen core (`k.walk` + `tick`; listen stops are
  `k.until(stillFor(1.2))` with `k.hint(() => null)` while they last) → the moments in
  `rust` order at S1/S2 (`rust.still(id, { room })`, the walk's `tick` + `rust.answer`,
  `rust.go`) → `rust.done()` → the bay → `searchBeat(k, 0, {...})` → `k.fact(0)` → the
  singing → `k.reunion(...)` → `k.fact(1)`.
- `searchBeat` options from the knobs: `glimpse: k.knobs('zoeken').glimpse`, `hintAfter:
  k.knobs('zoeken').hintAfterS`, `lyingH: SIZE.heikikker.h`, `call: 'heikikker'`, decoys =
  this play's moss clods + StandDecoys' butterfly/stonechat (non-'bush' content decoys).
- Never `Math.random` in a ven file (review greps it). Every choice: `k.play.fork(name)`
  and `k.play.note(name, value)` (`bay:B,spot:1,order:adder-pad-modder,adder:+0.6`).

### 6.3 The north bank (ven.home.ts)

- **Clearings** (`venClearings()`): each bay's cove (r ≈ 3 m round its centre down to the
  water line), the two stations' path stretches, the shore path's line: the world's heather
  and grass scatter and (with the Dressing change) the world's cattails stay out.
- **The shore path**: a decal strip (pale trodden sand, ~0.7 m wide, wobbling) along the
  bank from the hide's north side to bay C; one or two draw calls.
- **Heather** on the land side of the path (instanced: `world/Plants.heatherGeometry` as a
  CoverField 'heath' or its own InstancedMesh), where the adder slides off to and the way
  round goes through.
- **The coves**: a CoverField (instanced, ≤ 3 draw calls for all three coves together)
  of tussocks ('grass', 0.5-0.8 m) and a few short fronds; cotton-grass heads (an
  InstancedMesh of small white puffs on thin stems, 1 draw call); veenmos cushions (groundDecal
  layers in moss green / ochre / a little red, ≤ 2 per cove); 3-5 home cattails per cove at
  the water line (instanced; never between the search lens and the frog).
- **The soft-moss carpet** (one per station, shown only when this play puts it there):
  bright green decal + a wet sheen layer + an `inBog(x, z)` ellipse test; it quakes (a vertex
  wobble or a scale pulse on its sheen) when he is within 1.5 m.
- **Moss clods** (the 'bush' decoys): frog-sized rounded lumps of moss/peat, instanced
  (1 draw call), on the cove's authored decoy slots; a click wobbles one (nothing there).
- **Frogs**: the hidden frog is a resident Actor (`kikker`, idle 'stand', tinted red-brown
  per research/animal-visual-accuracy.md §Heikikker); 2-3 chorus frogs per cove are heads at
  the water line (static meshes or one instanced proxy) with ring decals that spread when one
  calls. The rare blue frog is the same model with a sky-blue tint (P2).
- **The adder**: a resident Actor (`adder`, before: null in free roam, laid at its station
  under the card), coiled; head lift = a small pitch/raise of the coil, slide-off = a 1.5 s
  glide into the heather and hidden.
- Small things go in `env.detail(at)` groups; the home rests beyond Residents' distances; the
  whole home ≤ ~20 draw calls when near. `spread`: the three coves and the stations.

### 6.4 Places and their pins (ven.places.test.ts)

Starting points (verify by looking, then pin; θ from the ven centre (46,-19), +x toward +z;
the path at r 19.5 gives ~0.34 m of path per degree):
- shore path at r ≈ 19.5, from the NW corner (θ≈136°, ≈(29.5,-3)) east to θ≈40°;
- bay A θ≈90° (frog at the water line ≈ (46.0,-7.0), stand ≈ (46.0,-3.5)), bay B θ≈68°
  (frog ≈ (50.9,-7.0), stand ≈ (52.0,-4.2)), bay C θ≈45° (frog ≈ (56.3,-8.7), stand ≈
  (58.4,-6.6)); the water line = where `heightAt` meets `WATER_LEVEL` (r 12-14.6 here);
- S1 on the first stretch of the north path for every bay (θ≈128°, ≈(34.0,-3.6)); S2 per
  bay ~18-20° before its stand (A θ≈108°, B θ≈86°, C θ≈63°); S1-S2 ≥ 7 m, S2 ≥ 6 m
  before the stand; per bay route: marker → (22.5,-10.5) (west of the hide) → NW corner →
  S1 → S2 → the bay's stand (≈ 39 / 46 / 54 m).
- The world's five single cattail props (`Dressing` PLACES: (33,-8), (38,-4), (43,-2),
  (49,-2), (30,-13)) stand on this bank: no prop between a search lens and its frog, none in
  a carpet or on a station (move a station or a bay, never the props).
Pins (every variant, every bay × spot × station × kind):
1. Dry where he stands (`heightAt − WATER_LEVEL ≥ 0.2`), the frog spots at the water line
   (`0.02..0.3`), nothing he walks to blocked (not `r < 20 && height < WL + 0.15`).
2. Inside the world (< 68 m from the origin) and the north bank (not the south forest).
3. ≥ 10 m from every other marker (wildcamera, ecoduct, nachtronde, eekhoorn, vos,
   stuifzand); ≥ 4 m from the bird hide's footprint and the bench (22,-6.5); ≥ 8 m from the
   roaming roe's loop (44,12 r 6); clear of trees, props (`__ranger.dressing()`) and every
   other home's clearings (`frislingClearings()`, `reeClearings()`, `wildcameraClearings()`,
   `eekhoornClearings()`; and later ones).
4. The search: the frog partly visible from the bay's `SEARCH_VIEW` (`visibleShare` within
   `[glimpse·0.6, glimpse·1.6]` for every band's glimpse) and **off centre**
   (`offCentre(frame, target) ≥ 0.25`, FOUNDATION's helper); the frog ≥ 60 px wide on a
   1280×800 picture; the cover round it ≥ 2× its height; every decoy slot ≥ 0.35 m from the
   frog and from each other.
5. The stations: the adder on the path with a dry way round on the heather side keeping
   ≥ 3.2 m from her; the moss carpet across the path with dry `via` points round it on the
   heather side; the GO walk (≥ 3 m along the path) dry and clear.
6. Route length marker → stand 35-56 m; the look from the marker sees the bay over the water.
8. `places.home` = the after-pose of the frog on the moss at bay B (missions.spec checks the
   home's animals are within 4 m of it after the win, and the ranger ends ≤ 12 m from it).
7. `venLayout` is deterministic per seed and its order equals the trial's (above).

### 6.5 Shared changes (additive; every builder lists theirs in the report)

- `registry.ts`: add the ven after the eekhoorn.
- `WorldSession.storyOrder`: adventures in **registry order**, then the rest in `missies`
  order (a pure `storyOrderOf(missies, adventureIds)` in `core/patrol.ts` + a unit test:
  frisling, ree, wildcamera, eekhoorn, ven, ecoduct, stuifzand, nachtronde, vos, herstel).
  The first four keep their order (golden unchanged).
- `world/Dressing.ts`: the reed belt skips `this.clearings` (as `gridSpots` does).
- `beats/choice.ts`: `StillOpts.room?: { at: () => Spot; r: number; warn?: number }`: the
  impulse is his distance to `at` under `r` (his input stays free: the script calls
  `k.free()` first); `HoldCore` unchanged. `ChoiceRun.go(...)` + `GoCore`: reuse what the
  frisling/ree lanes landed (grep `GoCore` on integration); only if absent add it to the ree
  design's signature (`go(id, { line, away, waitS, toward?, wrong, right })`).
- `core/sound.ts`: `'heikikker'` (a soft low bubbling "woog", ~3 short notes), `'adder'` (a
  soft short hiss: band-passed noise, quiet, never sharp), P2 `'eend'` (a soft quack).
- `world/Residents.ts`: lay a resident at a play's pose under the card, only if FOUNDATION
  or the frisling lane has not landed one (grep `lay(` / `repose(`).
- Nothing in `golden.spec.ts`/`golden-lib.ts`; `missions.spec.ts` only if the generic loop
  needs a soft check (none expected).

## 7. Construct parity, per breinkracht

| breinkracht | 2D floor | the world | why they measure the same |
|---|---|---|---|
| Speurkracht (ven, stuifzand) | `buildZoekenTrial(skin, knobs, play.fork(...))` field | the same trial's decoy SET and COUNT laid on authored slots; the frog's spot from the bay's pinned spots | same builder, same `scoreZoeken`/`zoekSummary`, same `glimpse` (= 1 − haze), same hint delay; scored on the first click; misses on decoys only (plain cover is the empty ground) |
| Rustkracht (ven, ecoduct) | `DagnachtRun` cards in the trial's seeded order | the same trial and run; a card is a body moment (`still` hands/feet/room, `answer` on a walk, `go`) | each encounter: one `choose(false)` at the first impulse, `choose(true)` when held/done; the summary `{encounters, never-wronged, impulses, holdS}` |
| Geheugenkracht (ecoduct) | `SpanRun` over 7 spots | the same `SpanRun` over the sand bed's 7 look-alike patches (`PRINT_SPOTS`, uniform scale) | same supplier from the play's fork; the show = the lead animal's visits (round 1 of each group) or the glow reshow; recall right after; all 7 in one held view |
| Wisselkracht (stuifzand) | `WisselRun` bins | `aimBeat` with the drift-sand `AimWorld` (`WisselRun` through `AimRun`) | same queue, same turn rule, both places named and visible the whole time, the turn in two channels (light + card + voice), no answer tag on the item |
| Echokracht | (none in these three) | | |

Variety (bay, spot, stations, groups, nests, light, life) only changes where and what it
looks like; every difficulty number comes from `k.knobs`.

## 8. What I check when I review a package

Always: `RANGER_PORT=<p> npm run gate` tail line; `RANGER_PORT=<p> npm run golden` table
(ALL GREEN, golden untouched); `npx playwright test e2e/missions.spec.ts --grep "<titel>"`
for the mission (and one other adventure's test, for the shared changes); the unit tests it
adds; draw calls < 150 and triangles in budget in every beat; no `Math.random` in the
lane's files (grep); no new runtime dependency; an old save loads; every new string ≤ 7
words, read aloud, plain without jargon. Then I play it myself **three times in a row**
(fresh save, `?dev=1&seed=N` for a replay, and once with a seeded practised save at band 3+),
at 1280×800 with real keys and mouse, with mistakes (run on the follow, walk at the adder,
step in the moss, wait at the dry path, click a moss clod), and look at my screenshots:

- three plays differ in where, in what order and in what light; none plays the same way;
- the frog is found by looking, not by a trail; partly visible, never in the middle;
- every beat has one line and a cue in the world; the follow can be done by ear and eye;
- every mistake gets a calm reaction and the same moment again; nothing is scary (the
  adder is never at the lens, hisses softly, never strikes);
- walks use the follow camera; a framed beat moves the lens once, calmly;
- the 2D floor ("altijd 2D") plays the same encounters as cards in the same order;
- after the win the world shows it (a frog on the moss at bay B, the ✓ flag) after a reload.

## 9. Pitfalls (found while scouting; builders read these)

1. The world's cattail belt (`Dressing.scatterGlbPlants`) ignores homes' clearings: without
   the additive fix, world cattails stand in the coves and between the lens and the frog.
2. On the north bank the water line is 12-14 m from the centre, not at the water disc's
   20 m; compute the water line from `heightAt` vs `WATER_LEVEL`, never from a radius. The
   ranger can walk down to `WATER_LEVEL + 0.15`.
3. The follow camera behind him sinks into cattails at the water's edge: a stand must keep
   the lens's side of him clear (the home's own cattails only at the water line, never on
   the lens side).
4. The bird hide (solid, r 2.7) blocks the bank north of the marker; the way north is west
   of it, past the "Ken je roep" bench (22,-6.5), whose prompt is off in mission mode.
5. The roaming roe's loop (44,12) r 6 touches the north bank: keep ≥ 8 m away.
6. `storyOrder` follows `missies` array order today: the ven would jump before the eekhoorn.
7. The frog model is bright green: a moor frog is red-brown (research); the blue rare is a tint
   of the same model. At ~2-4× true size it is still small: keep the search frame tight
   (cove ≈ 2.4 × 1.8 m) so the frog is ≥ 60 px.
8. There is no frog, adder or duck call: add calm synths; `Sound` plays one call at a time,
   so a "chorus" is a sequence of single calls from different coves, never overlapping a
   spoken line.
9. Sound is the follow's main cue: it must also play muted (rings on the water, the chip's
   words; the arrow after ~20 s without progress, the kit's default).
10. `ChoiceRun.ask(id)` throws out of order: with a `rustPlan` use `next()`/the trial order;
    `prepare` must compute the same order (same builder, same fork) to lay the stations.
11. Things a play lays (the adder, the moss carpet, the decoys) are laid under the briefing
    card and taken back on `unprepare`; the stations are ≥ 15 m from the marker so nothing
    pops in view even without the card.
12. The listen stops and the adder's hold need a NULL play hint (golden's player waits);
    `registerPlayHint` is one slot: register null inside the walk (a `k.hint(() => null)`
    that the walk's own hint does not overwrite: end the walk leg first, or add an additive
    `WalkOpts.still?: () => boolean` to the kit).
13. The marker's 'animal' look puts a frog in the ring: use `look: 'none'`.
14. Don't edit `src/` while golden runs in the same worktree (Vite reload).
15. P3: the ecoduct prop is solid and its deck is not walkable ground: animals come down at
    its mouth, never walk on the deck (actors seat on `terrain.y`). P4: the drift sand is flat
    and bare: dress it, and keep the boar's loop clear.

## 10. Package plan

| id | what the player gets | depends on | size |
|---|---|---|---|
| `ven-world` | De kikker in het ven as an adventure on the north bank: the follow by ear, the three body moments in a seeded order at seeded stations, the frog in one of three coves, the singing frog, the reunion; storyOrder; the 2D floor in the same order | foundation:adaptive (rustPlan, knobs) | large |
| `ven-life` | the ven alive and worth coming back to: ducks with ducklings, dragonflies, a butterfly, a feather, the blue frog (rare with pity), small surprises, discoveries in the veldgids; every mood checked; growth tuned by playing three times at band 1 and band 4 | ven-world, foundation:veldgids | medium |
| `oversteek` | De oversteek at the real ecoduct: the sand bed, the screen, two groups crossing (the route = corsi), keep still, don't call, step aside; variety, knobs, discoveries | ven-life | large |
| `stille-zand` | Het stille zand: the tyre tracks, the nightjar's broken-wing flush, the search on the sand, guarding the nest at dusk (wisselen via aimBeat); variety, knobs, discoveries | oversteek | large |

They run one after another, each landed whole before the next starts. Priority if time runs
short: `ven-world` > `ven-life` > `oversteek` > `stille-zand`. After them (a later run): De
nachtronde (simon + wisselen at dusk: reuse the callers and the turn of the light, but at the
herstel heath's red deer rut, not a second wildcamera), De vos en zijn buren (simon at the
fox's den), De winterronde (the finale: corsi + dagnacht in winter).
