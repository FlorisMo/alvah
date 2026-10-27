# State of the golden path

> Hand-written after playing. Each row: status, what a player experiences, how and when
> it was verified. Goal and steps: [GOAL.md](GOAL.md).
> ✅ works · 🟡 works with problems · ❌ blocks the player

## 2026-10-27: Benjamin's voice (voice/benjamin)

The mentor is now **Benjamin** (was Bram), and every line the game reads aloud is his
recorded ElevenLabs voice: 1,414 sentence clips in `app/public/voice/` (36.7 min, ~27,800
characters recorded). A text with any sentence unrecorded falls back whole to the browser
voice, and the dev server notes it in `app/scripts/voice-missed.txt` for the next
`npm run voice`. Played at 1280×800 on a fresh save, title to the first lesson: every
line came from a clip (10 played, the browser voice used for none), and the speaker strip's
highlight moved word by word in step. Checks: `npm test` "ℹ pass 1078 ℹ fail 0", tsc clean;
`anim` + `interact` "5 passed (3.4m)"; `readaloud` + `readcoverage` + `veldgids` "7 passed
(7.4m)". The full e2e suite was stopped at 69/121 on the owner's word (the specs it reached
passed but for `anim` and `interact` under load, both green on the rerun above).

## 2026-10-06 14:55: after run 7 (run7/integration; every check ran on 2b43aa5, and only docs changed after it; played by hand on a fresh save + screenshots looked at)

**The golden path is ALL GREEN, and every adventure is now a different little expedition
each time he plays it: it grows with him and leaves something new to find.** Seven of the ten
missions are adventures in the world: the four from run 6 and, new, *De kikker in het
ven*, *De oversteek* and *Het stille zand*. The last three (*De nachtronde*, *De vos en zijn
buren*, *De winterronde*) are still staged mini-game patches. All checks ran on 2b43aa5
(2026-10-06, 13:25-14:02): `npm run gate`: "# pass 1074 # fail 0", then "4 passed
(19.8s)". `npm run golden`: "ALL GREEN: the golden path plays start to finish" (1 passed,
4.5 min). `e2e/missions.spec.ts` (all ten missions at their real markers, plus the
practised, body, 2D, reduced-motion and missiebord cases): "20 passed (26.9m)", with no
quality, triangle or draw-call soft failures. Deploy smoke the CI way (`CI=1 npm run
e2e:smoke`): "4 passed (1.6m)". iPad engine (`npm run e2e:webkit`): "4 passed (24.6s)".
Root `npm run build`: "[build] Complete!" (21 pages). Run again on the final tree (docs
only since 2b43aa5), 14:49: the gate printed "# pass 1074 # fail 0", then "4 passed
(20.0s)"; the root build "[build] Complete!" (21 pages).

Played by the final agent at 1280×800 with real keys and mouse (each beat's play hint,
never a win hook), on one fresh save: the frisling, reekalf, wildcamera, eekhoorn and ven
in story order, then the frisling and the eekhoorn twice more each, then the veldgids and
three new visits. 9 plays, 0 page errors, draw calls ≤ 137, triangles ≤ 0.79M:

| # | Step | Status | What a player experiences |
|---|------|--------|---------------------------|
| 1 | Opening screen | ✅ | *Begin* after 4.9 s. The very first visit is the golden hour. Every later visit has its own light (ochtendnevel, zonnig, bewolkt, gouden uur, schemer), never the last one twice: three reloads in a row gave mist, sun, dusk. |
| 2 | Make your ranger | ✅ | Unchanged. Red hair and the blue jacket are measured on the 3D ranger. |
| 3 | Walk the world | ✅ | Walk 2.2 m/s. Shift runs 4.2 m/s, and now it looks like running (a lean, pumping arms, dust on sand). Free roam has small surprises: a buzzard gliding low, a woodpecker drumming, a cuckoo in the mist, now and then a stag or a badger. Each one is a veldgids row. Distant animals read as brown fur in every light, never as black cut-outs. |
| 4 | Jeep / helicopter | ✅ | Unchanged (15.4 m in 3 s; lands 0 m from the pad centre). |
| 5 | Go to mission 1 | ✅ | The chip and the marker. The mission starts after 2 clicks. |
| 6 | Mission 1 games | ✅ | *De verdwaalde frisling*, a new expedition every play (below). Golden won it in 139 s, with draw calls ≤ 138. |
| 7 | Finish mission | ✅ | The reward card says what grew ("Je breinkrachten groeien.", "Je Echokracht groeit."). A drop is never shown. The first win drops the cut-fence clue; a replay skips the fence look he already saw. Each fact card comes from a pool of three per step, never one he has read. |
| 8 | Back in the world | ✅ | The next mission is offered. Story order: frisling, reekalf, wildcamera, eekhoorn, ven, oversteek, stille zand, nachtronde. A finished mission replays from its ring with a short card: its title, one line and *Ga op pad*. |

