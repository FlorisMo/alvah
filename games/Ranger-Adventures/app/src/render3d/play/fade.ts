/**
 * play/fade.ts — calm fades for the world's set pieces.
 *
 * A piece fades up (a finished family's reunion), and a far one fades out and then
 * rests: it is not drawn at all. That keeps the draw calls inside the < 150 budget
 * wherever the lens looks, and nothing pops in or out. The fade is a short moment
 * (`FAR_FADE_S`) when a piece crosses its edge — never a see-through animal standing
 * at some distance — and the edge has two sides (it goes beyond `far`, comes back
 * within `near`), so walking along it never makes it flicker.
 */

import * as THREE from 'three';

interface Solid { transparent: boolean; opacity: number; depthWrite: boolean; forceSinglePass: boolean }

/**
 * Every material under `root`, made fadeable: each remembers how it was drawn, so a
 * finished fade gives it back exactly. `own` first gives a mesh its own copy of a
 * material it may share with other clones of the same GLB (fading one marker's
 * animal must never fade another's).
 */
export function fadeable(root: THREE.Object3D, own = false): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mine = own ? list.map((m) => (m.userData.fadeOwn === mesh.uuid ? m : ownCopy(m, mesh.uuid))) : list;
    if (own && mine.some((m, i) => m !== list[i])) mesh.material = Array.isArray(mesh.material) ? mine : mine[0];
    for (const m of mine) {
      m.userData.solid ??= { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, forceSinglePass: m.forceSinglePass } satisfies Solid;
      out.push(m);
    }
  });
  return out;
}

function ownCopy(m: THREE.Material, owner: string): THREE.Material {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile; // (eye shaders keep their hooks)
  c.userData = { ...m.userData, fadeOwn: owner };
  return c;
}

/** Draw `mats` at `k` (0..1) of their own opacity; at 1 exactly as they were. */
export function setOpacity(mats: THREE.Material[], k: number): void {
  for (const m of mats) {
    const was = m.userData.solid as Solid;
    const done = k >= 1;
    const transparent = done ? was.transparent : true;
    if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
    m.opacity = was.opacity * k;
    m.depthWrite = done ? was.depthWrite : k > 0.6;
    // while it fades, one pass: a see-through double-sided material (a fern, a tussock) is
    // otherwise drawn twice, back faces then front, so a fading home cost twice its draw
    // calls just when a wide view already held several (run 6 integration)
    m.forceSinglePass = done ? was.forceSinglePass ?? false : true;
  }
}

/** How long (s) a far piece takes to fade out, or back in. */
export const FAR_FADE_S = 0.9;

/** A far piece's calm rest: it fades out once it is further than `far` m from the
 *  lens and back in once it is nearer than `near` m; in between it keeps what it was. */
export class FarRest {
  private want = true;
  private k = Number.NaN;
  private readonly near: number;
  private readonly far: number;
  constructor(near: number, far: number) { this.near = near; this.far = far; }
  /** The piece's draw factor now (1 = drawn, 0 = resting), stepped by `dt`; the first
   *  step, and every step under reduced motion, is a cut. */
  step(d: number, dt: number, reduced: boolean): number {
    if (d < this.near) this.want = true;
    else if (d > this.far) this.want = false;
    const to = this.want ? 1 : 0;
    if (Number.isNaN(this.k) || reduced) this.k = to;
    else this.k += Math.sign(to - this.k) * Math.min(Math.abs(to - this.k), dt / FAR_FADE_S);
    return this.k;
  }

  /** Drawn from now on, fully (a piece the player needs at once, however far the lens):
   *  a later `step` fades it out calmly if it is far. */
  hold(): void {
    this.want = true;
    this.k = 1;
  }
}

/** Below this share of its opacity a fading piece is not drawn (see `restFar`). */
const DRAWN_FROM = 0.05;

/**
 * Draw a whole piece at `k` (from `FarRest`): fully at 1, see-through while it fades,
 * not drawn at all (it rests) at 0. Cheap when nothing changes. The piece's own
 * `visible` is this function's: toggle a parent to hide it otherwise.
 */
export function restFar(root: THREE.Object3D, k: number): void {
  const was = (root.userData.farK as number | undefined) ?? 1;
  if (k === was) return;
  root.userData.farK = k;
  // the last few hundredths of a fade are not drawn either: nobody sees a piece at 3 %,
  // and a whole home drawn for them is a dozen draw calls in a view that has none spare
  root.visible = k >= DRAWN_FROM;
  if (root.visible) setOpacity(fadeable(root, true), k);
}
