/**
 * voice.ts — Benjamin's recorded voice, the pure half (2026-10-27). No DOM, no audio.
 *
 * Every line the game reads aloud is said by Benjamin, the warden: an ElevenLabs voice
 * Floris designed for him. The words are recorded ONCE, ahead of time, one clip per
 * sentence (`npm run voice`, scripts/voice.mjs), into `public/voice/` with a manifest
 * that maps each sentence to its clip, its length and when each of its words starts.
 * The game never calls ElevenLabs while a child plays; the key never ships.
 *
 * A text is said by clips when EVERY sentence in it has one; otherwise the browser's
 * own voice says the whole text (two voices in one line would be worse than one). In
 * dev, such a text is reported to the dev server, which notes it in
 * `scripts/voice-missed.txt` for the next `npm run voice` (vite.config.ts).
 *
 * New or changed words: run `npm run voice` (a dry run: what is missing, how many
 * characters), then `npm run voice -- --go` to record them. Never another voice:
 * VOICE below is the one Benjamin.
 */

/** Benjamin's voice: the one ElevenLabs voice every clip is recorded with. */
export const VOICE = {
  /** ElevenLabs voice id ("Benjamin", designed by Floris 2026-10-27). */
  id: 'squHBnETMVeVdrDpROKa',
  model: 'eleven_multilingual_v2',
  /** Calm and steady, a little slower than talk: a dyslexic reader follows each word. */
  settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.9 },
} as const;

/** A breath between two sentence clips of one text (ms). */
export const CLIP_GAP_MS = 140;

/** One recorded sentence: its file in public/voice/, its length and its words' starts (ms). */
export interface Clip { f: string; ms: number; w: number[] }
export interface VoiceManifest { voice: string; clips: Record<string, Clip> }

/** A shown line as it should sound: a rule's arrow is said as "naar" ("Dag-dier →
 *  open plek" → "Dag-dier naar open plek"), never as "pijl"; a count as "van"
 *  ("0/3" → "0 van 3", never a date); an icon is a picture, so it is not said. */
export function forSpeech(text: string): string {
  return text
    .replace(/\s*→\s*/g, ' naar ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 van $2')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The sentences a text is said in, as recorded: one clip each. */
export function voiceUnits(text: string): string[] {
  return forSpeech(text).split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** The clips that say `text`, in order, or null when one of its sentences has none. */
export function clipsFor(manifest: VoiceManifest | null, text: string): Clip[] | null {
  if (!manifest) return null;
  const units = voiceUnits(text);
  if (units.length === 0) return null;
  const clips: Clip[] = [];
  for (const u of units) {
    const c = manifest.clips[u];
    if (!c) return null;
    clips.push(c);
  }
  return clips;
}

/** When each spoken word starts (ms from the first clip's start) and when it all ends,
 *  for clips played one after the other with CLIP_GAP_MS between them. */
export function clipTiming(clips: readonly Clip[]): { starts: number[]; totalMs: number } {
  const starts: number[] = [];
  let at = 0;
  clips.forEach((c, i) => {
    for (const w of c.w) starts.push(at + w);
    at += c.ms + (i < clips.length - 1 ? CLIP_GAP_MS : 0);
  });
  return { starts, totalMs: at };
}
