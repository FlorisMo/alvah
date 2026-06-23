# Ranger van de Veluwe — Auto-QA Report (Floris review gate)

> RUN-LEDGER capstone box **132b**. Auto-generated gate that fronts the Deep Demo (§5/§8d-7)
> for Floris's review. Covers the four required axes — **draw calls · a11y · persistence ·
> tone lint** — plus the build/test gate and the screenshot status. Date: 2026-06-23.
> Re-run the numbers any time with the commands quoted under each section.

## TL;DR — PASS (review-ready)

| Gate | Result |
|---|---|
| Build (`tsc && vite build`) | ✅ green — 86 modules, `dist/assets/index.js` 788 kB (211 kB gzip) |
| Unit + parity suite | ✅ **229/229** across 28 test files (0 fail / 0 skip) |
| Draw calls (§1d budget < 150) | ✅ per-screen budgets logged **~45–67**, overlay enforces 150 |
| a11y (≥56px + dual-channel) | ✅ every interactive target ≥56px; no colour-only feedback |
| Persistence (`alvah-ef-v1`) | ✅ co-tenant namespace; `/spelen` progress provably preserved |
| Tone lint (M3/E3 leesniveau) | ✅ **0** over-length sentences over a 100+-string live corpus |
| Screenshots | ⏸ deferred — no headless WebGL in-sandbox (standing convention); the **Deep Demo** + `?demo` boot entry is the live visual review surface |

**Two ledger boxes stay blocked and are NOT part of this gate** (both need Floris): the Anything
World animal-rig generation (external paid job, §9c loop/Floris-owned) and **125b** (CI asset-hosting
policy + the first outward-facing `/ranger` push). This report reviews the **built, self-verifiable
game**; the live deploy is Floris's call.

---

## 1. Build + test gate (§9e)

```
npm --prefix games/Ranger-Adventures/app run build
node --test --experimental-strip-types "games/Ranger-Adventures/app/src/**/*.test.ts"
```

- **Build:** green. `tsc` typecheck clean → `vite build` 86 modules, one bundle
  `index.js` 788 kB / **211 kB gzip**, `index.css` 45.6 kB / 8.8 kB gzip. (The >500 kB
  warning is THREE.js in one chunk — acceptable for a single-route game shell; code-splitting
  is a later optimisation, not a correctness issue.)
- **Tests:** **229 pass / 0 fail / 0 skip** across 28 files. This is the §9e full unit run.
  Coverage spine:
  - **Construct-parity (§1f), all 5 EF engines:** `zoeken3d` 9 · `corsi3d` 7 · `dagnacht3d` 6 ·
    `simon3d` 9 · `wisselen3d` 8 — each cross-checks the extracted pure core against an
    independent re-impl of the frozen 2D rule, so the 2D twin and the diegetic in-world variant
    emit an identical `BeatSummary` by construction.
  - **3D harness:** `ViewMode` 10 · `kit-math` 9 (the single §1f branch + ≥56px hit-sphere maths).
  - **World:** `Biomes` 7 · `CharacterController` 8 · `Wayfinding` 8 · `ProceduralMotion` 9.
  - **Expression/motion:** `Eyes` 8 · `Face` · `CalmPose` · `MotionMode` 5.
  - **Meta/immersion:** `patrol` 10 · `worldbeat` 9 · `companion` · `avatar` · `demo` 8 ·
    `deepdemo` 9 · `Sandbox` 9.
  - **Reading/a11y/persistence:** `readlevel` 9 · `wordclock` · `reading-prefs` 6 · `ambient` 7 ·
    `persist` 9 · `assets`.

---

## 2. Draw calls — §1d budget < 150

- **Authority:** `src/ui/Budgets.ts` — `DRAW_CALL_BUDGET = 150`, a live `renderer.info.render.calls`
  overlay that paints `b-over` (red) the instant a frame crosses 150. `aria-hidden` so it never
  reaches the child.
