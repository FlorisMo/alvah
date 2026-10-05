/**
 * sound.ts — minimal WebAudio cues for dual-channel feedback (colour + sound;
 * Alvah profile, BUILD-PLAN §3 / memory: never colour alone). A small placeholder
 * for the full recipe set in prototype/sound.jsx, ported later. Callers gate on
 * settings.geluid. The AudioContext is made behind the boot veil (`prepare`: it waits
 * suspended) and resumed inside the first tap (`unlock`: the autoplay rule, iOS too).
 * Making it inside the Begin tap held the picture for up to ~2 s: the constructor is
 * slow. Made lazily if nothing prepared it.
 */

import { fadeInCurve, fadeOutCurve, callWindow, callGain, placeCall } from './audiofade';

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let primed = false; // a sound has been started inside a tap (older iOS needs one)

/** The context, made if there is none yet (suspended until a tap resumes it). */
function made(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  } catch {
    return null;
  }
}

function ac(): AudioContext | null {
  const c = made();
  // before any tap the browser keeps it suspended: the promise just waits (never an error)
  if (c && c.state === 'suspended') {
    try { void (c.resume() as Promise<void> | undefined)?.catch(() => {}); } catch { /* an old WebKit */ }
  }
  return c;
}

/**
 * A short decaying filtered-noise burst — the body of a footstep (W4.7b). The
 * noise is generated with a tiny deterministic LCG (stable across frames, no
 * `Math.random`) and shaped by a biquad so sand reads muffled (lowpass) and
 * grass reads as a soft brighter swish (bandpass).
 */
function noiseBurst(dur: number, filter: BiquadFilterType, cutoff: number, q: number, peak: number, delay = 0, dest?: AudioNode): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = ((seed / 0x7fffffff) * 2 - 1) * (1 - i / n); // white noise with a linear decay
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = filter;
  filt.frequency.value = cutoff;
  filt.Q.value = q;
  const gain = a.createGain();
  gain.gain.value = peak;
  src.connect(filt);
  filt.connect(gain);
  gain.connect(dest ?? a.destination);
  src.start(t0);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number, dest?: AudioNode, sweep = 1): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep !== 1) osc.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(dest ?? a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/**
 * A soft pig "knor": a low, warm, filtered buzz with a gentle pulse, gliding down a
 * little — the wild boar's call. (The recorded boar clip read as a dinosaur roar to a
 * child tester, child:B1, so the boar speaks with this calm synth instead.)
 */
function knor(freq: number, start: number, dur: number, peak: number, dest: AudioNode): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.linearRampToValueAtTime(freq * 0.82, t0 + dur);
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 520;
  filt.Q.value = 0.8;
  const pulse = a.createGain(); // the grunt's soft flutter
  pulse.gain.value = 0.6;
  const lfo = a.createOscillator();
  lfo.frequency.value = 24;
  const lfoDepth = a.createGain();
  lfoDepth.gain.value = 0.4;
  lfo.connect(lfoDepth);
  lfoDepth.connect(pulse.gain);
  const env = a.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.05);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(pulse);
  pulse.connect(env);
  env.connect(dest);
  osc.start(t0); lfo.start(t0);
  osc.stop(t0 + dur + 0.03); lfo.stop(t0 + dur + 0.03);
}

/**
 * Run 7 (ven-life): a mallard's soft "kwak" — a nasal buzz (a sawtooth through a narrow
 * band-pass round its formant), falling a little, with a quick soft start and end. Quiet:
 * a duck on the far side of the water, never a horn.
 */
function quack(freq: number, start: number, dur: number, peak: number, dest: AudioNode, sweep = 0.8): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
  const filt = a.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1150;
  filt.Q.value = 2.2;
  const env = a.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.018);
  env.gain.setValueAtTime(peak, t0 + dur * 0.55);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/**
 * Run 7 (the ven): a moor frog's soft "woog" — a low round note bubbling (a quick flutter,
 * as a bottle emptying under water), rising a little, through a soft lowpass. Calm and
 * small: a frog, never a horn.
 */
