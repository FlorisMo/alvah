/**
 * ecoduct.ts — "De oversteek" as an adventure at the real ecoduct (run 7, design
 * `state/adventures/design.md` §4).
 *
 * One calm look at the green bridge for animals; a quiet walk to the wildlife screen in front
 * of its mouth; then he watches who comes over. Groups come down off the bridge behind its
 * ends and round its corner to the raked sand bed: red deer, a sow with her piglets, a roe
 * with her calf, a fox alone (in the mist and at dusk) — another mix, other corners and other
 * ways out every play; each group waits out of his picture and walks in at its edge. As
 * the first group comes, the first calm moment: keep his FEET still (a step and they stop and
 * stare at the screen) or keep his HANDS still when the young one comes right up to the
 * screen and looks at him (a click calls it: it startles and trots off, and comes back). Then
 * the ROUTE (corsi): the group's lead treads the sand bed patch by patch, its fresh tracks
 * lighting where it steps, the others after it into the heath; "Welke weg liepen ze?" — he
 * points the patches back; the next group crosses with a new route (one longer after a clean
 * one). Then the two other calm moments, in this play's order: feet still as another group
 * comes, hands still as a young one looks at him, and the flip — he looks at the tracks in
 * the sand up close, and a group comes and waits at the bridge's foot: he stands in their way
 * ("Ze willen over. Ga maar opzij."), and only when he steps aside do they cross past him.
 * The last group into the heath is the reunion: "De dieren staken veilig over."
 *
 * Every play draws its own crossing under the briefing card (ecoduct.places `ecoductLayout`):
 * which groups, round which corner, out which way, how many; the order of the three moments
 * is the dagnacht trial's own (the 2D floor's too); the light is the home's own each play
 * (dawn mist, the golden hour, an overcast evening, dusk); now and then a badger trundles over
 * (k.rare). How long a route is, how many groups cross for it, how long he must keep still
 * and how long the animals wait for him are the level's knobs, never this file's.
 *
 * Steps (content, the EF contract): 0 corsi · 1 dagnacht, each logged once.
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Mission } from '../../../content/types';
import type { Play } from '../../../core/play';
import type { Residents } from '../../world/Residents';
import type { Actor } from '../actors';
import type { Spot } from '../types';
import type { MoodId } from '../../Moods';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildCorsiTrial } from '../../../engines/corsi';
import { playDagnachtTrial, type Encounter } from '../../../engines/dagnacht';
import { routeBeat } from '../beats/route';
import { choiceRun, type ChoiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { atLocal, dist, headingTo, toward } from '../places';
import { Seen } from './ven.finds';
import { SIZE } from '../../AnimalScale';
import { REVEAL_GAP_MS, REVEAL_SHOW_MS } from '../../../ui/hud/reveal-queue';
import { EcoductHome } from './ecoduct.home';
import {
  AFTER_HINDE, AFTER_KALF, ASIDE, BACK_MAX, BED, BED_STAND, BED_VIEW, DAS, DAS_ID, DECK_LOOK, ECODUCT_HOME, EXITS, GROUPS, MISSION, STAND, TRAILS, VARIANT_KEY,
  asideView, backCorner, backOff, backWay, crossingLine, ecoductClearings, ecoductLayout, ecoductTreeClearings, fileBack, flipFacing, haltOf, lastVariants, leaveWay, mouthOf, onBed, roepSpot, waitOf,
  type Crossing, type EcoductLaid, type Kind, type Side,
} from './ecoduct.places';

/** The light this home plays in: animals cross at dawn and dusk (a new light each play,
 *  never one of his last two plays'). */
export const ECODUCT_MOODS = { allow: ['ochtendnevel', 'gouden-uur', 'bewolkt', 'schemer'] as readonly MoodId[], perPlay: 2 };

/** How fast each kind walks down to the bed and over it (m/s): calm, never a dash. */
const PACE: Readonly<Record<Kind | 'das', number>> = { hert: 1.35, zwijn: 1.0, ree: 1.25, vos: 1.2, das: 1.15 };
/** The hind and her calf's walk over the sand and home at the end (m/s): brisk, so they are
 *  grazing at their spot while the reunion's line is still up. */
const HOME_PACE = 1.5;
/** A curious young one's trot up to him (m/s), before its last careful step. */
const YOUNG_TROT = 2.5;
/** How far each walks behind the one before it (m). */
const GAP: Readonly<Record<Kind | 'das', number>> = { hert: 2.1, zwijn: 0.95, ree: 1.5, vos: 1.2, das: 1 };
/** Its calls: a soft contact call (a temptation) and its alarm (a reach). */
const CALL: Readonly<Record<Kind | 'das', { soft: string; alarm: string }>> = {
  hert: { soft: 'fiep', alarm: 'ree' }, zwijn: { soft: 'wildzwijn', alarm: 'wildzwijn' }, ree: { soft: 'fiep', alarm: 'ree' },
  vos: { soft: 'vos', alarm: 'vos' }, das: { soft: 'das', alarm: 'das' },
};
/** How far (m) the opening look's aim lies from the lens: it glides ~5 m toward the bridge. */
const LOOK_AIM_M = 11;
/** The route's show: the lead trots from patch to patch (it knows the way) — each hop takes
 *  about `hop` s (`min`-`max` m/s); the patch glows from the moment it steps onto it (`on` m
 *  from its middle) and its nose goes to the sand for `dwell` s. About 1.2-1.9 s a patch (the
 *  2D floor lights one every 1.15 s; the squirrel's visits ≤ 2 s): `visit_s` measures it. */
const VISIT = { hop: 0.7, min: 2.5, max: 3.5, dwell: 0.4, on: 0.5 } as const;
/** How big (px) an animal shows in his picture, steady for a second, before it is his. */
const SEEN_PX = 40;
/** One new find's card (s; ui/hud/reveal-queue.ts), and the longest a calm moment holds on
 *  for cards still waiting (two): they show where they belong, never spill into a next play. */
const CARD_S = (REVEAL_SHOW_MS + REVEAL_GAP_MS) / 1000;
const CARDS_MAX_S = 2 * CARD_S;

