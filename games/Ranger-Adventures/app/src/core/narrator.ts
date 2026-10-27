/**
 * narrator.ts — read-aloud, the SWAPPABLE voice layer (BUILD-PLAN §6 voice
 * decision). Since 2026-10-27 the voice is Benjamin's: clips recorded ahead of time
 * with ElevenLabs (core/voice.ts says how, `npm run voice` records them), played from
 * `public/voice/`. A text with a sentence not yet recorded falls back to the browser
 * (Web Speech, preferring the iPad's Enhanced Dutch voice "Xander"), as does a browser
 * that refuses to play the clip.
 *
 * Every text handed to the voice is announced as a `ranger:say` window event (its
 * spoken form, `forSpeech`), whichever voice says it: the e2e specs listen to that.
 *
 * iOS note: sound must be started from a user gesture; always pair an explicit
 * read-aloud button with any auto-speak attempt.
 */

import { assetUrl } from './assets';
import { forSpeech, voiceUnits, clipsFor, clipTiming, CLIP_GAP_MS, type Clip, type VoiceManifest } from './voice';

export { forSpeech } from './voice';

export interface Narrator {
  /** Say a new line: whatever is being said stops first. `onStart`: the voice is heard. */
  speak(text: string, opts?: { onStart?: () => void }): void;
  /** Say a line AFTER the one being said (an instruction, then the rule): never cuts it off. */
  queue(text: string, opts?: { onStart?: () => void }): void;
  stop(): void;
  /** Is the voice saying something now (or about to)? */
  busy(): boolean;
  /** Resolves once the voice is quiet (at most `maxMs` later): an animal call waits
   *  for the words instead of sounding over them. */
  quiet(maxMs?: number): Promise<void>;
  /** When each spoken word of `text` starts and when it ends (ms), if Benjamin's clips
   *  say it; null when the browser's voice would (then the word clock estimates). */
  timing(text: string): { starts: number[]; totalMs: number } | null;
  readonly available: boolean;
}

function chooseDutchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = voices.filter((v) => v.lang?.toLowerCase().startsWith('nl'));
  if (nl.length === 0) return null;
  // prefer an enhanced/premium Dutch voice (e.g. "Xander") — research "ship-now"
  const enhanced = nl.find((v) => /xander|enhanced|premium|natural|neural/i.test(v.name));
  return enhanced ?? nl[0];
}

/** One text waiting its turn: Benjamin's clips, or the browser's voice. */
interface Job { text: string; clips: Clip[] | null; onStart?: () => void }

const isDev = (): boolean => {
  try { return !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV; } catch { return false; }
};

class ClipNarrator implements Narrator {
  private voice: SpeechSynthesisVoice | null = null;
  private manifest: VoiceManifest | null = null;
  private audio: HTMLAudioElement | null = null;
  private jobs: Job[] = [];
  private job: Job | null = null;
  private clipIdx = 0;
  private gapTimer = 0;
  private synthTimer = 0;
  private missed = new Set<string>();

  get available(): boolean {
    return typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined');
  }

  constructor() {
    if (typeof window === 'undefined') return;
    if ('speechSynthesis' in window) {
      const pick = (): void => { this.voice = chooseDutchVoice(window.speechSynthesis.getVoices()); };
      pick();
      window.speechSynthesis.addEventListener('voiceschanged', pick);
    }
    if (typeof fetch === 'function') {
      fetch(assetUrl('voice/manifest.json'))
        .then((r) => (r.ok ? r.json() : null))
        .then((m: VoiceManifest | null) => { if (m?.clips) this.manifest = m; })
        .catch(() => { /* no clips: the browser's voice says everything */ });
    }
  }

  speak(text: string, opts: { onStart?: () => void } = {}): void {
    if (!this.available || !text) return;
    this.stop();
    this.queue(text, opts);
  }

  queue(text: string, opts: { onStart?: () => void } = {}): void {
    if (!this.available || !text) return;
    const spoken = forSpeech(text);
    if (!spoken) return;
    window.dispatchEvent(new CustomEvent('ranger:say', { detail: spoken }));
    const clips = typeof Audio !== 'undefined' ? clipsFor(this.manifest, spoken) : null;
    if (!clips) this.noteMissing(spoken);
    this.jobs.push({ text: spoken, clips, onStart: opts.onStart });
    if (!this.job) this.next();
  }

