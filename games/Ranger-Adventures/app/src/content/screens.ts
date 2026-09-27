/**
 * screens.ts — what each menu screen says aloud (child:B12): its heading and what to
 * do next. Read by `ui/ReadAloud.readScreenAloud` on the title, the ranger maker,
 * Pauze and the missiebord. AVI M3/E3, at most 7 words a sentence (linted with the
 * rest of the copy in core/readlevel.test.ts).
 */
export const SAY = {
  title: 'Word boswachter. Help de dieren van de Veluwe. Druk op Begin.',
  maker: 'Maak je eigen ranger. Kies een naam. Kies hoe je eruitziet. Klaar? Druk op: dit is mijn ranger.',
  pauze: 'Pauze. Wat wil je doen? Of ga terug naar de open plek.',
  missiePauze: 'Pauze. Wil je verder? Of stop je de missie?',
  bord: 'Het missiebord. Kies een missie.',
} as const;
