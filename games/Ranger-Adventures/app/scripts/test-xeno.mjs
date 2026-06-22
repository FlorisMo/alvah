// Validate the xeno-canto key + preview the most-recorded Dutch birds
// (recordings count ≈ a rough commonality/recordability proxy). Reads
// XENO_CANTO_KEY from ../.env.local. Prints only counts/species (never the key).
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/^XENO_CANTO_KEY=(.*)$/m)?.[1] || '').trim();
if (!KEY) { console.error('✗ no XENO_CANTO_KEY in .env.local'); process.exit(1); }

const url = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent('cnt:netherlands grp:birds')}&key=${KEY}&per_page=500`;
const r = await fetch(url);
console.log('HTTP', r.status);
const text = await r.text();
let j;
try { j = JSON.parse(text); } catch { console.log('non-JSON response:', text.slice(0, 300)); process.exit(1); }

console.log(`numRecordings: ${j.numRecordings}   numSpecies: ${j.numSpecies}   numPages: ${j.numPages}`);
const tally = {};
const lic = {};
for (const rec of j.recordings || []) {
  const name = rec.en || `${rec.gen} ${rec.sp}`;
  tally[name] = (tally[name] || 0) + 1;
  if (rec.lic) lic[rec.lic] = (lic[rec.lic] || 0) + 1;
}
const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('\nTop birds on page 1 (by # recordings):');
for (const [name, n] of top) console.log(`  ${String(n).padStart(3)}  ${name}`);
console.log('\nLicense spread on page 1:', JSON.stringify(lic));
