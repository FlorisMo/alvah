import { defineConfig, devices } from '@playwright/test';

// THROWAWAY probe config (P1.2 diagnosis) — separate from the frozen main +
// capture configs. Laptop viewport only, own port. Deleted before the box closes.
const PORT = 4198;

export default defineConfig({
  testDir: './e2e-probe',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results-probe',
  timeout: 300_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
