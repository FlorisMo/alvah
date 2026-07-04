/**
 * MissionIcon.ts — one flat, hand-drawn pictogram per mission card (RUN-3 F-23).
 *
 * The board/lodge used to be ten visually identical text-only cards, which asks a
 * dyslexic 8-year-old to READ ten times to pick "the frog one". This gives every
 * card a distinct silhouette on a biome-tinted disc so it reads at a glance while
 * the title text (and its read-aloud on tap → briefing) stays exactly as it was.
 *
 * In-repo only: inline SVG in the existing palette, no new deps, no asset pipeline
 * (see AUDIT-FINDINGS F-23 contract check). The disc is decorative (aria-hidden) —
 * the card button's title text carries the accessible name, so nothing is spoken
 * twice. Each silhouette is keyed by the mission's animal, with two per-mission
 * overrides where the same animal (edelhert) recurs, so all ten stay distinct:
 *   ecoduct ("De oversteek") → a wildlife overpass · herstel ("De winterronde") → a snowflake.
 */
import type { Mission } from '../content/types';

/** Soft disc + darker "ink" per landschap, so the four biomes also scan by colour
 *  (F-23 endorses the optional per-biome tint). Values extend the calm palette from
 *  the biome accents in render3d/Biomes (heather / leaf / sand / ven-water). */
const BIOME_TINT: Record<string, { disc: string; ink: string }> = {
  heide: { disc: '#f1e7f4', ink: '#7a4f88' },
  bos: { disc: '#e9eddf', ink: '#3f5a2b' },
  stuifzand: { disc: '#f4ecd7', ink: '#8a7439' },
  ven: { disc: '#e3edf0', ink: '#40636f' },
};
const NEUTRAL_TINT = { disc: '#eef1e9', ink: '#2f6b46' };

/** Inner SVG (viewBox 0 0 64 64) per silhouette. `currentColor` = the biome ink,
 *  set on `.mc-icon` in missions.css, so the shape inherits the per-biome tone. */
