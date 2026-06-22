// ranger-run.mjs — the autonomous "finish the game" run orchestrator (BUILD-PLAN §9).
//
// One command drives the multi-day run: `npm --prefix app run finish`.
// This script is the PLUMBING around the run, not the creative coder — the
// TypeScript game work (engines, 3D variants, meta systems) is done by the
// Claude agent working down RUN-LEDGER.md. What this owns end-to-end:
//   • the three living files at games/Ranger-Adventures/:
//       RUN-LEDGER.md  — the checklist (source of truth for what's next)
//       RUN-STATUS.md  — live snapshot (phase · ~% · landed · next · heartbeat · blocker)
//       RUN-LOG.md     — append-only status blocks, one per run/step
//   • the autonomous ASSET pipeline (Meshy gen → optimize → audio) with a
//     ~10-min retry-on-credit/transient loop and concurrency capped at 3 (§9b/§9c)
//   • the build/test gate (§9e) and the per-phase commit+push cadence (§9a)
//
// Subcommands (argv[2], default `run`):
//   status                 refresh RUN-STATUS.md + print the status block   (SAFE, read-only to code)
//   tick "<needle>"        mark the first unchecked [ ] containing <needle> as [x], refresh status
//   assets [--limit=N]     run gen→opt→audio with retry + concurrency cap (autonomous)
//   gate [--test=<cmd>]    `npm run build` (+ optional targeted test); green/red
//   commit "<msg>"         git add/commit/push the tracked run files + code (per-phase cadence)
//   run                    the heartbeat loop: status → assets → gate → handoff banner (what `finish` calls)
//
// Idempotent: re-running resumes from the ledger; finished assets are skipped by
// the underlying scripts' own manifests. Never commits .env.local or assets-gen/.

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(fileURLToPath(new URL('..', import.meta.url)));      // .../app
const ROOT = path.resolve(APP, '..');                                         // .../Ranger-Adventures
const LEDGER = path.join(ROOT, 'RUN-LEDGER.md');
const STATUS = path.join(ROOT, 'RUN-STATUS.md');
const LOG = path.join(ROOT, 'RUN-LOG.md');
const LOGDIR = path.join(APP, 'logs');                                        // git-ignored per-job logs

const RETRY_MS = 10 * 60 * 1000;   // §9c — retry every ~10 min on credit-out / transient error
const RETRY_CEIL_MS = 24 * 60 * 60 * 1000; // §9c — pause with NEEDS-FLORIS after ~24h
const HEARTBEAT_MS = 5 * 60 * 1000; // run-loop idle heartbeat
const MAX_CONCURRENCY = 3;          // §9b

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────────────────────────
// Ledger parsing → progress, current phase, what-landed, what's-next
// ──────────────────────────────────────────────────────────────────────────
function parseLedger() {
  const text = fs.readFileSync(LEDGER, 'utf8');
  const lines = text.split('\n');
  const items = [];
  let phase = '(intro)';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) { phase = h[1].replace(/\s*[✅◑].*$/, '').trim(); continue; }
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s*(.*)$/);
    if (!m) continue;
    const done = m[1].toLowerCase() === 'x';
    const body = m[2].trim();
    const weight = parseInt(body.match(/\((\d+)\)\s*$/)?.[1] ?? '1', 10);
    items.push({ phase, done, body, weight, lineNo: i });
  }
  return { text, lines, items };
}

function summary() {
  const { items } = parseLedger();
  const total = items.reduce((s, it) => s + it.weight, 0);
  const doneW = items.filter((it) => it.done).reduce((s, it) => s + it.weight, 0);
  const pct = total ? Math.round((doneW / total) * 100) : 0;
  const firstOpen = items.find((it) => !it.done) || null;
  const phase = firstOpen ? firstOpen.phase : (items.at(-1)?.phase ?? 'done');
  // "landed" = the last checked item at or before the first open one
  const idx = firstOpen ? items.indexOf(firstOpen) : items.length;
  const landed = [...items.slice(0, idx)].reverse().find((it) => it.done) || items.filter(it => it.done).at(-1);
  return { items, pct, phase, next: firstOpen, landed };
}

function clean(s) { return (s || '').replace(/\s*\((\d+)\)\s*$/, '').replace(/\*\*/g, '').trim(); }

// ──────────────────────────────────────────────────────────────────────────
// Status block + the three living files
// ──────────────────────────────────────────────────────────────────────────
function statusBlock(s, blocker) {
  const landed = s.landed ? clean(s.landed.body) : '—';
  const next = s.next ? clean(s.next.body) : 'ALL DONE 🎉';
  const block =
    `✔ landed: ${landed}\n` +
    `▶ phase:  ${s.phase}\n` +
    `→ next:   ${next}\n` +
    `▷ progress: ~${s.pct}%${blocker ? `\n⚠ blocker: ${blocker}` : ''}`;
  return block;
}

