# Ranger van de Veluwe — 3D Immersion Plan (mini-games → in-world experiences)

> **Purpose.** Take the five EF mini-games from "leave the world, play a 2D card game, come back"
> to **diegetic 3D activities that happen inside the living Veluwe** — so the whole thing feels like
> *being a ranger*, not *opening a game*. This is an **expansion of BUILD-PLAN Phase 4 + 5**, not a
> replacement. Read [BUILD-PLAN.md](BUILD-PLAN.md) §1b/§1e/§5 and the current
> [app/src/ui/Missions.ts](app/src/ui/Missions.ts) flow first; this doc decides the *how* of the 3D
> render variants and the immersion layer, then hands off to the long autonomous run.
>
> **Status (Jun 2026): INTEGRATED into the executable plan** — BUILD-PLAN [§1f](BUILD-PLAN.md) (locked
> decision: construct parity + 2D floor), [§5](BUILD-PLAN.md) Phase 4–5, and [§8d](BUILD-PLAN.md) run shape
> (step 2b). This doc stays the **detailed per-engine design reference** the autonomous run follows. Current
> state: the 5 EF engines exist as 2D views (`render2d/*`) + a first 3D world (`render3d/World.ts`); the
> diegetic 3D variants below are what the run builds next, each gated by its construct-parity test.

---

## 0. The two non-negotiables (everything below obeys these)

### 0a. Construct fidelity — "the exercise must be *truly* the same"
The EF demand is a **measurement**. Making it 3D may NOT change what's being measured, or the
difficulty/skill DDA (`core/skill.ts`) silently starts scoring a different task.

**The contract — frozen:**
- The **trial generators stay untouched**: `buildZoekenTrial` (decoys + `lensSterkte`), the Corsi route
  over `PRINT_SPOTS` (`routeLengte`), `buildSimonTrial` (`simonLengte`), the dagnacht encounter set +
  the one rule-flip (`slowmo` window), `buildWisselTrial` (`flipEvery`/`wisselFreq`). Same `skin` +
  `Settings` in → same trial → **same EF load**.
- A 3D view may change **only**: spatial layout of the *same* elements, input modality (raycast pick /
  proximity instead of a DOM tap), and sensory dressing (light, sound, animation). It must emit the
  **same `BeatSummary`** so skill/DDA see identical data.
- **No construct contamination.** Don't add cognitive load that belongs to a *different* EF: e.g. no
  required navigation *during* a working-memory recall (would inject spatial WM into simon); the
  wisselen destinations stay always-visible+labelled (so it's rule-application, not spatial memory);
  zoeken's search set is unchanged (the clue trail sets the *region*, it doesn't shrink the set).
- Every 3D view ships a **parity test**: feed a fixed seed, assert the same trial + the same emitted
  beat as the 2D view. This is the autonomous run's self-audit gate for "same exercise."

### 0b. Motion-comfort + the 2D floor
Alvah is motion-sensitive. The §1e camera spec is law: fixed 50–60° FOV, exp-damped follow, **roll=0**,
no head-bob/blur/snap/FOV-kick/shake. Every 3D activity:
- prefers **camera reframes over locomotion**, and **cuts/fades over moves** under reduced-motion;
- keeps the existing **2D `render2d/*` view as the always-available fallback** (reduced-motion + low-end
  + fast-iteration). 3D is **additive**, never the only path. The `ViewMode` resolver (below) picks.
- ≥56px effective tap targets (generous invisible raycast hit-spheres), dual-channel feedback
  (glow **colour** + **scale** pulse), text always present + read-aloud, never-scary calm-pose gate on
  every animal, never game-over, mild recoverable consequence.

---

## 1. The immersion thesis — from "mini-game" to "a ranger's patrol"

