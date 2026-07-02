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
// RUN_LEDGER env selects the active run's checklist (run 2+ use their own
// ledger file, e.g. WORLD-LEDGER.md via world-run-loop.sh); default = run 1.
const LEDGER = path.join(ROOT, process.env.RUN_LEDGER || 'RUN-LEDGER.md');
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
    `▤ ledger: ${path.basename(LEDGER)}\n` +
    `▷ progress: ~${s.pct}%${blocker ? `\n⚠ blocker: ${blocker}` : ''}`;
  return block;
}

function writeStatus(s, blocker) {
  const flag = blocker ? `\n\n> **NEEDS-FLORIS:** ${blocker}\n` : '';
  const body =
`# Ranger van de Veluwe — Run Status (live snapshot)

> Rewritten every step by \`scripts/ranger-run.mjs\`. The durable checklist is
> [${path.basename(LEDGER)}](${path.basename(LEDGER)}); this is the at-a-glance view.

- **Ledger:** ${path.basename(LEDGER)}
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

// NEEDS-FLORIS blockers persist in a side file (app/logs/, gitignored) so the
// next heartbeat/tick refresh does not silently erase them. Clear with
// `status --blocker=none`; an explicit --blocker="..." sets a new one.
const BLOCKFILE = path.join(LOGDIR, 'run-blocker.txt');
function loadBlocker() {
  try { const t = fs.readFileSync(BLOCKFILE, 'utf8').trim(); return t && t !== 'none' ? t : ''; }
  catch { return ''; }
}
function saveBlocker(b) {
  fs.mkdirSync(LOGDIR, { recursive: true });
  fs.writeFileSync(BLOCKFILE, b || 'none');
}

function refresh(note, blocker) {
  if (blocker !== undefined) saveBlocker(blocker === 'none' ? '' : blocker);
  const eff = (blocker !== undefined && blocker !== 'none' ? blocker : loadBlocker()) || undefined;
  const s = summary();
  writeStatus(s, eff);
  appendLog(s, note, eff);
  console.log(statusBlock(s, eff));
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
  // Push honestly: verify the exit code (run 1 reported "pushed" even when the
  // remote rejected). -u origin HEAD works on main and on the run-2 branch.
  let p = await runJob('git', ['push', '-u', 'origin', 'HEAD'], { label: 'git-push', logFile: 'git-push.log' });
  if (p.code !== 0) {
    console.log('• push rejected — trying git pull --rebase + one retry…');
    await runJob('git', ['pull', '--rebase'], { label: 'git-pull-rebase', logFile: 'git-push.log' });
    p = await runJob('git', ['push', '-u', 'origin', 'HEAD'], { label: 'git-push-retry', logFile: 'git-push.log' });
  }
  if (p.code !== 0) {
    refresh('push failed', 'git push failed twice — resolve divergence/auth, then push manually (app/logs/git-push.log).');
    console.error('✗ committed but PUSH FAILED (see app/logs/git-push.log).');
    process.exit(1);
  }
  console.log('✓ committed + pushed.');
}

// ──────────────────────────────────────────────────────────────────────────
// tick — mark a ledger box done
// ──────────────────────────────────────────────────────────────────────────
async function tick(needle) {
  if (!needle) { console.error('tick needs a substring of the step text'); process.exit(1); }
  const { lines } = parseLedger();
  const low = needle.toLowerCase();
  const idx = lines.findIndex((l) => /^\s*-\s*\[ \]/.test(l) && l.toLowerCase().includes(low));
  if (idx === -1) { console.error(`✗ no unchecked step matching "${needle}"`); process.exit(1); }
  // Run-2 hardening (WORLD-PLAN §3.1): ticking is gated MECHANICALLY, not on
  // the honor system — build must be green, and once the e2e harness exists
  // (post-W0.1) e2e:smoke must be green too. --force is reserved for the
  // graceful-degrade boxes the plan names (W0.7 / W3.0 / W3.5).
  if (!process.argv.includes('--force')) {
    const okBuild = await gate();
    if (!okBuild) { console.error('✗ tick refused — build gate RED.'); process.exit(1); }
    const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
    if (pkg.scripts?.['e2e:smoke'] && fs.existsSync(path.join(APP, 'e2e'))) {
      console.log('▶ gate: npm run e2e:smoke');
      const t = await runJob('npm', ['run', 'e2e:smoke'], { label: 'e2e-smoke', logFile: 'e2e-smoke.log' });
      if (t.code !== 0) { console.error('✗ tick refused — e2e:smoke RED (see app/logs/e2e-smoke.log).'); process.exit(1); }
      console.log('✓ e2e:smoke green.');
    }
  }
  lines[idx] = lines[idx].replace(/\[ \]/, '[x]');
  fs.writeFileSync(LEDGER, lines.join('\n'));
  console.log(`✓ ticked: ${clean(lines[idx])}`);
  refresh(`ticked: ${clean(lines[idx])}`);
}

// ──────────────────────────────────────────────────────────────────────────
// run — the heartbeat loop (`npm run finish`)
// ──────────────────────────────────────────────────────────────────────────
async function run() {
  // Run-2 guard: `run`/`npm run finish` is the RUN-1 heartbeat (it never
  // returns and fires the unfiltered asset pipeline). Run 2 is driven by
  // world-run-loop.sh + status|tick|gate|commit only.
  if (process.env.RUN_LEDGER && process.env.RUN_LEDGER !== 'RUN-LEDGER.md') {
    console.error(`✗ 'run' is a run-1 command; ${process.env.RUN_LEDGER} is driven by world-run-loop.sh.`);
    console.error('  Use: status | tick "<needle>" | gate | commit "<msg>".');
    process.exit(1);
  }
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
  console.log(`AGENT: resume here → first unchecked box in ${path.basename(LEDGER)}:`);
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
  case 'status': refresh('status', arg('blocker')); break;
  case 'tick': await tick(rest.join(' ')); break;
  case 'assets': await runAssets({ limit: arg('limit') ? parseInt(arg('limit'), 10) : undefined }); refresh('assets pass'); break;
  case 'gate': { const ok = await gate(arg('test')); process.exit(ok ? 0 : 1); }
  case 'commit': await commit(rest.join(' ')); break;
  case 'run': await run(); break;
  default: console.error(`unknown command: ${cmd}`); process.exit(1);
}
