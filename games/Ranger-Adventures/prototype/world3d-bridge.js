// ============================================================================
//  world3d-bridge.js — the 3D-INTEGRATION-PASS bridge (HANDOFF §6.5 / §12.9)
// ----------------------------------------------------------------------------
//  Turns the proven Stage + procedural Alvah into ONE continuous golden-hour
//  Veluwe you walk through. It does NOT touch the game: the five EF-engines,
//  the content registry, badges, skill, story and reduced-motion stay exactly
//  as they are. This module is the *render-layer* glue only:
//
//   • builds the world (reuses stage.js unchanged) + loads Alvah (character.js)
//   • plants data-driven in-world INTERACTABLES (Missie 1's 3 steps become 3
//     places, not 3 screens) + diegetic landmarks (huisje, uitkijktoren)
//   • a calm WAYFINDING beam over the current objective
//   • eased camera PUSH-IN / PULL-OUT around an interactable (the "moment in
//     the world" choreography) — never a separate puzzle screen / route change
//   • proximity + screen-projection feed, so the React layer can float the one
//     consistent interact-prompt and run the real engine in situ
//   • a real 3D reduced-motion mode (no auto-orbit, longer eased transitions)
//
//  React (world3d.jsx) owns the engines + diegetic UI and talks to this module
//  through `window.V3D`. Clean split: Three.js here, React there.
// ============================================================================

import * as THREE from 'three';
import { Stage } from './stage.js';
import { loadCharacter } from './character.js';
import { SPECS } from './specs.js';

// ── the world's interactables: Missie 1's three EF-steps, placed in space ────
//  kind = which EF-engine runs here; stepN = which step skin in MISSIE_FRISLING.
//  Order in this array == the objective order the wayfinding beam follows.
const INTERACTABLES = [
  { id: 'zoekplek',    kind: 'zoeken',   missie: 'frisling', stepN: 1, label: 'Zoek de big',     korte: 'in het gras', pos: [-6.0, 0, 2.5],  color: '#f5c23b' },
  { id: 'sporenpad',   kind: 'corsi',    missie: 'frisling', stepN: 2, label: 'Onthoud de weg',  korte: 'over de stenen', pos: [6.5, 0, 3.0], color: '#8fd0c0' },
  // completing frisling's last step drops the season's FIRST clue ('spoor').
  { id: 'schemerplek', kind: 'dagnacht', missie: 'frisling', stepN: 3, label: 'Blijf rustig',    korte: 'bij het ven',  pos: [1.5, 0, -7.0],  color: '#b79ad9', clue: 'spoor' },
  // a SECOND living species lives here: walk up to the fox den + answer the fox (simon).
  { id: 'vossenhol',   kind: 'simon',    missie: 'vos',      stepN: 1, label: 'Antwoord de vos', korte: 'bij het hol',  pos: [8.5, 0, -4.0],  color: '#d2823c', dier: 'vos' },
  // ── season-arc STORY moments (HANDOFF §6.4/§7.3). Each completes a mission
  //    tagged verhaalHaak and DROPS one clue. They UNLOCK in chapter order via
  //    `naClue` so the season only ever moves forward (lente→zomer→herfst); the
  //    case-board renders the clues + the hopeful resolution.
  { id: 'wildcamera',  kind: 'simon',    missie: 'wildcamera', stepN: 1, label: 'Hang de camera op',      korte: 'in het bos',       pos: [-9.5, 0, -5.5], color: '#7fb0d8', clue: 'camera', naClue: 'spoor' },
  { id: 'ecoduct',     kind: 'corsi',    missie: 'ecoduct',    stepN: 1, label: 'Kijk bij de oversteek',   korte: 'over het ecoduct', pos: [11.5, 0, 4.5],  color: '#9bd07f', clue: 'band',   naClue: 'camera' },
  // the cabin's diegetic prikbord — always walk-up-able, never "done".
  { id: 'prikbord',    kind: 'caseboard',                              label: 'Bekijk het prikbord',     korte: 'bij het huisje',   pos: [-3.6, 0, 8.0],  color: '#c89f6c' },
];

