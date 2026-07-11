import { test, type Page, type TestInfo, type CDPSession, type BrowserContext } from '@playwright/test';
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
 *   jeep near/in/drive burst · mission board · a 3D mission · reduce-motion world
 *   through BOTH gates (OS media AND the in-game "Rustige beweging" toggle, F-34b).
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
  // `avatarScreen.visible` (F-11) is occlusion-aware: onScreen AND he is NOT hidden
  // behind terrain (a rim berm / crest standing between lens and ranger) AND not
  // faded — the boundary-rim assert reads it, so an all-terrain "ranger nowhere in
  // frame" edge shot fails the annotation the way onScreen/heightFrac (projection
  // only) cannot.
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
  // D1.3 mission-entry camera truth: `groundAtCam` is the RENDERED-terrain height (raycast
  // ground-snap) under the lens — the game-3d assert reads `cam.y > groundAtCam` so a
  // below-terrain reframe (fresh simon-3D `cam.y` −1.29, up-tilt) is caught as no-evidence.
  // `taskInView` = the running activity's task staging sits in the live frustum (true on a
  // game-3d entry landed on its playfield; null in free-roam) — an off-field/backside frame
  // reads false. Pixels stay the court of appeal (§4).
  cam: { dist: number; yaw: number; pitch: number; x: number; y: number; z: number; target: string; avatarInView: boolean; avatarOpacity: number; avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number; visible: boolean }; landmarkInView: boolean; groundAtCam: number; taskInView: boolean | null; fov: number; zoom: { dist: number; min: number; max: number }; orbit: { yaw: number; lift: number } } | null;
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
  // RUN-3 P5.2 (F-34c): the RM-judgeability pixel-diff. `ratio` is the fraction of
  // pixels (0..1) that DIFFER from a named reference frame `vs`, measured in-browser
  // on a coarse grid (blink/AA-noise-tolerant; no image-lib dep — pngjs/pixelmatch
  // are absent). The reduce-motion group reads it two ways: ≈0 across the RM IDLE PAIR
  // (secondary motion frozen — skyTime stops, so clouds/grass/water/bird hold) and vs
  // the pre-toggle normal still (nothing STRUCTURAL differs, only the invisible-in-a-
  // still temporal policy), and ≫0 across the RM WALK BURST (§1e keepLocomotion — the
  // ranger still walks, so consecutive frames move). null when no reference was given.
  pixelDiff: { vs: string; ratio: number } | null;
  // RUN-3 P3.1 (F-01/F-02/F-14/F-20/F-25/F-28): live DOM tap-target measurements.
  // Per named-control selector, the SMALLEST visible box (`minW`/`minH`) across all
  // matches + that worst element's `box`. The ≥56px assert reads `minW`/`minH` ≥ 56
  // for each control on the scene it lives on (Begin=title, swatches/chips/confirm=
  // avatar, Pauze=controls-hud, hub links=pause-hub, board-exit=board-open,
  // speaker=mission-3d). F-01 reads `taps['.av-klaar'].box` against `viewport` to
  // prove the confirm CTA sits fully inside the frame (no scroll). null off-scene.
  taps: Record<string, TapBox> | null;
  viewport: { width: number; height: number } | null;
  // P3.3 (F-06/F-15): the live onboarding-hint sequence. `active` is the SINGLE hint
  // on screen — 'walk' (entry control line), 'tap' (post-walk transient), 'boundary'
  // (P4.6 rim cue), or null. The world-entry shot reads active='walk' with the tracker
  // held back to prove ONE hint at entry (F-06); `helpChip` = the laptop "?" re-show
  // chip is mounted (F-15). `walkSeen`/`tapSeen` are the persisted one-time flags. null
  // before the world/hook is ready.
  hint: { active: string | null; walkSeen: boolean; tapSeen: boolean; helpChip: boolean } | null;
  // P4.6 (F-11): the world-rim state — `bound` (move-limit radius, m), the ranger's
  // live `dist` from world centre, and `atRim` (pressed against the rim heading out,
  // the "Hier stopt het bos" cue fired). The boundary shot asserts `dist` ≤ `bound`
  // (clamped, never beyond) with `atRim` true after an outward walk — a gentle stop,
  // not an invisible wall. P5.5 adds `scatterMax` (furthest LOW ground-tuft radius —
  // heather/marram/reed): the rim shot asserts it ≤ `bound − RIM_TUFT_CLEAR` so that
  // class is cleared from the outer rim band and none floats at head height in the edge
  // frame. null off-world / before the hook is ready.
  boundary: { bound: number; dist: number; atRim: boolean; scatterMax: number } | null;
  // P1.0 (F-19): the case-board hub — world x/z, live proximity (`near`), and whether
  // the board FACE/papers point sits in the live view frustum (`inFrustum`). The
  // board-affordance assert reads `inFrustum` TRUE while `near` to prove the approach
  // framing swings the lens off the ranger's spine so the board is actually in shot at
  // believable scale (with avatar.height ∈ [1.5,2.0]). null off-world / before boot.
  board: { x: number; z: number; near: boolean; inFrustum: boolean } | null;
  // RUN-3 P5.3 (F-34d): the live `.rm` <body> class (reduced-motion.ts mirrors
  // prefersReducedMotion() onto it). Recorded on EVERY shot so the "`.rm` via BOTH
  // gates" assert grades off the DOM truth: true on the OS-media group (`reduce-motion`,
  // applyReducedMotionClass at boot) AND on the in-game-toggle group (`reduce-motion-
  // toggle`, setReducedMotionOverride), false on every normal-mode shot. null when the
  // DOM probe was skipped/failed (never fails the shot, cf. taps). Pairs with the RM
  // reframe triple below (cam.dist + pixelDiff) that proves the camera CUTS, not eases.
  rm: { bodyClass: boolean } | null;
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
  cam(): { dist: number; yaw: number; pitch: number; x: number; y: number; z: number; target: string; avatarInView: boolean; avatarOpacity: number; avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number; visible: boolean }; landmarkInView: boolean; groundAtCam: number; taskInView: boolean | null; fov: number; zoom: { dist: number; min: number; max: number }; orbit: { yaw: number; lift: number } } | null;
  board(): { x: number; z: number; near: boolean; inFrustum: boolean } | null;
  vehicle(): { placed: boolean; near: boolean; inVehicle: boolean; x: number; z: number; heading: number; headingUnwrapped: number; speed: number; driverHidden: boolean } | null;
  hint(): { active: string | null; walkSeen: boolean; tapSeen: boolean; helpChip: boolean } | null;
  boundary(): { bound: number; dist: number; atRim: boolean; scatterMax: number } | null;
  // D1.0(b): win the active 3D mission step via its GENUINE resolve path; true if
  // one was pending. Lets the player-path game-3d group advance past a first step
  // to reach dagnacht/wisselen (never a first step) — the same dev hook the frozen
  // chain.spec.ts drives. Dev-only (`?dev=1`/DEV), so present in the capture build.
  winStep(): boolean;
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
   *  `a.taps` so the ≥56px / inside-viewport asserts grade off real DOM geometry.
   *  `diffAgainst` (P5.2/F-34c) diffs THIS shot against a reference frame's PNG and
   *  records the fraction of changed pixels into `a.pixelDiff` — the RM-judgeability
   *  signal (≈0 for the frozen idle pair, ≫0 for the kept-locomotion walk burst).
   *  Returns the captured PNG buffer (null on a failed capture) so the caller can
   *  chain it as the next shot's `diffAgainst`. */
  async function snap(
    page: Page, name: string, group: string, note: string,
    tapSelectors?: string[], diffAgainst?: { buf: Buffer; label: string },
  ): Promise<Buffer | null> {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    const a: Annotation = {
      name, platform, group, note, ok: true, file: `${platform}/${file}`,
      screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
      pixelHash: null, pixelDiff: null, taps: null, viewport: null, hint: null, boundary: null, board: null, rm: null,
    };
    let png: Buffer | null = null;
    try {
      const s = await hook(page, (r) => {
        const v = r.vehicle();
        return {
          screen: r.screen, missionView: r.missionView, pos: r.pos(),
          cameraYaw: r.cameraYaw(), drawCalls: r.drawCalls(), clip: r.clip(), avatar: r.avatar(), groundSpeed: r.groundSpeed(), cam: r.cam(), version: r.version,
          veh: v && v.inVehicle ? { heading: v.heading, headingUnwrapped: v.headingUnwrapped, speed: v.speed, inVehicle: v.inVehicle, driverHidden: v.driverHidden } : null,
          hint: r.hint(),
          boundary: r.boundary(),
          board: r.board(),
        };
      });
      if (s) { Object.assign(a, s); version = s.version; }
      // F-18 pixel court of appeal: `screenshot({path})` writes the PNG AND returns
      // its bytes — hash them so the grade can prove pose stability from the RENDER
      // (idle pair hashes equal) instead of trusting the hook that lied in Run A (§4).
      png = await page.screenshot({ path: path.join(dir, file) });
      a.pixelHash = createHash('md5').update(png).digest('hex');
      // P5.2 (F-34c): the RM-judgeability pixel-diff vs a caller-supplied reference.
      // Non-fatal (like the tap probe): a diff failure leaves pixelDiff null but keeps
      // the screenshot + hash, so a graphics quirk in the in-browser decode can never
      // downgrade a valid shot to a GAP.
      if (diffAgainst) {
        try { a.pixelDiff = { vs: diffAgainst.label, ratio: await pixelDiffRatio(page, diffAgainst.buf, png) }; }
        catch { /* keep the shot even if the canvas diff throws */ }
      }
    } catch (e) {
      // D1.0 (2026-07-05): a renderer/page death mid-shot must BUBBLE so the enclosing
      // group can spend its one crash-retry in a fresh page — the box's (a) retry has to
      // "absorb" the browser-closed protocol error that killed `game3d-zoeken` at 15:21.
      // Swallowing it here (the old behaviour) both stranded that retry AND left `a.file`
      // pointing at a `NN-<name>.png` the failed `screenshot()` never wrote (the D1.0 grade's
      // "referenced but ABSENT on disk" finding). So: re-throw a crash; on a NON-crash
      // capture failure keep the honest GAP shot but DROP its `file` claim so no annotation
      // ever names a PNG that is not on disk (D1.0(c): the fresh set must equal the fresh
      // annotations). `scene`/`runGroup` catch the re-thrown crash and roll back cleanly.
      if (isCrash(e) || page.isClosed()) throw e;
      a.ok = false; a.file = ''; a.note = `${note}  [CAPTURE FAILED: ${String(e).slice(0, 140)}]`;
    }
    // P3.1 tap-target geometry — supplementary; a measurement miss is its own
    // signal (a control absent when it should be present) and never fails the shot.
    if (tapSelectors && tapSelectors.length) {
      try { a.taps = await measureTaps(page, tapSelectors); a.viewport = page.viewportSize(); }
      catch { /* keep the screenshot + hook state even if the DOM probe throws */ }
    }
    // P5.3 (F-34d): record the live `.rm` body class so the "`.rm` via both gates"
    // assert reads the DOM truth (reduced-motion.ts owns the class), not a hook that
    // could drift. Supplementary like taps — a probe miss leaves rm null, never a GAP.
    try { a.rm = { bodyClass: await page.evaluate(() => document.body.classList.contains('rm')) }; }
    catch { /* keep the screenshot + hook state even if the class probe throws */ }
    shots.push(a);
    flush();
    return png;
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
        pixelHash: null, pixelDiff: null, taps: null, viewport: null, hint: null, boundary: null, board: null, rm: null,
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
   *
   * D1.0(a): each group also runs under a WALL-CLOCK budget (`opts.budgetMs`, 5 min
   * default). One slow/wedged group can no longer eat the whole test timeout and
   * starve the groups after it — the Run C 11:27 timeout was the `ven` walk plus a
   * newPage hang pushing the TOTAL past the cap, taking the later groups down with
   * it. On a budget overrun the group's page is closed and it is recorded as a
   * "deels vastgelegd" GAP — the frames it ALREADY flushed are KEPT (honest partial
   * evidence) and the flow moves on. A budget overrun is NOT retried (a slow group
   * would just overrun again); the crash-retry path below is unchanged.
   */
  async function runGroup(
    label: string,
    opts: { reduce?: boolean; budgetMs?: number },
    body: (page: Page, stick: TouchStick | null) => Promise<void>,
  ): Promise<void> {
    const budgetMs = opts.budgetMs ?? 300_000;
    // D1.4: MEASURE the headless runtime per group so budgets are balanced against
    // reality, not guessed — the box's core lesson (throttled rAF makes walks/eases
    // crawl, so a budget sized for a 60 fps device GAPs under capture load). The
    // per-group elapsed is logged at every exit below (done / GAP / retry); the audit
    // reads these from the capture stdout to see exactly which group is near its budget.
    const groupStart = Date.now();
    const elapsedS = (): number => Math.round((Date.now() - groupStart) / 1000);
    for (let attempt = 1; attempt <= 2; attempt++) {
      const nAtStart = n, shotsAtStart = shots.length;
      let page: Page | null = null;
      let stick: TouchStick | null = null;
      let run: Promise<void> | null = null;
      let budgetHit = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // F-21 (P4.7 unblock): `context.newPage()` itself can throw OR HANG with a
        // `Target.createTarget` protocol error once the software renderer is under
        // memory pressure from the earlier groups — Run B's P4.7 capture lost the
        // whole board + mission scene set to exactly this at this line (a 30-min
        // hang killed the run before `.mission-board` could be re-shot for F-29).
        // Open the group's page through a bounded, backed-off retry, INSIDE the
        // try, so a total failure degrades to this group's crash-retry / GAP and
        // the later groups still run — never a fatal, uncaught newPage.
        page = await openGroupPage(context);
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
        // D1.0(a): race the group body against its wall-clock budget. The body's
        // scenes flush to disk as they go, so a budget overrun still leaves the
        // frames captured before it — the loser of the race is swallowed (`.catch`)
        // so a late rejection after the timeout never goes unhandled.
        run = body(page, stick);
        run.catch(() => {});
        await Promise.race([
          run,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              budgetHit = true;
              reject(new Error(`group "${label}" exceeded its ${Math.round(budgetMs / 1000)}s budget`));
            }, budgetMs);
          }),
        ]);
        clearTimeout(timer);
        await page.close();
        // eslint-disable-next-line no-console
        console.log(`[capture] group "${label}" done in ${elapsedS()}s (budget ${Math.round(budgetMs / 1000)}s)`);
        return; // group done
      } catch (e) {
        clearTimeout(timer);
        await page?.close().catch(() => {});
        if (budgetHit) {
          // Budget overrun: KEEP the scenes already flushed (real evidence). Let the
          // body fully unwind after the page closed (its in-flight ops reject) so no
          // shot lands after the marker, then record ONE "deels vastgelegd" GAP and
          // move on — no retry, and never a rollback of good frames.
          await Promise.resolve(run).catch(() => {});
          // eslint-disable-next-line no-console
          console.log(`[capture] group "${label}" GAP: budget overrun at ${elapsedS()}s (budget ${Math.round(budgetMs / 1000)}s) — RAISE this group's budget or make the scene cheaper`);
          shots.push({
            name: label, platform, group: 'GAP', ok: false, file: '',
            note: `Groep "${label}" overschreed het tijdbudget (~${Math.round(budgetMs / 1000)}s) en is deels vastgelegd — dit is zelf een audit-bevinding; de latere groepen lopen door.`,
            screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
            pixelHash: null, pixelDiff: null, taps: null, viewport: null, hint: null, boundary: null, board: null, rm: null,
          });
          flush();
          return;
        }
        // discard this attempt's partial shots so the retry (or the GAP) is clean
        n = nAtStart; shots.length = shotsAtStart; flush();
        if (attempt === 1 && isCrash(e)) {
          // eslint-disable-next-line no-console
          console.log(`[capture] group "${label}" lost the renderer at ${elapsedS()}s — retrying once: ${String(e).slice(0, 100)}`);
          continue;
        }
        // eslint-disable-next-line no-console
        console.log(`[capture] group "${label}" GAP at ${elapsedS()}s: ${String(e).slice(0, 100)}`);
        shots.push({
          name: label, platform, group: 'GAP', ok: false, file: '',
          note: `Groep "${label}" kon niet worden vastgelegd: ${String(e).slice(0, 200)} — dit is zelf een audit-bevinding.`,
          screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, avatar: null, groundSpeed: null, cam: null, veh: null,
          pixelHash: null, pixelDiff: null, taps: null, viewport: null, hint: null, boundary: null, board: null, rm: null,
        });
        flush();
        return;
      }
    }
  }

  // ══ GROUP 1 — intro: title → avatar → world → walk burst → controls → pause hub
  //    → title-return. Own fresh page. (The laptop dolly-zoom scene moved to its own
  //    fresh-boot GROUP 1b below so it shoots from the un-sunk spawn, not the sink.) ══
  await runGroup('intro', { budgetMs: 540_000 }, async (page, stick) => {
    await scene(page, 'title', async () => {
      await page.goto('/');
      await page.locator('.boot-title').waitFor({ timeout: 30_000 });
      // P1.4: the real world props (tree line, prikbord, cabin) + the grounded
      // ranger swap in async over the primitive backdrop — GATE the snap on the
      // ranger landing (avatar.height reads on the dev hook). The rig is the
      // heaviest asset and loads concurrently with the props, so avatar>1 doubles
      // as "the title is dressed". Generous 25 s (matches the world load budget);
      // best-effort .catch so a zero-asset env still snaps rather than crashing.
      await page.waitForFunction(() => {
        const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
        return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 1);
      }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset safe */ });
      await settle(page, 900); // seat the idle pose + let any last tree pop in
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
      // P3.3 (F-06): the world opens with ONE hint. `.explore-onboard` is visible
      // (count 1), while the tap tip and the wayfinding tracker are held back
      // (count 0) until the first step — the hook's `hint.active` reads 'walk'.
      await snap(page, 'world-entry', 'Wereld', 'Eerste frame in de wereld — camera-kader + avatarschaal (punch-list #1); één hint (F-06).',
        ['.explore-onboard', '.explore-tip', '.explore-wayfind']);
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
        : 'Laptop-kader: joystick weg (fijne pointer) — de ≥56 px "?"-hulpchip toont de besturing (F-15).',
        ['.explore-pause', '.explore-help']);
    });
    // D1.1: the laptop dolly-zoom / orbit / click-walk scene MOVED OUT of the intro
    // group into its OWN fresh-boot group ('camera', below). It used to run HERE, after
    // the walk-burst drove the ranger ~48 m into the −z sink (P1.5a), then walked him
    // ALL THE WAY BACK to origin (walkTo budget 300) before the dolly could extend — a
    // ~300-iter, ~2 s/iter crawl under capture load that blew the intro group's 540 s
    // budget and GAPped the zoom pair entirely (zero camera-zoom frames). Shooting it
    // from a dedicated fresh spawn instead removes the walk-back: the ranger is at the
    // un-sunk clearing (0,0) with the full 9.5 m boom, so the pair settles + differs in
    // ~10 s (see GROUP 1b).
    // pause hub — opened over the LIVE world (last scene of the group).
    await scene(page, 'pause-hub', async () => {
      await press(page, isPad, page.locator('.explore-pause'));
      await settle(page, 400);
      await snap(page, 'pause-hub', 'Pauze/menu', 'Pauze-menu — is er een duidelijke "terug/hoofdmenu"? (punch-list #5)',
        ['.lodge-links .ra-chip', '.ph-hoofdmenu', '.ph-back']);
    });
    // F-27 (P3.2): the pause hub's "Naar het hoofdmenu" is the ONE exit below the
    // title — screen→'title' with NO password re-ask (in-app swap, not a reload),
    // and "Begin" restores the same avatar + progress (state.ts write-through).
    await scene(page, 'title-return', async () => {
      await press(page, isPad, page.locator('.ph-hoofdmenu'));
      await waitFor(page, (r) => r.screen === 'title', 15_000);
      await snap(page, 'title-return', 'Pauze/menu', 'Hoofdmenu vanuit de pauze — screen=title, geen wachtwoord opnieuw (F-27).',
        ['.ra-title-begin']);
      await press(page, isPad, page.locator('.ra-title-begin'));
      await waitFor(page, (r) => r.screen === 'world', 40_000);
      await settle(page, 600);
      await snap(page, 'title-return-world', 'Pauze/menu', 'Terug in de wereld na hoofdmenu — avatar + voortgang bewaard (F-27).');
    });
  });

  // ══ GROUP 1b — laptop camera: dolly-zoom PAIR (D1.1) + orbit + click-walk, on a
  //    DEDICATED fresh boot so the ranger stands at the un-sunk spawn clearing (0,0)
  //    with the full boom range. Laptop-only (the iPad leg has no wheel/trackpad
  //    dolly). Own page + a 240 s budget: no walk, but each of the ~6 settleCam waits can
  //    ride its 20 s best-effort backstop under the throttled-rAF capture load (D1.1/D1.4),
  //    so the old 180 s was too tight and the scene GAPped ("boom never settled") — 240 s
  //    covers the worst case with margin. Booting fresh is what makes the zoom pair reliable:
  //    the old placement (inside GROUP 1, after the walk-burst sink) needed a ~300-iter
  //    walk-BACK that blew the budget; here there is nothing to walk back from. ══
  if (!isPad) {
    await runGroup('camera', { budgetMs: 240_000 }, async (page) => {
      await bootWorld(page, false);
      await settle(page, 1500); // rig swap-in + follow-boom settle at spawn (cf. world-idle)
      await scene(page, 'camera-attempts', async () => {
        // Shoot the dolly pair from the fresh un-sunk spawn: the boom reaches its full
        // 9.5 m and the ranger is solid, so a SETTLED zoom-in vs zoom-out renders two
        // genuinely different frames. The old pair were identical PRE-SETTLE voids
        // (cam.dist 1.67 on BOTH while zoom.dist read 9.5 — the eased dolly caught before
        // it moved, direction doc §8.7). settleCam gates each snap on the eased boom
        // having STOPPED (steady-state |Δcam.dist| ≤ max(0.03 m, 0.4 %) ×2), so cam.dist
        // reads the DESTINATION framing, never a mid-ease value.
        await settleCam(page); // confirm the spawn follow-boom is steady before the first dolly
        const box = await page.locator('canvas#scene').boundingBox();
        if (!box) throw new Error('no canvas');
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        // Record the HORIZONTAL boom (lens→ranger in XZ) next to the 3D cam.dist so the
        // audit can read the settle-to-target directly: the player-set dolly `zoom.dist`
        // IS a horizontal boom, and the 3D `cam.dist` = hypot(boom, ~1.5 m fixed eye
        // height). At the far clamp the eye offset is negligible so cam.dist ≈ zoom.dist;
        // at the near clamp cam.dist sits the fixed ~1.5 m ABOVE zoom.dist while the
        // horizontal boom STILL ≈ zoom.dist — the true "dolly reached its destination"
        // proof on BOTH clamps (a pre-settle void would read boom 1.6 while zoom.dist 9.5).
        const boomNote = (a: Annotation): string => {
          const c = a.cam, p = a.pos;
          if (!c || !p) return '';
          const boom = Math.hypot(c.x - p.x, c.z - p.z);
          return `  [D1.1 settle: horizontale boom ${boom.toFixed(2)} m ≈ dolly ${c.zoom.dist.toFixed(2)} m; cam.dist ${c.dist.toFixed(2)} m = 3D lens→borst incl. vaste ~1,5 m ooghoogte.]`;
        };
        // F-16: a real wheel-in DOLLIES the walk boom toward its floor. −800 · 0.01 =
        // −8 m from the 4.6 m default → clamps to zoom.min; the frame comes in close.
        await page.mouse.wheel(0, -800); await settle(page, 150); await settleCam(page);
        await snap(page, 'camera-zoom-in', 'Laptop-camera', 'Scroll inzoomen (na camera-settle, geen pre-settle void) — de dolly staat op de min-clamp, FOV onveranderd (F-16). NB cam.dist leest ~1,5 m bóven zoom.dist door de vaste ooghoogte-offset (lens→bbox-midden); op de verre clamp valt dat weg en cam.dist ≈ zoom.dist.');
        const zin = shots[shots.length - 1];
        zin.note += boomNote(zin); flush();
        // wheel-out the other way: +1400 · 0.01 = +14 m → clamps to zoom.max, pull-back.
        // settleCam waits out the full ~1.5 s ease so cam.dist reaches ~9.6 (was caught at
        // 1.67 pre-settle) and the frame is the settled wide boom.
        await page.mouse.wheel(0, 1400); await settle(page, 150); await settleCam(page);
        await snap(page, 'camera-zoom-out', 'Laptop-camera', 'Scroll uitzoomen (na camera-settle) — de dolly trekt terug naar de max-clamp; cam.dist duidelijk groter en ≈ zoom.dist, FOV nog steeds vast (F-16).');
        const zout = shots[shots.length - 1];
        zout.note += boomNote(zout); flush();
        // D1.1 assert (HARD — stays hard even though settleCam is now best-effort, GATE-D1):
        // a settled dolly pair MUST render DIFFERENT frames. If the two share one pixelHash the
        // boom never moved (a pre-settle / clamped / wedged void) — and a best-effort settle that
        // rode its 20 s backstop must NEVER EXCUSE that. Fold it as an ok:false finding on BOTH
        // frames of the pair (the D1.3 no-GAP precedent: throwing would GAP the whole scene and
        // lose both zoom frames); a healthy settled dolly (near-clamp vs 9.5 m far-clamp) always
        // differs, so on a good run this is silent and both frames stay ok:true.
        if (zin.pixelHash && zout.pixelHash && zin.pixelHash === zout.pixelHash) {
          zin.ok = false; zout.ok = false;
          const finding = '  [D1.1: zoom-in en zoom-out delen één pixelHash — de dolly bewoog niet (pre-settle/geklemde/vastgelopen boom, óók niet geëxcuseerd door een best-effort settle); dit is zelf een audit-bevinding.]';
          zin.note += finding; zout.note += finding;
          flush();
        }
        // F-17: a >6 px drag ORBITS the lens (yaw + eye-lift) and must NOT move the ranger
        // — the Run A defect was this same drag relocating `pos` 0.93 m and flipping the
        // view 180°. down at centre, 12×18 px = 216 px right, up: cam.yaw swings ~1 rad and
        // cam.orbit.yaw ≠ 0 while `pos` holds (compare the camera-zoom-out shot's pos). 700
        // ms lets the ~0.18 s orbit ease settle so cam.yaw reads clean (the yaw ease, not the
        // dolly — cam.dist barely moves, so settleCam below just confirms the boom is steady).
        await page.mouse.move(cx, cy); await page.mouse.down();
        for (let i = 1; i <= 12; i++) { await page.mouse.move(cx + i * 18, cy); await page.waitForTimeout(20); }
        await page.mouse.up(); await settle(page, 700); await settleCam(page);
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
        await page.mouse.wheel(0, -500); await settle(page, 150); await settleCam(page); // dolly ~9.5 → ~4.5 m, settled
        await page.mouse.click(cx, box.y + box.height * 0.60); await settle(page, 1800);
        await snap(page, 'camera-click-walk', 'Laptop-camera', 'Schone klik (geen sleep) — de ranger loopt naar het punt en pos verschuift, dus tik-om-te-lopen leeft nog (F-17).');
      });
    });
  }

  // ══ GROUP 2 — jeep: boot → walk to it (touch on iPad), climb in, drive burst
  //    (steering test #3), climb back out. Own fresh page. D1.6: 540 s budget, sized for a
  //    CONVERGING body. The audit #2/#3 GAPs (421/420 → 721/720, always +1 s = the budget
  //    kill granularity) were NOT a slow body — they were the DIVERGENT walk-to-jeep: the
  //    old poll-correct-hold loop held the keys DOWN across each ~2 s starved poll, so the
  //    ranger overshot the near radius and ORBITED the jeep forever, eating any budget. The
  //    walkTo fix above (pulsed keys released BEFORE each read → an uncorrected leg can't
  //    exceed the near radius → no orbit) makes it converge; the other groups run 66–269 s
  //    and this one does more (walk + enter + two drive bursts + exit), so ~200–300 s is the
  //    honest converging measure and 540 s is ~2× headroom for headless variance — NOT the
  //    720 s that was only ever masking the orbit. The body stays fully bounded (walkTo
  //    iter-cap + every waitFor/settle bounded), so this ceiling only catches a real wedge. ══
  await runGroup('jeep', { budgetMs: 540_000 }, async (page, stick) => {
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
  //    the leg that killed the iPad run in Run A — now isolated + touch-walked). D1.4:
  //    explicit 420 s budget (was the 300 s default) — this group chains the most work
  //    behind one walk (walk-to-board + open + pick card + Ga op pad + 25 s 3d-wait +
  //    settle + stop), which overran 300 s under load and GAPped at GATE-D1. ══
  await runGroup('board', { budgetMs: 420_000 }, async (page, stick) => {
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
        ['.zoeken-speak', '.ra-speak', '.mission-pause']);
    });
    // F-26 (P3.2): a mission is no longer a one-way door — the persistent Pauze
    // opens a calm "Stop de missie" that returns to the open plek (screen→'world').
    await scene(page, 'mission-stopped', async () => {
      await press(page, isPad, page.locator('.mission-pause'));
      await press(page, isPad, page.locator('.mp-stop'));
      await waitFor(page, (r) => r.screen === 'world', 30_000);
      await settle(page, 600);
      await snap(page, 'mission-stopped', 'Missie', 'Na "Stop de missie" — terug op de open plek, screen=world (F-26).');
    });
  });

  // ══ GROUP 4 — reduce-motion via GATE 1: the OS media query (F-34b). `reduce:true`
  //    sets `emulateMedia({reducedMotion:'reduce'})` before boot. Own fresh page:
  //    a clean first-run boot, so the F-34a returning-player stall cannot bite. ══
  await runGroup('reduce-motion', { reduce: true }, async (page) => {
    await scene(page, 'reduce-motion', async () => {
      await bootWorld(page, isPad);
      await settle(page, 1200);
      await snap(page, 'reduce-motion-world', 'Reduce-Motion', 'Verminder-beweging AAN via de OS-gate — ziet de wereld er nog goed uit of plat/kapot?');
    });
  });

  // ══ GROUP 4b — reduce-motion via GATE 2: the IN-GAME toggle (F-34b), MADE
  //    JUDGEABLE (F-34c / P5.2). NO OS media (`{}`, not `{reduce:true}`) — boot a
  //    NORMAL world, snap a normal idle REFERENCE, then open Pauze → Instellingen and
  //    flip "Rustige beweging" (Tweaks.ts:42 → setReducedMotionOverride(true) →
  //    `body.rm`), return to the open plek and prove the RM world is JUDGEABLE, not
  //    merely present — the whole F-34 point (a lone RM still can only catch gross
  //    breakage; the policy is TEMPORAL). Three graded captures, all on the gate
  //    Floris actually uses on the iPad:
  //      • RM STILL vs the pre-toggle normal reference — nothing STRUCTURAL differs
  //        (pixelDiff ≈ 0: same world, only the invisible-in-a-still temporal policy
  //        changed; a flat/black/broken RM world would read large);
  //      • an IDLE PAIR — two frames ~2.5 s apart with NO input: secondary motion is
  //        frozen (World.ts `if (!reduced) skyTime += dt` stops the clock → clouds/
  //        grass/water/bird hold), so pixelDiff ≈ 0 (a normal-mode idle pair drifts);
  //      • a short WALK BURST — §1e keepLocomotion means the ranger STILL walks, so
  //        consecutive frames differ (pixelDiff ≫ 0, clip=walk): RM calms the world
  //        WITHOUT freezing the child's own movement.
  //    Also the set's ONLY capture of the Instellingen/Tweaks UI. Own fresh page
  //    (clean first-run → the toggle starts at its default OFF, so the flip genuinely
  //    arms RM instead of riding an OS setting). ══
  await runGroup('reduce-motion-toggle', {}, async (page, stick) => {
    await scene(page, 'reduce-motion-toggle', async () => {
      await bootWorld(page, isPad);
      // Settle to a clean idle, then snap the NORMAL-mode reference the RM still is
      // graded against — SAME page, spawn and pose, so the only thing the toggle can
      // change is temporal (invisible in a still) ⇒ the RM still must ≈ this frame.
      await settle(page, 1500);
      const normalRef = await snap(page, 'rm-ref-normal', 'Reduce-Motion',
        'Normale modus, stil — ijkbeeld. De RM-wereld hierna mag hier structureel NIET van afwijken (alleen beweging verandert, en dat zie je niet in een stilstaand beeld).');
      // Pauze → Instellingen. Every press is BOUNDED (P0.3/F-34a: an unbounded wait
      // on a control that never appears is what ate Run A's reduce-motion capture).
      await press(page, isPad, page.locator('.explore-pause'), 10_000);
      await press(page, isPad, page.locator('.ph-tweaks'), 10_000);
      const rm = page.locator('.tw-toggle[data-key="reducedMotion"]');
      await rm.waitFor({ state: 'visible', timeout: 10_000 });
      // Flip it ON (default OFF on a clean first-run boot; defensive if already on).
      if ((await rm.getAttribute('aria-checked')) !== 'true') await press(page, isPad, rm, 10_000);
      // Prove the in-game gate ENGAGED before shooting: setReducedMotionOverride(true)
      // adds `body.rm` (reduced-motion.ts) — the same class F-34d (P5.3) will assert.
      // Bounded poll (file idiom, cf. passAvatarMaker); a toggle that never arms RM
      // throws → `scene` records it as a GAP, never a mislabeled "RM" shot.
      let rmOn = false;
      for (let i = 0; i < 20; i++) {
        if (await page.evaluate(() => document.body.classList.contains('rm'))) { rmOn = true; break; }
        await page.waitForTimeout(150);
      }
      if (!rmOn) throw new Error('in-game "Rustige beweging" toggle did not engage body.rm');
      // Snap the Instellingen panel with the toggle now ON — the set's only view of
      // the Tweaks/settings UI (F-34 note) and evidence the in-game gate is armed.
      await snap(page, 'instellingen-rm', 'Reduce-Motion',
        'Instellingen — "Rustige beweging" AAN (de in-game gate die Floris op de iPad gebruikt).',
        ['.tw-toggle', '.tw-back']);
      // Klaar → pause hub → Terug naar de open plek → the RM world via the toggle gate.
      await press(page, isPad, page.locator('.tw-back'), 10_000);
      await press(page, isPad, page.locator('.ph-back'), 10_000);
      await waitForWorld(page);
      // (1) RM STILL — settle to idle, then diff against the normal reference. A near-
      // zero ratio proves nothing structural differs (world intact, not flat/black);
      // this frame also anchors the idle pair below.
      await settle(page, 1500);
      const rmIdle = await snap(page, 'reduce-motion-toggle-world', 'Reduce-Motion',
        'Verminder-beweging AAN via de in-game toggle — zelfde wereld, camera snijdt i.p.v. zwiert. Structureel gelijk aan het ijkbeeld (pixelDiff ≈ 0), niet plat/kapot.',
        undefined, normalRef ? { buf: normalRef, label: 'rm-ref-normal' } : undefined);
      // (2) IDLE PAIR (F-34c) — ~2.5 s later, still NO input. skyTime is frozen under
      // RM so clouds/grass/water/bird all hold and a settled camera does not drift ⇒
      // pixelDiff ≈ 0 vs the frame above. THE machine proof RM actually stills the
      // world (a normal-mode idle pair, with the atmosphere clock running, would not).
      await settle(page, 2500);
      const idleHold = await snap(page, 'reduce-motion-idle-hold', 'Reduce-Motion',
        'Zelfde plek, 2,5 s later, RM AAN — secundaire beweging bevroren (wolken/gras/water stil): pixelDiff ≈ 0 t.o.v. het vorige frame.',
        undefined, rmIdle ? { buf: rmIdle, label: 'reduce-motion-toggle-world' } : undefined);
      // (3) WALK BURST (F-34c) — hold forward under RM. §1e keepLocomotion keeps the
      // ranger walking (walk clip + real translation), so consecutive frames DIFFER:
      // pixelDiff ≫ 0 and clip=walk. Frame 1 diffs vs the idle-hold to show motion
      // STARTED; 2–3 vs the previous walk frame. The contrast with the frozen idle
      // pair is the whole judgement: RM calms the world, never the child's movement.
      await holdForward(page, isPad, stick);
      try {
        let prev = idleHold;
        let prevLabel = 'reduce-motion-idle-hold';
        for (let i = 1; i <= 3; i++) {
          await settle(page, 320);
          const b = await snap(page, `reduce-motion-walk-${i}`, 'Reduce-Motion (burst)',
            `RM-loopframe ${i}/3 — de ranger loopt door (keepLocomotion): het beeld verandert zichtbaar, clip=walk, pixelDiff ≫ 0 t.o.v. ${prevLabel}.`,
            undefined, prev ? { buf: prev, label: prevLabel } : undefined);
          prev = b; prevLabel = `reduce-motion-walk-${i}`;
        }
      } finally { await releaseForward(page, isPad, stick); }
      // (4) CUT-NOT-MOVE reframe (F-34d / P5.3) — LAPTOP wheel dolly (a player-initiated
      //     reframe; scope is laptop-only). Under RM every placeCamera SNAPS (World.ts:
      //     camera.position.copy, not the ~0.3 s lerp), so a wheel dolly RE-FRAMES the
      //     boom in ONE frame — a step, never an ease. Proven off the REAL render camera
      //     (cam.dist, an F-18 pose field) AND pixels (§4), with NO reliance on
      //     frame-precise timing:
      //       • cut-vs-before: pixelDiff ≫ 0 and cam.dist jumps a real ~5 m — the reframe
      //         is ALREADY fully present ~1 frame after the wheel (the step landed);
      //       • settled-vs-cut: pixelDiff ≈ 0 and cam.dist unchanged over the next ~0.8 s —
      //         the camera did NOT keep moving after that frame, so it was a CUT, not an
      //         interpolation. (A normal-mode dolly would still be easing through the 120 ms
      //         'cut' sample, so settled-vs-cut would read ≫ 0 — that contrast is the proof.)
      //     This is F-34d's durable cuts-not-moves assert on the settled RM camera.
      if (!isPad) {
        const cbox = await page.locator('canvas#scene').boundingBox();
        if (cbox) {
          const cx = cbox.x + cbox.width / 2, cy = cbox.y + cbox.height / 2;
          await page.mouse.move(cx, cy);
          await settle(page, 800); // land on a clean, fully-settled pre-reframe pose
          const before = await snap(page, 'reduce-motion-reframe-before', 'Reduce-Motion',
            'RM aan — camera-pose vóór de dolly (ijk cam.dist). De wielscroll hierna trekt de boom naar buiten; onder RM snijdt dat in één frame i.p.v. te zwieren.');
          // dolly OUT hard → zoomDist saturates to the max clamp: a big, unambiguous reframe.
          await page.mouse.wheel(0, 1400);
          // ~a few frames only: under RM the snap already landed on frame 1, so this 'cut'
          // sample is ALREADY the final pose (a damped dolly would read partway here).
          await settle(page, 120);
          const cut = await snap(page, 'reduce-motion-reframe-cut', 'Reduce-Motion',
            'RM, ~1 frame ná de dolly — de camera staat al op de nieuwe, verdere boom (cut): pixelDiff ≫ 0 en cam.dist duidelijk groter dan het vóór-frame, de stap is al volledig aanwezig.',
            undefined, before ? { buf: before, label: 'reduce-motion-reframe-before' } : undefined);
          // full ease window: a DAMPED dolly would still be moving here, so an unchanged
          // pose proves the reframe was a step, not an interpolation.
          await settle(page, 800);
          await snap(page, 'reduce-motion-reframe-settled', 'Reduce-Motion',
            'RM, na de volledige demp-tijd — cam.dist én pixels ongewijzigd t.o.v. het cut-frame (pixelDiff ≈ 0): het was een harde snit, geen zwevende interpolatie (F-34d cuts-not-moves).',
            undefined, cut ? { buf: cut, label: 'reduce-motion-reframe-cut' } : undefined);
        }
      }
    });
  });

  // ══ GROUP 5 — world boundary (F-11). Boot, walk straight out to the rim, and
  //    snap the calm forest-edge stop. Own fresh page (isolation like the rest).
  //    Assert BOTH: pos clamped (boundary.dist ≤ bound, atRim true) AND the ranger is
  //    actually shown (cam.avatarScreen.visible true — the P4.6 re-judge caught the
  //    boom sinking behind the rim berm so terrain occluded him while onScreen lied). ══
  // D1.4: 510 s budget (was 360 s) — the walk out to the ~70 m rim is the single longest
  // walk in the flow and crawls under full-capture load, so 360 s GAPped it at GATE-D1
  // ("zero rim frames"). The walkToBoundary loop is already bounded (never a stall).
  await runGroup('boundary', { budgetMs: 510_000 }, async (page, stick) => {
    await bootWorld(page, isPad);
    await scene(page, 'boundary', async () => {
      await walkToBoundary(page, isPad, stick);
      await settle(page, 500);
      await snap(page, 'boundary-rim', 'Wereldrand',
        'Aan de wereldrand (F-11) — de ranger stopt kalm bij de bomenrij: pos geklemd op de bound, geen onzichtbare muur, "Hier stopt het bos". De ranger blijft zichtbaar boven de rand (cam.avatarScreen.visible=true, niet achter de berm weggezakt).');
    });
  });

  // ══ GROUP 6 — the prikbord / case-board (P1.5). Boot, open the pause hub, then
  //    open the prikbord over the LIVE world (its clue + veldnotitie detective
  //    board, DIRECTION §3.3 — the story's heartbeat). The prior capture only shot
  //    the mission-PICK board (`board-open`) + the pause hub; the prikbord itself,
  //    which the P1.5 box names, was a blind spot. Runs BEFORE the timeout-prone
  //    `ven` group below: the prior P1.5 grade (2026-07-05) found this group appended
  //    LAST, after `ven`, which exhausted the 30-min test timeout ("annotations end
  //    on a `ven` GAP") — so `caseboard` never ran and the prikbord frame + the
  //    `.cb-back` ≥56px assert were never captured. Ordering it ahead of `ven` lets
  //    the prikbord render inside the test budget regardless of the ven walk. Frames
  //    it so the grade can judge the prikbord reads as the SAME warm world as the
  //    pause hub (shared warm scrim + warm cream card) with a legible ≥56px `.cb-back`
  //    chip. Own fresh page. ══
  await runGroup('caseboard', {}, async (page) => {
    await bootWorld(page, isPad);
    await scene(page, 'caseboard', async () => {
      await press(page, isPad, page.locator('.explore-pause'));
      await settle(page, 300);
      await press(page, isPad, page.locator('.ph-prikbord'));
      await page.locator('.case-board').waitFor({ timeout: 10_000 });
      await settle(page, 300);
      await snap(page, 'caseboard', 'Prikbord',
        'Het prikbord (P1.5) — het clue/veldnotitie-detectivebord over de levende wereld: leest het als dezelfde warme wereld als de pauze (gedeeld scrim + warm papier-kaart), met een leesbare ≥56px terug-chip?',
        ['.cb-back']);
    });
  });

  // ══ GROUP 6b — the five mini-game 2D floors (P1.6). GATE-P1/P1.6 need each of
  //    zoeken · corsi · simon · dagnacht · wisselen shot as a 2D floor to judge
  //    "each reads as the same naturalistic Veluwe, 2D floor included" — the prior
  //    set held only ONE mission frame (29-mission-3d, zoeken 3D) and NO 2D floor
  //    at all. The demo sandbox (?sandbox) can launch any EF engine; `?flat` forces
  //    the always-available 2D floor (Sandbox.launchEf force2d) so all five render
  //    deterministically without driving five separate missions (the ven walk
  //    already strains the 30-min budget). A fresh goto per engine keeps each floor
  //    isolated (no stacked panels / hidden chrome). Frames them so the P1.6 grade
  //    can judge each 2D floor reads as the SAME warm golden-hour world (DIRECTION
  //    §2.1/§3: one palette, "tint never darkness" — simon/wisselen were a dark-blue
  //    night before), with drawCalls <150. Own fresh page. ══
  await runGroup('game-floors', { budgetMs: 420_000 }, async (page) => {
    const FLOORS: { ef: string; panel: string; label: string }[] = [
      { ef: 'zoeken',   panel: '.zoeken', label: 'Speurkracht' },
      { ef: 'corsi',    panel: '.route',  label: 'Geheugenkracht' },
      { ef: 'simon',    panel: '.simon',  label: 'Echokracht' },
      { ef: 'dagnacht', panel: '.danger', label: 'Rustkracht' },
      { ef: 'wisselen', panel: '.wissel', label: 'Wisselkracht' },
    ];
    for (const f of FLOORS) {
      await scene(page, `floor-${f.ef}`, async () => {
        // Fresh boot straight into the ?flat sandbox per engine — resets the DOM so
        // no prior floor panel lingers, and the sandbox uses the ranger directly (no
        // avatar step). The presence gate + clean save were seeded in runGroup.
        await page.goto('/?sandbox&flat');
        await page.locator('.boot-title').waitFor({ timeout: 30_000 });
        await press(page, isPad, page.locator('.btn-start'));
        await page.locator('.sbx-jump-toggle').waitFor({ timeout: 30_000 });
        await press(page, isPad, page.locator('.sbx-jump-toggle'));
        const post = page.locator(`.sbx-jump[data-id="${f.ef}"][data-kind="ef"]`);
        await post.waitFor({ state: 'visible', timeout: 15_000 });
        await press(page, isPad, post);
        await page.locator(f.panel).waitFor({ timeout: 15_000 });
        await settle(page, 700); // let the floor paint (and any intro overlay seat)
        await snap(page, `floor-${f.ef}`, 'Speelvlakken (2D)',
          `2D-speelvlak ${f.label} (${f.ef}) — leest het als dezelfde warme gouden-uur-Veluwe (§2.1/§3, "tint, nooit donker"), niet als een los spel?`,
          [`${f.panel}-speak`]);
      });
    }
  });

  // ══ GROUP 6c — the five mini-game 3D surfaces, on the PLAYER-REACHABLE MISSION
  //    PATH (D1.0(b), 2026-07-05). The prior set shot each engine via `/?sandbox`,
  //    which rings the demo scene with billboard sprites (incl. a story-gated WOLF)
  //    the real mission path NEVER shows — so those frames were NO-evidence for the
  //    game as played (D0.1; DIRECTION §8.7: "point the harness at the player's
  //    path"). This drives the REAL flow the child walks: board → the mission card
  //    whose step uses this engine (by `data-id`) → "Ga op pad" → the step plays 3D
  //    IN-PLACE on the live free-roam world (Missions.runMission §1f — the same path
  //    the frozen board/chain specs assert), so the frame is the shipped screen, no
  //    sandbox billboards/wolf in shot.
  //      • zoeken / corsi / simon are the FIRST step of a mission (frisling /
  //        ecoduct / nachtronde) → reached directly.
  //      • dagnacht / wisselen are NEVER a first step (veluwe.ts), so we complete the
  //        first step through its GENUINE resolve (`__ranger.winStep()`, the dev hook
  //        the frozen chain.spec.ts drives), clicking through any between-step "Wist
  //        je dat" fact card, until the target engine's 3D card stages.
  //    ISOLATION — one runGroup PER GAME (D1.0 retry, 2026-07-05). The prior single
  //    `game-3d` group ran all five engines in ONE page under ONE 840 s budget, so
  //    when `game3d-zoeken` lost the renderer mid-shot (the F-21 browser-closed
  //    protocol error) the WHOLE group rolled back to its one retry, burned the budget
  //    on a wedged re-boot, and the other four engines were never even attempted (the
  //    15:21 D1.0 grade: "only 1 of 5 was attempted"). Giving EACH game its own
  //    `runGroup` — own fresh page, own crash-retry, own budget — contains a renderer
  //    death to THAT game: it spends ITS crash-retry in a fresh page (the software
  //    renderer usually recovers once the wedged page closes — openGroupPage backs
  //    off), or GAPs alone, while the remaining engines still capture. Each budget
  //    covers ONE honest attempt: boot (warm HTTP cache) + the dominant, VARIABLE
  //    walk-to-board (measured 45–67 s, occasionally longer when the ranger catches on
  //    terrain — the P1.5a sink) + startMission + the 25 s 3d-wait (+ the winStep
  //    advance for the two step-1 engines), with slow-walk margin — a wedged engine
  //    GAPs at its own cap instead of starving the rest. The whole set is ordered
  //    BEFORE the timeout-prone ven so a slow ven walk can never starve these frames. ══
  // Per engine: which mission surfaces it, whether it needs a step-advance to reach
  // it, and the 3D card + read-aloud button its variant mounts. zoeken/corsi/simon
  // are step 0; dagnacht/wisselen are step 1 (advance:true → winStep past step 0).
  const GAMES3D: { ef: string; mission: string; advance: boolean; card: string; speak: string; label: string }[] = [
    { ef: 'zoeken',   mission: 'frisling',          advance: false, card: '.zoeken-bar',    speak: '.zoeken-speak', label: 'Speurkracht' },
    { ef: 'corsi',    mission: 'ecoduct',           advance: false, card: '.route3d-card',  speak: '.route-speak',  label: 'Geheugenkracht' },
    { ef: 'simon',    mission: 'nachtronde',        advance: false, card: '.simon3d-card',  speak: '.simon-speak',  label: 'Echokracht' },
    { ef: 'dagnacht', mission: 'ree-niet-aanraken', advance: true,  card: '.dag3d-card',    speak: '.danger-speak', label: 'Rustkracht' },
    { ef: 'wisselen', mission: 'stuifzand',         advance: true,  card: '.wissel3d-card', speak: '.wissel-speak', label: 'Wisselkracht' },
  ];
  for (const g of GAMES3D) {
    // Own page + own crash-retry + own budget per engine (see the ISOLATION note above).
    // Step-1 engines (dagnacht/wisselen) get a wider budget for the extra winStep advance.
    // D1.4: 330 s (step-0) / 360 s (step-1), up from 240/300 — the shared walk-to-board +
    // startMission + 25 s 3d-wait overran 240 s under load (game3d-simon GAPped at GATE-D1).
    await runGroup(`game3d-${g.ef}`, { budgetMs: g.advance ? 360_000 : 330_000 }, async (page, stick) => {
      await bootWorld(page, isPad);
      await scene(page, `game3d-${g.ef}`, async () => {
        // Walk to the case-board → open it → pick THIS engine's mission by data-id →
        // "Ga op pad" (the real player path; runGroup seeded a clean save).
        await walkToBoard(page, isPad, stick);
        await startMissionFromBoard(page, isPad, g.mission);
        await waitFor(page, (r) => r.missionView === '3d', 25_000);
        // Land on THIS engine's 3D surface: a first-step engine is already staged; a
        // second-step engine (dagnacht/wisselen) advances through the first step.
        if (g.advance) await advanceToStepCard(page, isPad, g.card);
        else await page.locator(g.card).waitFor({ state: 'visible', timeout: 20_000 });
        await settle(page, 500);        // let the staged forms mount + the §1e reframe kick off
        await settleMissionCam(page);   // D1.3: wait out the reframe so the reads are the DESTINATION framing, not a pre-settle void (§8.7)
        await snap(page, `game3d-${g.ef}`, 'Speelvlakken (3D)',
          `3D-speelvlak ${g.label} (${g.ef}) op het ECHTE missiepad (bord → "${g.mission}" → Ga op pad) — leest de diegetische 3D-staging als dezelfde warme gouden-uur-Veluwe (§2.1/§2.2: één licht, gegronde vormen met zachte slagschaduw), ZONDER sandbox-billboards/wolf, missionView=3d, drawCalls <150?`,
          [g.speak]);
        // D1.3: the SETTLED mission-entry camera must land ABOVE the rendered terrain
        // (cam.y > groundAtCam — the raycast ground-snap under the lens, so a below-ground
        // reframe like the fresh simon-3D at cam.y −1.29 is caught) AND frame the task
        // staging (taskInView). Fold both into the shot's note as an honest ok:false finding
        // — never throw (that GAPs the scene + loses the frame); the fixed reframe holds them,
        // so a healthy run stays green (direction §2.2/§2.5/§8.7).
        const shot = shots[shots.length - 1];
        const c = shot.cam;
        if (c) {
          const clear = c.y - c.groundAtCam;
          shot.note += `  [D1.3: cam.y ${c.y.toFixed(2)} m boven terrein ${c.groundAtCam.toFixed(2)} m → vrije hoogte ${clear.toFixed(2)} m; taskInView=${c.taskInView}.]`;
          if (!(c.y > c.groundAtCam)) {
            shot.ok = false;
            shot.note += '  [D1.3: de camera staat ONDER het gerenderde terrein (cam.y ≤ grond) — een onder-terrein reframe is geen bewijs (§2.5/§8.7).]';
          }
          if (c.taskInView !== true) {
            shot.ok = false;
            shot.note += `  [D1.3: de taak-staging valt BUITEN het frustum (taskInView=${c.taskInView}) — het speelvlak is niet in beeld (§8.7).]`;
          }
          flush();
        }
      });
    });
  }

  // ══ GROUP 7 — the ven (P1.2, DEFERRED). Boot, walk out to the ven-water shore and
  //    snap the fen. The prior P1.2 grade (2026-07-05) found the ven in ZERO frames —
  //    §2.2's most distinctive biome (dark still water + reed fringe + moss/peat bank)
  //    was never on camera, so "each biome reads as real Veluwe ground" was
  //    unverifiable. The straight line spawn→VEN_CENTER crosses bos, then enters the
  //    forced-ven shore blob (Biomes.VEN_SHORE_R) around the water, so the walk lands
  //    the ranger on the reed-fringed bank with the water in frame ahead — the ONE ven
  //    frame, with the annotation `pos` reading as the ven biome. Runs LAST because it
  //    is timeout-prone (the long walk out to the far ven basin is what exhausted the
  //    test budget above): kept after the P1.5 `caseboard` group so a slow ven walk can
  //    never again starve the prikbord frame. Own fresh page. ══
  // D1.4: 510 s budget (was 360 s) — the walk out to the far ven basin (~50 m) is, with
  // the boundary rim, the flow's longest walk and crawls under load; 360 s left no margin.
  await runGroup('ven', { budgetMs: 510_000 }, async (page, stick) => {
    await bootWorld(page, isPad);
    await scene(page, 'ven-shore', async () => {
      await walkToVen(page, isPad, stick);
      await settle(page, 500);
      await snap(page, 'ven-shore', 'Ven',
        'Aan de venrand (P1.2) — donker stil water, rietkraag en mos/veen-oever: leest de ven als echte Veluwegrond? De ranger stopt aan de waterlijn (de ven is onbewaadbaar).');
    });
  });

  flush();
  attachSummary(testInfo, shots);
  // D1.0(c): the fresh set on disk must EQUAL the fresh annotations — remove any PNG
  // left by an earlier run with different shot numbering (shot indices shift as
  // groups are added/reordered), so no stale frame sits beside a fresh one to
  // mislead the judge (a `15-pause-hub` beside a fresh `16-pause-hub` — D1.0 / §8.7).
  pruneOrphanPngs(dir, shots);
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
/**
 * P5.2 (F-34c): fraction of pixels (0..1) that DIFFER between two viewport PNGs,
 * computed IN-BROWSER via canvas — no image-lib dependency (pngjs/pixelmatch are
 * absent and a new dep needs Floris). Both frames are drawn to a coarse 160×120
 * grid and compared with a small per-pixel channel-sum threshold, so sub-pixel AA
 * fringe and a single blinked eyelid stay ≈0 while a walked stride (moving legs +
 * a translating frame) reads clearly large. This is the "pixel-diff" the RM judge
 * reads: ≈0 across the RM idle pair (secondary motion frozen) and vs the pre-toggle
 * normal still (nothing structural differs), ≫0 across the RM walk burst (locomotion
 * kept — §1e keepLocomotion). Runs on the live capture page; the caller treats a
 * throw as non-fatal (the shot keeps its screenshot + hash, pixelDiff stays null).
 */
