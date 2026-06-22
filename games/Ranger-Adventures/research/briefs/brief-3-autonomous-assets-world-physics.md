# Deep-research brief 3 — Can a coding agent self-source the 3D cast, world & physics?

> Paste everything from "## Context" down into a Claude web deep-research run. Save the report back in
> this folder as `brief-3-REPLY.md`.

## Context (read first, then research the questions below)

I'm building a **non-commercial, private children's web game** — "Ranger van de Veluwe" — for my
8-year-old son (dyslexia, motion-sensitive; everything calm/warm/never-scary). It runs in the browser
on **Three.js / WebGL2 (WebGPU where available)**, targeting **iPad / mid-range**. We're planning a
largely **autonomous build** by a coding agent (Vite + TypeScript + Three.js). The agent can write code,
download assets over the network, and run npm tools — but it **cannot** manually sculpt/rig models in
Blender, hand-author animation, or record audio. **This brief decides how much of the realistic 3D cast
and world the agent can acquire or generate on its own, vs. what still needs a human 3D artist.**

**We already know (don't re-derive — extend/verify):** glTF/GLB + DRACO + KTX2 pipeline; budgets
(<150 draw calls/frame on iPad, ≤30 bones/skeleton, instancing, InstancedSkinnedMesh + animation
throttling); Quaternius CC0 covers **fox, deer, stag, wolf** only; **MakeHuman/MPFB2** is our humanoid
base (child proportions, CC0) with an ARKit ~16-shape subset added in Blender; **Auto-Rig Pro** is the
manual rig/retarget tool; cross-family animal retargeting is unreliable (snake/frog/bird need custom).
The **scarce species with no ready rigged CC0 asset** are: **wild zwijn, das, eekhoorn, raaf,
nachtzwaluw, adder, zandhagedis, heikikker (incl. egg→tadpole→froglet→adult metamorphosis)**; plus the
**edelhert antler-growth cycle**. We want to remove as much of the human bottleneck as possible.

## Research questions

**A. AI 3D-asset generation — is it game-ready and license-clean? (the decisive question)**
Survey current text→3D and image→3D tools and open-source models: **Meshy, Tripo / TripoSG, Rodin /
Hyper3D, Hunyuan3D (Tencent), Stable Fast 3D / SF3D (Stability), TRELLIS (Microsoft), Luma Genie, Kaedim,
Sloyd**, and any notable open-weights models. For each, establish — with sources, dates, confidence:
1. **Output quality** for *stylized, warm, child-friendly* animals (not photoreal) — good enough for our
   cast? Can they hit our scarce species (badger, squirrel, snake, lizard, raven, nightjar, frog)?
2. **Game-ready?** Do they output **clean-topology, UV'd, glTF/GLB** meshes within our poly budgets —
   and crucially, **are they rigged and animated**, or just static meshes that still need rigging?
3. **Auto-rig / auto-animate add-ons** that are **programmatic/scriptable** (not manual Blender):
   Mixamo (humanoid only?), AccuRig, **Anything-World / AnyRig**, Rokoko, Cascadeur auto-physics,
   text→motion models — what can a script chain to turn a generated mesh into a walking animal?
4. **Licensing for a private, non-commercial kids' app** — output ownership, API terms, NC clauses.
5. **Programmatic access** (API/CLI/self-hostable) + rough cost.
**Bottom line wanted:** for each scarce species + the Alvah likeness, can the agent realistically
generate a usable rigged asset, or is a human still required? Be decisive per case.

**B. Open-source physics & character controller for a *gentle* web 3D game.**
We need **light** physics (a kinematic character controller: capsule, ground/slope follow, soft
obstacle/vehicle bonks) — NOT heavy ragdoll/jitter, which would fight our strict motion-comfort spec.
Compare **Rapier (@dimforge, Rust/WASM), three-mesh-bvh (collision, physics-free), cannon-es, Jolt-wasm,
Ammo.js** for: web/iPad performance, smoothness (no jitter), maintenance, license, and fit for a
follow-cam kids' game. Evaluate the controllers **pmndrs/ecctrl** (Rapier) and **pmndrs/BVHEcctrl**
(physics-free). **Recommend one stack.**

**C. Procedural world / terrain / vegetation generation in Three.js.**
What open-source libs/techniques build our **Veluwe landscapes** (heath, mixed forest, drifting sand,
fen/pond) **from code** — heightmap/terrain generators, scatter/instancing for grass/heather/pines,
biome blending, LOD? Include the procedural-grass approach we already noted. Aim: a charming, performant
world the agent builds without hand-modelled environments.

**D. Programmatic CC0 audio acquisition.**
For the `simon` sound-echo engine (animal calls: burlen/blaf/knor/kroa/nachtzwaluw-ratel) + world
ambience: which libraries allow **API/scripted** download of **CC0 / clearly-licensed** clips
(**xeno-canto** for birds, **Freesound** CC0, others)? Note license/attribution per source so we keep a
clean log.

**E. (If relevant) "world models" / generative environments.**
Briefly assess whether any generative "world model" / scene-generation tech is mature and license-clean
enough to help build a small stylized 3D nature world for the web — or whether procedural (C) is the
pragmatic path today. Don't overreach; flag hype vs. usable.

## Deliverable format
1. **AI-3D-gen verdict table:** per tool — stylized-animal quality | rigged+animated? | glTF web-ready? |
   programmatic? | license (kids/non-commercial) | cost | source+date.
2. **Per-scarce-species decision:** for each (zwijn, das, eekhoorn, raaf, nachtzwaluw, adder,
   zandhagedis, frog+metamorphosis, antler-cycle, Alvah likeness) → "agent can self-source via X" or
   "human still required, because Y."
3. **Recommended physics/controller stack** with rationale + the comfort caveat.
4. **Recommended procedural world toolkit** + repos.
5. **CC0 audio sources** + how to fetch + license notes.
6. **One-paragraph bottom line:** how much of BUILD-PLAN §2c (the human residual) collapses into the
   autonomous agent if we adopt your recommendations.
Flag every load-bearing claim **zeker** / **waarschijnlijk**, with source URL + date.
