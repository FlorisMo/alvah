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
import { SKY_STOPS } from './Atmosphere';

/** The single golden-hour rig every 3D scene reads from (RUN-C-DIRECTION §2.1). */
export const GOLDEN_HOUR = {
  /** Warm directional KEY — a low golden sun in the #FFCF8F→#FFB870 band (§2.1). */
  keyColor: 0xffc588,
  keyIntensity: 1.7,
  /** Low, raking key direction (screen-left, camera looks down −z). Matches the
   *  World's shadow-follow offset so the hero shadow rakes the same way the light
   *  reads on every other screen. */
  keyDir: new THREE.Vector3(-9, 7, 4),
  /** HemisphereLight FILL — COOL sky bounce over WARM ground bounce (§2.1): warm
   *  highlights, cool shadows, the shared shading signature of the whole cast. */
  skyColor: 0xa8c4e8,
  groundColor: 0x7a6347,
  fillIntensity: 1.0,
  /** Warm horizon fog colour — the last SKY_STOPS band, so fog dissolves into the
   *  sky instead of greying it. Ranges stay per-scene (each clearing is a
   *  different size); the COLOUR is shared so the palette can never diverge. */
  fogColor: '#e9b27f',
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