async function pixelDiffRatio(page: Page, a: Buffer, b: Buffer): Promise<number> {
  const urls: [string, string] = [
    `data:image/png;base64,${a.toString('base64')}`,
    `data:image/png;base64,${b.toString('base64')}`,
  ];
  return page.evaluate(async ([ua, ub]) => {
    const load = (d: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('img decode failed'));
        img.src = d;
      });
    const W = 160, H = 120;
    const grid = (img: HTMLImageElement): Uint8ClampedArray => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      if (!g) throw new Error('no 2d context for pixel-diff');
      g.drawImage(img, 0, 0, W, H);
      return g.getImageData(0, 0, W, H).data;
    };
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    const pa = grid(ia), pb = grid(ib);
    let diff = 0;
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 24) diff += 1;
    }
    return diff / (W * H);
  }, urls);
}
function attachSummary(testInfo: TestInfo, shots: Annotation[]): void {
  const gaps = shots.filter((s) => !s.ok).length;
  testInfo.annotations.push({ type: 'capture', description: `${shots.length} shots, ${gaps} gaps` });
}
/** D1.0(c): delete any PNG in the platform dir NOT referenced by a fresh shot's
 *  `file`, so `<platform>/` on disk == the fresh annotations (GAP shots carry an
 *  empty `file` and protect no PNG). Called once at the end of the flow, after the
 *  final flush; a rm failure is logged-over, never fatal (evidence beats a crash). */
