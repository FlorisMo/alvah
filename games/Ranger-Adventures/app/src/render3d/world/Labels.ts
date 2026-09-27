/**
 * world/Labels.ts — the diegetic name-tags (mission markers, the Missiebord, the
 * sit-spot, the landmark beacons): a camera-facing sprite per tag, drawn on top of
 * everything so no nearer mesh clips it mid-glyph, and faded out behind the camera
 * and with distance so a far tag never punches through a hill (F-22).
 */

import * as THREE from 'three';

// F-22 occlusion-proof labels: the diegetic name-tags draw with depthTest off so
// no nearer mesh can clip them mid-glyph (see make). The cost of drawing them
// on top of everything is that a far tag would otherwise punch through hills from
// across the map, so each fades OUT with distance — full opacity within FULL m
// (the hub / an open mission, i.e. the moment the label matters), gone by GONE m.
// Wave 2: nearer than before (55 → 85 m): now that a far tag stays readable (the size
// floor below) a whole horizon of them read as a wall of words; the HUD chip names the
// way to anything further.
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

export class Labels {
  // every diegetic world/vehicle/POI name-tag make() builds, so one per-frame pass
  // (fade) can keep them all occlusion-proof + distance-faded.
  private readonly list: THREE.Sprite[] = [];
  private readonly _fwd = new THREE.Vector3();  // scratch: camera forward for the label fade
  private readonly _wp = new THREE.Vector3();   // scratch: a label's world position
  private readonly _ws = new THREE.Vector3();   // scratch: a label's parent world scale
  private readonly baseSize = new Map<THREE.Sprite, { w: number; h: number }>(); // its world size before the clamp

  /** A camera-facing sprite name-tag (rounded warm card + the mission title). */
  make(text: string, color: string): THREE.Sprite {
    const pad = 24, fontPx = 44;
    const pipGap = 34; // left pad → colour pip → text: the title baseline starts pad+pipGap in
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    // F-22 re-open: the width MUST cover the whole run — left pad + pip + text + an
    // EQUAL right pad. The old `textW + pad*2` ignored the pipGap the title is drawn
    // at, so the last glyph overflowed the canvas' right edge and clipped
    // ("Missiebord" → "Missieborc"). Deriving both from pipGap keeps them in lockstep.
    const w = pad + pipGap + Math.ceil(ctx.measureText(text).width) + pad;
    const h = fontPx + pad * 2;
    c.width = w; c.height = h;
    // rounded warm card
    const r = 22;
    ctx.fillStyle = 'rgba(40, 30, 18, 0.78)';
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath(); ctx.fill();
    // a colour pip + the title (dual-channel: colour + word)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pad + 10, h / 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fdf6e8';
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + pipGap, h / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // F-22: depthTest OFF + a high renderOrder → a nearer mesh (the giant avatar's
    // leg in Run A, the board planks, a pine, the parked jeep) can no longer
    // depth-occlude the tag and cut the one string that names the object mid-glyph.
    // depthWrite stays off so the tag never pollutes the depth buffer for what draws
    // after it. The always-on-top trade-off is bounded by the per-frame
    // distance/behind-camera fade in fade().
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 12; // draw after the opaque world + props so it composites over them
    const scale = 0.0042; // world units per px → ~legible without dominating
    sprite.scale.set(w * scale, h * scale, 1);
    this.baseSize.set(sprite, { w: w * scale, h: h * scale });
    this.list.push(sprite); // registered for the F-22 occlusion-proof distance fade
    return sprite;
  }

  /**
   * F-22: keep every diegetic name-tag readable. make() draws them with depthTest off
   * + a high renderOrder, so a nearer mesh can never clip a tag mid-glyph; the cost is
   * that a far tag would punch through hills, so each fades out behind the camera and
   * with distance. Wave 2: each tag's card is also held between LABEL_PX_MIN and
   * LABEL_PX_MAX tall on screen (`viewportPx` = the canvas height in CSS px) and fades
   * out when the lens nearly touches it — never a giant card filling the frame. Cheap:
   * a dot, a length and a scale per tag, no allocation, no draw-call change.
   */
  fade(camera: THREE.PerspectiveCamera, viewportPx: number): void {
    if (this.list.length === 0) return;
    const cp = camera.position;
    const fwd = camera.getWorldDirection(this._fwd);
    // metres of height one CSS px covers at 1 m in front of the lens
    const perPx = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, viewportPx);
    for (const label of this.list) {
      const mat = label.material as THREE.SpriteMaterial;
      const wp = label.getWorldPosition(this._wp);
      const dx = wp.x - cp.x, dy = wp.y - cp.y, dz = wp.z - cp.z;
      const depth = dx * fwd.x + dy * fwd.y + dz * fwd.z;
      if (depth <= 0.5) { mat.opacity = 0; continue; } // behind the camera
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const far = (LABEL_FADE_GONE - dist) / (LABEL_FADE_GONE - LABEL_FADE_FULL);
      const near = (dist - LABEL_NEAR_GONE) / (LABEL_NEAR_FULL - LABEL_NEAR_GONE);
      mat.opacity = Math.max(0, Math.min(1, far, near));
      // clamp the card's on-screen height (a parent's scale is divided out)
      const base = this.baseSize.get(label);
      if (!base) continue;
      const parentScale = label.parent ? label.parent.getWorldScale(this._ws).y || 1 : 1;
      const px = (base.h * parentScale) / (depth * perPx);
      const k = px > LABEL_PX_MAX ? LABEL_PX_MAX / px : px < LABEL_PX_MIN ? LABEL_PX_MIN / px : 1;
      label.scale.set(base.w * k, base.h * k, 1);
    }
  }
}
