/**
 * world/Dust.ts — a cloud of small, faint puffs of dust: ONE THREE.Points (1 draw call,
 * hidden while no puff lives) of world-sized soft discs, each fading in quickly and out
 * slowly as it drifts and grows, clamped on screen and faded out near the lens, so dust can
 * never become a blob over the picture (audit veh-02). The jeep kicks it up behind its rear
 * wheels (W5.2, world/Vehicles.ts) and, run 7, the ranger's heels on sand when he runs
 * (world/Player.ts). The owner decides where and when a puff starts (and never under
 * reduced motion: dust is secondary motion); the cloud ages, drifts and draws them, lit like
 * the ground under it (DUST_ALBEDO).
 */

import * as THREE from 'three';

export interface DustLook {
  /** its width (m) when it starts and when it has faded */
  from: number;
  to: number;
  /** its opacity at the heart of the disc, at its strongest */
  alpha: number;
  /** closer to the lens than `near[0]` m a puff is gone, from `near[1]` m on it is whole */
  near: readonly [number, number];
}

/** The jeep's dust (W5.2): a light haze, 0.45 → 1.3 m, gone within 2.5 m of the lens. */
export const JEEP_DUST: DustLook = { from: 0.45, to: 1.3, alpha: 0.4, near: [2.5, 6] };

/** What dust is made of: pale sand (linear rgb). A puff is lit like the flat ground it came
 *  off and goes through the picture's own tone curve, output colour space and fog, so in
 *  every mood it stands to its sand the way it does in the golden hour: a touch lighter and
 *  a touch less yellow (anim.spec reads it: a puff's heart about 7-16 levels over the sand),
 *  never a glowing dot. Its numbers top 1 because a puff floats in the light (it takes the
 *  low sun on its side too, the ground only by the sine of the sun's height). In the golden
 *  hour it is within a few levels of the cream the jeep's dust always was. */
export const DUST_ALBEDO: readonly [number, number, number] = [1.1, 1.0, 0.56];

/** A dev read (the dust's pixel check, anim.spec): the colour on screen (0..255) at the heart
 *  of the cloud's strongest puff, read in ONE frame just before the cloud is drawn (the ground
 *  there) and just after (that ground with the dust over it); `alpha` is that puff's own
 *  opacity at its heart, and (x, y) the drawing-buffer pixel. */
export interface DustHeart {
  before: [number, number, number];
  after: [number, number, number];
  alpha: number;
  x: number;
  y: number;
}

const _v = new THREE.Vector3();
const _k = new THREE.Color();
const _px = new Uint8Array(9 * 4);
/** The mean colour (0..255) of the 3 × 3 drawing-buffer pixels around (x, y) (GL: y up),
 *  as drawn so far this frame. Dev reads only: it stalls the GPU. */
