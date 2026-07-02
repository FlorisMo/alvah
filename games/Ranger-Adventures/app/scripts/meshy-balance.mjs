// W0.7 Meshy balance probe. Reads MESHY_API_KEY from ../.env.local.
// Prints ONLY the masked key prefix + remaining credits — never the key value.
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || '').trim();
const key = read('MESHY_API_KEY');

if (!key) { console.log('✗ No MESHY_API_KEY found in .env.local'); process.exit(1); }
console.log(`Key present: ${key.slice(0, 4)}…(${key.length} chars)`);

const H = { Authorization: `Bearer ${key}` };
try {
  const r = await fetch('https://api.meshy.ai/openapi/v1/balance', { headers: H });
  const j = await r.json();
  console.log(`[balance] HTTP ${r.status} → ${j.balance != null ? j.balance + ' credits' : JSON.stringify(j).slice(0, 200)}`);
} catch (e) { console.log('[balance] network error:', e.message); }
