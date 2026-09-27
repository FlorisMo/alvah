/**
 * world/Sky.ts — the sky, the golden-hour light and the slow ambient clock.
 *
 * The baked golden-hour sky + fog, the shared hemisphere fill, the warm sun with its
 * tight hero shadow frustum that follows the ranger, the drifting cloud shadows and
 * the ~12 s bird flyover. `skyTime` is the ambient clock every secondary motion reads
 * (wind in the grass, the water shimmer); it only advances when reduced-motion is off,
 * so all of it freezes together (comfort §C).
 */

import * as THREE from 'three';
import { SKY_STOPS, cloudOffset, windSway, flyoverAt, type Flyover } from '../Atmosphere';
import { GOLDEN_HOUR, addGoldenHourHemi, makeGoldenHourSun, makeSkyDome } from '../Lighting';

const SKY_LOW = GOLDEN_HOUR.fogColor; // shared golden-hour horizon + fog colour (P1.1)

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
  private cloudLayer: THREE.Mesh | null = null;  // multiply-blended cloud-shadow plane
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
   * W4.6: drifting cloud shadows. ONE large flat plane over the play area,
   * MULTIPLY-blended so its soft grey blobs darken the ground pixels behind it —
   * a real cheap cloud shadow (one draw call, no shadow-map cost). The texture
   * repeats and its offset is scrolled by `cloudOffset(skyTime)` each frame, so
   * the patches drift; a frozen clock (reduced-motion) stops them. Sits low over
   * the terrain and only DARKENS (multiply against white = no change), so it
   * never adds a visible plane — just soft moving shade.
   */
  buildCloudShadows(): void {
    const N = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // white = "no darkening" under multiply
    ctx.fillRect(0, 0, N, N);
    // a few soft grey blobs = the cloud undersides that darken the ground. Drawn
    // with wrap-around copies so the tile stays seamless when it repeats.
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
    tex.repeat.set(2.2, 2.2); // ~110 m per tile over the 240 m ground — big soft clouds
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.MultiplyBlending, premultipliedAlpha: true, // three wants this for multiply
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 3.2;   // low over the gentle relief so shade reads on the ground
    mesh.renderOrder = 2;    // after the ground + props so the multiply lands on them
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.cloudLayer = mesh;
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
   *  shadows + sail the flyover bird. Runs every frame, even during an in-place
   *  activity, so the sky keeps breathing. Returns the clock for the wind + water. */
  advance(dt: number, reduced: boolean): number {
    if (!reduced) this.skyTime += dt;
    const st = this.skyTime;
    if (this.cloudLayer) {
      const off = cloudOffset(st);
      const map = (this.cloudLayer.material as THREE.MeshBasicMaterial).map;
      if (map) map.offset.set(off.x, off.y);
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

  /** Dev-hook read-back (W4.6): gradient stop count, whether the cloud-shadow layer is
   *  present, the LIVE clock / cloud offset / wind phase / bird position. */
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
      cloudDrift: this.cloudLayer !== null,
      windMeshes,
      skyTime: this.skyTime,
      cloudOffset: cloudOffset(this.skyTime),
      windSample: windSway(this.skyTime, 0),
      flyover: f ? { x: f.x, y: f.y, z: f.z, visible: f.visible } : null,
    };
  }
}
