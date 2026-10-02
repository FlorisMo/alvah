/**
 * ree.home.ts — the roe's home in the world, built with the world (the THREE half of
 * ree.places.ts): the THREE stands of tall pijpenstrootje a calf may lie in (each with its
 * look-alikes: rust-brown dead bracken, a butterfly on a foxglove, a stonechat on a stalk,
 * a nightjar at the edge), the COPSE's junipers and bracken round the doe's bed (its trees
 * are the world forest's: the adventure's `trees`), the juniper THICKET out on the heath
 * (her cover in layout C), each layout's HIDE (a juniper and a fallen log), her trodden
 * path (wissel) of the layout played, and the wet POOL on this play's way, whose water
 * rings when a boot goes in.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes). Run 7:
 * every play lays its own morning under the briefing card (`layPlay`): the grass of every
 * stand stands as built again, the calf's stand opens a small window over its back for
 * the search's lens (cover-math `openWindow`: its spotted back glimpsed between the stems,
 * never more), the trial's look-alikes stand in that stand, the pool lies on this play's
 * way and her path is worn where this play's prints run.
 */

import * as THREE from 'three';
import type { Distractor } from '../../../content/types';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { CoverField, moorGrassGeometry } from '../cover';
import { backPoints, openWindow, standClumps, visibleShare, type Clump, type V3 } from '../cover-math';
import { StandDecoys, decoyClumps, type Decoy, type DecoyAt } from '../decoys';
import { groundDecal, groundStrip } from '../decal';
import { atLocal, dist, segDist, stream, toLocal } from '../places';
import { heightFor } from '../../play/spawn';
import { lodGeometries, lodMaterial } from '../../Lod';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { boxObstacle } from '../../CharacterController';
import { SIZE } from '../../AnimalScale';
import { WATER_DEEP, WATER_SHALLOW, WATER_TREES, FRESNEL_POWER, WATER_F0 } from '../../Water';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import type { ReeLayoutId } from './ree.variety';
import {
  juniperR, REE_LAYOUTS, LAYOUTS, FRINGE, COPSE, THICKET, COPSE_TREES, DOE_BED, CALF_BED, CALF_DOELEN, POOL, WISSEL_HALF,
  REE_RESIDENTS, calfAt, calfTalkOf, onStand, wisselLine, type Cover, type PoolSpot, type ReeLayout,
} from './ree.places';

/** The sky overhead that a small pool mirrors when it is seen from above (the ven, seen
 *  across, mirrors the hazy horizon and the far trees instead). */
const POOL_SKY = '#7d949a';

/** Her wissel's worn sand: paler than the heath's peat, so the path reads from the ring. */
const WISSEL_SAND = '#a8957a';

/** The drops a boot throws up in the pool. */
const DROPS = 9;

/** The juniper's shape: taller than the world's round bush, and slimmer. */
const JUNIPER_TALL = 1.25;
const JUNIPER_SLIM = 0.82;

/** Beyond this far (m) from the lens a juniper or a log draws a lighter copy, and beyond
 *  `FAR_COPY_M` its lightest (a view across the heath holds the copse's, the thicket's and
 *  the hides' eight junipers and three logs: drawn whole they were ~140k triangles, a
 *  quarter of the home's share of the hide walks and the watch turn, review r1). */
const MID_COPY_M = 7.5;
const FAR_COPY_M = 16;
/** The light copies are made this long (ms) after the home is built, one per idle moment. */
const FAR_COPY_AFTER_MS = 4000;
/** The copies' triangles, near and far (the real juniper has ~12.4k, the log ~11k). */
const MID_JUNIPER_TRIS = 3600;
const MID_LOG_TRIS = 2600;
const FAR_JUNIPER_TRIS = 1800;
const FAR_LOG_TRIS = 1200;
/** The light copies lose the model's normal-map shading: this brings their colour back
 *  to the real one's apparent tone (as the forest's far trees, world/Forest LOD_TONE). */
const FAR_TONE = 0.86;

/** The leaves of a tussock in a stand that is not this play's (a whole one has 52; a
 *  stand not played is only ever seen across the heath, 10-25 m off). */
const LIGHT_BLADES = 8;

/** The share of the calf's back the search's lens glimpses between the stems (run 7: P1's
 *  fixed value; the level's knob from ree-growth on). */
