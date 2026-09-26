/**
 * stage.ts — where and how a 3D mini-game stands in the world (2026-09-26).
 *
 * A `Stage` picks a play patch IN FRONT of the ranger (he stays behind the lens, so
 * he never stands in the patch or hides a target), clear of hub props, trees, water
 * and other missions' animals (`WorldCtx.isClear`), and frames it with ONE calm
 * reframe: the lens looks where it already looked whenever that heading is clear (a
 * forward glide, no turn), keeps a fixed pitch and FOV, and backs off only as far as
 * the patch needs to fit the part of the screen the game's DOM card leaves free.
 *
 * Everything staged on it sits PER POINT on `WorldCtx.groundY` (the rendered ground),
 * never on a flat activity Y. The approached marker animal is hidden while the game
 * runs (its mission is being played right here) and comes back on `dispose()`.
 */

import * as THREE from 'three';
import type { Spawned, SpawnOpts, WorldCtx } from './types';
import { makeReframe } from './kit';
import { safeCamHeight, stageHeadings } from './kit-math';
import { grassMaterial, grassTuftGeometry, heightFor } from './spawn';

export interface StageSpec {
  /** playfield half-width across the view (m) */
  halfW: number;
  /** playfield half-depth along the view (m) */
  halfD: number;
  /** tallest thing staged on the patch (m) — its top stays in frame */
  tall?: number;
  /** lens pitch below the horizon (deg) */
  pitchDeg?: number;
  /** screen px the DOM card covers at the top / bottom — the patch frames between them */
  insetTop?: number;
  insetBottom?: number;
}

const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);

export class Stage {
  readonly ctx: WorldCtx;
  readonly spec: Required<StageSpec>;
  /** patch centre on the ground */
  readonly centre = V();
  /** unit XZ direction from the lens into the patch (depth axis, v +) */
  readonly fwd = V();
  /** unit XZ direction across the patch (u +, screen-right) */
  readonly right = V();
  /** planned lens position + aim */
  readonly cam = V();
  readonly look = V();

  private readonly scene: THREE.Scene;
  private readonly owned: THREE.Object3D[] = [];
  private readonly spawned: Spawned[] = [];
  private readonly hidden: { o: THREE.Object3D; was: boolean }[] = [];
  private disposed = false;

  constructor(ctx: WorldCtx, spec: StageSpec) {
    this.ctx = ctx;
    this.scene = ctx.scene as THREE.Scene;
    this.spec = {
      tall: 1, pitchDeg: 30, insetTop: 0, insetBottom: 0, ...spec,
    };
    this.plan();
    ctx.setFocus(this.centre.x, this.centre.y, this.centre.z);
    // the approached marker IS this mission's animal — while its game runs it steps
    // out of the scene rather than standing in (or in front of) the patch
    const m = ctx.approachedModel as THREE.Object3D | null;
    if (m) { this.hidden.push({ o: m, was: m.visible }); m.visible = false; }
  }

  /* ------------------------------------------------------------- planning ---- */

  private plan(): void {
    const ctx = this.ctx;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const R = V(ctx.player.x, 0, ctx.player.z);
    // straight ahead = where the lens already looks (so the reframe is a glide, no turn)
    const look0 = camera.getWorldDirection(V());
    look0.y = 0;
    if (look0.lengthSq() < 1e-6) look0.set(-Math.sin(ctx.player.yaw), 0, -Math.cos(ctx.player.yaw));
    look0.normalize();

    let best: { score: number; f: THREE.Vector3; P: THREE.Vector3; cam: THREE.Vector3; look: THREE.Vector3 } | null = null;
    for (const deg of stageHeadings()) {
      const f = look0.clone().applyAxisAngle(V(0, 1, 0), (deg * Math.PI) / 180);
      const fit = this.fitAlong(R, f);
      const bad = this.violations(fit.P, f, fit.cam);
      const score = bad * 100 + Math.abs(deg) / 180;
      if (!best || score < best.score) best = { score, f, P: fit.P, cam: fit.cam, look: fit.look };
      if (bad < 0.01) break;
    }
    const b = best!;
    this.fwd.copy(b.f);
    this.right.set(-b.f.z, 0, b.f.x); // fwd × up → screen-right
    this.centre.copy(b.P);
    this.cam.copy(b.cam);
    this.look.copy(b.look);
  }

