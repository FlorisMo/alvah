// optimize-animated.mjs — stage the RIGGED + ANIMATED GLBs (Meshy humanoid rigs
// now; Anything World animal/bird rigs once that paid job runs) from
// ../assets-gen/animated/<id>.glb into /models/, preserving the skeleton and the
// baked animation clips so the loader's "prefer an animated GLB over procedural"
// path (Models.loadRig → AnimationMixer, World.ts) can drive them.
//
// WHY a separate pass from gltf-optimize.mjs: that script runs flatten()/join()/
// simplify() to crush static props, but flatten+join COLLAPSE the node hierarchy
// that a skin + animation channels reference — they silently break the rig. Here
// we run only the animation-safe transforms: dedup → weld → WebP texture compress
// → DRACO geometry. No flatten/join/simplify, so skinning + clips survive intact.
// Size still drops hard (the 8–9 MB raw rigs are mostly PNG texture + uncompressed
// geometry; WebP + DRACO land them in the low hundreds of kB).
//
// Idempotent: re-run any time (overwrites animated/opt/ + the staged GLB). Reads
// ../assets-gen/manifest.json only for each id's category (texture sizing); it
// scans the animated/ dir directly, so it stages whatever rigs are present — the
// 3 Meshy humanoids today, the AW cast the moment that job lands its files.
//
// Usage:
//   node scripts/optimize-animated.mjs                       # every animated/*.glb
//   node scripts/optimize-animated.mjs --only=ranger-alvah   # a subset
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, textureCompress, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const ANIM = new URL('../assets-gen/animated/', import.meta.url);
const OPT = new URL('../assets-gen/animated/opt/', import.meta.url);
const GEN = new URL('../assets-gen/', import.meta.url);
const PUB = new URL('../public/models/', import.meta.url);
fs.mkdirSync(OPT, { recursive: true });
fs.mkdirSync(PUB, { recursive: true });

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;

// Texture size per category (mirrors gltf-optimize.mjs §1d tiers); animated rigs
// are mostly human/animal → 1024, birds → 512.
const TEXSIZE = { human: 1024, animal: 1024, bird: 512, prop: 512 };

const genManifest = fs.existsSync(new URL('manifest.json', GEN))
  ? JSON.parse(fs.readFileSync(new URL('manifest.json', GEN), 'utf8'))
  : {};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

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

const files = fs.readdirSync(ANIM).filter((f) => f.endsWith('.glb'));
if (!files.length) {
  console.log('No animated GLBs in assets-gen/animated/ yet (Meshy humanoid rigs / AW animal rigs). Nothing to stage.');
  process.exit(0);
}

// Stage into the SAME public manifest gltf-optimize.mjs writes, so animated entries
// overwrite their static stand-ins (same id) with animated:true + their clip count.
const PUBMAN = new URL('manifest.json', PUB);
const pubManifest = fs.existsSync(PUBMAN) ? JSON.parse(fs.readFileSync(PUBMAN, 'utf8')) : {};

let count = 0, totalBefore = 0, totalAfter = 0;
for (const file of files) {
  const id = file.replace(/\.glb$/, '');
  if (ONLY && !ONLY.has(id)) continue;
  const src = new URL(file, ANIM);

  const cat = genManifest[id]?.category || 'human';
  const texSize = TEXSIZE[cat] ?? 1024;

  try {
    const doc = await io.read(fileURLToPath(src));
    const before = triCount(doc);
    const anims = doc.getRoot().listAnimations().length;
    const skins = doc.getRoot().listSkins().length;

    // Animation-safe ONLY: no flatten/join/simplify (they break the skin+rig).
    await doc.transform(
      dedup(),
      weld(),
      prune({ keepAttributes: true, keepLeaves: false }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize] }),
      draco(),
    );

    const dest = new URL(`${id}.glb`, OPT);
    await io.write(fileURLToPath(dest), doc);

    // Confirm the rig survived the squeeze before staging.
    const after = await io.read(fileURLToPath(dest));
    const animsAfter = after.getRoot().listAnimations().length;
    const skinsAfter = after.getRoot().listSkins().length;
    if (animsAfter < anims || skinsAfter < skins) {
      console.error(`✗ ${id}: rig lost in optimize (anims ${anims}→${animsAfter}, skins ${skins}→${skinsAfter}) — NOT staged`);
      continue;
    }

    fs.copyFileSync(dest, new URL(`${id}.glb`, PUB));
    const bBytes = fs.statSync(src).size;
    const aBytes = fs.statSync(dest).size;
    totalBefore += bBytes; totalAfter += aBytes; count++;
    pubManifest[id] = { file: `${id}.glb`, category: cat, bytes: aBytes, tris: triCount(doc), animated: true, clips: animsAfter };
    console.log(`✓ ${id}  ${(bBytes / 1048576).toFixed(1)}MB → ${(aBytes / 1024).toFixed(0)}kB   ${animsAfter} clip(s), ${skinsAfter} skin   tris ${before}`);
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`);
  }
}

fs.writeFileSync(PUBMAN, JSON.stringify(pubManifest, null, 2));
console.log(`\nStaged ${count} animated model(s): ${(totalBefore / 1048576).toFixed(1)}MB → ${(totalAfter / 1048576).toFixed(2)}MB → app/public/models/ (animated:true).`);
