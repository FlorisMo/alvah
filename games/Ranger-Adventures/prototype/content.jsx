/* ============================================================
   content.jsx — area registry + Content accessors
   The engine reads everything through Content. Adding an area is
   a content job: write content-<area>.jsx, then add it here.
   (Loads AFTER content-veluwe.jsx, BEFORE the screens.)
   ============================================================ */

const AREAS = [
  window.AREA_VELUWE,
  { id: 'wadden',    naam: 'Wadden',    status: 'binnenkort', mapPin: { x: 38, y: 20 },
    landschappen: ['wad', 'kwelder'], vlaggenschipDieren: ['zeehond'], missies: [] },
  { id: 'biesbosch', naam: 'Biesbosch', status: 'binnenkort', mapPin: { x: 30, y: 74 },
    landschappen: ['rivier', 'wilgenbos'], vlaggenschipDieren: ['bever'], missies: [] },
  { id: 'duinen',    naam: 'Duinen',    status: 'binnenkort', mapPin: { x: 16, y: 46 },
    landschappen: ['duin'], vlaggenschipDieren: ['konijn'], missies: [] },
];

const Content = {
  areas: () => AREAS,
  area: (id) => AREAS.find(a => a.id === id) || null,
  activeArea: () => AREAS.find(a => a.status === 'actief') || AREAS[0],

  // missions of an area
  missions: (areaId) => (Content.area(areaId) || { missies: [] }).missies,
  mission: (areaId, missieId) => {
    const a = Content.area(areaId); if (!a) return null;
    return a.missies.find(m => m.id === missieId) || a.missies[0] || null;
  },
  firstActiveMission: (areaId) => {
    const a = Content.area(areaId); if (!a) return null;
    return a.missies.find(m => m.status === 'actief') || a.missies[0] || null;
  },

  // a step config inside a mission (1-indexed step number)
  step: (areaId, missieId, stepN) => {
    const m = Content.mission(areaId, missieId);
    return m && m.stappen ? m.stappen[stepN - 1] : null;
  },

  // animal lookup
  animal: (id) => (window.ANIMALS || {})[id] || null,

  // story / season-arc (HANDOFF §6.4 / §7.3)
  verhaalboog: (areaId) => (Content.area(areaId) || {}).verhaalboog || null,
  clue: (areaId, id) => {
    const vb = Content.verhaalboog(areaId);
    return vb && vb.clues ? vb.clues[id] || null : null;
  },
  // all clue records for an area, in chapter order
  clues: (areaId) => {
    const vb = Content.verhaalboog(areaId);
    if (!vb || !vb.clues) return [];
    return Object.keys(vb.clues).map(k => vb.clues[k]).sort((a, b) => (a.hoofdstuk || 0) - (b.hoofdstuk || 0));
  },
  seasonMeta: (z) => ({
    lente:  { naam: 'Lente',  kort: 'kraamtijd' },
    zomer:  { naam: 'Zomer',  kort: 'heide & ven' },
    herfst: { naam: 'Herfst', kort: 'bronst' },
    winter: { naam: 'Winter', kort: 'herstel' },
  }[z] || { naam: 'Lente', kort: '' }),

  // jargon helper: pick simple vs "knap woord" copy
  pick: (simpel, knap, jargon) => (jargon && knap) ? knap : simpel,

  // default step title when a skin gives no instruction
  efTitel: (ef) => ({
    zoeken:  'Zoek het dier in het gras.',
    corsi:   'Onthoud de weg.',
    dagnacht:'Blijf rustig. Kies veilig.',
    simon:   'Doe de stappen na.',
    wisselen:'Sorteer goed.',
  }[ef] || 'Ranger-taak'),
};

window.AREAS = AREAS;
window.Content = Content;