function pruneOrphanPngs(dir: string, shots: Annotation[]): void {
  const keep = new Set(
    shots.map((s) => s.file).filter(Boolean).map((f) => path.basename(f)),
  );
  let removed = 0;
  let entries: string[] = [];
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const f of entries) {
    if (!f.toLowerCase().endsWith('.png') || keep.has(f)) continue;
    try { fs.rmSync(path.join(dir, f)); removed += 1; } catch { /* leave it; a rm miss is not fatal */ }
  }
  if (removed) {
    // eslint-disable-next-line no-console
    console.log(`[capture] pruned ${removed} orphan PNG(s) not in the fresh ${path.basename(dir)} annotations`);
  }
}
/** A page/renderer death — bubble it so a group can spend its one crash-retry.
 *  Includes the `Target.createTarget` / hung-`newPage` signature (F-21): once the
 *  software renderer is wedged, even opening the next group's page fails, and that
 *  must count as a crash so `runGroup` retries it rather than aborting the run. */
function isCrash(e: unknown): boolean {
  return /been closed|is closed|has crashed|Target crashed|Target page|Target closed|Target\.createTarget|newPage/i.test(String(e));
}
/** Open a fresh page for a scene GROUP, resilient to the F-21 software-renderer
 *  instability that recurs on the laptop project: after the earlier groups churn
 *  the WebGL context, `context.newPage()` can throw a `Target.createTarget`
 *  protocol error OR hang until the whole-test timeout (Run B's P4.7 capture lost
 *  the board + mission scenes to exactly this). Each attempt is time-bounded so a
 *  wedged target cannot eat the 30-min budget, and we back off between tries so the
 *  browser can respawn its GPU process / release the prior page before retrying. */
