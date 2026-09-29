/**
 * beats/choice.ts — rustkracht (the dagnacht engine: inhibition) asked IN the world,
 * spread over the mission (design §4.1: two choices at the find spot, three at the
 * wallow). Construct parity (§6): the SAME `buildDagnachtTrial` builder and the SAME
 * pure `DagnachtRun` as the 2D floor and the 3D stage, in content order; two options in
 * the accessible DOM card, their slots shuffled, the ranger rules as chips, "Nu mag het
 * wél" on the flip; a wrong answer re-presents the same encounter. The run is logged
 * once, when the last encounter is passed (`done`), through the kit.
 *
 * What changes is what the child sees: the subject is the real animal right there (the
 * piglet in the bracken, the yearling at his bag, the sow looking up), and each answer
 * gets a reaction in the world the script plays (`wrong` / `right`) — calm, never
 * toward the camera. The card holds the ranger still while it is up (it is a card
 * over the world).
 */

import '../../play/play3d.css';
import { buildDagnachtTrial, DagnachtRun, type DagnachtTrial, type Encounter } from '../../../engines/dagnacht';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { anchoredPrompt, clearPlayHint } from '../../play/kit';
import type { AdventureKit } from '../kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export interface AskOpts {
  /** a wrong answer: what the animal does (awaited before the card comes back) */
  wrong?: () => Promise<unknown> | void;
  /** the right answer: what happens next (awaited before `ask` resolves) */
  right?: () => Promise<unknown> | void;
  /** shown with the card: the animal turns up (a look, a sound) */
  show?: () => void;
}

export class ChoiceRun {
  readonly trial: DagnachtTrial;
  private readonly run: DagnachtRun;
  private readonly k: AdventureKit;
  private readonly step: number;
  private logged = false;

  constructor(k: AdventureKit, step: number) {
    this.k = k;
    this.step = step;
    const diff = store.difficulty('dagnacht');
    this.trial = buildDagnachtTrial(k.steps[step].skin, { ...diff, reducedMotion: k.reduced } as typeof diff);
    this.run = new DagnachtRun(this.trial.encounters.length);
  }

  /** The encounter the run is at now. */
  get current(): Encounter | null {
    return this.run.finished ? null : this.trial.encounters[this.run.index];
  }

  /** Ask encounter `id` (it must be the next in content order) until it is answered right. */
  async ask(id: string, o: AskOpts = {}): Promise<void> {
    const enc = this.current;
    if (!enc || enc.id !== id) throw new Error(`[adventure] choice "${id}" asked out of order (next: ${enc?.id ?? 'none'})`);
    this.k.check();
    this.k.beat = `choice:${id}`;
    clearPlayHint(); // answered with the card's buttons (golden reads the content's goed option)
    this.k.say(null);
    o.show?.();
    const settings = store.get().settings;
    for (;;) {
      const goed = await this.present(enc);
      if (goed) {
        this.run.choose(true);
        if (settings.geluid) Sound.correct();
        await this.k.guard(this.toast('ok', enc.uitleg ?? 'Rustig zo.'));
        // the card goes first: what follows may walk the ranger (a card holds him still)
        this.card?.remove();
        this.card = null;
        await this.k.guard(Promise.resolve(o.right?.()));
        return;
      }
      this.run.choose(false); // recoverable: marks the encounter, keeps it up
      if (settings.geluid) Sound.tryAgain();
      await this.k.guard(Promise.all([this.toast('gevolg', enc.gevolg ?? 'Wacht even. Probeer het anders.', 2400), Promise.resolve(o.wrong?.())]));
    }
  }

  /** Every encounter passed: log the run (once). */
  done(): void {
    if (this.logged) return;
    if (!this.run.finished) throw new Error('[adventure] rustkracht logged before every encounter was passed');
    this.logged = true;
    this.k.log(this.step, this.run.summary());
  }

  private card: HTMLDivElement | null = null;

  /** The card for `enc`; resolves with whether the chosen option was the right one. */
  private present(enc: Encounter): Promise<boolean> {
    const settings = store.get().settings;
    const regels = this.trial.regels.length
      ? `<div class="p3-chips" aria-label="Ranger-regels">${this.trial.regels.map((r) => `<span class="p3-chip">${esc(r)}</span>`).join('')}</div>`
      : '';
    const flip = enc.flip ? `<p class="p3-flip">Nu mag het wél</p>` : '';
    const order = Math.random() < 0.5 ? [0, 1] : [1, 0]; // position never cues the answer
    const card = anchoredPrompt(
      this.k.host,
      `<div class="p3-bottom dag3d">` +
        `<div class="p3-card">` +
        `<div class="p3-row"><p class="p3-text">${esc(enc.vraag)}</p>` +
        `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button></div>` +
        regels + flip +
        `<div class="p3-choices">` +
        order.map((i) => `<button class="p3-choice" data-i="${i}" type="button">${esc(enc.opties[i].label)}</button>`).join('') +
        `</div></div></div>`,
      this.k.signal,
    );
    this.card = card;
    const q = enc.flip ? `Nu mag het wél. ${enc.vraag}` : enc.vraag;
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(q));
    if (settings.voorlezen) narrator.queue(q);
    return this.k.guard(new Promise<boolean>((resolve) => {
      card.querySelectorAll<HTMLButtonElement>('.p3-choice').forEach((b) => {
        b.addEventListener('click', () => {
          card.querySelectorAll<HTMLButtonElement>('.p3-choice').forEach((x) => { x.disabled = true; });
          resolve(!!enc.opties[parseInt(b.dataset.i!, 10)].goed);
        }, { once: true });
      });
    }));
  }

  /** The feedback line ABOVE the card (never over a choice), read aloud; resolves after a calm read. */
  private toast(kind: 'ok' | 'gevolg', text: string, min = 1600): Promise<void> {
    const card = this.card;
    if (card) {
      const col = card.querySelector('.p3-bottom') ?? card;
      col.querySelector('.p3-toast')?.remove();
      const t = document.createElement('div');
      t.className = `p3-toast ${kind}`;
      t.setAttribute('role', 'status');
      t.textContent = text;
      col.insertBefore(t, col.firstChild);
    }
    if (store.get().settings.voorlezen) narrator.speak(text);
    const words = text.split(/\s+/).length;
    return this.k.wait(Math.max(min, words * 280) / 1000).then(() => {
      if (kind === 'gevolg') { card?.remove(); if (this.card === card) this.card = null; }
    });
  }
}

/** A rustkracht run over step `step`, asked encounter by encounter. */
export function choiceRun(k: AdventureKit, step: number): ChoiceRun {
  return new ChoiceRun(k, step);
}
