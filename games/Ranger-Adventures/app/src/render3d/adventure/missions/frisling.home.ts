/**
 * frisling.home.ts — the rotte's home in the world, built with the world (the THREE
 * half of frisling.places.ts): the muddy WALLOW with its fallen log and bracken rim,
 * THREE STANDS of bracken and pijpenstrootje the lost piglet may lie in (run 7: one per
 * way, each with its look-alike things a searching child may take for him: rust-brown dead
 * fronds, a butterfly on a foxglove, a stonechat on a seed head, a nightjar at the edge),
 * loose clumps along each way home, the two ROOTING FIELDS' seven patches of turned earth,
 * and a few small trotter prints in the empty marker ring.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes); only
 * the ring's little prints go once he is home. Each play is laid in under the briefing
 * card (`lay`): the piglet's nook gets a small window in the stems over his back for the
 * search's lens (cover-math `openWindow`, the knobs' glimpse: his stripes glimpsed between
 * the stems, never more), the trial's look-alikes go to this play's spots, the ring's
 * prints point the way. `layDefault` puts back free roam's home (run 6's stand).
 */

import * as THREE from 'three';
import type { Distractor } from '../../../content/types';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { CoverField } from '../cover';
import { backPoints, openWindow, visibleShare, type Clump, type V3 } from '../cover-math';
import { PatchField } from '../patches';
import { StandDecoys, type Decoy } from '../decoys';
import { groundDecal } from '../decal';
import { atLocal, headingTo } from '../places';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { CutFence } from './frisling.clue';
import { SIZE } from '../../AnimalScale';
import {
  FRISLING_PLACES, WALLOW, WALLOW_FRAME, WALLOW_LOG, MARKER, WAYS, WAY_IDS, DEFAULT_WAY,
  fieldFrame, fieldSpotsOf, wallowClumps, wallowLog, standCover, standSeed, spotTag, nookAt, decoyAt,
  type FieldId, type WayId,
} from './frisling.places';
import { assignSpots, type DecoyKind } from './frisling.vary';

export type { Decoy } from '../decoys';

/** How far a stand of bracken is drawn from its own spot (m): a home's reach — a 1 m tall
 *  stand out on its own never pops in in open view. */
const STAND_REACH = { near: 40, far: 46, own: true } as const;

/** One way's stand: its own cover (three draw calls), its look-alikes, resting by its own
 *  distance (and, while a play goes another way, by that distance still). */
class Stand {
  readonly group: THREE.Object3D;
  readonly cover: CoverField;
  readonly decoys: StandDecoys;
  /** a look-alike spot's dead-bracken clump (its index in the cover) */
  readonly spotClump: number[];
  private readonly env: DressingEnv;
  readonly id: WayId;

  constructor(env: DressingEnv, id: WayId, distractors: readonly Distractor[]) {
    this.env = env;
    this.id = id;
    const w = WAYS[id];
    this.group = env.detail(w.stand, STAND_REACH);
    const clumps: Clump[] = standCover(id);
    this.cover = new CoverField({ parent: this.group, groundY: env.groundY, clumps, seed: standSeed(id) });
    this.spotClump = w.decoySpots.map((_, i) => clumps.findIndex((c) => c.decoy === spotTag(i)));
    // the look-alikes, first on their default spots (free roam's stand shows them there)
    const spots = assignSpots(w.decoySpots.map((_, i) => i), w.decoySpots, distractors.map(kindOf));
    const at = distractors.map((d, i) => ({ d, ...decoyAt(id, spots[i]) }));
    const tagged = clumps.map((c) => {
      const i = distractors.findIndex((d, k) => d.k === 'bush' && c.decoy === spotTag(spots[k]));
      return i >= 0 ? { ...c, decoy: distractors[i].id } : c;
    });
    this.decoys = new StandDecoys(env, this.group, at, this.cover, tagged, w.coverApproach, { perch: 'frond' });
    // no look-alike stands in a stand until a play (or free roam's default) lays them
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.useDecoys([]);
  }

  /** The trial's look-alikes on their spots (decoy i of `trial` on `spots[i]`); the rest go. */
  layDecoys(trial: readonly Distractor[], spots: readonly number[]): void {
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.relay(trial.map((d, i) => ({ id: d.id, ...decoyAt(this.id, spots[i]), clump: this.spotClump[spots[i]] })), WAYS[this.id].coverApproach);
    this.decoys.useDecoys(trial.map((d) => d.id));
  }

  /** No look-alikes, no window: the stand as it grows. */
  clear(): void {
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.useDecoys([]);
    this.cover.reset();
  }

