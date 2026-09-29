/**
 * eekhoorn.ts — "De verstopte nootjes" as an adventure in the world (design §4.4).
 *
 * The squirrel lives on its oak right by the marker: it runs down and round the trunk,
 * forages at its foot, sits on a branch stub, and chatters at the ranger when he comes
 * near. Once the mission starts it takes him to its glade: down the oak and over the
 * forest floor to a pine, where it sits on a stub and waits for him; a leap to the next
 * pine and on to a third, where it waits again; then into its glade. There it buries its
 * acorns in the moss, one spot after another, runs up the big oak — and forgets where
 * (CORSI: he points the spots out in order; it dashes to each, sniffs and digs it up; a
 * wrong spot, it sniffs and finds nothing, and the spots glow again as he remembers
 * them). With all its acorns back it piles them by its stump. Then the neighbours come
 * to see the store: the jay (the nut thief), the green woodpecker, the raven — and the
 * squirrel on its stump. They call, and he calls them back (SIMON). The jay flies off,
 * the squirrel sits on its stump and eats an acorn. Afterwards the store stays, the
 * squirrel lives at its glade, and a later visit finds an oak seedling at a forgotten spot.
 *
 * Steps (content, the EF contract): 0 corsi · 1 simon, each logged once.
 */

import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { ResidentGroup } from '../../world/Residents';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { listenerOf } from '../../world/Residents';
import { routeBeat } from '../beats/route';
import { callersBeat, type Caller } from '../beats/callers';
import { Squirrel } from '../squirrel';
import { dist, headingTo } from '../places';
import { TREE_BASE_H } from '../../world/Forest';
import { EekhoornHome } from './eekhoorn.home';
import {
  CALLERS_VIEW, EEKHOORN_HOME, EEKHOORN_PLACES as P, GLADE_VIEW, HEAP, HEAP_GRAB, HOME_TREES, INTRO_VIEW, JAY_GROUND, STUMP, HIDE_SEEN_AT, hideSide,
  eekhoornClearings, eekhoornTreeClear,
} from './eekhoorn.places';

/** The squirrel's size (m, sitting up with its tail): the upper end of a red squirrel,
 *  so a child reads it on a trunk a few metres off. */
const SQUIRREL_H = 0.3;

export const eekhoornAdventure: Adventure = {
  id: 'eekhoorn',
  home: EEKHOORN_HOME,
  clearings: eekhoornClearings(),
  trees: HOME_TREES.map((t) => ({ x: t.x, z: t.z, s: t.h / TREE_BASE_H[t.species], rotY: t.rotY, species: t.species })),
  treeClearings: eekhoornTreeClear(),
  dressing: (env) => new EekhoornHome(env),
  actor: (spec, env, _height, dressing) => {
    if (spec.key !== 'squirrel' || !(dressing instanceof EekhoornHome)) return null;
    const sq = new Squirrel(spec.key, env, { height: SQUIRREL_H, trees: dressing.trees, seed: 11 });
    sq.stumps.push({ x: STUMP.x, z: STUMP.z, top: STUMP.top, r: STUMP.r });
    sq.onDig = (x, z) => dressing.puffAt(x, z, env.reduced());
    return sq;
  },
  prepare(world) {
    // a replay: the store is small again and the jay back on its stub (under the card)
    (world.residents.dressing('eekhoorn') as EekhoornHome | null)?.setState(world.residents.state('eekhoorn') ?? 'before');
  },

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as EekhoornHome;
    const sq = fam.actors.squirrel as Squirrel;
    sq.lensAt = () => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });
    sq.rangerAt = () => k.ranger();
    fam.voice('squirrel', false); // (the adventure chatters itself now)
    // (they stay set: running home after a stop it goes round the lens and the ranger too)
    await story(k, fam, home, sq);
  },
};

