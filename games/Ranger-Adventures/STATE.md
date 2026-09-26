# State of the golden path

> Hand-written after playing. Each row: status, what a player experiences, how and when
> it was verified. Goal and steps: [GOAL.md](GOAL.md).
> ✅ works · 🟡 works with problems · ❌ blocks the player

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