async function openGroupPage(context: BrowserContext): Promise<Page> {
  let lastErr: unknown = new Error('newPage failed');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const pagePromise = context.newPage();
    pagePromise.catch(() => {}); // a late rejection after a timeout must not go unhandled
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pagePromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('newPage timed out — Target.createTarget hang')), 20_000);
        }),
      ]);
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-console
      console.log(`[capture] newPage attempt ${attempt}/4 failed: ${String(e).slice(0, 90)}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}
/** Tap on the iPad (genuine touch), click on the laptop — then fall back to a
 *  faithful DOM click if real input can't complete.
 *
 *  D1.0 (2026-07-05, diagnosed on the running dev server): the live-rendering world
 *  DEFEATS Playwright's actionability gate for the HUD's `<button>`s. `.explore-pause`
 *  is present, visible, `pointer-events:auto`, opacity 1, and hit-tests to ITSELF at
 *  its centre — yet a real `.click()` (and even a `{force:true}` click, and a bare
 *  `{trial:true}` actionability probe) TIMES OUT, while `dispatchEvent('click')` fires
 *  the handler and opens the hub every time. The world's per-frame repaint keeps the
 *  "stable" sub-check from ever passing on a button drawn over the canvas. This wedged
 *  the whole `reduce-motion-toggle` group (its `.explore-pause` is pressed WITHOUT a
 *  prior walk) and the `board` group (its unbounded `.explore-board-open` press hung
 *  the entire 300 s budget); `game-3d`'s first three engines only captured because the
 *  walk-to-board happens to leave the render quiet enough for that one press.
 *
 *  So: attempt REAL input first (fidelity — it works on the pre-world title/avatar
 *  screens and wherever the render loop is briefly quiet), but BRIEFLY; on failure
 *  fall back to a DOM `click` dispatch (every pressed control is click-driven — no
 *  pressed selector binds pointerdown/mousedown). The fallback fires ONLY if the target
 *  is still present, so a real click that fired then unmounted its control is never
 *  double-fired (which would undo a toggle). A control that never appears still degrades
 *  to the caller's next bounded wait → an honest GAP, never the 30-min stall (P0.3). A
 *  renderer death still bubbles so the group can spend its one crash-retry. */
async function press(
  page: Page, isPad: boolean, locator: ReturnType<Page['locator']>, timeout?: number,
): Promise<void> {
  const total = timeout ?? 15_000;
  try {
    if (isPad) await locator.tap({ timeout: Math.min(total, 1_500) });
    else await locator.click({ timeout: Math.min(total, 1_500) });
    return;
  } catch (e) {
    if (isCrash(e) || page.isClosed()) throw e; // renderer death → group crash-retry
    if (!(await locator.isVisible().catch(() => false))) return; // fired-then-unmounted, or absent
    await locator.dispatchEvent('click', {}, { timeout: Math.min(total, 4_000) });
  }
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

/** D1.1: block until the eased follow-boom has SETTLED before a camera/dolly snap, so
 *  the frame is the destination framing — never a pre-settle void (direction doc §8.7:
 *  the 12/13-camera-zoom pair were two IDENTICAL mid-transition frames, cam.dist 1.67
 *  against zoom.dist 9.5, the dolly caught before it moved). The boom eases toward the
 *  player-set zoom.dist with a ~0.3 s exp-damp (World.ts:3477); "settled" = the live
 *  `cam.dist` has stopped changing (|Δ| ≤ max(0.03 m, 0.4 %) across two consecutive
 *  ~80 ms polls), which converges to within ~2 % of the eased target. Steady-state,
 *  NOT a strict "within 5 % of zoom.dist", is the criterion on purpose: cam.dist reads
 *  the 3D lens→bbox-centre distance, so at the FAR clamp it equals zoom.dist (±~1.5 %)
 *  but at the NEAR clamp it sits a fixed ~1.5 m eye-height offset ABOVE zoom.dist — a
 *  5 %-of-zoom.dist gate could never fire on a genuine zoom-IN, steady-state catches
 *  both.
 *
 *  BACKSTOP (GATE-D1, 2026-07-11): under the FULL capture load the engine's own rAF is
 *  throttled, so the SAME ease converges ~13× slower — the 6 s bound this ran under
 *  before fired MID-ease in the audit capture ("camera boom never settled within 6000 ms",
 *  last cam.dist 4.85 vs target 9.5) and THREW, which GAPped the whole camera-attempts
 *  scene and lost BOTH zoom frames (against D1.1's "no new GAP entries" leg + the D1.0
 *  lose-no-evidence lesson). So this now mirrors `settleMissionCam`'s best-effort backstop:
 *  a generous 20 s bound, and on the bound we RETURN best-effort (near-destination) rather
 *  than throw. The steady-state criterion keys on the RATE of change (Δ per ~80 ms poll),
 *  not the absolute error, so even a ~13×-throttled healthy ease reaches it in ~7–8 s and
 *  returns well inside the bound; only a genuinely wedged/dead boom rides to the backstop.
 *  A best-effort return must NEVER EXCUSE a bad pair: the downstream pixelHash-differ assert
 *  in the camera scene stays HARD (an ok:false audit finding, the D1.3 no-GAP precedent) —
 *  two identical pre-settle frames are caught even when this settle hit the backstop. */
async function settleCam(page: Page, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  let prev: number | null = null;
  let stable = 0;
  for (;;) {
    const dist = await hook(page, (r) => r.cam()?.dist ?? null);
    if (dist != null) {
      if (prev != null && Math.abs(dist - prev) <= Math.max(0.03, 0.004 * dist)) {
        if (++stable >= 2) return;
      } else stable = 0;
      prev = dist;
    }
    if (Date.now() - start > timeoutMs) return; // best-effort near-destination frame; the pixelHash-differ assert stays the hard gate
    await page.waitForTimeout(80);
  }
}

/** D1.3: block until the §1e MISSION reframe has SETTLED before a game-3D snap+assert, so
 *  the camera-above-terrain + task-in-frustum reads are the DESTINATION framing, never a
 *  pre-settle void (fresh corsi-3D read a steep pre-settle pitch mid-ease; direction §8.7).
 *  Unlike `settleCam` (which polls the zoom-dolly `cam.dist`), the mission reframe MOVES the
 *  whole camera POSITION toward its raised look, so "settled" = the live `cam` x/y/z has
 *  stopped moving (‖Δpos‖ ≤ 0.03 m across two consecutive ~90 ms polls).
 *
 *  The reframe is an exp-damped push-in (tau 0.35 s → ~2 s on a 60 fps device). In THIS
 *  headless capture the engine's own rAF is throttled, so the SAME ease converges far
 *  slower (measured effective tau ≈ 4–5 s → ~10–15 s to arrive on the farther reframes),
 *  hence the generous backstop. On backstop we RETURN best-effort rather than throw: the
 *  ease is monotone-converging and the D1.3 asserts folded into the snap note below
 *  (cam.y > groundAtCam, taskInView) hold across the WHOLE ease, so a slow-but-valid ease
 *  reads a representative near-destination frame — it must NOT GAP the scene (the D1.0
 *  budget/GAP lesson). A genuinely dead/void camera reads `cam=null` and the fold is
 *  skipped; the shot is still kept. */
async function settleMissionCam(page: Page, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  let prev: { x: number; y: number; z: number } | null = null;
  let stable = 0;
  for (;;) {
    const p = await hook(page, (r) => { const c = r.cam(); return c ? { x: c.x, y: c.y, z: c.z } : null; });
    if (p) {
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) <= 0.03) {
        if (++stable >= 2) return;
      } else stable = 0;
      prev = p;
    }
    if (Date.now() - start > timeoutMs) return; // best-effort near-destination frame; the folded asserts gate correctness
    await page.waitForTimeout(90);
  }
}

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

// D1.6: convergence-safe PULSED walking. The GATE-D1 audit-#3 jeep GAP was a
// DIVERGENCE, not a slow walk: the old loop held the arrow keys DOWN across each
// poll's page.evaluate, and late in a full capture those evaluates return ~2 s late
// through a starved event loop — so the ranger kept walking the LAST-commanded heading
// for seconds, overshot the `near` radius, re-aimed, overshot again, and ORBITED a
// fixed target forever (consuming ANY budget — hence 421/420 → 721/720). The fix is a
// PULSE: hold the keys for a short BOUNDED window, then RELEASE them BEFORE the next
// (possibly slow) read, so the ranger stands STILL while the poll round-trips. On-foot
// movement has no momentum — World.ts drops the walk target the frame a key releases
// (`this.target.set(rp,0,rp)`), so he stops instantly and an uncorrected leg is exactly
// speed×pulse. Capped WELL under the tightest `near` radius (board/marker = 2.4 m),
// which makes an orbit GEOMETRICALLY impossible even when polls crawl: a target-aimed
// step shorter than the radius can never jump the ranger past the near zone.
const WALK_SPEED_MPS = 1.8;    // World.ts on-foot ground speed — sizes the pulse cap
const WALK_PULSE_MIN_MS = 200;
const WALK_PULSE_MAX_MS = 900; // 1.8 m/s × 0.9 s = 1.62 m per uncorrected leg < 2.4 m (board/marker near
                               // radius, the tightest) — an orbit needs a leg > ~2× the radius, so this has
                               // wide margin — while keeping the leg BIG so the far approach needs few polls
                               // (each poll is stopped read-time; the D1.6 slow-walk cost is poll COUNT).
const WALK_PULSE_FRAC = 0.6;   // hold long enough to cover ~60 % of the remaining gap, then re-aim

/** One combined read per poll: the walk TARGET (x,z,near) AND the ranger pos + camera
 *  yaw, from a SINGLE page.evaluate. Halves the round-trips of the old two-evaluate poll,
 *  so the walk starves the render loop half as much and each poll returns sooner under
 *  capture load (the D1.4 fewer-round-trips insight, taken one step further). */
type WalkRead = () => Promise<{ tx: number; tz: number; near: boolean; px: number; pz: number; yaw: number } | null>;

/** How long to hold the keys this pulse: cover ~WALK_PULSE_FRAC of the remaining gap,
 *  clamped to [MIN,MAX] so a single uncorrected leg is always ≪ the tightest near radius. */
function walkPulseMs(dist: number): number {
  return Math.max(WALK_PULSE_MIN_MS, Math.min(WALK_PULSE_MAX_MS, (dist / WALK_SPEED_MPS) * 1000 * WALK_PULSE_FRAC));
}

/** Camera-relative walk toward a world target. Keyboard (laptop) or joystick
 *  touch (iPad) — same geometry, so the iPad reaches the board/jeep as reliably
 *  as the laptop did (F-21: iPad locomotion must be touch, never `page.keyboard`). */
async function walkTo(
  page: Page,
  isPad: boolean,
  stick: TouchStick | null,
  read: WalkRead,
  // D1.6: the pulsed walk takes MORE polls per metre (shorter legs) but each converges,
  // so keep a generous iteration cap — a REACHING walk short-circuits on `near`, so the
  // cap never slows a healthy walk; it only bounds a genuinely wedged one (the per-group
  // wall-clock budget is the real backstop). iPad is a Floris demo (never auto-run).
  budget = 320,
): Promise<void> {
  if (isPad) return joystickWalkTo(page, stick!, read, Math.min(budget, 220));
  return keyboardWalkTo(page, read, budget);
}

async function keyboardWalkTo(page: Page, read: WalkRead, budget: number): Promise<void> {
  const down = new Set<string>();
  const pressKeys = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
  };
  const releaseKeys = async (): Promise<void> => {
    for (const k of KEYS) if (down.has(k)) { await page.keyboard.up(k); down.delete(k); }
  };
  try {
    for (let i = 0; i < budget; i++) {
      // Keys are RELEASED here → the ranger is stationary while this (possibly seconds-late
      // under load) read round-trips; he cannot drift past the target during a slow poll.
      const s = await read();
      if (!s) { await page.waitForTimeout(100); continue; }
      if (s.near) return;
      const { sx, sYf } = screenDir(s.tx - s.px, s.tz - s.pz, s.yaw);
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
      if (want.size === 0) { await page.waitForTimeout(80); continue; }
      // PULSE: press, hold for a bounded window (≪ near-radius of travel), release BEFORE
      // the next read. The release is what breaks the orbit — the ranger never coasts.
      await pressKeys(want);
      await page.waitForTimeout(walkPulseMs(Math.hypot(s.tx - s.px, s.tz - s.pz)));
      await releaseKeys();
    }
    throw new Error('never reached target within step budget');
  } finally { await releaseKeys().catch(() => {}); }
}

async function joystickWalkTo(page: Page, stick: TouchStick, read: WalkRead, budget: number): Promise<void> {
  try {
    for (let i = 0; i < budget; i++) {
      // Stick RELEASED between iterations (same pulse discipline as the keyboard path) — a
      // slow poll can't carry the ranger past the target while the read is in flight.
      const s = await read();
      if (!s) { await page.waitForTimeout(120); continue; }
      if (s.near) return;
      const { sx, sYf } = screenDir(s.tx - s.px, s.tz - s.pz, s.yaw);
      const mag = Math.hypot(sx, sYf) || 1;
      await stick.hold(page, sx / mag, sYf / mag);
      await page.waitForTimeout(walkPulseMs(Math.hypot(s.tx - s.px, s.tz - s.pz)));
      await stick.release();
    }
    throw new Error('joystick walk never reached target within step budget');
  } finally { await stick.release().catch(() => {}); }
}

async function walkToBoard(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  await walkTo(page, isPad, stick, () => hook(page, (r) => {
    const b = r.board(); const p = r.pos(); const y = r.cameraYaw();
    return b && p && y != null ? { tx: b.x, tz: b.z, near: b.near, px: p.x, pz: p.z, yaw: y } : null;
  }));
}

/** D1.0(b): open the case-board and start the mission with the given id — the REAL
 *  player path (mirrors the frozen chain.spec.ts `startMissionFromBoard`: pick the
 *  card by `data-id`, then "Ga op pad"). Bounded presses so a control that never
 *  becomes actionable degrades to this scene's GAP, never a 30-min stall (P0.3). */
async function startMissionFromBoard(page: Page, isPad: boolean, missionId: string): Promise<void> {
  const open = page.locator('.explore-board-open');
  await open.waitFor({ state: 'visible', timeout: 15_000 });
  await press(page, isPad, open, 15_000);
  await page.locator('.mission-board').waitFor({ timeout: 10_000 });
  const cardBtn = page.locator(`.mission-card[data-id="${missionId}"]`);
  await cardBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await press(page, isPad, cardBtn, 15_000);
  const go = page.getByRole('button', { name: 'Ga op pad' });
  await go.waitFor({ state: 'visible', timeout: 15_000 });
  await press(page, isPad, go, 15_000);
}

/** D1.0(b): advance a running mission by `winsNeeded` steps to reach the TARGET
 *  engine's 3D card, then STOP — the deterministic advance the frozen chain.spec.ts
 *  uses to reach a mission's later steps (dagnacht/wisselen are never a first step,
 *  veluwe.ts). Each intermediate step is completed via its GENUINE resolve
 *  (`__ranger.winStep()`), clicking through any between-step "Wist je dat" fact card.
 *  CRUCIALLY it fires at most `winsNeeded` wins, so it never wins the TARGET step
 *  itself (which would complete it before the shot) even if the target's card mounts
 *  a beat after its win registers. Bails (→ this scene's GAP) if the mission reaches
 *  its reward first, so a variant that never stages can't silently over-run the whole
 *  mission; bounded loop → never the 30-min stall (P0.3). */
async function advanceToStepCard(page: Page, isPad: boolean, targetCard: string, winsNeeded = 1): Promise<void> {
  const target = page.locator(targetCard);
  const fact = page.locator('.fact .btn-start');
  const reward = page.locator('.reward');
  let wins = 0;
  for (let i = 0; i < 120; i++) {
    if (await target.isVisible().catch(() => false)) return; // reached this engine's 3D surface
    if (await reward.isVisible().catch(() => false)) throw new Error(`mission reached its reward before ${targetCard} staged`);
    if (await fact.isVisible().catch(() => false)) { await press(page, isPad, fact, 8_000).catch(() => {}); await page.waitForTimeout(150); continue; }
    // Only win the INTERMEDIATE steps; once winsNeeded are done, wait for the target
    // step to stage on its own so we never resolve it out from under the shot.
    if (wins < winsNeeded) { if (await hook(page, (r) => r.winStep())) wins += 1; }
    await page.waitForTimeout(300);
  }
  throw new Error(`3D card ${targetCard} never staged while advancing the mission`);
}
/** F-11: walk OUT to the world rim and stop when the gentle-stop latch trips
 *  (`boundary.atRim` — the ease-to-zero stop + "Hier stopt het bos" cue engaged).
 *  Steers toward a far point on the −z axis (into the 'bos' sector, well clear of
 *  the ven) rather than holding forward blindly: the follow-cam rotates to match
 *  facing, so a pine-slide would swing "forward" tangential and a blind walk would
 *  drift along the rim forever — re-aiming radially outward each step corrects that
 *  and lands on the rim by the shortest path. Reuses the stepped walkers directly
 *  (a generous budget, past `walkTo`'s nearby-target iPad cap); bounded, so it can
 *  never become the 30-min stall P0.3 warns of, and it exits the instant it arrives. */
async function walkToBoundary(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  const read: WalkRead = () => hook(page, (r) => {
    const b = r.boundary(); const p = r.pos(); const y = r.cameraYaw();
    return b && p && y != null ? { tx: 0, tz: -(b.bound + 50), near: b.atRim, px: p.x, pz: p.z, yaw: y } : null;
  });
  if (isPad) { await joystickWalkTo(page, stick!, read, 500); return; }
  await keyboardWalkTo(page, read, 500);
}
/** P1.2: walk out to the ven-water shore. Steers toward VEN_CENTER (the water basin
 *  at 46,-19; Biomes.VEN_CENTER) and latches on the reed-fringed bank as the ranger
 *  nears the waterline — the ven is un-wadeable (World.limits.blocked), so he stops
 *  on the moss bank with the water ahead. The near-latch (< 22 m from centre) trips
 *  INSIDE the forced-ven shore blob (VEN_SHORE_R 26), so the annotation `pos` reads
 *  as the ven biome. Bounded like walkToBoundary — never the 30-min stall (P0.3). */
async function walkToVen(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  // NB the reader closure is stringified + re-run INSIDE the page (see `hook`), so it must
  // capture NO Node-scope variable — VEN_CENTER (46,−19; Biomes.VEN_CENTER, the water basin)
  // is inlined here, not referenced from an outer const.
  const read: WalkRead = () => hook(page, (r) => {
    const p = r.pos(); const y = r.cameraYaw();
    if (!p || y == null) return null;
    const vx = 46, vz = -19;
    return { tx: vx, tz: vz, near: Math.hypot(p.x - vx, p.z - vz) < 22, px: p.x, pz: p.z, yaw: y };
  });
  if (isPad) { await joystickWalkTo(page, stick!, read, 500); return; }
  await keyboardWalkTo(page, read, 500);
}
async function walkToJeep(page: Page, isPad: boolean, stick: TouchStick | null): Promise<void> {
  await walkTo(page, isPad, stick, () => hook(page, (r) => {
    const v = r.vehicle(); const p = r.pos(); const y = r.cameraYaw();
    return v && p && y != null ? { tx: v.x, tz: v.z, near: v.near, px: p.x, pz: p.z, yaw: y } : null;
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
