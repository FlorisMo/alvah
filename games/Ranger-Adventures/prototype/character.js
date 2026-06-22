// ============================================================================
//  character.js — loadCharacter(stage, spec) + generieke beweging/emotie-laag
// ----------------------------------------------------------------------------
//  Eén engine, nul hardcoded vos-namen of -assen: álles komt uit de spec.
//  loadCharacter doet:
//    GLB laden → (optioneel) smooth-shade + vacht-PBR → ogen uit spec.eyes →
//    botten via spec.bones/spec.axes → generieke secundaire beweging op de
//    staartketen → schaal op spec.scale.targetHeight → locomotie met spec.locomotion.
//
//  Retourneert een handle:
//    handle.update(dt)            — per frame (mixer, locomotie, secundair, emotie)
//    handle.setGait('rust'|'walk'|'run'|'auto')
//    handle.setEmotion('kalm'|'alert'|'bang')   ← EMOTIE-STRUCTUUR
//    handle.dispose()
//    handle.model, handle.spec, handle.emotions (lijst), handle.gait
//
//  EMOTIE-LAAG — twee generieke backends, per dier via spec.emoties geconfigureerd:
//    • POSE  : additieve kop/staart-houding (headPitch/headYaw/tailLift) — bv. de vos.
//    • MORPH : expressie-morphtargets op de mesh (bv. de robot: Surprised/Sad).
//  Elk nieuw dier erft beide automatisch; je vult in de spec alleen in wat past.
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHumanoid } from './humanoid.js';

