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

const SKY_LOW = GOLDEN_HOUR.fogColor; // shared golden-hour horizon + fog colour (P1.1)

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // P1.1: the SHARED golden-hour sky (Lighting.makeSkyDome over Atmosphere.SKY_STOPS),
    // the same dome the title stands under — one sky. It is laid on the view's elevation,
    // so its horizon band IS the fog colour at the horizon: distant hills and the rim
    // dissolve into the sky there instead of showing a pale band under it.
    scene.background = new THREE.Color(SKY_LOW);
    scene.add(makeSkyDome());
    scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 22, 90);

    // P1.1: the ONE shared golden-hour rig (Lighting.GOLDEN_HOUR, §2.1) — the same
    // cool-sky / warm-ground hemisphere fill + warm low key the title + sandbox use,
    // so no screen reads as a different game.
    addGoldenHourHemi(scene);
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

  /** W4.6: advance the ambient clock (frozen under reduced-motion) and drift the cloud
   *  shade + sail the flyover bird. Runs every frame, even during an in-place
   *  activity, so the sky keeps breathing. Returns the clock for the wind + water. */
  advance(dt: number, reduced: boolean): number {
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
  } {
    const f = this.lastFlyover;
    return {
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
