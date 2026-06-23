/**
 * wordclock.ts — the karaoke word-clock (BUILD-PLAN §6 / §3 read-aloud).
 *
 * iOS Safari's SpeechSynthesis `onboundary` event is unreliable (often never
 * fires), so we do NOT lean on it for the synced highlight. Instead we estimate
 * each word's spoken span up front from a length + punctuation-pause model and
 * drive the highlight off our own clock (the prototype's timed-highlight idea,
 * promoted to primary). This module is the PURE, deterministic core: no THREE,
 * no DOM, no wall-clock — the UI layer (ui/ReadAloud.ts) owns the rAF loop and
 * just asks `activeWordAt(clock, elapsedMs)` each frame.
 *
 * The model is an estimate, not exact TTS timing. When a future build (Piper
 * pre-baked clips) can MEASURE a line's real duration, pass it as `totalMs` and
 * the whole clock scales to it proportionally — zero rework for callers.
 */

export interface WordSpan {
  /** The display token exactly as it appears in the text (punctuation kept). */
  text: string;
  /** 0-based position among the spoken words. */
  index: number;
  /** Span start, ms from the utterance start (inclusive). */
  startMs: number;
  /** Span end, ms (exclusive — equals the next word's startMs). */
  endMs: number;
}

export interface WordClock {
  words: WordSpan[];
  totalMs: number;
}

export interface ClockOptions {
  /** Speech rate multiplier, mirroring Web-Speech `rate` (<1 = slower → longer). */
  rate?: number;
  /** If given, scale the whole clock to exactly this measured duration (Piper path). */
  totalMs?: number;
}

// Timing model (ms), tuned to a calm child-friendly Dutch read-aloud (~rate 0.96).
const BASE_PER_WORD = 90; //  fixed cost per word (onset + release)
const PER_CHAR = 58; //       per visible character
const PAUSE_COMMA = 190; //   trailing , : ; – (clause break)
const PAUSE_SENTENCE = 360; // trailing . ! ? (sentence break)

const COMMA_END = /[,:;–-]$/;
const SENTENCE_END = /[.!?…]+$/;

/** Per-word weight before any rate/totalMs scaling (in model-ms). */
function wordWeight(token: string): number {
  let w = BASE_PER_WORD + token.length * PER_CHAR;
  if (SENTENCE_END.test(token)) w += PAUSE_SENTENCE;
  else if (COMMA_END.test(token)) w += PAUSE_COMMA;
  return w;
}

/**
 * Build a karaoke clock for `text`: a contiguous, non-overlapping span per
 * spoken word. Whitespace-only / empty text yields an empty clock (totalMs 0).
 */
export function buildWordClock(text: string, opts: ClockOptions = {}): WordClock {
  const tokens = (text ?? '').trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return { words: [], totalMs: 0 };

  const rate = opts.rate && opts.rate > 0 ? opts.rate : 1;
  const weights = tokens.map(wordWeight);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Total: a measured duration if supplied, else the model sum scaled by rate
  // (faster rate → shorter). Either way we distribute it proportionally by weight
  // so the spans stay contiguous and end exactly on totalMs.
  const totalMs = opts.totalMs && opts.totalMs > 0 ? opts.totalMs : weightSum / rate;

  const words: WordSpan[] = [];
  let acc = 0; // accumulated weight, for exact-boundary distribution
  let prevEnd = 0;
  for (let i = 0; i < tokens.length; i++) {
    acc += weights[i];
    // map the running weight fraction onto totalMs → no drift, last.endMs === totalMs
    const endMs = (acc / weightSum) * totalMs;
    words.push({ text: tokens[i], index: i, startMs: prevEnd, endMs });
    prevEnd = endMs;
  }
  return { words, totalMs };
}

/**
 * Index of the word being spoken at `elapsedMs`, or -1 when nothing should be
 * highlighted (before the start, or once the utterance has finished). A word
 * owns [startMs, endMs); the boundary belongs to the next word.
 */
export function activeWordAt(clock: WordClock, elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= clock.totalMs) return -1;
  // linear scan — read-aloud lines are short (a sentence or two)
  for (const w of clock.words) {
    if (elapsedMs >= w.startMs && elapsedMs < w.endMs) return w.index;
  }
  return -1;
}
