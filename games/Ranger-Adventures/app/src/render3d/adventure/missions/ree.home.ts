/**
 * ree.home.ts — the roe's home in the world, built with the world (the THREE half of
 * ree.places.ts): the MEADOW of tall pijpenstrootje the calf lies in (with the trial's
 * look-alikes: rust-brown dead bracken, a butterfly on a foxglove, a stonechat on a
 * stalk, a nightjar at the edge), the COPSE's junipers and bracken round the doe's bed
 * (its trees are the world forest's: the adventure's `trees`), the HIDE's juniper and fallen
 * log, and the wet POOL on the way there, whose water rings when a boot goes in.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes). The
 * meadow opens a small window over the calf's back for the search's lens (cover-math
 * `openWindow`): from there its spotted back is glimpsed between the stems, never more.
 */

import * as THREE from 'three';
import type { Distractor } from '../../../content/types';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { CoverField } from '../cover';
import { backPoints, openWindow, standClumps, visibleShare, type Clump, type V3 } from '../cover-math';
import { StandDecoys, decoyClumps, type Decoy, type DecoyAt } from '../decoys';
import { groundDecal } from '../decal';
import { atLocal, dist, segDist, stream, toLocal } from '../places';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { boxObstacle } from '../../CharacterController';
import { SIZE } from '../../AnimalScale';
import { WATER_DEEP, WATER_SHALLOW, WATER_TREES, FRESNEL_POWER, WATER_F0 } from '../../Water';
import {
  juniperR, REE_PLACES, MEADOW, MEADOW_FRAME, COPSE_FRAME, CALF_SPOT, SEARCH_VIEW, JUNIPERS, COPSE_TREES, DOE_BED, CALF_BED, COPSE_GAP,
  HIDE_JUNIPER, HIDE_LOG, POOL, POOL_FRAME, MEET, onMeadow,
} from './ree.places';

/** The sky overhead that a small pool mirrors when it is seen from above (the ven, seen
 *  across, mirrors the hazy horizon and the far trees instead). */
const POOL_SKY = '#7d949a';

/** The drops a boot throws up in the pool. */
const DROPS = 9;

/** The juniper's shape: taller than the world's round bush, and slimmer. */
const JUNIPER_TALL = 1.25;
const JUNIPER_SLIM = 0.82;

/**
 * The pool's still water: the ven's fresnel mix (world/Dressing.buildVenWater, Water.ts),
 * without its shimmer — the dark peat water under a mirror of the sky overhead (seen
 * from above, as a child sees a small pool), at a grazing look the golden haze and the
 * dark band of trees. The decal's
 * feathered rim (vertex alpha) lets it meet the mud softly. In the fog like the rest.
 */
function poolWater(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDeep: { value: new THREE.Color(WATER_DEEP) },
      uShallow: { value: new THREE.Color(WATER_SHALLOW) },
      uTrees: { value: new THREE.Color(WATER_TREES) },
      uSky: { value: new THREE.Color(POOL_SKY) },
      uFresnelPower: { value: FRESNEL_POWER },
      uF0: { value: WATER_F0 },
    }]),
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 color;
      varying vec3 vWorld;
      varying float vEdge;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vEdge = color.a;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uTrees;
      uniform vec3 uSky;
      uniform float uFresnelPower;
      uniform float uF0;
      varying vec3 vWorld;
      varying float vEdge;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = uF0 + (1.0 - uF0) * pow(clamp(1.0 - max(viewDir.y, 0.0), 0.0, 1.0), uFresnelPower);
        vec3 mirrored = mix(uTrees, uShallow, smoothstep(0.07, 0.24, viewDir.y));
        // a steeper look (a small pool is seen from above) mirrors the sky overhead: blue
        mirrored = mix(mirrored, uSky, smoothstep(0.1, 0.32, viewDir.y));
        vec3 col = mix(uDeep, mirrored, clamp(fres * 1.3, 0.0, 0.8));
        gl_FragColor = vec4(col, 0.95 * smoothstep(0.0, 0.45, vEdge));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

/** A water ring spreading on the pool (a boot went in). */
interface Ring { mesh: THREE.Mesh; t: number; delay: number }

