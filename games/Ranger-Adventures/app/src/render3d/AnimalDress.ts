/**
 * AnimalDress.ts — the THREE-touching half of the coat/posture recipe (the pure
 * table lives in Coat.ts, like Eyes.ts ↔ EyeMaterial.ts). Both calls are
 * best-effort: a model with no tintable body material or no children is left
 * untouched and never throws — the game stays playable.
 */

import * as THREE from 'three';
import { coatTintFor, postureFor, patternFor, coatCoords, albedoLiftFor, isAnimalModel, matteRoughness, MATTE_ROUGHNESS, type CoatPattern } from './Coat';
import { applyEyes } from './EyeMaterial';
import { applyCalmPose } from './CalmPoseRig';
import { mergeColourSplits } from './play/merge';

const EYE_NAME = /eye|oog|iris|cornea|pupil/i; // never retint the eyes (they own their material)

/** How an animal is dressed beyond its model id. */
export interface DressOpts {
  /** a content id with a coat of its own on this model (a reddish yearling on the boar's) */
  coat?: string | null;
  /** its eyes (default on; a bird gliding far overhead has none anybody sees) */
  eyes?: boolean;
  /** join its colour-split primitives into one draw call (default on) */
  merge?: boolean;
}

/**
 * Run 7: the ONE way an animal is dressed, wherever it is loaded — the roamers and the
 * gliding birds (world/Fauna.ts), the mission markers' heroes (world/Markers.ts) and every
 * animal a mission or a home stages (play/spawn.ts). Before, each path dressed its own way,
 * so a fix in one left the others behind. In order: its eyes, its coat (a tint where the
 * model contradicts the dossier, a young one's own coat, the piglet's stripes), its stance
 * and calm pose, one draw call for its colours; and it is tagged (`userData.animal`) so the
 * light and the dev probe find it. Best-effort: a model with nothing to dress is left as it is.
 */
export function dressAnimal(root: THREE.Object3D, id: string | null, opts: DressOpts = {}): void {
  if (!id) return;
  if (opts.eyes !== false) applyEyes(root, id, { dusk: false }); // parallax reads the live policy
  applyCoat(root, id);
  if (opts.coat && opts.coat !== id) applyCoat(root, opts.coat);
  applyPattern(root, id);
  applyPosture(root, id);
  applyCalmPose(root, id); // a one-time rest-pose bias (not motion)
  if (opts.merge !== false) mergeColourSplits(root);
  if (!isAnimalModel(id)) return; // (a person staged by a home keeps its own light)
  lightAnimal(root, id);
  root.userData.animal = id;
}

/* ------------------------------------------------------- the animal light ---- */

/**
 * Run 7: the animal fill — one soft light every animal gets on top of the world's
 * hemisphere fill, so the side away from the low sun is lit like a warm bounce instead of
 * going black (distant animals rendered almost black: a dark coat on its shaded side, lit
 * only by the hemisphere fill, through the tone curve's toe). Linear colour × intensity;
 * each mood sets it (world/Sky.ts). ONE uniform object shared by every animal material, so
 * a mood change is one write and a faded copy (play/fade.ts) keeps it.
 */
const animalFill = { value: new THREE.Color(0, 0, 0) }; // (world/Sky.ts sets the mood's)

/** Set the animal fill (a css colour × intensity). */
export function setAnimalFill(color: string, intensity: number): void {
  animalFill.value.set(color).multiplyScalar(Math.max(0, intensity));
}

/** The animal fill now (linear rgb), for the dev read. */
export function animalFillNow(): [number, number, number] {
  return [animalFill.value.r, animalFill.value.g, animalFill.value.b];
}

/** Dressed copies of shared materials: every roamer of a species shares one. */
const LIT = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Light one animal the same way everywhere: matte (metalness 0, roughness ≥ fur's, also
 * through its maps), its colour lifted where the dossier coat reads black (Coat.ts), and
 * the animal fill in its indirect light — one shader variant for every animal (its eyes
 * keep their own material). A dressed COPY replaces each material (shared ones share one
 * copy): the cached GLB's own materials are never changed, so a later clone of it is
 * dressed once, not twice.
 */
