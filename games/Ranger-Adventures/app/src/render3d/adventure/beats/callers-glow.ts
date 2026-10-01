/**
 * beats/callers-glow.ts — the light a calling animal takes (beats/callers.ts, the
 * eekhoorn neighbours): its OWN colours in a warm light, a warm rim on its outline. Kept
 * apart from the beat (it needs only three) so its hard rule is pinned by a node test
 * (callers-glow.test.ts): a material gets the rim's shader ONCE, for good, with ONE set
 * of rim uniforms that every later glow on it drives. Two ways that broke (2026-10-01):
 * a beat stopped mid-call left its wrapper on, the next glow wrapped it again, the shader
 * declared the rim twice and the animal was not drawn at all; and a glow that unwrapped
 * the material when it ended let the next one wrap it anew with the very same program
 * key — the renderer keeps a compiled program per material and key and does not run the
 * new wrapper, so the program kept reading the first glow's (dead) uniforms: on a replay
 * the roe lit up as a flat cream cut-out and the neighbours had no rim.
 */

import * as THREE from 'three';

/** The warm light of a call. */
export const CALL = '#ffd98a';
/** How bright a call lights its animal (its own colours, so brighter than a flat fill). */
export const CALL_GLOW = 0.95;
/** How far a call lifts an animal's own colour toward white (0..1): a touch — scaled by
 *  the colour's own luminance, so a black raven stays a black bird and its rim does the
 *  work (a lift added flat turned its near-black into a pale olive grey, 2026-10-01).
 *  Every other caller's base colour is white (its colours are in its texture): unlifted. */
const LIFT = 0.12;

/** A material that carries the rim's shader (for good, once a glow reached it): how it
 *  looked before any glow (its look at rest, given back whenever no call lights it), its
 *  emissive map at rest, the rim's uniforms (the compiled shader reads these — the same
 *  ones for every glow on it) and the glow that lights it now. */
interface Worn {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensity: number;
  /** its own emissive map (a model with a baked one lends it to its colour texture while lit) */
  map: THREE.Texture | null;
  rest: THREE.Texture | null;
  rim: { value: number };
  rimColor: { value: THREE.Color };
  /** (null: none — it is at rest) */
  owner: WarmGlow | null;
}

/** Every material that carries the rim's shader: a later glow on it drives the same
 *  uniforms (never a second wrapper, never a new one). Weak: a material that is thrown
 *  away is forgotten. */
const WORN = new WeakMap<THREE.Material, Worn>();

/** Does `mat` carry the rim's shader? (the tests) */
export function wearsRim(mat: THREE.Material): boolean { return WORN.has(mat); }

/** Put the rim's shader on `mat` — once, for good: idle (rim 0) it looks exactly as it
 *  did — and remember how it looked. */
function wear(mat: THREE.MeshStandardMaterial): Worn {
  const e: Worn = {
    mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity, map: mat.emissiveMap, rest: mat.emissiveMap,
    rim: { value: 0 }, rimColor: { value: new THREE.Color() }, owner: null,
  };
  // a textured part with no emissive map of its own (the roe's coat): its colour texture
  // goes in as the emissive map now, with the rim — its emissive shows nothing at rest, so
  // it looks as it did, and while it glows it glows in its own coat, not one flat colour
  if (!mat.emissiveMap && mat.map && (mat.emissiveIntensity === 0 || mat.emissive.getHex() === 0)) { mat.emissiveMap = mat.map; e.rest = mat.map; }
  const { rim, rimColor } = e;
  const compile = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.uCallRim = rim;
    shader.uniforms.uCallRimColor = rimColor;
    // (only while it glows: at rest the block is skipped and it looks as it did)
    shader.fragmentShader = 'uniform float uCallRim;\nuniform vec3 uCallRimColor;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nif (uCallRim > 0.0) {\n' +
      '  float callFace = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);\n' +
      // a model whose colours are in its vertices (a merged one, the roe): its own
      // colours in the light too, lifted a little like the base colour
      '  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n' +
      `  totalEmissiveRadiance *= vColor.rgb + (1.0 - vColor.rgb) * ${LIFT.toFixed(2)};\n` +
      '  #endif\n' +
      // lit toward the lens, softer where it turns away: its shape, never a flat fill;
      // and a warm ring on its very outline only (a dark raven glows at its edge and
      // stays a dark bird inside it)
      '  totalEmissiveRadiance *= 0.5 + 0.5 * callFace;\n' +
      '  totalEmissiveRadiance += uCallRimColor * (uCallRim * 1.3 * smoothstep(0.55, 0.95, 1.0 - callFace));\n}');
  };
  mat.customProgramCacheKey = function () { return `${key.call(this)}|call-rim`; };
  mat.needsUpdate = true;
  WORN.set(mat, e);
  return e;
}

