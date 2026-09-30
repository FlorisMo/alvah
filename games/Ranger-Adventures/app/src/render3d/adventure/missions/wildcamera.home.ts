/**
 * wildcamera.home.ts — the crossing in the wood, built with the world (the THREE half of
 * wildcamera.places.ts): the stump in the marker ring with the camera trap lying on it,
 * the WILDWISSEL (a trodden game trail with deer slots, boar and badger prints) winding
 * from the ring to the crossing, the second trail from the open glade past the camera
 * pine into the thicket, the glade's short grass and foxgloves, the thicket's bramble,
 * juniper and bracken with the badger's sett at its foot, a fallen log, the camera trap
 * itself (strapped to the pine: it turns on its strap, its red light blinks, it flashes
 * a soft infrared glow at night), the fan of ground it sees, the empty snare, the nightjar
 * (it flies, so the home moves it), and the man in the morning photo (never in the world:
 * he stands in the picture for the one render that takes it).
 *
 * Before the mission the camera lies on the stump; after it, it hangs on its pine,
 * blinking now and then — also after a reload.
 */

import * as THREE from 'three';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { groundDecal } from '../decal';
import { atLocal, dist, headingTo, stream, toLocal } from '../places';
import { grassTuftGeometry, grassMaterial, heightFor } from '../../play/spawn';
import { disposeTag } from '../../play/stage';
import { boxObstacle } from '../../CharacterController';
import { SIZE } from '../../AnimalScale';
import { crouchPose } from './wildcamera.pose';
import {
  WILDCAMERA_PLACES as P, CROSS, TREE, PINE, CAMERA, LOG, GLADE_R, FAN_HALF, SETT_FACE, JUNIPER, THICKET_BUSHES, TAG_AT, NIGHTJAR_AT, NIGHTJAR_STUMP,
  SNARE_MARKS, trailA, trailB,
} from './wildcamera.places';
import type { Spot } from '../types';

/** The camera trap's size (m): shown ≈ 1.5× so a child sees it on its tree (AnimalScale). */
const CAM_H = SIZE.wildcamera.h;
/** How far its lens sits in front of its back (m), at CAM_H (the model is 1.29 : 1.6). */
const CAM_DEPTH = CAM_H * (1.29 / 1.6);
/** The camera's fan of view on the ground: its reach (m); its half-angle is the places'. */
const FAN_REACH = 5.4;
/** The places' name-tags: how wide (m), and how long a turn of their marks takes (s: a
 *  sign turning over, edge-on half way). */
const TAG_W = 1.9;
const TAG_TURN_S = 0.7;
/** The camera's "no" (a press beside both places): a short sweep over and back on its
 *  strap — how long (s) and how far each way (rad). */
const NOD_S = 0.46;
const NOD_RAD = 0.24;

/** A soft round glow (white in the middle, fading out): the red light's halo, so a
 *  1 cm light on a camera reads from across the crossing. */
let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Which animals a place is for under the rule shown now: a sun (day animals) or a moon
 *  (night animals), the same marks the card's rule chips and tags carry. */
type Mark = 'dag' | 'nacht';

/**
 * A place's name over the world with its day/night mark in front: the name-tag's dark
 * pill (play/stage `nameTag`), and a round badge before the words, a drawn sun on the
 * card's day yellow or a drawn moon on its night blue. Drawn into `canvas` (redrawn when
 * the mark turns: one texture, `needsUpdate`).
 */
function drawMarkTag(canvas: HTMLCanvasElement, text: string, mark: Mark): void {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = '600 64px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';
  const badge = 84; // the badge's width, with its gap
  const tw = g.measureText(text).width;
  const w = Math.min(500, tw + 56 + badge);
  const x = (512 - w) / 2, y = 20, h = 88, r = 26;
  g.fillStyle = 'rgba(28,24,18,0.78)';
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
  // the badge: the card's aim-tag colours (wildcamera.css .aim-tag.dag / .nacht)
  const cx = x + 22 + 32, cy = 64;
  g.fillStyle = mark === 'dag' ? '#f6d77a' : '#3f4f86';
  g.beginPath(); g.arc(cx, cy, 33, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round';
  if (mark === 'dag') {
    // a sun: a disc and eight short rays, in the day tag's dark brown
    g.fillStyle = g.strokeStyle = '#3b2a0c';
    g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17);
      g.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      g.stroke();
    }
  } else {
    // a moon: a crescent (a disc with a disc cut out), in the night tag's pale white
    g.fillStyle = '#f3f1ff';
    g.beginPath();
    g.arc(cx - 2, cy, 19, 0, Math.PI * 2);
    g.arc(cx + 8, cy - 7, 16, 0, Math.PI * 2, true);
    g.fill('evenodd');
  }
  g.fillStyle = '#fff';
  g.textAlign = 'left';
  g.fillText(text, x + 28 + badge - 6, 66);
}

/** A place's marked name-tag (a sprite; `disposeTag` frees it). */
function markTag(text: string, mark: Mark, width: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  drawMarkTag(canvas, text, mark);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  sprite.scale.set(width, width / 4, 1);
  sprite.renderOrder = 5;
  sprite.userData.text = text;
  return sprite;
}

