import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the browser-proof contract (WORLD-PLAN §3.1).
 *
 * The whole point of run 2: no box may claim "done" without a rendered frame /
 * input event checked in a real browser. E2E asserts against the dev-state
 * hook `window.__ranger` (state, not pixels — headless SwiftShader renders
 * deterministically enough for state asserts, W0.2 adds the hook).
 *
 * - Fixed uncommon port 4199 so a vite dev server Floris has open on 5173 never
 *   turns the suite red; `reuseExistingServer` reuses a 4199 server locally but
 *   never in CI.
 * - `retries: 2` in CI only (SwiftShader is ~10× slower; movement asserts use
 *   `expect.poll`, never fixed sleeps).
 * - Screenshots on failure + explicit artifact shots go to `e2e/__shots__/`
 *   (gitignored). The CI swiftshader launch args (W0.6) live on chromium.
 * - WebKit (W0.8) is the iPad Safari engine — the primary device. It runs the
 *   smoke set only (`grep: /@smoke/` = boot + journey + movement) so it stays
 *   fast; `shot()` no-ops on webkit (helpers.ts). CI installs chromium only,
 *   so `e2e:smoke` is scoped to `--project=chromium` (package.json) and the
 *   webkit run is `e2e:webkit`, local-only. Frozen smoke assertions (§3.1)
 *   are unchanged — webkit adds a second engine, it removes nothing.
 */
const PORT = 4199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
        // CI runners have no GPU; three.js WebGL needs software rendering.
        // SwiftShader via ANGLE keeps the world drawing headlessly (W0.6).
        // Locally we have a real GPU, so these args stay off.
        launchOptions: {
          args: process.env.CI
            ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
            : [],
        },
      },
    },
    {
      // iPad Safari engine (the primary device). Smoke set only — boot,
      // journey, movement — so the second-engine pass stays quick. Not part
      // of CI's chromium-only `e2e:smoke`; run it locally via `e2e:webkit`.
      name: 'webkit',
      grep: /@smoke/,
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
