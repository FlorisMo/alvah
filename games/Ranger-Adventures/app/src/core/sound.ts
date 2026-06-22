/**
 * sound.ts — minimal WebAudio cues for dual-channel feedback (colour + sound;
 * Alvah profile, BUILD-PLAN §3 / memory: never colour alone). A small placeholder
 * for the full recipe set in prototype/sound.jsx, ported later. Callers gate on
 * settings.geluid. AudioContext is created lazily and resumed on first use (the
 * triggering tap satisfies the autoplay-unlock rule).
 */

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const Sound = {
  /** success "sings" — a gentle rising two-note */
  found(): void {
    tone(660, 0, 0.16, 'sine', 0.18);
    tone(880, 0.12, 0.22, 'sine', 0.18);
  },
  /** failure is "quiet" — one soft low note, never harsh */
  tryAgain(): void {
    tone(300, 0, 0.18, 'sine', 0.12);
  },
  /** small tick for taps */
  step(): void {
    tone(520, 0, 0.06, 'triangle', 0.1);
  },
};
