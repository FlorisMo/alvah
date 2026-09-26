/**
 * animalIcon.ts — the picture a 2D floor shows for an animal or an encounter
 * (2026-09-26). The 2D tokens used to print the first two letters of the name
 * ("ED", "RE", "WI") and the danger view printed raw ids ("zwijn-honger",
 * "pad-veilig") — letters are exactly what a dyslexic reader should not have to
 * decode. A picture + the plain name reads at a glance. Pure (no DOM), so the
 * mapping carries a unit test.
 */

const ICON: Record<string, string> = {
  edelhert: '🦌', ree: '🦌', reekalf: '🦌', wildzwijn: '🐗', frisling: '🐗', das: '🦡', vos: '🦊',
  eekhoorn: '🐿️', wolf: '🐺', raaf: '🐦‍⬛', merel: '🐦‍⬛', nachtzwaluw: '🐦', koekoek: '🐦',
  roodborsttapuit: '🐦', 'groene-specht': '🐦', koolmees: '🐦', heikikker: '🐸', adder: '🐍',
  heideblauwtje: '🦋',
};

/** The plain name of a content animal id where the id is not a word a child reads. */
const NAME: Record<string, string> = { wildzwijn: 'wild zwijn', edelhert: 'hert', heikikker: 'kikker' };

/** The picture for a content animal id (a small bird as the calm default). */
export function animalIcon(id: string): string {
  return ICON[id] ?? '🐾';
}

/** What a dagnacht encounter shows: a picture + plain words (never a raw id). */
export function subjectView(subject: string, dier?: string): { icon: string; label: string } {
  switch (subject) {
    case 'adder': return { icon: '🐍', label: 'adder' };
    case 'modderpoel': return { icon: '🟫', label: 'modderpoel' };
    case 'pad-veilig': return { icon: '🥾', label: 'vrij pad' };
    case 'zwijn-honger': return { icon: '🐗', label: 'hongerig zwijn' };
    case 'frisling': return { icon: '🐗', label: 'frisling' };
    case 'wildzwijn': return { icon: '🐗', label: 'zeug met biggen' };
    case 'rotte': return { icon: '🐗🐗', label: 'de rotte' };
    case 'reekalf': return dier && dier !== 'ree'
      ? { icon: animalIcon(dier), label: dier }
      : { icon: '🦌', label: 'reekalf' };
    default: return { icon: dier ? animalIcon(dier) : '🐾', label: (dier && NAME[dier]) ?? dier ?? subject.replace(/-/g, ' ') };
  }
}