/** Is something being said now (a call never sounds over a spoken line)? */
function speaking(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
}

/** This play's crossing, drawn and laid under the briefing card. */
let drawn: { seed: number; laid: EcoductLaid } | null = null;

/** Draw this play's crossing (its seed, his last plays) and lay the bed smooth for it. */
function lay(world: { residents: Residents }, mission: Mission, play: Play): EcoductLaid | null {
  const home = world.residents.dressing(MISSION) as EcoductHome | null;
  if (!home) return null;
  const s = store.get();
  // the three moments' order: the very trial the run (and the 2D floor) plays this play
  const order = playDagnachtTrial(mission.stappen[1].skin, { jargon: s.settings.jargon, reducedMotion: false, ...store.knobs('dagnacht') }, play, s.geschiedenis)
    .encounters.map((e) => e.id);
  // how many groups cross for the route: the level's rounds (the skin may cap them)
  const rounds = buildCorsiTrial(mission.stappen[0].skin, store.knobs('corsi')).knobs.rounds;
  // (the light this play stands in: the fox only crosses in the mist and at dusk)
  const mood = typeof play.variant?.mood === 'string' ? play.variant.mood as MoodId : undefined;
  const laid = ecoductLayout(play, rounds, order, lastVariants(s.geschiedenis), mood);
  play.note(VARIANT_KEY, laid.variant);
  // the bed raked smooth for tonight's tracks
  home.rake();
  drawn = { seed: play.seed, laid };
  return laid;
}

export const ecoductAdventure: Adventure = {
  id: MISSION,
  home: ECODUCT_HOME,
  clearings: ecoductClearings(),
  treeClearings: ecoductTreeClearings(),
  dressing: (env) => new EcoductHome(env),
  moods: ECODUCT_MOODS,
  /** Under the briefing card: this play's crossing is drawn, the bed raked. */
  prepare(world, mission, play) { lay(world, mission, play); },
  unprepare(world) { (world.residents.dressing(MISSION) as EcoductHome | null)?.setState(world.residents.state(MISSION) ?? 'before'); drawn = null; },

  async play(k: AdventureKit): Promise<void> {
    const laid = drawn && drawn.seed === k.play.seed ? drawn.laid : lay(k.world, k.mission, k.play);
    if (!laid) throw new Error('[ecoduct] no home');
    await story(k, laid);
  },
};

/* ------------------------------------------------------------- a group ---- */

/** A walk the script can hold (a group that stops to stare) and let go on. */
interface Hold { paused: boolean; stop: boolean }

/** Which group an animal walks with now (a kind may cross twice in a play: the later group
 *  takes its animals over, and the earlier one, still walking off, lets them be). A play's
 *  own: every play begins with nobody taken (the last play's finale owned the home's deer). */
let OWNER = new WeakMap<Actor, Group>();

/** One group crossing: its animals (the lead first), its way down, over and out. */
class Group {
  readonly kind: Kind | 'das';
  readonly members: Actor[];
  readonly lead: Actor;
  readonly young: Actor;
  /** the corner it comes round (a play's guard may send it round the other: `enter`) */
  from: Side;
  readonly out: Side;
  /** walking off: hide each one once it is out of his picture */
  private leaving = false;
  private readonly k: AdventureKit;
  constructor(k: AdventureKit, c: Crossing | { kind: 'das'; from: Side; out: Side; n: number }, A: Readonly<Record<string, Actor>>) {
    this.k = k;
    this.kind = c.kind;
    this.from = c.from;
    this.out = c.out;
    const keys = c.kind === 'das' ? [DAS] : GROUPS[c.kind].members.slice(0, c.n);
    this.members = keys.map((key) => A[key]);
    this.lead = this.members[0];
    this.young = c.kind === 'das' ? this.lead : A[GROUPS[c.kind].young];
  }

  get gap(): number { return GAP[this.kind]; }
  get pace(): number { return PACE[this.kind]; }

  /**
   * In file at its wait (its trail's start, outside every picture he watches from: the
   * places test pins it through the kit's own lenses), facing down the trail. Nothing pops:
   * an animal of it still in his picture (walking off with an earlier group, the home's deer
   * leaving) is never moved — it walks out of the picture first; and when the lens he has
   * NOW sees the wait (a child who stepped aside somewhere of his own), the file waits
   * further back along its way, or round the other corner if that one is out of sight.
   */
  async enter(): Promise<void> {
    const k = this.k, cam = k.world.camera;
    const shown = (): Actor[] => this.members.filter((m) => m.group.visible && inPicture(cam, m, 0.04));
    if (shown().length) {
      // (one standing about in his picture walks calmly off out of it first)
      for (const m of shown()) if (m.doing !== 'go' && m.doing !== 'follow') { OWNER.delete(m); void walkOff(m, leaveWay(m)); }
      k.stats.enter_waited = (k.stats.enter_waited ?? 0) + 1;
      if (!(await k.until(() => !shown().length, 14))) k.stats.enter_seen = (k.stats.enter_seen ?? 0) + 1;
    }
    const fileAt = (side: Side, back: number): Spot[] => this.members.map((_, i) => fileBack(side, back + this.gap * i));
    const seen = (spots: Spot[]): boolean => spots.some((p, i) => inView(cam, p, this.members[i].height, lenOf(this.members[i])));
    let side = this.from, back = 0;
    if (seen(fileAt(side, 0))) {
      const other: Side = side === 'N' ? 'S' : 'N';
      let found = false;
      for (back = 1; back <= BACK_MAX && !found; back += 1) found = !seen(fileAt(side, back));
      back -= 1;
      if (!found && !seen(fileAt(other, 0))) { side = other; back = 0; found = true; k.stats.enter_swapped = (k.stats.enter_swapped ?? 0) + 1; }
      if (!found) k.stats.enter_seen = (k.stats.enter_seen ?? 0) + 1;
      else k.stats.enter_back = Math.max(k.stats.enter_back ?? 0, back);
    }
    this.from = side;
    const face = headingTo(waitOf(side), TRAILS[side][1]);
    fileAt(side, back).forEach((p, i) => {
      const m = this.members[i];
      OWNER.set(m, this);
      if (m.lies) void m.lie(false);
      m.place(p.x, p.z, face);
      m.idle();
      m.group.visible = true;
    });
    this.leaving = false;
  }

