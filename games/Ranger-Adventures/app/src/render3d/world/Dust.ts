/**
 * world/Dust.ts — a cloud of small, faint puffs of dust: ONE THREE.Points (1 draw call,
 * hidden while no puff lives) of world-sized soft discs, each fading in quickly and out
 * slowly as it drifts and grows, clamped on screen and faded out near the lens, so dust can
 * never become a blob over the picture (audit veh-02). The jeep kicks it up behind its rear
 * wheels (W5.2, world/Vehicles.ts) and, run 7, the ranger's heels on sand when he runs
 * (world/Player.ts). The owner decides where and when a puff starts (and never under
 * reduced motion: dust is secondary motion); the cloud ages, drifts and draws them.
 */

import * as THREE from 'three';
import { MOODS, keyElevation } from '../Moods';

export interface DustLook {
  /** a puff's colour */
  color: string;
  /** its width (m) when it starts and when it has faded */
  from: number;
  to: number;
  /** its opacity at the heart of the disc, at its strongest */
  alpha: number;
  /** closer to the lens than `near[0]` m a puff is gone, from `near[1]` m on it is whole */
  near: readonly [number, number];
}

/** The jeep's dust (W5.2): a light haze, 0.45 → 1.3 m, gone within 2.5 m of the lens. */
export const JEEP_DUST: DustLook = { color: '#ebdfc4', from: 0.45, to: 1.3, alpha: 0.4, near: [2.5, 6] };

/** The light on the ground (per channel, linear): the sky fill from above plus the key as
 *  high as the sun stands (cf. Moods.groundLight). */
function groundLight(out: THREE.Color, sky: THREE.Color, skyI: number, key: THREE.Color, keyI: number, sinUp: number): THREE.Color {
  return out.copy(sky).multiplyScalar(skyI).add(_k.copy(key).multiplyScalar(keyI * Math.max(0, sinUp)));
}
const _k = new THREE.Color();
const _l = new THREE.Color();
const _v = new THREE.Vector3();
/** …in the golden hour, the light every puff's `color` was chosen in. */
const GOLDEN = (() => {
  const m = MOODS['gouden-uur'];
  return groundLight(new THREE.Color(), new THREE.Color(m.light.hemiSky), m.light.hemiI, new THREE.Color(m.light.key), m.light.keyI,
    Math.sin((keyElevation(m.keyAt) * Math.PI) / 180));
})();

const lum = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** A channel's tint: the light's brightness `L` (as a share of the golden hour's) with only a
 *  little of its colour (`r`: the channel's own share): the golden hour's key is deep orange,
 *  so a straight per-channel share turned a misty morning's dust mint. */
const tint = (r: number, L: number): number => Math.min(1.25, Math.max(0.3, L * Math.pow(r / L, 0.4)));

export class DustCloud {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly soil: Float32Array;   // each puff's strength (pale sand shows most)
  private next = 0;
  private seed: number;

  constructor(scene: THREE.Scene, n: number, look: DustLook, seed = 0x9e3779b1) {
    this.n = n;
    this.seed = seed;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n); // all 0 → every slot starts dead
    this.soil = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    geo.setAttribute('aSoil', new THREE.BufferAttribute(this.soil, 1));
    const f = (x: number): string => x.toFixed(3);
    const uniforms = { uColor: { value: new THREE.Color(look.color) }, uScale: { value: 700 } };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uScale;
        attribute float aAge;
        attribute float aLife;
        attribute float aSoil;
        varying float vAlpha;
        void main() {
          float life = max(aLife, 0.0001);
          float f = clamp(aAge / life, 0.0, 1.0);
          float alive = step(0.0001, aLife) * (1.0 - step(aLife, aAge));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mv.z, 0.5);
          // fade in fast, out slowly; and away near the lens: never a blob over the screen
          float near = smoothstep(${f(look.near[0])}, ${f(look.near[1])}, depth);
          vAlpha = smoothstep(0.0, 0.15, f) * (1.0 - f) * alive * near * aSoil;
          float metres = mix(${f(look.from)}, ${f(look.to)}, f);
          gl_PointSize = clamp(metres * uScale / depth, 1.0, 72.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d) * 4.0;          // 0 at the centre, 1 at the rim
          float soft = exp(-3.5 * r2) * (1.0 - r2);
          float a = max(soft, 0.0) * vAlpha * ${f(look.alpha)}; // a light haze, not a cloud
          if (a <= 0.003) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    // run 7 (feel): a puff is lifted ground, so it takes the light the ground has now (the
    // mood, a crossfade, the wildcamera's night) as a share of the golden hour's, the light
    // its colour was chosen in: unchanged in the golden hour, never a cream spot glowing at
    // dusk or in the mist. Lit by the scene's hemisphere fill and its sun, found once.
    const base = new THREE.Color(look.color);
    let hemi: THREE.HemisphereLight | null = null, sun: THREE.DirectionalLight | null = null;
    pts.frustumCulled = false; // puffs live in world space, not around the origin
    pts.visible = true;        // drawn once while the world loads (its shader compiles then); update hides it
    const size = new THREE.Vector2();
    pts.onBeforeRender = (renderer, sc, cam) => {
      if (!hemi || !sun) {
        sc.traverse((o) => {
          if (!hemi && (o as THREE.HemisphereLight).isHemisphereLight) hemi = o as THREE.HemisphereLight;
          const d = o as THREE.DirectionalLight;
          if (d.isDirectionalLight && (!sun || (d.castShadow && !sun.castShadow))) sun = d;
        });
      }
      if (hemi && sun) {
        const s = sun as THREE.DirectionalLight, h = hemi as THREE.HemisphereLight;
        const up = _v.subVectors(s.position, s.target.position).normalize().y;
        groundLight(_l, h.color, h.intensity, s.color, s.intensity, up);
        const L = lum(_l) / lum(GOLDEN);
        uniforms.uColor.value.setRGB(base.r * tint(_l.r / GOLDEN.r, L), base.g * tint(_l.g / GOLDEN.g, L), base.b * tint(_l.b / GOLDEN.b, L));
      }
      renderer.getDrawingBufferSize(size);
      const fov = (cam as THREE.PerspectiveCamera).fov ?? 55;
      uniforms.uScale.value = size.y / (2 * Math.tan((fov * Math.PI) / 360));
    };
    scene.add(pts);
    this.points = pts;
  }

  /** A deterministic 0..1 (LCG) for scatter — no `Math.random`, stable frames. */
  rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Start a puff at (x, y, z) drifting (vx, vy, vz) m/s for `life` s, at `strength` (0..1;
   *  it takes the oldest slot). */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, strength: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.soil[i] = strength;
  }

  /** Age every live puff by `dt` and drift it; true while any still lives (the owner hides
   *  the cloud when none does, so an idle cloud costs no draw call). */
  update(dt: number): boolean {
    let alive = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const age = this.age[i] + dt;
      if (age >= this.life[i]) { this.life[i] = 0; this.age[i] = age; continue; }
      this.age[i] = age;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      alive = true;
    }
    const g = this.points.geometry;
    for (const a of ['position', 'aAge', 'aLife', 'aSoil']) (g.getAttribute(a) as THREE.BufferAttribute).needsUpdate = true;
    return alive;
  }
}