What changes every play, how it grows and what there is to find (seen in my plays unless
marked "spec"):

- **De verdwaalde frisling** (zoeken · corsi · rustkracht, 2.5-3.5 min). *Varies:* the
  squeak leads one of three ways (wei, steen, berk; never the same way twice in a row) to
  that way's bracken stand. The piglet lies in one of five nooks with his striped flank to
  the lens, never in the middle. In my three plays: berk, 184 px off the middle, golden
  hour; steen, 142 px, overcast; wei, 173 px, golden hour. The look-alikes, the family's
  layout at the mud and the order of the five calm moments are drawn per play (advzp, advpz,
  avdzp). No answer cards are left: hands still (aaien, voeren), walk slowly with the tired
  piglet (dragen), feet still at the sow's stare (zeug), walk on when the path is free
  (pad). *Grows:* zoeken went from level 1 to 4 to 5 over my three plays (less of him shows,
  the hint comes later, the prints are fainter). The corsi route grew 4 → 5 → 6 over 2-3
  rounds, the holds 3.5 → 5 → 5.5 s. *Finds (7):* the sow, the yearling, the piglet, the
  woodlark, the rubbing log, the bed of bitten bracken, and the rare magpie on the sow. My
  save had 5 of 7 after three plays.
- **Het reekalf in het gras** (zoeken · rustkracht, about 2 min). *Varies:* one of three
  grass stands round the copse (never one of the last two plays'), each with its own path,
  search side and hide. The calf lies in one of four spots, never in the middle (221-232 px
  off it). The three calf moments come in a drawn order, and the pool lies on the way in or
  on the way out. The search lens hangs about 3.7-3.9 m up, with the boy small at the
  picture's edge (the owner's camera fix). *Body:* hands still while the calf peeps (aai),
  feet still while it sniffs his boots (geur), a step back with ↓ when it totters toward
  him (oppakken), round the pool, still in the watch, and walking away himself once the
  mother is back. *Grows:* less of the calf and more brown look-alikes; holds go from 4 to
  7 s with more temptations; the doe stops to listen up to three times. *Finds (7):* the
  doe, the calf, a woodlark, a buzzard, a cuckoo, a sapling a roebuck rubbed, and the rare
  twins.
