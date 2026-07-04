import { test, type Page, type TestInfo, type CDPSession } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * RUN-3 AUDIT capture flow (WORLD-PLAN §3.1 lesson; FINDINGS.md "agreed shape").
 *
 * ONE test per project (laptop | ipad) walks the REAL player flow and drops a
 * screenshot + a state annotation at every screen/state the audit needs to see:
 *   title · avatar · world-entry · WALK BURST (≥3 frames, gliding evidence) ·
 *   controls HUD · (laptop) trackpad-zoom + orbit ATTEMPTS · pause hub ·
 *   jeep near/in/drive burst · mission board · a 3D mission · reduce-motion world.
 *
 * ── Run B / P0.2 (F-21) hardening ────────────────────────────────────────────
 * Run A booted the WHOLE flow in ONE long-lived page. On the iPad project the
 * renderer died mid-walk toward the board ("Target … has been closed"), and
 * every scene AFTER it — board, mission AND reduce-motion — got nothing (the
 * three most content-critical iPad surfaces). Two fixes make the substrate
 * survivable and touch-honest:
 *   1. SCENE-ISOLATED PAGES. The flow is split into scene GROUPS; each group
 *      runs in its OWN fresh page (`context.newPage()`) seeded per-group (clear
 *      the ranger save so every boot is a clean first-run, re-seed the presence
 *      gate). One renderer death can no longer erase later groups, and each
 *      group gets ONE crash-retry (a fresh page + re-boot).
 *   2. TOUCH on the iPad project. Locomotion (walk bursts + walk-to-jeep/board)
 *      and the in-jeep drive burst are driven through the on-screen JOYSTICK via
 *      genuine CDP touch events — never `page.keyboard`; the `laptop` project
 *      keeps keyboard + mouse. Buttons are tapped (`locator.tap`) on the iPad.
 *
 * It asserts almost nothing — a failed capture is itself an audit finding, so
 * every scene is wrapped: a NON-crash scene error records a GAP and the flow
 * continues; a page-crash bubbles up so the group's one retry can re-boot.
 * Annotations are written to disk after EVERY shot, so even a mid-flow timeout
 * still leaves a usable partial contact sheet.
 *
 * Engine caveat (honesty contract): the `ipad` project is the iPad VIEWPORT +
 * TOUCH on the Chromium engine, not Safari (local WebKit bus-errors, §10). Every
 * iPad shot carries that caveat; true Safari look = a Floris on-device check.
 */

// cwd is app/. Evidence lands beside the run-3 docs; raw PNGs are gitignored,
// annotations.json is small + tracked so the audit is reproducible.
const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

