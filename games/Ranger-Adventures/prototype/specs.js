// ============================================================================
//  specs.js — per-dier CharacterSpec-objecten (DATA, finetunebaar)
// ----------------------------------------------------------------------------
//  TUNING-NIVEAU 2 (één dier): pas hier waarden aan om ÉÉN personage te tunen.
//  Wereld/look-tunables staan in STAGE_CONFIG (stage.js) — niet hier.
//
//  Gouden regel (research §A9): logische clip-namen (idle/walk/run) en
//  bot-rol-keys (head/chest/tail) blijven STABIEL over alle fasen. Een latere
//  hi-poly-versie = nieuwe spec met dezelfde keys, géén engine-herschrijving.
//
//  Niets in de engine (stage.js / character.js) bevat hardcoded vos-namen of
//  -assen: álles komt uit deze specs.
//
//  ── LICENTIEBEWIJS PER ASSET (CC0 / Royalty-Free vereist) ──────────────────
//  • Vos   — Khronos glTF-Sample-Assets "Fox"
//            licentie: CC0 1.0 (Public Domain) — model door PixelMannen / tweak door AsoboStudio·Microsoft
//            bron: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox  (gecheckt 2026-06-21)
//  • Robot — three.js "RobotExpressive" (framework-test-placeholder, géén Veluwe-dier)
//            licentie: CC0 1.0 — model door Tomás Laulhé, aanpassingen door Don McCurdy
//            bron: https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/RobotExpressive/  (gecheckt 2026-06-21)
//            doel: bewijst de spec-mapping (ándere bot-/clip-namen) + de emotie-laag
//            via morph-targets. Vervang later door een CC0 Veluwe-dier (Quaternius
//            "Ultimate Animated Animal Pack") zodra de Code-fase een asset-pijplijn heeft.
//  • Ranger — "Alvah": géén kant-en-klare mens-asset. We hergebruiken alléén het
//            CC0-SKELET + de Idle/Walking/Running-CLIPS van three.js RobotExpressive
//            en verbergen de robot-mesh; de zichtbare junior-boswachter is volledig
//            eigen PROCEDUREEL werk (humanoid.js). Herkomst rig/clips: CC0 1.0
//            (Tomás Laulhé / Don McCurdy). bron: zie robot-URL hieronder (gecheckt 2026-06-21).
//            Quaternii "Ultimate Animated Character Pack" (CC0) is het bedoelde
//            productie-alternatief zodra de Code-fase een lokale asset-pijplijn heeft.
// ============================================================================

