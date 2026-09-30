/**
 * Speaker.ts — the speaker strip: a person in the world talks to the player (run 6,
 * FLOW lane P2). Today that is Bram, the warden by the missiebord.
 *
 * A calm paper strip at the bottom of the screen (above the one prompt slot) with his
 * drawn portrait, his name and ONE line at a time. Each line is read aloud with the
 * words lighting up (ReadAloud.mountReadAloud) and stays until the voice is done and a
 * reading time has passed (so it never flicks past with the voice off); then the next
 * line. Meanwhile Bram turns to the ranger with a speech mark over his head; far away he
 * talks over his portofoon (a small radio on the portrait).
 *
 * It never takes the keys: the player walks while Bram talks. It is part of the explore
 * HUD (`.explore-overlay`, never a menu, so `menuOpen()` stays false). When the HUD goes
 * (a menu card, a mission, the title), what is being said stops, and `say` resolves with
 * how many lines were said, so the caller can pick up where it stopped.
 */

import { store } from '../../core/state';
import { readingMs } from '../../core/lessons';
import { MENTOR_NAAM } from '../../content/mentor';
import { mountReadAloud } from '../ReadAloud';
import { session, esc, menuOpen } from '../flow/session';

/** What `say` resolves with: how many lines were said to the end, and whether all were. */
export interface SayResult { spoken: number; done: boolean }

/** Bram further than this (m): he talks over his portofoon. */
const RADIO_M = 16;
/** A breath between two lines (ms). */
const LINE_GAP_MS = 380;
/** However long the voice keeps going, a line moves on after its reading time plus this. */
const VOICE_CAP_MS = 7000;

interface Job {
  lines: string[];
  onLine?: (i: number) => void;
  resolve: (r: SayResult) => void;
}

let slot: HTMLElement | null = null;   // the HUD's teaching slot the strip lives in
let strip: HTMLElement | null = null;
let queue: Job[] = [];
let job: Job | null = null;
let lineIdx = 0;
let lineAt = 0;                         // when the current line started (ms)
let doneAt = 0;                         // when it had been read and heard (ms; 0: not yet)
let lineReadMs = 0;                     // its reading time (ms), worked out once a line
let raf = 0;

/** The drawn portrait of Bram: his green cap, his face, his uniform collar and badge. */
export const BRAM_PORTRAIT =
  '<svg class="sp-face" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
  '<circle cx="32" cy="32" r="32" fill="#dfe8d4"/>' +
  // shoulders + shirt
  '<path d="M8 64c2-12 12-17 24-17s22 5 24 17z" fill="#2f5b3a"/>' +
  '<path d="M25 47l7 7 7-7" fill="none" stroke="#1f3f28" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<circle cx="44" cy="55" r="3.2" fill="#e9c96a"/>' +
  // neck + face
  '<rect x="27.5" y="38" width="9" height="9" rx="3" fill="#e2b48f"/>' +
  '<ellipse cx="32" cy="30" rx="11.5" ry="13" fill="#efc6a2"/>' +
  '<ellipse cx="20.6" cy="31" rx="2.4" ry="3.4" fill="#e2b48f"/><ellipse cx="43.4" cy="31" rx="2.4" ry="3.4" fill="#e2b48f"/>' +
  // eyes, brows, smile
  '<circle cx="27.4" cy="30" r="1.7" fill="#3a2a1c"/><circle cx="36.6" cy="30" r="1.7" fill="#3a2a1c"/>' +
  '<path d="M24.6 26.4q2.8-1.6 5.4 0M34 26.4q2.8-1.6 5.4 0" fill="none" stroke="#7a5534" stroke-width="1.5" stroke-linecap="round"/>' +
  '<path d="M27.5 35.6q4.5 3.6 9 0" fill="none" stroke="#a0573e" stroke-width="1.8" stroke-linecap="round"/>' +
  // the ranger cap
  '<path d="M19.6 24.5c.6-8 5.6-12.5 12.4-12.5s11.8 4.5 12.4 12.5z" fill="#2f5b3a"/>' +
  '<path d="M17.5 24.2h29c1.4 0 1.4 2.8 0 2.8h-29c-1.4 0-1.4-2.8 0-2.8z" fill="#244a2f"/>' +
  '<circle cx="32" cy="18.6" r="2.4" fill="#e9c96a"/>' +
  '</svg>';

/** A small portofoon (walkie-talkie) badge on the portrait: Bram talks from afar. */
const RADIO_BADGE =
  '<svg class="sp-radio" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="12" fill="#fdfcf8"/>' +
  '<rect x="8" y="7.5" width="8" height="12" rx="2" fill="#2f5b3a"/>' +
  '<path d="M10 7.5V3.2" stroke="#2f5b3a" stroke-width="1.8" stroke-linecap="round"/>' +
  '<rect x="9.6" y="9.4" width="4.8" height="3.2" rx=".8" fill="#dfe8d4"/>' +
  '<circle cx="12" cy="16" r="1.3" fill="#dfe8d4"/>' +
  '</svg>';