type Annotation = {
  name: string; platform: string; group: string; note: string; ok: boolean;
  screen: string | null; pos: { x: number; z: number } | null; cameraYaw: number | null;
  drawCalls: number | null; missionView: string | null; clip: { name: string; time: number } | null;
  // F-07: the ranger's LIVE measured world bounding-box height (m). The scale
  // assert reads avatar.height ∈ [1.5, 2.0] off any world/walk shot. null before
  // the hook/world is ready (title/avatar screens, GAPs).
  avatar: { height: number } | null;
  // F-08: the ranger's LIVE post-collision ground speed (m/s). The assert reads it
  // ∈ [1.4, 2.2] on the walk-burst shots (while clip = walk) to prove the retuned
  // foot speed is human-scaled, not the old ~2.7–3.5 m/s near-jeep glide that slid
  // the feet ~2.5× per stride. 0 while standing; null before the hook is ready.
  groundSpeed: number | null;
  // F-05 ⊕ F-18: the REAL render camera read back after the frame update. `dist`
  // is the boom length (assert: ≥ 3 = the world is visible, not the lens buried
  // in the avatar); `avatarInView` = the ranger's whole bbox sits in the frustum;
  // `yaw`/`dist` steady across the world-idle pair proves the pose telemetry is
  // read off the settled camera (§4: pixels still outrank it). `avatarOpacity` = the
  // applied fade (1 = solid): the F-07 machine signal — opacity == 1 on a settled
  // hero/POI shot means a hard-to-see ranger is small, NOT faded, so the grade
  // stops blaming the boom. `avatarScreen` = his bbox projected to screen space
  // (steer #2): {x,y} in [-1,1], onScreen, and heightFrac (viewport-height fraction)
  // — a framed ranger reads |x|,|y| ≲ 0.6 with a non-tiny heightFrac; a speck or an
  // off-frame ranger fails it, so a soft-DOF frame can't be misgraded as "murk".
  // `landmarkInView` (F-09) = a hub landmark (cabin / mission board / beacon) sits in
  // the live frustum: the world-entry assert that the spawn faces the hub, not the
  // void (true on the world-entry / walk shots once F-09 turns the hub into frame).
  // null on GAPs/boot.
  // F-16 laptop dolly zoom: `fov` is the fixed lens (constant across the zoom pair — a
  // dolly never zooms the lens); `zoom` is the player-set walk boom clamped to its live
  // bounds — `zoom.dist` ∈ [min, max] proves the wheel respects BOTH clamps, saturating
  // to `min` on scroll-in and `max` on scroll-out, while `cam.dist` (the real 3D boom)
  // shows the framing visibly differ.
  // F-17 laptop drag-orbit: `orbit` is the player's look offset — `orbit.yaw` (rad, free)
  // changes on a >6 px drag and NEVER on a clean tap; the real `cam.yaw` (quaternion) is
  // the court of appeal. The camera-orbit shot proves a drag swings `cam.yaw` while `pos`
  // holds; the camera-click-walk shot proves a clean click still moves `pos` (tap-to-walk).
  cam: { dist: number; yaw: number; pitch: number; x: number; y: number; z: number; target: string; avatarInView: boolean; avatarOpacity: number; avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number }; landmarkInView: boolean; fov: number; zoom: { dist: number; min: number; max: number }; orbit: { yaw: number; lift: number } } | null;
  // vehicle heading/speed when driving — the DATA signal for the F-32 steering
  // control conditions. `headingUnwrapped` is the CUMULATIVE steered yaw (never
  // wrapped): across the no-turn straight pair it barely moves (drift ≈ 0), across
  // the held-turn drive burst it changes MONOTONICALLY — the wrapped `heading` could
  // alias a whole turn away between samples (F-18), the unwrapped one cannot.
  // `driverHidden` (F-31): true while he rides the jeep with his mesh hidden (the
  // sanctioned fallback) — the assert reads it true + clip='sit' to prove he boards,
  // never stands planted + idle. null when not in a vehicle.
  veh: { heading: number; headingUnwrapped: number; speed: number; inVehicle: boolean; driverHidden: boolean } | null;
  // F-18 court of appeal (P1.2): the md5 of THIS shot's PNG bytes. "Pixels outrank
  // the hook" (§4) becomes machine-checkable — the world-idle / world-idle-hold pair
  // reads an IDENTICAL hash when the pose is genuinely still, so the P1.2 idle assert
  // (cam.yaw / cam.dist steady ±0.01) is confirmed by the RENDER, not by a hook that
  // moved yaw between pixel-identical frames in Run A. It also flags the inverse: a
  // camera claim that "changed" while the hash holds is a telemetry lie to distrust.
  // Emits what the §8 grades were computing by hand. null on GAPs / failed captures.
  pixelHash: string | null;
  // RUN-3 P3.1 (F-01/F-02/F-14/F-20/F-25/F-28): live DOM tap-target measurements.
  // Per named-control selector, the SMALLEST visible box (`minW`/`minH`) across all
  // matches + that worst element's `box`. The ≥56px assert reads `minW`/`minH` ≥ 56
  // for each control on the scene it lives on (Begin=title, swatches/chips/confirm=
  // avatar, Pauze=controls-hud, hub links=pause-hub, board-exit=board-open,
  // speaker=mission-3d). F-01 reads `taps['.av-klaar'].box` against `viewport` to
  // prove the confirm CTA sits fully inside the frame (no scroll). null off-scene.
  taps: Record<string, TapBox> | null;
  viewport: { width: number; height: number } | null;
  file: string;
};
/** The smallest visible box of a selector's matches (the worst case for a ≥56px
 *  floor), plus the count and the offending element's position (for F-01's
 *  inside-the-viewport check). All dims are CSS px, rounded. */
type TapBox = { count: number; minW: number; minH: number; box: { x: number; y: number; w: number; h: number } | null };

interface Hook {
  screen: string; missionView: '2d' | '3d' | null; version: string;
  pos(): { x: number; z: number } | null; cameraYaw(): number | null; drawCalls(): number | null;
  clip(): { name: string; time: number } | null;
  avatar(): { height: number } | null;
  groundSpeed(): number | null;
  cam(): { dist: number; yaw: number; pitch: number; x: number; y: number; z: number; target: string; avatarInView: boolean; avatarOpacity: number; avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number }; landmarkInView: boolean; fov: number; zoom: { dist: number; min: number; max: number }; orbit: { yaw: number; lift: number } } | null;
  board(): { x: number; z: number; near: boolean } | null;
  vehicle(): { placed: boolean; near: boolean; inVehicle: boolean; x: number; z: number; heading: number; headingUnwrapped: number; speed: number; driverHidden: boolean } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

