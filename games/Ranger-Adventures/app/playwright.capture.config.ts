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

// Select capture projects by name from CAPTURE_PROJECTS (comma-separated).
// Unset/empty → keep all (both form factors). Unknown names are ignored; if the
// filter would leave nothing, fall back to all so a typo never yields 0 tests.
function filterProjects<T extends { name: string }>(all: T[]): T[] {
  const want = (process.env.CAPTURE_PROJECTS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (want.length === 0) return all;
  const kept = all.filter((p) => want.includes(p.name));
  return kept.length ? kept : all;
}

export default defineConfig({
  testDir: './e2e-capture',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results',
  // One project walks the WHOLE flow (one test). The flow has grown well past the
  // "2 boots" this cap was first sized for: ~15 scene groups, each booting a world
  // (the first streams ~13 MB of GLBs, ~3 min; later boots hit the warm HTTP cache),
  // and the game-3d group (D1.0(b)) now drives FIVE real missions instead of the
  // cheap sandbox. D1.4 raised the ceiling to 66 min — a BACKSTOP, not the expected
  // ~45–55 min runtime: the GATE-D1 audit ran the main flow 39.6 min with FIVE groups
  // CUT at their budgets; once those budgets are widened so nothing GAPs, the same flow
  // runs to COMPLETION and needs more wall-clock (ven runs LAST, so a too-tight whole-test
  // cap kills exactly the group that must not GAP). This 66-min ceiling sits ABOVE the
  // realistic total yet BELOW the ~94-min sum of all per-GROUP budgets, so the real guard
  // against a runaway stays the per-GROUP wall-clock budgets in capture.spec.ts
  // (D1.0(a)/D1.4): one slow/wedged group GAPs at its own cap and the flow continues, so
  // this whole-test cap only fires if MANY groups overrun at once (itself a red flag the
  // per-group timing logs surface). The runGroup elapsed-time logs (D1.4) measure the real
  // headless runtime so this and the per-group budgets can be re-balanced against evidence.
  timeout: 3_960_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A real GPU locally renders the world fine headed or headless; capture runs
    // headless by default (add `--headed` to watch). No SwiftShader args needed
    // locally (they are a CI-only concern in the main config).
  },
  // Run B SCOPE (Floris, 2026-07-03): CAPTURE_PROJECTS picks which form factors
  // to capture. Empty/unset = BOTH (the Run A default — keeps the archived
  // contact sheet reproducible). The Run B loop sets CAPTURE_PROJECTS=laptop
  // because the iPad leg (2160×1620, software-rendered headless) HANGS the
  // renderer before the jeep/board/mission/RM scenes (F-21). iPad verification
  // is meanwhile folded into Floris's on-device demo; iPad auto-capture returns
  // with CAPTURE_PROJECTS=laptop,ipad once the render hang is solved.
  projects: filterProjects([
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
  ]),
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