/** Say `lines` in the strip, one after the other. Waits its turn behind a line already
 *  being said. Resolves when the last line has been said, or when it was stopped. */
export function say(lines: readonly string[], opts: { onLine?: (i: number) => void } = {}): Promise<SayResult> {
  return new Promise((resolve) => {
    queue.push({ lines: [...lines], onLine: opts.onLine, resolve });
    if (!job) next();
  });
}

/** Is something being said (or waiting to be)? */
export function speaking(): boolean {
  return !!job;
}

/** The line in the strip now (the dev hook reads it), or null. */
export function speakerLine(): string | null {
  return job ? job.lines[lineIdx] ?? null : null;
}

/** Stop whatever is being said (the HUD is going, a menu opened): every waiting `say`
 *  resolves with what was said so far. */
export function cancelSpeaker(): void {
  const all = job ? [job, ...queue] : queue;
  const said = lineIdx;
  job = null; queue = [];
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  // the voice is not stopped here: a menu that replaced the HUD has its own words, and
  // they already took the voice over
  hideStrip();
  all.forEach((j, i) => j.resolve({ spoken: i === 0 ? said : 0, done: false }));
}

/** (Re)attach the strip to the HUD's teaching slot: after the HUD is drawn afresh a line
 *  being said carries on where it is (it is never restarted). */
export function mountSpeaker(into: HTMLElement | null): void {
  slot = into;
  if (strip && slot && job) slot.appendChild(strip);
}

function next(): void {
  job = queue.shift() ?? null;
  lineIdx = 0;
  if (!job) { hideStrip(); return; }
  startLine();
  if (!raf) raf = requestAnimationFrame(tick);
}

function startLine(): void {
  if (!job) return;
  const text = job.lines[lineIdx];
  lineAt = performance.now();
  doneAt = 0;
  lineReadMs = readingMs(text);
  const radio = (session.world?.wardenDistance() ?? 0) > RADIO_M;
  showStrip(text, radio);
  session.world?.setWardenTalking(true, !radio); // over the portofoon: no speech mark
  job.onLine?.(lineIdx);
}

function tick(now: number): void {
  raf = 0;
  if (!job) return;
  // the HUD went (a menu card replaced it, a mission, the title), or a veil is up: stop
  if (!strip?.isConnected || menuOpen()) { cancelSpeaker(); return; }
  const t = now - lineAt;
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const voiceBusy = !!synth && store.get().settings.voorlezen && (synth.speaking || synth.pending);
  const read = lineReadMs;
  // a line is done once it has been up its reading time and the voice is quiet (or it
  // kept going far too long); then a breath, then the next line
  if (!doneAt && t >= read && (!voiceBusy || t >= read + VOICE_CAP_MS)) doneAt = now;
  if (doneAt && now - doneAt >= LINE_GAP_MS) {
    lineIdx++;
    if (lineIdx >= job.lines.length) {
      const j = job;
      job = null;
      hideStrip();
      j.resolve({ spoken: j.lines.length, done: true });
      if (queue.length) next();
      return;
    }
    startLine();
  }
  raf = requestAnimationFrame(tick);
}

function showStrip(text: string, radio: boolean): void {
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'speaker-strip';
    strip.setAttribute('role', 'status');
    strip.setAttribute('aria-live', 'polite');
    strip.innerHTML =
      `<span class="sp-portrait">${BRAM_PORTRAIT}${RADIO_BADGE}</span>` +
      `<span class="sp-body"><span class="sp-name">${esc(MENTOR_NAAM)}</span><span class="sp-line"></span></span>`;
  }
  if (slot && strip.parentElement !== slot) slot.appendChild(strip);
  strip.classList.toggle('sp-on-radio', radio);
  strip.classList.remove('sp-leaving');
  const line = strip.querySelector<HTMLElement>('.sp-line')!;
  // a fresh line eases in (a quick fade, none under reduced motion: .rm)
  line.classList.remove('sp-line-in');
  void line.offsetWidth;
  line.classList.add('sp-line-in');
  mountReadAloud({ textEl: line, text, autoStart: store.get().settings.voorlezen });
}

function hideStrip(): void {
  session.world?.setWardenTalking(false);
  const s = strip;
  strip = null;
  if (!s) return;
  if (!s.isConnected) { s.remove(); return; }
  s.classList.add('sp-leaving');
  window.setTimeout(() => s.remove(), 180);
}
