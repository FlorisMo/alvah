/**
 * Progress.test.ts — felt progress: every finished mission leaves its own calm,
 * lasting tableau at its marker, laid out on the ground around the marker's animal.
 * Run: `node --experimental-strip-types --test src/render3d/world/Progress.test.ts`
 *
 * The browser truth is `npm run golden` step 7 ("the world reacts within 6 m of the
 * marker") and e2e/missions.spec.ts; this pins the layout rules with a fake world.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { AREA_VELUWE } from '../../content/veluwe.ts';
import {
  Progress, TABLEAUS, REUNION_S, HERE_R, REST_NEAR, REST_FAR, heroOf, frameAt, toWorld, spotFree, finishedFlag, earthDen, inReunionView,
  type ProgressEnv, type ReunionView,
} from './Progress.ts';

/** The follow lens behind the ranger, looking at him (he stands `back` m before the marker
 *  on the line from `from`, the lens 4.6 m further back and 2.4 m up). */
function lens(m: { x: number; z: number }, from: { x: number; z: number }, back = 2): ReunionView {
  const dx = m.x - from.x, dz = m.z - from.z, l = Math.hypot(dx, dz);
  const ux = dx / l, uz = dz / l;
  const ranger = { x: m.x - ux * back, z: m.z - uz * back };
  const camera = new THREE.PerspectiveCamera(55, 1280 / 800, 0.1, 240);
  camera.position.set(ranger.x - ux * 4.6, groundY(ranger.x, ranger.z) + 2.4, ranger.z - uz * 4.6);
  camera.lookAt(ranger.x, groundY(ranger.x, ranger.z) + 0.8, ranger.z);
  camera.updateMatrixWorld();
  return { camera, ranger };
}

/** A rolling test ground (so "on the ground" means something). */
const groundY = (x: number, z: number): number => 0.4 * Math.sin(x * 0.3) + 0.3 * Math.cos(z * 0.25);

/** A stand-in model: a box of height h with its feet at y=0 (what spawnModel returns). */
function box(h: number) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(h * 0.6, h, h * 0.9), new THREE.MeshStandardMaterial());
  mesh.position.y = h / 2;
  const inner = new THREE.Group();
  inner.add(mesh);
  root.add(inner);
  const clips: string[] = [];
  return { root, update: () => {}, dispose: () => root.removeFromParent(), rigged: false, clip: (n: string) => { clips.push(n); }, clips };
}

/** Run 6: the missions whose family LIVES at a home of its own (world/Residents.ts,
 *  render3d/adventure): their tableau is only the "klaar" flag at the marker. */
const LIVES_AT_HOME = new Set(['frisling', 'ree-niet-aanraken']);
/** A mission whose family still walks in to its marker (the classic tableau: a hind and
 *  her calf on the crossing). */
const FAMILY = 'ecoduct';

function world(extra: Partial<ProgressEnv> = {}) {
  const scene = new THREE.Scene();
  // (the missions with a tableau first: the first marker stands at (30, 0))
  const ordered = [...AREA_VELUWE.missies.filter((m) => !LIVES_AT_HOME.has(m.id)), ...AREA_VELUWE.missies.filter((m) => LIVES_AT_HOME.has(m.id))];
  const markers = ordered.map((m, i) => {
    const a = (i / AREA_VELUWE.missies.length) * Math.PI * 2;
    const group = new THREE.Group();
    const x = Math.cos(a) * 30, z = Math.sin(a) * 30;
    group.position.set(x, groundY(x, z), z);
    scene.add(group);
    return { missionId: m.id, x, z, group };
  });
  const spawned: string[] = [];
  const env: ProgressEnv = {
    scene, groundY,
    obstacles: [],
    blocked: () => false,
    markers: () => markers,
    actors: () => [],
    spawnModel: async (id, opts) => { spawned.push(id); return box(opts?.height ?? 0.5); },
    spawnPlant: async (id, h) => { spawned.push(id); return box(h); },
    heightFor: () => 0.5,
    ...extra,
  };
  return { env, scene, markers, spawned, progress: new Progress(env) };
}

/** Advance the module's clock like the World does each frame. */
function tick(p: Progress, seconds: number, reduced = false, cam?: THREE.Camera, activity = false): void {
  if (!cam) { cam = new THREE.PerspectiveCamera(); cam.position.set(0, 2, 0); }
  for (let t = 0; t < seconds; t += 1 / 30) p.update(t, 1 / 30, reduced, cam, activity);
}

