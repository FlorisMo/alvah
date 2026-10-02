/**
 * beats/aim.ts — wisselen in the world (design run6-missions §4.3 beat 3, §6): a camera
 * trap is aimed, animal by animal, at one of two NAMED places in one held view — the
 * open glade or the thicket — by the rule on the card ("Dag-dier → open plek. Nacht-dier
 * → het bosje."). When the rule flips, the day turns to night (or back): the sky, the
 * card and the voice say it together ("Het wordt nacht. Nu is het andersom!").
 *
 * Construct parity (§6): the SAME `buildWisselTrial`, `WisselRun` (through the pure
 * `AimRun`), `placeNames`, `regelAndersom` and `dagOfNacht` as the 2D floor and the 3D
 * stage; both places visible and named the whole time; the rule shown with icons; the
 * flip cued in two channels; the ranger never walks while he sorts; a wrong place is
 * recoverable (an empty photo, the same animal again); the same `{ trials: 1, correct }`
 * summary, logged once through the kit.
 *
 * What the child sees is the mission's (`AimWorld`): the camera turning on its strap,
 * the animal walking into view there, the shutter and the photo, the empty photo, the
 * sky turning. The card at the bottom shows the animal that comes (its drawn picture,
 * its name, its day/night tag with a drawn sun or moon), the question, and the rule. A press beside both places gets a
 * calm "no" from the camera (it is no pick: the core only ever hears a place). The flip
 * is the round's peak: the card makes way, the day turns (the sky, the camera's light),
 * and only then comes the new rule, said outright, with the next animal. The places'
 * own marks (a sun on the glade, a moon on the thicket) stay as they are, as the 2D
 * floor's bins do: after the flip a day animal goes to the moon's place — the switch.
 */

import * as THREE from 'three';
import '../../play/play3d.css';
import { buildWisselTrial, dagOfNacht, type WisselBin, type WisselItem } from '../../../engines/wisselen';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { aimPicture, dayNightIcon } from './aim-pics';
import { anchoredPrompt, clearPlayHint, pick3d, SPEAK_BTN } from '../../play/kit';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Place } from '../types';
import { AimRun } from './aim-math';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** run 7: the pick id of the animal standing on the crossing (no place) */
const VISITOR = '__visitor';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** What the mission does in the world for the aim beat. */
export interface AimWorld {
  /** the two places: what a click on each is (the pick targets), and the thing a perfect
   *  player clicks (golden's play hint: visible, standing on the ground) */
  places: Record<WisselBin, { pick: THREE.Object3D; hint: THREE.Object3D }>;
  /** the beat starts / ends (the places' names, the camera's fan) */
  begin(): void;
  end(): void;
  /** turn the camera to look at the place (resolves when it looks there) */
  look(bin: WisselBin): Promise<void>;
  /** the right place: the animal walks in there (it sets off at once, while the camera
   *  still turns: `looked` resolves when it looks there) and is photographed */
  photo(item: WisselItem, bin: WisselBin, looked: Promise<void>): Promise<void>;
  /** the wrong place: an empty photo */
  empty(bin: WisselBin): Promise<void>;
  /** the animal of the photo before walks off (the next one comes) */
  leave(item: WisselItem): void;
  /** an animal photographed at this place is still walking off through it (a perfect
   *  player waits for it to go before he aims there again: the play hint waits too) */
  leaving?(bin: WisselBin): boolean;
  /** the day turns (the rule flipped): the sky fades to night or back to day (the
   *  places keep their marks: the rule turned, not the places); resolves when it has */
  turn(to: 'night' | 'day'): Promise<void>;
  /** a press beside both places: the camera shakes a calm "no" (no pick, no photo) */
  miss?(): void;
  /** run 7 (additive; without it the beat plays as before): the animal comes FIRST. Called
   *  for each animal of the queue (`index`: its place in it) as soon as it is next — the
   *  first before the first card, the next one at the right click before it (in parallel
   *  with that photo) — and awaited before its card shows: it walks (or flies) in and
   *  stands where he sees it, and he decides by watching it. No hint, no pick until then.
   *  `turn`: the day turns before its card (the card then carries the new rule, taller). */
  arrive?(item: WisselItem, index: number, turn?: 'night' | 'day'): Promise<void>;
  /** run 7 (additive): the animal that stands on the crossing while he decides, as a pick
   *  target (an invisible proxy round it): a click on it is no choice (the click would
   *  otherwise go through it to a place behind it); `touch` is its calm reaction */
  visitor?: THREE.Object3D;
  touch?(item: WisselItem): void;
}

