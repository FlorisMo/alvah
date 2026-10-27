# Run 7 · WILDCAMERA lane: every night a different night

> Lane lead's design, 2026-10-01 (branch `run7/lead-wildcamera`, scouted on run7/integration
> @ 1941214, port 5540). Read GOAL.md, STATE.md (2026-10-01), CLAUDE.md, ARCHITECTURE.md and
> design/run6-missions.md §4.3 first, and the run's STRATEGY.md (decisions 1-8, the run-7
> contracts). FOUNDATION's `state/foundation/design.md` is authoritative for the contract
> names (`k.play`, `k.knobs`, `k.discover`, `k.rare`, `k.mood`, the beat log); where it
> renames something, use its name. This file is the contract the builders build to and the
> lead reviews against. The final agent copies it to `design/run7-wildcamera.md`.

## 0. In one paragraph (player terms)

A wildlife camera is the most replayable toy a ranger owns: you hang it at the same spot
and every morning it shows you a different night. Today our camera shows the same night
every time: the same five animals walk in from the same two corners, the same four callers
call from the same four spots, the echo stops after two calls, the poacher crouches by the
same foxglove, and the light is always golden hour → blue night → dawn. After this run the
crossing stays the familiar stage (the pine, the open glade left, the thicket with the sett
right) and **who comes, how they come, who calls, where the man set his snare, the light
and the surprises change every play**. The child does every step with his own hands and
feet: he picks the camera off its stump, straps it on the pine, walks past it to test it
(and gets a photo of himself), watches each animal step onto the crossing and aims the
camera where it will go, echoes a night choir that grows with him, flips through the
night's photos himself, and finds the snare by comparing the photo with the wood. Some
nights bring something rare (a fox with her cubs, a white roe at dawn) or a funny
close-up, and the veldgids keeps them.

## 1. What I found (scouted 2026-10-01)

Played the mission four times with real keys and clicks at 1280×800 from the marker: three
fresh saves (one with a wrong aim and a wrong echo on purpose) and one practised save (all
five skills at level 3.6, 20 trials each, the four adventures done). Screenshots looked at
side by side; read wildcamera.ts/.places.ts/.home.ts/.photos.ts, beats/aim*.ts,
beats/callers*.ts, kit.ts, engines/simon.ts, engines/wisselen.ts, core/skill.ts,
core/state.ts, MissionFlow, the missions.spec loop.

**The same every play** (all four runs):
- The whole route and stage: marker stump → the same 12 m trail → the same pine →
  glade left, thicket right, the same view.
- The aim cast: always edelhert, ree, das, nachtzwaluw, wildzwijn (only the order varies);
  each animal always walks in from the same corner for its place (GLADE_ENTRY / THICKET_ENTRY).
- The flip: always after the 4th of 6 photos, always day → night, once.
- The night: always das (sett), wildzwijn (bushes), ree (glade edge), nachtzwaluw (log),
  same arrival order and delays (0 / 0.9 / 1.8 / 2.4 s).
- The morning: the same man by the same foxglove + juniper at (11.05, -19.8), the same
  walk back up the same trail, the same roe stepping into the glade.
- The photo clock (`CLOCK` lists) gives identical times; the light is always golden hour.

**Too easy / too hard:**
- The echo at level 1 is ONE sequence of two (`simonLengte` 2 → target 2): "ree,
  nachtzwaluw", done in 1.2 s. Two runs drew the same animal twice in a row
  ("nachtzwaluw, nachtzwaluw"; the practised one "das, ree, ree, wildzwijn, wildzwijn"):
  a two-call echo of one animal twice is a non-game.
- The practised save's aim round is IDENTICAL to level 1: content fixes `trials: 6` and
  `buildWisselTrial` caps `flipEvery` at `totaal - ceil(totaal/3)` = 4, so the flip comes
  after the 4th photo at level 1, 3.6 and up to ~4.8. Practice never shows there.
- The practised echo starts at 2 again and climbs 2 → 3 → 4 → 5 (four listens, ~35 s):
  "start where he is" does not happen.
