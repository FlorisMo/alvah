# research/ — verified knowledge base (keep forever)

The deep-research foundation for the game. Treat like the site's `reference/`: **read-only truth**,
the source we distill game content from — never edited for gameplay. Each doc tags its claims with
confidence (**zeker** = solid, **waarschijnlijk** = likely). Honour those flags.

## Upstream research (the "what")
| File | What it is | Use it for |
|---|---|---|
| [veluwe-research.md](veluwe-research.md) | Verified Veluwe natural history | Animal terminology (frisling/rotte/zeug; roe = *sprong*, not roedel), kid-safe facts, real ranger work, recovery stories, and the **tone/safety chart** — what's fine vs. too dark for an 8-year-old |
| [mini-game-research.md](mini-game-research.md) | EF science + game-design research | Honest EF evidence (no brain-training claims), **19 mini-game seeds** → 5 engines, dyslexia/accessibility rules, the softer **failure model**, the poacher/restoration story arc |
| [3d-animal-animation-research.md](3d-animal-animation-research.md) | 3D animal art-direction + pipeline | Per-animal silhouette/gait/colour specs, glTF/Draco/KTX2 pipeline, poly budgets, rigging per family, CC0 asset sources |
| [humans-full-animals-eyes-research.md](humans-full-animals-eyes-research.md) | Human likeness + eyes/emotion vertical | Human proportions, eye/iris rendering, ARKit-52 — the base for the expression work |

## Build references (the "how", from the three deep-research runs — research is COMPLETE)
Actionable, decision-grade. The plan resolves their conflicts in [../BUILD-PLAN.md](../BUILD-PLAN.md) §1–2.
| File | What it is | Use it for |
|---|---|---|
| [3d-assets-avatar-rigging-runtime.md](3d-assets-avatar-rigging-runtime.md) | "Build it" reference | Per-animal asset table (what's CC0 / paid / must-custom-rig), avatar-system pick (**MakeHuman/MPFB2**), per-family rig+retarget workflow, WebGL2/WebGPU runtime + measured budgets + repos to study |
| [3d-expression-eyes-motion-comfort.md](3d-expression-eyes-motion-comfort.md) | "Feel it" reference | ARKit ~16-shape subset + per-emotion recipes, child/adult blink/gaze timing, per-family animal "never-scary" emote cheat-sheet, eye-render recipe, motion-comfort spec + QA checklist, reading-light storytelling |
| [3d-autonomous-sourcing-physics-world.md](3d-autonomous-sourcing-physics-world.md) | "Can the agent self-source it" reference | AI mesh-gen verdict table + per-species decision (what the agent can generate vs the 4 human jobs), free physics/controller stack (Rapier/ecctrl, three-mesh-bvh/BVHEcctrl), procedural world toolkit, CC0 audio (xeno-canto/Freesound). **Key fact: mesh-gen is solved; legless/morphing rigs are the residual.** |

## Read-aloud / voice (accessibility)
| File | What it is | Use it for |
|---|---|---|
| [voice-tts-readaloud-research.md](voice-tts-readaloud-research.md) | Free/open Dutch TTS for the read-aloud + karaoke | **Ship-now:** Web Speech API preferring the iPad's free **Enhanced Dutch voice "Xander"**. **Best free upgrade:** **Piper** (MIT, build-time pre-bake of static lines). **Parent-voice-cloning verdict:** **XTTS-v2** — feasible & license-clean for a *private* project, build-time only. **iPad-Safari word-timing reality:** don't trust `onboundary`; build our own word clock. Kokoro ruled out (no Dutch). |

## Known gaps (each doc has its own "Open Gaps"/"Caveats" section)
- **Scarce rigged animals** (das, eekhoorn, adder, zandhagedis, raaf/nachtzwaluw) + **frog metamorphosis**
  / **antler cycle** have no ready assets → the human asset track (BUILD-PLAN §2).
- **Avatar conflict resolved:** MakeHuman base (child proportions, CC0) + ARKit subset authored in
  Blender (BUILD-PLAN §1a).
- **No exact population numbers** — use "honderden herten" at most, never as game facts.
- **Device performance** (iPad) unmeasured — profile early; treat the budgets as conservative starts.
- **Cybersickness numbers** are mostly VR-measured — milder on tablet; playtest the values with Alvah.
