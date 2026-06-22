// Meshy generation pipeline (preview → refine). Reads MESHY_API_KEY from
// ../.env.local and an asset shot-list (./asset-shotlist.json). For each asset:
//   1) preview  — fast grey geometry (raw preview meshes have NO colour)
//   2) refine   — bakes PBR colour + texture onto the preview mesh
// then downloads the refined .glb + thumbnail to ../assets-gen/ and logs a
// manifest (with the licence note). Idempotent: skips ids already finished in
// the manifest. Stops cleanly on a 402 (out of credits / plan limit) so a long
// run never burns past the month's budget.
//
// Poly target: each item may set "target_polycount"; otherwise a per-category
// default is used. This is the BASE topology — scripts/gltf-optimize.mjs reduces
// + DRACO/KTX2-compresses further toward the <150-draw-call iPad budget.
//
// Usage:
//   node scripts/meshy-gen.mjs --limit=2                 # first 2 not-yet-done
//   node scripts/meshy-gen.mjs --only=ranger-alvah       # one (regenerates it)
//   node scripts/meshy-gen.mjs --no-refine               # preview only (cheap QA)
//   node scripts/meshy-gen.mjs                           # the whole list
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/^MESHY_API_KEY=(.*)$/m)?.[1] || '').trim();
if (!KEY) { console.error('✗ no MESHY_API_KEY in .env.local'); process.exit(1); }

const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d';

const OUT = new URL('../assets-gen/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = new URL('manifest.json', OUT);
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

const shotlist = JSON.parse(fs.readFileSync(new URL('./asset-shotlist.json', import.meta.url), 'utf8'));

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => process.argv.includes(`--${name}`);
const LIMIT = arg('limit') ? parseInt(arg('limit'), 10) : Infinity;
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;
const REFINE = !has('no-refine');

// Base poly target per category (pre-optimization; gltf-optimize trims further).
const POLY = { human: 30000, animal: 24000, bird: 16000, prop: 12000 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(id, label) {
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${BASE}/${id}`, { headers: H });
    const j = await r.json();
    if (j.status === 'SUCCEEDED') { process.stdout.write('\r' + ' '.repeat(40) + '\r'); return j; }
    if (j.status === 'FAILED') throw new Error('FAILED: ' + JSON.stringify(j.task_error || j).slice(0, 200));
    process.stdout.write(`\r  …${label} ${j.status || '?'} ${j.progress ?? 0}%   `);
    await sleep(5000);
  }
  throw new Error('poll timeout');
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// Returns the created task id, or throws 'OUT_OF_CREDITS' on a 402.
async function create(body) {
  const r = await fetch(BASE, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (r.status === 402) throw new Error('OUT_OF_CREDITS');
  const j = await r.json().catch(() => ({}));
  const id = j.result || j.id;
  if (!id) throw new Error(`no task id (HTTP ${r.status}): ${JSON.stringify(j).slice(0, 200)}`);
  return id;
}

let done = 0;
for (const item of shotlist) {
  if (!item || typeof item !== 'object' || !item.id || !item.prompt) continue; // skip _comment / invalid
  if (done >= LIMIT) break;
  if (ONLY && !ONLY.has(item.id)) continue;
  if (manifest[item.id]?.glb && manifest[item.id]?.refined) { console.log(`• skip (already refined): ${item.id}`); continue; }

  console.log(`\n▶ ${item.id}  [${item.category}]${REFINE ? '  preview→refine' : '  preview only'}`);
  const polycount = item.target_polycount || POLY[item.category] || 20000;

  try {
    // 1) preview — geometry
    const previewId = await create({
      mode: 'preview',
      prompt: item.prompt,
      art_style: item.art_style || 'realistic',
      should_remesh: true,
      topology: 'triangle',
      target_polycount: polycount,
    });
    const prev = await poll(previewId, 'preview');

    // 2) refine — bake PBR colour + texture onto the preview mesh
    let final = prev, refineId = null, refined = false;
    if (REFINE) {
      refineId = await create({ mode: 'refine', preview_task_id: previewId, enable_pbr: true });
      final = await poll(refineId, 'refine');
      refined = true;
    }

    const glbUrl = final.model_urls?.glb;
    const glbBytes = glbUrl ? await download(glbUrl, new URL(`${item.id}.glb`, OUT)) : 0;
    if (final.thumbnail_url) await download(final.thumbnail_url, new URL(`${item.id}.png`, OUT)).catch(() => {});

    manifest[item.id] = {
      prompt: item.prompt, category: item.category, art_style: item.art_style || 'realistic',
      target_polycount: polycount, previewId, refineId, refined,
      glb: `${item.id}.glb`, glbBytes, thumb: `${item.id}.png`,
      license: 'Meshy Ultra — full private ownership (generated under paid plan)',
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`  ✓ ${refined ? 'refined' : 'preview'} glb ${(glbBytes / 1024 / 1024).toFixed(1)} MB + thumbnail`);
    done += 1;
  } catch (e) {
    if (e.message === 'OUT_OF_CREDITS') {
      console.error('  ✗ 402 — out of credits / plan limit. Stopping here.');
      break;
    }
    console.error(`  ✗ ${item.id}: ${e.message}`);
  }
}
console.log(`\nGenerated ${done} asset(s). Manifest: app/assets-gen/manifest.json`);