- The snare: he walked past it on the way in; 11 m up the same trail; the chip names it.
- Not too hard anywhere; the small callers (badger ~30 px, nightjar ~25 px) are clickable
  thanks to the hit spheres.

**Read instead of played:**
- The aim card says "Daar komt een hert." and shows its tag BEFORE any animal is there;
  the animal walks in only after the click. He decides by reading the card.
- Four one-button actions: "Pak de camera", "Hang de camera op", "Bekijk de foto's",
  "Haal de val weg".
- The photo review is a slideshow on a timer; he only presses Verder at the end.
- Two raaf fact cards (kept: they are the veldnotities).

**Numbers:** ~2.5-3 min for a perfect player (155-185 s of adventure); 60-81 draw calls in
every beat; 0 page errors. One of three runs, the arrow-key walker took 239 s and 124 m on
"Loop terug naar je camera" (it circled the stump/sett cluster near `handBack` before it
got there): a flake risk for missions.spec.

## 2. The bar (what "done" means for this lane)

1. **Three plays in a row feel like three different nights**: different visitors, routes,
   callers, snare spot, light and (sometimes) a surprise, while the place stays familiar.
2. **The child plays, never only reads**: no `.adv-action` button left in the mission; every
   animal is SEEN before he decides about it.
3. **It grows with him**: a fresh save's first play is an easy win (6 photos, one flip; the
   echo grows past two); a practised save plays a visibly harder version of the SAME two
   exercises (more photos, more day/night turns; a longer echo that starts longer).
4. **Measurable**: the same pure cores and `BeatSummary` as the 2D floor, logged once each,
   with `{ level, score/span, seed, variant }`; the 2D floor keeps working with the same
   content.
5. **A reason to come back**: five things to discover at this home (two rare), with
   silhouettes + a hint line in the veldgids; calm reveals; no pressure.
6. Everything that made it Alvah's game stays: calm lens, never scary (the man is a calm
   grey figure; no wolf), ≤ 7 words a line read aloud, laptop first, iPad works, < 150 draw
   calls, golden and missions.spec play it through the play hints.

## 3. Three plays in a row (after all three packages)

**Play 1 (fresh save, level 1, a misty evening).** The camera lies on the stump; he clicks
it and picks it up. Along the trail, the roe in the glade lifts her head and slips away. At
the pine: "Hang de camera aan de boom." He clicks the trunk; the ranger straps it on; the
red light blinks. "Loop eens langs de camera." He walks across the crossing: flash, and the
first photo in the strip is HIM ("Klik! Daar sta jij."). Then the evening: a hind steps out
of the trees on the left and stops on the crossing, ears up. "Kijk, een hert." Sun tag.
He aims at the open glade; she walks there; click. A jay drops onto the trail from the
right; a wild boar trots in; a roe; then the light turns and it is night: "Nu is het
andersom!" A fox slips in from the right and waits on the crossing: night animal, so now
the open glade. Night: the badger comes out of its sett, a boar by the bushes, the fox at
the glade's edge, the nightjar on the old stump. They call: badger, fox… he calls them
back; "Goed zo! Nu komt er een bij." badger, fox, boar. Morning, mist between the trees. He
flips through the photos himself: himself, the hind, the jay, … and a boar's snout pressed
to the lens ("Wie is dat? Een neus!"). The last one: a man crouching by a birch and a big
stone. "Waar is dit?" He looks round, finds the birch and the stone on the deer trail
north-west of the glade, spots the wire loop in the grass and clicks it. Back at his camera a roe
steps into the glade. New in the veldgids: Jij op de foto, De vos, Een neus op de foto.

**Play 2 (the next day, golden hour).** Red deer stag, roe, jay, badger, nightjar, boar,
each arriving by its own way. Night: badger, nightjar on the log this time, roe in the
glade's middle, boar by the juniper; the echo starts at 2 and grows to 4. After the echo,
in the IR glow, a vixen trots across the crossing with two cubs tumbling after her: "Kijk!
Een vos met jongen." (rare; the photo is in the strip). Morning: the man by the foxglove and
the juniper up the trail he came along.

