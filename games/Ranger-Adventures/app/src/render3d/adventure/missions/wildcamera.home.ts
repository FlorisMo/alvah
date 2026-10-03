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
  JAY_AT, SNARE_IDS, SNARE_SPOTS, PINE_PICK, snareTufts, trailA, trailB, trailC, foxPrintLine, type SnareId, type SnareSpot,
} from './wildcamera.places';
import type { Spot } from '../types';
import type { Actor } from '../actors';

/** The camera trap's size (m): shown ≈ 1.5× so a child sees it on its tree (AnimalScale). */
const CAM_H = SIZE.wildcamera.h;
/** How far its lens sits in front of its back (m), at CAM_H (the model is 1.29 : 1.6). */
const CAM_DEPTH = CAM_H * (1.29 / 1.6);
/** The camera's fan of view on the ground: its reach (m); its half-angle is the places'. */
const FAN_REACH = 5.4;
/** The places' name-tags: how wide (m). */
const TAG_W = 1.9;
/** The camera's "no" (a press beside both places): a short sweep over and back on its
 *  strap — how long (s) and how far each way (rad). */
const NOD_S = 0.46;
const NOD_RAD = 0.24;
/** The glow round the camera's place on the pine before he straps it on: its size (m),
 *  ≈ 55 px across from the crossing (its bright middle; measured in the browser). */
const GHOST_GLOW = 1.4;

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

/** What a place IS, the same mark for the whole round: the sunny open glade a sun, the
 *  dark thicket a moon — as the 2D floor's bins (render2d/WisselView: ☀️ open plek,
 *  🌙 het hol) and the card's day/night tags draw them. They never turn with the rule:
 *  after "Nu is het andersom!" a day animal goes to the moon's place, the switch itself
 *  (a sign that swapped with the rule only asked him to match its icon). */
type Mark = 'dag' | 'nacht';

/**
 * A place's name over the world with its day/night mark in front: the name-tag's dark
 * pill (play/stage `nameTag`), and a round badge before the words, a drawn sun on the
 * card's day yellow or a drawn moon on its night blue. Drawn into `canvas` once.
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

/** Run 7 (wc-album): a fox's print — four oval toes round a small pad, the claw tips just
 *  showing — fresh and crisp (one 64 px cell). */
let foxPrintTex: THREE.CanvasTexture | null = null;
function foxPrintTexture(): THREE.CanvasTexture {
  if (foxPrintTex) return foxPrintTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const ink = 'rgba(40,24,12,1)';
  const rim = 'rgba(222,200,158,0.95)';
  const blob = (cx: number, cy: number, rx: number, ry: number, rot = 0): void => {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    g.fillStyle = ink;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = rim;
    g.stroke();
  };
  // the pad (a rounded triangle), the two front toes close together, the two side toes
  blob(32, 44, 9, 8);
  blob(27, 21, 4.5, 6, -0.1); blob(37, 21, 4.5, 6, 0.1);
  blob(18, 31, 4, 5.5, -0.5); blob(46, 31, 4, 5.5, 0.5);
  g.fillStyle = ink;
  for (const [x, y] of [[27, 12], [37, 12]]) g.fillRect(x - 0.8, y, 1.6, 3.5);
  foxPrintTex = new THREE.CanvasTexture(c);
  foxPrintTex.colorSpace = THREE.SRGBColorSpace;
  return foxPrintTex;
}

/** Run 7 (wc-album): a fox's fresh prints along `line` — one neat file (a fox sets its
 *  hind feet in its front prints), a hand's width beside the trail's middle, every quad
 *  seated on the ground. One mesh, one draw call. */
function foxPrints(groundY: (x: number, z: number) => number, line: readonly Spot[], seed: number): THREE.Mesh {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const rnd = stream(seed);
  let along = 0.3;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const L = dist(a, b);
    const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
    while (along < L) {
      const side = 0.13 + (rnd() - 0.5) * 0.04;
      const px = a.x + dx * along - dz * side, pz = a.z + dz * along + dx * side;
      const sz = 0.23 * (0.92 + rnd() * 0.16);
      const yaw = Math.atan2(dx, dz) + (rnd() - 0.5) * 0.12;
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
      const base = pos.length / 3;
      for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
        const x = px + rx * u * sz + fx * v * sz, z = pz + rz * u * sz + fz * v * sz;
        pos.push(x, groundY(x, z) + 0.04, z);
        uv.push(u + 0.5, v + 0.5);
      }
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      along += 0.4 * (0.92 + rnd() * 0.16);
    }
    along -= L;
  }
  const geo = upFacing(pos, idx);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: foxPrintTexture(), transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
  }));
  mesh.name = 'fox-prints';
  mesh.renderOrder = 2;
  mesh.raycast = () => {};
  mesh.visible = false;
  return mesh;
}

