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
  not 52, so it's bounded work. Free skeleton+walk/idle rig via **Mixamo** (free, royalty-free,
  humanoid). One free pipeline: MakeHuman/MPFB2 → Mixamo rig → Blender (ARKit subset) → glTF/DRACO/KTX2.
  The "Alvah" likeness = a saved MPFB preset + optional light sculpt; the in-game creator exposes a
  curated slice (skin tone / hair / outfit / iris). (RPM is free but CC-BY-NC-SA + weak child body — not
  needed; the MakeHuman+Mixamo path is free and child-correct.)

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

Brief-3 settled this (research/3d-autonomous-sourcing-physics-world.md). The decisive fact: **mesh
generation is solved; rigging ≠ animation, and the one combo no free, scriptable tool reliably handles
is "non-humanoid body plan + topology-changing morph"** (legless slither, frog hop, life-stage/antler
morphs). Everything else collapses into the agent.

> **FREE-ONLY (Floris): use only free libraries/tools.** This project is **private & non-commercial**,
> so **CC0, CC BY (just credit), NC, MIT/Apache/GPL** are all fine — which makes "free" very
> achievable. The shifts from the report's paid recommendations: **no Meshy Pro / Tripo Pro / Rodin** →
> use **free-tier or MIT-self-host mesh gen**; **no Auto-Rig Pro ($40)** → use **Blender Rigify (free)**
> for the human-residual jobs; **avoid Hunyuan3D** (its open licence excludes the EU). See §2a.

### 2a. Free asset acquisition, in tiers (how the cast/world get made *without* paid tools)
1. **CC0, pre-rigged + animated — download & wire.** **Quaternius (CC0)** = fox, deer, stag, wolf;
   Poly Haven HDRIs; Khronos samples. Zero work, zero cost, zero licence doubt. ✅ agent.
2. **Procedural-in-code — the free backbone.** Three.js geometry from primitives (like `humanoid.js`):
   the player, low-poly animals, vehicles, props, and the **whole Veluwe world** (terrain + vegetation,
   §2d). No external service, no licence, fully tweakable. **This alone yields a complete, charming,
   playable 3D game for €0.** ✅ agent.
3. **AI mesh-gen — free routes (optional upgrade, not a blocker).** For nicer scarce-species meshes:
   either **Meshy free tier** (outputs CC BY 4.0 — fine, just credit "Meshy"; monthly credit cap, ample
   for our ~10-animal fixed cast) **or self-host MIT models** **TRELLIS.2 / TripoSG / SF3D** (truly
   unrestricted, free — but need a GPU; run on a free HF Space or a GPU box). All output **static
   meshes only**. ✅ agent (with the GPU/credit nuance — see advice).
4. **Auto-rig + animate the easy cast — free.** **Mesh2Motion** (open-source) and **Anything World**
   (free tier, credit cap) rig+animate **quadrupeds + birds**: zwijn, das, eekhoorn, raaf, nachtzwaluw.
   **Mixamo** (free, humanoid-only) rigs **Alvah**. ✅ agent.
5. **Audio — free.** **xeno-canto** (raven/nightjar calls; v3 free API key) + **Freesound** (mammal
   calls + ambience; filter `license:"Creative Commons 0"`). Keep a per-clip licence log; prefer
   CC0/CC BY. ✅ agent.

**Strategy — UPDATED (Floris, 22 Jun 2026): one ambitious realism run.** Floris wants the long autonomous
run to reach for **maximum realism up front** (a realistic, license-clean ranger + animals + real voice),
then **fine-tune from a deep demo** (§5) rather than from bare stand-ins. So the run targets **tiers 1–5 in
one pass — contingent on the §6a realism prerequisites** (a few free API keys / a GPU — the one thing an
agent cannot self-provision). Where a prerequisite is missing, that asset **falls back** to tier 1/2 (CC0
Quaternius or procedural) so the build never blocks. Tier-1 CC0 + procedural stay the floor; tiers 3–5 are
the reach, validated against the deep demo. **The realistic ranger does NOT come from the three.js Soldier**
(see §6 item 10: do-not-ship — unclear licence + adult soldier); it is AI-generated clean + Mixamo-rigged.

### 2b. ✅ Autonomous-buildable now (the whole codebase + most content/assets)
- Vite + TS + Three.js app scaffold; ported logic/content/specs.
- Render-agnostic spine + all **5 EF engines** wired to `staircase`/`scoring`/`progressie`.
- **Difficulty/skill tracking** (over-time + with-skill, invisible DDA, frustration-ease, child hint).
- **Content registry** + **authored launch content as data** (missions/steps/animals/facts, drafted from
  research + the 19 seeds).