test('every mission ends in its own tableau, with the animal it is about at its marker', () => {
  for (const m of AREA_VELUWE.missies) {
    const t = TABLEAUS[m.id];
    assert.ok(t, `mission ${m.id} has a finished tableau`);
    if (LIVES_AT_HOME.has(m.id)) continue;
    assert.ok(t.pieces.length >= 1, `${m.id}: something gathers at the marker`);
    assert.ok(heroOf(m.id, m.dier).length > 0, `${m.id}: a hero animal`);
  }
  // run 6: the frisling's rotte lives at its wallow; its marker ring stays empty (the
  // piglet is hidden in the bracken, you hear him) and gets only the "klaar" flag
  assert.equal(heroOf('frisling', 'wildzwijn'), '');
  assert.deepEqual(TABLEAUS.frisling.pieces, []);
  // run 6: the reekalf and its mother live at their copse; the ring stays empty (the calf
  // lies hidden in the tall grass) and gets only the flag
  assert.equal(heroOf('ree-niet-aanraken', 'ree'), '');
  assert.deepEqual(TABLEAUS['ree-niet-aanraken'].pieces, []);
  assert.equal(heroOf('ecoduct', 'edelhert'), 'edelhert');
});

test('the marker frame: + along = beyond the marker, + across = right of the way in', () => {
  const f = frameAt(0, -10, 0, 0); // walking from spawn toward -z
  assert.deepEqual(toWorld(f, 2, 0), { x: 0, z: -12 });
  const right = toWorld(f, 0, 1);
  assert.ok(Math.abs(right.x - 1) < 1e-9 && Math.abs(right.z + 10) < 1e-9, 'looking down -z, right is +x');
});

test('a finished tableau stands on the ground within 6 m of its marker, around (never in front of) its animal', async () => {
  const w = world();
  for (const m of w.markers) {
    await w.progress.complete(m.missionId, false, false);
    const f = frameAt(m.x, m.z, 0, 0);
    const g = w.scene.getObjectByName(`progress-${m.missionId}`)!;
    assert.ok(g, `${m.missionId}: tableau in the scene`);
    let flags = 0;
    g.traverse((o) => { if (o.name === 'klaar-flag') flags += 1; });
    assert.equal(flags, 1, `${m.missionId}: one "klaar" flag`);
    for (const c of g.children) {
      const d = Math.hypot(c.position.x - m.x, c.position.z - m.z);
      assert.ok(d < 6 && d > 0.5, `${m.missionId}: ${c.name || 'piece'} ${d.toFixed(2)} m from the marker`);
      const lift = TABLEAUS[m.missionId].pieces.find((p) => p.lift)?.lift ?? 0;
      const stake = TABLEAUS[m.missionId].pieces.find((p) => p.stake)?.stake ?? 0;
      const gap = c.position.y - groundY(c.position.x, c.position.z);
      assert.ok([0, lift, stake].some((v) => Math.abs(gap - v) < 1e-6), `${m.missionId}: seated on the ground (gap ${gap})`);
      if (c.name !== 'klaar-flag') {
        assert.ok(!LIVES_AT_HOME.has(m.missionId), `${m.missionId}: only the flag (its family lives at its home)`);
        const lx = c.position.x - f.ox, lz = c.position.z - f.oz;
        const a = lx * f.dx + lz * f.dz, s = -lx * f.dz + lz * f.dx;
        assert.ok(!(a < 0.6 && Math.abs(s) < 1.0), `${m.missionId}: not between the lens and the marker's animal`);
      }
    }
    // the tableau steps away with the marker when its mission is replayed there
    assert.ok((m.group.userData.companions as THREE.Object3D[]).includes(g));
  }
});

test('completing twice never builds a second tableau (a replay, a reload)', async () => {
  const w = world();
  await w.progress.complete('frisling', false, false);
  const n = w.spawned.length;
  await w.progress.complete('frisling', false, false);
  await w.progress.complete('frisling', true, true);
  assert.equal(w.spawned.length, n);
  assert.equal(w.scene.children.filter((o) => o.name === 'progress-frisling').length, 1);
});