function lightAnimal(root: THREE.Object3D, id: string): void {
  const lift = albedoLiftFor(id);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const lit = list.map((m) => litCopy(m, lift));
    if (lit.some((m, i) => m !== list[i])) mesh.material = Array.isArray(mesh.material) ? lit : lit[0];
  });
}

function litCopy(src: THREE.Material, lift: number): THREE.Material {
  const std = src as THREE.MeshStandardMaterial;
  if (!std.isMeshStandardMaterial || src.userData.eyeSpec || src.userData.animalLit) return src;
  const known = LIT.get(src);
  if (known) return known;
  const m = std.clone();
  // its own shader hooks (the piglet's stripes) and their program key travel with it
  const prev = std.onBeforeCompile;
  const prevKey = std.customProgramCacheKey();
  m.userData = { ...std.userData, animalLit: true };
  m.metalness = 0;
  m.roughness = matteRoughness(std.roughness);
  if (lift !== 1) m.color.multiplyScalar(lift);
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uAnimalFill = animalFill;
    shader.fragmentShader = animalLightShader(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => `${prevKey}|animal-light`;
  LIT.set(src, m);
  return m;
}

/**
 * The animal light in a MeshStandardMaterial's fragment shader: fur never glossier than
 * MATTE_ROUGHNESS (through a roughness map too), never metal, and the fill added to the
 * indirect light — the full fill where the coat turns away from the key (the sun), half of
 * it where the key already lights it, so the low sun still models the body. Throws when an
 * anchor is missing (a three upgrade renamed a chunk) rather than silently lighting nothing.
 */
export function animalLightShader(fragment: string): string {
  for (const a of ['#include <common>', '#include <roughnessmap_fragment>', '#include <metalnessmap_fragment>', '#include <lights_fragment_end>']) {
    if (!fragment.includes(a)) throw new Error(`animalLightShader: no ${a} to patch`);
  }
  return fragment
    .replace('#include <common>', '#include <common>\nuniform vec3 uAnimalFill;')
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${MATTE_ROUGHNESS.toFixed(2)});`)
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
    .replace('#include <lights_fragment_end>', `{
  float animalKey = 0.0;
  #if NUM_DIR_LIGHTS > 0
    animalKey = saturate(dot(geometryNormal, directionalLights[0].direction));
  #endif
  irradiance += uAnimalFill * (1.0 - 0.5 * animalKey);
}
#include <lights_fragment_end>`);
}

/**
 * Lerp a loaded model's body material colours toward its dossier coat tint. Skips
 * eye meshes and any material without a `.color`. Returns the count of materials
 * retinted (0 when the species has no correction — the common case). Idempotent-ish:
 * cloning the material per call keeps a re-dress from compounding the lerp.
 */
export function applyCoat(root: THREE.Object3D, id: string | null): number {
  const tint = coatTintFor(id);
  if (!tint) return 0;
  const target = new THREE.Color(tint.color);
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (EYE_NAME.test(mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((m) => {
      const src = m as THREE.Material & { color?: THREE.Color; name?: string };
      if (!src.color || EYE_NAME.test(src.name ?? '')) return m;
      if (tint.only && !tint.only.includes(src.name ?? '')) return m; // (only its coat)
      const clone = src.clone() as THREE.Material & { color: THREE.Color };
      clone.color.copy(src.color).lerp(target, tint.strength);
      if (tint.ramp && (clone as THREE.MeshStandardMaterial).isMeshStandardMaterial) rampShader(clone as THREE.MeshStandardMaterial, tint.ramp);
      n++;
      return clone;
    }) as THREE.Material[] | THREE.Material;
    // unwrap a single-element array back to a lone material (three prefers this)
    if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
  });
  return n;
}