  /** The lens pose that frames a patch laid along heading `f` from the ranger at R. The
   *  patch starts ≥1.2 m ahead of him and far enough out that the lens (which backs
   *  off to fit the patch into the free screen band) still stands in FRONT of him. */
  private fitAlong(R: THREE.Vector3, f: THREE.Vector3): { P: THREE.Vector3; cam: THREE.Vector3; look: THREE.Vector3 } {
    const { halfD } = this.spec;
    let ahead = 1.2 + halfD;
    let out = this.fitAt(R.clone().addScaledVector(f, ahead), f);
    for (let i = 0; i < 3; i++) {
      const lensBack = Math.hypot(out.cam.x - out.P.x, out.cam.z - out.P.z);
      const need = Math.max(1.2 + halfD, lensBack + 0.35);
      if (need <= ahead + 0.05) break;
      ahead = need;
      out = this.fitAt(R.clone().addScaledVector(f, ahead), f);
    }
    return out;
  }

  /** Back the lens off along a fixed pitch until the patch box fits the free band. */
  private fitAt(P0: THREE.Vector3, f: THREE.Vector3): { P: THREE.Vector3; cam: THREE.Vector3; look: THREE.Vector3 } {
    const ctx = this.ctx;
    const { halfW, halfD, tall, pitchDeg, insetTop, insetBottom } = this.spec;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const rect = ctx.canvas.getBoundingClientRect();
    const H = rect.height || 800;
    const W = rect.width || 1280;
    const yTop = 1 - (2 * (insetTop + 12)) / H;
    const yBot = -1 + (2 * (insetBottom + 12)) / H;
    const xLim = 1 - 24 / W * 2;
    const P = P0.clone();
    P.y = ctx.groundY(P.x, P.z);
    const right = V(-f.z, 0, f.x);
    // the patch box: its ground corners + the tallest form over the front/back rows
    const pts: THREE.Vector3[] = [];
    for (const u of [-halfW, 0, halfW]) {
      for (const v of [-halfD, halfD]) {
        const g = P.clone().addScaledVector(right, u).addScaledVector(f, v);
        g.y = ctx.groundY(g.x, g.z);
        pts.push(g, g.clone().setY(g.y + tall));
      }
    }
    const tmp = new THREE.PerspectiveCamera(camera.fov, W / H, 0.1, 400);
    const pitch = (pitchDeg * Math.PI) / 180;
    const dir = f.clone().multiplyScalar(Math.cos(pitch)).setY(-Math.sin(pitch)); // lens → aim
    const ndc = V();
    let bestFit: { cam: THREE.Vector3; look: THREE.Vector3 } | null = null;
    for (let dist = 3; dist <= 16 && !bestFit; dist += 0.2) {
      // slide the aim point up/down so the box sits centred in the free band
      let lift = tall * 0.35;
      for (let k = 0; k < 4; k++) {
        const look = P.clone().setY(P.y + lift);
        tmp.position.copy(look).addScaledVector(dir, -dist);
        tmp.up.set(0, 1, 0);
        tmp.lookAt(look);
        tmp.updateMatrixWorld(true);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
          ndc.copy(p).project(tmp);
          minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x);
          minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y);
        }
        if (minX >= -xLim && maxX <= xLim && minY >= yBot && maxY <= yTop) {
          bestFit = { cam: tmp.position.clone(), look };
          break;
        }
        // re-centre vertically: shift the aim by the band-centre error (in metres at the patch)
        const err = (minY + maxY) / 2 - (yTop + yBot) / 2;
        const mPerNdc = dist * Math.tan((camera.fov * Math.PI) / 360);
        lift += err * mPerNdc;
      }
    }
    if (!bestFit) {
      const look = P.clone().setY(P.y + tall * 0.35);
      bestFit = { cam: look.clone().addScaledVector(dir, -16), look };
    }
    // never under (or skimming) the rendered ground at the lens's own spot
    bestFit.cam.y = safeCamHeight(bestFit.cam.y, ctx.groundY(bestFit.cam.x, bestFit.cam.z), 1.4);
    return { P, cam: bestFit.cam, look: bestFit.look };
  }

  /** How many clearance rules a candidate breaks (0 = a good stage). */
  private violations(P: THREE.Vector3, f: THREE.Vector3, cam: THREE.Vector3): number {
    const ctx = this.ctx;
    const { halfW, halfD } = this.spec;
    const right = V(-f.z, 0, f.x);
    let bad = 0;
    // the patch itself (+ a small rim) is free
    for (let u = -halfW - 0.3; u <= halfW + 0.31; u += 0.7) {
      for (let v = -halfD - 0.3; v <= halfD + 0.31; v += 0.7) {
        const x = P.x + right.x * u + f.x * v, z = P.z + right.z * u + f.z * v;
        if (!ctx.isClear(x, z, 0.2)) bad++;
      }
    }
    // the backdrop just behind the patch stays calm too (no jeep, cabin or person
    // standing over the game) — a lighter rule: it only breaks a tie
    for (let u = -halfW - 1; u <= halfW + 1.01; u += 1.0) {
      for (let v = halfD + 0.9; v <= halfD + 7; v += 1.2) {
        const x = P.x + right.x * u + f.x * v, z = P.z + right.z * u + f.z * v;
        if (!ctx.isClear(x, z, 0.4)) bad += v < halfD + 3.5 ? 0.3 : 0.1;
      }
    }
    // the lens stands in the open and sees the patch over open ground
    if (!ctx.isClear(cam.x, cam.z, 0.6)) bad += 3;
    for (let t = 0.15; t < 1; t += 0.15) {
      const x = cam.x + (P.x - cam.x) * t, z = cam.z + (P.z - cam.z) * t;
      if (!ctx.isClear(x, z, 0.3)) bad++;
    }
    // the rolling ground never rises between the lens and the back of the patch
    for (const u of [-halfW, 0, halfW]) {
      const tx = P.x + right.x * u + f.x * halfD, tz = P.z + right.z * u + f.z * halfD;
      const ty = ctx.groundY(tx, tz) + 0.15;
      for (let t = 0.1; t < 1; t += 0.1) {
        const x = cam.x + (tx - cam.x) * t, z = cam.z + (tz - cam.z) * t;
        const y = cam.y + (ty - cam.y) * t;
        if (ctx.groundY(x, z) > y) { bad += 2; break; }
      }
    }
    return bad;
  }

  /* ------------------------------------------------------------- building ---- */

  /** A point on the rendered ground at patch-local (u across, v into the view). */
  at(u: number, v: number, lift = 0): THREE.Vector3 {
    const x = this.centre.x + this.right.x * u + this.fwd.x * v;
    const z = this.centre.z + this.right.z * u + this.fwd.z * v;
    return V(x, this.ctx.groundY(x, z) + lift, z);
  }

  /** rotation.y that turns a model's +z (its face) toward the lens, plus `turn` rad. */
  faceLens(p: THREE.Vector3, turn = 0): number {
    return Math.atan2(this.cam.x - p.x, this.cam.z - p.z) + turn;
  }

  /** Add an object to the scene, owned by the stage (removed + freed on dispose). */
  add<T extends THREE.Object3D>(o: T): T {
    if (this.disposed) return o; // a late async add after teardown never re-enters the scene
    this.scene.add(o);
    this.owned.push(o);
    return o;
  }

  /** Spawn one of the world's animals standing at patch-local (u,v), facing the lens
   *  turned by `turn` rad (a side-on profile reads best: ±1.2). Null when missing. */
  async animal(id: string, u: number, v: number, turn = 0, opts: SpawnOpts = {}): Promise<THREE.Group | null> {
    const s = await this.ctx.spawnModel(id, { height: heightFor(id), ...opts });
    if (!s) return null;
    if (this.disposed) { s.dispose(); return null; }
    return this.place(s, u, v, turn);
  }

  /** Spawn a world vegetation piece at patch-local (u,v). Null when missing. */
  async plant(id: string, height: number, u: number, v: number, spin = 0): Promise<THREE.Group | null> {
    const s = await this.ctx.spawnPlant(id, height);
    if (!s) return null;
    if (this.disposed) { s.dispose(); return null; }
    const g = this.place(s, u, v, 0);
    g.rotation.y = spin;
    return g;
  }

  /** Soft grass tufts at patch-local points (h = tuft height, m) — ONE instanced draw
   *  call for the whole patch, every tuft seated on the ground. */
  grass(points: { u: number; v: number; h: number }[], blades = 18): THREE.InstancedMesh {
    return this.add(this.grassMesh(points, blades));
  }

  /** The same grass tufts as one mesh the caller owns (e.g. per-encounter dressing). */
  grassMesh(points: { u: number; v: number; h: number }[], blades = 18): THREE.InstancedMesh {
    const geo = grassTuftGeometry(blades, 7 + blades);
    const mesh = new THREE.InstancedMesh(geo, grassMaterial(), Math.max(1, points.length));
    mesh.count = points.length;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    points.forEach((p, i) => {
      const at = this.at(p.u, p.v, -0.02);
      q.setFromAxisAngle(V(0, 1, 0), i * 2.39996);
      m.compose(at, q, V(p.h * 1.1, p.h, p.h * 1.1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  /**
   * A flat, soft-edged ground patch (sand under an adder, a mud pool, a sunny
   * clearing) centred at patch-local (u,v), `rx` across × `rz` deep, with a gently
   * irregular rim. A polar mesh draped vertex by vertex over the RENDERED ground, so
   * it never cuts into a slope or floats over a dip. `layer` stacks decals (a higher
   * layer draws over a lower one without z-fighting). The caller owns the mesh.
   */
  decal(color: THREE.ColorRepresentation, rx: number, rz: number, u: number, v: number,
    opts: { roughness?: number; layer?: number; emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}): THREE.Mesh {
    const layer = opts.layer ?? 1;
    const RINGS = 6, SEGS = 32;
    const pos: number[] = [];
    const idx: number[] = [];
    const c = this.at(u, v);
    pos.push(c.x, c.y + 0.02 + layer * 0.012, c.z);
    for (let r = 1; r <= RINGS; r++) {
      const k = r / RINGS;
      for (let i = 0; i < SEGS; i++) {
        const a = (i / SEGS) * Math.PI * 2;
        const wob = k === 1 ? 1 + 0.08 * Math.sin(a * 3 + u * 5) + 0.05 * Math.cos(a * 5 + v * 3) : 1;
        const lu = u + Math.cos(a) * rx * k * wob, lv = v + Math.sin(a) * rz * k * wob;
        const p = this.at(lu, lv, 0.02 + layer * 0.012);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < SEGS; i++) idx.push(0, 1 + ((i + 1) % SEGS), 1 + i);
    for (let r = 1; r < RINGS; r++) {
      const a0 = 1 + (r - 1) * SEGS, b0 = 1 + r * SEGS;
      for (let i = 0; i < SEGS; i++) {
        const i1 = (i + 1) % SEGS;
        idx.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // make sure the faces point up whatever the winding came out as
    const n = geo.attributes.normal as THREE.BufferAttribute;
    if (n.getY(0) < 0) { geo.setIndex(idx.slice().reverse()); geo.computeVertexNormals(); }
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 1,
      emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 0,
      polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = layer;
    return mesh;
  }

  /** Seat a spawn at patch-local (u,v) on the ground and hand it to the stage. */
  place(s: Spawned, u: number, v: number, turn: number): THREE.Group {
    const root = s.root as THREE.Group;
    const p = this.at(u, v);
    root.position.copy(p);
    root.rotation.y = this.faceLens(p, turn);
    this.scene.add(root);
    this.spawned.push(s);
    return root;
  }

  /** Re-seat an object on the ground at its current x/z (+ lift). */
  seat(o: THREE.Object3D, lift = 0): void {
    o.position.y = this.ctx.groundY(o.position.x, o.position.z) + lift;
  }

  /** The one calm move onto the patch (a cut under reduced-motion). */
  reframe(): { update: (dt: number) => boolean } {
    // the lens glides forward over the ranger's head: a small rise keeps him low in frame
    return makeReframe(this.ctx.camera as THREE.PerspectiveCamera, this.cam.clone(), this.look.clone(), this.ctx.reducedMotion, 1.3, 0.6);
  }

  /** Advance every spawned idle clip (call once per frame). */
  update(dt: number): void {
    for (const s of this.spawned) s.update(dt);
  }

  /** Remove + free everything the stage made and bring the hidden marker back. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.spawned) s.dispose();
    this.spawned.length = 0;
    for (const o of this.owned) {
      o.removeFromParent();
      o.traverse((c) => {
        if ((c as THREE.Sprite).isSprite) { disposeTag(c as THREE.Sprite); return; } // shared sprite geometry stays
        const mesh = c as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of mats) m.dispose();
      });
    }
    this.owned.length = 0;
    for (const h of this.hidden) h.o.visible = h.was;
    this.hidden.length = 0;
  }
}

/** A camera-facing name tag (rounded dark card, white text) — the in-world label the
 *  simon/wisselen/roep games hang over an animal. `width` in metres. */
export function nameTag(text: string, width = 0.95): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.font = '600 64px Inter, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(500, g.measureText(text).width + 56);
  g.fillStyle = 'rgba(28,24,18,0.78)';
  const x = (512 - w) / 2, y = 20, h = 88, r = 26;
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(width, width / 4, 1);
  sprite.renderOrder = 5;
  return sprite;
}

/** Dispose a sprite made by `nameTag` (its canvas texture + material). */
export function disposeTag(s: THREE.Sprite): void {
  s.material.map?.dispose();
  s.material.dispose();
}
