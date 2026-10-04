/**
 * Coat.test.ts — seeded unit test for the pure coat-tint + posture recipe (W3.7b).
 * Run: `node --experimental-strip-types src/render3d/Coat.test.ts`
 *
 * Pins the honest-scope invariants:
 *  - the coat-tint map is SPARSE: only confirmed dossier contradictions (the CC0
 *    vos) get a tint; everyone else is left alone (no speculative repaint),
 *  - the vos tint aims at a rufous/orange hue and keeps strength < 1 (shading survives),
 *  - head-low species (wild zwijn / frisling / das) get a small forward pitch,
 *    alert/level species (ree/edelhert/eekhoorn/vos/wolf) keep pitch 0,
 *  - every posture pitch stays within the POSTURE_MAX_PITCH ceiling,
 *  - both functions are pure (same input → same output). Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { coatTintFor, postureFor, POSTURE_MAX_PITCH, patternFor, patternAt, coatCoords } from './Coat.ts';

const ALL = [
  'animal-vos-fox', 'animal-edelhert-reddeer', 'animal-ree-roedeer', 'animal-das-badger',
  'animal-eekhoorn-squirrel', 'animal-wildzwijn-boar', 'animal-frisling-piglet',
  'animal-wolf', 'animal-adder-snake', 'animal-heikikker-frog', 'bird-merel',
];

function rgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

test('coat tint is sparse: only the confirmed vos, red deer and heikikker contradictions are corrected', () => {
  const tinted = ALL.filter((id) => coatTintFor(id) !== null);
  assert.deepEqual(tinted, ['animal-vos-fox', 'animal-edelhert-reddeer', 'animal-heikikker-frog'], 'no speculative retints beyond the vos, the red deer and the frog');
  assert.equal(coatTintFor(null), null);
  assert.equal(coatTintFor('animal-ree-roedeer'), null, 'the dossier-matching cast is untouched');
});

test('the vos tint is rufous/orange and keeps its shading (strength < 1)', () => {
  const t = coatTintFor('animal-vos-fox')!;
  const c = rgb(t.color);
  assert.ok(c.r > c.g && c.g > c.b, `vos tint ${t.color} must read rufous (r>g>b)`);
  assert.ok(t.strength > 0 && t.strength < 1, 'a partial lerp keeps the pack shading');
});

test('the red deer is red-brown (dossier: zomer roestig/roodbruin) on its coat only', () => {
  const t = coatTintFor('animal-edelhert-reddeer')!;
  const c = rgb(t.color);
  assert.ok(c.r > c.g * 1.5 && c.g > c.b, `red deer tint ${t.color} must read red-brown`);
  assert.ok(t.strength > 0 && t.strength < 1, 'a partial lerp keeps the pack shading');
  assert.deepEqual(t.only, ['Material'], 'its body only: the antlers and the pale rump stay its own');
  assert.equal(coatTintFor('animal-vos-fox')!.only, undefined, 'the fox: every body material');
});

test('the heikikker is red-brown (dossier: normaal roodbruin), its green texture recoloured with its spots kept', () => {
  const t = coatTintFor('animal-heikikker-frog')!;
  const c = rgb(t.color);
  assert.ok(c.r > c.g * 1.3 && c.g > c.b, `heikikker tint ${t.color} must read red-brown`);
  assert.equal(t.pale, true, 'a hue fix: its own texture bleached to light and dark, then coloured');
});

test('posture: head-low species pitch forward, alert/level species stay upright', () => {
  for (const id of ['animal-wildzwijn-boar', 'animal-frisling-piglet', 'animal-das-badger']) {
    const p = postureFor(id);
    assert.ok(p.pitch > 0 && p.headLow, `${id} should be nose-down`);
  }
  for (const id of ['animal-ree-roedeer', 'animal-edelhert-reddeer', 'animal-eekhoorn-squirrel',
    'animal-vos-fox', 'animal-wolf']) {
    const p = postureFor(id);
    assert.equal(p.pitch, 0, `${id} keeps its upright/level stance`);
    assert.equal(p.headLow, false);
  }
  assert.deepEqual(postureFor(null), { pitch: 0, headLow: false });
});

test('every posture pitch is a subtle stance, never a topple (≤ POSTURE_MAX_PITCH)', () => {
  for (const id of ALL) {
    const { pitch } = postureFor(id);
    assert.ok(pitch >= 0 && pitch <= POSTURE_MAX_PITCH, `${id}: pitch ${pitch} out of the calm band`);
  }
});

test('determinism: coatTintFor + postureFor are pure', () => {
  for (const id of ALL) {
    assert.deepEqual(coatTintFor(id), coatTintFor(id));
    assert.deepEqual(postureFor(id), postureFor(id));
  }
});


test('run 6: the frisling wears its pyjama — golden lengthwise stripes on an ochre-brown body', () => {
  const p = patternFor('animal-frisling-piglet');
  assert.ok(p, 'the piglet has a stripe pattern');
  assert.equal(patternFor('animal-wildzwijn-boar'), null, 'the sow keeps her own dark coat');
  assert.equal(patternFor('animal-ree-roedeer'), null);
  // down one flank, from the spine to the belly: dark spine, then light and dark bands
  const along: string[] = [];
  for (let a = 0; a <= 2.2; a += 0.02) along.push(patternAt(p!, 0.45, 0.8, a));
  const stripes = along.join('').split('base').filter((x) => x.includes('stripe')).length;
  assert.equal(stripes, p!.perSide, `${p!.perSide} light stripes a flank`);
  assert.equal(patternAt(p!, 0.45, 0.8, 0), 'base', 'the spine is a dark band');
  // lengthwise: the same band all along the body, none on the head, legs dark, snout dark
  const a1 = (1 / (p!.perSide + 0.5)) * 2.25; // the first stripe's middle
  for (let u = p!.from + 0.02; u < p!.to - 0.02; u += 0.05) assert.equal(patternAt(p!, u, 0.8, a1), 'stripe', `the stripe runs along the body (u ${u.toFixed(2)})`);
  assert.equal(patternAt(p!, 0.85, 0.8, a1), 'head');
  assert.equal(patternAt(p!, 0.5, 0.2, 1), 'dark', 'dark legs');
  assert.equal(patternAt(p!, 0.97, 0.7, 0.2), 'dark', 'a dark snout');
  assert.equal(patternAt(p!, 0.5, 0.45, 2.8), 'belly');
  // its coordinates on a model box: tail → snout along +z (the world's model convention)
  const box = { min: { x: -0.3, y: -0.5, z: -1 }, max: { x: 0.3, y: 0.5, z: 1 } };
  assert.ok(Math.abs(coatCoords(p!, 0, 0, 1, box).u - 1) < 1e-9 && Math.abs(coatCoords(p!, 0, 0, -1, box).u) < 1e-9);
  assert.ok(coatCoords(p!, 0.3, 0.14, 0, box).a > 1.3, 'the flank sits round the side');
  // the yearling's reddish coat is a content-id tint (it shares the boar's model)
  const t = coatTintFor('overloper');
  assert.ok(t && t.strength < 1 && rgb(t.color).r > rgb(t.color).b);
});

test('run 7 (wc-album): the white roe is a pale coat on a content id; the roe\'s own model keeps its coat', () => {
  const t = coatTintFor('witte-ree')!;
  assert.equal(t.pale, true, 'a pale (leucistic) coat');
  const c = rgb(t.color);
  assert.ok(c.r > 225 && c.g > 225 && c.b > 210, `a creamy white (${t.color})`);
  assert.equal(coatTintFor('animal-ree-roedeer'), null, 'every other roe stays brown');
  assert.equal(coatTintFor('animal-vos-fox')!.pale, undefined, 'the other tints are lerps, as before');
});

test('run 7: the raven is black (its GLB is a pale grey bird): a soft near-black, its shading kept', () => {
  const t = coatTintFor('animal-raaf-raven')!;
  assert.ok(t, 'the raven has its tint');
  const c = rgb(t.color);
  assert.ok(Math.max(c.r, c.g, c.b) < 70, `near-black (${t.color})`);
  assert.ok(t.strength > 0.6 && t.strength < 1, 'its own shading stays (strength < 1)');
});

test('run 7: the eekhoorn\'s dark-brown visitor wears a coat ramp on the red squirrel\'s model: dark brown back, a lighter brown belly', () => {
  const t = coatTintFor('eekhoorn-donker')!;
  assert.ok(t && t.ramp, 'a ramp');
  assert.equal(t.strength, 0, 'no tint on top of the ramp');
  const lum = (hex: string): number => { const c = rgb(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
  for (const hex of [t.ramp!.dark, t.ramp!.light]) {
    const c = rgb(hex);
    assert.ok(c.r > c.g && c.g > c.b, `${hex} is a brown (r > g > b)`);
  }
  assert.ok(lum(t.ramp!.dark) < lum(t.ramp!.light) * 0.6, 'its back much darker than its belly');
  assert.ok(lum(t.ramp!.dark) >= 40, 'never a black hole');
  assert.ok(t.ramp!.split[0] < t.ramp!.split[1]);
  assert.equal(coatTintFor('eekhoorn')?.ramp, undefined, 'the red squirrel itself keeps its own fur');
});
