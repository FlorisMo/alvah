/**
 * ReadAloud.ts — the shared read-aloud helper (BUILD-PLAN §6 / §3, ledger 97b).
 *
 * One place that pairs the swappable `narrator` voice with the pure karaoke
 * `wordclock` core (97a): it renders the spoken line(s) as per-word spans in the
 * accessible DOM card, speaks them, and drives a rAF highlight off our own clock
 * (iOS Safari's `onboundary` is unreliable — see wordclock.ts). The current word
 * gets `.ra-word.is-spoken`; under reduced-motion the CSS keeps only the colour
 * swap (no transition/scale — base.css `.rm *` neutralises durations globally).
 *
 * Calm by construction: at most one word highlighted, no flashing, the highlight
 * simply walks the sentence and clears when the line ends (never-scary §B).
 *
 * Used across the Missions read-aloud screens (briefing/veldnotitie, feit,
 * reward, ontknoping, wildcam, worldbeat) in place of the ad-hoc
 * `narrator.speak(text)` + bare `<p>` pattern. A multi-line screen (the briefing)
 * passes one segment per line; the spans share one continuous clock so the
 * highlight flows across the lines exactly as the voice does.
 */

import './readaloud.css';
import { narrator } from '../core/narrator';
import { buildWordClock, activeWordAt, type WordClock } from '../core/wordclock';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Tokenise exactly like buildWordClock so span index === WordSpan.index. */
function tokenize(text: string): string[] {
  return (text ?? '').trim().split(/\s+/).filter((t) => t.length > 0);
}

/** One line of the read-aloud card: an element to fill + the text it carries. */
export interface ReadAloudSegment {
  el: HTMLElement;
  text: string;
}

export interface ReadAloudHandle {
  /** (Re)start: speak the line(s) and run the karaoke highlight from the top. */
  speak(): void;
  /** Stop speech, cancel the rAF loop, clear the highlight. Idempotent. */
  stop(): void;
}

export interface ReadAloudOptions {
  /** Single-element case: the element to fill with spans + the line to read. */
  textEl?: HTMLElement;
  text?: string;
  /** Multi-line case (e.g. the briefing): one segment per line, spoken in order. */
  segments?: ReadAloudSegment[];
  /** Spoken BEFORE the segments but not rendered as spans (e.g. the briefing's
   *  personalised "Ranger Alvah." greeting + title). The clock accounts for it,
   *  so the visible highlight starts on the first body word at the right moment. */
  lead?: string;
  /** Spoken AFTER the segments but not rendered as spans (e.g. the reward's knap
   *  woord and the way on). The highlight simply rests once the segments end. */
  trail?: string;
  /** Optional 🔊 button — clicking it always (re)speaks, even if voorlezen is off. */
  speakBtn?: Element | null;
  /** Speak immediately on mount (the caller passes the `voorlezen` setting). */
  autoStart?: boolean;
}

/**
 * Render the line(s) as karaoke word-spans, wire the speak button, and
 * (optionally) start reading. Returns a handle so the screen can `stop()` on
 * navigation — exactly where it used to call `narrator.stop()`.
 */
export function mountReadAloud(opts: ReadAloudOptions): ReadAloudHandle {
  const segments: ReadAloudSegment[] =
    opts.segments ?? (opts.textEl ? [{ el: opts.textEl, text: opts.text ?? '' }] : []);

  // Render every segment's spans with a single continuous index space (offset by
  // the unspoken-but-counted `lead`), so the clock built from the joined text
  // lines up token-for-token. `spans` is keyed by GLOBAL token index, so a lead
  // word (idx < leadCount) simply has no span → it's spoken, never highlighted.
  const leadCount = tokenize(opts.lead ?? '').length;
  const spans: (HTMLElement | undefined)[] = [];
  let running = leadCount;
  for (const seg of segments) {
    const tokens = tokenize(seg.text);
    seg.el.innerHTML = tokens
      .map((tok, i) => `<span class="ra-word" data-i="${running + i}">${esc(tok)}</span>`)
      .join(' ');
    seg.el.querySelectorAll<HTMLElement>('.ra-word').forEach((node, i) => {
      spans[running + i] = node;
    });
    running += tokens.length;
  }
  // Joined exactly as the spans concatenate (single spaces) → identical tokens.
  const fullText = [opts.lead, ...segments.map((s) => s.text), opts.trail]
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join(' ');

  let clock: WordClock | null = null;
  let raf = 0;
  let startMs = 0;
  let current = -1;

  const clearHighlight = (): void => {
    if (current >= 0) spans[current]?.classList.remove('is-spoken');
    current = -1;
  };

  const setActive = (idx: number): void => {
    if (idx === current) return;
    if (current >= 0) spans[current]?.classList.remove('is-spoken');
    if (idx >= 0) spans[idx]?.classList.add('is-spoken');
    current = idx;
  };

  const tick = (now: number): void => {
    if (!clock) return;
    setActive(activeWordAt(clock, now - startMs));
    if (now - startMs >= clock.totalMs) {
      clearHighlight();
      raf = 0;
      return; // clock done — speech may trail a touch, but the highlight rests
    }
    raf = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    narrator.stop();
    clearHighlight();
  };

  const speak = (): void => {
    stop();
    if (!fullText) return;
    narrator.speak(fullText);
    // The clock is tuned to the narrator's calm ~0.96 rate (wordclock.ts), so
    // build at the default rate — no double-scaling.
    clock = buildWordClock(fullText);
    const hasRaf = typeof requestAnimationFrame === 'function' && typeof performance !== 'undefined';
    if (!hasRaf || clock.totalMs <= 0) return; // speech still happens; just no karaoke
    startMs = performance.now();
    raf = requestAnimationFrame(tick);
  };

  opts.speakBtn?.addEventListener('click', speak);
  if (opts.autoStart) speak();

  return { speak, stop };
}

