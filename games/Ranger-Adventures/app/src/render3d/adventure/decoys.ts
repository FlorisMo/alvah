/**
 * decoys.ts — the look-alikes a searching child may take for the hidden animal (the
 * zoeken trial's distractors, design §6), laid IN a stand of cover: a low clump of
 * rust-brown dead bracken (a 'bush'), a heath blue butterfly on a foxglove, a stonechat
 * on the tip of a dry stalk, a nightjar pressed to a bare patch at the edge. Shared by
 * the homes that hide an animal (the frisling's bracken, the reekalf's tall grass), so
 * both searches are the same game with the same look-alikes.
 *
 * A 'bush' decoy is a clump of the stand's own cover (`decoyClumps`: added to the
 * stand's clumps before its CoverField is built); the others are small models of their
 * own. A click on one gets its reaction (`poke`): the dead fronds rustle and part, the
 * bird flits up and settles, the butterfly lifts off its flower. A trial keeps only
 * its own decoys (`useDecoys`, under the briefing card).
 */

import * as THREE from 'three';
import type { Distractor } from '../../content/types';
import type { DressingEnv } from '../world/Residents';
import type { CoverField } from './cover';
import type { Clump } from './cover-math';
import { groundDecal } from './decal';
import { headingTo } from './places';
import type { Spot } from './types';
import { SIZE } from '../AnimalScale';

/** A look-alike a searching child may take for the hidden animal (a zoeken decoy). */
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

/** A content distractor at its place in the stand (world x/z). */
export interface DecoyAt extends Spot { d: Distractor }

/** The low clumps of rust-brown dead bracken the 'bush' decoys are: add them to the
 *  stand's clumps before its CoverField is built. `size`: bigger in cover that is taller
 *  than bracken's, so the brown still shows through it. */
export function decoyClumps(at: readonly DecoyAt[], size = 1): Clump[] {
  return at.filter((q) => q.d.k === 'bush').map((q) => ({ x: q.x, z: q.z, kind: 'dead' as const, size, decoy: q.d.id }));
}

/** How the look-alikes of a stand are made (run 7, all optional: the defaults are run 6's). */
export interface StandDecoyOpts {
  /** where the stonechat sits: 'stalk' (default) on the tip of a 1 m dry stalk above the
   *  fronds; 'frond' low on a short dry seed head among them (≤ 0.75 m, a light stalk): from
   *  a lens looking down on the stand a bird, never a dark stick with a dot */
  perch?: 'stalk' | 'frond';
}

/** The stonechat's perch heights (m): run 6's tall dry stalk, and run 7's seed head low
 *  among the fronds. */
const PERCH_H = { stalk: 1.05, frond: 0.68 } as const;

/** The decoys of one stand: built with the home, alive while the lens is near. */
export class StandDecoys {
  readonly decoys: Decoy[] = [];
  private readonly cover: CoverField;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly made: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly birds: { o: THREE.Object3D; base: THREE.Vector3; kind: string; t: number }[] = [];
  private readonly env: DressingEnv;
  private readonly group: THREE.Object3D;
  /** a nightjar's bare patch, per decoy id (laid again where it moves) */
  private readonly bare = new Map<string, THREE.Mesh>();
  /** the look-alikes were laid elsewhere (`relay`): a nightjar's patch goes with its bird */
  private relaid = false;

