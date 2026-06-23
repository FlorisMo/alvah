/**
 * Sandbox.test.ts — seeded unit test for the pure Demo Sandbox layout core
 * (DEMO-SANDBOX.md Tier 2; BUILD-PLAN §9e). Run:
 *   node --experimental-strip-types --test src/render3d/Sandbox.test.ts
 *
 * Pins the invariants the compact showroom relies on: the layout is deterministic,
 * every cast member + every interaction is placed (nothing dropped), no two placements
 * overlap, the whole clearing fits inside a compact radius well within the World bound,
 * the interaction triggers ring the centre closer than the cast, and the jump-menu
 * (the demo-skip target list) covers every placement exactly once.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sandboxLayout, castCallKey, COMPACT_RADIUS, INNER_RING, CAST_RING_0, MIN_SPACING,
  type SandboxInteraction,
} from './Sandbox.ts';

// A representative cast (the real game has ~74 non-ranger models) + the full
// interaction set the sandbox must expose (5 EF + 6 meta beats).
const CAST = [
  'animal-vos-fox', 'animal-ree-roe', 'animal-edelhert-stag', 'animal-das-badger',
  'animal-eekhoorn-squirrel', 'animal-wildzwijn-boar', 'animal-frisling-piglet',
  'animal-adder-viper', 'animal-heikikker-frog', 'bird-raaf-raven', 'bird-buizerd-buzzard',
  'bird-nachtzwaluw-nightjar', 'bird-wilde-eend-duck', 'human-warden', 'human-poacher',
];
const INTERACTIONS: SandboxInteraction[] = [
  { id: 'zoeken', kind: 'ef', label: 'Spoor zoeken' },
  { id: 'corsi', kind: 'ef', label: 'Onthoud de plekken' },
  { id: 'simon', kind: 'ef', label: 'Luister en herhaal' },
  { id: 'dagnacht', kind: 'ef', label: 'Dag of nacht' },
  { id: 'wisselen', kind: 'ef', label: 'Wissel de regel' },
  { id: 'companion', kind: 'meta', label: 'Verzorg je maatje' },
  { id: 'caseboard', kind: 'meta', label: 'Het prikbord' },
  { id: 'avatar', kind: 'meta', label: 'Maak je ranger' },
  { id: 'badge', kind: 'meta', label: 'Breinkracht-badge' },
  { id: 'fact', kind: 'meta', label: 'Wist je dat' },
  { id: 'arc', kind: 'meta', label: 'Het verhaal' },
];

const RANGER = 'ranger-alvah';
const build = () => sandboxLayout({ ranger: RANGER, cast: CAST, interactions: INTERACTIONS });

test('layout is deterministic', () => {
  assert.deepEqual(build(), build());
});

test('every cast member + every interaction + the ranger is placed (nothing dropped)', () => {
  const { placements } = build();
  const ids = new Set(placements.map((p) => p.id));
  assert.ok(ids.has(RANGER), 'ranger present');
  for (const id of CAST) assert.ok(ids.has(id), `cast ${id} present`);
  for (const it of INTERACTIONS) assert.ok(ids.has(it.id), `interaction ${it.id} present`);
  // exactly one placement each — no duplicates.
  assert.equal(placements.length, 1 + CAST.length + INTERACTIONS.length);
  assert.equal(ids.size, placements.length);
});

test('no two placements overlap (≥ MIN_SPACING apart)', () => {
  const { placements } = build();
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const d = Math.hypot(placements[i].x - placements[j].x, placements[i].z - placements[j].z);
      assert.ok(d >= MIN_SPACING - 1e-9, `${placements[i].id} ↔ ${placements[j].id} = ${d.toFixed(2)}m`);
    }
  }
});

test('the whole clearing is compact — within COMPACT_RADIUS and far inside the World bound (116 m)', () => {
  const { placements, radius } = build();
  for (const p of placements) {
    assert.ok(Math.hypot(p.x, p.z) <= COMPACT_RADIUS + 1e-9, `${p.id} within compact radius`);
  }
  assert.ok(radius <= COMPACT_RADIUS + 1e-9);
  assert.ok(radius < 116, 'far inside the World bound');
});

test('interaction triggers ring the centre closer than the cast (do-something is a step away)', () => {
  const { placements } = build();
  const ef = placements.filter((p) => p.kind === 'ef' || p.kind === 'meta');
  const cast = placements.filter((p) => p.kind === 'cast');
  const maxInteraction = Math.max(...ef.map((p) => Math.hypot(p.x, p.z)));
  const minCast = Math.min(...cast.map((p) => Math.hypot(p.x, p.z)));
  assert.ok(maxInteraction < minCast, `interactions (≤${maxInteraction.toFixed(1)}m) inside cast (≥${minCast.toFixed(1)}m)`);
  // interactions sit on the inner ring; ranger sits dead centre.
  for (const p of ef) assert.ok(Math.abs(Math.hypot(p.x, p.z) - INNER_RING) < 1e-6, `${p.id} on inner ring`);
  assert.ok(cast.every((p) => Math.hypot(p.x, p.z) >= CAST_RING_0 - 1e-6), 'cast at or beyond the first cast ring');
  const ranger = placements.find((p) => p.kind === 'ranger')!;
  assert.equal(Math.hypot(ranger.x, ranger.z), 0);
});

test('everything faces the central station (the demo reads inward)', () => {
  const { placements } = build();
  for (const p of placements.filter((q) => q.ring > 0)) {
    // facing should point back toward origin: the unit facing vector ≈ -position direction.
    const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
    const len = Math.hypot(p.x, p.z);
    const dot = (fx * -p.x + fz * -p.z) / len;
    assert.ok(dot > 0.999, `${p.id} faces inward`);
  }
});

test('the jump-menu covers every placement exactly once (the demo-skip target list)', () => {
  const { placements, jumpTargets } = build();
  assert.equal(jumpTargets.length, placements.length);
  const jids = new Set(jumpTargets.map((t) => t.id));
  assert.equal(jids.size, jumpTargets.length, 'no duplicate jump targets');
  for (const p of placements) {
    const t = jumpTargets.find((q) => q.id === p.id)!;
    assert.ok(t, `${p.id} has a jump target`);
    assert.equal(t.x, p.x); assert.equal(t.z, p.z); assert.equal(t.kind, p.kind);
  }
});

test('castCallKey maps cast model ids to the Dutch species call key', () => {
  // category prefix dropped, species segment kept — matches the audio + synth CALLS keys.
  assert.equal(castCallKey('animal-wildzwijn-boar'), 'wildzwijn');
  assert.equal(castCallKey('animal-ree-roedeer'), 'ree');
  assert.equal(castCallKey('animal-raaf-raven'), 'raaf');
  assert.equal(castCallKey('animal-raaf-fledgling'), 'raaf'); // both ravens → one call
  assert.equal(castCallKey('bird-merel'), 'merel');
  assert.equal(castCallKey('figure-poacher'), 'poacher');
  assert.equal(castCallKey('ranger-warden-boa'), 'warden');
  // a bare token is its own key; never throws.
  assert.equal(castCallKey('wolf'), 'wolf');
  assert.equal(castCallKey(''), '');
});

test('scales to the full ~74-model cast without overlap or blowing the compact bound', () => {
  const big = Array.from({ length: 74 }, (_, i) => `cast-${i}`);
  const { placements, radius } = sandboxLayout({ ranger: RANGER, cast: big, interactions: INTERACTIONS });
  assert.equal(placements.length, 1 + 74 + INTERACTIONS.length);
  assert.ok(radius <= COMPACT_RADIUS + 1e-9, `radius ${radius.toFixed(1)} stays compact`);
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const d = Math.hypot(placements[i].x - placements[j].x, placements[i].z - placements[j].z);
      assert.ok(d >= MIN_SPACING - 1e-9, `overlap ${placements[i].id} ↔ ${placements[j].id}`);
    }
  }
});
