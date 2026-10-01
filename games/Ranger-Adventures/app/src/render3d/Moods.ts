/**
 * Moods.ts — the calm times of day and weather the world stands in (run 7, design
 * `state/foundation/design.md` §4.5 and §6.2). Pure: no THREE, no DOM (like Daylight.ts).
 *
 * Every visit the world may stand in a different light: the golden hour (today's look, the
 * first visit of every save), a misty morning, a bright day, an overcast afternoon or a soft
 * dusk. Never dark, stormy or scary: no rain, no thunder, no flicker; every mood keeps at
 * least 0.85× the golden hour's light on a standing animal (`lightOn`), the fog never closer
 * than 22 m (a framed beat's targets are ≤ 15 m away), and every animal gets a fill of its
 * own (`fill`/`fillI`, AnimalDress.ts) so its side away from the sun never goes black.
 *
 * A mood is a LightSet (the hemisphere fill, the key, the fog colour, the animal fill), the
 * sky's colour stops (zenith → horizon; the fog colour IS the horizon stop through the tone
 * curve, so the fogged world meets the sky seamlessly), the fog's range, the key's place
 * (static per mood: it only changes with a cut, never as a moving shadow in view), the sun's
 * glow on the dome, the shadow's strength and how much the grass sways. world/Sky.ts shows
 * it and crossfades between two; `lightAt(mood, night, k)` turns any of them into the
 * wildcamera's night.
 */

import type { Play } from '../core/play';
import { EXPOSURE, SKY_STOPS, toneMappedHex } from './Atmosphere.ts';
import { lightAt, lightOn, mixHex, type LightSet } from './Daylight.ts';

/** The golden hour (today's look), a misty morning, a bright day, an overcast afternoon, a
 *  soft dusk. Never dark, stormy or scary. */
export type MoodId = 'gouden-uur' | 'ochtendnevel' | 'zonnig' | 'bewolkt' | 'schemer';

export const MOOD_IDS: readonly MoodId[] = ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt', 'schemer'];

/** The mood a fresh save stands in (its first visit): the game as it always looked. */
export const DEFAULT_MOOD: MoodId = 'gouden-uur';

/** Is this a mood id (a save or a URL may carry anything)? */
export function isMood(x: unknown): x is MoodId {
  return typeof x === 'string' && (MOOD_IDS as readonly string[]).includes(x);
}

/** One mood, as world/Sky.ts shows it. */
export interface Mood {
  id: MoodId;
  /** the hemisphere fill, the key, the fog colour, the animal fill */
  light: LightSet & { fill: string; fillI: number };
  /** the sky from the zenith (0) to the horizon (1) */
  sky: readonly [number, string][];
  /** the fog's range (m): nothing nearer than `fogNear` is hazed */
  fogNear: number;
  fogFar: number;
  /** where the key light stands relative to what it lights (world m): its direction is the
   *  sun's. Static per mood; it changes only with a cut. */
  keyAt: { x: number; y: number; z: number };
  /** how strongly the sun glows on the dome, and the broad warm light on its side (0..1) */
  glow: number;
  warm: number;
  /** how dark the ranger's and the props' shadows are (1 = full) */
  shadow: number;
  /** how much the grass sways (× the golden hour's) */
  wind: number;
}

/** The golden hour's key light offset (Lighting.GOLDEN_HOUR.keyDir, the World's shadow
 *  follow offset): low, raking in from screen-left. */
const GOLDEN_KEY = { x: -9, y: 7, z: 4 } as const;

/** The key's offset for a sun `elevation` degrees up, from the golden hour's side (the same
 *  azimuth: every mood lights the world from the same side, only higher or lower). Its
 *  height stays the golden hour's 7 m, so the shadow camera's range holds. Pure. */
export function keyAtElevation(elevationDeg: number): { x: number; y: number; z: number } {
  const h = Math.hypot(GOLDEN_KEY.x, GOLDEN_KEY.z);
  const reach = GOLDEN_KEY.y / Math.tan((elevationDeg * Math.PI) / 180);
  return { x: (GOLDEN_KEY.x / h) * reach, y: GOLDEN_KEY.y, z: (GOLDEN_KEY.z / h) * reach };
}

/** The sun's elevation (degrees) for a key offset. Pure. */
export function keyElevation(k: { x: number; y: number; z: number }): number {
  return (Math.atan2(k.y, Math.hypot(k.x, k.z)) * 180) / Math.PI;
}

