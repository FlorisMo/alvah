// One-off (23 Jun): promote the approved new Alvah (regen-ranger v4 — no hat, hands
// out) as the live ranger-alvah. Optimizes ranger-alvah-v2.glb with the same pipeline
// as gltf-optimize (human target) straight into public/models/ranger-alvah.glb, STATIC
// — the old Meshy rig was only an idle clip, which ProceduralMotion already provides.
// Surgical: touches ONLY the ranger-alvah entry in the public manifest.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, simplify, prune, textureCompress, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const GEN = new URL('../assets-gen/', import.meta.url);
const SRC = fileURLToPath(new URL('ranger-alvah-v2.glb', GEN));
const PUB = new URL('../public/models/', import.meta.url);
const DEST = fileURLToPath(new URL('ranger-alvah.glb', PUB));
const MAN = fileURLToPath(new URL('manifest.json', PUB));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
await MeshoptSimplifier.ready;

const tris = (doc) => {
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const i = p.getIndices();
      if (i) n += i.getCount() / 3;
      else { const a = p.getAttribute('POSITION'); if (a) n += a.getCount() / 3; }
    }
  return Math.round(n);
};

const doc = await io.read(SRC);
const before = tris(doc);
const ratio = Math.max(0.05, Math.min(1, 18000 / Math.max(1, before)));
await doc.transform(
  dedup(), flatten(), join(), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
  draco(),
);
fs.mkdirSync(fileURLToPath(PUB), { recursive: true });
await io.write(DEST, doc);
const after = tris(doc);
const bytes = fs.statSync(DEST).size;

const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
man['ranger-alvah'] = { file: 'ranger-alvah.glb', category: 'human', bytes, tris: after, animated: false, clips: 0 };
fs.writeFileSync(MAN, JSON.stringify(man, null, 2));
console.log(`✓ staged new Alvah: ${(fs.statSync(SRC).size / 1048576).toFixed(1)}MB → ${(bytes / 1024).toFixed(0)}kB, tris ${before}→${after}, animated:false (procedural idle)`);
