# State of the golden path

> Hand-written after playing. Each row: status, what a player experiences, how and when
> it was verified. Goal and steps: [GOAL.md](GOAL.md).
> ✅ works · 🟡 works with problems · ❌ blocks the player

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
