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
 * (`tap` → advance / next / replay / ease / complete) as the 2D floor, the spots in the
 * PRINT_SPOTS layout scaled uniformly, the same summary, logged once. Nothing interleaves
 * a running sequence.
 *
 * Run 7 (`adaptive`, design §5.2): ROUNDS from the knobs (`k.knobs('corsi')`; a skin's
 * `rondes` caps them for its story): after a route walked back a new route shows ("Kijk,
 * nog een weg."), one longer when the last was clean; a wrong spot shows the route again,
 * a second one silently a shorter route. The animal's `visit` show is every round's first
 * show; a reshow after a wrong spot is the spots glowing, as always.
 */

import * as THREE from 'three';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { GROEI } from '../../../content/copy';
import { buildCorsiTrial, CorsiRun, type SpanResult } from '../../../engines/corsi';
import type { AdventureKit, FrameSpec } from '../kit';
import { routeStop } from './route-math';
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
  /** `vergeten`: said after a visit show, before `wijs` (the squirrel forgot); `nogEen`
   *  (run 7, default `GROEI.nogEenWeg`): a new round's route is shown */
  lines: { kijk: string; wijs: string; mis: string; goed: string; vergeten?: string; nogEen?: string };
  /** Run 6 (the squirrel): each round's FIRST show is an animal's visits — `visit` goes to
   *  the spot and calls `light(true)` while it is there (it digs), `light(false)` as it
   *  leaves; the beat waits for each visit, one spot at a time. A reshow (after a wrong
   *  pick) is the spots glowing in order, as always. */
  visit?: (spot: { id: number; x: number; z: number }, light: (on: boolean) => void) => Promise<void>;
  /** Run 6: the feedback to a pick, instead of the walker sniffing and the ranger walking
   *  after it: resolves when the next pick may come (short: an animal's quick dash).
   *  Run 7 (additive): `next` = a right spot that ends a round (a new route comes);
   *  `reshow` = a wrong spot (the route again, or silently a shorter one). */
  picked?: (spot: { id: number; x: number; z: number }, res: RoutePick) => Promise<void>;
  /** Run 6: a show just ended (recall is open): `first` = the animal's own visits */
  shown?: (first: boolean) => void;
}

/** What a pick was, for the home's own feedback (`picked`). */
export type RoutePick = 'advance' | 'next' | 'complete' | 'reshow';

/** The span core's answer as a home's feedback reads it (a replay and an ease look alike:
 *  an ease is never shown). */
function pickOf(res: SpanResult): RoutePick {
  return res === 'replay' || res === 'ease' ? 'reshow' : res;
}

/** Show timings (s): each spot lit, dark between two, a breath before the first. */
const ON_S = 0.8;
const GAP_S = 0.35;
const LEAD_S = 0.9;

export async function routeBeat(k: AdventureKit, step: number, o: RouteOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'route';
  const settings = store.get().settings;
  const trial = buildCorsiTrial(k.steps[step].skin, k.knobs('corsi'));
  const run = new CorsiRun(trial, k.play.fork('corsi').rng); // run 7: the play's routes (its 2D twin draws the same)
  await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  await k.frame(o.view, { face: o.stand.heading });
  const field = o.field;
  field.wake(true); // (run 7: a field resting as one draw shows each spot as its own again)
  const camera = k.world.camera;
  const canvas = k.ctx.canvas;
  let phase: 'show' | 'recall' | 'done' = 'show';
  let busy = false;
  run.begin();
  k.stats.route_length = run.sequence.length;
  k.stats.route_rounds = trial.knobs.rounds;
  k.stats.route_round = 1;

  /** The route, one spot at a time (the mission clock: it waits while paused). A round's
   *  first show may be an animal's visits (`visit`); a reshow is the spots glowing. */
  let shownRound = 0;
  const show = async (say: string | null): Promise<void> => {
    phase = 'show';
    field.clear();
    if (say) k.say(say);
    await k.wait(LEAD_S);
    const visits = !!o.visit && shownRound !== run.round;
    shownRound = run.round;
    const seq = [...run.sequence]; // this round's route (an ease draws a new, shorter one)
    for (const id of seq) {
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
    // run 7: he stops beside the spot where he hides no spot from the lens (the route shows
    // again, or a new one comes, while he stands there); none: he stays where he is
    const stop = !o.picked && d > 1.6
      ? routeStop({ spot: s, from: me, spots: field.spots, eye: camera.position, groundY: (x, z) => k.ctx.groundY(x, z) })
      : null;
    const walk = o.picked ? o.picked(s, pickOf(res)).catch(() => {}) : stop ? k.walkRanger(stop.x, stop.z, 0.04).catch(() => false) : Promise.resolve(true);
    if (res === 'replay' || res === 'ease') {
      // a wrong spot: the route again ('replay'), or silently a shorter one ('ease')
      field.mark(i, 'wrong');
      if (settings.geluid) { Sound.sniff(); Sound.tryAgain(); }
      k.say(o.lines.mis);
      void walk.then(() => k.wait(1.2)).then(() => { busy = false; return show(null); }).catch(() => {});
      return;
    }
    field.mark(i, 'ok');
    if (settings.geluid) { Sound.sniff(); Sound.step(); }
    if (res === 'complete') {
      phase = 'done';
      void walk.then(() => { busy = false; finished(); });
      return;
    }
    if (res === 'next') {
      // the round's route is walked back: a new route (one longer after a clean one)
      phase = 'show';
      k.stats.route_round = run.round;
      k.stats.route_length = run.sequence.length;
      if (settings.geluid) Sound.correct();
      // (he walked after the animal to the last spot: back to where he watches, so he never
      // stands in front of the new route)
      const back = (): Promise<unknown> => (o.picked || Math.hypot(k.ranger().x - o.stand.x, k.ranger().z - o.stand.z) < 0.8
        ? Promise.resolve() : k.walkRanger(o.stand.x, o.stand.z, 0.04).catch(() => false));
      void walk.then(() => k.wait(0.5)).then(back).then(() => { busy = false; return show(o.lines.nogEen ?? GROEI.nogEenWeg); }).catch(() => {});
      return;
    }
    void walk.then(() => { busy = false; });
  };
  canvas.addEventListener('pointerdown', onDown, { signal: k.signal });
  let over = false;
  try {
    await show(o.lines.kijk);
    await k.guard(complete);
    over = true;
  } finally {
    canvas.removeEventListener('pointerdown', onDown);
    unhint();
    // stopped mid-show ("Stop de missie"): no spot stays lit with its prints in the world
    if (!over) field.clear();
    field.wake(false); // (it rests as one draw again once its glows have faded)
  }
  const summary = run.summary();
  k.log(step, summary);
  k.stats.route_wrong = run.wrongCount;
  k.stats.route_span = summary.span ?? 0;
  if (settings.geluid) Sound.found();
  k.say(o.lines.goed, { good: true });
  await k.wait(1.8);
  field.clear();
  return summary;
}