export const SEARCH_GLIMPSE = 0.35;

/** The tussocks close round every spot a calf may lie in (u, v off the spot in its stand's
 *  frame, size): one arching over its rump. Every spot gets the same ring, so the cover
 *  never marks the real one. */
const RING: readonly (readonly [number, number, number])[] = [[-0.46, 0.2, 1.2], [0.48, 0.18, 1.25], [0.02, 0.5, 1.3], [-0.3, -0.38, 1.15], [0.36, -0.34, 1.1]];

/**
 * The pool's still water: the ven's fresnel mix (world/Dressing.buildVenWater, Water.ts),
 * without its shimmer — the dark peat water under a mirror of the sky overhead (seen
 * from above, as a child sees a small pool), at a grazing look the golden haze and the
 * dark band of trees. The decal's feathered rim (vertex alpha) lets it meet the mud
 * softly. In the fog like the rest.
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
interface Ring { mesh: THREE.Mesh; t: number; delay: number; max: number }

/** One pool spot: its meshes (the muddy rim, the mud, the water) and the rushes at its rim
 *  (clumps of the cover field nearest to it). */
interface PoolBuilt { spot: PoolSpot; field: CoverField; meshes: THREE.Mesh[]; rushes: number[] }

/** What a play lays (ree.ts `prepare`). */
export interface ReeLaid {
  layout: ReeLayout;
  /** the calf's spot (world, lying) */
  calf: { x: number; z: number; yaw: number };
  pool: 'in' | 'out';
  /** the trial's look-alikes (content ids) */
  decoys: readonly string[];
  /** how much of the calf's back the search's lens glimpses */
  glimpse: number;
}

