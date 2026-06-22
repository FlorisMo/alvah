# Ranger Adventures — Gameplan & project structure

> **What this is.** The master orientation doc for the new big game. It records what was
> handed over from Claude Design, how we've structured it, what we keep, and how it will be
> integrated into the Alvah site later. Read this first; then the per-folder READMEs.
>
> **Status:** structuring the hand-off (June 2026). Nothing is integrated into the Astro site
> yet — that is deliberate (`games/` lives outside `src/`, see root `README.md`).

---

## 1. What the game is (one paragraph)

**"Ranger van de Veluwe"** is a story layer that wraps Alvah's five existing executive-function
mini-games. The player is a ranger on the Veluwe who cares for animals through **missions**. The
clever bit: the EF "breinkrachten" (search, spatial memory, working memory, inhibition, cognitive
flexibility) are **hidden inside real ranger work** instead of a bare puzzle screen — not "open the
Corsi game" but "remember the route the herd took and point it back home". So it is **not a sixth
loose game**; it is a meaning-giving wrapper around the five engines. The Veluwe is area 1, built so
more areas can be added as **data, not new code**. Look & feel: a warm, Pokémon-style top-down world
that zooms into designed scenes on key moments — with a **parallel 3D track** (Three.js) that upgrades
the animals/world from CSS shapes toward realistic realtime 3D.

Full intent lives in [design/ontwerp-brief.md](design/ontwerp-brief.md) (the brief),
[design/plan.md](design/plan.md) (the gameplan/rationale) and
[design/design-spec.md](design/design-spec.md) (the craft bible).

---

## 2. What Claude Design handed over (current state)

A mature, clickable hand-off — far more than a mockup:

- **A working 2D MVP** — an 8-screen mission loop (`map → cabin → transport → travel → briefing →
  world → reunion → complete`) with **3 playable missions** and **all 5 EF engines built**
  (zoeken/corsi/simon/dagnacht/wisselen). Runs in-browser via React 18 UMD + Babel-standalone.
- **A parallel 3D proof-of-concept** — Three.js golden-hour stage, a spec-driven character pipeline,
  a photoreal-ish fox, and a procedural humanoid "ranger" likeness tool. Proves the EF engines and
  content registry are **render-agnostic** (the same logic drives 2D and 3D).
- **A content registry** — areas/missions/steps/animals modelled as **data** (`content-veluwe.jsx`),
  so new content slots in without engine changes.
- **Five deep-research documents** — verified biology, EF science + accessibility, 3D animal/eye
  rendering specs, and a Design↔Code build plan.

