import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mottleRGB,
  vertexTint,
  groundPatch,
  heathCover,
  detailTile,
  DETAIL_TILE_PX as TILE,
  BIOME_GROUND_TONES,
  GROUND_TILE_PX,
  GROUND_TILE_REPEAT,
  GROUND_BRIGHTEN,
} from './GroundDetail.ts';
import { BIOME_ORDER } from './Biomes.ts';

// W4.4 — the pure ground-albedo layers. The world paints from these, so the
// invariants that keep it gouache-not-garish (deterministic, tileable, in-range,
// near-parity brightness) are pinned here, no browser needed.

test('mottleRGB is deterministic and in [0,1]', () => {
  for (const [u, v] of [[0.1, 0.2], [0.5, 0.5], [0.83, 0.04], [0.99, 0.99]]) {
    const a = mottleRGB(u, v);
    const b = mottleRGB(u, v);
    assert.deepEqual(a, b, 'same input → same colour');
    for (const c of a) {
      assert.ok(c >= 0 && c <= 1, `channel ${c} in [0,1]`);
    }
  }
});

test('mottleRGB tiles seamlessly (u=0 matches u=1, v=0 matches v=1)', () => {
  for (const v of [0, 0.17, 0.42, 0.8]) {
    assert.deepEqual(mottleRGB(0, v), mottleRGB(1, v), 'wrap in u');
  }
  for (const u of [0, 0.31, 0.66, 0.9]) {
    assert.deepEqual(mottleRGB(u, 0), mottleRGB(u, 1), 'wrap in v');
  }
});

test('mottleRGB is near-white on average (gentle shade, not a dark map)', () => {
  let sum = 0, count = 0;
  const N = 24;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const [r, g, b] = mottleRGB(i / N, j / N);
      sum += (r + g + b) / 3;
      count++;
    }
  }
  const mean = sum / count;
  // gouache wash: bright on average so the multiplied ground keeps its daylight
  assert.ok(mean > 0.82 && mean < 0.96, `mean grey ${mean.toFixed(3)} stays high`);
});

test('mottleRGB highlights read warm, pools read cool (golden hour)', () => {
  // Scan for the brightest and darkest samples; the bright one biases red>blue.
  let hi: [number, number, number] = [0, 0, 0];
  let lo: [number, number, number] = [1, 1, 1];
  const N = 20;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const c = mottleRGB(i / N, j / N);
      if (c[1] > hi[1]) hi = c;
      if (c[1] < lo[1]) lo = c;
    }
  }
  assert.ok(hi[0] >= hi[2], 'highlight: red ≥ blue (warm)');
  assert.ok(lo[0] <= lo[2], 'pool: red ≤ blue (cool)');
});

test('vertexTint is deterministic and centred near 1 (no net dimming)', () => {
  assert.equal(vertexTint(12, -7), vertexTint(12, -7));
  let sum = 0, count = 0, min = Infinity, max = -Infinity;
  for (let x = -110; x <= 110; x += 11) {
    for (let z = -110; z <= 110; z += 11) {
      const t = vertexTint(x, z);
      sum += t; count++;
      min = Math.min(min, t); max = Math.max(max, t);
    }
  }
  const mean = sum / count;
  assert.ok(mean > 0.97 && mean < 1.03, `mean tint ${mean.toFixed(3)} ≈ 1`);
  assert.ok(min >= 0.92 && max <= 1.08, `range [${min.toFixed(2)},${max.toFixed(2)}] bounded`);
});

test('tile constants are sane for a single repeating draw call', () => {
  assert.ok(GROUND_TILE_PX >= 128 && GROUND_TILE_PX <= 512, 'tile px reasonable');
  assert.ok(GROUND_TILE_REPEAT >= 4 && GROUND_TILE_REPEAT <= 32, 'repeat reasonable');
  assert.ok(GROUND_BRIGHTEN > 1 && GROUND_BRIGHTEN < 1.3, 'brighten compensates, mildly');
});

// P1.2 — the per-biome two-tone ground. Each landschap must carry two distinct,
// valid ground tones, and the mixing field must stay a calm, in-range, seamless
// blend so the floor reads as real Veluwe ground, never a flat slab.