/** At rest: as it looks while no call lights it. */
function rest(e: Worn): void {
  e.rim.value = 0;
  e.mat.emissive.copy(e.emissive);
  e.mat.emissiveIntensity = e.intensity;
  e.mat.emissiveMap = e.rest;
}

/**
 * A calling animal lights up in its OWN colours: its real materials take a warm light
 * (the emissive reads the colour texture and the base colour, tinted warm, so the jay
 * stays a jay and the badger a badger), and a warm rim rings its outline (so a black
 * raven lights up too, its feathers still its own) — never a flat cream cut-out. The
 * rim goes into the shader once, when the first glow reaches the material (a shader
 * variant per material, built while the lens holds, never mid-call), and stays there,
 * idle at rest; a later glow on the same material — the next beat, a replay, a beat
 * begun again after a stop — drives the same rim, through the same program. While it
 * glows, a model that has its own (dark, baked) emissive map lends that slot to its
 * colour texture — a texture swap, no new shader — and gets it back the moment the glow
 * ends, so at rest every animal looks exactly as it did; a textured part without one (the
 * roe's coat) takes its colour texture as its emissive map when the rim goes in (its
 * emissive shows nothing at rest); an untextured one glows in its own base colour, and a
 * merged one (the roe's other parts: their colours in their vertices) in its vertex
 * colours. The light is strongest where it faces the lens, so it keeps its shape.
 * `clear` gives every material its look at rest back.
 */
export class WarmGlow {
  private readonly mats: Worn[] = [];
  private readonly color = new THREE.Color();
  private readonly tmp = new THREE.Color();

  constructor(root: THREE.Object3D, color: THREE.ColorRepresentation = CALL) {
    this.color.set(color);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.hitSphere || mesh.userData.hintAnchor) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat.isMeshStandardMaterial) continue;
        const e = WORN.get(mat) ?? wear(mat);
        // (a glow that never cleared — its beat stopped mid-call — left it lit: at rest
        // again, under this one)
        if (e.owner !== this) { if (e.owner) rest(e); e.owner = this; }
        if (!this.mats.includes(e)) this.mats.push(e);
      }
    });
  }

  /** Light it `level` (0 = as it was), warm, or in `color` (a right echo's green). */
  set(level: number, color?: THREE.ColorRepresentation): void {
    if (color !== undefined) this.color.set(color);
    const on = level > 0.001;
    for (const e of this.mats) {
      if (e.owner !== this) continue; // (a later glow has it now)
      if (!on) { rest(e); continue; }
      e.rim.value = level;
      e.rimColor.value.copy(this.color);
      if (e.map && e.mat.map) e.mat.emissiveMap = e.mat.map;
      // its own colour (texture × base colour) in the warm light, lifted only a touch and
      // only as much as it is light: a black raven stays a black bird (the rim rings it),
      // never a pale grey one
      const c = e.mat.color;
      const lift = LIFT * (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
      e.mat.emissive.copy(this.tmp.setRGB(c.r + (1 - c.r) * lift, c.g + (1 - c.g) * lift, c.b + (1 - c.b) * lift).multiply(this.color));
      e.mat.emissiveIntensity = level;
    }
  }

  /** Every material at rest again, as it looked before any glow (its rim idle in its
   *  shader, ready for the next glow — no recompile). */
  clear(): void {
    for (const e of this.mats) {
      if (e.owner !== this) continue;
      rest(e);
      e.owner = null;
    }
  }
}
