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
 * sky turning. The card at the bottom shows the animal that comes (its picture, its
 * name, its ☀/🌙 tag), the question, and the rule.
 */

import * as THREE from 'three';
import '../../play/play3d.css';
import { buildWisselTrial, dagOfNacht, type WisselBin, type WisselItem } from '../../../engines/wisselen';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { animalIcon } from '../../../render2d/animalIcon';
import { anchoredPrompt, clearPlayHint, pick3d } from '../../play/kit';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Place } from '../types';
import { AimRun } from './aim-math';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
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
  /** the right place: the animal walks in there and is photographed */
  photo(item: WisselItem, bin: WisselBin): Promise<void>;
  /** the wrong place: an empty photo */
  empty(bin: WisselBin): Promise<void>;
  /** the animal of the photo before walks off (the next one comes) */
  leave(item: WisselItem): void;
  /** the day turns (the rule flipped): the sky fades to night or back to day */
  turn(to: 'night' | 'day'): Promise<void>;
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
    /** a right photo: "Klik! Een mooie foto." */
    foto: string;
    /** an empty photo: "Leeg. Het dier is daar nu niet." */
    leeg: string;
    /** the day turns: "Het wordt nacht." / "Het wordt dag." */
    nacht: string;
    dag: string;
    /** the rule flipped: "Nu is het andersom!" */
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
  const trial = buildWisselTrial(skin, store.difficulty('wisselen'));
  const aim = new AimRun(trial, regel);
  k.stats.aim_animals = trial.queue.length;
  k.stats.aim_flip_every = trial.flipEvery;
  const w = o.world;

  await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  await k.frame(o.view, { face: o.stand.heading });
  k.say(null);
  w.begin();

  const speak = (t: string): void => { if (settings.voorlezen) narrator.speak(t); };
  const queue = (t: string): void => { if (settings.voorlezen) narrator.queue(t); };

  /** The card: the animal that comes (picture, name, tag), the question, the rule. */
  let card: HTMLDivElement | null = null;
  const show = (item: WisselItem, flip: string | null, toast: { kind: 'ok' | 'gevolg'; text: string } | null): void => {
    const cue = dagOfNacht(item.dag);
    const [c1, c2] = aim.chips;
    const komt = o.lines.komt(item.id);
    card = anchoredPrompt(k.host,
      `<div class="p3-bottom aim3d">` +
      (toast ? `<div class="p3-toast ${toast.kind}" role="status">${esc(toast.text)}</div>` : '') +
      `<div class="p3-card">` +
      (flip ? `<p class="p3-flip">${esc(flip)}</p>` : '') +
      `<div class="p3-row">` +
      `<span class="aim-pic" aria-hidden="true">${animalIcon(item.id)}</span>` +
      `<div class="p3-lines"><p class="p3-text">${esc(komt)}</p><p class="p3-sub">${esc(o.lines.vraag)}</p></div>` +
      `<span class="aim-tag ${item.dag ? 'dag' : 'nacht'}">${esc(`${cue.icoon} ${cue.woord}`)}</span>` +
      `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="p3-chips" aria-label="De regel"><span class="p3-chip">${esc(c1)}</span><span class="p3-chip">${esc(c2)}</span></div>` +
      `</div></div>`,
      k.signal);
    const said = `${komt} ${cue.woord}. ${o.lines.vraag}`;
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(flip ? `${flip} ${aim.rule} ${said}` : said));
  };
  const say = (item: WisselItem): string => `${o.lines.komt(item.id)} ${dagOfNacht(item.dag).woord}. ${o.lines.vraag}`;

  let busy = true;
  let ready = false;
  const unhint = k.hint(() => {
    if (!ready || busy || !aim.current) return null;
    return { id: aim.right, target: w.places[aim.right].hint };
  });

  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });
  const onPick = (id: string): void => {
    const item = aim.current;
    if (!ready || busy || !item) return; // (the pause card covers the canvas: no click gets here)
    const bin = id as WisselBin;
    busy = true;
    // the words of the pick before ("Leeg…", "Klik!…") go: they are not about this one
    card?.querySelector('.p3-toast')?.remove();
    const s = aim.pick(bin);
    void (async () => {
      await w.look(bin);
      if (s.shot === 'empty') {
        if (settings.geluid) Sound.tryAgain();
        await w.empty(bin);
        k.stats.aim_wrong = (k.stats.aim_wrong ?? 0) + 1;
        show(item, null, { kind: 'gevolg', text: o.lines.leeg });
        speak(o.lines.leeg);
        busy = false;
        return;
      }
      await w.photo(item, bin);
      k.beat = `aim:${aim.run.index}`;
      if (settings.geluid) Sound.correct();
      if (s.done) { finished(); return; }
      const next = aim.current!;
      if (s.turn) {
        const turnLine = s.turn === 'night' ? o.lines.nacht : o.lines.dag;
        const flip = `${turnLine} ${o.lines.andersom}`;
        w.leave(item);
        if (settings.geluid) Sound.select();
        show(next, flip, null);
        speak(flip);
        await w.turn(s.turn);
        queue(aim.rule); // the NEW rule, said outright (two channels: the sky and the words)
        queue(say(next));
        k.stats.aim_turns = (k.stats.aim_turns ?? 0) + 1;
      } else {
        show(next, null, { kind: 'ok', text: o.lines.foto });
        w.leave(item);
        speak(`${o.lines.foto} ${say(next)}`);
      }
      busy = false;
    })().catch(() => {});
  };

  const targets = (['open', 'hol'] as const).map((b) => ({ id: b, object: w.places[b].pick }));
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets, onPick, signal: k.signal,
  });
  try {
    const first = aim.current!;
    show(first, null, null);
    speak(`${aim.rule} ${say(first)}`);
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
    `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `</div></div></div>`, k.signal);
  card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(o.lines.goed));
  speak(o.lines.goed);
  await k.wait(2.2);
  card.remove();
  w.end();
  return summary;
}
