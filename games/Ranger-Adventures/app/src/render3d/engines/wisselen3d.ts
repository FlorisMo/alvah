/**
 * wisselen3d.ts — the diegetic 3D variant of the "wisselen" engine (cognitive
 * flexibility / set-shifting), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildWisselTrial` builder
 * and drives the SAME pure `WisselRun` core as the 2D `playWissel`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the whole
 * queue is sorted with no wrong click). **No cross-construct contamination:** both
 * places stay visible + named the whole time and the ranger never walks, so this is
 * rule-application, not spatial memory.
 *
 * 2026-09-26 staging: the animal to sort is the world's own model at its real size,
 * its name over it; "de open plek" (a sunny clearing with flowers) sits left and "het
 * hol" (the world's badger sett) right, each named with its icon. Between them, a
 * signboard FACING the player carries the rule as icon + word + arrow — ☀ dag → the
 * side it goes, 🌙 nacht → the other — so the rule reads without colour; when the rule
 * flips ("Nu andersom!") the board redraws its arrows.
 *
 * Never-scary / motion-comfort (§1e): a right choice walks the animal calmly to its
 * place (an instant settle under reduced-motion); a wrong one is a small shake + "probeer
 * de andere plek", recoverable, never game-over. One eased reframe (a cut when reduced).
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildWisselTrial, WisselRun, type WisselBin } from '../../engines/wisselen';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, contactShadow, hintAnchor, pick3d, registerActivityWin, registerPlayHint,
  activityScopeSignal,
} from '../play/kit';
import { Stage, nameTag } from '../play/stage';
import { heightFor } from '../play/spawn';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** How far either side of the centre the two places sit (m). */
const SIDE = 2.3;

/* ------------------------------------------------------------ the rule board ---- */

