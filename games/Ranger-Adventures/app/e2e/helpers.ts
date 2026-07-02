import type { Page, TestInfo } from '@playwright/test';

/**
 * Shared E2E helpers for the browser-proof suite (WORLD-PLAN §3.1).
 */

/** Directory for curated artifact screenshots (gitignored, W0.1). */
export const SHOTS_DIR = 'e2e/__shots__';

/**
 * Save a named artifact screenshot for human review. Screenshots are proof for
 * a person, never an assertion target (SwiftShader pixels are not stable).
 */
export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

/**
 * Collect page errors (uncaught exceptions). The boot smoke asserts this stays
 * empty — a silent throw during boot is exactly the class of failure run 1
 * never caught.
 */
export function collectPageErrors(page: Page, sink: string[]): void {
  page.on('pageerror', (err) => sink.push(String(err)));
}

/**
 * Attach the collected page errors to the test report so a failure is
 * self-explaining.
 */
export async function reportPageErrors(testInfo: TestInfo, errors: string[]): Promise<void> {
  if (errors.length) {
    await testInfo.attach('pageerrors', { body: errors.join('\n'), contentType: 'text/plain' });
  }
}
