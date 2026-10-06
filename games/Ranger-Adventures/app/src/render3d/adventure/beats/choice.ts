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
 *
 * Run 7 (`adaptive`, design §5.4): the order of the moments is this play's (a skin's
 * `rustPlan`, drawn from `k.play.fork('dagnacht')`, exactly as the 2D floor draws it): a
 * home plays them with `next()` / `nextIn(slot)` instead of naming them in content order.
 * A body moment's hold and its temptations come from the level's knobs and grow or ease
 * inside the beat (`RustTempo`); the summary carries the longest hold (`holdS`).
 *
 * Run 7 (ree-growth, additive): an encounter can also be answered by WALKING AWAY (`go`:
 * the flip "Nu mag het wél" played with his feet — the mother is back, he walks off
 * himself; standing the level's `goWaitS` or walking up to them is the old rule). The pure
 * core is `GoCore` (hold-math.ts); the 2D floor still asks it as a card.
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
import type { RustKnobs } from '../../../core/skill';
import type { IconName } from '../../../ui/icons';
import type { Place, Spot } from '../types';
import { isRunning } from '../actors-math';
import { BACK_AGAIN_S, GoCore, HoldCore, RustTempo, backSpot, readSeconds, steppedBack } from './hold-math';

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
  /** run 7 (the ven, additive): KEEP YOUR DISTANCE — his input stays free (the script
   *  frees it first: he may wait or walk round), and coming within `r` m of `at()` (the
   *  adder on the path) is the reach; within `warn` m `onWarn` is called once each time he
   *  comes that near (she lifts her head: a cue, no reach) */
  room?: { at: () => Spot; r: number; warn?: number; onWarn?: () => void;
    /** run 7 (words-ree, additive): GIVE ROOM — the moment is answered by a small step
     *  BACK of this many m (from where he stood when it began, away from `at()`), not by
     *  time; waiting is no reach (the line comes again after a quiet while). His feet must
     *  be free: the script frees them (under its framed lens, or the follow camera). Its
     *  walk hint (`back`) shows golden the step. Default: none (the hold is held on time). */
    back?: number };
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
  /** run 7 (the ven, additive): called the moment the hold is held, before its good words
   *  (with `room` his feet are free: the adder stops them here, so he never walks on into
   *  her while he is praised for leaving her be). Default: nothing. */
  held?: () => void;
}

/** A rustkracht moment answered by WALKING AWAY (`ChoiceRun.go`, run 7). */
export interface GoOpts {
  /** the one objective line: what to do (≤ 7 words a sentence, read aloud; it comes back
   *  after a wrong answer) */
  line: string;
  /** where the animals are now (each frame: the nearer of them) */
  family: () => Spot;
  /** where he walks to (golden's hint, the chip's goal) and the way there round what
   *  stands in it; the moment is answered long before he is there (`away` m) */
  to: Place | Spot;
  via?: readonly Spot[];
  /** the chip: where, in words; the cue under it; its sign */
  doel: string;
  cue?: string;
  glyph?: IconName;
  /** said when he runs (running counts as neither); `onRun`: the animals hear it */
  hush: string;
  onRun?: () => void;
  /** GoCore's rule: metres away (default 4), seconds of standing (default the level's
   *  `goWaitS`), metres closer (default 2.5) */
  away?: number;
  waitS?: number;
  closer?: number;
  /** run 7 (the ecoduct, additive): the way the animals take, when he stands on it: going
   *  means stepping OFF it (GoCore `off`), not walking on along it. Default: away from them. */
  off?: readonly Spot[];
  /** what the old rule did, said after the animals' reaction (default the encounter's gevolg) */
  mis?: string;
  /** he stood too long or came closer: what the animals do (awaited before the line comes back) */
  wrong?: (why: 'stay' | 'closer') => Promise<unknown> | void;
  /** he walked away: what happens next (awaited before `go` resolves) */
  right?: () => Promise<unknown> | void;
}

/** The keys that would take a step (as the ree's watch reads them). */
const STEP_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;

/** Run 7 (additive): how a rustkracht run is built. */
export interface ChoiceRunOpts {
  /** the encounters in THIS play's order (ids; a mission's drawn order, e.g. the ree's pool
   *  first or fourth): the same encounters, the same DagnachtRun, another order. Ids it
   *  does not name keep their content order after it. Default: content order. */
  order?: readonly string[];
}