const SIL: Record<string, string> = {
  // wildzwijn — chunky body, blunt snout, ear, four stubby legs (the frisling's parent)
  wildzwijn:
    '<ellipse cx="36" cy="33" rx="20" ry="13"/>' +
    '<path d="M20 28 q-14 1 -15 11 q0 5 5 6 q1 -7 11 -7 q7 0 9 -6 z"/>' +
    '<path d="M27 21 l-3 -9 l9 5 z"/>' +
    '<rect x="22" y="44" width="4.5" height="11" rx="1.5"/><rect x="32" y="45" width="4.5" height="11" rx="1.5"/>' +
    '<rect x="42" y="45" width="4.5" height="11" rx="1.5"/><rect x="50" y="44" width="4.5" height="11" rx="1.5"/>',
  // ree — slender fawn: two tall ears, thin legs, no antlers (distinct from the stag)
  ree:
    '<ellipse cx="30" cy="34" rx="15" ry="8.5"/>' +
    '<path d="M41 31 q5 -5 6 -14 l5 1 q-1 11 -7 18 z"/>' +
    '<ellipse cx="51" cy="15" rx="5" ry="6"/>' +
    '<path d="M48 10 l-3 -9 l6 5 z"/><path d="M55 10 l3 -9 l-6 5 z"/>' +
    '<rect x="20" y="41" width="3.4" height="15" rx="1.2"/><rect x="27" y="41" width="3.4" height="15" rx="1.2"/>' +
    '<rect x="35" y="41" width="3.4" height="15" rx="1.2"/><rect x="41" y="41" width="3.4" height="14" rx="1.2"/>',
  // edelhert — stag: branching antlers are the tell (distinct from the fawn's ears)
  edelhert:
    '<ellipse cx="28" cy="36" rx="15" ry="8.5"/>' +
    '<path d="M39 33 q5 -5 6 -14 l5 1 q-1 11 -7 18 z"/>' +
    '<ellipse cx="49" cy="17" rx="4.6" ry="6"/>' +
    '<g stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M46 12 q-3 -7 -1 -10"/><path d="M45 5 l-5 -1"/><path d="M45.5 8 l-4 2"/>' +
    '<path d="M52 12 q3 -7 1 -10"/><path d="M53 5 l5 -1"/><path d="M52.5 8 l4 2"/></g>' +
    '<rect x="18" y="44" width="3.4" height="14" rx="1.2"/><rect x="25" y="44" width="3.4" height="14" rx="1.2"/>' +
    '<rect x="33" y="44" width="3.4" height="14" rx="1.2"/><rect x="39" y="44" width="3.4" height="13" rx="1.2"/>',
  // das — low elongated body + pointed snout (badger crouch)
  das:
    '<path d="M9 41 q0 -13 15 -13 h14 q15 0 15 13 q0 7 -8 7 H17 q-8 0 -8 -7 z"/>' +
    '<path d="M11 35 q-9 1 -10 7 q3 4 10 3 z"/>' +
    '<circle cx="19" cy="25" r="3.2"/>' +
    '<rect x="18" y="47" width="4.5" height="8" rx="1.5"/><rect x="29" y="47" width="4.5" height="8" rx="1.5"/>' +
    '<rect x="40" y="47" width="4.5" height="8" rx="1.5"/>',
  // eekhoorn — the big curled bushy tail over the back is unmistakable
  eekhoorn:
    '<path d="M43 53 q23 -4 18 -28 q-3 -13 -15 -12 q11 5 9 17 q-2 15 -16 15 z"/>' +
    '<path d="M31 53 q-9 -3 -9 -18 q0 -14 13 -15 q11 -1 12 10 q2 13 -6 23 z"/>' +
    '<circle cx="30" cy="17" r="8"/>' +
    '<path d="M25 10 l-2 -8 l7 4 z"/>',
  // vos — pointed ears + long bushy tail
  vos:
    '<path d="M40 53 q21 3 18 -15 q-2 -7 -9 -6 q7 7 2 15 q-4 8 -13 6 z"/>' +
    '<path d="M23 53 q-6 -15 5 -25 l12 0 q8 12 4 25 z"/>' +
    '<path d="M21 26 l-4 -13 l11 6 z"/><path d="M43 26 l4 -13 l-11 6 z"/>' +
    '<path d="M19 24 q13 -9 26 0 q1 11 -13 15 q-14 -4 -13 -15 z"/>',
  // heikikker — front-facing frog: two domed eyes on a wide body + splayed haunches
  heikikker:
    '<ellipse cx="32" cy="42" rx="21" ry="13"/>' +
    '<ellipse cx="13" cy="45" rx="7" ry="10"/><ellipse cx="51" cy="45" rx="7" ry="10"/>' +
    '<circle cx="22" cy="25" r="9"/><circle cx="42" cy="25" r="9"/>',
  // nachtzwaluw — a bird in flight (two swept wings + a small body)
  nachtzwaluw:
    '<path d="M32 36 q-17 -19 -28 -9 q15 0 24 13 z"/>' +
    '<path d="M32 36 q17 -19 28 -9 q-15 0 -24 13 z"/>' +
    '<ellipse cx="32" cy="38" rx="4.2" ry="9"/>',
  // brug — the ecoduct: a green wildlife overpass with a couple of little trees on top
  brug:
    '<path d="M6 32 q26 -19 52 0 v20 h-9 v-16 a17 12 0 0 0 -34 0 v16 H6 z"/>' +
    '<circle cx="24" cy="19" r="5"/><rect x="23" y="18" width="2" height="9"/>' +
    '<circle cx="40" cy="19" r="5"/><rect x="39" y="18" width="2" height="9"/>',
  // sneeuw — a six-point snowflake for the winter round
  sneeuw:
    '<g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="32" y1="7" x2="32" y2="57"/><line x1="10" y1="19.5" x2="54" y2="44.5"/><line x1="54" y1="19.5" x2="10" y2="44.5"/>' +
    '<path d="M32 15 l-6 -5 M32 15 l6 -5"/><path d="M32 49 l-6 5 M32 49 l6 5"/>' +
    '<path d="M17 24 l-8 0 M17 24 l3 -7"/><path d="M47 40 l8 0 M47 40 l-3 7"/>' +
    '<path d="M47 24 l8 0 M47 24 l-3 -7"/><path d="M17 40 l-8 0 M17 40 l3 7"/></g>',
  // fallback — a simple leaf, so any future mission still gets a real pictogram
  _leaf: '<path d="M32 8 q22 6 20 30 q-2 20 -20 18 q-18 2 -20 -18 q-2 -24 20 -30 z"/><path d="M32 14 v34" stroke="currentColor" stroke-width="2.4" fill="none"/>',
};

/** Per-mission override where the same animal recurs, so all ten cards stay distinct. */
const OVERRIDE: Record<string, string> = { ecoduct: 'brug', herstel: 'sneeuw' };

/**
 * The card pictogram: a biome-tinted disc holding this mission's silhouette.
 * Decorative (aria-hidden) — the card's title text already names the mission.
 */
export function missionIcon(m: Mission): string {
  const key = OVERRIDE[m.id] ?? m.dier ?? '';
  const sil = SIL[key] ?? SIL._leaf;
  const tint = BIOME_TINT[m.landschap] ?? NEUTRAL_TINT;
  return (
    `<span class="mc-icon" aria-hidden="true" style="--disc:${tint.disc};--ink:${tint.ink}">` +
    `<svg viewBox="0 0 64 64" fill="currentColor">${sil}</svg>` +
    `</span>`
  );
}