// where the fox lives (its wander home zone)
const FOX_HOME = [8.5, -4.0];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => t < 0 ? 0 : t > 1 ? 1 : t;

let resolveReady;
const V3D = {
  ready: new Promise((res) => { resolveReady = res; }),
  stage: null,
  alvah: null,
  fox: null,
  interactables: INTERACTABLES.map(i => ({ ...i, done: false })),
  _frameCb: null,
  _drive: { f: 0, b: 0, l: 0, r: 0, run: false },
  reduceMotion: false,
  busy: false,                 // a camera tween is running
  inSitu: null,                // id of the interactable we're zoomed into

  onFrame(cb) { this._frameCb = cb; },
  setLocks() {},               // overwritten in boot() once markers exist
  setDriveInput(i) { Object.assign(this._drive, i); if (this.alvah) this.alvah.setInput(this._drive); },
  setReducedMotion(b) {
    this.reduceMotion = !!b;
    if (this.stage) this.stage.setFlag('autoRotate', false);   // comfort: never auto-orbit
  },
};
window.V3D = V3D;

// ---------------------------------------------------------------------------
boot();
async function boot() {
  const sceneEl = document.getElementById('scene');
  const perfEl = document.getElementById('perf');
  const stage = new Stage(sceneEl, { perfEl });
  V3D.stage = stage;

  // comfort defaults: gentle trailing third-person, no auto-orbit, moderate zoom
  stage.setFlag('autoRotate', false);
  stage.controls.minDistance = 2.2;
  stage.controls.maxDistance = 9;
  stage.reduceMotion = stage.reduceMotion;             // keep OS pref
  V3D.reduceMotion = stage.reduceMotion;

  buildLandmarks(stage);
  const markers = buildInteractables(stage);

  await stage.whenReady;

  // load Alvah (procedural ranger on the CC0 rig) — reused unchanged
  const alvah = await loadCharacter(stage, SPECS.ranger);
  V3D.alvah = alvah;
  alvah.setHat(true);
  alvah.setGait('manual');           // the player drives; idles when no input
  alvah.setEmotion('kalm');
  stage.followTarget(alvah.model);

  // load the FOX (CC0 Khronos Fox) — a SECOND living species via the SAME engine.
  // Proves the <Dier>-abstraction: a different spec (own rig/clip/axis names, fur,
  // tail secondary-motion, eyes, emotion-POSE) drops in unchanged. It wanders its
  // own home-zone near the den (spec.locomotion.home/homeRadius, generic).
  let foxNoticed = false;
  try {
    const foxSpec = { ...SPECS.vos, locomotion: { ...SPECS.vos.locomotion, home: FOX_HOME, homeRadius: 2.6 } };
    const fox = await loadCharacter(stage, foxSpec);
    V3D.fox = fox;
    fox.model.position.set(FOX_HOME[0], 0, FOX_HOME[1]);
    fox.setGait('auto'); fox.setEmotion('kalm');
  } catch (e) { console.warn('fox load skipped', e); }

  // frame Alvah nicely at the start
  placeCameraBehind(stage, alvah.model, 5.4, 2.4, true);

  // ── camera choreography state ──────────────────────────────────────────
  const cam = { mode: 'free', t: 0, dur: 1, sp: new THREE.Vector3(), st: new THREE.Vector3(), ep: new THREE.Vector3(), et: new THREE.Vector3(), onArrive: null };
  function tweenTo(endPos, endTarget, dur, onArrive) {
    cam.mode = 'move'; cam.t = 0; cam.dur = dur;
    cam.sp.copy(stage.camera.position); cam.st.copy(stage.controls.target);
    cam.ep.copy(endPos); cam.et.copy(endTarget); cam.onArrive = onArrive || null;
    stage.controls.enabled = false;          // user can't drag mid-move
    stage.flags.follow = false;
  }

  // push the camera in onto an interactable (the "moment in the world")
  V3D.interact = function (id) {
    const it = V3D.interactables.find(x => x.id === id); if (!it) return;
    V3D.busy = true; V3D.inSitu = id;
    alvah.setGait('rust'); alvah.setEmotion('alert');
    // if this moment is the fox's, settle the fox so it's present + attentive
    if (it.dier === 'vos' && V3D.fox) { foxNoticed = true; V3D.fox.setGait('rust'); V3D.fox.setEmotion('alert'); }
    const target = new THREE.Vector3(it.pos[0], 0.55, it.pos[2]);
    // keep the current viewing direction, pull to a calm close framing
    _v.copy(stage.camera.position).sub(target); _v.y = 0;
    if (_v.lengthSq() < 0.01) _v.set(0, 0, 1);
    _v.normalize();
    const endPos = target.clone().addScaledVector(_v, 3.4); endPos.y = 1.9;
    tweenTo(endPos, target, V3D.reduceMotion ? 2.0 : 1.05, () => { V3D.busy = false; });
  };

  // ease back out to free-roam third-person around Alvah
  V3D.endInteract = function () {
    V3D.busy = true;
    alvah.setEmotion('kalm');
    const a = alvah.model.position;
    const target = new THREE.Vector3(a.x, 0.55, a.z);
    _v.copy(stage.camera.position).sub(target); _v.y = 0;
    if (_v.lengthSq() < 0.01) _v.set(0, 0, 1);
    _v.normalize();
    const endPos = target.clone().addScaledVector(_v, 5.4); endPos.y = 2.4;
    tweenTo(endPos, target, V3D.reduceMotion ? 2.0 : 1.1, () => {
      V3D.busy = false; V3D.inSitu = null;
      stage.controls.enabled = true; stage.flags.follow = true;
      alvah.setGait('manual'); alvah.setInput(V3D._drive);
      if (V3D.fox) { foxNoticed = false; V3D.fox.setGait('auto'); V3D.fox.setEmotion('kalm'); }
    });
  };

  // mark an interactable solved → marker becomes a wooden notch-post; objective advances
  V3D.completeInteractable = function (id) {
    const it = V3D.interactables.find(x => x.id === id); if (it) it.done = true;
    const m = markers[id]; if (m) m.complete();
  };

  // field work is done when every EF post (not the always-open case-board) is solved
  V3D.allDone = function () { return V3D.interactables.filter(x => x.kind !== 'caseboard').every(x => x.done); };
  // the wayfinding beam follows the next UNLOCKED, unsolved EF post (skips the board)
  V3D.nextObjective = function () { return V3D.interactables.find(x => !x.done && !x.locked && x.kind !== 'caseboard') || null; };
  // React drives chapter-gating: lock posts whose prerequisite clue isn't found yet
  V3D.setLocks = function (ids) {
    const set = new Set(ids || []);
    for (const it of V3D.interactables) {
      const locked = set.has(it.id);
      it.locked = locked;
      const m = markers[it.id]; if (m && m.setLocked) m.setLocked(locked);
    }
  };

  resolveReady(V3D);

  // ── main loop ──────────────────────────────────────────────────────────
  const tmpScreen = new THREE.Vector2();
  function project(pos3, y) {
    _v2.set(pos3[0], y == null ? 0.9 : y, pos3[2]).project(stage.camera);
    const W = window.innerWidth, H = window.innerHeight;
    const behind = _v2.z > 1;
    return { x: (_v2.x * 0.5 + 0.5) * W, y: (-_v2.y * 0.5 + 0.5) * H, behind };
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(stage.clock.getDelta(), 0.05);

    // camera tween (overrides Stage follow while it runs)
    if (cam.mode === 'move') {
      cam.t += dt / cam.dur; const k = smooth(clamp01(cam.t));
      stage.camera.position.lerpVectors(cam.sp, cam.ep, k);
      stage.controls.target.lerpVectors(cam.st, cam.et, k);
      if (cam.t >= 1) { cam.mode = 'free'; if (cam.onArrive) { const f = cam.onArrive; cam.onArrive = null; f(); } }
    }

    // markers: bob + beam pulse on the active objective
    const objective = V3D.nextObjective();
    const t = stage.clock.elapsedTime;
    for (const id in markers) markers[id].update(dt, t, objective && objective.id === id, stage.flags.motion && !V3D.reduceMotion);

    if (V3D.alvah) V3D.alvah.update(dt);
    // the fox lives its own life: wanders its home-zone, but stops to NOTICE the
    // ranger when he comes close (a small, calm sign it's alive + aware).
    if (V3D.fox) {
      const a = V3D.alvah ? V3D.alvah.model.position : null;
      const f = V3D.fox.model.position;
      if (a && !V3D.inSitu && !V3D.busy) {
        const near = Math.hypot(a.x - f.x, a.z - f.z) < 3.4;
        if (near) {
          if (V3D.fox.gait !== 'rust') { V3D.fox.setGait('rust'); V3D.fox.setEmotion('alert'); }
          V3D.fox.model.rotation.y = Math.atan2(a.x - f.x, a.z - f.z) + (V3D.fox.spec.locomotion.headingOffset || 0);
        } else if (V3D.fox.gait === 'rust' && !foxNoticed) {
          V3D.fox.setGait('auto'); V3D.fox.setEmotion('kalm');
        }
      }
      V3D.fox.update(dt);
    }
    stage.update(dt);

    // feed the React layer: nearest interactable, prompt position, objective marker
    if (V3D._frameCb && V3D.alvah) {
      const a = V3D.alvah.model.position;
      let near = null, nearDist = 1e9;
      for (const it of V3D.interactables) {
        if (it.done || it.locked) continue;          // locked story posts aren't here yet
        const d = Math.hypot(a.x - it.pos[0], a.z - it.pos[2]);
        if (d < nearDist) { nearDist = d; near = it; }
      }
      const inReach = near && nearDist < 2.6 && !V3D.busy && !V3D.inSitu;
      const obj = (!V3D.inSitu && objective) ? { id: objective.id, ...project(objective.pos, 1.9), dist: Math.hypot(a.x - objective.pos[0], a.z - objective.pos[2]) } : null;
      V3D._frameCb({
        prompt: inReach ? { id: near.id, label: near.label, ...project(near.pos, 1.0) } : null,
        objective: obj,
        inSitu: V3D.inSitu,
        busy: V3D.busy,
        alvahScreen: project([a.x, 0, a.z], 1.7),
        alvahPos: [a.x, a.z],
        alvahRot: V3D.alvah.model.rotation.y,
        foxPos: V3D.fox ? [V3D.fox.model.position.x, V3D.fox.model.position.z] : null,
        moving: !!(V3D._drive.f || V3D._drive.b),
        doneCount: V3D.interactables.filter(x => x.done && x.kind !== 'caseboard').length,
        total: V3D.interactables.filter(x => x.kind !== 'caseboard').length,
      });
    }
  }
  animate();
}

