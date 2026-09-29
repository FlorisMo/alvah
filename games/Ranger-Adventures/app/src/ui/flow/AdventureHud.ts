/**
 * AdventureHud.ts — what a child sees on screen while an adventure plays in the world
 * (run 6, design §3.9): ONE objective line (≤ 7 words, read aloud once when it
 * appears, 🔊 to hear it again), the objective chip (the wayfinding strip: where the
 * goal is, in words — the arrow only once he seems lost), an action button for things
 * done in the world ("Hang de camera op"), a soft binocular frame for a look, and the
 * joystick while he walks on a touch screen. The Pauze chip is the mission's own.
 *
 * Nothing here is a menu: the HUD is not a `.ra-overlay`, so while he walks the world
 * never reads it as a card over the world (session.menuOpen) and the ranger walks on.
 * Choice cards (the rustkracht rounds) are real cards and do hold him.
 */

import './adventure.css';
import { narrator } from '../../core/narrator';
import { store } from '../../core/state';
import { joystickVisible } from '../../core/input';
import { Joystick } from '../Joystick';
import { coarsePointer } from '../hud/device';
import { session, esc } from './session';

export interface ChipCue {
  /** what he walks to ("De big", "De modderpoel") */
  doel: string;
  /** the words under it ("links · 8 m") */
  cue: string;
  /** the arrow's turn (rad, relative to where he looks), or null: words only */
  angle: number | null;
  arrived?: boolean;
}

export class AdventureHud {
  readonly el: HTMLDivElement;
  private readonly line: HTMLDivElement;
  private readonly lineText: HTMLParagraphElement;
  private readonly chip: HTMLDivElement;
  private readonly bottom: HTMLDivElement;
  private readonly vignette: HTMLDivElement;
  private joystick: Joystick | null = null;
  private said = '';
  private arrowTurn = 0;
  private actionDone: (() => void) | null = null;

  constructor() {
    const el = document.createElement('div');
    el.className = 'adventure-hud';
    el.innerHTML =
      `<div class="adv-vignette" aria-hidden="true"></div>` +
      `<div class="adv-veil" role="status" aria-live="polite"><p class="adv-veil-text"></p></div>` +
      `<div class="adv-line p3-top" role="status" aria-live="polite" hidden>` +
      `<div class="p3-card"><div class="p3-row">` +
      `<p class="p3-text"></p>` +
      `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div></div></div>` +
      `<div class="explore-wayfind adv-chip" hidden>` +
      `<span class="wf-glyph adv-no-arrow" aria-hidden="true">·</span>` +
      `<span class="wf-text"><b class="wf-doel"></b><span class="wf-cue"></span></span>` +
      `</div>` +
      `<div class="adv-bottom" hidden></div>`;
    this.el = el;
    this.line = el.querySelector('.adv-line')!;
    this.lineText = el.querySelector('.adv-line .p3-text')!;
    this.chip = el.querySelector('.adv-chip')!;
    this.bottom = el.querySelector('.adv-bottom')!;
    this.vignette = el.querySelector('.adv-vignette')!;
    el.querySelector('.adv-line .p3-speak')?.addEventListener('click', () => narrator.speak(this.lineText.textContent ?? ''));
    session.host.appendChild(el);
  }

  /** The objective line. A new line is read aloud once (when voorlezen is on); the same
   *  line again is not. `good`: it answers a success (a calm green edge). null hides it. */
  say(text: string | null, opts: { good?: boolean; queue?: boolean } = {}): void {
    if (!text) { this.line.hidden = true; this.said = ''; return; }
    this.line.hidden = false;
    this.line.classList.toggle('adv-good', !!opts.good);
    if (text === this.said) return;
    this.said = text;
    this.lineText.textContent = text;
    if (store.get().settings.voorlezen) {
      if (opts.queue) narrator.queue(text); else narrator.speak(text);
    }
  }

  /** The line on screen now (for the dev read), or null. */
  get current(): string | null {
    return this.line.hidden ? null : this.said || null;
  }

  /** The objective chip: where to go, in words; the arrow only when `angle` is given. */
  setChip(c: ChipCue | null): void {
    if (!c) { this.chip.hidden = true; return; }
    this.chip.hidden = false;
    const doel = this.chip.querySelector<HTMLElement>('.wf-doel')!;
    const cue = this.chip.querySelector<HTMLElement>('.wf-cue')!;
    const glyph = this.chip.querySelector<HTMLElement>('.wf-glyph')!;
    if (doel.textContent !== c.doel) doel.textContent = c.doel;
    if (cue.textContent !== c.cue) cue.textContent = c.cue;
    this.chip.classList.toggle('wf-arrived', !!c.arrived);
    if (c.angle === null || c.arrived) {
      glyph.classList.add('adv-no-arrow');
      glyph.textContent = c.arrived ? '◎' : '👂';
      glyph.style.transform = '';
      return;
    }
    glyph.classList.remove('adv-no-arrow');
    if (glyph.textContent !== '↑') glyph.textContent = '↑';
    this.arrowTurn += Math.atan2(Math.sin(c.angle - this.arrowTurn), Math.cos(c.angle - this.arrowTurn));
    glyph.style.transform = `rotate(${this.arrowTurn.toFixed(3)}rad)`;
  }

  /** An action done in the world: one big button (Space / Enter press it). Resolves on
   *  its click; `null` takes it away. */
  action(label: string | null): Promise<void> {
    this.actionDone = null;
    if (!label) { this.bottom.hidden = true; this.bottom.innerHTML = ''; return Promise.resolve(); }
    this.bottom.hidden = false;
    this.bottom.innerHTML = `<button class="btn-start adv-action" type="button" data-key="primary">${esc(label)}</button>`;
    return new Promise((done) => {
      this.actionDone = done;
      this.bottom.querySelector('.adv-action')?.addEventListener('click', () => {
        this.bottom.hidden = true;
        this.bottom.innerHTML = '';
        const d = this.actionDone;
        this.actionDone = null;
        d?.();
      }, { once: true });
    });
  }

  /** Time passes (the night goes by): a calm dark veil over the world with one line in
   *  the middle, read aloud; null lifts it. The fade is CSS (a cut under reduced motion). */
  veil(text: string | null): void {
    const v = this.el.querySelector<HTMLElement>('.adv-veil')!;
    if (text) {
      v.querySelector('.adv-veil-text')!.textContent = text;
      if (store.get().settings.voorlezen) narrator.speak(text);
    }
    v.classList.toggle('on', !!text);
  }

  /** The binocular frame for a look (on/off; the fade is CSS, a cut under reduced motion). */
  binoculars(on: boolean): void {
    this.vignette.classList.toggle('on', on);
  }

  /** The joystick while he walks himself (touch screens); gone while a beat holds him. */
  walking(on: boolean): void {
    const world = session.world;
    if (on && !this.joystick && world) {
      const js = new Joystick();
      js.setVisible(joystickVisible(store.get().settings.joystick, coarsePointer()));
      this.el.appendChild(js.el);
      world.setJoystick(() => js.vector());
      this.joystick = js;
    } else if (!on && this.joystick) {
      this.joystick.dispose();
      this.joystick.el.remove();
      this.joystick = null;
      world?.setJoystick(null);
    }
  }

  dispose(): void {
    this.walking(false);
    this.actionDone = null;
    this.el.remove();
  }
}