- **Story/antagonist** + **case-board**; **companion + rehab**; **badges**; **knap-woord** vocab layer.
- **Avatar creator UI + `avatar` state**; name/likeness threaded through copy + TTS.
- **3D world**: procedural Veluwe terrain + vegetation (§2d), tier-1 CC0 + procedural cast, camera rig
  (§1e), reduced-motion mode, expression system, eye shader, diegetic HUD, in-place mini-games, wayfinding.
- **Physics/controller** (§2c-stack), **accessibility** (M3/E3, read-aloud+karaoke, ≥56px, dual-channel),
  **Tweaks**, fetched **audio**; localStorage persistence (`ranger-mvp-state` → `alvah-ef-v1`).

### 2c. 🙋 The exact human residual — FOUR small jobs (all doable in free Blender + Rigify)
The only things no free scriptable tool solves (legless locomotion + topology-changing morphs):
1. **Adder** — legless rig + slither (no auto-tool has a snake category).
2. **Moor frog (adult)** — rig + hop (no amphibian preset anywhere).
3. **Frog metamorphosis** — egg→tadpole→froglet→adult morph (stages are topologically decoupled).
4. **Edelhert antler-growth morph** — velvet→hard→cast (matching-topology morph).
Plus an **optional human polish pass on Alvah's likeness** (a recognisable child face from a photo is the
weakest link for generators). **Tools: free — Blender + Rigify** (not Auto-Rig Pro). And these can be
**stylized down** to avoid even that (see advice): a gently-sliding stylized snake, a simple frog
cross-fade, discrete seasonal antler swaps. *Not build blockers — they swap into existing spec slots.*

- **On-device iPad profiling** — approximate via throttled desktop; final tuning needs the device (human).
- **Playtests with Alvah** — irreducibly human: motion-comfort, real-word feel, fear/sadness, difficulty.

