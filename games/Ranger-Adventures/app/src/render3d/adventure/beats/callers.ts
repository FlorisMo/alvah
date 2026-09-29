/**
 * beats/callers.ts — simon in the world (design §4.4 beat 4, §6): real animals at their
 * own places round the ranger call a growing sequence, and he calls them back by
 * clicking them in the same order. The lens holds one view with every caller in it (none
 * behind leaves); a call is the animal's own sound WITH a warm light-up and its own
 * small motion (a tail flick, a hop), so it plays with the sound off too.
 *
 * Construct parity (§6): the SAME `buildSimonTrial` and the SAME pure `SimonRun` (begin
 * → tap → advance / grow / complete / replay) as the 2D floor and simon3d: four callers
 * with distinct calls and places, all visible through listen and echo, a growing
 * sequence, a wrong click replays the same sequence, nothing in between; the same
 * `{ trials: 1, correct }` summary, logged once.
 */

import * as THREE from 'three';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { narrator } from '../../../core/narrator';
import { buildSimonTrial, randomCaller, SimonRun } from '../../../engines/simon';
import { Glow, pick3d } from '../../play/kit';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Place } from '../types';

/** One animal that calls: what a child sees and clicks, and its own small motion. */
export interface Caller {
  /** the content animal id (the trial's `dieren`) */
  id: string;
  object: THREE.Object3D;
  /** it calls: a flick of the tail, a hop (the beat plays the sound and the light) */
  call(): void;
}

export interface CallersOpts {
  view: FrameSpec;
  /** where the ranger stands (he walks there first, the input locked) */
  stand: Place;
  callers: readonly Caller[];
  lines: { luister: string; echo: string; groei: string; opnieuw: string; goed: string };
}

const CALL = '#ffd98a';  // the warm light of a call
const OK = '#8fd6a0';    // a calm green: the right one
const WRONG = '#e8a27a'; // soft warm, never an alarm red

/** The pause (ms) between two calls, and the shortest a call is lit. */
const GAP_MS = 360;
const MIN_LIT_MS = 700;

export async function callersBeat(k: AdventureKit, step: number, o: CallersOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'callers';
  const settings = store.get().settings;
  const trial = buildSimonTrial(k.steps[step].skin, store.difficulty('simon'));
  const run = new SimonRun(trial.target, () => randomCaller(trial.dieren));
  const byId = new Map(o.callers.map((c) => [c.id, c]));
  for (const id of trial.dieren) if (!byId.has(id)) throw new Error(`[callers] no caller for "${id}"`);
  await k.walkRanger(o.stand.x, o.stand.z, 0.05);
  await k.frame(o.view, { face: o.stand.heading });
  k.stats.callers_target = trial.target;

  const glows = new Map(trial.dieren.map((id) => [id, new Glow(byId.get(id)!.object, CALL)]));
  const level = new Map<string, number>();
  const want = new Map<string, { v: number; color: string }>();
  const light = (id: string, v: number, color = CALL): void => { want.set(id, { v, color }); };
  const quiet = (): void => { for (const id of trial.dieren) light(id, 0); };
  const offTick = k.onTick((dt) => {
    for (const id of trial.dieren) {
      const w = want.get(id) ?? { v: 0, color: CALL };
      const cur = level.get(id) ?? 0;
      const next = k.reduced ? w.v : cur + (w.v - cur) * Math.min(1, dt * 12);
      level.set(id, next);
      glows.get(id)!.set(next, w.color);
    }
  });

  let phase: 'listen' | 'echo' | 'done' = 'listen';
  let token = 0;
  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });

  /** The animals call the sequence, one at a time, once the voice is quiet. */
  const listen = async (line: string | null): Promise<void> => {
    const my = ++token;
    phase = 'listen';
    quiet();
    if (line) k.say(line);
    if (settings.voorlezen) await k.guard(narrator.quiet(6000));
    await k.wait(0.5);
    for (const id of run.sequence) {
      if (my !== token) return;
      const c = byId.get(id)!;
      light(id, 0.42);
      c.call();
      const dur = settings.geluid ? Sound.call(id) : Sound.callDur(id);
      await k.wait(Math.max(MIN_LIT_MS, dur * 1000) / 1000);
      light(id, 0);
      await k.wait(GAP_MS / 1000);
    }
    if (my !== token) return;
    phase = 'echo';
    k.say(o.lines.echo);
  };

  const onPick = (id: string): void => {
    if (phase !== 'echo' || k.world.menuShown()) return;
    const res = run.tap(id);
    const c = byId.get(id);
    k.stats.callers_taps = (k.stats.callers_taps ?? 0) + 1;
    if (res === 'advance' || res === 'grow' || res === 'complete') {
      if (settings.geluid && res === 'advance') Sound.call(id);
      c?.call();
      light(id, 0.28, OK);
      window.setTimeout(() => { if (phase !== 'done') light(id, 0); }, 420);
    }
    if (res === 'grow') {
      phase = 'listen';
      if (settings.geluid) Sound.correct();
      void k.wait(1.1).then(() => listen(o.lines.groei)).catch(() => {});
    } else if (res === 'complete') {
      phase = 'done';
      if (settings.geluid) Sound.found();
      finished();
    } else if (res === 'replay') {
      phase = 'listen';
      light(id, 0.35, WRONG);
      if (settings.geluid) Sound.tryAgain();
      void k.wait(1.2).then(() => listen(o.lines.opnieuw)).catch(() => {});
    }
  };

  const teardown = pick3d({
    canvas: k.ctx.canvas,
    camera: k.world.camera,
    raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets: o.callers.filter((c) => trial.dieren.includes(c.id)).map((c) => ({ id: c.id, object: c.object })),
    onPick,
    signal: k.signal,
  });
  const unhint = k.hint(() => {
    if (phase !== 'echo') return null;
    const c = byId.get(run.expected);
    return c ? { id: c.id, target: c.object } : null;
  });

  try {
    run.begin();
    void listen(o.lines.luister).catch(() => {});
    await k.guard(complete);
  } finally {
    token += 1;
    teardown();
    unhint();
  }
  const summary = run.summary();
  k.log(step, summary);
  k.stats.callers_wrong = run.wrongCount;
  k.say(o.lines.goed, { good: true });
  await k.wait(1.4);
  offTick();
  quiet();
  for (const g of glows.values()) g.clear();
  return summary;
}
