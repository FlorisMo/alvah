/**
 * devhook.ts — the dev-state hook `window.__ranger` (WORLD-PLAN §3.1 / W0.2).
 *
 * The browser-proof contract asserts against runtime STATE, not pixels
 * (headless SwiftShader renders deterministically enough for state but not for
 * pixel diffs). This module is the single, DOM-free channel the E2E suite reads.
 *
 * It is gated behind `import.meta.env.DEV || ?dev=1` (W0.2): the hook object is
 * only attached to `window` in that case. The setter/provider calls elsewhere
 * are always safe — they just update module state; when the hook is not
 * installed nothing reads it.
 *
 * Fields (per §3.1): `screen`, `pos()`, `cameraYaw()`, `drawCalls()`,
 * `missionView`, `clip()`, `version`. Live values (pos, camera, draw calls,
 * animation clip) come through registered providers so this module never needs
 * to import three.js or the World — keeping it out of the pure-core test spine.
 */

export type Screen = 'title' | 'avatar' | 'lodge' | 'world' | 'mission';
export type MissionView = '2d' | '3d' | null;

export interface RangerDevHook {
  readonly version: string;
  readonly screen: Screen;
  readonly missionView: MissionView;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  clip(): { name: string; time: number } | null;
  /** The mission id the ranger is standing at (proximity), or null (W1.4). */
  nearId(): string | null;
  /** Every mission marker's world position, for E2E navigation (W1.4). */
  markers(): { x: number; z: number; missionId: string }[] | null;
  /** The spawn case-board hub: world position + live proximity, for E2E (W2.2). */
  board(): { x: number; z: number; near: boolean } | null;
  /** Win the active 3D mission step via its genuine resolve path; true if one
   *  was pending. Drives the two-mission-chain E2E deterministically (W2.3). */
  winStep(): boolean;
}

const VERSION = '2.0.0-world';

const state = {
  screen: 'title' as Screen,
  missionView: null as MissionView,
  pos: null as null | (() => { x: number; z: number }),
  cameraYaw: null as null | (() => number),
  drawCalls: null as null | (() => number),
  clip: null as null | (() => { name: string; time: number } | null),
  nearId: null as null | (() => string | null),
  markers: null as null | (() => { x: number; z: number; missionId: string }[]),
  board: null as null | (() => { x: number; z: number; near: boolean } | null),
  winStep: null as null | (() => boolean),
};

/** Current screen the player is on. */
export function setScreen(s: Screen): void {
  state.screen = s;
}

/** Resolved view mode of the active mission ('2d' | '3d'), or null when none. */
export function setMissionView(v: MissionView): void {
  state.missionView = v;
}

/** Register the live ranger-position source (the World). Pass null to clear. */
export function providePos(fn: (() => { x: number; z: number }) | null): void {
  state.pos = fn;
}

/** Register the live camera-yaw source (the World). Pass null to clear. */
export function provideCameraYaw(fn: (() => number) | null): void {
  state.cameraYaw = fn;
}

/** Register the live draw-call source (the Budgets overlay / renderer.info). */
export function provideDrawCalls(fn: (() => number) | null): void {
  state.drawCalls = fn;
}

/** Register the live player-animation clip source (the mixer, W3.2). */
export function provideClip(fn: (() => { name: string; time: number } | null) | null): void {
  state.clip = fn;
}

/** Register the live proximity source (the World's `nearId`). Pass null to clear. */
export function provideNearId(fn: (() => string | null) | null): void {
  state.nearId = fn;
}

/** Register the live marker-positions source (the World). Pass null to clear. */
export function provideMarkers(
  fn: (() => { x: number; z: number; missionId: string }[]) | null,
): void {
  state.markers = fn;
}

/** Register the live case-board hub source (the World). Pass null to clear (W2.2). */
export function provideBoard(
  fn: (() => { x: number; z: number; near: boolean } | null) | null,
): void {
  state.board = fn;
}

/** Register the "win the active 3D step" driver (the mission runner). W2.3. */
export function provideWinStep(fn: (() => boolean) | null): void {
  state.winStep = fn;
}

/**
 * Attach `window.__ranger` when DEV or `?dev=1`. Idempotent. Returns whether
 * the hook was installed (for logging/tests).
 */
export function installDevHook(): boolean {
  const devFlag =
    import.meta.env.DEV ||
    new URLSearchParams(location.search).has('dev');
  if (!devFlag) return false;
  const hook: RangerDevHook = {
    version: VERSION,
    get screen() { return state.screen; },
    get missionView() { return state.missionView; },
    pos: () => (state.pos ? state.pos() : null),
    cameraYaw: () => (state.cameraYaw ? state.cameraYaw() : null),
    drawCalls: () => (state.drawCalls ? state.drawCalls() : null),
    clip: () => (state.clip ? state.clip() : null),
    nearId: () => (state.nearId ? state.nearId() : null),
    markers: () => (state.markers ? state.markers() : null),
    board: () => (state.board ? state.board() : null),
    winStep: () => (state.winStep ? state.winStep() : false),
  };
  (window as unknown as { __ranger: RangerDevHook }).__ranger = hook;
  return true;
}
