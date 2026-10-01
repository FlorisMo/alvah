/**
 * beats/search.ts — zoeken in the world (design §4.1 beat 3, §6): the lens holds still
 * over a stand of true-scale cover; the animal lies IN it, pressed flat, only a glimpse
 * of its back showing between the stems; the look-alikes are the trial's decoys. The
 * child clicks where he sees it.
 *
 * Construct parity (§6): the SAME `buildZoekenTrial` (target + decoys from the trial,
 * laid on the stand with the 3D zoeken's own `patchLocal`), scored on the FIRST click
 * by the shared `scoreZoeken` rule (a click on a decoy is a miss; a click on the plain
 * cover is not — the 2D field's empty ground), and the SAME `{ trials: 1, correct }`
 * summary, logged once through the kit. The trail that led here ended at the stand,
 * never at the animal. The view holds still.
 *
 * Hints are diegetic and late (after 14 s or two misses): he squeaks where he lies and
 * the stems over him quiver; much later they lean aside a little. Every click gets a
 * sound and a reaction within a frame: a decoy clump rustles and parts (nothing there),
 * a bird flits, the plain cover rustles, and a find parts the stems over him.
 */

import * as THREE from 'three';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { scoreZoeken } from '../../../engines/zoeken';
import { tapHitRadius } from '../../play/kit-math';
import { backPoints, openWindow, visibleShare } from '../cover-math';
import { backTop } from '../../play/pose';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Actor } from '../actors';
import type { CoverField } from '../cover';
import { listenerOf } from '../../world/Residents';
import type { Place, Spot } from '../types';

/** A look-alike in the stand: what a click on it finds. */
export interface SearchDecoy {
  id: string;
  object: THREE.Object3D;
  x: number; z: number;
  /** its reaction to a click (a clump parts, a bird flits) */
  poke(from: Spot): void;
}

export interface SearchOpts {
  view: FrameSpec;
  /** where the ranger stands to search (the view's own include spot) */
  stand: Place;
  cover: CoverField;
  /** the hidden animal (lying in the cover) */
  target: Actor;
  decoys: readonly SearchDecoy[];
  /** the animal's call (a hint from where it lies) */
  call?: string;
  lines: { zoek: string; mis: string; hint: string; gevonden: string };
  /** seconds before the first hint (the design's 14 s), and misses before it */
  hintAfter?: number;
  /** the animal's height lying down (m): the cover round it must stand twice that */
  lyingH?: number;
  /** how much of its back the stems let the lens see (default 0.3: a glimpse); less is
   *  a harder find */
  glimpse?: number;
  /** run 7: the most of its back the window may show (default: no limit, as before): every
   *  hiding spot shows the same glimpse for the same knob */
  glimpseMax?: number;
}

export interface SearchResult { summary: BeatSummary; misses: number; seconds: number }

const HINT_AFTER_S = 14;

