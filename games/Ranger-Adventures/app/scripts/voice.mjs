#!/usr/bin/env node
// voice.mjs — record Benjamin saying every sentence the game reads aloud (2026-10-27).
//
//   npm run voice            a dry run: which sentences have no clip yet, and how many
//                            characters recording them costs (ElevenLabs bills per character)
//   npm run voice -- --go    record them: public/voice/<id>.mp3 + public/voice/manifest.json
//   … --match <regex>         only the sentences that match (a try-out, one mission's lines)
//
// The sentences come from two places: the whole reading corpus (core/readingcorpus.ts,
// every line the content holds, the ranger called Alvah) and scripts/voice-missed.txt,
// where the dev server notes every text the game said with no clip yet (vite.config.ts):
// lines put together while playing (a title, a count, an animal). So: play or run the
// e2e specs against the dev server, then run this.
//
// The voice is core/voice.ts#VOICE, never another. The key is ELEVENLABS_API_KEY in
// ../.env.local (git-ignored, never bundled, never printed). A clip is named after the
// voice, model, settings and words, so a changed voice records everything afresh.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { VOICE, voiceUnits } from '../src/core/voice.ts';
import { readingCorpus } from '../src/core/readingcorpus.ts';

const GO = process.argv.includes('--go');
const MATCH = process.argv.includes('--match') ? new RegExp(process.argv[process.argv.indexOf('--match') + 1], 'i') : null;
const OUT = new URL('../public/voice/', import.meta.url);
const MANIFEST = new URL('manifest.json', OUT);
const MISSED = new URL('./voice-missed.txt', import.meta.url);
const FORMAT = 'mp3_44100_64'; // 64 kbit/s CBR: a clip's length is its size
const AT_ONCE = 3;

const SIG = JSON.stringify([VOICE.id, VOICE.model, VOICE.settings]);
const fileFor = (unit) => crypto.createHash('sha1').update(SIG + '\n' + unit).digest('hex').slice(0, 16) + '.mp3';

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { voice: SIG, clips: {} };
if (manifest.voice !== SIG) {
  console.log('The voice, model or settings changed (core/voice.ts): every sentence is recorded afresh.');
  manifest.voice = SIG;
  manifest.clips = {};
}

// every sentence the game can say, as it is said
const units = new Set();
for (const e of readingCorpus()) if (!e.sample) for (const u of voiceUnits(e.text)) units.add(u);
const missedLines = fs.existsSync(MISSED) ? fs.readFileSync(MISSED, 'utf8').split('\n').filter((l) => l.trim()) : [];
for (const l of missedLines) for (const u of voiceUnits(l)) units.add(u);

const todo = [...units].filter((u) => !(manifest.clips[u] && fs.existsSync(new URL(manifest.clips[u].f, OUT))))
  .filter((u) => !MATCH || MATCH.test(u)).sort();
const chars = todo.reduce((n, u) => n + u.length, 0);
console.log(`${units.size} sentences in all, ${Object.keys(manifest.clips).length} recorded; ${todo.length} to record, ${chars} characters.`);

const env = fs.existsSync(new URL('../.env.local', import.meta.url)) ? fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8') : '';
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.*)$/m)?.[1] || process.env.ELEVENLABS_API_KEY || '').trim();

if (KEY) {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } });
    if (r.ok) {
      const s = await r.json();
      console.log(`ElevenLabs plan "${s.tier}": ${s.character_count} of ${s.character_limit} characters used this period.`);
    }
  } catch { /* the plan is only shown, never needed */ }
}

if (!GO) {
  for (const u of todo.slice(0, 15)) console.log('  ' + u);
  if (todo.length > 15) console.log(`  … and ${todo.length - 15} more`);
  console.log(todo.length ? 'Dry run. Record them with: npm run voice -- --go' : 'Nothing to record.');
  process.exit(0);
}
if (!KEY) { console.error('No ELEVENLABS_API_KEY in .env.local.'); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
const save = () => {
  const clips = Object.fromEntries(Object.keys(manifest.clips).sort().map((k) => [k, manifest.clips[k]]));
  fs.writeFileSync(MANIFEST, JSON.stringify({ voice: manifest.voice, clips }, null, 0).replace(/\},"/g, '},\n"') + '\n');
};

/** The bytes before the sound in an mp3: its ID3 tag and the silent Info frame after it.
 *  At 64 kbit/s CBR the rest is 8 bytes a millisecond. */
function headerBytes(mp3) {
  let at = mp3.subarray(0, 3).toString('latin1') === 'ID3'
    ? 10 + ((mp3[6] & 0x7f) << 21 | (mp3[7] & 0x7f) << 14 | (mp3[8] & 0x7f) << 7 | (mp3[9] & 0x7f)) : 0;
  if (/Info|Xing/.test(mp3.subarray(at, at + 48).toString('latin1'))) at += 208 + ((mp3[at + 2] >> 1) & 1);
  return at;
}

/** When each whitespace word of `unit` starts (ms), from the per-character alignment. */
function wordStarts(unit, al) {
  const starts = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(unit))) {
    const t = al?.character_start_times_seconds?.[m.index];
    starts.push(Math.round((typeof t === 'number' ? t : 0) * 1000));
  }
  return starts;
}

async function record(unit) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}/with-timestamps?output_format=${FORMAT}`;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: unit, model_id: VOICE.model, voice_settings: VOICE.settings }),
    });
    if (r.ok) {
      const j = await r.json();
      const mp3 = Buffer.from(j.audio_base64, 'base64');
      const f = fileFor(unit);
      fs.writeFileSync(new URL(f, OUT), mp3);
      const ms = Math.round(((mp3.length - headerBytes(mp3)) * 8) / 64);
      manifest.clips[unit] = { f, ms, w: wordStarts(unit, j.alignment) };
      return;
    }
    const why = (await r.text()).slice(0, 300);
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise((s) => setTimeout(s, 2000 * attempt)); continue; }
    throw new Error(`${r.status} ${why}`);
  }
}

let done = 0, failed = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  while (queue.length) {
    const u = queue.shift();
    try {
      await record(u);
      done++;
      if (done % 20 === 0) { save(); console.log(`  ${done}/${todo.length}`); }
    } catch (e) {
      failed++;
      console.error(`  failed: "${u}": ${e.message}`);
      if (/quota|401|403/.test(e.message)) queue.length = 0; // no credits or no access: stop
    }
  }
}));
save();

// what was missed and is now recorded leaves the list
const left = missedLines.filter((l) => voiceUnits(l).some((u) => !manifest.clips[u]));
if (fs.existsSync(MISSED)) fs.writeFileSync(MISSED, left.length ? left.join('\n') + '\n' : '');
console.log(`Recorded ${done}, failed ${failed}. ${Object.keys(manifest.clips).length} clips in public/voice/.`);
process.exit(failed ? 1 : 0);