### 2c-stack. Engine libraries — all free/open (sourcing report §C)
- **Physics/controller:** **Rapier** (Apache-2.0) + **pmndrs/ecctrl** (MIT) default; switch to the
  physics-free **three-mesh-bvh** (MIT) + **pmndrs/BVHEcctrl** (MIT) if any capsule jitter fights the
  motion-comfort spec (it's deterministic/kinematic — the gentlest option). Avoid cannon-es/Ammo
  (unmaintained), Jolt (heavier than needed).

### 2d. Procedural world — all free/open (sourcing report §D)
**THREE.Terrain** (heightmaps + slope/elevation biome splatting) + **three-landscape** (splat materials)
+ chunked **InstancedMesh** scatter (heather/pines) + **procedural-grass-threejs** (WebGPU→WebGL2
fallback, instanced). Keeps <150 draw calls via per-chunk instancing + fog + distance LOD. Generative
"world models" (Meta WorldGen / Google Genie) are **not yet usable/licence-clean** — procedural wins today.

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
- **4-chapter season arc** (lente→zomer→herfst→winter) with the recurring poacher mystery: nuisance →
  mystery → evidence → outsmart → **catch** → **Alvah brings him in to the BOA** → **restore** (heath
  regrows / animal released). **Floris (22 Jun 2026): a bit more stakes — the ranger *actively catches*
  the poacher and escorts him to the ranger-police.** Keep it kid-safe the way good kids' shows do: the
  catch is via the wildlife camera + outsmarting (no violence, no weapons-in-use), the poacher is a
  bumbler who is *reformable*, comes quietly and is sorry — but the **capture is the satisfying,
  higher-stakes beat**. Clues drop per mission onto the cabin **case-board**. Every tense beat resolves
  hopefully in-session.
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

Suggested autonomous target: **Phases 0–6 + the realism reach (§2a) + the Deep Demo below.** Phases 7–8
are the human-polish (the 4 topology-morph creatures, the true Alvah-face likeness) + Astro-integration tail.

**Deep Demo — the long-run capstone (Floris, 22 Jun 2026).** The unattended run ends by producing one
explorable **deep demo**: boot → avatar → free-roam the 3D Veluwe → meet the realistic ranger + animals →
hear the (Piper) voice → play each of the 5 engines in-world → follow the season/poacher arc + companion +
badges — the whole game end-to-end at its best-available realism, as a SINGLE artifact Floris reviews and
fine-tunes from. The demo IS the review gate an unattended run otherwise lacks (visual warmth, never-scary,
motion-comfort, voice, tone). Pair it with an auto-captured screenshot + QA pass so the build self-flags the
objective budgets (<150 draw calls, a11y, persistence, tone word-lint) before Floris looks.

---

## 6. Gap analysis — what's still missing

**Gating decisions — DECIDED (Floris, Jun 2026):**
1. **Build tooling** (§1c) — standalone **Vite + TS + Three.js** app under `games/.../app/`. ✅
2. **Render strategy** (§1b) — **3D-first**, art acquired in tiers (§2a), 2D fallback retained. ✅
3. **Asset approach** (§2a) — **maximize autonomy**: CC0 (Quaternius) + generate-in-code backbone now;
   optional free AI mesh-gen + auto-rig for scarce species; the human residual is just 4 jobs (§2c). ✅
4. **Alvah defaults** (§3) — consequence **mild**, helicopter **hover-stabilized**, **clean-sans** font;
   **real words used judiciously** (not jargon-off). ✅
5. **Launch content** (§4) — **CONFIRMED (Floris, 22 Jun 2026): all ~10 missions** — keep the 7 already
   authored in `prototype/content-veluwe.jsx` + write **3 new** to fill the empty **winter** season and
   the **stuifzand** + **ven** landscapes; play in season order (lente→winter), winter = the restoration
   finale. Story arc tuned for **more stakes + an active catch** (see §4 arc bullet). ✅
6. **Avatar** (§3, §8) — **CONFIRMED (Floris, 22 Jun 2026): customizable ranger-kid NOW** (fully
   autonomous creator) **+ a hand-made Alvah likeness preset LATER** (human-polish item, §2c). ✅
7. **Voice / read-aloud** — **RESEARCHED (22 Jun 2026):** `research/voice-tts-readaloud-research.md`.
   **Ship now:** Web Speech API preferring the iPad's free **Enhanced Dutch voice "Xander"** (download
   via iOS Settings → Accessibility → Spoken Content; fixes the weak default; offline). `speak()` must
   fire from a tap (iOS gesture rule). **Karaoke timing:** build our own word clock — iOS Safari
   `onboundary` is unreliable (promote the prototype's timed highlight to primary). **Free upgrades
   (later, non-blocking):** Piper (MIT) build-time pre-bake of static lines, or — now proven feasible &
   license-clean for a private project — **clone Floris's own voice** (XTTS-v2, build-time pre-bake;
   Coqui CPML = NC-only, no EU exclusion → fine here). Built behind a **swappable `Narrator` interface**;
   **Floris chose Piper (22 Jun 2026)** as the warm-upgrade target (not voice-cloning) — bake Piper
   static lines at audio-polish time; ship "Xander" until then. ✅
8. **Parallel human tracks** (§2c) — **start now**: see §6a checklist.
9. **Ambitious realism scope** (§1b/§2a) — **Floris (22 Jun 2026): take the big jump.** The long run reaches
   for max realism (realistic clean ranger + AI-generated, auto-rigged scarce animals + Quaternius CC0 big
   four + real animal audio + Piper voice), **gated on the §6a prerequisites**, falling back to CC0/procedural
   where one is missing — then a **Deep Demo** (§5) to fine-tune from. ✅
   **CORRECTION (verified 22 Jun 2026 — see `SETUP-realism-keys.md`):** the free tiers of the AI mesh/rig
   tools are **web-UI/manual or paid**, NOT free-autonomous — Meshy API = **Pro $20/mo** (free tier is
   hand-export only), Anything World rig-API = **email-gated + forced visible credit**, Mixamo = **no API
   (manual browser rig)**, self-host = **needs a 16GB+ NVIDIA GPU** (not a Mac). So the **free unattended
   run reaches realism via CC0 rigged+animated assets (Quaternius) + procedural + Piper voice +
   xeno-canto/Freesound audio (free keys)**; **photoreal AI characters/animals are a MANUAL or PAID asset
   track**, decided after the deep demo. The truly free+autonomous result is *charming & animated*, not photoreal.
   **DECISION (Floris, 22 Jun 2026): approved one month of Meshy Pro (~$20, cancel after).** So the agent can
   auto-generate + **auto-rig the realistic ranger** (Meshy API rigs humanoids) and generate realistic
   **animal meshes**. Flagship animals (vos/ree/edelhert/wolf) stay **free Quaternius CC0** (already animated);
   the residual manual/gated bit is **animating the generated scarce animals** (Meshy web-app / Anything World
   / procedural fallback). Free **Freesound + xeno-canto** keys still needed for real animal sounds; Piper voice
   stays free. Net: a realistic ranger + realistic meshes for ~$20 one-off, polished from the deep demo.
