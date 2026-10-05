/**
 * icons.ts — the ranger's kit of drawn line icons (run 6, FLOW P3): one set for every
 * screen between the world and a mission, so no emoji is ever UI chrome (an emoji draws
 * differently on every system, a grey blob on some, and a speech engine may read it out).
 *
 * All drawn on one 24 px grid with a 2 px round stroke in `currentColor`, so an icon
 * takes the colour of the words beside it. Every icon is `aria-hidden`: it never joins
 * a button's name and is never spoken; the words beside it carry the meaning (dual
 * channel: a picture AND a word). Pure strings, no DOM, no imports but types.
 *
 * `icon(name)` is the markup; `SKILL_ICON` names the picture of each breinkracht badge
 * (core/skill.ts SKILL_META.icon), `CLUE_ICON` the picture of each clue kind.
 */

const PATHS = {
  speaker:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/>',
  pause: '<rect x="6.5" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/>',
  book:
    '<path d="M12 6.6C10 5.1 7 4.6 3.8 5.1v13c3.2-.5 6.2 0 8.2 1.5 2-1.5 5-2 8.2-1.5v-13C17 4.6 14 5.1 12 6.6z"/>' +
    '<path d="M12 6.6v13"/><path d="M6.5 9.2c1.3-.1 2.4.1 3.3.5M6.5 12.4c1.3-.1 2.4.1 3.3.5"/>',
  raven:
    '<path d="M3.2 18.4 8.2 13.9c1.3-3.6 3.3-6.3 6.5-6.5 1.4-.1 2.5.5 3.1 1.4l3.4 1-3.6.8c-.3 3.7-2.3 6.3-5.8 7.1l-3.5.5z"/>' +
    '<path d="M11.4 17.6v2.8M14 16.9l.8 3.3M10.2 13.6c1.6.4 3.2.1 4.4-.9"/><circle cx="15.3" cy="9.9" r=".95" fill="currentColor" stroke="none"/>',
  badge: '<circle cx="12" cy="9.2" r="5.4"/><path d="M8.7 13.4 7.2 20.5l4.8-2.5 4.8 2.5-1.5-7.1"/><path d="M12 6.6l.8 1.6 1.7.3-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.3z" fill="currentColor" stroke-width="1"/>',
  gear:
    '<path d="M10.31 5.21L10.78 2.88L13.22 2.88L13.69 5.21L15.61 6.00L17.58 4.69L19.31 6.42L18.00 8.39L18.79 10.31L21.12 10.78L21.12 13.22L18.79 13.69L18.00 15.61L19.31 17.58L17.58 19.31L15.61 18.00L13.69 18.79L13.22 21.12L10.78 21.12L10.31 18.79L8.39 18.00L6.42 19.31L4.69 17.58L6.00 15.61L5.21 13.69L2.88 13.22L2.88 10.78L5.21 10.31L6.00 8.39L4.69 6.42L6.42 4.69L8.39 6.00Z"/>' +
    '<circle cx="12" cy="12" r="3.2"/>',
  home: '<path d="M3.8 11.6 12 4.8l8.2 6.8"/><path d="M6 10v9.2h12V10"/><path d="M10 19.2v-5h4v5"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  forward: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  jeep:
    '<path d="M2.8 16.2v-4.4l1.9-4.3h7.6l2.4 4.3h4.6c.9 0 1.7.8 1.7 1.7v2.7"/><path d="M2.8 11.8h18"/><path d="M8.8 7.5v4.3"/>' +
    '<circle cx="7" cy="16.6" r="2.1"/><circle cx="17" cy="16.6" r="2.1"/>',
  helicopter:
    '<path d="M3.5 4.8h13"/><path d="M10 4.8v3"/><path d="M5.5 12.4a4.6 4.6 0 0 1 4.6-4.6h2.6a4.6 4.6 0 0 1 4.6 4.6v1.8H5.5z"/>' +
    '<path d="M17.3 11.4h3.2l.9-1.8"/><path d="M7.5 18.8h9M9.2 14.2l-.9 4.6M14.2 14.2l.9 4.6"/>',
  camera: '<path d="M3.8 8.2h3.4l1.6-2.4h6.4l1.6 2.4h3.4v11H3.8z"/><circle cx="12" cy="13.4" r="3.6"/><path d="M17.3 10.6h.01"/>',
  footprints:
    '<path d="M7.8 11.2c-1.6 0-2.6 1.6-2.6 3.8 0 2 1 3.6 2.4 3.6s2.2-1.3 2.2-3.2c0-2.4-.6-4.2-2-4.2z"/>' +
    '<path d="M16.2 4.8c-1.4 0-2 1.8-2 4.2 0 1.9.8 3.2 2.2 3.2s2.4-1.6 2.4-3.6c0-2.2-1-3.8-2.6-3.8z"/>' +
    '<path d="M6.2 20.4h.01M8.9 20.6h.01M15.2 14h.01M17.9 14.2h.01"/>',
  tyre:
    '<path d="M4 20.5l3-2.2 3 2.2M4 15.5l3-2.2 3 2.2M4 10.5l3-2.2 3 2.2M4 5.5l3-2.2 3 2.2"/>' +
    '<path d="M14 20.5l3-2.2 3 2.2M14 15.5l3-2.2 3 2.2M14 10.5l3-2.2 3 2.2M14 5.5l3-2.2 3 2.2"/>',
  compass: '<circle cx="12" cy="12" r="8.6"/><path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z" fill="currentColor" fill-opacity=".18"/>',
  keyboard: '<rect x="2.8" y="6.4" width="18.4" height="11.2" rx="2.2"/><path d="M6.6 10h.01M10 10h.01M13.6 10h.01M17.2 10h.01M7.6 14h8.8"/>',
  stick: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.6" fill="currentColor" fill-opacity=".18"/>',
  leaf: '<path d="M5 19c0-8.3 5.2-14 14.2-14 0 9-6 14-14.2 14z"/><path d="M5 19l8.4-8.4"/>',
  pin: '<path d="M12 21s-6.4-6.1-6.4-11a6.4 6.4 0 0 1 12.8 0c0 4.9-6.4 11-6.4 11z"/><circle cx="12" cy="10" r="2.3"/>',
  unknown: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3" stroke-dasharray="3.2 3"/>',
  flag: '<path d="M6 21V3.8"/><path d="M6 4.6h11.4l-2.6 4 2.6 4H6"/>',
  arrow: '<path d="M12 19.2V5"/><path d="M6.4 10.6 12 5l5.6 5.6"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  boot:
    '<path d="M7.4 3.8h5.2v7.4l6.2 2.6c1 .4 1.6 1.3 1.6 2.3v2.1H4.6v-3.3l2.8-2.6z"/><path d="M4.6 18.2v2h15.8v-2"/><path d="M9.6 7h3M9.6 9.8h3"/>',
  paw:
    '<ellipse cx="12" cy="15.6" rx="3.9" ry="3.3"/><circle cx="6.3" cy="10.4" r="1.8"/><circle cx="9.7" cy="6.8" r="1.8"/>' +
    '<circle cx="14.3" cy="6.8" r="1.8"/><circle cx="17.7" cy="10.4" r="1.8"/>',
  bulb: '<path d="M9 17.2h6M9.8 20.2h4.4"/><path d="M8.2 14.2A6 6 0 1 1 15.8 14.2c-.7.6-.8 1.2-.8 2V17H9v-.8c0-.8-.1-1.4-.8-2z"/>',
  heart: '<path d="M12 19.6s-7.6-4.4-7.6-9.8A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.6 2.4c0 5.4-7.6 9.8-7.6 9.8z"/>',
  photo: '<rect x="3.8" y="4.8" width="16.4" height="14.4" rx="2"/><path d="M3.8 16.2l4.6-4.4 3.4 3.2 2.6-2.4 5.8 5"/><circle cx="15.6" cy="9.2" r="1.6"/>',
  // run 7: the veldgids, a closed field guide with a leaf on its cover (the sporenboek is
  // the open book)
  veldgids:
    '<rect x="4.6" y="3.4" width="14.8" height="17.2" rx="1.8"/><path d="M8.2 3.4v17.2"/>' +
    '<path d="M11 15.6c0-3.7 2.3-6.2 6.1-6.2 0 3.9-2.5 6.2-6.1 6.2z" fill="currentColor" fill-opacity=".16"/><path d="M11 15.6l3.3-3.3"/>',
  // the five breinkrachten (drawn light on the badge's tier disc)
  magnifier: '<circle cx="10.4" cy="10.4" r="5.8"/><path d="M14.8 14.8 20 20"/>',
  route:
    '<circle cx="5.8" cy="17.4" r="2.1"/><circle cx="12" cy="7" r="2.1"/><circle cx="18.2" cy="15.2" r="2.1"/>' +
    '<path d="M7 15.4 10.8 9M13.4 8.8l3.6 4.6" stroke-dasharray="2.2 2.2"/>',
  ear: '<path d="M7.8 9.2a4.6 4.6 0 0 1 9.2 0c0 2.7-2 3.6-2.9 5.1-.8 1.3-.6 2.7-1.9 3.7-1.2.9-3 .6-3.6-.7"/><path d="M10.8 9.4a1.8 1.8 0 1 1 3.4.9c-.4.8-1.3 1-1.6 1.9"/>',
  hand:
    '<path d="M8.2 12.2V6.6a1.5 1.5 0 0 1 3 0v4.6M11.2 10.4V5.1a1.5 1.5 0 0 1 3 0v5.8M14.2 10.9V7a1.5 1.5 0 0 1 3 0v7.1c0 3.7-2.4 6.1-6 6.1-2.4 0-3.9-1-5-2.8l-2.3-3.7a1.4 1.4 0 0 1 2.3-1.6l2 2.6"/>',
  swap: '<path d="M4.6 8.6h14l-3.6-3.6"/><path d="M19.4 15.4h-14l3.6 3.6"/>',
  // run 7 (the veldgids): a pine cone, its stalk on top and its scales in rows
  cone:
    '<path d="M12 3.4v2.4"/><path d="M12 5.8c-3.3 0-5.4 3.5-5.4 7.4 0 3.9 2.4 7 5.4 7s5.4-3.1 5.4-7c0-3.9-2.1-7.4-5.4-7.4z"/>' +
    '<path d="M8.8 8.9 12 10.6l3.2-1.7M7 12.6l5 2.5 5-2.5M7.6 16.4l4.4 2.1 4.4-2.1"/>',
  // run 7 (ven-life): a dragonfly from above — its long thin body, two pairs of wings
  dragonfly:
    '<circle cx="12" cy="5.2" r="1.7" fill="currentColor" fill-opacity=".16"/><path d="M12 7v13.5"/>' +
    '<path d="M12 9.2C9.4 7.3 5.2 7 3 8.3c1.8 2 6.3 2.4 9 .9z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M12 9.2c2.6-1.9 6.8-2.2 9-.9-1.8 2-6.3 2.4-9 .9z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M12 11.8c-2.3-1.1-5.6-.9-7.4.5 1.7 1.4 5 1.3 7.4-.5zM12 11.8c2.3-1.1 5.6-.9 7.4.5-1.7 1.4-5 1.3-7.4-.5z"/>',
  // run 7 (stille-zand): two speckled eggs lying side by side on the sand (a nightjar's)
  egg:
    '<path d="M8.6 19.6c-2.6 0-4.4-2-4.4-4.7 0-3.3 2-6.6 4.4-6.6S13 11.6 13 14.9c0 2.7-1.8 4.7-4.4 4.7z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M15.6 19.6c-2.3 0-3.9-1.8-3.9-4.2 0-2.9 1.8-5.9 3.9-5.9s3.9 3 3.9 5.9c0 2.4-1.6 4.2-3.9 4.2z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M3 21h18"/><circle cx="7.4" cy="13.6" r=".55" fill="currentColor"/><circle cx="9.6" cy="16.2" r=".55" fill="currentColor"/>' +
    '<circle cx="16.4" cy="14.4" r=".55" fill="currentColor"/>',
  // run 7 (stille-zand): an anthill — a heap of pine needles on the sand, ants on its flank
  mound:
    '<path d="M2.8 19.5C4.6 13.2 8 8.6 12 8.6s7.4 4.6 9.2 10.9z" fill="currentColor" fill-opacity=".16"/>' +
    '<path d="M2.5 19.6h19"/><path d="M8.6 15.6l1.6-1.2M12.6 12.6l1.4 1.4M14.8 16.6l1.7-.9M10.6 17.9l1.2.6"/>' +
    '<circle cx="17.9" cy="13.6" r=".7" fill="currentColor"/><circle cx="6.4" cy="17.1" r=".7" fill="currentColor"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** The drawn icon as inline SVG markup (aria-hidden: the words beside it are the name). */
export function icon(name: IconName, cls = ''): string {
  return (
    `<svg class="ic ic-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `${PATHS[name]}</svg>`
  );
}

/** Every icon name, for the unit test and a look at the whole set. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** The picture of each clue kind in the sporenboek and on the clue card. */
export const CLUE_ICON: Record<string, IconName> = { spoor: 'footprints', camera: 'camera', band: 'tyre' };