**Play 3 (overcast).** A stag, a hind, a roe; badger, fox, boar. Night: four callers in new
spots. The man is by a fallen log and a fern on the deer trail just north of the
crossing. At the reunion the roe that steps into the glade is WHITE:
"Een witte ree! Heel bijzonder." (rare; the pity rule makes sure a rare comes within about
three plays).

**Over weeks.** The echo starts at 2 and grows within the night while he succeeds; once he
wins easily at 2 it starts at 3, later at 4, the night choir grows to five callers at high
levels (if FOUNDATION's simon knobs say so). The aim round grows from 6 photos and one turn
to 8 and two turns (evening → night → morning) and later 10 with turns that do not come at
a fixed count. Up is celebrated calmly by FOUNDATION's reward; down is silent; never back to
two calls once he is past it.

**What he can discover here (five rows in the discoveries table):**

| id | kind | plain name | knap name | hint line (silhouette) | how |
|---|---|---|---|---|---|
| `wc-selfie` | foto | Jij op de foto | Jij op de wildcamera | Loop eens langs de camera. | the test photo, every play (new on the first) |
| `wc-vos` | dier | De vos | De vos | Wie sluipt er ’s nachts langs? | the fox is photographed or calls (in ~3 of 4 plays) |
| `wc-neus` | foto | Een neus op de foto | Een snuit op de foto | Wie komt héél dichtbij? | the funny close-up, seeded chance ~0.35 (forced on the 3rd play without one) |
| `wc-vosjes` | zeldzaam | Een vos met jongen | Een vos met welpen | Soms komt er een hele familie. | `k.rare('wildcamera')` → the fox family at night |
| `wc-witte-ree` | zeldzaam | Een witte ree | Een witte ree | Een heel bijzondere ree… | `k.rare('wildcamera')` → the white roe at the reunion |

Left out on purpose: **the wolf**. A wolf on a photo, on the night the child also meets a
man with a snare, reads as a threat to an 8-year-old; the owner said to leave it out unless
it reads calm, and the fox family and the white roe carry the "rare" job without that risk.
If FOUNDATION's `k.discover` can keep an image, the `foto` and `zeldzaam` rows carry his own
photo (a ≤ 12 KB 160×100 JPEG); otherwise the veldgids shows the drawn picture.

## 4. What changes every play (the variety), all drawn from `k.play`

A new pure module `missions/wildcamera.variety.ts` (THREE-free) draws one
`WildcameraPlay` record at the start of each play from `k.play` (decision 1: never
`Math.random` in a wildcamera file). Everything below is construct-neutral: it never
changes how hard a breinkracht is (only the level does), and every variant is pinned by a
unit test as equally readable.

| What | Variants | Package |
|---|---|---|
| The evening's visitors (aim cast) | content pools: dag `edelhert, hinde, ree, gaai`; nacht `das, nachtzwaluw, wildzwijn, vos`; the pure trial builder draws from them with the play's rng (3 of 4 each at 6 photos) | P1 |
| How each visitor arrives | from the LEFT (out of the trees past the glade) or the RIGHT (past the thicket) along trail B, stopping at one of three stop spots on the crossing (`STOPS`: left-middle, middle, right-middle); side and stop drawn independently of the place it must go to | P1 |
| The night choir | the badger always (its sett) + 3 of `wildzwijn, ree, nachtzwaluw, vos`; each in one of its allowed slots from a pinned set of 7 (`CALLER_SLOTS`); arrival order and small delays seeded | P1 |
| The camera's clock on the photos | a running clock from a seeded start (17:20-18:10), minutes added per photo, a jump at each turn | P1 |
| The snare's spot | three pinned spots, each with its own two landmarks that always stand in the world: S1 foxglove + juniper up trail A (today's, (11.05, -19.8)), S2 birch + boulder on the west leg of a new deer trail C (≈ (1.5, -23.5)), S3 fallen log + fern on trail C's east leg (≈ (6.0, -24.0)); never the same spot twice in a row when the last play is readable from the beat log | P2 |
| The night's surprises | the funny close-up (a boar's snout at night or a jay at the lens by day), seeded ~0.35; the rare of the play from `k.rare('wildcamera')` | P3 |
| The light | the evening from `k.mood` restricted to evening moods (golden hour, overcast, misty); the night stays the wildcamera's own readable blue; the dawn misty or clear; the mission's end restores the session mood | P3 |

