import { test, expect } from '@playwright/test';

/**
 * W3.5 style-coherence evidence (NOT a smoke test — no @smoke tag, so the frozen
 * smoke set is untouched). Loads the standalone Charactershowroom cast gallery
 * (`showroom.html`), filters to the `animal` category, and shoots the row where
 * the four CC0 Quaternius animals (ree/edelhert/vos/wolf, now staged animated via
 * `loadRig`) stand beside the Meshy cast (heikikker/das/eekhoorn/frisling/…). This
 * lets a human judge whether the pack style clashes with the Meshy look
 * (WORLD-PLAN §5 W3.5). Writes into the tracked qa-evidence-2/ folder.
 */
test('showroom: CC0 animals beside the Meshy cast (W3.5 style check)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/showroom.html');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.getByRole('button', { name: 'animal', exact: true }).click();
  // Let the async rig loads attach and the mixers leave the bind pose.
  await page.waitForTimeout(7_000);
  await page.screenshot({ path: '../qa-evidence-2/w35-showroom-animals.png' });
});
