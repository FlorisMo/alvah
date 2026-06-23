/**
 * CalmPose.test.ts — seeded unit test for the pure animal calm-pose set (BUILD-PLAN §9e).
 * Run: `node --experimental-strip-types src/render3d/CalmPose.test.ts`
 *
 * This IS the running "never-scary QA gate" (§B) as code: every species' RESOLVED pose
 * must satisfy its never-scary invariants — no S-coil, no raised hackles, no crouch,
 * no gape/bared teeth, no raised tail "flag" (nor tuck), no full unblinking stare,
 * ears never pinned flat-back. Plus the §B per-species calm cues + determinism.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POSE_CAP, calmGatePose, calmPoseFor, calmPoseBones, type PoseRecipe,
} from './CalmPose.ts';

/** The cast whose poses the §B cheat-sheet specifies. */
const SPECIES = [
  'animal-ree-roedeer', 'animal-edelhert-reddeer', 'animal-wildzwijn-boar',
  'animal-frisling-piglet', 'animal-vos-fox', 'animal-eekhoorn-squirrel',
  'animal-das-badger', 'animal-raaf-raven', 'animal-nachtzwaluw-nightjar',
  'animal-adder-snake', 'animal-heikikker-frog', 'animal-heideblauwtje-butterfly',
];

/** The universal §B AVOID-list invariants every resolved pose must satisfy. */
function assertNeverScary(p: PoseRecipe, who: string): void {
  assert.equal(p.coil, 0, `${who}: adder S-coil rear-up must be 0`);
  assert.equal(p.hackles, 0, `${who}: raised hackles must be 0`);
  assert.equal(p.crouch, 0, `${who}: fearful crouch must be 0`);
  assert.ok(p.mouthOpen <= POSE_CAP.maxMouthOpen + 1e-9, `${who}: mouth gapes (bared teeth/gape)`);
  assert.ok(p.eyeOpen <= POSE_CAP.eyeSoftCap + 1e-9, `${who}: wide unblinking stare`);
  assert.ok(p.tailLift >= 0 && p.tailLift <= POSE_CAP.maxTailLift + 1e-9, `${who}: tail flagged or tucked`);
  assert.ok(p.headPitch >= -POSE_CAP.maxHeadLower - 1e-9 && p.headPitch <= POSE_CAP.maxHeadLift + 1e-9, `${who}: head out of calm band`);
  assert.ok(p.earTilt >= -POSE_CAP.maxEarBack - 1e-9, `${who}: ears pinned flat-back`);
}

test('every species resolves to a never-scary pose (the §B QA gate)', () => {
  for (const id of SPECIES) assertNeverScary(calmPoseFor(id), id);
  // unlisted family members + props also pass
  assertNeverScary(calmPoseFor('animal-onbekend-newt'), 'unlisted-mammal');
  assertNeverScary(calmPoseFor('bird-koolmees-tit'), 'unlisted-bird');
  assertNeverScary(calmPoseFor('prop-acorn'), 'prop');
  assertNeverScary(calmPoseFor(null), 'null');
});

test('calmGatePose FORCES a deliberately threatening pose back to calm', () => {
  const threat: PoseRecipe = {
    ear: 'relaxed', earTilt: -2,        // pinned hard back
    tail: 'low-loose', tailLift: 3,      // tail flagged straight up
    head: 'lifted-soft', headPitch: 2,   // reared threat
    eye: 'soft', eyeOpen: 1,             // wide unblinking stare
    mouth: 'soft-open', mouthOpen: 1,    // full gape / bared teeth
    crouch: 5, hackles: 5, coil: 5,      // crouch + hackles + S-coil
  };
  const g = calmGatePose(threat);
  assertNeverScary(g, 'forced-threat');
  assert.equal(g.earTilt, -POSE_CAP.maxEarBack, 'ear-back not floored to the soft relax');
  assert.equal(g.tailLift, POSE_CAP.maxTailLift, 'tail not capped to a low loose lift');
  assert.equal(g.headPitch, POSE_CAP.maxHeadLift, 'head not capped to lifted-curious');
  // idempotent — gating an already-gated pose changes nothing
  assert.deepEqual(calmGatePose(g), g);
});

test('§B per-species calm cues are encoded', () => {
  // fox: soft half-closed "smile" eyes (notably less open than a deer's soft eye)
  assert.ok(calmPoseFor('animal-vos-fox').eye === 'half-closed');
  assert.ok(calmPoseFor('animal-vos-fox').eyeOpen < calmPoseFor('animal-ree-roedeer').eyeOpen);
  // nightjar: eyes narrowed to slits, utterly still, head low (cryptic roost)
  const nj = calmPoseFor('animal-nachtzwaluw-nightjar');
  assert.equal(nj.eye, 'narrowed-slits');
  assert.ok(nj.eyeOpen < 0.5 && nj.headPitch < 0, 'nightjar not a flattened cryptic roost');
  // badger: head LOW (nose to ground), calm not via eye contact
  assert.ok(calmPoseFor('animal-das-badger').headPitch < -0.2, 'badger head not low/grazing');
  // deer: tail gently twitching = "all-clear", a low loose lift (never a flag)
  const ree = calmPoseFor('animal-ree-roedeer');
  assert.equal(ree.tail, 'gentle-twitch');
  assert.ok(ree.tailLift > 0 && ree.tailLift < POSE_CAP.maxTailLift);
  // squirrel: tail loosely curled + still (not 'none', not flicking — pose rests it)
  assert.equal(calmPoseFor('animal-eekhoorn-squirrel').tail, 'curled-still');
  // adder + frog: legless/tailless, no gape, low/level head
  for (const id of ['animal-adder-snake', 'animal-heikikker-frog']) {
    const p = calmPoseFor(id);
    assert.equal(p.tail, 'none');
    assert.equal(p.mouthOpen, 0);
  }
});

test('calmPoseBones emits only calm, gate-bounded biases', () => {
  for (const id of SPECIES) {
    const p = calmPoseFor(id);
    for (const b of calmPoseBones(id)) {
      assert.ok(['head', 'ear', 'tail'].includes(b.keyword), `${id}: unexpected bone keyword ${b.keyword}`);
      // the tail bias is exactly the gated (never-flag) lift
      if (b.keyword === 'tail') assert.ok(b.euler.x >= 0 && b.euler.x <= POSE_CAP.maxTailLift + 1e-9);
      if (b.keyword === 'head') assert.ok(Math.abs(b.euler.x) <= Math.max(POSE_CAP.maxHeadLift, POSE_CAP.maxHeadLower) + 1e-9);
    }
    // an eared species emits an ear bias only when it has ears
    const hasEar = calmPoseBones(id).some((b) => b.keyword === 'ear');
    assert.equal(hasEar, p.ear !== 'none' && p.earTilt !== 0, `${id}: ear-bias presence mismatch`);
  }
  // a legless/earless species (adder) emits no ear/tail bias
  const snake = calmPoseBones('animal-adder-snake');
  assert.ok(!snake.some((b) => b.keyword === 'ear' || b.keyword === 'tail'), 'adder got an ear/tail bias');
});

test('deterministic — calmPoseFor / calmPoseBones are pure', () => {
  for (const id of SPECIES) {
    assert.deepEqual(calmPoseFor(id), calmPoseFor(id));
    assert.deepEqual(calmPoseBones(id), calmPoseBones(id));
  }
});
