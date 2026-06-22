// audio-fetch.mjs — clean-licensed animal calls + ambience for the game.
//   • BIRDS  → xeno-canto v3 (raaf, nachtzwaluw, …). Excludes NoDerivatives (ND);
//              prefers CC0/BY/BY-NC; ShareAlike (SA) is allowed for this private,
//              non-commercial game but LOGGED. Picks a short, high-quality clip.
//   • MAMMALS + AMBIENCE → Freesound (edelhert/ree/zwijn/das/eekhoorn + forest).
//              Uses the API token to fetch the CC preview-hq-mp3 (full-res needs
//              OAuth2; previews are plenty for a game). Prefers CC0.
// Every clip's licence + attribution is written to ../assets-gen/audio/manifest.json
// so credits are auditable. Reads XENO_CANTO_KEY + FREESOUND_API_KEY from
// ../.env.local. Downloads to ../assets-gen/audio/. Idempotent: skips done ids.
//
// Usage:  node scripts/audio-fetch.mjs            (all)
//         node scripts/audio-fetch.mjs --only=raaf,edelhert
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || '').trim();
const XENO = read('XENO_CANTO_KEY');
const FREE = read('FREESOUND_API_KEY');

const OUT = new URL('../assets-gen/audio/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = new URL('manifest.json', OUT);
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;

// id = game animal id (matches content/veluwe.ts) so Sound.registerCall(id,…) lines up.
const TARGETS = [
  // birds → xeno-canto (binomial query is most precise)
  { id: 'raaf',        source: 'xeno', q: 'gen:Corvus sp:corax type:call' },
  { id: 'nachtzwaluw', source: 'xeno', q: 'gen:Caprimulgus sp:europaeus type:song' },
  // mammals → freesound (free-text; CC-filtered)
  { id: 'edelhert',    source: 'free', q: 'deer bellow' },
  { id: 'ree',         source: 'free', q: 'deer bark' },
  { id: 'wildzwijn',   source: 'free', q: 'wild boar grunt' },
  { id: 'das',         source: 'free', q: 'badger growl snuffle' },
  { id: 'eekhoorn',    source: 'free', q: 'squirrel' },
  // ambience → freesound (looping bed for the world)
  { id: 'ambient-bos',   source: 'free', q: 'forest birds ambience morning', kind: 'ambient' },
  { id: 'ambient-heide', source: 'free', q: 'heath moor wind ambience', kind: 'ambient' },
];

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return fs.statSync(dest).size;
}

// ---- xeno-canto (birds) ----
async function fetchXeno(t) {
  const url = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(t.q + ' cnt:netherlands')}&key=${XENO}&per_page=80`;
  let recs = (await (await fetch(url)).json()).recordings || [];
  if (!recs.length) {
    // widen: drop the country filter
    const url2 = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(t.q)}&key=${XENO}&per_page=80`;
    recs = (await (await fetch(url2)).json()).recordings || [];
  }
  // exclude NoDerivatives; prefer higher quality (A best) + shorter clips
  const ok = recs
    .filter((r) => !/[-/]nd[-/]/i.test(r.lic || '') && r.file)
    .sort((a, b) => (a.q || 'E').localeCompare(b.q || 'E') || secs(a.length) - secs(b.length));
  const pick = ok[0];
  if (!pick) throw new Error('no ND-free recording found');
  const bytes = await download(pick.file, new URL(`${t.id}.mp3`, OUT));
  const lic = (pick.lic || '').replace(/^\/\//, 'https://').replace(/^https?:https?:/, 'https:');
  return {
    kind: t.kind || 'call', source: 'xeno-canto', file: `${t.id}.mp3`, bytes,
    species: `${pick.gen} ${pick.sp}`, en: pick.en, recordist: pick.rec,
    license: lic, quality: pick.q, length: pick.length,
    page: `https://xeno-canto.org/${pick.id}`,
    attribution: `${pick.en || pick.gen + ' ' + pick.sp} — ${pick.rec} / xeno-canto.org/${pick.id} (${lic})`,
  };
}
const secs = (mmss) => { const p = String(mmss || '0:30').split(':').map(Number); return p.length === 2 ? p[0] * 60 + p[1] : p[0]; };

// ---- freesound (mammals + ambience), preview-quality via API token ----
async function fetchFree(t) {
  const filter = 'license:("Creative Commons 0" OR "Attribution" OR "Attribution Noncommercial")';
  const fields = 'id,name,username,license,previews,url,duration';
  const sort = t.kind === 'ambient' ? 'rating_desc' : 'score';
  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(t.q)}&filter=${encodeURIComponent(filter)}&fields=${fields}&sort=${sort}&page_size=20&token=${FREE}`;
  const j = await (await fetch(url)).json();
  const results = j.results || [];
  // prefer CC0; for calls prefer short clips
  const ranked = results.sort((a, b) => {
    const cc0 = (x) => (/Creative Commons 0/i.test(x.license) ? 0 : 1);
    if (cc0(a) !== cc0(b)) return cc0(a) - cc0(b);
    if (t.kind !== 'ambient') return (a.duration || 99) - (b.duration || 99);
    return 0;
  });
  const pick = ranked[0];
  if (!pick) throw new Error('no CC result found');
  const prev = pick.previews?.['preview-hq-mp3'] || pick.previews?.['preview-lq-mp3'];
  if (!prev) throw new Error('no preview url');
  const bytes = await download(prev, new URL(`${t.id}.mp3`, OUT));
  return {
    kind: t.kind || 'call', source: 'freesound', file: `${t.id}.mp3`, bytes,
    soundName: pick.name, author: pick.username, license: pick.license,
    duration: pick.duration, page: pick.url,
    attribution: `"${pick.name}" by ${pick.username} — freesound.org (${pick.license})`,
  };
}

let done = 0;
for (const t of TARGETS) {
  if (ONLY && !ONLY.has(t.id)) continue;
  if (manifest[t.id]?.file && fs.existsSync(new URL(manifest[t.id].file, OUT))) { console.log(`• skip (have): ${t.id}`); continue; }
  if (t.source === 'xeno' && !XENO) { console.log(`• skip ${t.id}: no XENO_CANTO_KEY`); continue; }
  if (t.source === 'free' && !FREE) { console.log(`• skip ${t.id}: no FREESOUND_API_KEY`); continue; }
  try {
    const rec = t.source === 'xeno' ? await fetchXeno(t) : await fetchFree(t);
    manifest[t.id] = rec;
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`✓ ${t.id}  ${(rec.bytes / 1024).toFixed(0)}kB  [${rec.license}]  ${rec.attribution.slice(0, 70)}`);
    done++;
  } catch (e) {
    console.error(`✗ ${t.id}: ${e.message}`);
  }
}
// Stage clips + a slim manifest into public/audio/ so the running game can
// fetch('/audio/<id>.mp3'). public/audio is git-ignored (regenerable binaries).
const PUB = new URL('../public/audio/', import.meta.url);
fs.mkdirSync(PUB, { recursive: true });
const slim = {};
for (const [id, rec] of Object.entries(manifest)) {
  const srcFile = new URL(rec.file, OUT);
  if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, new URL(rec.file, PUB));
  slim[id] = { file: rec.file, kind: rec.kind, license: rec.license, attribution: rec.attribution };
}
fs.writeFileSync(new URL('manifest.json', PUB), JSON.stringify(slim, null, 2));

console.log(`\nFetched ${done} clip(s). Licence log: app/assets-gen/audio/manifest.json`);
console.log(`Staged ${Object.keys(slim).length} clip(s) → app/public/audio/ (served at /audio/).`);
