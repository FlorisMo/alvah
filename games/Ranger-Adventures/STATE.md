# State of the golden path

> Hand-written after playing. Each row: status, what a player experiences, how and when
> it was verified. Goal and steps: [GOAL.md](GOAL.md).
> ✅ works · 🟡 works with problems · ❌ blocks the player

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
| 2 | Make your ranger | ✅ | Skin, hair, jacket, eyes show on the 3D ranger. He is a real 8-year-old: 1.32 m beside Bram and the poacher (1.8 m); animals and plants at true size. |
| 3 | Walk the world | ✅ | Bram greets him by name, then the lessons are learned by doing (arrows, Shift). Walking 2.0-2.2 m/s, Shift runs 4.1-4.2 m/s (iPad: the stick at its rim); the lens stays ~5 m behind, FOV 55, no bob, no snap. A marker's animal stands beside its ring, never in it. |
| 4 | Jeep / helicopter | ✅ | Animals see the jeep coming and trot aside; it brakes for them and never touches one (driven at a roaming boar: it trotted off, closest 4.0 m). Bram suggests the jeep once when the next mission is far, and is quiet once he sits in it. Heli flies to a pad and lands. |
| 5 | Go to mission 1 | ✅ | Bram's hook brings the chip; Enter at the ring starts it. |
| 6 | Mission 1 games | ✅ | *De verdwaalde frisling*, one adventure (below). |
| 7 | Finish mission | ✅ | Reward with three breinkrachten, the cut-fence clue; the family of six stays at the wallow. |
| 8 | Back in the world | ✅ | By the family; Bram: "Volg de pijl linksboven." while the chip points to the reekalf (one next step); the story order is the four adventures first. Reload keeps all four homes "after". |

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