- **Per-screen budgets logged across the run** (each variant's §9f note):
  - World build-out (ground + still water + 4 instanced veg layers + ranger + ~10 markers): **~45–55**.
  - Each in-world EF variant adds only its own activity meshes (~11 visible; ≥56px hit-spheres
    are `visible:false` → **0 draw-call cost**): **~57–67**.
  - The DOM overlays (case-board, wildcam capture, worldbeat, Tweaks, DemoSkip, DeepDemo,
    avatar/companion screens) add **no 3D meshes** → draw calls unchanged behind them.
- **Verdict:** comfortably inside budget on every screen; the overlay is the always-on regression guard.

## 3. Accessibility — Alvah profile (BUILD-PLAN §3)

- **Tap targets ≥56px:** swept across `src/ui/*.css`. Every interactive class is ≥56px
  (`.mission-card` 120 · `.btn-start`/`.ra-pill`/`.choice-opt`/`.wb-opt`/`.ra-text-btn` and the
  avatar/sandbox/tweaks/demo controls 56–64 · the `.wb-opt`/care row 92). The only sub-56px
  rules are **non-interactive** and verified so: `.lodge-clue-count` (22px count *badge*) and
  `.care-msg` (24px *paragraph*) — not tap targets.
- **Dual-channel feedback:** confirmed by grep that no feedback is colour-only — every site pairs a
  `settings.geluid`-gated `Sound.*` (found/correct/tryAgain/step/call) with a visual cue
  (emissive COLOUR + SCALE pulse), a per-option GLYPH, the words, and read-aloud, in every 2D + 3D
  engine and meta screen.
- **Reduced-motion:** one authority (`render3d/MotionMode.ts`) reads the live OS-∪-toggle state
  **per frame** — no consumer captures the flag at construction, so the Tweaks toggle calms the
  whole 3D + CSS layer with **no restart**. The three KEEP channels (locomotion / expression /
  gaze) are unit-pinned invariants ("reduce ≠ none"). The `.rm` body class calms CSS transitions
  while colour/glyph/sound/words carry the signal.
- **Never-scary / never-game-over / motion-comfort:** each variant's §9f note verified calm-pose
  staging (still forms, no lunge — wrong-choice leans go AWAY from the +z camera), §1e damped
  reframe that cuts under reduced-motion, and the never-game-over re-present loop.

## 4. Persistence — `alvah-ef-v1` migration (§9g)

- **Design:** `src/core/persist.ts` co-tenants the Ranger state under a single `ranger` namespace
  **inside** the shared `alvah-ef-v1` blob rather than renaming the key — because `alvah-ef-v1` is
  already owned by the `/spelen` practice games. `writeRangerRoot` read-modify-writes, so every
  other namespace (`/spelen`'s exercises/mijlpalen/preferences/schemaVersion) survives verbatim;
  `readRangerPartial` resolves the `ranger` ns first, else one-time-migrates the legacy standalone
  `ranger-mvp-state` key, else fresh.
- **Test pin (`persist` 9/9):** the load-bearing invariant — *writing the Ranger state preserves
  every `/spelen` field* — plus ns-wins-over-legacy, full legacy round-trip, and garbage-source
  tolerance (never throws).
- **Known follow-up (flagged, not in scope here):** `/spelen/admin`'s `clearAll()` does a blunt
  `removeItem('alvah-ef-v1')`, so a "reset everything" there would also clear the Ranger ns. The
  reverse is safe (Ranger never clobbers `/spelen`). Left for the Phase-8 integration audit (123) —
  CLAUDE rule 5 forbids touching `src/scripts/admin` from this step.

## 5. Tone lint — M3/E3 leesniveau (games-subtree tone gate)

- **Gate:** `src/core/readlevel.ts` (pure ≤7-words/sentence + one-idea-per-line lint) run over the
  **live** authored corpus by `readlevel.test.ts` — briefings, step copy, feiten, clues,
  ontknoping, animal facts (100+ strings). Asserts **0** over-length offenders, so a too-long
  sentence cannot slip back in. `wordclock` (iOS-safe karaoke) + `reading-prefs` (clamp + NaN
  survival) green alongside.
- **Scope note:** the games-subtree tone gate IS this readlevel lint. The `src/`-site
  `check:tov:strict` pre-commit hook (em-dash / "hij of zij" / rhetorical-tag) is NOT wired for
  `games/`; a few pre-existing `gevolg` consequence strings + code-comment dividers use em-dashes,
  pre-dating the run and out of scope per §9/CLAUDE-rule-5.

## 6. Screenshots

Deferred — there is **no headless WebGL** in the sandbox, the standing convention for this whole
run. The live visual review surface is the **Deep Demo** (lodge link "Diepe demo: de hele
rondleiding" + `?demo` boot entry): boot → avatar → free-roam → meet cast + hear voice → play all 5
EF engines in-world → arc → companion → badges, end to end, reusing the live screens. Floris runs it
on the iPad (the §6a / §8c-#4 human gate) for the motion-comfort + real-word-feel + difficulty pass.

## 7. Staged cast + audio (for the review)

- **Models** (`public/models/`, manifest 75): 3 humanoids (ranger-alvah · warden-boa · poacher),
  14 animals, 19 birds, ~37 props (cabin/case-board/ecoduct/boa-post/hide/nest-box/snare + seasonal
  oak/birch/heather autumn+winter + finishing props), 2 vehicles (jeep · helicopter, static frames).
- **Audio** (`public/audio/`): 6 real recorded calls (edelhert/ree/wildzwijn CC0,
  raaf/nachtzwaluw CC BY-NC-SA, eekhoorn) + 2 ambient beds (bos · heide); `core/sound.ts` synth
  fallback + graceful degradation cover the rest.
- **Animation:** humanoids carry Meshy rigs; the animal/bird **Anything World** rigs are the one
  external paid job still pending (§9c) — the procedural-motion fallback (`ProceduralMotion.ts`)
  makes the whole cast move and the game fully playable meanwhile, and the mixer path is wired +
  dormant, ready to prefer the animated GLBs the moment they're staged.

---

### §9f adversarial pass on this report
- *What's wrong?* — Nothing blocking. The bundle-size warning is informational (single-route THREE
  app); the em-dash strings are out-of-scope pre-existing copy on a surface whose gate is the
  readlevel lint, not the src/ hook.
- *What's missing?* — Live screenshots (no headless WebGL; Deep Demo is the substitute) and the two
  Floris-owned boxes (AW generation + 125b deploy) — both correctly out of this gate's scope.
- *What breaks never-scary / motion-comfort?* — Nothing new: this box adds no copy, no meshes, no
  tap targets; every gate above is the game's own already-audited behaviour, re-verified green.
