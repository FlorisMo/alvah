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
 *   (gitignored). WebKit (W0.8) and the CI swiftshader launch args (W0.6) land
 *   in their own boxes.
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
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