test('audit capture flow', async ({ context }, testInfo) => {
  const platform = testInfo.project.name; // 'laptop' | 'ipad'
  const isPad = platform === 'ipad';
  const dir = path.join(EVID, platform);
  fs.mkdirSync(dir, { recursive: true });
  const shots: Annotation[] = [];
  let n = 0;
  let version: string | null = null;

  const flush = () =>
    fs.writeFileSync(
      path.join(EVID, `annotations-${platform}.json`),
      JSON.stringify({ platform, version, shots }, null, 2),
    );

  /** Screenshot the viewport + record the live hook state; persist immediately.
   *  `tapSelectors` (P3.1) additionally measures those controls' live boxes into
   *  `a.taps` so the ≥56px / inside-viewport asserts grade off real DOM geometry. */
  async function snap(page: Page, name: string, group: string, note: string, tapSelectors?: string[]): Promise<void> {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    const a: Annotation = {
      name, platform, group, note, ok: true, file: `${platform}/${file}`,
      screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
      pixelHash: null, taps: null, viewport: null,
    };
    try {
      const s = await hook(page, (r) => {
        const v = r.vehicle();
        return {
          screen: r.screen, missionView: r.missionView, pos: r.pos(),
          cameraYaw: r.cameraYaw(), drawCalls: r.drawCalls(), clip: r.clip(), avatar: r.avatar(), groundSpeed: r.groundSpeed(), cam: r.cam(), version: r.version,
          veh: v && v.inVehicle ? { heading: v.heading, headingUnwrapped: v.headingUnwrapped, speed: v.speed, inVehicle: v.inVehicle, driverHidden: v.driverHidden } : null,
        };
      });
      if (s) { Object.assign(a, s); version = s.version; }
      // F-18 pixel court of appeal: `screenshot({path})` writes the PNG AND returns
      // its bytes — hash them so the grade can prove pose stability from the RENDER
      // (idle pair hashes equal) instead of trusting the hook that lied in Run A (§4).
      const png = await page.screenshot({ path: path.join(dir, file) });
      a.pixelHash = createHash('md5').update(png).digest('hex');
    } catch (e) { a.ok = false; a.note = `${note}  [CAPTURE FAILED: ${String(e).slice(0, 140)}]`; }
    // P3.1 tap-target geometry — supplementary; a measurement miss is its own
    // signal (a control absent when it should be present) and never fails the shot.
    if (tapSelectors && tapSelectors.length) {
      try { a.taps = await measureTaps(page, tapSelectors); a.viewport = page.viewportSize(); }
      catch { /* keep the screenshot + hook state even if the DOM probe throws */ }
    }
    shots.push(a);
    flush();
  }
  /** Run one scene. A non-crash throw records a GAP and never kills the flow; a
   *  page-crash re-throws so the enclosing group can spend its one retry. */
  async function scene(page: Page, label: string, fn: () => Promise<void>): Promise<void> {
    try { await fn(); }
    catch (e) {
      if (isCrash(e) || page.isClosed()) throw e; // → group re-boot
      shots.push({
        name: label, platform, group: 'GAP', ok: false, file: '',
        note: `Scene "${label}" kon niet worden vastgelegd: ${String(e).slice(0, 200)} — dit is zelf een audit-bevinding.`,
        screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
        pixelHash: null, taps: null, viewport: null,
      });
      flush();
    }
  }

  /**
   * Run a scene GROUP in its own fresh page (F-21 isolation). Seeds a clean
   * first-run save + the presence gate before any app script, then runs `body`.
   * One crash-retry: on a page-crash the partial shots are rolled back and the
   * group re-boots once in a brand-new page; a second crash (or a non-crash
   * failure that escaped `scene`) records a single GAP and the flow moves on.
   */
  async function runGroup(
    label: string,
    opts: { reduce?: boolean },
    body: (page: Page, stick: TouchStick | null) => Promise<void>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const nAtStart = n, shotsAtStart = shots.length;
      const page = await context.newPage();
      let stick: TouchStick | null = null;
      try {
        if (opts.reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
        // Clear the ranger save (first-run every group) + pre-seed the presence
        // gate, BEFORE any page script — persist.ts co-tenants `alvah-ef-v1`, and
        // the BaseLayout gate reads sessionStorage `alvah-gate-v1` (never the pw).
        await page.addInitScript(() => {
          try {
            localStorage.removeItem('alvah-ef-v1');
            localStorage.removeItem('ranger-mvp-state');
            sessionStorage.setItem('alvah-gate-v1', '1');
          } catch { /* storage unavailable — boot still fine */ }
        });
        if (isPad) stick = new TouchStick(await context.newCDPSession(page));
        await body(page, stick);
        await page.close();
        return; // group done
      } catch (e) {
        await page.close().catch(() => {});
        // discard this attempt's partial shots so the retry (or the GAP) is clean
        n = nAtStart; shots.length = shotsAtStart; flush();
        if (attempt === 1 && isCrash(e)) {
          // eslint-disable-next-line no-console
          console.log(`[capture] group "${label}" lost the renderer — retrying once: ${String(e).slice(0, 100)}`);
          continue;
        }
        shots.push({
          name: label, platform, group: 'GAP', ok: false, file: '',
          note: `Groep "${label}" kon niet worden vastgelegd: ${String(e).slice(0, 200)} — dit is zelf een audit-bevinding.`,
          screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
          pixelHash: null, taps: null, viewport: null,
        });
        flush();
        return;
      }
    }
  }

  // ══ GROUP 1 — intro: title → avatar → world → walk burst → controls →
  //    (laptop camera attempts) → pause hub. Own fresh page. ══
  await runGroup('intro', {}, async (page, stick) => {
    await scene(page, 'title', async () => {
      await page.goto('/');
      await page.locator('.boot-title').waitFor({ timeout: 30_000 });
      await snap(page, 'title', 'Boot', 'Titelscherm "Word boswachter" — eerste indruk.', ['.btn-start']);
    });
    await scene(page, 'avatar', async () => {
      await press(page, isPad, page.getByRole('button', { name: 'Begin' }));
      await page.getByRole('button', { name: 'Dit is mijn ranger' }).waitFor({ timeout: 30_000 });
      await snap(page, 'avatar', 'Boot', 'Avatar-maker — de ranger die je speelt.',
        ['.av-klaar', '.av-swatch', '.av-chip', '.av-naam-chip']);
    });
    await scene(page, 'world-entry', async () => {
      await press(page, isPad, page.getByRole('button', { name: 'Dit is mijn ranger' }));
      await waitForWorld(page);
      await settle(page, 1500);
      await snap(page, 'world-entry', 'Wereld', 'Eerste frame in de wereld — camera-kader + avatarschaal (punch-list #1).');
    });
    // F-18 idle-stability pair (P1.2 assert): two frames 3 s apart with NO input,
    // both AFTER the real rig has swapped in — cam.yaw/cam.dist must hold ±0.01,
    // proving the pose is read off the settled render camera, not a drifting boom.
    await scene(page, 'world-idle', async () => {
      await settle(page, 1500); // rig loaded + camera settled (~3 s post-enter)
      await snap(page, 'world-idle', 'Wereld', 'Stil, geen input — camera-pose ijkpunt (F-18 idle-check).');
      await settle(page, 3000); // 3 s idle
      await snap(page, 'world-idle-hold', 'Wereld', 'Zelfde plek, 3 s later — pose stabiel? yaw/dist ±0.01.');
    });
    // WALK BURST — gliding evidence: drive forward, snap 5 frames ~250 ms apart.
    await scene(page, 'walk-burst', async () => {
      await holdForward(page, isPad, stick);
      try {
        for (let i = 1; i <= 5; i++) {
          await settle(page, 250);
          await snap(page, `walk-${i}`, 'Lopen (burst)', `Loopframe ${i}/5 — benen + pos/clip tussen frames (glijdt vs loopt, #2).`);
        }
      } finally { await releaseForward(page, isPad, stick); }
    });
    await scene(page, 'controls-hud', async () => {
      await settle(page, 400);
      await snap(page, 'controls-hud', 'Besturing', isPad
        ? 'iPad-kader: staat de joystick er, ≥56 px, tap-to-walk zichtbaar?'
        : 'Laptop-kader: joystick hoort weg te zijn (fijne pointer) — welke besturing zie je?',
        ['.explore-pause']);
    });
    if (!isPad) {
      await scene(page, 'camera-attempts', async () => {
        const box = await page.locator('canvas#scene').boundingBox();
        if (!box) throw new Error('no canvas');
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        // F-16: a real wheel-in DOLLIES the walk boom toward its floor. −800 · 0.01 =
        // −8 m from the 4.6 m default → clamps to zoom.min; the frame comes in close.
        // 700 ms lets the ~0.3 s position-damp all but settle so cam.dist reads clean.
        await page.mouse.wheel(0, -800); await settle(page, 700);
        await snap(page, 'camera-zoom-in', 'Laptop-camera', 'Scroll inzoomen — de dolly haalt het beeld dichterbij; cam.zoom.dist op de min-clamp, FOV onveranderd (F-16).');
        // wheel-out the other way: +1400 · 0.01 = +14 m → clamps to zoom.max, pull-back.
        await page.mouse.wheel(0, 1400); await settle(page, 700);
        await snap(page, 'camera-zoom-out', 'Laptop-camera', 'Scroll uitzoomen — de dolly trekt terug naar de max-clamp; cam.dist duidelijk groter, FOV nog steeds vast (F-16).');
        // F-17: a >6 px drag ORBITS the lens (yaw + eye-lift) and must NOT move the ranger
        // — the Run A defect was this same drag relocating `pos` 0.93 m and flipping the
        // view 180°. down at centre, 12×18 px = 216 px right, up: cam.yaw swings ~1 rad and
        // cam.orbit.yaw ≠ 0 while `pos` holds (compare the camera-zoom-out shot's pos). 700
        // ms lets the ~0.18 s orbit ease settle so cam.yaw reads clean.
        await page.mouse.move(cx, cy); await page.mouse.down();
        for (let i = 1; i <= 12; i++) { await page.mouse.move(cx + i * 18, cy); await page.waitForTimeout(20); }
        await page.mouse.up(); await settle(page, 700);
        await snap(page, 'camera-orbit', 'Laptop-camera', 'Slepen om te draaien (orbit) — cam.yaw draait ~1 rad, cam.orbit.yaw ≠ 0, en pos blijft gelijk: geen teleport meer (F-17, #4).');
        // F-17 seam, other half: a CLEAN click (no drag) still walks. The +1400 zoom-out
        // above left the walk boom at its ~9.5 m max, which flattens the follow cam toward
        // level (eye 2.4 m, lookAt 1.1 m → pitch ~7.8° down, horizon ~36% from the top): a
        // 32%-from-top ray then cleared the horizon into SKY and hit no ground, so the click
        // set no walk target and `pos` never moved — the P2.2 grade's harness-aim bug, NOT
        // the (correct) World.ts click-vs-drag seam. Fix, harness-only: dolly the boom back
        // toward the F-05 default (~4.6 m) to restore the downward walk-cam pitch, then click
        // LOW (60% down — well below the horizon at EITHER zoom) so walkToPointer's ground
        // raycast lands and `pos` shifts vs the camera-orbit shot: the clean click still
        // walks while the drag only orbited (§3 tap-to-walk seam, both sides asserted). The
        // held orbit yaw is harmless here — it rotates WHICH ground point is hit, not whether
        // one is; and any prop the low ray happens to catch (board/jeep) also sets a walk
        // target, so `pos` shifts either way.
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -500); await settle(page, 700); // dolly ~9.5 → ~4.5 m
        await page.mouse.click(cx, box.y + box.height * 0.60); await settle(page, 1800);
        await snap(page, 'camera-click-walk', 'Laptop-camera', 'Schone klik (geen sleep) — de ranger loopt naar het punt en pos verschuift, dus tik-om-te-lopen leeft nog (F-17).');
      });
    }
    // pause hub — opened over the LIVE world (last scene of the group).
    await scene(page, 'pause-hub', async () => {
      await press(page, isPad, page.locator('.explore-pause'));
      await settle(page, 400);
      await snap(page, 'pause-hub', 'Pauze/menu', 'Pauze-menu — is er een duidelijke "terug/hoofdmenu"? (punch-list #5)',
        ['.lodge-links .ra-chip', '.ph-back']);
    });
  });

  // ══ GROUP 2 — jeep: boot → walk to it (touch on iPad), climb in, drive burst
  //    (steering test #3), climb back out. Own fresh page. ══
  await runGroup('jeep', {}, async (page, stick) => {
    await bootWorld(page, isPad);
    await scene(page, 'jeep', async () => {
      const placed = await hook(page, (r) => r.vehicle()?.placed ?? false);
      if (!placed) throw new Error('vehicle not placed in world');
      await walkToJeep(page, isPad, stick);
      await snap(page, 'jeep-near', 'Jeep', 'Bij de jeep — model + "Stap in"-affordance.');
      await enterJeep(page, isPad);
      await waitFor(page, (r) => r.vehicle()?.inVehicle ?? false, 15_000);
      await settle(page, 700);
      await snap(page, 'jeep-in', 'Jeep', 'In de jeep — camerakader, blur/DOF, is het model helder? (#3)');
      try {
        // F-32 TURN control condition — throttle + ONE steer held (laptop
        // ArrowUp+ArrowLeft; iPad joystick up-left, throttle y=1 steer x=−1). With the
        // speed-scaled steering the jeep now turns AS it drives: veh.headingUnwrapped
        // must change MONOTONICALLY across the burst (a real, comfortable ~0.6 rad/s
        // turn) and consecutive frames differ in pixels — no more doughnut-in-place.
        await holdDriveTurn(page, isPad, stick);
        try {
          for (let i = 1; i <= 4; i++) {
            await settle(page, 350);
            await snap(page, `jeep-drive-${i}`, 'Jeep (burst)', `Rijframe ${i}/4, gas + stuur — draait de heading gestaag mee? (F-32 stuur)`);
          }
        } finally { await releaseDriveTurn(page, isPad, stick); }
        // F-32 NO-TURN control condition — throttle ONLY, no steer, ~3 s. The contrast
        // that makes the turn burst meaningful: veh.headingUnwrapped must stay ~flat
        // (drift ≈ 0) while driving straight — steering only turns on real steer input,
        // never on its own (the audit's "always-circling jeep" is refuted by the pair).
        await holdForward(page, isPad, stick);
        try {
          await settle(page, 400);
          await snap(page, 'jeep-straight-1', 'Jeep (recht)', 'Gas, geen stuur — start; heading mag NIET vanzelf driften (F-32 controle).');
          await settle(page, 2600);
          await snap(page, 'jeep-straight-2', 'Jeep (recht)', 'Gas, geen stuur, 3 s later — unwrapped heading ~gelijk: recht vooruit, geen doughnut.');
        } finally { await releaseForward(page, isPad, stick); }
      } finally {
        // always climb back out (defensive — the group's page is closed after,
        // but keep the exit path exercised + the state clean).
        if (await hook(page, (r) => r.vehicle()?.inVehicle ?? false)) {
          await exitJeep(page, isPad).catch(() => {});
          await waitFor(page, (r) => !(r.vehicle()?.inVehicle ?? false), 10_000).catch(() => {});
        }
      }
    });
  });

  // ══ GROUP 3 — board → a 3D mission in-place. Own fresh page (this is exactly
  //    the leg that killed the iPad run in Run A — now isolated + touch-walked). ══
  await runGroup('board', {}, async (page, stick) => {
    await bootWorld(page, isPad);
    await scene(page, 'mission-board', async () => {
      await walkToBoard(page, isPad, stick);
      await settle(page, 300);
      await snap(page, 'board-affordance', 'Missiebord', 'Bij het bord — is de "open"-affordance leesbaar/groot genoeg?');
      const open = page.locator('.explore-board-open');
      await open.waitFor({ timeout: 10_000 });
      await press(page, isPad, open);
      await page.locator('.mission-board').waitFor({ timeout: 10_000 });
      await snap(page, 'board-open', 'Missiebord', 'Missiebord open — layout, leesbaarheid, tap-doelen.', ['.mb-back']);
    });
    await scene(page, 'mission-3d', async () => {
      // BOUNDED waits (P0.3/F-34a). `showMissionBoard` renders `.mission-board`
      // and its `.mission-card`s together in one node, so a card that is not
      // actionable within a short window is itself a finding — NOT a reason to
      // spend the whole 30-min test budget on one unbounded click and starve
      // the reduce-motion group that runs after this one. Run A's stall was
      // exactly this: an unbounded `.mission-card` click hung 1_800_000 ms and
      // RM captured nothing. A bounded wait turns that into a quick GAP (caught
      // by `scene`), and the flow reaches reduce-motion.
      const firstCard = page.locator('.mission-card').first();
      await firstCard.waitFor({ state: 'visible', timeout: 15_000 });
      await press(page, isPad, firstCard, 15_000);
      const go = page.getByRole('button', { name: 'Ga op pad' });
      await go.waitFor({ state: 'visible', timeout: 15_000 });
      await press(page, isPad, go, 15_000);
      await waitFor(page, (r) => r.missionView === '3d', 25_000);
      await settle(page, 1000);
      await snap(page, 'mission-3d', 'Missie', 'Missie speelt 3D in-place — hoe ziet een echte opdracht eruit?',
        ['.zoeken-speak', '.ra-speak']);
    });
  });

  // ══ GROUP 4 — reduce-motion world (OS media set before boot). Own fresh page:
  //    a clean first-run boot, so the F-34a returning-player stall cannot bite. ══
  await runGroup('reduce-motion', { reduce: true }, async (page) => {
    await scene(page, 'reduce-motion', async () => {
      await bootWorld(page, isPad);
      await settle(page, 1200);
      await snap(page, 'reduce-motion-world', 'Reduce-Motion', 'Verminder-beweging AAN — ziet de wereld er nog goed uit of plat/kapot?');
    });
  });

  flush();
  attachSummary(testInfo, shots);
});

