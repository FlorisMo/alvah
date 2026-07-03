#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// usage-guard.mjs — Run C pre-flight STOP/GO gate (VISION §12/§10, run-C delta 5).
//
// The Run C supervisor (run-c-loop.sh) calls this ONCE at the top of every
// iteration. It prints exactly one final line — `GO` (exit 0) or
// `STOP: <reason>` (exit non-zero) — and the supervisor breaks cleanly on STOP,
// writing a NEEDS-FLORIS status and pausing. Re-launching resumes.
//
// ── WHAT IS REAL vs WHAT IS A PROXY (be honest — this matters) ───────────────
//   (a) WEEKLY Claude usage %  →  *** NOT programmatically measurable ***.
//       After authoritative research there is NO public mechanism: the
//       anthropic-ratelimit-* headers are MINUTE-level only, `claude usage`
//       does not exist (GH #44328 still open), and the Admin usage API needs an
//       Admin key no personal Max subscription has. `claude -p` gives this
//       script no token count at all. So the weekly gate here is a HONEST
//       PROXY, never ground truth. It combines three fail-safe layers:
//         1. LIVE SIGNAL (real, reactive): scan the tail of the loop log for a
//            Claude usage/rate-limit phrase; if the last sitting hit the wall,
//            STOP now and let the weekly window reset before resuming.
//         2. SITTINGS BUDGET (proxy): a cumulative count of sittings inside a
//            rolling ~7-day window, persisted across relaunches. STOP when the
//            remaining fraction drops to RUNC_WEEKLY_STOP_PCT (default 3%).
//            This is the "stop at ~3% weekly remaining" intent, approximated —
//            it leaves margin so a good run never hard-blocks mid-sitting.
//         3. SESSION WALL-CLOCK (backstop): elapsed vs RUNC_TIME_BUDGET_SEC
//            (default 8h), measured from the per-launch RUNC_LOOP_START_EPOCH
//            the supervisor exports.
//   (b) MESHY credit balance  →  *** REAL ***. Queried live from Meshy's
//       balance endpoint (GET openapi/v1/balance). Only enforced as a STOP for
//       asset-generation boxes (`--asset`); a low balance never blocks the
//       art-direction / cohesion / reading work that spends no credits. Layered
//       ON TOP of meshy-gen.mjs's own reactive 402 catch — defence in depth.
//
// ── FAIL-SAFE POSTURE ────────────────────────────────────────────────────────
//   • Graceful, never a hard block: every STOP is a clean pause with a reason.
//   • If it cannot determine usage AT ALL *and* no budget is configured (both
//     proxy budgets disabled AND log-scan off), it prints STOP — refusing to
//     risk burning into a hard weekly block blind. Normal operation ships with
//     safe defaults, so this only bites if someone strips every guardrail.
//   • Any unexpected internal error → STOP (pause), not GO (spend). The Meshy
//     balance read degrades to `null` (unknown) rather than throwing, so a
//     transient network hiccup falls through to the reactive 402 path, not a
//     halt.
//
// ── NEVER prints the API key *** (only ever the masked 4-char prefix). ────────
//
// Usage (from app/):
//   node scripts/usage-guard.mjs            # weekly gate for a normal box
//   node scripts/usage-guard.mjs --asset    # + enforce the Meshy reserve (STOP)
//   node scripts/usage-guard.mjs --status   # print status, always GO (no count)
//   node scripts/usage-guard.mjs --reset    # reset the weekly sittings window
//
// Env knobs (all optional; safe defaults):
//   RUNC_WEEKLY_STOP_PCT      default 3     # stop at this % of the proxy left
//   RUNC_WEEKLY_SITTINGS_BUDGET default 400 # sittings per ~7-day window (0=off)
//   RUNC_TIME_BUDGET_SEC      default 28800 # per-launch wall-clock cap (0=off)
//   RUNC_LOOP_START_EPOCH     (supervisor exports `date +%s` at launch)
//   RUNC_MESHY_RESERVE        default 50    # keep >= this many Meshy credits
//   RUNC_LOOP_LOG             path to the loop log to scan (optional)
//   RUNC_DISABLE_LOGSCAN      set to skip the live-signal log scan
//   RUNC_GUARD_STATE          state file (default app/logs/usage-guard-state.json)
//   RUNC_GUARD_LOG            audit log  (default runs/run-4-experience/RUN-C-USAGE-GUARD.log)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(fileURLToPath(new URL('..', import.meta.url)));   // .../app
const ROOT = path.resolve(APP, '..');                                     // .../Ranger-Adventures
const LOGDIR = path.join(APP, 'logs');                                    // gitignored