/**
 * Run 7: a coat RAMP (Coat.ts `ramp`): each texel of the fur by its own lightness onto the
 * ramp from `dark` to `light`, the fur's own shading kept — another coat on the same fur (a
 * dark-brown squirrel on the red squirrel's model, its cream belly a pale fawn).
 */
function rampShader(mat: THREE.MeshStandardMaterial, r: NonNullable<ReturnType<typeof coatTintFor>>['ramp'] & object): void {
  const col = (hex: string): THREE.Vector3 => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };
  const uniforms = { coatRampDark: { value: col(r.dark) }, coatRampLight: { value: col(r.light) }, coatRampSplit: { value: new THREE.Vector2(r.split[0], r.split[1]) } };
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 coatRampDark; uniform vec3 coatRampLight; uniform vec2 coatRampSplit;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = mix(coatRampDark, coatRampLight, smoothstep(coatRampSplit.x, coatRampSplit.y, lum));
  diffuseColor.rgb = c * (0.75 + 0.5 * lum);
}`);
  };
  mat.customProgramCacheKey = () => `${prevKey}|coat-ramp-${r.dark}-${r.light}`;
  mat.needsUpdate = true;
}

const _box = new THREE.Box3();
const _at = new THREE.Vector3();

/**
 * Bias a head-low / snuffling species into a subtle nose-down stance. `wrapper` is
 * the group `prepModel` returns (feet at y=0, so pitching its child about X pivots
 * near the feet — nose dips, back lifts a hair). A no-op for upright species.
 * One-time transform (not motion), so reduced-motion does not apply.
 *
 * Tipped forward, the snout dips below the hooves prepModel stood on the ground, so
 * the posture stands the animal on its lowest point again (the posture species are
 * static meshes: the geometry, vertex by vertex, is what draws).
 */
export function applyPosture(wrapper: THREE.Object3D, id: string | null): void {
  const { pitch } = postureFor(id);
  if (pitch <= 0) return;
  const inner = wrapper.children[0];
  if (!inner) return;
  inner.rotation.x += pitch;
  wrapper.updateWorldMatrix(true, true);
  const low = _box.setFromObject(wrapper, true).min.y - wrapper.getWorldPosition(_at).y;
  if (Number.isFinite(low)) inner.position.y -= low;
}

/**
 * Run 6: paint a model's coat PATTERN (Coat.ts `patternFor`: the frisling's golden
 * lengthwise stripes) over its own texture. Each vertex carries its place on the body
 * (along it, up it, round it: a `coatUV` attribute, written once on the shared GLB
 * geometry, so a piglet laid down by play/pose.lieDown keeps its stripes where they
 * were), and the fragment shader draws the stripes crisply from it. The head keeps its
 * texture's own light and dark (the eyes, the ears), tinted brown. One extra shader
 * program for every striped piglet. A model without a pattern is left untouched.
 */
export function applyPattern(root: THREE.Object3D, id: string | null): number {
  const p = patternFor(id);
  if (!p) return 0;
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || EYE_NAME.test(mesh.name)) return;
    const geo = mesh.geometry;
    if (!geo.getAttribute('coatUV')) {
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const c = coatCoords(p, pos.getX(i), pos.getY(i), pos.getZ(i), box);
        uv[i * 3] = c.u; uv[i * 3 + 1] = c.vy; uv[i * 3 + 2] = c.a;
      }
      geo.setAttribute('coatUV', new THREE.BufferAttribute(uv, 3));
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial || mat.userData.coat) continue;
      mat.userData.coat = true;
      patternShader(mat, p);
      n++;
    }
  });
  return n;
}

function patternShader(mat: THREE.MeshStandardMaterial, p: CoatPattern): void {
  const col = (hex: string): THREE.Vector3 => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };
  const uniforms = {
    coatBase: { value: col(p.base) }, coatStripe: { value: col(p.stripe) }, coatDark: { value: col(p.dark) },
    coatBelly: { value: col(p.belly) }, coatHead: { value: col(p.head) },
    coatShape: { value: new THREE.Vector4(p.perSide, p.duty, p.from, p.to) }, coatLegs: { value: p.legs },
  };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 coatUV;\nvarying vec3 vCoat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoat = coatUV;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCoat;
uniform vec3 coatBase; uniform vec3 coatStripe; uniform vec3 coatDark; uniform vec3 coatBelly; uniform vec3 coatHead;
uniform vec4 coatShape; uniform float coatLegs;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  float u = vCoat.x, vy = vCoat.y, a = vCoat.z;
  float band = a / 2.25 * (coatShape.x + 0.5);
  float k = floor(band + 0.5);
  float d = abs(band - k);
  float aa = max(fwidth(band) * 0.8, 0.02);
  float stripe = (1.0 - smoothstep(coatShape.y * 0.5 - aa, coatShape.y * 0.5 + aa, d)) * step(0.5, k) * step(k, coatShape.x + 0.1);
  float body = smoothstep(coatShape.z - 0.03, coatShape.z + 0.03, u) * (1.0 - smoothstep(coatShape.w - 0.03, coatShape.w + 0.03, u));
  vec3 c = mix(coatBase, coatStripe, stripe * body);
  c = mix(c, coatBelly, smoothstep(2.15, 2.4, a));
  c *= 0.9 + 0.16 * lum;
  c = mix(c, coatHead * (0.35 + 0.95 * lum), smoothstep(coatShape.w + 0.01, coatShape.w + 0.07, u));
  c = mix(c, coatDark, 1.0 - smoothstep(coatLegs - 0.03, coatLegs + 0.03, vy));
  c = mix(c, coatDark, smoothstep(0.92, 0.95, u));
  diffuseColor.rgb = c;
}`);
  };
  mat.customProgramCacheKey = () => `coat-${p.kind}-${p.perSide}`;
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------ the dev probe ---- */