  /** The others walk after the lead, each behind the one before. */
  file(): void {
    this.members.slice(1).forEach((m, i) => {
      const ahead = this.members[i];
      m.follow(() => ({ x: ahead.x, z: ahead.z, speed: ahead.speed }), this.gap);
    });
  }

  /** The lead walks `pts` in turn (the others in file after it); a hold stops it where it is
   *  until let go. Resolves true once there (false: held for good, or gone from his picture). */
  async walk(pts: readonly Spot[], hold: Hold = { paused: false, stop: false }, speed = this.pace): Promise<boolean> {
    this.file();
    for (const p of pts) {
      for (;;) {
        // (a group gone from his picture walks no further: a hidden animal stands still)
        if (hold.stop || this.gone) return false;
        if (hold.paused) { await this.k.until(() => !hold.paused || hold.stop); if (!hold.stop) this.file(); continue; }
        const ok = await this.k.guard(this.lead.go(p.x, p.z, { speed }));
        if (ok) break;
        if (hold.paused || hold.stop || this.gone) continue;
        break; // (blocked: on to the next point)
      }
    }
    return !hold.stop && !this.gone;
  }

  /** `rest` (the group but its young one) walk `pts`, the first of them leading, the others
   *  in file after it. */
  async walkRest(rest: readonly Actor[], pts: readonly Spot[]): Promise<void> {
    rest.slice(1).forEach((m, i) => { const ahead = rest[i]; m.follow(() => ({ x: ahead.x, z: ahead.z, speed: ahead.speed }), this.gap); });
    for (const p of pts) if (!(await this.k.guard(rest[0].go(p.x, p.z, { speed: this.pace })))) return;
  }

  /** All stop and look at `at` (heads up), for `secs`. */
  stare(at: Spot, secs: number): void {
    for (const m of this.members) void m.lookAt(() => ({ x: at.x, z: at.z, speed: 0 }), secs);
  }

  /** Off the bed and out its way; it is gone (hidden, all at once — never one left standing
   *  behind the others) only once the whole group is out of his picture (`tick`): at the
   *  way's end and still in view it walks on along it a little further, and stands there if
   *  it must (never a vanishing in front of him). */
  async leave(way: readonly Spot[] = EXITS[this.out]): Promise<boolean> {
    this.leaving = true;
    await this.walk(way);
    const e = way.length >= 2 ? way : EXITS[this.out];
    let a = e[e.length - 2], b = e[e.length - 1];
    for (let i = 0; i < 3 && !this.gone; i++) {
      const L = dist(a, b) || 1;
      const on = { x: b.x + ((b.x - a.x) / L) * 6, z: b.z + ((b.z - a.z) / L) * 6 };
      if (Math.hypot(on.x, on.z) > 72 || !(await this.walk([on]))) break;
      a = b; b = on;
    }
    if (!this.gone) for (const m of this.members) if (OWNER.get(m) === this) m.root(m.x, m.z, 0.4);
    return true;
  }

  /** After a route's show (the lead already stepped off behind the sand): the others step
   *  round the bed's near back corner from where they waited (never over it), then all leave
   *  along its back and side — nothing stands in front of a patch while he points them back,
   *  and nobody stands waiting there (a step that cannot be made is let go of). */
  async leaveBehind(): Promise<boolean> {
    this.leaving = true;
    const k = this.k;
    const steps = this.members.slice(1).map((m, i) => { const b = backCorner(m, i); return m.go(b.x, b.z, { speed: this.pace }); });
    if (steps.length) await k.guard(Promise.race([Promise.all(steps), k.wait(4)]));
    return this.leave(backWay(this.out));
  }

  /** Per frame while leaving: once every one of them is wholly out of his picture (behind
   *  the lens or past its edge), the group is gone. */
  tick(cam: THREE.Camera): void {
    if (!this.leaving || this.gone) return;
    const out = this.members.every((m) => !m.group.visible || OWNER.get(m) !== this
      || (!inPicture(cam, m, 0.03) && Math.hypot(m.x - BED.x, m.z - BED.z) > 6));
    if (out) this.away();
  }

  /** Every one hidden (out of his picture already), or walking with a later group: gone. */
  get gone(): boolean { return this.members.every((m) => !m.group.visible || OWNER.get(m) !== this); }

  /** Hide them all at once (a stop: the home lays its own). */
  away(): void { for (const m of this.members) if (OWNER.get(m) === this) { m.idle(); m.group.visible = false; } this.leaving = false; }
}

/** Would an animal (`h` m tall, `len` m long) standing at `p` show in the lens's picture
 *  (any of its body: its feet, its back, either end, with a margin `m` in the picture's
 *  half-widths)? Nothing in the world counts as cover: the ecoduct is an open arch. */
function inView(cam: THREE.Camera, p: Spot, h: number, len: number, m = 0.06): boolean {
  const y = groundAt(p);
  const r = len / 2;
  for (const [dx, dz, dy] of [[0, 0, 0.1], [0, 0, h], [r, 0, h * 0.6], [-r, 0, h * 0.6], [0, r, h * 0.6], [0, -r, h * 0.6]] as const) {
    V.set(p.x + dx, y + dy, p.z + dz);
    if (V.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.2) continue; // (behind the lens)
    V.project(cam);
    if (Math.abs(V.x) < 1 + m && Math.abs(V.y) < 1 + m) return true;
  }
  return false;
}
const V = new THREE.Vector3();
/** The rendered ground under a spot (the script's, set when a play begins). */
let groundAt: (p: Spot) => number = () => 0;

/** Is the animal in his picture now (any of it, `m` beyond the frame's edge counts)? */
function inPicture(cam: THREE.Camera, a: Actor, m = 0): boolean {
  return inView(cam, a, a.height, lenOf(a), m);
}
/** An animal's length (m) as drawn (the scale table's, at its height). */
function lenOf(a: Actor): number {
  const sz = (SIZE as Record<string, { h: number; len?: number }>)[a.animal];
  return (sz?.len ?? a.height) * (a.height / (sz?.h ?? a.height));
}