function woog(freq: number, start: number, dur: number, peak: number, dest: AudioNode, sweep = 1.18): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 950;
  filt.Q.value = 0.7;
  const pulse = a.createGain(); // the bubbling flutter
  pulse.gain.value = 0.55;
  const lfo = a.createOscillator();
  lfo.frequency.value = 38;
  const lfoDepth = a.createGain();
  lfoDepth.gain.value = 0.45;
  lfo.connect(lfoDepth);
  lfoDepth.connect(pulse.gain);
  const env = a.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.035);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(pulse);
  pulse.connect(env);
  env.connect(dest);
  osc.start(t0); lfo.start(t0);
  osc.stop(t0 + dur + 0.03); lfo.stop(t0 + dur + 0.03);
}

/**
 * Per-animal call motifs — synthesized placeholders, distinct enough that the
 * simon (sound-echo) engine is learnable by ear. The audio pipeline
 * (scripts/audio-fetch.mjs → xeno-canto/Freesound) registers real recorded
 * calls via registerCall(); when a real sample is present it wins, so wiring in
 * real audio is zero-rework. dur ≈ how long the call rings (seconds).
 */
// `notes` (when present) plays that pitch SEQUENCE instead of `rep` copies of
// `freq` — the way to synth a call with distinct successive pitches (koekoek's
// hoog→laag, koolmees' ti-ta-ti-ta) so "Ken je roep" (W6.4) is learnable by ear.
interface CallSpec { freq: number; dur: number; type: OscillatorType; vibrato?: number; rep?: number; notes?: number[]; knor?: boolean; sweep?: number; peak?: number; drum?: number; woog?: boolean; hiss?: boolean; quack?: boolean }
const CALLS: Record<string, CallSpec> = {
  edelhert:   { freq: 150, dur: 0.7,  type: 'sawtooth', vibrato: 6 },   // burlen — deep bellow
  ree:        { freq: 420, dur: 0.22, type: 'square',   rep: 2 },        // blaf — short bark
  wildzwijn:  { freq: 120, dur: 0.3,  type: 'sawtooth', rep: 2, knor: true }, // knor-knor — a soft grunt
  frisling:   { freq: 520, dur: 0.18, type: 'square',   rep: 3 },        // piglet squeak
  // run 6 (the adventures): a lost piglet's thin squeak, "wiek-wiek", rising, soft — and
  // a sow's happy grunting when her piglet is back, higher and softer than her warning
  piep:       { freq: 980, dur: 0.13, type: 'sine', notes: [980, 1150], sweep: 1.45, peak: 0.12 },
  'knor-blij':{ freq: 165, dur: 0.16, type: 'sawtooth', rep: 4, knor: true, peak: 0.26 },
  // a roe calf's thin "fiep" for its mother: high, short, soft
  fiep:       { freq: 1320, dur: 0.11, type: 'sine', notes: [1320, 1240], sweep: 0.86, peak: 0.08 },
  raaf:       { freq: 280, dur: 0.34, type: 'sawtooth', rep: 2 },        // kroa — diep en laag
  das:        { freq: 240, dur: 0.28, type: 'triangle', rep: 2 },        // churr
  // run 7 (the wildcamera's night choir): a fox's short rising yelp, "wiek-wiek" — high and
  // rising where the roe's bark is a low flat square tone, so the two never sound alike
  vos:        { freq: 640, dur: 0.22, type: 'triangle', notes: [640, 900], sweep: 1.4, peak: 0.18 },
  nachtzwaluw:{ freq: 600, dur: 0.6,  type: 'triangle', vibrato: 22 },   // ratel — churring trill
  eekhoorn:   { freq: 760, dur: 0.16, type: 'square',   rep: 3 },        // chatter
  wolf:       { freq: 330, dur: 0.8,  type: 'sine',     vibrato: 3 },     // howl
  // W6.4b1 "Ken je roep" vogelroepen — onmiskenbaar uit elkaar te houden motieven,
  // per dossier-omschrijving (research/bird-visual-accuracy.md). Echte opnamen
  // winnen straks via registerCall (zero-rework).
  koekoek:       { freq: 540, dur: 0.26, type: 'sine',     notes: [560, 420] },              // koe-koek: hoog dan laag
  merel:         { freq: 900, dur: 0.46, type: 'sine',     vibrato: 10 },                     // mooi fluitliedje
  roodborsttapuit:{ freq: 1650, dur: 0.05, type: 'square', notes: [1650, 1650] },             // tik tik — twee steentjes
  'groene-specht':{ freq: 760, dur: 0.12, type: 'triangle', notes: [820, 760, 700, 650] },    // kju-kju — een lachje
  koolmees:      { freq: 1150, dur: 0.11, type: 'square',  notes: [1150, 820, 1150, 820] },    // ti-ta ti-ta — een pompje
  // run 7 (the open world's surprises): the buzzard's mew, "piieeuw", a soft falling
  // whistle twice; the great spotted woodpecker's drumming, a quick soft roll of knocks
  buizerd:       { freq: 1650, dur: 0.78, type: 'sine', rep: 2, sweep: 0.62, peak: 0.07 },
  specht:        { freq: 1300, dur: 0.75, type: 'triangle', drum: 15, peak: 0.09 },
  // run 7 (frisling body): a woodlark flushed from the heather, its soft falling "lu-lu-lu"
  boomleeuwerik: { freq: 2350, dur: 0.09, type: 'sine', notes: [2350, 2260, 2170, 2080, 1990, 1900, 1820], sweep: 0.97, peak: 0.06 },
  // run 7 (the squirrel's neighbours): the great spotted woodpecker on its bark drums a
  // roll; the nuthatch's "tuuit tuuit tuuit", three clear whistles each rising — a sound
  // of its own beside the great tit's "ti-ta" (the two never call together)
  'grote-bonte-specht': { freq: 1250, dur: 0.8, type: 'triangle', drum: 16, peak: 0.1 },
  boomklever:    { freq: 1250, dur: 0.15, type: 'sine', notes: [1250, 1250, 1250], sweep: 1.45, peak: 0.13 },
  // run 7 (the ven): the moor frog's soft bubbling "woog woog woog", low and round, each a
  // little higher; the adder's soft short hiss (band-passed air, quiet, never sharp)
  heikikker:     { freq: 430, dur: 0.17, type: 'sine', notes: [430, 455, 440], sweep: 1.2, peak: 0.2, woog: true },
  adder:         { freq: 3400, dur: 0.5, type: 'sine', peak: 0.045, hiss: true },
  // run 7 (ven-life): a mallard duck's soft "kwak kwak" — a short nasal note falling a
  // little, twice, through a soft band-pass: a duck chatting to her ducklings, never loud
  eend:          { freq: 360, dur: 0.15, type: 'sawtooth', notes: [370, 340], sweep: 0.8, peak: 0.07, quack: true },
  // run 7 (stille-zand): a nightjar's wing clap in its display flight at dusk — a short,
  // soft, dry clap (band-passed air, never sharp)
  vleugelklap:   { freq: 1500, dur: 0.07, type: 'sine', peak: 0.09, hiss: true },
};
const DEFAULT_CALL: CallSpec = { freq: 440, dur: 0.3, type: 'sine', rep: 2 };

