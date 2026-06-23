/**
 * Biomes.test.ts — seeded unit test for the pure biome field (BUILD-PLAN §8d.2, §9e).
 * Run: `node --experimental-strip-types src/render3d/Biomes.test.ts`
 *
 * Pins the invariants the world build-out depends on: the field is deterministic,
 * all four landschappen are actually present (none warped away), the relief is
 * cliff-free across sector seams (a step would read as a wall — never-scary), the
 * ven basin is the lowest ground (it holds the water), and the lodge clearing is heide.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BIOME_ORDER, CLEARING_R, VEN_CENTER, WATER_LEVEL,
  anchorInBiome, biomeAt, heightAt, type Biome,
} from './Biomes.ts';

/** A dense deterministic grid over the playable world (~±110 m). */
const GRID: { x: number; z: number }[] = [];
for (let x = -110; x <= 110; x += 5) for (let z = -110; z <= 110; z += 5) GRID.push({ x, z });

test('biomeAt + heightAt are deterministic', () => {
  for (const { x, z } of [{ x: 12, z: -34 }, { x: -80, z: 51 }, { x: 46, z: -19 }]) {
    assert.equal(biomeAt(x, z), biomeAt(x, z));
    assert.equal(heightAt(x, z), heightAt(x, z));
  }
});

test('all four landschappen are present across the world (none warped away)', () => {
  const seen = new Set<Biome>();
  for (const { x, z } of GRID) seen.add(biomeAt(x, z));
  for (const b of BIOME_ORDER) assert.ok(seen.has(b), `${b} appears somewhere`);
});

test('every classified point is one of the four known biomes', () => {
  for (const { x, z } of GRID) assert.ok(BIOME_ORDER.includes(biomeAt(x, z)), `${x},${z} valid`);
});

test('relief is cliff-free — no step looks like a wall at a sector seam', () => {
  // adjacent samples 1 m apart must differ by well under a comfortable slope
  for (const { x, z } of GRID) {
    const h = heightAt(x, z);
    assert.ok(Math.abs(heightAt(x + 1, z) - h) < 0.5, `dx slope @ ${x},${z}`);
    assert.ok(Math.abs(heightAt(x, z + 1) - h) < 0.5, `dz slope @ ${x},${z}`);
  }
});

test('the ven basin is the lowest ground and sits below the water surface', () => {
  const venY = heightAt(VEN_CENTER.x, VEN_CENTER.z);
  assert.ok(venY < WATER_LEVEL, 'basin floor is under the still-water plane');
  // it is lower than the relief anywhere outside its own neighbourhood
  for (const { x, z } of GRID) {
    const far = Math.hypot(x - VEN_CENTER.x, z - VEN_CENTER.z) > 30;
    if (far) assert.ok(heightAt(x, z) > venY, `basin lower than ${x},${z}`);
  }
});

test('the lodge clearing at world centre is heide', () => {
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const r = CLEARING_R - 0.5;
    assert.equal(biomeAt(Math.cos(a) * r, Math.sin(a) * r), 'heide', 'inside the clearing');
  }
});

test('anchorInBiome lands a marker inside the requested landschap', () => {
  for (const b of BIOME_ORDER) {
    const p = anchorInBiome(b);
    assert.equal(biomeAt(p.x, p.z), b, `${b} anchor is in ${b}`);
    assert.ok(Math.hypot(p.x, p.z) > CLEARING_R, `${b} anchor is outside the clearing`);
  }
});
