/**
 * lessons.ts — the pure rules of the first minute (run 6, FLOW lane P2): what the game
 * teaches and tells, in which order, and when each step is done. No DOM, no three.js;
 * `ui/hud/Lessons.ts` runs it every frame, `core/lessons.test.ts` pins it.
 *
 * The first minute of a new boswachter, one thing at a time:
 *   bram     Bram greets you (three lines in the speaker strip)
 *   lopen    walk: the arrow key caps (the stick on a tablet), done after 3 m
 *   rennen   run: the Shift cap (the stick pushed far), done after 1.5 s of running;
 *            it gives way after 12 s shown or 25 m walked, so it never blocks
 *   haak     Bram tells the hook of the first mission; only now the chip shows the way
 *   kijken   look round (drag the view): only if he stands still ~5 s, once a session
 * and later, once each: `missiebord` (back from the first mission), `jeep` (the next
 * mission far away on foot, the jeep near). A returning player hears `welkom` once a
 * session. Walking or running before a lesson shows counts: a lesson already done is
 * skipped. Learned steps are saved (settings.geleerd), so a reload never repeats them.
 */

/** A step you learn by doing. */
export type LessonId = 'lopen' | 'rennen' | 'kijken';
/** A step Bram says. */
export type BeatId = 'welkom' | 'bram' | 'haak' | 'missiebord' | 'jeep';
export type StepId = LessonId | BeatId;

/** What the player has learned or been told, for good (saved in settings). */
export type Geleerd = Partial<Record<LessonId | 'bram' | 'haak' | 'missiebord' | 'jeep', boolean>>;

/** The numbers each lesson is judged by. */
export const LESSON = {
  lopen: { doneM: 3 },
  rennen: { doneS: 1.5, timeoutS: 12, timeoutM: 25 },
  kijken: { stillS: 5, donePx: 40, timeoutS: 10 },
} as const;

/** The jeep beat: the next mission this far (m) away on foot, the jeep this near. */
export const JEEP_BEAT = { missionM: 30, jeepM: 40 } as const;

/** What the player has done so far this session (the lessons read it). */
export interface Progress {
  walkedM: number;   // on foot, free roam
  runS: number;      // running, on foot
  lookPx: number;    // dragging the view round
}

/** A lesson is done by doing it (at any time this session, also before it showed). */
export function lessonDone(id: LessonId, p: Progress): boolean {
  if (id === 'lopen') return p.walkedM >= LESSON.lopen.doneM;
  if (id === 'rennen') return p.runS >= LESSON.rennen.doneS;
  return p.lookPx >= LESSON.kijken.donePx;
}

/** A shown lesson gives way (never blocks): the run lesson after 12 s shown or 25 m
 *  walked while shown, the look lesson after 10 s. The walk lesson waits: it is the one
 *  thing he needs. */
export function lessonTimedOut(id: LessonId, shownS: number, walkedSinceM: number): boolean {
  if (id === 'rennen') return shownS >= LESSON.rennen.timeoutS || walkedSinceM >= LESSON.rennen.timeoutM;
  if (id === 'kijken') return shownS >= LESSON.kijken.timeoutS;
  return false;
}

/** Where the guide stands this frame. */
export interface GuideState {
  geleerd: Geleerd;
  returning: boolean;          // came in from the title with a ranger already made
  welkomSaid: boolean;         // this session
  rennenShown: boolean;        // this session (it timed out: not again until a reload)
  kijkenShown: boolean;        // this session
  hookRelevant: boolean;       // the next mission is the first one, not done yet
  missiebordArmed: boolean;    // back from the first finished mission
  onFoot: boolean;
  jeepFar: boolean;            // the next mission > 30 m on foot, the jeep ≤ 40 m
  stillS: number;              // how long he has stood still
  prompting: boolean;          // a proximity prompt is on screen (he is at a place)
  progress: Progress;
}

/** Bram's hook is still to come: until then the chip does not show. */
export function hookPending(s: Pick<GuideState, 'geleerd' | 'hookRelevant'>): boolean {
  return s.hookRelevant && !s.geleerd.haak;
}

/**
 * The next step to show, or null (nothing to teach or tell now). Lessons already done
 * are not returned (the caller marks them learned: `learnedByDoing`).
 */
export function nextStep(s: GuideState): StepId | null {
  const g = s.geleerd;
  if (s.returning && !s.welkomSaid) return 'welkom';
  if (!s.returning && !g.bram) return 'bram';
  if (!g.lopen && !lessonDone('lopen', s.progress)) return s.onFoot ? 'lopen' : null;
  if (!g.rennen && !s.rennenShown && !lessonDone('rennen', s.progress)) return s.onFoot ? 'rennen' : null;
  if (hookPending(s)) return 'haak';
  if (s.missiebordArmed && !g.missiebord) return 'missiebord';
  if (!g.jeep && s.onFoot && s.jeepFar) return 'jeep';
  if (!g.kijken && !s.kijkenShown && !lessonDone('kijken', s.progress) && s.onFoot && !s.prompting && s.stillS >= LESSON.kijken.stillS) return 'kijken';
  return null;
}

/** The lessons done by doing this session that are not saved as learned yet. */
export function learnedByDoing(g: Geleerd, p: Progress): LessonId[] {
  return (['lopen', 'rennen', 'kijken'] as const).filter((id) => !g[id] && lessonDone(id, p));
}

/**
 * The save's old one-off flags as learned steps. `wereldHintGezien` (the old walk hint
 * was seen: this player has walked and found the way before) → `lopen` and `haak`;
 * `renHintGezien` (FEEL's run tip) → `rennen`. What is already in `geleerd` wins.
 */
export function migrateGeleerd(settings: {
  geleerd?: Geleerd; wereldHintGezien?: boolean; tikHintGezien?: boolean; renHintGezien?: boolean;
}): Geleerd {
  const out: Geleerd = {};
  if (settings.wereldHintGezien) { out.lopen = true; out.haak = true; }
  if (settings.renHintGezien) out.rennen = true;
  return { ...out, ...(settings.geleerd ?? {}) };
}

/** How long (ms) a line of Bram's stays up at least: a reading time (1.2 s + 0.35 s a
 *  word), so a line never flicks past with the voice off. */
export function readingMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return 1200 + 350 * words;
}
