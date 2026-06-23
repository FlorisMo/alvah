# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by `scripts/ranger-run.mjs`. The durable checklist is
> [RUN-LEDGER.md](RUN-LEDGER.md); this is the at-a-glance view.

- **Phase:** Phase 8 / Capstone — autonomous ceiling reached (§9c)
- **Progress:** ~97% (weighted by ledger items) — all autonomously-buildable boxes done through the Deep Demo capstone + Auto-QA (132b). Health check this thread: `npm run build` GREEN + full unit suite **229/229** PASS.
- **Just landed:** Auto-QA report (capstone 132b) — build-green 229/229, draw-call/a11y/persistence/tone-lint gate PASS (commit 4caa6d1).
- **Next up:** No autonomously-actionable box remains. The three open `[ ]` boxes all need Floris (see Blocker).
- **Last heartbeat:** 2026-06-23 16:10Z
- **Blocker:** ⏸ **NEEDS-FLORIS (autonomous ceiling, §9c).** Three boxes left, none runnable in a sandboxed thread:
  1. **Ledger line 28 — Anything World generation.** External paid AW job (~31 rig/animate runs), loop/Floris-owned; no AW credits/run in-sandbox. `assets-gen/animated/` holds only the 3 Meshy humanoid rigs. The procedural-motion fallback (line 29 ✓) already animates the whole cast, so the game is fully playable meanwhile; the mixer path is wired + dormant, ready to prefer the animated GLBs the moment they are staged.
  2. **Ledger 125b — CI assets half + first live push.** Genuinely Floris's call: how the ~24 MB git-ignored `public/{models,audio,draco}` reach CI (commit the bundle vs Git LFS vs release-artifact fetch vs regenerate) — conflicts with the §9a "never commit git-ignored binaries" rule — then the first outward-facing push to main that ships `/ranger`.
  3. **Ledger 129 — final AUDIT + full E2E.** §9g gates this on the live `/ranger` deploy (125b). Its runnable half is already green this thread (build + 229/229 unit). The Phase-8 SITE-integration set stays deliberately uncommitted in the working tree (commit only via the `games/` subtree until 125b — `ranger-run.mjs commit` / `git add -A` is UNSAFE here).

```
✔ landed: Auto-QA report (capstone 132b) — build-green 229/229, gate PASS
▶ phase:  Phase 8 / Capstone — autonomous ceiling reached (§9c)
→ next:   NEEDS-FLORIS — AW generation (28) · asset-hosting + first live push (125b) · final E2E gated on deploy (129)
▷ progress: ~97%
```
