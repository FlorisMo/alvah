# Ranger van de Veluwe — Build Plan (toward an autonomous build run)

> **Purpose.** Consolidate everything (brief, HANDOFF, research, and the two 3D build references) into
> **one executable plan** an autonomous agent could build the whole game from — and to honestly mark
> what an agent *can't* do alone. Read [GAMEPLAN.md](GAMEPLAN.md) first for orientation; this is the
> *how/execute* layer. Detail lives in [research/](research/) and [design/](design/); this doc decides
> and sequences.
>
> **Status:** research complete (4 knowledge docs + 2 build references). This plan resolves the open
> technical decisions and defines the autonomous-run scope. A handful of decisions (§6) still need
> Floris's sign-off before the run.

---

## 1. Resolved technical decisions (the cross-doc syntheses)

These reconcile points where the docs disagreed or were silent. **Confirm §6 before building.**

### 1a. Humanoid avatar pipeline — RESOLVED (the two replies conflicted)
- `3d-assets-avatar-rigging-runtime.md` → use **MakeHuman/MPFB2**: the *only* tool with a true child
  age-slider (real 8-year-old proportions) and CC0 output. RPM has weak child bodies + CC-BY-NC-SA.
- `3d-expression-eyes-motion-comfort.md` → use **Ready Player Me**: ships native **ARKit-52** face rig;
  MakeHuman ships **no** blendshapes.
- **Decision:** **MakeHuman/MPFB2 is the base** (child proportions + CC0 win for an 8-yo hero), and we
  **author the ~16-shape ARKit subset in Blender** (the `ARKitBlendshapeHelper` addon) — we need 16,
  not 52, so it's bounded work. One CC0 pipeline: MakeHuman → Blender (rig + expression shapes) →
  glTF/DRACO/KTX2. The "Alvah" likeness = a saved MPFB preset + a light sculpt pass; the in-game creator
  exposes a curated slice (skin tone / hair / outfit / iris). RPM stays a contingency for the adult
  cast or a selfie-likeness path only.

### 1b. Render strategy — DECIDED (Floris: "3D-first, make sure you can")
- Brief's MVP = Pokémon-style top-down 2D + zoom-in 2D plates. Your pillar = **"realistic and 3D"**.
  HANDOFF §6.5 = 3D is a render-layer upgrade; engines/flow/content stay identical.
- **Decision:** keep the **render-agnostic spine**; target the **realtime 3D world as primary**. Art is
  acquired in **tiers** (§2a) — downloaded CC0 + generated-in-code + (verify) AI-generated — so the game
  is **fully playable in 3D from day one** and gets *progressively* more realistic, not "stand-ins until
  a human shows up". Everything drops into the same `<Dier>`/spec slots (frozen
  `design/3d-animals-build-plan.md` §15). The **2D render is retained** as the low-end / reduced-motion
  fallback and fast-iteration path.

### 1c. Build tooling — DECIDED (Floris, Jun 2026)
- The current `prototype/` (React UMD + in-browser Babel) is great for a clickable mock but **won't
  scale** to a full 3D game (no bundling, no module/asset pipeline, no tree-shaking for Three.js).
