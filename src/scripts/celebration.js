// Celebration-config: voorspelbare audio-chords per mijlpaal-volgnummer +
// bloem-SVG per spel voor het einde-scherm. Geen variable reward, geen random
// drops — research-rule §C.3 (predictable + mastery-anchored).
//
// Pure module: geen DOM, geen storage. Caller injecteert SVG-string en speelt
// chord af via audio.js::playChord.

import { MIJLPALEN } from './mijlpalen.js';

// Vier akkoorden, één per mijlpaal-volgnummer (1-4) per spel. Hetzelfde
// akkoord voor "mijlpaal-1" ongeacht spel — Alvah leert "dit klinkt als de
// eerste mijlpaal", consistent over spellen heen. Frequencies in Hz.
const CHORD_PROGRESSIE = [
  [220.00, 277.18, 329.63],                      // 1: A-mineur (warm, laag)
  [293.66, 369.99, 440.00],                      // 2: D-majeur (helder, mid)
  [329.63, 415.30, 493.88, 659.25],              // 3: E-majeur (brighter)
  [523.25, 659.25, 783.99, 987.77],              // 4: C-majeur octaaf-hoog
];

// Bepaalt het chord-array voor een gegeven mijlpaal-id. Retourneert null
// als de id niet voorkomt in MIJLPALEN.
export function chordVoor(milestoneId) {
  for (const spelId of Object.keys(MIJLPALEN)) {
    const lijst = MIJLPALEN[spelId];
    const idx = lijst.findIndex((m) => m.id === milestoneId);
    if (idx >= 0 && idx < CHORD_PROGRESSIE.length) {
      return CHORD_PROGRESSIE[idx];
    }
  }
  return null;
}

// SVG-bloem per spel. Eén-tone via currentColor zodat CSS de kleur per spel
// kan zetten via `color`-property. Wisselen heeft een multi-kleur regenboog
// hardcoded omdat dat het thema is.
function svgWrap(viewBox, inner) {
  return `<svg viewBox="${viewBox}" width="84" height="84" aria-hidden="true">${inner}</svg>`;
}

const SIMON_NOTE = svgWrap('0 0 100 100', `
  <g fill="currentColor">
    <circle cx="34" cy="72" r="14"/>
    <rect x="46" y="22" width="4" height="52"/>
    <path d="M50 22 Q72 18 72 40" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>
`);

const CORSI_STAR = svgWrap('0 0 100 100', `
  <polygon
    points="50,8 61,38 92,38 67,57 76,90 50,70 24,90 33,57 8,38 39,38"
    fill="currentColor"/>
`);

const DAY_NIGHT_FLOWER = svgWrap('0 0 100 100', `
  <g fill="currentColor">
    <ellipse cx="50" cy="22" rx="9" ry="16"/>
    <ellipse cx="50" cy="78" rx="9" ry="16"/>
    <ellipse cx="22" cy="50" rx="16" ry="9"/>
    <ellipse cx="78" cy="50" rx="16" ry="9"/>
    <ellipse cx="32" cy="32" rx="11" ry="9" transform="rotate(-45 32 32)"/>
    <ellipse cx="68" cy="32" rx="11" ry="9" transform="rotate(45 68 32)"/>
    <ellipse cx="32" cy="68" rx="11" ry="9" transform="rotate(45 32 68)"/>
    <ellipse cx="68" cy="68" rx="11" ry="9" transform="rotate(-45 68 68)"/>
    <circle cx="50" cy="50" r="13" fill="#1a1a1a" opacity="0.18"/>
    <circle cx="50" cy="50" r="10"/>
  </g>
`);

const ZOEKEN_LILY = svgWrap('0 0 100 100', `
  <g fill="currentColor">
    <ellipse cx="50" cy="55" rx="35" ry="9" opacity="0.35"/>
    <path d="M50 50 L70 35 Q72 50 65 60 Z"/>
    <path d="M50 50 L30 35 Q28 50 35 60 Z"/>
    <path d="M50 48 L65 25 Q50 32 35 25 Z"/>
    <path d="M50 52 L65 78 Q50 70 35 78 Z"/>
    <circle cx="50" cy="50" r="8" fill="#1a1a1a" opacity="0.22"/>
    <circle cx="50" cy="50" r="5"/>
  </g>
`);

const WISSELEN_RAINBOW = svgWrap('0 0 100 100', `
  <g>
    <ellipse cx="50" cy="22" rx="11" ry="20" fill="#c94174"/>
    <ellipse cx="78" cy="50" rx="20" ry="11" fill="#f5c23b"/>
    <ellipse cx="50" cy="78" rx="11" ry="20" fill="#1e4d32"/>
    <ellipse cx="22" cy="50" rx="20" ry="11" fill="#2b5fb8"/>
    <circle cx="50" cy="50" r="11" fill="#1a1a1a"/>
    <circle cx="50" cy="50" r="6" fill="#fdfcf8"/>
  </g>
`);

const BLOEMEN = {
  simon: SIMON_NOTE,
  corsi: CORSI_STAR,
  'day-night': DAY_NIGHT_FLOWER,
  zoeken: ZOEKEN_LILY,
  wisselen: WISSELEN_RAINBOW,
};

export function bloemSvg(spelId) {
  return BLOEMEN[spelId] || null;
}

// Voor tests/inspectie.
export function alleSpelIds() {
  return Object.keys(BLOEMEN);
}