const fogOf = (sky: readonly [number, string][]): string => toneMappedHex(sky[sky.length - 1][1], EXPOSURE);

function mood(m: Omit<Mood, 'light'> & { light: Omit<Mood['light'], 'fog'> }): Mood {
  return { ...m, light: { ...m.light, fog: fogOf(m.sky) } };
}

/** The five moods. Values chosen by looking at the world in each (moods.spec), and pinned
 *  by Moods.test.ts: never dark, never fog nearer than 22 m. */
export const MOODS: Readonly<Record<MoodId, Mood>> = {
  // the golden hour: EXACTLY today's (Lighting.GOLDEN_HOUR, Atmosphere.SKY_STOPS, fog 22/90)
  'gouden-uur': mood({
    id: 'gouden-uur',
    light: { hemiSky: '#b4c6e0', hemiGround: '#8a6b4a', hemiI: 0.85, key: '#ffc080', keyI: 2.1, fill: '#fff0dc', fillI: 1.3 },
    sky: SKY_STOPS, fogNear: 22, fogFar: 90, keyAt: { ...GOLDEN_KEY }, glow: 0.22, warm: 0.85, shadow: 1, wind: 1,
  }),
  // a misty morning: a pale gold low sun, a brighter neutral fill, the mist close (the far
  // wood a soft cream-grey wall), a pale cream-grey sky; still air
  ochtendnevel: mood({
    id: 'ochtendnevel',
    light: { hemiSky: '#d2dae2', hemiGround: '#9a8c76', hemiI: 1.15, key: '#ffe0ae', keyI: 1.45, fill: '#f6f1e8', fillI: 1.3 },
    sky: [[0, '#a9b9cb'], [0.3, '#c6ced5'], [0.55, '#dad9d2'], [0.75, '#e3ddd0'], [0.9, '#e8e0cf'], [1, '#e9e0cd']],
    fogNear: 24, fogFar: 62, keyAt: keyAtElevation(24), glow: 0.16, warm: 0.35, shadow: 0.7, wind: 1,
  }),
  // a bright day: a white sun higher up, a clear blue sky, a long clear view, a breeze
  zonnig: mood({
    id: 'zonnig',
    light: { hemiSky: '#a8c6ee', hemiGround: '#8c7656', hemiI: 0.9, key: '#fff4e2', keyI: 2.0, fill: '#f2f4fc', fillI: 1.15 },
    sky: [[0, '#5f93d6'], [0.3, '#84ade0'], [0.55, '#a7c5e8'], [0.75, '#c2d6ea'], [0.9, '#d3e0ea'], [1, '#dae4ea']],
    fogNear: 30, fogFar: 110, keyAt: keyAtElevation(52), glow: 0.12, warm: 0, shadow: 1, wind: 1.25,
  }),
  // overcast and soft: a weak key with faint shadows, a strong even fill, a soft grey-white
  // sky, more breeze in the grass
  bewolkt: mood({
    id: 'bewolkt',
    light: { hemiSky: '#d8dde2', hemiGround: '#8e8676', hemiI: 1.55, key: '#e9e7e2', keyI: 0.8, fill: '#eef0f2', fillI: 1.25 },
    sky: [[0, '#aab3bc'], [0.3, '#bec5cb'], [0.55, '#ced1d3'], [0.75, '#d7d8d7'], [0.9, '#dcdbd7'], [1, '#dedcd7']],
    fogNear: 24, fogFar: 80, keyAt: keyAtElevation(45), glow: 0.03, warm: 0, shadow: 0.4, wind: 1.4,
  }),
  // a soft dusk: a low rose-amber sun, a cool lilac fill, a rose-to-blue sky, a stronger
  // animal fill (the low sun lights little of a coat)
  schemer: mood({
    id: 'schemer',
    light: { hemiSky: '#aaa8dc', hemiGround: '#735e5e', hemiI: 1.15, key: '#ffae86', keyI: 2.0, fill: '#ecdcf2', fillI: 1.7 },
    sky: [[0, '#5d76b4'], [0.3, '#8b8ec6'], [0.55, '#bf9fc1'], [0.75, '#e5aeac'], [0.9, '#f1b797'], [1, '#f3bb94']],
    fogNear: 22, fogFar: 75, keyAt: keyAtElevation(14), glow: 0.3, warm: 0.9, shadow: 0.85, wind: 1,
  }),
};

