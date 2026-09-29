/**
 * frisling.home.ts — the rotte's home in the world, built with the world (the THREE
 * half of frisling.places.ts): the muddy WALLOW with its fallen log and bracken rim,
 * the STAND of bracken and pijpenstrootje the lost piglet lies in (with the look-alike
 * things a searching child may take for him: rust-brown dead fronds, a butterfly on a
 * foxglove, a stonechat on a stalk, a nightjar at the edge), loose clumps along the
 * way home, the ROOTING FIELD's seven patches of turned earth, and a few small
 * trotter prints in the empty marker ring.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes); only
 * the ring's little prints go once he is home. The stand opens a small window over the
 * piglet's back for the search's lens (cover-math `openWindow`): from there his stripes
 * are glimpsed between the stems, never more.
 */

import * as THREE from 'three';
import type { Distractor } from '../../../content/types';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { CoverField } from '../cover';
import { backPoints, openWindow, standClumps, visibleShare, type Clump, type V3 } from '../cover-math';
import { PatchField } from '../patches';
import { groundDecal } from '../decal';
import { atLocal, dist, toLocal, headingTo } from '../places';
import { patchLocal } from '../../play/kit-math';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { boxObstacle } from '../../CharacterController';
import { CutFence } from './frisling.clue';
import { SIZE } from '../../AnimalScale';
import {
  FRISLING_PLACES, STAND, STAND_FRAME, WALLOW, WALLOW_FRAME, WALLOW_LOG, FIELD_FRAME, LOST_SPOT, SEARCH_VIEW,
  fieldSpots, hideClumps, onStand, MARKER,
} from './frisling.places';

/** A look-alike a searching child may take for the piglet (a zoeken decoy). */
export interface Decoy {
  /** the content distractor id ('d1', 'v1', 'b1' ...) */
  id: string;
  kind: string;
  /** what a click finds: its visible thing (a bird, a butterfly's flower) */
  object: THREE.Object3D;
  /** for a clump of dead bracken: its clump in the cover (it rustles and parts) */
  clump: number | null;
  x: number; z: number;
}

/** The frisling home, as the adventure uses it. */
export class FrislingHome implements HomeDressing {
  readonly group = new THREE.Group();
  readonly cover: CoverField;
  readonly field: PatchField;
  readonly decoys: Decoy[] = [];
  /** the stems a lens at the search's eye sees the piglet's back past (stats) */
  readonly glimpse: { share: number; changed: number };
  /** the eye the stand's window was opened for */
  readonly searchEye: V3;
  private readonly ringPrints: THREE.InstancedMesh;
  /** the season's first clue (after): the cut fence past the wallow, boot prints through it */
  readonly clue: CutFence;
  /** while the adventure plays, the clue waits for its moment (`revealClue`), never
   *  appearing in the reunion's view */
  holdClue = false;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly decoyParts: Map<string, THREE.Object3D[]> = new Map();
  private readonly birds: { o: THREE.Object3D; base: THREE.Vector3; kind: string; t: number }[] = [];
  private clock = 0;