The authoritative narrative of the build (what's done, conventions, "do not break" rules) is
[design/HANDOFF.md](design/HANDOFF.md). Read it before touching prototype code.

---

## 3. Folder structure (and why)

```
Ranger-Adventures/
├── GAMEPLAN.md          ← you are here (master orientation)
├── README.md            ← short pointer into this structure
├── research/            ← the deep-research knowledge base — KEEP FOREVER (source of truth for content)
├── design/              ← design intent, gameplan, craft bible, build plan, handoff + UI mockups
├── prototype/           ← the runnable Claude Design hand-off (code). Kept intact & runnable.
└── design-mock-up/      ← inbox: drop the NEXT Claude Design export here; sort it per §3
```

**Why split research / design / prototype?**
- **research/** is *verified knowledge* (biology, EF evidence, 3D specs). It outlives any code and is
  the source we distill game content from. Treat it like `reference/` on the main site: read-only
  truth, never gameplay-edited.
- **design/** is *intent and plans* — what we're building and how it should feel, plus the Design↔Code
  hand-off rules and the UI flow mockups.
- **prototype/** is *the code as delivered*. Everything in it is flat siblings (the HTML loads JSX/CSS
  by relative path), so it's kept together and **stays runnable** — open any `.html`. Don't refactor it
  in place; it's the reference we re-implement from.

**Why keep `design-mock-up/`?** It was the original drop-zone and Claude Design will keep producing.
New exports land there, then get sorted into research/design/prototype per this section.

---

## 4. What we keep (the "deep sense of what we have")

### 4a. Research — keep all of it (`research/`)
All four research docs are verified and reusable. See [research/README.md](research/README.md) for the
index + confidence flags. Headline value:
- **veluwe-research.md** — verified animal terminology (frisling/rotte/zeug, roe = *sprong* not roedel),
  kid-safe facts, ranger work (camera traps, ecoducts, tree-blazing), recovery stories, and a **tone/
  safety chart** (what's fine vs. too dark for an 8-year-old). This is the content bible.
- **mini-game-research.md** — honest EF evidence (near-transfer real, far-transfer unproven → never
  claim brain-training), **19 mini-game seeds** mapped onto the 5 engines, dyslexia/accessibility rules
  (clean sans-serif **not** OpenDyslexic; cream not white; ≥44–48px targets), the **softer failure
  model** (replace 3-strike vehicle-destruction with soft-bonk), and the poacher/restoration story arc.
- **3d-animal-animation-research.md** — per-animal 3D specs (silhouette/gait/colour), the glTF/Draco/
  KTX2 pipeline, poly budgets, rigging per family, and **CC0 asset sources** (Quaternius covers all 9
  animals).
- **humans-full-animals-eyes-research.md** — human likeness specs + the **eyes/emotion** vertical
  (pupil shape, catchlights, blink/saccade, ARKit-52 blendshapes). Directly relevant to the
  "emotional expression" research you flagged.

### 4b. Code — keep most of it, by tier (`prototype/`)
Full file-by-file map in [prototype/README.md](prototype/README.md). Summary tiers for the eventual
Astro re-integration:

| Tier | Files | Fate |
|---|---|---|
| **Keep as logic** | `skill.jsx`, `companion.jsx`, `state.jsx` (the methods), `sound.jsx` (audio recipes) | Port the logic; drop the React/Babel shell |
| **Keep as content/data** | `content.jsx`, `content-veluwe.jsx`, `specs.js` | Port near 1:1 (data + character specs) |
| **Keep as engine definitions** | `step-spot/route/danger/simon/wissel.jsx` | The EF task definitions are render-agnostic — reuse the logic |
| **Keep as 3D reference** | `stage.js`, `character.js`, `humanoid.js`, `world3d-bridge.js`, `world3d.jsx` | Strong POC; keep as the pattern for the production 3D layer |
| **Reference / rewrite** | `screen-*.jsx`, `sprites.jsx`, `app.jsx`, all `*.css`, `tweaks*.jsx`, the 6 `.html` | Re-implement as Astro components; keep tokens/shapes/flows as reference |

The thesis worth protecting: **5 fixed engines + everything else is a data "skin".** New mini-game, new
animal, new mission, new area = a data record, not a code path. (HANDOFF §3b, §7.5.)

---

## 5. Integration approach (how this lands in the site, later)

Per the brief and the build plan, integration is **Claude Code's** job in the Astro repo and is a
*later* phase — this folder is the source. Guardrails when that happens:

1. **Stays outside the public build until deliberate.** `games/` is not in `src/`; nothing deploys by
   accident. robots stays Disallow; no external trackers (site rules in root `CLAUDE.md`).
2. **Reuse the proven site pipeline**, don't re-invent it: `staircase.js` / `scoring.js` /
   `progressie.js` / `mijlpalen.js` / `storage.js` / `celebration.js` already exist in `src/scripts/`.
   The mission layer is a presentation layer that still logs each step through them. The prototype's own
   `localStorage['ranger-mvp-state']` maps onto the real `alvah-ef-v1` schema (migrate, don't fork).
3. **No new frameworks/Tailwind/CSS-in-JS** (site rule). Re-implement screens as Astro + vanilla CSS;
   keep the prototype's design tokens.
4. **Render-agnostic spine first.** Land the content registry + 5 engines + difficulty/skill tracking
   (all 2D-valid) before the 3D render upgrade. 3D is a render-layer swap, not a redesign (HANDOFF §6.5).
5. **Accessibility is non-negotiable** — AVI M3/E3 copy, read-aloud, ≥44–48px targets, reduced-motion,
   cream backgrounds, audio+icon primary / text backup. (Brief §6, research Theme E.)

A suggested build order already exists in HANDOFF §7.6; we'll confirm ours when we start integrating.

---

## 6. Privacy (read before committing `games/`)

`prototype/` contains **six photos of Alvah** (`1000152315–320.jpg`) used by the likeness tools. A
`prototype/.gitignore` keeps them **local-only by default** so they don't enter git history of a repo
that could ever be shared. They still work locally. If this repo is private and you're comfortable,
delete those lines to commit them. This mirrors the site's no-surnames / privacy-first stance
(root `CLAUDE.md` rule 1).

---

## 7. Open decisions (carry-overs + new)

From HANDOFF §5/§6.7 and worth settling as we integrate:
- Map style: stylized nature-map vs. literal NL outline.
- "Knap woord" jargon (frisling/rotte) default-on or default-off for Alvah.
- Travel mini-game: how reflex-y vs. gentle/auto-assisted.
- Consequence severity default + how big the resource economy gets.
- 3D camera: fixed-follow vs. free third-person — **test with Alvah for motion sickness**.
- Show per-engine skill to the child (badges) — Floris already leaned **yes, visible** (HANDOFF §7.4).

New, structural:
- When do we start the Astro integration vs. keep iterating in `app/` here? (BUILD-PLAN §1c/§5)
- The §8 decisions that gate the first autonomous build run (BUILD-PLAN §6).

---

## 8. Deep research — DONE; now an executable plan

All **three** deep-research runs are back and folded into [research/](research/) as build references:
[3d-assets-avatar-rigging-runtime.md](research/3d-assets-avatar-rigging-runtime.md) (assets, avatar,
rigging, runtime/perf), [3d-expression-eyes-motion-comfort.md](research/3d-expression-eyes-motion-comfort.md)
(faces, eyes, animal emoting, camera/motion-comfort, storytelling), and
[3d-autonomous-sourcing-physics-world.md](research/3d-autonomous-sourcing-physics-world.md) (what the
agent can self-source for free: AI mesh-gen + auto-rig + physics + procedural world + audio). Briefs
removed (consumed). **Research is complete.** Build choices are **free-only** (CC0/CC BY/NC/MIT).

**The plan is now consolidated into [BUILD-PLAN.md](BUILD-PLAN.md)** — the executable roadmap toward an
autonomous build run: resolved technical decisions (the avatar-pipeline conflict, render strategy, build
tooling, runtime budget, expression/camera constants), the autonomous-vs-human split, the
"customized for Alvah" profile, the launch content manifest, sequenced phases with acceptance criteria,
and the gap analysis. Read it next.
