# Animated Assets, Rigging, Locomotion & Physics for a Calm iPad Forest Game (vanilla TS + three.js r184)

## TL;DR
- **Adopt Quaternius' CC0 animated animal/character packs first** — they are free, public-domain (CC0-1.0), ship native glTF with baked walk/idle clips that play directly through THREE.AnimationMixer, and are low-poly/mobile-safe. This solves most of your animal-animation problem with near-zero integration effort and lets you stop fighting the un-rigged Meshy meshes.
- **For the Meshy meshes you must keep, the cheapest offline rig path is Mixamo (humans) + Meshy's own free in-app rigging or Blender Rigify (quadrupeds)** — bake to keyframes, export GLB, no runtime cloud dependency. Skip Anything World, DeepMotion, Rokoko for runtime use (cloud/subscription/per-call). Skip AI4Animation and NVIDIA KIMODO entirely — research-grade, Unity/PyTorch, non-commercial or human-only, cannot run in mobile Safari.
- **For physics, do NOT adopt a full engine yet.** Fix the sinking-on-slopes bug with a raycast-down ground-snap (offset by capsule half-height, project velocity along the slope tangent). Keep cannon-es on the shelf as the lightweight option; only reach for rapier.js if you later add stacking/tumbling physics. A WASM physics engine is overkill for a calm child's game with a ~150 draw-call budget.

---

## 1. Animated / Rigged Animal + Character Assets (drop-in for three.js)

Ranked by aesthetic fit (gentle, low-poly, never scary), license permissiveness, mobile performance, and three.js integration ease.

### #1 — Quaternius (Ultimate Animated Animals, Farm Animals, Ultimate Animated Character Pack)
- **License:** CC0-1.0 (public domain) — no attribution required, commercial OK. The most permissive possible. poly.pizza confirms each Quaternius model tagged "CC0."
- **Maintenance:** Long-running and active; the Animated Animal / Farm packs on poly.pizza show updates around mid-2022 (Jul 9–10, 2022), with newer packs (Universal Animation Library 2, Downtown City MegaKit) added recently. Stable, not abandoned.
- **Web/three.js compat:** Native glTF/GLB **and** FBX download; each animal ships multiple baked clips. The Ultimate Animated Animal Pack lists "12 different animals, each with more than 12 unique animations (Attack, Death, Kicks, Gallops, Walk, Jump and many more!)." Drops straight into THREE.AnimationMixer — the ideal format for your stack.
- **iPad performance:** Deliberately low-poly, single-material, small textures — excellent for a ~150 draw-call budget. Each animal is one skinned mesh (one draw call).
- **Integration effort:** **Low.** Load GLB, read `gltf.animations`, play clip. No conversion.
- **Forest-animal coverage:** Deer, Stag, Fox, Wolf, Husky/Shiba, plus horses/cows/etc. (poly.pizza bundle lists Cow, Donkey, Deer, Alpaca, Bull, Fox, Shiba Inu, Stag, Husky, Wolf, White Horse, Horse — all CC0). **Deer and stag are directly covered.** Badger, raven, adder, frog are NOT in the core Quaternius animated set — you'll source those elsewhere or rig your Meshy versions.
- **Link:** https://quaternius.com/ and https://poly.pizza/u/Quaternius

### #2 — Poly Pizza (poly.pizza)
- **License:** Per-asset, clearly labeled CC0 or CC-BY-3.0. Filter `?anim=1&lic=1` for animated + licensed. Hosts the Quaternius animated packs plus others.
- **Maintenance:** Active aggregator; some bundles updated Oct 1, 2025.
- **Web/three.js compat:** Direct GLB + FBX download per model; has a JSON API (v1.1) exposing an `"Animated": true` flag and direct `.glb` download URLs — you could even script asset pulls.
- **iPad performance:** Most models are low-poly (e.g. vehicles ~2,900 tris per the API sample). Good.
- **Integration effort:** **Low.** GLB download or API.
- **Coverage:** Broad low-poly animals; animation quality varies by author — verify each model actually contains clips (many are static, flagged `"Animated": false`).
- **Link:** https://poly.pizza/