function writeStatus(s, blocker) {
  const flag = blocker ? `\n\n> **NEEDS-FLORIS:** ${blocker}\n` : '';
  const body =
`# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by \`scripts/ranger-run.mjs\`. The durable checklist is
> [RUN-LEDGER.md](RUN-LEDGER.md); this is the at-a-glance view.

- **Phase:** ${s.phase}
- **Progress:** ~${s.pct}% (weighted by ledger items)
- **Just landed:** ${s.landed ? clean(s.landed.body) : '—'}
- **Next up:** ${s.next ? clean(s.next.body) : 'ALL DONE 🎉'}
- **Last heartbeat:** ${now()}
- **Blocker:** ${blocker || 'none'}
${flag}
\`\`\`
${statusBlock(s, blocker)}
\`\`\`
`;
  fs.writeFileSync(STATUS, body);
}

function appendLog(s, note, blocker) {
  const header = fs.existsSync(LOG) ? '' :
    `# Ranger van de Veluwe — Run Log (append-only)\n\nOne status block per run/step (BUILD-PLAN §9b).\n`;
  const entry = `\n---\n**${now()}**${note ? ` · ${note}` : ''}\n\n\`\`\`\n${statusBlock(s, blocker)}\n\`\`\`\n`;
  fs.appendFileSync(LOG, header + entry);
}

function refresh(note, blocker) {
  const s = summary();
  writeStatus(s, blocker);
  appendLog(s, note, blocker);
  console.log(statusBlock(s, blocker));
  return s;
}

// ──────────────────────────────────────────────────────────────────────────
// Subprocess helpers (capped concurrency + per-job log + retry)
// ──────────────────────────────────────────────────────────────────────────
function runJob(cmd, args, { label, logFile } = {}) {
  return new Promise((resolve) => {
    fs.mkdirSync(LOGDIR, { recursive: true });
    const out = logFile ? fs.openSync(path.join(LOGDIR, logFile), 'a') : 'inherit';
    const child = spawn(cmd, args, { cwd: APP, stdio: ['ignore', out, out] });
    child.on('close', (code) => {
      if (out !== 'inherit') fs.closeSync(out);
      resolve({ code, label: label || args.join(' ') });
    });
  });
}

// Run `thunks` (functions returning promises) with at most MAX_CONCURRENCY in flight.
async function pool(thunks) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, thunks.length) }, async () => {
    while (i < thunks.length) { const my = i++; results[my] = await thunks[my](); }
  });
  await Promise.all(workers);
  return results;
}

// Retry a job whose log signals OUT_OF_CREDITS / transient error, every ~10 min,
// up to ~24h, then flag NEEDS-FLORIS. `isBlocked(log)` inspects the tail.
async function withRetry(fn, label, isBlocked) {
  const start = Date.now();
  for (;;) {
    const res = await fn();
    const tail = res.logTail || '';
    if (res.code === 0 || !isBlocked(tail)) return res;
    if (Date.now() - start > RETRY_CEIL_MS) {
      const s = summary();
      writeStatus(s, `${label} blocked >24h (credits/API). Top up or check keys, then re-run \`npm --prefix app run finish\`.`);
      appendLog(s, `${label} paused — NEEDS-FLORIS`, 'credit/API ceiling');
      console.error(`\n⚠ ${label}: blocked >24h — paused with NEEDS-FLORIS. See RUN-STATUS.md.`);
      process.exit(2);
    }
    const s = summary();
    writeStatus(s, `${label}: credits/API unavailable — retrying every ~10 min (since ${now()}).`);
    console.log(`  …${label} blocked — retry in ~10 min (${now()})`);
    await sleep(RETRY_MS);
  }
}

function tailOf(logFile, n = 4000) {
  try { return fs.readFileSync(path.join(LOGDIR, logFile), 'utf8').slice(-n); }
  catch { return ''; }
}
const looksBlocked = (t) =>
  /OUT_OF_CREDITS|402|429|ECONNRESET|ETIMEDOUT|ENOTFOUND|out of credits|rate.?limit|5\d\d\b/i.test(t);

