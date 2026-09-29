/**
 * wildcamera.ts — "De wildcamera" as an adventure in the world (design run6-missions §4.3).
 *
 * A camera trap lies on a stump at the marker. The ranger takes it and follows a
 * WILDWISSEL — a narrow trodden game trail with deer slots, boar and badger prints — into
 * the wood, to a crossing where a second game trail runs from an open glade past a
 * sturdy pine into a thicket with the badger's sett. He straps the camera to the pine
 * (its red light blinks) and aims it, animal by animal, at the glade or the thicket by
 * the rule on the card; each right choice brings the animal walking into view there and
 * a photograph joins the strip (WISSELEN). When the rule flips, the day turns into night
 * (or back): night animals come out into the open, day animals rest in the thicket. At
 * night the badger comes out of its sett, a wild boar out of the bushes, a roe to the
 * glade's edge, a nightjar onto a log; they call, and he calls them back in order
 * (SIMON). The night passes. In the morning he looks through the photos: the animals
 * he aimed for, and on the last one a man setting a snare by the trail. He finds the
 * empty snare and takes it away. A roe steps into the glade; the camera clicks: it
 * guards the wood. The camera stays on its pine.
 *
 * Steps (content, the EF contract): 0 wisselen · 1 simon, each logged once.
 */

import type { Adventure } from '../registry';
import type { AdventureKit } from '../kit';
import type { Actor } from '../actors';
import type { WisselBin, WisselItem } from '../../../engines/wisselen';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { aimBeat, type AimWorld } from '../beats/aim';
import { callersBeat, type Caller } from '../beats/callers';
import { headingTo, atLocal } from '../places';
import type { Spot } from '../types';
import { WildcameraHome } from './wildcamera.home';
import { PhotoStrip, develop, type Photo } from './wildcamera.photos';
import {
  WILDCAMERA_HOME, WILDCAMERA_PLACES as P, CROSS, CROSS_VIEW, REUNION_VIEW, TRAIL_VIEW, SNARE_VIEW, CALLER_SPOTS, LOG,
  aimSpot, cameraAim, wildcameraClearings, wildcameraTreeClearings, wildcameraTrees, type AimSpot,
} from './wildcamera.places';

export const wildcameraAdventure: Adventure = {
  id: 'wildcamera',
  home: WILDCAMERA_HOME,
  clearings: wildcameraClearings(),
  treeClearings: wildcameraTreeClearings(),
  trees: wildcameraTrees(),
  dressing: (env) => new WildcameraHome(env),

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as WildcameraHome;
    const photos = new PhotoStrip(k.host);
    try {
      await story(k, fam.actors as Record<Walker, Actor>, home, photos);
    } finally {
      photos.dispose();
    }
  },
};

type Walker = 'edelhert' | 'ree' | 'das' | 'wildzwijn';

/** How fast each animal comes into view (m/s): a calm walk, never a dash. */
const PACE: Record<string, number> = { edelhert: 1.35, ree: 1.25, das: 0.9, wildzwijn: 1.05 };

/** Where the camera aims for each place: the glade's middle, the thicket's foot. */
const AIM_AT: Record<WisselBin, Spot> = { open: P.glade, hol: atLocal(CROSS, 4.1, -2.1) };

/** The camera's clock on the photos: evening, night, first light. */
const CLOCK = {
  dag: ['17:42', '18:05', '18:31', '18:56', '19:20', '19:48', '20:07', '20:26'],
  nacht: ['22:14', '23:02', '23:47', '00:36', '01:18', '02:05', '02:51', '03:34'],
};