/* ------------------------------------------------------------- the story ---- */

async function story(k: AdventureKit, laid: EcoductLaid): Promise<void> {
  const c = k.copy;
  groundAt = (p) => k.ctx.groundY(p.x, p.z);
  OWNER = new WeakMap();
  const fam = k.borrow();
  const home = fam.dressing as EcoductHome;
  const A = fam.actors;
  for (const key of Object.keys(A)) fam.voice(key, false);
  const crossings = laid.crossings;
  const groups: Group[] = [];
  const groupOf = (i: number): Group => (groups[i] ??= new Group(k, crossings[i], A));
  const live = new Set<Group>();
  k.onTick(() => { for (const g of live) g.tick(k.world.camera); });
  k.stats.crossings = crossings.length;
  k.stats.variant_groups = crossings.map((x) => 'hzrv'.indexOf(x.kind.charAt(0))).reduce((a, b) => a * 4 + b, 0);
  watchFinds(k, A);

  // the three moments in this play's order (the same DagnachtRun the 2D floor plays)
  const rust = choiceRun(k, 1);
  const order = rust.trial.encounters.map((e) => e.id);
  k.stats.order = order.map((id) => ['stil', 'roep', 'opzij'].indexOf(id) + 1).reduce((a, b) => a * 10 + b, 0);

  /* 0 · the hind and her calf (grazing by the bridge before his first crossing, on the heath
     by the screen after one) walk calmly off, away from where he will watch: the play brings
     whoever comes. Each is hidden only once it is out of his picture — never a vanishing in
     it, never one left standing in it */
  const homeDeer = ['hinde', 'kalf'].map((key) => A[key]).filter((a) => a.group.visible);
  const way = leaveWay({ x: homeDeer[0]?.x ?? 0, z: homeDeer[0]?.z ?? 0 });
  homeDeer.forEach((a, i) => { void walkOff(a, way.map((p) => ({ x: p.x + i * 1.4, z: p.z - i * 0.6 }))).catch(() => {}); });
  const offDeer = k.onTick(() => {
    for (const a of homeDeer) {
      if (!a.group.visible || OWNER.get(a)) continue;
      if (!inPicture(k.world.camera, a, 0.03)) { a.idle(); a.group.visible = false; }
    }
    if (homeDeer.every((a) => !a.group.visible || OWNER.get(a))) offDeer();
  });

  /* 1 · one calm look at the green bridge for animals; he ends facing it (the look glides
     toward a point on the line to its deck, so the lens stops ~17 m short of it: the whole
     bridge in the picture, never its arch filling it) */
  // (a replay begins where the last play ended, often with his back to the bridge: then one
  // soft dip turns him and the lens toward it first — never a swing round him)
  {
    const r = k.ranger(), cam = k.world.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const want = headingTo(r, DECK_LOOK), now = Math.atan2(fwd.x, fwd.z);
    if (Math.abs(Math.atan2(Math.sin(want - now), Math.cos(want - now))) > Math.PI / 2) {
      const ahead = { x: r.x + Math.sin(want) * 6, z: r.z + Math.cos(want) * 6 };
      await k.frame({ at: ahead, heading: want, halfW: 3, halfD: 3, tall: 2, pitchDeg: 14, include: [{ x: r.x, z: r.z, h: 1.32, r: 0.3 }] }, { face: want, dip: true });
    }
  }
  const cam0 = k.world.camera.position;
  const toDeck = Math.hypot(DECK_LOOK.x - cam0.x, DECK_LOOK.z - cam0.z);
  const f = Math.min(1, LOOK_AIM_M / Math.max(1, toDeck));
  const aim = { x: cam0.x + (DECK_LOOK.x - cam0.x) * f, z: cam0.z + (DECK_LOOK.z - cam0.z) * f, y: cam0.y + (DECK_LOOK.y - cam0.y) * f - 0.45 };
  await k.look(aim, c.kijk, 2.2, { turn: true, seconds: 2.2 });

  /* 2 · a quiet walk to the screen */
  await k.walk({ name: 'scherm', to: STAND, r: 0.6, line: c.naarScherm, doel: c.chipScherm, glyph: 'boot', quiet: { line: c.sst } });

  /* 3 · behind the screen: the held view over the bed, the bridge's mouth and its corners */
  await k.walkRanger(STAND.x, STAND.z, 0.04);
  k.beat = 'wacht';
  await k.frame(BED_VIEW, { face: STAND.heading });
  k.say(c.wacht);
  const g1 = groupOf(0);
  live.add(g1);
  await g1.enter();
  // the first calm moment, as the first group comes (never the flip)
  const first = rust.next()!;
  if (first.id === 'roep') await roepAt(k, rust, first, g1, 'scherm');
  else await stilAt(k, rust, first, g1);
  // (its lead waits at the bed's edge when the route's show begins)
  if (dist(g1.lead, mouthOf(g1.from)) > 1.2) await g1.walk([mouthOf(g1.from)]);

  /* 4 · the route over the sand (corsi): the lead treads it patch by patch; one group a round */
  let round = 0;
  let shownBy: Group = g1;
  /** patches the lead has trodden in this round's show (the last one: it steps off the bed) */
  let trodden = 0;
  /** the show's time per patch, measured (s) */
  let visitT = 0, visits = 0;
  await routeBeat(k, 0, {
    view: BED_VIEW, stand: STAND, field: home.field,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[0].skin.copy?.goed ?? c.routeWijs, nogEen: c.nogEenWeg },
    // the show: the group's lead walks onto each patch in turn and puts its nose to the sand
    // (the patch glows warm, its fresh tracks show, as long as it stands there); the others
    // wait at the mouth, heads up, until it is over
    visit: async (s, light) => {
      const g = shownBy;
      const t0 = k.now;
      for (const m of g.members.slice(1)) { m.idle(); void m.lookAt(() => ({ x: g.lead.x, z: g.lead.z, speed: 0 }), 99); }
      const hop = Math.max(VISIT.min, Math.min(VISIT.max, dist(g.lead, s) / VISIT.hop));
      // (the trot onto the patch: it glows as the lead steps onto it, and its nose goes down
      // there without the slow last stride of a walk that ends)
      void g.lead.go(s.x, s.z, { speed: hop });
      await k.until(() => dist(g.lead, s) < VISIT.on || g.lead.doing !== 'go', 4);
      light(true);
      const fwd = { x: Math.sin(g.lead.yaw), z: Math.cos(g.lead.yaw) };
      await g.lead.sniff(s.x + fwd.x * 0.5, s.z + fwd.z * 0.5, VISIT.dwell, 0.6);
      light(false);
      visitT += k.now - t0; visits += 1;
      k.stats.visit_s = Math.round((visitT / visits) * 100) / 100;
      k.stats.visit_max = Math.max(k.stats.visit_max ?? 0, Math.round((k.now - t0) * 100) / 100);
      // the route's last patch: the lead steps straight back off the sand, behind the
      // patches, so nothing stands in front of one while he points them back
      if (++trodden >= (k.stats.route_length ?? 99)) {
        trodden = 0;
        const off = backOff(s);
        await g.lead.go(off.x, off.z, { speed: VISIT.min });
      }
    },
    // the show over: the others come after the lead, along the bed's back and side (never
    // over it), and the group walks on into the heath
    shown: (firstShow) => {
      if (!firstShow) return;
      void shownBy.leaveBehind().catch(() => {});
    },
    // a patch he points at: a soft step (the tracks there are his to read; nothing walks)
    picked: async () => { await k.wait(0.25); },
    // the next round: the next group comes round its corner to the bed's mouth
    between: async () => {
      round += 1;
      trodden = 0;
      const g = groupOf(round);
      live.add(g);
      await g.enter();
      k.say(c.nogMeer);
      await g.walk(TRAILS[g.from].slice(1));
      g.stare(STAND, 0.7);
      await k.wait(0.7);
      shownBy = g;
    },
  });
  // the route's groups leave their tracks in the sand once it is pointed back (never before:
  // the tracks would show the way)
  for (let i = 0; i <= round; i++) home.tread(crossingLine(groups[i].from, groups[i].out), groups[i].kind, groups[i].members.length, 11 + i);

  /* 5 · the raaf: thousands of animals cross here */
  await k.fact(0);

  /* 5b · now and then (k.rare: a seeded chance, the pity rule) a badger trundles over */
  if (k.rare()?.id === DAS_ID) await badger(k, A, home, live, laid);

  /* 6-7 · the other two moments, in this play's order, one group each; the flip on the bed */
  let where: Where = 'scherm';
  let next = round + 1;
  let finale: Group | null = null;
  for (let e = rust.next(); e; e = rust.next()) {
    const g = groupOf(Math.min(next++, crossings.length - 1));
    live.add(g);
    const isLast = rust.trial.encounters[rust.trial.encounters.length - 1].id === e.id;
    if (e.id === 'opzij') {
      if (where === 'scherm') await toBed(k);
      await opzijAt(k, rust, e, g);
      where = 'opzij';
    } else if (e.id === 'stil') {
      if (where !== 'scherm') { await backToScreen(k); where = 'scherm'; }
      await g.enter();
      await stilAt(k, rust, e, g);
    } else {
      await g.enter();
      await roepAt(k, rust, e, g, where);
    }
    if (isLast) { finale = g; break; }
    // (this group crosses the bed and goes on its way while the next comes)
    await crossOver(home, g, true);
  }
  rust.done();
  // (the last moment may have held a close picture of him and a young one: the reunion is
  // seen over the sand they cross, from behind him)
  if (where !== 'scherm') { const r = k.ranger(); await k.frame(asideView(r), { face: headingTo(r, { x: BED.x, z: BED.z }), dip: true }); }

  /* 8 · the reunion: the hind and her calf cross into the heath by the screen, where they
     graze from now on: "De dieren staken veilig over." */
  const homeWalk: Hold = { paused: false, stop: false };
  // they come on over the sand now; the line comes WITH them, once the hind steps onto the
  // sand in his picture (never over an empty bed while they are still round the corner),
  // and it stays while they walk over it and onto the heath to their spot: a calm ending he
  // sees whole, and nothing left for the home to walk after it
  const crossing = finale ? Promise.race([crossHome(home, finale, homeWalk), k.wait(16)]).catch(() => {}) : Promise.resolve();
  if (finale) {
    const t0 = k.now, f = finale;
    await k.until(() => onBed(f.lead, 0.3) && inPicture(k.world.camera, f.lead, -0.12), 10);
    k.stats.reunion_wait = Math.round((k.now - t0) * 10) / 10;
  }
  await k.reunion(async () => {
    // (while they walk home the line holds on for every new find's card still waiting, two
    // at most — the cards show as they go, never after them)
    await Promise.all([k.guard(crossing).then(() => k.wait(0.8)), k.until(() => k.revealsWaiting() === 0, CARDS_MAX_S)]);
  }, { holdS: Math.max(2, Math.min(2, k.revealsWaiting()) * CARD_S) });
  /* 9 · the raaf: badgers and foxes use it too */
  await k.fact(1);
  // (the home takes them over now: they walk the rest of the way to their spot by themselves)
  homeWalk.stop = true;
}