/** The longest a call may ring (s): one short snippet, never a whole recording. */
const CALL_MAX_S = 1.6;
/** Soft edges of a call snippet (s): in, out, and the quick fade of a call cut short. */
const CALL_FADE_IN = 0.03;
const CALL_FADE_OUT = 0.25;
const CALL_CUT = 0.08;

/** A recorded call, trimmed to its calm snippet and levelled (see `callWindow`). */
interface CallSample { buffer: AudioBuffer; offset: number; dur: number; gain: number }

/** Real recorded calls keyed by animal id — populated at runtime by the audio layer. */
const sampleBuffers = new Map<string, CallSample>();

/** The call that is sounding now: at most ONE at a time (child:B1). */
let currentCall: { bus: GainNode; sources: AudioScheduledSourceNode[] } | null = null;

/** Fade the sounding call out quickly and let it go. */
function stopCurrentCall(a: AudioContext): void {
  const c = currentCall;
  currentCall = null;
  if (!c) return;
  const now = a.currentTime;
  try {
    c.bus.gain.cancelScheduledValues(now);
    c.bus.gain.setValueAtTime(c.bus.gain.value, now);
    c.bus.gain.linearRampToValueAtTime(0, now + CALL_CUT);
    for (const src of c.sources) src.stop(now + CALL_CUT + 0.02);
  } catch { /* already stopped */ }
}

/** A woodpecker's drumming: `spec.drum` soft knocks in `spec.dur` s, a little quicker in
 *  the middle and fading at the end (filtered noise for the wood, a short low tone for the
 *  trunk). No Math.random: the knocks are evenly shaped. */
