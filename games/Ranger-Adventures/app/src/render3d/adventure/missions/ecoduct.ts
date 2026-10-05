/**
 * ecoduct.ts — "De oversteek" as an adventure at the real ecoduct (run 7, design
 * `state/adventures/design.md` §4).
 *
 * One calm look at the green bridge for animals; a quiet walk to the wildlife screen in front
 * of its mouth; then he watches who comes over. Groups come down off the bridge behind its
 * ends and round its corner to the raked sand bed: red deer, a sow with her piglets, a roe
 * with her calf, a fox alone — another mix, other corners and other ways out every play. As
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
import { EcoductHome } from './ecoduct.home';
import {
  ASIDE, BED, BED_STAND, BED_VIEW, DAS, DAS_ID, DECK_LOOK, ECODUCT_HOME, EXITS, GROUPS, HIDEAWAY, MISSION, STAND, TRAILS, VARIANT_KEY,
  asideView, crossingLine, ecoductClearings, ecoductLayout, ecoductTreeClearings, lastVariants, mouthOf, nearestOn, roepSpot,
  type Crossing, type EcoductLaid, type Kind, type Side,
} from './ecoduct.places';

/** The light this home plays in: animals cross at dawn and dusk (a new light each play,
 *  never one of his last two plays'). */
export const ECODUCT_MOODS = { allow: ['ochtendnevel', 'gouden-uur', 'bewolkt', 'schemer'] as readonly MoodId[], perPlay: 2 };

/** How fast each kind walks down to the bed and over it (m/s): calm, never a dash. */
const PACE: Readonly<Record<Kind | 'das', number>> = { hert: 1.35, zwijn: 1.0, ree: 1.25, vos: 1.2, das: 0.9 };
/** How far each walks behind the one before it (m). */
const GAP: Readonly<Record<Kind | 'das', number>> = { hert: 2.1, zwijn: 0.95, ree: 1.5, vos: 1.2, das: 1 };
/** Its calls: a soft contact call (a temptation) and its alarm (a reach). */
const CALL: Readonly<Record<Kind | 'das', { soft: string; alarm: string }>> = {
  hert: { soft: 'fiep', alarm: 'ree' }, zwijn: { soft: 'wildzwijn', alarm: 'wildzwijn' }, ree: { soft: 'fiep', alarm: 'ree' },
  vos: { soft: 'vos', alarm: 'vos' }, das: { soft: 'das', alarm: 'das' },
};
/** How far (m) the opening look's aim lies from the lens: it glides ~5 m toward the bridge. */
const LOOK_AIM_M = 11;
/** The lead's breath on each patch of the route (s): its head down to the sand. */
const VISIT_DWELL = 0.55;
/** …and its pace between the patches (× its walk): brisk, it knows the way. */
const VISIT_PACE = 1.15;
/** How big (px) an animal shows in his picture, steady for a second, before it is his. */
const SEEN_PX = 40;

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
  const laid = ecoductLayout(play, rounds, order, lastVariants(s.geschiedenis));
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

/** One group crossing: its animals (the lead first), its way down, over and out. */
class Group {
  readonly kind: Kind | 'das';
  readonly members: Actor[];
  readonly lead: Actor;
  readonly young: Actor;
  readonly from: Side;
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