// ── helpers ──────────────────────────────────────────────────────────────────
/**
 * P3.1: measure each selector's live boxes and return the SMALLEST visible one
 * (the worst case for the ≥56px floor). `minW`/`minH` grade "each ≥56"; `box`
 * (the offending element's position + size) grades F-01's inside-the-viewport
 * check. A selector with no visible match returns count 0 / box null — itself a
 * finding (the control the assert expects was not on screen).
 */
async function measureTaps(page: Page, selectors: string[]): Promise<Record<string, TapBox>> {
  const round = (v: number): number => Math.round(v * 10) / 10;
  const out: Record<string, TapBox> = {};
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count();
    let minW = Infinity, minH = Infinity, visible = 0;
    let worst: { x: number; y: number; w: number; h: number } | null = null;
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      if (!b) continue;
      visible += 1;
      if (b.width < minW) minW = b.width;
      if (b.height < minH) { minH = b.height; worst = { x: b.x, y: b.y, w: b.width, h: b.height }; }
    }
    out[sel] = {
      count: visible,
      minW: visible ? round(minW) : 0,
      minH: visible ? round(minH) : 0,
      box: worst ? { x: Math.round(worst.x), y: Math.round(worst.y), w: Math.round(worst.w), h: Math.round(worst.h) } : null,
    };
  }
  return out;
}
function attachSummary(testInfo: TestInfo, shots: Annotation[]): void {
  const gaps = shots.filter((s) => !s.ok).length;
  testInfo.annotations.push({ type: 'capture', description: `${shots.length} shots, ${gaps} gaps` });
}
/** A page/renderer death — bubble it so a group can spend its one crash-retry. */
function isCrash(e: unknown): boolean {
  return /been closed|is closed|has crashed|Target crashed|Target page|Target closed/i.test(String(e));
}
/** Tap on the iPad (genuine touch), click on the laptop. Pass `timeout` to BOUND
 *  the action: an unbounded press auto-waits for actionability up to the WHOLE
 *  30-min test timeout if its target never becomes actionable — which is exactly
 *  what ate Run A's reduce-motion capture (P0.3/F-34a: the `.mission-card` click
 *  hung 30 min and every group after it, incl. reduce-motion, got nothing). */