/** The animal prints in the trails: an atlas of three kinds (64 px cells). */
type PrintKind = 0 | 1 | 2; // 0 a deer's slot, 1 a wild boar's, 2 a badger's
let printTex: THREE.CanvasTexture | null = null;
function printAtlas(): THREE.CanvasTexture {
  if (printTex) return printTex;
  const c = document.createElement('canvas');
  c.width = 192; c.height = 64;
  const g = c.getContext('2d')!;
  const ink = 'rgba(74,50,28,0.95)';
  const rim = 'rgba(214,190,146,0.95)';
  const toe = (cx: number, cy: number, rx: number, ry: number, rot = 0): void => {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    g.fillStyle = ink;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = rim;
    g.stroke();
  };
  // a deer's slot: two narrow pointed halves
  toe(26, 32, 6, 17, 0.08); toe(38, 32, 6, 17, -0.08);
  // a wild boar's: two broader, rounder halves and two dewclaw dots behind
  toe(64 + 25, 28, 8, 14, 0.12); toe(64 + 39, 28, 8, 14, -0.12);
  toe(64 + 20, 50, 3.5, 4); toe(64 + 44, 50, 3.5, 4);
  // a badger's: a broad pad and five toes in a row in front, claw marks
  toe(128 + 32, 40, 14, 9);
  for (let i = 0; i < 5; i++) {
    const x = 128 + 32 + (i - 2) * 7.5;
    toe(x, 22 - Math.abs(i - 2) * 1.5, 3.4, 4.2);
    g.fillStyle = ink;
    g.fillRect(x - 0.8, 10 - Math.abs(i - 2) * 1.5, 1.6, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  printTex = tex;
  return tex;
}

/** A ground mesh whose triangles all face up (wound counter-clockwise seen from above),
 *  so it is lit from its front like the ground under it. */
function upFacing(pos: number[], idx: number[]): THREE.BufferGeometry {
  const out: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const ux = pos[b * 3] - pos[a * 3], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    // the normal's y = (u × v).y = uz·vx − ux·vz: > 0 faces up
    if (uz * vx - ux * vz >= 0) out.push(a, b, c); else out.push(a, c, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(out);
  geo.computeVertexNormals();
  return geo;
}

/** A trodden strip of bare sandy soil along a polyline, draped over the ground, soft at
 *  its edges (vertex alpha). One draw call. */
function trailRibbon(groundY: (x: number, z: number) => number, lines: readonly Spot[][], width: number, seed: number): THREE.Mesh {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const base = new THREE.Color('#b99d73');
  const COLS = [-1, -0.55, 0, 0.55, 1];
  const ALPHA = [0, 0.62, 0.78, 0.62, 0];
  const rnd = stream(seed);
  for (const line of lines) {
    // resample the line every 0.3 m
    const pts: Spot[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const n = Math.max(1, Math.ceil(dist(a, b) / 0.3));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
    }
    pts.push(line[line.length - 1]);
    const start = pos.length / 3;
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l;
      const w = width * (0.85 + 0.3 * rnd()) * (i === 0 || i === pts.length - 1 ? 0.4 : 1);
      const fade = Math.min(1, i / 3, (pts.length - 1 - i) / 3);
      COLS.forEach((c, j) => {
        const x = p.x + nx * c * w * 0.5, z = p.z + nz * c * w * 0.5;
        pos.push(x, groundY(x, z) + 0.025, z);
        col.push(base.r, base.g, base.b, ALPHA[j] * fade);
      });
    });
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = 0; j < COLS.length - 1; j++) {
        const a = start + i * COLS.length + j, b = a + COLS.length;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const geo = upFacing(pos, idx);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wildwissel';
  mesh.renderOrder = 1;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  return mesh;
}

/** The prints along the trails: left/right, a stretch of one animal then another, every
 *  quad seated on the ground. One merged mesh, one draw call. */
function trailPrints(groundY: (x: number, z: number) => number, lines: readonly Spot[][], seed: number): THREE.Mesh {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const rnd = stream(seed);
  // (shown ≈ 1.6× their true size, like the camera: a child must see them in the trail)
  const SIZE_M: Record<PrintKind, number> = { 0: 0.2, 1: 0.22, 2: 0.2 };
  const STRIDE: Record<PrintKind, number> = { 0: 0.66, 1: 0.5, 2: 0.4 };
  let kind: PrintKind = 0;
  for (const line of lines) {
    let along = 0.4, left = true, runLeft = 2.2 + rnd() * 2;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const L = dist(a, b);
      const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
      while (along < L) {
        const cx = a.x + dx * along, cz = a.z + dz * along;
        const side = (left ? -1 : 1) * 0.07;
        const px = cx - dz * side, pz = cz + dx * side;
        const s = SIZE_M[kind] * (0.9 + rnd() * 0.2);
        const yaw = Math.atan2(dx, dz) + (rnd() - 0.5) * 0.25;
        const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
        const base = pos.length / 3;
        for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
          const x = px + rx * u * s + fx * v * s, z = pz + rz * u * s + fz * v * s;
          pos.push(x, groundY(x, z) + 0.035, z);
          uv.push((kind + (u + 0.5)) / 3, v + 0.5);
        }
        idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        along += STRIDE[kind] * (0.9 + rnd() * 0.2);
        left = !left;
        runLeft -= STRIDE[kind];
        if (runLeft <= 0) { kind = ((kind + 1 + Math.floor(rnd() * 2)) % 3) as PrintKind; runLeft = 1.8 + rnd() * 2.5; }
      }
      along -= L;
    }
  }
  const geo = upFacing(pos, idx);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mat = new THREE.MeshStandardMaterial({
    map: printAtlas(), transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wildwissel-prints';
  mesh.renderOrder = 2;
  mesh.raycast = () => {};
  return mesh;
}

/** The wildcamera's home, as the adventure uses it. */
export class WildcameraHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** the camera lying on the stump at the marker (before) */
  private stumpCam: THREE.Object3D | null = null;
  private stumpCamWanted = true;
  /** the camera trap on the pine: it turns about the trunk (`pivot.rotation.y` = where
   *  its lens looks), its red light blinks, its infrared glow flashes at night */
  readonly trap = new THREE.Group();
  private readonly trapBody = new THREE.Group();
  private readonly led: THREE.Mesh;
  /** the red light's soft halo (it blinks with the light) */
  private readonly ledGlow: THREE.Sprite;
  private readonly ir: THREE.Mesh;
  private readonly strap: THREE.Mesh;
  /** the ground the camera sees: a soft fan from its lens */
  private readonly fan: THREE.Mesh;
  private fanOn = 0;
  private fanWant = 0;
  private aimNow = 0;
  private aimFrom = 0;
  private aimTo = 0;
  private aimT = 1;
  private aimDur = 0.6;
  private blink: 'off' | 'idle' | 'rec' = 'off';
  private irFlash = 0;
  private ledFlash = 0;
  /** night: the red light gives way to the soft infrared glow round the lens */
  private irMode = false;
  private irOn = 0;
  private readonly irGlow: THREE.Sprite;
  /** the "no": time left (s), and the sweep it adds to where the camera looks (rad) */
  private nod = 0;
  private nodOff = 0;
  /** the places' marks: which each shows, and a turn under way (0 → 1) */
  private marks: { open: Mark; hol: Mark } = { open: 'dag', hol: 'nacht' };
  private markTurn: { t: number; to: { open: Mark; hol: Mark }; swapped: boolean } | null = null;
  /** the places' names, over the glade and the thicket (only while the camera is aimed) */
  readonly tags: { open: THREE.Sprite; hol: THREE.Sprite };
  /** the two places as a click finds them (the glade's ground, grass and flowers; the
   *  thicket's bushes and the sett), and what a perfect player clicks on each (the
   *  glade's sunny middle; the juniper) */
  readonly glade = new THREE.Group();
  readonly thicket = new THREE.Group();
  gladeHint: THREE.Object3D;
  thicketHint: THREE.Object3D;
  private readonly zones: THREE.Mesh[] = [];
  /** the empty snare by the trail (the morning), and the grass it lies half in */
  private snare: THREE.Object3D | null = null;
  private snareGrass: THREE.InstancedMesh | null = null;
  private snareWanted = false;
  /** the man in the morning photo (only ever in that one picture), crouched: how far
   *  his crouch sinks him */
  private poacher: THREE.Object3D | null = null;
  private poacherDrop = 0;
  /** the nightjar: it flies in and lands, so the home moves it */
  readonly bird = new THREE.Group();
  /** the log it sits on at night, and the bird: what a click on the nightjar finds (the
   *  bird on its log reads as one thing; a container at the origin) */
  readonly perch = new THREE.Group();
  private birdBody: THREE.Object3D | null = null;
  /** how high the top of the thicket's stump stands where the nightjar lands on it (m) */
  private stumpTop: number = NIGHTJAR_AT.hol.lift;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; yaw: number; done: () => void } | null = null;
  private readonly spawned: { dispose(): void; update?(dt: number): void }[] = [];
  private readonly groundY: (x: number, z: number) => number;
  private clock = 0;
  private state: HomeState = 'before';

  constructor(env: DressingEnv) {
    this.group.name = 'wildcamera-home';
    env.parent.add(this.group);
    const g = env.groundY;
    this.groundY = g;
    const add = (s: { root: unknown; dispose(): void } | null, x: number, z: number, yaw: number, lift = 0): THREE.Object3D | null => {
      if (!s) return null;
      const r = s.root as THREE.Object3D;
      r.position.set(x, g(x, z) + lift, z);
      r.rotation.y = yaw;
      this.group.add(r);
      this.spawned.push(s);
      return r;
    };

    /* -- the marker: a stump, the camera trap lying on it -- */
    const st = P.stump;
    const STUMP_H = 0.42;
    void env.spawnPlant('prop-tree-stump', STUMP_H).then((s) => add(s, st.x, st.z, 0.4, -0.05));
    env.obstacles.push({ x: st.x, z: st.z, r: 0.34 });
    void env.spawnPlant('prop-wildlife-camera', CAM_H).then((s) => {
      const r = add(s, st.x, st.z, headingTo(st, { x: 0, z: 0 }) + 0.5, STUMP_H - 0.08);
      if (!r) return;
      r.name = 'camera-on-stump';
      r.rotation.x = -Math.PI / 2 + 0.05; // lying on its back on the stump, lens up
      r.position.y += CAM_DEPTH * 0.5 - 0.02;
      r.visible = this.stumpCamWanted;
      this.stumpCam = r;
    });

    /* -- the trails: the wildwissel from the ring, the glade↔thicket trail -- */
    const lines = [trailA(), trailB()];
    this.group.add(trailRibbon(g, lines, 0.5, 11));
    this.group.add(trailPrints(g, lines, 29));
    // the crossing: a patch of trodden ground where the two trails meet
    this.group.add(groundDecal(g, TREE.x, TREE.z + 0.9, 1.25, 0.95, 0.4, '#9c8260', { layer: 1, wobble: 0.2, seed: 7, feather: true }));

    /* -- the open glade: short sunny grass, two foxgloves -- */
    const G = P.glade;
    this.glade.name = 'glade';
    this.thicket.name = 'thicket';
    // (the glade's grass and flowers and the thicket's bushes are small things: each rests
    // sooner than the home, by its own spot, Residents `detail`)
    env.detail(P.glade).add(this.glade);
    env.detail(P.thicket).add(this.thicket);
    this.glade.add(groundDecal(g, G.x, G.z, GLADE_R, GLADE_R * 0.8, 0.3, '#8f9a4c', { layer: 1, wobble: 0.22, seed: 3, feather: true }));
    // its sunny middle (the spot the camera aims at): a warm patch of short grass
    const sunny = groundDecal(g, G.x, G.z, 0.75, 0.6, 0.3, '#a9a856', { layer: 2, wobble: 0.25, seed: 8 });
    sunny.name = 'glade-sun';
    this.glade.add(sunny);
    this.gladeHint = sunny;
    const tufts = new THREE.InstancedMesh(grassTuftGeometry(14, 5), grassMaterial(), 34);
    tufts.name = 'glade-grass';
    const rnd = stream(41);
    const m = new THREE.Matrix4();
    // (none on the sandy trail where the nightjar lands at night, nor between it and the
    // lens: a dark bird on the path must never stand behind a tuft)
    const perch = toLocal(CROSS, NIGHTJAR_AT.open);
    const clear = (x: number, z: number): boolean => {
      const q = toLocal(CROSS, { x, z });
      return Math.hypot(q.u - perch.u, q.v - perch.v) < 0.6 || (Math.abs(q.u - perch.u) < 0.45 && q.v < perch.v && q.v > perch.v - 1.4);
    };
    for (let i = 0; i < tufts.count; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * GLADE_R * 0.95;
      const x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r * 0.8;
      const h = (0.22 + rnd() * 0.18) * (clear(x, z) ? 0 : 1);
      m.compose(new THREE.Vector3(x, g(x, z) - 0.01, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(h * 1.4, h, h * 1.4));
      tufts.setMatrixAt(i, m);
    }
    tufts.instanceMatrix.needsUpdate = true;
    this.glade.add(tufts);
    const fox1 = atLocal(CROSS, -6.1, -0.7), fox2 = atLocal(CROSS, -2.9, -0.4);
    void env.spawnPlant('prop-foxglove', SIZE.vingerhoedskruid.h * 0.8).then((s) => { const r = add(s, fox1.x, fox1.z, 1.1); if (r) this.glade.add(r); });
    void env.spawnPlant('prop-foxglove', SIZE.vingerhoedskruid.h * 0.65).then((s) => { const r = add(s, fox2.x, fox2.z, 2.4); if (r) this.glade.add(r); });

    /* -- the thicket: bramble, juniper, bracken; the sett at its foot -- */
    // (only the juniper is solid: the animals come and go through the rest, as through bracken)
    this.thicketHint = this.thicket;
    const bush = (id: string, h: number, u: number, v: number, yaw: number, solid = 0, hint = false): void => {
      const p = atLocal(CROSS, u, v);
      void env.spawnPlant(id, h).then((s) => {
        const r = add(s, p.x, p.z, yaw);
        if (!r) return;
        this.thicket.add(r);
        if (hint) this.thicketHint = r;
      });
      if (solid) env.obstacles.push({ x: p.x, z: p.z, r: solid });
    };
    for (const b of THICKET_BUSHES) {
      const q = toLocal(CROSS, b.at);
      bush(b.id, b.h, q.u, q.v, b.yaw, b.id === 'prop-juniper-bush' ? JUNIPER.r : 0, b.id === 'prop-juniper-bush');
    }
    const sett = P.sett;
    void env.spawnPlant('prop-badger-sett', SIZE.dassenburcht.h).then((s) => {
      // its way in faces into the wood, away from the views (the badger sleeps inside by day)
      const r = add(s, sett.x, sett.z, SETT_FACE, -0.04);
      if (r) this.thicket.add(r);
    });
    // the old stump at the thicket's front, before the sett: the nightjar's perch by day
    // (its top measured where the bird lands on it)
    const ns = NIGHTJAR_STUMP;
    void env.spawnPlant('prop-tree-stump', ns.h).then((s) => {
      const r = add(s, ns.x, ns.z, 2.2, -0.04);
      if (!r) return;
      this.thicket.add(r);
      r.updateMatrixWorld(true);
      const n = NIGHTJAR_AT.hol;
      const hit = new THREE.Raycaster(new THREE.Vector3(n.x, g(n.x, n.z) + 3, n.z), new THREE.Vector3(0, -1, 0)).intersectObject(r, true)[0];
      if (hit) this.stumpTop = hit.point.y - g(n.x, n.z);
    });
    env.obstacles.push({ x: ns.x, z: ns.z, r: ns.r });

    /* -- the fallen log the nightjar sits on at night (with the bird: one thing to click) -- */
    this.perch.name = 'nightjar-perch';
    this.group.add(this.perch);
    void env.spawnPlant('prop-fallen-log', LOG.h).then((s) => { const r = add(s, LOG.x, LOG.z, LOG.turn, -0.04); if (r) this.perch.add(r); });
    env.obstacles.push(boxObstacle(LOG.x, LOG.z, 0.55, 0.16, LOG.turn, 0.2));

    /* -- the camera trap on the pine -- */
    this.trap.name = 'camera-trap';
    this.trap.position.set(TREE.x, g(CAMERA.x, CAMERA.z) + PINE.camY, TREE.z);
    this.trap.add(this.trapBody);
    this.trapBody.position.z = PINE.trunkR + CAM_DEPTH * 0.5 - 0.01;
    this.strap = new THREE.Mesh(
      new THREE.TorusGeometry(PINE.trunkR + 0.012, 0.014, 6, 28).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#3c3a2c', roughness: 0.9 }),
    );
    this.strap.position.set(TREE.x, this.trap.position.y + 0.02, TREE.z);
    this.strap.raycast = () => {};
    this.group.add(this.strap);
    void env.spawnPlant('prop-wildlife-camera', CAM_H).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.y = -CAM_H / 2;
      this.trapBody.add(r);
      this.spawned.push(s);
    });
    // the red light (it blinks) and the infrared ring round the lens (a soft glow at night)
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b2e', transparent: true }));
    this.led.position.set(0.06, 0.1, CAM_DEPTH * 0.5 + 0.004);
    this.ir = new THREE.Mesh(new THREE.CircleGeometry(0.055, 18), new THREE.MeshBasicMaterial({ color: '#9b2c2c', transparent: true, opacity: 0, depthWrite: false }));
    this.ir.position.set(0, 0.02, CAM_DEPTH * 0.5 + 0.006);
    this.led.raycast = () => {};
    this.ledGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: '#ff4a3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.ledGlow.scale.setScalar(0.11);
    this.ledGlow.position.copy(this.led.position).z += 0.01;
    this.ledGlow.raycast = () => {};
    this.trapBody.add(this.ledGlow);
    // the infrared glow at night: a dim deep-red halo round the lens (so it reads from
    // across the crossing, as the red light does by day)
    this.irGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: '#d8322a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.irGlow.scale.setScalar(0.3);
    this.irGlow.position.set(0, 0.02, CAM_DEPTH * 0.5 + 0.02);
    this.irGlow.visible = false;
    this.irGlow.raycast = () => {};
    this.trapBody.add(this.irGlow);
    this.ir.raycast = () => {};
    this.trapBody.add(this.led, this.ir);
    this.group.add(this.trap);

    /* -- the fan of ground the camera sees -- */
    const SEG = 16, RINGS = 6;
    const fpos: number[] = [], fcol: number[] = [], fidx: number[] = [];
    for (let r = 0; r <= RINGS; r++) {
      for (let i = 0; i <= SEG; i++) {
        fpos.push(0, 0, 0);
        const k = r / RINGS;
        const edge = 1 - Math.abs(i / SEG - 0.5) * 2;
        fcol.push(1, 1, 1, (1 - k) * Math.min(1, edge * 3) * (r === 0 ? 0 : 1));
      }
    }
    for (let r = 0; r < RINGS; r++) {
      for (let i = 0; i < SEG; i++) {
        const a = r * (SEG + 1) + i, b = a + SEG + 1;
        fidx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fgeo.setAttribute('color', new THREE.Float32BufferAttribute(fcol, 4));
    fgeo.setIndex(fidx);
    this.fan = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, depthWrite: false, color: '#fff0b8',
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide,
    }));
    this.fan.name = 'camera-fan';
    this.fan.renderOrder = 3;
    this.fan.visible = false;
    this.fan.frustumCulled = false;
    this.fan.raycast = () => {};
    this.group.add(this.fan);

    /* -- where a click counts as the glade or the thicket: the whole place, not just a
          flower or a bush in it (invisible, never in a picture: `material.visible` off) -- */
    const zone = (p: Spot, r: number, h: number, into: THREE.Group, name: string): void => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1).translate(0, h / 2 - 0.05, 0),
        new THREE.MeshBasicMaterial({ visible: false }));
      m.name = name;
      m.position.set(p.x, g(p.x, p.z), p.z);
      m.visible = false; // (only while the camera is aimed: showTags)
      into.add(m);
      this.zones.push(m);
    };
    zone(P.glade, GLADE_R + 0.2, 1.3, this.glade, 'glade-zone');
    zone(atLocal(CROSS, 4.9, -0.8), 2.1, 2.0, this.thicket, 'thicket-zone');

    /* -- the places' names, each with the mark of the animals it is for now (shown while
          the camera is aimed; the marks swap when the rule flips) -- */
    this.tags = { open: markTag('open plek', 'dag', TAG_W), hol: markTag('het bosje', 'nacht', TAG_W) };
    const tagAt = (p: Spot, y: number, t: THREE.Sprite): void => { t.position.set(p.x, g(p.x, p.z) + y, p.z); t.visible = false; this.group.add(t); };
    tagAt(TAG_AT.open, TAG_AT.open.y, this.tags.open);
    tagAt(TAG_AT.hol, TAG_AT.hol.y, this.tags.hol);

    /* -- by the wildwissel up from the crossing: a juniper and a foxglove, the snare's spot
          between them in a tuft of grass (a small thing: it rests by its own spot) -- */
    const spot = env.detail(P.snare);
    const mk = SNARE_MARKS;
    void env.spawnPlant('prop-juniper-bush', mk.bush.h).then((s) => { const r = add(s, mk.bush.x, mk.bush.z, mk.bush.yaw); if (r) spot.add(r); });
    env.obstacles.push({ x: mk.bush.x, z: mk.bush.z, r: mk.bush.r });
    void env.spawnPlant('prop-foxglove', SIZE.vingerhoedskruid.h * 0.85).then((s) => { const r = add(s, mk.foxglove.x, mk.foxglove.z, mk.foxglove.yaw); if (r) spot.add(r); });
    // the grass the snare lies half in: tufts round it, thickest behind and beside it (as
    // he comes up the trail), a few low ones in front: the wire loop shows between them
    // from close by, never from down the trail
    {
      const sp = P.snare;
      const tuft = new THREE.InstancedMesh(grassTuftGeometry(14, 5), grassMaterial(), 16);
      tuft.name = 'snare-grass';
      const rt = stream(53);
      const toCam = Math.atan2(CAMERA.x - sp.x, CAMERA.z - sp.z);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < tuft.count; i++) {
        // round it, but never right on the loop, and the side toward the trail's lens kept low
        const a = (i / tuft.count) * Math.PI * 2 + rt() * 0.3;
        const rr = 0.2 + rt() * 0.28;
        const x = sp.x + Math.sin(a) * rr, z = sp.z + Math.cos(a) * rr;
        const front = Math.cos(a - toCam); // 1: between the snare and the way he comes
        const h = (front > 0.55 ? 0.16 : 0.3) + rt() * 0.12;
        m4.compose(new THREE.Vector3(x, g(x, z) - 0.01, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rt() * 6.28), new THREE.Vector3(h * 1.3, h, h * 1.3));
        tuft.setMatrixAt(i, m4);
      }
      tuft.instanceMatrix.needsUpdate = true;
      tuft.raycast = () => {};
      spot.add(tuft);
      this.snareGrass = tuft;
    }

    /* -- the snare, the man in the photo, the nightjar -- */
    const sn = P.snare;
    // (shown ≈ 1.5× its size, like the camera: a wire loop in the leaves must be found)
    void env.spawnPlant('prop-snare-empty', 0.24).then((s) => {
      const r = add(s, sn.x, sn.z, 0.7, -0.03);
      if (r) r.visible = this.snareWanted;
      this.snare = r;
    });
    void env.spawnModel('figure-poacher', { height: SIZE.stroper.h, idle: false }).then((s) => {
      if (s) this.poacherDrop = crouchPose(s.root as THREE.Object3D); // (posed at the origin, unturned)
      const r = add(s, sn.x, sn.z, 0);
      if (r) r.visible = false;
      this.poacher = r;
    });
    this.bird.name = 'nightjar';
    this.bird.visible = false;
    this.perch.add(this.bird);
    // (shown ≈ 1.5× its size, like the camera: a 17 cm bird must read on its log at night)
    void env.spawnModel('nachtzwaluw', { height: heightFor('nachtzwaluw') * 1.5, idle: false }).then((s) => {
      if (!s) return;
      this.birdBody = s.root as THREE.Object3D;
      this.bird.add(this.birdBody);
      this.spawned.push(s);
    });

    this.setState('before');
  }

  /* ------------------------------------------------------------ the story ---- */

  /** He takes the camera off the stump: it lifts toward his hands (`to`, where he
   *  stands) and he tucks it away (a cut under reduced motion). */
  pickUp(to: Spot | null = null, reduced = false): void {
    this.stumpCamWanted = false;
    const r = this.stumpCam;
    if (!r) return;
    if (!to || reduced) { r.visible = false; return; }
    const from = r.position.clone();
    const hands = new THREE.Vector3(from.x + (to.x - from.x) * 0.6, this.groundY(to.x, to.z) + 0.75, from.z + (to.z - from.z) * 0.6);
    this.lift = { t: 0, from, to: hands, scale: r.scale.x };
  }
  private lift: { t: number; from: THREE.Vector3; to: THREE.Vector3; scale: number } | null = null;

  /** Put the camera back on its stump exactly as it lay (a lift cut short). */
  private restStumpCam(): void {
    const l = this.lift, r = this.stumpCam;
    this.lift = null;
    if (!l || !r) return;
    r.position.copy(l.from);
    r.scale.setScalar(l.scale);
  }

  /** The camera goes onto the pine, looking at the crossing (toward the lens); its red
   *  light starts to blink. It settles on its strap (a cut under reduced motion). */
  strapOn(reduced = false): void {
    this.trap.visible = true;
    this.strap.visible = true;
    this.settle = reduced ? 1 : 0;
    this.trapBody.scale.setScalar(reduced ? 1 : 0.86);
    this.aimNow = this.aimFrom = this.aimTo = 0;
    this.aimT = 1;
    this.trap.rotation.y = 0;
    this.blink = 'rec';
  }

  /** Turn the camera on its strap to look along `heading` (rad) over ~0.6 s (at once
   *  under reduced motion); `aiming` is true until it looks there. */
  aim(heading: number, reduced: boolean): void {
    let d = heading - this.aimNow;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.aimFrom = this.aimNow;
    this.aimTo = this.aimNow + d;
    this.aimT = reduced ? 1 : 0;
    this.aimDur = 0.35 + Math.abs(d) * 0.25;
    if (reduced) { this.aimNow = this.aimTo; this.trap.rotation.y = this.aimNow; this.layFan(); }
  }

  /** The camera is still turning. */
  get aiming(): boolean { return this.aimT < 1; }

  /** The heading the camera looks along now. */
  get aimHeading(): number { return this.aimNow; }

  /** Show the fan of ground the camera sees (fades in/out). */
  showFan(on: boolean): void { this.fanWant = on ? 1 : 0; if (on) this.fan.visible = true; }

  /** The time of day (1 day, 0 night): at night the camera's fan is a faint cool glow,
   *  not a beam of warm light. */
  setNight(k: number): void {
    const m = this.fan.material as THREE.MeshBasicMaterial;
    m.color.set('#fff0b8').lerp(new THREE.Color('#aebfff'), Math.min(1, Math.max(0, k)));
    this.fanPeak = 0.42 - 0.2 * Math.min(1, Math.max(0, k));
    m.opacity = this.fanPeak * this.fanOn;
    // (past the middle of the dusk the camera sees by infrared: its red light goes out)
    this.irMode = k > 0.5;
  }
  private fanPeak = 0.42;
  /** the camera settling on its strap (0 → 1) */
  private settle = 1;

  /** The shutter: the red light flashes, and at night the infrared ring glows softly. */
  flash(night: boolean): void {
    this.ledFlash = 0.35;
    if (night) this.irFlash = 1;
  }

  /** The infrared ring glows softly (a caller at night): 0..1. */
  glowIr(k: number): void { this.irFlash = Math.max(this.irFlash, k); }

  /** A press beside both places: the camera on its strap gives a calm "no" — a short
   *  sweep over and back, its light blinks once (under reduced motion only the blink).
   *  False while it turns (a "no" never stacks on a look or on itself). */
  shake(reduced: boolean): boolean {
    if (this.aimT < 1 || this.nod > 0 || !this.trap.visible) return false;
    this.ledFlash = 0.16;
    if (this.irMode) this.irFlash = Math.max(this.irFlash, 0.6);
    if (!reduced) this.nod = NOD_S;
    return true;
  }

  /** The places' marks for the rule now: by day the glade is for the day animals (a sun)
   *  and the thicket for the night animals (a moon); flipped, the other way round. With
   *  `turn` the two signs turn over (edge-on half way, the new mark on the way back). */
  setMarks(flipped: boolean, turn: boolean): void {
    const to = { open: (flipped ? 'nacht' : 'dag') as Mark, hol: (flipped ? 'dag' : 'nacht') as Mark };
    if (to.open === this.marks.open && !this.markTurn) return;
    if (!turn) { this.markTurn = null; this.drawMarks(to); return; }
    this.markTurn = { t: 0, to, swapped: false };
  }

  private drawMarks(to: { open: Mark; hol: Mark }): void {
    this.marks = to;
    for (const key of ['open', 'hol'] as const) {
      const t = this.tags[key];
      const tex = t.material.map as THREE.CanvasTexture;
      drawMarkTag(tex.image as HTMLCanvasElement, t.userData.text as string, to[key]);
      tex.needsUpdate = true;
      t.scale.x = TAG_W;
    }
  }

  /** The places' marks now (the dev read). */
  get placeMarks(): { open: Mark; hol: Mark } { return { ...this.marks }; }

  /** The places' names over the glade and the thicket (and the ground a click on either
   *  counts on): while the camera is being aimed. */
  showTags(on: boolean): void {
    this.tags.open.visible = on;
    this.tags.hol.visible = on;
    for (const z of this.zones) z.visible = on;
  }

  /** The empty snare by the trail (the morning): there, or taken away. */
  showSnare(on: boolean): void {
    this.snareWanted = on;
    if (this.snare) this.snare.visible = on;
  }

  /** The object a player clicks for the snare (null until it has loaded). */
  get snareObject(): THREE.Object3D | null { return this.snare; }

  /** The camera trap's lens: where it is, and a camera looking from there at `p` (at
   *  `y` m over the ground) for a photograph `aspect` wide that frames `frameH` m of
   *  height there (so a badger fills the picture as a stag does; never narrower than
   *  `minFov`° — the nightjar's close-up zooms in further). */
  photoCamera(p: Spot, y: number, aspect: number, frameH = 1.6, minFov = 18): THREE.PerspectiveCamera {
    const dir = new THREE.Vector3(Math.sin(this.aimNow), 0, Math.cos(this.aimNow));
    const lens = new THREE.Vector3(TREE.x, this.trap.position.y + 0.02, TREE.z).addScaledVector(dir, PINE.trunkR + CAM_DEPTH + 0.05);
    const d = Math.max(1, Math.hypot(p.x - lens.x, p.z - lens.z));
    const fov = THREE.MathUtils.clamp((2 * Math.atan(frameH / 2 / d) * 180) / Math.PI, minFov, 58);
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 80);
    cam.position.copy(lens);
    cam.lookAt(p.x, this.groundY(p.x, p.z) + y, p.z);
    cam.updateMatrixWorld(true);
    return cam;
  }

  /** For a photograph's one render: the words over the places and the camera's fan are
   *  not in the picture, and by day the sky's fill is `fill`× as bright (the camera meters
   *  on the animal: a deer against the low sun comes out in its colours, not black).
   *  Returns how to put it all back. */
  photoPrep(fill = 1): () => void {
    const was = [this.tags.open.visible, this.tags.hol.visible, this.fan.visible];
    this.tags.open.visible = this.tags.hol.visible = this.fan.visible = false;
    const hemis = fill !== 1 ? this.skyFill() : [];
    const i0 = hemis.map((h) => h.intensity);
    for (const h of hemis) h.intensity *= fill;
    return () => {
      [this.tags.open.visible, this.tags.hol.visible, this.fan.visible] = was;
      hemis.forEach((h, i) => { h.intensity = i0[i]; });
    };
  }

  /** The world's sky fill (its hemisphere light), found once. */
  private hemis: THREE.HemisphereLight[] | null = null;
  private skyFill(): THREE.HemisphereLight[] {
    if (this.hemis?.length) return this.hemis;
    let top: THREE.Object3D = this.group;
    while (top.parent) top = top.parent;
    const out: THREE.HemisphereLight[] = [];
    top.traverse((o) => { if ((o as THREE.HemisphereLight).isHemisphereLight) out.push(o as THREE.HemisphereLight); });
    this.hemis = out;
    return out;
  }

  /** For the morning photo's one render: the man crouches by the snare, looking down
   *  at it, seen from the side. Returns how to take him out again. */
  poacherIn(): () => void {
    const r = this.poacher;
    if (!r) return () => {};
    const sn = P.snare;
    const side = headingTo(sn, CAMERA) + Math.PI / 2; // side-on to the camera
    const at = atLocal({ x: sn.x, z: sn.z, heading: side }, 0, -0.5);
    r.position.set(at.x, this.groundY(at.x, at.z) - this.poacherDrop, at.z);
    r.rotation.set(0, side, 0);
    const wasSnare = this.snare?.visible ?? false;
    if (this.snare) this.snare.visible = true;
    // (he kneels in the grass to set the wire: it lies flat round the loop at dawn, so the
    // camera sees the snare at his hands; the grass stands up again by the morning)
    const grass = this.snareGrass, wasGrass = grass?.visible ?? false;
    if (grass) grass.visible = false;
    r.visible = true;
    return () => { r.visible = false; if (this.snare) this.snare.visible = wasSnare; if (grass) grass.visible = wasGrass; };
  }

  /** The nightjar flies from `from` to `to` (landing there on the ground, or at `lift` m
   *  on a log), facing `yaw` when it lands. At once under reduced motion. */
  fly(from: Spot & { y?: number }, to: Spot & { lift?: number }, yaw: number, reduced: boolean, secs = 2.4): Promise<void> {
    this.bird.visible = true;
    const a = new THREE.Vector3(from.x, this.groundY(from.x, from.z) + (from.y ?? 3.2), from.z);
    const b = new THREE.Vector3(to.x, this.groundY(to.x, to.z) + (to.lift ?? 0), to.z);
    this.bird.userData.perch = to.lift ?? 0; // (how high its log holds it: the play-hint probe)
    this.flight?.done();
    return new Promise((done) => {
      this.flight = { from: a, to: b, t: reduced ? 1 : 0, dur: secs, yaw, done };
      if (reduced) this.stepFlight(0);
    });
  }

  /** The nightjar calls: it lifts a little on its log (and settles again). */
  birdHop(on: boolean): void { if (this.birdBody) this.birdBody.position.y = on ? 0.05 : 0; }

  /** The nightjar out of the picture (flown off). */
  birdGone(): void {
    this.flight?.done();
    this.flight = null;
    this.bird.visible = false;
  }

  /** How high the nightjar's perch in a place holds it (m): the thicket's stump top, as
   *  measured on the model; the sandy trail. */
  nightjarLift(bin: 'open' | 'hol'): number { return bin === 'hol' ? this.stumpTop : NIGHTJAR_AT.open.lift; }

  /** Where the nightjar is now (its feet). */
  get birdAt(): THREE.Vector3 { return this.bird.position; }

  /** The object a player clicks for the nightjar. */
  get birdObject(): THREE.Object3D { return this.bird; }

  private stepFlight(dt: number): void {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = f.t * f.t * (3 - 2 * f.t);
    const p = f.from.clone().lerp(f.to, e);
    p.y += Math.sin(e * Math.PI) * 0.6 * (1 - e); // a soft glide down
    this.bird.position.copy(p);
    const dir = f.to.clone().sub(f.from);
    this.bird.rotation.set(0, f.t < 0.85 ? Math.atan2(dir.x, dir.z) : f.yaw, 0);
    if (f.t >= 1) { const d = f.done; this.flight = null; d(); }
  }

  /* ------------------------------------------------------------- the frame ---- */

  setState(state: HomeState): void {
    this.state = state;
    const after = state === 'after';
    this.restStumpCam();
    this.settle = 1;
    this.trapBody.scale.setScalar(1);
    this.stumpCamWanted = !after;
    if (this.stumpCam) this.stumpCam.visible = !after;
    this.trap.visible = after;
    this.strap.visible = after;
    this.trap.rotation.y = this.aimNow = this.aimTo = after ? 0.25 : 0;
    this.aimT = 1;
    this.blink = after ? 'idle' : 'off';
    this.fanWant = this.fanOn = 0;
    this.fan.visible = false;
    this.setNight(0);
    this.irOn = 0;
    this.nod = this.nodOff = 0;
    this.setMarks(false, false);
    this.showTags(false);
    this.showSnare(false);
    this.birdGone();
    if (this.poacher) this.poacher.visible = false;
  }

  update(dt: number, _t: number, reduced: boolean): void {
    this.clock += dt;
    for (const s of this.spawned) s.update?.(dt);
    // the camera lifts off the stump into his hands, and is tucked away
    const l = this.lift, sc = this.stumpCam;
    if (l && sc) {
      l.t = Math.min(1, l.t + dt / 0.5);
      const e = l.t * l.t * (3 - 2 * l.t);
      sc.position.lerpVectors(l.from, l.to, e);
      sc.rotation.x = -Math.PI / 2 + 0.05 + e * (Math.PI / 2 - 0.05); // it turns upright as he lifts it
      sc.scale.setScalar(l.scale * (1 - 0.35 * e));
      if (l.t >= 1) { sc.visible = false; this.restStumpCam(); sc.rotation.x = -Math.PI / 2 + 0.05; }
    }
    // the camera settles on its strap
    if (this.settle < 1) {
      this.settle = Math.min(1, this.settle + dt / 0.3);
      const e = 1 - (1 - this.settle) * (1 - this.settle);
      this.trapBody.scale.setScalar(0.86 + 0.14 * e);
    }
    // the camera turns on its strap
    if (this.aimT < 1) {
      this.aimT = Math.min(1, this.aimT + dt / this.aimDur);
      const e = this.aimT * this.aimT * (3 - 2 * this.aimT);
      this.aimNow = this.aimFrom + (this.aimTo - this.aimFrom) * e;
      this.trap.rotation.y = this.aimNow;
      this.layFan();
    }
    // …and shakes its "no": one soft sweep over and back, easing out
    if (this.nod > 0) {
      this.nod = Math.max(0, this.nod - dt);
      const p = 1 - this.nod / NOD_S;
      this.nodOff = Math.sin(p * Math.PI * 2) * NOD_RAD * (1 - 0.35 * p);
      if (this.nod === 0) this.nodOff = 0;
      this.trap.rotation.y = this.aimNow + this.nodOff;
      // (its fan on the ground brightens a little as it sweeps: the "no" is seen there)
      (this.fan.material as THREE.MeshBasicMaterial).opacity = this.fanPeak * this.fanOn * (1 + 0.7 * Math.sin(p * Math.PI));
      this.layFan();
    }
    // the places' signs turn over to their new marks
    const mt = this.markTurn;
    if (mt) {
      mt.t = Math.min(1, mt.t + dt / TAG_TURN_S);
      if (mt.t >= 0.5 && !mt.swapped) { mt.swapped = true; this.drawMarks(mt.to); }
      const edge = Math.abs(Math.cos(mt.t * Math.PI)); // 1 → 0 (edge-on) → 1
      for (const key of ['open', 'hol'] as const) this.tags[key].scale.x = TAG_W * Math.max(0.04, edge);
      if (mt.t >= 1) { this.markTurn = null; for (const key of ['open', 'hol'] as const) this.tags[key].scale.x = TAG_W; }
    }
    // the fan fades in and out
    if (this.fanOn !== this.fanWant) {
      this.fanOn = reduced ? this.fanWant : this.fanOn + Math.sign(this.fanWant - this.fanOn) * Math.min(Math.abs(this.fanWant - this.fanOn), dt * 2.5);
      (this.fan.material as THREE.MeshBasicMaterial).opacity = this.fanPeak * this.fanOn;
      this.fan.visible = this.fanOn > 0.001;
      if (this.fan.visible) this.layFan();
    }
    // the red light: a slow blink after the mission, a steady quick one while it watches
    const ledMat = this.led.material as THREE.MeshBasicMaterial;
    this.ledFlash = Math.max(0, this.ledFlash - dt);
    // (at night it sees by infrared: the red light goes out and the ring round the lens
    // glows a soft deep red, breathing slowly; it fades over as the dusk passes)
    const ir = this.irMode && this.blink === 'rec';
    this.irOn = reduced ? (ir ? 1 : 0) : Math.max(0, Math.min(1, this.irOn + (ir ? dt : -dt) / 0.8));
    const on = this.blink === 'rec' ? (this.clock % 1.1) < 0.55
      : this.blink === 'idle' ? (this.clock % 3.2) < 0.18 : false;
    const lit = this.ledFlash > 0 ? 1 : (on ? 0.95 : 0.12) * (1 - this.irOn);
    ledMat.opacity = lit;
    this.led.visible = (this.blink !== 'off' || this.ledFlash > 0) && lit > 0.02;
    (this.ledGlow.material as THREE.SpriteMaterial).opacity = lit > 0.5 ? lit : 0;
    this.ledGlow.visible = this.led.visible && lit > 0.5 && this.trap.visible;
    // the infrared ring: its steady night glow, and a brighter flash that fades
    const irMat = this.ir.material as THREE.MeshBasicMaterial;
    this.irFlash = Math.max(0, this.irFlash - dt * 1.6);
    const breathe = this.irOn * (0.5 + (reduced ? 0 : 0.12 * Math.sin(this.clock * 2.2)));
    const irK = Math.max(this.irFlash * 0.8, breathe);
    irMat.opacity = irK;
    this.ir.visible = irK > 0.01;
    const irGlowMat = this.irGlow.material as THREE.SpriteMaterial;
    irGlowMat.opacity = Math.min(1, irK * 1.3);
    this.irGlow.visible = irK > 0.01 && this.trap.visible;
    this.stepFlight(dt);
    void this.state;
  }

  /** Lay the fan over the ground from the lens along the camera's heading. */
  private layFan(): void {
    const pos = this.fan.geometry.attributes.position as THREE.BufferAttribute;
    const SEG = 16, RINGS = 6;
    const look = this.aimNow + this.nodOff;
    const ox = TREE.x + Math.sin(look) * (PINE.trunkR + CAM_DEPTH);
    const oz = TREE.z + Math.cos(look) * (PINE.trunkR + CAM_DEPTH);
    for (let r = 0; r <= RINGS; r++) {
      const reach = 0.3 + (FAN_REACH - 0.3) * (r / RINGS);
      for (let i = 0; i <= SEG; i++) {
        const a = look - FAN_HALF + (2 * FAN_HALF * i) / SEG;
        const x = ox + Math.sin(a) * reach, z = oz + Math.cos(a) * reach;
        pos.setXYZ(r * (SEG + 1) + i, x, this.groundY(x, z) + 0.05, z);
      }
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    for (const s of this.spawned) s.dispose();
    disposeTag(this.tags.open);
    disposeTag(this.tags.hol);
    this.fan.geometry.dispose();
    (this.fan.material as THREE.Material).dispose();
    this.strap.geometry.dispose();
    (this.strap.material as THREE.Material).dispose();
    for (const o of [this.led, this.ir, ...this.zones]) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    this.snareGrass?.geometry.dispose();
    this.snareGrass?.removeFromParent();
    (this.ledGlow.material as THREE.Material).dispose();
    (this.irGlow.material as THREE.Material).dispose();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.name === 'wildwissel' || mesh.name === 'wildwissel-prints')) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    for (const o of [this.glade, this.thicket]) o.removeFromParent();
    this.group.removeFromParent();
  }
}
