import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the W7.4 SHIP proof: E2E against the REAL site build.
 *
 * The default `playwright.config.ts` runs against the vite DEV server (`npm run
 * dev`, source, base `/`, `import.meta.env.DEV === true`). That proves the code
 * works, but not that the *shipped artifact* works: the production `--mode site`
 * bundle (fixed-name `/ranger/app.js`, code-split vendor/mission chunks, base
 * `/ranger/`, DEV off) is a different beast, and it is served behind the
 * BaseLayout access gate.
 *
 * This config drives the exact thing that lands on alvah.nl:
 *   - root `npm run build`  → `app run build:site` (stages `public/ranger/`) +
 *     `astro build` (emits `dist/` incl. `dist/ranger/`),
 *   - `astro preview`       → serves `dist/` locally,
 *   - the spec pre-seeds the presence-only gate `sessionStorage['alvah-gate-v1']`
 *     via `context.addInitScript` (never scripting the password — the gate is
 *     documented as intentionally bypassable, WORLD-PLAN §7/W7.4).
 *
 * Run it with `npm run e2e:preview` AFTER a root build (the webServer only
 * serves `dist/`; it does not build). It is deliberately SEPARATE from the
 * frozen `e2e:smoke` tick gate (which stays on the dev server) — this is the
 * ship box's own acceptance, run by hand at W7.4.
 *
 * ROOT is the repo root relative to this file (`app/` → three levels up). The
 * `astro preview` port is fixed uncommon (4323) so a dev/preview server already
 * open never clashes.
 */
const PORT = 4323;
const ROOT = '../../..';

export default defineConfig({
  testDir: './e2e-preview',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  // Reuse the already-gitignored artifact dir (root .gitignore: `test-results/`).
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
        // Match the dev config: GPU-less CI needs SwiftShader for three.js WebGL.
        launchOptions: {
          args: process.env.CI
            ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
            : [],
        },
      },
    },
  ],
  webServer: {
    // Serve the built `dist/` from the repo root. `astro build` must have run
    // first (root `npm run build`); this only previews.
    command: `npx astro preview --port ${PORT}`,
    cwd: ROOT,
    url: `http://localhost:${PORT}/ranger/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
