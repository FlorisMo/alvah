import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the RUN-3 AUDIT capture harness (screenshot-in-the-loop).
 *
 * Run 2's lesson (FINDINGS.md): a mechanical gate that never LOOKS at the screen
 * ships a huge avatar and a gliding capsule. Run 3's audit fixes that by putting
 * a real rendered frame in front of a judge. THIS config only presses the
 * shutter — it is a dumb, cheap, model-free capture pass. It boots the real game
 * on the dev server, walks the actual player flow, and writes a screenshot +
 * a state annotation for every screen/state at BOTH form factors. Fable (or any
 * judge) then LOOKS at the contact sheet; no model is needed to capture.
 *
 * Two projects, ONE flow each:
 *   - laptop : Desktop Chrome viewport, mouse + trackpad (wheel) + keyboard.
 *   - ipad   : iPad (gen 7) landscape viewport + touch.
 *
 * ENGINE NOTE (honesty): BOTH projects run on the CHROMIUM engine. Local WebKit
 * (the true iPad-Safari engine) bus-errors on this Mac's frozen build
 * (WORLD-PLAN §10, W0.8). So the `ipad` project reproduces the iPad VIEWPORT and
 * TOUCH input, not Safari's exact rendering — real Safari-engine look stays a
 * Floris on-device check. The audit flags that in every iPad finding.
 *
 * Deliberately SEPARATE from the frozen `e2e:smoke` tick gate and the main
 * `playwright.config.ts` — this changes no game code and asserts nothing; it
 * only produces evidence. Fixed uncommon port 4197 so a dev/preview server
 * already open never clashes. Not parallel: each project walks one page through
 * the whole flow in order.
 */
const PORT = 4197;

export default defineConfig({
  testDir: './e2e-capture',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results',
  timeout: 1_800_000, // one project walks the whole flow; each world boot streams ~13 MB of GLBs (~3 min on
                      // this machine), so 2 boots + the walk-to-jeep/board detours want generous headroom.
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A real GPU locally renders the world fine headed or headless; capture runs
    // headless by default (add `--headed` to watch). No SwiftShader args needed
    // locally (they are a CI-only concern in the main config).
  },
  projects: [
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // iPad viewport + touch, but forced onto the Chromium engine (local WebKit
      // is a frozen bus-erroring build, §10). defaultBrowserType override keeps
      // the iPad viewport/touch/isMobile flags while swapping the engine.
      name: 'ipad',
      use: {
        ...devices['iPad (gen 7) landscape'],
        defaultBrowserType: 'chromium',
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
