/**
 * World.ts — the explorable 3D Veluwe (BUILD-PLAN §4). A procedural heath/forest
 * (instanced pines + heather to stay well under the draw-call budget), the real
 * generated ranger you walk around, and one animal "marker" per mission. Tap the
 * ground to walk; tap an animal (or walk up to it) to start that mission.
 *
 * Render layer only — it drives the spine through the onApproach callback and
 * holds no game logic. Camera follows the §1e spec: fixed FOV, exponentially
 * damped follow, roll=0 always, no shake / head-bob / snap-rotate. Under
 * reduced-motion the follow cuts instead of damping and idle motion is off.
 * Every asset is best-effort — missing models fall back to procedural stand-ins.
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';
import { loadManifest, loadModel, prepModel } from './Models';

export interface WorldMarker {
  missionId: string;
  titel: string;
  modelId: string | null;   // generated GLB id, or null → procedural totem
  height: number;           // target world height for the model
  color: string;            // totem / accent colour
}

const SKY_TOP = '#fde8c8', SKY_MID = '#f6cf9e', SKY_LOW = '#e9b27f';
const HEATH = new THREE.Color('#8a9a55');
const FOREST = new THREE.Color('#5d7340');

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

  private readonly ranger = new THREE.Group();
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly camDesired = new THREE.Vector3();
  private readonly camOffset = new THREE.Vector3(0, 3.4, 6.2); // gentle behind-above
  private readonly markers: { group: THREE.Group; pos: THREE.Vector3; missionId: string }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly onApproach: (missionId: string | null) => void;
  private nearId: string | null = null;
  private speed = 2.4;

  constructor(canvas: HTMLCanvasElement, markers: WorldMarker[], onApproach: (missionId: string | null) => void) {
    this.canvas = canvas;
    this.onApproach = onApproach;

    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 22, 90);

    this.scene.add(new THREE.HemisphereLight(0xfde8c8, 0x6d8a45, 0.95));
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.5);
    sun.position.set(-8, 7, 5);
    this.scene.add(sun);

    this.ground = this.buildGround();
    this.scene.add(this.ground);
    this.scatterPines(90);
    this.scatterHeather(220);

    // ranger: procedural stand-in first (instant), real model swaps in when loaded
    this.ranger.add(this.proceduralRanger());
    this.scene.add(this.ranger);

    this.camera.up.set(0, 1, 0);
    this.placeCamera(true);

    this.placeMarkers(markers);
    void this.loadRealRanger();

    canvas.addEventListener('pointerdown', this.onPointer);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  // ---- build ----
  private skyTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.55, SKY_MID); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildGround(): THREE.Mesh {
    // gently rolling heath via a low-frequency vertex displacement
    const geo = new THREE.PlaneGeometry(240, 240, 64, 64);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const h = Math.sin(x * 0.06) * Math.cos(y * 0.05) * 0.8 + Math.sin(x * 0.013 + y * 0.02) * 1.4;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: HEATH, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  /** sample ground height at world x,z (matches buildGround's displacement). */
  private groundY(x: number, z: number): number {
    return Math.sin(x * 0.06) * Math.cos(z * 0.05) * 0.8 + Math.sin(x * 0.013 + z * 0.02) * 1.4;
  }

  private scatterPines(n: number): void {
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6);
    const crownGeo = new THREE.ConeGeometry(0.95, 2.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: FOREST, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
    const m = new THREE.Matrix4();
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const ang = (i * 2.39996); // golden-angle spread
      const rad = 16 + (i / n) * 96;
      const x = Math.cos(ang) * rad + (Math.sin(i * 12.9) * 6);
      const z = Math.sin(ang) * rad + (Math.cos(i * 7.3) * 6);
      if (Math.hypot(x, z) < 12) continue; // keep the clearing around the ranger
      const s = 0.8 + (i % 5) * 0.12;
      const y = this.groundY(x, z);
      m.makeScale(s, s, s); m.setPosition(x, y + 0.6 * s, z);
      trunks.setMatrixAt(placed, m);
      m.makeScale(s, s, s); m.setPosition(x, y + 1.9 * s, z);
      crowns.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = placed; crowns.count = placed;
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  private scatterHeather(n: number): void {
    const geo = new THREE.IcosahedronGeometry(0.32, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#9a6aa8', roughness: 1, flatShading: true });
    const tufts = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const ang = i * 1.7, rad = 6 + (i / n) * 90;
      const x = Math.cos(ang) * rad + Math.sin(i * 3.1) * 5;
      const z = Math.sin(ang) * rad + Math.cos(i * 4.7) * 5;
      const s = 0.5 + (i % 4) * 0.22;
      m.makeScale(s, s * 0.6, s); m.setPosition(x, this.groundY(x, z) + 0.12, z);
      tufts.setMatrixAt(i, m);
    }
    tufts.instanceMatrix.needsUpdate = true;
    this.scene.add(tufts);
  }

  private proceduralRanger(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), mat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#e8c39a', roughness: 1 }));
    head.position.y = 1.32;
    g.add(body, head);
    return g;
  }

  private async loadRealRanger(): Promise<void> {
    await loadManifest();
    const model = await loadModel('ranger-alvah');
    if (!model) return;
    const prepped = prepModel(model, 1.25);
    this.ranger.clear();
    this.ranger.add(prepped);
  }

  private placeMarkers(markers: WorldMarker[]): void {
    const N = Math.max(1, markers.length);
    markers.forEach((mk, i) => {
      const ang = (i / N) * Math.PI * 2;
      const rad = 9;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const group = new THREE.Group();
      group.position.set(x, this.groundY(x, z), z);

      // a soft halo ring so every marker reads as "go here", model or totem
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: mk.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      group.add(this.proceduralTotem(mk.color)); // instant stand-in
      this.scene.add(group);
      this.markers.push({ group, pos: group.position.clone(), missionId: mk.missionId });

      if (mk.modelId) {
        void loadModel(mk.modelId).then((m) => {
          if (!m) return;
          const prepped = prepModel(m, mk.height);
          // drop the totem (keep the ring), add the real animal
          const totem = group.children.find((c) => c.userData.totem);
          if (totem) group.remove(totem);
          group.add(prepped);
        });
      }
    });
  }

  private proceduralTotem(color: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1, 6), new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }));
    post.position.y = 0.5;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: 0.25 }));
    orb.position.y = 1.2;
    g.add(post, orb);
    return g;
  }

  // ---- input ----
  private onPointer = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // 1) a tapped marker → walk over to it (proximity then offers "Speel mee")
    for (const mk of this.markers) {
      const hit = this.raycaster.intersectObject(mk.group, true);
      if (hit.length) {
        const dir = new THREE.Vector3(mk.pos.x, 0, mk.pos.z).sub(new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z));
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(mk.pos.x - dir.x * 1.6, 0, mk.pos.z - dir.z * 1.6); // stop just in front
        return;
      }
    }
    // 2) otherwise walk to the tapped ground point
    const g = this.raycaster.intersectObject(this.ground, false);
    if (g.length) {
      const p = g[0].point;
      this.target.set(p.x, 0, p.z);
    }
  };

  // ---- per-frame ----
  update(dt: number, t: number): void {
    const reduced = prefersReducedMotion();

    // move the ranger toward the walk target
    const rp = this.ranger.position;
    const dx = this.target.x - rp.x, dz = this.target.z - rp.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.06) {
      const step = Math.min(this.speed * dt, dist);
      rp.x += (dx / dist) * step;
      rp.z += (dz / dist) * step;
      this.ranger.rotation.y = Math.atan2(dx, dz);
    }
    rp.y = this.groundY(rp.x, rp.z);

    // gentle idle bob on the animals (off under reduced motion)
    if (!reduced) {
      for (let i = 0; i < this.markers.length; i++) {
        const child = this.markers[i].group.children.find((c) => (c as THREE.Group).children?.length && !c.userData.totem && !(c as THREE.Mesh).isMesh);
        if (child) child.position.y = Math.sin(t * 1.4 + i) * 0.05;
      }
    }

    // proximity → surface the "play" affordance (debounced by id)
    let near: string | null = null;
    for (const mk of this.markers) {
      if (Math.hypot(mk.pos.x - rp.x, mk.pos.z - rp.z) < 2.4) { near = mk.missionId; break; }
    }
    if (near !== this.nearId) { this.nearId = near; this.onApproach(near); }

    this.placeCamera(reduced);
  }

  private placeCamera(snap: boolean): void {
    const rp = this.ranger.position;
    this.camDesired.set(rp.x + this.camOffset.x, rp.y + this.camOffset.y, rp.z + this.camOffset.z);
    if (snap) {
      this.camera.position.copy(this.camDesired);
    } else {
      // exponential damping (~0.3s) — frame-rate independent, no shake
      const a = 1 - Math.exp(-1 / 0.3 * (1 / 60));
      this.camera.position.lerp(this.camDesired, a);
    }
    this.camera.up.set(0, 1, 0); // roll = 0 always
    this.camera.lookAt(rp.x, rp.y + 1.0, rp.z);
  }
}
