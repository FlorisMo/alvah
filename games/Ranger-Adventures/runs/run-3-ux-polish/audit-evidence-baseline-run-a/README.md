# Run A evidence — frozen baseline (do not overwrite)

This folder is a **byte-identical archive** of `../audit-evidence/` as it stood at
the end of **Run A** (the Fable audit sitting, 2026-07-03), copied here by
**Run B box P0.1** *before* the first `npm run capture` of Run B.

## Why it exists

`../audit-evidence/{laptop,ipad,crops}/*.png` and `index.html` are **git-ignored
and regenerable** — the very first `npm run capture` in Run B **overwrites them**.
Every finding in [`../AUDIT-FINDINGS.md`](../AUDIT-FINDINGS.md) (F-01 … F-34) cites
these exact frames as its evidence. Archiving them here means Fable's original
pixels survive the re-capture, so any Run B claim can be checked against the
picture the finding was actually written from (BUILD-PLAN §3 "substrate before
gates").

## What's here (captured Run A, 2026-07-03, ~10:29–11:39)

| Path | Contents |
|------|----------|
| `laptop/` | 22 PNGs — `01-title` … `22-mission-3d` (1280×800, keyboard-driven, Chromium) |
| `ipad/` | 16 PNGs — `01-title` … `16-jeep-drive-4` (1080×810 dsf 2, Chromium engine) |
| `crops/` | 18 measured detail crops (`a6-*`, `a7-*`, `a8-*`, `a9-*`) |
| `annotations-laptop.json` | per-shot dev-hook state for the laptop run |
| `annotations-ipad.json` | per-shot dev-hook state for the iPad run |
| `crop_tool.py` | the pure-Python PNG crop/diff tool used to make `crops/` |
| `index.html` | the generated contact sheet |

## Known Run A gaps (do NOT read as "these screens are fine")

- **iPad has NO board / mission-3d / reduce-motion frames** — the iPad capture
  crashed mid-scene (WebGL context loss); `annotations-ipad.json` records these as
  `GAP`. This is finding **F-21**, and hardening the harness to close it is Run B
  box **P0.2**.
- **iPad locomotion was keyboard-driven**, not touch — no touch evidence exists in
  this baseline (also F-21 / P0.2).
- Every iPad frame is the true iPad **viewport** on the **Chromium** engine (local
  WebKit is broken on this Mac — WORLD-PLAN §10). Layout/scale conclusions hold;
  true Safari rendering is a Floris on-device call.

## Tracking

Mirroring `../audit-evidence/`: the heavy PNGs + `index.html` are **git-ignored**
(they live on disk only); the two `annotations-*.json` and this `README.md` are
**tracked** so the numeric evidence stays reproducible without bloating git.
**Never overwrite this folder** — `npm run capture` only ever writes to
`../audit-evidence/`.
