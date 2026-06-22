# Ranger van de Veluwe — Asset, Avatar, Rigging & Runtime Build Reference (June 2026)

## TL;DR
- **CC0 coverage is partial.** Quaternius (CC0) cleanly covers edelhert (deer/stag), vos (fox), and a wolf base usable for canid motion; but **wild zwijn, das, eekhoorn, raaf, nachtzwaluw, adder, zandhagedis, and heikikker (esp. metamorphosis) must be custom-rigged from static models or bought.** Plan to **custom-rig ~7 of 11 animals** and **hand-build all frog metamorphosis stages**.
- **For humanoids, use MakeHuman/MPFB2 (CC0 output, GPLv3 tool) as the primary path** for the child + adult ranger + poacher — it is the only option with a real age slider (true child proportions), CC0 output safe for a private kids' app, and clean glTF/Blender export. Ready Player Me is a fallback but is **not CC0** (website avatars are CC-BY-NC-SA; "free for registered developers" under Partner terms) and has weak child-body support.
- **Runtime is sound: ship WebGL2 now, feature-detect WebGPU.** WebGPU is enabled by default in Safari 26 on iPadOS (released 15 Sept 2025) but shipped with bugs that affected Three.js (fixed in 26.1). Three.js `WebGPURenderer` (import `three/webgpu`) auto-falls-back to WebGL2. Budget to **~100–200 draw calls/frame**, instanced vegetation, **≤25–30 bones/skeleton**, KTX2 textures, and shared-skeleton/animation-throttling for any animal crowds.

## Key Findings

1. **The single biggest content risk is rigged-animal scarcity, not modeling.** Static meshes of every species exist; rigged+animated CC0 versions do not. The realistic plan is one shared rig per animal *family* plus a small custom animation library, retargeted offline.
2. **Quaternius' free "Animated Animal Pack" (CC0) contains exactly 12 models:** Cow, Donkey, Deer, Alpaca, Bull, Fox, Shiba Inu, Stag, Husky, Wolf, White Horse, Horse — confirmed by the poly.pizza bundle listing. Among your cast it directly yields **Deer/Stag (edelhert), Fox (vos), and Wolf (canid base)**. Nothing else in your list is in it.
3. **Frog metamorphosis (egg→tadpole→froglet→adult) does not exist as a ready CC0/web asset.** The only off-the-shelf life-cycle products are paid and DAZ/Maya-targeted (DAZ "Amazon Tree Frogs and Tadpole"; TurboSquid "Frog Life Cycle Stages Rigged for Maya") — wrong topology/format/licensing for a web build. Guaranteed custom job, best solved with **morph targets (blend shapes) across 4 stage meshes**, not bones.
4. **MakeHuman/MPFB2 is the only character generator with genuine child support and clean CC0 licensing.** Per the yelzkizi.org MetaHuman child-creation guide, "MetaHuman Creator currently lacks child presets… Toddlers are nearly impossible due to extreme proportions. MetaHuman suits ages 8+. Requires custom rigs for younger." VRoid is anime-styled and cannot be set CC0 on VRoid Hub; CC4 is paid and Windows-only with awkward glTF export.
5. **Cross-family animal retargeting is only reliable *within* a family.** Auto-Rig Pro's Remap is the most capable tool (different bone names/orientations, spline-IK for snakes/tails, 3-bone IK for digitigrade legs). Three.js' built-in `SkeletonUtils.retarget()` is fragile and effectively humanoid-only. Snake and frog will not accept quadruped animation at all.
6. **WebGPU on iPad is real but young.** Safari 26.0 (15 Sept 2025) shipped WebGPU on iOS/iPadOS; Safari 26.1 (3 Nov 2025) had to fix WebGPU bugs — per WebKit's Safari 26.1 notes, it "Fixed an issue where WebGPU video textures failed to load in Three.js panoramas. (159918934)." Treat WebGPU as progressive enhancement, not baseline.

## Details

### A. Per-animal asset table

Legend: rig/anim presence and license flagged **zeker** (certain, directly sourced) or **waarschijnlijk** (probable). Dates checked June 2026.