  /**
   * `group`: where they hang (the home's group); `clumps`: the stand's clumps as its
   * CoverField was built from them (the 'bush' decoys among them); `face`: where the
   * searcher stands (a bird turns side-on to him).
   */
  constructor(env: DressingEnv, group: THREE.Object3D, at: readonly DecoyAt[], cover: CoverField, clumps: readonly Clump[], face: Spot, opts: StandDecoyOpts = {}) {
    this.cover = cover;
    this.env = env;
    this.group = group;
    const g = env.groundY;
    for (const q of at) {
      if (q.d.k === 'bush') {
        const ci = clumps.findIndex((c) => c.decoy === q.d.id);
        const anchor = new THREE.Object3D();
        anchor.name = `decoy-${q.d.id}`;
        anchor.position.set(q.x, g(q.x, q.z) + 0.3, q.z);
        group.add(anchor);
        this.decoys.push({ id: q.d.id, kind: 'bush', object: anchor, clump: ci, x: q.x, z: q.z });
        continue;
      }
      const holder = new THREE.Group();
      holder.name = `decoy-${q.d.id}`;
      holder.position.set(q.x, g(q.x, q.z), q.z);
      holder.rotation.y = headingTo(q, face) + 0.9;
      group.add(holder);
      this.decoys.push({ id: q.d.id, kind: q.d.k, object: holder, clump: null, x: q.x, z: q.z });
      const add = (s: { root: unknown; dispose(): void } | null, y = 0): THREE.Object3D | null => {
        if (!s) return null;
        const r = s.root as THREE.Object3D;
        r.position.y = y;
        holder.add(r);
        this.spawned.push(s);
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
        const bare = groundDecal(g, q.x, q.z, 0.34, 0.28, 0.3, '#9a8358', { layer: 1, seed: 4, feather: true });
        group.add(bare);
        this.bare.set(q.d.id, bare);
        void env.spawnModel('nachtzwaluw', { idle: false }).then((s) => {
          const r = add(s);
          if (r) this.birds.push({ o: r, base: r.position.clone(), kind: 'ground', t: 0 });
        });
      } else {
        // a stonechat on the tip of a dry stalk above the fronds (run 7 'frond': on a short
        // dry seed head among them, a light stalk with a pale tuft)
        const low = opts.perch === 'frond';
        const stalkH = PERCH_H[opts.perch ?? 'stalk'];
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(low ? 0.006 : 0.008, low ? 0.01 : 0.014, stalkH, 5).translate(0, stalkH / 2, 0),
          new THREE.MeshStandardMaterial({ color: low ? '#c9b27c' : '#8c7a52', roughness: 1 }));
        stalk.rotation.z = 0.06;
        holder.add(stalk);
        this.made.push(stalk);
        if (low) {
          // the seed head the bird sits on: a pale, rough tuft just under its feet
          const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0).scale(1, 1.6, 1), new THREE.MeshStandardMaterial({ color: '#d8c58f', roughness: 1 }));
          head.position.set(Math.sin(0.06) * -stalkH, stalkH - 0.045, 0);
          holder.add(head);
          this.made.push(head);
        }
        void env.spawnModel(q.d.animal ?? 'roodborsttapuit', { idle: false }).then((s) => {
          const r = add(s, stalkH - 0.01);
          if (r) this.birds.push({ o: r, base: r.position.clone(), kind: 'perch', t: 0 });
        });
      }
    }
  }

  /**
   * Run 7: lay the look-alikes on other spots of the stand (a play draws where each sits,
   * under the briefing card): a 'bush' decoy takes the dead clump given for it (its old
   * clump is taken away; `useDecoys` shows the trial's), a bird or a butterfly moves its
   * holder there, turned side-on to the searcher at `face`; a nightjar's bare patch is laid
   * again under it. Decoys not named stay where they are.
   */
  relay(at: readonly { id: string; x: number; z: number; clump?: number }[], face: Spot): void {
    const g = this.env.groundY;
    this.relaid = true;
    for (const q of at) {
      const d = this.decoys.find((x) => x.id === q.id);
      if (!d) continue;
      d.x = q.x; d.z = q.z;
      if (d.clump !== null) {
        if (q.clump !== undefined && q.clump !== d.clump) { this.cover.showClump(d.clump, false); d.clump = q.clump; }
        d.object.position.set(q.x, g(q.x, q.z) + 0.3, q.z);
        continue;
      }
      d.object.position.set(q.x, g(q.x, q.z), q.z);
      d.object.rotation.y = headingTo(q, face) + 0.9;
      const old = this.bare.get(q.id);
      if (old) {
        old.removeFromParent();
        old.geometry.dispose();
        for (const m of [old.material].flat()) m.dispose();
        const bare = groundDecal(g, q.x, q.z, 0.34, 0.28, 0.3, '#9a8358', { layer: 1, seed: 4, feather: true });
        bare.visible = d.object.visible;
        this.group.add(bare);
        this.bare.set(q.id, bare);
      }
    }
  }

  /** The decoys of this trial stay; the others step out of the stand (under the briefing card). */
  useDecoys(ids: readonly string[]): void {
    for (const d of this.decoys) {
      const on = ids.includes(d.id);
      d.object.visible = on;
      if (d.clump !== null) this.cover.showClump(d.clump, on);
      const bare = this.bare.get(d.id);
      if (bare && this.relaid) bare.visible = on;
    }
  }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: Spot): void {
    if (d.clump !== null) { this.cover.rustle(d.clump, 0.16); this.cover.part(d.clump, from, 0.55, 1.4); return; }
    for (const b of this.birds) if (b.o.parent === d.object) b.t = 1.1;
  }

  /** Per frame: a poked bird flits up a little and settles again; a butterfly opens its wings. */
  update(dt: number, reduced: boolean): void {
    for (const b of this.birds) {
      if (b.t <= 0) continue;
      b.t = Math.max(0, b.t - dt);
      const k = reduced ? 0 : Math.sin((1 - b.t / 1.1) * Math.PI);
      b.o.position.set(b.base.x, b.base.y + k * (b.kind === 'ground' ? 0.12 : 0.22), b.base.z + k * 0.05);
    }
  }

  dispose(): void {
    for (const s of this.spawned) s.dispose();
    for (const m of [...this.made, ...this.bare.values()]) {
      m.geometry.dispose();
      for (const mat of [m.material].flat()) mat.dispose();
    }
  }
}