test('BIOME_GROUND_TONES covers every biome with two distinct valid hexes', () => {
  for (const biome of BIOME_ORDER) {
    const tones = BIOME_GROUND_TONES[biome];
    assert.ok(Array.isArray(tones) && tones.length === 2, `${biome} has two tones`);
    for (const hex of tones) {
      assert.match(hex, /^#[0-9a-f]{6}$/i, `${biome} tone ${hex} is a hex colour`);
    }
    assert.notEqual(tones[0], tones[1], `${biome} tones differ (real breakup, not a slab)`);
  }
});

test('groundPatch is deterministic and bounded in [0,1]', () => {
  assert.equal(groundPatch(12, -7), groundPatch(12, -7), 'same input → same mix');
  let min = Infinity, max = -Infinity;
  for (let x = -110; x <= 110; x += 7) {
    for (let z = -110; z <= 110; z += 7) {
      const t = groundPatch(x, z);
      assert.ok(t >= 0 && t <= 1, `patch ${t} in [0,1]`);
      min = Math.min(min, t); max = Math.max(max, t);
    }
  }
  // both tones actually surface across the world (neither tone is dead)
  assert.ok(min < 0.35 && max > 0.65, `range [${min.toFixed(2)},${max.toFixed(2)}] spans both tones`);
});

test('groundPatch varies over distance (clumps, not a flat constant)', () => {
  // sampling two well-separated points should generally differ — the ground is
  // not one uniform mix everywhere (which would reproduce the old flat slab).
  const a = groundPatch(0, 0);
  const b = groundPatch(40, -30);
  const c = groundPatch(-25, 55);
  assert.ok(Math.abs(a - b) > 0.02 || Math.abs(a - c) > 0.02, 'the mix field actually varies');
});

test('heathCover is deterministic, bounded and patchy (heather mats and sandy openings)', () => {
  let lo = 0, hi = 0;
  for (let i = 0; i < 400; i++) {
    const x = -70 + (i % 20) * 7, z = -70 + Math.floor(i / 20) * 7;
    const c = heathCover(x, z);
    assert.equal(c, heathCover(x, z));
    assert.ok(c >= 0 && c <= 1);
    if (c < 0.3) lo++;
    if (c > 0.7) hi++;
  }
  assert.ok(lo > 40 && hi > 40, `both open sand (${lo}) and dense heather (${hi}) occur`);
});

test('detailTile is in [0,1], quick to bake, and its florets are sparse', () => {
  // CPU time, not wall time: the bake is one synchronous pass, so this is what it costs;
  // a wall clock on a busy machine (parallel builds) measures the wait for a core.
  const t0 = process.cpuUsage();
  const { grit, speck, needle } = detailTile();
  const used = process.cpuUsage(t0);
  const ms = (used.user + used.system) / 1000;
  assert.ok(ms < 400, `bakes in ${ms.toFixed(0)} ms of CPU (it sits on the title's boot path)`);
  for (const ch of [grit, speck, needle]) {
    assert.equal(ch.length, TILE * TILE);
    for (let i = 0; i < ch.length; i += 97) assert.ok(ch[i] >= 0 && ch[i] <= 1);
  }
  const lit = speck.filter((v) => v > 0.5).length / speck.length;
  assert.ok(lit > 0.005 && lit < 0.2, `florets are sparse, not everywhere (${(lit * 100).toFixed(1)}%)`);
  const strokes = needle.filter((v) => v > 0.3).length / needle.length;
  assert.ok(strokes > 0.02 && strokes < 0.6, `needles cover part of the tile (${(strokes * 100).toFixed(1)}%)`);
  assert.deepEqual(detailTile().needle.slice(0, 64), needle.slice(0, 64), 'deterministic');
});

import { groundSpeckle, BIOME_ACCENT_TONES } from './GroundDetail.ts';

test('groundSpeckle: deterministic, bounded, and both accent tails occur (patches a few metres across)', () => {
  let lo = 0, hi = 0, n = 0, jumps = 0;
  for (let x = -70; x < 70; x += 0.9) for (let z = -70; z < 70; z += 0.9) {
    const s = groundSpeckle(x, z);
    assert.ok(s >= 0 && s <= 1);
    n++;
    if (s < 0.38) lo++;
    if (s > 0.6) hi++;
    if (Math.abs(groundSpeckle(x + 0.9, z) - s) > 0.25) jumps++;
  }
  assert.equal(groundSpeckle(3.3, -8.1), groundSpeckle(3.3, -8.1));
  assert.ok(lo / n > 0.12 && hi / n > 0.12, `low ${(lo / n).toFixed(2)} and high ${(hi / n).toFixed(2)} patches both occur`);
  assert.ok(jumps / n < 0.01, 'smooth patches, not per-point noise');
  for (const [a, b] of Object.values(BIOME_ACCENT_TONES)) assert.notEqual(a, b);
});
