// Anything World animal/bird rigging + animation (the quadruped + bird half of the
// cast; Meshy's rig API does HUMANS only and hard-fails 422 on four-legged/winged
// meshes — BUILD-PLAN §8c #2). Anything World's *processing* API runs its own
// pose-estimation for quadrupeds + birds, so the ~8 mammals + ~23 birds rig+animate
// here. Snake (adder), frog (heikikker) and the butterfly are NOT riggable by AW
// (no skeleton template) → they stay procedural (next ledger box).
//
// Cost: ~5 AW credits / model, idle/walk(+glide for birds) included. ~31 models ≈
// ~155 cr → fits the $50 Micro grant (300 cr/mo) in ~2 runs. Idempotent: skips any
// id that already has assets-gen/animated/<id>.glb + a manifest.rig record, so a
// re-run after a credit top-up resumes exactly where it stopped (§9c).
//
// The rigged+animated GLB lands in ../assets-gen/animated/<id>.glb — the SAME slot
// the Meshy humanoid rigs use, so the loader's "prefer an animated GLB" path and the
// optimize/stage pass treat both providers identically.
//
// ── RUN OWNERSHIP ──────────────────────────────────────────────────────────────
// This is a long EXTERNAL paid-generation job (network + AW credits + minutes per
// model). Like the Meshy render boxes it is run by the autonomous loop / Floris, NOT
// inline by a fresh agent thread. It needs ../.env.local with ANYTHING_WORLD_API and
// the source GLBs in ../assets-gen/<id>.glb (produced by meshy-gen.mjs). With neither
// present it preflights, prints a clear NEEDS-FLORIS-style message, and exits 0
// without spending anything.
//
// AW's processing API is EXPERIMENTAL (§8c #2) — request/response field names may
// drift. Following the meshy-rig.mjs idiom, every response read probes a few likely
// shapes (findField) so a minor API revision degrades to a clear error, not a crash.
// Verify the endpoint shapes against the live API on first real run.
//
// Usage:
//   node scripts/anything-world.mjs --preflight        # key + credits check, no spend
//   node scripts/anything-world.mjs                     # rig+animate the whole eligible cast
//   node scripts/anything-world.mjs animal-vos-fox bird-merel
//   node scripts/anything-world.mjs --only=animal-wolf
import fs from 'node:fs';

const ENV_URL = new URL('../.env.local', import.meta.url);
const env = fs.existsSync(ENV_URL) ? fs.readFileSync(ENV_URL, 'utf8') : '';
const KEY = (env.match(/^ANYTHING_WORLD_API=(.*)$/m)?.[1] || '').trim();
const BASE = (env.match(/^ANYTHING_WORLD_API_BASE=(.*)$/m)?.[1] || 'https://api.anything.world').trim().replace(/\/$/, '');

// AW-eligible cast: quadruped mammals + birds. type → AW model_category hint.
// raven/nightjar/fledgling live under category 'bird' in the shotlist; the buizerd,
// wilde-eend etc. too. Snake/frog/butterfly are deliberately ABSENT (procedural).
const QUADRUPEDS = [
  'animal-wildzwijn-boar', 'animal-frisling-piglet', 'animal-das-badger',
  'animal-eekhoorn-squirrel', 'animal-wolf', 'animal-vos-fox',
  'animal-ree-roedeer', 'animal-edelhert-reddeer',
];
const BIRDS = [
  'animal-raaf-raven', 'animal-nachtzwaluw-nightjar', 'animal-raaf-fledgling',
  'bird-merel', 'bird-koolmees', 'bird-pimpelmees', 'bird-roodborst', 'bird-vink',
  'bird-winterkoning', 'bird-grote-bonte-specht', 'bird-groene-specht',
  'bird-boomklever', 'bird-gaai', 'bird-ekster', 'bird-koekoek', 'bird-tjiftjaf',
  'bird-boomleeuwerik', 'bird-roodborsttapuit', 'bird-goudhaantje', 'bird-zanglijster',
  'bird-houtduif', 'bird-buizerd', 'bird-wilde-eend',
];
// Never sent to AW — no template skeleton; charming procedural motion instead.
const PROCEDURAL_ONLY = ['animal-adder-snake', 'animal-heikikker-frog', 'animal-heideblauwtje-butterfly'];