async function press(
  page: Page, isPad: boolean, locator: ReturnType<Page['locator']>, timeout?: number,
): Promise<void> {
  const opts = timeout != null ? { timeout } : undefined;
  if (isPad) await locator.tap(opts); else await locator.click(opts);
}
/** Silent boot into the world (groups 2–4 don't re-snap title/avatar). Mirrors
 *  main.ts:90 (F-34a): after "Begin" a true first run mounts the avatar-maker,
 *  but a RETURNING player (persisted `avatarGemaakt`) drops STRAIGHT into the
 *  world — the "Dit is mijn ranger" button never renders. Blocking on that
 *  button unconditionally is the stall that ate Run A's reduce-motion capture
 *  (~30 min waiting for a control that can't exist). `passAvatarMaker` branches
 *  on which boot this actually is, so boot() is correct for BOTH paths — not
 *  merely side-stepped by the per-group save-clear. */
async function bootWorld(page: Page, isPad: boolean): Promise<void> {
  await page.goto('/');
  await press(page, isPad, page.getByRole('button', { name: 'Begin' }));
  await passAvatarMaker(page, isPad);
  await waitForWorld(page);
}
/** Click through the avatar-maker on a first run; skip it for a returning player
 *  who boots straight to the world (main.ts:90). Polls for whichever outcome
 *  this boot produces, so neither path can block for the whole test timeout on
 *  the other path's UI (F-34a). */
