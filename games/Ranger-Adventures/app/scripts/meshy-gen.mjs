// Meshy generation pipeline. Reads MESHY_API_KEY from ../.env.local and an
// asset shot-list (./asset-shotlist.json), generates each as a preview-mode
// text-to-3D, downloads the .glb + thumbnail to ../assets-gen/, and logs a
// manifest (with the license note). Idempotent: skips ids already in the
// manifest. Stops cleanly on a 402 (out of credits / plan limit).
//
// Usage:
//   node scripts/meshy-gen.mjs --limit=2          # generate first 2 not-yet-done
//   node scripts/meshy-gen.mjs --only=ranger-alvah,prop-pine-scots
//   node scripts/meshy-gen.mjs                     # generate the whole list
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
const LIMIT = arg('limit') ? parseInt(arg('limit'), 10) : Infinity;
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(id) {
  for (let i = 0; i < 80; i++) {
    const r = await fetch(`${BASE}/${id}`, { headers: H });
    const j = await r.json();
    if (j.status === 'SUCCEEDED') return j;
    if (j.status === 'FAILED') throw new Error('FAILED: ' + JSON.stringify(j.task_error || j).slice(0, 200));
    process.stdout.write(`\r  …${j.status || '?'} ${j.progress ?? 0}%   `);
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

let done = 0;
for (const item of shotlist) {
  if (!item || typeof item !== 'object' || !item.id || !item.prompt) continue; // skip _comment / invalid
  if (done >= LIMIT) break;
  if (ONLY && !ONLY.has(item.id)) continue;
  if (manifest[item.id]?.glb) { console.log(`• skip (already done): ${item.id}`); continue; }

  console.log(`\n▶ ${item.id}  [${item.category}]`);
  const create = await fetch(BASE, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ mode: 'preview', prompt: item.prompt, art_style: item.art_style || 'realistic' }),
  });
  if (create.status === 402) {
    console.error('  ✗ 402 — out of credits / plan limit. Stopping here.');
    break;
  }
  const cj = await create.json().catch(() => ({}));
  const taskId = cj.result || cj.id;
  if (!taskId) { console.error(`  ✗ no task id (HTTP ${create.status}): ${JSON.stringify(cj).slice(0, 200)}`); continue; }

  try {
    const res = await poll(taskId);
    const glbUrl = res.model_urls?.glb;
    const glbBytes = glbUrl ? await download(glbUrl, new URL(`${item.id}.glb`, OUT)) : 0;
    if (res.thumbnail_url) await download(res.thumbnail_url, new URL(`${item.id}.png`, OUT)).catch(() => {});
    manifest[item.id] = {
      prompt: item.prompt, category: item.category, art_style: item.art_style || 'realistic',
      taskId, glb: `${item.id}.glb`, glbBytes, thumb: `${item.id}.png`,
      license: 'Meshy Pro — full private ownership (generated under paid plan)',
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`\r  ✓ glb ${(glbBytes / 1024).toFixed(0)} kB + thumbnail saved        `);
    done += 1;
  } catch (e) {
    console.error(`\r  ✗ ${item.id}: ${e.message}`);
  }
}
console.log(`\nGenerated ${done} asset(s). Manifest: app/assets-gen/manifest.json`);
