// ============================================================================
//  humanoid.js — generieke procedurele "aankleed"-laag voor een menselijke rig
// ----------------------------------------------------------------------------
//  Sommige characters zijn géén kant-en-klare gestylede mesh (zoals de vos),
//  maar een CC0 humanoïde RIG + clips waarop we zélf een gestyleerd low-poly
//  lichaam bouwen. buildHumanoid() verbergt de basis-mesh en bouwt romp/ledematen/
//  hoofd/outfit als primitieven die aan de BOTTEN hangen — exact het patroon dat
//  character.js al voor de vos-ogen gebruikt (geometrie geparenteerd aan een bot),
//  hier veralgemeniseerd tot een heel figuur.
//
//  SCHAAL-ROBUUST: alle maten zijn FRACTIES van de gemeten skelet-hoogte H
//  (head-bot → voet-bot, ná model.scale). Zo klopt het ongeacht de bbox-normering.
//
//  DATA komt uit spec.build (specs.js): palette (kleuren), bones (rol→botnaam),
//  badges (verdienbare insignes). De vorm/proporties staan hier als defaults
//  (override met spec.build.dims). Een 2e mens = een nieuwe spec.build, geen
//  herschrijving van deze module.
//
//  Retourneert een API: { setBadges(ids[]), setHat(bool), badgeDefs, dispose }.
// ============================================================================

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const DEFAULT_DIMS = {
  limbR: 0.052, armCuffR: 0.058, legR: 0.062, neckR: 0.05,
  headR: 0.145, hairR: 0.172,
  torsoW: 0.30, torsoD: 0.20, hipsW: 0.26,
  eyeR: 0.036, browW: 0.072, noseR: 0.022,
  shoulderR: 0.075, jointR: 0.05,
  bootW: 0.085, bootH: 0.06, bootL: 0.155,
  sashW: 0.055, sashT: 0.022, badgeR: 0.046,
};