test('the pieces keep out of water, trunks, other markers and the story people', async () => {
  const m0 = { x: 30, z: 0 };
  const water = (x: number, z: number): boolean => x > 31.5; // everything beyond the marker is the ven
  const trunk = { x: 30.8, z: -1.9, r: 0.6, tree: true };
  const w = world({ blocked: water, obstacles: [trunk], actors: () => [{ x: 29, z: 2 }] });
  const id0 = w.markers[0].missionId; // marker 0 stands at (30, 0)
  await w.progress.complete(id0, false, false);
  const g = w.scene.getObjectByName(`progress-${id0}`)!;
  assert.ok(g.children.length >= 2, 'the flag and at least one piece found room');
  for (const c of g.children) {
    assert.ok(!water(c.position.x, c.position.z), `${c.name} is not in the water`);
    assert.ok(Math.hypot(c.position.x - trunk.x, c.position.z - trunk.z) > trunk.r, 'not in the trunk');
    assert.ok(Math.hypot(c.position.x - 29, c.position.z - 2) > 0.8, 'not in the warden');
  }
  void m0;
});

test('a finished family keeps a later game patch off it, except for its own replay', async () => {
  const w = world();
  await w.progress.complete(FAMILY, false, false);
  const g = w.scene.getObjectByName(`progress-${FAMILY}`)!;
  const p = g.children[1].position;
  assert.equal(w.progress.blocks(p.x, p.z, 0.2, null), true);
  assert.equal(w.progress.blocks(p.x, p.z, 0.2, FAMILY), false);
  assert.equal(w.progress.blocks(p.x + 40, p.z, 0.2, null), false);
});

test('the reunion: the family walks calmly in and the flag rises; the promise resolves after it', async () => {
  const w = world();
  const m = w.markers.find((k) => k.missionId === FAMILY)!;
  let done = false;
  const run = w.progress.complete(FAMILY, true, false, lens(m, { x: 0, z: 0 })).then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 0)); // the build (spawns) resolves
  await new Promise((r) => setTimeout(r, 0));
  const g = w.scene.getObjectByName(`progress-${FAMILY}`)!;
  const flag = g.getObjectByName('klaar-flag')!;
  const target = w.progress.state().find((s) => s.missionId === FAMILY)!.pieces;
  // at the start: the flag is flat, the arriving animals stand further out than their spot
  assert.ok(flag.scale.y < 0.05);
  const starts = g.children.filter((c) => c.name !== 'klaar-flag').map((c) => Math.hypot(c.position.x - m.x, c.position.z - m.z));
  tick(w.progress, REUNION_S / 2);
  assert.equal(done, false, 'still playing halfway');
  const mids = g.children.filter((c) => c.name !== 'klaar-flag').map((c) => Math.hypot(c.position.x - m.x, c.position.z - m.z));
  tick(w.progress, REUNION_S / 2 + 0.2);
  await run;
  assert.equal(done, true);
  assert.ok(Math.abs(flag.scale.y - 1) < 1e-6, 'the flag stands');
  const ends = g.children.filter((c) => c.name !== 'klaar-flag');
  ends.forEach((c, i) => {
    const t = target[i];
    assert.ok(Math.hypot(c.position.x - t.x, c.position.z - t.z) < 1e-6, `${t.id} reached its spot`);
    const d = Math.hypot(c.position.x - m.x, c.position.z - m.z);
    assert.ok(starts[i] > d + 0.5, `${t.id} walked in (${starts[i].toFixed(2)} → ${d.toFixed(2)} m)`);
    assert.ok(mids[i] > d + 0.2 && mids[i] < starts[i] - 0.2, `${t.id} was on its way halfway (a calm walk, not a jump)`);
  });
});

test('under reduced motion the reunion is a cut: everything simply stands there at once', async () => {
  const w = world();
  const mh = w.markers.find((k) => k.missionId === 'herstel')!;
  await w.progress.complete('herstel', true, true, lens(mh, { x: 0, z: 0 }));
  const g = w.scene.getObjectByName('progress-herstel')!;
  assert.equal(g.getObjectByName('klaar-flag')!.scale.y, 1);
  const target = w.progress.state().find((s) => s.missionId === 'herstel')!.pieces;
  g.children.filter((c) => c.name !== 'klaar-flag').forEach((c, i) => {
    assert.ok(c.visible, `${target[i].id} visible`);
    assert.ok(Math.hypot(c.position.x - target[i].x, c.position.z - target[i].z) < 1e-9);
  });
});

