/**
 * world/Labels.ts — the diegetic name-tags (mission markers, the Missiebord, the
 * sit-spot, the landmark beacons): a camera-facing sprite per tag, drawn on top of
 * everything so no nearer mesh clips it mid-glyph, and faded out behind the camera
 * and with distance so a far tag never punches through a hill (F-22).
 *
 * Run 6 (FLOW): the tags stop cluttering the view. Each frame, in one allocation-free
 * pass and with no extra draw calls, a tag shows only when it matters and reads cleanly:
 *   - who shows: the next mission (`setAlways`, at any distance within the fog fade),
 *     the Missiebord within 20 m, any other tag within 12 m of the ranger (`reach`);
 *   - a building in the way (the cabin, the bird hide, the watchtower …) hides a tag
 *     behind it instead of the tag floating on its roof (a 2D sightline test against the
 *     solid footprints, with their height);
 *   - two tags never overlap on screen: the one that matters more (the next mission,
 *     then the nearer) stays, the other fades;
 *   - a tag at the screen edge fades before it is cut, so no word fragment shows (this
 *     frame's edge, never eased: an eased fade trails a turning view by several frames);
 *   - `setGlow` makes a tag glow for a few seconds of being seen (a warm sun outline, a
 *     soft breath; steady under reduced motion): the chip's mission after Bram's hook, the
 *     board. Hidden behind the cabin it waits, so the glow Bram points at is seen.
 */

import * as THREE from 'three';
import type { Obstacle } from '../CharacterController';

// F-22 occlusion-proof labels: the diegetic name-tags draw with depthTest off so
// no nearer mesh can clip them mid-glyph (see make). The cost of drawing them
// on top of everything is that a far tag would otherwise punch through hills from
// across the map, so each fades OUT with distance — full opacity within FULL m
// (the hub / an open mission, i.e. the moment the label matters), gone by GONE m.
const LABEL_FADE_FULL = 35;  // camera→label distance (m) below which a tag is fully opaque
const LABEL_FADE_GONE = 55;  // …and above which it has faded to nothing
// Wave 2: a tag's size ON SCREEN is clamped (card height in CSS px): never a giant card
// in front of the lens when the camera passes close to a marker, never an unreadable
// speck far away. And a tag the lens is almost touching fades out (it is right there;
// the prompt names it).
const LABEL_PX_MIN = 24;     // ≈ 11 px text: still readable at a distance, not a wall of cards
const LABEL_PX_MAX = 48;     // ≈ 23 px text: the biggest a tag ever gets
const LABEL_NEAR_GONE = 2.5; // m from the lens: hidden
const LABEL_NEAR_FULL = 4;   // m: fully there again

/** A tag with no other rule shows within this many metres of the ranger. */
export const TAG_REACH_M = 12;
/** A tag on screen keeps this gap (px) to the next one; a faded one needs a little more
 *  room before it comes back, so two tags at the edge of touching never flicker. */
const OVERLAP_GAP_PX = 6;
const OVERLAP_HYST_PX = 10;
/** Within this many px of the screen's edge a tag fades out (gone once it touches it). */
const EDGE_FADE_PX = 22;
/** How fast a tag eases in or out (1/s). */
const EASE_PER_S = 7;
/** A solid footprint this big or bigger hides the tags behind it (buildings). */
const OCCLUDER_MIN_R = 2;
/** The height (m) of a solid that does not say. */
const OCCLUDER_DEFAULT_H = 4;
/** A glowing tag breathes this much (scale) at this pace (s a breath). */
const GLOW_BREATH = 0.08;
const GLOW_PERIOD_S = 1.6;
/** A glow counts down only while its tag is drawn at least this much (Bram points at a
 *  tag the cabin still hides: it glows once he sees it), and ends this long after it
 *  began, seen or not. */
const GLOW_SEEN = 0.5;
const GLOW_MAX_S = 30;

interface Tag {
  sprite: THREE.Sprite;
  text: string;
  color: string;
  reach: number;            // m from the ranger (Infinity: no rule)
  always: boolean;          // the next mission: shows at any distance
  w: number; h: number;     // world size before the on-screen clamp
  plain: THREE.CanvasTexture;
  glowTex: THREE.CanvasTexture | null;
  glowLeft: number;         // s of glow left, counted only while the tag is seen (0: none)
  glowAge: number;          // s since the glow began (it ends by GLOW_MAX_S, seen or not)
  vis: number;              // eased 0..1: how far in it is after the rules
  edge: number;             // 0..1 this frame: how clear of the screen's edge it is (not eased)
  blocked: boolean;         // faded by the overlap pass last frame (hysteresis)
  // this frame, in screen px (CSS) and metres
  on: boolean; sx: number; sy: number; hw: number; hh: number; dist: number; rank: number;
  fromRanger: number;       // m from the ranger (the dev hook reads it)
}

