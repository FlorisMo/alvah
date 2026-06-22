// One-off: does the Meshy key work on the FREE tier, or is generation Pro-gated?
// Reads MESHY_API_KEY from ../.env.local. Prints only statuses (never the key).
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || '').trim();
const key = read('MESHY_API_KEY');

if (!key) { console.log('✗ No MESHY_API_KEY found in .env.local'); process.exit(1); }
console.log(`Key loaded: ${key.slice(0, 4)}…(${key.length} chars)`);

const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const base = 'https://api.meshy.ai/openapi/v2/text-to-3d';

// 1) AUTH CHECK — list tasks (no credits spent). 200 = key valid + API reachable.
try {
  const r = await fetch(`${base}?page_size=1`, { headers: H });
  console.log(`\n[1] AUTH/list  → HTTP ${r.status}`);
  console.log('    ' + (await r.text()).slice(0, 300));
} catch (e) { console.log('[1] AUTH/list  → network error:', e.message); }

// 2) GENERATE TEST — tiny preview task. 200/202 + a result id = free generation WORKS.
//    402/403 / "payment"/"subscription"/"credits" = Pro needed.
try {
  const r = await fetch(base, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ mode: 'preview', prompt: 'a small cute stylized red fox', art_style: 'realistic' }),
  });
  console.log(`\n[2] GENERATE   → HTTP ${r.status}`);
  console.log('    ' + (await r.text()).slice(0, 400));
} catch (e) { console.log('[2] GENERATE   → network error:', e.message); }