/** The reekalf home, as the adventure uses it. */
export class ReeHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** each stand's tall grass is its own field, and the covers' bracken one more (the
   *  rushes at each pool in the field nearest it): a field out of the picture is not
   *  drawn (one field over all three stands drew every stand whenever one was in view) */
  private readonly standCovers = new Map<ReeLayoutId, CoverField>();
  private readonly coverFields = new Map<Cover, CoverField>();
  /** the stems a lens at the search's eye sees the calf's back past (stats) */
  glimpse: { share: number; changed: number } = { share: 0, changed: 0 };
  searchEye: V3 = { x: 0, y: 0, z: 0 };
  /** the play laid now (the free-roam default until the first briefing) */
  laid: ReeLaid;
  private readonly stands = new Map<ReeLayoutId, StandDecoys>();
  private readonly gapClumps = new Map<ReeLayoutId, number>();
  private readonly pools = new Map<string, PoolBuilt>();
  private readonly wissels = new Map<ReeLayoutId, THREE.Mesh>();
  /** a stand that is not this play's draws its tussocks lighter (fewer leaves each: it is
   *  only ever seen across the heath this play); the played stand is always whole */
  private readonly fullTussock = new Map<ReeLayoutId, THREE.BufferGeometry>();
  private readonly lightTussock = moorGrassGeometry(29, LIGHT_BLADES);
  /** every stand's stems as they were built (a play's glimpse window is opened from these) */
  private readonly built = new Map<ReeLayoutId, { h: number; lx: number; lz: number; r: number }[]>();
  private readonly spawned: { dispose(): void }[] = [];
  /** the far copies' material (vertex colours, its own: a home's rest fades it) and the
   *  height each kind's copy was baked at */
  private readonly farMat = lodMaterial().clone();
  private readonly farRef = new Map<string, number>();
  private readonly farJobs: (() => void)[] = [];
  private farPending = false;
  private disposed = false;
  private readonly made: THREE.Mesh[] = [];
  private readonly rings: Ring[] = [];
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly drops: THREE.InstancedMesh;
  private dropT = -1;
  private readonly dropAt = new THREE.Vector3();
  private readonly groundY: (x: number, z: number) => number;
  private readonly env: DressingEnv;
  private readonly distractors: readonly Distractor[];
  /** the ranger is wading in the pool (and how long since his last plash) */
  private wading = false;
  private wadeT = 0;

  constructor(env: DressingEnv, distractors: readonly Distractor[]) {
    this.group.name = 'ree-home';
    env.parent.add(this.group);
    this.env = env;
    this.distractors = distractors;
    const g = env.groundY;
    this.groundY = g;
    const rnd = stream(41);
    /** each stand's clumps, and each cover's */
    const standClumps_ = new Map<ReeLayoutId, Clump[]>();
    // (the copse's and the thicket's bracken are one field: the thicket is small, and a
    // field of its own would cost three more draw calls wherever both are in view)
    const bracken: Clump[] = [];
    const coverClumps = new Map<Cover, Clump[]>([[COPSE, bracken], [THICKET, bracken]]);
    const decoysAt = new Map<ReeLayoutId, DecoyAt[]>();

    /* -- the stands: tall pijpenstrootje tussocks, a ring round every calf spot -- */
    LAYOUTS.forEach((l, li) => {
      const spots = CALF_DOELEN.map((d) => calfAt(l, d));
      const decoyAt: DecoyAt[] = distractors.map((d) => ({ d, ...onStand(l, d.x, d.y) }));
      decoysAt.set(l.id, decoyAt);
      const keep = (u: number, v: number): boolean => {
        const p = atLocal(l.frame, u, v);
        if (spots.some((s) => dist(p, s) < 0.4)) return false;                  // a calf's own spot
        return !decoyAt.some((q) => dist(p, q) < (q.d.k === 'bush' ? 0.45 : 0.4)); // a decoy's own spot
      };
      const stand = standClumps(l.frame, FRINGE.a, FRINGE.b, 0.46, 53 + li * 17, keep)
        .map((c): Clump => ({ ...c, kind: 'grass', size: 1.12 + rnd() * 0.18 })); // pijpenstrootje, no bracken
      // the hiding places: tussocks close round every spot, one arching over its rump
      for (const s of spots) {
        const sl = toLocal(l.frame, s);
        for (const [u, v, k] of RING) stand.push({ ...atLocal(l.frame, sl.u + u, sl.v + v), kind: 'grass', size: k });
      }
      // a looser fringe round the stand: it thins out into the heath, not a hard edge
      const talks = spots.map((s) => calfTalkOf(l, s));
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
        const k = FRINGE.kMin + rnd() * (FRINGE.kMax - FRINGE.kMin);
        const p = atLocal(l.frame, Math.cos(a) * FRINGE.a * k, Math.sin(a) * FRINGE.b * k);
        if (dist(p, l.search) < 1.1 || talks.some((t) => dist(p, t) < 0.8)) continue; // where he stands
        // where mother and calf meet stays open, and so does the hide's view of it
        if (dist(p, l.meet) < 1.9 || segDist(p, l.hide, l.meet) < 0.9) continue;
        if (l.way.slice(1).some((q, j) => segDist(p, l.way[j], q) < 0.6)) continue; // his way round
        stand.push({ ...p, kind: 'grass', size: 0.8 + rnd() * 0.3 });
      }
      // (the dead bracken look-alikes stand a little taller than in the frisling's bracken:
      // their rust-brown must show between the tall grass like the calf's back does)
      standClumps_.set(l.id, [...stand, ...decoyClumps(decoyAt, 1.45)]);
    });

    /* -- the copse: bracken round the junipers and the trunks, her beds and gaps kept free -- */
    const beds = [DOE_BED, CALF_BED, ...LAYOUTS.filter((l) => l.cover === COPSE).map((l) => l.bed)];
    const grazes = [REE_RESIDENTS.find((r) => r.key === 'doe')!.before!, ...LAYOUTS.flatMap((l) => l.graze)];
    const bedPaths = LAYOUTS.filter((l) => l.cover === COPSE).map((l) => [l.gap, l.bed] as const);
    const brackenOf = (c: Cover, seed: number, trees: readonly { x: number; z: number }[]): void => {
      const clumps = coverClumps.get(c)!;
      for (const q of standClumps(c.frame, c.a, c.b, 0.72, seed)) {
        if (c.junipers.some((j) => dist(q, j) < 0.55 + j.h * 0.22)) continue;
        if (trees.some((t) => dist(q, t) < 0.5)) continue;
        if (beds.some((b) => dist(q, b) < 0.7)) continue;
        if (grazes.some((p) => dist(q, p) < 1.4)) continue; // where she grazes stays open heath
        const lp = toLocal(c.frame, q);
        if (c === COPSE && lp.v > 2.6) continue; // the west gap's side stays open
        const gaps = LAYOUTS.filter((l) => l.cover === c).map((l) => l.gap);
        if (gaps.some((p) => dist(q, p) < 0.75)) continue; // her gaps
        const onPath = bedPaths.some(([a, b]) => segDist(q, a, b) < 0.45);
        clumps.push({ ...q, kind: onPath ? 'bracken' : rnd() < 0.8 ? 'bracken' : 'mix', size: 1.0 + rnd() * 0.25 });
      }
    };
    brackenOf(COPSE, 67, COPSE_TREES);
    /* -- the thicket out on the heath (layout C's cover): junipers in bracken -- */
    const thicketBeds = LAYOUTS.filter((l) => l.cover === THICKET).map((l) => l.bed);
    beds.push(...thicketBeds);
    brackenOf(THICKET, 71, []);

    /* -- rushes at every pool spot's rim (not in the water, not on his way round): in
       the field nearest to it (a field is drawn only while it is in the picture: one
       that reached across the heath to a far pool would be drawn from everywhere) -- */
    const rushStart = new Map<string, { field: ReeLayoutId | Cover; from: number; to: number }>();
    const fieldAt = (p: { x: number; z: number }): ReeLayoutId | Cover => {
      const all: [ReeLayoutId | Cover, number][] = [
        ...LAYOUTS.map((q): [ReeLayoutId, number] => [q.id, dist(p, q.frame)]),
        ...[COPSE, THICKET].map((c): [Cover, number] => [c, dist(p, c.frame)]),
      ];
      return all.sort((a, b) => a[1] - b[1])[0][0];
    };
    for (const l of LAYOUTS) for (const [k, p] of [['in', l.pools.in], ['out', l.pools.out]] as const) {
      if (!p) continue;
      const field = fieldAt(p);
      const clumps = typeof field === 'string' ? standClumps_.get(field)! : coverClumps.get(field)!;
      const from = clumps.length;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.35;
        if (Math.cos(a) * p.side > 0.55) continue; // the side he walks round stays clear
        const q = atLocal(p, Math.cos(a) * (POOL.halfW + 0.3), Math.sin(a) * (POOL.halfD + 0.3));
        if (Math.abs(toLocal(p, q).u) < 0.7) continue; // his straight way in and out
        clumps.push({ ...q, kind: 'grass', size: 0.72 + rnd() * 0.15 });
      }
      rushStart.set(`${l.id}.${k}`, { field, from, to: clumps.length });
    }

    LAYOUTS.forEach((l, i) => {
      const field = new CoverField({ parent: this.group, groundY: g, clumps: standClumps_.get(l.id)!, seed: 29 + i * 7 });
      this.standCovers.set(l.id, field);
      const tussock = field.meshes.find((m) => m.name === 'cover-tussock');
      if (tussock) this.fullTussock.set(l.id, tussock.geometry);
      this.built.set(l.id, field.stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r })));
    });
    const brackenField = new CoverField({ parent: this.group, groundY: g, clumps: bracken, seed: 31 });
    for (const c of [COPSE, THICKET]) this.coverFields.set(c, brackenField);
    for (const l of LAYOUTS) {
      this.gapClumps.set(l.id, this.coverFields.get(l.cover)!.nearestClump(l.gap.x, l.gap.z, (c) => c.kind !== 'grass')?.i ?? 0);
    }

    /* -- the look-alikes of every stand (adventure/decoys.ts): only the played stand's
       small things show; the dead bracken stands in every stand as cover -- */
    for (const l of LAYOUTS) {
      const s = new StandDecoys(env, env.detail(l.frame), decoysAt.get(l.id)!, this.standCovers.get(l.id)!, standClumps_.get(l.id)!, l.search); // (small things: they rest sooner, Residents `detail`)
      this.stands.set(l.id, s);
    }

    /* -- the junipers: the copse's, the thicket's and every hide's -- */
    const bush = (x: number, z: number, h: number, turn: number): void => {
      // a Veluwe juniper grows up more than out: the world's round bush, drawn slimmer
      void env.spawnPlant('prop-juniper-bush', h / JUNIPER_TALL).then((s) => {
        if (!s) return;
        const r = this.withFarCopy(s.root as THREE.Object3D, 'prop-juniper-bush', h, MID_JUNIPER_TRIS, FAR_JUNIPER_TRIS);
        r.position.set(x, g(x, z) - 0.03, z);
        r.rotation.y = turn;
        r.scale.multiply(new THREE.Vector3(JUNIPER_SLIM, JUNIPER_TALL, JUNIPER_SLIM));
        this.group.add(r);
        this.spawned.push(s);
      });
      env.obstacles.push({ x, z, r: juniperR(h) });
    };
    for (const j of [...COPSE.junipers, ...THICKET.junipers]) bush(j.x, j.z, j.h, j.turn);
    LAYOUTS.forEach((l, i) => bush(l.hideJuniper.x, l.hideJuniper.z, l.hideJuniper.h, 1.3 + i * 1.7));

    /* -- every hide's fallen log, lying across in front of where he stands -- */
    for (const l of LAYOUTS) {
      const log = l.hideLog;
      void env.spawnPlant('prop-fallen-log', SIZE.boomstam.h * 0.9).then((s) => {
        if (!s) return;
        const r = this.withFarCopy(s.root as THREE.Object3D, 'prop-fallen-log', SIZE.boomstam.h * 0.9, MID_LOG_TRIS, FAR_LOG_TRIS);
        r.position.set(log.x, g(log.x, log.z) - 0.04, log.z);
        r.rotation.y = log.turn;
        this.group.add(r);
        this.spawned.push(s);
      });
      env.obstacles.push(boxObstacle(log.x, log.z, log.half, 0.24, log.turn, 0.25));
    }

    /* -- her wissels: the path her hooves wore through the heath, ring to tall grass (the
       played layout's shows: where this morning's prints run) -- */
    LAYOUTS.forEach((l, i) => {
      const w = groundStrip(g, wisselLine(l), WISSEL_HALF, WISSEL_SAND, { layer: 1, wobble: 0.28, seed: 5 + i * 3, feather: true });
      w.renderOrder = -1; // under the marker ring's halo where it crosses it
      w.visible = false;
      this.group.add(w);
      this.made.push(w);
      this.wissels.set(l.id, w);
    });

    /* -- the wet pools: a muddy rim, dark still water that takes the sky's light (one
       spot shows: this play's) -- */
    for (const l of LAYOUTS) for (const [k, p] of [['in', l.pools.in], ['out', l.pools.out]] as const) {
      if (!p) continue;
      const meshes: THREE.Mesh[] = [];
      const decal = (rx: number, rz: number, color: string, o: Parameters<typeof groundDecal>[7]): THREE.Mesh => {
        const m = groundDecal(g, p.x, p.z, rx, rz, p.heading + Math.PI / 2, color, o);
        meshes.push(m);
        return m;
      };
      decal(POOL.halfW + 0.55, POOL.halfD + 0.45, '#5f4d34', { layer: 1, wobble: 0.18, seed: 7, feather: true });
      decal(POOL.halfW + 0.12, POOL.halfD + 0.1, '#4a3e2c', { layer: 2, wobble: 0.14, seed: 11, roughness: 0.4, feather: true });
      // the water: the ven's own still water (dark peat teal near, the evening sky and the
      // far bank's trees mirrored at a grazing look), fading into its muddy rim
      const water = decal(POOL.halfW, POOL.halfD, '#ffffff', { layer: 3, wobble: 0.12, seed: 11, feather: true });
      (water.material as THREE.Material).dispose();
      water.material = poolWater();
      for (const m of meshes) { m.visible = false; this.group.add(m); this.made.push(m); }
      const rr = rushStart.get(`${l.id}.${k}`)!;
      const rushes = Array.from({ length: rr.to - rr.from }, (_, i) => rr.from + i);
      this.pools.set(`${l.id}.${k}`, { spot: p, field: typeof rr.field === 'string' ? this.standCovers.get(rr.field)! : this.coverFields.get(rr.field)!, meshes, rushes });
    }
    // what a boot in the water makes: rings spreading one after the other, and a few
    // drops thrown up that fall back (calm and small: a plash, not a splash)
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#eef3ee', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), this.ringMat.clone());
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.rings.push({ mesh, t: -1, delay: i * 0.3, max: 0.72 });
    }
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#e4ecea' }), DROPS);
    this.drops.visible = false;
    this.drops.renderOrder = 5;
    this.group.add(this.drops);

    // in free roam, before any play: layout A's morning (where the calf lies in the spec)
    const a = REE_LAYOUTS.A;
    this.laid = { layout: a, calf: calfAt(a, CALF_DOELEN[0]), pool: 'in', decoys: distractors.map((d) => d.id), glimpse: SEARCH_GLIMPSE };
    this.layPlay(this.laid);
  }

  /**
   * Lay a play's morning (under the briefing card; and once at build, the free-roam one):
   * every stand's grass as it was built, the calf's stand's window opened over its back
   * for the search's lens, the trial's look-alikes in that stand (the dead bracken stands
   * in every stand: cover), the pool on this play's way (its rushes with it), her wissel
   * worn where this play's prints run.
   */
  layPlay(p: ReeLaid): void {
    this.laid = p;
    const l = p.layout;
    // the grass stands as built, everywhere (a window opened for another play closes);
    // the played stand whole, the others lighter
    for (const [id, field] of this.standCovers) {
      const tussock = field.meshes.find((m) => m.name === 'cover-tussock');
      if (tussock) tussock.geometry = id === l.id ? this.fullTussock.get(id)! : this.lightTussock;
      const built = this.built.get(id)!;
      field.stems.forEach((s, i) => {
        const b = built[i];
        s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
        if (s.h0 !== undefined) delete s.h0;
      });
      field.refresh();
    }
    // the glimpse window: from the search's lens, a little of the calf's back shows
    const lens = this.env.lensFor(l.views.search);
    this.searchEye = lens.cam;
    const g = this.groundY;
    const lyH = lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf);
    const back = backPoints(p.calf.x, g(p.calf.x, p.calf.z), p.calf.z, p.calf.yaw, SIZE.reekalf.len, lyH);
    const cover = this.cover;
    const changed = openWindow(cover.stems, lens.cam, back, p.glimpse);
    cover.refresh();
    this.glimpse = { share: visibleShare(back, lens.cam, cover.stems), changed: changed.length };
    // the look-alikes: this trial's in the played stand; elsewhere only the dead bracken
    const bushes = this.distractors.filter((d) => d.k === 'bush' && p.decoys.includes(d.id)).map((d) => d.id);
    for (const [id, s] of this.stands) s.useDecoys(id === l.id ? p.decoys : bushes);
    // the pool on this play's way, its rushes with it
    const on = `${l.id}.${p.pool}`;
    for (const [k, b] of this.pools) {
      for (const m of b.meshes) m.visible = k === on;
      for (const c of b.rushes) b.field.showClump(c, k === on);
    }
    for (const [id, w] of this.wissels) w.visible = id === l.id;
  }

  /**
   * A solid piece (a juniper, a log) with light copies for afar: the world's load-time
   * simplifier (Lod.ts, as the forest's far trees) bakes the model once per kind, and a
   * THREE.LOD draws the real model within `MID_COPY_M` of the lens, the near copy out to
   * `FAR_COPY_M` and the lightest beyond (eight junipers and three logs cost ~140k
   * triangles in a view across the heath drawn whole). `h`: this piece's height (the
   * copies were baked at the first one's; they scale with it).
   */
  private withFarCopy(root: THREE.Object3D, kind: string, h: number, mid: number, far: number): THREE.Object3D {
    const key = `ree:${kind}`;
    if (!this.farRef.has(key)) this.farRef.set(key, h);
    const lod = new THREE.LOD();
    lod.addLevel(root, 0);
    // (the copy is made a while after the world is built, at an idle moment: simplifying
    // a model costs ~0.1-0.2 s, and the title must not wait for it)
    this.farJobs.push(() => {
      const geos = lodGeometries(key, root, [mid, far]);
      geos.forEach((geo, i) => {
        if (!geo.userData.toned) {
          const col = geo.attributes.color as THREE.BufferAttribute;
          for (let k = 0; k < col.array.length; k++) (col.array as Float32Array)[k] *= FAR_TONE;
          geo.userData.toned = true;
        }
        const copy = new THREE.Mesh(geo, this.farMat);
        copy.scale.setScalar(h / this.farRef.get(key)!);
        lod.addLevel(copy, i ? FAR_COPY_M : MID_COPY_M, 0.1);
      });
    });
    this.nextFarJob(FAR_COPY_AFTER_MS);
    return lod;
  }

  /** Run the next far copy at an idle moment (one at a time). */
  private nextFarJob(after = 0): void {
    if (this.farPending || this.disposed) return;
    this.farPending = true;
    setTimeout(() => {
      const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      const run = (): void => {
        this.farPending = false;
        if (this.disposed) return;
        this.farJobs.shift()?.();
        if (this.farJobs.length) this.nextFarJob(50);
      };
      if (idle) idle(run, { timeout: 2000 }); else run();
    }, after);
  }

  /** The played stand's tall grass (the search's cover: its glimpse, the calf's stems). */
  get cover(): CoverField { return this.standCovers.get(this.laid.layout.id)!; }

  /** The bracken at a layout's gap stirs (she is about to step out, or heard him). */
  rustleGap(l: ReeLayout, amp: number): void { this.coverFields.get(l.cover)!.rustle(this.gapClumps.get(l.id) ?? 0, amp); }

  /** The pool laid now (its frame, its way round). */
  get pool(): PoolSpot { return this.pools.get(`${this.laid.layout.id}.${this.laid.pool}`)!.spot; }

  /** The played stand's look-alikes. */
  get decoys(): readonly Decoy[] { return this.stands.get(this.laid.layout.id)!.decoys; }

  /** The decoys of this trial stay in the played stand; the others step out of it (under
   *  the briefing card). */
  useDecoys(ids: readonly string[]): void { this.layPlay({ ...this.laid, decoys: ids }); }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: { x: number; z: number }): void { this.stands.get(this.laid.layout.id)!.poke(d, from); }

  /** (x, z) is in the pool's water (a little inside its rim). */
  inWater(x: number, z: number): boolean {
    const p = this.pool;
    const l = toLocal(p, { x, z });
    return (l.u / POOL.halfW) ** 2 + (l.v / POOL.halfD) ** 2 < 0.85;
  }

  /** A boot in the pool at (x, z): rings spread over the water, a few drops fly up. */
  splash(x: number, z: number): void {
    const p = this.pool;
    const y = this.groundY(x, z) + 0.08; // just over the water (its decal layer)
    // the rings stay on the water: they spread no further than its rim from where he stands
    const l = toLocal(p, { x, z });
    const room = Math.max(0.18, Math.min(0.72, POOL.halfW - Math.abs(l.u), (POOL.halfD - Math.abs(l.v)) / 0.72));
    for (const r of this.rings) {
      r.t = 0;
      r.max = room;
      r.mesh.position.set(x, y, z);
      r.mesh.rotation.y = p.heading; // (its x across the pool, its z along it)
    }
    this.dropT = 0;
    this.dropAt.set(x, y, z);
  }

  setState(_state: HomeState): void { /* the stands, the copse and the pool stay */ }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean; ranger?: boolean }[]): void {
    for (const f of this.standCovers.values()) f.update(dt, t, reduced, movers);
    for (const f of new Set(this.coverFields.values())) f.update(dt, t, reduced, movers);
    // a boot in the pool plashes (whoever's, whenever: a mission's wrong answer or a walk
    // straight through it): a plash going in, rings at every step while he wades on
    const me = movers.find((m) => m.ranger);
    const inPool = !!me && this.inWater(me.x, me.z);
    this.wadeT += dt;
    if (inPool && me && (!this.wading || (me.moving && this.wadeT > 0.75))) {
      if (!this.wading && store.get().settings.geluid) Sound.splash();
      this.splash(me.x, me.z);
      this.wadeT = 0;
    }
    this.wading = inPool;
    for (const s of this.stands.values()) s.update(dt, reduced);
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
      const s = 0.1 + e * (r.max - 0.1);
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
    this.disposed = true;
    for (const [id, f] of this.standCovers) {
      const tussock = f.meshes.find((m) => m.name === 'cover-tussock');
      if (tussock) tussock.geometry = this.fullTussock.get(id)!; // (the field disposes its own)
      f.dispose();
    }
    this.lightTussock.dispose();
    this.farMat.dispose();
    for (const f of new Set(this.coverFields.values())) f.dispose();
    for (const s of this.stands.values()) s.dispose();
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