// ── procedural diegetic landmarks (huisje-hub + uitkijktoren) ───────────────
function buildLandmarks(stage) {
  const scene = stage.scene;
  const grp = new THREE.Group(); scene.add(grp);

  // het huisje — the hub/home, warm wood + green roof
  const cabin = new THREE.Group(); cabin.position.set(-1.5, 0, 9.5); cabin.rotation.y = -0.5;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 2.0),
    new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 })); wall.position.y = 0.75; wall.castShadow = wall.receiveShadow = true; cabin.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: '#33603b', roughness: 1, flatShading: true })); roof.position.y = 2.05; roof.rotation.y = Math.PI / 4; roof.castShadow = true; cabin.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.1),
    new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 })); door.position.set(0, 0.48, 1.0); cabin.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1),
    new THREE.MeshStandardMaterial({ color: '#f5c23b', emissive: '#caa033', emissiveIntensity: 0.4, roughness: 0.7 })); win.position.set(0.75, 0.85, 1.0); cabin.add(win);
  grp.add(cabin);

  // de uitkijktoren — the fire-tower vantage (wayfinding landmark, visible from afar)
  const tower = new THREE.Group(); tower.position.set(13, 0, -10);
  const legMat = new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 1 });
  for (const [sx, sz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 5), legMat);
    leg.position.set(sx, 2.7, sz); leg.rotation.x = sz * 0.02; leg.rotation.z = -sx * 0.02; leg.castShadow = true; tower.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 2.0), legMat); deck.position.y = 5.4; deck.castShadow = true; tower.add(deck);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.5),
    new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 })); hut.position.y = 6.0; hut.castShadow = true; tower.add(hut);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4),
    new THREE.MeshStandardMaterial({ color: '#33603b', roughness: 1, flatShading: true })); towerRoof.position.y = 6.85; towerRoof.rotation.y = Math.PI / 4; tower.add(towerRoof);
  grp.add(tower);

  // a quiet ven (water) near the dusk interactable
  const ven = new THREE.Mesh(new THREE.CircleGeometry(3.2, 36),
    new THREE.MeshStandardMaterial({ color: '#43607a', roughness: 0.25, metalness: 0.0, envMapIntensity: 1.1 }));
  ven.rotation.x = -Math.PI / 2; ven.position.set(2.2, 0.02, -8.5); scene.add(ven);

  // de vossenburcht — an earth mound + dark den entrance where the fox lives
  const den = new THREE.Group(); den.position.set(8.5, 0, -4.6); den.rotation.y = -0.4;
  const sand = new THREE.MeshStandardMaterial({ color: '#9c7a4e', roughness: 1 });
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), sand);
  mound.scale.set(1, 0.5, 1.1); mound.position.y = 0; mound.receiveShadow = true; mound.castShadow = true; den.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.52, 22),
    new THREE.MeshStandardMaterial({ color: '#1a1206', roughness: 1 }));
  hole.rotation.x = -0.95; hole.position.set(0, 0.42, 1.0); den.add(hole);
  // a little spoil of excavated sand + two stones by the entrance
  const spoil = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), sand);
  spoil.scale.set(1.3, 0.35, 1); spoil.position.set(0.2, 0, 1.7); den.add(spoil);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#7d7568', roughness: 1, flatShading: true });
  [[-1.1, 1.4, 0.34], [1.2, 0.9, 0.28]].forEach(([x, z, r]) => {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), stoneMat);
    st.position.set(x, r * 0.6, z); st.castShadow = true; den.add(st);
  });
  grp.add(den);

  grp.traverse(o => { if (o.isMesh) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(m => stage.registerEnvMat(m, 'world')); } });
  stage.registerEnvMat(ven.material, 'world');
}

