# Ranger van de Veluwe — Demo Sandbox (compact "everything in one room")

> **Purpose (Floris, 23 Jun 2026).** A small, fast demo space that holds **all the
> characters and one of every interaction**, so the actual cast and mechanics can be
> shown in seconds — without grinding through missions/seasons. This is **distinct
> from the end-to-end Deep Demo** (BUILD-PLAN §5): the Deep Demo is the *whole game,
> skippably*; this is a *showroom* — quick, total, no story required.

Built in **two tiers** so the cast can be eyeballed now and the full thing lands at the capstone.

---

## Tier 1 — Charactershowroom  ✅ built (standalone, now)
A dev/demo page that loads **every staged model** and lets you inspect the real cast.
- Files: `app/showroom.html` + `app/src/showroom.ts`. **Deliberately decoupled** — imports
  only `three` and reads `/models/manifest.json` + `/audio/manifest.json`, so it neither
  breaks nor is broken by the autonomous run's game code.
- Open it: `npm --prefix app run dev` → **http://localhost:5173/showroom.html**
- Shows all 75 models on a calm grid; **plays the baked rig animation when one exists**
  (`manifest.animated`), else a gentle procedural turntable idle; tap a character to
  **focus the camera + hear its real call**; filter chips by category (human/animal/bird/prop/vehicle).
- **Anything World:** automatic — the moment AW-animated GLBs are staged into `/models`
  (manifest `animated: true`), the showroom plays them instead of the idle. No code change.

## Tier 2 — Full Demo Sandbox  ⏳ built by the run, right after the cast + interactions
> **Placement (Floris, 23 Jun):** its own **"Demo surroundings"** phase right after Phase 4 (the
> cast + the 5 in-world interactions = its real prerequisites), **new Alvah likeness first** so the
> demo shows the improved figure. It reuses the live engines, so it still reflects the later
> Phase 5/6 polish whenever it's opened.
One **compact in-world scene** (a single clearing / "ranger-station showroom", not the full
Veluwe) containing **every element and every interaction**, each reachable in a few seconds:
- **Cast:** every animal/bird/companion present and calm-posed (never-scary gate), each with
  its call; the player ranger + warden + (reformed) poacher.
- **All 5 EF activities playable in-world**, one trigger each (dagnacht · corsi · simon ·
  zoeken · wisselen) — the real diegetic 3D variants (Phase 4 §II), each still passing its
  construct-parity test; 2D fallback intact.
- **Meta interactions:** companion care beat, a case-board clue, an avatar-creator open, a
  badge award, a "wist-je-dat" fact card, a season/arc resolve beat.
- **Instant access:** a jump-menu to any character or interaction; no briefings, no grind
  (reuses the §9g demo-skip options).
- **Comfort/a11y:** §1e camera, reduced-motion path, ≥56px targets, read-aloud — same gates
  as the game.

**Anything World, for both tiers (Floris):** prefer the AW-rigged + animated GLBs wherever
they're already staged (`/models` manifest `animated: true` / `assets-gen/animated/<id>.glb`),
falling back to the always-on procedural motion otherwise. So whenever the AW pass has run,
the demo automatically shows the realistic animations; until then it shows procedural — the
demo is never blocked on the external paid AW job.

**Acceptance:** every cast member visible + audible; one of each interaction reachable in
≤2 taps; AW animations shown where staged; <150 draw calls; never-scary + reduced-motion +
text-only paths all hold; build-green.