function readRGB(renderer: THREE.WebGLRenderer, x: number, y: number): [number, number, number] {
  const gl = renderer.getContext();
  gl.readPixels(x - 1, y - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, _px);
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 9; i++) for (let c = 0; c < 3; c++) out[c] += _px[i * 4 + c] / 9;
  return out.map((v) => Math.round(v * 10) / 10) as [number, number, number];
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
    // the look rides in uniforms, so every cloud draws with ONE shader program (the heels'
    // cloud costs no second compile)
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColor: { value: new THREE.Color() }, uScale: { value: 700 },
        uNear: { value: new THREE.Vector2(look.near[0], look.near[1]) },
        uSize: { value: new THREE.Vector2(look.from, look.to) },
        uAlpha: { value: look.alpha },
      }]),
      transparent: true,
      depthWrite: false,
      fog: true,
      vertexShader: `
        #include <fog_pars_vertex>
        uniform float uScale;
        uniform vec2 uNear;
        uniform vec2 uSize;
        attribute float aAge;
        attribute float aLife;
        attribute float aSoil;
        varying float vAlpha;
        void main() {
          float life = max(aLife, 0.0001);
          float f = clamp(aAge / life, 0.0, 1.0);
          float alive = step(0.0001, aLife) * (1.0 - step(aLife, aAge));
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mvPosition.z, 0.5);
          // fade in fast, out slowly; and away near the lens: never a blob over the screen
          float near = smoothstep(uNear.x, uNear.y, depth);
          vAlpha = smoothstep(0.0, 0.15, f) * (1.0 - f) * alive * near * aSoil;
          float metres = mix(uSize.x, uSize.y, f);
          gl_PointSize = clamp(metres * uScale / depth, 1.0, 72.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d) * 4.0;          // 0 at the centre, 1 at the rim
          float soft = exp(-3.5 * r2) * (1.0 - r2);
          float a = max(soft, 0.0) * vAlpha * uAlpha; // a light haze, not a cloud
          if (a <= 0.003) discard;
          // lit like the ground (uColor, linear), then the picture's own tone curve, output
          // colour space and fog, in the order three draws the ground in
          gl_FragColor = vec4(uColor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    const uniforms = mat.uniforms;
    const pts = new THREE.Points(geo, mat);
    // run 7 (feel): a puff is lifted sand, so it is lit like the flat ground it came off: its
    // albedo times the light on that ground now (the hemisphere fill from above plus the sun
    // as high as it stands; the mood, a crossfade, the wildcamera's night), the same Lambert
    // three lights the ground with. Found once: the scene's hemisphere fill and its sun.
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
      const c = uniforms.uColor.value as THREE.Color;
      if (hemi && sun) {
        const s = sun as THREE.DirectionalLight, h = hemi as THREE.HemisphereLight;
        const up = Math.max(0, _v.subVectors(s.position, s.target.position).normalize().y);
        c.copy(h.color).multiplyScalar(h.intensity).add(_k.copy(s.color).multiplyScalar(s.intensity * up));
        c.setRGB((c.r * DUST_ALBEDO[0]) / Math.PI, (c.g * DUST_ALBEDO[1]) / Math.PI, (c.b * DUST_ALBEDO[2]) / Math.PI);
      }
      renderer.getDrawingBufferSize(size);
      const fov = (cam as THREE.PerspectiveCamera).fov ?? 55;
      uniforms.uScale.value = size.y / (2 * Math.tan((fov * Math.PI) / 360));
      if (this.probeWanted) this.probeAt = this.readHeart(renderer, cam, size, look);
    };
    pts.onAfterRender = (renderer) => {
      const at = this.probeAt;
      if (!at) return;
      this.probeAt = null;
      this.probeWanted = false;
      this.heart = { ...at, after: readRGB(renderer, at.x, at.y) };
    };
    scene.add(pts);
    this.points = pts;
  }

  /* ------------------------------------------------- the dev pixel read ---- */

  private probeWanted = false;
  private probeAt: Omit<DustHeart, 'after'> | null = null;
  private heart: DustHeart | null = null;

  /** Dev read (DustHeart): the last measurement, and ask for a new one the next frame the
   *  cloud is drawn with a puff on screen. Costs nothing until asked. */
  probe(): DustHeart | null {
    this.probeWanted = true;
    return this.heart;
  }

  /** The strongest live puff's heart on screen and the colour there before the cloud draws. */
  private readHeart(renderer: THREE.WebGLRenderer, cam: THREE.Camera, size: THREE.Vector2, look: DustLook): Omit<DustHeart, 'after'> | null {
    let best = -1, alpha = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0 || this.age[i] >= this.life[i]) continue;
      const f = this.age[i] / this.life[i];
      _v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).applyMatrix4(cam.matrixWorldInverse);
      const a = smooth(0, 0.15, f) * (1 - f) * this.soil[i] * smooth(look.near[0], look.near[1], Math.max(-_v.z, 0.5)) * look.alpha;
      if (a > alpha) { alpha = a; best = i; }
    }
    if (best < 0) return null;
    _v.set(this.pos[best * 3], this.pos[best * 3 + 1], this.pos[best * 3 + 2]).project(cam);
    if (Math.abs(_v.x) > 0.98 || Math.abs(_v.y) > 0.98 || _v.z > 1) return null;
    const x = Math.round(((_v.x + 1) / 2) * size.x), y = Math.round(((_v.y + 1) / 2) * size.y);
    return { before: readRGB(renderer, x, y), alpha, x, y };
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
