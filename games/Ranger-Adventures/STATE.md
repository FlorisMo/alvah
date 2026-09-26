# State of the golden path

> Hand-written after playing. Each row: status, what a player experiences, how and when
> it was verified. Goal and steps: [GOAL.md](GOAL.md).
> ✅ works · 🟡 works with problems · ❌ blocks the player

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
