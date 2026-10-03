/**
 * ree.window.test.ts — the calf's glimpse is fitted to the level, both ways (run 7,
 * ree-growth): a stand that hides too much is opened, one that shows too much closes a
 * little (its tussocks a little taller and fuller, never more than 40 %), so every spot
 * shows about the level's share. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { backPoints, visibleShare, type Stem } from '../cover-math.ts';
import { closeWindow, fitWindow, refitWindow, FIT_BAND, GROW_MAX, type Built } from './ree.window.ts';
import { knobsFor } from '../../../core/skill.ts';
import { stream } from '../places.ts';

/** A patch of tall grass round a calf lying at the origin, `gap` m between tussocks. */
function stand(gap: number, seed: number): Stem[] {
  const rnd = stream(seed);
  const out: Stem[] = [];
  for (let x = -1.6; x <= 1.6 + 1e-9; x += gap) for (let z = -1.6; z <= 1.6 + 1e-9; z += gap) {
    const px = x + (rnd() - 0.5) * gap * 0.5, pz = z + (rnd() - 0.5) * gap * 0.5;
    if (Math.hypot(px, pz) < 0.35) continue; // (the calf's own spot)
    const h = 0.7 + rnd() * 0.25;
    out.push({ kind: 'tussock', x: px, y: 0, z: pz, h, lx: (rnd() - 0.5) * 0.1, lz: (rnd() - 0.5) * 0.1, r: 0.3 * h, clump: out.length, yaw: rnd() * 6.28 });
  }
  return out;
}
const EYE = { x: 0.6, y: 3.8, z: -4.2 };
const BACK = backPoints(0, 0, 0, Math.PI / 2 + 0.2, 0.63, 0.36);
const AT = { x: 0, y: 0, z: 0 };
const builtOf = (s: readonly Stem[]): Built[] => s.map((q) => ({ h: q.h, lx: q.lx, lz: q.lz, r: q.r }));

// (the live stands, read in the browser on 2026-10-03 in the search itself — its
// `stats.glimpse`, from the lens the search really stands at, with real keys up to it —
// for all 12 (layout, spot) on seeded saves at levels 1-4, 24 plays: level 1 (0.38) → 0.40
// in 5 of 5, level 2 (0.32) → 0.33 in 7 of 7, level 3 (0.27) → 0.33 in 6 of 6, level 4
// (0.23) → 0.27 in 6 of 6, a share of 15 back points; review r1's repros B10, B20, A01 at
// level 2 and C0 at level 3, which the lay's lens had put off the band, among them)
test('the glimpse is fitted to the level\'s share: opened where the grass hides too much, closed where it shows too much', () => {
  let opened = 0, closed = 0;
  for (const lv of [1, 2, 3, 4, 5, 6]) {
    const min = knobsFor('zoeken', lv).glimpse;
    for (const [gap, seed] of [[0.3, 1], [0.34, 2], [0.4, 3], [0.46, 4], [0.52, 5], [0.58, 6]] as const) {
      const stems = stand(gap, seed);
      const built = builtOf(stems);
      const before = visibleShare(BACK, EYE, stems);
      fitWindow(stems, built, EYE, BACK, min, AT);
      const after = visibleShare(BACK, EYE, stems);
      const tag = `level ${lv} (glimpse ${min}), gap ${gap}: ${before.toFixed(2)} → ${after.toFixed(2)}`;
      assert.ok(after >= min - 1e-9, `${tag}: at least the level's share`);
      assert.ok(after <= min + FIT_BAND + 1e-9, `${tag}: not much more than the level's share`);
      if (before < min) opened++;
      if (before > min + FIT_BAND) closed++;
      // grown tussocks: at most 40 % taller, drawn fuller (h0 = their built height)
      stems.forEach((s, i) => {
        assert.ok(s.h <= built[i].h * GROW_MAX + 1e-9, `${tag}: a tussock grew ${(s.h / built[i].h).toFixed(2)}×`);
        if (s.h > built[i].h + 1e-9) assert.ok(Math.abs((s.h0 ?? 0) - built[i].h) < 1e-9, `${tag}: a grown tussock is drawn fuller`);
      });
    }
  }
  assert.ok(opened > 0, `it opened (${opened}; closed ${closed})`);
});

test('closing only grows the tussocks near the calf, and never hides it below the level', () => {
  const stems = stand(0.55, 9);
  const built = builtOf(stems);
  assert.ok(visibleShare(BACK, EYE, stems) > 0.3, 'a stand that shows much of the calf');
  const grown = closeWindow(stems, built, EYE, BACK, 0.25, 0.2, AT, 2.0);
  assert.ok(grown.length > 0 && visibleShare(BACK, EYE, stems) <= 0.25 + 1e-9, 'it closed');
  for (const i of grown) assert.ok(Math.hypot(stems[i].x, stems[i].z) <= 2.0 + 1e-9);
  assert.ok(visibleShare(BACK, EYE, stems) >= 0.2 - 1e-9);
  stems.forEach((s, i) => { if (!grown.includes(i)) assert.equal(s.h, built[i].h); });
});

// (review r1: the lay fitted the window for its lens, the search measured from the lens it
// really stood at — he stops up to ~0.15 m from his planned spot — and a fitted window sits
// on its edge: 5-60 cm between the two lenses moved a back point or two, below the level's
// band at level 2, and the old coarse re-open overshot to the level-1 share at level 3)
test('the search\'s lens a little off the planned one: its share is fitted again into the level\'s band, never past it', () => {
  let refits = 0, cases = 0;
  for (const lv of [1, 2, 3, 4, 5, 6]) {
    const min = knobsFor('zoeken', lv).glimpse;
    for (const [gap, seed] of [[0.3, 1], [0.34, 2], [0.4, 3], [0.46, 4], [0.52, 5], [0.58, 6]] as const) {
      for (const [dx, dy, dz] of [[0.06, 0, 0], [-0.15, 0.04, 0.1], [0.1, -0.05, -0.15], [0, 0.2, 0.3], [-0.4, 0.1, -0.3]]) {
        const stems = stand(gap, seed);
        const built = builtOf(stems);
        fitWindow(stems, built, EYE, BACK, min, AT);
        const eye = { x: EYE.x + dx, y: EYE.y + dy, z: EYE.z + dz };
        const before = visibleShare(BACK, eye, stems);
        const drawn = stems.map((q) => q.h);
        const changed = refitWindow(stems, built, eye, BACK, min, AT);
        const after = visibleShare(BACK, eye, stems);
        const tag = `level ${lv} (glimpse ${min}), gap ${gap}, lens off by (${dx}, ${dy}, ${dz}): ${before.toFixed(2)} → ${after.toFixed(2)}`;
        cases++;
        assert.ok(after >= min - 1e-9 && after <= min + FIT_BAND + 1e-9, `${tag}: in the level's band`);
        if (before >= min - 1e-9 && before <= min + FIT_BAND + 1e-9) assert.equal(changed.length, 0, `${tag}: on the band already: left as laid`);
        else refits++;
        // the stems that grow to it are named; every other one is drawn as it was
        stems.forEach((q, i) => { if (!changed.includes(i)) assert.ok(Math.abs(q.h - drawn[i]) < 1e-6, `${tag}: stem ${i} changed unnamed`); });
        stems.forEach((q, i) => assert.ok(q.h <= built[i].h * GROW_MAX + 1e-9, `${tag}: a tussock grew ${(q.h / built[i].h).toFixed(2)}×`));
      }
    }
  }
  assert.ok(refits > 0, `some lenses were fitted again (${refits} of ${cases})`);
});
