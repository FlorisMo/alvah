// Meshy humanoid rigging (POST /openapi/v1/rigging). Takes a refined text-to-3D
// task (input_task_id from the manifest) and returns a rigged + basic-animated
// character GLB. Meshy's rig API runs HUMAN pose-estimation, so this is for the
// THREE humanoids ONLY (ranger/warden/poacher) — quadrupeds + birds hard-fail
// HTTP 422 and go through Anything World instead (BUILD-PLAN §8c #2).
//
// Cost: ~5 credits each, idle/walk basic animations included. Idempotent: skips
// an id that already has a rigged GLB in ../assets-gen/animated/ + a manifest.rig
// record. The raw rigged GLB lands in ../assets-gen/animated/<id>.glb; the
// optimize/stage pass (gltf-optimize.mjs) handles it like any other source GLB.
//
// Usage:
//   node scripts/meshy-rig.mjs ranger-warden-boa figure-poacher
//   node scripts/meshy-rig.mjs --only=figure-poacher
//   node scripts/meshy-rig.mjs            # default: the 2 remaining humanoids
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/^MESHY_API_KEY=(.*)$/m)?.[1] || '').trim();
if (!KEY) { console.error('✗ no MESHY_API_KEY in .env.local'); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const OUT = new URL('../assets-gen/', import.meta.url);
const ANIM = new URL('../assets-gen/animated/', import.meta.url);
fs.mkdirSync(ANIM, { recursive: true });
const MANIFEST = new URL('manifest.json', OUT);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

// Real-world standing heights (metres) so the rig + future world-scale is right.
const HEIGHT = { 'ranger-alvah': 0.9, 'ranger-warden-boa': 1.8, 'figure-poacher': 1.75 };

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
let ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (arg('only')) ids = arg('only').split(',');
if (!ids.length) ids = ['ranger-warden-boa', 'figure-poacher'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const balance = async () => (await (await fetch('https://api.meshy.ai/openapi/v1/balance', { headers: H })).json()).balance;
const download = async (url, dest) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
};
// The rigged GLB url moved around across Meshy API revisions — probe the likely fields.
const findGlb = (t) =>
  t.model_urls?.glb || t.result?.rigged_character_glb_url || t.rigged_character_glb_url ||
  t.result?.model_urls?.glb || t.result?.glb || null;

for (const id of ids) {
  const entry = manifest[id];
  if (!entry) { console.error(`✗ ${id}: not in manifest`); continue; }
  const dest = new URL(`${id}.glb`, ANIM);
  if (entry.rig?.taskId && fs.existsSync(dest)) { console.log(`• skip (already rigged): ${id}`); continue; }
  const inputTaskId = entry.refineId;
  if (!inputTaskId) { console.error(`✗ ${id}: no refineId in manifest`); continue; }
  const height = HEIGHT[id] ?? 1.0;

  const before = await balance();
  console.log(`\n▶ rig ${id}  (input ${inputTaskId}, ${height} m)  balance ${before}`);
  const r = await fetch('https://api.meshy.ai/openapi/v1/rigging', {
    method: 'POST', headers: H,
    body: JSON.stringify({ input_task_id: inputTaskId, height_meters: height }),
  });
  const j = await r.json().catch(() => ({}));
  const taskId = j.result || j.id;
  if (!taskId) { console.error(`  ✗ rig not accepted (HTTP ${r.status}): ${JSON.stringify(j).slice(0, 200)}`); continue; }

  let final;
  for (let i = 0; i < 120; i++) {
    const t = await (await fetch(`https://api.meshy.ai/openapi/v1/rigging/${taskId}`, { headers: H })).json();
    if (t.status === 'SUCCEEDED') { final = t; break; }
    if (t.status === 'FAILED') { console.error(`  ✗ rig FAILED: ${JSON.stringify(t.task_error || t).slice(0, 200)}`); break; }
    process.stdout.write(`\r  …${t.status || '?'} ${t.progress ?? 0}%   `);
    await sleep(5000);
  }
  if (final?.status !== 'SUCCEEDED') continue;

  const glbUrl = findGlb(final);
  if (!glbUrl) { console.error(`  ✗ no rigged GLB url in response: ${Object.keys(final).join(',')}`); continue; }
  const bytes = await download(glbUrl, dest);
  const anims = final.result?.basic_animations || final.basic_animations || final.animations || null;
  entry.rig = {
    taskId, height, animatedGlb: `animated/${id}.glb`, glbBytes: bytes,
    basicAnimations: anims ? Object.keys(anims) : (Array.isArray(anims) ? anims.length : null),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  const after = await balance();
  console.log(`\n  ✓ rigged ${id} → assets-gen/animated/${id}.glb (${(bytes / 1024 / 1024).toFixed(1)} MB) | cost ${before - after} cr`);
}
