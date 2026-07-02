# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [WORLD-LEDGER.md](WORLD-LEDGER.md); this is the at-a-glance view.

- **Ledger:** WORLD-LEDGER.md
- **Phase:** Fase W5 — Voertuigen
- **Progress:** ~78% (weighted by ledger items)
- **Just landed:** W5.3a Pure heli-vluchtcore + opt-in toggle: core/heli.ts (exp-gedempte klim/daal ≤2 m/s naar vaste kruishoogte, horizon altijd recht/roll 0, gedempte yaw, translate-detectie voor vignette) + unit tests; settings.helikopter (default false) via state.ts + reduced-motion→niet-beschikbaar predicaat + unit test
- **Next up:** W5.3b Helikopter wereld-integratie: helipads bij BOA-post + stuifzand, in/uit op pads, cockpitkader-overlay + bewegings-vignette (uit bij hover), HUD-prompt, dev-hook heli(); reduced-motion toont kalme niet-beschikbaar-melding; E2E toggle aan → pad-naar-pad vlucht + FOV constant + roll 0 + gedempte yaw, en reduced-motion niet-beschikbaar
- **Last heartbeat:** 2026-07-02 19:29:01Z
- **Blocker:** none

```
✔ landed: W5.3a Pure heli-vluchtcore + opt-in toggle: core/heli.ts (exp-gedempte klim/daal ≤2 m/s naar vaste kruishoogte, horizon altijd recht/roll 0, gedempte yaw, translate-detectie voor vignette) + unit tests; settings.helikopter (default false) via state.ts + reduced-motion→niet-beschikbaar predicaat + unit test
▶ phase:  Fase W5 — Voertuigen
→ next:   W5.3b Helikopter wereld-integratie: helipads bij BOA-post + stuifzand, in/uit op pads, cockpitkader-overlay + bewegings-vignette (uit bij hover), HUD-prompt, dev-hook heli(); reduced-motion toont kalme niet-beschikbaar-melding; E2E toggle aan → pad-naar-pad vlucht + FOV constant + roll 0 + gedempte yaw, en reduced-motion niet-beschikbaar
▤ ledger: WORLD-LEDGER.md
▷ progress: ~78%
```