/** The reekalf home, as the adventure uses it. */
export class ReeHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** the meadow's tall grass, the copse's bracken, the rushes at the pool: one field */
  readonly cover: CoverField;
  /** the stems a lens at the search's eye sees the calf's back past (stats) */
  readonly glimpse: { share: number; changed: number };
  readonly searchEye: V3;
  /** the copse's bracken clump nearest its gap (it rustles before she steps out) */
  readonly gapClump: number;
  private readonly lookAlikes: StandDecoys;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly made: THREE.Mesh[] = [];
  private readonly rings: Ring[] = [];
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly drops: THREE.InstancedMesh;
  private dropT = -1;
  private readonly dropAt = new THREE.Vector3();
  private readonly groundY: (x: number, z: number) => number;

  constructor(env: DressingEnv, distractors: readonly Distractor[]) {
    this.group.name = 'ree-home';
    env.parent.add(this.group);
    const g = env.groundY;
    this.groundY = g;
    const rnd = stream(41);

    /* -- the meadow: tall pijpenstrootje tussocks, a few with bracken, the calf in it -- */
    const calf = CALF_SPOT;
    const decoyAt: DecoyAt[] = distractors.map((d) => ({ d, ...onMeadow(d.x, d.y) }));
    const keep = (u: number, v: number): boolean => {
      const p = atLocal(MEADOW_FRAME, u, v);
      if (dist(p, calf) < 0.4) return false;                             // its own spot
      return !decoyAt.some((q) => dist(p, q) < (q.d.k === 'bush' ? 0.45 : 0.4)); // a decoy's own spot
    };
    const meadow = standClumps(MEADOW_FRAME, MEADOW.halfW + 0.45, MEADOW.halfD + 0.4, 0.46, 53, keep)
      .map((c): Clump => ({ ...c, kind: 'grass', size: 1.12 + rnd() * 0.18 })); // pijpenstrootje, no bracken
    // its hiding place: tussocks close round it, one arching over its rump
    const cl = toLocal(MEADOW_FRAME, calf);
    for (const [u, v, s] of [[-0.46, 0.2, 1.2], [0.48, 0.18, 1.25], [0.02, 0.5, 1.3], [-0.3, -0.38, 1.15], [0.36, -0.34, 1.1]] as const) {
      meadow.push({ ...atLocal(MEADOW_FRAME, cl.u + u, cl.v + v), kind: 'grass', size: s });
    }
    // a looser fringe round the meadow: it thins out into the heath, not a hard edge
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
      const k = 1.12 + rnd() * 0.35;
      const p = atLocal(MEADOW_FRAME, Math.cos(a) * (MEADOW.halfW + 0.45) * k, Math.sin(a) * (MEADOW.halfD + 0.4) * k);
      if (dist(p, REE_PLACES.meadowApproach) < 1.1 || dist(p, REE_PLACES.calfTalk) < 0.8) continue; // where he stands
      // where mother and calf meet stays open, and so does the hide's view of it
      if (dist(p, MEET) < 1.9 || segDist(p, REE_PLACES.hide, MEET) < 0.9) continue;
      meadow.push({ ...p, kind: 'grass', size: 0.8 + rnd() * 0.3 });
    }
    // (the dead bracken look-alikes stand a little taller than in the frisling's bracken:
    // their rust-brown must show between the tall grass like the calf's back does)
    const clumps: Clump[] = [...meadow, ...decoyClumps(decoyAt, 1.45)];

    /* -- the copse: bracken round the junipers and the trunks, her bed kept free -- */
    const junipers = JUNIPERS.map((j) => ({ ...atLocal(COPSE_FRAME, j.u, j.v), h: j.h, turn: j.turn }));
    const bedPath = [COPSE_GAP, DOE_BED];
    for (const c of standClumps(COPSE_FRAME, 3.9, 3.1, 0.72, 67)) {
      if (junipers.some((j) => dist(c, j) < 0.55 + j.h * 0.22)) continue;
      if (COPSE_TREES.some((t) => dist(c, t) < 0.5)) continue;
      if (dist(c, DOE_BED) < 0.7 || dist(c, CALF_BED) < 0.55) continue;
      if (dist(c, REE_PLACES.graze) < 1.4) continue; // where she grazes stays open heath
      const lp = toLocal(COPSE_FRAME, c);
      if (lp.v > 2.6) continue; // the gap's side stays open
      const onPath = bedPath.some((q) => dist(c, q) < 0.45);
      clumps.push({ ...c, kind: onPath ? 'bracken' : rnd() < 0.8 ? 'bracken' : 'mix', size: 1.0 + rnd() * 0.25 });
    }

    /* -- rushes at the pool's rim (not in the water, not on his way round) -- */
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.35;
      if (Math.cos(a) > 0.55) continue; // the side he walks round stays clear
      const p = atLocal(POOL_FRAME, Math.cos(a) * (POOL.halfW + 0.3), Math.sin(a) * (POOL.halfD + 0.3));
      if (Math.abs(toLocal(POOL_FRAME, p).u) < 0.7) continue; // his straight way in and out
      clumps.push({ ...p, kind: 'grass', size: 0.72 + rnd() * 0.15 });
    }

    this.cover = new CoverField({ parent: this.group, groundY: g, clumps, seed: 29 });
    this.gapClump = this.cover.nearestClump(COPSE_GAP.x, COPSE_GAP.z, (c) => c.kind !== 'grass')?.i ?? 0;

    // the glimpse window: from the search's lens, a little of the calf's back shows
    const lens = env.lensFor(SEARCH_VIEW);
    this.searchEye = lens.cam;
    const lyH = lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf);
    const back = backPoints(calf.x, g(calf.x, calf.z), calf.z, calf.yaw, SIZE.reekalf.len, lyH);
    const changed = openWindow(this.cover.stems, lens.cam, back, 0.3);
    this.cover.refresh();
    this.glimpse = { share: visibleShare(back, lens.cam, this.cover.stems), changed: changed.length };

    /* -- the look-alikes in the meadow (adventure/decoys.ts) -- */
    this.lookAlikes = new StandDecoys(env, this.group, decoyAt, this.cover, clumps, REE_PLACES.meadowApproach);

    /* -- the junipers: the copse's three, and the hide's -- */
    const bush = (x: number, z: number, h: number, turn: number): void => {
      // a Veluwe juniper grows up more than out: the world's round bush, drawn slimmer
      void env.spawnPlant('prop-juniper-bush', h / JUNIPER_TALL).then((s) => {
        if (!s) return;
        const r = s.root as THREE.Object3D;
        r.position.set(x, g(x, z) - 0.03, z);
        r.rotation.y = turn;
        r.scale.multiply(new THREE.Vector3(JUNIPER_SLIM, JUNIPER_TALL, JUNIPER_SLIM));
        this.group.add(r);
        this.spawned.push(s);
      });
      env.obstacles.push({ x, z, r: juniperR(h) });
    };
    for (const j of junipers) bush(j.x, j.z, j.h, j.turn);
    bush(HIDE_JUNIPER.x, HIDE_JUNIPER.z, HIDE_JUNIPER.h, 1.3);

    /* -- the hide's fallen log, lying across in front of where he stands -- */
    void env.spawnPlant('prop-fallen-log', SIZE.boomstam.h * 0.9).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.set(HIDE_LOG.x, g(HIDE_LOG.x, HIDE_LOG.z) - 0.04, HIDE_LOG.z);
      r.rotation.y = HIDE_LOG.turn;
      this.group.add(r);
      this.spawned.push(s);
    });
    env.obstacles.push(boxObstacle(HIDE_LOG.x, HIDE_LOG.z, HIDE_LOG.half, 0.24, HIDE_LOG.turn, 0.25));

    /* -- the wet pool: a muddy rim, dark still water that takes the sky's light -- */
    const pool = (rx: number, rz: number, color: string, o: Parameters<typeof groundDecal>[7]): void => {
      const m = groundDecal(g, POOL.x, POOL.z, rx, rz, POOL.heading + Math.PI / 2, color, o);
      this.group.add(m);
      this.made.push(m);
    };
    pool(POOL.halfW + 0.55, POOL.halfD + 0.45, '#5f4d34', { layer: 1, wobble: 0.18, seed: 7, feather: true });
    pool(POOL.halfW + 0.12, POOL.halfD + 0.1, '#4a3e2c', { layer: 2, wobble: 0.14, seed: 11, roughness: 0.4, feather: true });
    // the water: the ven's own still water (dark peat teal near, the evening sky and the
    // far bank's trees mirrored at a grazing look), fading into its muddy rim
    const water = groundDecal(g, POOL.x, POOL.z, POOL.halfW, POOL.halfD, POOL.heading + Math.PI / 2, '#ffffff', { layer: 3, wobble: 0.12, seed: 11, feather: true });
    (water.material as THREE.Material).dispose();
    water.material = poolWater();
    this.group.add(water);
    this.made.push(water);
    // what a boot in the water makes: rings spreading one after the other, and a few
    // drops thrown up that fall back (calm and small: a plash, not a splash)
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#eef3ee', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), this.ringMat.clone());
      mesh.visible = false;
      mesh.renderOrder = 5;
      mesh.rotation.y = POOL.heading; // (its x across the pool, its z along it)
      this.group.add(mesh);
      this.rings.push({ mesh, t: -1, delay: i * 0.3 });
    }
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#e4ecea' }), DROPS);
    this.drops.visible = false;
    this.drops.renderOrder = 5;
    this.group.add(this.drops);
  }

  /** The trial's look-alikes in the meadow. */
  get decoys(): readonly Decoy[] { return this.lookAlikes.decoys; }

  /** The decoys of this trial stay; the others step out of the meadow (under the briefing card). */
  useDecoys(ids: readonly string[]): void { this.lookAlikes.useDecoys(ids); }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: { x: number; z: number }): void { this.lookAlikes.poke(d, from); }

  /** A boot in the pool at (x, z): rings spread over the water, a few drops fly up. */
  splash(x: number, z: number): void {
    const y = this.groundY(x, z) + 0.08; // just over the water (its decal layer)
    for (const r of this.rings) {
      r.t = 0;
      r.mesh.position.set(x, y, z);
    }
    this.dropT = 0;
    this.dropAt.set(x, y, z);
  }

  setState(_state: HomeState): void { /* the meadow, the copse and the pool stay */ }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    this.cover.update(dt, t, reduced, movers);
    this.lookAlikes.update(dt, reduced);
    for (const r of this.rings) {
      if (r.t < 0) continue;
      r.t += dt;
      const k = (r.t - r.delay) / 1.8;
      const m = r.mesh.material as THREE.MeshBasicMaterial;
      if (k < 0) { r.mesh.visible = false; continue; }
      if (k >= 1 || reduced) { r.t = -1; r.mesh.visible = false; m.opacity = 0; continue; }
      r.mesh.visible = true;
      const e = 1 - (1 - k) * (1 - k); // fast at first, slowing as it spreads
      // (they stay on the water: the pool is longer across than along, and the boot
      // went in a little short of its middle)
      const s = 0.1 + e * 0.62;
      r.mesh.scale.set(s, 1, s * 0.72);
      m.opacity = 0.8 * (1 - k);
    }
    if (this.dropT >= 0) {
      this.dropT += dt;
      const T = this.dropT;
      if (T > 0.7 || reduced) { this.dropT = -1; this.drops.visible = false; } else {
        this.drops.visible = true;
        const m = new THREE.Matrix4();
        for (let i = 0; i < DROPS; i++) {
          const a = (i / DROPS) * Math.PI * 2 + i * 0.7;
          const out = 0.35 + (i % 3) * 0.12, up = 1.3 + (i % 4) * 0.18;
          const h = Math.max(0, up * T - 4.9 * T * T);
          m.makeTranslation(this.dropAt.x + Math.cos(a) * out * T, this.dropAt.y + h, this.dropAt.z + Math.sin(a) * out * T);
          this.drops.setMatrixAt(i, h > 0 || T < 0.05 ? m : m.makeScale(0, 0, 0));
        }
        this.drops.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    this.cover.dispose();
    this.lookAlikes.dispose();
    for (const s of this.spawned) s.dispose();
    for (const m of this.made) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    for (const r of this.rings) { r.mesh.geometry.dispose(); (r.mesh.material as THREE.Material).dispose(); }
    this.ringMat.dispose();
    this.drops.geometry.dispose();
    (this.drops.material as THREE.Material).dispose();
    this.drops.dispose();
    this.group.removeFromParent();
  }
}
