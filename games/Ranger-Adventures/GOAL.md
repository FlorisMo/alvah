# Ranger van de Veluwe — THE GOAL (read this first)

> One page. If you only read one file before touching the game, read this one.
> Then read [STATE.md](STATE.md) (what works today) and [CLAUDE.md](CLAUDE.md) (how to work here).

## What the game is

A calm 3D ranger game for Alvah (8, dyslexic, motion-sensitive). You are the newest
*boswachter* of the Veluwe. You walk and drive through one open 3D world, help animals
through **missions**, and each mission hides Alvah's five executive-function exercises
("breinkrachten") inside real ranger work. Full product vision: [VISION.md](VISION.md).
The app itself: [app/](app/) (vanilla three.js + Vite + TypeScript).

## The end goal: the golden path works, start to finish

The game is "done enough" when a first-time player can do all of this **without a
single bug, dead end or confusing moment**:

1. **Opening screen** loads calm and pretty; *Begin* works (mouse click or Enter).
2. **Make your ranger**: the choices you make (skin, hair, jacket, eyes) show on the
   3D ranger in the world.
3. **Walk the free world**: the ranger always stands on the ground you see (no sinking,
   floating, falling); every tree, prop, animal and marker also stands on that ground.
   Keys feel natural (forward walks forward, left/right turn) and the camera stays calm
   behind the ranger: it never spins, never flips to face him, never gets buried in a tree.
4. **Drive the jeep** (and fly the helicopter once switched on): it faces the way it
   drives, moves over the terrain, does not pass through trees or buildings, and you can
   get out and walk on.
5. **Go to the first mission** ("De verdwaalde frisling"): the game shows you clearly
   where to go, and starting it is one obvious action.
6. **Play its mini-games** (zoeken, corsi, rustkracht): they happen *in the same 3D world*
   with the *same real animal models*, a child understands what to do, and they can be
   played and won with real mouse clicks.
7. **Finish the mission**: reward, clue, and the world *visibly reacts* (progress is felt).
8. **Back in the free world** at a sensible spot, the next mission is offered, progress
   survives a page reload.

After that: the other nine missions and the remaining mini-games (simon, wisselen, roep)
reach the same bar.

## Priorities

- **Laptop first** (keyboard + mouse, ~1280×800 window). iPad (touch) is second: it must
  not break, but laptop decides every trade-off. (Floris, 2026-09-26. Older docs that say
  "iPad-first" are outdated on this point.)
- **Playable before pretty.** A working, calm, winnable path beats any visual polish.
- **Alvah's contracts stay sacred:** calm camera (fixed field of view, no roll, no shake,
  no snapping; reduced-motion = cuts), never scary and never game-over, Dutch text of at
  most ~7 words per line with read-aloud, big targets (≥56 px), no surnames anywhere.

## How we know it works

One command plays the golden path the way a player does (real keyboard and real mouse
clicks, never a "win this step" shortcut) and fails on any broken step. See
[CLAUDE.md](CLAUDE.md) for the exact commands. A step only counts as working when that test
passes **and** a screenshot of it looks right to a human eye.

## History in one line

Five earlier AI runs (June–July 2026, `runs/`) built most of the content, the engines and
the world, but they checked numbers instead of playing. The game looked "verified" and
could not be played. `runs/` is an archive: don't read it to decide what to do next.
