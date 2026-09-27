/**
 * Atmosphere.ts — W4.6 "Lucht + adem" (sky + breath), pure & THREE-free.
 *
 * The world gains four ambient touches that make the sky feel alive without a
 * day cycle and without breaking the draw-call budget or the motion-comfort law:
 *
 *   1. a RICHER golden-hour gradient (`SKY_STOPS` — more colour bands than the
 *      old three-stop ramp), baked once onto the sky canvas;
 *   2. DRIFTING cloud shadows — a soft cloud-alpha plane multiply-darkening the
 *      ground, its texture offset scrolled by `cloudOffset(t)`;
 *   3. a gentle WIND wave on the tall grasses (marram + reed), each blade tilted
 *      by `windSway(t, phase)`;
 *   4. a BIRD FLYOVER — one high bird crossing the sky on `FLYOVER_PERIOD` (~12 s)
 *      via `flyoverAt(t)`, with a calm pause between passes.
 *
 * ALL of this is SECONDARY motion (comfort research §C): the World advances an
 * atmosphere clock ONLY when reduced-motion is off, so passing a frozen `t`
 * freezes every effect (clouds stop, grass stills, the bird parks). The math is
 * pure here so the unit test pins the freeze + the ranges + the ~12 s period with
 * no browser. Everything is deterministic — no Math.random / Date.now.
 */

/** The golden-hour sky from the zenith (0) down to the horizon (1): a pale, cool
 *  blue overhead warming through cream and gold into the peach haze the fog is made
 *  of, so distant hills and trees dissolve into the sky exactly at the horizon.
 *  `[position 0..1, css colour]`. Lighting.makeSkyDome maps it onto the view's
 *  ELEVATION (not the screen), so the horizon colour always sits at the horizon. */
export const SKY_STOPS: readonly [number, string][] = [
  [0.0, '#96b3d9'], // pale evening blue overhead
  [0.3, '#c6d2de'],
  [0.55, '#eedfc8'], // cream
  [0.75, '#f6d8ae'], // gold
  [0.9, '#f6d2a2'],
  [1.0, '#f3cc9c'], // the bright horizon haze (the fog is this through the tone curve: Lighting.GOLDEN_HOUR.fogColor)
];

/**
 * The colour the renderer draws for an sRGB `hex` put through three.js's ACES filmic tone
 * curve at `exposure` (the same maths as its tonemapping_fragment), back as sRGB hex. The
 * sky dome's horizon band is tone mapped but three mixes fog in AFTER the tone curve, so
 * the fog must BE this colour to meet the sky seamlessly (a fog of the raw haze drew a
 * visible orange band under a cream horizon: the "end of the plate" seen from the
 * helicopter, breaker B9). Pure.
 */
export function toneMappedHex(hex: string, exposure: number): string {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * (exposure / 0.6);
  });
  // ACESInputMat · v (three's column-major mat3, transposed from the ACES source)
  const a = [
    0.59719 * lin[0] + 0.35458 * lin[1] + 0.04823 * lin[2],
    0.076 * lin[0] + 0.90834 * lin[1] + 0.01566 * lin[2],
    0.0284 * lin[0] + 0.13383 * lin[1] + 0.83777 * lin[2],
  ].map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)); // RRT + ODT fit
  const o = [
    1.60475 * a[0] - 0.53108 * a[1] - 0.07367 * a[2],
    -0.10208 * a[0] + 1.10813 * a[1] - 0.00605 * a[2],
    -0.00327 * a[0] - 0.07276 * a[1] + 1.07602 * a[2],
  ];
  return '#' + o.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  }).join('');
}

/** Cloud-shadow drift speed, in texture-uv units per second (slow, calm). */
export const CLOUD_DRIFT = { x: 0.0042, y: 0.0016 } as const;

/** Seconds for one bird to cross the sky (the "~12 s vogel-overvlucht"). */
export const FLYOVER_PERIOD = 12;
/** Fraction of the period the bird is on its crossing arc; the rest is a calm
 *  gap (the bird is parked off-view), so a bird passes ~every 12 s rather than
 *  looping edge-to-edge without pause. */
export const FLYOVER_VISIBLE = 0.62;

const WIND_AMP = 0.09;  // primary sway (radians) — a gentle lean, never a thrash
const WIND_AMP2 = 0.03; // faster secondary flutter

/**
 * Cloud-shadow texture offset at absolute atmosphere time `t` (seconds). Returns
 * uv in [0,1) (wrapped), scrolled by `CLOUD_DRIFT`. A frozen `t` → a fixed offset
 * (reduced-motion stops the drift).
 */
export function cloudOffset(t: number): { x: number; y: number } {
  const wrap = (v: number): number => ((v % 1) + 1) % 1;
  return { x: wrap(t * CLOUD_DRIFT.x), y: wrap(t * CLOUD_DRIFT.y) };
}

/**
 * Wind sway angle (radians) for a blade of vegetation at absolute time `t` and a
 * per-blade `phase` (so a field desyncs). Two summed sines — a slow lean plus a
 * faster flutter — bounded by `WIND_AMP + WIND_AMP2`. A frozen `t` → a fixed
 * angle (reduced-motion stills the grass).
 */
export function windSway(t: number, phase: number): number {
  return Math.sin(t * 1.05 + phase) * WIND_AMP + Math.sin(t * 2.4 + phase * 1.7) * WIND_AMP2;
}

export interface Flyover {
  x: number;
  y: number;
  z: number;
  /** Heading (rad) for the bird group's yaw — it flies toward +x. */
  facing: number;
  /** True while on its crossing arc; false during the calm gap (park off-view). */
  visible: boolean;
  /** Progress along the crossing, 0..1 (for the wing-beat phase if wanted). */
  progress: number;
}

/**
 * One high bird crossing the sky, west→east, on `FLYOVER_PERIOD`. It sails a
 * shallow arc (rises a touch mid-cross) high above the play area, then rests
 * off-view for the remainder of the cycle. A frozen `t` → a fixed pose (the bird
 * parks under reduced-motion). Pure.
 */
export function flyoverAt(t: number): Flyover {
  const cyc = ((t % FLYOVER_PERIOD) + FLYOVER_PERIOD) % FLYOVER_PERIOD;
  const raw = cyc / FLYOVER_PERIOD; // 0..1 over the whole cycle
  const visible = raw < FLYOVER_VISIBLE;
  const p = visible ? raw / FLYOVER_VISIBLE : 1; // 0..1 across the arc while visible
  const arc = Math.sin(p * Math.PI);             // 0 at edges, 1 mid-cross
  return {
    x: -150 + p * 300,        // cross the whole width, west → east
    y: 30 + arc * 5,          // high, with a gentle mid-cross rise
    z: -48 - arc * 8,         // arc a little deeper into the scene mid-cross
    facing: Math.PI / 2,      // group forward (+z) yawed to head +x
    visible,
    progress: p,
  };
}
