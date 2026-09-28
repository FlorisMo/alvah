/**
 * Lighting.ts — the ONE golden-hour rig, shared by every 3D scene (P1.1).
 *
 * RUN-C-DIRECTION §2.1 makes a single lighting recipe the law for the whole
 * world so "de hele set als één wereld samenhangt": title → world → case-board →
 * the 5 games all build their key + fill + sky + fog from THESE constants, so no
 * screen can drift into reading as a different game. Before this module the three
 * player scenes (Stage title backdrop, the explorable World, the demo Sandbox)
 * each hand-copied a slightly different Hemi/Sun/sky triple — the drift the
 * cohesion box exists to end.
 *
 * The signature is "warme highlights, koele schaduwen" (3d-animal-animation-
 * research §A7/§C2): a warm low DirectionalLight key + a HemisphereLight fill
 * whose SKY term is cool (skylight bounce into shadow) and GROUND term is warm
 * (sun-warmed earth bounce). Values are the direction doc's, not invented.
 *
 * Contracts: no draw-call cost (two lights + a shared 2×256 sky canvas), no
 * motion, no network. Tone mapping / exposure / pixelRatio live on the ONE shared
 * renderer (Stage), so they are already unified across every scene.
 */

import * as THREE from 'three';
import { SKY_STOPS, toneMappedHex } from './Atmosphere';

/** Renderer exposure for the ACES curve (Stage owns the one renderer). */
const EXPOSURE = 1.08;

/** The single golden-hour rig every 3D scene reads from (RUN-C-DIRECTION §2.1). */
export const GOLDEN_HOUR = {
  /** Warm directional KEY — a low golden sun in the #FFCF8F→#FFB870 band (§2.1). */
  keyColor: 0xffc080,
  keyIntensity: 2.1,
  /** Low, raking key direction (screen-left, camera looks down −z). Matches the
   *  World's shadow-follow offset so the hero shadow rakes the same way the light
   *  reads on every other screen. */
  keyDir: new THREE.Vector3(-9, 7, 4),
  /** HemisphereLight FILL — COOL sky bounce over WARM ground bounce (§2.1): warm
   *  highlights, cool shadows, the shared shading signature of the whole cast. A
   *  little lower than the key so the low sun models every form (2026-09-27). */
  skyColor: 0xb4c6e0,
  groundColor: 0x8a6b4a,
  fillIntensity: 0.85,
  /** The horizon haze as the sky dome DRAWS it: the last SKY_STOPS band through the
   *  tone curve (three mixes fog in after tone mapping, so the fog must be the drawn
   *  colour, not the raw haze). Fully fogged hills, trees and the forest beyond the rim
   *  then dissolve into the sky at the horizon in every direction instead of drawing an
   *  orange band under it (breaker B9, parent B11). Ranges stay per-scene (each clearing
   *  is a different size); the COLOUR is shared. */
  fogColor: toneMappedHex(SKY_STOPS[SKY_STOPS.length - 1][1], EXPOSURE),
  /** Renderer exposure for the ACES curve (Stage owns the one renderer). */
  exposure: EXPOSURE,
} as const;

/** Add the shared cool-sky / warm-ground hemisphere fill to a scene. */
export function addGoldenHourHemi(scene: THREE.Scene): THREE.HemisphereLight {
  const hemi = new THREE.HemisphereLight(
    GOLDEN_HOUR.skyColor, GOLDEN_HOUR.groundColor, GOLDEN_HOUR.fillIntensity,
  );
  scene.add(hemi);
  return hemi;
}

/** Build the shared warm DirectionalLight key. The caller sets `.position` (the
 *  World seats it at its shadow-follow offset; title/sandbox at `keyDir`) and,
 *  where shadows are wanted, opts the sun into casting — so this stays the single
 *  source of the key's COLOUR + INTENSITY without owning any scene's shadow rig. */
export function makeGoldenHourSun(): THREE.DirectionalLight {
  return new THREE.DirectionalLight(GOLDEN_HOUR.keyColor, GOLDEN_HOUR.keyIntensity);
}

/** Bake the shared vertical golden-hour sky gradient (Atmosphere.SKY_STOPS) onto a
 *  2×256 canvas texture — the SAME warm zenith→horizon ramp on every screen, so
 *  the title sky and the world sky are literally one gradient. */
export function bakeGoldenHourSky(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [at, col] of SKY_STOPS) g.addColorStop(at, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The golden-hour sky as a dome drawn behind everything: SKY_STOPS laid on the view
 * direction's elevation (zenith → horizon, and the haze below it), with a soft warm
 * glow toward the sun. The same dome stands behind the title and the world, so the
 * sky, the fog at the horizon and the light are one. It never moves with anything
 * (it is drawn at infinity) and costs one draw call.
 */
export function makeSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uRamp: { value: bakeGoldenHourSky() },
      uSunDir: { value: GOLDEN_HOUR.keyDir.clone().normalize() },
      uSun: { value: new THREE.Color(GOLDEN_HOUR.keyColor) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = p.xyww; // on the far plane: behind everything, never clipped
      }`,
    fragmentShader: `
      uniform sampler2D uRamp;
      uniform vec3 uSunDir;
      uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        // the warm bands hug the horizon; the blue only opens up well above it
        // (the haze holds for the first few degrees, where distant hills stand in it)
        float t = 1.0 - pow(clamp((up - 0.03) / 0.97, 0.0, 1.0), 0.6);
        vec3 col = texture2D(uRamp, vec2(0.5, 1.0 - t)).rgb;
        // the sun's warm glow hangs just above the horizon, so the horizon band itself is
        // the same haze all the way round (the fog it meets has no direction)
        float glow = pow(max(dot(d, uSunDir), 0.0), 5.0) * smoothstep(0.0, 0.12, up);
        col += uSun * glow * 0.22 * (1.0 - up * 0.6);
        // golden hour: a broad warm light over the tree line on the sun's side of the sky,
        // fading round to the far side and up into the clear top (above the haze band, so
        // the horizon still meets the direction-less fog seamlessly)
        vec2 sunH = normalize(uSunDir.xz);
        float side = max(dot(normalize(d.xz + vec2(1e-5)), sunH), 0.0);
        float warm = side * side * smoothstep(0.02, 0.14, up) * (1.0 - smoothstep(0.12, 0.6, up));
        col = mix(col, col * vec3(1.06, 0.97, 0.84) + uSun * 0.07, warm * 0.85);
        gl_FragColor = vec4(col, 1.0);
        // the horizon band goes through the tone curve (GOLDEN_HOUR.fogColor is its result,
        // so the fogged world dissolves into it); higher up the sky keeps its own colours
        #include <tonemapping_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, col, smoothstep(0.03, 0.3, up));
        #include <colorspace_fragment>
      }`,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -1000; // first: everything else draws over it
  dome.raycast = () => {};  // the sky is never clicked
  return dome;
}