// ── interactable markers: ground-ring + bobbing orb + objective light-beam ──
function buildInteractables(stage) {
  const scene = stage.scene;
  const markers = {};
  for (const it of INTERACTABLES) {
    if (it.kind === 'caseboard') { markers[it.id] = buildCaseBoardMarker(stage, it); continue; }
    const grp = new THREE.Group(); grp.position.set(it.pos[0], 0, it.pos[2]); scene.add(grp);
    if (it.naClue) grp.visible = false;          // chapter-gated: hidden until its clue is found
    const col = new THREE.Color(it.color);

    // soft ground ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);

    // bobbing orb (the "something here" beacon)
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, roughness: 0.4, flatShading: true }));
    orb.position.y = 1.0; orb.castShadow = false; grp.add(orb);

    // objective light-beam (only lit when this is the active objective)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 7, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 3.5; grp.add(beam);

    // wooden notch-post — hidden until solved (the honest, earned consequence)
    const post = new THREE.Group(); post.visible = false; grp.add(post);
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 1 })); stake.position.y = 0.55; stake.castShadow = true; post.add(stake);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.06),
      new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 })); notch.position.y = 1.0; post.add(notch);

    [ring.material, orb.material, beam.material, post].forEach(() => {});
    [orb.material, post.children[0].material, post.children[1].material].forEach(m => stage.registerEnvMat(m, 'world'));

    markers[it.id] = {
      grp, ring, orb, beam, post, done: false,
      setLocked(b) { this.grp.visible = !b; },
      update(dt, t, isObjective, motion) {
        if (this.done) return;
        if (motion) { this.orb.position.y = 1.0 + Math.sin(t * 1.8) * 0.12; this.orb.rotation.y += dt * 0.8; }
        const wantBeam = isObjective ? (0.16 + (motion ? Math.sin(t * 2.0) * 0.06 : 0)) : 0.0;
        this.beam.material.opacity += (wantBeam - this.beam.material.opacity) * Math.min(1, dt * 4);
        const wantRing = isObjective ? 0.7 : 0.32;
        this.ring.material.opacity += (wantRing - this.ring.material.opacity) * Math.min(1, dt * 4);
      },
      complete() {
        this.done = true;
        this.orb.visible = false; this.ring.visible = false; this.beam.visible = false;
        this.post.visible = true;
      },
    };
  }
  return markers;
}

