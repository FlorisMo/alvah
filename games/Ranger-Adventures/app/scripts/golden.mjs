#!/usr/bin/env node
// golden.mjs — `npm run golden`: play the golden path (GOAL.md steps 1-8) like a real
// player with e2e/golden.spec.ts, then print its step | result | note table LAST, so the
// first broken step is the last thing on screen. Exit code = the spec's (0 = all green).
//
//   RANGER_PORT=5404 npm run golden          # always pick your own port
//   RANGER_PORT=5404 npm run golden -- --headed
//
// The Playwright config gives local Chromium the real-GPU args and starts a dev server
// on RANGER_PORT if none is running there (it reuses one that is, so use YOUR port).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summary = path.join(app, 'test-results', 'golden', 'SUMMARY.txt');
rmSync(summary, { force: true });
console.log(`golden path on http://localhost:${process.env.RANGER_PORT ?? 4199} (RANGER_PORT) — takes ~3-4 min`);
const run = spawnSync(
  'npx',
  ['playwright', 'test', '--project=chromium', '--grep', '@golden', '--reporter=line', ...process.argv.slice(2)],
  { cwd: app, stdio: 'inherit', env: { ...process.env, GOLDEN_QUIET: '1' } },
);
if (existsSync(summary)) process.stdout.write(readFileSync(summary, 'utf8'));
else console.log('\nno golden table was written: the run died before the spec started (see the output above)');
process.exit(run.status ?? 1);
