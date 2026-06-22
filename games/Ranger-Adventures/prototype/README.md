# prototype/ — the runnable Claude Design hand-off

The game **as delivered**: React 18 UMD + Babel-standalone (in-browser JSX) for the 2D game, plus a
Three.js POC for the 3D track. All files are **flat siblings** (the HTML loads JSX/CSS by relative
path), so they live together and **stay runnable**. Don't refactor in place — this is the reference we
re-implement from in the Astro site (see [../GAMEPLAN.md](../GAMEPLAN.md) §4b–§5).

## Run it
Open any `.html` over a local server (Babel + ES-module loading need http, not `file://`):
```
cd prototype && python3 -m http.server 8000   # then visit http://localhost:8000/
```

| Entry point | Shows |
|---|---|
| **Ranger van de Veluwe.html** | The 2D MVP — full 8-screen mission loop, 3 missions, all 5 EF engines |
| **Veluwe 3D.html** / **Veluwe Wereld 3D.html** | EF mission logic running *in situ* in a continuous Three.js world |
| **Vos 3D POC.html** | Photoreal-ish procedural-fur fox — the character pipeline on one animal |
| **Alvah Likeness.html** | Procedural humanoid "ranger" likeness tuning (loads the likeness photos) |
| **Ranger Audition.html** | Side-by-side CC0 mesh candidates through the same spec pipeline |

## File map / re-integration tiers
Logic is render-agnostic and reusable; the React/Babel/CSS shell is reference-only.

- **Keep as logic:** `state.jsx` (methods: `logSession`, `damageVehicle`, `findClue`, …), `skill.jsx`
  (difficulty/skill resolver), `companion.jsx`, `sound.jsx` (WebAudio recipes).
- **Keep as content/data:** `content.jsx` (registry API), `content-veluwe.jsx` (animals + missions),
  `specs.js` (character specs — CC0 sources, bone maps, emotion configs).
- **Keep as engine definitions:** `step-spot.jsx` (zoeken), `step-route.jsx` (corsi),
  `step-simon.jsx` (simon), `step-danger.jsx` (dagnacht), `step-wissel.jsx` (wisselen).
- **Keep as 3D reference:** `stage.js` (Three.js golden-hour stage), `character.js` (glTF + animation +
  emotion), `humanoid.js` (procedural figure), `world3d-bridge.js` (3D↔React glue), `world3d.jsx`.
- **Reference / rewrite for Astro:** `screen-*.jsx`, `app.jsx`, `sprites.jsx` (CSS-shape creatures),
  all `*.css` (keep tokens), `tweaks*.jsx` (dev tuning panel — drop in production).

## State
The prototype persists to `localStorage['ranger-mvp-state']`. On integration this maps onto the site's
real `alvah-ef-v1` schema (migrate, don't fork) — see GAMEPLAN §5.

## Privacy
`1000152315–320.jpg` are photos of Alvah, loaded by the likeness prototypes. They're **git-ignored by
default** (`.gitignore` here) — local-only. See GAMEPLAN §6.
