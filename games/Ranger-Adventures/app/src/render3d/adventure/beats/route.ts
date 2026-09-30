/**
 * beats/route.ts — corsi in the world (design §4.1 beat 8, §6): the route the group
 * took, remembered over a field of LOOK-ALIKE spots (turned earth where they rooted),
 * and walked back. The lens holds one view with all seven spots in it; the route lights
 * up one spot at a time (a warm glow and fresh prints, only once the lens has settled);
 * then the child clicks the spots back in order, and the animal he leads trots to each
 * one and sniffs it while he walks after it — feedback, never input. A wrong spot: it
 * sniffs, finds nothing, and the route shows again exactly as the core says.
 *
 * Construct parity (§6): the SAME `buildCorsiTrial` and the SAME pure `CorsiRun`
 * (`tap` → advance / complete / reshow) as the 2D floor, the spots in the PRINT_SPOTS
 * layout scaled uniformly, the same `{ trials: 1, correct }` summary, logged once.
 * Nothing interleaves a running sequence.
 */

import * as THREE from 'three';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildCorsiTrial, CorsiRun } from '../../../engines/corsi';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Actor } from '../actors';
import type { PatchField } from '../patches';
import type { Place } from '../types';

export interface RouteOpts {
  view: FrameSpec;
  /** where the ranger stands to watch (the view's own include spot) */
  stand: Place;
  field: PatchField;
  /** the animal that goes to each spot he picks and sniffs it */
  walker?: Actor;
  /** `vergeten`: said after the first show, before `wijs` (the squirrel forgot) */
  lines: { kijk: string; wijs: string; mis: string; goed: string; vergeten?: string };
  /** Run 6 (the squirrel): the FIRST show is an animal's visits — `visit` goes to the
   *  spot and calls `light(true)` while it is there (it digs), `light(false)` as it
   *  leaves; the beat waits for each visit, one spot at a time. A reshow (after a wrong
   *  pick) is the spots glowing in order, as always. */
  visit?: (spot: { id: number; x: number; z: number }, light: (on: boolean) => void) => Promise<void>;
  /** Run 6: the feedback to a pick, instead of the walker sniffing and the ranger walking
   *  after it: resolves when the next pick may come (short: an animal's quick dash). */
  picked?: (spot: { id: number; x: number; z: number }, res: 'advance' | 'complete' | 'reshow') => Promise<void>;
  /** Run 6: a show just ended (recall is open): `first` = the animal's own visits */
  shown?: (first: boolean) => void;
}

/** Show timings (s): each spot lit, dark between two, a breath before the first. */
const ON_S = 0.8;
const GAP_S = 0.35;
const LEAD_S = 0.9;

export async function routeBeat(k: AdventureKit, step: number, o: RouteOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'route';
  const settings = store.get().settings;
  const trial = buildCorsiTrial(store.difficulty('corsi'));
  const run = new CorsiRun(trial.sequence);
  await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  await k.frame(o.view, { face: o.stand.heading });
  const field = o.field;
  const camera = k.world.camera;
  const canvas = k.ctx.canvas;
  let phase: 'show' | 'recall' | 'done' = 'show';
  let busy = false;
  k.stats.route_length = trial.sequence.length;

  /** The route, one spot at a time (the mission clock: it waits while paused). The
   *  first show may be an animal's visits (`visit`); a reshow is the spots glowing. */
  let shows = 0;
  const show = async (say: boolean): Promise<void> => {
    phase = 'show';
    field.clear();
    if (say) k.say(o.lines.kijk);
    await k.wait(LEAD_S);
    const visits = o.visit && shows === 0;
    shows += 1;
    for (const id of trial.sequence) {
      const i = field.spots.findIndex((s) => s.id === id);
      if (visits) {
        await k.guard(o.visit!(field.spots[i], (on) => { field.show(i, on); if (on && settings.geluid) Sound.dig(); }));
        continue;
      }
      field.show(i, true);
      if (settings.geluid) Sound.dig();
      await k.wait(ON_S);
      field.show(i, false);
      await k.wait(GAP_S);
    }
    if (!visits) await k.wait(0.2);
    phase = 'recall';
    o.shown?.(!!visits);
    if (visits && o.lines.vergeten) {
      // recall opens at once (right after the show); the words follow calmly
      k.say(o.lines.vergeten);
      const at = k.now;
      void k.until(() => k.now - at > 2.4 || phase !== 'recall' || run.recallIndex > 0).then(() => {
        if (phase === 'recall' && !busy) k.say(o.lines.wijs, { queue: true });
      }).catch(() => {});
    } else k.say(o.lines.wijs);
  };

  const unhint = k.hint(() => {
    if (phase !== 'recall' || busy) return null;
    const m = field.mounds[run.expected];
    return m ? { id: String(run.expected), target: m } : null;
  });

  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const pickAt = (e: PointerEvent): number | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(field.mounds, false)[0];
    if (h) return field.indexOf(h.object);
    // near a mound on the ground counts too (a small target, a child's click)
    const y = field.spots.reduce((a, s) => a + s.y, 0) / field.spots.length;
    plane.set(new THREE.Vector3(0, 1, 0), -y);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return field.nearest(hit.x, hit.z, 0.85);
  };

  const onDown = (e: PointerEvent): void => {
    if (phase !== 'recall' || busy || k.world.menuShown()) return;
    const i = pickAt(e);
    if (i === null) return;
    const id = field.spots[i].id;
    const res = run.tap(id);
    const s = field.spots[i];
    busy = true;
    // the piglet trots there and sniffs; the ranger walks after him (feedback, not input)
    // — or the beat's own feedback (the squirrel dashes there and sniffs)
    if (o.walker && !o.picked) void o.walker.sniff(s.x, s.z, 1.2);
    const me = k.ranger();
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    const walk = o.picked ? o.picked(s, res).catch(() => {}) : d > 1.6 ? k.walkRanger(s.x, s.z, 1.25).catch(() => false) : Promise.resolve(true);
    if (res === 'reshow') {
      field.mark(i, 'wrong');
      if (settings.geluid) { Sound.sniff(); Sound.tryAgain(); }
      k.say(o.lines.mis);
      void walk.then(() => k.wait(1.2)).then(() => { busy = false; return show(false); }).catch(() => {});
      return;
    }
    field.mark(i, 'ok');
    if (settings.geluid) { Sound.sniff(); Sound.step(); }
    if (res === 'complete') {
      phase = 'done';
      void walk.then(() => { busy = false; finished(); });
      return;
    }
    void walk.then(() => { busy = false; });
  };
  canvas.addEventListener('pointerdown', onDown, { signal: k.signal });
  try {
    await show(true);
    await k.guard(complete);
  } finally {
    canvas.removeEventListener('pointerdown', onDown);
    unhint();
  }
  const summary = run.summary();
  k.log(step, summary);
  k.stats.route_wrong = run.wrongCount;
  if (settings.geluid) Sound.found();
  k.say(o.lines.goed, { good: true });
  await k.wait(1.8);
  field.clear();
  return summary;
}
