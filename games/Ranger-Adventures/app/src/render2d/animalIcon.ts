/**
 * animalIcon.ts — the picture a 2D floor shows for an animal or an encounter
 * (2026-09-26). The 2D tokens used to print the first two letters of the name
 * ("ED", "RE", "WI") and the danger view printed raw ids ("zwijn-honger",
 * "pad-veilig") — letters are exactly what a dyslexic reader should not have to
 * decode. A picture + the plain name reads at a glance. Pure (no DOM), so the
 * mapping carries a unit test.
 */

/** A roe deer drawn small and without antlers, with its white rump — so the ree never
 *  shares the red deer's antlered 🦌 in a game where the child must tell them apart
 *  (child:B13). `spots` draws the fawn's white spots. Inline SVG sized in em, so it
 *  scales with the token's font size like the emoji beside it. */
function roeSvg(spots: boolean): string {
  const dots = spots
    ? '<g fill="#fff4dc"><circle cx="24" cy="30" r="1.6"/><circle cx="30" cy="28.5" r="1.6"/><circle cx="36" cy="30" r="1.6"/>' +
      '<circle cx="27" cy="34" r="1.4"/><circle cx="33" cy="33.5" r="1.4"/><circle cx="21" cy="34" r="1.3"/></g>'
    : '';
  return (
    '<svg class="ai-svg" viewBox="0 0 64 64" width="1.15em" height="1.15em" aria-hidden="true">' +
    '<g fill="#8a5429"><rect x="18" y="38" width="2.8" height="18" rx="1.2"/><rect x="23" y="38" width="2.8" height="17" rx="1.2"/>' +
    '<rect x="36" y="38" width="2.8" height="18" rx="1.2"/><rect x="41" y="38" width="2.8" height="17" rx="1.2"/></g>' +
    '<ellipse cx="30" cy="33" rx="16" ry="8.5" fill="#b9773f"/>' +
    '<path d="M39 30 L46 15 L52 17 L46 34 Z" fill="#b9773f"/>' +
    '<ellipse cx="51.5" cy="17.5" rx="6.5" ry="4.2" fill="#b9773f"/>' +
    '<path d="M46 14 Q44 6 48 7 Q49 11 48.5 14 Z M50 13.5 Q50 5 54 7 Q53 11 51.8 14 Z" fill="#9c6232"/>' +
    '<ellipse cx="15.5" cy="31" rx="3.6" ry="4.4" fill="#fff4dc"/>' +
    '<circle cx="52" cy="16.2" r="1.3" fill="#2a1a10"/><circle cx="57.6" cy="18.6" r="1.4" fill="#2a1a10"/>' +
    dots +
    '</svg>'
  );
}

/** A jay side-on (pinkish brown, a black tail, the blue bar on its wing, its crest) and a
 *  green woodpecker clinging upright (green, a red cap, a black mask): the squirrel's
 *  tree neighbours, each its own picture beside the raven and the squirrel. */
function jaySvg(): string {
  return (
    '<svg class="ai-svg" viewBox="0 0 64 64" width="1.15em" height="1.15em" aria-hidden="true">' +
    '<path d="M12 40 L2 50 L6 52 L16 44 Z" fill="#1d1d22"/>' +
    '<ellipse cx="30" cy="36" rx="17" ry="11" fill="#c89276"/>' +
    '<path d="M22 32 Q32 26 40 34 Q32 40 22 38 Z" fill="#8b7d77"/>' +
    '<rect x="26" y="33" width="10" height="3.2" fill="#3a7bd5"/><rect x="28" y="33" width="1.6" height="3.2" fill="#1d1d22"/>' +
    '<rect x="32" y="33" width="1.6" height="3.2" fill="#1d1d22"/>' +
    '<circle cx="46" cy="27" r="9" fill="#d09a80"/><path d="M42 19 Q46 13 51 19 Z" fill="#e8d8cc"/>' +
    '<path d="M53 27 L61 29 L53 31 Z" fill="#3a3530"/><path d="M44 31 L50 33" stroke="#1d1d22" stroke-width="1.6"/>' +
    '<circle cx="49" cy="26" r="1.6" fill="#1d1d22"/>' +
    '<path d="M26 47 L25 55 M34 47 L35 55" stroke="#8a6a50" stroke-width="1.8"/>' +
    '</svg>'
  );
}
function greenWoodpeckerSvg(): string {
  return (
    '<svg class="ai-svg" viewBox="0 0 64 64" width="1.15em" height="1.15em" aria-hidden="true">' +
    '<path d="M26 44 L22 60 L30 58 Z" fill="#3f5f25"/>' +
    '<ellipse cx="30" cy="34" rx="10" ry="15" fill="#6f9a3a"/>' +
    '<ellipse cx="34" cy="38" rx="5" ry="9" fill="#c8cf7a"/>' +
    '<circle cx="33" cy="16" r="8" fill="#7da544"/><path d="M26 12 Q32 5 40 12 L38 14 Q32 10 28 14 Z" fill="#d8322a"/>' +
    '<path d="M33 16 L39 18 L33 20 Z" fill="#1d1d22"/><path d="M40 16 L54 18 L40 20 Z" fill="#6b6660"/>' +
    '<circle cx="35" cy="15.5" r="1.5" fill="#f4f0e0"/>' +
    '</svg>'
  );
}

const ICON: Record<string, string> = {
  edelhert: '🦌', ree: roeSvg(false), reekalf: roeSvg(true), wildzwijn: '🐗', frisling: '🐗', das: '🦡', vos: '🦊',
  eekhoorn: '🐿️', wolf: '🐺', raaf: '🐦‍⬛', merel: '🐦‍⬛', nachtzwaluw: '🐦', koekoek: '🐦',
  roodborsttapuit: '🐦', 'groene-specht': greenWoodpeckerSvg(), gaai: jaySvg(), koolmees: '🐦', heikikker: '🐸', adder: '🐍',
  heideblauwtje: '🦋',
};

/** The plain name of a content animal id where the id is not a word a child reads. */
const NAME: Record<string, string> = { wildzwijn: 'wild zwijn', edelhert: 'hert', heikikker: 'kikker' };

/** The picture for a content animal id (a small bird as the calm default). */
export function animalIcon(id: string): string {
  return ICON[id] ?? '🐾';
}

/** What a dagnacht encounter shows: a picture + plain words (never a raw id). With
 *  `jargon` off ("knappe woorden" uit) the words are the simple ones: big, moeder, groep. */
export function subjectView(subject: string, dier?: string, jargon = false): { icon: string; label: string } {
  switch (subject) {
    case 'adder': return { icon: '🐍', label: 'adder' };
    case 'modderpoel': return { icon: '🟫', label: 'modderpoel' };
    case 'pad-veilig': return { icon: '🥾', label: 'vrij pad' };
    case 'zwijn-honger': return { icon: '🐗', label: 'hongerig zwijn' };
    case 'frisling': return { icon: '🐗', label: jargon ? 'frisling' : 'big' };
    case 'wildzwijn': return { icon: '🐗', label: jargon ? 'zeug met biggen' : 'moeder met biggen' };
    case 'rotte': return { icon: '🐗🐗', label: jargon ? 'de rotte' : 'de groep' };
    case 'reekalf': return dier && dier !== 'ree'
      ? { icon: animalIcon(dier), label: NAME[dier] ?? dier }
      : { icon: animalIcon('reekalf'), label: 'reekalf' };
    default: return { icon: dier ? animalIcon(dier) : '🐾', label: (dier && NAME[dier]) ?? dier ?? subject.replace(/-/g, ' ') };
  }
}