async function story(k: AdventureKit, A: Record<Walker, Actor>, home: WildcameraHome, photos: PhotoStrip): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const lens = (): { x: number; z: number; speed: number } => ({ x: k.world.camera.position.x, z: k.world.camera.position.z, speed: 0 });
  let shots = 0;
  const clockOf = (night: boolean): string => {
    const list = night ? CLOCK.nacht : CLOCK.dag;
    return list[Math.min(list.length - 1, shots++ % list.length)];
  };
  /** A photograph from the camera on the pine, looking at `p` (`y` m up, `frameH` m of
   *  height in the picture), developed. */
  const photograph = async (p: Spot, y: number, frameH: number, what: string, time: Photo['time'], prepare?: () => () => void): Promise<Photo | null> => {
    const cam = home.photoCamera(p, y, 1.6, frameH);
    const raw = await k.guard(k.world.snapshot(cam, 320, 200, () => {
      const a = home.photoPrep();
      const b = prepare?.();
      return () => { b?.(); a(); };
    }));
    if (!raw) return null;
    return { url: develop(raw, time, time === 'ochtend' ? '05:52' : clockOf(time === 'nacht'), shots + 7), what, time };
  };
  const shutter = (night: boolean): void => {
    home.flash(night);
    if (settings.geluid) Sound.shutter();
  };

  /* -- the animals: in from out of view, and out again -- */
  const leaving = new Map<string, number>();
  let birdToken = 0;
  const walkIn = async (id: string, s: AimSpot): Promise<void> => {
    leaving.delete(id);
    if (id === 'nachtzwaluw') {
      birdToken += 1;
      const from = home.bird.visible ? { x: home.birdAt.x, z: home.birdAt.z, y: home.birdAt.y - k.ctx.groundY(home.birdAt.x, home.birdAt.z) } : { ...s.from, y: 3.4 };
      await k.guard(home.fly(from, { ...s.at, lift: 0 }, s.yaw, k.reduced, 2.2));
      return;
    }
    const a = A[id as Walker];
    if (!a.group.visible) {
      a.place(s.from.x, s.from.z, headingTo(s.from, s.at));
      a.group.visible = true;
    }
    await k.guard(Promise.race([a.go(s.at.x, s.at.z, { speed: PACE[id] ?? 1.1, face: s.yaw }), k.wait(9).then(() => false)]));
  };
  const walkOut = (id: string, s: AimSpot): void => {
    if (id === 'nachtzwaluw') {
      const token = ++birdToken;
      const p = home.birdAt;
      void home.fly({ x: p.x, z: p.z, y: 0.2 }, { x: s.from.x, z: s.from.z, lift: 3.4 }, 0, k.reduced, 2.2)
        .then(() => { if (token === birdToken) home.birdGone(); });
      return;
    }
    const a = A[id as Walker];
    const t = (leaving.get(id) ?? 0) + 1;
    leaving.set(id, t);
    if (a.lies) void a.lie(false);
    void a.go(s.from.x, s.from.z, { speed: PACE[id] ?? 1.1 }).then((ok) => {
      if (ok && leaving.get(id) === t) { a.group.visible = false; a.idle(); }
    });
  };

  /* 1 · at the marker: the camera lies on the stump */
  k.beat = 'pak';
  await k.act(c.pakKnop, c.pak);
  home.pickUp();
  if (settings.geluid) Sound.step();
  // he steps onto the wildwissel where it leaves the ring, and the view looks along it
  // into the wood (one calm move; the follow camera takes over from there, facing the way)
  k.beat = 'pad';
  k.lockFollow();
  await k.walkRanger(P.trailStart.x, P.trailStart.z, 0.05);
  k.world.faceRanger(TRAIL_VIEW.heading);
  k.say(c.kijkPad);
  await k.frame(TRAIL_VIEW, { face: TRAIL_VIEW.heading });
  await k.wait(2.2);

  /* 2 · follow the wildwissel into the wood, to the crossing */
  await k.walk({ name: 'wissel', to: P.crossApproach, r: P.crossApproach.r, line: c.volg, doel: c.chipPad, cue: c.sporen });

  /* 3 · strap the camera to the pine */
  k.beat = 'hang';
  await k.act(c.hangKnop, c.hang);
  await k.walkRanger(P.strap.x, P.strap.z, 0.05);
  k.world.faceRanger(P.strap.heading);
  await k.wait(0.3);
  home.strapOn();
  if (settings.geluid) Sound.strap();
  k.say(c.hangt, { good: true });
  k.stats.camera_strapped = 1;
  await k.wait(1.6);

  /* 4 · aim the camera for each animal, as the day turns to night (wisselen) */
  photos.show(true);
  const at = new Map<string, AimSpot>();
  const aimWorld: AimWorld = {
    places: {
      open: { pick: home.glade, hint: home.gladeHint },
      hol: { pick: home.thicket, hint: home.thicketHint },
    },
    begin: () => { home.showTags(true); home.showFan(true); },
    end: () => { home.showTags(false); home.showFan(false); },
    look: async (bin) => {
      home.aim(cameraAim(AIM_AT[bin]), k.reduced);
      await k.until(() => !home.aiming, 3);
    },
    photo: async (item: WisselItem, bin: WisselBin) => {
      const s = aimSpot(item.id, bin);
      at.set(item.id, s);
      await walkIn(item.id, s);
      // a deer rests in the thicket at night: the roe lies down
      if (item.id === 'ree' && bin === 'hol') await k.guard(A.ree.lie(true));
      await k.wait(0.35);
      const night = k.world.daylight() < 0.5;
      shutter(night);
      // framed on the animal: its middle, a little more than its height in the picture
      const h = item.id === 'nachtzwaluw' ? 0.26 : A[item.id as Walker].height * (item.id === 'ree' && bin === 'hol' ? 0.5 : 1);
      const p = await photograph(s.at, h * 0.5, Math.max(1.1, h * (h > 1 ? 1.6 : 2.3)), item.id, night ? 'nacht' : 'dag');
      if (p) photos.add(p);
      k.stats.photos = photos.photos.length;
      await k.wait(0.6);
    },
    empty: async (bin) => {
      const night = k.world.daylight() < 0.5;
      shutter(night);
      const p = await photograph(AIM_AT[bin], 0.5, 2.2, 'leeg', night ? 'nacht' : 'dag');
      if (p) photos.empty(p, c.leeg.split('.')[0]);
      await k.wait(0.5);
    },
    leave: (item) => { const s = at.get(item.id); if (s) walkOut(item.id, s); },
    turn: async (to) => {
      k.daylight(to === 'night' ? 0 : 1, 2.2);
      await k.wait(2.4);
    },
  };
  await aimBeat(k, 0, {
    view: CROSS_VIEW, stand: P.watch, world: aimWorld,
    lines: {
      vraag: c.vraag, komt: (id) => c[`komt_${id}`] ?? c.vraag, foto: c.foto, leeg: c.leeg,
      nacht: c.nacht, dag: c.dag, andersom: c.andersom, goed: k.steps[0].skin.copy?.goed ?? c.foto,
    },
  });
  // the last one walks off too
  for (const [id, s] of at) if (id === 'nachtzwaluw' ? home.bird.visible : A[id as Walker].group.visible) walkOut(id, s);
  photos.show(false);
  home.aim(0, k.reduced); // the camera looks back at the crossing

  /* 5 · the raaf: the badger sleeps by day */
  await k.fact(0);

  /* 6 · night: who comes? (the night callers walk in) */
  k.beat = 'night';
  if (k.world.daylight() > 0.2) {
    k.say(c.donker);
    k.daylight(0, 2.4);
    await k.wait(2.6);
  }
  k.say(c.nachtKomt);
  const S = CALLER_SPOTS;
  const arrive = async (id: string, delay: number): Promise<void> => {
    await k.wait(delay);
    const s = S[id];
    if (id === 'nachtzwaluw') {
      birdToken += 1;
      await k.guard(home.fly({ ...s.from, y: 4 }, { ...s.at, lift: LOG.h * 0.9 }, s.yaw, k.reduced, 2.6));
      return;
    }
    const a = A[id as Walker];
    if (a.lies) await a.lie(false);
    if (!a.group.visible) { a.place(s.from.x, s.from.z, headingTo(s.from, s.at)); a.group.visible = true; }
    await k.guard(Promise.race([a.go(s.at.x, s.at.z, { speed: (PACE[id] ?? 1) * 0.8, face: s.yaw }), k.wait(10).then(() => false)]));
  };
  // (any animal of the day still about has walked off: the night ones come in)
  await k.wait(0.6);
  await Promise.all([arrive('das', 0), arrive('wildzwijn', 0.9), arrive('ree', 1.8), arrive('nachtzwaluw', 2.4)]);
  k.stats.callers_in = 4;
  await k.wait(0.8);

  /* 7 · they call; he calls them back in the same order (simon) */
  const caller = (id: Walker): Caller => {
    const a = A[id];
    return {
      id, pick: a.group, body: a.body, at: () => ({ x: a.x, z: a.z }),
      act: (on) => { if (on) void a.lookAt(lens, 0.9); },
    };
  };
  const bird: Caller = {
    id: 'nachtzwaluw', pick: home.perch, body: home.birdObject, hint: home.perch, at: () => home.birdAt, act: (on) => home.birdHop(on),
  };
  const simonCopy = k.steps[1].skin.copy ?? {};
  await callersBeat(k, 1, {
    view: null,
    callers: [caller('das'), caller('wildzwijn'), caller('ree'), bird],
    lines: {
      luister: simonCopy.luister ?? 'Luister wie er roept…', echo: simonCopy.echo ?? 'Doe ze na. Klik op de dieren.',
      goed: simonCopy.goed ?? 'Knap onthouden!', groei: c.groei, opnieuw: c.opnieuw,
    },
    onCall: () => home.glowIr(0.9),
  });

  /* 8 · the night animals go; the night passes */
  k.beat = 'morning';
  k.say(c.slapen);
  for (const id of ['das', 'wildzwijn', 'ree', 'nachtzwaluw']) {
    const s = S[id];
    walkOut(id, { at: s.at, from: s.from, yaw: s.yaw });
  }
  await k.wait(2.6);
  k.say(null);
  k.ui.veil(c.ochtend);
  await k.wait(1.2);
  // behind the veil: first light; the camera saw a man by the trail at dawn
  for (const id of ['das', 'wildzwijn', 'ree'] as const) { A[id].group.visible = false; A[id].idle(); }
  home.birdGone();
  k.daylight(0.3, 0);
  home.aim(cameraAim(P.snare), true);
  await k.wait(0.2);
  const man = await photograph(P.snare, 0.8, 2.4, 'man', 'ochtend', () => home.poacherIn());
  if (man) photos.photos.push(man);
  k.cluePhoto = man?.url ?? null;
  home.showSnare(true);
  await k.wait(1.4);
  k.ui.veil(null);
  k.daylight(1, 3.2); // the sun comes up
  await k.wait(1.6);

  /* 9 · what did the camera see? the photos, and the man on the last one */
  k.beat = 'photos';
  await k.act(c.fotoKnop, c.fotos);
  k.say(null);
  k.stats.photos = photos.photos.length;
  await k.guard(photos.review(c.fotoTitel, c.man, 'Verder', k.signal));
  /* 10 · the raaf: the camera tells the ranger who lives here */
  await k.fact(1);

  /* 11 · the snare by the trail: take it away */
  await k.walk({ name: 'val', to: P.snareApproach, r: P.snareApproach.r, line: c.zoekVal, doel: c.chipVal, cue: c.bijPad });
  k.beat = 'val';
  await k.walkRanger(P.snareApproach.x, P.snareApproach.z, 0.05);
  await k.frame(SNARE_VIEW, { face: P.snareApproach.heading });
  await k.act(c.valKnop, c.valHier);
  home.showSnare(false);
  if (settings.geluid) { Sound.rustle(); Sound.found(); }
  k.say(c.valWeg, { good: true });
  k.stats.snare_gone = 1;
  await k.wait(1.8);

  /* 12 · the camera guards the wood: a roe steps into the glade, click */
  const roe = WILDCAMERA_HOME.residents.find((r) => r.key === 'ree')!.after!;
  await k.frame(REUNION_VIEW, { face: headingTo(k.ranger(), P.glade) });
  await k.reunion(async () => {
    const from = aimSpot('ree', 'open').from;
    const a = A.ree;
    if (a.lies) await a.lie(false);
    a.place(from.x, from.z, headingTo(from, roe));
    a.group.visible = true;
    home.aim(cameraAim(roe), k.reduced);
    await Promise.race([a.go(roe.x, roe.z, { speed: 1.1, face: roe.yaw }), k.wait(8)]);
    shutter(false);
    a.root(roe.x, roe.z, roe.roam ?? 0.5);
    await k.wait(1.2);
  });
}