/** Where he is for a moment: behind the screen, on the bed, or aside in front of the screen. */
type Where = 'scherm' | 'opzij';

/** Over the bed from its mouth to the far side, tracks in the sand behind it, and out:
 *  resolves once it is over the bed (`ahead`: the rest of the way out goes on meanwhile),
 *  or once it is gone. */
async function crossOver(home: EcoductHome, g: Group, ahead: boolean): Promise<void> {
  const mouth = mouthOf(g.from);
  if (dist(g.lead, mouth) > 1.2) await g.walk([mouth]);
  await g.walk([{ x: BED.x, z: BED.z }]);
  home.tread(crossingLine(g.from, g.out), g.kind, g.members.length, 31 + g.members.length);
  const out = g.leave().catch(() => false);
  if (!ahead) await out;
}

/** The last group over (the hind and her calf): over the bed and out onto the heath by the
 *  screen, to where they graze from now on (the home's after state: nothing pops there). */
async function crossHome(home: EcoductHome, g: Group, hold: Hold): Promise<void> {
  const mouth = mouthOf(g.from);
  if (dist(g.lead, mouth) > 1.2) await g.walk([mouth], hold, HOME_PACE);
  await g.walk([{ x: BED.x, z: BED.z }], hold, HOME_PACE);
  home.tread(crossingLine(g.from, 'N'), g.kind, g.members.length, 41);
  await g.walk([AFTER_HINDE], hold, HOME_PACE);
  if (hold.stop) return;
  const kalf = g.young;
  await k0(kalf.go(AFTER_KALF.x, AFTER_KALF.z, { speed: 'walk', face: AFTER_KALF.yaw }));
  if (hold.stop) return;
  g.lead.root(AFTER_HINDE.x, AFTER_HINDE.z, 0.6);
  kalf.root(AFTER_KALF.x, AFTER_KALF.z, 0.5);
}
/** (a promise whose result is not needed) */
const k0 = (p: Promise<unknown>): Promise<void> => p.then(() => {}, () => {});