export function buildHumanoid(stage, spec, handle) {
  const model = handle.model;
  const B = spec.build;
  const D = Object.assign({}, DEFAULT_DIMS, B.dims || {});
  model.updateMatrixWorld(true);

  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const N = B.bones;

  const made = [];                       // alle nieuwe meshes (voor dispose-traverse zit het al in model)
  const wpos = (roleOrName) => {
    const name = N[roleOrName] || roleOrName;
    const b = bones[name]; const v = new THREE.Vector3();
    if (b) { b.updateWorldMatrix(true, false); v.setFromMatrixPosition(b.matrixWorld); }
    return v;
  };

  // ── verberg de basis-mesh; de botten blijven door de mixer aangedreven ──
  if (B.hideBaseMesh !== false) model.traverse(o => { if (o.isMesh) o.visible = false; });

  // ── SCHAAL-FIX ──────────────────────────────────────────────────────────
  //  De RobotExpressive-mesh is ~50× groter dan z'n bot-armatuur (bind-scale),
  //  dus de mesh-bbox-normering van de engine maakt de BOTTEN piepklein. Wij
  //  bouwen op de botten → herschaal het model zodat de SKELET-hoogte ==
  //  targetHeight, zet de voeten op de grond en de romp op de oorsprong.
  {
    model.updateMatrixWorld(true);
    const span = Math.max(1e-4, wpos('head').y - wpos('footL').y);
    const target = (spec.scale && spec.scale.targetHeight) || 1.5;
    model.scale.multiplyScalar(target / span);
    model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const hips = wpos('hips'), foot = wpos('footL');
    model.position.set(-hips.x, -foot.y, -hips.z); model.updateMatrixWorld(true);
  }

  // ── oriëntatie-basis uit de bind-pose (schouder-as → voor/rechts) ──
  const up = new THREE.Vector3(0, 1, 0);
  const right = wpos('shoulderL').sub(wpos('shoulderR'));
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0); right.normalize();
  const fwd = new THREE.Vector3().crossVectors(up, right).normalize().multiplyScalar(B.fwdSign || 1);

  const H = Math.max(0.2, wpos('head').y - wpos('footL').y);    // skelet-hoogte (wereld-units)
  const f = (frac) => frac * H;

  // ── materialen (palette → MeshStandardMaterial), mee-dimmend met dagdeel ──
  const mats = {};
  const ROUGH = { hair: 0.95, hairTip: 0.9, boot: 0.7, iris: 0.3, irisInner: 0.3, white: 0.5,
    kerchief: 0.8, lip: 0.45, mouthDark: 0.7, brow: 0.9, lash: 0.85, teeth: 0.4 };
  for (const k in B.palette) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(B.palette[k]), roughness: ROUGH[k] ?? 0.9, metalness: 0 });
    stage.registerEnvMat(m, handle); mats[k] = m;
  }
  const mat = (k) => mats[k] || mats.skin;

  // gedeelde geometrieën
  const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 12);
  const UNIT_CIRCLE = new THREE.CircleGeometry(1, 24);

  // ── lokale helpers ─────────────────────────────────────────────────────
  function orient(yDir, rightHint) {
    const y = yDir.clone().normalize();
    let x = rightHint.clone().sub(y.clone().multiplyScalar(rightHint.dot(y)));
    if (x.lengthSq() < 1e-9) x.set(1, 0, 0); x.normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  function attach(boneRole, worldM, geom, material, shadow = true) {
    const b = bones[N[boneRole] || boneRole]; if (!b) return null;
    b.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(worldM);
    const mesh = new THREE.Mesh(geom, material);
    local.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = shadow; mesh.receiveShadow = shadow;
    b.add(mesh); made.push(mesh); return mesh;
  }
  // cilinder-segment tussen twee botten (radiaal symmetrisch → alleen Y uitlijnen)
  function segmentPts(attachRole, pA, pB, r0, r1, material) {
    const dir = pB.clone().sub(pA); const len = Math.max(1e-3, dir.length());
    const geom = new THREE.CylinderGeometry(r1, r0, len, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    const M = new THREE.Matrix4().compose(pA.clone().add(pB).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return attach(attachRole, M, geom, material);
  }
  function segment(attachRole, fromRole, toRole, r0, r1, material) {
    return segmentPts(attachRole, wpos(fromRole), wpos(toRole), r0, r1, material);
  }
  function ball(attachRole, atWorld, r, material) {
    const M = new THREE.Matrix4().compose(atWorld, new THREE.Quaternion(), new THREE.Vector3(r, r, r));
    return attach(attachRole, M, UNIT_SPHERE, material);
  }
  function box(attachRole, center, dimsXYZ, yDir, rightHint, material) {
    const geom = new THREE.BoxGeometry(dimsXYZ.x, dimsXYZ.y, dimsXYZ.z);
    const M = new THREE.Matrix4().compose(center, orient(yDir, rightHint), new THREE.Vector3(1, 1, 1));
    return attach(attachRole, M, geom, material);
  }
  const lerpV = (a, b, t) => a.clone().lerp(b, t);
  // getapt cilinder-segment, direct in WERELD-ruimte gebakken (voor merge)
  function cylGeomWorld(pA, pB, r0, r1, seg = 6) {
    const dir = pB.clone().sub(pA); const len = Math.max(1e-3, dir.length());
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(pA.clone().add(pB).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    return g;
  }
  // merge een reeks wereld-ruimte-geometrieën tot ÉÉN mesh op een bot (1 draw call)
  function attachMerged(boneRole, geoms, material, shadow = true) {
    if (!geoms.length) return null;
    const b = bones[N[boneRole] || boneRole]; if (!b) { geoms.forEach(g => g.dispose()); return null; }
    b.updateWorldMatrix(true, false);
    const merged = BufferGeometryUtils.mergeGeometries(geoms, false);
    geoms.forEach(g => g.dispose());
    if (!merged) return null;
    merged.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = shadow; mesh.receiveShadow = shadow;
    b.add(mesh); made.push(mesh); return mesh;
  }

  // ====================================================================
  //  ROMP
  // ====================================================================
  // bekken / korte broek-bovenkant
  box('hips', lerpV(wpos('hips'), wpos('abdomen'), 0.15).add(fwd.clone().multiplyScalar(f(0.01))),
    new THREE.Vector3(f(D.hipsW), f(0.16), f(D.torsoD * 0.92)), up, right, mat('shorts'));
  // onderlijf jas
  box('abdomen', lerpV(wpos('abdomen'), wpos('torso'), 0.5),
    new THREE.Vector3(f(D.torsoW * 0.92), f(0.30), f(D.torsoD)), up, right, mat('jacket'));
  // borst jas (iets breder bovenaan)
  box('torso', lerpV(wpos('torso'), wpos('neck'), 0.45),
    new THREE.Vector3(f(D.torsoW), f(0.34), f(D.torsoD)), wpos('neck').sub(wpos('torso')), right, mat('jacket'));
  // schouders
  ball('torso', wpos('shoulderL').add(up.clone().multiplyScalar(f(0.01))), f(D.shoulderR), mat('jacket'));
  ball('torso', wpos('shoulderR').add(up.clone().multiplyScalar(f(0.01))), f(D.shoulderR), mat('jacket'));
  // nek
  segment('neck', 'neck', 'head', f(D.neckR), f(D.neckR * 0.92), mat('skin'));

  // ====================================================================
  //  ARMEN  (boven=jasmouw, joint, onder=huid, hand)
  // ====================================================================
  for (const s of ['L', 'R']) {
    segment('upperArm' + s, 'upperArm' + s, 'lowerArm' + s, f(D.limbR), f(D.limbR * 0.92), mat('jacket'));
    ball('lowerArm' + s, wpos('lowerArm' + s), f(D.jointR), mat('jacketCuff'));    // elleboog/cuff
    const handPt = wpos('lowerArm' + s).lerp(wpos('hand' + s), 0.66);               // arm wat inkorten
    segmentPts('lowerArm' + s, wpos('lowerArm' + s), handPt, f(D.limbR * 0.9), f(D.limbR * 0.78), mat('skin'));
    ball('lowerArm' + s, handPt, f(D.armCuffR * 0.78), mat('skin'));                // hand
  }

  // ====================================================================
  //  BENEN  (dij=korte broek, knie huid, scheen huid, laars)
  // ====================================================================
  for (const s of ['L', 'R']) {
    segment('upperLeg' + s, 'upperLeg' + s, 'lowerLeg' + s, f(D.legR), f(D.legR * 0.88), mat('shorts'));
    ball('lowerLeg' + s, wpos('lowerLeg' + s), f(D.jointR), mat('skin'));           // knie
    segment('lowerLeg' + s, 'lowerLeg' + s, 'foot' + s, f(D.legR * 0.82), f(D.legR * 0.66), mat('skin'));
    // laars
    const fp = wpos('foot' + s);
    const center = new THREE.Vector3(fp.x, f(D.bootH) * 0.5, fp.z).add(fwd.clone().multiplyScalar(f(0.03)));
    box('foot' + s, center, new THREE.Vector3(f(D.bootW), f(D.bootH), f(D.bootL)), up, right, mat('boot'));
  }

  // ====================================================================
  //  HOOFD + GEZICHT
  // ====================================================================
  const headC = wpos('head').add(up.clone().multiplyScalar(-f(0.02)));    // iets zakken zodat 't op de nek zit
  ball('head', headC, f(D.headR), mat('skin'));
  // oren
  ball('head', headC.clone().add(right.clone().multiplyScalar(f(D.headR * 0.96))).add(up.clone().multiplyScalar(-f(0.01))), f(0.03), mat('skin'));
  ball('head', headC.clone().add(right.clone().multiplyScalar(-f(D.headR * 0.96))).add(up.clone().multiplyScalar(-f(0.01))), f(0.03), mat('skin'));

  // ── HAAR: shaggy, golvend, middellang — dark-blond met door-de-zon lichtere punten ──
  //  Likeness §13d: pony valt naar voren + opzij, langer/rommeliger op kruin & achterkant,
  //  oren deels bedekt, losse cowlick. GESCULPTEERDE MASSA (geen radiale spikes): een
  //  vollere helm-vorm + volume-lumps, platte fringe-plukken naar voren/opzij, en een
  //  rommelige onderrand van platte plukken die LANGS de kop naar beneden vallen.
  //  Per kleurgroep tot ÉÉN mesh gemerged (basis = mat('hair'); punten = mat('hairTip')).
  {
    const baseG = [], tipG = [];
    const R = f(D.hairR);
    let _s = 20240621; const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };

    // platte 'pluk' (dun blok): lengte-as = flow, dikte-as = kop-normaal (ligt plat op de kop)
    const plate = (center, flow, norm, w, len, th) => {
      const y = flow.clone().normalize();
      let z = norm.clone(); z.sub(y.clone().multiplyScalar(z.dot(y))); if (z.lengthSq() < 1e-9) z.set(0, 0, 1); z.normalize();
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      const g = new THREE.BoxGeometry(w, len, th, 1, 2, 1);
      g.applyMatrix4(new THREE.Matrix4().compose(center, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)), new THREE.Vector3(1, 1, 1)));
      return g;
    };
    // val-richting: tangent langs de kop omlaag + heel licht naar buiten (zit nét boven de huid)
    const tangentDown = (n, side) => {
      let d = up.clone().multiplyScalar(-1); d.sub(n.clone().multiplyScalar(d.dot(n)));   // omlaag, geprojecteerd op het kop-oppervlak
      d.add(right.clone().multiplyScalar(side)).add(n.clone().multiplyScalar(0.14));      // beetje sweep + nét naar buiten
      return d.normalize();
    };

    // 1) BASIS-MASSA — helm die schedel/zijkanten/achterkant dekt, MAAR het gezicht vrijlaat.
    //  De bol-kap staat naar ACHTER + OMHOOG verschoven: de voorrand vormt de haarlijn net
    //  boven de wenkbrauwen, terwijl achter/zijkant laag doorlopen (oren deels bedekt).
    {
      const cap = new THREE.SphereGeometry(R * 0.98, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.95);
      const q = orient(up, right);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1 * (B.fwdSign || 1)));
      const c = headC.clone().add(up.clone().multiplyScalar(R * 0.2)).add(fwd.clone().multiplyScalar(-R * 0.34));
      cap.applyMatrix4(new THREE.Matrix4().compose(c, q, new THREE.Vector3(1.08, 1.05, 1.15)));
      baseG.push(cap);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const bp = headC.clone()
          .add(up.clone().multiplyScalar(R * (0.5 + rnd() * 0.3)))
          .add(right.clone().multiplyScalar(Math.cos(a) * R * 0.55))
          .add(fwd.clone().multiplyScalar((Math.sin(a) * 0.45 - 0.28) * R));
        const s = new THREE.SphereGeometry(R * (0.3 + rnd() * 0.16), 10, 8);
        s.applyMatrix4(new THREE.Matrix4().makeTranslation(bp.x, bp.y, bp.z));
        (rnd() < 0.5 ? tipG : baseG).push(s);
      }
    }

    // 1b) PONY-RUG — een gladde haar-massa vlak op het voorhoofd ÁCHTER de pony-plukken, zodat
    //  gaten tussen de plukken háár tonen i.p.v. huid (de plukken worden textuur op een massa).
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const edge = Math.sin(t * Math.PI);
      const root = headC.clone()
        .add(fwd.clone().multiplyScalar(R * 0.5))
        .add(up.clone().multiplyScalar(R * (0.56 - 0.04 * Math.abs(t - 0.5))))
        .add(right.clone().multiplyScalar((t - 0.5) * R * 0.9));
      const n = root.clone().sub(headC).normalize();
      const flow = up.clone().multiplyScalar(-1); flow.sub(n.clone().multiplyScalar(flow.dot(n) - 0.03)); flow.normalize();
      const len = R * (0.34 + 0.16 * edge);
      const center = root.clone().add(flow.clone().multiplyScalar(len * 0.5));
      const faceN = fwd.clone().multiplyScalar(0.8).add(n.clone().multiplyScalar(0.2)).normalize();
      baseG.push(plate(center, flow, faceN, R * (0.26 + 0.06 * edge), len, R * 0.03));
    }

    // 2) FRINGE — zachte, schuin gestreken pony die naar BENEDEN over het voorhoofd valt in
    //  golvende plukken; ligt dicht tegen de huid, eindigt net boven/op de wenkbrauwen en
    //  veegt naar één kant (Alvah kamt z'n pony schuin). Géén vooruit-stekende spikes.
    {
      for (let i = 0; i < 22; i++) {
        const t = i / 21;                                       // slaap → slaap langs de haarlijn
        const edge = Math.sin(t * Math.PI);                     // 0 aan de slapen → 1 in het midden
        const root = headC.clone()
          .add(fwd.clone().multiplyScalar(R * (0.52 - 0.04 * Math.abs(t - 0.5))))
          .add(up.clone().multiplyScalar(R * (0.58 - 0.05 * Math.abs(t - 0.5))))
          .add(right.clone().multiplyScalar((t - 0.5) * R * 0.92));
        const n = root.clone().sub(headC).normalize();
        const flow = up.clone().multiplyScalar(-1.0)
          .add(right.clone().multiplyScalar(-(t - 0.5) * 0.5 * edge + 0.1 * edge))
          .add(fwd.clone().multiplyScalar(0.03));
        flow.sub(n.clone().multiplyScalar(flow.dot(n) - 0.04)); flow.normalize();   // ligt vlak op de huid
        const len = R * (0.32 + 0.18 * edge) * (0.85 + rnd() * 0.4);   // korter: eindigt mid-voorhoofd, niet als zware band
        const center = root.clone().add(flow.clone().multiplyScalar(len * 0.5));
        // SMALLE STRENGEN bovenop de gladde pony-massa (1b): textuur, geen brede latten
        const faceN = fwd.clone().multiplyScalar(0.7).add(n.clone().multiplyScalar(0.3)).normalize();
        (rnd() < 0.45 ? tipG : baseG).push(plate(center, flow, faceN, R * (0.1 + 0.045 * edge + rnd() * 0.025), len, R * 0.035));
      }
    }

    // 3) SHAGGY ONDERRAND — korte plukken over de slapen/oren/nek, hoog & kort zodat ze tegen
    //  de kop liggen en NIET als losse latten langs de wangen/kaak hangen. Front-sector over-
    //  geslagen (sin(a) > 0.12) zodat het gezicht vrij blijft.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      if (Math.sin(a) > 0.12) continue;
      const n = up.clone().multiplyScalar(0.22).add(right.clone().multiplyScalar(Math.cos(a))).add(fwd.clone().multiplyScalar(Math.sin(a))).normalize();
      const root = headC.clone().add(n.clone().multiplyScalar(R * 0.92)).add(up.clone().multiplyScalar(R * 0.02));
      const flow = tangentDown(n, (rnd() - 0.5) * 0.45);
      const len = R * (0.22 + rnd() * 0.16);
      const center = root.clone().add(flow.clone().multiplyScalar(len * 0.5));
      (rnd() < 0.4 ? tipG : baseG).push(plate(center, flow, n, R * (0.16 + rnd() * 0.08), len, R * 0.06));
    }

    // 4) ACHTER/NEK — langere platte plukken die naar beneden vallen (shaggy achterkant)
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * Math.PI * 0.85;
      const n = fwd.clone().multiplyScalar(-0.85).add(right.clone().multiplyScalar(Math.sin(a) * 0.72)).add(up.clone().multiplyScalar(0.22)).normalize();
      const root = headC.clone().add(n.clone().multiplyScalar(R * 0.9)).add(up.clone().multiplyScalar(-R * 0.04));
      const flow = tangentDown(n, (rnd() - 0.5) * 0.3);
      const len = R * (0.5 + rnd() * 0.32);
      const center = root.clone().add(flow.clone().multiplyScalar(len * 0.5));
      (rnd() < 0.4 ? tipG : baseG).push(plate(center, flow, n, R * (0.24 + rnd() * 0.08), len, R * 0.07));
    }

    // 5) COWLICK — één klein pluk dat vooraan op de kruin licht omhoog wipt (subtiel, geen spike)
    {
      const root = headC.clone().add(up.clone().multiplyScalar(R * 0.86)).add(fwd.clone().multiplyScalar(R * 0.2));
      const flow = fwd.clone().multiplyScalar(0.3).add(up.clone().multiplyScalar(0.95)).normalize();
      const n = root.clone().sub(headC).normalize();
      tipG.push(plate(root.clone().add(flow.clone().multiplyScalar(R * 0.1)), flow, n, R * 0.16, R * 0.19, R * 0.05));
    }

    // 6) KRUIN-GOLVEN — platte plukken liggend op de bovenkap (tousled/golvend; zichtbaar zonder hoed)
    for (let i = 0; i < 17; i++) {
      const a = (i / 17) * Math.PI * 2 + rnd() * 1.3;
      const el = 0.38 + rnd() * 0.46;
      const n = up.clone().multiplyScalar(el).add(right.clone().multiplyScalar(Math.cos(a) * (1 - el))).add(fwd.clone().multiplyScalar(Math.sin(a) * (1 - el) - 0.12)).normalize();
      const root = headC.clone().add(n.clone().multiplyScalar(R * 0.93));
      let flow = fwd.clone().multiplyScalar(-0.55 - rnd() * 0.35).add(right.clone().multiplyScalar((rnd() - 0.5) * 0.9)).add(up.clone().multiplyScalar(-0.12));
      flow.sub(n.clone().multiplyScalar(flow.dot(n))); flow.add(n.clone().multiplyScalar(0.1)); flow.normalize();
      const len = R * (0.42 + rnd() * 0.32);
      const center = root.clone().add(flow.clone().multiplyScalar(len * 0.5));
      (rnd() < 0.55 ? tipG : baseG).push(plate(center, flow, n, R * (0.22 + rnd() * 0.1), len, R * 0.05));
    }

    attachMerged('head', baseG, mat('hair'));
    attachMerged('head', tipG, mat('hairTip') || mat('hair'));
  }

  // ── ogen (platte schijf met groen-hazel iris + warme golden-hour catchlight, §12/§13d) ──
  const eyeTex = makeEyeTexture({
    irisOuter: B.palette.iris || '#83906a',
    irisInner: B.palette.irisInner || B.palette.iris || '#9d8348',
    pupil: B.palette.dark || '#1c1710',
  });
  const eyeMatFace = new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true });
  const faceQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
  // eigen oog-oriëntatie (X=right, Y=up, Z=fwd) zodat de schijf betrouwbaar AMANDEL kan staan
  const eyeBasisQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
  const eyeCenter = headC.clone().add(fwd.clone().multiplyScalar(f(D.headR * 0.93))).add(up.clone().multiplyScalar(f(D.headR * 0.05)));
  const lashG = [];
  for (const sgn of [1, -1]) {
    const p = eyeCenter.clone().add(right.clone().multiplyScalar(sgn * f(D.headR * 0.37)));
    // amandelvormig oog: breder dan hoog (niet bol/uilachtig)
    const M = new THREE.Matrix4().compose(p, eyeBasisQ, new THREE.Vector3(f(D.eyeR) * 1.12, f(D.eyeR) * 0.82, f(D.eyeR)));
    attach('head', M, UNIT_CIRCLE, eyeMatFace, false);
    const eR = f(D.eyeR);
    // BOVENLID-lijn — een zachte donkere boog die het oog 'aardt' (leest als dichte wimperbasis)
    let prev = null;
    for (let i = 0; i <= 9; i++) {
      const u = i / 9;                                  // alleen de BOVENRAND (geen inner-corner-blob)
      const ang = Math.PI * (0.82 - u * 0.66);
      const q = p.clone()
        .add(right.clone().multiplyScalar(sgn * Math.cos(ang) * eR * 1.08))
        .add(up.clone().multiplyScalar(Math.sin(ang) * eR * 0.9))
        .add(fwd.clone().multiplyScalar(eR * 0.16));
      if (prev) lashG.push(cylGeomWorld(prev, q, eR * 0.085, eR * 0.085, 4));
      prev = q;
    }
    // lange donkere BOVENWIMPERS — fijne haartjes, naar boven+buiten geveegd, buitenste het langst
    for (let i = 0; i < 9; i++) {
      const u = i / 8;                                  // binnen → buiten
      const ang = Math.PI * (0.78 - u * 0.6);           // langs de bovenrand
      const base = p.clone()
        .add(right.clone().multiplyScalar(sgn * Math.cos(ang) * eR * 1.04))
        .add(up.clone().multiplyScalar(Math.sin(ang) * eR * 0.88))
        .add(fwd.clone().multiplyScalar(eR * 0.22));
      const dir = up.clone().multiplyScalar(0.6).add(right.clone().multiplyScalar(sgn * (0.34 + u * 0.62))).add(fwd.clone().multiplyScalar(0.46)).normalize();
      const len = eR * (0.46 + u * 0.66);               // buitenste langer (typische kinderkrul)
      lashG.push(cylGeomWorld(base, base.clone().add(dir.multiplyScalar(len)), eR * 0.07, eR * 0.012, 4));
    }
    // wenkbrauw — laag geplaatst, vrij recht, zacht middenbruin (§13d)
    const bp = p.clone().add(up.clone().multiplyScalar(f(D.headR * 0.26))).add(fwd.clone().multiplyScalar(f(0.004)));
    box('head', bp, new THREE.Vector3(f(D.browW), f(0.016), f(0.02)), up, right, mat('brow') || mat('hair'));
  }
  attachMerged('head', lashG, mat('lash') || mat('hair'), false);
  // neus — kleine rechte brug + iets opwippende ronde tip (§13d: profiel licht omhoog)
  {
    const bridge = eyeCenter.clone().add(up.clone().multiplyScalar(-f(D.headR * 0.14))).add(fwd.clone().multiplyScalar(f(0.006)));
    const tip = eyeCenter.clone().add(up.clone().multiplyScalar(-f(D.headR * 0.33))).add(fwd.clone().multiplyScalar(f(0.023)));
    segmentPts('head', bridge, tip, f(D.noseR * 0.6), f(D.noseR * 0.92), mat('skin'));
    ball('head', tip, f(D.noseR * 0.86), mat('skin'));      // kleine, ronde, iets vooruit-/omhoog stekende tip
  }
  // mond — vollere lippen + twee licht prominente bovenste voortanden (glimlach-pose, §13d)
  {
    const mc = eyeCenter.clone().add(up.clone().multiplyScalar(-f(D.headR * 0.66))).add(fwd.clone().multiplyScalar(-f(0.002)));
    const w = f(0.072);
    box('head', mc, new THREE.Vector3(w, f(0.012), f(0.016)), up, right, mat('mouthDark') || mat('boot'));            // donkere mondopening
    box('head', mc.clone().add(up.clone().multiplyScalar(f(0.016))).add(fwd.clone().multiplyScalar(f(0.002))),
      new THREE.Vector3(w * 0.98, f(0.016), f(0.021)), up, right, mat('lip'));                                       // vollere bovenlip
    box('head', mc.clone().add(up.clone().multiplyScalar(-f(0.017))).add(fwd.clone().multiplyScalar(f(0.004))),
      new THREE.Vector3(w * 0.92, f(0.02), f(0.023)), up, right, mat('lip'));                                        // vollere onderlip
    for (const sgn of [1, -1]) {                                                                                      // twee voortanden, iets naar voren
      const tp = mc.clone().add(right.clone().multiplyScalar(sgn * f(0.011))).add(up.clone().multiplyScalar(f(0.003))).add(fwd.clone().multiplyScalar(f(0.013)));
      box('head', tp, new THREE.Vector3(f(0.019), f(0.023), f(0.01)), up, right, mat('teeth') || mat('white'));
    }
  }

  // ====================================================================
  //  OUTFIT: halsdoek + sjerp met badge-slots
  // ====================================================================
  // halsdoek: ring om de nek + driehoekige bef op de borst
  {
    const ringQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);  // torus horizontaal
    const ring = new THREE.TorusGeometry(f(D.neckR * 1.25), f(0.018), 8, 18);
    const M = new THREE.Matrix4().compose(wpos('neck').add(up.clone().multiplyScalar(-f(0.01))), ringQuat, new THREE.Vector3(1, 1, 1));
    attach('neck', M, ring, mat('kerchief'));
    const bib = new THREE.ConeGeometry(f(0.075), f(0.13), 3);
    const bibC = lerpV(wpos('neck'), wpos('torso'), 0.45).add(fwd.clone().multiplyScalar(f(D.torsoD * 0.5)));
    const q = orient(up.clone().multiplyScalar(-1), right);   // punt naar beneden
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6));
    const Mb = new THREE.Matrix4().compose(bibC, q, new THREE.Vector3(1, 0.5, 1));  // afgeplat tegen de borst
    attach('torso', Mb, bib, mat('kerchief'));
  }

  // sjerp: diagonale band van rechterschouder → linkerheup
  const setBadgesApi = buildSash();

  function buildSash() {
    const top = wpos('shoulderR').add(fwd.clone().multiplyScalar(f(D.torsoD * 0.5))).add(up.clone().multiplyScalar(-f(0.02)));
    const bottom = wpos('hips').add(right.clone().multiplyScalar(f(0.10))).add(fwd.clone().multiplyScalar(f(D.torsoD * 0.5)));
    const dir = bottom.clone().sub(top); const len = dir.length();
    const sashGeom = new THREE.BoxGeometry(f(D.sashW), len, f(D.sashT));
    const sashM = new THREE.Matrix4().compose(top.clone().add(bottom).multiplyScalar(0.5), orient(dir, right), new THREE.Vector3(1, 1, 1));
    attach('torso', sashM, sashGeom, mat('sash'));

    // badge-slots langs de sjerp
    const defs = B.badges || [];
    const emptyTex = makeBadgeTexture(null);
    const emptyMat = new THREE.MeshBasicMaterial({ map: emptyTex, transparent: true });
    const slotGeom = new THREE.CircleGeometry(f(D.badgeR), 28);
    const slots = [];
    const n = defs.length;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1);
      const p = top.clone().lerp(bottom, t).add(fwd.clone().multiplyScalar(f(D.sashT) + f(0.004)));
      const earnedTex = makeBadgeTexture(defs[i]);
      const earnedMat = new THREE.MeshBasicMaterial({ map: earnedTex, transparent: true });
      const M = new THREE.Matrix4().compose(p, faceQ, new THREE.Vector3(1, 1, 1));
      const mesh = attach('torso', M, slotGeom, emptyMat, false);
      mesh.renderOrder = 3;
      slots.push({ id: defs[i].id, mesh, earnedMat, emptyMat });
    }
    return (ids) => {
      const set = new Set(ids || []);
      for (const s of slots) s.mesh.material = set.has(s.id) ? s.earnedMat : s.emptyMat;
    };
  }

  // ====================================================================
  //  HOED (brimmed ranger-hoed) — toggle
  // ====================================================================
  const hatMeshes = [];
  {
    const top = headC.clone().add(up.clone().multiplyScalar(f(D.headR * 0.78)));
    const crown = new THREE.CylinderGeometry(f(D.headR * 0.86), f(D.headR * 0.96), f(0.10), 18);
    hatMeshes.push(attach('head', new THREE.Matrix4().compose(top, orient(up, right), new THREE.Vector3(1, 1, 1)), crown, mat('hat')));
    const brim = new THREE.CylinderGeometry(f(D.headR * 1.5), f(D.headR * 1.5), f(0.015), 22);
    const brimC = headC.clone().add(up.clone().multiplyScalar(f(D.headR * 0.66)));
    hatMeshes.push(attach('head', new THREE.Matrix4().compose(brimC, orient(up, right), new THREE.Vector3(1, 1, 1)), brim, mat('hat')));
    const band = new THREE.TorusGeometry(f(D.headR * 0.9), f(0.016), 8, 22);
    const bandQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);  // band horizontaal om de bol
    hatMeshes.push(attach('head', new THREE.Matrix4().compose(brimC.clone().add(up.clone().multiplyScalar(f(0.05))), bandQuat, new THREE.Vector3(1, 1, 1)), band, mat('hatBand')));
  }
  const setHat = (on) => hatMeshes.forEach(m => { if (m) m.visible = on; });

  return { setBadges: setBadgesApi, setHat, badgeDefs: B.badges || [] };
}