export class Labels {
  private readonly tags: Tag[] = [];
  private readonly bySprite = new Map<THREE.Sprite, Tag>();
  private order: number[] = [];                  // tags sorted by rank each frame (reused)
  private readonly _fwd = new THREE.Vector3();   // scratch: camera forward
  private readonly _wp = new THREE.Vector3();    // scratch: a label's world position
  private readonly _ws = new THREE.Vector3();    // scratch: a label's parent world scale
  private readonly _ndc = new THREE.Vector3();   // scratch: a label projected
  private shown = 1; // 0..1: how far every tag is in (0 on the title and in the maker: the world, no words)
  private clock = 0;
  // the world the pass reads: the solids (buildings hide tags) and the ground under them
  private obstacles: readonly Obstacle[] = [];
  private occluders: Obstacle[] = [];
  private occluderSeen = -1;
  private groundY: (x: number, z: number) => number = () => 0;

  /** How far every tag is in: 0 while a shot is up, easing back to 1 once the follow
   *  camera has the lens (World steps it), so no tag pops in over a moving picture. */
  setShown(k: number): void {
    this.shown = Math.max(0, Math.min(1, k));
  }

  /** The solids that may stand between the lens and a tag, and the ground height. */
  setWorld(env: { obstacles: readonly Obstacle[]; groundY: (x: number, z: number) => number }): void {
    this.obstacles = env.obstacles;
    this.groundY = env.groundY;
  }

