/**
 * frisling.clue.ts — the season's first clue as world dressing (design §4.1 beat 15,
 * content clue 'spoor': "Iemand knipte het hek stuk. In het zand staan grote
 * voetstappen."). A stretch of old wire fence past the wallow with one bay cut and its
 * two halves pulled open, and a grown-up's boot prints in a strip of sand through the
 * gap. Non-graphic: a fence and footprints, nothing more.
 *
 * Four draw calls (posts, wire, prints, sand), hidden until the mission is done; the
 * fence keeps the ranger and the animals out of the wire (two box obstacles) only
 * while it stands.
 */

import * as THREE from 'three';
import type { Obstacle } from '../../CharacterController';
import { boxObstacle } from '../../CharacterController';
import { groundDecal } from '../decal';
import { atLocal } from '../places';
import { CLUE, CLUE_FRAME, bootPrints, cluePosts } from './frisling.places';

/** Where the cut bay's two halves end (share of the bay from its left post). */
const CUT = { left: 0.3, right: 0.7, pull: 0.32, sag: 0.14 } as const;
const WIRE_H = 1.0;
const WIRE_LIFT = 0.07;

/** The wire mesh of one metre of fence: galvanised strands, closer near the ground. */
function wireTexture(bays: number): THREE.CanvasTexture {
  const W = 256 * bays, H = 192;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#a7a79c';
  g.lineCap = 'round';
  // horizontal strands (from the bottom up, wider apart higher up: a game fence)
  const rows = [0.02, 0.1, 0.19, 0.29, 0.4, 0.52, 0.65, 0.8, 0.97];
  g.lineWidth = 2.2;
  for (const r of rows) {
    const y = H - r * (H - 4) - 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  // vertical stays
  g.lineWidth = 1.6;
  const stays = 10;
  for (let i = 0; i <= stays * bays; i++) {
    const x = (i / (stays * bays)) * W;
    g.beginPath(); g.moveTo(x, H - rows[0] * (H - 4) - 2); g.lineTo(x, H - rows[rows.length - 1] * (H - 4) - 2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A grown-up's boot sole: a long print with a heel, the tread in bars. */
function soleTexture(): THREE.CanvasTexture {
  const W = 64, H = 160;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(52, 38, 24, 0.85)';
  // the ball and toe (top), the heel (bottom), a narrow arch between
  g.beginPath(); g.ellipse(32, 44, 25, 40, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(31, 128, 19, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(20, 70, 22, 44);
  // the tread: lighter bars across
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0, 0, 0, 0.55)';
  for (let y = 12; y < 150; y += 11) {
    if (y > 80 && y < 104) continue; // the arch leaves no bars
    g.fillRect(8, y, 48, 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CutFence {
  readonly group = new THREE.Group();
  private readonly obstacles: Obstacle[];
  private readonly worldObstacles: Obstacle[];
  private readonly mats: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private fade = 1;
  private fadeSecs = 0;
  private shown = false;

  constructor(parent: THREE.Object3D, groundY: (x: number, z: number) => number, worldObstacles: Obstacle[]) {
    this.group.name = 'frisling-clue';
    this.worldObstacles = worldObstacles;
    const posts = cluePosts();
    const f = CLUE_FRAME;

    /* -- the posts: weathered wood, one leaning -- */
    const postGeo = new THREE.CylinderGeometry(0.045, 0.056, CLUE.postH, 7).translate(0, CLUE.postH / 2, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: '#6e5a42', roughness: 0.95 });
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    postMesh.name = 'clue-posts';
    const m = new THREE.Matrix4();
    posts.forEach((p, i) => {
      const lean = i === CLUE.gapBay ? 0.09 : Math.sin(i * 2.1) * 0.025;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, f.heading + i, 0, 'YXZ'));
      m.compose(new THREE.Vector3(p.x, groundY(p.x, p.z) - 0.05, p.z), q, new THREE.Vector3(1, 1, 1));
      postMesh.setMatrixAt(i, m);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    postMesh.castShadow = true;
    this.group.add(postMesh);

    /* -- the wire: one quad a bay, the cut bay two halves pulled open toward the wallow -- */
    const bays = posts.length - 1;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const quad = (a: { x: number; z: number; y: number; top: number }, b: { x: number; z: number; y: number; top: number }, u0: number, u1: number): void => {
      const n = pos.length / 3;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, b.x, b.top, b.z, a.x, a.top, a.z);
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    const at = (u: number, v: number, sag = 0): { x: number; z: number; y: number; top: number } => {
      const p = atLocal(f, u, v);
      const y = groundY(p.x, p.z) + WIRE_LIFT;
      return { x: p.x, z: p.z, y, top: y + WIRE_H - sag };
    };
    const half = ((posts.length - 1) * CLUE.bay) / 2;
    for (let i = 0; i < bays; i++) {
      const u0 = -half + i * CLUE.bay, u1 = u0 + CLUE.bay;
      if (i !== CLUE.gapBay) { quad(at(u0, 0), at(u1, 0), i / bays, (i + 1) / bays); continue; }
      // cut: each half hangs from its post, its free edge pulled in and sagging
      const cl = u0 + CLUE.bay * CUT.left, cr = u0 + CLUE.bay * CUT.right;
      quad(at(u0, 0), at(cl, -CUT.pull, CUT.sag), i / bays, (i + CUT.left) / bays);
      quad(at(cr, -CUT.pull * 0.8, CUT.sag * 0.7), at(u1, 0), (i + CUT.right) / bays, (i + 1) / bays);
    }
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wireGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    wireGeo.setIndex(idx);
    wireGeo.computeVertexNormals();
    const wireTex = wireTexture(bays);
    const wireMat = new THREE.MeshStandardMaterial({
      map: wireTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.name = 'clue-wire';
    this.group.add(wire);

    /* -- a strip of sand through the gap, and the boot prints in it -- */
    const prints = bootPrints();
    const mid = prints[Math.floor(prints.length / 2)];
    const sand = groundDecal(groundY, mid.x, mid.z, 0.55, 3.2, f.heading, '#b9a27a', { layer: 1, wobble: 0.14, seed: 12, feather: true });
    sand.name = 'clue-sand';
    this.group.add(sand);
    const soleTex = soleTexture();
    const soleMat = new THREE.MeshStandardMaterial({
      map: soleTex, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, // (the right foot is the left one mirrored)
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    const soleGeo = new THREE.PlaneGeometry(0.12, 0.3).rotateX(-Math.PI / 2);
    const soles = new THREE.InstancedMesh(soleGeo, soleMat, prints.length);
    soles.name = 'clue-prints';
    prints.forEach((p, i) => {
      // (the texture's toe is at its top: +v of the plane, which lies along −z once flat)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw + Math.PI);
      m.compose(new THREE.Vector3(p.x, groundY(p.x, p.z) + 0.05, p.z), q, new THREE.Vector3(p.left ? 1 : -1, 1, 1));
      soles.setMatrixAt(i, m);
    });
    soles.instanceMatrix.needsUpdate = true;
    soles.renderOrder = 3;
    this.group.add(soles);

    this.mats.push(postMat, wireMat, soleMat, sand.material as THREE.Material);
    this.textures.push(wireTex, soleTex);
    this.geos.push(postGeo, wireGeo, soleGeo, sand.geometry);

    /* -- the wire keeps walkers out, except through the gap -- */
    const rot = f.heading + Math.PI; // (a box's own x runs along the fence)
    const gl = -half + CLUE.gapBay * CLUE.bay + CLUE.bay * CUT.left;
    const gr = -half + CLUE.gapBay * CLUE.bay + CLUE.bay * CUT.right;
    const box = (a: number, b: number): Obstacle => { const c = atLocal(f, (a + b) / 2, 0); return boxObstacle(c.x, c.z, (b - a) / 2, 0.05, rot, 0.25); };
    this.obstacles = [box(-half, gl), box(gr, half)];

    this.group.visible = false;
    parent.add(this.group);
  }

  /** Show it (fading in over `secs`: under a card, never popping in view) or hide it. */
  show(on: boolean, secs = 0): void {
    if (on === this.shown) return;
    this.shown = on;
    this.group.visible = on;
    for (const o of this.obstacles) {
      const i = this.worldObstacles.indexOf(o);
      if (on && i < 0) this.worldObstacles.push(o);
      if (!on && i >= 0) this.worldObstacles.splice(i, 1);
    }
    this.fadeSecs = on ? secs : 0;
    this.fade = on && secs > 0 ? 0 : 1;
    this.applyFade();
  }

  get visible(): boolean { return this.shown; }

  update(dt: number): void {
    if (this.fade >= 1 || this.fadeSecs <= 0) return;
    this.fade = Math.min(1, this.fade + dt / this.fadeSecs);
    this.applyFade();
  }

  private applyFade(): void {
    const k = this.fade;
    const [postMat, wireMat, soleMat, sandMat] = this.mats as THREE.MeshStandardMaterial[];
    for (const mat of [postMat, wireMat]) {
      const fading = k < 1;
      if (mat.transparent !== fading) { mat.transparent = fading; mat.needsUpdate = true; }
      mat.opacity = k;
    }
    soleMat.opacity = k;
    sandMat.opacity = k;
    if (!sandMat.transparent) { sandMat.transparent = true; sandMat.needsUpdate = true; }
  }

  dispose(): void {
    this.show(false);
    for (const t of this.textures) t.dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    this.group.removeFromParent();
  }
}
