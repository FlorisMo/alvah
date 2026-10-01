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
 *
 * Run 6 polish: an encounter can also be played with the BODY (`still`): no card, no
 * buttons, no countdown — one read-aloud line says what to hold ("Raak hem niet aan",
 * "Sta heel stil"), the animal right in front of him tempts him, and his own hand (a
 * click on the piglet) or his own feet (a step key, a tap on the world) are the impulse.
 * The same `DagnachtRun`, in the same content order (beats/hold-math.ts maps reaches and
 * time onto its `choose`): the trials stay five, the summary is the one the 2D floor
 * logs for the same answers, and the floor still plays all five as cards. An encounter
 * can also be answered by a WALK (`answer`: the ree's pool, round it or through it).
 */

import * as THREE from 'three';
import '../../play/play3d.css';
import { playDagnachtTrial, DagnachtRun, type DagnachtTrial, type Encounter } from '../../../engines/dagnacht';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { zinnen } from '../../../core/readlevel';
import { anchoredPrompt, clearPlayHint, SPEAK_BTN } from '../../play/kit';
import { tapHitRadius } from '../../play/kit-math';
import type { AdventureKit } from '../kit';
import { HoldCore, HOLD_S, HOLD_SILENT_S, readSeconds } from './hold-math';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export interface AskOpts {
  /** a wrong answer: what the animal does (awaited before the card comes back) */
  wrong?: () => Promise<unknown> | void;
  /** the right answer: what happens next (awaited before `ask` resolves) */
  right?: () => Promise<unknown> | void;
  /** shown with the card: the animal turns up (a look, a sound) */
  show?: () => void;
  /** the wrong answer's reaction walks the RANGER (a boot into a pool): a card holds him
   *  still, so the card makes way while it plays, and the consequence line stands over
   *  the card when it comes back (what happened first, then the words for it) */
  walks?: boolean;
  /** run 7: the card's question in other words (the same encounter met elsewhere: the
   *  piglet himself at the bag, not the yearling); default: the encounter's own */
  vraag?: string;
}

/** A rustkracht moment played with the body (`ChoiceRun.still`). */
export interface StillOpts {
  /** the one objective line: what to hold (≤ 7 words, read aloud; the 🔊 repeats it) */
  line: string;
  /** HANDS still: a click or a tap ON this (the piglet, read at the click: lying or
   *  standing, the body shown now) is a hand reaching for it; any other click does nothing */
  hands?: THREE.Object3D | (() => THREE.Object3D | null);
  /** FEET still: a step key (arrows, WASD) or a tap on the world (on the scene itself,
   *  never on a button or the line) is a step toward them. His own input is locked
   *  meanwhile (a framed beat). */
  feet?: boolean;
  /** what the reach did, said after the animal's reaction (default: the encounter's gevolg) */
  mis?: string;
  /** shown with the line: the animal turns up (a look, a sound) */
  show?: () => void;
  /** the temptation, a moment into every hold (he peeks at him and squeaks again) */
  tempt?: () => void;
  /** a reach: what the animal does (awaited before the line and the hold come back) */
  wrong?: () => Promise<unknown> | void;
  /** held: what happens next (awaited before `still` resolves) */
  right?: () => Promise<unknown> | void;
}

/** The keys that would take a step (as the ree's watch reads them). */
const STEP_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;

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
    // run 7: a skin with a rustPlan plays its calm moments in the order the play's seed
    // draws, never his last two plays' (the 2D floor and the classic stage draw the same)
    this.trial = playDagnachtTrial(k.steps[step].skin, { ...diff, reducedMotion: k.reduced } as typeof diff, k.play, store.get().geschiedenis);
    this.run = new DagnachtRun(this.trial.encounters.length);
  }

  /** The encounter the run is at now. */
  get current(): Encounter | null {
    return this.run.finished ? null : this.trial.encounters[this.run.index];
  }

  /** Run 7 (design foundation §5.4): the next encounter of the trial, whatever its id (a
   *  skin with a rustPlan draws its order), or null once every one was passed. */
  next(): Encounter | null { return this.current; }

  /** Run 7: the next encounter if it belongs to `slot`, else null — a home plays its calm
   *  moments slot by slot, each at its station: `for (let e; (e = rust.nextIn('weg'));) …` */
  nextIn(slot: string): Encounter | null {
    const e = this.current;
    return e && e.slot === slot ? e : null;
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
    let note: string | null = null;
    for (;;) {
      const goed = await this.present(o.vraag ? { ...enc, vraag: o.vraag } : enc, note);
      note = null;
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
      if (o.walks) {
        this.card?.remove();
        this.card = null;
        await this.k.guard(Promise.resolve(o.wrong?.()));
        note = enc.gevolg ?? 'Wacht even. Probeer het anders.';
        continue;
      }
      await this.k.guard(Promise.all([this.toast('gevolg', enc.gevolg ?? 'Wacht even. Probeer het anders.', 2400), Promise.resolve(o.wrong?.())]));
    }
  }

  /**
   * Play encounter `id` (next in content order) with the BODY: the line says what to hold,
   * the animal tempts him, and he keeps still until it calms (~4 s after the line was
   * read). A reach — `hands`: a click on the animal; `feet`: a step key or a tap on the
   * world — is the wrong answer (`choose(false)`, marked once): the animal reacts calmly,
   * a short line says so, and the same moment comes back. Never a fail. A full hold is
   * the right answer: the good line (the content's uitleg), then `right`. No play hint
   * while it lasts (a perfect player does nothing: golden simply waits).
   */
  async still(id: string, o: StillOpts): Promise<void> {
    const enc = this.current;
    if (!enc || enc.id !== id) throw new Error(`[adventure] choice "${id}" asked out of order (next: ${enc?.id ?? 'none'})`);
    const k = this.k;
    k.check();
    k.beat = `still:${id}`;
    clearPlayHint();
    const unhint = k.hint(() => null); // (nothing to click: a stale walk hint must not survive into it)
    const settings = store.get().settings;
    const core = new HoldCore(settings.voorlezen ? HOLD_S : HOLD_SILENT_S, (goed) => { this.run.choose(goed); });
    const canvas = k.ctx.canvas;
    const camera = k.world.camera;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let reached = false;
    /** a click on the animal (its body, or within a child's fingertip of it: ≥ 56 px round) */
    const onAnimal = (e: PointerEvent, target: THREE.Object3D): boolean => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.intersectObject(target, true).some((h) => h.object.visible && !h.object.userData.hitSphere)) return true;
      const c = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
      const rad = tapHitRadius(camera.position.distanceTo(c), (camera.fov * Math.PI) / 180, r.height || 800, 0.16);
      return ray.ray.distanceToPoint(c) <= rad;
    };
    const onDown = (e: PointerEvent): void => {
      if (k.world.menuShown()) return;
      if (o.hands) {
        const body = typeof o.hands === 'function' ? o.hands() : o.hands;
        if (body && e.target === canvas && onAnimal(e, body)) reached = true;
        return;
      }
      if (o.feet && e.target === canvas) reached = true; // (a tap on the world: never a button, the line, the chip)
    };
    const onKey = (e: KeyboardEvent): void => {
      if (o.feet && !e.repeat && STEP_KEYS.test(e.code) && !k.world.menuShown()) reached = true;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    o.show?.();
    try {
      for (;;) {
        // the line (read aloud once: after a reach it comes back as a new line), and its read
        k.say(o.line);
        let read = false;
        // (a stop while it is read rejects the read: the wait below unwinds the moment, so
        // the read itself must not throw a second, uncaught "adventure stopped")
        void this.readOut(o.line).then(() => { read = true; }, () => {});
        await k.until(() => reached || read);
        if (!reached) {
          core.begin(k.now);
          let tempted = false;
          await k.until(() => {
            if (!tempted && core.seconds - core.left(k.now) > 1.1) { tempted = true; o.tempt?.(); }
            return reached || core.tick(k.now);
          });
        }
        if (!reached) break; // held
        // a reach: marked once, the animal reacts, the words for it, the same moment again
        core.impulse();
        k.stats[`still_${id}`] = core.impulses;
        if (settings.geluid) Sound.tryAgain();
        k.say(null);
        await k.guard(Promise.resolve(o.wrong?.()));
        const mis = o.mis ?? enc.gevolg ?? 'Wacht even. Probeer het anders.';
        k.say(mis);
        await this.readOut(mis, 1.6);
        reached = false; // (a reach while it reacted, or while its line was said, was the same one)
        core.again();
      }
    } finally {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      unhint();
    }
    k.stats[`still_${id}`] = core.impulses;
    if (settings.geluid) Sound.correct();
    const good = enc.uitleg ?? 'Rustig zo.';
    k.say(good, { good: true });
    await this.readOut(good, 1.6);
    await k.guard(Promise.resolve(o.right?.()));
  }

  /** A line's read: the voice done with it (when voorlezen is on) and never quicker than a
   *  calm read (280 ms a word, at least `min` s); mission time, stopped by a stop. */
  private async readOut(line: string, min = 0): Promise<void> {
    const k = this.k;
    const calm = k.wait(Math.max(min, readSeconds(line)));
    if (!store.get().settings.voorlezen) { await calm; return; }
    const words = line.split(/\s+/).length;
    await Promise.all([calm, k.guard(narrator.quiet(words * 700 + 2000))]);
  }

  /**
   * Answer encounter `id` (next in content order) from the WORLD — what his feet did on
   * a walk (the ree's pool: a boot in the water, or round it dry), not a card: `false`
   * marks it (the run counts the encounter once, however often), `true` passes it. The
   * mission plays the reaction and says the encounter's own words (`current`).
   */
  answer(id: string, goed: boolean): void {
    const enc = this.current;
    if (!enc || enc.id !== id) throw new Error(`[adventure] choice "${id}" answered out of order (next: ${enc?.id ?? 'none'})`);
    this.run.choose(goed);
  }

  /** Every encounter passed: log the run (once). */
  done(): void {
    if (this.logged) return;
    if (!this.run.finished) throw new Error('[adventure] rustkracht logged before every encounter was passed');
    this.logged = true;
    this.k.log(this.step, this.run.summary());
  }

  private card: HTMLDivElement | null = null;

  /** The card for `enc` (with `note` over it: what the last answer did); resolves with
   *  whether the chosen option was the right one. */
  private present(enc: Encounter, note: string | null = null): Promise<boolean> {
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
        `${SPEAK_BTN}</div>` +
        regels + flip +
        `<div class="p3-choices">` +
        order.map((i) => `<button class="p3-choice" data-i="${i}" type="button">${esc(enc.opties[i].label)}</button>`).join('') +
        `</div></div></div>`,
      this.k.signal,
    );
    this.card = card;
    const q = enc.flip ? `Nu mag het wél. ${enc.vraag}` : enc.vraag;
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(q));
    if (note) this.note('gevolg', note);
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
    this.note(kind, text);
    const words = text.split(/\s+/).length;
    return this.k.wait(Math.max(min, words * 280) / 1000).then(() => {
      if (kind === 'gevolg') { card?.remove(); if (this.card === card) this.card = null; }
    });
  }

  /** A feedback line over the card up now, read aloud. */
  private note(kind: 'ok' | 'gevolg', text: string): void {
    const card = this.card;
    if (card) {
      const col = card.querySelector('.p3-bottom') ?? card;
      col.querySelector('.p3-toast')?.remove();
      const t = document.createElement('div');
      t.className = `p3-toast ${kind}`;
      t.setAttribute('role', 'status');
      // one sentence a line (each ≤ 7 words): never eight words side by side
      for (const [i, z] of zinnen(text).entries()) {
        if (i) t.appendChild(document.createElement('br'));
        t.appendChild(document.createTextNode(z));
      }
      col.insertBefore(t, col.firstChild);
    }
    if (store.get().settings.voorlezen) narrator.speak(text);
  }
}

/** A rustkracht run over step `step`, asked encounter by encounter. */
export function choiceRun(k: AdventureKit, step: number): ChoiceRun {
  return new ChoiceRun(k, step);
}
