// ============================================================================
//  stage.js — Stage-klasse + STAGE_CONFIG (gedeeld, dier-ONAFHANKELIJK)
// ----------------------------------------------------------------------------
//  TUNING-NIVEAU 1 (hele wereld/look): pas STAGE_CONFIG aan om de héle scène te
//  tunen. Eén-dier-tunables staan in specs.js — niet hier.
//
//  Verhuisd uit de Vos-POC: renderer/composer/post, golden-hour licht-rig,
//  TIMES dagdeel-presets, HDRI/IBL, procedurele heide-grond + geïnstanceerde
//  props (gras/heide/dennen/rotsen/stof), volg-cam, perf-overlay, reduced-motion.
//
//  Hooks die characters gebruiken (character.js):
//    stage.scene                  — de THREE.Scene
//    stage.registerEnvMat(m,owner)— materiaal mee laten dimmen met het dagdeel
//    stage.releaseEnvMats(owner)  — bij character-wissel weer afmelden
//    stage.followTarget(obj)      — volg-cam + licht + contactschaduw volgen dit object
//    stage.flags                  — { motion, follow, shadow, autoRotate } (gedeelde toggles)
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export const STAGE_CONFIG = {
  pixelRatioCap: 1.5,                 // perf: cap 2->1.5 (~44% minder fragment-werk)
  shadowMapSize: 1024,               // perf: 2048->1024 = ¼ shadow-fragmentwerk
  grassCount: 3000,                  // perf: was 6000
  props: { heather: 150, pines: 10, rocks: 9, motes: 260 },
  worldRadius: 60,
  roamRadius: 11,                    // dieren blijven binnen deze straal
  camera: {
    fov: 36, near: 0.1, far: 200,
    start: [3.6, 2.6, 5.0], targetY: 0.65,
    minDist: 1.2, maxDist: 12, maxPolar: Math.PI * 0.49,
    autoRotateSpeed: 0.4, followSmoothing: 0.0005, followY: 0.55,
  },
  hdri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/spruit_sunrise_1k.hdr',
  startTime: 'sunrise',
  // per dagdeel: key-kleur/intensiteit/hoek, hemi-fill, fog, exposure, achtergrond+env, motes, bloom, contact
  times: {
    sunrise: { keyColor:'#ffc488', keyInt:2.1,  keyPos:[-6,4.6,3], hemiSky:'#cfe0f5', hemiGround:'#6b5638', hemiInt:0.25, rimColor:'#ffd6a0', rimInt:1.15, rimPos:[6,3,-5],   fog:'#d8c49c', fogNear:16, fogFar:40, exposure:1.0,  bgInt:1.0,  envMul:1.0,  mote:'#ffe7b0', moteOp:0.55, bloom:0.14, contactOp:0.50 },
    day:     { keyColor:'#fff3df', keyInt:2.7,  keyPos:[-3,8.5,2], hemiSky:'#bcd8ff', hemiGround:'#8a7a55', hemiInt:0.50, rimColor:'#ffffff', rimInt:0.50, rimPos:[5,5,-4],   fog:'#cdd6c2', fogNear:22, fogFar:58, exposure:1.05, bgInt:1.15, envMul:1.2,  mote:'#fff3d0', moteOp:0.28, bloom:0.08, contactOp:0.55 },
    sunset:  { keyColor:'#ff8a47', keyInt:2.25, keyPos:[-7,3.2,2], hemiSky:'#aebfe0', hemiGround:'#7a4630', hemiInt:0.22, rimColor:'#ffb070', rimInt:1.30, rimPos:[7,2.6,-5], fog:'#c6975f', fogNear:14, fogFar:38, exposure:0.95, bgInt:0.95, envMul:0.92, mote:'#ffcf9a', moteOp:0.55, bloom:0.17, contactOp:0.50 },
    night:   { keyColor:'#aac4ff', keyInt:0.55, keyPos:[-5,6,3],   hemiSky:'#2c3e63', hemiGround:'#171f2e', hemiInt:0.40, rimColor:'#9fc0ff', rimInt:0.80, rimPos:[6,3.5,-5], fog:'#1b2540', fogNear:10, fogFar:30, exposure:0.60, bgInt:0.22, envMul:0.30, mote:'#bcd4ff', moteOp:0.42, bloom:0.22, contactOp:0.28 },
  },
};

