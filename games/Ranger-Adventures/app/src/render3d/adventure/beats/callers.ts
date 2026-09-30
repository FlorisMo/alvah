/**
 * beats/callers.ts — simon in the world (design run6-missions §4.3 beat 4, §4.4 beat 4,
 * §6): animals that are really there — at their own spots round a place in the world —
 * call a growing sequence, each with its own sound and a soft light-up; the child calls
 * them back by clicking them in the same order.
 *
 * Construct parity (§6): the SAME `buildSimonTrial` and the SAME pure `SimonRun`
 * (`begin` → `tap`: advance / grow / complete / replay) as the 2D floor and the 3D
 * stage, so the same `{ trials: 1, correct }` summary, logged once through the kit.
 * Four callers with a distinct call and a distinct place, ALL visible during listening
 * and echoing (the lens holds still); the light-up and the call come together (so it
 * plays muted too); the sequence grows; a wrong click replays the SAME sequence. No
 * other beat runs in between.
 */

import * as THREE from 'three';
import '../../play/play3d.css';
import { buildSimonTrial, randomCaller, SimonRun } from '../../../engines/simon';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { Glow, anchoredPrompt, clearPlayHint, pick3d } from '../../play/kit';
import { listenerOf } from '../../world/Residents';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Place } from '../types';
import { listenPlan } from './callers-math';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const CALL = '#ffd98a';  // the warm light of a call
const OK = '#8fd6a0';    // a right echo
const WRONG = '#e8a27a'; // a wrong echo (soft, warm)

/** One animal that calls. */
export interface Caller {
  /** the content animal id (as the trial's `dieren` names it) */
  id: string;
  /** what a click on it is (its group: the body and anything it sits on) */
  pick: THREE.Object3D;
  /** the model that lights up (one that owns its materials: a spawn) */
  body: THREE.Object3D | null;
  /** what a perfect player clicks (golden's hint: standing on the ground); default the body */
  hint?: THREE.Object3D;
  /** where it is (its call comes from there) */
  at(): { x: number; z: number };
  /** it calls now (on) / is done (off): a little movement of its own (head up, a hop) */
  act?(on: boolean): void;
}

export interface CallersOpts {
  /** the held view (null: the lens already holds one) */
  view: FrameSpec | null;
  stand?: Place;
  callers: readonly Caller[];
  lines: { luister: string; echo: string; goed: string; groei: string; opnieuw: string };
  /** each call (the camera's infrared blinks with it) */
  onCall?(id: string): void;
}