- **Decision:** scaffold a real app — **Vite + TypeScript + Three.js** — as a standalone project under
  `games/Ranger-Adventures/app/`. Port the prototype's reusable logic/content/specs (the KEEP tiers in
  [prototype/README.md](prototype/README.md)) into ES modules. Keep the UI layer light (Preact or
  vanilla Web Components) to ease the eventual Astro re-wrap. **Astro integration stays a later phase**
  (the brief's Code-phase) — the heavy 3D game matures as its own Vite app first, then folds into the
  site reusing `src/scripts/` + the `alvah-ef-v1` schema.
- **Non-dev note:** this changes nothing about "runs in a browser." Vite is just a dev tool that
  outputs plain static web files; the game still opens in Safari on the iPad. Floris never touches the
  tooling. (Floris asked for "in browser, ideally" — confirmed: the deliverable is a browser web game.)

### 1d. Runtime budget — LOCKED (from `3d-assets-avatar-rigging-runtime.md` §D)
WebGL2 baseline; feature-detect WebGPU via `three/webgpu` auto-fallback (Safari 26+, treat as
progressive — bugs through 26.1). Enforce with `renderer.info`: **<150 draw calls/frame on iPad**,
instanced vegetation/props, **≤30 bones/skeleton**, **InstancedSkinnedMesh + animation-throttling** for
repeated animals, all textures **KTX2**, `gltf-transform optimize` → DRACO+KTX2. Poly tiers (1.5–4K
overworld / 5–15K mid / 20–50K close-up) confirmed appropriate. Study repos: `pmndrs/ecctrl`
(controller), `donmccurdy/three-gltf-viewer` (loader/disposal), `luis-herasme/instanced-skinned-mesh`
(herds), `CK42BB/procedural-grass-threejs` (heath).

### 1e. Expression, eyes & camera — LOCKED (from `3d-expression-eyes-motion-comfort.md`)
Bake these as **engine-level constants + data-driven JSON** (artists tune without code):
- **Faces:** the ~16-shape ARKit subset + the per-emotion weight recipes (neutral/happy/surprised/
  curious/sad-gentle/proud/focused), caps 0.5–0.7, always animate the upper face, ~0.3–0.4s eased fades.
- **Gaze/blink:** child blinks **less** than adults (~6–10/min attentive vs 15–20); eyes lead, head
  follows ~80–150ms; the child/adult timing tables (§A.4).
- **Eyes shader (build before any animal modeling):** one upper-quadrant catchlight on both eyes,
  clearcoat cornea (spec high, roughness ~0.05–0.15), one-mesh iris parallax; per-species pupil; dusk
  eyeshine ON for fox/deer/roe/badger/nightjar/frog, OFF for squirrel/adder/lizard.
- **Animal poses:** per-family calm cues + **AVOID lists** (no bared teeth / hackles / S-coil / unblinking
  stare) — a "never-scary" QA gate on every pose.
- **Camera:** fixed 50–60° FOV (no dynamic FOV), exp-damped follow (~0.3s pos / 0.2s rot), **roll=0
  always**, quaternions, soft collisions; **BAN** head-bob/blur/snap-rotate/FOV-kick/shake. Cockpit-frame
  for vehicle + helicopter; helicopter = highest risk → vignette/tunneling + hover-stabilize (consider
  hover-only). A real **3D reduced-motion mode** (camera moves → cuts/fades, secondary motion off, keep
  expression/gaze/walk), in-game toggle mirroring OS, no restart. Ship the §C.5 QA checklist.

---

## 2. What the autonomous run can build — and the asset bottleneck, busted

The naive constraint is "a code agent can't make 3D art." That's only half-true, and Floris's directive
is **"figure out what you can't do and make sure you can."** Here's the honest breakdown and the plan to
maximize autonomy.

### 2a. Asset acquisition in tiers (how the cast/world get made *without* a human artist)
A coding agent (given **network + npm access** in the build run) can get far past stand-ins:
1. **Download CC0, pre-rigged + animated** — fetch and wire directly. Covers **fox, red deer, stag,
   wolf** (Quaternius, CC0) and HDRIs/Khronos sample assets. Real assets, zero human work. ✅ agent.
2. **Generate in code (procedural)** — Three.js geometry built from primitives, like the existing
   `humanoid.js`. Good for the player figure, low-poly animals, vehicles, props, and the **Veluwe
   landscapes** (heath/forest/drifting-sand/fen terrain + instanced vegetation). Stylized-but-charming,
   fully playable, infinitely tweakable. ✅ agent.
3. **AI-generated assets (VERIFY — this is the new research, §6/brief-3)** — text/image→3D tools could
   produce the **scarce species** (das, eekhoorn, adder, zandhagedis, raaf, nachtzwaluw, frog stages).
   Open question: do they output *rigged, animated, game-ready* glTF at an acceptable license/quality?
   That's exactly what brief-3 settles. If yes → most of the "human-only" list collapses.
4. **CC0 audio** — fetch animal calls + ambience from CC0 libraries (xeno-canto for birds; Freesound
   CC0) for the `simon` sound-echo engine + world ambience, with a license log. ✅ agent (verify each).

**So the autonomous run targets tiers 1+2 for a complete, charming, fully-playable 3D game on day one,
and folds in tier 3 (AI assets) + the human polish track as they land — realism rises over time.**

### 2b. ✅ Autonomous-buildable now (the whole codebase + most content/assets)
- Vite + TS + Three.js app scaffold; ported logic/content/specs.
- Render-agnostic spine + all **5 EF engines** wired to `staircase`/`scoring`/`progressie`.
- **Difficulty/skill tracking** (over-time + with-skill, invisible DDA, frustration-ease, child hint).
- **Content registry** + **authored launch content as data** (missions/steps/animals/facts, drafted from
  research + the 19 seeds).
- **Story/antagonist** + **case-board**; **companion + rehab**; **badges**; **knap-woord** vocab layer.
- **Avatar creator UI + `avatar` state**; name/likeness threaded through copy + TTS.
- **3D world**: procedural Veluwe terrain + vegetation, tier-1 CC0 animals + procedural cast, camera rig
  (§1e), reduced-motion mode, expression system, eye shader, diegetic HUD, in-place mini-games, wayfinding.
- **Accessibility** (M3/E3 copy, read-aloud + karaoke, ≥56px targets, dual-channel feedback), **Tweaks**.
- **CC0 audio** fetched + wired; localStorage persistence (`ranger-mvp-state` → `alvah-ef-v1`).

### 2c. 🙋 Genuinely still human-in-loop (a *small* residual after §2a)
- **Photoreal *rigged* realism** for the hard species **only if tier-3 AI 3D-gen proves inadequate**
  (brief-3 decides) — then Blender + Auto-Rig Pro: zwijn, das, eekhoorn, raaf/nachtzwaluw, adder
  (spline-IK), zandhagedis; **frog metamorphosis** + **antler cycle** are the novel hard builds.
- **Alvah's precise likeness** — a parametric/photo→avatar path may get close autonomously (brief-3);
  a faithful sculpt is human (MakeHuman/MPFB + polish).
- **On-device iPad profiling** — approximate via throttled desktop; final tuning needs the device.
- **Playtests with Alvah** — irreducibly human: 10-min motion-comfort test, jargon feel, fear/sadness
  check, difficulty calibration. These are *validation gates*, not build blockers.

---

## 3. Customized for Alvah (the consolidated profile)

Pulls his specifics into one place so the build bakes them as defaults (he can be re-tuned via Tweaks):
- **Name & identity:** `avatar.naam = "Alvah"` injected into all copy + TTS; default avatar = the Alvah
  likeness preset (creator sits on top).
- **Reading (AVI M3/E3, dyslexia):** 3–7 word sentences, one idea per line, repeat kernwoorden, large
  text; **read-aloud always present** + short synced karaoke highlight. Plot fully followable with text
  unread (the §D storytelling patterns: voice + gaze-lead + icon + pose + resolve-hopeful).
- **Font:** default a **clean sans** (NOT a "dyslexia font" — research is explicit OpenDyslexic shows no
  benefit); offer **Atkinson Hyperlegible** as an alternate toggle, not the default.
- **Touch & feedback:** **tap targets ≥56px** (Alvah's profile is stricter than the 44–48px general
  rule) and **feedback always on ≥2 channels (colour + scale)** — never colour alone.
- **Motion:** he's motion-sensitive → honour OS reduced-motion; lean toward gentle camera defaults; the
  full §1e comfort spec (helicopter default in the dedicated bullet below).
- **Tone:** Pokémon-warm but nuchter — feedback without exclamation pile-up; success *sings*, failure is
  *quiet*; **never a game-over**, never comparative/peer-ranked, no numeric score.
- **Difficulty:** start gentle; staircase to ~70–80% success; scales over time + with skill; scale-down
  silent, scale-up opt-in; consequence severity default **mild** for Alvah initially (Floris dials up).
  [confirmed]
- **Real words, used judiciously (Floris, Jun 2026 — supersedes "jargon off"):** Alvah *likes* real
  words, so **use the genuine vakterm** where it's the true name and adds flavour (frisling, rotte,
  burcht, ven, ecoduct) — always with **picture + sound** support and the simple word alongside. But
  **don't overdo it**: where an easier word is the natural choice and the vakterm adds nothing, use the
  easy word. Knap-woord badges collect the real words he's met. Not a hard on/off — a *balance* the copy
  bakes in (and a Tweak can still dial up/down).
