// contact-sheet.mjs — build the RUN-3 audit contact sheet from the capture pass.
//
// Reads every annotations-<platform>.json the capture spec wrote and emits a
// single self-contained index.html: laptop and iPad side by side, grouped by
// scene, each shot with its live state (screen · pos · cameraYaw · drawCalls ·
// missionView · clip) printed under it. Walk/drive bursts get a per-frame delta
// so gliding is readable at a glance. No image libraries, no deps — the HTML
// references the PNGs on disk; open it in a browser (or hand the PNGs to Fable).
//
// Usage:  node e2e-capture/contact-sheet.mjs
// (run from app/; evidence dir is ../runs/run-3-ux-polish/audit-evidence)

import fs from 'node:fs';
import path from 'node:path';

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

const files = fs.existsSync(EVID)
  ? fs.readdirSync(EVID).filter((f) => /^annotations-.*\.json$/.test(f))
  : [];
if (!files.length) {
  console.error(`✗ no annotations-*.json in ${EVID}. Run \`npm run capture\` first.`);
  process.exit(1);
}

const runs = files.map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), 'utf8')));
const platforms = runs.map((r) => r.platform);
const version = runs.find((r) => r.version)?.version ?? '(unknown)';

// group order follows the capture flow; anything else lands after.
const ORDER = ['Boot', 'Wereld', 'Lopen (burst)', 'Besturing', 'Laptop-camera', 'Missiebord', 'Missie', 'Pauze/menu', 'Jeep', 'Jeep (burst)', 'Reduce-Motion', 'GAP'];
const groups = [...new Set(runs.flatMap((r) => r.shots.map((s) => s.group)))]
  .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 1) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(d) : v));
const posStr = (p) => (p ? `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})` : '—');

function stateLine(s) {
  const bits = [
    `screen: <b>${esc(s.screen ?? '—')}</b>`,
    `pos: ${esc(posStr(s.pos))}`,
    `camYaw: ${esc(num(s.cameraYaw, 2))}`,
    `draws: ${esc(num(s.drawCalls, 0))}`,
    s.missionView ? `view: <b>${esc(s.missionView)}</b>` : null,
    s.clip ? `clip: <b>${esc(s.clip.name)}</b>@${esc(num(s.clip.time, 2))}` : `clip: <b>null</b>`,
    s.veh ? `heading: <b>${esc(num(s.veh.heading, 3))}</b> · speed: ${esc(num(s.veh.speed, 1))}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

// per-burst delta: pos travelled between consecutive frames + whether clip drives.
function burstDeltas(shots) {
  const out = new Map();
  for (const g of ['Lopen (burst)', 'Jeep (burst)']) {
    const frames = shots.filter((s) => s.group === g && s.pos);
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1].pos, b = frames[i].pos;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (g === 'Jeep (burst)') {
        // steering signal: heading change while a turn key is held. Near-zero
        // Δheading across the burst → the jeep does not steer (#3).
        const h0 = frames[i - 1].veh?.heading, h1 = frames[i].veh?.heading;
        const dh = (h0 != null && h1 != null)
          ? Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)))
          : null;
        out.set(frames[i].file, `Δpos ${d.toFixed(2)} m · Δheading ${dh == null ? '—' : dh < 0.05 ? `<b style="color:#c0392b">${dh.toFixed(3)} (stuurt niet?)</b>` : `${dh.toFixed(3)} rad`}`);
      } else {
        const clip = frames[i].clip;
        out.set(frames[i].file, `Δpos ${d.toFixed(2)} m · clip ${clip ? `${esc(clip.name)} advancing` : '<b style="color:#c0392b">null (glijdt?)</b>'}`);
      }
    }
  }
  return out;
}

function card(s, deltas) {
  const glideNote = deltas.get(s.file);
  return `
    <figure class="shot ${s.ok ? '' : 'gap'}">
      ${s.file ? `<a href="${esc(s.file)}" target="_blank"><img loading="lazy" src="${esc(s.file)}" alt="${esc(s.name)}"></a>` : `<div class="noshot">— geen frame —</div>`}
      <figcaption>
        <div class="cap-name">${esc(s.name)}</div>
        <div class="cap-note">${esc(s.note)}</div>
        <div class="cap-state">${stateLine(s)}</div>
        ${glideNote ? `<div class="cap-delta">${glideNote}</div>` : ''}
      </figcaption>
    </figure>`;
}

let body = '';
for (const g of groups) {
  body += `<h2>${esc(g)}</h2>`;
  for (const run of runs) {
    const deltas = burstDeltas(run.shots);
    const shots = run.shots.filter((s) => s.group === g);
    if (!shots.length) continue;
    body += `<div class="platform-row"><div class="plabel">${esc(run.platform)}</div><div class="strip">${shots.map((s) => card(s, deltas)).join('')}</div></div>`;
  }
}

const html = `<!doctype html><meta charset="utf-8"><title>Ranger — Run 3 audit contact sheet</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 0; background: #f6f5f2; color: #23201b; }
  header { padding: 20px 24px; background: #2f3a2e; color: #f6f5f2; position: sticky; top: 0; z-index: 2; }
  header h1 { margin: 0 0 4px; font-size: 18px; }
  header p { margin: 0; opacity: .8; font-size: 13px; }
  main { padding: 8px 24px 60px; }
  h2 { margin: 28px 0 6px; font-size: 15px; border-bottom: 2px solid #c9a24b; padding-bottom: 4px; }
  .platform-row { display: flex; align-items: flex-start; gap: 12px; margin: 8px 0; }
  .plabel { flex: 0 0 52px; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .05em; color: #6b6459; padding-top: 8px; }
  .strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; flex: 1; }
  .shot { margin: 0; flex: 0 0 300px; background: #fff; border: 1px solid #e2ded6; border-radius: 8px; overflow: hidden; }
  .shot.gap { border-color: #c0392b; background: #fdeeec; }
  .shot img { width: 300px; height: auto; display: block; background: #ddd; }
  .noshot { width: 300px; height: 120px; display: grid; place-items: center; color: #c0392b; font-style: italic; }
  figcaption { padding: 8px 10px; }
  .cap-name { font-weight: 700; font-size: 13px; }
  .cap-note { color: #4a463d; margin: 2px 0 4px; font-size: 12.5px; }
  .cap-state { font-family: ui-monospace, monospace; font-size: 11px; color: #6b6459; }
  .cap-delta { font-family: ui-monospace, monospace; font-size: 11px; margin-top: 3px; padding: 2px 5px; background: #f0ecdf; border-radius: 4px; }
</style>
<header>
  <h1>Ranger van de Veluwe — Run 3 audit contact sheet</h1>
  <p>Bundle ${esc(version)} · platforms: ${esc(platforms.join(' + '))} · iPad-kader draait op de Chromium-engine (lokale WebKit valt om, §10) → echte Safari-look = Floris op het toestel.</p>
</header>
<main>${body}</main>`;

const outFile = path.join(EVID, 'index.html');
fs.writeFileSync(outFile, html);
const total = runs.reduce((n, r) => n + r.shots.length, 0);
console.log(`✓ contact sheet: ${outFile}`);
console.log(`  ${total} shots across ${platforms.join(' + ')} · open it in a browser or point the judge at the PNGs.`);
