# app/ — Ranger van de Veluwe (the real build)

The standalone **Vite + TypeScript + Three.js** game app (BUILD-PLAN §1c). The
clickable `../prototype/` (React UMD + in-browser Babel) is the *reference we
port from*; this is the project that grows into the shippable game and later
folds into the Astro site (BUILD-PLAN §5, phase 8).

Floris never touches this tooling — Vite just outputs plain static web files;
the game still opens in a browser (Safari on the iPad is the primary device).

## Run it
```
npm install
npm run dev      # local dev server with hot reload
npm run build    # type-check (tsc) + production build to dist/
npm run preview  # serve the production build
```

## The one architectural rule: a render-agnostic spine
The 5 EF engines, the content registry, and game state are **pure logic/data**
with no rendering. Rendering is a **swappable layer** on top:
- `render3d/` — the Three.js world (primary; BUILD-PLAN §1b "3D-first").
- a 2D DOM layer is retained as the reduced-motion / low-end / fast-iteration
  fallback.
3D is a render-layer upgrade, **not** a redesign — engines/flow/content stay
identical (HANDOFF §1, §6.5). Do not couple game logic to Three.js.

## Layout
```
src/
  main.ts             entry — boots the stage, budget overlay, boot card
  styles/             tokens.css (ported palette) + base.css (shell, a11y, .rm)
  core/               render-agnostic helpers (reduced-motion now; state/engines next)
  render3d/           Three.js render layer (Stage = Phase-0 golden-hour scene)
  ui/                 DOM overlays (Budgets dev overlay now; HUD/read-aloud next)
```

## Decisions baked in here (so a later session doesn't re-litigate)
- **No React / no R3F.** UI stays vanilla TS (light, and eases the Astro
  re-wrap, BUILD-PLAN §1c). So the pmndrs `ecctrl` / `BVHEcctrl` controllers —
  which are react-three-fiber components — are **not** used. The character
  controller (Phase 4) will be **three-mesh-bvh** (framework-agnostic, MIT) +
  a small hand-written kinematic capsule following three-mesh-bvh's own
  character-controller example — the gentlest, jitter-free fit for the
  motion-comfort spec.
- **World/physics libs added at Phase 4**, not now: three-mesh-bvh, THREE.Terrain
  (vendored), procedural-grass-threejs. Kept out of Phase 0–1 to avoid premature
  deps (the asset/lib space "moves monthly" — re-verify licenses at use).
- **Voice / read-aloud is a swappable layer** — engine still being chosen
  (`../research/voice-tts-readaloud-research.md`). Build everything against the
  read-aloud interface; the engine drops in later with zero rework.
- **Fonts:** system stacks for now; **no Google Fonts request** (client-side /
  offline-clean). Self-host Fraunces + Lexend + Atkinson Hyperlegible later.
- **Runtime budget (§1d):** target < 150 draw calls/frame on iPad — the
  `Budgets` overlay makes it live. Cap pixel ratio at 2; instance vegetation.

## Privacy / site rules (inherited)
All data stays client-side (localStorage, key `ranger-mvp-state` → later
`alvah-ef-v1`). No trackers, no third-party scripts, no external requests.

## Asset pipeline (BUILD-PLAN §6 item 11)
Three scripts under `scripts/`, run via npm. Keys live in `.env.local` (git-ignored,
NEVER commit). Outputs land in `assets-gen/` (git-ignored) and are staged into
`public/` (also git-ignored) for the running game.
- `npm run assets:gen` — Meshy **preview→refine** text-to-3D from
  `scripts/asset-shotlist.json` (priority order; per-category poly target;
  stops cleanly at the credit limit). → `assets-gen/*.glb` + `manifest.json`.
- `npm run assets:opt` — `gltf-transform` optimize: dedup/weld/**meshopt simplify**
  to a per-category poly target + **WebP** textures + **DRACO** geometry. Cuts the
  raw 8–25 MB GLBs to ~150–500 kB. Stages → `public/models/` + manifest.
  (KTX2 auto-enables if a `toktx` encoder is on PATH; `brew install ktx` for the
  iPad pass — otherwise WebP, which iPad Safari + three.js handle natively.)
- `npm run assets:audio` — clean-licensed calls + ambience: **xeno-canto** (birds,
  ND excluded) + **Freesound** (mammals + ambience, CC-filtered). Per-clip licence
  log in `assets-gen/audio/manifest.json`; stages → `public/audio/`.
- `npm run assets:all` — gen → opt → audio in sequence.
- `scripts/finalize-assets.sh` — waits for a background `assets:gen` to finish,
  then runs opt + audio (for long unattended generation runs).
The DRACO decoder is staged into `public/draco/` by `assets:opt` so the browser
can decode the compressed GLBs offline (no CDN).

## Status
- **Phase 0 (scaffold) — done:** boots; golden-hour stage; live budget overlay.
- **Phase 1 (spine + engines) — done:** all 5 EF engines ported as render-agnostic
  logic + 2D views (zoeken/corsi/simon/dagnacht/wisselen), wired through
  `ENGINE_VIEWS`; skill/DDA + localStorage persistence; per-animal call audio
  (real recordings via `core/calls.ts`, synth fallback in `core/sound.ts`).
- **Phase 2 (content) — done:** 10 missions in `content/veluwe.ts` covering all 5
  engines + all 4 landscapes (heide/bos/ven/stuifzand) + the winter finale; the
  season/poacher arc + clues as data.
- **Phase 3 (meta) — done (core):** mission wrapper (`ui/Missions.ts`): lodge →
  briefing → play → "wist-je-dat" → reward with breinkracht badges (tier from
  `skill.best`) + knap-woord. (Companion/rehab + avatar creator: still to build.)
- **Phase 4 (3D world) — first pass done:** `render3d/World.ts` — procedural
  Veluwe (instanced pines/heather), the **real generated ranger + animals**
  loaded from `/models/`, §1e damped-follow camera (roll=0, no shake), tap-to-walk
  + walk-up-to-play. Reuses the one renderer via `Stage.enterWorld()`.
- **Next:** expand the world (more props/biomes, the §1e helicopter/vehicle
  frames, reduced-motion cuts polish), companion + avatar creator, then the Deep
  Demo capstone. See BUILD-PLAN §5.
