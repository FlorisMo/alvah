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
  speak(text: string): void;
  stop(): void;
  readonly available: boolean;
}

function chooseDutchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = voices.filter((v) => v.lang?.toLowerCase().startsWith('nl'));
  if (nl.length === 0) return null;
  // prefer an enhanced/premium Dutch voice (e.g. "Xander") — research "ship-now"
  const enhanced = nl.find((v) => /xander|enhanced|premium|natural|neural/i.test(v.name));
  return enhanced ?? nl[0];
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
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'nl-NL';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.96;
    u.pitch = 1.02;
    synth.speak(u);
  }

  stop(): void {
    if (this.available) window.speechSynthesis.cancel();
  }
}

export const narrator: Narrator = new WebSpeechNarrator();