async function passAvatarMaker(page: Page, isPad: boolean): Promise<void> {
  const confirm = page.getByRole('button', { name: 'Dit is mijn ranger' });
  const start = Date.now();
  for (;;) {
    if (await confirm.isVisible()) { await press(page, isPad, confirm); return; }
    if (await hook(page, (r) => r.screen === 'world')) return; // returning player
    if (Date.now() - start > 40_000) { await press(page, isPad, confirm); return; }
    await page.waitForTimeout(150);
  }
}
async function waitForWorld(page: Page): Promise<void> {
  await waitFor(page, (r) => r.screen === 'world', 40_000);
}
async function waitFor(page: Page, pred: (r: Hook) => boolean, timeout: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await hook(page, pred)) return;
    if (Date.now() - start > timeout) throw new Error(`waitFor timed out after ${timeout} ms`);
    await page.waitForTimeout(250);
  }
}
async function settle(page: Page, ms: number): Promise<void> { await page.waitForTimeout(ms); }

// ── locomotion: keyboard on laptop, JOYSTICK-via-touch on the iPad ────────────

/**
 * The on-screen joystick driven by GENUINE touch (CDP `Input.dispatchTouchEvent`).
 * `ux` = screen-right (+), `uy` = screen-forward (+, = up), matching `input.ts`'s
 * `joystickVector` convention (thumb offset `(ux·r, −uy·r)` from the ring centre).
 * The touchStart lands at the ring centre (so `onDown` fires + captures), then the
 * thumb slides to the steer offset — held down until `release`.
 */
