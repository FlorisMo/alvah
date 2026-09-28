/**
 * screens.ts — the front door's words and what each menu screen says aloud (child:B12):
 * its heading and what to do next. Read by `ui/ReadAloud.readScreenAloud` on the title,
 * the ranger maker, Pauze and the missiebord. AVI M3/E3, at most 7 words a sentence
 * (linted with the rest of the copy in core/readlevel.test.ts).
 */

/** The title over the real clearing (and the boot veil's name). */
export const TITLE = {
  naam: 'Ranger van de Veluwe',
  sub: 'Word de nieuwe boswachter.',
  begin: 'Begin',
} as const;

/** The ranger maker. `groet` takes the chosen name. */
export const MAKER = {
  titel: 'Maak je ranger',
  groet: (naam: string): string => `Hoi, ranger ${naam}!`,
  naam: 'Je naam',
  klaar: 'Dit is mijn ranger',
} as const;

export const SAY = {
  title: 'Ranger van de Veluwe. Word de nieuwe boswachter. Druk op Begin.',
  maker: 'Maak je eigen ranger. Kies een naam. Kies hoe je eruitziet. Klaar? Druk op: dit is mijn ranger.',
  pauze: 'Pauze. Wat wil je doen? Of ga terug naar de open plek.',
  missiePauze: 'Pauze. Wil je verder? Of stop je de missie?',
  bord: 'Het missiebord. Kies een missie.',
} as const;