export const SPECS = {

  // ── VOS — Vulpes vulpes ────────────────────────────────────────────────
  vos: {
    id: 'vos',
    naam: 'Vos',
    source: {
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
      licentie: 'CC0',
      bron: 'Khronos glTF-Sample-Assets',
    },
    // wereldhoogte (scene-units) — bbox-genormaliseerd; ~vos-silhouet
    scale: { targetHeight: 1.4 },
    // logische naam -> clipnaam ván dit model
    clips: { idle: 'Survey', walk: 'Walk', run: 'Run' },
    // bot-rol -> botnaam ván dit model
    bones: {
      head: 'b_Head_05',
      neck: 'b_Neck_04',
      chest: 'b_Spine01_02',
      tail: ['b_Tail01_012', 'b_Tail02_013', 'b_Tail03_014'],
    },
    // per-rig as-conventie (de vos wijkt af van z-forward!)
    axes: {
      head: { fwd: 'x', up: 'y', side: 'z' },   // +X=snuit, +Y=omhoog, +Z=zijwaarts
      tail: { wag: 'x', lift: 'z' },            // local X=wag, Z=lift
    },
    // procedurele vacht-PBR (de CC0-vos is vlak) + sheen
    material: {
      proceduralFur: true,
      sheen: 0.7, sheenColor: '#ffc184',
      roughness: 0.85, normalScale: 0.26,
      envMapIntensity: 0.95,
      faceGlint: true,                          // natte glans (ogen/neus) uit de diffuse
    },
    // de vacht-mesh heeft GEEN oog-geometrie → procedurele amandelogen aan de kop-bot
    eyes: {
      enabled: true,
      fwd: 18.8, up: 8.0, sep: 3.4, r: 1.15,    // lokaal t.o.v. head-bot (in GLB-units, schaalt mee)
      sx: 0.72, sy: 0.82, sz: 1.22,             // amandel: dun in diepte (fwd), breed zijwaarts (side)
      color: 0x201509, glint: true,
    },
    // skate-tuning + gang-snelheden per dier
    locomotion: { walkRef: 1.4, runRef: 3.2, walkSpeed: 1.1, runSpeed: 3.0, headingOffset: 0 },
    // generieke secundaire beweging op spec.bones.tail + chest
    secondary: {
      tail: { spring: 22, damp: 0.65, wagIdle: 0.05, wagSpeed: 0.035, turn: 0.10, liftSpeed: 0.06 },
      breathing: { amp: 0.013 },
    },
    // EMOTIE-LAAG (research §B5 sub g) — vos = POSE-backend (additieve kop/staart-houding)
    //   headPitch: +snuit omhoog / -omlaag   headYaw: +wegdraaien   tailLift: +pluim op / -ingetrokken
    emoties: {
      kalm:  { headPitch: 0.00, headYaw: 0.00, tailLift: 0.00 },
      alert: { headPitch: 0.22, headYaw: 0.00, tailLift: 0.22 },   // kop hoog, luisterend, pluim op
      bang:  { headPitch: -0.25, headYaw: 0.18, tailLift: -0.30 }, // kop laag, afgewend, staart ingetrokken
    },
  },

  // ── RANGER — "Alvah", junior-boswachter (mens) ─────────────────────────
  //  Likeness (benadering, géén foto-kloon, §13d): shaggy/golvend dark-blond haar
  //  met zon-gebleekte punten, GROEN-HAZEL ogen + lange donkere wimpers, kind-
  //  proporties (groot hoofd, slank). De zichtbare figuur is volledig
  //  PROCEDUREEL gebouwd (humanoid.js) bovenop een CC0-rig: we hergebruiken
  //  alléén het skelet + de Idle/Walking/Running-clips van RobotExpressive en
  //  verbergen de robot-mesh. Zo is de herkomst hard CC0 en laadt het betrouwbaar.
  ranger: {
    id: 'ranger',
    naam: 'Ranger',
    note: 'Alvah — junior-boswachter. Procedureel low-poly figuur op een CC0-humanoïde rig (RobotExpressive: skelet + idle/walk/run hergebruikt, robot-mesh verborgen).',
    source: {
      url: 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
      licentie: 'CC0',
      bron: 'three.js / Tomás Laulhé · Don McCurdy — alléén rig + clips hergebruikt; uiterlijk is eigen procedureel werk',
    },
    scale: { targetHeight: 1.5 },                         // staand kind, iets hoger dan de vos (1.4)
    clips: { idle: 'Idle', walk: 'Walking', run: 'Running' },
    // emotie via kop-pose → alleen de kop-bot is nodig; geen staart/borst
    bones: { head: 'Head', neck: null, chest: null, tail: [] },
    axes: { head: { fwd: 'z', up: 'y', side: 'x' }, tail: { wag: 'x', lift: 'z' } },
    material: { proceduralFur: false, envMapIntensity: 1.0 },
    eyes: { enabled: false },                             // ogen worden in humanoid.js gebouwd
    locomotion: { walkRef: 1.0, runRef: 2.4, walkSpeed: 1.2, runSpeed: 3.2, headingOffset: 0 },
    secondary: null,
    // EMOTIE — POSE-backend op de kop (geen bruikbare expressie-morphs op de eigen mesh)
    emoties: {
      kalm:  { headPitch: 0.00, headYaw: 0.00, tailLift: 0.00 },
      alert: { headPitch: -0.22, headYaw: 0.00, tailLift: 0.00 },   // kin omhoog, oplettend
      bang:  { headPitch: 0.30, headYaw: 0.38, tailLift: 0.00 },    // kop omlaag + afgewend
    },
    // ── procedureel lichaam + outfit + verdienbare badges (humanoid.js) ──
    build: {
      hideBaseMesh: true,
      fwdSign: -1,                                       // gezicht/outfit naar de body-voorkant
      bones: {
        shoulderL: 'ShoulderL', shoulderR: 'ShoulderR',
        upperArmL: 'UpperArmL', lowerArmL: 'LowerArmL', handL: 'Palm1L',
        upperArmR: 'UpperArmR', lowerArmR: 'LowerArmR', handR: 'Palm1R',
        hips: 'Hips', abdomen: 'Abdomen', torso: 'Torso_1', neck: 'Neck', head: 'Head',
        upperLegL: 'UpperLegL', lowerLegL: 'LowerLegL', footL: 'FootL',
        upperLegR: 'UpperLegR', lowerLegR: 'LowerLegR', footR: 'FootR',
      },
      palette: {
        skin: '#e9b489',                                  // licht, warme ondertoon, lichte bruining
        hair: '#735a35', hairTip: '#b0915a',              // dark-blond/lichtbruin + door-de-zon lichtere punten
        jacket: '#33603b', jacketCuff: '#274b2e',         // bosgroen
        shorts: '#8a7b4a', boot: '#4a3526',               // khaki short + bruine laars
        kerchief: '#b8402c', sash: '#6d5a33',             // scout-rode halsdoek + leren sjerp
        hat: '#37563a', hatBand: '#274b2e',               // ranger-hoed
        // GEZICHT — likeness §13d: groen-hazel ogen (NIET blauw), volle lippen, lage rechte brauw
        iris: '#83906a', irisInner: '#9d8348',            // groen-grijs buiten, warme hazel kern
        dark: '#1c1710', lip: '#c47a67', mouthDark: '#5a342f',
        brow: '#705a37', lash: '#241a13', teeth: '#f3efe1',
      },
      // ~6 Veluwe-badges; leeg tot verdiend (handle.setBadges([...]))
      badges: [
        { id: 'vossen-spotter', naam: 'Vossen-spotter', color: '#c8612b', glyph: 'fox' },
        { id: 'nachtwacht',     naam: 'Nachtwacht',     color: '#39507e', glyph: 'moon' },
        { id: 'heide-held',     naam: 'Heide-held',     color: '#7a5285', glyph: 'heath' },
        { id: 'boomklimmer',    naam: 'Boomklimmer',    color: '#2f6d40', glyph: 'pine' },
        { id: 'spoorzoeker',    naam: 'Spoorzoeker',    color: '#6b4a30', glyph: 'paw' },
        { id: 'waterwachter',   naam: 'Waterwachter',   color: '#2f8a8a', glyph: 'water' },
      ],
    },
  },

  // ── ROBOT — RobotExpressive (framework-test, CC0) ──────────────────────
  robot: {
    id: 'robot',
    naam: 'Robot',
    note: 'Framework-test — bewijst spec-mapping (ándere bot-/clipnamen) + morph-emoties. Geen Veluwe-dier.',
    source: {
      url: 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
      licentie: 'CC0',
      bron: 'three.js / Tomás Laulhé · Don McCurdy',
    },
    scale: { targetHeight: 1.6 },
    // ándere clipnamen dan de vos → test de logische mapping écht
    clips: { idle: 'Idle', walk: 'Walking', run: 'Running' },
    // dit model heeft geen bruikbare tail/chest-rol; kop bewust niet via bot (emotie via morphs)
    bones: { head: null, neck: null, chest: null, tail: [] },
    axes: { head: { fwd: 'z', up: 'y', side: 'x' }, tail: { wag: 'x', lift: 'z' } },
    material: { proceduralFur: false, envMapIntensity: 1.0 },   // eigen PBR-materialen behouden
    eyes: { enabled: false },                                    // model heeft al ogen
    locomotion: { walkRef: 1.0, runRef: 2.4, walkSpeed: 1.1, runSpeed: 3.0, headingOffset: 0 },
    secondary: null,                                             // geen staart/borst → geen secundaire beweging
    // EMOTIE-LAAG — robot = MORPH-backend (expressie-morphtargets op de kop-mesh)
    emoties: {
      kalm:  { morph: {} },
      alert: { morph: { Surprised: 0.7 } },
      bang:  { morph: { Sad: 0.9 } },
    },
  },

};

// volgorde in de character-kiezer
export const SPEC_ORDER = ['vos', 'ranger', 'robot'];