export interface AimOpts {
  view: FrameSpec;
  /** where the ranger stands while he aims (the view's own include spot) */
  stand: Place;
  world: AimWorld;
  lines: {
    /** "Waar kijkt de camera?" */
    vraag: string;
    /** the animal comes: "Daar komt een hert." (by animal id) */
    komt: (id: string) => string;
    /** run 7 (additive): the card's first line once the animal stands there: "Kijk, een
     *  vos." (only with `world.arrive`; else `komt`) */
    kijk?: (id: string) => string;
    /** a right photo: "Klik! Een mooie foto." */
    foto: string;
    /** an empty photo: "Leeg. Het dier is daar nu niet." */
    leeg: string;
    /** the day turns: "Het wordt nacht." / "Het wordt dag." */
    nacht: string;
    dag: string;
    /** the rule flipped: "Nu is het andersom!" (the card's banner, then the rule said) */
    andersom: string;
    /** all done: the step's own goed line */
    goed: string;
  };
}

/** Play the aim (wisselen, step `step`). Resolves once every animal is photographed. */
export async function aimBeat(k: AdventureKit, step: number, o: AimOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'aim';
  const settings = store.get().settings;
  const skin = k.steps[step].skin;
  const regel = skin.copy?.regel ?? 'Dag-dier → open plek. Nacht-dier → het hol.';
  // run 7: the level's knobs (how many animals, when the rule turns, how often: a turn back
  // to day from band 4) and the play's queue (its 2D twin draws the same)
  const trial = buildWisselTrial(skin, k.knobs('wisselen'), k.play.fork('wisselen').rng);
  const aim = new AimRun(trial, regel);
  k.stats.aim_animals = trial.queue.length;
  k.stats.aim_flip_every = trial.flipEvery;
  k.stats.aim_flips = trial.flips ?? 1;
  const w = o.world;
  /** the card's first line for an animal: what he sees (it stands there), or what comes */
  const first = (id: string): string => (w.arrive && o.lines.kijk ? o.lines.kijk(id) : o.lines.komt(id));

  await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  await k.frame(o.view, { face: o.stand.heading });
  k.say(null);
  w.begin();

  const speak = (t: string): void => { if (settings.voorlezen) narrator.speak(t); };
  const queue = (t: string): void => { if (settings.voorlezen) narrator.queue(t); };

  /** A rule chip ("☀️ Dag-dier → open plek") with its drawn sun or moon for the emoji. */
  const chip = (c: string): string => {
    const dag = c.startsWith(dagOfNacht(true).icoon);
    const icoon = dagOfNacht(dag).icoon;
    return `<span class="p3-chip">${dayNightIcon(dag)}${esc(c.startsWith(icoon) ? c.slice(icoon.length).trim() : c)}</span>`;
  };
  /** The card: the animal that comes (picture, name, tag), the question, the rule. */
  let card: HTMLDivElement | null = null;
  const show = (item: WisselItem, flip: string | null, toast: { kind: 'ok' | 'gevolg'; text: string } | null): void => {
    const cue = dagOfNacht(item.dag);
    const [c1, c2] = aim.chips;
    const komt = first(item.id);
    card = anchoredPrompt(k.host,
      `<div class="p3-bottom aim3d${flip ? ' aim-flipped' : ''}">` +
      (toast ? `<div class="p3-toast ${toast.kind}" role="status">${esc(toast.text)}</div>` : '') +
      `<div class="p3-card">` +
      (flip ? `<p class="p3-flip aim-flip">${esc(flip)}</p>` : '') +
      `<div class="p3-row">` +
      `<span class="aim-pic" aria-hidden="true">${aimPicture(item.id)}</span>` +
      `<div class="p3-lines"><p class="p3-text">${esc(komt)}</p><p class="p3-sub">${esc(o.lines.vraag)}</p></div>` +
      `<span class="aim-tag ${item.dag ? 'dag' : 'nacht'}">${dayNightIcon(item.dag)}${esc(cue.woord)}</span>` +
      `${SPEAK_BTN}` +
      `</div>` +
      `<div class="p3-chips" aria-label="De regel">${chip(c1)}${chip(c2)}</div>` +
      `</div></div>`,
      k.signal);
    const said = `${komt} ${cue.woord}. ${o.lines.vraag}`;
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(flip ? `${flip} ${aim.rule} ${said}` : said));
  };
  /** The card makes way for the world (the flip): only its one line stays, small. */
  const turning = (line: string): void => {
    card = anchoredPrompt(k.host,
      `<div class="p3-bottom aim3d aim-turning"><div class="p3-card"><div class="p3-row">` +
      `<p class="p3-flip aim-flip">${esc(line)}</p>${SPEAK_BTN}` +
      `</div></div></div>`, k.signal);
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(line));
  };
  const say = (item: WisselItem): string => `${first(item.id)} ${dagOfNacht(item.dag).woord}. ${o.lines.vraag}`;

  let busy = true;
  let ready = false;
  const unhint = k.hint(() => {
    if (!ready || busy || !aim.current) return null;
    if (w.leaving?.(aim.right)) return null; // (the stag of the photo before still stands in front of the juniper)
    return { id: aim.right, target: w.places[aim.right].hint };
  });

  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });
  const onPick = (id: string): void => {
    const item = aim.current;
    if (!ready || busy || !item) return; // (the pause card covers the canvas: no click gets here)
    if (id === VISITOR) { w.touch?.(item); return; } // (the animal itself: no choice)
    const bin = id as WisselBin;
    busy = true;
    // the words of the pick before ("Leeg…", "Klik!…") go: they are not about this one
    card?.querySelector('.p3-toast')?.remove();
    const s = aim.pick(bin);
    const pickedAt = k.now;
    /** (dev read: seconds from a right click to the next animal's card, the longest) */
    const timed = (): void => {
      const t = Math.round((k.now - pickedAt) * 10) / 10;
      k.stats.aim_card_s = t;
      k.stats.aim_card_max_s = Math.max(k.stats.aim_card_max_s ?? 0, t);
    };
    void (async () => {
      const looked = w.look(bin);
      if (s.shot === 'empty') {
        await looked;
        if (settings.geluid) Sound.tryAgain();
        await w.empty(bin);
        k.stats.aim_wrong = (k.stats.aim_wrong ?? 0) + 1;
        show(item, null, { kind: 'gevolg', text: o.lines.leeg });
        speak(o.lines.leeg);
        busy = false;
        return;
      }
      // (run 7: the next animal comes while this one is photographed; the world says when
      // it sets off, and its card waits for it)
      const next0 = s.done ? undefined : aim.current;
      const arriving = next0 && w.arrive ? w.arrive(next0, aim.run.index, s.turn ?? undefined) : Promise.resolve();
      arriving.catch(() => {});
      await w.photo(item, bin, looked);
      k.beat = `aim:${aim.run.index}`;
      if (settings.geluid) Sound.correct();
      if (s.done) { finished(); return; }
      const next = aim.current!;
      if (s.turn) {
        // the peak of the round: the card makes way and the world turns (the sky, the
        // camera's light) under one line, "Het wordt nacht.";
        // then the card comes back with the new rule said outright, and the next animal
        k.beat = 'aim:turn';
        const turnLine = s.turn === 'night' ? o.lines.nacht : o.lines.dag;
        w.leave(item);
        turning(turnLine);
        speak(turnLine);
        if (settings.geluid) Sound.select();
        await w.turn(s.turn);
        await k.guard(arriving);
        show(next, o.lines.andersom, null);
        k.stats.aim_turn_s = Math.round((k.now - pickedAt) * 10) / 10;
        speak(`${o.lines.andersom} ${aim.rule}`); // the NEW rule, said outright
        queue(say(next));
        k.beat = `aim:${aim.run.index}`;
        k.stats.aim_turns = (k.stats.aim_turns ?? 0) + 1;
      } else if (w.arrive) {
        // the photo's words now; the next card once the next animal stands there
        w.leave(item);
        if (settings.voorlezen) narrator.speak(o.lines.foto);
        await k.guard(arriving);
        show(next, null, { kind: 'ok', text: o.lines.foto });
        timed();
        queue(say(next));
      } else {
        show(next, null, { kind: 'ok', text: o.lines.foto });
        timed();
        w.leave(item);
        speak(`${o.lines.foto} ${say(next)}`);
      }
      busy = false;
    })().catch(() => {});
  };

  /** a press beside both places: the camera's calm "no" (only while it waits for a pick) */
  const onMiss = (): void => {
    if (!ready || busy || !aim.current) return;
    k.stats.aim_miss = (k.stats.aim_miss ?? 0) + 1;
    w.miss?.();
  };
  const targets = (['open', 'hol'] as const).map((b) => ({ id: b as string, object: w.places[b].pick }));
  if (w.visitor) targets.push({ id: VISITOR, object: w.visitor });
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets, onPick, onMiss, signal: k.signal,
  });
  try {
    const lead = aim.current!;
    // (run 7: the first animal walks in before its card, while the rule is said)
    if (w.arrive) {
      speak(aim.rule);
      await k.guard(w.arrive(lead, 0));
      show(lead, null, null);
      queue(say(lead));
    } else {
      show(lead, null, null);
      speak(`${aim.rule} ${say(lead)}`);
    }
    ready = true;
    busy = false;
    await k.guard(complete);
  } finally {
    teardown();
    unhint();
    clearPlayHint();
  }
  const summary = aim.summary();
  k.log(step, summary);
  if (settings.geluid) Sound.found();
  card = anchoredPrompt(k.host,
    `<div class="p3-bottom aim3d"><div class="p3-card"><div class="p3-row">` +
    `<p class="p3-text">${esc(o.lines.goed)}</p>` +
    `${SPEAK_BTN}` +
    `</div></div></div>`, k.signal);
  card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(o.lines.goed));
  speak(o.lines.goed);
  await k.wait(2.2);
  card.remove();
  w.end();
  return summary;
}
