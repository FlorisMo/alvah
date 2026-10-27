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
import { prefersReducedMotion } from '../core/reduced-motion';
import { buildWordClock, activeWordAt, type WordClock } from '../core/wordclock';
import { zinnen } from '../core/readlevel';
import { icon } from './icons';
import { ALGEMEEN } from '../content/copy';

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
  /** Run 6: the line appears as the voice reaches it (a field note written as it is
   *  read). It keeps its place while it waits, so nothing on the card moves. Without a
   *  voice to follow (voorlezen off), under reduced motion, or once stopped: all shown. */
  reveal?: boolean;
  /** Spoken as a sentence of its own (a title shown without a full stop): the voice
   *  pauses after it instead of running on into the next line. */
  sentence?: boolean;
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
  const starts: number[] = []; // each segment's first token (global index)
  let running = leadCount;
  for (const seg of segments) {
    starts.push(running);
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
  const spoken = (seg: ReadAloudSegment): string =>
    seg.sentence && !/[.!?…]\s*$/.test(seg.text) ? `${seg.text.trim()}.` : seg.text;
  const fullText = [opts.lead, ...segments.map(spoken), opts.trail]
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

  // the lines still waiting for the voice (run 6: `reveal`)
  const waiting = new Set<number>();
  const showLine = (k: number): void => {
    if (!waiting.delete(k)) return;
    segments[k].el.classList.remove('ra-line-wait');
    segments[k].el.classList.add('ra-line-in');
  };
  const showAll = (): void => { for (const k of [...waiting]) showLine(k); };

  const setActive = (idx: number): void => {
    if (idx === current) return;
    if (current >= 0) spans[current]?.classList.remove('is-spoken');
    if (idx >= 0) spans[idx]?.classList.add('is-spoken');
    current = idx;
  };

  const tick = (now: number): void => {
    if (!clock) return;
    const t = now - startMs;
    setActive(activeWordAt(clock, t));
    // a waiting line appears a breath before the voice reaches its first word
    for (const k of waiting) if (t >= (clock.words[starts[k]]?.startMs ?? 0) - REVEAL_LEAD_MS) showLine(k);
    if (t >= clock.totalMs) {
      clearHighlight();
      showAll();
      raf = 0;
      return; // clock done — speech may trail a touch, but the highlight rests
    }
    raf = requestAnimationFrame(tick);
  };

  const halt = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    narrator.stop();
    clearHighlight();
  };
  const stop = (): void => { halt(); showAll(); };

  const speak = (): void => {
    halt();
    if (!fullText) return;
    // Benjamin's clips know when each word starts; the browser's voice is estimated,
    // tuned to its calm ~0.96 rate (wordclock.ts), so built at the default rate
    const timing = narrator.timing(fullText);
    clock = buildWordClock(fullText, timing ?? {});
    const hasRaf = typeof requestAnimationFrame === 'function' && typeof performance !== 'undefined';
    if (!hasRaf || clock.totalMs <= 0) { narrator.speak(fullText); showAll(); return; } // speech still happens; just no karaoke
    // the highlight starts when the voice is heard (a clip may take a moment to load)
    // (no later than START_WAIT_MS: lines waiting for the voice never wait for good)
    const run = clock;
    let started = false;
    const begin = (): void => {
      if (started || clock !== run) return;
      started = true;
      startMs = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    narrator.speak(fullText, { onStart: begin });
    window.setTimeout(begin, narrator.available ? START_WAIT_MS : 0);
  };

  opts.speakBtn?.addEventListener('click', speak);
  // lines written as they are read: only when the voice reads them now, and never
  // under reduced motion (then every line is simply there)
  if (opts.autoStart && !prefersReducedMotion()) {
    segments.forEach((seg, k) => { if (seg.reveal) { waiting.add(k); seg.el.classList.add('ra-line-wait'); } });
  }
  if (opts.autoStart) speak();

  return { speak, stop };
}

/** A text on a card, one sentence a line (so every line shown is ≤ 7 words, one idea
 *  each: run 6): the lines go into `host` and come back as segments, lit up as said. */
export function sentenceSegments(host: HTMLElement, text: string): ReadAloudSegment[] {
  const parts = zinnen(text);
  host.innerHTML = parts.map(() => '<span class="zin"></span>').join(' ');
  return Array.from(host.querySelectorAll<HTMLElement>('.zin')).map((el, i) => ({ el, text: parts[i] }));
}

/** A waiting line shows this long before the voice reaches its first word (ms). */
const REVEAL_LEAD_MS = 220;
/** The highlight starts with the voice, or after this long if the voice is slow (ms). */
const START_WAIT_MS = 1500;

/* ------------------------------------------------------ a screen read aloud ---- */