// ---- canvas-textuur: één oog — groen-hazel iris + warme golden-hour catchlight (§12/§13d) ----
function makeEyeTexture(opt) {
  const irisOuter = opt.irisOuter || '#83906a';
  const irisInner = opt.irisInner || irisOuter;
  const pupil = opt.pupil || '#1c1710';
  const s = 128; const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.clearRect(0, 0, s, s); const cx = s / 2, cy = s / 2;
  // sclera (warm wit)
  g.fillStyle = '#f4efe2'; g.beginPath(); g.ellipse(cx, cy, s * 0.45, s * 0.45, 0, 0, 7); g.fill();
  // iris — radiale verloop: warme hazel kern → groen-grijs buitenrand. Grote iris (kinderoog):
  //  weinig wit zichtbaar = rustige, niet-verbaasde blik.
  const ir = s * 0.38;
  const grad = g.createRadialGradient(cx, cy, ir * 0.16, cx, cy, ir);
  grad.addColorStop(0, irisInner); grad.addColorStop(0.5, irisInner);
  grad.addColorStop(0.68, irisOuter); grad.addColorStop(1, irisOuter);
  g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, ir, 0, 7); g.fill();
  // subtiele iris-strepen (geeft de iris diepte)
  g.strokeStyle = 'rgba(58,48,28,0.22)'; g.lineWidth = s * 0.009;
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * ir * 0.3, cy + Math.sin(a) * ir * 0.3); g.lineTo(cx + Math.cos(a) * ir * 0.94, cy + Math.sin(a) * ir * 0.94); g.stroke(); }
  // limbale ring (donkere rand → laat de iris 'lezen')
  g.strokeStyle = 'rgba(26,20,12,0.6)'; g.lineWidth = s * 0.024; g.beginPath(); g.arc(cx, cy, ir * 0.95, 0, 7); g.stroke();
  // pupil
  g.fillStyle = pupil; g.beginPath(); g.arc(cx, cy, ir * 0.42, 0, 7); g.fill();
  // ÉÉN warme golden-hour catchlight (scherp, naar de key toe = boven-links) + zachte echo
  g.fillStyle = 'rgba(255,246,226,0.97)'; g.beginPath(); g.arc(cx - s * 0.085, cy - s * 0.1, s * 0.055, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,250,240,0.5)'; g.beginPath(); g.arc(cx - s * 0.045, cy - s * 0.05, s * 0.022, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- canvas-textuur: een badge (of leeg slot bij def=null) ----