  stop(): void {
    this.jobs = [];
    this.job = null;
    if (this.gapTimer) { window.clearTimeout(this.gapTimer); this.gapTimer = 0; }
    if (this.synthTimer) { window.clearTimeout(this.synthTimer); this.synthTimer = 0; }
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  busy(): boolean {
    if (this.job || this.jobs.length) return true;
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    return !!synth && (synth.speaking || synth.pending);
  }

  quiet(maxMs = 6000): Promise<void> {
    if (!this.available) return Promise.resolve();
    const t0 = Date.now();
    return new Promise((resolve) => {
      const check = (): void => {
        if (!this.busy() || Date.now() - t0 >= maxMs) resolve();
        else window.setTimeout(check, 100);
      };
      check();
    });
  }

  timing(text: string): { starts: number[]; totalMs: number } | null {
    if (typeof Audio === 'undefined') return null;
    const clips = clipsFor(this.manifest, text);
    return clips ? clipTiming(clips) : null;
  }

  private next(): void {
    this.job = this.jobs.shift() ?? null;
    this.clipIdx = 0;
    if (!this.job) return;
    if (this.job.clips) this.playClip(this.job);
    else this.sayWithBrowser(this.job);
  }

  private done(job: Job): void {
    if (this.job !== job) return;
    this.job = null;
    this.next();
  }

  private playClip(job: Job): void {
    const clip = job.clips![this.clipIdx];
    const a = this.audio ?? (this.audio = new Audio());
    a.onended = () => {
      if (this.job !== job) return;
      this.clipIdx++;
      if (this.clipIdx >= job.clips!.length) { this.done(job); return; }
      this.gapTimer = window.setTimeout(() => { this.gapTimer = 0; if (this.job === job) this.playClip(job); }, CLIP_GAP_MS);
    };
    // a clip that cannot be played (not found, a browser that refuses sound before a
    // tap): the browser's voice says the rest of the text instead
    const fallBack = (): void => {
      if (this.job !== job) return;
      a.onended = null; a.onerror = null;
      const first = this.clipIdx === 0;
      const rest = voiceUnits(job.text).slice(this.clipIdx).join(' ');
      this.job = { text: rest, clips: null, onStart: first ? job.onStart : undefined };
      this.sayWithBrowser(this.job);
    };
    a.onerror = fallBack;
    a.src = assetUrl(`voice/${clip.f}`);
    const started = a.play();
    if (this.clipIdx === 0) {
      if (started && typeof started.then === 'function') started.then(() => { if (this.job === job) job.onStart?.(); }, fallBack);
      else job.onStart?.();
    } else if (started && typeof started.catch === 'function') started.catch(fallBack);
  }

  private sayWithBrowser(job: Job): void {
    const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    job.onStart?.();
    if (!synth) { this.done(job); return; }
    const u = new SpeechSynthesisUtterance(job.text);
    u.lang = 'nl-NL';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.96;
    u.pitch = 1.02;
    synth.speak(u);
    // the browser's own queue says it; the next job waits until it is quiet (its end
    // event is not reliable on every browser)
    const t0 = Date.now();
    const wait = (): void => {
      this.synthTimer = 0;
      if (this.job !== job) return;
      if ((synth.speaking || synth.pending) && Date.now() - t0 < 30_000) this.synthTimer = window.setTimeout(wait, 100);
      else this.done(job);
    };
    this.synthTimer = window.setTimeout(wait, 150);
  }

  /** In dev: a text Benjamin has no clips for goes on the dev server's list
   *  (scripts/voice-missed.txt) for the next `npm run voice`. */
  private noteMissing(text: string): void {
    if (!isDev() || this.missed.has(text)) return;
    this.missed.add(text);
    if (typeof fetch === 'function') {
      void fetch('/__voice-missed', { method: 'POST', body: text }).catch(() => { /* a preview build: no list */ });
    }
  }
}

export const narrator: Narrator = new ClipNarrator();