// ──────────────────────────────────────────────────────────────────────────
// Autonomous asset pipeline: gen → opt → audio, with retry on credit-out
// ──────────────────────────────────────────────────────────────────────────
async function runAssets({ limit }) {
  console.log('▶ assets: Meshy gen → gltf-optimize → audio-fetch (retry-on-credit, cap 3)');
  const genArgs = ['scripts/meshy-gen.mjs', ...(limit ? [`--limit=${limit}`] : [])];
  await withRetry(
    async () => { const r = await runJob('node', genArgs, { label: 'gen', logFile: 'gen.log' }); return { ...r, logTail: tailOf('gen.log') }; },
    'asset-gen',
    looksBlocked,
  );
  // opt + audio can run together (cap 3 leaves room); neither burns Meshy credits.
  await pool([
    () => runJob('node', ['scripts/gltf-optimize.mjs'], { label: 'opt', logFile: 'opt.log' }),
    () => runJob('node', ['scripts/audio-fetch.mjs'], { label: 'audio', logFile: 'audio.log' }),
  ]);
  console.log('✓ assets: gen+opt+audio pass complete (see app/logs/).');
}

// ──────────────────────────────────────────────────────────────────────────
// Build/test gate + commit
// ──────────────────────────────────────────────────────────────────────────
async function gate(testCmd) {
  console.log('▶ gate: npm run build');
  const b = await runJob('npm', ['run', 'build'], { label: 'build' });
  if (b.code !== 0) { console.error('✗ build RED — fix before advancing (§9e).'); return false; }
  if (testCmd) {
    console.log(`▶ gate: ${testCmd}`);
    const t = await runJob('sh', ['-c', testCmd], { label: 'test' });
    if (t.code !== 0) { console.error('✗ targeted test RED.'); return false; }
  }
  console.log('✓ gate green.');
  return true;
}

async function commit(msg) {
  if (!msg) { console.error('commit needs a message'); process.exit(1); }
  // Stage tracked run files + source; .gitignore keeps .env.local + assets-gen out.
  await runJob('git', ['add', '-A'], { label: 'git-add' });
  const c = await runJob('git', ['commit', '-m', msg], { label: 'git-commit' });
  if (c.code !== 0) { console.log('• nothing to commit.'); return; }
  await runJob('git', ['push'], { label: 'git-push' });
  console.log('✓ committed + pushed.');
}

// ──────────────────────────────────────────────────────────────────────────
// tick — mark a ledger box done
// ──────────────────────────────────────────────────────────────────────────
function tick(needle) {
  if (!needle) { console.error('tick needs a substring of the step text'); process.exit(1); }
  const { lines } = parseLedger();
  const low = needle.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s*\[ \]/.test(lines[i]) && lines[i].toLowerCase().includes(low)) {
      lines[i] = lines[i].replace(/\[ \]/, '[x]');
      fs.writeFileSync(LEDGER, lines.join('\n'));
      console.log(`✓ ticked: ${clean(lines[i])}`);
      refresh(`ticked: ${clean(lines[i])}`);
      return;
    }
  }
  console.error(`✗ no unchecked step matching "${needle}"`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// run — the heartbeat loop (`npm run finish`)
// ──────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Ranger van de Veluwe — autonomous finish run            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  const s = refresh('run start');
  if (!s.next) { console.log('\n🎉 Ledger fully checked — nothing left to run.'); return; }

  // 1) Autonomous asset work first (it can run unattended with retry).
  await runAssets({});
  // 2) Keep the build honest.
  await gate();
  // 3) Hand off the next code-step to the agent and heartbeat.
  refresh('asset+gate pass done');
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('AGENT: resume here → first unchecked box in RUN-LEDGER.md:');
  console.log(`   ${clean(s.next.body)}   [phase: ${s.phase}]`);
  console.log('Build the step, `node scripts/ranger-run.mjs tick "<needle>"`,');
  console.log('then commit+push at each phase boundary. Heartbeat continues.');
  console.log('────────────────────────────────────────────────────────────');
  // Idle heartbeat so a long unattended session keeps RUN-STATUS.md fresh.
  for (;;) { await sleep(HEARTBEAT_MS); refresh('heartbeat'); }
}

// ──────────────────────────────────────────────────────────────────────────
// dispatch
// ──────────────────────────────────────────────────────────────────────────
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const cmd = process.argv[2] || 'run';
const rest = process.argv.slice(3).filter((a) => !a.startsWith('--'));

switch (cmd) {
  case 'status': refresh('status'); break;
  case 'tick': tick(rest.join(' ')); break;
  case 'assets': await runAssets({ limit: arg('limit') ? parseInt(arg('limit'), 10) : undefined }); refresh('assets pass'); break;
  case 'gate': { const ok = await gate(arg('test')); process.exit(ok ? 0 : 1); }
  case 'commit': await commit(rest.join(' ')); break;
  case 'run': await run(); break;
  default: console.error(`unknown command: ${cmd}`); process.exit(1);
}