  /** Close any old window and open one over him lying in `nook` (as `pose`), for the
   *  search's lens: `glimpse` of his back shows, never more than 1.5× it. */
  openFor(nook: number, pose: 0 | 1 | 2, glimpse: number): { share: number; changed: number; eye: V3 } {
    const w = WAYS[this.id];
    this.cover.reset();
    const lens = this.env.lensFor(w.searchView);
    const p = nookAt(this.id, nook, pose);
    const g = this.env.groundY;
    const back = backPoints(p.x, g(p.x, p.z), p.z, p.yaw, SIZE.frisling.len, lyingHeight(heightFor('frisling'), LEG_SHARE.frisling));
    const changed = openWindow(this.cover.stems, lens.cam, back, glimpse, glimpse * 1.5);
    this.cover.refresh();
    return { share: visibleShare(back, lens.cam, this.cover.stems), changed: changed.length, eye: lens.cam };
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    if (!this.group.visible) return;
    this.cover.update(dt, t, reduced, movers);
    this.decoys.update(dt, reduced);
  }

  dispose(): void {
    this.cover.dispose();
    this.decoys.dispose();
  }
}

/** A content distractor as the variant reads it. */
const kindOf = (d: Distractor): DecoyKind => ({ k: d.k, animal: d.animal });