### #3 — Mixamo (Adobe) — for the humanoid characters (child ranger, adult NPCs)
- **License:** Free with an Adobe ID; royalty-free commercial use, even bundled in a game. **Humanoid/biped ONLY.**
- **Maintenance:** Stable Adobe service; library unchanged but reliable.
- **Web/three.js compat:** Exports FBX/Collada, **not glTF** — you must convert. Standard pipeline: import FBX + animation clips into Blender, combine, export glTF/GLB (Don McCurdy's documented workflow at donmccurdy.com), then optimize with gltf-transform + Draco. Works perfectly in three.js after conversion.
- **iPad performance:** Rigs are game-ready but can be heavier than Quaternius; decimate/limit bone counts and texture sizes for mobile.
- **Integration effort:** **Medium** — FBX→GLB conversion + retarget step, but very well-trodden.
- **Best use:** Rig your Meshy child-ranger and adult NPCs, and pull walk/idle clips. This is the single best free path for your HUMAN characters.
- **Link:** https://www.mixamo.com/

### #4 — Kenney (kenney.nl)
- **License:** CC0-1.0 across the board (some bundles are a paid one-time "all-in-1" convenience download from $9.97, but individual packs are free CC0).
- **Maintenance:** Very active, frequent new packs.
- **Web/three.js compat:** glTF and FBX. **Character packs (Animated Characters series; the Kay Lousberg modular characters with ~17 animations, 75+ skins) ARE rigged and animated.** Kenney's **animal packs (Animal Pack Redux, 240 assets) are largely STATIC** low-poly props, not walk-cycle rigged.
- **iPad performance:** Extremely light, blocky/clean style. Excellent.
- **Integration effort:** **Low** for characters; animals would need rigging.
- **Aesthetic note:** Blockier/more abstract than "stylized-but-believable" — may read as too toy-like next to Meshy meshes, but very child-friendly and never scary.
- **Link:** https://kenney.nl/assets

### #5 — Sketchfab (Creative Commons, Downloadable + Animated filters)
- **License:** Per-model. On Sketchfab, CC-BY (Attribution) is always on by default; optional flags add NC (NonCommercial), ND (NoDerivatives), or SA (ShareAlike). Filter **Downloadable** + **Animated**, then check license: CC0 (best), CC-BY (attribution), **avoid CC-BY-NC/ND for a shipping game.** Always read per-asset license.
- **Maintenance:** Huge active marketplace.
- **Web/three.js compat:** glTF/GLB downloads; the platform itself is WebGL-based so models are web-friendly. The Model Inspector shows bone structure/vertex influences so you can check rig quality before download.
- **iPad performance:** Highly variable — many CC models are film-quality and far over your poly/draw-call budget. Must vet and decimate.
- **Integration effort:** **Medium** — quality/rig/scale inconsistency; expect per-model cleanup and gltf-transform optimization.
- **Best use:** Filling specific gaps (badger, raven, adder, frog) where Quaternius has nothing. Search tags like `rigged-animal`, `animated`, `cc0`.
- **Link:** https://sketchfab.com/search?features=animated (add Downloadable + license filters)

### Others considered (brief)
- **Synty POLYGON:** High-quality gentle low-poly style, but sold via Unity Asset Store / Fab; assets are FBX and Unity-oriented. Usable in three.js only after FBX→GLB conversion; licensing is per-seat one-time purchase but tied to their EULA (not open-source). Viable but higher-friction than Quaternius.
- **itch.io low-poly animal packs:** Many CC0/one-time-purchase animated packs (Quaternius mirrors here too — e.g. "LowPoly Animated Animals," 6 animals with Death/Idle/Jump/Run/Walk, CC0). Hit-or-miss; verify rig + license per pack.
- **Fab (Epic marketplace):** Has large animated animal bundles (e.g. an "ULTIMATE 3D ANIMAL PACK | 80+ Animals" listing Badger, Boar, Deer, Fox with "idle, walk, run, and death animations") but as FBX/Blend, Unreal-oriented, commercial licenses, and "some model comes with" animations (i.e., not all rigged) — convert to GLB and verify per model.
- **BlenderKit / Adobe Stock 3D / Sketchfab Store:** Paid or mixed licensing, heavier assets; not the fastest path for your budget/stack.

**Verdict for Area 1:** Quaternius (animals + characters) + Mixamo (your Meshy humans) covers most of the cast for free with clean glTF. Use Sketchfab CC0/CC-BY to fill badger/raven/adder/frog, or rig your Meshy versions (Area 2).

---

## 2. Auto-Rigging & Retargeting Pipelines (static Meshy mesh → animated, offline, ideally free)

The practical question: cheapest, lowest-effort, **offline** path to walk cycles on static quadruped/bird/reptile meshes, played back in three.js with no cloud dependency.

### #1 — Adobe Mixamo — HUMANS ONLY, free, best for your ranger + NPCs
- **Cost:** Free (Adobe ID). Royalty-free output.
- **Scope:** **Humanoid/biped ONLY.** Cannot rig quadrupeds, birds, or the adder.
- **Export:** FBX/Collada only (no glTF). Convert FBX→GLB in Blender; the FBX converts cleanly and the resulting rig + baked clips play in THREE.AnimationMixer. This is a standard, documented workflow.
- **Offline?** Rigging is a cloud upload, but the OUTPUT is a plain file with no runtime dependency. Fully offline at runtime.
- **Effort:** Low-medium. **Use this for every human character.**
- **Link:** https://www.mixamo.com/

### #2 — Meshy.ai in-app rigging — LOWEST EFFORT for your existing quadrupeds (free, with caveats)
- **Cost:** Free plan = **100 credits/month** ("Free plan accounts receive 100 credits per month… reset automatically on the 1st of each month at 00:00 UTC," help.meshy.ai). Crucially, **rig + animate in the web app costs 0 credits.** Free-tier output is **CC BY 4.0** ("All models generated on the Free plan are licensed under CC BY 4.0… you must credit Meshy"), plus an often-overlooked cap: **free users can download up to 10 models/month.** Pro ($20/mo) removes attribution.
- **Scope:** "Meshy's built-in auto-rigging supports humanoid and quadruped characters with no manual bone setup required" (meshy.ai/use-cases/free-game-assets) — **birds/reptiles are NOT claimed.** Animation library is uneven: "Free users access 20+ preset animations; paid plans unlock 600+ motions including walk cycles, attacks, idles, and jumps," and quadrupeds have **fewer ready animations than humanoids.** The public **API** rigging is humanoid-only and consumes credits; the free 0-credit rig is the **web app.**
- **Export:** **GLB (and FBX/USDZ)** downloaded to disk — offline, no runtime cloud dependency, native to three.js.
- **Effort:** **Very low** (<2 min, drag-drop, no weight-painting). Since your meshes already come from Meshy, this is the path of least resistance for quadrupeds — try it first for deer/boar/badger.
- **Link:** https://www.meshy.ai/features/ai-animation-generator

### #3 — Reallusion AccuRIG (+ ActorCore) — free, but biped-focused
- **Cost:** Free standalone app (Windows 8+; free ActorCore account required even for local export).
- **Scope:** Generates a **19-joint full-body BIPED rig** + finger rig. It is **humanoid/biped-focused** — not a quadruped auto-rigger. Good alternative to Mixamo for your humans, especially stylized ones (praised skin-weighting). AccuRIG 2.0 (July 2025) can also browse, retarget, and export ActorCore stock animations.
- **Export:** FBX / USD / iAvatar. FBX→GLB conversion needed for three.js.
- **Offline?** Output is a file; no runtime dependency.
- **Effort:** Low-medium. **Redundant with Mixamo for humans; not useful for animals.**
- **Link:** https://actorcore.reallusion.com/auto-rig

### #4 — Blender Rigify (quadruped + bird meta-rigs) — free, fully open, the offline workhorse
- **License:** **GPL-2.0-or-later**, bundled free with Blender. (GPL applies to the tool, not your exported art — your GLB output is yours.)
- **Scope:** Ships a **"Basic Quadruped" meta-rig** plus animal/bird rig types (wing/feather samples) — covers deer, boar, badger, raven; snake/adder needs a custom bone chain.
- **Export:** Blender's glTF exporter outputs armature + baked animation. **CRITICAL:** Rigify uses IK/control bones + drivers that do NOT export to glTF live — you must **Bake Action (Visual Keying)** to plain deform-bone keyframes before export (documented in KhronosGroup glTF-Blender-IO issues). After baking, plays fine in THREE.AnimationMixer.
- **Offline?** 100% local, no cloud ever.
- **Effort:** **Moderate-to-hard** — Rigify "does not attach the rig to a mesh, so you still have to do skinning etc. yourself" (Blender Manual). You fit the metarig, weight-paint, author/retarget the walk cycle, and bake. Free but time-intensive. Current Blender is 4.5 LTS / 5.x (2026); Rigify is bundled in all.
- **Link:** https://docs.blender.org/manual/en/latest/addons/rigging/rigify/

### #5 — Auto-Rig Pro (Blender addon) — one-time purchase, handles non-humanoids
- **License/Cost:** Paid Blender addon, **one-time purchase (~$40)** — acceptable under your "no subscription" rule.
- **Scope:** Humanoid "Smart" auto-rig; **non-humanoid (horse, dog…) can be rigged without the Smart feature.** Strong retargeting (Mixamo/BVH), and **direct FBX/GLTF export with Unity/UE/Godot presets** — notably it exports glTF directly, avoiding the manual bake dance of raw Rigify.
- **Offline?** Fully local.
- **Effort:** Medium. Best paid option if Rigify's manual baking is too painful and Meshy's quadruped animations are too limited.
- **Link:** https://superhivemarket.com/products/auto-rig-pro

### #6 — Cascadeur — one-time-purchase-capable, quadruped AutoPosing (for hand-authoring clips)
- **License/Cost:** Free tier is **non-commercial and .casc-export-only** (unusable for shipping). Indie ($8/mo annual, revenue <$100k) **converts to a perpetual license after 12 months** and unlocks FBX/GLB/USD export — so it can become effectively one-time. As of 2025.3 it added **Quadruped support for AutoPosing and QuickRig.**
- **Scope:** AI-assisted keyframe/physics animation authoring (humanoid + quadruped). Not an auto-rigger for arbitrary meshes; it's for MAKING the clips.
- **Export:** FBX/GLB/USD (paid tiers) → three.js after processing.
- **Effort:** Medium-high (animation tool learning curve). Overkill unless you want to hand-craft signature motions.
- **Link:** https://cascadeur.com/

### Explicitly flagged as WRONG for this project (cloud / subscription / per-call)
- **Anything World (anything.world):** AI animal rigging, but **cloud-based** — the Blender add-on and REST API require a live internet connection and run on a **credit/subscription system** (free tier is monthly-capped API calls; paid tiers reported from ~$50/mo). The Blender add-on is **GPL-3.0**. You *can* download the animated GLB and use it offline afterward, but the generation step is a metered cloud service. **Skip for runtime; only conceivable as an occasional offline asset-baker if the free tier suffices.**
- **DeepMotion (Animate 3D / SayMotion):** **Video-to-mocap for HUMANS**, cloud-only, credit/subscription (freemium: 1 credit ≈ 1 sec of animation; free tier is a small monthly allotment). Not for quadrupeds, not for runtime. **Skip.**
- **Rokoko (Vision / Studio):** Human mocap + retargeting; free Starter plan gives unlimited FBX export but **custom-character import + retargeting require paid Plus/Pro.** Humanoid-focused, cloud video path. **Skip for animals.**

**Verdict for Area 2:** Humans → **Mixamo** (free) → FBX→GLB. Existing Meshy quadrupeds → **try Meshy's free in-app rig first**, fall back to **Blender Rigify** (free, more effort) or **Auto-Rig Pro** ($40 one-time, smoother glTF). Everything bakes to GLB clips for cheap AnimationMixer playback. Avoid all runtime-cloud services.

---

## 3. Procedural / Learned Locomotion in a browser three.js context

Priority guidance up front: **prefer simple, mobile-safe procedural motion (spring bones + light foot-IK) over neural research tech.** For an 8-year-old's calm game you likely need almost none of this — your existing "gentle bob/sway" plus baked walk clips is already appropriate.

### #1 — three-vrm spring bones (@pixiv/three-vrm-springbone) — RECOMMENDED secondary motion
- **What it does:** Verlet-integration spring dynamics for tails, ears, hair, cloth — natural jiggle/sway with drag, stiffness, gravity, and optional collider capsules/spheres. Exactly the "gentle sway" you already fake, but principled.
- **License:** **MIT.**
- **Maintenance:** Actively maintained — "Latest version: 3.5.2, last published: 9 days ago… MIT" (npm). Note the module itself is a **small package (~1,312 weekly downloads per Snyk Advisor)**; the ~51k figure often cited is for the whole `@pixiv/three-vrm` suite, not the springbone module alone.
- **Web/iPad:** Pure JS, cheap; a handful of spring joints per animal is negligible on mobile. (There's an open request to skip off-frustum calculation — easy to gate yourself.)
- **Integration effort:** **Low-medium.** The springbone module can be used standalone on any bone chain (doesn't require a full VRM avatar), though wiring it to non-VRM rigs takes a little setup.
- **Link:** https://github.com/pixiv/three-vrm (module: `@pixiv/three-vrm-springbone`)

### #2 — Foot-IK via a small three.js IK solver (THREE.IK / IK-threejs / fullik)
- **What they do:** FABRIK/CCD inverse-kinematics chains to plant feet/legs on sloped terrain so limbs don't float or sink. `THREE.IK` (FABRIK, multi-chain, ball-joint constraints); `upf-gti/IK-threejs` (CCD + FABRIK + hinge/ball constraints); `fullik` (Caliko port, listed in the official three.js ecosystem).
- **License:** THREE.IK is open-source (jsantell); verify each repo's license before shipping.
- **Maintenance:** **THREE.IK is explicitly labeled "work in progress" and lightly maintained** — expect to pin a version and possibly patch for r184. IK-threejs and fullik are alternatives.
- **Web/iPad:** A 2–3 bone IK chain per leg is cheap; solving 4 legs on one hero animal is fine. Doing it for a whole herd is not — budget carefully.
- **Integration effort:** **Medium.** IK + terrain raycasting + rig-specific bone mapping is fiddly. Only worth it for the player-adjacent hero animal, not background critters.
- **Links:** https://github.com/jsantell/THREE.IK · https://github.com/upf-gti/IK-threejs

### #3 — NVIDIA KIMODO — NOT usable client-side; only a possible offline clip-baker for HUMANS
- **What it is (verified):** A **kinematic motion diffusion model** trained on 700 hours of optical mocap, controlled by text + kinematic constraints, for authoring high-quality **human** motion (and humanoid-robot retargeting). Interactive demo runs via Viser + a released Python codebase. The URL you supplied is **correct and current**: https://research.nvidia.com/labs/sil/projects/kimodo/
- **License:** **Codebase is Apache-2.0** (permissive). Code released at https://github.com/nv-tlabs/kimodo; trained on the SOMA body model / BONES-SEED dataset.
- **Browser/iPad?** **No.** It's a Python/PyTorch diffusion model needing a real GPU — cannot run in mobile Safari at interactive rates.
- **Offline bake?** Conceivably yes, but **HUMAN-only** and heavyweight — you'd run it on a workstation to generate human clips, export, bake to GLB. Massive overkill vs Mixamo for a child's game. **Skip.** No animal support.
- **Link:** https://research.nvidia.com/labs/sil/projects/kimodo/ (code: https://github.com/nv-tlabs/kimodo)

### #4 — AI4Animation (Sebastian Starke) — NOT usable in-browser; license blocks commercial use
- **Correct canonical repo (verified):** **https://github.com/sebastianstarke/AI4Animation** (NOT under facebookresearch). Author: Sebastian Starke (PhD, Univ. of Edinburgh; later Meta/EA). There is a newer **Python port ("AI4AnimationPy")** that removes the Unity dependency for data-processing/inference (NumPy/PyTorch), but the classic demos are Unity3D + TensorFlow/PyTorch.
- **What it does:** Deep-learning character locomotion — **Mode-Adaptive Neural Networks for quadruped motion (SIGGRAPH 2018)**, Phase-Functioned NN (2017), Neural State Machine (2019), Local Motion Phases (2020). Genuinely covers quadruped locomotion — thematically relevant.
- **License:** **Research/education ONLY — NOT free for commercial use or redistribution.** Motion-capture data is **CC BY-NC 4.0 (non-commercial).** IP belongs to Univ. of Edinburgh + Adobe. **This alone disqualifies it for a shipping game.**
- **Browser/iPad?** **No** — Unity + neural inference; not a mobile-web technology.
- **Offline bake?** Even offline, the non-commercial license makes shipping its output legally unsafe. **Skip.**
- **Link:** https://github.com/sebastianstarke/AI4Animation

**Verdict for Area 3:** Add **three-vrm spring bones (MIT)** for tails/ears — biggest believability gain for least cost, mobile-safe. Add a **small foot-IK solver only for the one or two hero animals** near the camera. **Do not** attempt KIMODO or AI4Animation in-browser; they are Unity/Python research tech, and AI4Animation is non-commercial-licensed. If you ever want their quality, the only legal/feasible use is offline clip generation on a PC (and only KIMODO is permissively licensed — human-only) — but Mixamo/Meshy/Rigify make that unnecessary.

---

## 4. Lightweight Physics for three.js in the browser

### The specific bug and its minimal robust fix (do this first — no engine needed)
Your controller resolves XZ movement then sets Y directly from a heightmap lookup, so on slopes the character's Y is set to the ground height *under its center*, and because the mesh origin is usually at the feet/center, it visually sinks as the slope rises under the leading edge. The fix is a **raycast-down ground snap**:

1. **Cast a ray straight down** (`new THREE.Raycaster(origin, new THREE.Vector3(0,-1,0))`) from a point **above** the character (current position + a few units of headroom) against the terrain mesh, then `intersectObject(terrain)`. Use the returned `intersection.point.y` as the true ground contact — this respects the actual triangle under the character, including slope, far better than a bilinear heightmap sample.
2. **Offset by the capsule/half-height:** set the character's origin to `groundY + halfHeight` (or `+ footOffset` if the model origin is at the feet). This is what stops the sinking — you place the *body*, not the *origin*, on the ground.
3. **Project movement along the slope tangent:** use the intersection's **face normal** to project the desired XZ velocity onto the slope plane (`v_slope = v - n * (v·n)`), so walking uphill doesn't overshoot into the terrain or lose speed unnaturally (the classic three.js "raycast + face normal" ball-on-terrain technique).
4. **Steep-slope clamping:** if `normal.y` (dot with world-up) is below a threshold (e.g. cos 45°), treat as unwalkable — block or slide, don't snap up.
5. **Keep the jeep from sticking to terrain:** for vehicles, don't hard-snap every frame. Either raycast from **4 wheel points** and average/orient (a cheap "4-ray suspension"), or use a **spring/hover offset** (raycast down, apply a target-height offset with damping) rather than clamping Y exactly to ground — the community "hover/spring character controller" pattern (three.js forum) prevents the vehicle from magnetically welding to every bump. A small `lerp` toward target Y also smooths stair-stepping.

This is ~30–50 lines, zero dependencies, zero bundle cost, and runs great on iPad. **It is the correct first move.** A physics engine does not fix "sinking on slopes" more cheaply than this.

### rapier.js (@dimforge/rapier3d) — powerful, but likely overkill
- **License:** **Apache-2.0.** (Permissive, fine.)
- **What/perf:** High-performance Rust physics compiled to **WASM**; very fast, robust rigid bodies, colliders, a built-in kinematic character controller (handles slopes/steps), and heightfield terrain support.
- **Bundle size:** The **`-compat` build embeds the WASM as base64 ≈ ~1.9 MB** (JS) vs **~1.4 MB** for the raw WASM build; gzip narrows the gap. Either way it's **~1.4–1.9 MB** added to your download — large for a small child's game, and it must init asynchronously (`await RAPIER.init()`).
- **Maintenance:** Actively maintained — current release **v0.19.3 (~6 months old as of mid-2026)**, Apache-2.0 (npm).
- **iPad/Safari:** WASM performs well on modern iPads; the main costs are the download/parse and async init. Non-compat build needs Vite WASM plugins (`vite-plugin-wasm`, `vite-plugin-top-level-await`).
- **Integration effort:** **Medium-high** — async init, body/mesh sync each frame, collider setup. Vanilla (non-React) usage is well documented (sbcode, dimforge).
- **When it's worth it:** Only if you later add real dynamics — tumbling objects, stacking, vehicle suspension you don't want to hand-roll, collectibles that bounce, ragdolls. For walking a child ranger and gently-bobbing animals over terrain, it's overkill.
- **Link:** https://github.com/dimforge/rapier.js/ · https://rapier.rs/

### cannon-es — the lightweight middle ground
- **License:** **MIT.**
- **What/perf:** Maintained ESM fork of cannon.js (pmndrs), tree-shakeable, TypeScript types, originally built for three.js. **~33 kB full, ~20 kB for a basic World/Body/Box setup** (per the maintainers on the three.js forum) — roughly **50–100× smaller than Rapier's WASM payload.**
- **iPad/Safari:** Pure JS, no WASM init; fine for modest body counts. Slower than Rapier at high body counts, but you won't hit those counts.
- **Integration effort:** **Low-medium** — simple API, many three.js examples; you sync `body.position/quaternion` to your mesh each frame.
- **When it's worth it:** If you want *a little* real physics (a bouncing ball, a tipping crate, simple collisions) without a big download. Good "shelf" option.
- **Link:** https://github.com/pmndrs/cannon-es

### No-engine kinematic approach (recommended default)
- Raycast ground-snap (above) + capsule-vs-terrain + slope tangent projection + steep-slope clamp covers essentially all movement needs for this game.
- **Bundle cost: 0. iPad cost: negligible** (a few raycasts/frame; add `three-mesh-bvh` if terrain is dense and raycasts get expensive).
- This is what most small three.js games ship with.

**Verdict for Area 4:** Fix the slope bug with raycast ground-snapping (no engine). Keep **cannon-es (MIT, ~20–33 kB)** as your first reach if you need light dynamics. Consider **rapier.js (Apache-2.0, ~1.4–1.9 MB WASM)** only if the game grows real physics needs — it is overkill today.

---

## Recommended Minimal Stack (in adoption order, by quality-gain-per-hour)

**Adopt now (highest ROI, all free, all mobile-safe):**
1. **Quaternius CC0 animated animals + characters** (glTF, AnimationMixer-ready). Replaces the procedural-bob hack for every animal they cover (deer, stag, fox, wolf…). *Hours: ~1–2. Gain: huge.*
2. **The raycast ground-snap fix** (offset by half-height, project along slope tangent, steep-slope clamp; 4-ray/hover for the jeep). Kills the sinking bug with zero dependencies. *Hours: ~2–4. Gain: huge, and unblocks everything on terrain.*
3. **Mixamo for the human child-ranger + adult NPCs** (rig your Meshy humans → FBX → GLB via Blender → gltf-transform + Draco). *Hours: ~2–4. Gain: high — proper human walk/idle.*
4. **Meshy in-app free rigging for your existing quadruped Meshy meshes** (badger, boar, etc. that Quaternius lacks) → GLB. Free (rig/animate = 0 credits), <2 min each; fall back to **Blender Rigify** (free) or **Auto-Rig Pro** ($40 one-time) if quadruped clips are too limited. *Hours: low per model. Gain: high for gap animals.*
5. **three-vrm spring bones (MIT)** on tails/ears of the hero animals. *Hours: ~2–3. Gain: medium — believable, gentle secondary motion.*

**Adopt later, only if needed:**
6. **A small foot-IK solver (THREE.IK/fullik)** for the one or two camera-close hero animals on slopes. *Only if feet visibly float.*
7. **cannon-es (MIT)** if you add light dynamics (a rolling ball, a tipping crate).

**Skip as overkill for a calm child's browser game:**
- **rapier.js** — until/unless you add real physics (stacking, ragdolls, vehicle sim). ~1.4–1.9 MB WASM + async init is a lot for this game.
- **Anything World, DeepMotion, Rokoko** — cloud/subscription/per-call; wrong for a free, offline, no-subscription project (occasional offline asset-baking only, and only if a free tier suffices).
- **NVIDIA KIMODO** — Apache-2.0 but human-only, Python/GPU, cannot run in mobile Safari; Mixamo makes it unnecessary.
- **AI4Animation** — non-commercial license (CC BY-NC data; research-only code), Unity/PyTorch, not web. Legally unsafe to ship regardless of offline baking.

**The one-sentence answer:** Lean on **free CC0 rigged assets (Quaternius) + Mixamo/Meshy/Rigify for the meshes you must keep**, fix locomotion on terrain with a **raycast ground-snap** and add **MIT spring bones** for charm — and treat every WASM physics engine and every neural-motion research project as optional or off-limits until the game actually demonstrates a need they uniquely solve.

## Caveats
- **Meshy free-tier output is CC BY 4.0** (attribution required) and capped at **10 model downloads/month**; pay $20/mo (Pro) to remove attribution. Its **quadruped animation library is thin** and **birds/reptiles are unconfirmed** — validate the adder and raven specifically before relying on it (its public API is humanoid-only).
- **Mixamo/AccuRIG are humanoid/biped-only**; do not expect them to rig your animals.
- **Rigify GLB export requires baking IK/drivers to keyframes** (Visual Keying) — a raw Rigify rig will not animate correctly in three.js otherwise. Rigify also does not skin the mesh for you.
- **THREE.IK is a "work in progress"** with light maintenance; pin a version and test against three.js r184.
- **Verify per-model licenses on Sketchfab/Poly Pizza/itch.io/Fab** — "animated" and "free" do not guarantee CC0 or even a rig; many labeled models are static, and Fab's big animal bundles say "some model comes with" animations.
- Always run downloaded/rigged GLBs through **gltf-transform + Draco** and check draw calls (merge materials, atlas textures) to stay under ~150 draw calls on iPad.
- Some AI auto-rig tools (e.g. 3D AI Studio, Tripo AI) advertise quadruped/avian/serpentine rigs with Mixamo-compatible GLB export; they may be worth a look for the adder/raven specifically, but verify offline export + license before relying on them, and note these are third-party/marketing claims not independently tested here.
- **Source-quality note:** Meshy, DeepMotion, Rokoko, AccuRIG and similar tool descriptions come partly from vendor marketing (promotional language like "production-ready," "in under 30 seconds"). Pricing/limits change frequently — confirm on the vendor's current pricing page before committing. Licensing facts for Quaternius (CC0), three-vrm (MIT), cannon-es (MIT), rapier.js (Apache-2.0), KIMODO (Apache-2.0), and AI4Animation (research/CC BY-NC) were taken from primary repos/pages and are the most reliable claims here.