const TYPE = (id) => (BIRDS.includes(id) ? 'bird' : 'quadruped');
const ELIGIBLE = [...QUADRUPEDS, ...BIRDS];

const OUT = new URL('../assets-gen/', import.meta.url);
const ANIM = new URL('../assets-gen/animated/', import.meta.url);
const MANIFEST = new URL('manifest.json', OUT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Probe a value across a few likely field paths (AW API is experimental).
const findField = (obj, names) => {
  for (const n of names) {
    const v = n.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (v != null) return v;
  }
  return null;
};
const findGlb = (t) => findField(t, [
  'model.glb', 'glb', 'animatedModel', 'animated_glb', 'result.glb',
  'result.model_urls.glb', 'model_urls.glb', 'rigged_glb', 'output.glb',
]);
const findStatus = (t) => findField(t, ['status', 'state', 'result.status', 'job.status']);
const findJobId = (t) => findField(t, ['id', 'job_id', 'jobId', 'modelId', 'model_id', 'result.id', 'taskId']);

async function aw(path, opts = {}) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(KEY)}`;
  const r = await fetch(url, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, json };
}

async function preflight() {
  if (!KEY) {
    console.log('ℹ no ANYTHING_WORLD_API in .env.local — AW rig/animate is loop/Floris-owned.');
    console.log('  Provision the key + ensure source GLBs in assets-gen/<id>.glb, then re-run.');
    return false;
  }
  // A lightweight authenticated GET. /credits is the documented account endpoint;
  // fall back to treating any non-401/403 as "key works" since AW is experimental.
  const { ok, status, json } = await aw('/credits', { method: 'GET' }).catch((e) => ({ ok: false, status: 0, json: { _err: e.message } }));
  if (status === 401 || status === 403) { console.error(`✗ AW key rejected (HTTP ${status}).`); return false; }
  const credits = findField(json, ['credits', 'remaining', 'balance', 'creditsRemaining']);
  console.log(`✓ AW key present (HTTP ${status || '?'})${credits != null ? ` — ~${credits} credits` : ''}.`);
  return true;
}

// Submit one model: POST /rig (multipart GLB) → poll → POST /animate → poll → GLB url.
async function rigAndAnimate(id) {
  const src = new URL(`${id}.glb`, OUT);
  if (!fs.existsSync(src)) { console.error(`✗ ${id}: no source assets-gen/${id}.glb (run meshy-gen first)`); return null; }

  const form = new FormData();
  form.append('model', new Blob([fs.readFileSync(src)]), `${id}.glb`);
  form.append('name', id);
  form.append('model_category', TYPE(id));
  const rig = await aw('/rig', { method: 'POST', body: form });
  if (rig.status === 402) { console.error(`  ✗ ${id}: out of AW credits (402)`); return 'OUT_OF_CREDITS'; }
  const jobId = findJobId(rig.json);
  if (!rig.ok || !jobId) { console.error(`  ✗ ${id}: rig not accepted (HTTP ${rig.status}): ${JSON.stringify(rig.json).slice(0, 200)}`); return null; }

  // poll the rig job
  let rigged;
  for (let i = 0; i < 120; i++) {
    const t = await aw(`/rig/${jobId}`, { method: 'GET' });
    const st = String(findStatus(t.json) || '').toUpperCase();
    if (st.includes('SUCC') || st.includes('DONE') || st.includes('COMPLETE')) { rigged = t.json; break; }
    if (st.includes('FAIL') || st.includes('ERROR')) { console.error(`  ✗ ${id}: rig failed: ${JSON.stringify(t.json).slice(0, 200)}`); return null; }
    process.stdout.write(`\r  …rig ${id} ${st || '?'}   `);
    await sleep(5000);
  }
  if (!rigged) { console.error(`  ✗ ${id}: rig timed out`); return null; }

  // animate the rigged model (idle/walk[/glide] basic set)
  const riggedId = findJobId(rigged) || jobId;
  const an = await aw('/animate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: riggedId, model_category: TYPE(id) }) });
  if (an.status === 402) { console.error(`  ✗ ${id}: out of AW credits (402)`); return 'OUT_OF_CREDITS'; }
  const anJob = findJobId(an.json) || riggedId;

  let done = findGlb(an.json) ? an.json : null;
  for (let i = 0; !done && i < 120; i++) {
    const t = await aw(`/animate/${anJob}`, { method: 'GET' });
    const st = String(findStatus(t.json) || '').toUpperCase();
    if (findGlb(t.json) || st.includes('SUCC') || st.includes('DONE') || st.includes('COMPLETE')) { done = t.json; break; }
    if (st.includes('FAIL') || st.includes('ERROR')) { console.error(`  ✗ ${id}: animate failed: ${JSON.stringify(t.json).slice(0, 200)}`); return null; }
    process.stdout.write(`\r  …animate ${id} ${st || '?'}   `);
    await sleep(5000);
  }
  const glbUrl = done && findGlb(done);
  if (!glbUrl) { console.error(`  ✗ ${id}: no animated GLB url`); return null; }

  const dest = new URL(`${id}.glb`, ANIM);
  const dl = await fetch(glbUrl);
  if (!dl.ok) { console.error(`  ✗ ${id}: download ${dl.status}`); return null; }
  const buf = Buffer.from(await dl.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { bytes: buf.length, jobId, animations: findField(done, ['animations', 'clips', 'result.animations']) };
}

async function main() {
  const preflightOnly = process.argv.includes('--preflight');
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  let ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (onlyArg) ids = onlyArg.split(',');
  if (!ids.length) ids = ELIGIBLE;
  ids = ids.filter((id) => {
    if (PROCEDURAL_ONLY.includes(id)) { console.log(`• procedural-only (AW can't rig): ${id}`); return false; }
    if (!ELIGIBLE.includes(id)) { console.log(`• not AW-eligible (skip): ${id}`); return false; }
    return true;
  });

  const ok = await preflight();
  if (preflightOnly || !ok) process.exit(ok ? 0 : 0);

  fs.mkdirSync(ANIM, { recursive: true });
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  let done = 0;
  for (const id of ids) {
    const dest = new URL(`${id}.glb`, ANIM);
    if (manifest[id]?.rig?.provider === 'anything-world' && fs.existsSync(dest)) { console.log(`• skip (already animated): ${id}`); continue; }
    console.log(`\n▶ AW rig+animate ${id} (${TYPE(id)})`);
    const res = await rigAndAnimate(id);
    if (res === 'OUT_OF_CREDITS') { console.error('■ AW credits exhausted — stopping cleanly (re-run after top-up, §9c).'); break; }
    if (!res) continue;
    manifest[id] = manifest[id] || {};
    manifest[id].rig = { provider: 'anything-world', jobId: res.jobId, animatedGlb: `animated/${id}.glb`, glbBytes: res.bytes, animations: res.animations ? (Array.isArray(res.animations) ? res.animations.length : Object.keys(res.animations).length) : null };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    done++;
    console.log(`\n  ✓ ${id} → assets-gen/animated/${id}.glb (${(res.bytes / 1048576).toFixed(1)} MB)`);
  }
  console.log(`\nAW pass: ${done} model(s) animated, ${ELIGIBLE.length} eligible (${PROCEDURAL_ONLY.length} stay procedural).`);
}

main().catch((e) => { console.error('✗ AW pipeline error:', e.message); process.exit(1); });
