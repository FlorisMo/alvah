/**
 * mentor.ts — what Bram says, and the first minute's lessons (run 6, FLOW lane P2).
 *
 * Bram is the warden (the BOA of the canon), the player's mentor, by the missiebord.
 * First name only. Calm, kind, few words: he greets a new boswachter, tells the hook
 * of the first mission, and later points at the jeep and at the missiebord when they
 * become useful. His lines play in the speaker strip (ui/hud/Speaker.ts), read aloud
 * with the words lighting up; the lessons (ui/hud/Lessons.ts) teach the controls by
 * doing, one at a time.
 *
 * Pure data, no imports: the read-level test (core/readlevel.test.ts) lints every line
 * here — AVI M3/E3, at most 7 words a sentence and a line. `{naam}` is the ranger's
 * name from the maker (core/avatar.rangerNaam).
 */

/** The mentor's name, as the speaker strip shows it. */
export const MENTOR_NAAM = 'Bram';

/** Bram's lines per beat. Each line is one strip, spoken on its own. */
export const BRAM = {
  /** A new boswachter, just made in the maker: the first play frame. */
  intro: ['Hoi {naam}! Welkom op de Veluwe.', 'Ik ben Bram, de boswachter.', 'Jij bent nu ook boswachter!'],
  /** The hook of the first mission (the frisling), once the controls are learned. The
   *  MISSIONS lane's frisling story: a piglet lost from its group, which roots at the
   *  mud pool; you find it and bring it home. Knap woorden: frisling. */
  haak: {
    simpel: ['Luister! Een kleine big is zoek.', 'Help jij hem zoeken?', 'Volg de pijl linksboven.'],
    knap: ['Luister! Een frisling is zoek.', 'Help jij hem zoeken?', 'Volg de pijl linksboven.'],
  },
  /** The first time the next mission is far away on foot and the jeep is near. */
  jeep: ['Dat is ver lopen.', 'Pak de jeep maar!'],
  /** Back in the world after the first finished mission. */
  missiebord: ['Er is nog meer werk, {naam}.', 'Kijk maar op het missiebord.'],
  /** After the second finished mission (wired with the porch ring, FLOW P4). */
  raaf: ['Bij de hut zit een jonge raaf.', 'Kun jij hem helpen?'],
  /** A returning player, once a session; he adds who he is if they never met. */
  welkomTerug: ['Welkom terug, {naam}!'],
  kennismaken: 'Ik ben Bram, de boswachter.',
} as const;

/** Fill in the ranger's name. */
export function metNaam(line: string, naam: string): string {
  return line.replace(/\{naam\}/g, naam);
}

/** The lessons: what to do, in the words of the device (keys and mouse on a laptop,
 *  the stick and a finger on a tablet). One line each. */
export const LES = {
  lopen: { keys: 'Loop met de pijltjes.', stick: 'Sleep de stick om te lopen.' },
  rennen: { keys: 'Hou Shift vast. Dan ren je.', stick: 'Duw de stick ver. Dan ren je.' },
  kijken: { keys: 'Kijk rond: sleep met de muis.', stick: 'Kijk rond: veeg over het scherm.' },
} as const;

/** The "Zo speel je" card behind the "?" chip: one word per control. */
export const BESTURING = {
  titel: 'Zo speel je',
  keys: [
    { wat: 'Lopen', toets: 'pijltjes' },
    { wat: 'Rennen', toets: 'Shift' },
    { wat: 'Rondkijken', toets: 'muis' },
    { wat: 'Doen', toets: 'Enter' },
    { wat: 'Pauze', toets: 'Esc' },
  ],
  stick: [
    { wat: 'Lopen', toets: 'stick' },
    { wat: 'Rennen', toets: 'stick ver' },
    { wat: 'Rondkijken', toets: 'veeg' },
    { wat: 'Doen', toets: 'tik' },
  ],
  terug: 'Terug',
  /** What the card says aloud (the keys by name, then what they do). */
  zegKeys: 'Zo speel je. Pijltjes: lopen. Shift: rennen. Muis slepen: rondkijken. Enter: doen. Escape: pauze.',
  zegStick: 'Zo speel je. Stick: lopen. Stick ver: rennen. Veeg: rondkijken. Tik: doen.',
} as const;
