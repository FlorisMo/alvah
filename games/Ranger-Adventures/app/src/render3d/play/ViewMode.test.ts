/**
 * ViewMode.test.ts — seeded unit test for the pure 3D/2D resolver
 * (3D-IMMERSION-PLAN §2/§4, BUILD-PLAN §9e). Run:
 *   node --experimental-strip-types --test src/render3d/play/ViewMode.test.ts
 *
 * Pins the frozen contract: the 2D view is the always-available floor; 3D is
 * chosen ONLY when every gate passes (scene live · WebGL-capable · a parity-green
 * variant ships · not force-2D · motion-ok-or-rmSafe). Any failed gate → 2D, so
 * the game never blocks. Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveViewMode, variantFor, type ViewModeReq } from './ViewMode.ts';
import type { Play3dEngine } from './types.ts';

const stub: Play3dEngine['play'] = async () => ({ trials: 1, correct: 1, success: true });

const REGISTRY: Play3dEngine[] = [
  { engine: 'dagnacht', play: stub, rmSafe: true },   // reduced-motion path defined
  { engine: 'zoeken', play: stub, rmSafe: false },    // 3D ships, but moves under play
];

/** All gates open for an rmSafe engine → the baseline "go 3D" request. */
function go(over: Partial<ViewModeReq> = {}): ViewModeReq {
  return {
    engine: 'dagnacht',
    sceneLive: true,
    webglCapable: true,
    reducedMotion: false,
    force2d: false,
    registry: REGISTRY,
    ...over,
  };
}

test('all gates open → 3d', () => {
  assert.equal(resolveViewMode(go()), '3d');
});

test('force2d (demo/Tweaks) → 2d floor', () => {
  assert.equal(resolveViewMode(go({ force2d: true })), '2d');
});

test('scene not live → 2d', () => {
  assert.equal(resolveViewMode(go({ sceneLive: false })), '2d');
});

test('no WebGL → 2d', () => {
  assert.equal(resolveViewMode(go({ webglCapable: false })), '2d');
});

test('engine has no shipped 3D variant → 2d', () => {
  assert.equal(resolveViewMode(go({ engine: 'corsi' })), '2d');
});

test('reduced-motion + rmSafe variant → still 3d (cuts-not-moves path)', () => {
  assert.equal(resolveViewMode(go({ reducedMotion: true })), '3d');
});

test('reduced-motion + NON-rmSafe variant → 2d floor', () => {
  assert.equal(resolveViewMode(go({ engine: 'zoeken', reducedMotion: true })), '2d');
});

test('non-rmSafe variant with motion ok → 3d', () => {
  assert.equal(resolveViewMode(go({ engine: 'zoeken' })), '3d');
});

test('variantFor finds a registered engine and misses an unregistered one', () => {
  assert.equal(variantFor(REGISTRY, 'dagnacht')?.engine, 'dagnacht');
  assert.equal(variantFor(REGISTRY, 'simon'), undefined);
});

test('deterministic: same req → same mode', () => {
  const req = go();
  assert.equal(resolveViewMode(req), resolveViewMode(req));
});