export class Stage {
  constructor(appEl, opts = {}) {
    this.cfg = STAGE_CONFIG;
    this.appEl = appEl;
    this.perfEl = opts.perfEl || null;
    this.onStatus = opts.onStatus || (() => {});
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.preserveDB = !!opts.preserveDrawingBuffer;   // harness/screenshot only — default off (perf)
    this.flags = { motion: true, follow: true, shadow: true, autoRotate: true };

    this.followObj = null;
    this.envMats = [];
    this.windMats = [];
    this.clock = new THREE.Clock();
    this._dummy = new THREE.Object3D();
    this._shadowPrev = new THREE.Vector3(1e9, 0, 0);

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._initWorld();
    this._initPost();
    this._initPerf();
    this._initTime();

    this._collectWorldEnv();
    this.setTime(this.cfg.startTime, true);

    // env (HDRI) — resolve whenReady zodra de environment klaar is (succes of fallback)
    this.whenReady = this._initEnv();

    window.addEventListener('resize', () => this._onResize());
  }

  // ---- renderer / scene / camera / controls ----
  _initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: this.preserveDB });
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.cfg.pixelRatioCap));
    r.info.autoReset = false;            // perf: zelf resetten zodat de overlay over de HELE frame leest
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.appEl.appendChild(r.domElement);
    this.renderer = r;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#d8c49c', 16, 40);
    const c = this.cfg.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, window.innerWidth / window.innerHeight, c.near, c.far);
    this.camera.position.set(...c.start);
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.target.set(0, c.targetY, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = c.minDist; controls.maxDistance = c.maxDist;
    controls.maxPolarAngle = c.maxPolar; controls.enablePan = false;
    controls.autoRotate = true; controls.autoRotateSpeed = c.autoRotateSpeed;
    controls.update();
    this.controls = controls;
    this._prevTarget = controls.target.clone();
  }

  _initLights() {
    const key = new THREE.DirectionalLight('#ffc488', 2.1);
    key.position.set(-6, 5, 3); key.castShadow = true;
    key.shadow.mapSize.set(this.cfg.shadowMapSize, this.cfg.shadowMapSize);
    key.shadow.autoUpdate = false;        // perf: alleen hertekenen als de zon/het dier echt bewoog
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    const sd = 7;
    key.shadow.camera.left = -sd; key.shadow.camera.right = sd; key.shadow.camera.top = sd; key.shadow.camera.bottom = -sd;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
    this.scene.add(key); this.scene.add(key.target);
    const hemi = new THREE.HemisphereLight('#cfe0f5', '#6b5638', 0.25);
    this.scene.add(hemi);
    const rim = new THREE.DirectionalLight('#ffd6a0', 1.15);   // warme rim — golden-hour silhouet (research C2)
    rim.position.set(6, 3, -5); rim.castShadow = false;
    this.scene.add(rim); this.scene.add(rim.target);
    this.key = key; this.hemi = hemi; this.rim = rim;
  }

  // ---- procedural world ----
  _heathTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#6b7a48'; g.fillRect(0, 0, 512, 512);
    const blobs = [['#7d8a52', 260], ['#5a6a3e', 240], ['#49562f', 200], ['#a99a6b', 120], ['#7a5d7e', 70]];
    for (const [col, n] of blobs) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 34;
        g.globalAlpha = 0.25 + Math.random() * 0.4; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * 6, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.anisotropy = 4; return t;
  }
  _radialTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(20,28,14,.55)'); grd.addColorStop(1, 'rgba(20,28,14,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  _makeGrassMat() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = { value: 0 }; this.windMats.push(sh.uniforms);
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         float h01=clamp(position.y/0.3,0.0,1.0);
         float ph=instanceMatrix[3].x*0.6+instanceMatrix[3].z*0.6;
         transformed.x+=sin(uTime*1.6+ph)*0.06*h01*h01;
         transformed.z+=cos(uTime*1.2+ph)*0.04*h01*h01;`); };
    return m;
  }
  _initWorld() {
    const dummy = this._dummy;
    // ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(this.cfg.worldRadius, 72),
      new THREE.MeshStandardMaterial({ map: this._heathTexture(), roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    // contact shadow under the active character
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: this._radialTex(), transparent: true, depthWrite: false, opacity: .5 }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = .012; this.scene.add(contact); this.contact = contact;

    // wind-swaying grass (instanced)
    const blade = new THREE.PlaneGeometry(0.022, 0.3, 1, 2); blade.translate(0, 0.15, 0);
    { const p = blade.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const f = 1.0 - (y / 0.3) * 0.78; p.setX(i, p.getX(i) * f); } p.needsUpdate = true; }
    const GRASS = this.cfg.grassCount;
    const grass = new THREE.InstancedMesh(blade, this._makeGrassMat(), GRASS);
    grass.material.envMapIntensity = 0.65; grass.castShadow = false; grass.receiveShadow = false;
    const gcol = new THREE.Color(); let gi = 0; const clumps = Math.ceil(GRASS / 18);
    for (let c = 0; c < clumps; c++) {
      const ang = Math.random() * Math.PI * 2, rad = 1.6 + Math.random() * 7.0;
      const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
      for (let b = 0; b < 18 && gi < GRASS; b++, gi++) {
        const x = cx + (Math.random() - .5) * 0.55, z = cz + (Math.random() - .5) * 0.55;
        dummy.position.set(x, 0, z); dummy.rotation.y = Math.random() * Math.PI;
        const w = 0.7 + Math.random() * 0.6, hf = 0.7 + Math.random() * 0.6; dummy.scale.set(w, hf, w);
        dummy.updateMatrix(); grass.setMatrixAt(gi, dummy.matrix);
        const t = Math.random(); const dry = Math.random() < 0.18;
        if (dry) gcol.setRGB(0.55 + 0.12 * t, 0.50 + 0.10 * t, 0.24 + 0.08 * t);
        else gcol.setRGB(0.26 + 0.16 * t, 0.36 + 0.16 * t, 0.15 + 0.08 * t);
        grass.setColorAt(gi, gcol);
      }
    }
    grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    dummy.rotation.set(0, 0, 0); this.scene.add(grass);

    // heather clumps
    const NH = this.cfg.props.heather;
    const heather = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true }), NH);
    heather.material.envMapIntensity = 0.6; const hcol = new THREE.Color();
    for (let i = 0; i < NH; i++) { const ang = Math.random() * Math.PI * 2, rad = 1.8 + Math.random() * 13;
      dummy.position.set(Math.cos(ang) * rad, 0.05, Math.sin(ang) * rad); dummy.rotation.y = Math.random() * Math.PI;
      const s = 0.55 + Math.random() * 0.9; dummy.scale.set(s, 0.62 * s, s); dummy.updateMatrix(); heather.setMatrixAt(i, dummy.matrix);
      const t = Math.random(); hcol.setRGB(0.30 + 0.14 * t, 0.19 + 0.09 * t, 0.33 + 0.10 * t); heather.setColorAt(i, hcol); }
    heather.instanceMatrix.needsUpdate = true; if (heather.instanceColor) heather.instanceColor.needsUpdate = true;
    heather.castShadow = true; this.scene.add(heather);

    // distant pines (instanced)
    const PINES = this.cfg.props.pines;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6); trunkGeo.translate(0, 0.6, 0);
    const coneGeos = [0, 1, 2].map(k => { const g = new THREE.ConeGeometry(1.1 - k * 0.28, 1.4, 7); g.translate(0, 1.4 + k * 0.9, 0); return g; });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 1 }), PINES);
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#2f3e26', roughness: 1 });
    const coneInsts = coneGeos.map(g => { const m = new THREE.InstancedMesh(g, foliageMat, PINES); m.castShadow = true; return m; });
    for (let i = 0; i < PINES; i++) { const ang = Math.random() * Math.PI * 2, rad = 15 + Math.random() * 16;
      dummy.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad); dummy.rotation.set(0, Math.random() * Math.PI, 0);
      const s = 1.4 + Math.random() * 1.6; dummy.scale.setScalar(s); dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix); coneInsts.forEach(ci => ci.setMatrixAt(i, dummy.matrix)); }
    trunkInst.instanceMatrix.needsUpdate = true; coneInsts.forEach(ci => ci.instanceMatrix.needsUpdate = true);
    this.scene.add(trunkInst); coneInsts.forEach(ci => this.scene.add(ci));

    // rocks (instanced)
    const ROCKS = this.cfg.props.rocks;
    const rockMat = new THREE.MeshStandardMaterial({ color: '#8a8377', roughness: 1, metalness: 0, flatShading: true });
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), rockMat, ROCKS);
    rocks.castShadow = true; rocks.receiveShadow = true;
    for (let i = 0; i < ROCKS; i++) { const ang = Math.random() * Math.PI * 2, rad = 2.5 + Math.random() * 12;
      const sc = (0.18 + Math.random() * 0.3) / 0.3;
      dummy.position.set(Math.cos(ang) * rad, 0.05, Math.sin(ang) * rad);
      dummy.rotation.set(Math.random(), Math.random(), Math.random()); dummy.scale.set(sc, sc * (0.6 + Math.random() * 0.4), sc);
      dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix); }
    rocks.instanceMatrix.needsUpdate = true; dummy.scale.setScalar(1); this.scene.add(rocks);

    // floating dust motes
    const MOTES = this.cfg.props.motes; const moteGeo = new THREE.BufferGeometry(); const mpos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) { mpos[i * 3] = (Math.random() - .5) * 24; mpos[i * 3 + 1] = 0.2 + Math.random() * 3.0; mpos[i * 3 + 2] = (Math.random() - .5) * 24; }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: '#ffe7b0', size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(motes); this.motes = motes; this._moteCount = MOTES;
  }

  _initPost() {
    const cap = this.cfg.pixelRatioCap;
    const fx = new EffectComposer(this.renderer); fx.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    fx.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.14, 0.5, 0.92);
    fx.addPass(bloom); fx.addPass(new OutputPass());
    fx.addPass(new SMAAPass(window.innerWidth, window.innerHeight));
    this.fx = fx; this.bloom = bloom;
  }

  _initEnv() {
    const pmrem = new THREE.PMREMGenerator(this.renderer); pmrem.compileEquirectangularShader();
    const gradientSky = () => { const c = document.createElement('canvas'); c.width = 16; c.height = 256; const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#bcd2ee'); grd.addColorStop(0.5, '#e9d6ac'); grd.addColorStop(1, '#e7c891');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    return new Promise((resolve) => {
      new RGBELoader().load(this.cfg.hdri, (hdr) => {
        const envMap = pmrem.fromEquirectangular(hdr).texture; this.scene.environment = envMap;
        hdr.mapping = THREE.EquirectangularReflectionMapping; this.scene.background = hdr;
        this.scene.backgroundBlurriness = 0.45; this.scene.backgroundIntensity = 1.0;
        this.applyTimeState(); resolve();
      }, (xhr) => { if (xhr.total) this.onStatus(Math.round(xhr.loaded / xhr.total * 55)); },
      () => { this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.background = gradientSky(); resolve(); });
    });
  }

  _initPerf() {
    this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0; this._fps = 60; this._perfShow = true;
    if (this.perfEl) this.perfEl.addEventListener('click', () => { this._perfShow = !this._perfShow; this.perfEl.classList.toggle('off', !this._perfShow); });
  }
  _updatePerf(dt, calls, tris) {
    this._fpsAcc += dt; this._fpsN++; this._fpsT += dt;
    if (this._fpsT >= 0.5) { this._fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0; }
    if (this.perfEl) this.perfEl.textContent = this._perfShow ? `${this._fps.toFixed(0)} fps\n${calls} calls\n${(tris / 1000).toFixed(1)}k tris` : `${this._fps.toFixed(0)} fps`;
  }

  // ================= TIME OF DAY =================
  _initTime() {
    this.timeState = { keyColor: new THREE.Color(), keyInt: 0, keyX: 0, keyY: 0, keyZ: 0,
      hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiInt: 0,
      rimColor: new THREE.Color(), rimInt: 0, rimX: 0, rimY: 0, rimZ: 0,
      fog: new THREE.Color(), fogNear: 0, fogFar: 0, exposure: 0, bgInt: 0, envMul: 1,
      moteColor: new THREE.Color(), moteOp: 0, bloom: 0, contactOp: 0 };
    this.timeTarget = null; this.timeName = this.cfg.startTime;
  }
  _timeFrom(p) {
    return { keyColor: new THREE.Color(p.keyColor), keyInt: p.keyInt, keyX: p.keyPos[0], keyY: p.keyPos[1], keyZ: p.keyPos[2],
      hemiSky: new THREE.Color(p.hemiSky), hemiGround: new THREE.Color(p.hemiGround), hemiInt: p.hemiInt,
      rimColor: new THREE.Color(p.rimColor), rimInt: p.rimInt, rimX: p.rimPos[0], rimY: p.rimPos[1], rimZ: p.rimPos[2],
      fog: new THREE.Color(p.fog), fogNear: p.fogNear, fogFar: p.fogFar, exposure: p.exposure, bgInt: p.bgInt, envMul: p.envMul,
      moteColor: new THREE.Color(p.mote), moteOp: p.moteOp, bloom: p.bloom, contactOp: p.contactOp };
  }
  applyTimeState() {
    const s = this.timeState;
    this.key.color.copy(s.keyColor); this.key.intensity = s.keyInt;
    this.hemi.color.copy(s.hemiSky); this.hemi.groundColor.copy(s.hemiGround); this.hemi.intensity = s.hemiInt;
    this.rim.color.copy(s.rimColor); this.rim.intensity = s.rimInt;
    this.scene.fog.color.copy(s.fog); this.scene.fog.near = s.fogNear; this.scene.fog.far = s.fogFar;
    this.renderer.toneMappingExposure = s.exposure; this.scene.backgroundIntensity = s.bgInt;
    for (let i = 0; i < this.envMats.length; i++) { const m = this.envMats[i]; m.envMapIntensity = (m.userData.baseEnv || 1) * s.envMul; }
    this.motes.material.color.copy(s.moteColor); this.motes.material.opacity = s.moteOp;
    this.bloom.strength = s.bloom; if (this.renderer.shadowMap.enabled) this.contact.material.opacity = s.contactOp;
  }
  _applyTimeLerp(k) {
    const s = this.timeState, t = this.timeTarget;
    s.keyColor.lerp(t.keyColor, k); s.hemiSky.lerp(t.hemiSky, k); s.hemiGround.lerp(t.hemiGround, k); s.rimColor.lerp(t.rimColor, k); s.fog.lerp(t.fog, k); s.moteColor.lerp(t.moteColor, k);
    s.keyInt += (t.keyInt - s.keyInt) * k; s.keyX += (t.keyX - s.keyX) * k; s.keyY += (t.keyY - s.keyY) * k; s.keyZ += (t.keyZ - s.keyZ) * k;
    s.hemiInt += (t.hemiInt - s.hemiInt) * k; s.rimInt += (t.rimInt - s.rimInt) * k; s.rimX += (t.rimX - s.rimX) * k; s.rimY += (t.rimY - s.rimY) * k; s.rimZ += (t.rimZ - s.rimZ) * k;
    s.fogNear += (t.fogNear - s.fogNear) * k; s.fogFar += (t.fogFar - s.fogFar) * k; s.exposure += (t.exposure - s.exposure) * k; s.bgInt += (t.bgInt - s.bgInt) * k; s.envMul += (t.envMul - s.envMul) * k;
    s.moteOp += (t.moteOp - s.moteOp) * k; s.bloom += (t.bloom - s.bloom) * k; s.contactOp += (t.contactOp - s.contactOp) * k;
    this.applyTimeState();
  }
  setTime(name, instant) {
    if (!this.cfg.times[name]) return;
    const t = this._timeFrom(this.cfg.times[name]); this.timeTarget = t; this.timeName = name;
    if (instant) { const s = this.timeState;
      s.keyColor.copy(t.keyColor); s.hemiSky.copy(t.hemiSky); s.hemiGround.copy(t.hemiGround); s.rimColor.copy(t.rimColor); s.fog.copy(t.fog); s.moteColor.copy(t.moteColor);
      s.keyInt = t.keyInt; s.keyX = t.keyX; s.keyY = t.keyY; s.keyZ = t.keyZ; s.hemiInt = t.hemiInt; s.rimInt = t.rimInt; s.rimX = t.rimX; s.rimY = t.rimY; s.rimZ = t.rimZ;
      s.fogNear = t.fogNear; s.fogFar = t.fogFar; s.exposure = t.exposure; s.bgInt = t.bgInt; s.envMul = t.envMul; s.moteOp = t.moteOp; s.bloom = t.bloom; s.contactOp = t.contactOp;
      this.applyTimeState(); }
  }

  // ---- env-mat registry (dag/nacht-dimming) ----
  registerEnvMat(m, owner) {
    if (!m || m.userData._envT || !('envMapIntensity' in m)) return;
    m.userData._envT = true; m.userData._envOwner = owner;
    m.userData.baseEnv = (m.envMapIntensity !== undefined ? m.envMapIntensity : 1);
    this.envMats.push(m);
  }
  releaseEnvMats(owner) {
    this.envMats = this.envMats.filter(m => { if (m.userData._envOwner === owner) { m.userData._envT = false; return false; } return true; });
  }
  _collectWorldEnv() { this.scene.traverse(o => { if (o.isMesh) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(m => this.registerEnvMat(m, 'world')); } }); }

  // ---- hooks ----
  followTarget(obj) { this.followObj = obj; }
  setFlag(name, val) {
    this.flags[name] = val;
    if (name === 'autoRotate') this.controls.autoRotate = val;
    if (name === 'shadow') {
      this.renderer.shadowMap.enabled = val; this.contact.visible = val;
      if (val) { this.key.shadow.needsUpdate = true; this._shadowPrev.set(1e9, 0, 0); }
      this.scene.traverse(o => { if (o.isMesh && o.material) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(m => { if (m) m.needsUpdate = true; }); } });
    }
  }

  // ---- per-frame ----
  update(dt) {
    const t = this.clock.elapsedTime;
    if (this.timeTarget) this._applyTimeLerp(this.reduceMotion ? 1 : (1 - Math.pow(0.0015, dt)));

    const f = this.followObj;
    if (f) {
      const s = this.timeState;
      this.key.position.set(f.position.x + s.keyX, s.keyY, f.position.z + s.keyZ); this.key.target.position.copy(f.position);
      this.rim.position.set(f.position.x + s.rimX, s.rimY, f.position.z + s.rimZ); this.rim.target.position.copy(f.position);
      this.contact.position.set(f.position.x, 0.012, f.position.z);
    }
    if (this.renderer.shadowMap.enabled) { const sm = this.key.position.distanceToSquared(this._shadowPrev);
      if (sm > 1e-6) { this.key.shadow.needsUpdate = true; this._shadowPrev.copy(this.key.position); } }

    if (this.flags.follow && f) {
      const c = this.cfg.camera;
      const goal = f.position.clone().setY(c.followY);
      const newT = this._prevTarget.clone().lerp(goal, 1 - Math.pow(c.followSmoothing, dt));
      const delta = newT.clone().sub(this._prevTarget);
      this.controls.target.add(delta); this.camera.position.add(delta); this._prevTarget.copy(newT);
    }

    if (this.flags.motion) for (const u of this.windMats) u.uTime.value = t;
    if (this.flags.motion) { const p = this.motes.geometry.attributes.position, arr = p.array;
      for (let i = 0; i < this._moteCount; i++) { arr[i * 3 + 1] += dt * 0.06; arr[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.02; if (arr[i * 3 + 1] > 3.3) arr[i * 3 + 1] = 0.2; }
      p.needsUpdate = true; }

    this.controls.update();
    this.renderer.info.reset();
    this.fx.render();
    this._updatePerf(dt, this.renderer.info.render.calls, this.renderer.info.render.triangles);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight); this.fx.setSize(window.innerWidth, window.innerHeight);
    this.bloom.setSize(Math.max(2, window.innerWidth / 2), Math.max(2, window.innerHeight / 2));
  }
}
