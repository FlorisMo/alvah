/**
 * beats/aim-pics.ts — the pictures on the aim card (beats/aim.ts): drawn, never emoji
 * (an emoji draws differently on every system, and the shared screens use drawn icons,
 * ui/icons.ts). The animals are flat side-on drawings in the style of the 2D floor's roe
 * (render2d/animalIcon `roeSvg`, which the card keeps for the roe): each one real enough
 * to tell apart at a glance — the stag's antlers, the badger's striped white face, the
 * boar's bristly back and tusk, the nightjar's long tail. The sun and the moon of the
 * day/night rule are drawn like the game's line icons (24 grid, round 2 px stroke, in
 * the colour of the words beside them). Pure strings; aria-hidden (the words carry the
 * meaning, and are what is read aloud).
 */

import { animalIcon } from '../../../render2d/animalIcon';

const SVG = (body: string): string => `<svg class="ai-svg" viewBox="0 0 64 64" width="1.15em" height="1.15em" aria-hidden="true">${body}</svg>`;
const STAG = SVG(
  '<g fill="#6e4226"><rect x="17" y="38" width="3" height="19" rx="1.3"/><rect x="22.5" y="38" width="3" height="18" rx="1.3"/>' +
  '<rect x="37" y="38" width="3" height="19" rx="1.3"/><rect x="42.5" y="38" width="3" height="18" rx="1.3"/></g>' +
  '<ellipse cx="31" cy="33" rx="17" ry="9" fill="#9a5f33"/>' +
  '<path d="M40 31 L45 17 L52 18.5 L48 36 Z" fill="#9a5f33"/>' +
  '<path d="M41 32 L45 19 L48 20 L45 34 Z" fill="#6e4226" opacity=".55"/>' +
  '<ellipse cx="52" cy="19.5" rx="6.8" ry="4.3" fill="#9a5f33"/>' +
  '<path d="M46.5 16.5 Q44.5 13 47.5 12.5 Q48.5 14.5 48.5 16.5 Z" fill="#7a4a2a"/>' +
  '<g fill="none" stroke="#5a3a22" stroke-width="2.2" stroke-linecap="round">' +
  '<path d="M50 16 C49 11 46 7 42 4"/><path d="M47.3 10 L51 6.5"/><path d="M44.5 6.4 L42 8.5"/>' +
  '<path d="M53 16 C54.5 11 57.5 8 61 6"/><path d="M56.6 10 L60.5 11"/></g>' +
  '<ellipse cx="14.5" cy="30.5" rx="3.4" ry="4.2" fill="#e8d6b4"/>' +
  '<circle cx="52.4" cy="18.2" r="1.3" fill="#2a1a10"/><circle cx="58.2" cy="21" r="1.4" fill="#2a1a10"/>');
const BADGER = SVG(
  '<g fill="#2b2a28"><rect x="15" y="40" width="4.4" height="10" rx="1.8"/><rect x="21.5" y="41" width="4.4" height="9" rx="1.8"/>' +
  '<rect x="33" y="41" width="4.4" height="9" rx="1.8"/><rect x="39.5" y="40" width="4.4" height="10" rx="1.8"/></g>' +
  '<path d="M7 36 L2.5 34.5 L6 39.5 Z" fill="#5f5c55"/>' +
  '<ellipse cx="26" cy="35.5" rx="20" ry="9" fill="#7c7970"/>' +
  '<path d="M9 31 Q26 25 42 30" fill="none" stroke="#5f5c55" stroke-width="3" stroke-linecap="round"/>' +
  '<path d="M40 28 Q52 28.5 61 38 Q53 45 40 44 Z" fill="#f6f3ea" stroke="#4a4842" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M40.5 32 Q51 32.5 59.5 38 L57.8 40.4 Q49.5 37 40.5 38.5 Z" fill="#1f1f22"/>' +
  '<path d="M41 26.2 Q43.5 24 45.5 26.8 Q43.5 28.4 41 27.8 Z" fill="#1f1f22"/>' +
  '<circle cx="60.3" cy="39" r="1.7" fill="#1c1c1e"/>');
const BOAR = SVG(
  '<g fill="#3b2c21"><rect x="17" y="39" width="3.4" height="15" rx="1.4"/><rect x="23" y="40" width="3.4" height="14" rx="1.4"/>' +
  '<rect x="36" y="40" width="3.4" height="14" rx="1.4"/><rect x="41.5" y="39" width="3.4" height="15" rx="1.4"/></g>' +
  '<path d="M9 31 Q6 28 5.5 33" fill="none" stroke="#3b2c21" stroke-width="1.6" stroke-linecap="round"/>' +
  '<path d="M10 34 Q10 23 26 22 Q37 21.5 43 27 L44 44 Q30 46 17 44 Q10 42 10 34 Z" fill="#5c4533"/>' +
  '<path d="M14 26 L17 22.5 L19 25.5 L22 21.5 L24 24.5 L27 21 L29 24 L32 21 L34 24.5 L37 22.5 L38 26 Z" fill="#3b2c21"/>' +
  '<path d="M41 26 L55 33 Q58 35 58 38 L57 41 L44 43 Z" fill="#5c4533"/>' +
  '<path d="M42 25 L45 19.5 L47.5 26 Z" fill="#3b2c21"/>' +
  '<ellipse cx="57.3" cy="38.3" rx="2.2" ry="3" fill="#2a1e16"/>' +
  '<path d="M53.5 40 Q55 43 52.5 44.5" fill="none" stroke="#f1ead8" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="49" cy="31" r="1.3" fill="#140e0a"/>');
