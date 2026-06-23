# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [RUN-LEDGER.md](RUN-LEDGER.md); this is the at-a-glance view.

- **Phase:** Asset pipeline
- **Progress:** ~28% (weighted by ledger items)
- **Just landed:** Anything World pipeline · script — `scripts/anything-world.mjs`: wire `ANYTHING_WORLD_API` (app/.env.local), preflight `/credits`, rig→animate→download to `assets-gen/animated/<id>.glb`, idempotent + manifest-recorded; AW-eligible cast = 8 quadrupeds + 23 birds; adder/heikikker/butterfly stay procedural; defensive field-probing for the experimental API
- **Next up:** Anything World pipeline · generation — loop/Floris-owned external paid job (~31 models, ~2 AW runs). Needs source GLBs in `assets-gen/<id>.glb` (Meshy gen) + AW credits; NOT runnable in a sandboxed thread. Run: `node app/scripts/anything-world.mjs`. The loader "prefer animated GLB over procedural" lands in the procedural-fallback + optimize/stage boxes below
- **Last heartbeat:** 2026-06-23 09:07:25Z
- **Blocker:** none

```
✔ landed: Anything World pipeline · script — `scripts/anything-world.mjs`: wire `ANYTHING_WORLD_API` (app/.env.local), preflight `/credits`, rig→animate→download to `assets-gen/animated/<id>.glb`, idempotent + manifest-recorded; AW-eligible cast = 8 quadrupeds + 23 birds; adder/heikikker/butterfly stay procedural; defensive field-probing for the experimental API
▶ phase:  Asset pipeline
→ next:   Anything World pipeline · generation — loop/Floris-owned external paid job (~31 models, ~2 AW runs). Needs source GLBs in `assets-gen/<id>.glb` (Meshy gen) + AW credits; NOT runnable in a sandboxed thread. Run: `node app/scripts/anything-world.mjs`. The loader "prefer animated GLB over procedural" lands in the procedural-fallback + optimize/stage boxes below
▷ progress: ~28%
```
