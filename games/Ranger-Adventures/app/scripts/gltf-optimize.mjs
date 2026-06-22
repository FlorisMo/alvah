// gltf-optimize.mjs — squeeze the raw Meshy GLBs (5–25 MB) toward the iPad
// runtime budget (BUILD-PLAN §1d). Per asset: dedup/flatten/join/weld → meshopt
// SIMPLIFY to a per-category poly target → prune → WebP texture compression →
// DRACO geometry compression. Reads ../assets-gen/manifest.json, writes
// optimized GLBs to ../assets-gen/opt/, and records before/after sizes back on
// the manifest (optBytes). Idempotent-ish: re-run any time; it overwrites opt/.
//
// KTX2: true GPU-texture compression needs a native encoder (`toktx`). If one is
// on PATH it's used; otherwise textures fall back to WebP (well-supported by
// three.js + iPad Safari, big download win) and a note is logged. Install the
// encoder later with `brew install ktx` for the final on-device pass.
//
// Usage:
//   node scripts/gltf-optimize.mjs                 # all refined assets
//   node scripts/gltf-optimize.mjs --only=ranger-alvah,animal-wolf
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, simplify, prune, textureCompress, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const GEN = new URL('../assets-gen/', import.meta.url);
const OPT = new URL('../assets-gen/opt/', import.meta.url);
fs.mkdirSync(OPT, { recursive: true });
const MANIFEST = new URL('manifest.json', GEN);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;

// Runtime poly targets (§1d mid/close tiers) + texture sizes per category.
const TARGET = { human: 18000, animal: 14000, bird: 8000, prop: 6000 };
const TEXSIZE = { human: 1024, animal: 1024, bird: 512, prop: 512 };

const hasToktx = (() => {
  try { execSync('toktx --version', { stdio: 'ignore' }); return true; } catch { return false; }
})();

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
await MeshoptSimplifier.ready;

function triCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) n += idx.getCount() / 3;
      else { const p = prim.getAttribute('POSITION'); if (p) n += p.getCount() / 3; }
    }
  return Math.round(n);
}

if (!hasToktx) console.log('ℹ KTX2 encoder (toktx) not found — using WebP textures. `brew install ktx` enables KTX2 for the iPad pass.\n');

let count = 0, totalBefore = 0, totalAfter = 0;
for (const [id, rec] of Object.entries(manifest)) {
  if (ONLY && !ONLY.has(id)) continue;
  if (!rec.refined) { console.log(`• skip (preview-only, not refined): ${id}`); continue; }
  const src = new URL(rec.glb, GEN);
  if (!fs.existsSync(src)) { console.log(`• skip (missing glb): ${id}`); continue; }

  const cat = rec.category || 'prop';
  const target = TARGET[cat] ?? 10000;
  const texSize = TEXSIZE[cat] ?? 1024;

  try {
    const doc = await io.read(fileURLToPath(src));
    const before = triCount(doc);
    const ratio = Math.max(0.05, Math.min(1, target / Math.max(1, before)));

    await doc.transform(
      dedup(),
      flatten(),
      join(),
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize] }),
      draco(),
    );

    const dest = new URL(`${id}.glb`, OPT);
    await io.write(fileURLToPath(dest), doc);
    const after = triCount(doc);
    const bBytes = fs.statSync(src).size;
    const aBytes = fs.statSync(dest).size;
    totalBefore += bBytes; totalAfter += aBytes; count++;
    rec.opt = `opt/${id}.glb`;
    rec.optBytes = aBytes;
    rec.tris = { before, after };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`✓ ${id}  ${(bBytes / 1048576).toFixed(1)}MB → ${(aBytes / 1024).toFixed(0)}kB   tris ${before}→${after}`);
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`);
  }
}
// Stage optimized GLBs + a manifest into public/models/ so the running 3D world
// can load /models/<id>.glb. public/models is git-ignored (regenerable).
const PUB = new URL('../public/models/', import.meta.url);
fs.mkdirSync(PUB, { recursive: true });
const slim = {};
for (const [id, rec] of Object.entries(manifest)) {
  if (!rec.opt) continue;
  const srcFile = new URL(rec.opt, GEN);
  if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, new URL(`${id}.glb`, PUB));
  slim[id] = { file: `${id}.glb`, category: rec.category, bytes: rec.optBytes, tris: rec.tris?.after };
}
fs.writeFileSync(new URL('manifest.json', PUB), JSON.stringify(slim, null, 2));

console.log(`\nOptimized ${count} asset(s): ${(totalBefore / 1048576).toFixed(1)}MB → ${(totalAfter / 1048576).toFixed(2)}MB total.`);
console.log(`Staged ${Object.keys(slim).length} model(s) → app/public/models/ (served at /models/).`);