/** One of the home's deer walks calmly off along `way` (and on along its last stretch while
 *  it is still in his picture: the play hides it once it is out of it). */
async function walkOff(a: Actor, way: readonly Spot[]): Promise<void> {
  for (const p of way) { if (!a.group.visible || OWNER.get(a)) return; await a.go(p.x, p.z, { speed: 'walk' }); }
  let [p, q] = [way[way.length - 2], way[way.length - 1]];
  for (let i = 0; i < 3 && a.group.visible && !OWNER.get(a); i++) {
    const L = dist(p, q) || 1;
    const on = { x: q.x + ((q.x - p.x) / L) * 6, z: q.z + ((q.z - p.z) / L) * 6 };
    if (Math.hypot(on.x, on.z) > 71) break;
    await a.go(on.x, on.z, { speed: 'walk' });
    [p, q] = [q, on];
  }
}

/* --------------------------------------------------------- the moments ---- */

/**
 * FEET still as a group comes (`stil`): behind the screen, the held view. The group comes
 * round the bridge's corner and down to the bed; the line says keep still. A step (an arrow
 * key, a tap on the world) and they stop and stare at the screen, heads up, a soft alarm —
 * the words, and the same moment again; kept still while it holds (the level's hold), they
 * come on down to the bed's mouth. Its temptations: they pause at the corner, half in view;
 * one calls softly; the young one skips a few steps ahead.
 */
async function stilAt(k: AdventureKit, rust: ChoiceRun, e: Encounter, g: Group): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const trail = TRAILS[g.from];
  // round the corner and a few steps down toward the bed (big enough to see what comes):
  // then the line, and they come on down to the bed's edge while he keeps still
  k.beat = 'stil:komt';
  const hold: Hold = { paused: false, stop: false };
  await g.walk([trail[1], trail[2]]);
  const down = g.walk(trail.slice(3), hold, g.pace * 0.6).catch(() => false);
  let pull = 0;
  const kinds = ['pauze', 'roep', 'jong'] as const;
  await rust.still(e.id, {
    line: c.komt, feet: true,
    tempt: () => {
      const kind = kinds[pull++ % kinds.length];
      k.stats[`tempt_${kind}`] = (k.stats[`tempt_${kind}`] ?? 0) + 1;
      if (kind === 'pauze') { hold.paused = true; g.lead.idle(); g.stare(STAND, 1.2); void k.wait(1.3).then(() => { hold.paused = false; }).catch(() => {}); }
      else if (kind === 'roep') { if (settings.geluid && !speaking()) Sound.callAt(CALL[g.kind].soft, g.lead.x, g.lead.z, listenerOf(k.world.camera), 22); }
      else if (g.young !== g.lead) { const y = g.young; void y.go(y.x + (STAND.x - y.x) * 0.15, y.z + (STAND.z - y.z) * 0.15, { speed: 'trot' }).then(() => g.file()); }
    },
    // a step: they stop and stare at the screen, a soft alarm; then they wait a moment
    wrong: async () => {
      hold.paused = true;
      g.lead.idle();
      g.stare(STAND, 2.2);
      if (settings.geluid) Sound.callAt(CALL[g.kind].alarm, g.lead.x, g.lead.z, listenerOf(k.world.camera), 22);
      await k.wait(1.9);
      hold.paused = false;
    },
    // held: they come on down to the bed
    right: async () => { hold.paused = false; await down; },
  });
  hold.paused = false;
  await down;
  k.stats.stil = (k.stats.stil ?? 0) + 1;
}

/** The young one's name in his words (plain or knap): 'Het kalfje', 'Het biggetje', 'De vos'. */
function youngName(c: Readonly<Record<string, string>>, kind: Kind | 'das'): string {
  return kind === 'zwijn' ? c.biggetje : kind === 'vos' ? c.vos : c.kalfje;
}

/**
 * HANDS still when a young one looks at him (`roep`): the group comes to the bed's mouth and
 * its young one (the fox itself) walks up to him — beside the screen, or on the open sand by
 * him — stops at arm's length plus a step, and looks at him. A click on it is calling it: it
 * startles, trots off a few metres, stops, looks back, and comes back (the same moment). Kept
 * still while it holds: it trots back to its group. Its temptations: a step nearer, a sniff
 * toward him, a look away and back.
 */