function drumRoll(spec: CallSpec, bus: AudioNode): void {
  const n = spec.drum ?? 12;
  const peak = spec.peak ?? 0.08;
  let t = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const g = peak * (1 - 0.55 * u);
    noiseBurst(0.026, 'bandpass', spec.freq, 2.4, g, t, bus);
    tone(spec.freq * 0.32, t, 0.035, 'triangle', g * 0.5, bus);
    t += (spec.dur / n) * (1.12 - 0.3 * Math.sin(Math.PI * u)); // quicker in the middle of the roll
  }
}

function playCall(id: string, out?: AudioNode, max?: number): number {
  const a = ac();
  if (!a) return 0.3;
  stopCurrentCall(a); // one animal at a time: a new call gently ends the last one
  const bus = a.createGain();
  bus.connect(out ?? a.destination);
  const dur = playCallOn(a, bus, id);
  // run 7 (additive): held to `max` s — the rest fades out softly, as a call cut short
  if (max !== undefined && dur > max) {
    const t0 = a.currentTime;
    bus.gain.setValueAtTime(1, t0 + Math.max(0, max - CALL_CUT));
    bus.gain.linearRampToValueAtTime(0, t0 + max);
    return max;
  }
  return dur;
}

function playCallOn(a: AudioContext, bus: GainNode, id: string): number {
  const sample = sampleBuffers.get(id);
  if (sample) {
    const t0 = a.currentTime;
    const { dur } = sample;
    const src = a.createBufferSource();
    src.buffer = sample.buffer;
    const env = a.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(sample.gain, t0 + CALL_FADE_IN);
    env.gain.setValueAtTime(sample.gain, t0 + Math.max(CALL_FADE_IN, dur - CALL_FADE_OUT));
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(env);
    env.connect(bus);
    src.start(t0, sample.offset, dur);
    currentCall = { bus, sources: [src] };
    return dur;
  }
  const spec = CALLS[id] ?? DEFAULT_CALL;
  if (spec.drum) {
    drumRoll(spec, bus);
    currentCall = { bus, sources: [] };
    return spec.dur;
  }
  if (spec.hiss) {
    noiseBurst(spec.dur, 'bandpass', spec.freq, 1.3, spec.peak ?? 0.05, 0, bus);
    currentCall = { bus, sources: [] };
    return spec.dur;
  }
  const gap = spec.dur * 0.45;
  // a pitch SEQUENCE (koekoek/koolmees/…) plays each note in turn; otherwise `rep`
  // copies of the one pitch (with a small warble when `vibrato` is set).
  const notes = spec.notes ?? Array.from({ length: spec.rep ?? 1 }, () => spec.freq);
  notes.forEach((freq, i) => {
    const start = i * (spec.dur + gap);
    if (spec.woog) {
      woog(freq, start, spec.dur, spec.peak ?? 0.2, bus, spec.sweep ?? 1.18);
    } else if (spec.quack) {
      quack(freq, start, spec.dur, spec.peak ?? 0.07, bus, spec.sweep ?? 0.8);
    } else if (spec.knor) {
      knor(freq * (i % 2 ? 0.92 : 1), start, spec.dur, spec.peak ?? 0.4, bus);
    } else if (spec.vibrato) {
      // a small warble for the trilling/bellowing/singing calls
      tone(freq, start, spec.dur, spec.type, 0.16, bus);
      tone(freq * 1.04, start + 0.03, spec.dur, spec.type, 0.08, bus);
    } else {
      tone(freq, start, spec.dur, spec.type, spec.peak ?? 0.16, bus, spec.sweep ?? 1);
    }
  });
  currentCall = { bus, sources: [] };
  return notes.length * (spec.dur + gap);
}