| Animal (NL/EN) | Best CC0 option | Best paid option | Rig / anims | License | Key URL | Verdict |
|---|---|---|---|---|---|---|
| **Wild zwijn + frisling** (wild boar + piglet) | None CC0 (not in Quaternius pack) | "ULTIMATE 3D ANIMAL PACK" (Fab/WildMesh) incl. Boar/Wild Boar, some rigged+anim (FBX/Blend); WildMesh free Sketchfab demos are **personal-use only** | paid: yes (varies); CC0: none | mixed | fab.com listing 88598546-b2b4 | **Custom-rig from static; piglet = scaled boar mesh.** zeker no CC0 rigged |
| **Edelhert** (red deer, antler cycle) | **Quaternius "Stag" + "Deer" (CC0)**, glTF, ~12 anims, low-poly | WildMesh "Realistic Deer 2.0" (145 anims; paid on Fab/Patreon) | CC0: rigged+anim **zeker**; paid: rigged+anim zeker | CC0 (Quaternius) | poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS | **Use Quaternius Stag as base; antler cycle is custom (gap #2).** |
| **Ree** (roe deer) | No dedicated CC0; **retarget from Quaternius Deer** | deer models on CGTrader/TurboSquid | derive from deer rig | CC0 (derived) | quaternius.com | **Reshape/retarget Quaternius Deer; same ungulate rig.** |
| **Vos** (red fox) | **Quaternius "Fox" (CC0)**, glTF, ~12 anims | many | CC0: rigged+anim **zeker** | CC0 | poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS | **Direct use. Best-case animal.** |
| **Das** (European badger) | No CC0 rigged found (scarce) | CGTrader/TurboSquid mustelids; "ULTIMATE 3D ANIMAL PACK" lists Badger/HoneyBadger | scarce | mixed | cgtrader.com badger | **Custom-rig from static, or buy. Hard spot.** zeker scarce |
| **Eekhoorn** (red squirrel) | "Low-Poly Squirrel (Rigged)" by SomeNortherner — free, "any purpose incl. commercial" w/ credit requested; **weights need work** | "Cartoon Squirrel Animated Rigged Base Mesh" (3DDisco, Fab) 8 anims incl. climb; "Squirrel Animated Rigged" (GamePropsFactory) 18 anims | free rig present but unweighted **waarschijnlijk**; paid rigged+anim **zeker** | free ≠ CC0 (attribution) | sketchfab 7983c9e011ad | **Buy a rigged base or custom-rig. Hard spot.** |
| **Raaf** (raven) | No verified CC0 rigged raven; "Crow LowPoly" animated exists, license unconfirmed | CGTrader/TurboSquid rigged ravens/crows (200+) | scarce CC0 | mixed | sketchfab.com/tags/raven | **Custom-rig from static bird, or buy. Bird-family rig.** |
| **Nachtzwaluw** (nightjar) | None (niche species) | None species-specific; use generic bird | none | n/a | — | **Custom: reshape raven/bird rig to nightjar silhouette.** zeker none |
| **Adder** (viper) | "Snake [Low Poly]" (endbored) & others free on Sketchfab; CC0 varies | Zacxophone "Animated snakes pack" (3 rigged meshes, 3 slither anims, **~95.8k tris — needs decimation**); "King Cobra Rigged low poly" | paid: rigged+anim **zeker**; free: rig varies | mixed; verify per model | sketchfab 88d57c4b19fc | **Buy Zacxophone pack or spline-IK custom. Spline-IK only — no quadruped retarget.** |
| **Zandhagedis** (sand lizard) | No confirmed CC0 rigged sand lizard | Generic lizards on CGTrader/TurboSquid; "Quirky Series" Chameleon/Iguana (UE, paid) | scarce | mixed | cgtrader.com lizard | **Custom-rig from static, or buy generic lizard. Hard spot.** |
| **Heikikker** (moor frog + metamorphosis) | None CC0; no metamorphosis anywhere free | DAZ "Amazon Tree Frogs and Tadpole" (full metamorphosis, DAZ format); TurboSquid "Frog Life Cycle Stages Rigged for Maya" | paid life-cycle exists, wrong format/license | paid, non-web | turbosquid.com 1727503; docs.daz3d 50107 | **Fully custom: 4 stage meshes + morph targets. Hardest spot.** zeker no ready web asset |

### B. Avatar-system comparison

| System | Child proportions | Custom likeness | Modular swap (hair/skin/outfit/iris) | glTF web export | License fit (private kids' app) |
|---|---|---|---|---|---|
| **MakeHuman / MPFB2** | **Yes — real age slider to child/toddler** | Yes (sculpt/morph in Blender) | Yes (proxies, MakeSkin materials, separate hair/clothes) | Yes via Blender glTF exporter | **Best — output CC0; tool GPLv3; safe for closed/private app, no attribution** zeker |
| **Ready Player Me** | Weak — adult/teen body; no true child body | Selfie→avatar or preset; limited | Yes (assets/outfits via Studio) | Yes (GLB via REST/iframe; LOD options) | **Caution — website avatars CC-BY-NC-SA; "free for registered developers" under Partner terms, NOT a perpetual CC0 grant** zeker |
| **VRoid Studio** | Anime child possible but stylized, not realistic | Yes (anime aesthetic) | Yes (very strong dress-up/material system) | VRM (glTF-based); needs conversion | Output usable commercially BUT **cannot be set CC0 on VRoid Hub**; anime look off-brief |
| **Character Creator 4** | Child morphs via content but adult-centric | Yes (headshot plugin) | Yes (best-in-class) | Awkward — glTF export historically weak; FBX native | Paid; Standard License now allows engine export; Windows-only |

**Recommendation: MakeHuman/MPFB2 as the single primary path** for child avatar + adult ranger + poacher. Rationale: (1) only tool with authentic child body proportions — non-negotiable for an 8-year-old protagonist (per the yelzkizi.org guide, even MetaHuman "suits ages 8+" and needs custom rigs/scaling for younger, while MPFB2 has a true age macro down to child/toddler); (2) CC0 output removes all licensing doubt for a private kids' game; (3) native Blender workflow shares the same Rigify/game rig and the same glTF/DRACO/KTX2 export pipeline you use for animals; (4) modular meshes + MakeSkin materials map directly to a character-creator UI (skin tone, hair, outfit, iris). Build the "specific boy" default as a saved MPFB preset; expose a curated subset of sliders/material swaps in your in-game creator. **Trade-off:** MPFB base faces are less photoreal than CC4/RPM and need artist polish — budget sculpting time for the likeness preset. Keep RPM as a contingency only for selfie-to-avatar; if used, register as a developer and re-confirm current Partner terms (per RPM docs, website avatars are "under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license… for non-commercial projects (as long as you credit us)").

### C. Per-family rig + retarget workflow

**Core principle:** build a small set of **shared family skeletons**, author one animation library per family, and retarget *within* family only. Cross-family retarget (deer→fox) works partially; quadruped→snake/frog/bird does not.

- **Ungulate (edelhert / ree / zwijn):** One quadruped skeleton (spine, 4 legs w/ 3-bone IK, neck, tail, head, jaw, ears). Rig in **Auto-Rig Pro** (rigs non-humanoids manually) or Rigify quadruped meta-rig. Author deer locomotion once; **ARP Remap** to roe (smaller) and boar (bulkier) using interactive offset tweaks for proportion. zeker (ARP supports differing proportions/bone orientations).
- **Canid (vos):** Quaternius Fox is already rigged+animated — use directly; for extra clips, share the quadruped rig and retarget.
- **Rodent (eekhoorn):** Custom quadruped+climb rig (grasping forepaws + big tail). Closest off-the-shelf is a paid squirrel base. Author idle/eat/climb/leap manually.
- **Mustelid (das):** Low-slung quadruped variant of the canid rig (short legs, long body). Custom-rig static badger in ARP.
- **Bird (raaf / nachtzwaluw):** One bird rig (wing feather chains, tail fan, neck, feet). Author raven flight/hop/perch; reshape mesh for nightjar. No CC0 base — custom.
- **Snake (adder): spline-IK only.** Use ARP's **Spline IK limb** (explicitly advertised for ropes/tentacles/IK spine). Do NOT retarget quadruped anims. Either buy Zacxophone's rigged slither pack (decimate from ~95.8k tris to ≤5K) or rig a custom bone-chain + spline IK.
- **Lizard (zandhagedis):** Sprawling quadruped rig (legs out to side, belly-low, whippy tail). Custom in ARP — distinct from ungulate digitigrade legs.
- **Frog (heikikker):** Custom skeleton (powerful hind legs, IK feet, jump arc). **Metamorphosis = morph targets across 4 separate stage meshes** (egg cluster, tadpole, froglet w/ legs+tail, adult), cross-faded — bones cannot grow legs. zeker (no ready asset).

**Tool verdict:** **Auto-Rig Pro (Remap module) is the recommended primary rig+retarget tool** — universal (ARP/Rigify/custom), IK feet/hands, spline IK, glTF/FBX export, interactive proportion offset. **Rigify** is the free fallback for rigging (quadruped/bird meta-rigs) but weaker at retargeting. **Cascadeur** is useful for *authoring* physically-plausible animal motion (jumps/falls) but is not a retargeter. **Rokoko / SkeletonUtils / upf-gti retargeting-threejs are humanoid-focused** — use upf-gti or SkeletonUtils only for the human cast, and note even there `SkeletonUtils.retarget()` is buggy/outdated (documented param mismatches; fails on differing proportions). Do all animal retargeting **offline in Blender**, bake clips, export — never at runtime.

### D. Runtime & performance

**WebGPU / WebGL2 state (iPad target):**
- WebGPU is **enabled by default in Safari 26** on macOS/iOS/iPadOS/visionOS (Safari 26.0, "Released September 15, 2025 — 26 (20622.1.22)," added WebGPU support per Apple release notes). Before iPadOS 26, Safari had **no** WebGPU, so WebGPU only reaches latest-OS users. zeker.
- **Known early bugs:** WebKit's Safari 26.1 notes (released 3 Nov 2025) "Fixed an issue where WebGPU video textures failed to load in Three.js panoramas. (159918934)" and a WebGPU black-screen video-playback bug — i.e. real Three.js-affecting bugs shipped in 26.0. A WebGPU "device lost (destroyed)" crash is reported on Safari 26 for WASM apps doing a second render pass. iOS Metal backend has buffer-size caps (~256MB older iPhones up to ~993MB iPad Pro). zeker.
- **Three.js `WebGPURenderer`** (import from `three/webgpu`) **auto-falls back to a WebGL2 backend** when WebGPU is unavailable; requires `await renderer.init()`. Consensus that **r171 (Sept 2025)** made it production-viable; TSL compiles to WGSL (WebGPU) or GLSL (WebGL2); Node materials only run on WebGPURenderer. waarschijnlijk on exact revision; zeker on capability.
- **Recommendation:** Ship **WebGL2 as baseline**; instantiate `WebGPURenderer` and let it fall back, OR feature-detect `navigator.gpu` and opt into WebGPU only on confirmed-good configs. Don't depend on WebGPU compute for core gameplay yet. Tooling caveat: stats-gl dropped WebGPU compat as of r181.

**Measured budgets (mostly PC/laptop-measured — treat iPad as stricter):**
- **Draw calls are the governing constraint, not triangles.** Per Utsubo's "100 Three.js Tips That Actually Improve Performance (2026)": "Below 100 draw calls, most devices maintain smooth 60fps. Above 500, even powerful GPUs struggle. Check with renderer.info.render.calls." R3F docs cap "1,000 draw calls as the very maximum, optimally a few hundred or less." Same Utsubo source: "A real estate demo reduced draw calls from 9,000 to 300 by switching chairs to instanced rendering." zeker.
- **Skinned meshes are CPU-bound:** On an old i7-4720HQ laptop, frames dropped below 60fps past **~200 skinned meshes** (model: 700 verts / 900 tris / 128² tex / 25 bones). With **animation throttling (update every 4th frame) + `bindMode="detached"` → ~500 @ 60fps**; with a **shared-skeleton manager → 1,000 @ 60fps**. On a tablet the bottleneck shifts to GPU and numbers drop sharply (one user got 5–10fps at 2,000 instances pre-optimization). **~25–30 bones is the recommended mobile skeleton ceiling.** zeker (Three.js forum, PC-measured).
- **VRAM/textures:** an uncompressed 200KB PNG can occupy **20MB+ of VRAM**; **KTX2/Basis stays GPU-compressed (~10× reduction)**. Use UASTC for normals/hero textures, ETC1S for diffuse; power-of-two dims (128–1024). zeker.
- Your stated ceilings (~50K tris & <100 draw calls/frame; poly tiers 1.5–4K overworld / 5–15K mid / 20–50K close-up) are **consistent with these measurements** and appropriately conservative for iPad. Keep them.

**Open-source repos to study (exact URLs, checked June 2026):**
- **pmndrs/ecctrl** — https://github.com/pmndrs/ecctrl — floating-capsule third-person controller for R3F + Rapier, with skinned-mesh animation set (`EcctrlAnimation`), touch joystick, camera modes. WebGL2, MIT, ~635★. Closest off-the-shelf match for your child-ranger controller.
- **pmndrs/BVHEcctrl** — https://github.com/pmndrs/BVHEcctrl — newer physics-free controller using three-mesh-bvh; supports **InstancedStaticCollider** (relevant for instanced world props). WebGL2.
- **donmccurdy/three-gltf-viewer** — https://github.com/donmccurdy/three-gltf-viewer — canonical **glTF + DRACO + KTX2 + Meshopt** loader setup and disposal patterns. ~2.3k★, actively maintained.
- **luis-herasme/instanced-skinned-mesh** — https://github.com/luis-herasme/instanced-skinned-mesh — InstancedSkinnedMesh + animation LOD/throttling for animated crowds (10→144fps at 2,000 instances). Directly relevant to herds/flocks of animals.
- **CK42BB/procedural-grass-threejs** — https://github.com/CK42BB/procedural-grass-threejs — instanced grass/vegetation, distance LOD, **WGSL compute with WebGL2 fallback + TSL references**. Best match for Veluwe heath/vegetation.
- **swift502/Sketchbook** — https://github.com/swift502/Sketchbook — full third-person + vehicle web game engine (three + cannon), animation FSM, Blender scene pipeline. ~1.7k★ but **archived/inactive** — study architecture, don't depend on it.
- **obecerra3/OpenWorldJS** — https://github.com/obecerra3/OpenWorldJS — open-world engine, instancing, GLTF, animation FSM. Experimental.
- **Wawa Sensei** — https://github.com/wass08 (e.g. `r3f-vite-starter`, `r3f-3rd-person-controller-final`, `r3f-sims-online-final`) — R3F game boilerplates/tutorials for character + scene architecture.
- **klich3/threejs-gltf-with-compressions-sample** — https://github.com/klich3/threejs-gltf-with-compressions-sample — side-by-side Draco/Meshopt/KTX2 with real file-size deltas.

### E. Gap list — what must be custom-built (cheapest path each)

1. **Frog metamorphosis (egg→tadpole→froglet→adult)** — *hardest.* No asset anywhere. Cheapest: model 4 low-poly stage meshes in Blender, link with **morph targets / cross-fade**, one simple skeleton on the legged stages. ~Several days of artist time.
2. **Edelhert antler-growth cycle** — no off-the-shelf solution. Cheapest: model 3–4 antler LOD/stage meshes (velvet nub → full → cast), **swap as child meshes parented to a head socket**, toggle by season state. Use mesh swap, not bone morph.
3. **Das (badger)** — custom-rig a static mesh on the mustelid skeleton. Cheap: buy a static badger, auto-skin in ARP, author 4–5 clips.
4. **Eekhoorn (squirrel)** — buy a rigged base (3DDisco/Fab w/ climb anims) OR custom-rig; add climb/leap/eat.
5. **Adder (viper)** — buy Zacxophone slither pack (decimate to ≤5K tris) OR custom spline-IK chain.
6. **Zandhagedis (sand lizard)** — custom sprawling-quadruped rig from a static lizard.
7. **Raaf + nachtzwaluw (birds)** — one custom bird rig; nightjar = reshaped raven mesh.
8. **Wild zwijn + frisling** — custom-rig static boar; piglet = scaled/retextured boar.
9. **Ree (roe deer)** — cheapest gap: reshape + retarget from Quaternius Deer.
10. **Child likeness preset** — sculpt the specific boy as an MPFB/Blender preset (artist time), expose curated creator sliders.

## Recommendations

**Stage 1 — De-risk content (weeks 1–4).**
- Lock the pipeline on easy wins first: import Quaternius **Fox, Deer, Stag** (CC0), run them through your gltf-transform → DRACO+KTX2 path, and validate on a real iPad in Safari 26 (WebGL2 baseline).
- Stand up **MakeHuman/MPFB2** and produce the child avatar + ranger + poacher as CC0 glTF; build the "specific boy" preset. This unblocks the human cast cheaply.
- Build the **family-skeleton rig library in Blender + Auto-Rig Pro** (ungulate, canid, mustelid, rodent, bird, lizard, snake-spline, frog). Buy ARP (one-time, low cost) — it is the load-bearing tool.

**Stage 2 — Fill the gaps (weeks 4–10).**
- Custom-rig boar, badger, lizard, bird from static meshes; buy rigged squirrel and snake bases to save time. Author one locomotion library per family and ARP-Remap within family.
- Prototype the **frog metamorphosis (morph-target)** and **antler-cycle (mesh-swap)** early — novel and schedule risk.

**Stage 3 — Runtime hardening (ongoing).**
- Keep WebGL2 the baseline; add WebGPU via `three/webgpu` auto-fallback behind a feature flag once Safari WebGPU stabilizes past 26.1.
- Enforce budgets with `renderer.info`: target **<150 draw calls/frame** on iPad, instanced vegetation/props, shared skeletons or InstancedSkinnedMesh + animation throttling for repeated animals, **≤30 bones** per animal skeleton, all textures KTX2.
- Study **ecctrl** for the controller, **three-gltf-viewer** for the loader, **instanced-skinned-mesh** for herds, **procedural-grass** for the heath.

**Thresholds that change the plan:**
- If draw calls exceed ~250 on iPad or visible skinned-animal count exceeds ~30, switch repeated animals to InstancedSkinnedMesh + LOD immediately.
- If MPFB likeness quality proves insufficient for the "specific boy," escalate to Character Creator 4 (paid) for the hero head only, keeping MPFB for the rest.
- If WebGPU bugs persist past Safari 26.2, stay WebGL2-only through launch.

## Caveats
- **License verification is per-asset and load-bearing.** "Free" on Sketchfab ≠ CC0; many WildMesh/AnimalMesh "free downloads" are **personal-use-only** (commercial only via Fab/Patreon). Re-check each model's license tab at download time and keep a license log. For a *private, non-commercial* project most CC-BY/personal-use terms are tolerable, but CC0 is safest and avoids attribution UI.
- **Ready Player Me terms can change.** The "free for registered developers" path is governed by Partner terms, not a perpetual CC0 grant (website avatars are explicitly CC-BY-NC-SA). Re-confirm before relying on it.
- **Performance numbers above are mostly PC/laptop-measured** from Three.js forum case studies; no authoritative single-iPad-model benchmark was found. Treat iPad as stricter and profile on the actual target device early. (synthesis flagged waarschijnlijk)
- **Truebones "FBX/BVH ZOO" (75+ animals, free w/ code, royalty-free):** coverage of your exact species is unverified and its rigs are mocap-skeleton FBX of uneven quality — potentially useful as an *animation* source to retarget, but verify per-animal before relying on it.
- **Quaternius CC0 status is confirmed zeker** (CC0 1.0 on poly.pizza / itch / quaternius.com); the free "Animated Animal Pack" 12-model roster is confirmed and does **not** include your scarce species. Note the larger "Ultimate Animated Animal Pack" (12 models, also CC0, "free to use in personal and commercial projects") is a separate download — verify its exact species list before assuming extra coverage.