/* ------------------------------------------------------ a screen read aloud ---- */


/**
 * A 🔊 "Lees voor" button beside `target` (child:B12): in the target's `.ra-row` when
 * it sits in one, else in a new row that takes the target's place (the target moves
 * into it, its listeners stay). Returns the button, or null without a target.
 */
export function speakButtonBeside(target: Element | null): HTMLButtonElement | null {
  if (!target?.parentElement) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ra-say';
  btn.setAttribute('aria-label', 'Lees voor');
  btn.textContent = '🔊';
  const row = target.parentElement.classList.contains('ra-row') || target.parentElement.classList.contains('ra-say-row')
    ? target.parentElement
    : null;
  if (row) { row.insertBefore(btn, target); return btn; }
  const wrap = document.createElement('div');
  wrap.className = 'ra-say-row';
  target.parentElement.insertBefore(wrap, target);
  wrap.append(btn, target);
  return btn;
}

export interface ScreenAloudOptions {
  /** What the screen says: its heading and what the primary action does. */
  text: string;
  /** The element the 🔊 sits beside (default: the screen's primary button). */
  anchor?: string;
  /** Say it once as the screen opens (the caller passes the `voorlezen` setting). */
  autoStart?: boolean;
  /** Items (mission cards, menu choices) that say their own words when focused with
   *  the keyboard or when the mouse rests on them — only while `hover` is on. */
  items?: string;
  itemText?: (item: HTMLElement) => string;
  hover?: boolean;
}

/** How long the mouse rests on an item before it is read (no chatter while moving). */
const HOVER_DWELL_MS = 450;

/**
 * Read a whole screen aloud (child:B12): the title, the ranger maker, Pauze, the
 * missiebord, the reward card. A 🔊 beside the primary action says `text` at any
 * time; the screen says it once when it opens; each item says its own words on focus
 * or hover. Returns a handle so the screen can `stop()` when it closes.
 */
export function readScreenAloud(el: HTMLElement, opts: ScreenAloudOptions): ReadAloudHandle {
  const target = el.querySelector(opts.anchor ?? '[data-key="primary"], .btn-start');
  const btn = speakButtonBeside(target);
  const speak = (): void => narrator.speak(opts.text);
  btn?.addEventListener('click', (e) => { e.stopPropagation(); speak(); });
  if (opts.items && opts.hover) {
    const say = (item: HTMLElement): void => {
      const t = (opts.itemText?.(item) ?? item.getAttribute('aria-label') ?? item.textContent ?? '').trim();
      if (t) narrator.speak(t);
    };
    el.querySelectorAll<HTMLElement>(opts.items).forEach((item) => {
      let dwell = 0;
      item.addEventListener('mouseenter', () => { dwell = window.setTimeout(() => say(item), HOVER_DWELL_MS); });
      item.addEventListener('mouseleave', () => window.clearTimeout(dwell));
      item.addEventListener('focus', () => { if (item.matches(':focus-visible')) say(item); });
    });
  }
  // a browser only lets a page speak after the player has touched it (the first boot)
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }) : null;
  if (opts.autoStart && nav?.userActivation?.hasBeenActive !== false) speak();
  return { speak, stop: () => narrator.stop() };
}
