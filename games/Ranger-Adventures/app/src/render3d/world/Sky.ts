/**
 * world/Sky.ts — the sky, the golden-hour light and the slow ambient clock.
 *
 * The baked golden-hour sky + fog, the shared hemisphere fill, the warm sun with its
 * tight hero shadow frustum that follows the ranger, the drifting cloud shade on the
 * ground and the ~12 s bird flyover. `skyTime` is the ambient clock every secondary motion reads
 * (wind in the grass, the water shimmer); it only advances when reduced-motion is off,
 * so all of it freezes together (comfort §C).
 */

import * as THREE from 'three';
import { SKY_STOPS, cloudOffset, cloudShadeShader, windSway, flyoverAt, type Flyover } from '../Atmosphere';
import { GOLDEN_HOUR, addGoldenHourHemi, makeGoldenHourSun, makeSkyDome } from '../Lighting';
import { DaylightFade, DAYLIGHT_FADE_S, MOON_DIR, NIGHT_STOPS, lightAt, nightSet, type LightSet } from '../Daylight';

const SKY_LOW = GOLDEN_HOUR.fogColor; // shared golden-hour horizon + fog colour (P1.1)

/** The golden hour's lights (Lighting.GOLDEN_HOUR), as the day↔night mix reads them. */
const DAY_SET: LightSet = {
  fog: SKY_LOW,
  hemiSky: `#${new THREE.Color(GOLDEN_HOUR.skyColor).getHexString()}`,
  hemiGround: `#${new THREE.Color(GOLDEN_HOUR.groundColor).getHexString()}`,
  hemiI: GOLDEN_HOUR.fillIntensity,
  key: `#${new THREE.Color(GOLDEN_HOUR.keyColor).getHexString()}`,
  keyI: GOLDEN_HOUR.keyIntensity,
};
const NIGHT_SET: LightSet = nightSet(GOLDEN_HOUR.exposure);

/**
 * Run 6 (the wildcamera's day↔night): the night sky as a second dome over the golden one,
 * drawn with the night's share as its opacity — NIGHT_STOPS on the view's elevation (the
 * horizon band through the tone curve, so the night fog meets it seamlessly, exactly as
 * the golden dome does), a scatter of faint stars above the tree line and a pale moon
 * with a soft halo. It stays hidden (no draw call) all day. The world's own: the title
 * and every other scene keep their golden dome untouched.
 */
function makeNightDome(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    for (const [at, col] of NIGHT_STOPS) grad.addColorStop(at, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 128);
  }
  const ramp = new THREE.CanvasTexture(c);
  ramp.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Vector3(MOON_DIR.x, MOON_DIR.y, MOON_DIR.z).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRamp: { value: ramp }, uMoon: { value: moon }, uAlpha: { value: 0 } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform sampler2D uRamp;
      uniform vec3 uMoon;
      uniform float uAlpha;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        float t = 1.0 - pow(clamp((up - 0.03) / 0.97, 0.0, 1.0), 0.6);
        vec3 col = texture2D(uRamp, vec2(0.5, 1.0 - t)).rgb;
        // a few faint stars above the tree line (fixed: they never twinkle or move)
        vec3 cell = floor(d * 180.0);
        float star = step(0.9965, hash(cell)) * smoothstep(0.16, 0.5, up);
        vec3 f = fract(d * 180.0) - 0.5;
        star *= smoothstep(0.35, 0.0, length(f));
        col += vec3(0.75, 0.8, 0.95) * star * 0.55;
        // the moon: a pale disc and a soft halo round it
        float m = dot(d, uMoon);
        col += vec3(0.55, 0.62, 0.8) * pow(max(m, 0.0), 60.0) * 0.35;
        col = mix(col, vec3(0.93, 0.95, 1.0), smoothstep(0.99935, 0.9996, m));
        gl_FragColor = vec4(col, uAlpha);
        #include <tonemapping_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, col, smoothstep(0.03, 0.3, up));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  dome.name = 'night-sky';
  dome.frustumCulled = false;
  dome.renderOrder = -999; // right after the golden dome; behind everything (depth 1)
  dome.raycast = () => {};
  dome.visible = false;
  return dome;
}

/**
 * The cloud shade's tile: white (no shade) with a few soft warm-grey blobs, drawn with
 * wrap-around copies so it repeats seamlessly. Baked once a session (a title round trip
 * builds a new World; the texture is shared, not rebuilt).
 */