/** The encounters in `order` (by id), the rest after them in content order. */
export function inOrder(encounters: readonly Encounter[], order: readonly string[]): Encounter[] {
  const named = order.map((id) => encounters.find((e) => e.id === id)).filter((e): e is Encounter => !!e);
  return [...named, ...encounters.filter((e) => !named.includes(e))];
}

export class ChoiceRun {
  readonly trial: DagnachtTrial;
  private readonly run: DagnachtRun;
  private readonly k: AdventureKit;
  private readonly step: number;
  /** this beat's holds (run 7 growth, additive: readable, so a home's own body moment — the
   *  frisling's tired-piglet walk — goes as long as a hold wants now and tells it a reach) */
  readonly tempo: RustTempo;
  /** the level's rustkracht knobs (a go moment's wait) */
  private readonly knobs: RustKnobs;
  /** the two answers' places on a card (position never cues the answer; seeded) */
  private readonly sides: () => number;
  private logged = false;

  constructor(k: AdventureKit, step: number, opts: ChoiceRunOpts = {}) {
    this.k = k;
    this.step = step;
    const settings = store.get().settings;
    const knobs = k.knobs('dagnacht');
    this.knobs = knobs;
    // run 7: this play's order of the calm moments, never his last two plays' (its 2D twin
    // and the classic stage draw the same)
    this.trial = playDagnachtTrial(k.steps[step].skin, { jargon: settings.jargon, reducedMotion: k.reduced, ...knobs }, k.play, store.get().geschiedenis);
    // (a mission that draws its own order, the ree's: the same encounters in that order)
    if (opts.order) this.trial = { ...this.trial, encounters: inOrder(this.trial.encounters, opts.order) };
    this.run = new DagnachtRun(this.trial.encounters.length);
    this.tempo = new RustTempo(knobs, !settings.voorlezen, k.play.fork('rust').rng);
    this.sides = k.play.fork('knoppen').rng;
  }

  /** The encounter the run is at now. */
  get current(): Encounter | null {
    return this.run.finished ? null : this.trial.encounters[this.run.index];
  }

  /** Run 7: the next calm moment of this play's order (whatever its id), or null once all
   *  are passed. A home plays it with `ask(e.id)`, `still(e.id)` or `answer(e.id)`. */
  next(): Encounter | null {
    return this.current;
  }