  /** A camera-facing sprite name-tag (rounded warm card + the title). `reach`: within
   *  how many metres of the ranger it shows (the default rule, TAG_REACH_M). */
  make(text: string, color: string, opts: { reach?: number } = {}): THREE.Sprite {
    const plain = Labels.drawCard(text, color, false);
    // F-22: depthTest OFF + a high renderOrder → a nearer mesh (the giant avatar's
    // leg in Run A, the board planks, a pine, the parked jeep) can no longer
    // depth-occlude the tag and cut the one string that names the object mid-glyph.
    // depthWrite stays off so the tag never pollutes the depth buffer for what draws
    // after it. The always-on-top trade-off is bounded by the per-frame pass in fade().
    const mat = new THREE.SpriteMaterial({ map: plain.tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 12; // draw after the opaque world + props so it composites over them
    sprite.scale.set(plain.w, plain.h, 1);
    const tag: Tag = {
      sprite, text, color, reach: opts.reach ?? TAG_REACH_M, always: false,
      w: plain.w, h: plain.h, plain: plain.tex, glowTex: null, glowLeft: 0, glowAge: 0, vis: 0, edge: 1, blocked: false,
      on: false, sx: 0, sy: 0, hw: 0, hh: 0, dist: 0, rank: 0, fromRanger: 0,
    };
    this.tags.push(tag);
    this.bySprite.set(sprite, tag);
    this.order.push(this.tags.length - 1);
    return sprite;
  }

  /** Give a tag new words (a finished mission reads "✓ <titel>"): same sprite, same rules. */
  retitle(sprite: THREE.Sprite, text: string, color: string): void {
    const tag = this.bySprite.get(sprite);
    if (!tag) return;
    const card = Labels.drawCard(text, color, false);
    tag.plain.dispose();
    tag.glowTex?.dispose();
    tag.plain = card.tex; tag.glowTex = null;
    tag.text = text; tag.color = color; tag.w = card.w; tag.h = card.h;
    const mat = sprite.material as THREE.SpriteMaterial;
    mat.map = tag.glowLeft > 0 ? this.glowTexOf(tag) : tag.plain;
    mat.needsUpdate = true;
    sprite.scale.set(card.w, card.h, 1);
  }

  /** The next mission's tag shows at any distance (within the fog fade). */
  setAlways(sprite: THREE.Sprite, on: boolean): void {
    const tag = this.bySprite.get(sprite);
    if (tag) tag.always = on;
  }

  /** A tag glows for `seconds` of being seen (0 stops it): the warm outlined card and a
   *  soft breath. The seconds count only while the tag is drawn; it ends by 30 s anyway. */
  setGlow(sprite: THREE.Sprite, seconds: number): void {
    const tag = this.bySprite.get(sprite);
    if (!tag) return;
    tag.glowLeft = Math.max(0, seconds);
    tag.glowAge = 0;
    const mat = sprite.material as THREE.SpriteMaterial;
    const map = tag.glowLeft > 0 ? this.glowTexOf(tag) : tag.plain;
    if (mat.map !== map) { mat.map = map; mat.needsUpdate = true; }
  }

  /** Whether a tag glows now (the dev hook reads it). */
  glowing(sprite: THREE.Sprite): boolean {
    return (this.bySprite.get(sprite)?.glowLeft ?? 0) > 0;
  }

  /**
   * The per-frame pass (F-22 + run 6): distance and lens fades, the on-screen size clamp,
   * who shows (reach / always), buildings in the way, no two tags on top of each other,
   * nothing cut at the screen edge, the glow. `focus` is the ranger. Cheap: a few dot
   * products per tag and a pairwise rectangle test over ≤ ~20 tags; no allocation, no
   * draw-call change.
   */
  fade(
    camera: THREE.PerspectiveCamera,
    view: { w: number; h: number },
    focus: { x: number; z: number },
    dt: number,
    reduced: boolean,
  ): void {
    const n = this.tags.length;
    if (n === 0) return;
    this.clock += dt;
    this.refreshOccluders();
    const cp = camera.position;
    const fwd = camera.getWorldDirection(this._fwd);
    const vpH = Math.max(1, view.h), vpW = Math.max(1, view.w);
    // metres of height one CSS px covers at 1 m in front of the lens
    const perPx = (2 * Math.tan((camera.fov * Math.PI) / 360)) / vpH;

    // 1. per tag: where it is, how big on screen, and the rules that do not need the others
    for (let i = 0; i < n; i++) {
      const tag = this.tags[i];
      const label = tag.sprite;
      tag.on = false;
      if (tag.glowLeft > 0) {
        // the glow counts down only while the tag is drawn (last frame), and ends by 30 s
        tag.glowAge += dt;
        if ((label.material as THREE.SpriteMaterial).opacity > GLOW_SEEN) tag.glowLeft = Math.max(0, tag.glowLeft - dt);
        if (tag.glowLeft === 0 || tag.glowAge >= GLOW_MAX_S) this.setGlow(label, 0);
      }
      if (this.shown <= 0 || !Labels.shownInScene(label)) continue;
      const wp = label.getWorldPosition(this._wp);
      const dx = wp.x - cp.x, dy = wp.y - cp.y, dz = wp.z - cp.z;
      const depth = dx * fwd.x + dy * fwd.y + dz * fwd.z;
      if (depth <= 0.5) continue; // behind the camera
      // where it stands on screen and how big, for every tag in front of the lens (one
      // fading out is still drawn there): the card's on-screen height is clamped (a
      // parent's scale is divided out)
      const parentScale = label.parent ? label.parent.getWorldScale(this._ws).y || 1 : 1;
      const px = (tag.h * parentScale) / (depth * perPx);
      const k = px > LABEL_PX_MAX ? LABEL_PX_MAX / px : px < LABEL_PX_MIN ? LABEL_PX_MIN / px : 1;
      const breath = tag.glowLeft > 0 && !reduced ? 1 + GLOW_BREATH * (0.5 - 0.5 * Math.cos((this.clock / GLOW_PERIOD_S) * Math.PI * 2)) : 1;
      label.scale.set(tag.w * k * breath, tag.h * k * breath, 1);
      const ndc = this._ndc.copy(wp).project(camera);
      tag.sx = (ndc.x * 0.5 + 0.5) * vpW;
      tag.sy = (0.5 - ndc.y * 0.5) * vpH;
      tag.hh = (tag.h * k * breath * parentScale) / (depth * perPx) / 2;
      tag.hw = tag.hh * (tag.w / tag.h);
      // the screen's edge: this frame's own, never eased (an eased fade lags a turning
      // view by several frames, and a cut word shows): gone once the card touches the edge
      const inset = Math.min(tag.sx - tag.hw, vpW - (tag.sx + tag.hw), tag.sy - tag.hh, vpH - (tag.sy + tag.hh));
      tag.edge = Math.max(0, Math.min(1, inset / EDGE_FADE_PX));
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const far = (LABEL_FADE_GONE - dist) / (LABEL_FADE_GONE - LABEL_FADE_FULL);
      const near = (dist - LABEL_NEAR_GONE) / (LABEL_NEAR_FULL - LABEL_NEAR_GONE);
      if (Math.min(far, near) <= 0) continue;
      // who shows: the next mission at any distance, the rest only near the ranger
      const fromRanger = Math.hypot(wp.x - focus.x, wp.z - focus.z);
      tag.fromRanger = fromRanger;
      if (!tag.always && tag.glowLeft <= 0 && fromRanger > tag.reach) continue;
      // a building between the lens and the tag hides it (not its own landmark)
      if (this.occluded(cp.x, cp.y, cp.z, wp.x, wp.y, wp.z)) continue;
      tag.dist = dist;
      tag.rank = (tag.always || tag.glowLeft > 0 ? 0 : 1000) + dist;
      tag.on = true;
    }

    // 2. the one that matters more first (the next mission, a glowing tag, then the nearer)
    const order = this.order;
    for (let a = 1; a < n; a++) {
      const v = order[a]; const r = this.tags[v].on ? this.tags[v].rank : Infinity;
      let b = a - 1;
      while (b >= 0 && (this.tags[order[b]].on ? this.tags[order[b]].rank : Infinity) > r) { order[b + 1] = order[b]; b--; }
      order[b + 1] = v;
    }

    // 3. overlap (the later one fades), ease the rules in or out, then the edge as is
    for (let a = 0; a < n; a++) {
      const tag = this.tags[order[a]];
      const mat = tag.sprite.material as THREE.SpriteMaterial;
      let target = 0;
      if (tag.on) {
        const gap = tag.blocked ? OVERLAP_HYST_PX : OVERLAP_GAP_PX;
        let clear = true;
        for (let b = 0; b < a && clear; b++) {
          const o = this.tags[order[b]];
          if (!o.on || o.blocked || o.edge <= 0) continue; // one off the edge hides nothing
          if (Math.abs(tag.sx - o.sx) < tag.hw + o.hw + gap && Math.abs(tag.sy - o.sy) < tag.hh + o.hh + gap) clear = false;
        }
        tag.blocked = !clear;
        if (clear) {
          const d = tag.dist;
          const far = (LABEL_FADE_GONE - d) / (LABEL_FADE_GONE - LABEL_FADE_FULL);
          const near = (d - LABEL_NEAR_GONE) / (LABEL_NEAR_FULL - LABEL_NEAR_GONE);
          target = Math.max(0, Math.min(1, far, near));
        }
      } else tag.blocked = false;
      // the rules (distance, reach, a building, another tag) ease softly; the edge does not
      tag.vis = reduced ? target : tag.vis + (target - tag.vis) * Math.min(1, dt * EASE_PER_S);
      if (tag.vis < 0.004) tag.vis = 0;
      mat.opacity = tag.vis * tag.edge * this.shown;
    }
  }

  /** Dev-hook read-back: every tag drawn now with its words, opacity and screen box. */
  visibleTags(): { text: string; o: number; x: number; y: number; w: number; h: number; glow: boolean; d: number; always: boolean }[] {
    const out: { text: string; o: number; x: number; y: number; w: number; h: number; glow: boolean; d: number; always: boolean }[] = [];
    for (const t of this.tags) {
      const o = (t.sprite.material as THREE.SpriteMaterial).opacity;
      if (o < 0.05 || !Labels.shownInScene(t.sprite)) continue;
      out.push({ text: t.text, o: Math.round(o * 100) / 100, x: Math.round(t.sx - t.hw), y: Math.round(t.sy - t.hh), w: Math.round(t.hw * 2), h: Math.round(t.hh * 2), glow: t.glowLeft > 0, d: Math.round(t.fromRanger * 10) / 10, always: t.always });
    }
    return out;
  }

  /** The buildings (big solid footprints), picked again when the list grows. */
  private refreshOccluders(): void {
    if (this.occluderSeen === this.obstacles.length) return;
    this.occluderSeen = this.obstacles.length;
    this.occluders = this.obstacles.filter((o) => !o.tree && o.r >= OCCLUDER_MIN_R);
  }

  /** Does a solid stand between the lens (c) and a tag (t)? A 2D sightline test against
   *  each footprint (an oriented box, or a circle), then whether the sightline passes
   *  below its roof there. A tag above its own building (the watchtower's) is never
   *  hidden by it. */
  private occluded(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number): boolean {
    for (const o of this.occluders) {
      const ox = tx - o.x, oz = tz - o.z;
      if (ox * ox + oz * oz < o.r * o.r) continue; // the tag's own building
      let t0 = 0, t1 = 1;
      let ax = cx - o.x, az = cz - o.z, bx = tx - o.x, bz = tz - o.z;
      let hx = o.r, hz = o.r;
      if (o.box) {
        const c = Math.cos(o.box.rot), s = Math.sin(o.box.rot);
        const lax = ax * c - az * s, laz = ax * s + az * c;
        const lbx = bx * c - bz * s, lbz = bx * s + bz * c;
        ax = lax; az = laz; bx = lbx; bz = lbz;
        hx = o.box.hx; hz = o.box.hz;
      } else if (!Labels.segCircle(ax, az, bx, bz, o.r)) continue;
      // slab test (the box; for a circle its bounding square, after the circle test)
      const ex = bx - ax, ez = bz - az;
      let hit = true;
      for (let k = 0; k < 2 && hit; k++) {
        const p = k === 0 ? ax : az, d = k === 0 ? ex : ez, hlf = k === 0 ? hx : hz;
        if (Math.abs(d) < 1e-9) { if (p < -hlf || p > hlf) hit = false; continue; }
        let u0 = (-hlf - p) / d, u1 = (hlf - p) / d;
        if (u0 > u1) { const tmp = u0; u0 = u1; u1 = tmp; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
        if (t0 > t1) hit = false;
      }
      if (!hit) continue;
      const roof = this.groundY(o.x, o.z) + (o.h ?? OCCLUDER_DEFAULT_H);
      const yIn = cy + (ty - cy) * t0, yOut = cy + (ty - cy) * t1;
      if (Math.min(yIn, yOut) < roof) return true;
    }
    return false;
  }

  private static segCircle(ax: number, az: number, bx: number, bz: number, r: number): boolean {
    const ex = bx - ax, ez = bz - az;
    const l2 = ex * ex + ez * ez || 1e-9;
    const u = Math.max(0, Math.min(1, -(ax * ex + az * ez) / l2));
    const px = ax + ex * u, pz = az + ez * u;
    return px * px + pz * pz < r * r;
  }

  /** The sprite and every parent are visible (a marker hidden for its mission hides its tag). */
  private static shownInScene(o: THREE.Object3D): boolean {
    for (let at: THREE.Object3D | null = o; at; at = at.parent) if (!at.visible) return false;
    return true;
  }

  private glowTexOf(tag: Tag): THREE.CanvasTexture {
    tag.glowTex ??= Labels.drawCard(tag.text, tag.color, true, (tag.plain.image as HTMLCanvasElement).width).tex;
    return tag.glowTex;
  }

  /** The card: a rounded warm card with a colour pip and the words (dual channel). The
   *  glowing twin has the same size, a sun outline and a warmer card. */
  private static drawCard(text: string, color: string, glow: boolean, fixedW?: number): { tex: THREE.CanvasTexture; w: number; h: number } {
    const pad = 24, fontPx = 44;
    const pipGap = 34; // left pad → colour pip → text: the title baseline starts pad+pipGap in
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    // F-22 re-open: the width MUST cover the whole run — left pad + pip + text + an
    // EQUAL right pad (a glyph must never overflow the canvas' right edge). The glowing
    // twin takes the plain card's width, so swapping them never stretches the words.
    const w = fixedW ?? pad + pipGap + Math.ceil(ctx.measureText(text).width) + pad;
    const h = fontPx + pad * 2;
    c.width = w; c.height = h;
    const r = 22;
    const card = (inset: number): void => {
      const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset, rr = r - inset;
      ctx.beginPath();
      ctx.moveTo(x0 + rr, y0); ctx.arcTo(x1, y0, x1, y1, rr); ctx.arcTo(x1, y1, x0, y1, rr);
      ctx.arcTo(x0, y1, x0, y0, rr); ctx.arcTo(x0, y0, x1, y0, rr); ctx.closePath();
    };
    ctx.fillStyle = glow ? 'rgba(58, 42, 16, 0.9)' : 'rgba(40, 30, 18, 0.78)';
    card(0); ctx.fill();
    if (glow) {
      ctx.strokeStyle = '#f5c23b';
      ctx.lineWidth = 6;
      card(3); ctx.stroke();
    }
    // a colour pip + the title (dual-channel: colour + word)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pad + 10, h / 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glow ? '#fff4d6' : '#fdf6e8';
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + pipGap, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const scale = 0.0042; // world units per px → ~legible without dominating
    return { tex, w: w * scale, h: h * scale };
  }
}
