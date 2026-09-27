/**
 * Terrain.test.ts — the drawn ground IS the ground every placement reads.
 * Run: `node --experimental-strip-types --test src/render3d/world/Terrain.test.ts`
 *
 * Pins the fix for the z-mirror (2026-09-26): the ground mesh, taken through its own
 * world matrix, must carry `heightAt(x,z)` and the colour of `biomeAt(x,z)` at world
 * (x,z), and `Terrain.y` must equal the surface a ray hits between the vertices too.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BIOME_PALETTE, VEN_CENTER, WATER_LEVEL, biomeAt, heightAt } from '../Biomes.ts';
import { Terrain, groundColor, TERRAIN_SIZE } from './Terrain.ts';

/** Deterministic spread of sample indices over the vertex grid (no Math.random). */
function sampleIndices(count: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(Math.floor(((k * 2654435761) >>> 0) % count));
  return out;
}

function worldVertex(mesh: THREE.Mesh, i: number): THREE.Vector3 {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.matrixWorld);
}

test('drawn vertex height at world (x,z) equals heightAt(x,z) — no mirror', () => {
  const t = new Terrain({ detail: true });
  t.mesh.updateMatrixWorld(true);
  const count = (t.mesh.geometry.attributes.position as THREE.BufferAttribute).count;
  const idx = sampleIndices(count, 400);
  let asymmetric = 0; // samples where heightAt(x,z) and heightAt(x,-z) genuinely differ
  for (const i of idx) {
    const v = worldVertex(t.mesh, i);
    assert.ok(Math.abs(v.y - heightAt(v.x, v.z)) < 1e-3, `vertex ${i} @ (${v.x}, ${v.z}): drawn ${v.y} vs heightAt ${heightAt(v.x, v.z)}`);
    if (Math.abs(heightAt(v.x, v.z) - heightAt(v.x, -v.z)) > 0.1) asymmetric++;
  }
  // the check has teeth: most samples sit where a z-mirror would read a different height
  assert.ok(asymmetric >= 50, `≥50 samples discriminate the mirror (got ${asymmetric})`);
});

test('drawn vertex colour at world (x,z) is the colour of biomeAt(x,z)', () => {
  const flat = new Terrain({ detail: false });
  flat.mesh.updateMatrixWorld(true);
  const col = flat.mesh.geometry.attributes.color as THREE.BufferAttribute;
  const count = col.count;
  const want = new THREE.Color();
  let mirrorWouldFail = 0;
  for (const i of sampleIndices(count, 400)) {
    const v = worldVertex(flat.mesh, i);
    want.set(BIOME_PALETTE[biomeAt(v.x, v.z)].ground);
    const got = [col.getX(i), col.getY(i), col.getZ(i)];
    assert.ok(
      Math.abs(got[0] - want.r) < 1e-4 && Math.abs(got[1] - want.g) < 1e-4 && Math.abs(got[2] - want.b) < 1e-4,
      `vertex ${i} @ (${v.x}, ${v.z}) is painted ${biomeAt(v.x, v.z)}`,
    );
    if (biomeAt(v.x, v.z) !== biomeAt(v.x, -v.z)) mirrorWouldFail++;
  }
  assert.ok(mirrorWouldFail >= 50, `≥50 samples discriminate a mirrored paint (got ${mirrorWouldFail})`);

  // with ground detail on, each vertex carries groundColor at its own world position
  const rich = new Terrain({ detail: true });
  rich.mesh.updateMatrixWorld(true);
  const rc = rich.mesh.geometry.attributes.color as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (const i of sampleIndices(count, 100)) {
    const v = worldVertex(rich.mesh, i);
    groundColor(v.x, v.z, heightAt(v.x, v.z), true, c);
    assert.ok(Math.abs(rc.getX(i) - c.r) < 1e-4 && Math.abs(rc.getY(i) - c.g) < 1e-4 && Math.abs(rc.getZ(i) - c.b) < 1e-4,
      `detailed vertex ${i} @ (${v.x}, ${v.z}) painted from its own world spot`);
  }
});

test('Terrain.y is the drawn surface between vertices (matches a downward ray)', () => {
  const t = new Terrain({ detail: false });
  t.mesh.updateMatrixWorld(true);
  const lim = 74; // the playable bound
  for (let k = 0; k < 120; k++) {
    const x = ((k * 37.13) % (2 * lim)) - lim;
    const z = ((k * 53.71 + 11) % (2 * lim)) - lim;
    const ray = t.raycastY(x, z);
    assert.ok(Number.isFinite(ray), `ray hits the ground at (${x}, ${z})`);
    assert.ok(Math.abs(t.y(x, z) - ray) < 1e-3, `y(${x}, ${z}) = ${t.y(x, z)} vs ray ${ray}`);
    assert.ok(Math.abs(t.y(x, z) - heightAt(x, z)) < 0.05, `y stays within 5 cm of the smooth field at (${x}, ${z})`);
  }
  // off the plane it falls back to the smooth field
  const far = TERRAIN_SIZE;
  assert.equal(t.y(far, 0), heightAt(far, 0));
});