- **De wildcamera** (wisselen · simon, about 2.5 min). *Varies:* which 3 of 4 day animals
  and 3 of 4 night animals come, and from which side. Each one walks on and stands still
  before its card. The night's four callers stand in new spots, the dawn's light changes,
  and the snare lies at one of three spots with its own two landmarks (never the last play's).
  *Body:* no buttons. He takes the camera off its stump, straps it to the pine, walks into
  its fan for a photo of himself, flips the night's photos, and finds the snare by
  comparing the man's photo with the wood. Every stretch between two rule turns has a day
  AND a night animal, so clicking one place every time never counts as easy. *Grows:* the
  echo starts at 2, at 3 once 2 came easily, at 4 on a practised save, and grows to 7 in one
  night. The aim round grows from 6 photos and one turn to 8 photos and two. *Finds (6):*
  the badger, the fox, his own photo, a nose at the lens, and two rares: the fox with cubs
  and the white roe.
- **De verstopte nootjes** (corsi · simon, 3-4 min). *Varies:* the way through the pines
  (middle, north or south), the hide tree, the nest, the gnawed cones, the den, the antics,
  a second hide about 1 in 3, one small surprise, the moss field's mirror image, three
  neighbours from 18 trios, and the ending (in my plays: buries, grooms, eats). *Grows:* in my
  three plays the echo went 3-5 (level 2), 3-6 over four rounds (level 3), 4-7 (level 4); the
  acorns went 4-5, then 5-6. *Finds (10):* the squirrel, the jay, both woodpeckers, the
  nuthatch (from a later visit), the nest, the gnawed cones, the oak seedling (free roam,
  later), and two rares: the dark-brown squirrel and the young one. My save had 6 of 10
  after three plays and no rare yet.
- **De kikker in het ven** (new; zoeken · rustkracht, 1.5-2 min). He follows the frogs by
  ear along the north bank: run and they fall silent, stand still and they call ("Sta stil.
  Luister."). He keeps his distance from the snake basking on the path, walks round the
  quaking moss and walks on when the dry path is free. Then he stands still at a cove and
  finds the brown frog at the water's edge; it sings, the ven answers, and it plops back.
  *Varies:* the cove, the nook (never near the middle: 294 px off it in my play, 155 px in
  the spec), the order of the three moments, the light (never one of the last two plays'),
  the duck family and the small life. *Finds (7):* the frog, the snake, the duck with her
  ducklings, a dragonfly, the heath blue, a blue feather, and the rare blue frog. My first
  play found 5 of 7.
- **De oversteek** (new, spec; corsi · rustkracht, 3-4 min). Behind the screen at the
  ecoduct he remembers the lead animal's way over the sand patches, keeps still for a
  curious young one and for a group coming, and steps aside to let a family over. The
  groups, their order and the light change every play; the fox comes at mist or dusk.
  6 finds, including the rare badger.
- **Het stille zand** (new, spec; zoeken · wisselen, 2.5-3 min). He follows a car's tyre
  tracks, sees a nightjar fake a broken wing, finds her mate among look-alikes (134 px off
  the middle), guards the burrow and the open sand while visitors come (the rule turns at
  dusk), and steps back for a look at her eggs. 6 finds, including the rare wing claps; the
  woodlark comes on a later visit.

Across every game:
- **One seed per play** (logged with every beat; `?dev=1&seed=N` replays it). Variety
  never sets difficulty. Only his level per breinkracht does (`core/skill.ts`, 1-6, with a
  floor that rises), and the 2D floor reads the same knobs and plays the same order and
  summaries (construct parity; the ree's 2D order is the one exception, below).
- **Every beat goes into a bounded history**: level, span or score, seed, variant, and what
  its judgement read. Grown-ups read it in Instellingen → Groei.
- **The veldgids** (Pauze → *Open je veldgids*, and at the hut): a page per place plus
  *Overal op de Veluwe*, 56 rows. Each find shows its real picture; the rest are grey
  shapes with a read-aloud hint, and rares have gold dashed frames. A rare never comes on a
  home's first play or right after one; then it has a low chance, and it is sure by the 6th
  won play (the owner's ruling of 2026-10-05: spread over a few sessions). A run-6 save
  opens with the four rescued animals already in.
- **No line on screen is longer than 7 words**, and the facts come from pools (40 new ones,
  each also a veldnotitie).
- **Within budget at the world level:** far fields, props and ducklings are drawn as
  simpler copies. Free roam's worst views went from 1.13M triangles to 0.81-0.86M.

How verified: the checks above. I looked at golden's 38 screenshots and at the
missions.spec shots, and at the screenshots of my own 9 plays (the search pictures, calm
moments, reunions and reward cards), the veldgids's ten pages, and three visits' moods.

Still open (for the next run):
- **Owner calls.** Enter at a finished mission's ring starts the next mission (the child
  B6 ruling), and there is no *Nog een keer* on the reward card; with replay as the theme,
  both are worth a fresh look. Harder often means longer: my third eekhoorn play took
  254 s, and a cap per echo beat would change the simon tables of every echo home. Some
  growth steps change nothing he plays (corsi bands 2-4, simon 2-3, the eekhoorn's two
  mouthfuls); the owner kept the curve. From the reunion to the reward, the frisling's ending
  runs about 19 s when the piglets' chase fires.
- **Discoveries.** The frisling, ree and ven pages still fill most of their page on the
  first play (the ven: 5 of 7). Only their rare spacing changed. A rare that was rolled but
  not seen does not reset its counter. Once *Overal* is full, free roam repeats the same
  two calls. Het stille zand has no find bound to a mood.
- **Veldgids art.** Glyph icons instead of pictures, the yearling reusing the sow's
  portrait, 'De vos met jongen' showing a single fox, 'De neus op de foto' always showing
  the boar, the duck pale, the nightjar's generic icon.
- **Frisling.** The follow's prints read as pale specks. The berk stand's birch is a dark
  post at the top right. The fence-clue look glides over the family, and the sow can sit
  cut off at the bottom edge. Draw calls reach 145 on berk.
- **Ree.** Stand C's twin bed lies on open heath. The 2D floor plays the ree's cards in
  content order with no variant, and its header reads "Terug naar de groep". The
  end-of-walk card stop (0.8-0.9 s) has no play hint.
- **Wildcamera.** A near bramble and fern stand in front of the thicket's animal spot, so
  day animals sent there at night are photographed behind leaves. The night's stage shapes
  repeat across plays. The jay and nightjar visitors are 25-35 px tall. The man's photo is
  always 05:52 in the same blue dawn. The 2D floor names 'hinde' and 'edelhert' in the plain
  variant.
- **Eekhoorn.** The found view sometimes shows the squirrel's back (2 of 6 in its lane). At
  the den look a sliver of the ranger's hair sits at the picture's edge (my second play).
  The jay's own cache reads at about 15 px. The callers' view keeps one composition every
  play.
- **New adventures.** De oversteek is watched from the same screen every play, and no
  animal crosses the deck itself (that needs a walkable deck: a world build). Het stille
  zand's pictures show the helicopter pad, the jeep and the hut. The drift sand's beat
  order is the same every play. The nightjar's legs hang in flight.
- **Moods** read as tints near the ground (mist mostly shows far off). After a ree play in
  another mood, the sun stays at the play's height until the next briefing cut.
- **Kit.** A reveal card and a mission's line can talk over each other. In headless Chrome
  `speechSynthesis` can stay "speaking" for 84-182 s, holding back the reveal cards; check
  the cancel→speak sequence on the owner's Chrome and the iPad.
- **Harness, not the game.** Under heavy load golden's title soft check and its hair-colour
  read can fail. Golden's lead-home note reads about 0 m when the tired walk takes the lead.
  missions.spec can read the ree's lens mid-glide. The full `npm run e2e` (about 25 min) was not
  run. iPad touch and reduced motion were covered by `e2e:webkit` and the spec's
  reduced-motion case, not played by hand.

## 2026-10-01 14:00: after run 6 (run6/integration, code at fca89f3; played by hand on a fresh save + screenshots looked at)

**The golden path is ALL GREEN, and the first four missions are now games played in the
world with the ranger's own body** (walks with the keys, finds and picks with the mouse,
"keep still" moments instead of answer cards). All checks ran on fca89f3, 11:03-11:23:
`npm run golden` printed "ALL GREEN: the golden path plays start to finish" (1 passed,
4.0 min). All ten missions pass at their real markers (`e2e/missions.spec.ts`: "18 passed
(13.6m)"). Deploy smoke the CI way (`CI=1 npm run e2e:smoke`): "4 passed (1.3m)". iPad
engine (`npm run e2e:webkit`): "4 passed (21.7s)". `npm run gate`: "# pass 681 # fail 0",
then "4 passed (17.6s)". Root `npm run build`: "[build] Complete!" (21 pages).

Played by hand at 1280×800 with real keys and mouse, fresh save, ~25 min, 0 page errors,
draw calls ≤ 105 (the two playtesters saw peaks of 112 and 121; the cap is 150):

| # | Step | Status | What a player experiences |
|---|------|--------|---------------------------|
| 1 | Opening screen | ✅ | The spawn clearing at golden hour under the title; Enter presses *Begin*. |
| 2 | Make your ranger | ✅ | Skin, hair, jacket, eyes show on the 3D ranger. He is a real 8-year-old: 1.32 m beside Benjamin and the poacher (1.8 m); animals and plants at true size. |
| 3 | Walk the world | ✅ | Benjamin greets him by name, then the lessons are learned by doing (arrows, Shift). Walking 2.0-2.2 m/s, Shift runs 4.1-4.2 m/s (iPad: the stick at its rim); the lens stays ~5 m behind, FOV 55, no bob, no snap. A marker's animal stands beside its ring, never in it. |
| 4 | Jeep / helicopter | ✅ | Animals see the jeep coming and trot aside; it brakes for them and never touches one (driven at a roaming boar: it trotted off, closest 4.0 m). Benjamin suggests the jeep once when the next mission is far, and is quiet once he sits in it. Heli flies to a pad and lands. |
| 5 | Go to mission 1 | ✅ | Benjamin's hook brings the chip; Enter at the ring starts it. |
| 6 | Mission 1 games | ✅ | *De verdwaalde frisling*, one adventure (below). |
| 7 | Finish mission | ✅ | Reward with three breinkrachten, the cut-fence clue; the family of six stays at the wallow. |
| 8 | Back in the world | ✅ | By the family; Benjamin: "Volg de pijl linksboven." while the chip points to the reekalf (one next step); the story order is the four adventures first. Reload keeps all four homes "after". |

The four redesigned missions, as played:

- **De verdwaalde frisling** (~2-2.5 min, zoeken · corsi · rustkracht). One look at the
  family; follow the squeak ~32 m to a bracken stand; click the piglet's stripes (a miss:
  "Hier niet. Zoek verder."). Hands still while he squeaks (a click is a hand reaching: he
  scoots deeper, the moment comes back). Card: carry him, or walk with him. Lead him home
  ~31 m: Shift makes him dive into a clump ("Niet rennen. Dan schrikt hij." on every run)
  and he waits until you walk calmly back ("De big wacht op je." → "Rustig maar. Daar komt
  hij."), so a run never gains a metre. Watch the group's route over the rooting field and
  point it back. The yearling sniffs your bag (card: "Hou je tas dicht"). The sow looks at
  you, framed from their side so her stare reads: feet still (a step: she grunts and steps
  between). Card "Het pad is vrij" (the flip: now "Blijf staan" is the wrong answer, and
  the group shuffles on: "Je wacht te lang.").
  Reunion. 3 cards left, 2 body moments, ~45 s of walking.
- **Het reekalf in het gras** (~1.5-2 min, zoeken · rustkracht). Look at the doe, follow
  her slots, she slips into the copse; find the calf flat in the tall grass. Hands still
  twice by the calf (it peeps; it stretches its nose to your hand): a click makes it bolt
  and drop again, or the doe barks from the copse. One card (lost? → "Stil weglopen").
  Sneak ~11 m to the hide with a wet pool across the way: walking into it plashes ("Plons!
  Dat maakt veel lawaai."), he steps back out; round it: "Rustig eromheen." Watch through
  the binoculars (a step key: "Sta stil. Anders schrikt ze."); the doe steps out and noses
  her calf; card "Loop rustig weg"; the calf drinks. 2 cards of 5 encounters.
- **De wildcamera** (~2 min, wisselen · simon). Take the camera, follow the animal path
  ~12 m, hang it on the pine. Aim it at *open plek* (a sun sign) or *het bosje* (a moon
  sign) for six animals; after four the day turns to night and "Nu is het andersom!": the
  signs stay, so a night animal now goes to the sun's place, a real switch (a wrong place:
  "Leeg. Het dier is daar nu niet."). Night: the roe, the nightjar, the badger and the boar
  call from their spots; call them back. Morning: the trap's photo shows a man setting a
  snare (no jeep or helicopter in it); find the snare by the photo's foxglove and bush.
- **De verstopte nootjes** (eekhoorn, ~2-2.5 min, corsi · simon). The squirrel
  chatters from its stub; follow it tree to tree (it waits). Hide-and-seek: walk round the
  pine; whenever any of it could show it slips round the bark; found only once it is in
  view. Watch where it buries its nuts and point them back when it forgets. Meet the jay,
  the green woodpecker and the raven; call along so the jay leaves.

How verified: the checks above (their tails), golden's 38 screenshots and the ten
missions' screenshots looked at, and a hand play of the first screens, walk/run, the jeep
at a boar, and all four missions with mistakes (a miss, a wrong card, a run while leading,
a reach at the calf, a boot in the pool, a step in the watch, the old rule after the flip),
judged from screenshots.

Still open (for the next run):
- Little varies between plays: the piglet and the calf lie in the same spot every time,
  dead centre of the search view (found in ~2 s), and the rustkracht cards come in the
  same order. The corsi routes, the callers and the aim round's animals are drawn anew.
- The six later missions are still staged mini-game patches. The nachtronde's raaf stood
  behind a pine in 1 of 3 `missions.spec` runs; after the last fix (no staged game on
  another home's ground) the final run was clean, but the stage still tests its sightlines
  only to the patch's front row, so a caller at its back edge could still hide.
- Frisling: the follow starts facing the family and the first prints are faint; "pad" is
  still a card. After a reach the piglet is a sliver in the bracken; the stonechat decoy
  reads as a black stick from above; the yearling walks through the mossy log.
- Ree: the watch holds one line ~16 s; the reunion is small and far.
- Wildcamera: "Daar komt een hert." before any animal shows (it walks in on the pick); four
  one-button actions. In both callers rounds a first play ends after two calls (level 1).
- Eekhoorn: the first wait is a small squirrel ~9 m off and its stops read 15-25 px;
  "Gevonden!" with it ~25 px; one leap starts out of frame.
- Jeep: boarding from its front swings the lens ~168°. Home animals ignore the jeep (only a
  stall line). Running looks like walking (same framing, no dust or arm swing).
- Load: triangles reach ~0.94-0.99M of 1M where several homes are in view; frames of
  100-330 ms at a home's edge and at each trap photo, measured only under heavy laptop load.
- Small polish left: the 2D floors' emoji (simon, wisselen), some consequence lines run to
  two lines, the heli view blocked in 1 of 11 golden samples.
- The full `npm run e2e` (~22 min) was not run.

## 2026-09-27 13:50: after wave 4 (merged main; played + screenshots looked at)

**The golden path is ALL GREEN: 8 of 8 steps pass, no quality failures**
(`npm run golden`). All ten missions pass at their real markers (`e2e/missions.spec.ts`
15/15). The deploy gate passes the CI way (`CI=1 npm run e2e:smoke`, software GL +
production build: 4/4 in 1.4 min). `npm run gate` green, 491 unit tests.

What wave 3's four fresh-eyes testers found and wave 4 fixed: the wayfinding arrow no
longer loops (a route guide along the sand paths), a mission picked on the missiebord
brings you to its marker, *Stop de missie* keeps the marker, pause/board/briefing stop
the arrow keys, the jeep slides off the ven shore, the world continues past the rim
(forest, no plate edge), the chase camera fades the trees round the jeep, the camera
never dives onto his head at the rim or the cabin, one crown model for camera + forest,
animal calls are one short calm snippet at a time, every screen reads aloud, wisselen
speaks its rule, pictures match their words, software GL boots a light mode, and the
title survives a return from the pause menu without leaking GPU memory.

Still open (small): the *Onderweg* world-beat card has no Enter target; the 2D bird
bench's own timers don't stop on *Stop*; distant marker labels can overlap; the jeep's
collision list is copied every frame; the full `npm run e2e` suite (~22 min) was not
re-run after the final merge.

## 2026-09-27 07:00: after wave 2 (`npm run golden` + `missions.spec` on main, screenshots looked at)

**Golden: 7 of 8 steps pass, nothing blocks the player.** All ten missions pass at their
real markers with real clicks (`npx playwright test e2e/missions.spec.ts`: 15/15, incl. the
season finale, the 2D floor, the bird bench and a mission started from the missiebord).
Root `npm run build` (the deploy build) is green.

| # | Step | Status | What a player experiences |
|---|------|--------|---------------------------|
| 1 | Opening screen | ✅ | Warm heath with real heather and grass tufts; ~260k triangles. |
| 2 | Make your ranger | ✅ | Skin, hair, jacket and eyes show on the 3D ranger (world, maker preview). |
| 3 | Walk the world | ✅ | Tank keys: ↑ walks, ↓ backs up, ←/→ turn; the camera settles within ~6° of a release and never swings to face him. Drag to look, click to walk, solid buildings. 0.25–0.46M triangles. |
| 4 | Jeep / helicopter | ✅ | Jeep faces forward, driver seated, soft collisions, faint tracks, clear key hint. Heli flies to a pad and lands on it. |
| 5 | Go to mission 1 | 🟡 | Works; the view of the ranger was briefly blocked in 5 of 150 samples on the walk. |
| 6 | Mission 1 mini-games | ✅ | zoeken, corsi, rustkracht won with real clicks, in the world, with real animals. |
| 7 | Finish mission | ✅ | The sow with three striped piglets stays at the marker, a ✓ flag and halo; a calm reunion plays. |
| 8 | Back in the world | ✅ | Next mission offered; progress and the reunited family survive a reload. |

Known red outside golden: 4 older e2e specs (anim flaky under load, friction/nachtronde,
quality laag tier, sitspot's renamed roep card).

## 2026-09-27 00:58: after wave 1 (`npm run golden` on main + screenshots looked at)

**Nothing blocks the player any more:** golden plays 1 → 8 with real keys and clicks and
wins mission 1 at its real marker. Remaining ✗ are quality failures.

| # | Step | Status | What a player experiences |
|---|------|--------|---------------------------|
| 1 | Opening screen | ✅ | Calm, loads fast; Enter presses *Begin*. |
| 2 | Make your ranger | 🟡 | Creator works; jacket/hair choices still don't reach the 3D ranger. |
| 3 | Walk the world | 🟡 | Ground is fixed: ranger, trees, markers and props all stand on the drawn ground. Left/right keep the camera turning ~90° after release; Down swings the camera to face the ranger. ~2.6M triangles (budget 1M). Heide ground reads as magenta smears; dark cone "grass" spikes. |
| 4 | Jeep / helicopter | 🟡 | Jeep drives 15 m in 3 s on the terrain, but its model faces sideways and a dust blob covers it; the driver stands on it. Heli not re-checked. |
| 5 | Go to mission 1 | ✅ | Chip names the right side; one prompt at a time; one click/Space starts it. |
| 6 | Mission 1 mini-games | ✅ | zoeken (piglet hidden in real bushes, trail), corsi (mossy stones), rustkracht (answer buttons) all won with real clicks. Rustkracht shows an adult boar where the text says *frisling*. |
| 7 | Finish mission | 🟡 | Reward + clue work; the world still does not change at the marker. |
| 8 | Back in the world | 🟡 | Next mission offered, reload keeps progress. An oversized marker label floats in front of the camera and the marker boar fills the bottom of the frame. |

## 2026-09-26: baseline audit (six Opus 5.5 playtest audits, laptop + iPad)

| # | Step | Status | What a player experiences |
|---|------|--------|---------------------------|
| 1 | Opening screen | 🟡 | Loads in ~5 s, calm. Purple "gem" heather props look off-style. Enter does not press *Begin*. |
| 2 | Make your ranger | 🟡 | Creator works, but the choices never reach the 3D ranger (only the 2D portrait). |
| 3 | Walk the world | ❌ | Forward is fine and the ranger stays on the ground. Left/right/back makes the camera spin nonstop. The rendered terrain is mirrored vs. the height used to place things: trees float or sink, markers and mission props are buried. ~2.6M triangles. |
| 4 | Jeep / helicopter | 🟡 | Jeep really drives, but its model faces sideways, drives through trees and the cabin, a dust blob covers the screen, and it is parked on a mission marker. Heli flies but also sideways, and one pad is sunk into the ground. |
| 5 | Go to mission 1 | 🟡 | The HUD chip points the way (sometimes the wrong side); *Speel mee* + Space starts it. The jeep's button can cover the mission button. |
| 6 | Mission 1 mini-games | ❌ | 3D games ignored every mouse click (**fixed 2026-09-26, commit 3c34be7**). At the real marker the props are buried, so the stage looks empty. Animals are coloured capsules, not the real models. |
| 7 | Finish mission | 🟡 | Reward, badges and clue work. Nothing in the world changes. |
| 8 | Back in the world | 🟡 | Back in the world, next mission offered, progress survives reload. *Stop de missie* teleports you to spawn. |

Root causes, in order of impact: the terrain z-mirror (step 3, 6), the full-screen click
blocker (6, fixed), the camera feedback loop (3), primitive stand-ins in the mini-games (6).