/** The look between two moods at `t` (0 = `a`, 1 = `b`): the lights, the fog, the animal
 *  fill, the wind and the shadow mixed straight; the key's place is NOT mixed (it changes
 *  only with a cut: world/Sky.ts keeps it). Pure. */
export function mixMood(a: Mood, b: Mood, t: number): Omit<Mood, 'id' | 'sky' | 'keyAt'> {
  const k = Math.min(1, Math.max(0, t));
  const n = (x: number, y: number): number => x + (y - x) * k;
  return {
    light: {
      fog: mixHex(a.light.fog, b.light.fog, k),
      hemiSky: mixHex(a.light.hemiSky, b.light.hemiSky, k),
      hemiGround: mixHex(a.light.hemiGround, b.light.hemiGround, k),
      hemiI: n(a.light.hemiI, b.light.hemiI),
      key: mixHex(a.light.key, b.light.key, k),
      keyI: n(a.light.keyI, b.light.keyI),
      fill: mixHex(a.light.fill, b.light.fill, k),
      fillI: n(a.light.fillI, b.light.fillI),
    },
    fogNear: n(a.fogNear, b.fogNear),
    fogFar: n(a.fogFar, b.fogFar),
    glow: n(a.glow, b.glow),
    warm: n(a.warm, b.warm),
    shadow: n(a.shadow, b.shadow),
    wind: n(a.wind, b.wind),
  };
}

/** The light on a standing animal in a mood, at daylight `k` toward `night` (the
 *  wildcamera's): `lightAt` over the mood's own set. Pure. */
export function moodLightAt(id: MoodId, night: LightSet, k: number): LightSet & { night: number } {
  return lightAt(MOODS[id].light, night, k);
}

/** A mood's light on a standing animal, as a share of the golden hour's (≥ 0.85: never dark). */
export function lightShare(id: MoodId): number {
  return lightOn(MOODS[id].light) / lightOn(MOODS['gouden-uur'].light);
}

/* ---------------------------------------------------- which mood, when ---- */

/** What a home asks of the light (Adventure.moods): only these moods, and/or a new one
 *  each play. */
export interface MoodRule { allow?: readonly MoodId[]; perPlay?: boolean }

/**
 * This play's mood: the session's, unless the home restricts it (`allow` without the
 * session's mood: drawn from `allow`) or asks a new one each play (`perPlay`: drawn from
 * `allow`, else every mood, never the home's `last` when there is another to draw).
 * Drawn from the play's own fork ('mood'), so it never moves another decision.
 */
export function playMood(session: MoodId, rule: MoodRule | undefined, play: Play, last?: MoodId | null): MoodId {
  const allow = rule?.allow?.length ? rule.allow : null;
  if (rule?.perPlay) {
    const from = allow ?? MOOD_IDS;
    const fresh = last ? from.filter((m) => m !== last) : from;
    return play.fork('mood').pick(fresh.length ? fresh : from);
  }
  if (allow && !allow.includes(session)) return play.fork('mood').pick(allow);
  return session;
}

/**
 * The session's mood (design §4.5), drawn once per page load before the title shows: a
 * forced one (`?mood=<id>`) wins; the first session of a save is the golden hour (every
 * fresh-save test and the first visit see today's look); every later one is drawn from the
 * session's seed among the five, never the last session's. Pure.
 */
export function sessionMood(o: { sessions: number; last: MoodId | null; seed: number; forced?: string | null }): MoodId {
  if (isMood(o.forced)) return o.forced;
  if (o.sessions <= 0) return DEFAULT_MOOD;
  const from = MOOD_IDS.filter((m) => m !== o.last);
  // a seed of its own (not the plays' stream): murmur-style mix of the session seed
  let h = (o.seed ^ 0x6d6f6f64) >>> 0; // 'mood'
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return from[h % from.length];
}

/** The mood a home's last play stood in, read from the beat history (each logged beat carries
 *  its play's variant, 'mood:<id>' among it), or null. Pure. */
export function lastMoodAt(history: readonly { m: string; va?: string }[], missionId: string): MoodId | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const b = history[i];
    if (b.m !== missionId || !b.va) continue;
    const hit = /(?:^|,)mood:([a-z-]+)/.exec(b.va);
    if (hit && isMood(hit[1])) return hit[1];
  }
  return null;
}

/** `?mood=<id>` in a URL's search part → the id, else null. Pure. */
export function parseMoodParam(search: string): MoodId | null {
  const raw = new URLSearchParams(search).get('mood');
  return isMood(raw) ? raw : null;
}