/** The 🔊 "Lees voor" button's markup: the drawn speaker (an emoji renders as a grey
 *  blob on some systems), named by its label, never by its picture. */
export function speakButtonHtml(cls = 'ra-speak'): string {
  return `<button class="${cls}" type="button" aria-label="${ALGEMEEN.leesVoor}">${icon('speaker')}</button>`;
}


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
  btn.setAttribute('aria-label', ALGEMEEN.leesVoor);
  btn.innerHTML = icon('speaker');
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
  /** What the screen says: its heading and what the primary action does (a function when
   *  it changes while the screen is up, e.g. the maker's greeting with the name). */
  text: string | (() => string);
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

/** After the first press, how long a screen waits to see whether that press took it away. */
const FIRST_PRESS_MS = 250;

/** How long the mouse rests on an item before it is read (no chatter while moving). */
const HOVER_DWELL_MS = 450;

/** The one hover read waiting to be said: only one item is ever under the mouse. */
let hoverTimer = 0;
function cancelHoverRead(): void {
  if (hoverTimer) window.clearTimeout(hoverTimer);
  hoverTimer = 0;
}
/** An item whose press says something of its own (the maker's name chip says the new
 *  greeting) ends the hover read still waiting on it. On a touch screen a tap's mouseenter
 *  only comes AFTER the press, so that wait starts after the press already cleared it,
 *  and its label would cut the item's own words off. An item that is quiet when pressed
 *  (a swatch) keeps it: on a tablet the tap is how its label is heard. */
export function endHoverRead(): void {
  cancelHoverRead();
}
/** A press (click, tap, key) ends the wait: whatever the player pressed speaks for
 *  itself — the next screen's voice is never talked over by a stale label (V1). */
let pressCancelsHover = false;
function cancelHoverOnPress(): void {
  if (pressCancelsHover || typeof document === 'undefined') return;
  pressCancelsHover = true;
  document.addEventListener('pointerdown', cancelHoverRead, true);
  document.addEventListener('keydown', cancelHoverRead, true);
}
/** The words an item says: its label without the icons beside it (aria-hidden). */
function itemWords(item: HTMLElement): string {
  const label = item.getAttribute('aria-label');
  if (label) return label;
  const copy = item.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ');
}

/**
 * Read a whole screen aloud (child:B12): the title, the ranger maker, Pauze, the
 * missiebord, the reward card. A 🔊 beside the primary action says `text` at any
 * time; the screen says it once when it opens; each item says its own words on focus
 * or hover. Returns a handle so the screen can `stop()` when it closes.
 */
export function readScreenAloud(el: HTMLElement, opts: ScreenAloudOptions): ReadAloudHandle {
  const target = el.querySelector(opts.anchor ?? '[data-key="primary"], .btn-start');
  const btn = speakButtonBeside(target);
  const speak = (): void => narrator.speak(typeof opts.text === 'function' ? opts.text() : opts.text);
  btn?.addEventListener('click', (e) => { e.stopPropagation(); speak(); });
  if (opts.items && opts.hover) {
    const say = (item: HTMLElement): void => {
      const t = (opts.itemText?.(item) ?? itemWords(item)).trim();
      if (t) narrator.speak(t);
    };
    cancelHoverOnPress();
    el.querySelectorAll<HTMLElement>(opts.items).forEach((item) => {
      item.addEventListener('mouseenter', () => {
        cancelHoverRead();
        hoverTimer = window.setTimeout(() => {
          hoverTimer = 0;
          // only while the item is still on screen and under the mouse: a tap that
          // opened the next screen took it away (mouseleave never fires then)
          if (item.isConnected && item.matches(':hover')) say(item);
        }, HOVER_DWELL_MS);
      });
      item.addEventListener('mouseleave', cancelHoverRead);
      item.addEventListener('focus', () => { if (item.matches(':focus-visible')) say(item); });
    });
  }
  // a browser only lets a page speak after the player has touched it (the first boot):
  // then the screen speaks at his first click or key, unless that press took it away
  // (Begin), and the next screen speaks for itself
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }) : null;
  let waitFirst: (() => void) | null = null;
  if (opts.autoStart && nav?.userActivation?.hasBeenActive === false) {
    const first = (): void => {
      forget();
      window.setTimeout(() => { if (el.isConnected && !/--leaving\b/.test(el.className)) speak(); }, FIRST_PRESS_MS);
    };
    const forget = (): void => {
      window.removeEventListener('pointerdown', first, true);
      window.removeEventListener('keydown', first, true);
      waitFirst = null;
    };
    window.addEventListener('pointerdown', first, true);
    window.addEventListener('keydown', first, true);
    waitFirst = forget;
  } else if (opts.autoStart) speak();
  return { speak, stop: () => { waitFirst?.(); cancelHoverRead(); narrator.stop(); } };
}