10. **Ranger realism / the "army character"** — the figure Floris liked is the **three.js *Soldier***, which
   the design audition marks **do-NOT-ship**: licence *"onduidelijk"* (three.js itself flags many example
   assets as unlicensed → fails our clean-licence rule) **and** it's an *adult armored soldier*, not a kid
   ranger. So we hit that *realism* via a **license-clean, age-correct route**: AI-generate a realistic
   junior-ranger mesh (Meshy free-tier CC BY / self-host MIT) → **Mixamo** rig (idle/walk/run) → the existing
   `ranger` spec slot; the customizable creator sits on top; a true Alvah-face likeness stays an optional
   human-polish pass (§2c). Needs the §6a mesh-gen prerequisite (else the procedural figure remains).
11. **Asset-generation order + birds-heavy cast** (Floris, 22 Jun 2026) — **Meshy Pro purchased** (1000 cr/mo,
   ~100 models; cancel after one month — generated assets are kept forever). Pipeline lives in
   `app/scripts/meshy-gen.mjs` + `asset-shotlist.json` (validated: ranger + pine generated OK). Generate the
   cast **in priority order**: **(1) characters we already need** (ranger + mission animals not covered by free
   Quaternius: wildzwijn, frisling, das, eekhoorn, raaf, nachtzwaluw, adder, heikikker) → **(2) the wolf** (via
   Meshy, per Floris) + story humans (warden, poacher) → **(3) crucial landscape props** → **(4) the birds** —
   Floris wants birds **~70% of the cast** (NL wildlife is bird-dominated); a curated batch of recognisable
   Veluwe birds for ambient life + sound-echo variety. fox/ree/edelhert stay **free Quaternius** (skip Meshy
   there). **Method:** preview→**refine** (colour/texture; raw preview is grey) + neutral A-pose for humans;
   then a **gltf-transform optimize** pass (DRACO + KTX2 + poly target) — raw GLBs are far over budget (a pine
   came out 25 MB). **Audio:** clean-licensed calls per species — **xeno-canto** for birds (**exclude
   NoDerivatives/ND**; ShareAlike ok for a private game; log each) + **Freesound** for mammals. **Credit
   reality:** the full ~50-asset list with refine ≈ the month's 1000 credits, so finish tiers 1–3 then do as
   many birds as credits allow. After the asset pipeline: continue the game build (remaining engines + 3D). ✅

7. **Free-only toolchain** (§2) — DECIDED: CC0/CC BY/NC/MIT only; no paid tools. ✅

**Research is COMPLETE** — three build references in `research/` cover assets/rigging/runtime,
expression/eyes/motion-comfort, and autonomous-sourcing/physics/world. No further research is needed to
start the build.

### 6a. Parallel human/asset checklist (start now; gates *realism*, not the build — all free)
- [ ] **REALISM PREREQUISITES — the ambitious run (§6 item 9) needs these; an agent CANNOT create accounts:**
  - [ ] **Meshy** free account + API key (output CC BY — credit Meshy) **or** a **GPU** for self-hosted MIT
        mesh-gen (TRELLIS.2 / TripoSG) — the realistic ranger + scarce animals.
  - [ ] **Anything World** free account + API key — auto-rig+animate generated quadrupeds/birds (**verify the
        output licence in writing before shipping**).
  - [ ] **Mixamo** (free Adobe account) — humanoid ranger rig + idle/walk/run clips.
  - [ ] **xeno-canto v3 key + Freesound key** — real animal calls + ambience (else placeholder tones).
  - [ ] **Piper** (no account) — agent downloads + pre-bakes static lines; **a human listens** to pick the
        Dutch voice (avoid `nl_NL-mls`; audition `nl_NL-pim` / `ronnie` / `nl_BE-nathalie`).
- [ ] **Four free-Blender jobs** (§2c): adder slither, moor-frog hop, frog metamorphosis morph, antler
      morph — **Blender + Rigify** (free). Or stylize them away to skip even this.
- [ ] **Alvah likeness**: optional human polish for a true Alvah face (the AI-gen ranger covers *realism*;
      the *exact likeness* is the human-polish item).
- [ ] **Early iPad check**: load assets through the DRACO+KTX2 pipeline on a real iPad (Safari 26+).
- [ ] **Deep Demo review (§5)**: Floris explores the demo → produces the fine-tune list (look, voice,
      comfort, tone, difficulty). This is the main human gate of the ambitious run.
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