/** The frisling home, as the adventure uses it. */
export class FrislingHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** the wallow's own cover: its rim and the clumps between the north field and it */
  readonly wallowCover: CoverField;
  readonly stands: Readonly<Record<WayId, Stand>>;
  readonly fields: Readonly<Record<FieldId, PatchField>>;
  /** the way laid in now (this play's, or free roam's default) */
  way: WayId = DEFAULT_WAY;
  /** the stems a lens at the search's eye sees the piglet's back past (stats) */
  glimpse: { share: number; changed: number } = { share: 0, changed: 0 };
  /** the eye the stand's window was opened for */
  searchEye: V3 = { x: 0, y: 0, z: 0 };
  private readonly ringPrints: THREE.InstancedMesh;
  /** the season's first clue (after): the cut fence past the wallow, boot prints through it */
  readonly clue: CutFence;
  /** while the adventure plays, the clue waits for its moment (`revealClue`), never
   *  appearing in the reunion's view */
  holdClue = false;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly distractors: readonly Distractor[];
  private readonly env: DressingEnv;

  constructor(env: DressingEnv, distractors: readonly Distractor[]) {
    this.env = env;
    this.distractors = distractors;
    this.group.name = 'frisling-home';
    env.parent.add(this.group);
    const g = env.groundY;

    /* -- the wallow: mud in a shallow dip, a wetter core, churned earth round it -- */
    const W = FRISLING_PLACES.wallow;
    const yaw = WALLOW_FRAME.heading;
    this.group.add(groundDecal(g, W.x, W.z, WALLOW.halfW + 0.7, WALLOW.halfD + 0.6, yaw, '#5b4430', { layer: 1, wobble: 0.16, seed: 3, feather: true }));
    this.group.add(groundDecal(g, W.x, W.z, WALLOW.halfW, WALLOW.halfD, yaw, '#3e2c1d', { layer: 2, wobble: 0.14, seed: 5, roughness: 0.55 }));
    const wet = atLocal(WALLOW_FRAME, -0.3, 0.2);
    this.group.add(groundDecal(g, wet.x, wet.z, WALLOW.halfW * 0.55, WALLOW.halfD * 0.5, yaw + 0.4, '#2a1d14', { layer: 3, wobble: 0.2, seed: 9, roughness: 0.12, metalness: 0.05 }));
    // the fallen log they scratch on
    const logAt = atLocal(WALLOW_FRAME, WALLOW_LOG.u, WALLOW_LOG.v);
    void env.spawnPlant('prop-fallen-log', SIZE.boomstam.h * 0.8).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.set(logAt.x, g(logAt.x, logAt.z) - 0.04, logAt.z);
      r.rotation.y = yaw + WALLOW_LOG.turn;
      this.group.add(r);
      this.spawned.push(s);
    });
    env.obstacles.push(wallowLog());

    /* -- the wallow's cover: its rim and the clumps between the north field and it -- */
    this.wallowCover = new CoverField({
      parent: this.group, groundY: g, seed: 17,
      clumps: wallowClumps().map((h) => ({ x: h.x, z: h.z, kind: h.size >= 1 ? 'bracken' as const : 'mix' as const, size: h.size })),
    });

    /* -- the three stands (each with its look-alikes and the clumps beside its way home) -- */
    this.stands = { wei: new Stand(env, 'wei', distractors), steen: new Stand(env, 'steen', distractors), berk: new Stand(env, 'berk', distractors) };

    /* -- the rooting fields: seven look-alike patches of turned earth each (small things) -- */
    const field = (f: FieldId, seed: number): PatchField => {
      const fr = fieldFrame(f);
      return new PatchField({ parent: env.detail(fr), groundY: g, spots: fieldSpotsOf(f), size: 0.95, heading: fr.heading + Math.PI, seed });
    };
    this.fields = { N: field('N', 23), S: field('S', 29) };

    /* -- a few small trotter prints in the empty marker ring, toward the way -- */
    this.ringPrints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.065).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2c1f15', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 8);
    this.ringPrints.name = 'ring-prints';
    this.ringPrints.renderOrder = 2;
    env.detail(MARKER).add(this.ringPrints);

    /* -- the clue (after): a cut fence past the wallow -- */
    this.clue = new CutFence(this.group, g, env.obstacles);

    this.layDefault();
  }

  /** This play's stand, its field, its look-alikes (what the script works with). */
  get stand(): Stand { return this.stands[this.way]; }
  get cover(): CoverField { return this.stands[this.way].cover; }
  get field(): PatchField { return this.fields[WAYS[this.way].field]; }
  get decoys(): readonly Decoy[] { return this.stands[this.way].decoys.decoys; }

  /**
   * Lay a play in (under the briefing card): the stand of its way gets the trial's
   * look-alikes on this play's spots and a window over the nook he lies in; the other
   * stands stand empty; the ring's prints point the way.
   */
  lay(way: WayId, o: { nook: number; pose: 0 | 1 | 2; trial: readonly Distractor[]; spots: readonly number[]; glimpse: number }): void {
    this.way = way;
    for (const id of WAY_IDS) if (id !== way) this.stands[id].clear();
    const st = this.stands[way];
    st.layDecoys(o.trial, o.spots);
    const win = st.openFor(o.nook, o.pose, o.glimpse);
    this.glimpse = { share: win.share, changed: win.changed };
    this.searchEye = win.eye;
    this.pointRing(way);
  }

  /** Free roam's home: run 6's stand with the content's look-alikes, the piglet in its
   *  first nook (his squeak comes from there), the ring's prints pointing north. */
  layDefault(glimpse = 0.3): void {
    const w = WAYS[DEFAULT_WAY];
    this.lay(DEFAULT_WAY, {
      nook: 0, pose: 0, trial: this.distractors, glimpse,
      spots: assignSpots(w.decoySpots.map((_, i) => i), w.decoySpots, this.distractors.map(kindOf)),
    });
  }

  /** The ring's few little prints, pointing along the way the follow goes. */
  private pointRing(way: WayId): void {
    const g = this.env.groundY;
    const h = headingTo(MARKER, WAYS[way].follow[1] ?? WAYS[way].stand);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const p = atLocal({ x: MARKER.x, z: MARKER.z, heading: h }, side * 0.035 + (i % 2 ? 0.05 : -0.05), -0.6 + i * 0.4);
        m.compose(new THREE.Vector3(p.x, g(p.x, p.z) + 0.03, p.z), q, new THREE.Vector3(1, 1, 1));
        this.ringPrints.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
      }
    }
    this.ringPrints.instanceMatrix.needsUpdate = true;
  }

  /** A clump the piglet dived into rustles (whichever cover it is in). */
  rustleNear(x: number, z: number, amp: number): void {
    for (const c of [this.wallowCover, this.cover]) {
      const cl = c.nearestClump(x, z);
      if (cl && cl.d < 1.2) { c.rustle(cl.i, amp); return; }
    }
  }

  /** The clumps a frightened piglet may dive into on this play's way (its stand, the
   *  clumps beside the way home, the wallow's). */
  hideSpots(): { x: number; z: number }[] {
    return [...this.cover.clumps.filter((q) => q.kind !== 'dead'), ...this.wallowCover.clumps].map((q) => ({ x: q.x, z: q.z }));
  }

  /** The clue drops: the cut fence fades in (under the raaf's card). */
  revealClue(secs = 1.2): void {
    this.holdClue = false; // (the mission is done: a borrowed home gets its state on release)
    this.clue.show(true, secs);
  }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: { x: number; z: number }): void { this.stand.decoys.poke(d, from); }

  setState(state: HomeState): void {
    this.ringPrints.visible = state === 'before';
    this.clue.show(state === 'after' && !this.holdClue);
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    this.wallowCover.update(dt, t, reduced, movers);
    for (const id of WAY_IDS) this.stands[id].update(dt, t, reduced, movers);
    this.fields.N.update(dt, reduced);
    this.fields.S.update(dt, reduced);
    this.clue.update(dt);
  }

  dispose(): void {
    this.wallowCover.dispose();
    for (const id of WAY_IDS) this.stands[id].dispose();
    this.fields.N.dispose();
    this.fields.S.dispose();
    this.clue.dispose();
    for (const s of this.spawned) s.dispose();
    this.ringPrints.geometry.dispose();
    (this.ringPrints.material as THREE.Material).dispose();
    this.ringPrints.removeFromParent();
    this.group.removeFromParent();
  }
}