test('spotFree keeps the approach corridor open and respects the other markers', () => {
  const f = frameAt(0, -20, 0, 0);
  const env = { obstacles: [], blocked: () => false, actors: () => [], markers: () => [{ missionId: 'b', x: 0, z: -26, group: new THREE.Group() }] };
  const front = toWorld(f, -1.5, 0.2);
  assert.equal(spotFree(env, 'a', f, front.x, front.z, 0.2), false, 'in front of the marker animal');
  const side = toWorld(f, 1.0, 2.0);
  assert.equal(spotFree(env, 'a', f, side.x, side.z, 0.2), true);
  const nearB = toWorld(f, 5.5, 0.5);
  assert.equal(spotFree(env, 'a', f, nearB.x, nearB.z, 0.2), false, 'on another marker');
});

test('the flag and the den are one draw call each', () => {
  const flag = finishedFlag();
  assert.ok(flag.isMesh && !Array.isArray(flag.material));
  const den = earthDen(0.45);
  let meshes = 0;
  (den.root as THREE.Object3D).traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes += 1; });
  assert.equal(meshes, 1);
  den.dispose();
});

test('a reunion gathers IN the picture: seen from behind the ranger, and when he walked past the marker', async () => {
  for (const back of [2, -2.5]) { // before the marker · past it (the marker at the lens's feet)
    const w = world();
    for (const m of w.markers) {
      const view = lens(m, { x: m.x * 0.3 + 5, z: m.z * 0.3 - 4 }, back);
      await w.progress.complete(m.missionId, true, true, view);
      const g = w.scene.getObjectByName(`progress-${m.missionId}`)!;
      for (const c of g.children) {
        if (c.name === 'klaar-flag') continue; // the flag stands at the marker's own ring
        const ok = inReunionView(view, c.position.x, c.position.y + 0.2, c.position.z, 0.1);
        assert.ok(ok, `${m.missionId} (${back > 0 ? 'before' : 'past'} the marker): a piece stands out of the picture`);
        assert.ok(Math.hypot(c.position.x - m.x, c.position.z - m.z) < 6.5, `${m.missionId}: still at the marker`);
      }
    }
  }
});

test('finished at the missiebord: the family stands at its OWN marker and comes home when the ranger comes to look', async () => {
  // the reload layout, for comparison
  const ref = world();
  await ref.progress.complete(FAMILY, false, false);
  const home = ref.progress.state().find((s) => s.missionId === FAMILY)!.pieces;

  const w = world();
  const m = w.markers.find((k) => k.missionId === FAMILY)!;
  // the board: the ranger stands far from the marker, the lens looks away from it
  const board = { x: m.x * 0.1, z: m.z * 0.1 };
  assert.ok(Math.hypot(board.x - m.x, board.z - m.z) > HERE_R);
  const view = lens({ x: board.x - m.x * 0.2, z: board.z - m.z * 0.2 }, board, 0);
  const t0 = Date.now();
  await w.progress.complete(FAMILY, true, false, view);
  assert.ok(Date.now() - t0 < 500, 'nothing to wait for at the board: the reward follows the caption');
  const g = w.scene.getObjectByName(`progress-${FAMILY}`)!;
  const flag = g.getObjectByName('klaar-flag')!;
  const pieces = () => g.children.filter((c) => c.name !== 'klaar-flag');
  // laid out at its marker, exactly as a reload lays it out
  const at = w.progress.state().find((s) => s.missionId === FAMILY)!.pieces;
  assert.deepEqual(at.map((p) => [p.id, +p.x.toFixed(6), +p.z.toFixed(6)]), home.map((p) => [p.id, +p.x.toFixed(6), +p.z.toFixed(6)]));
  for (const p of at) assert.ok(Math.hypot(p.x - m.x, p.z - m.z) < 6, `${p.id} stands at its marker`);
  // the "klaar" flag rises at once (run 6: an adventure is finished where its family lives);
  // the family waits out of sight while the lens is elsewhere (or a game plays)
  tick(w.progress, 1.2, false, view.camera);
  assert.ok(flag.visible && Math.abs(flag.scale.y - 1) < 1e-6, 'the flag stands');
  assert.ok(pieces().every((c) => !c.visible), 'waiting out of sight');
  const atMarker = lens(m, { x: 0, z: 0 });
  tick(w.progress, 1, false, atMarker.camera, true);
  assert.ok(pieces().every((c) => !c.visible), 'never during a game');
  // the ranger walks up to the marker: the family walks calmly in
  tick(w.progress, 0.5, false, atMarker.camera);
  const mid = pieces().map((c) => Math.hypot(c.position.x - m.x, c.position.z - m.z));
  tick(w.progress, REUNION_S, false, atMarker.camera);
  pieces().forEach((c, i) => {
    assert.ok(c.visible);
    assert.ok(Math.hypot(c.position.x - at[i].x, c.position.z - at[i].z) < 1e-6, `${at[i].id} is home`);
    const d = Math.hypot(c.position.x - m.x, c.position.z - m.z);
    if (TABLEAUS[FAMILY].pieces[i].arrive) assert.ok(mid[i] > d + 0.2, `${at[i].id} walked in`);
  });
});