async function roepAt(k: AdventureKit, rust: ChoiceRun, e: Encounter, g: Group, where: Where): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  k.beat = 'roep:komt';
  // the group comes round the corner into his picture; there its young one breaks away and
  // trots up to him (a quick trot, then a careful last step), while the others walk on down
  // to the bridge's foot and stand there watching it
  const trail = TRAILS[g.from];
  await g.walk([trail[1]]);
  const y = g.young;
  const me0 = k.ranger();
  const spot = roepSpot(where === 'scherm' ? STAND : me0, g.from, where === 'scherm' ? 'scherm' : 'bed');
  const rest = g.members.filter((m) => m !== y);
  if (rest.length) {
    void g.walkRest(rest, [trail[2]]).then(() => { for (const m of rest) { m.idle(); void m.lookAt(() => ({ x: y.x, z: y.z, speed: 0 }), 99); } }).catch(() => {});
  }
  if (where !== 'scherm') {
    // (on the open sand: one held picture of him and it, side on)
    await k.frame(roepView(me0, spot), { face: headingTo(me0, spot), dip: true });
  }
  const near0 = toward(spot, y, 0.8);
  await y.go(near0.x, near0.z, { speed: YOUNG_TROT });
  const atHim = (): { x: number; z: number; speed: number } => { const r = k.ranger(); return { x: r.x, z: r.z, speed: 0 }; };
  // (its last careful step is part of the moment: the words come as it takes it)
  void y.go(spot.x, spot.z, { speed: 0.6 }).then((ok) => { if (ok) void y.lookAt(atHim, 99); });
  let pull = 0;
  const near = (d: number): Spot => toward(y, k.ranger(), Math.max(0, Math.min(d, dist(y, k.ranger()) - 1.25)));
  await rust.still(e.id, {
    line: `${youngName(c, g.kind)} ${c.kijktJe}`,
    hands: () => y.body,
    tempt: () => {
      const kind = (['stap', 'snuif', 'opzij'] as const)[pull++ % 3];
      k.stats[`tempt_${kind}`] = (k.stats[`tempt_${kind}`] ?? 0) + 1;
      if (kind === 'stap') { const p = near(0.35); void y.go(p.x, p.z, { speed: 0.4 }).then(() => y.lookAt(atHim, 99)); }
      else if (kind === 'snuif') { const r = k.ranger(); void y.sniff(r.x, r.z, 1.1, Math.max(1.3, dist(y, r) - 0.1)).then(() => y.lookAt(atHim, 99)); }
      else { void y.lookAt(() => ({ x: g.lead.x, z: g.lead.z, speed: 0 }), 0.9).then(() => y.lookAt(atHim, 99)); if (settings.geluid && !speaking()) Sound.callAt(CALL[g.kind].soft, y.x, y.z, listenerOf(k.world.camera), 18); }
    },
    // called: it startles and trots off a few metres, stops and looks back (the words come
    // then); it comes back calmly while they are said
    wrong: async () => {
      if (settings.geluid) Sound.callAt(CALL[g.kind].alarm, y.x, y.z, listenerOf(k.world.camera), 20);
      const off = toward(y, mouthOf(g.from), 3.2);
      await k.guard(Promise.race([y.go(off.x, off.z, { speed: 'trot' }), k.wait(2.2)]));
      void y.lookAt(atHim, 99);
      void k.wait(1.6).then(() => y.go(spot.x, spot.z, { speed: 0.6 })).then(() => y.lookAt(atHim, 99)).catch(() => {});
    },
    // left alone: it trots back to its group
    right: async () => {
      const m = mouthOf(g.from);
      await y.go(m.x + (y.x - m.x) * 0.15, m.z + (y.z - m.z) * 0.15, { speed: 'trot' });
      g.file();
    },
  });
  k.stats.roep = (k.stats.roep ?? 0) + 1;
}

/** A held picture of him and the young one looking at him on the open sand: side on, the
 *  two of them in it. */
function roepView(r: Spot, y: Spot): { at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number; include: { x: number; z: number; h: number; r?: number }[] } {
  const mid = { x: (r.x + y.x) / 2, z: (r.z + y.z) / 2 };
  // (from the heath's side, the bed and the bridge beyond them)
  const h = headingTo(r, y) + (headingTo(r, y) > 0 ? -Math.PI / 2 : Math.PI / 2);
  return { at: mid, heading: h, halfW: 1.7, halfD: 1.1, tall: 1.3, pitchDeg: 22, insetTop: 120, insetBottom: 20, include: [{ x: r.x, z: r.z, h: 1.32, r: 0.3 }] };
}

/**
 * He goes to look at the tracks in the sand up close (where every group crossed): a walk
 * onto the bed, and there he sees them at his feet ("Kijk. Allemaal sporen in het zand.").
 * Now he stands right in their way.
 */
async function toBed(k: AdventureKit): Promise<void> {
  const c = k.copy;
  await k.walk({ name: 'zand', to: BED_STAND, r: BED_STAND.r, line: c.sporen, doel: c.chipZand, glyph: 'footprints' });
  k.lockFollow();
  k.world.stopRanger();
  // (a calm look: the tracks' card, and any other new find's still waiting, shows here)
  k.beat = 'look:sporen';
  // (he stands among the tracks facing the bridge, the lens behind him: however he walked
  // round the screen, the next group's wait lies out of this picture — pinned)
  k.world.faceRanger(BED.heading);
  k.say(c.zoveel);
  k.discover('ecoduct.sporen', { first: true });
  k.stats.sporen = 1;
  const t0 = k.now;
  await k.behind();
  await k.wait(Math.max(0.4, 2.4 - (k.now - t0)));
  // (one waiting card at most: the rest show on his next walk or at the reunion)
  await k.until(() => k.revealsWaiting() === 0, CARD_S);
}

/** Back behind the screen (a group will come, and there he keeps still). */
async function backToScreen(k: AdventureKit): Promise<void> {
  const c = k.copy;
  await k.walk({ name: 'terug', to: STAND, r: 0.6, line: c.terug, doel: c.chipScherm, glyph: 'boot', quiet: { line: c.sst } });
  await k.walkRanger(STAND.x, STAND.z, 0.04);
  await k.frame(BED_VIEW, { face: STAND.heading, dip: true });
}

/**
 * The flip (`opzij`): he stands on the bed, in their way. A group comes round the corner and
 * stops at the bed's mouth, heads up, looking at him: they want over. "Ze willen over. Ga maar
 * opzij." He walks off their way (GoCore: 4 m from where he stood, off the line they take);
 * then he watches from beside the screen as they come on over the bed past him. Standing too
 * long is the old rule ("Blijf staan"): they turn and walk back up behind the corner, then come
 * out to the mouth again (the same moment).
 */