class TouchStick {
  private down = false;
  private cx = 0; private cy = 0; private r = 1;
  constructor(private readonly cdp: CDPSession) {}
  private async acquire(page: Page): Promise<void> {
    const box = await page.locator('.rj-base').boundingBox();
    if (!box) throw new Error('joystick (.rj-base) not visible for touch drive');
    this.cx = box.x + box.width / 2;
    this.cy = box.y + box.height / 2;
    this.r = box.width / 2;
  }
  async hold(page: Page, ux: number, uy: number): Promise<void> {
    await this.acquire(page);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: this.cx, y: this.cy }] });
    this.down = true;
    await this.steer(ux, uy);
  }
  async steer(ux: number, uy: number): Promise<void> {
    if (!this.down) return;
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: this.cx + ux * this.r, y: this.cy - uy * this.r }],
    });
  }
  async release(): Promise<void> {
    if (!this.down) return;
    this.down = false;
    try { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } catch { /* page gone */ }
  }
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
/** Project a world delta onto the camera-relative screen axes (the inverse of
 *  `toWorld`): `sx` = screen-right, `sYf` = screen-forward. Shared by both the
 *  keyboard walk (→ arrow keys) and the joystick walk (→ thumb offset). */
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Camera-relative walk toward a world target. Keyboard (laptop) or joystick
 *  touch (iPad) — same geometry, so the iPad reaches the board/jeep as reliably
 *  as the laptop did (F-21: iPad locomotion must be touch, never `page.keyboard`). */
