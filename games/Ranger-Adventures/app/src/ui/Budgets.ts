import type * as THREE from 'three';

/** iPad target from BUILD-PLAN §1d: under 150 draw calls per frame. */
const DRAW_CALL_BUDGET = 150;

/**
 * Dev-only overlay that surfaces the live runtime budget (draw calls, triangles,
 * FPS) from renderer.info — the §1d guardrail made visible. aria-hidden, so it
 * never reaches the child; a later build gates it behind a dev flag.
 */
export class Budgets {
  private readonly el: HTMLDivElement;
  private acc = 0;
  private frames = 0;
  private fps = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'budgets';
    this.el.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.el);
  }

  /** Call once per frame (after render). Recomputes/repaints ~2x/second. */
  update(renderer: THREE.WebGLRenderer, dt: number): void {
    this.acc += dt;
    this.frames += 1;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.acc = 0;
    this.frames = 0;
    this.paint(renderer);
  }

  private paint(renderer: THREE.WebGLRenderer): void {
    const { calls, triangles } = renderer.info.render;
    const over = calls > DRAW_CALL_BUDGET;
    this.el.innerHTML =
      `<span class="b-row ${over ? 'b-over' : 'b-ok'}">draw calls ${calls} / ${DRAW_CALL_BUDGET}</span>` +
      `<span class="b-row">tris ${triangles.toLocaleString('nl-NL')}</span>` +
      `<span class="b-row">fps ${this.fps}</span>`;
  }
}