const num = (name, dflt) => {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

const STOP_PCT = num('RUNC_WEEKLY_STOP_PCT', 3);
const SITTINGS_BUDGET = num('RUNC_WEEKLY_SITTINGS_BUDGET', 400);   // 0 disables
const TIME_BUDGET_SEC = num('RUNC_TIME_BUDGET_SEC', 8 * 60 * 60);  // 0 disables
const MESHY_RESERVE = num('RUNC_MESHY_RESERVE', 50);
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;                        // ~1 week
const STATE_FILE = process.env.RUNC_GUARD_STATE || path.join(LOGDIR, 'usage-guard-state.json');
const AUDIT_LOG = process.env.RUNC_GUARD_LOG ||
  path.join(ROOT, 'runs', 'run-4-experience', 'RUN-C-USAGE-GUARD.log');

const IS_ASSET = process.argv.includes('--asset');
const IS_STATUS = process.argv.includes('--status');
const IS_RESET = process.argv.includes('--reset');

const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

// ── state (weekly sittings window), persisted across relaunches ──────────────
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      windowStart: Number(s.windowStart) || Date.now(),
      sittings: Number(s.sittings) || 0,
    };
  } catch {
    return { windowStart: Date.now(), sittings: 0 };
  }
}
function saveState(st) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  } catch { /* non-fatal: a state write hiccup must not halt a good run */ }
}
function auditLine(line) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
    fs.appendFileSync(AUDIT_LOG, `${nowIso()} · ${line}\n`);
  } catch { /* audit is best-effort */ }
}

// ── Meshy balance (REAL) — reuse meshy-gen.mjs's loader; NEVER print the key ──
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