// ── the cabin case-board: a diegetic cork prikbord (HANDOFF §6.4 / §12.9) ───
//  Not an EF post — you walk up and READ it. React opens the case-board panel;
//  this is just the in-world object + a soft "you can look here" ground ring.
function buildCaseBoardMarker(stage, it) {
  const scene = stage.scene;
  const grp = new THREE.Group(); grp.position.set(it.pos[0], 0, it.pos[2]); grp.rotation.y = 0.55; scene.add(grp);
  const col = new THREE.Color(it.color);

  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 1 });
  // two legs
  for (const sx of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6), woodMat);
    leg.position.set(sx, 0.75, 0); leg.castShadow = true; grp.add(leg);
  }
  // the cork board (tilted back a touch so it faces a walk-up ranger)
  const board = new THREE.Group(); board.position.set(0, 1.28, 0); board.rotation.x = -0.13; grp.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 0.08),
    new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 1 })); frame.castShadow = true; board.add(frame);
  const cork = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.96, 0.04),
    new THREE.MeshStandardMaterial({ color: '#c89f6c', roughness: 1 })); cork.position.z = 0.04; board.add(cork);
  // three pinned "photos" + a faint string between them
  const paper = new THREE.MeshStandardMaterial({ color: '#fdfbf4', roughness: 0.9 });
  [[-0.45, 0.12], [0.02, -0.04], [0.46, 0.1]].forEach(([x, y], i) => {
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.02), paper);
    ph.position.set(x, y, 0.07); ph.rotation.z = (i - 1) * 0.06; board.add(ph);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#b23b22', roughness: 0.5 }));
    pin.position.set(x, y + 0.16, 0.09); board.add(pin);
  });

  // soft ground ring (the calm "look here" beacon)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 36),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);

  grp.traverse(o => { if (o.isMesh) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(m => stage.registerEnvMat(m, 'world')); } });

  return {
    grp, ring, done: false,
    setLocked() {},
    complete() {},
    update(dt, t, isObjective, motion) {
      const want = 0.34 + (motion ? Math.sin(t * 1.6) * 0.1 : 0);
      this.ring.material.opacity += (want - this.ring.material.opacity) * Math.min(1, dt * 4);
    },
  };
}

// ── helper: drop the camera behind a model at a comfy third-person framing ──
function placeCameraBehind(stage, model, dist, height, instant) {
  const p = model.position;
  const heading = model.rotation.y;
  const bx = p.x - Math.sin(heading) * dist;
  const bz = p.z - Math.cos(heading) * dist;
  stage.camera.position.set(bx, height, bz);
  stage.controls.target.set(p.x, 0.55, p.z);
  stage.controls.update();
}