export const Sound = {
  /** Make the AudioContext before any tap, while nothing moves on screen (the boot veil):
   *  it waits suspended until `unlock`. */
  prepare(): void {
    made();
  },
  /** Resume the AudioContext from a user gesture (the autoplay rule, iOS too); the first
   *  time also start a silent sample, which older iOS needs to let sound out. */
  unlock(): void {
    const a = ac();
    if (!a || primed) return;
    try {
      const s = a.createBufferSource();
      s.buffer = a.createBuffer(1, 1, 22050);
      s.connect(a.destination);
      s.start(0);
      primed = true;
    } catch { /* no sound is fine */ }
  },
  /** success "sings" — a gentle rising two-note */
  found(): void {
    tone(660, 0, 0.16, 'sine', 0.18);
    tone(880, 0.12, 0.22, 'sine', 0.18);
  },
  /** run 7: something new in his veldgids — a soft high two-note chime, much quieter than
   *  `found` (it comes in the open world, never as a prize) */
  reveal(): void {
    tone(1047, 0, 0.42, 'sine', 0.05);
    tone(1568, 0.16, 0.6, 'sine', 0.04);
    tone(3136, 0.16, 0.3, 'sine', 0.008); // (a faint shimmer on the second note)
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
  /**
   * A soft surface-aware footstep (W4.7b). Sand is a muffled low thud (lowpass
   * noise + a low body tone); grass is a lighter, slightly brighter swish. Kept
   * quiet on purpose — ambient locomotion feedback, never a foreground cue.
   * Running (run 6), each step is a touch shorter and lighter: quick, light feet.
   */
  footstep(surface: 'zand' | 'gras', brisk = false): void {
    const len = brisk ? 0.72 : 1; // shorter
    const lift = brisk ? 1.18 : 1; // a little brighter
    if (surface === 'zand') {
      noiseBurst(0.14 * len, 'lowpass', 900 * lift, 0.7, 0.06);
      tone(76 * lift, 0, 0.09 * len, 'sine', 0.05);
    } else {
      noiseBurst(0.09 * len, 'bandpass', 2600 * lift, 0.8, 0.05);
      tone(120 * lift, 0, 0.05 * len, 'sine', 0.035);
    }
  },
  /**
   * Start the jeep's soft engine loop (W5.2). Two detuned sawtooths through a
   * lowpass make a low, warm idle — deliberately quiet (ambient feel, never a
   * foreground drone). Idempotent; the caller gates on `settings.geluid` and the
   * AudioContext is unlocked by the Space-to-enter gesture. `engineSet` revs it
   * with speed; `engineStop` fades it out on step-out.
   */
  engineStart(): void {
    const a = ac();
    if (!a || engine) return;
    const osc = a.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 58;
    const osc2 = a.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = 87;
    const filt = a.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 300; filt.Q.value = 0.6;
    const gain = a.createGain(); gain.gain.value = 0.0001;
    osc.connect(filt); osc2.connect(filt); filt.connect(gain); gain.connect(a.destination);
    osc.start(); osc2.start();
    engine = { osc, osc2, filt, gain };
  },
  /** Rev the engine loop by the drive fraction (|speed|/maxSpeed, 0..1): a touch
   *  louder + higher + brighter with throttle. Smooth ramps so it never clicks.
   *  No-op if the loop is not running (e.g. sound was off at step-in). */
  engineSet(speedFrac: number): void {
    const a = ac();
    if (!a || !engine) return;
    const f = speedFrac < 0 ? 0 : speedFrac > 1 ? 1 : speedFrac;
    const now = a.currentTime;
    engine.gain.gain.setTargetAtTime(0.03 + 0.05 * f, now, 0.08);
    engine.osc.frequency.setTargetAtTime(58 + 26 * f, now, 0.12);
    engine.osc2.frequency.setTargetAtTime(87 + 39 * f, now, 0.12);
    engine.filt.frequency.setTargetAtTime(300 + 500 * f, now, 0.12);
  },
  /** Fade out + stop the engine loop (step-out / dispose). Safe if not running. */
  engineStop(): void {
    if (!engine) return;
    const a = ac();
    try {
      const now = a ? a.currentTime : 0;
      if (a) { engine.gain.gain.cancelScheduledValues(now); engine.gain.gain.setTargetAtTime(0.0001, now, 0.05); }
      engine.osc.stop(now + 0.2);
      engine.osc2.stop(now + 0.2);
    } catch { /* already stopped */ }
    engine = null;
  },

  /** play an animal's call; returns its duration (s) so the caller can time the sequence */
  call(id: string): number {
    return playCall(id);
  },
  /**
   * An animal's call from where it is in the world (run 6): panned by its bearing from
   * the listener (the lens: where it stands and the heading it looks along), at most
   * ±0.8, and softer further away — full within 3 m, soft at 15 m, silent past 25 m
   * (past `reach` m: a call a story wants followed from far off carries further).
   * One call at a time, like `call`. Returns its duration (s), 0 when out of earshot.
   */
  callAt(id: string, x: number, z: number, listener: { x: number; z: number; yaw: number }, reach = 25, max?: number): number {
    const a = ac();
    if (!a) return 0;
    const { pan, gain } = placeCall(x, z, listener, reach);
    if (gain <= 0.01) return 0;
    const g = a.createGain();
    g.gain.value = gain;
    const p = typeof a.createStereoPanner === 'function' ? a.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(a.destination); } else g.connect(a.destination);
    return playCall(id, g, max);
  },
  /** leaves and stems moving: a short, soft, band-passed rustle */
  rustle(): void {
    noiseBurst(0.32, 'bandpass', 2600, 0.7, 0.07);
    noiseBurst(0.12, 'highpass', 4800, 0.5, 0.025, 0.09);
    noiseBurst(0.1, 'highpass', 4200, 0.5, 0.02, 0.2);
  },
  /** a boot in a shallow wet pool: a soft low plash and a few drips after it */
  splash(): void {
    noiseBurst(0.34, 'lowpass', 900, 0.8, 0.12);
    noiseBurst(0.22, 'bandpass', 2100, 1.2, 0.05, 0.05);
    for (let i = 0; i < 3; i++) noiseBurst(0.05, 'bandpass', 2600 + i * 500, 3, 0.025, 0.32 + i * 0.17);
  },
  /** run 7 (the ven): a boot sinking into soft wet moss — a low soft suck and a slurp */
  squelch(): void {
    noiseBurst(0.3, 'lowpass', 360, 1.1, 0.13);
    tone(170, 0.03, 0.2, 'sine', 0.05, undefined, 0.62);
    noiseBurst(0.12, 'bandpass', 900, 2.2, 0.035, 0.16);
  },
  /** run 7 (the ven): a small frog into the water — a soft round "plop" and a few drips */
  plop(): void {
    tone(780, 0, 0.09, 'sine', 0.09, undefined, 0.42);
    noiseBurst(0.16, 'lowpass', 1100, 0.9, 0.05, 0.02);
    for (let i = 0; i < 2; i++) noiseBurst(0.04, 'bandpass', 2400 + i * 600, 3, 0.018, 0.22 + i * 0.15);
  },
  /** a snout at the ground: three quick, soft sniffs */
  sniff(): void {
    for (let i = 0; i < 3; i++) noiseBurst(0.06, 'highpass', 1700, 0.6, 0.05, i * 0.13);
  },
  /** turned earth: a low soft thud and a crumble */
  dig(): void {
    noiseBurst(0.18, 'lowpass', 420, 0.7, 0.09);
    noiseBurst(0.14, 'bandpass', 1400, 0.8, 0.035, 0.07);
  },
  /** a strap pulled tight round a trunk, and the buckle's click */
  strap(): void {
    noiseBurst(0.26, 'bandpass', 1800, 1.2, 0.05);
    noiseBurst(0.03, 'highpass', 3200, 0.8, 0.06, 0.3);
    tone(900, 0.31, 0.03, 'triangle', 0.06);
  },
  /** a trail camera's soft shutter click */
  shutter(): void {
    noiseBurst(0.03, 'highpass', 3000, 0.7, 0.06);
    noiseBurst(0.04, 'bandpass', 2000, 0.9, 0.05, 0.07);
  },
  /** the duration (s) of an animal's call — for scheduling the listen phase (run 7,
   *  additive: held to `max` s, as `callAt` holds it) */
  callDur(id: string, max?: number): number {
    const sample = sampleBuffers.get(id);
    const spec = CALLS[id] ?? DEFAULT_CALL;
    const d = sample ? sample.dur : spec.drum ? spec.dur : (spec.notes?.length ?? spec.rep ?? 1) * (spec.dur + spec.dur * 0.45);
    return max !== undefined ? Math.min(d, max) : d;
  },
  /** the audio pipeline calls this to swap a synth motif for a real recording:
   *  it keeps only the calm snippet of the recording, levelled (child:B1) */
  registerCall(id: string, buffer: AudioBuffer): void {
    const w = callWindow(buffer.getChannelData(0), buffer.sampleRate, CALL_MAX_S);
    sampleBuffers.set(id, { buffer, offset: w.offset, dur: w.dur, gain: callGain(w) });
  },
  /** fade out the call that is sounding (a game step ends) */
  stopCall(): void {
    const a = ac();
    if (a) stopCurrentCall(a);
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
/** The W5.2 jeep engine loop while driving — at most one runs. */
let engine: { osc: OscillatorNode; osc2: OscillatorNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