/** One dressed animal as the player sees it (`__ranger.animals()`, read-only). */
export interface AnimalSeen {
  /** its model id, and where it stands (world m) */
  id: string; x: number; y: number; z: number;
  /** from the lens (m) */
  dist: number;
  /** its screen box (CSS px: x0, y0, x1, y1), and whether its middle is in the picture */
  box: [number, number, number, number]; onScreen: boolean;
  /** points of its own surface that the lens sees (CSS px): sample the picture there to
   *  read the animal's own pixels, never the ground or sky round it */
  pts: [number, number][];
  /** how many of its sampled cells a name tag drawn over the world covers (they are not in
   *  `pts`): a test that wants the whole animal looks from somewhere else */
  covered: number;
}

const seenBox = new THREE.Box3();
const seenV = new THREE.Vector3();
const seenRay = new THREE.Raycaster();
const camAt = new THREE.Vector3();

function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Does this hit hide what lies behind it (a see-through overlay, a blob shadow, a hidden
 *  part do not)? */
function hides(hit: THREE.Intersection): boolean {
  const o = hit.object as THREE.Mesh;
  if (!o.isMesh || o.userData.hitSphere || !shown(o)) return false;
  const mat = (Array.isArray(o.material) ? o.material[hit.face?.materialIndex ?? 0] : o.material) as THREE.Material | undefined;
  if (!mat || !mat.visible || mat.colorWrite === false) return false;
  return !(mat.transparent && (!mat.depthWrite || mat.opacity < 0.35));
}

/** Is this hit a name tag drawn over the world (a sprite that ignores depth, world/Labels.ts):
 *  wherever it stands along the ray, it is what the picture shows there? */
function drawnOver(hit: THREE.Intersection): boolean {
  const o = hit.object as THREE.Sprite;
  if (!o.isSprite || !shown(o)) return false;
  const mat = o.material;
  return mat.visible && mat.depthTest === false && mat.opacity >= 0.35;
}