// ---- gedeelde procedurele vacht-maps (canvas, geen fetch) — één keer bouwen ----
let _FUR_NORMAL = null, _FUR_ROUGH = null, _furH = null;
const _FUR_SIZE = 512;
function _furHeightCanvas(size) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size); g.filter = 'blur(0.7px)';
  const n = size * 15;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const len = size * (0.005 + Math.random() * 0.020);
    const ang = Math.random() * Math.PI * 2; const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    const a = 0.05 + Math.random() * 0.13;
    g.strokeStyle = (Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
    g.lineWidth = 0.6 + Math.random() * 0.7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
  }
  g.filter = 'none'; return c;
}
function _ensureFur() {
  if (_FUR_NORMAL) return;
  _furH = _furHeightCanvas(_FUR_SIZE);
  const size = _FUR_SIZE; const src = _furH.getContext('2d').getImageData(0, 0, size, size).data;
  // normal
  { const strength = 1.5; const out = document.createElement('canvas'); out.width = out.height = size; const og = out.getContext('2d');
    const img = og.createImageData(size, size); const d = img.data;
    const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = -(H(x + 1, y) - H(x - 1, y)) * strength, ny = -(H(x, y + 1) - H(x, y - 1)) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz); const o = (y * size + x) * 4;
      d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (nz / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    _FUR_NORMAL = new THREE.CanvasTexture(out); _FUR_NORMAL.colorSpace = THREE.NoColorSpace; _FUR_NORMAL.wrapS = _FUR_NORMAL.wrapT = THREE.RepeatWrapping; _FUR_NORMAL.anisotropy = 4; _FUR_NORMAL.repeat.set(8, 8); }
  // roughness
  { const out = document.createElement('canvas'); out.width = out.height = size; const og = out.getContext('2d');
    const img = og.createImageData(size, size); const d = img.data;
    for (let i = 0; i < size * size; i++) { const h = src[i * 4] / 255; const v = (0.74 + (1 - h) * 0.2) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    og.putImageData(img, 0, 0);
    _FUR_ROUGH = new THREE.CanvasTexture(out); _FUR_ROUGH.colorSpace = THREE.NoColorSpace; _FUR_ROUGH.wrapS = _FUR_ROUGH.wrapT = THREE.RepeatWrapping; _FUR_ROUGH.repeat.set(8, 8); }
}

function _setByAxis(vec, axis, value) { vec[axis] = value; }

export function loadCharacter(stage, spec) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(spec.source.url, (gltf) => {
      const model = gltf.scene;
      const handle = { model, spec, gait: 'auto', emotion: 'kalm', emotions: Object.keys(spec.emoties || {}) };

      // ── materiaal-pass ──────────────────────────────────────────────────
      if (spec.material && spec.material.proceduralFur) {
        _ensureFur();
        model.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          try { const g = o.geometry; g.deleteAttribute('normal');
            const merged = BufferGeometryUtils.mergeVertices(g); merged.computeVertexNormals();
            merged.computeBoundingBox(); merged.computeBoundingSphere();
            o.geometry = merged; if (g !== merged) g.dispose(); } catch (e) { console.warn('smooth-shade skipped', e); }
          const old = o.material;
          const mat = new THREE.MeshPhysicalMaterial({
            map: old && old.map ? old.map : null,
            color: old && old.color ? old.color.clone() : new THREE.Color(0xffffff),
            roughness: spec.material.roughness ?? 0.85, metalness: 0.0,
            normalMap: _FUR_NORMAL, normalScale: new THREE.Vector2(spec.material.normalScale ?? 0.26, spec.material.normalScale ?? 0.26),
            roughnessMap: _FUR_ROUGH,
            sheen: spec.material.sheen ?? 0.7, sheenRoughness: 0.85, sheenColor: new THREE.Color(spec.material.sheenColor || '#ffc184'),
            envMapIntensity: spec.material.envMapIntensity ?? 0.95,
          });
          if (spec.material.faceGlint && old && old.map && old.map.image) {
            try { const im = old.map.image; const S = im.width || 256;
              const mc = document.createElement('canvas'); mc.width = mc.height = S; const mg = mc.getContext('2d', { willReadFrequently: true });
              mg.drawImage(im, 0, 0, S, S); const px = mg.getImageData(0, 0, S, S).data;
              const outI = mg.createImageData(S, S); const od = outI.data;
              for (let i = 0; i < S * S; i++) { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
                const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); const sat = mx === 0 ? 0 : (mx - mn) / mx; const lum = (r + gg + b) / 3;
                const m = (lum < 80 && sat < 0.40) ? 255 : 0; od[i * 4] = od[i * 4 + 1] = od[i * 4 + 2] = m; od[i * 4 + 3] = 255; }
              mg.putImageData(outI, 0, 0); mg.filter = 'blur(1.2px)'; mg.drawImage(mc, 0, 0); mg.filter = 'none';
              const ccTex = new THREE.CanvasTexture(mc); ccTex.colorSpace = THREE.NoColorSpace;
              ccTex.flipY = (old.map.flipY !== undefined) ? old.map.flipY : false;
              mat.clearcoat = 1.0; mat.clearcoatRoughness = 0.06; mat.clearcoatMap = ccTex; mat.needsUpdate = true;
            } catch (e) { console.warn('face-glint skipped', e); }
          }
          stage.registerEnvMat(mat, handle);
          o.material = mat;
        });
      } else {
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true;
          const mm = Array.isArray(o.material) ? o.material : [o.material];
          mm.forEach(m => { if (m) { if ('envMapIntensity' in m && spec.material && spec.material.envMapIntensity != null) m.envMapIntensity = spec.material.envMapIntensity; stage.registerEnvMat(m, handle); } }); } });
      }

      // ── schaal via bbox -> targetHeight (reële maat -> wereldschaal) ─────
      const box = new THREE.Box3().setFromObject(model); const size = new THREE.Vector3(); box.getSize(size);
      const ctr = new THREE.Vector3(); box.getCenter(ctr); const s = spec.scale.targetHeight / size.y;
      model.scale.setScalar(s);
      model.position.x -= ctr.x * s; model.position.z -= ctr.z * s; model.position.y -= box.min.y * s;
      model.rotation.y = spec.locomotion.headingOffset || 0;
      stage.scene.add(model);

      // ── procedureel lichaam/outfit/badges voor humanoïde rigs (spec.build) ──
      //  (ná schaal + scene.add zodat bot-wereldposities in finale units staan)
      let humanoid = null;
      if (spec.build) { model.updateMatrixWorld(true); humanoid = buildHumanoid(stage, spec, handle); }

      // ── botten via spec.bones ───────────────────────────────────────────
      const findBone = (n) => { if (!n) return null; let b = null; model.traverse(o => { if (o.name === n) b = o; }); return b; };
      const headBone = findBone(spec.bones.head);
      const tailBones = (spec.bones.tail || []).map(findBone).filter(Boolean);
      const chestBone = findBone(spec.bones.chest); const chestBase = chestBone ? chestBone.scale.clone() : null;

      // ── morph-meshes (emotie-MORPH-backend) ─────────────────────────────
      const morphMeshes = []; model.traverse(o => { if (o.isMesh && o.morphTargetDictionary) morphMeshes.push(o); });

      // ── ogen uit spec.eyes (modellen zonder oog-geometrie) ──────────────
      let eyeMat = null;
      if (spec.eyes && spec.eyes.enabled && headBone) {
        const E = spec.eyes; const ax = spec.axes.head;
        eyeMat = new THREE.MeshPhysicalMaterial({ color: E.color ?? 0x201509, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.2, envMapIntensity: 0.45 });
        const eyeGeo = new THREE.SphereGeometry(1, 16, 12);
        const mkEye = (sideSign) => { const m = new THREE.Mesh(eyeGeo, eyeMat);
          const p = new THREE.Vector3(); _setByAxis(p, ax.fwd, E.fwd); _setByAxis(p, ax.up, E.up); _setByAxis(p, ax.side, sideSign * E.sep); m.position.copy(p);
          const sc = new THREE.Vector3(); _setByAxis(sc, ax.fwd, E.r * E.sx); _setByAxis(sc, ax.up, E.r * E.sy); _setByAxis(sc, ax.side, E.r * E.sz); m.scale.copy(sc);
          headBone.add(m); return m; };
        mkEye(1); mkEye(-1);
        if (E.glint) {
          const glintMat = new THREE.MeshBasicMaterial({ color: 0xfff4e2 }); const glintGeo = new THREE.SphereGeometry(1, 8, 6);
          const mkGlint = (sideSign) => { const m = new THREE.Mesh(glintGeo, glintMat); m.renderOrder = 2;
            const p = new THREE.Vector3(); _setByAxis(p, ax.fwd, E.fwd + E.r * E.sx * 0.95); _setByAxis(p, ax.up, E.up + E.r * 0.42); _setByAxis(p, ax.side, sideSign * (E.sep + E.r * 0.22)); m.position.copy(p);
            m.scale.setScalar(E.r * 0.26); headBone.add(m); return m; };
          mkGlint(1); mkGlint(-1);
        }
        stage.registerEnvMat(eyeMat, handle);
      }

      // ── mixer + logische clip-mapping (idle/walk/run -> clipnaam) ────────
      const mixer = new THREE.AnimationMixer(model);
      const byName = {}; gltf.animations.forEach(c => { byName[c.name] = c; });
      const actions = {};
      for (const key of ['idle', 'walk', 'run']) { const cn = spec.clips[key]; const clip = cn ? byName[cn] : null; actions[key] = clip ? mixer.clipAction(clip) : null; }
      let current = 'idle';
      if (actions.idle) actions.idle.play();
      function setClip(name) {
        if (name === current) return; const from = actions[current], to = actions[name];
        if (to) { to.reset().play(); to.enabled = true; to.setEffectiveWeight(1); if (from) from.crossFadeTo(to, 0.3, false); current = name; }
        else if (from) { from.stop(); current = name; }
      }

      // ── locomotie-state ─────────────────────────────────────────────────
      const L = spec.locomotion; const ROAM = stage.cfg.roamRadius;
      // optionele thuis-zone: een 2e/3e dier zwerft rond zijn eigen plek i.p.v. de
      // wereld-oorsprong (default = oorsprong + volledige roamRadius → ongewijzigd).
      const HOME = new THREE.Vector3(L.home ? L.home[0] : 0, 0, L.home ? L.home[1] : 0);
      const HOME_R = L.homeRadius || ROAM;
      const wander = { state: 'idle', timer: 1.2, target: new THREE.Vector3(), speed: 0, mode: 'walk', heading: model.rotation.y - (L.headingOffset || 0) };
      let pathAngle = 0, pathRadius = 5; const PATH_R = 5;
      const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
      function setHeading(h) { wander.heading = h; model.rotation.y = h + (L.headingOffset || 0); }
      function pickTarget() { const ang = Math.random() * Math.PI * 2, rad = Math.min(HOME_R * 0.9, 2 + Math.random() * 7);
        wander.target.set(HOME.x + Math.cos(ang) * rad, 0, HOME.z + Math.sin(ang) * rad);
        const run = Math.random() < 0.22; wander.mode = run ? 'run' : 'walk';
        wander.speed = run ? (2.8 + Math.random() * 1.1) : (0.9 + Math.random() * 0.6);
        setClip(run ? 'run' : 'walk'); wander.state = 'moving'; }

      // ── secundaire beweging-state ───────────────────────────────────────
      const sec = spec.secondary; const _prevPos = model.position.clone();
      let tSwingX = 0, tVelX = 0, tSwingZ = 0, tPhase = 0, breathT = 0, charSpeed = 0, _prevHeading = model.rotation.y;
      const wagAx = spec.axes.tail ? spec.axes.tail.wag : 'x';
      const liftAx = spec.axes.tail ? spec.axes.tail.lift : 'z';

      // ── emotie-state ────────────────────────────────────────────────────
      const allMorphNames = new Set();
      for (const en in (spec.emoties || {})) { const m = spec.emoties[en].morph || {}; for (const k in m) allMorphNames.add(k); }
      const emo = { headPitch: 0, headYaw: 0, tailLift: 0 };
      const emoMorph = {}; allMorphNames.forEach(n => { emoMorph[n] = 0; });
      let emoTarget = { headPitch: 0, headYaw: 0, tailLift: 0 };
      let emoMorphTarget = {}; allMorphNames.forEach(n => { emoMorphTarget[n] = 0; });

      // ================= API =================
      handle.play = (name) => setClip(name);
      // verdienbare badges + hoed (alleen actief bij een humanoïde build)
      handle.badges = [];
      handle.setBadges = (ids) => { handle.badges = ids || []; if (humanoid && humanoid.setBadges) humanoid.setBadges(handle.badges); };
      handle.setHat = (on) => { handle.hat = !!on; if (humanoid && humanoid.setHat) humanoid.setHat(!!on); };
      handle.badgeDefs = humanoid ? humanoid.badgeDefs : [];
      handle.canDrive = true;                      // elk character is bestuurbaar (manual gait)
      // pijltjes-invoer voor de manual/bestuurbaar-gang
      handle._input = { f: 0, b: 0, l: 0, r: 0, run: false };
      handle.setInput = (i) => { Object.assign(handle._input, i); };
      handle.setGait = (g) => {
        handle.gait = g;
        if (g === 'auto') { wander.state = 'idle'; wander.timer = 0.4; }
        else if (g === 'manual') { /* geen vast pad: advanceLocomotion stuurt op _input */ }
        else {
          // manual: leg vast cirkelpad vast vanaf huidige positie
          if (g !== 'rust') { pathAngle = Math.atan2(model.position.z, model.position.x); pathRadius = Math.max(1.5, Math.hypot(model.position.x, model.position.z)); }
          setClip(g === 'rust' ? 'idle' : g);
        }
      };
      handle.setEmotion = (name) => {
        const e = (spec.emoties && spec.emoties[name]) ? spec.emoties[name] : null; if (!e) return;
        handle.emotion = name;
        emoTarget = { headPitch: e.headPitch || 0, headYaw: e.headYaw || 0, tailLift: e.tailLift || 0 };
        emoMorphTarget = {}; allMorphNames.forEach(n => { emoMorphTarget[n] = (e.morph && e.morph[n] != null) ? e.morph[n] : 0; });
      };

      function advanceLocomotion(dt) {
        if (handle.gait === 'auto') {
          if (wander.state === 'idle') { const a = actions[current]; if (a) a.timeScale = 1; wander.timer -= dt; if (wander.timer <= 0) pickTarget(); }
          else { const d = wander.target.clone().sub(model.position); d.y = 0; const dist = d.length();
            if (dist < 0.4) { wander.state = 'idle'; wander.timer = 1.0 + Math.random() * 2.4; setClip('idle'); }
            else { d.normalize(); model.position.addScaledVector(d, wander.speed * dt);
              const dx = model.position.x - HOME.x, dz = model.position.z - HOME.z; const rr = Math.hypot(dx, dz);
              if (rr > HOME_R) { model.position.x = HOME.x + dx / rr * HOME_R; model.position.z = HOME.z + dz / rr * HOME_R; }
              const th = Math.atan2(d.x, d.z); setHeading(lerpAngle(wander.heading, th, 1 - Math.pow(0.0001, dt)));
              const ref = wander.mode === 'run' ? L.runRef : L.walkRef; const a = actions[current]; if (a) a.timeScale = Math.max(0.7, Math.min(1.7, wander.speed / ref)); }
          }
        } else if (handle.gait === 'rust') {
          const a = actions[current]; if (a) a.timeScale = 1;
        } else if (handle.gait === 'manual') {
          // bestuurbaar: pijltjes draaien (l/r) en bewegen (f/b) langs de heading
          const I = handle._input; const turnSpd = 2.4;
          if (I.l) setHeading(wander.heading + turnSpd * dt);
          if (I.r) setHeading(wander.heading - turnSpd * dt);
          const moving = I.f || I.b;
          if (moving) {
            const run = !!I.run; const speed = run ? L.runSpeed : L.walkSpeed; const sign = I.f ? 1 : -1;
            const fdir = new THREE.Vector3(Math.sin(wander.heading), 0, Math.cos(wander.heading));
            model.position.addScaledVector(fdir, sign * speed * dt);
            const rr = Math.hypot(model.position.x, model.position.z); if (rr > ROAM) model.position.multiplyScalar(ROAM / rr);
            setClip(run ? 'run' : 'walk');
            const ref = run ? L.runRef : L.walkRef; const a = actions[current]; if (a) a.timeScale = sign * Math.max(0.7, Math.min(1.7, speed / ref));
          } else {
            setClip('idle'); const a = actions[current]; if (a) a.timeScale = 1;
          }
        } else { // walk / run langs vast cirkelpad (clip-snelheid gekoppeld -> geen ice-skating)
          const isRun = handle.gait === 'run'; const speed = isRun ? L.runSpeed : L.walkSpeed;
          pathAngle += (speed / PATH_R) * dt; pathRadius += (PATH_R - pathRadius) * (1 - Math.pow(0.05, dt));
          model.position.set(Math.cos(pathAngle) * pathRadius, 0, Math.sin(pathAngle) * pathRadius);
          const th = Math.atan2(-Math.sin(pathAngle), Math.cos(pathAngle));
          setHeading(lerpAngle(wander.heading, th, 1 - Math.pow(0.0001, dt)));
          const ref = isRun ? L.runRef : L.walkRef; const a = actions[current]; if (a) a.timeScale = Math.max(0.7, Math.min(1.7, speed / ref));
        }
      }

      function applySecondary(dt) {
        if (!sec || !tailBones.length) return;
        const inst = _prevPos.distanceTo(model.position) / Math.max(dt, 1e-3);
        charSpeed += (inst - charSpeed) * Math.min(1, dt * 7); _prevPos.copy(model.position);
        let dh = model.rotation.y - _prevHeading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        _prevHeading = model.rotation.y; const turn = Math.max(-2.5, Math.min(2.5, dh / Math.max(dt, 1e-3)));
        tPhase += dt * (1.5 + charSpeed * 0.7);
        const driveX = Math.sin(tPhase) * (sec.tail.wagIdle + charSpeed * sec.tail.wagSpeed) + turn * sec.tail.turn;
        const k = sec.tail.spring, c = 2 * Math.sqrt(sec.tail.spring) * sec.tail.damp;
        tVelX += (k * (driveX - tSwingX) - c * tVelX) * dt; tSwingX += tVelX * dt;
        const liftTarget = charSpeed * sec.tail.liftSpeed + Math.sin(tPhase * 0.8) * 0.015;
        tSwingZ += (liftTarget - tSwingZ) * Math.min(1, dt * 6);
        for (let i = 0; i < tailBones.length; i++) { const b = tailBones[i], f = (i + 1) / tailBones.length;
          b.rotation[wagAx] += tSwingX * (0.55 + f) + Math.sin(tPhase - i * 0.7) * 0.02 * f * (0.4 + charSpeed);
          b.rotation[liftAx] += tSwingZ * (0.4 + f); }
        if (chestBone && chestBase && sec.breathing) { const idleF = Math.max(0, 1 - charSpeed * 2.5); breathT += dt * 1.7;
          const br = Math.sin(breathT) * sec.breathing.amp * idleF;
          chestBone.scale.set(chestBase.x * (1 + br), chestBase.y * (1 + br * 0.6), chestBase.z * (1 + br)); }
      }

      function applyEmotion(dt) {
        const k = Math.min(1, dt * 6);
        emo.headPitch += (emoTarget.headPitch - emo.headPitch) * k;
        emo.headYaw += (emoTarget.headYaw - emo.headYaw) * k;
        emo.tailLift += (emoTarget.tailLift - emo.tailLift) * k;
        for (const n of allMorphNames) emoMorph[n] += ((emoMorphTarget[n] || 0) - emoMorph[n]) * k;
        // POSE-backend (additief op de clip-pose)
        if (headBone) { const ax = spec.axes.head; headBone.rotation[ax.side] += emo.headPitch; headBone.rotation[ax.up] += emo.headYaw; }
        if (tailBones.length) { for (let i = 0; i < tailBones.length; i++) { const f = (i + 1) / tailBones.length; tailBones[i].rotation[liftAx] += emo.tailLift * (0.4 + f); } }
        // MORPH-backend
        if (allMorphNames.size) for (const mesh of morphMeshes) { const dict = mesh.morphTargetDictionary, infl = mesh.morphTargetInfluences;
          for (const n of allMorphNames) { const idx = dict[n]; if (idx !== undefined) infl[idx] = emoMorph[n]; } }
      }

      handle.update = (dt) => {
        const motion = stage.flags.motion;
        if (motion) advanceLocomotion(dt);
        if (mixer) mixer.update(motion ? dt : 0);            // (0 = pose herberekenen zonder klok -> géén additieve accumulatie)
        if (motion && !stage.reduceMotion) applySecondary(dt);
        applyEmotion(dt);                                     // emotie-houding altijd (ook bij Beweging-uit, zodat de uitdrukking zichtbaar is)
      };

      handle.dispose = () => {
        if (stage.followObj === model) stage.followObj = null;
        stage.scene.remove(model);
        stage.releaseEnvMats(handle);
        mixer.stopAllAction();
        model.traverse(o => { if (o.isMesh) { if (o.geometry) o.geometry.dispose();
          const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach(m => { if (m) { for (const key in m) { const v = m[key]; if (v && v.isTexture) v.dispose(); } m.dispose(); } }); } });
        if (eyeMat) eyeMat.dispose();
      };

      // init: zwerven + kalm
      handle.setEmotion('kalm');
      handle.setGait('auto');
      if (humanoid) { handle.setHat(true); handle.setBadges([]); }   // ranger start met hoed, badges nog te verdienen
      resolve(handle);
    }, undefined, (err) => { console.error('character load failed', spec.id, err); reject(err); });
  });
}