async function opzijAt(k: AdventureKit, rust: ChoiceRun, e: Encounter, g: Group): Promise<void> {
  const c = k.copy;
  k.beat = 'opzij:komt';
  await g.enter();
  const trail = TRAILS[g.from];
  const halt = haltOf(g.from);
  // he turns to where they will come from (the lens behind him); they come round the corner
  // and down toward the bed, and stop a few steps above it, looking at him: he is in their
  // way (they are already walking in as the lens turns with him)
  const coming = g.walk([...trail.slice(1, 3), halt]);
  // (he faces a little past them: beside his head in the lens behind him, never behind it)
  k.world.faceRanger(flipFacing(k.ranger(), g.from));
  await k.behind();
  await coming;
  g.stare(k.ranger(), 99);
  // their way: down to the mouth, over the bed (through where he stands) and out
  const way = [halt, mouthOf(g.from), { x: BED.x, z: BED.z }, ...EXITS[g.out]];
  const aside = ASIDE[g.out];
  let why: 'stay' | 'closer' = 'stay';
  /** their walk back and down again after he waited too long (a newer one stops the last) */
  let back: Hold = { paused: false, stop: false };
  await rust.go(e.id, {
    line: c.opzij,
    // (the animals at the bridge's foot; going is stepping OFF their way, not along it)
    family: () => ({ x: g.lead.x, z: g.lead.z }), off: way,
    to: aside, doel: c.chipOpzij, glyph: 'footprints', hush: c.sst,
    // (walking up to them is no answer, nor is standing: the words fit what he did)
    get mis(): string | undefined { return why === 'closer' ? c.nietNaar : undefined; },
    wrong: async (w) => {
      why = w;
      // they give up and turn back up toward the bridge's end (the words come as they go);
      // a moment later they come down to its foot again (the same moment)
      back.stop = true;
      const turn: Hold = { paused: false, stop: false };
      back = turn;
      g.lead.idle();
      await k.guard(Promise.race([g.walk([trail[1]], turn), k.wait(2.4)]));
      void k.wait(2.6).then(async () => {
        if (turn.stop) return;
        await g.walk([trail[2], halt], turn);
        if (!turn.stop) g.stare(k.ranger(), 99);
      }).catch(() => {});
    },
    // he watches them come: from behind him, over the bed (one soft dip: he faces the other way)
    right: async () => {
      back.stop = true;
      const r = k.ranger();
      k.world.faceRanger(headingTo(r, { x: BED.x, z: BED.z }));
      await k.frame(asideView(r), { face: headingTo(r, { x: BED.x, z: BED.z }), dip: true });
    },
  });
  k.stats.opzij = (k.stats.opzij ?? 0) + 1;
}

/* ------------------------------------------------------------ the rare ---- */

/** The badger: round a corner, trundling over the bed (its nose to the sand), and out into
 *  the heath on the other side; he is told once it is in his picture. */
async function badger(k: AdventureKit, A: Readonly<Record<string, Actor>>, home: EcoductHome, live: Set<Group>, laid: EcoductLaid): Promise<void> {
  const c = k.copy;
  const from: Side = laid.crossings[0].from === 'N' ? 'S' : 'N';
  const g = new Group(k, { kind: 'das', from, out: from === 'N' ? 'S' : 'N', n: 1 }, A);
  live.add(g);
  k.beat = 'das';
  await g.enter();
  k.stats.das = 1;
  // (its words once it is near enough to see what it is: down at the bridge's foot)
  await g.walk(TRAILS[g.from].slice(1, 3));
  k.say(c.das, { good: true });
  await g.walk(TRAILS[g.from].slice(3));
  const a = g.lead;
  const p = atLocal(BED, g.from === 'N' ? -0.6 : 0.6, 0.3);
  await a.go(p.x, p.z, { speed: g.pace });
  await a.sniff(p.x + 0.4, p.z, 0.9, 0.5);
  home.tread(crossingLine(g.from, g.out), 'das', 1, 77);
  void g.leave().catch(() => {});
  await k.wait(1.6);
}

/* ---------------------------------------------------------- what he saw ---- */

/** An animal's box as he sees it (its own size from the scale table, round where it stands:
 *  a rigged model's bones say nothing about its drawn size). */
function boxFor(a: Actor): THREE.Box3 {
  const len = lenOf(a);
  const y = a.group.position.y;
  return new THREE.Box3(new THREE.Vector3(a.x - len / 2, y, a.z - len / 2), new THREE.Vector3(a.x + len / 2, y + a.height, a.z + len / 2));
}

/** Each kind that crosses goes in his veldgids once he really saw it (in his picture, big
 *  enough, steady, for a moment); the badger the same. */
function watchFinds(k: AdventureKit, A: Readonly<Record<string, Actor>>): void {
  const seen = new Seen(
    () => ({ cam: k.world.camera, w: k.ctx.canvas.clientWidth || 1280, h: k.ctx.canvas.clientHeight || 800, me: k.ranger() }),
    (id) => { k.discover(id); k.stats[`seen_${id.slice(id.indexOf('.') + 1)}`] = Math.round(k.now); },
  );
  const box = (keys: readonly string[]) => (): THREE.Box3 | null => {
    const shown = keys.map((key) => A[key]).find((a) => a.group.visible);
    return shown ? boxFor(shown) : null;
  };
  for (const kind of ['hert', 'zwijn', 'ree', 'vos'] as Kind[]) {
    // (the deer that grazed before the play walk off in the opening look: seen crossing)
    seen.watch({ id: GROUPS[kind].disc, box: box(GROUPS[kind].members), px: SEEN_PX, secs: 1, within: 26, when: () => !/^(look$|walk:scherm)/.test(k.beat) });
  }
  seen.watch({ id: DAS_ID, box: box([DAS]), px: SEEN_PX, secs: 1, within: 26 });
  k.onTick((dt) => {
    seen.tick(dt);
    for (const [key, v] of Object.entries(seen.most)) k.stats[`px_${key.slice(key.indexOf('.') + 1)}`] = v;
  });
}
