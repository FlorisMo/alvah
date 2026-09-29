/**
 * Daylight.ts — the time of day an adventure may turn (run 6, design run6-missions §4.3),
 * pure and THREE-free so the unit test pins it.
 *
 * The world stands in ONE light: the golden hour (Lighting.GOLDEN_HOUR). The wildcamera
 * mission lets the day turn into night and back while the camera trap watches: `k` = 1
 * is exactly today's golden hour, `k` = 0 a calm, readable blue moonlit night — never
 * pitch black, every animal still readable (a cool bright sky fill over a dark warm
 * ground, a pale moon key from the sun's own direction, so no shadow ever jumps). Every
 * value in between is a straight mix, crossfaded over ~2 s (`DaylightFade`), a cut under
 * reduced motion. World/Sky.ts applies it to the hemisphere fill, the key light, the fog,
 * the background and the night dome (stars and a moon, drawn over the golden dome with
 * `night` as its opacity).
 */

import { toneMappedHex } from './Atmosphere.ts';

/** The lights of one time of day (css hex colours, intensities). */
export interface LightSet {
  /** the fog and the background: the horizon band as the sky dome draws it */
  fog: string;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  /** the key light: the low sun, or the moon */
  key: string;
  keyI: number;
}

/** The night sky from the zenith (0) to the horizon (1): deep blue overhead, a soft
 *  lighter blue haze at the horizon, so the tree line stands dark against it. */
export const NIGHT_STOPS: readonly [number, string][] = [
  [0.0, '#101b36'],
  [0.35, '#1b2b50'],
  [0.7, '#2c416d'],
  [1.0, '#3d5584'],
];

/** Where the moon hangs (a unit-ish direction: south, a third of the way up), so it is
 *  in the sky of a view that looks south into the wood. */
export const MOON_DIR = { x: 0.18, y: 0.42, z: -0.89 } as const;

/** The night's lights, the fog matched to the night dome's horizon through the same tone
 *  curve the golden hour uses (`exposure`: the renderer's). */
export function nightSet(exposure: number): LightSet {
  return {
    fog: toneMappedHex(NIGHT_STOPS[NIGHT_STOPS.length - 1][1], exposure),
    hemiSky: '#8ea8e6',   // a cool, bright moonlit sky fill: the animals stay readable
    hemiGround: '#2c2a36', // a dark ground bounce
    hemiI: 1.05,
    key: '#b9c9f4',       // a pale moon
    keyI: 0.95,
  };
}

/** Mix two css hex colours (sRGB, straight). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** The lights at daylight `k` (1 = `day` exactly, 0 = `night`), and how much of the
 *  night dome shows (`night`, 0..1). */
export function lightAt(day: LightSet, night: LightSet, k: number): LightSet & { night: number } {
  const d = Math.min(1, Math.max(0, k));
  if (d >= 1) return { ...day, night: 0 };
  if (d <= 0) return { ...night, night: 1 };
  const t = 1 - d; // how far into the night
  return {
    fog: mixHex(day.fog, night.fog, t),
    hemiSky: mixHex(day.hemiSky, night.hemiSky, t),
    hemiGround: mixHex(day.hemiGround, night.hemiGround, t),
    hemiI: day.hemiI + (night.hemiI - day.hemiI) * t,
    key: mixHex(day.key, night.key, t),
    keyI: day.keyI + (night.keyI - day.keyI) * t,
    night: t,
  };
}

/** The relative luminance of a css hex colour (0..1, sRGB → linear). */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How much light falls on a thing standing in `s` (the sky fill from above + the key):
 *  a rough, comparable measure of "can a child still see the animal". */
export function lightOn(s: LightSet): number {
  return luminance(s.hemiSky) * s.hemiI + luminance(s.key) * s.keyI;
}

/** How long (s) a turn of the day takes: calm, never a snap. */
export const DAYLIGHT_FADE_S = 2;

/**
 * The daylight crossfade: `set(target)` starts an eased move from where it is now to
 * `target` over `seconds`; `step(dt, reduced)` advances it (under reduced motion it
 * arrives at once: a cut) and returns whether the value changed this frame.
 */
export class DaylightFade {
  value = 1;
  private from = 1;
  private to = 1;
  private t = 1;
  private dur = DAYLIGHT_FADE_S;

  get target(): number { return this.to; }

  set(target: number, seconds = DAYLIGHT_FADE_S): void {
    const k = Math.min(1, Math.max(0, target));
    if (k === this.to && this.t >= 1) return;
    this.from = this.value;
    this.to = k;
    this.t = 0;
    this.dur = Math.max(0.001, seconds);
  }

  /** At once (a new world, a stopped mission under reduced motion). */
  cut(target: number): void {
    const k = Math.min(1, Math.max(0, target));
    this.value = this.from = this.to = k;
    this.t = 1;
  }

  step(dt: number, reduced: boolean): boolean {
    if (this.t >= 1) return false;
    if (reduced) { this.cut(this.to); return true; }
    this.t = Math.min(1, this.t + dt / this.dur);
    const e = this.t * this.t * (3 - 2 * this.t);
    this.value = this.from + (this.to - this.from) * e;
    return true;
  }
}
