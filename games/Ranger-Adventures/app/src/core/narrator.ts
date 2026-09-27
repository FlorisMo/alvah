/**
 * narrator.ts — read-aloud, the SWAPPABLE voice layer (BUILD-PLAN §6 voice
 * decision). Ship-now implementation = the browser Web Speech API, preferring
 * the iPad's free Enhanced Dutch voice ("Xander"). The chosen upgrade (Piper,
 * build-time pre-baked clips + timing JSON) will implement this same `Narrator`
 * interface later — zero rework for callers.
 *
 * iOS note: speech must be triggered from a user gesture; always pair an
 * explicit read-aloud button with any auto-speak attempt.
 */

export interface Narrator {
  /** Say a new line: whatever is being said stops first. */
  speak(text: string): void;
  /** Say a line AFTER the one being said (an instruction, then the rule): never cuts it off. */
  queue(text: string): void;
  stop(): void;
  /** Resolves once the voice is quiet (at most `maxMs` later): an animal call waits
   *  for the words instead of sounding over them. */
  quiet(maxMs?: number): Promise<void>;
  readonly available: boolean;
}

function chooseDutchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = voices.filter((v) => v.lang?.toLowerCase().startsWith('nl'));
  if (nl.length === 0) return null;
  // prefer an enhanced/premium Dutch voice (e.g. "Xander") — research "ship-now"
  const enhanced = nl.find((v) => /xander|enhanced|premium|natural|neural/i.test(v.name));
  return enhanced ?? nl[0];
}

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

class WebSpeechNarrator implements Narrator {
  private voice: SpeechSynthesisVoice | null = null;

  get available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  constructor() {
    if (!this.available) return;
    const pick = (): void => {
      this.voice = chooseDutchVoice(window.speechSynthesis.getVoices());
    };
    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
  }

  speak(text: string): void {
    if (!this.available || !text) return;
    window.speechSynthesis.cancel();
    this.queue(text);
  }

  queue(text: string): void {
    if (!this.available || !text) return;
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(forSpeech(text));
    u.lang = 'nl-NL';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.96;
    u.pitch = 1.02;
    synth.speak(u);
  }

  stop(): void {
    if (this.available) window.speechSynthesis.cancel();
  }

  quiet(maxMs = 6000): Promise<void> {
    if (!this.available) return Promise.resolve();
    const synth = window.speechSynthesis;
    const t0 = Date.now();
    return new Promise((resolve) => {
      const check = (): void => {
        if (!(synth.speaking || synth.pending) || Date.now() - t0 >= maxMs) resolve();
        else window.setTimeout(check, 100);
      };
      check();
    });
  }
}

export const narrator: Narrator = new WebSpeechNarrator();
