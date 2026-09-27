import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the browser suite (the dev server; `playwright.preview.config.ts`
 * drives the built site instead). E2E asserts against the dev-state hook
 * `window.__ranger` (state, not pixels); golden, missions, sitspot and roundtrip play
 * with real input only, some older specs still win steps through `winStep()`.
 *
 * - The port is `RANGER_PORT` (one per parallel agent; 4199 when unset). Locally a
 *   server already running on it is reused, so a shared port tests someone else's code;
 *   in CI a fresh one is always started.
 * - Chromium (the laptop engine: the device that decides every trade-off, GOAL.md) runs
 *   everything. Locally it gets the real-GPU args: without them headless Chromium
 *   silently draws in software and the world crawls.
 * - CI (`CI=1`, GitHub's GPU-less ubuntu runner) runs `npm run e2e:smoke` only: boot,
 *   devhook, journey, movement, on SwiftShader (software GL). The game detects software
 *   GL and boots its light mode there (core/quality.ts); the smoke waits for rendered
 *   frames, not seconds, where it waits for the game to act (movement.spec). CI also
 *   retries twice, runs one worker and gives each test 120 s.
 * - WebKit is the iPad engine (second device: it must keep working). It runs the smoke
 *   set only, locally (`npm run e2e:webkit`); `shot()` no-ops on it (helpers.ts).
 * - Local runs use at most 2 workers: every worker boots a whole 3D world on the one
 *   GPU, and at the default (half the cores) the walking and mission specs timed out
 *   under load while each passed alone (review TEST-2, 2026-09-27).
 * - Screenshots on failure + explicit artifact shots go to `e2e/__shots__/` and
 *   `test-results/` (both gitignored).
 */
const PORT = Number(process.env.RANGER_PORT ?? 4199); // RANGER_PORT: one port per parallel agent (a reused server would test another worktree's code)
const CI_SOFTWARE_GL = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
const LOCAL_GPU = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--enable-gpu', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Per-test budget. CI's GPU-less runner renders with SwiftShader, so a whole journey
  // (boot → avatar → world → shots) needs more than the 30 s default: 120 s is still a
  // real upper bound (a hang fails). Locally 60 s; the walking and mission specs set
  // their own, longer budgets.
  timeout: process.env.CI ? 120_000 : 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2, // each worker boots a world on the one GPU (see above)
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  outputDir: './test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CI runners have no GPU: SwiftShader via ANGLE draws WebGL in software (and the
        // game boots its light mode). Locally headless Chromium does NOT pick the GPU by
        // itself: without these args it falls back to software GL and the world crawls.
        launchOptions: { args: process.env.CI ? CI_SOFTWARE_GL : LOCAL_GPU },
      },
    },
    {
      // iPad Safari engine (the second device: it must keep working). Smoke set only,
      // so the second-engine pass stays quick. Not part of CI's chromium-only
      // `e2e:smoke`; run it locally via `e2e:webkit`.
      name: 'webkit',
      grep: /@smoke/,
      timeout: 120_000, // WebKit boots the world slower: 46-57 s per smoke test with other agents' worlds on the machine
      use: { ...devices['iPad (gen 7) landscape'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