  /** In file at its trail's start (back the way it came along the deck's foot), unseen
   *  behind the ecoduct's end, facing down the trail. */
  enter(): void {
    const t = TRAILS[this.from];
    const p = t[0], q = t[1];
    const back = { x: (p.x - q.x) / dist(p, q), z: (p.z - q.z) / dist(p, q) };
    const face = headingTo(p, q);
    this.members.forEach((m, i) => {
      if (m.lies) void m.lie(false);
      m.place(p.x + back.x * this.gap * i, p.z + back.z * this.gap * i, face);
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

  /** All stop and look at `at` (heads up), for `secs`. */
  stare(at: Spot, secs: number): void {
    for (const m of this.members) void m.lookAt(() => ({ x: at.x, z: at.z, speed: 0 }), secs);
  }

  /** Off the bed and out its way, until the whole group is out of his picture (then it is
   *  gone: hidden, all at once — never one left standing behind the others). */
  async leave(): Promise<boolean> {
    this.leaving = true;
    await this.walk(EXITS[this.out]);
    // (at the way's end and still in view: it walks on a little, then it is gone)
    if (!this.gone) { const e = EXITS[this.out]; const a = e[e.length - 2], b = e[e.length - 1]; await this.walk([{ x: b.x + (b.x - a.x), z: b.z + (b.z - a.z) }]); }
    this.away();
    return true;
  }

  /** Per frame while leaving: once every one of them is out of his picture (behind the lens,
   *  past its side edge, or far out on the heath), the group is gone. */
  tick(cam: THREE.Camera): void {
    if (!this.leaving || this.gone) return;
    const out = this.members.every((m) => {
      if (!m.group.visible) return true;
      const v = new THREE.Vector3(m.x, m.group.position.y + 0.5, m.z).applyMatrix4(cam.matrixWorldInverse);
      const p = new THREE.Vector3(m.x, m.group.position.y + 0.5, m.z).project(cam);
      return (v.z > -0.5 || Math.abs(p.x) > 1.12 || Math.abs(p.y) > 1.15 || Math.hypot(m.x - cam.position.x, m.z - cam.position.z) > 34)
        && Math.hypot(m.x - BED.x, m.z - BED.z) > 6;
    });
    if (out) this.away();
  }

  /** Every one hidden (out of his picture already): gone. */
  get gone(): boolean { return this.members.every((m) => !m.group.visible); }

  /** Hide them all at once (a stop: the home lays its own). */
  away(): void { for (const m of this.members) { m.idle(); m.group.visible = false; } this.leaving = false; }
}

/* ------------------------------------------------------------- the story ---- */

async function story(k: AdventureKit, laid: EcoductLaid): Promise<void> {
  const c = k.copy;
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

  /* 0 · the hind and her calf that grazed by the bridge's north foot go back behind it (they
     noticed him at the marker): the play brings whoever comes */
  for (const key of ['hinde', 'kalf']) {
    const a = A[key];
    if (!a.group.visible) continue;
    void a.go(HIDEAWAY.x - (key === 'kalf' ? 1.6 : 0), HIDEAWAY.z, { speed: 'walk' }).then((ok) => { if (ok) { a.group.visible = false; a.idle(); } });
  }

  /* 1 · one calm look at the green bridge for animals; he ends facing it (the look glides
     toward a point on the line to its deck, so the lens stops ~17 m short of it: the whole
     bridge in the picture, never its arch filling it) */
  const cam0 = k.world.camera.position;
  const toDeck = Math.hypot(DECK_LOOK.x - cam0.x, DECK_LOOK.z - cam0.z);
  const f = Math.min(1, LOOK_AIM_M / Math.max(1, toDeck));
  const aim = { x: cam0.x + (DECK_LOOK.x - cam0.x) * f, z: cam0.z + (DECK_LOOK.z - cam0.z) * f, y: cam0.y + (DECK_LOOK.y - cam0.y) * f - 0.45 };
  await k.look(aim, c.kijk, 2.6, { turn: true, seconds: 2.4 });

  /* 2 · a quiet walk to the screen */
  await k.walk({ name: 'scherm', to: STAND, r: 0.6, line: c.naarScherm, doel: c.chipScherm, glyph: 'boot', quiet: { line: c.sst } });
  for (const key of ['hinde', 'kalf']) { A[key].idle(); A[key].group.visible = false; } // (behind the bridge by now)

  /* 3 · behind the screen: the held view over the bed, the bridge's mouth and its corners */
  await k.walkRanger(STAND.x, STAND.z, 0.04);
  k.beat = 'wacht';
  await k.frame(BED_VIEW, { face: STAND.heading });
  k.say(c.wacht);
  const g1 = groupOf(0);
  live.add(g1);
  g1.enter();
  // the first calm moment, as the first group comes (never the flip)
  const first = rust.next()!;
  if (first.id === 'roep') await roepAt(k, rust, first, g1, 'scherm');
  else await stilAt(k, rust, first, g1);

  /* 4 · the route over the sand (corsi): the lead treads it patch by patch; one group a round */
  let round = 0;
  let shownBy: Group = g1;
  await routeBeat(k, 0, {
    view: BED_VIEW, stand: STAND, field: home.field,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[0].skin.copy?.goed ?? c.routeWijs, nogEen: c.nogEenWeg },
    // the show: the group's lead walks onto each patch in turn and puts its nose to the sand
    // (the patch glows warm, its fresh tracks show, as long as it stands there); the others
    // wait at the mouth, heads up, until it is over
    visit: async (s, light) => {
      const g = shownBy;
      for (const m of g.members.slice(1)) { m.idle(); void m.lookAt(() => ({ x: g.lead.x, z: g.lead.z, speed: 0 }), 99); }
      if (!(await g.lead.go(s.x, s.z, { speed: g.pace * VISIT_PACE }))) return;
      light(true);
      const fwd = { x: Math.sin(g.lead.yaw), z: Math.cos(g.lead.yaw) };
      await g.lead.sniff(s.x + fwd.x * 0.5, s.z + fwd.z * 0.5, VISIT_DWELL, 0.6);
      light(false);
    },
    // the show over: the others come after the lead, and the group walks on into the heath
    shown: (firstShow) => {
      if (!firstShow) return;
      void shownBy.leave().catch(() => {});
    },
    // a patch he points at: a soft step (the tracks there are his to read; nothing walks)
    picked: async () => { await k.wait(0.25); },
    // the next round: the next group comes round its corner to the bed's mouth
    between: async () => {
      round += 1;
      const g = groupOf(round);
      live.add(g);
      g.enter();
      k.say(c.nogMeer);
      await g.walk(TRAILS[g.from].slice(1));
      g.stare(STAND, 0.7);
      await k.wait(0.7);
      shownBy = g;
    },
  });
  // the route's groups leave their tracks in the sand once it is pointed back (never before:
  // the tracks would show the way)
  for (let i = 0; i <= round; i++) home.tread(crossingLine(crossings[i].from, crossings[i].out), crossings[i].kind, crossings[i].n, 11 + i);

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
      g.enter();
      await stilAt(k, rust, e, g);
    } else {
      g.enter();
      await roepAt(k, rust, e, g, where);
    }
    if (isLast) { finale = g; break; }
    // (this group crosses the bed and goes on its way while the next comes)
    await crossOver(home, g, true);
  }
  rust.done();

