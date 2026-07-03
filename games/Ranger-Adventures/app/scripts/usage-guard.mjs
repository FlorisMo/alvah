#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// usage-guard.mjs — Run C pre-flight STOP/GO gate (VISION §12/§10, run-C delta 5).
//
// The Run C supervisor (run-c-loop.sh) calls this ONCE at the top of every
// iteration. It prints exactly one final line — `GO` (exit 0) or
// `STOP: <reason>` (exit non-zero) — and the supervisor breaks cleanly on STOP,
// writing a NEEDS-FLORIS status and pausing. Re-launching resumes.
//
// ── DESIGN (honest — Floris 2026-07-03): we do NOT predict Claude usage ──────
//   The WEEKLY Claude usage % is NOT programmatically measurable (the
//   anthropic-ratelimit-* headers are minute-level only; `claude usage` does not
//   exist; the Admin usage API needs an Admin key no personal Max plan has). So
//   Run C does NOT fake a "3% weekly" number. Instead it RUNS UNTIL IT ACTUALLY
//   HITS THE LIMIT, and the SUPERVISOR detects that break in each sitting's own
//   output and pauses gracefully ("accept it when it breaks"). That break-detect
//   lives in run-c-loop.sh, not here.
//
//   THIS guard therefore enforces only what is REAL:
//     (a) MESHY credit balance  →  *** REAL ***. Queried live from Meshy's
//         balance endpoint. Enforced as a STOP only for asset-generation boxes
//         (`--asset`) when below RUNC_MESHY_RESERVE, so a low balance never
//         blocks the credit-free art-direction / cohesion / reading work.
//         Layered on top of meshy-gen.mjs's own reactive 402 catch (defence in
//         depth). If the balance can't be read it degrades to GO (unknown) and
//         relies on the reactive 402 — it never hard-blocks on a network blip.
//     (b) SESSION WALL-CLOCK  →  *** REAL ***, optional. Elapsed since the
//         per-launch RUNC_LOOP_START_EPOCH vs RUNC_TIME_BUDGET_SEC (default 8h),
//         a "one overnight session" cap. Set 0 to disable and truly run until
//         the limit-break. Re-launch to continue a capped session.
//
// ── FAIL-SAFE POSTURE ────────────────────────────────────────────────────────
//   • Every STOP is a clean pause with a reason, never a hard crash.
//   • Any unexpected internal error → STOP (pause), not GO. The Meshy balance
//     read degrades to `null` (unknown → GO for asset, relying on the reactive
//     402) rather than throwing.
//   • NEVER prints the API key (only ever the masked 4-char prefix).
//
// Usage (from app/):
//   node scripts/usage-guard.mjs            # normal box: wall-clock check, else GO
//   node scripts/usage-guard.mjs --asset    # + enforce the Meshy reserve (STOP)
//   node scripts/usage-guard.mjs --status   # print status, always GO (read-only)
//
// Env knobs (all optional; safe defaults):
//   RUNC_TIME_BUDGET_SEC   default 28800  # per-launch wall-clock cap sec (0=off)
//   RUNC_LOOP_START_EPOCH  (supervisor exports `date +%s` at launch)
//   RUNC_MESHY_RESERVE     default 50     # keep >= this many Meshy credits
//   RUNC_GUARD_LOG         audit log (default runs/run-4-experience/RUN-C-USAGE-GUARD.log)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(fileURLToPath(new URL('..', import.meta.url)));   // .../app
const ROOT = path.resolve(APP, '..');                                     // .../Ranger-Adventures

const num = (name, dflt) => {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

const TIME_BUDGET_SEC = num('RUNC_TIME_BUDGET_SEC', 8 * 60 * 60);  // 0 disables
const MESHY_RESERVE = num('RUNC_MESHY_RESERVE', 50);
const AUDIT_LOG = process.env.RUNC_GUARD_LOG ||
  path.join(ROOT, 'runs', 'run-4-experience', 'RUN-C-USAGE-GUARD.log');

const IS_ASSET = process.argv.includes('--asset');
const IS_STATUS = process.argv.includes('--status');

const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

function auditLine(line) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
    fs.appendFileSync(AUDIT_LOG, `${nowIso()} · ${line}\n`);
  } catch { /* audit is best-effort */ }
}