/** The adventure, beat by beat. */
async function story(k: AdventureKit, fam: ResidentGroup, home: EekhoornHome, sq: Squirrel): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const [oak, pineA, pineB, pineC] = home.trees;
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  const faceMe = (from: { x: number; z: number }): number => headingTo(from, k.ranger());
  let lastChatter = -9;
  const chatter = (): void => {
    lastChatter = k.now;
    if (settings.geluid) Sound.callAt('eekhoorn', sq.x, sq.z, listenerOf(k.world.camera));
    sq.called();
  };
  void fam;

  // 0 · it sees him coming: up to its branch stub on its pine, and it chatters at him.
  //     The one look of the mission: the lens turns to it over his shoulder, so the
  //     child meets the squirrel he is going to follow; then the follow camera is back.
  k.beat = 'den';
  await k.guard(sq.goBranch(oak, faceMe(sq.branchPose(oak))));
  await k.frame(INTRO_VIEW, { face: headingTo(k.ranger(), oak.trunk) });
  k.say(c.daar);
  chatter();
  await k.wait(1.5);
  sq.flick();
  await k.wait(1.1);
  chatter();
  await k.wait(1.2);
  k.free();

  // 1 · "Volg de eekhoorn": tree to tree, it waits for him on a branch each time
  const hop = async (name: string, go: () => Promise<boolean>, to: { x: number; z: number }, line: string): Promise<void> => {
    k.say(line);
    const there = k.guard(go());
    let arrived = false;
    let toldWait = false;
    void there.then(() => { arrived = true; void sq.lookAt(me); chatter(); }).catch(() => {});
    await k.walk({
      name, to: { ...to, r: 4 }, r: 4, line, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
      // while he waits for the ranger it chatters now and then (a sound to follow); when
      // the ranger wanders off, the line says so once
      tick: () => {
        if (!arrived) return;
        if (k.now - lastChatter > 3.2) chatter();
        const far = dist(k.ranger(), sq) > 9;
        if (far && !toldWait) { toldWait = true; k.say(c.wacht); } else if (!far && toldWait && dist(k.ranger(), sq) < 6) { toldWait = false; k.say(line); }
      },
    });
    await there; // (he may be quicker than the squirrel: it gets there first)
  };
  await hop('pijn-1', () => sq.goBranch(pineA, headingTo(pineA.trunk, oak.trunk)), pineA.trunk, c.volg);
  await hop('pijn-3', async () => {
    // a leap to the next pine and another to the third, then it waits there
    if (!(await sq.goLeap(pineB))) return false;
    await k.wait(0.25);
    return sq.goLeap(pineC, headingTo(pineC.trunk, pineA.trunk));
  }, pineC.trunk, c.weer);

  // it plays hide-and-seek: as he comes up it scurries round the trunk to the far side
  // (as red squirrels do), and he walks round the tree to find it — its chatter from
  // behind the bark tells him where. Round the side, not straight behind (the way round
  // passes the trunk), on the side toward its glade.
  k.beat = 'verstop';
  const hideAt = hideSide(pineC.trunk, k.ranger(), STUMP);
  const hidden = k.guard(sq.goRound(pineC, { ang: hideAt, h: 1.1 }));
  hidden.catch(() => {});
  const round = { x: pineC.trunk.x + Math.sin(hideAt) * HIDE_SEEN_AT, z: pineC.trunk.z + Math.cos(hideAt) * HIDE_SEEN_AT };
  await k.wait(0.6);
  await k.walk({
    name: 'om-de-boom', to: round, r: 1.2, line: c.waarIsHij, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 14,
    tick: () => { if (k.now - lastChatter > 3.4) chatter(); },
  });
  await hidden;
  // found: he stops (a moment with the keys resting), it pours down the bark and pops up
  // on the ground in front of him, wherever he looks (in the follow camera's view), sits
  // up facing him and chatters
  k.lockFollow();
  await k.until(() => k.ranger().speed < 0.1, 1.5);
  const m = k.ranger();
  const ahead = m.heading; // (where he looks: the follow camera looks there too)
  // (ahead of him but off to the side away from the tree, on the open floor: straight
  // ahead his own body would hide it from the camera behind him, by the trunk it is a
  // small dark thing against the dark bark)
  const toTree = headingTo(m, pineC.trunk);
  const side = Math.sin(toTree - ahead) >= 0 ? -1 : 1;
  const popAt = ahead + side * 0.75;
  const pop = { x: m.x + Math.sin(popAt) * 1.8, z: m.z + Math.cos(popAt) * 1.8 };
  k.say(c.gevonden);
  await k.guard(sq.run(sq.dashTo(pop.x, pop.z, headingTo(pop, m))));
  chatter();
  await k.wait(0.7);
  sq.flick();
  await k.wait(1.1);

  // into its glade: down the pine and over the ground onto its stump by the store
  k.say(c.weer);
  const stumpFace = headingTo(STUMP, P.stand);
  const toStump = k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  toStump.catch(() => {}); // (a stop during the walk: the walk throws, this one is let go)
  await k.walk({ name: 'open-plek', to: P.stand, r: 1.6, line: c.weer, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18 });
  await toStump;
  k.say(c.plekje);
  chatter();
  // it takes an acorn from its store: it starts burying with one in its mouth
  await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z));
  await k.guard(sq.sniffHere(0.35));
  sq.carry(true);

  // 2 · it buries its acorns, one spot after another, and forgets them (corsi)
  /** Forgotten: back on its stump it looks this way and that, and chatters. */
  const forget = async (): Promise<void> => {
    if (!(await sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace))) return;
    chatter();
    if (!(await sq.look(stumpFace + 0.8))) return;
    if (!(await sq.look(stumpFace - 0.8))) return;
    await sq.look(stumpFace, 0.1);
  };
  await routeBeat(k, 0, {
    view: GLADE_VIEW, stand: P.stand, field: home.field,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[0].skin.copy?.goed ?? c.routeWijs, vergeten: c.vergeten },
    // the show: it dashes to each spot with an acorn in its mouth and digs it in (the
    // spot lit while it digs; the acorn sinks into the moss in front of its nose)
    visit: async (s, light) => {
      sq.carry(true);
      if (!(await sq.goDash(s.x, s.z))) return;
      light(true);
      sq.carry(false);
      const y = sq.now.yaw;
      home.buryAcorn(s.x + Math.sin(y) * 0.07, s.z + Math.cos(y) * 0.07, 0.62);
      await sq.dig(0.72);
      light(false);
    },
    // a pick: it dashes there and sniffs — the right one it digs up, a wrong one it
    // shakes off (nothing there)
    // the show over, it runs back to its stump and forgets (recall is open at once)
    shown: (first) => { if (first) { sq.carry(false); void forget().catch(() => {}); } },
    picked: async (s, res) => {
      if (res === 'reshow') {
        await sq.goDash(s.x, s.z);
        await sq.sniffHere(0.7);
        // nothing there: a shake of its head (a quick look left and right)
        const y = sq.now.yaw;
        await sq.look(y + 0.6, 0.15);
        await sq.look(y - 0.5, 0.15);
        return;
      }
      // the right spot: it digs, and the acorn comes up into its mouth
      if (!(await sq.goDash(s.x, s.z))) return;
      const y = sq.now.yaw;
      home.unearthAcorn(s.x + Math.sin(y) * 0.07, s.z + Math.cos(y) * 0.07, 0.5);
      if (!(await sq.dig(0.5))) return;
      sq.carry(true);
      sq.flick();
    },
  });

  // it brings the acorns back to its store: a happy run, and its store grows
  k.say(c.stapel);
  sq.carry(true);
  await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z));
  sq.carry(false);
  await sq.dig(0.45);
  home.growHeap(4);
  if (settings.geluid) Sound.found();
  await k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  chatter();

  // 3 · the raaf: forgotten nuts grow into trees
  await k.fact(0);

  k.beat = 'gaai';
  // 4 · the jay (the nut thief) comes down for the store; the squirrel scolds it from its
  //     stump, the neighbours call out, and he calls them back (simon). The lens turns
  //     to the neighbours first, so he sees the jay come.
  await k.walkRanger(P.callers.x, P.callers.z, 0.04);
  await k.frame(CALLERS_VIEW, { face: P.callers.heading });
  k.say(c.gaaiKomt);
  home.jayDown();
  await k.wait(1.2);
  if (settings.geluid) Sound.callAt('gaai', JAY_GROUND.x, JAY_GROUND.z, listenerOf(k.world.camera));
  await k.wait(0.9);
  chatter(); // (the squirrel scolds it)
  await k.wait(0.8);
  k.say(c.roepMee);
  await k.wait(2.2);
  if (sq.body) sq.body.userData.perch = STUMP.top; // (it sits on its stump)
  const callers: Caller[] = [
    { id: 'eekhoorn', pick: sq.group, body: sq.body, at: () => ({ x: sq.x, z: sq.z }), act: (on) => { if (on) sq.called(); } },
    ...home.neighbours.map((n): Caller => ({ id: n.id, pick: n.object, body: n.body, at: () => ({ x: n.at.x, z: n.at.z }), act: (on) => { if (on) n.call(); } })),
  ];
  await callersBeat(k, 1, {
    view: null, callers,
    lines: { luister: c.luisterBuren, echo: c.naroepen, groei: c.groei, opnieuw: c.opnieuw, goed: c.goedBuren },
  });
  if (sq.body) delete sq.body.userData.perch;
  // the jay (the nut thief) gives up and flies off over the trees
  k.say(c.gaai);
  const jay = home.neighbours.find((n) => n.id === 'gaai');
  if (settings.geluid && jay) Sound.callAt('gaai', jay.at.x, jay.at.z, listenerOf(k.world.camera));
  home.jayFlies();
  await k.wait(2.4);

  // 5 · the squirrel sits on its stump and eats an acorn: all its nuts are back
  home.seedlingWaits = true; // (a later visit finds the forgotten one grown)
  await k.reunion(async () => {
    sq.flick();
    await sq.eat(3.6);
  });
  k.stats.store = dist(sq, HEAP) < 1.2 ? 1 : 0;
  // the raaf: the squirrel wakes up in winter to eat (the store is its winter food)
  await k.fact(1);
}
