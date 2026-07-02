/**
 * sound.ts — minimal WebAudio cues for dual-channel feedback (colour + sound;
 * Alvah profile, BUILD-PLAN §3 / memory: never colour alone). A small placeholder
 * for the full recipe set in prototype/sound.jsx, ported later. Callers gate on
 * settings.geluid. AudioContext is created lazily and resumed on first use (the
 * triggering tap satisfies the autoplay-unlock rule).
 */

import { fadeInCurve, fadeOutCurve } from './audiofade';

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

/**
 * Per-animal call motifs — synthesized placeholders, distinct enough that the
 * simon (sound-echo) engine is learnable by ear. The audio pipeline
 * (scripts/audio-fetch.mjs → xeno-canto/Freesound) registers real recorded
 * calls via registerCall(); when a real sample is present it wins, so wiring in
 * real audio is zero-rework. dur ≈ how long the call rings (seconds).
 */
interface CallSpec { freq: number; dur: number; type: OscillatorType; vibrato?: number; rep?: number }
const CALLS: Record<string, CallSpec> = {
  edelhert:   { freq: 150, dur: 0.7,  type: 'sawtooth', vibrato: 6 },   // burlen — deep bellow
  ree:        { freq: 420, dur: 0.22, type: 'square',   rep: 2 },        // blaf — short bark
  wildzwijn:  { freq: 190, dur: 0.3,  type: 'sawtooth', rep: 2 },        // knor — grunt
  frisling:   { freq: 520, dur: 0.18, type: 'square',   rep: 3 },        // piglet squeak
  raaf:       { freq: 280, dur: 0.34, type: 'sawtooth', rep: 2 },        // kroa — croak
  das:        { freq: 240, dur: 0.28, type: 'triangle', rep: 2 },        // churr
  nachtzwaluw:{ freq: 600, dur: 0.6,  type: 'triangle', vibrato: 22 },   // ratel — churring trill
  eekhoorn:   { freq: 760, dur: 0.16, type: 'square',   rep: 3 },        // chatter
  wolf:       { freq: 330, dur: 0.8,  type: 'sine',     vibrato: 3 },     // howl
};
const DEFAULT_CALL: CallSpec = { freq: 440, dur: 0.3, type: 'sine', rep: 2 };

/** Real recorded calls keyed by animal id — populated at runtime by the audio layer. */
const sampleBuffers = new Map<string, AudioBuffer>();

function playCall(id: string): number {
  const a = ac();
  if (!a) return 0.3;
  const buf = sampleBuffers.get(id);
  if (buf) {
    const src = a.createBufferSource();
    const gain = a.createGain();
    gain.gain.value = 0.9;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(a.destination);
    src.start();
    return Math.min(buf.duration, 1.4);
  }
  const spec = CALLS[id] ?? DEFAULT_CALL;
  const rep = spec.rep ?? 1;
  const gap = spec.dur * 0.45;
  for (let i = 0; i < rep; i++) {
    const start = i * (spec.dur + gap);
    if (spec.vibrato) {
      // a small warble for the trilling/bellowing calls
      tone(spec.freq, start, spec.dur, spec.type, 0.16);
      tone(spec.freq * 1.04, start + 0.03, spec.dur, spec.type, 0.08);
    } else {
      tone(spec.freq, start, spec.dur, spec.type, 0.16);
    }
  }
  return rep * (spec.dur + gap);
}

export const Sound = {
  /** lazily unlock/resume the AudioContext from a user gesture (iOS rule) */
  unlock(): void {
    ac();
  },
  /** success "sings" — a gentle rising two-note */
  found(): void {
    tone(660, 0, 0.16, 'sine', 0.18);
    tone(880, 0.12, 0.22, 'sine', 0.18);
  },
  /** a single warm confirm note (round complete, not yet finished) */
  correct(): void {
    tone(700, 0, 0.14, 'sine', 0.16);
  },
  /** a soft selection blip (rule flip, menu) */
  select(): void {
    tone(580, 0, 0.1, 'triangle', 0.12);
  },
  /** failure is "quiet" — one soft low note, never harsh */
  tryAgain(): void {
    tone(300, 0, 0.18, 'sine', 0.12);
  },
  /** small tick for taps */
  step(): void {
    tone(520, 0, 0.06, 'triangle', 0.1);
  },
  /** play an animal's call; returns its duration (s) so the caller can time the sequence */
  call(id: string): number {
    return playCall(id);
  },
  /** the duration (s) of an animal's call — for scheduling the listen phase */
  callDur(id: string): number {
    const buf = sampleBuffers.get(id);
    if (buf) return Math.min(buf.duration, 1.4);
    const spec = CALLS[id] ?? DEFAULT_CALL;
    const rep = spec.rep ?? 1;
    return rep * (spec.dur + spec.dur * 0.45);
  },
  /** the audio pipeline calls this to swap a synth motif for a real recording */
  registerCall(id: string, buffer: AudioBuffer): void {
    sampleBuffers.set(id, buffer);
  },

  /** fetch + decode an audio file into a buffer (null if unavailable/offline) */
  async decode(url: string): Promise<AudioBuffer | null> {
    const a = ac();
    if (!a) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await a.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  },

  /**
   * Start a looping ambience bed, CROSSFADING out any current bed (W4.7a). A
   * biome crossing used to hard-cut (stop old + start new same instant → an
   * audible blip); now the outgoing bed fades out while the new one fades in
   * over `fade` s with equal power (no loudness dip). The first bed just fades
   * in from silence. Rapid re-crossings stop a still-fading bed immediately so
   * at most two sources ever run.
   */
  startAmbient(buffer: AudioBuffer, gain = 0.25, fade = AMBIENT_FADE): void {
    const a = ac();
    if (!a) return;
    const now = a.currentTime;

    // a bed still mid-fade from a previous rapid switch: retire it at once
    if (fading) { try { fading.src.stop(); } catch { /* already stopped */ } fading = null; }

    const prev = ambient;
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buffer;
    src.loop = true;
    src.connect(g);
    g.connect(a.destination);

    const steps = 32;
    if (a.state !== 'running' || fade <= 0) {
      // suspended context / no fade: set directly (a scheduled curve wouldn't run)
      g.gain.value = gain;
    } else {
      g.gain.setValueAtTime(0.0001, now);
      g.gain.setValueCurveAtTime(fadeInCurve(gain, steps), now, fade);
    }
    src.start(now);
    ambient = { src, gain: g };

    if (prev) {
      if (a.state !== 'running' || fade <= 0) {
        try { prev.src.stop(); } catch { /* already stopped */ }
      } else {
        const from = Math.max(prev.gain.gain.value, 0.0001);
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueCurveAtTime(fadeOutCurve(from, steps), now, fade);
        try { prev.src.stop(now + fade + 0.05); } catch { /* already stopped */ }
        fading = prev;
      }
    }
  },

  setAmbientGain(gain: number): void {
    const a = ac();
    if (!ambient) return;
    // a crossfade may have a value-curve scheduled; cancel it so the tweak sticks
    if (a) { ambient.gain.gain.cancelScheduledValues(a.currentTime); }
    ambient.gain.gain.value = gain;
  },

  stopAmbient(): void {
    if (fading) { try { fading.src.stop(); } catch { /* already stopped */ } fading = null; }
    if (!ambient) return;
    try { ambient.src.stop(); } catch { /* already stopped */ }
    ambient = null;
  },
};

/** Crossfade window (s) between ambience beds on a biome crossing. */
const AMBIENT_FADE = 1.5;
let ambient: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let fading: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