  constructor(env: DressingEnv, distractors: readonly Distractor[]) {
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
    env.obstacles.push(boxObstacle(logAt.x, logAt.z, 0.85, 0.22, yaw + WALLOW_LOG.turn, 0.25));

    /* -- the cover: the stand, the loose clumps on the way home, the wallow's rim -- */
    const lost = LOST_SPOT;
    const decoyAt = distractors.map((d) => ({ d, ...onStand(d.x, d.y) }));
    const keep = (u: number, v: number): boolean => {
      const p = atLocal(STAND_FRAME, u, v);
      if (dist(p, lost) < 0.36) return false;                           // his own spot
      return !decoyAt.some((q) => dist(p, q) < (q.d.k === 'bush' ? 0.45 : 0.4)); // a decoy's own spot
    };
    const clumps: Clump[] = standClumps(STAND_FRAME, STAND.halfW + 0.45, STAND.halfD + 0.4, 0.52, 71, keep);
    // his hiding place: tussocks close round him, a frond arching over his rump
    for (const [u, v, kind] of [[-0.42, 0.18, 'grass'], [0.44, 0.22, 'mix'], [0.05, 0.46, 'bracken'], [-0.3, -0.36, 'grass']] as const) {
      const lp = toLocal(STAND_FRAME, lost);
      clumps.push({ ...atLocal(STAND_FRAME, lp.u + u, lp.v + v), kind, size: 0.95 });
    }
    // the dead bracken decoys (rust-brown, low: the child may take one for the piglet)
    for (const q of decoyAt) if (q.d.k === 'bush') clumps.push({ x: q.x, z: q.z, kind: 'dead', size: 1, decoy: q.d.id });
    for (const h of hideClumps()) clumps.push({ x: h.x, z: h.z, kind: h.size >= 1 ? 'bracken' : 'mix', size: h.size });
    this.cover = new CoverField({ parent: this.group, groundY: g, clumps, seed: 17 });

    // the glimpse window: from the search's lens, a little of his back shows
    const lens = env.lensFor(SEARCH_VIEW);
    this.searchEye = lens.cam;
    const lyH = lyingHeight(heightFor('frisling'), LEG_SHARE.frisling);
    const back = backPoints(lost.x, g(lost.x, lost.z), lost.z, lost.yaw, SIZE.frisling.len, lyH);
    const changed = openWindow(this.cover.stems, lens.cam, back, 0.3);
    this.cover.refresh();
    this.glimpse = { share: visibleShare(back, lens.cam, this.cover.stems), changed: changed.length };

    /* -- the other decoys: a butterfly on a foxglove, a stonechat on a stalk, a nightjar -- */
    for (const q of decoyAt) {
      if (q.d.k === 'bush') {
        const ci = clumps.findIndex((c) => c.decoy === q.d.id);
        const anchor = new THREE.Object3D();
        anchor.name = `decoy-${q.d.id}`;
        anchor.position.set(q.x, g(q.x, q.z) + 0.3, q.z);
        this.group.add(anchor);
        this.decoys.push({ id: q.d.id, kind: 'bush', object: anchor, clump: ci, x: q.x, z: q.z });
        continue;
      }
      const holder = new THREE.Group();
      holder.name = `decoy-${q.d.id}`;
      holder.position.set(q.x, g(q.x, q.z), q.z);
      holder.rotation.y = headingTo(q, FRISLING_PLACES.coverApproach) + 0.9;
      this.group.add(holder);
      this.decoys.push({ id: q.d.id, kind: q.d.k, object: holder, clump: null, x: q.x, z: q.z });
      const parts: THREE.Object3D[] = [];
      this.decoyParts.set(q.d.id, parts);
      const add = (s: { root: unknown; dispose(): void } | null, y = 0): THREE.Object3D | null => {
        if (!s) return null;
        const r = s.root as THREE.Object3D;
        r.position.y = y;
        holder.add(r);
        this.spawned.push(s);
        parts.push(r);
        return r;
      };
      if (q.d.k === 'butterfly') {
        void env.spawnPlant('prop-foxglove', SIZE.vingerhoedskruid.h * 0.85).then((s) => add(s));
        void env.spawnModel(q.d.animal ?? 'heideblauwtje', { idle: false }).then((s) => {
          const r = add(s, SIZE.vingerhoedskruid.h * 0.62);
          if (r) { r.position.x = 0.07; this.birds.push({ o: r, base: r.position.clone(), kind: 'butterfly', t: 0 }); }
        });
      } else if (q.d.animal === 'nachtzwaluw') {
        // on a little bare patch at the stand's edge, pressed to the ground
        this.group.add(groundDecal(g, q.x, q.z, 0.34, 0.28, 0.3, '#9a8358', { layer: 1, seed: 4, feather: true }));
        void env.spawnModel('nachtzwaluw', { idle: false }).then((s) => {
          const r = add(s);
          if (r) this.birds.push({ o: r, base: r.position.clone(), kind: 'ground', t: 0 });
        });
      } else {
        // a stonechat on the tip of a dry stalk above the fronds
        const stalkH = 1.05;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, stalkH, 5).translate(0, stalkH / 2, 0),
          new THREE.MeshStandardMaterial({ color: '#8c7a52', roughness: 1 }));
        stalk.rotation.z = 0.06;
        holder.add(stalk);
        parts.push(stalk);
        void env.spawnModel(q.d.animal ?? 'roodborsttapuit', { idle: false }).then((s) => {
          const r = add(s, stalkH - 0.01);
          if (r) this.birds.push({ o: r, base: r.position.clone(), kind: 'perch', t: 0 });
        });
      }
    }

    /* -- the rooting field: seven look-alike patches of turned earth -- */
    this.field = new PatchField({ parent: this.group, groundY: g, spots: fieldSpots(), size: 0.95, heading: FIELD_FRAME.heading + Math.PI, seed: 23 });

    /* -- a few small trotter prints in the empty marker ring, toward the stand -- */
    const n = 4;
    this.ringPrints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.065).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2c1f15', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n * 2);
    this.ringPrints.name = 'ring-prints';
    const h = headingTo(MARKER, FRISLING_PLACES.cover);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        const p = atLocal({ x: MARKER.x, z: MARKER.z, heading: h }, side * 0.035 + (i % 2 ? 0.05 : -0.05), -0.6 + i * 0.4);
        m.compose(new THREE.Vector3(p.x, g(p.x, p.z) + 0.03, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h), new THREE.Vector3(1, 1, 1));
        this.ringPrints.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
      }
    }
    this.ringPrints.instanceMatrix.needsUpdate = true;
    this.ringPrints.renderOrder = 2;
    this.group.add(this.ringPrints);

    /* -- the clue (after): a cut fence past the wallow -- */
    this.clue = new CutFence(this.group, g, env.obstacles);
  }

  /** The clue drops: the cut fence fades in (under the raaf's card). */
  revealClue(secs = 1.2): void {
    this.holdClue = false; // (the mission is done: a borrowed home gets its state on release)
    this.clue.show(true, secs);
  }

  /** The decoys of this trial stay; the others step out of the stand (under the briefing card). */
  useDecoys(ids: readonly string[]): void {
    for (const d of this.decoys) {
      const on = ids.includes(d.id);
      d.object.visible = on;
      if (d.clump !== null) this.cover.showClump(d.clump, on);
    }
  }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: { x: number; z: number }): void {
    if (d.clump !== null) { this.cover.rustle(d.clump, 0.16); this.cover.part(d.clump, from, 0.55, 1.4); return; }
    for (const b of this.birds) if (b.o.parent === d.object) b.t = 1.1;
  }

  setState(state: HomeState): void {
    this.ringPrints.visible = state === 'before';
    this.clue.show(state === 'after' && !this.holdClue);
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    this.clock += dt;
    this.cover.update(dt, t, reduced, movers);
    this.field.update(dt, reduced);
    this.clue.update(dt);
    // a poked bird flits up a little and settles again; a butterfly opens its wings
    for (const b of this.birds) {
      if (b.t <= 0) continue;
      b.t = Math.max(0, b.t - dt);
      const k = reduced ? 0 : Math.sin((1 - b.t / 1.1) * Math.PI);
      b.o.position.set(b.base.x, b.base.y + k * (b.kind === 'ground' ? 0.12 : 0.22), b.base.z + k * 0.05);
    }
  }

  dispose(): void {
    this.cover.dispose();
    this.field.dispose();
    this.clue.dispose();
    for (const s of this.spawned) s.dispose();
    this.ringPrints.geometry.dispose();
    (this.ringPrints.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}

/** The patch of the stand a 2D trial point lands on (exported for the tests). */
export function standPoint(x: number, y: number): { u: number; v: number } {
  return patchLocal(x, y, STAND.halfW, STAND.halfD);
}