function drawSun(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = '#f2b62c';
  g.strokeStyle = '#f2b62c';
  g.lineWidth = r * 0.22;
  g.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    g.lineTo(x + Math.cos(a) * r * 1.12, y + Math.sin(a) * r * 1.12);
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, r * 0.55, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawMoon(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = '#5b6fb0';
  g.beginPath();
  g.arc(x, y, r * 0.85, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(x + r * 0.42, y - r * 0.22, r * 0.72, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawArrow(g: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  const dir = Math.sign(x1 - x0);
  g.save();
  g.strokeStyle = '#3b2a18';
  g.fillStyle = '#3b2a18';
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1 - dir * 18, y);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y);
  g.lineTo(x1 - dir * 34, y - 22);
  g.lineTo(x1 - dir * 34, y + 22);
  g.closePath();
  g.fill();
  g.restore();
}

/** The board face: ☀ dag + arrow to its place, 🌙 nacht + arrow to the other place.
 *  The open plek is LEFT, het hol RIGHT (as staged), so the arrows point at them. */
function paintBoard(c: HTMLCanvasElement, inverted: boolean): void {
  const g = c.getContext('2d')!;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#e9d7ae';
  g.strokeStyle = '#7a5a36';
  g.lineWidth = 14;
  g.beginPath();
  g.roundRect(8, 8, W - 16, H - 16, 26);
  g.fill();
  g.stroke();
  g.font = '700 88px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = '#2a1e10';
  const rows: { icon: 'sun' | 'moon'; word: string; y: number; toLeft: boolean }[] = [
    { icon: 'sun', word: 'dag', y: H * 0.3, toLeft: !inverted },
    { icon: 'moon', word: 'nacht', y: H * 0.72, toLeft: inverted },
  ];
  for (const r of rows) {
    // the icon + word sit on the side OPPOSITE the arrow tip, the arrow points to the place
    const iconX = r.toLeft ? W - 100 : 100;
    if (r.icon === 'sun') drawSun(g, iconX, r.y, 56); else drawMoon(g, iconX, r.y, 56);
    g.textAlign = r.toLeft ? 'right' : 'left';
    const wordX = r.toLeft ? W - 178 : 178;
    g.fillText(r.word, wordX, r.y + 2);
    const wordW = g.measureText(r.word).width;
    if (r.toLeft) drawArrow(g, wordX - wordW - 24, 40, r.y);
    else drawArrow(g, wordX + wordW + 24, W - 40, r.y);
  }
}

export function playWissel3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('wisselen');
    const trial = buildWisselTrial(step.skin, diff);
    const run = new WisselRun(trial);

    const instructie = copy.instructie ?? 'Breng elk dier naar de goede plek.';
    const goed = copy.goed ?? 'Alle dieren op de goede plek!';
    const regelDag = copy.regel ?? 'Dag-dier → open plek. Nacht-dier → het hol.';
    const regelOm = copy.regelOm ?? 'Nu andersom! Volg het bordje.';
    // after a flip the banner states the NEW mapping outright (not only "andersom")
    const regelAndersom = 'Dag-dier → het hol. Nacht-dier → open plek.';

    const tallest = Math.max(...trial.queue.map((q) => heightFor(q.id)), 1);
    const stage = new Stage(ctx, { halfW: SIDE + 0.9, halfD: 0.9, tall: Math.max(3.1, tallest + 0.5), pitchDeg: 20, insetBottom: 110, insetTop: 70 });
    const reframe = stage.reframe();

    /** where the animal waits: the middle, a step nearer the lens than the board */
    function centreAt(lift: number): THREE.Vector3 { return stage.at(0, -0.25, lift); }

    // ---- the two places (always visible + named) ----
    interface BinFx { bin: WisselBin; group: THREE.Group; glow: Glow; anchor: THREE.Object3D; at: THREE.Vector3 }
    const bins = new Map<WisselBin, BinFx>();

    // ---- the rule board, facing the player between the places ----
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 680; boardCanvas.height = 400;
    paintBoard(boardCanvas, false);
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    boardTex.anisotropy = 4;
    const sign = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#6e5234', roughness: 1 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), wood);
    post.position.y = 1.1;
    const faceMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.95), faceMat);
    face.position.set(0, 1.85, 0.08);
    sign.add(post, face);
    const signAt = stage.at(0, 1.4);
    sign.position.copy(signAt);
    sign.rotation.y = stage.faceLens(signAt);
    // lift the board until, seen from the planned lens, its lower edge clears the
    // name tag of the tallest animal in the queue — the rule is never hidden
    {
      const view = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.1, 200);
      view.position.copy(stage.cam);
      view.lookAt(stage.look);
      view.updateMatrixWorld(true);
      const tagTop = centreAt(0).clone().setY(centreAt(0).y + Math.max(0.3, tallest) + 0.45).project(view).y;
      let lift = 0;
      for (; lift < 1.6; lift += 0.05) {
        const bottom = signAt.clone().setY(signAt.y + 1.85 - 0.48 + lift).project(view).y;
        if (bottom > tagTop + 0.03) break;
      }
      post.scale.y = (2.2 + lift) / 2.2;
      post.position.y = (2.2 + lift) / 2;
      face.position.y = 1.85 + lift;
    }
    stage.add(sign);
    const boardGlow = new Glow(face, '#fff1c4');

    function paintSign(): void {
      paintBoard(boardCanvas, run.inverted);
      boardTex.needsUpdate = true;
    }

    // ---- the current animal, standing in the middle with its name ----
    let animal: { group: THREE.Group; dispose: () => void } | null = null;
    let animalToken = 0;
    const centre = centreAt(0);
    const centreShadow = contactShadow(0.45);
    centreShadow.position.copy(centre).setY(centre.y + 0.02);
    stage.add(centreShadow);
    /** a small animal (a nightjar, a squirrel) waits on a low stump so it reads */
    const PODIUM_BELOW = 0.45;
    const PODIUM_H = 0.36;
    let podium: THREE.Object3D | null = null;
    let lifted = 0; // how high the current animal stands (its podium), eased down on the walk

    async function stageAnimal(): Promise<void> {
      const token = ++animalToken;
      animal?.dispose();
      animal = null;
      const cur = run.current;
      if (!cur) return;
      const s = await ctx.spawnModel(cur.id, { height: heightFor(cur.id) });
      if (token !== animalToken || activityScopeSignal()?.aborted) { s?.dispose(); return; }
      const group = new THREE.Group();
      const h = heightFor(cur.id);
      lifted = h < PODIUM_BELOW && podium ? PODIUM_H : 0;
      if (podium) podium.visible = lifted > 0;
      group.position.copy(centre).setY(centre.y + lifted);
      let top = h;
      if (s) {
        const root = s.root as THREE.Group;
        root.rotation.y = stage.faceLens(centre, 1.2);
        group.add(root);
        tick = (dt) => s.update(dt);
      }
      const tag = nameTag(Content.animal(cur.id)?.naam ?? cur.id, 1.0);
      top = Math.max(top, 0.3);
      tag.position.set(0, top + 0.3, 0);
      group.add(tag);
      (ctx.scene as THREE.Scene).add(group);
      animal = {
        group,
        dispose: () => {
          group.removeFromParent();
          s?.dispose();
          tag.material.map?.dispose();
          tag.material.dispose();
        },
      };
    }
    let tick: (dt: number) => void = () => {};

    // a calm walk of the animal to its place (an instant settle under reduced-motion)
    let glide: { from: THREE.Vector3; to: THREE.Vector3; t: number; done: () => void } | null = null;
    let shakeUntil = 0;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (activityScopeSignal()?.aborted) { animal?.dispose(); stage.dispose(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (reframe.update(dt)) settled = true;
      stage.update(dt);
      tick(dt);
      if (animal) {
        if (glide) {
          glide.t = Math.min(1, glide.t + (reduced ? 1 : dt / 0.7));
          const e = glide.t * glide.t * (3 - 2 * glide.t);
          animal.group.position.lerpVectors(glide.from, glide.to, e);
          // off the podium (if any) and down onto the ground, then walking over it
          animal.group.position.y = ctx.groundY(animal.group.position.x, animal.group.position.z) + lifted * Math.max(0, 1 - e * 3);
          if (glide.t >= 1) { const d = glide.done; glide = null; d(); }
        }
      }
      if (animal) { // (the walk's end may have swapped the animal just above)
        animal.group.rotation.z = now < shakeUntil ? Math.sin(now / 30) * 0.05 * ((shakeUntil - now) / 500) : 0;
      }
      raf = requestAnimationFrame(loop);
    };
    let settled = false;
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    function banner(text: string): void {
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom"><div class="p3-card"><div class="p3-row">` +
          `<p class="p3-text">${esc(text)}</p>` +
          `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div></div></div>`,
      );
      card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
    }
    function ruleText(): string { return run.inverted ? regelAndersom : regelDag; }

    // ---- build the places from the world's own assets ----
    let teardownPick: (() => void) | null = null;
    let ready = false;
    let busy = false;
    void (async () => {
      // de open plek: a sunny sandy clearing ringed by flowers and fern
      const open = new THREE.Group();
      stage.add(open);
      const openAt = stage.at(-SIDE, 0.2);
      const clearing = stage.decal('#e3c985', 0.9, 0.7, -SIDE, 0.2, { emissive: '#6b5220', emissiveIntensity: 0.25 });
      open.add(clearing);
      const flowers = await Promise.all([
        stage.plant('prop-foxglove', 0.7, -SIDE - 0.75, 0.55, 0.3),
        stage.plant('prop-foxglove', 0.62, -SIDE + 0.7, 0.7, 1.9),
        stage.plant('prop-fern', 0.45, -SIDE - 0.9, -0.2, 2.4),
      ]);
      for (const f of flowers) if (f) open.add(f);
      const openTag = nameTag('☀ open plek', 1.15);
      openTag.position.copy(openAt).setY(openAt.y + 1.05);
      open.add(openTag);
      bins.set('open', { bin: 'open', group: open, glow: new Glow(clearing, '#8fd6a0'), anchor: hintAnchor(clearing, 0.5), at: openAt });

      // het hol: the world's badger sett
      const hol = new THREE.Group();
      stage.add(hol);
      const holAt = stage.at(SIDE, 0.25);
      const sett = await stage.plant('prop-badger-sett', 0.62, SIDE, 0.25, stage.faceLens(holAt));
      let holBody: THREE.Object3D;
      if (sett) { hol.add(sett); holBody = sett; } else {
        holBody = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5f5142' }));
        holBody.position.copy(holAt);
        hol.add(holBody);
      }
      const holTag = nameTag('🌙 het hol', 1.05);
      holTag.position.copy(holAt).setY(holAt.y + 1.05);
      hol.add(holTag);
      bins.set('hol', { bin: 'hol', group: hol, glow: new Glow(holBody, '#8fd6a0'), anchor: hintAnchor(holBody, 0.6), at: holAt });

      podium = await stage.plant('prop-tree-stump', PODIUM_H + 0.04, 0, -0.25, 0.7);
      if (podium) podium.position.y -= 0.04; // bedded into the ground a little
      await stageAnimal();
      if (activityScopeSignal()?.aborted) return;
      teardownPick = pick3d({
        canvas: ctx.canvas,
        camera,
        raycaster,
        targets: [...bins.values()].map((b) => ({ id: b.bin, object: b.group })),
        onPick: (id) => onPick(id as WisselBin),
      });
      ready = true;
    })().catch((e) => console.error('[wisselen3d] staging failed', e));

    const unHint = registerPlayHint(() => {
      if (!ready || !settled || busy || glide || run.finished || !animal) return null;
      const b = bins.get(run.correctBin());
      return b ? { id: b.bin, target: b.anchor } : null;
    });

    function onPick(bin: WisselBin): void {
      if (!ready || busy || run.finished || glide || !animal) return;
      const res = run.choose(bin);
      const target = bins.get(bin)!;
      if (res === 'retry') {
        if (settings.geluid) Sound.tryAgain();
        if (!reduced) shakeUntil = performance.now() + 500;
        banner('Bijna! Probeer de andere plek.');
        speak('Bijna! Probeer de andere plek.');
        return;
      }
      busy = true;
      if (settings.geluid) Sound.correct();
      target.glow.set(0.5);
      window.setTimeout(() => target.glow.set(0), 600);
      const from = animal.group.position.clone();
      const to = target.at.clone();
      // turn toward the place, then walk there calmly
      animal.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z) - (animal.group.children[0]?.rotation.y ?? 0);
      glide = {
        from, to, t: 0,
        done: () => {
          if (res === 'complete') { finish(); return; }
          if (res === 'flip') {
            paintSign();
            boardGlow.set(0.45);
            if (settings.geluid) Sound.select();
            banner(regelOm);
            speak(regelOm);
            window.setTimeout(() => {
              boardGlow.set(0);
              void stageAnimal().then(() => { banner(ruleText()); busy = false; });
            }, reduced ? 900 : 1700);
            return;
          }
          void stageAnimal().then(() => { banner(ruleText()); busy = false; });
        },
      };
    }

    function finish(): void {
      if (settings.geluid) Sound.found();
      banner(goed);
      speak(goed);
      const summary = run.summary();
      window.setTimeout(() => {
        narrator.stop();
        teardownPick?.();
        unHint();
        cancelAnimationFrame(raf);
        animalToken++;
        animal?.dispose();
        animal = null;
        boardTex.dispose();
        stage.dispose();
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        resolve(summary);
      }, 1500);
    }

    // boot
    registerActivityWin(() => finish()); // W2.3: dev-only win → genuine resolve + teardown
    speak(instructie);
    banner(ruleText());
  });
}

/** The registered 3D wisselen variant. rmSafe:false — every trial the child re-reads
 *  the rule and the place + animal names, and the flat 2D bins show every name at one
 *  size, so the resolver serves the 2D floor under reduced-motion (3D-IMMERSION-PLAN
 *  §4). The 3D path itself is cuts-not-moves (reframe cuts, the walk settles at once,
 *  the shake is gated `!reduced`, the board redraws in place). */
export const wisselen3dEngine: Play3dEngine = {
  engine: 'wisselen',
  play: playWissel3d,
  rmSafe: false,
};