const NIGHTJAR = SVG(
  '<path d="M20 36 L3 41 L4.5 45 L21 41 Z" fill="#6f5c46"/>' +
  '<path d="M6 41.5 L9 40.7 L9.6 43.3 L6.6 44.1 Z" fill="#f2eee4"/>' +
  '<ellipse cx="31" cy="37" rx="14" ry="7.2" fill="#8c7659"/>' +
  '<path d="M19 35 Q30 28 42 32 Q34 38 19 38.5 Z" fill="#5e4c38"/>' +
  '<path d="M24 34 L27 33 M30 32.6 L33 32.4 M36 32.8 L38.5 33.3" stroke="#c9b894" stroke-width="1.3" stroke-linecap="round"/>' +
  '<circle cx="44" cy="32" r="6.4" fill="#8c7659"/>' +
  '<path d="M49.5 32.5 L53.5 33.6 L49.5 34.6 Z" fill="#3a2e22"/>' +
  '<circle cx="45.5" cy="30.6" r="1.7" fill="#1a130c"/>' +
  '<path d="M26 44 L25 48 M34 44 L35 48" stroke="#5e4c38" stroke-width="1.6" stroke-linecap="round"/>');
/** Run 7: a fox side-on (the wildcamera's night visitor), in the badger's style: its
 *  orange-red coat, the long bushy tail with a white tip, black stockings, a pointed
 *  snout and two pointed ears. */
const FOX = SVG(
  '<g fill="#2b2420"><rect x="22" y="40" width="3.2" height="12" rx="1.4"/><rect x="27.5" y="41" width="3.2" height="11" rx="1.4"/>' +
  '<rect x="38" y="41" width="3.2" height="11" rx="1.4"/><rect x="43.5" y="40" width="3.2" height="12" rx="1.4"/></g>' +
  '<path d="M21 35 Q8 34 3 42 Q10 47 21 41 Z" fill="#cf6a2a"/>' +
  '<path d="M6.5 40.2 Q3.2 41.4 3 42 Q5.4 44.6 8.6 44.2 Z" fill="#f6f1e6"/>' +
  '<ellipse cx="34" cy="36" rx="14.5" ry="7.2" fill="#d9772f"/>' +
  '<path d="M41 39 Q46 44 50 39 Z" fill="#f6f1e6"/>' +
  '<path d="M44 31 Q50 25 56 29 L62 33.5 Q57 36.5 51 36 Q46 36.5 44 34 Z" fill="#d9772f"/>' +
  '<path d="M55 33.2 L62 33.5 Q58 36.2 53 35.6 Z" fill="#f6f1e6"/>' +
  '<path d="M48 27.5 L49.5 19.5 L53.5 26 Z M52.5 26.5 L55.5 19.5 L57 27.5 Z" fill="#c25d22"/>' +
  '<path d="M49.5 22 L50.2 25.6 L51.8 25.8 Z" fill="#2b2420"/>' +
  '<circle cx="62.2" cy="33.4" r="1.3" fill="#1c1714"/><circle cx="54.6" cy="30" r="1.2" fill="#1c1714"/>');
/** Run 7 (stille-zand): a red squirrel side-on, sitting up: its rust-red coat, the big bushy
 *  tail curled up over its back, the ear tufts, a pale belly — in the badger's style. */
const SQUIRREL = SVG(
  '<path d="M20 50 Q6 46 7 30 Q8 16 19 14 Q27 14 26 22 Q20 21 18 28 Q17 38 25 44 Z" fill="#b5522a"/>' +
  '<path d="M17 24 Q14 30 17 37" fill="none" stroke="#d9773f" stroke-width="2.2" stroke-linecap="round"/>' +
  '<ellipse cx="34" cy="42" rx="10" ry="11" fill="#c45f2c"/>' +
  '<ellipse cx="37" cy="45" rx="5.2" ry="7" fill="#f2e3c8"/>' +
  '<circle cx="42" cy="27" r="7.6" fill="#c45f2c"/>' +
  '<path d="M38 21 L37.2 13.5 L41.6 19.6 Z M43.6 20 L44.6 12.6 L47.4 20.6 Z" fill="#a8471f"/>' +
  '<path d="M49 28.5 Q51 30 48.6 31.4" fill="none" stroke="#5a2a14" stroke-width="1.3" stroke-linecap="round"/>' +
  '<circle cx="44.6" cy="25.6" r="1.6" fill="#1a110b"/>' +
  '<path d="M33 52 L30 56 M39 52 L41 56" stroke="#8a3c1c" stroke-width="2.6" stroke-linecap="round"/>' +
  '<path d="M44 36 Q48 38 46 41" fill="none" stroke="#8a3c1c" stroke-width="2.4" stroke-linecap="round"/>');

/** A sun and a moon drawn like the game's line icons (24 grid, round 2 px stroke, currentColor). */
const LINE = (paths: string): string => `<svg class="ic aim-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const SUN = LINE('<circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity=".25"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>');
const MOON = LINE('<path d="M19.2 14.8A7.8 7.8 0 1 1 9.2 4.8a6.2 6.2 0 0 0 10 10z" fill="currentColor" fill-opacity=".25"/>');

const PICS: Record<string, string> = { edelhert: STAG, das: BADGER, wildzwijn: BOAR, nachtzwaluw: NIGHTJAR, vos: FOX, eekhoorn: SQUIRREL };

/** The picture of an animal on the aim card (the roe, the hind and the jay keep their 2D
 *  floor's drawings). */
export function aimPicture(id: string): string {
  return PICS[id] ?? animalIcon(id);
}

/** A rule chip or the animal's tag with its drawn sun or moon in front of the words:
 *  `dag` picks the sun. */
export function dayNightIcon(dag: boolean): string {
  return dag ? SUN : MOON;
}