// ── Meshy balance (REAL) — read the key from .env.local; NEVER print the key ──
function loadMeshyKey() {
  try {
    const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    return (env.match(/^MESHY_API_KEY=(.*)$/m)?.[1] || '').trim();
  } catch {
    return '';
  }
}
async function getMeshyBalance() {
  const key = loadMeshyKey();
  if (!key) return { balance: null, note: 'no MESHY_API_KEY in .env.local' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch('https://api.meshy.ai/openapi/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (!r.ok) return { balance: null, note: `balance HTTP ${r.status}` };
    const j = await r.json();
    const b = Number.isFinite(j?.balance) ? j.balance : null;
    return { balance: b, note: b === null ? 'balance field missing' : `key ${key.slice(0, 4)}…` };
  } catch (e) {
    return { balance: null, note: `balance read failed (${e.name || 'error'})` };
  } finally {
    clearTimeout(t);
  }
}

// ── decide ───────────────────────────────────────────────────────────────────
function finish(go, reason, statusParts) {
  const line = statusParts.join(' · ');
  auditLine(`${go ? 'GO ' : 'STOP'} — ${line}${reason ? ` — ${reason}` : ''}`);
  console.log(line);
  if (go) {
    console.log('GO');
    process.exit(0);
  } else {
    console.log(`STOP: ${reason}`);
    process.exit(3);
  }
}

async function main() {
  const startEpoch = num('RUNC_LOOP_START_EPOCH', 0);
  const elapsedSec = startEpoch > 0 ? Math.max(0, Math.round(Date.now() / 1000 - startEpoch)) : null;
  const timeOn = TIME_BUDGET_SEC > 0 && elapsedSec !== null;

  const parts = [];
  parts.push(timeOn ? `elapsed ${Math.round(elapsedSec / 60)}m/${Math.round(TIME_BUDGET_SEC / 60)}m` : 'wall-clock off');

  // Meshy balance is only fetched when it matters (asset box or explicit status).
  let meshy = { balance: null, note: 'not checked (non-asset box)' };
  if (IS_ASSET || IS_STATUS) meshy = await getMeshyBalance();
  parts.push(`meshy ${meshy.balance === null ? '?' : meshy.balance}${IS_ASSET ? ` (reserve ${MESHY_RESERVE})` : ''}`);

  if (IS_STATUS) {
    auditLine(`STATUS — ${parts.join(' · ')} — meshy note: ${meshy.note}`);
    console.log(parts.join(' · '));
    console.log('GO');
    process.exit(0);
  }

  // ── STOP checks (any one pauses the run) ──

  // 1) Session wall-clock backstop (real, optional). The weekly-limit stop is the
  //    supervisor's per-sitting break-detection, NOT a proxy here.
  if (timeOn && elapsedSec >= TIME_BUDGET_SEC) {
    return finish(false,
      `session wall-clock budget reached (${Math.round(elapsedSec / 60)}m ≥ ${Math.round(TIME_BUDGET_SEC / 60)}m) — clean stop; re-launch to continue`,
      parts);
  }

  // 2) Meshy reserve — only enforced as a STOP for asset-generation boxes.
  //    Unknown balance (null) → GO and rely on meshy-gen.mjs's reactive 402.
  if (IS_ASSET && meshy.balance !== null && meshy.balance < MESHY_RESERVE) {
    return finish(false,
      `Meshy balance ${meshy.balance} < reserve ${MESHY_RESERVE} — pausing new-asset work; top up credits or defer asset boxes`,
      parts);
  }

  // ── GO. (No sitting counting, no fake weekly proxy — the loop stops on a real
  //    usage-limit break in a sitting's own output.) ──
  return finish(true, '', parts);
}

main().catch((e) => {
  // Any unexpected error fails SAFE: pause, don't spend.
  console.log(`usage-guard internal error (${e && e.name ? e.name : 'error'})`);
  console.log('STOP: usage-guard internal error — pausing as a fail-safe (see RUN-C-USAGE-GUARD.log)');
  process.exit(3);
});