  /** Run 7: the next moment when it belongs to `slot`, else null — a home plays its
   *  stations slot by slot: `for (let e; (e = rust.nextIn('thuis')); ) await play(e)`. */
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
    // (nothing to click: a stale walk hint must not survive into it; run 7 `room.back`: the
    // step back, once the moment is up, as a walk a perfect player makes backing up)
    const back = o.room?.back;
    let from: Spot | null = null, atFrom: Spot | null = null, backing = false;
    const stepped = (): boolean => {
      if (!back || !from || !atFrom) return false;
      const m = k.ranger();
      return steppedBack(from, m, atFrom) >= back;
    };
    const unhint = k.hint(() => {
      if (!back || !backing || !from || !atFrom) return null;
      const to = backSpot(from, atFrom, back + 0.3);
      return { id: `walk:back-${id}`, walk: { x: to.x, z: to.z, r: 0.25, back: true } };
    });
    const settings = store.get().settings;
    const tempo = this.tempo;
    const core = new HoldCore(tempo.seconds, (goed) => { this.run.choose(goed); });
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
    // (keep your distance: his own feet, free, read every frame)
    let warned = false;
    const offRoom = o.room ? k.onTick(() => {
      const room = o.room!;
      const me = k.ranger(), at = room.at();
      const d = Math.hypot(me.x - at.x, me.z - at.z);
      if (d < room.r) reached = true;
      const near = room.warn !== undefined && d < room.warn;
      if (near && !warned) room.onWarn?.();
      warned = near;
    }) : null;
    o.show?.();
    try {
      for (;;) {
        // the line (read aloud once: after a reach it comes back as a new line), and its read
        k.say(o.line);
        let read = false;
        // (a stop while it is read rejects the read: the wait below unwinds the moment, so
        // the read itself must not throw a second, uncaught "adventure stopped")
        void this.readOut(o.line).then(() => { read = true; }, () => {});
        if (back) {
          // (give room: measured from where he stands as the moment begins, away from where
          // the animal is then; a step back while the line is still read counts)
          const m = k.ranger();
          from = { x: m.x, z: m.z };
          atFrom = { ...o.room!.at() };
          backing = true;
          await k.until(() => reached || read || stepped());
          if (!reached && stepped()) { core.complete(); break; }
          if (!reached) {
            core.begin(k.now, tempo.seconds);
            k.stats.hold_s = core.seconds;
            let t0 = k.now, next = 0, tempts = tempo.temptsFor(core.seconds);
            await k.until(() => {
              while (next < tempts.length && k.now - t0 >= tempts[next]) { next += 1; o.tempt?.(); }
              if (reached) return true;
              if (stepped()) return core.complete();
              // he waits: no reach, the moment only waits — after a quiet while the line
              // comes again (read aloud), and the animal tempts him again
              if (k.now - t0 >= core.seconds + BACK_AGAIN_S) {
                k.say(null);
                k.say(o.line);
                t0 = k.now; next = 0; tempts = tempo.temptsFor(core.seconds);
              }
              return false;
            });
          }
          if (!reached) break; // (he stepped back: held)
          backing = false;
        } else {
          if (!reached) {
            // the hold: as long as the tempo wants now; the animal tempts him at its moments
            core.begin(k.now, tempo.seconds);
            k.stats.hold_s = core.seconds;
            const tempts = tempo.temptsFor(core.seconds);
            let next = 0;
            await k.until(() => {
              while (next < tempts.length && core.seconds - core.left(k.now) >= tempts[next]) { next += 1; o.tempt?.(); }
              return reached || core.tick(k.now);
            });
          }
          if (!reached) break; // held
        }
        // a reach: marked once, the animal reacts, the words for it, the same moment again
        // (the next hold silently a little shorter)
        core.impulse();
        tempo.reached();
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
      offRoom?.();
      unhint();
    }
    k.stats[`still_${id}`] = core.impulses;
    // (a step back is no hold: it never sets the beat's longest hold)
    tempo.held(back ? 0 : core.seconds, core.impulses === 0);
    o.held?.();
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
   * Run 7: play encounter `id` (next in this play's order) by WALKING AWAY — the flip, "Nu
   * mag het wél" with his feet: the line says go (read aloud), his input is free, the chip
   * names where and golden's hint walks there. Once the line is read, `GoCore` reads his
   * feet: `away` m off at a walk and farther from the animals is the right answer (the good
   * line, then `right`); standing the level's `goWaitS` (the old rule, "Blijf staan") or
   * walking `closer` m up to them is the wrong one (`choose(false)`, marked once): the
   * animals react, the encounter's words, and the same moment comes back from where he
   * is. Running says `hush` and counts as neither. Never a fail.
   */
  async go(id: string, o: GoOpts): Promise<void> {
    const enc = this.current;
    if (!enc || enc.id !== id) throw new Error(`[adventure] choice "${id}" asked out of order (next: ${enc?.id ?? 'none'})`);
    const k = this.k;
    k.check();
    clearPlayHint();
    const settings = store.get().settings;
    const core = new GoCore({ waitS: o.waitS ?? this.knobs.goWaitS, ...(o.away ? { away: o.away } : {}), ...(o.closer ? { closer: o.closer } : {}), ...(o.off ? { off: o.off } : {}) },
      (goed) => { this.run.choose(goed); });
    k.stats[`go_${id}_wait`] = core.rule.waitS;
    const here = (): Spot => { const m = k.ranger(); return { x: m.x, z: m.z }; };
    let from = here();
    let read = false, reacting = false;
    const readLine = (): void => { read = false; void this.readOut(o.line).then(() => { read = true; }, () => {}); };
    readLine();
    const react = async (why: 'stay' | 'closer'): Promise<void> => {
      k.stats[`go_${id}`] = core.wrongs;
      k.stats[`go_${id}_${why}`] = (k.stats[`go_${id}_${why}`] ?? 0) + 1;
      if (settings.geluid) Sound.tryAgain();
      k.say(null);
      await k.guard(Promise.resolve(o.wrong?.(why)));
      const mis = o.mis ?? enc.gevolg ?? 'Wacht even. Probeer het anders.';
      k.say(mis);
      await this.readOut(mis, 1.6);
      // the same moment again, from where he is now
      core.again();
      from = here();
      k.say(o.line);
      readLine();
      reacting = false;
    };
    let heading = k.ranger().heading, turnedAt = -9;
    // (a walk key or the stick held: he is trying to walk, even when a bush stops him)
    const held = new Set<string>();
    let pointers = 0;
    const onKeyDown = (e: KeyboardEvent): void => { if (STEP_KEYS.test(e.code)) held.add(e.code); };
    const onKeyUp = (e: KeyboardEvent): void => { held.delete(e.code); };
    const onPtrDown = (): void => { pointers += 1; };
    const onPtrUp = (): void => { pointers = Math.max(0, pointers - 1); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPtrDown, true);
    window.addEventListener('pointerup', onPtrUp, true);
    window.addEventListener('pointercancel', onPtrUp, true);
    const unlisten = (): void => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPtrDown, true);
      window.removeEventListener('pointerup', onPtrUp, true);
      window.removeEventListener('pointercancel', onPtrUp, true);
    };
    const tick = (): void => {
      const m = k.ranger();
      // (he is turning round: his heading moved within the last half second)
      const dh = Math.abs(Math.atan2(Math.sin(m.heading - heading), Math.cos(m.heading - heading)));
      heading = m.heading;
      if (dh > 0.004) turnedAt = k.now;
      if (reacting) return;
      if (core.phase === 'read' && read) core.begin(k.now, from, o.family());
      const trying = held.size > 0 || pointers > 0;
      if (core.tick(k.now, { x: m.x, z: m.z, speed: m.speed, running: isRunning(m), turning: k.now - turnedAt < 0.5, trying }, o.family()) === 'wrong') {
        reacting = true;
        void react(core.why ?? 'stay').catch(() => {});
      }
    };
    const walk = k.walk({
      name: `go-${id}`, to: o.to, r: 0.6, line: o.line, doel: o.doel, cue: o.cue, glyph: o.glyph, via: o.via,
      quiet: { line: o.hush, onRun: o.onRun }, reached: () => core.phase === 'done', tick,
    });
    k.beat = `go:${id}`; // (a moment, not a walk: a discovery's reveal waits)
    try {
      await walk;
      // (there before his feet were judged — he walked on while the animals reacted or the
      // line was read: it is judged where he stands, as soon as it may be)
      if (core.phase !== 'done') {
        const unhint = k.hint(() => ({ id: `walk:go-${id}:there`, walk: { x: o.to.x, z: o.to.z, r: 0.5 } }));
        try { await k.until(() => { tick(); return core.phase === 'done'; }); } finally { unhint(); }
      }
    } finally {
      unlisten();
    }
    // (answered: he stops where he is, the good words, then what follows)
    k.lockFollow();
    k.world.stopRanger();
    k.stats[`go_${id}`] = core.wrongs;
    k.stats[`go_${id}_s`] = Math.round(k.now);
    if (settings.geluid) Sound.correct();
    const good = enc.uitleg ?? 'Rustig zo.';
    k.say(good, { good: true });
    await this.readOut(good, 1.6);
    await k.guard(Promise.resolve(o.right?.()));
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

  /** Every encounter passed: log the run (once), with the longest hold when he held one. */
  done(): void {
    if (this.logged) return;
    if (!this.run.finished) throw new Error('[adventure] rustkracht logged before every encounter was passed');
    this.logged = true;
    const summary = this.run.summary();
    if (this.tempo.longest > 0) summary.holdS = this.tempo.longest;
    this.k.log(this.step, summary);
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
    const order = this.sides() < 0.5 ? [0, 1] : [1, 0]; // position never cues the answer
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

/** A rustkracht run over step `step`, asked encounter by encounter (`opts.order`: this
 *  play's order; default content order). */
export function choiceRun(k: AdventureKit, step: number, opts: ChoiceRunOpts = {}): ChoiceRun {
  return new ChoiceRun(k, step, opts);
}