function makeBadgeTexture(def) {
  const s = 160; const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.clearRect(0, 0, s, s); const cx = s / 2, cy = s / 2, R = s * 0.44;
  if (!def) {
    // leeg slot: donkere socket met stippel-rand
    g.fillStyle = 'rgba(30,26,18,0.55)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,210,190,0.5)'; g.lineWidth = s * 0.02; g.setLineDash([s * 0.05, s * 0.045]);
    g.beginPath(); g.arc(cx, cy, R * 0.82, 0, 7); g.stroke(); g.setLineDash([]);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // verdiende badge: gekleurde schijf + rand + simpel geometrisch icoon
  g.fillStyle = def.color; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = s * 0.035; g.beginPath(); g.arc(cx, cy, R * 0.92, 0, 7); g.stroke();
  g.fillStyle = '#fbf8f0'; g.strokeStyle = '#fbf8f0'; g.lineWidth = s * 0.035; g.lineJoin = 'round'; g.lineCap = 'round';
  drawGlyph(g, def.glyph, cx, cy, R * 0.6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function drawGlyph(g, glyph, cx, cy, r) {
  const tri = (x, y, w, h, dy = -1) => { g.beginPath(); g.moveTo(x, y + dy * h); g.lineTo(x - w, y - dy * h); g.lineTo(x + w, y - dy * h); g.closePath(); g.fill(); };
  if (glyph === 'fox') {          // twee oortjes
    tri(cx - r * 0.42, cy + r * 0.1, r * 0.34, r * 0.6); tri(cx + r * 0.42, cy + r * 0.1, r * 0.34, r * 0.6);
    g.beginPath(); g.arc(cx, cy + r * 0.35, r * 0.5, Math.PI, 0); g.fill();
  } else if (glyph === 'moon') {  // wassende maan
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx + r * 0.42, cy - r * 0.18, r * 0.92, 0, 7); g.fill(); g.restore();
  } else if (glyph === 'heath') { // drie heide-toefjes
    for (const dx of [-0.5, 0, 0.5]) { g.beginPath(); g.arc(cx + dx * r, cy + r * 0.3, r * 0.16, 0, 7); g.fill(); g.fillRect(cx + dx * r - r * 0.04, cy + r * 0.3, r * 0.08, r * 0.5); }
  } else if (glyph === 'pine') {  // dennenboom
    tri(cx, cy - r * 0.1, r * 0.55, r * 0.6); tri(cx, cy + r * 0.35, r * 0.7, r * 0.55); g.fillRect(cx - r * 0.1, cy + r * 0.6, r * 0.2, r * 0.35);
  } else if (glyph === 'paw') {   // pootafdruk
    g.beginPath(); g.ellipse(cx, cy + r * 0.25, r * 0.45, r * 0.4, 0, 0, 7); g.fill();
    for (const dx of [-0.55, -0.18, 0.18, 0.55]) { g.beginPath(); g.arc(cx + dx * r, cy - r * 0.45, r * 0.16, 0, 7); g.fill(); }
  } else if (glyph === 'water') { // druppel
    g.beginPath(); g.moveTo(cx, cy - r * 0.7); g.quadraticCurveTo(cx + r * 0.75, cy + r * 0.3, cx, cy + r * 0.7); g.quadraticCurveTo(cx - r * 0.75, cy + r * 0.3, cx, cy - r * 0.7); g.fill();
  } else {                        // ster (default)
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
  }
}