// ── LIVE SIGNAL (real): scan the loop-log tail for a Claude usage-limit phrase ─
const LIMIT_RE = /usage limit reached|approaching your usage limit|claude usage limit|weekly limit|rate.?limit(?:ed|s)?\b.*(?:reset|reached|exceeded)|resets? at|429 too many|too many requests|overloaded_error|rate_limit_error/i;
// A line is the guard's OWN output (its STOP message quotes the matched phrase);
// scanning it back would self-reinforce a STOP forever. Drop guard lines first.
const GUARD_NOISE_RE = /usage-guard|signal in loop log|^\s*STOP:|weekly-usage proxy/i;
function loopSignal() {
  if (process.env.RUNC_DISABLE_LOGSCAN) return null;
  const p = process.env.RUNC_LOOP_LOG;
  if (!p) return null;
  try {
    const buf = fs.readFileSync(p);
    const tail = buf.slice(-4000).toString('utf8'); // only the latest sitting's output
    const cleaned = tail.split('\n').filter((l) => !GUARD_NOISE_RE.test(l)).join('\n');
    const m = cleaned.match(LIMIT_RE);
    return m ? m[0] : null;
  } catch {
    return null;
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
  const st = loadState();

  if (IS_RESET) {
    saveState({ windowStart: Date.now(), sittings: 0 });
    console.log('usage-guard: weekly sittings window reset.');
    console.log('GO');
    process.exit(0);
  }

  // Roll the weekly window if it aged out (natural weekly resume).
  if (Date.now() - st.windowStart > WINDOW_MS) {
    st.windowStart = Date.now();
    st.sittings = 0;
  }

  const startEpoch = num('RUNC_LOOP_START_EPOCH', 0);
  const elapsedSec = startEpoch > 0 ? Math.max(0, Math.round(Date.now() / 1000 - startEpoch)) : null;

  const timeOn = TIME_BUDGET_SEC > 0 && elapsedSec !== null;
  const sittingsOn = SITTINGS_BUDGET > 0;
  const timeRemPct = timeOn ? (1 - elapsedSec / TIME_BUDGET_SEC) * 100 : null;
  const sittingsRemPct = sittingsOn ? (1 - st.sittings / SITTINGS_BUDGET) * 100 : null;

  // ── build the human status line ──
  const parts = [];
  parts.push(timeOn ? `elapsed ${Math.round(elapsedSec / 60)}m/${Math.round(TIME_BUDGET_SEC / 60)}m` : 'elapsed n/a');
  parts.push(sittingsOn ? `sittings ${st.sittings}/${SITTINGS_BUDGET} (~${Math.max(0, sittingsRemPct).toFixed(0)}% left)` : 'sittings off');

  // Meshy balance is only fetched when it matters (asset box or explicit status)
  let meshy = { balance: null, note: 'not checked (non-asset box)' };
  if (IS_ASSET || IS_STATUS) meshy = await getMeshyBalance();
  parts.push(`meshy ${meshy.balance === null ? '?' : meshy.balance}${IS_ASSET ? ` (reserve ${MESHY_RESERVE})` : ''}`);

  if (IS_STATUS) {
    // Report only — never counts a sitting, always GO.
    auditLine(`STATUS — ${parts.join(' · ')} — meshy note: ${meshy.note}`);
    console.log(parts.join(' · '));
    console.log('GO');
    process.exit(0);
  }

  // ── STOP checks (any one pauses the run) ──

  // 1) Live usage-limit signal in the loop log (real, reactive).
  const sig = loopSignal();
  if (sig) {
    return finish(false,
      `Claude usage-limit signal in loop log ("${sig.slice(0, 40)}") — pausing; re-launch after the weekly window resets`,
      parts);
  }

  // 2) Session wall-clock backstop.
  if (timeOn && elapsedSec >= TIME_BUDGET_SEC) {
    return finish(false,
      `session wall-clock budget reached (${Math.round(elapsedSec / 60)}m ≥ ${Math.round(TIME_BUDGET_SEC / 60)}m) — clean stop; re-launch to continue`,
      parts);
  }

  // 3) Weekly-usage PROXY: sittings budget with the stop-% margin.
  if (sittingsOn && sittingsRemPct <= STOP_PCT) {
    return finish(false,
      `weekly-usage proxy at ~${Math.max(0, sittingsRemPct).toFixed(0)}% ≤ ${STOP_PCT}% (sittings ${st.sittings}/${SITTINGS_BUDGET} this 7-day window) — pausing to leave weekly margin; re-launch after reset`,
      parts);
  }

  // 4) Meshy reserve — only enforced as a STOP for asset-generation boxes.
  if (IS_ASSET && meshy.balance !== null && meshy.balance < MESHY_RESERVE) {
    return finish(false,
      `Meshy balance ${meshy.balance} < reserve ${MESHY_RESERVE} — pausing new-asset work; top up credits or defer asset boxes`,
      parts);
  }

  // 5) FAIL-SAFE: no way to reason about usage at all → refuse to risk a hard block.
  const canReason = timeOn || sittingsOn || (!process.env.RUNC_DISABLE_LOGSCAN && !!process.env.RUNC_LOOP_LOG);
  if (!canReason) {
    return finish(false,
      'cannot determine usage AND no budget configured (time + sittings budgets disabled, log-scan off) — refusing to risk a hard weekly block; set RUNC_TIME_BUDGET_SEC or RUNC_WEEKLY_SITTINGS_BUDGET',
      parts);
  }

  // ── GO: count this sitting against the weekly window and persist. ──
  st.sittings += 1;
  saveState(st);
  return finish(true, '', parts);
}

main().catch((e) => {
  // Any unexpected error fails SAFE: pause, don't spend.
  console.log(`usage-guard internal error (${e && e.name ? e.name : 'error'})`);
  console.log('STOP: usage-guard internal error — pausing as a fail-safe (see RUN-C-USAGE-GUARD.log)');
  process.exit(3);
});
