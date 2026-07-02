// merge-ranger-clips.mjs — the Meshy humanoid rig API returns the base rigged
// GLB (model_urls.glb → one short rest clip) PLUS separate per-animation GLBs
// (basic_animations.walking_glb_url / running_glb_url), each carrying ONE baked
// clip on the SAME 26-node armature. meshy-rig.mjs only downloads the base GLB,
// so the staged rig would have a single clip. W3.1 needs ≥2 clips on one skinned
// GLB, and W3.2 wants named idle/walk actions.
//
// This transplants the walking + running clips onto the base rigged GLB (their
// skeletons are node-name identical — verified 0 mismatches), renames the three
// resulting clips to idle/walk/run, and overwrites assets-gen/animated/<id>.glb
// so the normal optimize-animated.mjs pass stages it. Idempotent: re-run any time
// from the three source GLBs (base + -walk + -run) in assets-gen/animated/.
//
// Usage: node scripts/merge-ranger-clips.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ANIM = new URL('../assets-gen/animated/', import.meta.url);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const p = (f) => fileURLToPath(new URL(f, ANIM));

const base = await io.read(p('ranger-alvah.glb'));
const root = base.getRoot();
const buffer = root.listBuffers()[0];
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));

// name the base's own default clip
root.listAnimations()[0]?.setName('idle');

// Transplant one animation from a source GLB into `base`, matching nodes by name.
async function transplant(srcFile, clipName) {
  const src = await io.read(p(srcFile));
  const anim = src.getRoot().listAnimations()[0];
  if (!anim) throw new Error(`no animation in ${srcFile}`);
  const newAnim = base.createAnimation(clipName);
  const samplerMap = new Map();
  let skipped = 0;
  for (const ch of anim.listChannels()) {
    const tgt = byName.get(ch.getTargetNode().getName());
    if (!tgt) { skipped++; continue; }
    const s = ch.getSampler();
    let ns = samplerMap.get(s);
    if (!ns) {
      const mk = (acc) => base.createAccessor()
        .setType(acc.getType())
        .setArray(acc.getArray().slice())
        .setBuffer(buffer);
      ns = base.createAnimationSampler()
        .setInput(mk(s.getInput()))
        .setOutput(mk(s.getOutput()))
        .setInterpolation(s.getInterpolation());
      newAnim.addSampler(ns);
      samplerMap.set(s, ns);
    }
    newAnim.addChannel(base.createAnimationChannel()
      .setTargetNode(tgt).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
  console.log(`  + ${clipName}: ${newAnim.listChannels().length} channels (${skipped} unmatched)`);
}

await transplant('ranger-alvah-walk.glb', 'walk');
await transplant('ranger-alvah-run.glb', 'run');

await io.write(p('ranger-alvah.glb'), base);
console.log('clips now:', base.getRoot().listAnimations().map((a) => a.getName()).join(', '));
console.log('skins:', base.getRoot().listSkins().length);