**One crossing, not several.** I weighed varying the camera tree or the crossing's layout
and chose not to: the camera on the pine's north face can only see the north half of the
wood, every new layout needs its own glade, thicket, sett, perches, caller spots and views
pinned, and real trappers keep their camera at the same spot precisely to see who comes. A
familiar stage with different visitors, light and surprises IS the fantasy, and it is far
less risky than a second crossing.

**Why the snare spots are where they are.** The morning photo is taken by THIS camera, on
the pine's north face: a spot south of the pine is behind its own trunk. West of the glade
is the reekalf's ground (its hide at (-7.5, -26.5), 9 m from the glade). East of the
thicket the ecoduct (19.1, -24.4) and nachtronde (20.8, -34.2) markers are too close. So
the three spots are north of the pine, on three different bearings from the camera (so no
photo shows another spot's landmarks behind the man): S1 up trail A (today's, bearing +23°,
12.9 m from the camera), and two on a new short deer trail C that leaves the glade's north
edge, winds north and then east and joins trail A near (9.9, -23.6): S2 ≈ (1.5, -23.5)
(bearing -29°, 9.3 m, 9.5 m from the ree hide) and S3 ≈ (6.0, -24.0) (bearing 0°, 7.7 m).
All three are bos, 5-15 m off the sand paths, 5.8-10.4 m from where he starts looking. The
builder confirms each by looking and pins it.

## 5. The beats, as they become (all three packages)