let cloudTex: THREE.CanvasTexture | null = null;
function cloudTexture(): THREE.CanvasTexture {
  if (cloudTex) return cloudTex;
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // white = the full sun
  ctx.fillRect(0, 0, N, N);
  const blobs: [number, number, number, number][] = [
    [0.22, 0.30, 0.26, 0.30], [0.66, 0.20, 0.20, 0.24],
    [0.48, 0.62, 0.30, 0.26], [0.83, 0.74, 0.22, 0.22],
    [0.12, 0.82, 0.18, 0.20],
  ];
  for (const [bx, by, br, a] of blobs) {
    for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
      const cx = (bx + ox) * N, cy = (by + oy) * N, r = br * N;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(120,116,110,${a})`); // soft warm-grey shade
      g.addColorStop(1, 'rgba(120,116,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cloudTex = tex;
  return tex;
}

export class Sky {
  // W4.5 golden-hour light + selective hero shadow map. The warm sun casts a soft
  // shadow only for the ranger + solid props (castShadow=true); its tight ortho
  // frustum FOLLOWS the ranger via a fixed offset (`sunOffset`) so the covered set
  // stays the CLOSEST props and the light DIRECTION never changes (static, no day
  // cycle). Moving animals get cheap blob shadows instead (no shadow-map cost).
  readonly sun: THREE.DirectionalLight;
  private readonly sunOffset = new THREE.Vector3(-9, 7, 4);
  // W4.6 "Lucht + adem": all SECONDARY ambient motion (drifting cloud shadows,
  // grass wind wave, bird flyover). `skyTime` advances ONLY when reduced-motion is
  // off, so every effect freezes together under reduced-motion (comfort §C).
  skyTime = 0;
  private readonly cloudOff = { value: new THREE.Vector2() }; // the cloud shade's drift (shared uniform)
  private cloudReceivers = 0;                                    // materials that draw the cloud shade
  private flyBird: THREE.Group | null = null;    // the ~12 s sky crossing bird
  private lastFlyover: Flyover | null = null;
  private readonly scene: THREE.Scene;
  // run 6: the time of day (1 = the golden hour, 0 = a readable blue night) and what it
  // turns: the hemisphere fill, the key (sun or moon), the fog + background, the night dome
  private readonly daylightFade = new DaylightFade();
  private readonly hemi: THREE.HemisphereLight;
  private readonly fog: THREE.Fog;
  private readonly background: THREE.Color;
  private readonly nightDome: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // P1.1: the SHARED golden-hour sky (Lighting.makeSkyDome over Atmosphere.SKY_STOPS),
    // the same dome the title stands under — one sky. It is laid on the view's elevation,
    // so its horizon band IS the fog colour at the horizon: distant hills and the rim
    // dissolve into the sky there instead of showing a pale band under it.
    this.background = new THREE.Color(SKY_LOW);
    scene.background = this.background;
    scene.add(makeSkyDome());
    this.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 22, 90);
    scene.fog = this.fog;
    this.nightDome = makeNightDome();
    scene.add(this.nightDome);

    // P1.1: the ONE shared golden-hour rig (Lighting.GOLDEN_HOUR, §2.1) — the same
    // cool-sky / warm-ground hemisphere fill + warm low key the title + sandbox use,
    // so no screen reads as a different game.
    this.hemi = addGoldenHourHemi(scene);
    // W4.5: a warm, low golden-hour sun raking in from screen-left (the camera
    // looks down −z, so −x is the left of frame). Static direction — no day cycle.
    const sun = makeGoldenHourSun();
    sun.position.copy(this.sunOffset);
    // Selective HERO shadow map: only meshes with castShadow=true (the ranger +
    // solid props, opted in on load) drop a soft shadow. The ortho frustum is
    // kept tight (±16 m) and FOLLOWS the ranger each frame (followSun), so the
    // covered set is always the CLOSEST props — high-res + budget-safe.
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    const R = 16;
    sun.shadow.camera.left = -R; sun.shadow.camera.right = R;
    sun.shadow.camera.top = R; sun.shadow.camera.bottom = -R;
    sun.shadow.bias = -0.0006; // kill shadow acne on the low-poly ground
    scene.add(sun);
    scene.add(sun.target); // the shadow camera aims here; moved with the ranger
    this.sun = sun;
  }

  /**
   * W4.6: drifting cloud shadows, ON THE GROUND. Every material that asks for them
   * (`userData.cloudShade`: the terrain and the sand paths) gets the soft grey blobs of
   * one repeating texture in its own lighting: the blobs dim the sun there, before tone
   * mapping and fog (Atmosphere.cloudShadeShader), so the haze covers a far cloud
   * shadow like it covers the far ground. The shared offset is scrolled by
   * `cloudOffset(skyTime)` each frame, so the patches drift; a frozen clock
   * (reduced-motion) stops them. No mesh and no draw call of its own.
   *
   * It used to be a multiply-blended plane 3.2 m over the ground, drawn over the finished
   * and fogged picture: from the helicopter the far ground came out as the fog colour
   * times itself, a hard tan band under the cream sky (verifier W4V-1). Called once the
   * ground and the paths are in the scene.
   */
  buildCloudShadows(): void {
    const map = { value: cloudTexture() };
    const off = this.cloudOff;
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!mat.userData.cloudShade || mat.userData.cloudShaded) continue;
        mat.userData.cloudShaded = true;
        const prev = mat.onBeforeCompile;
        const prevKey = mat.customProgramCacheKey();
        mat.onBeforeCompile = (shader, renderer) => {
          prev.call(mat, shader, renderer);
          shader.uniforms.uCloudMap = map;
          shader.uniforms.uCloudOff = off; // one shared uniform: advance() drifts them all
          const s = cloudShadeShader(shader.vertexShader, shader.fragmentShader);
          shader.vertexShader = s.vertex;
          shader.fragmentShader = s.fragment;
        };
        // its own program: the title's heath shares the ground material's key without clouds
        mat.customProgramCacheKey = () => `${prevKey}|cloud-shade`;
        mat.needsUpdate = true;
        this.cloudReceivers++;
      }
    });
  }

  /**
   * W4.6: the bird flyover. A small dark silhouette (a shallow V of two wings)
   * high in the sky; `flyoverAt(skyTime)` sails it west→east on the ~12 s period
   * with a calm gap between passes. Parked off-view / frozen under reduced-motion.
   */
  buildFlyover(): void {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#3b3630' });
    const wing = new THREE.BoxGeometry(1.6, 0.06, 0.34);
    const left = new THREE.Mesh(wing, mat);
    const right = new THREE.Mesh(wing, mat);
    left.position.set(-0.75, 0, 0); left.rotation.z = 0.28;
    right.position.set(0.75, 0, 0); right.rotation.z = -0.28;
    g.add(left, right);
    g.visible = false;
    this.flyBird = g;
    this.scene.add(g);
  }

  /** W4.5: the hero shadow camera follows the ranger — the tight ortho frustum
   *  tracks him via a FIXED offset so the light DIRECTION never changes (static
   *  golden-hour sun), only the covered set (the closest props) moves with him. */
  followSun(x: number, z: number): void {
    const o = this.sunOffset;
    this.sun.position.set(x + o.x, o.y, z + o.z);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }

  /**
   * Run 6: turn the time of day to `k` (1 = the golden hour, 0 = a readable blue moonlit
   * night) over `seconds` (~2 s, calm; a cut under reduced motion, or with `seconds` 0).
   * The hemisphere fill, the key light (the low sun becomes a pale moon from the same
   * direction, so no shadow jumps), the fog, the background and the night dome all move
   * together. A new world starts at 1; whoever turns it hands 1 back (the adventure kit
   * does when a mission ends or is stopped).
   */
  setDaylight(k: number, seconds = DAYLIGHT_FADE_S): void {
    if (seconds <= 0) { this.daylightFade.cut(k); this.applyDaylight(); return; }
    this.daylightFade.set(k, seconds);
  }

  /** The time of day now (1 = the golden hour), and where it is going. */
  get daylight(): { now: number; target: number } {
    return { now: this.daylightFade.value, target: this.daylightFade.target };
  }

  private applyDaylight(): void {
    const L = lightAt(DAY_SET, NIGHT_SET, this.daylightFade.value);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.key);
    this.sun.intensity = L.keyI;
    this.fog.color.set(L.fog);
    this.background.set(L.fog);
    this.nightDome.visible = L.night > 0.002;
    (this.nightDome.material as THREE.ShaderMaterial).uniforms.uAlpha.value = L.night;
  }

  /** W4.6: advance the ambient clock (frozen under reduced-motion) and drift the cloud
   *  shade + sail the flyover bird. Runs every frame, even during an in-place
   *  activity, so the sky keeps breathing. Returns the clock for the wind + water. */
  advance(dt: number, reduced: boolean): number {
    if (this.daylightFade.step(dt, reduced)) this.applyDaylight(); // run 6: the day turns (a cut when reduced)
    if (!reduced) this.skyTime += dt;
    const st = this.skyTime;
    if (this.cloudReceivers > 0) {
      const off = cloudOffset(st);
      this.cloudOff.value.set(off.x, off.y);
    }
    if (this.flyBird) {
      const f = flyoverAt(st);
      this.lastFlyover = f;
      this.flyBird.visible = f.visible;
      this.flyBird.position.set(f.x, f.y, f.z);
      this.flyBird.rotation.y = f.facing;
    }
    return st;
  }

  /** Dev-hook read-back (W4.6): gradient stop count, whether the ground draws the cloud
   *  shade, the LIVE clock / cloud offset / wind phase / bird position. */
  state(windMeshes: number): {
    gradientStops: number;
    cloudDrift: boolean;
    windMeshes: number;
    skyTime: number;
    cloudOffset: { x: number; y: number };
    windSample: number;
    flyover: { x: number; y: number; z: number; visible: boolean } | null;
    daylight: number;
  } {
    const f = this.lastFlyover;
    return {
      daylight: this.daylightFade.value,
      gradientStops: SKY_STOPS.length,
      cloudDrift: this.cloudReceivers > 0,
      windMeshes,
      skyTime: this.skyTime,
      cloudOffset: cloudOffset(this.skyTime),
      windSample: windSway(this.skyTime, 0),
      flyover: f ? { x: f.x, y: f.y, z: f.z, visible: f.visible } : null,
    };
  }
}