/** Play the search (zoeken, step `step`). Resolves once he is found and it is logged. */
export async function searchBeat(k: AdventureKit, step: number, o: SearchOpts): Promise<SearchResult> {
  k.check();
  k.beat = 'search';
  const settings = store.get().settings;
  // he stands where the view was planned for, facing the stand; the lens moves once
  await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  // the glimpse window was opened for the planned lens (a 1280×800 screen); on another
  // screen the lens differs a little: the stems that now hide his back more than planned
  // grow down calmly while the lens moves in (never after: the view holds still)
  if (o.lyingH) {
    const lens = k.lensFor(o.view).cam;
    const g = k.ctx.groundY(o.target.x, o.target.z);
    const back = backPoints(o.target.x, g, o.target.z, o.target.yaw, o.lyingH * 2.7, o.lyingH);
    const drawn = o.cover.stems.map((s) => s.h);
    const more = openWindow(o.cover.stems, lens, back, o.glimpse ?? 0.3, o.glimpseMax);
    if (more.length) o.cover.settle(more, 1.1, drawn);
    k.stats.glimpse = Math.round(visibleShare(back, lens, o.cover.stems) * 100) / 100;
  }
  await k.frame(o.view, { face: o.stand.heading });
  const camera = k.world.camera;
  const canvas = k.ctx.canvas;
  const body = o.target.body;
  if (!body) throw new Error('[adventure] the search target has no body');
  // where a player sees him: the middle of the glimpse between the stems, as this lens
  // sees it (the golden hint clicks it); the top of his back if no ray gets through
  const anchor = new THREE.Object3D();
  anchor.name = 'search-target';
  anchor.userData.hintAnchor = true;
  anchor.position.copy(backTop(body));
  body.add(anchor);
  // (the stems breathe in the breeze and quiver on a hint: the glimpse is looked for again
  // whenever the hint is read — only the tests read it — so the point it names is the one
  // seen through the stems as they stand at that very moment)
  const blockers = [o.cover.group, ...o.decoys.map((d) => d.object)];
  const aim = (): void => {
    const seen = glimpseOn(body, camera, blockers);
    if (seen) anchor.position.copy(body.worldToLocal(seen));
  };
  aim();
  // the design's bar, measured: the cover round him stands at least twice his lying height
  if (o.lyingH) {
    const near = o.cover.stems.filter((s) => Math.hypot(s.x - o.target.x, s.z - o.target.z) < 0.9).map((s) => s.h).sort((a, b) => a - b);
    const median = near.length ? near[Math.floor(near.length / 2)] : 0;
    k.stats.cover_h = Math.round(median * 100) / 100;
    k.stats.lying_h = Math.round(o.lyingH * 100) / 100;
    k.stats.cover_ratio = Math.round((median / o.lyingH) * 100) / 100;
  }
  const t0 = k.now;
  let misses = 0;
  let found = false;
  let hints = 0;
  let nextHint = Infinity;
  const heard = (): void => {
    if (settings.geluid && o.call) Sound.callAt(o.call, o.target.x, o.target.z, listenerOf(camera));
    const c = o.cover.nearestClump(o.target.x, o.target.z);
    if (c) o.cover.rustle(c.i, 0.07);
    o.cover.partAt(o.target.x, o.target.z, 0.45, 0.06, 0.6);
  };
  k.say(o.lines.zoek);
  const unhint = k.hint(() => { if (found) return null; aim(); return { id: 'target', target: anchor }; });
  const offHint = k.onTick((_dt, now) => {
    if (found) return;
    if (!hints && (misses >= 2 || now - t0 > (o.hintAfter ?? HINT_AFTER_S))) {
      hints = 1; nextHint = now;
      k.say(o.lines.hint);
    }
    if (hints && now >= nextHint) {
      heard();
      hints += 1;
      nextHint = now + 3.2;
      // much later the stems over him lean aside a little (a stronger glimpse)
      if (now - t0 > 32) o.cover.partAt(o.target.x, o.target.z, 0.55, 0.22, 3);
    }
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const c = new THREE.Vector3();
  const done = new Promise<void>((resolve) => {
    const onDown = (e: PointerEvent): void => {
      if (found || k.world.menuShown()) return;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hitsBody = ray.intersectObject(body, true).some((h) => h.object.visible && !h.object.userData.hitSphere);
      let pick: { id: string; d: number } | null = hitsBody ? { id: 'target', d: 0 } : null;
      if (!pick) {
        for (const d of o.decoys) {
          if (!d.object.visible) continue;
          if (ray.intersectObject(d.object, true).some((h) => h.object.visible)) { pick = { id: d.id, d: 0 }; break; }
        }
      }
      if (!pick) {
        // a near-miss on something small still counts (≥56 px round each, like pick3d)
        const vh = r.height || 800;
        const cand: { id: string; at: THREE.Vector3 }[] = [{ id: 'target', at: anchor.getWorldPosition(new THREE.Vector3()) }];
        for (const d of o.decoys) if (d.object.visible) cand.push({ id: d.id, at: d.object.getWorldPosition(new THREE.Vector3()) });
        for (const q of cand) {
          c.copy(q.at);
          const rad = tapHitRadius(camera.position.distanceTo(c), (camera.fov * Math.PI) / 180, vh, 0.16);
          const dd = ray.ray.distanceToPoint(c);
          if (dd <= rad && (!pick || dd < pick.d)) pick = { id: q.id, d: dd };
        }
      }
      const me = k.ranger();
      if (pick?.id === 'target') {
        found = true;
        canvas.removeEventListener('pointerdown', onDown);
        resolve();
        return;
      }
      if (pick) {
        misses += 1;
        const d = o.decoys.find((x) => x.id === pick!.id);
        d?.poke(me);
        if (settings.geluid) { Sound.rustle(); Sound.tryAgain(); }
        k.say(o.lines.mis);
        return;
      }
      // the plain cover: it rustles (nothing there), no miss — the 2D field's empty ground
      const clump = o.cover.pick(ray);
      if (clump !== null) {
        o.cover.rustle(clump, 0.1);
        if (settings.geluid) Sound.rustle();
      }
    };
    canvas.addEventListener('pointerdown', onDown, { signal: k.signal });
  });
  try {
    await k.guard(done);
  } finally {
    offHint();
    unhint();
  }
  // found: the stems part over him, he lifts his head and squeaks
  const seconds = k.now - t0;
  const summary: BeatSummary = { trials: 1, correct: scoreZoeken(misses) };
  k.log(step, summary);
  k.stats.search_misses = misses;
  k.stats.search_seconds = Math.round(seconds);
  if (settings.geluid) Sound.found();
  o.cover.partAt(o.target.x, o.target.z, 0.75, 0.62, 9);
  void o.target.lookAt(() => ({ ...k.ranger() }), 1.8);
  window.setTimeout(() => { if (!k.signal.aborted && settings.geluid && o.call) Sound.callAt(o.call, o.target.x, o.target.z, listenerOf(camera)); }, 450);
  k.say(o.lines.gevonden, { good: true });
  await k.wait(2.4);
  anchor.removeFromParent();
  return { summary, misses, seconds };
}

/**
 * The point of `body` a player sees best through the cover from `camera`: rays through
 * a grid over its upper half; of those whose first hit (body, cover, decoys) is the body,
 * the one deepest inside what shows (most neighbours seen too: a stem swaying in the
 * breeze does not cover it), nearest the middle on a tie. World space; null when no ray
 * gets through.
 */
function glimpseOn(body: THREE.Object3D, camera: THREE.Camera, cover: readonly THREE.Object3D[]): THREE.Vector3 | null {
  body.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(body);
  if (box.isEmpty()) return null;
  const ray = new THREE.Raycaster();
  const targets = [body, ...cover];
  const inBody = (o: THREE.Object3D | null): boolean => { for (let p = o; p; p = p.parent) if (p === body) return true; return false; };
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const NI = 7, NJ = 5, KS = [0.7, 0.95];
  const grid: (THREE.Vector3 | null)[] = [];
  const at = (i: number, j: number, k: number): THREE.Vector3 | null =>
    (i < 0 || j < 0 || i >= NI || j >= NJ ? null : grid[(k * NI + i) * NJ + j]);
  const p = new THREE.Vector3();
  KS.forEach((ky) => {
    for (let i = 0; i < NI; i++) {
      for (let j = 0; j < NJ; j++) {
        p.set(box.min.x + (box.max.x - box.min.x) * (i / (NI - 1)), box.min.y + (box.max.y - box.min.y) * ky, box.min.z + (box.max.z - box.min.z) * (j / (NJ - 1)));
        ray.set(eye, p.clone().sub(eye).normalize());
        const first = ray.intersectObjects(targets, true).find((h) => h.object.visible && !h.object.userData.hitSphere);
        grid.push(first && inBody(first.object) ? first.point.clone() : null);
      }
    }
  });
  const hits = grid.filter((g): g is THREE.Vector3 => !!g);
  if (!hits.length) return null;
  const mid = hits.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / hits.length);
  let best: THREE.Vector3 | null = null;
  let bestScore = -1;
  KS.forEach((_, k) => {
    for (let i = 0; i < NI; i++) {
      for (let j = 0; j < NJ; j++) {
        const h = at(i, j, k);
        if (!h) continue;
        const inner = [at(i - 1, j, k), at(i + 1, j, k), at(i, j - 1, k), at(i, j + 1, k), at(i, j, 1 - k)].filter(Boolean).length;
        const score = inner * 100 - h.distanceTo(mid);
        if (score > bestScore) { bestScore = score; best = h; }
      }
    }
  });
  return best;
}