async function walkTo(
  page: Page,
  isPad: boolean,
  stick: TouchStick | null,
  target: () => Promise<{ x: number; z: number; near: boolean } | null>,
  budget = 200,
): Promise<void> {
  if (isPad) return joystickWalkTo(page, stick!, target, Math.min(budget, 160));
  return keyboardWalkTo(page, target, budget);
}

async function keyboardWalkTo(
  page: Page,
  target: () => Promise<{ x: number; z: number; near: boolean } | null>,
  budget: number,
): Promise<void> {
  const down = new Set<string>();
  const sync = async (want: Set<string>) => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < budget; i++) {
      const t = await target();
      if (t?.near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || !t || yaw == null) { await page.waitForTimeout(100); continue; }
      const { sx, sYf } = screenDir(t.x - p.x, t.z - p.z, yaw);
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    throw new Error('never reached target within step budget');
  } finally { await sync(new Set()).catch(() => {}); }
}

async function joystickWalkTo(
  page: Page,
  stick: TouchStick,
  target: () => Promise<{ x: number; z: number; near: boolean } | null>,
  budget: number,
): Promise<void> {
  await stick.hold(page, 0, 1); // start moving; re-steered immediately below
  try {
    for (let i = 0; i < budget; i++) {
      const t = await target();
      if (t?.near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || !t || yaw == null) { await page.waitForTimeout(120); continue; }
      const { sx, sYf } = screenDir(t.x - p.x, t.z - p.z, yaw);
      const mag = Math.hypot(sx, sYf) || 1;
      await stick.steer(sx / mag, sYf / mag);
      await page.waitForTimeout(140);
    }
    throw new Error('joystick walk never reached target within step budget');
  } finally { await stick.release(); }
}

async function walkToBoard(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  await walkTo(page, isPad, stick, () => hook(page, (r) => r.board()));
}
async function walkToJeep(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  await walkTo(page, isPad, stick, () => hook(page, (r) => {
    const v = r.vehicle();
    return v ? { x: v.x, z: v.z, near: v.near } : null;
  }));
}

/** Hold "forward" for a walk burst: laptop ArrowUp, iPad joystick straight up. */
async function holdForward(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  if (isPad) await stick!.hold(page, 0, 1); else await page.keyboard.down('ArrowUp');
}
async function releaseForward(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  if (isPad) await stick!.release(); else await page.keyboard.up('ArrowUp').catch(() => {});
}

/** Hold "throttle forward + steer one way" for the drive burst: laptop
 *  ArrowUp+ArrowLeft, iPad joystick up-left (throttle y=1, steer x=−1). */
async function holdDriveTurn(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  if (isPad) { await stick!.hold(page, -1, 1); return; }
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
}
async function releaseDriveTurn(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  if (isPad) { await stick!.release(); return; }
  await page.keyboard.up('ArrowUp').catch(() => {});
  await page.keyboard.up('ArrowLeft').catch(() => {});
}

/** Board / leave the jeep: iPad taps the affordance, laptop presses Space. */
async function enterJeep(page: Page, isPad: boolean): Promise<void> {
  if (isPad) {
    const enter = page.locator('.explore-vehicle-enter');
    await enter.waitFor({ timeout: 10_000 });
    await enter.tap();
  } else {
    await page.keyboard.press('Space');
  }
}
async function exitJeep(page: Page, isPad: boolean): Promise<void> {
  if (isPad) {
    const exit = page.locator('.explore-vehicle-exit');
    await exit.waitFor({ timeout: 10_000 });
    await exit.tap();
  } else {
    await page.keyboard.press('Space');
  }
}
