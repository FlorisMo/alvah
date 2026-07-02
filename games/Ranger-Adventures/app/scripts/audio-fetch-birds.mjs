// audio-fetch-birds.mjs — extra vogelzang for the world (W4.7b).
//
// Fetches a handful of clean-licensed EXTRA bird calls from xeno-canto v3 and
// stages them next to the existing cast so `loadGameAudio` registers them for
// the future "Ken je roep" slice (W6.4). SAFE-BY-DESIGN, because the shared
// `audio-fetch.mjs` would clobber the tracked manifest (its assets-gen manifest
// base is gone): this script
//   • reads the EXISTING tracked public/audio/manifest.json as its base,
//   • only ADDS the new bird ids (idempotent — skips any id already present),
//   • never removes or rewrites an existing entry.
//
// Licence policy (same as audio-fetch.mjs): exclude NoDerivatives (ND); NL
// recordings preferred; ShareAlike (SA) / NonCommercial (NC) allowed for this
// private, non-commercial game but LOGGED. Re-encodes each clip to a small mono
// AAC (.m4a) via macOS `afconvert` (like W4.7a — no ffmpeg on this machine) so
// the iPad download stays light. Reads XENO_CANTO_KEY from ../.env.local; the
// key VALUE is never printed (only presence + a masked prefix).
//
// Usage:  node scripts/audio-fetch-birds.mjs
//         node scripts/audio-fetch-birds.mjs --only=merel,koekoek
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const XENO = (env.match(/^XENO_CANTO_KEY=(.*)$/m)?.[1] || '').trim();
console.log(`XENO_CANTO_KEY present: ${!!XENO}${XENO ? ` (masked ${XENO.slice(0, 4)}…, ${XENO.length} chars)` : ''}`);
if (!XENO) { console.log('• no key → clean skip (no bird calls fetched)'); process.exit(0); }

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;

// id = bare bird name (matches the existing audio manifest convention: raaf,
// nachtzwaluw) so Sound.registerCall(id, …) lines up when W6.4 plays them.
const TARGETS = [
  { id: 'merel',         q: 'gen:Turdus sp:merula type:song' },
  { id: 'koekoek',       q: 'gen:Cuculus sp:canorus type:song' },
  { id: 'roodborst',     q: 'gen:Erithacus sp:rubecula type:song' },
  { id: 'gaai',          q: 'gen:Garrulus sp:glandarius type:call' },
  { id: 'groene-specht', q: 'gen:Picus sp:viridis type:call' },
  { id: 'winterkoning',  q: 'gen:Troglodytes sp:troglodytes type:song' },
];

const PUB = fileURLToPath(new URL('../public/audio/', import.meta.url));
const PUB_MANIFEST = PUB + 'manifest.json';
const manifest = JSON.parse(fs.readFileSync(PUB_MANIFEST, 'utf8')); // EXISTING tracked base

// fuller licence log (source page, recordist, quality, length) → assets-gen/audio/
const LOG_DIR = new URL('../assets-gen/audio/', import.meta.url);
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG = new URL('bird-license-log.json', LOG_DIR);
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};

const secs = (mmss) => { const p = String(mmss || '0:30').split(':').map(Number); return p.length === 2 ? p[0] * 60 + p[1] : p[0]; };
const tmp = os.tmpdir();

async function fetchXeno(t) {
  const q = (extra) => `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(t.q + extra)}&key=${XENO}&per_page=80`;
  let recs = (await (await fetch(q(' cnt:netherlands q:A')))?.json())?.recordings || [];
  if (!recs.length) recs = (await (await fetch(q(' cnt:netherlands'))).json()).recordings || [];
  if (!recs.length) recs = (await (await fetch(q(''))).json()).recordings || [];
  // exclude ND; prefer higher quality (A) then shorter clips (a focused, small call)
  const ok = recs
    .filter((r) => !/[-/]nd[-/]/i.test(r.lic || '') && r.file && secs(r.length) >= 2)
    .sort((a, b) => (a.q || 'E').localeCompare(b.q || 'E') || secs(a.length) - secs(b.length));
  const pick = ok[0];
  if (!pick) throw new Error('no ND-free recording found');
  return pick;
}

/** mp3 → mono AAC .m4a (small, iPad-friendly). Two-step via afconvert (W4.7a). */
function encodeSmall(srcMp3, destM4a) {
  const caf = `${tmp}/ra-bird-${Date.now()}.caf`;
  // decode to mono 32 kHz PCM, then AAC-LC @ 40 kbps (clear enough for a call, tiny)
  execFileSync('afconvert', ['-f', 'caff', '-d', 'LEI16@32000', '--mix', '-c', '1', srcMp3, caf]);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac@32000', '-b', '40000', caf, destM4a]);
  fs.rmSync(caf, { force: true });
}

let added = 0;
for (const t of TARGETS) {
  if (ONLY && !ONLY.has(t.id)) continue;
  if (manifest[t.id]) { console.log(`• skip (have): ${t.id}`); continue; }
  try {
    const pick = await fetchXeno(t);
    const lic = (pick.lic || '').replace(/^\/\//, 'https://');
    const srcMp3 = `${tmp}/ra-bird-${t.id}.mp3`;
    const r = await fetch(pick.file);
    if (!r.ok) throw new Error(`download ${r.status}`);
    fs.writeFileSync(srcMp3, Buffer.from(await r.arrayBuffer()));
    const file = `${t.id}.m4a`;
    encodeSmall(srcMp3, PUB + file);
    fs.rmSync(srcMp3, { force: true });
    const bytes = fs.statSync(PUB + file).size;
    const attribution = `${pick.en || pick.gen + ' ' + pick.sp} — ${pick.rec} / xeno-canto.org/${pick.id} (${lic})`;
    manifest[t.id] = { file, kind: 'call', license: lic, attribution };
    log[t.id] = { file, source: 'xeno-canto', species: `${pick.gen} ${pick.sp}`, en: pick.en, recordist: pick.rec, quality: pick.q, length: pick.length, license: lic, page: `https://xeno-canto.org/${pick.id}`, bytes, attribution };
    fs.writeFileSync(PUB_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
    console.log(`✓ ${t.id}  ${(bytes / 1024).toFixed(0)}kB  [${lic}]  ${attribution.slice(0, 64)}`);
    added++;
  } catch (e) {
    console.error(`✗ ${t.id}: ${e.message}`);
  }
}
console.log(`\nAdded ${added} bird call(s) → public/audio/ + manifest. Licence log: assets-gen/audio/bird-license-log.json`);