function under(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
}

/**
 * Every dressed animal in the picture: its screen box and up to `max` of its own pixels
 * (spread evenly over what the lens sees of it: a ray through the pixel meets it first, and
 * its neighbours too), for a test that reads how bright an animal is drawn at a distance.
 * Read-only: nothing in the scene changes.
 */
export function animalsSeen(scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, max = 160): AnimalSeen[] {
  const out: AnimalSeen[] = [];
  camera.getWorldPosition(camAt);
  seenRay.camera = camera; // (a sprite's ray test needs it)
  const roots: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.userData.animal && shown(o)) roots.push(o); });
  const toScreen = (v: THREE.Vector3): [number, number, boolean] => {
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * w, (1 - (p.y * 0.5 + 0.5)) * h, p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1];
  };
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    seenBox.makeEmpty();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !shown(m) || m.userData.hitSphere) return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      if (mat.transparent && !mat.depthWrite) return; // a blob shadow is not the animal
      seenBox.expandByObject(m);
    });
    if (seenBox.isEmpty()) continue;
    const c = seenBox.getCenter(new THREE.Vector3());
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      seenV.set(i & 1 ? seenBox.max.x : seenBox.min.x, i & 2 ? seenBox.max.y : seenBox.min.y, i & 4 ? seenBox.max.z : seenBox.min.z);
      const [sx, sy] = toScreen(seenV);
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    const [, , onScreen] = toScreen(c);
    const pts: [number, number][] = [];
    let covered = 0;
    if (onScreen) {
      // its own pixels: a grid over its screen box, a ray from the lens through each cell,
      // kept where this animal is the first thing the ray meets; then the rim is eroded
      // away (an edge pixel is blended with what lies behind it)
      const bx0 = Math.max(0, x0), by0 = Math.max(0, y0), bx1 = Math.min(w - 1, x1), by1 = Math.min(h - 1, y1);
      const step = Math.max(1, Math.sqrt(((bx1 - bx0) * (by1 - by0)) / 400));
      const nx = Math.max(1, Math.floor((bx1 - bx0) / step)), ny = Math.max(1, Math.floor((by1 - by0) / step));
      const hitAt = new Uint8Array(nx * ny);
      const ndc = new THREE.Vector2();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const sx = bx0 + (i + 0.5) * step, sy = by0 + (j + 0.5) * step;
        ndc.set((sx / w) * 2 - 1, -((sy / h) * 2 - 1));
        seenRay.setFromCamera(ndc, camera);
        seenRay.far = Infinity;
        const hits = seenRay.intersectObjects(scene.children, true);
        const hit = hits.find(hides);
        if (!hit || !under(hit.object, root)) continue;
        if (hits.some(drawnOver)) { covered++; continue; } // (a name tag over it: not its pixel)
        hitAt[j * nx + i] = 1;
      }
      const inner: [number, number][] = [], all: [number, number][] = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!hitAt[j * nx + i]) continue;
        const p: [number, number] = [Math.round((bx0 + (i + 0.5) * step) * 10) / 10, Math.round((by0 + (j + 0.5) * step) * 10) / 10];
        all.push(p);
        const nb = (a: number, b: number): boolean => a >= 0 && b >= 0 && a < nx && b < ny && hitAt[b * nx + a] === 1;
        if (nb(i - 1, j) && nb(i + 1, j) && nb(i, j - 1) && nb(i, j + 1)) inner.push(p);
      }
      const use = inner.length >= 12 ? inner : all;
      const every = Math.max(1, Math.ceil(use.length / max));
      for (let k = 0; k < use.length; k += every) pts.push(use[k]);
    }
    const at = root.getWorldPosition(new THREE.Vector3());
    out.push({
      id: root.userData.animal as string, x: at.x, y: at.y, z: at.z, dist: c.distanceTo(camAt),
      box: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)], onScreen, pts, covered,
    });
  }
  return out;
}
