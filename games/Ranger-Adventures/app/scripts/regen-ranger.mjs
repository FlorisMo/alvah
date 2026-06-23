// regen-ranger.mjs — one-off: regenerate JUST the hero ranger with a stronger,
// rig-ready pose (the first pass came out hands-near-pockets). Writes to
// assets-gen/ranger-alvah-v2.{glb,png} ONLY — it does NOT touch manifest.json,
// so it's safe to run while the main generation is still going. QA the v2 png,
// then (if better) copy it over ranger-alvah.{glb,png}; the finalizer re-optimizes.
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/^MESHY_API_KEY=(.*)$/m)?.[1] || '').trim();
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const OUT = new URL('../assets-gen/', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Floris's likeness description (23 Jun) + the strong A-pose fix — kept under Meshy's 800-char cap.
const PROMPT =
  'full body 3D game character of a slender 8 year old boy forest ranger, child proportions, ' +
  'dark ash-blond wavy messy hair with soft bangs over the forehead, ' +
  'large expressive blue-green eyes with long dark lashes, soft round youthful face, ' +
  'full rosy cheeks, small straight button nose, friendly warm smile, fair skin with a natural glow, ' +
  'narrow shoulders, neutral A-pose with both arms held clearly away from the body, ' +
  'a wide gap between arms and torso, hands open, palms facing the thighs, legs slightly apart, ' +
  'feet flat, head up looking ahead, green ranger jacket over a yellow shirt, khaki shorts, ' +
  'brown hiking boots, small ranger hat, stylized realistic, clean topology, rig ready, ' +
  'single character centered, plain neutral background';

async function poll(id, label) {
  for (let i = 0; i < 120; i++) {
    const j = await (await fetch(`${BASE}/${id}`, { headers: H })).json();
    if (j.status === 'SUCCEEDED') { process.stdout.write('\r' + ' '.repeat(40) + '\r'); return j; }
    if (j.status === 'FAILED') throw new Error('FAILED: ' + JSON.stringify(j.task_error || j).slice(0, 200));
    process.stdout.write(`\r  …${label} ${j.progress ?? 0}%   `);
    await sleep(5000);
  }
  throw new Error('poll timeout');
}
async function create(body) {
  const r = await fetch(BASE, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const id = j.result || j.id;
  if (!id) throw new Error(`no task id (HTTP ${r.status}): ${JSON.stringify(j).slice(0, 200)}`);
  return id;
}
async function download(url, dest) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

console.log('▶ ranger-alvah v2 (stronger A-pose)  preview→refine');
const previewId = await create({ mode: 'preview', prompt: PROMPT, art_style: 'realistic', should_remesh: true, topology: 'triangle', target_polycount: 30000 });
await poll(previewId, 'preview');
const refineId = await create({ mode: 'refine', preview_task_id: previewId, enable_pbr: true });
const final = await poll(refineId, 'refine');
const bytes = await download(final.model_urls.glb, new URL('ranger-alvah-v2.glb', OUT));
if (final.thumbnail_url) await download(final.thumbnail_url, new URL('ranger-alvah-v2.png', OUT)).catch(() => {});
console.log(`  ✓ v2 glb ${(bytes / 1048576).toFixed(1)} MB + thumbnail → assets-gen/ranger-alvah-v2.{glb,png}`);