- **Helicopter:** default **hover-stabilized** (free vertical control opt-in). [confirmed]
- **Rewards:** father links a physical cadeau to a milestone via the site's `/spelen/admin` (unchanged).

---

## 4. Launch content manifest (the "enough variation" target)

Variation comes from **5 engines × skins × 4 seasons × landscapes × story**, not new code. Target for a
satisfying launch (all authorable as data by the agent from the seeds + `veluwe-research.md`):

- **~10 missions** in area Veluwe, spanning **all 5 engines** and **all 4 seasons/landscapes**
  (bos/heide/stuifzand/ven). Each = ordered Steps (engine + research-true skin) + M3/E3 briefing + badge
  + optional `verhaalHaak`. 3 are already built (frisling, reekalf, nachtronde); draw the rest from the
  19 seeds (track-reading, wildcamera/Snapshot, ecoduct, eekhoorn-memory, broedstoof, ven/heide-herstel,
  snare-removal #17 non-graphic, "niet voeren" #19).
- **4-chapter season arc** (lente→zomer→herfst→winter) with the bumbling-poacher mystery: nuisance →
  mystery → evidence → outsmart → catch-on-camera → report-to-BOA → **restore** (heath regrows / animal
  released). Clues drop per mission onto the cabin **case-board**. Every tense beat resolves hopefully
  in-session.
- **Companion** (default `raaf`): rescue → daily care routine (EF-in-disguise) → grows → accompanies;
  plus the recurring **rehab** loop (care + **release**, never sad).
- **Badges:** 5 brainpower (per engine, brons→zilver→goud on `skill.best`) + mission + knap-woord +
  companion milestones — all collectible/informational, no score/leaderboard.
- **Fact cards** ("wist-je-dat") + **knap-woord** vocab set, picture+sound, between steps.
- **Reskin discipline:** same engine re-skins by varying ONE difficulty axis at a time (in
  `moeilijkheid`), so freshness ≠ new mechanics.

Expansion is data-only: new mission/animal/area/companion/badge = a record (HANDOFF §7.5).

---

## 5. Sequenced build phases (with acceptance criteria)

Each phase is shippable and render-agnostic-first. Human/asset tracks (§2) run in parallel.

| # | Phase | Builds | Done when |
|---|---|---|---|
| 0 | **Scaffold** | Vite+TS+Three.js app; port logic/content/specs; CI build; design tokens | App boots; one screen renders; budgets overlay (`renderer.info`) live |
| 1 | **Spine + 5 engines (2D)** | Content registry, 5 EF engines, `staircase/scoring/progressie`, difficulty/skill, persistence | 3 existing missions playable end-to-end; skill record persists; DDA verifiable |
| 2 | **Content to launch set** | Author ~10 missions + facts + knap-woord as data from seeds/research | All 5 engines & 4 seasons covered; reskin-axis discipline holds; tone/safety gate passes |
| 3 | **Meta systems** | Story/antagonist + case-board; companion + rehab; badges; avatar creator UI + state | Arc advances by data gates; companion arc completes; badges render from `skill.best`; name threads through |
| 4 | **3D world (tier 1+2 assets)** | Procedural Veluwe terrain/vegetation + CC0 + procedural cast; Three.js world, camera rig (§1e), in-place mini-games, diegetic HUD, wayfinding | Free-roam + walk-up-to-play works; 3D matches 2D content; <150 draw calls on a mid device |
| 5 | **Expression + eyes + reduced-motion** | Eye shader, ARKit-subset face system (data recipes), animal calm-pose set, full 3D reduced-motion mode | §C.5 QA checklist green; faces/animals read warm; reduced-motion swaps moves→cuts |
| 6 | **Accessibility + audio hooks + Tweaks** | M3/E3 copy pass, read-aloud+karaoke, ≥56px/dual-channel audit, placeholder audio, Tweaks panel | Whole plot followable with text hidden; every Tweak wired; a11y audit passes |
| 7 | **Asset swap-in** (human-gated) | Replace stand-ins with rigged models/likeness/audio as the art track delivers | Per-asset: drops into existing spec slot, no engine change, budgets hold |
| 8 | **Astro integration** (later) | Re-wrap into the site; real `alvah-ef-v1` schema; `src/scripts/` reuse | Lives under the site shell; no trackers; robots Disallow; migration clean |

Suggested first autonomous target: **Phases 0–6** (a complete game, tier-1+2 assets). Phases 7–8 are the
human-polish + integration tail.

---

## 6. Gap analysis — what's still missing

**Gating decisions — DECIDED (Floris, Jun 2026):**
1. **Build tooling** (§1c) — standalone **Vite + TS + Three.js** app under `games/.../app/`. ✅
2. **Render strategy** (§1b) — **3D-first**, art acquired in tiers (§2a), 2D fallback retained. ✅
3. **Asset approach** (§2a) — **maximize autonomy**: download CC0 + generate-in-code now; AI-generate
   the scarce species pending brief-3; human polish is the tail, not the gate. ✅
4. **Alvah defaults** (§3) — consequence **mild**, helicopter **hover-stabilized**, **clean-sans** font;
   **real words used judiciously** (not jargon-off). ✅
5. **Launch content** (§4) — ~10 missions / 4-chapter arc / companion / rehab. (Default target; adjust
   freely as content is authored.)
6. **Parallel human tracks** (§2c) — **start now**: see §6a checklist.

**One research run still worth doing before/alongside the build (answers "make sure you can"):**
- **brief-3 — autonomous asset, world & physics acquisition** ([research/briefs/](research/briefs/)):
  can AI 3D-generation produce rigged, game-ready, license-clean models of the scarce species + Alvah's
  likeness? best open-source **physics / character-controller** for a gentle web game (Rapier vs
  three-mesh-bvh vs cannon-es)? procedural **terrain/world** generation libs? programmatic **CC0 audio**.
  This is the single highest-leverage unknown: a "yes" on AI-gen collapses most of §2c into the agent.

### 6a. Parallel human/asset checklist (start now; gates *realism*, not the build)
- [ ] Run **brief-3** (above) — decides how much of the cast/world the agent can self-source.
- [ ] If AI-gen falls short: buy **Auto-Rig Pro**, stand up the Blender family-rig library, custom-rig
      the scarce species; build **frog metamorphosis** (morph targets) + **antler cycle** (mesh-swap).
- [ ] **Alvah likeness**: try a photo→avatar/MPFB path; sculpt-polish if needed.
- [ ] **CC0 audio**: confirm xeno-canto/Freesound licenses for the calls we use; keep a license log.
- [ ] **Early iPad check**: load tier-1 assets through the DRACO+KTX2 pipeline on a real iPad (Safari 26).
- [ ] **Playtests with Alvah**: 10-min motion-comfort test, real-word feel, fear/sadness check,
      difficulty calibration — re-run per build.

**Genuinely still-open (flag for playtest, not blocking):** EF far-transfer is unproven → keep the
framing joyful, never "brain-training"; the likeness fidelity ceiling; Alvah's real motion-comfort
thresholds (the 10-min test tunes FOV/damping/vignette).

Nothing structural is missing for the four pillars: **variation** (§4 manifest + reskin discipline),
**EF focus** (§2 engines + difficulty/skill + honest framing), **realistic 3D** (§1b/§1d/§1e + the asset
track), **customized for Alvah** (§3). The remaining work is *decisions + human asset/playtest tracks*,
not unknowns.

---

## 7. References
- Orientation: [GAMEPLAN.md](GAMEPLAN.md) · build narrative + v2 spine: [design/HANDOFF.md](design/HANDOFF.md)
- Design rationale: [design/plan.md](design/plan.md) · craft: [design/design-spec.md](design/design-spec.md)
  · 3D Design↔Code bridge + frozen decisions: [design/3d-animals-build-plan.md](design/3d-animals-build-plan.md)
- Knowledge base: [research/](research/) — biology, EF/accessibility, and the two 3D build references
  ([assets/avatar/rigging/runtime](research/3d-assets-avatar-rigging-runtime.md),
  [expression/eyes/motion-comfort](research/3d-expression-eyes-motion-comfort.md)).
- Code to port from: [prototype/](prototype/) (see its README for keep/rewrite tiers).