test('finished at the missiebord under reduced motion: the family simply stands at its marker', async () => {
  const w = world();
  const m = w.markers.find((k) => k.missionId === 'vos')!;
  const board = { x: m.x * 0.1, z: m.z * 0.1 };
  await w.progress.complete('vos', true, true, lens({ x: board.x - m.x * 0.2, z: board.z - m.z * 0.2 }, board, 0));
  const g = w.scene.getObjectByName('progress-vos')!;
  tick(w.progress, 0.1, true);
  assert.ok(g.children.every((c) => c.visible), 'everything stands there');
  assert.equal(g.getObjectByName('klaar-flag')!.scale.y, 1);
  for (const c of g.children) assert.ok(Math.hypot(c.position.x - m.x, c.position.z - m.z) < 6);
});

test('a far family calmly fades out and rests (not drawn); the flag stays; coming back it fades in, solid', async () => {
  const w = world();
  const m = w.markers.find((k) => k.missionId === 'ecoduct')!;
  await w.progress.complete('ecoduct', false, false);
  const g = w.scene.getObjectByName('progress-ecoduct')!;
  const flag = g.getObjectByName('klaar-flag')!;
  const pieces = g.children.filter((c) => c !== flag);
  const opacity = (o: THREE.Object3D): number[] => {
    const out: number[] = [];
    o.traverse((x) => { const mat = (x as THREE.Mesh).material as THREE.Material | undefined; if (mat) out.push(mat.opacity); });
    return out;
  };
  const camAt = (d: number): THREE.Camera => {
    const c = new THREE.PerspectiveCamera();
    const u = Math.hypot(m.x, m.z);
    c.position.set(m.x - (m.x / u) * d, 2, m.z - (m.z / u) * d);
    return c;
  };
  const solid = () => pieces.every((c) => c.visible && opacity(c).every((o) => o === 1));
  tick(w.progress, 0.1, false, camAt(4));
  assert.ok(solid(), 'up close: solid');
  // standing still anywhere short of the edge, it stays solid (never a see-through family)
  tick(w.progress, 3, false, camAt((REST_NEAR + REST_FAR) / 2));
  assert.ok(solid(), 'between the edges: still solid');
  // past the far edge: a short calm fade, then it rests
  tick(w.progress, 0.4, false, camAt(REST_FAR + 5));
  assert.ok(pieces.every((c) => c.visible && opacity(c).every((o) => o > 0.2 && o < 0.8)), 'fading out, not popping');
  tick(w.progress, 1, false, camAt(REST_FAR + 5));
  assert.ok(pieces.every((c) => !c.visible), 'far off: resting, not drawn');
  assert.ok(flag.visible, 'the klaar flag still stands');
  tick(w.progress, 3, false, camAt((REST_NEAR + REST_FAR) / 2));
  assert.ok(pieces.every((c) => !c.visible), 'between the edges it keeps resting (no flicker on the edge)');
  tick(w.progress, 1.2, false, camAt(REST_NEAR - 2));
  assert.ok(solid(), 'within the near edge: faded back in, solid again');
  // reduced motion: a cut
  tick(w.progress, 1 / 30, true, camAt(REST_FAR + 5));
  assert.ok(pieces.every((c) => !c.visible), 'reduced motion: it simply rests');
});
