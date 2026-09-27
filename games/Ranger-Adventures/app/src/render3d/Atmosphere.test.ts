import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKY_STOPS,
  cloudOffset,
  windSway,
  flyoverAt,
  FLYOVER_PERIOD,
  FLYOVER_VISIBLE,
} from './Atmosphere.ts';

// W4.6 — the pure "Lucht + adem" math. Everything here is SECONDARY motion, so
// the contract the world leans on is: advance the atmosphere clock and things
// move; freeze the clock (reduced-motion) and everything stills. Plus sane
// ranges + the ~12 s flyover period. No browser needed.

test('SKY_STOPS is a richer, monotonic top→bottom gradient', () => {
  assert.ok(SKY_STOPS.length >= 5, `${SKY_STOPS.length} stops (richer than 3)`);
  assert.equal(SKY_STOPS[0][0], 0, 'starts at the zenith');
  assert.equal(SKY_STOPS[SKY_STOPS.length - 1][0], 1, 'ends at the horizon');
  for (let i = 1; i < SKY_STOPS.length; i++) {
    assert.ok(SKY_STOPS[i][0] > SKY_STOPS[i - 1][0], 'positions strictly increase');
    assert.match(SKY_STOPS[i][1], /^#[0-9a-f]{6}$/i, 'valid css hex colour');
  }
});

test('cloudOffset drifts over time and wraps into [0,1)', () => {
  const a = cloudOffset(0);
  const b = cloudOffset(10);
  assert.notDeepEqual(a, b, 'a moving clock drifts the clouds');
  for (const t of [0, 3.3, 250, 1e4, 99999]) {
    const o = cloudOffset(t);
    assert.ok(o.x >= 0 && o.x < 1, `x ${o.x} in [0,1)`);
    assert.ok(o.y >= 0 && o.y < 1, `y ${o.y} in [0,1)`);
  }
});

test('cloudOffset freezes for a frozen clock (reduced-motion)', () => {
  assert.deepEqual(cloudOffset(42), cloudOffset(42), 'same t → same offset');
});

test('windSway is bounded, gentle, and desyncs by phase', () => {
  let max = 0;
  for (let t = 0; t < 40; t += 0.13) {
    for (const phase of [0, 1.1, 2.7, 4.9]) {
      max = Math.max(max, Math.abs(windSway(t, phase)));
    }
  }
  assert.ok(max <= 0.13, `peak sway ${max.toFixed(3)} rad stays gentle`);
  assert.ok(max > 0.05, 'but the wind is actually felt');
  // two different phases at the same instant generally differ (a field waves,
  // not in lockstep)
  assert.notEqual(windSway(3, 0), windSway(3, 2.0));
});

test('windSway freezes for a frozen clock (reduced-motion)', () => {
  assert.equal(windSway(7.5, 1.3), windSway(7.5, 1.3), 'same t,phase → same angle');
});

test('flyoverAt crosses west→east on the ~12 s period, then pauses', () => {
  assert.equal(FLYOVER_PERIOD, 12);
  const start = flyoverAt(0.01);
  const mid = flyoverAt(FLYOVER_PERIOD * FLYOVER_VISIBLE * 0.5);
  assert.ok(start.visible && mid.visible, 'on-arc early + mid-cross');
  assert.ok(mid.x > start.x, 'moves toward +x (west → east)');
  assert.ok(mid.y >= start.y, 'rises a touch mid-cross');
  // during the calm gap after the crossing the bird is parked off-view
  const gap = flyoverAt(FLYOVER_PERIOD * (FLYOVER_VISIBLE + 1) * 0.5);
  assert.equal(gap.visible, false, 'a calm pause between passes');
  // the cycle repeats every period
  assert.deepEqual(flyoverAt(3), flyoverAt(3 + FLYOVER_PERIOD), 'periodic');
});

test('flyoverAt stays high above the play area', () => {
  for (let t = 0; t < FLYOVER_PERIOD; t += 0.2) {
    const f = flyoverAt(t);
    assert.ok(f.y >= 28, `y ${f.y} stays high (never dives at the player)`);
  }
});

test('flyoverAt freezes for a frozen clock (reduced-motion)', () => {
  assert.deepEqual(flyoverAt(5.2), flyoverAt(5.2), 'same t → same pose');
});

import { toneMappedHex } from './Atmosphere.ts';

test('toneMappedHex: the horizon haze through the ACES curve is the cream the sky dome draws (measured on screen)', () => {
  // measured in the rendered world (2026-09-27): the dome's horizon at exposure 1.08 read
  // rgb(227, 211, 185) while the raw-haze fog drew rgb(243, 204, 156): a visible band
  const got = toneMappedHex('#f3cc9c', 1.08);
  const rgb = [1, 3, 5].map((i) => parseInt(got.slice(i, i + 2), 16));
  assert.ok(Math.abs(rgb[0] - 227) <= 2 && Math.abs(rgb[1] - 211) <= 2 && Math.abs(rgb[2] - 185) <= 2, `drawn horizon ${got}`);
  assert.equal(toneMappedHex('#000000', 1), '#000000', 'black stays black');
});

import * as THREE from 'three';
import { CLOUD_TILE_M, cloudShadeShader, cloudUv } from './Atmosphere.ts';

test('cloudShadeShader: the cloud shade dims the sun on the ground BEFORE tone mapping and fog (verifier W4V-1)', () => {
  // The old shade was a multiply-blended plane drawn over the finished, fogged picture:
  // a fully fogged far ground came out fog x fog, a hard tan band under the cream sky.
  // Shaded while it is lit, haze covers a far cloud shadow like it covers the ground.
  const { vertex, fragment } = cloudShadeShader(THREE.ShaderLib.standard.vertexShader, THREE.ShaderLib.standard.fragmentShader);
  assert.match(vertex, /uniform vec2 uCloudOff;/);
  assert.match(vertex, /vCloudUv = /, 'the vertex stage hands the world-space cloud uv on');
  assert.match(fragment, /uniform sampler2D uCloudMap;/);
  const shade = fragment.indexOf('reflectedLight.directDiffuse *= cloudShade');
  assert.ok(shade > 0, 'the sun on the ground is dimmed by the cloud shade');
  assert.ok(shade > fragment.indexOf('#include <lights_fragment_end>'), 'after the lights are gathered');
  assert.ok(shade < fragment.indexOf('#include <tonemapping_fragment>'), 'before the tone curve');
  assert.ok(shade < fragment.indexOf('#include <fog_fragment>'), 'before the fog: the haze covers it');
  assert.ok(!/indirectDiffuse \*= cloudShade/.test(fragment), 'the sky fill is not shaded: a cloud blocks the sun');
  assert.throws(() => cloudShadeShader('void main() {}', fragment), /begin_vertex|common/, 'a renamed chunk fails loudly');
});

test('cloudUv: the clouds lie where the old 300 m plane (repeat 2.2) put them, and the shader agrees', () => {
  const off = { x: 0.31, y: 0.07 };
  for (const [x, z] of [[0, 0], [40, -12], [-73, 35], [120, 120]]) {
    // the plane: uv (x+150)/300 across, (−z+150)/300 up (rotated −π/2 about x), then × repeat + offset
    const u = ((x + 150) / 300) * 2.2 + off.x, v = ((-z + 150) / 300) * 2.2 + off.y;
    const got = cloudUv(x, z, off);
    assert.ok(Math.abs(got.u - u) < 1e-9 && Math.abs(got.v - v) < 1e-9, `(${x},${z}) → ${got.u},${got.v} vs ${u},${v}`);
  }
  const { vertex } = cloudShadeShader(THREE.ShaderLib.standard.vertexShader, THREE.ShaderLib.standard.fragmentShader);
  assert.ok(vertex.includes((1 / CLOUD_TILE_M).toFixed(6)), 'the GLSL uses the same tile size');
});
