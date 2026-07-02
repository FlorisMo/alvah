import { test, expect } from '@playwright/test';

/**
 * W3.7a relative-scale evidence (NOT a smoke test — no @smoke tag, so the frozen
 * smoke set is untouched). The Charactershowroom auto-scales every model to a
 * flat 1.7 (hiding all relative scale — the W3.5 §10 note). `?scale=true` sizes
 * each model to its canonical dossier stand height (`AnimalScale.ts`) instead,
 * so the ree towers over the vos and both are dwarfed by the ranger.
 *
 * Shoots the before (auto-scale) and after (true-scale) frames of the animal +
 * human row into the tracked qa-evidence-2/ folder for human review.
 */

async function shootRow(page: import('@playwright/test').Page, url: string, file: string): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.getByRole('button', { name: 'animal', exact: true }).click();
  // let the async rig loads attach + leave the bind pose
  await page.waitForTimeout(7_000);
  await page.screenshot({ path: `../qa-evidence-2/${file}` });
}

test('showroom: before/after relative scale (W3.7a)', async ({ page }) => {
  test.setTimeout(90_000); // two sequential showroom loads (~12 s each) + rig attach
  await shootRow(page, '/showroom.html', 'w37-scale-before-autoscale.png');
  await shootRow(page, '/showroom.html?scale=true', 'w37-scale-after-truescale.png');
});

/**
 * W3.7b dossier-look evidence: `?dress=true` applies the coat tint (vos rufous),
 * eye recipe and posture (boar/das nose-lowered) the live world now applies. The
 * before is the raw pack look; the after is the corrected cast — shot at true
 * scale so the vos is legible next to the ree.
 */
test('showroom: before/after coat + eyes + posture (W3.7b)', async ({ page }) => {
  test.setTimeout(90_000);
  await shootRow(page, '/showroom.html?scale=true', 'w37b-look-before.png');
  await shootRow(page, '/showroom.html?scale=true&dress=true', 'w37b-look-after.png');
});