/** Play the callers (simon, step `step`). Resolves once the sequence is echoed to its end. */
export async function callersBeat(k: AdventureKit, step: number, o: CallersOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'callers';
  const settings = store.get().settings;
  const trial = buildSimonTrial(k.steps[step].skin, store.difficulty('simon'));
  const run = new SimonRun(trial.target, () => randomCaller(trial.dieren));
  const byId = new Map(o.callers.map((c) => [c.id, c]));
  const missing = trial.dieren.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`[adventure] no caller for ${missing.join(', ')}`);
  k.stats.callers_target = trial.target;

  if (o.stand) await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  if (o.view) await k.frame(o.view, { face: o.stand?.heading });
  k.say(null);

  const glows = new Map<string, Glow>();
  for (const c of o.callers) if (c.body) glows.set(c.id, new Glow(c.body, CALL));
  const light = (id: string, level: number, color = CALL): void => { glows.get(id)?.set(level, color); };
  const quiet = (): void => { for (const c of o.callers) { light(c.id, 0); c.act?.(false); } };

  let phase: 'listen' | 'echo' | 'done' = 'listen';
  let card: HTMLDivElement | null = null;
  const banner = (text: string, dots: boolean): void => {
    card = anchoredPrompt(k.host,
      `<div class="p3-bottom"><div class="p3-card"><div class="p3-row">` +
      `<p class="p3-text">${esc(text)}</p>` +
      (dots ? `<p class="p3-dots" aria-hidden="true"></p>` : '') +
      `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div></div></div>`, k.signal);
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
    progress();
  };
  const progress = (): void => {
    const el = card?.querySelector('.p3-dots');
    if (el) el.textContent = run.sequence.map((_, i) => (i < run.echoIndex ? '●' : '○')).join(' ');
  };
  const speak = (t: string): void => { if (settings.voorlezen) narrator.speak(t); };
  const callFrom = (id: string): number => {
    const c = byId.get(id)!;
    if (!settings.geluid) return 0;
    const p = c.at();
    const d = Sound.callAt(id, p.x, p.z, listenerOf(k.world.camera));
    return d || Sound.callDur(id);
  };

  /** The animals call the sequence, one at a time, each light-up with its call (after
   *  the words: a call never sounds over the voice). */
  let listenToken = 0;
  const listen = async (line: string | null): Promise<void> => {
    const token = ++listenToken;
    phase = 'listen';
    quiet();
    banner(o.lines.luister, false);
    if (line) speak(line);
    if (settings.voorlezen) await k.guard(narrator.quiet(6000));
    await k.wait(0.4);
    const plan = listenPlan(run.sequence, (id) => Math.max(0.65, Sound.callDur(id)), k.reduced);
    for (const beat of plan) {
      if (token !== listenToken) return;
      const c = byId.get(beat.id)!;
      quiet();
      light(beat.id, 0.65);
      c.act?.(true);
      o.onCall?.(beat.id);
      callFrom(beat.id);
      await k.wait(beat.on);
      light(beat.id, 0);
      c.act?.(false);
      await k.wait(beat.gap);
    }
    if (token !== listenToken) return;
    phase = 'echo';
    banner(o.lines.echo, true);
    speak(o.lines.echo);
  };

  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });
  const flash = (id: string, color: string, secs: number): void => {
    light(id, color === WRONG ? 0.6 : 0.45, color);
    void k.wait(secs).then(() => { if (phase !== 'listen') light(id, 0); }).catch(() => {});
  };
  const onPick = (id: string): void => {
    if (phase !== 'echo') return;
    const res = run.tap(id);
    progress();
    if (res === 'advance') {
      callFrom(id);
      flash(id, OK, 0.4);
      return;
    }
    if (res === 'complete') {
      phase = 'done';
      callFrom(id);
      light(id, 0.45, OK);
      finished();
      return;
    }
    if (res === 'grow') {
      phase = 'listen';
      light(id, 0.45, OK);
      if (settings.geluid) Sound.correct();
      banner(o.lines.groei, false);
      speak(o.lines.groei);
      void k.wait(1.3).then(() => listen(null)).catch(() => {});
      return;
    }
    // a wrong click: recoverable — the SAME sequence again
    phase = 'listen';
    flash(id, WRONG, 0.65);
    if (settings.geluid) Sound.tryAgain();
    k.stats.callers_wrong = (k.stats.callers_wrong ?? 0) + 1;
    banner(o.lines.opnieuw, false);
    speak(o.lines.opnieuw);
    void k.wait(1.5).then(() => listen(null)).catch(() => {});
  };

  const unhint = k.hint(() => {
    if (phase !== 'echo') return null;
    const c = byId.get(run.expected);
    return c ? { id: c.id, target: c.hint ?? c.body ?? c.pick } : null;
  });
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets: o.callers.map((c) => ({ id: c.id, object: c.pick })), onPick, signal: k.signal,
  });
  try {
    run.begin();
    await listen(o.lines.luister);
    await k.guard(complete);
  } finally {
    teardown();
    unhint();
    clearPlayHint();
    listenToken += 1;
  }
  const summary = run.summary();
  k.log(step, summary);
  if (settings.geluid) Sound.found();
  banner(o.lines.goed, false);
  speak(o.lines.goed);
  await k.wait(1.8);
  quiet();
  for (const g of glows.values()) g.clear();
  (card as HTMLDivElement | null)?.remove();
  return summary;
}