/** Run 7: the birds the home flies: the nightjar, and the jay. */
export type BirdId = 'nachtzwaluw' | 'gaai';
type Flight = { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; yaw: number; done: () => void };

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
  /** the empty snare by the trail (the morning), and the grass it lies half in at each of
   *  its spots (run 7: the play's spot, `setSnareSpot`) */
  private snare: THREE.Object3D | null = null;
  private readonly snareGrass: Partial<Record<SnareId, THREE.InstancedMesh>> = {};
  private snareWanted = false;
  private snareSpot: SnareSpot = SNARE_SPOTS.S1;
  /** run 7: the peg the snare's wire is tied to (part of the snare: it goes with it) */
  private readonly snarePeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.022, 0.15, 6).translate(0, 0.075, 0),
    new THREE.MeshStandardMaterial({ color: '#b8956a', roughness: 0.9 }),
  );
  /** the man in the morning photo (only ever in that one picture), crouched: how far
   *  his crouch sinks him */
  private poacher: THREE.Object3D | null = null;
  private poacherDrop = 0;
  /** the birds that fly in and land (the home moves them): the nightjar, and (run 7) the
   *  jay; each its own group, model and flight */
  private readonly birds: Record<BirdId, { group: THREE.Group; body: THREE.Object3D | null; flight: Flight | null }> = {
    nachtzwaluw: { group: new THREE.Group(), body: null, flight: null },
    gaai: { group: new THREE.Group(), body: null, flight: null },
  };
  /** the nightjar (the night choir's bird and the aim round's): its group */
  get bird(): THREE.Group { return this.birds.nachtzwaluw.group; }
  /** the log it sits on at night, and the bird: what a click on the nightjar finds (the
   *  bird on its log reads as one thing; a container at the origin) */
  readonly perch = new THREE.Group();
  /** how high the top of the thicket's stump stands where the nightjar lands on it (m) */
  private stumpTop: number = NIGHTJAR_AT.hol.lift;
  /** run 7: the animal standing on the crossing while he decides, as a click finds it (an
   *  invisible box round it: a click on it is no choice of a place) */
  readonly visitor: THREE.Mesh;
  /** run 7: the camera's soft shape on the trunk before he straps it on, and the pine's
   *  whole trunk as a click on it finds it (`showStrapSpot`) */
  private readonly strapSpot = new THREE.Group();
  private readonly trunkProxy: THREE.Mesh;
  private readonly ghostMats: THREE.MeshStandardMaterial[] = [];
  private readonly ghostHalo: THREE.SpriteMaterial;
  private ghostT = 0;
  private readonly spawned: { dispose(): void; update?(dt: number): void }[] = [];
  /** run 7 (wc-album, dev read): the last close-up's nose on its animal */
  closeUpRead: Record<string, number> | null = null;
  /** run 7 (wc-album): the fox's fresh prints up the wildwissel (`showFoxPrints`) */
  private readonly foxPrints: THREE.Mesh;
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
      // (run 7: he clicks it there. What a perfect player clicks is the middle of its body as
      // it lies on the stump's top (an anchor there: the strap hanging over the stump's edge,
      // ~6 cm down its side, is not the place), for the play-hint probe, whose perch is
      // where the strap's end hangs)
      r.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(r);
      const mid = box.getCenter(new THREE.Vector3());
      mid.y = box.max.y - 0.05;
      const anchor = new THREE.Object3D();
      anchor.name = 'camera-on-stump-hint';
      r.add(anchor);
      anchor.position.copy(r.worldToLocal(mid));
      anchor.userData.perch = STUMP_H - 0.05 - 0.06;
      this.stumpCamBody = anchor;
    });

    /* -- the trails: the wildwissel from the ring, the glade↔thicket trail, and (run 7) deer
          trail C north of the crossing, by two of the snare's spots -- */
    const lines = [trailA(), trailB(), trailC()];
    this.group.add(trailRibbon(g, lines, 0.5, 11));
    this.group.add(trailPrints(g, lines, 29));
    // (run 7, wc-album: a fox's fresh prints up the wildwissel, on plays the fox comes)
    this.foxPrints = foxPrints(g, foxPrintLine(), 61);
    this.group.add(this.foxPrints);
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
    // (run 7: nor round the jay's spot on the sunny patch, nor between it and the lens)
    const jaySpot = toLocal(CROSS, JAY_AT.open);
    const clear = (x: number, z: number): boolean => {
      const q = toLocal(CROSS, { x, z });
      return Math.hypot(q.u - perch.u, q.v - perch.v) < 0.6 || (Math.abs(q.u - perch.u) < 0.45 && q.v < perch.v && q.v > perch.v - 1.4)
        || Math.hypot(q.u - jaySpot.u, q.v - jaySpot.v) < 0.55 || (Math.abs(q.u - jaySpot.u) < 0.4 && q.v < jaySpot.v && q.v > jaySpot.v - 1.2);
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

    /* -- run 7: where the camera will hang, before he straps it on: its shape on the
          trunk's face, light and warm and see-through, in a soft glow that breathes gently
          ("the camera goes here"); and the pine's whole trunk as a click finds it -- */
    this.strapSpot.name = 'camera-spot';
    this.strapSpot.position.set(TREE.x, this.trap.position.y, TREE.z + PINE.trunkR + CAM_DEPTH * 0.5 - 0.01);
    this.strapSpot.visible = false;
    // (the ghost hangs that high over the ground: the play-hint probe's perch)
    this.strapSpot.userData.perch = PINE.camY - CAM_H / 2;
    this.group.add(this.strapSpot);
    void env.spawnPlant('prop-wildlife-camera', CAM_H).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.y = -CAM_H / 2;
      // (cream, with none of the model's own dark textures, and lit from inside: it never
      // reads as the dark camera already hanging there, in the bark's shade or at dusk)
      r.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const own = mesh.material as THREE.Material;
        const m = new THREE.MeshStandardMaterial({
          color: '#fff4dc', emissive: '#ffd98a', emissiveIntensity: 0.6, roughness: 0.85,
          transparent: true, opacity: 0.7, depthWrite: true,
        });
        mesh.material = m;
        own.dispose();
        this.ghostMats.push(m);
      });
      this.strapSpot.add(r);
      this.spawned.push(s);
    });
    // a warm glow round it: in front of the bark (the trunk never cuts it) and just behind
    // the camera's front, so the light camera stands in it whole
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd98a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    halo.scale.setScalar(GHOST_GLOW);
    halo.position.set(0, 0, CAM_DEPTH * 0.5 - 0.02);
    halo.raycast = () => {};
    this.strapSpot.add(halo);
    this.ghostHalo = halo.material;
    // the pine as a click finds it: its whole trunk, from its foot up to where its crown
    // starts, at the model's own girth (wildcamera.places PINE_PICK). Invisible
    // (`material.visible` off: never in a picture, never in the play-hint probe's way)
    this.trunkProxy = new THREE.Mesh(
      new THREE.LatheGeometry(PINE_PICK.profile.map(([y, r]) => new THREE.Vector2(r, y)), PINE_PICK.seg),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    this.trunkProxy.name = 'pine-trunk';
    this.trunkProxy.position.set(TREE.x, g(TREE.x, TREE.z), TREE.z);
    this.trunkProxy.visible = false;
    this.group.add(this.trunkProxy);

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

    /* -- the places' names, each with its mark (a sun on the glade, a moon on the
          thicket: what the place is, never which animals go there now), shown while the
          camera is aimed. Each is part of its place: a click on the words "open plek"
          picks the open plek -- */
    this.tags = { open: markTag('open plek', 'dag', TAG_W), hol: markTag('het bosje', 'nacht', TAG_W) };
    const tagAt = (p: Spot, y: number, t: THREE.Sprite, place: THREE.Group): void => { t.position.set(p.x, g(p.x, p.z) + y, p.z); t.visible = false; place.add(t); };
    tagAt(TAG_AT.open, TAG_AT.open.y, this.tags.open, this.glade);
    tagAt(TAG_AT.hol, TAG_AT.hol.y, this.tags.hol, this.thicket);

    /* -- run 7: the snare's three spots (wildcamera.places SNARE_SPOTS), each with its two
          landmarks and the grass the wire lies half in: they ALWAYS stand there (only the
          snare comes and goes), each a small thing that rests by its own spot (S2's young
          birch too: a 3.6 m home plant, never a forest tree the forest would fade) -- */
    for (const id of SNARE_IDS) {
      const sp = SNARE_SPOTS[id];
      const spot = env.detail(sp.at);
      for (const mk of sp.marks) {
        void env.spawnPlant(mk.model, mk.h).then((s) => { const r = add(s, mk.at.x, mk.at.z, mk.yaw, mk.model === 'prop-fallen-log' || mk.model === 'prop-boulder' ? -0.04 : 0); if (r) spot.add(r); });
        if (mk.solid) env.obstacles.push(mk.model === 'prop-fallen-log' ? boxObstacle(mk.at.x, mk.at.z, mk.r, 0.18, mk.yaw, 0.2) : { x: mk.at.x, z: mk.at.z, r: mk.r });
      }
      // the grass the snare lies half in (wildcamera.places snareTufts: low on the side he
      // comes from, never on the wire)
      const tufts = snareTufts(sp);
      const tuft = new THREE.InstancedMesh(grassTuftGeometry(14, 5), grassMaterial(), tufts.length);
      tuft.name = `snare-grass-${id}`;
      const m4 = new THREE.Matrix4();
      tufts.forEach((t, i) => {
        m4.compose(new THREE.Vector3(t.x, g(t.x, t.z) - 0.01, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.turn), new THREE.Vector3(t.h * 1.3, t.h, t.h * 1.3));
        tuft.setMatrixAt(i, m4);
      });
      tuft.instanceMatrix.needsUpdate = true;
      tuft.raycast = () => {};
      spot.add(tuft);
      this.snareGrass[id] = tuft;
    }

    /* -- the snare (at this play's spot: setSnareSpot), the man in the photo, the nightjar -- */
    // (shown ≈ 1.5× its size, like the camera: a wire loop in the leaves must be found)
    void env.spawnPlant('prop-snare-empty', 0.24).then((s) => {
      const r = add(s, this.snareSpot.at.x, this.snareSpot.at.z, this.snareSpot.yaw, -0.03);
      if (!r) return;
      r.name = 'snare';
      r.visible = this.snareWanted;
      this.snare = r;
      // (run 7: the peg it is tied to, at its rim: a small pale stick in the grass, the part
      // of it a perfect player clicks — the loop itself is a ring with the ground inside)
      r.add(this.snarePeg);
      this.placeSnare();
    });
    void env.spawnModel('figure-poacher', { height: SIZE.stroper.h, idle: false }).then((s) => {
      if (s) this.poacherDrop = crouchPose(s.root as THREE.Object3D); // (posed at the origin, unturned)
      const r = add(s, this.snareSpot.at.x, this.snareSpot.at.z, 0);
      if (r) r.visible = false;
      this.poacher = r;
    });
    this.bird.name = 'nightjar';
    this.bird.visible = false;
    this.perch.add(this.bird);
    // (shown ≈ 1.5× its size, like the camera: a 17 cm bird must read on its log at night;
    // run 7: the jay too, a day visitor of the aim round)
    const jay = this.birds.gaai.group;
    jay.name = 'jay';
    jay.visible = false;
    this.group.add(jay);
    for (const id of ['nachtzwaluw', 'gaai'] as const) {
      void env.spawnModel(id, { height: heightFor(id) * 1.5, idle: false }).then((s) => {
        if (!s) return;
        const b = this.birds[id];
        b.body = s.root as THREE.Object3D;
        b.group.add(b.body);
        this.spawned.push(s);
      });
    }
    // run 7: the visitor's box (a click on the animal on the crossing; never in a picture)
    this.visitor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ visible: false }));
    this.visitor.name = 'visitor';
    this.visitor.visible = false;
    this.group.add(this.visitor);

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

  /** Run 7: the play's snare spot (the man sets it there; the morning photo, the search). */
  setSnareSpot(id: SnareId): void {
    this.snareSpot = SNARE_SPOTS[id];
    this.placeSnare();
  }

  /** The snare where the play's spot has it, in its grass (it lifts out of it when he
   *  takes it away: `liftSnare`). */
  private placeSnare(): void {
    const r = this.snare;
    if (!r) return;
    const sp = this.snareSpot.at;
    r.position.set(sp.x, this.groundY(sp.x, sp.z) - 0.03, sp.z);
    r.rotation.set(0, this.snareSpot.yaw, 0);
    r.scale.setScalar(this.snareScale ??= r.scale.x);
    this.snareLift = null;
    // the peg at the loop's rim on the side he comes from (the camera's: the grass is low
    // there), a little into the ground
    r.updateMatrixWorld(true);
    this.snarePeg.removeFromParent();
    const box = new THREE.Box3().setFromObject(r);
    const half = Math.max(0.05, Math.min(box.max.x - box.min.x, box.max.z - box.min.z) / 2);
    const toCam = Math.atan2(CAMERA.x - sp.x, CAMERA.z - sp.z) + 0.5;
    const px = sp.x + Math.sin(toCam) * half * 0.95, pz = sp.z + Math.cos(toCam) * half * 0.95;
    const world = new THREE.Vector3(px, this.groundY(px, pz) - 0.02, pz);
    r.add(this.snarePeg);
    this.snarePeg.position.copy(r.worldToLocal(world));
    this.snarePeg.scale.setScalar(1 / (this.snareScale || 1));
    this.snarePeg.rotation.set(0, 0, 0.12);
  }
  /** what a perfect player clicks on the snare (its peg) */
  get snareHint(): THREE.Object3D { return this.snarePeg; }
  private snareScale: number | undefined;

  /** He takes the snare out of the grass: it lifts toward his hands (`to`) and is gone
   *  (a cut under reduced motion). Resolves once it is gone. */
  liftSnare(to: Spot, reduced: boolean): Promise<void> {
    const r = this.snare;
    this.snareWanted = false;
    if (!r || reduced) { if (r) r.visible = false; return Promise.resolve(); }
    const from = r.position.clone();
    const hands = new THREE.Vector3(from.x + (to.x - from.x) * 0.55, this.groundY(to.x, to.z) + 0.72, from.z + (to.z - from.z) * 0.55);
    return new Promise((done) => { this.snareLift = { t: 0, from, to: hands, done }; });
  }
  private snareLift: { t: number; from: THREE.Vector3; to: THREE.Vector3; done: () => void } | null = null;

  /** The object a player clicks for the snare (null until it has loaded). */
  get snareObject(): THREE.Object3D | null { return this.snare; }

  /** Run 7: the camera lying on the stump at the marker, as a click finds it (null until
   *  it has loaded, or once he took it). `userData.perch`: the stump's top it lies on. */
  get stumpCamera(): THREE.Object3D | null { return this.stumpCam && this.stumpCamWanted ? this.stumpCam : null; }
  /** the middle of its body (the play hint: the strap hanging over the stump's edge is not
   *  where to click) */
  get stumpCameraBody(): THREE.Object3D | null { return this.stumpCamera ? this.stumpCamBody : null; }
  private stumpCamBody: THREE.Object3D | null = null;

  /** Run 7: where the camera will hang on the pine, before he straps it on: its shape on
   *  the trunk's face (light and see-through in a soft glow, breathing gently: "here"),
   *  and the pine's whole trunk as a click finds it. Off: gone. */
  showStrapSpot(on: boolean): void {
    this.strapSpot.visible = on;
    this.trunkProxy.visible = on;
    this.ghostT = 0;
  }
  /** what a click on the pine finds (its whole trunk, foot to crown, invisible) */
  get pineTarget(): THREE.Object3D { return this.trunkProxy; }
  /** what a perfect player clicks (the camera's soft shape on the trunk's face) */
  get strapHint(): THREE.Object3D { return this.strapSpot; }

  /** The camera trap's lens: where it is, and a camera looking from there at `p` (at
   *  `y` m over the ground) for a photograph `aspect` wide that frames `frameH` m of
   *  height there (so a badger fills the picture as a stag does; never narrower than
   *  `minFov`° — the nightjar's close-up zooms in further). */
  photoCamera(p: Spot, y: number, aspect: number, frameH = 1.6, minFov = 18): THREE.PerspectiveCamera {
    const lens = this.photoLens();
    const d = Math.max(1, Math.hypot(p.x - lens.x, p.z - lens.z));
    const fov = THREE.MathUtils.clamp((2 * Math.atan(frameH / 2 / d) * 180) / Math.PI, minFov, 58);
    return this.photoCameraAt(new THREE.Vector3(p.x, this.groundY(p.x, p.z) + y, p.z), fov, aspect);
  }

  /** The camera trap's lens, as it is turned now (on its strap, `heading` rad: where it
   *  looks; its turn now by default). */
  photoLens(heading = this.aimNow): THREE.Vector3 {
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    return new THREE.Vector3(TREE.x, this.trap.position.y + 0.02, TREE.z).addScaledVector(dir, PINE.trunkR + CAM_DEPTH + 0.05);
  }

  /** A camera from the trap's lens looking at `look` (world) with a field of view of `fov`°
   *  (vertical) for a photograph `aspect` wide (r2: the fox family's photo frames all three
   *  as they stand: wildcamera.cubs `familyPhoto`). */
  photoCameraAt(look: THREE.Vector3, fov: number, aspect: number): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 80);
    cam.position.copy(this.photoLens());
    cam.lookAt(look);
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

  /** Run 7 (wc-album r2): for a night photo's one render, what the camera's infrared flash
   *  lights stands out bright against the dark wood behind it (a trail camera's night photo:
   *  the near animal pale and clear, never a pale ghost on pale ground): the drawn bodies of
   *  `subjects` glow by `k` (their materials' own light, put back after). Returns how. */
  irLit(subjects: readonly THREE.Object3D[], k: number): () => void {
    const done: { m: THREE.MeshStandardMaterial; c: THREE.Color; i: number }[] = [];
    const seen = new Set<THREE.Material>();
    for (const o of subjects) {
      o.traverseVisible((x) => {
        const mesh = x as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
          if (!m || seen.has(m) || !(m as { emissive?: THREE.Color }).emissive) continue;
          seen.add(m);
          done.push({ m, c: m.emissive.clone(), i: m.emissiveIntensity ?? 1 });
          m.emissive.setRGB(k, k, k);
          m.emissiveIntensity = 1;
        }
      });
    }
    return () => { for (const d of done) { d.m.emissive.copy(d.c); d.m.emissiveIntensity = d.i; } };
  }

  /** Run 7: for the morning photo's one render, the dawn mist in the wood: the fog closes
   *  in to `near`..`far` m (from the camera on the pine), so the man and the two things
   *  beside him stand clear and what lies far behind them (the hut, the missiebord, the
   *  signpost by the clearing) fades into the morning grey. Returns how to lift it. */
  dawnMist(near: number, far: number): () => void {
    let top: THREE.Object3D = this.group;
    while (top.parent) top = top.parent;
    const fog = (top as THREE.Scene).fog as THREE.Fog | null;
    if (!fog || !(fog as THREE.Fog).isFog) return () => {};
    const was = [fog.near, fog.far];
    fog.near = near;
    fog.far = far;
    return () => { [fog.near, fog.far] = was; };
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
    const sn = this.snareSpot.at;
    const side = headingTo(sn, CAMERA) + Math.PI / 2; // side-on to the camera
    const at = atLocal({ x: sn.x, z: sn.z, heading: side }, 0, -0.5);
    r.position.set(at.x, this.groundY(at.x, at.z) - this.poacherDrop, at.z);
    r.rotation.set(0, side, 0);
    const wasSnare = this.snare?.visible ?? false;
    if (this.snare) this.snare.visible = true;
    // (he kneels in the grass to set the wire: it lies flat round the loop at dawn, so the
    // camera sees the snare at his hands; the grass stands up again by the morning)
    const grass = this.snareGrass[this.snareSpot.id], wasGrass = grass?.visible ?? false;
    if (grass) grass.visible = false;
    r.visible = true;
    return () => { r.visible = false; if (this.snare) this.snare.visible = wasSnare; if (grass) grass.visible = wasGrass; };
  }

  /** Run 7 (wc-album): the fox's fresh prints up the wildwissel (laid under the briefing
   *  card on plays the fox comes; gone again once the mission is done). */
  showFoxPrints(on: boolean): void { this.foxPrints.visible = on; }
  get foxPrintsShown(): boolean { return this.foxPrints.visible; }

  /**
   * Run 7 (wc-album): for the one render of the night's funny close-up, `a` (an animal of
   * the crossing) stands facing the camera on its pine with the tip of its nose `d` m from
   * the lens, and brings its nose toward the lens: a rigged one (the fox, the roe) lifts or
   * lowers its head on its own neck (at most `neck` rad over its neck bones, r2: never its
   * whole body stood up, never a tail over its head), then its body tips the rest (at most
   * `maxTilt` rad, nose up or down). The camera looks along `heading`. The tip of
   * the nose is found on the model as it stands level (on its middle line, the point
   * furthest toward the lens, its feet left out: never an ear, never a paw that swings
   * forward when it tips) and followed as it bends and tips. Returns where the nose is and
   * how to put the animal back.
   */
  closeUp(a: Actor, heading: number, d: number, maxTilt: number, neck = 0): { nose: Spot; y: number; undo: () => void } {
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const lens = this.photoLens(heading);
    const g = a.group;
    const was = { vis: g.visible, x: a.x, z: a.z, yaw: a.yaw, order: g.rotation.order, rx: g.rotation.x };
    const yaw = Math.atan2(-dir.x, -dir.z); // (facing the lens)
    g.rotation.order = 'YXZ';
    g.rotation.x = 0;
    g.visible = true;
    a.place(lens.x + dir.x * 3, lens.z + dir.z * 3, yaw);
    g.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    (a.body ?? g).traverseVisible((o) => { const m = o as THREE.Mesh; if (m.isMesh) meshes.push(m); }); // (what is drawn: never its lying body, hidden)
    const v = new THREE.Vector3();
    // (level: how high and how wide it stands, then its nose: on its middle line (never an
    // ear standing out to a side), the furthest toward the lens, its feet left out)
    const sideOf = (p: THREE.Vector3): number => (p.x - g.position.x) * dir.z - (p.z - g.position.z) * dir.x;
    let lo = Infinity, hi = -Infinity, wide = 0;
    for (const m of meshes) {
      const n = (m.geometry.attributes.position as THREE.BufferAttribute).count;
      for (let i = 0; i < n; i++) {
        m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
        lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); wide = Math.max(wide, Math.abs(sideOf(v)));
      }
    }
    let noseMesh: THREE.Mesh | null = null, noseI = 0, best = -Infinity;
    const mid = lo + (hi - lo) * 0.2, line = Math.max(0.025, wide * 0.15);
    for (const m of meshes) {
      const n = (m.geometry.attributes.position as THREE.BufferAttribute).count;
      for (let i = 0; i < n; i++) {
        m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
        if (v.y < mid || Math.abs(sideOf(v)) > line) continue;
        const along = -((v.x - g.position.x) * dir.x + (v.z - g.position.z) * dir.z);
        if (along > best) { best = along; noseMesh = m; noseI = i; }
      }
    }
    const tip = (): THREE.Vector3 => {
      g.updateMatrixWorld(true);
      return noseMesh ? noseMesh.getVertexPosition(noseI, new THREE.Vector3()).applyMatrix4(noseMesh.matrixWorld) : g.position.clone();
    };
    // (a rigged animal's neck: its head comes up, or down, toward the lens on its own neck
    // bones, each turned a share about the line across its face)
    const bones: THREE.Object3D[] = [];
    if (neck > 0) g.traverse((o) => { if ((o as THREE.Bone).isBone && /^(Neck\d|Head)$/.test(o.name)) bones.push(o); });
    const rest = bones.map((b) => b.quaternion.clone());
    const across = new THREE.Vector3(dir.z, 0, -dir.x);
    const pq = new THREE.Quaternion(), q = new THREE.Quaternion(), ax = new THREE.Vector3();
    const bend = (ang: number): void => {
      bones.forEach((b, i) => b.quaternion.copy(rest[i]));
      for (const b of bones) {
        g.updateMatrixWorld(true);
        b.parent!.getWorldQuaternion(pq);
        q.setFromAxisAngle(ax.copy(across).applyQuaternion(pq.invert()), ang / bones.length);
        b.quaternion.premultiply(q);
      }
    };
    let ang = 0;
    if (bones.length) {
      for (let i = 0; i < 5; i++) {
        bend(ang);
        const n = tip();
        bend(ang + 0.05);
        const slope = (tip().y - n.y) / 0.05;
        if (Math.abs(slope) < 1e-3) break;
        ang = Math.max(-neck, Math.min(neck, ang + ((lens.y - n.y) / slope) * 0.9));
      }
      bend(ang);
    }
    let tilt = 0;
    for (let i = 0; i < 4; i++) {
      g.rotation.x = -tilt;
      const n = tip();
      const reach = Math.max(0.15, Math.hypot(n.x - g.position.x, n.z - g.position.z));
      tilt = Math.max(-maxTilt, Math.min(maxTilt, tilt + Math.atan((lens.y - n.y) / reach) * 0.9));
    }
    g.rotation.x = -tilt;
    const n0 = tip();
    const ahead = -((n0.x - g.position.x) * dir.x + (n0.z - g.position.z) * dir.z);
    a.place(lens.x + dir.x * (d + ahead), lens.z + dir.z * (d + ahead), yaw);
    const n = tip();
    // (dev read: where the nose is on the animal — ahead of its middle, beside it, how high —
    // and how far it tipped)
    const fx = -dir.x, fz = -dir.z;
    this.closeUpRead = {
      ahead: (n.x - g.position.x) * fx + (n.z - g.position.z) * fz,
      side: (n.x - g.position.x) * -fz + (n.z - g.position.z) * fx,
      up: n.y - g.position.y, tilt, lensUp: lens.y - g.position.y, meshes: meshes.length, neck: ang,
    };
    return {
      nose: { x: n.x, z: n.z }, y: n.y - this.groundY(n.x, n.z),
      undo: () => {
        bones.forEach((b, i) => b.quaternion.copy(rest[i]));
        g.rotation.x = was.rx; g.rotation.order = was.order; a.place(was.x, was.z, was.yaw); g.visible = was.vis;
      },
    };
  }

  /** A bird (the nightjar unless `id` says the jay) flies from `from` to `to` (landing
   *  there on the ground, or at `lift` m on a log or a bush), facing `yaw` when it lands.
   *  At once under reduced motion. */
  fly(from: Spot & { y?: number }, to: Spot & { lift?: number }, yaw: number, reduced: boolean, secs = 2.4, id: BirdId = 'nachtzwaluw'): Promise<void> {
    const b = this.birds[id];
    b.group.visible = true;
    const a = new THREE.Vector3(from.x, this.groundY(from.x, from.z) + (from.y ?? 3.2), from.z);
    const c = new THREE.Vector3(to.x, this.groundY(to.x, to.z) + (to.lift ?? 0), to.z);
    b.group.userData.perch = to.lift ?? 0; // (how high its log holds it: the play-hint probe)
    b.flight?.done();
    return new Promise((done) => {
      b.flight = { from: a, to: c, t: reduced ? 1 : 0, dur: secs, yaw, done };
      if (reduced) this.stepFlight(id, 0);
    });
  }

  /** Run 7: a bird waiting on the crossing while he decides: the jay hops now and then, the
   *  nightjar shifts on its feet (a small bird draws the eye by moving). Off: still. */
  birdFidget(id: BirdId | null): void {
    for (const b of Object.values(this.birds)) if (b.body) { b.body.position.y = 0; b.body.rotation.y = 0; }
    this.fidget = id;
    this.fidgetT = 0;
  }
  private fidget: BirdId | null = null;
  private fidgetT = 0;

  /** A bird calls: it lifts a little on its perch (and settles again). */
  birdHop(on: boolean, id: BirdId = 'nachtzwaluw'): void { const body = this.birds[id].body; if (body) body.position.y = on ? 0.05 : 0; }

  /** A bird out of the picture (flown off); no id: both. */
  birdGone(id?: BirdId): void {
    for (const k of id ? [id] : (['nachtzwaluw', 'gaai'] as const)) {
      const b = this.birds[k];
      b.flight?.done();
      b.flight = null;
      b.group.visible = false;
    }
  }

  /** How high the nightjar's perch in a place holds it (m): the thicket's stump top, as
   *  measured on the model; the sandy trail. */
  nightjarLift(bin: 'open' | 'hol'): number { return bin === 'hol' ? this.stumpTop : NIGHTJAR_AT.open.lift; }

  /** Run 7: how high a bird's perch in a place holds it (m): the nightjar's stump or trail;
   *  the jay hops on the ground. */
  birdLift(id: BirdId, bin: 'open' | 'hol'): number { return id === 'gaai' ? JAY_AT[bin].lift : this.nightjarLift(bin); }

  /** The nightjar's old stump's top (m; the night choir's second perch). */
  get stumpLift(): number { return this.stumpTop; }

  /** Where the nightjar is now (its feet). */
  get birdAt(): THREE.Vector3 { return this.bird.position; }

  /** The object a player clicks for the nightjar. */
  get birdObject(): THREE.Object3D { return this.bird; }

  /** Run 7: where a bird is now (its feet), its group, and whether it is out. */
  birdAtOf(id: BirdId): THREE.Vector3 { return this.birds[id].group.position; }
  birdOf(id: BirdId): THREE.Group { return this.birds[id].group; }
  birdOut(id: BirdId): boolean { return this.birds[id].group.visible; }

  /** Run 7: the visitor's box round the animal standing at `at` (its length along `yaw`,
   *  its height), or none. */
  showVisitor(at: Spot | null, len = 1, h = 1, yaw = 0): void {
    const v = this.visitor;
    v.visible = !!at;
    if (!at) return;
    v.position.set(at.x, this.groundY(at.x, at.z), at.z);
    v.rotation.set(0, yaw, 0);
    v.scale.set(Math.max(0.5, len * 0.45), Math.max(0.45, h), Math.max(0.5, len));
    v.updateMatrixWorld(true);
  }

  private stepFlight(id: BirdId, dt: number): void {
    const b = this.birds[id];
    const f = b.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = f.t * f.t * (3 - 2 * f.t);
    const p = f.from.clone().lerp(f.to, e);
    p.y += Math.sin(e * Math.PI) * 0.6 * (1 - e); // a soft glide down
    b.group.position.copy(p);
    const dir = f.to.clone().sub(f.from);
    b.group.rotation.set(0, f.t < 0.85 ? Math.atan2(dir.x, dir.z) : f.yaw, 0);
    if (f.t >= 1) { const d = f.done; b.flight = null; d(); }
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
    this.showTags(false);
    this.showSnare(false);
    this.placeSnare();
    this.showStrapSpot(false);
    this.birdGone();
    this.birdFidget(null);
    this.showVisitor(null);
    if (this.poacher) this.poacher.visible = false;
    this.showFoxPrints(false); // (wc-album: a play's fox prints are gone after it, done or stopped; its briefing lays them anew)
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
    // run 7: the camera's shape on the trunk breathes gently, once in ~3 s (still under
    // reduced motion); its faintest is still plainly there, and never fainter than the
    // probe's see-through limit (0.35)
    if (this.strapSpot.visible) {
      this.ghostT += dt;
      const k = reduced ? 0.6 : 0.5 - 0.5 * Math.cos(this.ghostT * 2.0);
      for (const m of this.ghostMats) { m.opacity = 0.62 + 0.18 * k; m.emissiveIntensity = 0.5 + 0.3 * k; }
      this.ghostHalo.opacity = 0.6 + 0.3 * k;
    }
    // run 7: the snare lifts out of the grass toward his hands, shrinks a little and is gone
    const sl = this.snareLift, sr = this.snare;
    if (sl && sr) {
      sl.t = Math.min(1, sl.t + dt / 0.55);
      const e = sl.t * sl.t * (3 - 2 * sl.t);
      sr.position.lerpVectors(sl.from, sl.to, e);
      sr.scale.setScalar((this.snareScale ?? 1) * (1 - 0.4 * e));
      if (sl.t >= 1) { sr.visible = false; const d = sl.done; this.placeSnare(); d(); }
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
    this.stepFlight('nachtzwaluw', dt);
    this.stepFlight('gaai', dt);
    // a waiting bird: a little hop (the jay) or a small turn (the nightjar) every ~1.6 s
    if (this.fidget && !reduced) {
      const b = this.birds[this.fidget];
      this.fidgetT += dt;
      const ph = this.fidgetT % 1.6;
      if (b.body && !b.flight) {
        if (this.fidget === 'gaai') b.body.position.y = ph < 0.32 ? Math.sin((ph / 0.32) * Math.PI) * 0.06 : 0;
        else b.body.rotation.y = Math.sin(this.fidgetT * 1.2) * 0.22;
      }
    }
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
    for (const o of [this.led, this.ir, this.visitor, ...this.zones]) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    for (const g of Object.values(this.snareGrass)) { g.geometry.dispose(); g.removeFromParent(); }
    this.snarePeg.geometry.dispose();
    (this.snarePeg.material as THREE.Material).dispose();
    this.foxPrints.geometry.dispose();
    (this.foxPrints.material as THREE.Material).dispose();
    this.trunkProxy.geometry.dispose();
    (this.trunkProxy.material as THREE.Material).dispose();
    this.ghostHalo.dispose(); // (the ghost's own materials go with its spawned model)
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