Today: `lodge → pick mission → leaveWorld() → 2D game → reward → back to lodge`
([Missions.ts:167](app/src/ui/Missions.ts#L167)). The hard cut out of the world is what makes it feel
like five separate games.

**Target: one continuous in-world patrol.** The world stays loaded; activities unfold *in place*:

1. **Diegetic entry, not a briefing screen.** The world *poses* the task — the herd mills about lost at
   the treeline, dusk falls and the animals start calling, you spot a fresh *spoor* in the sand. The
   briefing text still exists (a11y + read-aloud) but is presented as the ranger's **veldnotitie**:
   anchored, short (M3/E3), skippable. No screen-tear into a separate "game".
2. **In-place play.** Instead of tearing down the scene, the camera does a gentle **damped reframe** to
   the activity spot (the approached animal / the route / the dusk clearing). Same renderer, same world.
3. **A clear accomplishment beat.** The mini-game element stays *legible* — there's an obvious task
   ("breng de kudde thuis", "beantwoord het nachtkoor", "vind het verstopte dier") and an obvious win
   tied to an **animal outcome**: the herd follows you home, the chorus answers, the hidden animal is
   logged on the **wildcamera**. Success *sings*, failure is quiet, the beat still logs to skill/DDA.
4. **The wildlife-camera / case-board is the connective tissue.** Things you *find* (zoeken),
   *remember* (corsi/simon), and *decide* (dagnacht/wisselen) drop clues onto the cabin **case-board**
   and feed the season/poacher arc — so the five activities read as *one world's work*, not a menu.
5. **Light world-EF seasoning, explicit core stays explicit** (BUILD-PLAN §8b): ambient impulse-resist
   moments and wayfinding can dust the open world, but the five named activities remain the clear,
   countable core. EF is the hidden skeleton; never "brain-training."

---

## 2. Architecture — a 3D render layer that reuses the spine

Mirror the proven render-agnostic split. **Add `render3d/engines/` as a sibling of `render2d/`.**

- **Same `PlayFn` contract.** Each 3D view exports `play3dX(ctx: WorldCtx, step: Step) => Promise<BeatSummary>`,
  consuming the **same trial builders** and emitting the **same beat** as its 2D twin. The engine logic
  in [engines/*.ts](app/src/engines/) is the shared, frozen source of truth.
- **`ViewMode` resolver** in the mission runner: choose the 3D view when the scene is live AND not
  reduced-motion AND device-capable; else the 2D view. The `runMission` loop branches once, here — so
  2D stays a first-class fallback with zero duplication of logic.
- **`WorldCtx`** handed to 3D views: `{ scene, camera, cameraRig, approachedModel, activitySpot, raycaster,
  prompt }` — so the view renders *into* the running world instead of `leaveWorld()`. Mission play
  becomes in-place; the camera rig reframes and restores.
- **Shared 3D interaction kit** (`render3d/play/` helpers, built once, reused by all five):
  - `pick3d` — raycast tap with generous invisible ≥56px-projected hit-spheres on diegetic objects.
  - `highlight3d` — dual-channel cue: emissive **colour** glow + **scale** pulse (works for colour-blind
    + reads under reduced-motion as a static glow).
  - `anchoredPrompt` — keep the **DOM overlay** for all text/choices/read-aloud (the existing
    accessible card system); 3D supplies the *scene*, DOM supplies the *words*. Text-only path must stay
    fully playable.
  - `spoorTrail` — instanced footprint/clue meshes laid along a spline (zoeken + reusable for wayfinding).
  - `reframe` / `cut` — §1e damped camera move, or a hard cut under reduced-motion.
- **Reduced-motion behavior per view** is defined explicitly (below); the absolute floor is "fall back to
  the 2D view." No flythroughs, no camera moves during recall.

---

## 3. Per-engine 3D design

For each: **the fantasy · what stays identical (the contract) · the 3D scene · input · the win beat ·
motion-comfort + reduced-motion.** Ordered by how naturally diegetic they are.

### 3a. dagnacht — inhibition (the "dissolves into the world" exemplar)
- **Fantasy:** you're walking the patrol and you *meet* the animal — the adder on the warm path, the
  zwijn begging at the hut, the tempting modderpoel. The ranger rule says don't.
- **Identical:** the same encounter set, the same one **rule-flip** that keeps it true inhibition (not
  "always say no"), the same `slowmo` choosing-window difficulty, the same recoverable consequence.
- **Scene:** the encounter is an in-world event at the approached animal — no separate screen. The
  choice prompt (`aai / pak / voer / recht-erdoor`) is an `anchoredPrompt` over the live animal.
- **Input:** tap the ≥56px choice buttons (DOM, for text/read-aloud); optionally tap the animal to look
  closer first. The **choosing window is preserved** (the impulse must stay prepotent + timed).
- **Win beat:** respect the animal → it settles calmly (calm-pose gated), a small "je liet 'm met
  rust" tally. Wrong → the animal startles *gently* and retreats, a few eikels/ground lost — never scary,
  never game-over.
- **Comfort:** static camera on the animal; no motion needed. Reduced-motion = identical, cuts only.

### 3b. corsi — visuospatial sequence memory (the hero example)
- **Fantasy:** "onthoud de route die de kudde liep en breng ze thuis." The doc's founding example.
- **Identical:** the `PRINT_SPOTS` layout and `routeLengte` are unchanged — the show→recall state machine
  runs exactly as the 2D `RouteView`.
- **Scene:** the spots become **glowing footprints on the 3D ground**. Show phase: they pulse in
  sequence in place (a firefly/glow walks the route) under a **static or gently-damped** camera — *no
  flythrough* (flythrough = motion-sickness + would add an egocentric-rotation confound). Recall phase:
  tap the footprints on the ground in order.
- **Input:** `pick3d` on the footprint hit-spheres; dual-channel confirm per tap.
- **Win beat:** correct route → the kudde **follows you home**; the herd animation is the reward.
- **Comfort:** camera essentially fixed; recall needs no locomotion. Reduced-motion = footprints light in
  sequence with no camera move at all.

### 3c. simon — audio-visual working memory
- **Fantasy:** dusk; the animals of the clearing call a growing phrase; you answer the **nachtkoor** back.
- **Identical:** `simonLengte`, the growing sequence, and the **light-up carries the sequence so it's
  playable muted** (dual-channel) — all unchanged from `SimonView`.
- **Scene:** an arc of animals across the dusk clearing (eyeshine on, per the §1e species list). Each
  **calls + lights/head-raises** in sequence; you tap them back. They are the same "buttons," placed in 3D.
- **Input:** `pick3d` on each animal (generous hit-sphere); per-animal call audio via `core/calls.ts`,
  synth fallback `core/sound.ts`.
- **Win beat:** the full chorus answers / the animals bed down for the night.
- **Comfort:** fixed camera framing the arc; no locomotion. **Construct guard:** the animals don't move
  during recall (moving targets would inject visual search). Reduced-motion = static glow, no secondary motion.

### 3d. zoeken — sustained attention + visual search (**+ the clue/tracking enrichment**)
- **Fantasy:** track an animal that "drukt zich" (lies dead-still) — **follow the spoor, the broken twig,
  the plukje haar** to the hide, then pick it out from the lookalikes.
- **Identical (terminal trial):** `buildZoekenTrial`'s target + decoys + `lensSterkte` haze are the
  **unchanged core**. The final discrimination — pick the still target out of N real-fauna decoys under
  haze — is byte-for-byte the same task and emits the same beat.
- **The tracking enrichment (new, additive):** a `spoorTrail` of diegetic clues (footprints → broken
  twig → tuft of hair → dropping → feather) leads to the **hide zone** that *contains the same
  trial*. This is on-construct: "zoeken" is sustained attention **+** visual search, and the trail adds
  the sustained-attention-over-distance leg without touching the discrimination set.
  - **New difficulty axis, kept separate** (reskin discipline = vary ONE axis): `spoorLengte` /
    `spoorHelderheid` (how many clue legs, how faint) tune the *tracking* leg; `afleiders` + `lensSterkte`
    still tune the *search* leg independently. The trail sets the **region**, never shrinks the decoy set.
  - Found target → frame it in the **kijker (verrekijker)** overlay (the haze = the binocular vignette) →
    tap to confirm → it's **logged on the wildcamera** (feeds the case-board).
- **Scene:** a localized heath/thicket vignette the trail leads into; instanced decoys; the target still.
- **Input:** walk/tap along the trail (gentle), then `pick3d` the target in the kijker.
- **Win beat:** "vastgelegd op de wildcamera" — a snapshot card for the case-board.
- **Comfort:** trail-walking uses the §1e damped follow or simple tap-to-look; reduced-motion = the trail
  reveals as static glowing markers (no walking) → straight to the kijker search. 2D fallback = today's view.

### 3e. wisselen — cognitive flexibility / set-shifting
- **Fantasy:** evening; you settle each animal where it belongs — dagdier → open plek, nachtdier → hol —
  but a **signpost/weer flips the rule** ("Nu andersom!").
- **Identical:** the queue (`skin.trials`), the day/night sets, and the **`flipEvery` cadence** are
  unchanged from `WisselView`.
- **Scene:** two **always-visible, labelled** destinations in the 3D clearing (open plek + den/burcht,
  each with a glowing icon). Animals approach a fork; the signpost shows the current rule and flips.
- **Input:** tap an animal then tap its destination (or a "leid hierheen" gate). **Construct guard:**
  destinations are persistently visible + labelled, so this stays *rule-application*, not spatial memory.
- **Win beat:** at the flip, "Nu andersom!" reads loud (icon + voice + text); a correct sort = the animal
  trots to its spot. All animals placed → the clearing settles for the night.
- **Comfort:** fixed camera on the fork; no locomotion. Reduced-motion = animals appear/cut, no trotting.

---

## 4. Build phases (slot into BUILD-PLAN §5 Phase 4–5 / §8d)

Each phase is build-green, self-audited, and ships the **parity test** (§0a) + a screenshot/QA note.

| # | Phase | Builds | Done when |
|---|---|---|---|
| I | **3D play harness** | `render3d/engines/` scaffold, `WorldCtx`, `ViewMode` resolver, the shared kit (`pick3d`/`highlight3d`/`anchoredPrompt`/`spoorTrail`/`reframe`), in-place mission flow (no `leaveWorld`) | One engine plays in-place; 2D fallback still works; resolver picks by reduced-motion/capability |
| II | **Diegetic 3D variants ×5** | The five views in §3 order (dagnacht → corsi → simon → zoeken → wisselen), each reusing its frozen trial builder | Each: parity test green (same trial + same beat as 2D); ≥56px; dual-channel; calm-pose gate; reduced-motion path defined |
| III | **Zoeken tracking enrichment** | `spoorTrail` clue legs + kijker overlay + wildcamera capture → case-board; `spoorLengte`/`spoorHelderheid` as separate difficulty axes | Trail leads to the *unchanged* search trial; new axes tune tracking only; capture lands on case-board |
| IV | **Immersion layer** | Diegetic task entry/exit (veldnotitie not briefing screen), accomplishment beats, continuous patrol, case-board wiring, light world-EF seasoning | World stays loaded across a mission; tasks legible; the five stay the explicit core; tone/never-scary gate passes |
| V | **Comfort + a11y audit** | Per-view reduced-motion behaviors, motion-comfort QA (§1e §C.5), text-only playability pass | Every view: cuts-not-moves under reduced-motion; fully playable with text hidden + read-aloud; <150 draw calls |

**Acceptance principle for the autonomous run:** a 3D variant ships only when its **parity test** proves
the same trial + beat as the 2D twin, its **reduced-motion** path is defined, and its **never-scary +
≥56px + dual-channel** checks pass. Otherwise the resolver keeps serving the 2D view — the game never blocks.

---

## 5. Open questions (for finetuning before handoff)
1. **In-place vs. framed scene** for mission play — proposed: in-place camera reframe primary, a framed
   mini-scene as the perf/reduced-motion fallback. Confirm?
2. **Zoeken trail length** — how many clue legs feels like *tracking* vs. *tedium* for a 7-year-old? (1–3
   legs proposed; a playtest knob.)
3. **dagnacht as ambient world events** — should some impulse-resist encounters fire *during free-roam*
   (true open-world seasoning) in addition to the named missions, or stay mission-bound for now?
4. **wisselen destinations** — fixed two spots (proposed, lowest confound) vs. occasionally relocating
   them (richer, but risks adding spatial load — would break §0a). Recommend fixed.
5. **Priority** — build all five 3D variants in the long run, or ship the three most diegetic
   (dagnacht/corsi/zoeken) first and let simon/wisselen ride the 2D view until a later pass?

---

## 6. Routing note (Phase 8, later) — **alvah.nl/ranger**
When this folds into the Astro site (BUILD-PLAN §5 Phase 8), the game must be reachable at
**`alvah.nl/ranger`**: the Vite app re-wrapped/served under the `/ranger` route, **behind the existing
client-side access gate** (BaseLayout, key `alvah-gate-v1`), **robots stays Disallow**, no external
trackers, localStorage migrates `ranger-mvp-state` → `alvah-ef-v1`. Not part of the 3D-immersion build
itself — recorded here so the integration thread plans the route from the start.