| # | Beat | What he does | Pkg |
|---|---|---|---|
| 0 | Briefing | unchanged lines | |
| 1 | Pick up | "Daar ligt de camera." He CLICKS the camera on the stump (3D target, hit sphere ≥ 56 px); he steps beside it and lifts it (today's `pickUp`) | P2 |
| 2 | Trail | unchanged walk (the shy roe slips off) | |
| 3 | Strap on | "Hang hem aan de dikke boom." He CLICKS the pine's trunk at chest height (an invisible hit proxy where the camera will hang); he walks the last steps; `strapOn`; "Het rode lampje knippert." | P2 |
| 4 | Test | "Loop eens langs de camera." A walk hint to a spot in the camera's fan ~2.5 m out; when he is inside the fan within 4 m: flash, a photo of him joins the strip, "Klik! Daar sta jij." | P2 |
| 5 | Aim (wisselen) | each visitor steps onto the crossing FIRST and stands, side-on, at its stop spot; only then the card ("Kijk, een vos." + its tag + the question + the rule chips). Right place: it walks there, click, photo. Wrong place: the camera turns and clicks the empty place ("Leeg. Het dier is daar nu niet."), the visitor stays and looks up at the camera, same card again. Each turn of the rule turns the sky | P1 |
| 6 | Fact 0 | unchanged | |
| 7 | Night choir (simon) | four (or five) callers walk in from their sides to the play's slots; echo with FOUNDATION's adaptive length | P1 |
| 7b | Rare at night | (vosjes) the vixen and two cubs cross trail B in the IR glow, ~6 s, a night photo | P3 |
| 8 | Morning | the play's dawn | P3 |
| 9 | Photos | the review card: one big photo, "Verder" (and → / Enter) flips; each photo's own short line read aloud ("Jij!", "Een hinde.", "Wie is dat? Een neus!"); the man's photo last: "Kijk! Een man zet een val." then "Waar is dit?" | P2 |
| 10 | Fact 1 | unchanged | |
| 11 | Find the snare | "Zoek de val." The man's photo stays pinned top-centre (the strip, larger) while he searches; chip "De val · bij het paadje", arrow only after ~20 s; near the spot "Zie je de val?" and he CLICKS the wire loop in the grass | P2 |
| 12 | Back + reunion | walk back to the camera; a roe steps into the glade (the white roe on a rare play), click: "De camera bewaakt het bos." | P2/P3 |

## 6. Technical approach

### 6.1 The play record (P1, pure)

`missions/wildcamera.variety.ts`:

```ts
export interface WildcameraPlay {
  seed: number;
  /** per aim visitor, in queue order: the side it comes from and the stop it waits at */
  arrivals: { side: 'left' | 'right'; stop: 0 | 1 | 2 }[];   // drawn independently of the bin
  /** the night choir: animal id → slot id (CALLER_SLOTS), and the order they walk in */
  callers: { id: string; slot: string; delay: number }[];
  clockStart: number;               // minutes after midnight of the first evening photo
  snare?: 'S1' | 'S2' | 'S3';       // P2
  surprise?: 'neus-zwijn' | 'neus-gaai' | null;   // P3
  rare?: string | null;             // P3, from k.rare
}
export function drawWildcameraPlay(play: PlayRng, opts: { callerCount: number; queueLength: number; last?: Partial<WildcameraPlay> | null }): WildcameraPlay
export function variantOf(p: WildcameraPlay, beat: 'aim' | 'callers'): string   // the beat log's `variant`
```

`PlayRng` is the shape of `k.play` (`rng/pick/shuffle/chance/between`). The aim queue
itself is the pure core's (`buildWisselTrial(skin, knobs, k.play.rng)`), never the
variety module's: the variety only decides HOW each queued animal arrives.

### 6.2 Aim: the animal first (P1, `beats/aim.ts` additive)

- `AimWorld.arrive?(item: WisselItem, index: number): Promise<void>` (new, optional):
  awaited before each card (the first, each one after a right photo, the one after a
  turn). The hint returns null and picks are ignored until it resolves. Without `arrive`
  the beat behaves exactly as today (default keeps today's behaviour).
- `AimOpts.lines.kijk?: (id) => string` (new, optional): the card's first line once the
  animal stands there ("Kijk, een vos."); falls back to `komt`.
- The wildcamera's `arrive` places the actor (or bird) just out of view on its side, walks
  it along trail B to `STOPS[stop]` and faces it side-on to the lens; `photo` then walks it
  from the stop to its place spot (`aimSpot`) while the camera turns; a wrong place leaves
  it standing at the stop with a short look at the camera (`lookAt(CAMERA)`).
- The next visitor sets off while the photographed one walks out (overlap), so a right
  click → next card stays ≤ ~4.5 s (`k.stats.aim_card_max_s`, today 4.7).
- Birds (nightjar, jay) fly in and land ON the trail at the stop spot, then fly to the
  place's perch. The jay needs its own bird (today `home.bird` is the nightjar only):
  generalise `home.fly/birdGone/birdAt` to a bird id. The jay's `hol` perch is NOT the
  nightjar's stump (a second low perch in the thicket's front, pinned).
- Pinned (places test): the three stop spots are inside CROSS_VIEW, ≥ 1.6 m from the
  ranger's watch spot, not behind the pine, the juniper or the sett mound from the lens,
  not on the log, and ≥ 0.12 of the screen width from its centre; both arrival paths stay
  on or beside trail B; no arrival walks within 35° of straight at the lens; the arrival
  side is independent of the place (over 1000 seeds the share "comes from the side of its
  right place" is within 0.45-0.55).

### 6.3 New visitors (P1)

- `hinde` (red deer hind: the stag model without antlers, `spawn.ts` already maps it):
  rigged, the stag's poses and places; plain line "Kijk, een hert." (the picture shows no
  antlers), knap "Kijk, een hinde."; aim picture: the stag drawing without antlers. The
  2D floor needs it too: a `hinde` row in the content animals table (naam `hinde`,
  simpelWoord `hert`) and `ICON.hinde` + `NAME.hinde` in render2d/animalIcon.ts (additive;
  `vos` and `gaai` have both already).
- `gaai` (jay, `bird-gaai`, 0.3 m): a day bird, flies; by day on the glade's sunny patch
  (hopping), at night (rule turned) on its thicket perch; aim picture `jaySvg`.
- `vos` (fox, rigged, 0.52 m): a night walker; by day (the rule as it starts) curled
  asleep at the thicket's foot (`lie`), at night (the rule turned) out in the glade; aim
  picture: a drawn fox (aim-pics.ts,
  same style as the badger). A night caller too: `CALLS.vos` in core/sound.ts (additive):
  a short rising yelp, clearly unlike the roe's bark (e.g. `{ freq: 640, dur: 0.24, type:
  'triangle', notes: [640, 940], sweep: 1.3 }`; tune by ear).
- Each gets a `nobody` resident entry (hidden until borrowed), `PACE`, per-place spots in
  `aimSpot`, a photo framing that reads (its middle, ~1.6-2.3× its height in the frame).

### 6.4 The night choir (P1)

- `CALLER_SLOTS` (pinned, places test): 7 slots round the crossing with the animals each
  allows: `sett-l` (today's badger), `sett-r` (badger), `log` (nightjar; today's),
  `stump` (nightjar; NIGHTJAR_STUMP), `glade-edge` (today's roe), `glade-mid`,
  `bushes` (today's boar), `juniper` (left of the juniper, clear of it). A layout = the
  badger in a sett slot + three (four with five callers) others in distinct allowed slots.
- The drawer enumerates the legal layouts and the test checks EVERY one: all callers inside
  CROSS_VIEW, none occluded by the pine/juniper/sett/ranger from the lens, every pair
  ≥ 120 px apart at 1280×800, every hit sphere ≥ 56 px, none on another's way in.
- The simon trial's callers: content keeps `dieren` = the four classic callers for the 2D
  floor; a new optional skin field `roepPool: ['das','wildzwijn','ree','nachtzwaluw','vos']`
  is what the world draws from (same COUNT as the 2D floor = construct-neutral). If
  FOUNDATION's `buildSimonTrial` draws a subset of `knobs.callers ?? 4` from a pool with the
  play's rng, both views use that instead and `roepPool` goes.

### 6.5 Growth (P1, depends on `foundation:adaptive`)

- Both beats read FOUNDATION's knobs and the play rng (`k.knobs('wisselen'|'simon')`,
  `k.play.rng`) instead of `store.difficulty(...)` + `Math.random`. If FOUNDATION's adaptive
  package already threads them through `aimBeat`/`callersBeat`, P1 only maps them into the
  world; otherwise P1 does it additively in both beats (and tells the eekhoorn lane, which
  shares `callersBeat`).
- The wisselen world handles any queue length and any number of turns: each turn turns the
  sky (night ↔ day, ~2.4 s, a cut under reduced motion) with "Het wordt nacht." / "Het
  wordt dag." then "Nu is het andersom!" + the new rule; the clock runs on across turns;
  after the round, the night beat turns to night if it ended in day (exists today).
- The simon world handles sequences up to 6 and 5 callers: the listen pacing from
  `listenPlan`, the dots, a fifth slot. Longer nights are fine; nothing times out.
- Logged with every beat (FOUNDATION's beat log): `{ level, score/span, seed, variant }`
  with `variant = variantOf(play, beat)`, e.g. `aim:edelhert<L1,gaai>R2,…` and
  `callers:das@sett-l,vos@glade-mid,ree@glade-edge,nachtzwaluw@stump`.

### 6.6 Hands (P2)

- Pick up / strap: `pick3d` targets with `k.hint(() => ({ id, target }))`; the camera on
  the stump (its hit sphere), an invisible upright proxy on the trunk at `PINE.camY` (a
  thin cylinder `material.visible = false` that is the pick target and the hint target).
- Test walk: `k.walk({ name: 'test', to: TEST_SPOT, r: 1.0, reached: () => inFan(k.ranger()) })`
  where `inFan` is the pure fan test (camera heading, `FAN_HALF`, 0.8-4 m); the selfie is
  `home.photoCamera(ranger, 0.66, 1.6, 1.5)` developed by day.
- Photos: `PhotoStrip.review` becomes a flip book: one photo at a time, a "Verder" button
  (the shared screen's primary: Enter presses it; → too), each photo's line read aloud
  (`Photo.line`), no timer. The last (the man) shows "Kijk! Een man zet een val." and the
  button closes it. missions.spec's loop clicks "Verder" until the card is gone.
- The clue photo stays visible during the search: `PhotoStrip.pin(photo)` shows it
  top-centre at ~220×138 px with a soft frame (my files only, no AdventureHud change).
- The snare: `SNARE_SPOTS` (pure, pinned) each `{ at, approach, marks: [two landmarks],
  view }`; `showSnare(spot)`; when he comes within `SNARE_FOUND` the line "Zie je de val?"
  and a 3D pick on the snare (hit sphere ≥ 56 px); click → he walks to `approach`, the
  snare lifts and is gone, "Goed zo. De val is weg." All three landmark pairs are permanent
  world dressing (they never pop in; only the snare comes and goes).

### 6.7 Discoveries, rares, surprises, light (P3, depends on `foundation:moods`)

- Rows added to FOUNDATION's discoveries table (§3). `k.discover(id)` at the moment it
  happens; it shows FOUNDATION's calm reveal once.
- `k.rare('wildcamera')` once at the start of a play (it owns the seeded chance + pity).
  `wc-vosjes`: after the echo, before the morning veil, a vixen and two `vos-welp` cubs
  (spawned for that play only, disposed after) cross trail B in the IR glow, a night photo;
  "Kijk! Een vos met jongen." `wc-witte-ree`: the reunion's roe is a second roe actor with a
  CLONED pale material (never tint the shared material: the resident roe and the ree home's
  doe would turn white too); "Een witte ree! Heel bijzonder."
- The funny close-up: at night (boar) or by day (jay), one extra snapshot with the animal
  0.35-0.5 m from the lens, slightly soft; put in the review in its clock order with
  "Wie is dat? Een neus!".
- Light: `k.mood` restricted for the evening (golden hour, overcast, misty), the night
  forced to the wildcamera's own, dawn misty or clear; the photo develop meters each mood.

## 7. Construct parity, per breinkracht

**Wisselen (the aim).** The world drives `AimRun` over the SAME `WisselRun`, built by the
SAME `buildWisselTrial(skin, knobs, rng)` the 2D `WisselView` uses, from the SAME content
pools (the 2D floor shows the hind, the jay and the fox too: `animalIcon` has them).
What the variety changes is presentation only: which pooled animals the builder drew, which
side each comes from (independent of its right place: pinned), where it stops (three
equally visible stops: pinned). Both places stay named and marked the whole time, the rule
stays on the card's chips, every turn is cued in three channels (sky, card, voice), the
ranger never walks while he sorts, a wrong place is a recoverable retry of the SAME animal,
and the summary is `aim.summary()` logged once. "Animal first" changes when the card
appears, not what is asked: the 2D floor already shows the animal with its tag before the
choice.

**Simon (the night choir).** The world drives the SAME `SimonRun` from the SAME
`buildSimonTrial(skin, knobs)` as `SimonView`. The world's callers are a seeded subset of
the content's pool of the SAME COUNT the 2D floor shows (4, or `knobs.callers`), each with
a distinct call and place, all visible and well apart during listen and echo (every legal
layout pinned), light-up and call together (it plays muted), a wrong click replays the SAME
sequence, nothing else runs in between; the summary is `run.summary()` logged once. The
sequence's length, start and growth are the pure core's (FOUNDATION), so the world and the
2D floor adapt identically.

**The body moments** (pick up, strap, test, flip, find the snare) are not breinkracht
trials: nothing is logged for them, so no construct changes.

## 8. Pitfalls (found while scouting)

1. `randomCaller` may repeat an animal at once: a level-1 echo of "nachtzwaluw,
   nachtzwaluw". Ask FOUNDATION to avoid an immediate repeat at low levels (in the pure core).
2. `buildWisselTrial` caps `flipEvery` at `totaal - ceil(totaal/3)`: with `trials: 6` the
   flip is after 4 at almost every level. The visible-harder version needs a `trials` knob
   (6 → 8 → 10) and a cadence that reaches 2-3 (FOUNDATION).
3. `SimonRun.begin()` always seeds two: a practised player restarts at two (FOUNDATION).
4. The jay cannot reuse `home.bird` (the nightjar) and must not share its thicket stump.
5. More than one turn: `clockOf` keeps separate day/night counters; a second day phase
   would print evening times again. Use one running clock.
6. The white roe: tint a CLONED material, never the spawn's shared one.
7. The fox cubs and the white roe: spawn per play, dispose after; check draw calls (< 150)
   with the fox family and five callers in view.
8. The walk back to the camera: the arrow-key walker circled the stump/sett cluster near
   `handBack` once (239 s). P2 checks the walk back from every snare spot with `walkTo` in
   ≤ 25 s; move `handBack` or the hint's `via` if needed.
9. A rare and a resident roe at the same time: the reunion's white roe is a visitor that
   grazes and walks off; the after state stays the ordinary roe (missions.spec checks it).
10. Under "altijd 2D" / reduced motion the classic path plays: the new pools must read in
    `WisselView` (icons for hinde, gaai, vos) and `SimonView` keeps four buttons.
11. Don't edit `src/` while golden runs in the same worktree; stop your own vite only.
12. `aimBeat` is wildcamera-only, `callersBeat` is shared with the eekhoorn: every change
    there is additive with today's default, and listed in the report.

## 9. Requests to FOUNDATION (put in my plan's risks; the lead of FOUNDATION decides)

- simon knobs: a start length that rises with the level (2 → 3 → 4), growth within the beat
  while he succeeds (to a ceiling), a silent ease after a miss, no immediate repeat at low
  levels, optionally `callers` (4 → 5 at high levels).
- wisselen knobs: `trials` (6 → 8 → 10) and a flip cadence that visibly changes by level
  ~3.5 (e.g. every 4 → 3 → 2, irregular at the top).
- `buildSimonTrial`/`buildWisselTrial` take the play's rng; ideally `buildSimonTrial` draws
  a subset of `knobs.callers` from a pool.
- A read of this home's previous play variant (from the beat log) for "never the same snare
  spot twice in a row"; without it the drawer is plain random.
- Optional: `k.discover(id, { photo })` keeps a small image for `foto`/`zeldzaam` rows.
- `k.mood` with an "evening" set and a way for the wildcamera to keep its own night.

## 10. Package plan

| id | Package | Depends on | What the player gets |
|---|---|---|---|
| `wc-nights` | Every night different, and the echo grows | contracts (implied), `foundation:adaptive` | new visitors (hind, jay, fox) from the play's pools; every animal steps onto the crossing BEFORE its card; arrivals from both sides at three stops; the night choir drawn from five animals into seven pinned slots; the echo and the aim grow with the level (more photos, more day/night turns, longer echoes that start longer); a running camera clock; variant logged |
| `wc-hands` | The camera in his hands | `wc-nights` | no action buttons: click the camera, click the pine, walk past it for a photo of himself, flip the photos himself, find the snare at one of three spots by the photo's landmarks (the clue photo pinned while he looks) and click it |
| `wc-album` | The camera's album | `wc-hands`, `foundation:moods` | five discoveries (two rare: a fox with cubs at night, a white roe at dawn, with the pity rule), a funny close-up some nights, the evening and dawn light vary; the night stays its own |

Each package keeps golden green, its missions.spec wildcamera tests green (with two
different seeds), plays with real keys and clicks through the play hints, keeps the 2D floor
working (same content, same summaries), and lists every shared-file change.

**What I check in every review** (played myself at 1280×800 from fresh saves and a seeded
practised save, three plays in a row with three seeds, screenshots opened): the package's
acceptance list; `RANGER_PORT=<p> npm run gate` tail; `npm run golden` ALL GREEN;
`npx playwright test e2e/missions.spec.ts --grep "wildcamera"` (three tests) with two seeds;
draw calls < 150 in every beat; no `Math.random` in `missions/wildcamera*`; every new string
≤ 7 words and read aloud; nothing pops into view; the man's photo free of jeep, helicopter,
Benjamin and the ranger; the 2D floor (Instellingen → altijd 2D) plays the mission with the same
pools.
