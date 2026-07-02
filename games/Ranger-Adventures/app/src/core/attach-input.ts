/**
 * attach-input.ts — the thin DOM listener layer the pure `input.ts` core
 * promised (WORLD-PLAN §3.2 / W1.2). `input.ts` stays THREE-free and DOM-free
 * in the unit-test spine; ALL keydown/keyup wiring lives here, so the pure
 * vector math and the browser plumbing test separately.
 *
 * One job: keep a live `Set<MoveKey>` of the currently-held movement keys
 * (arrows + WASD via `keyToMove`) that `World.update` reads each frame and feeds
 * through `resolveInput` → `resolveMove`. The joystick vector (W1.3) fuses in at
 * the `resolveInput` call site, not here.
 *
 * Listens on `window` (key events are not canvas-focused) and clears the held
 * set on blur so a key held while the tab loses focus never sticks the ranger
 * walking. Movement keys are `preventDefault`-ed so Arrow keys don't scroll the
 * page under the full-screen canvas.
 */

import { keyToMove, isInteractKey, type MoveKey } from './input';

export interface InputHandle {
  /** The live set of held movement directions — read each frame, never mutated by callers. */
  readonly held: ReadonlySet<MoveKey>;
  /** Detach every listener (call from `World.dispose`). */
  dispose(): void;
}

export interface AttachInputOptions {
  /**
   * Fired once per physical press of an interact key (Space/Enter, W1.4) — the
   * laptop trigger for the current proximity action. Autorepeat is filtered so a
   * held key fires exactly once. `World` routes this to its `nearId` action.
   */
  onInteract?: () => void;
}

/**
 * Wire keyboard movement onto `target` (default `window`). Returns the live held
 * set plus a `dispose` that removes all three listeners.
 */
export function attachInput(target: Window = window, opts: AttachInputOptions = {}): InputHandle {
  const held = new Set<MoveKey>();

  const onDown = (e: KeyboardEvent): void => {
    if (isInteractKey(e.code)) {
      e.preventDefault(); // Space would scroll / re-activate a focused button
      if (!e.repeat) opts.onInteract?.(); // one action per press, never autorepeat
      return;
    }
    const m = keyToMove(e.code);
    if (!m) return;
    held.add(m);
    e.preventDefault(); // arrows must not scroll the page under the canvas
  };
  const onUp = (e: KeyboardEvent): void => {
    const m = keyToMove(e.code);
    if (m) held.delete(m);
  };
  const onBlur = (): void => held.clear(); // lost focus → release everything, no stuck keys

  target.addEventListener('keydown', onDown as EventListener);
  target.addEventListener('keyup', onUp as EventListener);
  target.addEventListener('blur', onBlur);

  return {
    held,
    dispose(): void {
      target.removeEventListener('keydown', onDown as EventListener);
      target.removeEventListener('keyup', onUp as EventListener);
      target.removeEventListener('blur', onBlur);
    },
  };
}