test('the ven basin is drawn where the water sits (VEN_CENTER is a world point)', () => {
  const t = new Terrain({ detail: false });
  assert.ok(t.y(VEN_CENTER.x, VEN_CENTER.z) < WATER_LEVEL - 1, 'drawn basin floor is well under the water at VEN_CENTER');
  assert.equal(t.biome(VEN_CENTER.x, VEN_CENTER.z), 'ven');
  assert.ok(t.y(VEN_CENTER.x, -VEN_CENTER.z) > WATER_LEVEL, 'the mirrored spot is dry ground');
});

test('intersectRay finds the drawn ground where a mesh raycast does, and on grid lines too', () => {
  const t = new Terrain({ detail: false });
  t.mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  const eye = new THREE.Vector3(0, 2.4, 4.6); // the spawn follow camera
  let compared = 0;
  for (let k = 0; k < 60; k++) {
    const dir = new THREE.Vector3(Math.sin(k * 1.7) * 0.6, -0.15 - (k % 7) * 0.08, -1).normalize();
    rc.set(eye, dir);
    const hit = rc.intersectObject(t.mesh, false)[0];
    const p = t.intersectRay(rc.ray);
    if (!hit) continue;
    assert.ok(p, `ray ${k} meets the ground`);
    assert.ok(p!.distanceTo(hit.point) < 1e-3, `ray ${k}: march ${p!.toArray()} vs mesh ${hit.point.toArray()}`);
    compared++;
  }
  assert.ok(compared >= 40, `compared ${compared} rays`);
  // a ray exactly along the x = 0 grid line (the centre-column click at spawn)
  const along = new THREE.Ray(eye.clone(), new THREE.Vector3(0, -0.559, -0.829).normalize());
  const p = t.intersectRay(along);
  assert.ok(p, 'a ray along a grid line still meets the ground');
  assert.ok(Math.abs(p!.y - t.y(p!.x, p!.z)) < 1e-4, 'and the point lies on the drawn surface');
  // a ray pointing up never does, nor one that would only land far past the ground plane
  assert.equal(t.intersectRay(new THREE.Ray(eye.clone(), new THREE.Vector3(0, 1, 0))), null);
  assert.equal(t.intersectRay(new THREE.Ray(eye.clone(), new THREE.Vector3(0, -0.001, -1).normalize())), null);
});

import { buildFarForest, FAR_FOREST_IN, FAR_FOREST_OUT } from './Terrain.ts';

test('the forest beyond the rim hides the end of the ground plate from every view (parent B11, breaker B9)', () => {
  const bound = 75, lensFar = 240;              // World: limits.bound, camera far plane
  const t = new Terrain({ detail: false });
  const geo = buildFarForest(bound, (x, z) => t.y(x, z));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  let rMin = Infinity, rMax = 0, faceBelow = 0, faceN = 0, canopyN = 0, canopyLow = 0, canopyDown = 0;
  const around = new Set<number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.hypot(x, z);
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    around.add(Math.round(Math.atan2(z, x) * 100));
    if (r < bound + FAR_FOREST_IN + 0.1) { faceN++; if (y < t.y(x, z)) faceBelow++; }
    else if (r > bound + FAR_FOREST_IN + 1.5) {
      canopyN++;
      if (y - t.y(x, z) < 5) canopyLow++;
      if (nrm.getY(i) <= 0) canopyDown++;
    }
  }
  // it starts right behind the rim tree-line's last row and ends past the lens's reach
  assert.ok(Math.abs(rMin - (bound + FAR_FOREST_IN)) < 0.01 && bound + FAR_FOREST_IN - 10.2 - 1.4 > 1, `inner edge ${rMin.toFixed(1)} m, behind the rim rows`);
  assert.ok(rMin < 120, 'it starts well inside the 240 m ground plate, so it covers the plate edge');
  assert.ok(rMax >= FAR_FOREST_OUT - 0.01 && FAR_FOREST_OUT >= bound + lensFar, `it runs out to ${rMax.toFixed(0)} m, past anything the lens can see`);
  assert.ok(around.size >= 360, 'it goes all the way round');
  // its inner face starts under the ground (no gap to see through) and its canopy stands
  // over the ground as tall as the rim trees, facing the sky
  assert.ok(faceN >= 360 && faceBelow === faceN, 'the bottom row of the inner face is sunk into the ground');
  assert.equal(canopyLow, 0, `every canopy vertex stands ≥ 5 m over the ground (${canopyN} checked)`);
  assert.equal(canopyDown, 0, 'the canopy faces up');
  assert.ok(geo.index!.count / 3 < 60_000, `a light backdrop: ${geo.index!.count / 3} triangles`);
});