  /* 8 · the reunion: the last group crosses into the heath, "De dieren staken veilig over." */
  await k.reunion(async () => {
    if (finale) await k.guard(Promise.race([crossOver(home, finale, false), k.wait(6)]));
    await k.wait(1.2);
  });
  /* 9 · the raaf: badgers and foxes use it too */
  await k.fact(1);
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
  // round the corner first (out of sight behind the bridge until there): then the line
  k.beat = 'stil:komt';
  const hold: Hold = { paused: false, stop: false };
  await g.walk([trail[1]]);
  const down = g.walk(trail.slice(2), hold, g.pace * 0.75).catch(() => false);
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
  // the group round the corner from out of sight and down toward the bed; there the young
  // one leaves it and comes up to him
  await g.walk(TRAILS[g.from].slice(1, 3));
  g.stare(k.ranger(), 1.0);
  await k.wait(0.4);
  const y = g.young;
  const me0 = k.ranger();
  const spot = roepSpot(where === 'scherm' ? STAND : me0, g.from, where === 'scherm' ? 'scherm' : 'bed');
  // it comes up to him (the others watch from the mouth)
  for (const m of g.members) if (m !== y) { m.idle(); void m.lookAt(() => ({ x: y.x, z: y.z, speed: 0 }), 99); }
  if (where !== 'scherm') {
    // (on the open sand: one held picture of him and it, side on)
    await k.frame(roepView(me0, spot), { face: headingTo(me0, spot), dip: true });
  }
  await y.go(spot.x, spot.z, { speed: g.kind === 'zwijn' ? 0.9 : 1.1 });
  const atHim = (): { x: number; z: number; speed: number } => { const r = k.ranger(); return { x: r.x, z: r.z, speed: 0 }; };
  void y.lookAt(atHim, 99);
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
    // called: it startles, trots off a few metres, stops, looks back, and comes back calmly
    wrong: async () => {
      if (settings.geluid) Sound.callAt(CALL[g.kind].alarm, y.x, y.z, listenerOf(k.world.camera), 20);
      const back = toward(y, mouthOf(g.from), 3.2);
      await y.go(back.x, back.z, { speed: 'trot' });
      void y.lookAt(atHim, 99);
      await k.wait(1.1);
      await y.go(spot.x, spot.z, { speed: 0.45 });
      void y.lookAt(atHim, 99);
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
  k.beat = 'sporen';
  k.say(c.zoveel);
  k.discover('ecoduct.sporen', { first: true });
  k.stats.sporen = 1;
  await k.wait(2.4);
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
  const trail = TRAILS[g.from];
  g.enter();
  // he turns to where they will come from (the lens behind him)
  const r0 = k.ranger();
  k.world.faceRanger(headingTo(r0, trail[2]));
  await k.behind();
  // (they come round the corner and stop at the bridge's foot: he is in their way)
  await g.walk(trail.slice(1, 3));
  g.stare(k.ranger(), 99);
  // their way: down to the mouth, over the bed (through where he stands) and out
  const way = [...trail.slice(2), { x: BED.x, z: BED.z }, ...EXITS[g.out]];
  const aside = ASIDE[g.out];
  let why: 'stay' | 'closer' = 'stay';
  await rust.go(e.id, {
    line: c.opzij,
    family: () => nearestOn(k.ranger(), way),
    to: aside, doel: c.chipOpzij, glyph: 'footprints', hush: c.sst,
    // (walking up to them is no answer, nor is standing: the words fit what he did)
    get mis(): string | undefined { return why === 'closer' ? c.nietNaar : undefined; },
    wrong: async (w) => {
      why = w;
      // they give up and walk back up behind the corner, then come out to the mouth again
      g.lead.idle();
      await g.walk([trail[1], trail[0]]);
      await k.wait(1.2);
      await g.walk(trail.slice(1, 3));
      g.stare(k.ranger(), 99);
    },
    // he watches them come: from behind him, over the bed (one soft dip: he faces the other way)
    right: async () => {
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
  g.enter();
  k.stats.das = 1;
  await g.walk([TRAILS[from][1]]);
  k.say(c.das, { good: true });
  await g.walk(TRAILS[from].slice(2));
  const a = g.lead;
  const p = atLocal(BED, from === 'N' ? -0.6 : 0.6, 0.3);
  await a.go(p.x, p.z, { speed: g.pace });
  await a.sniff(p.x + 0.4, p.z, 0.9, 0.5);
  home.tread(crossingLine(from, g.out), 'das', 1, 77);
  void g.leave().catch(() => {});
  await k.wait(1.6);
}

/* ---------------------------------------------------------- what he saw ---- */

/** An animal's box as he sees it (its own size from the scale table, round where it stands:
 *  a rigged model's bones say nothing about its drawn size). */
function boxFor(a: Actor): THREE.Box3 {
  const sz = (SIZE as Record<string, { h: number; len?: number }>)[a.animal];
  const len = (sz?.len ?? a.height) * (a.height / (sz?.h ?? a.height));
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
    seen.watch({ id: GROUPS[kind].disc, box: box(GROUPS[kind].members), px: SEEN_PX, secs: 1, within: 26, when: () => !/^(look|walk:scherm)/.test(k.beat) });
  }
  seen.watch({ id: DAS_ID, box: box([DAS]), px: SEEN_PX, secs: 1, within: 26 });
  k.onTick((dt) => {
    seen.tick(dt);
    for (const [key, v] of Object.entries(seen.most)) k.stats[`px_${key.slice(key.indexOf('.') + 1)}`] = v;
  });
}
