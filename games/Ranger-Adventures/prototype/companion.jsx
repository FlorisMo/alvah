/* ============================================================
   companion.jsx — metgezel: redden → verzorgen → vriend
   (HANDOFF §7.2 / plan §13.3)  ·  species-agnostic, default raaf
   ------------------------------------------------------------
   Two layers (loaded BEFORE state.jsx):
   - a PERSISTENT companion you rescue early, care for over time
     (bond grows), who grows baby→jong→zelfstandig, unlocks
     helper-kunstjes and walks/flies with you on missions.
   - a recurring REHAB loop: other animals you tend briefly and
     then RELEASE (help AND let go — emotional-positive).

   The care routine is EF-in-disguise and feeds the SAME skill
   records as the engines (last thread): the ordered routine is a
   working-memory (simon) task; resisting over-handling is an
   inhibition (dagnacht) task. No new engine — a care SKIN that
   logs sessions. The helper-kunstje routes through the existing
   "hint" autonomy hook so EF stays with the child.
   ============================================================ */

/* ---- species config (data; add 'hond'/'vos' later, same shape) ---- */
const COMPANION_SOORTEN = {
  raaf: {
    soort: 'raaf', naam: 'raaf', roep: 'raaf',
    kunstjeBijFase: { jong: 'scout', zelfstandig: 'gids' },
    namen: ['Kroa', 'Veer', 'Schaduw', 'Inktje'],
  },
};

const FASE_ORDER = ['baby', 'jong', 'zelfstandig'];
const FASE_META = {
  baby:        { label: 'kuiken',       kort: 'Pas gered', drempel: 0 },
  jong:        { label: 'jonge raaf',   kort: 'Wordt sterk', drempel: 40 },
  zelfstandig: { label: 'vrije vriend', kort: 'Vliegt met je mee', drempel: 75 },
};

const KUNSTJE_META = {
  scout: { naam: 'Scout', uitleg: '{naam} vliegt op en speurt met je mee.', icon: 'eye' },
  gids:  { naam: 'Gids',  uitleg: '{naam} wijst je rustig de goede kant op.', icon: 'path' },
};

/* care routine per fase — needs change as it grows (that change = flexibiliteit) */
const ZORG_STAPPEN = {
  baby: [
    { id: 'warmte', label: 'Warm houden',  icon: 'flame', zin: 'Leg een zacht doekje om hem heen.' },
    { id: 'voer',   label: 'Voeren',       icon: 'drop',  zin: 'Geef een klein beetje voer.' },
    { id: 'rust',   label: 'Laten rusten', icon: 'moon',  zin: 'Laat hem rustig slapen.' },
    { id: 'check',  label: 'Checken',      icon: 'check', zin: 'Kijk of het beter gaat.' },
  ],
  jong: [
    { id: 'voer',   label: 'Voeren',        icon: 'drop',  zin: 'Nu wat groter voer.' },
    { id: 'beweeg', label: 'Laten bewegen', icon: 'wing',  zin: 'Laat hem zijn vleugels strekken.' },
    { id: 'check',  label: 'Checken',       icon: 'check', zin: 'Gaat het goed?' },
  ],
  zelfstandig: [
    { id: 'oefen', label: 'Samen oefenen', icon: 'wing',  zin: 'Oefen samen het vliegen.' },
    { id: 'check', label: 'Checken',       icon: 'check', zin: 'Hij wordt sterk en vrij.' },
  ],
};

/* rehab guests (existing sprites only; non-graphic, always releasable) */
const OPVANG_GASTEN = [
  { dier: 'nachtzwaluw', reden: 'tegen een raam gevlogen', zin: 'Een nachtzwaluw is even de weg kwijt.' },
  { dier: 'das',         reden: 'verzwakt gevonden',       zin: 'Een jonge das is moe en zwak.' },
];

/* ---- pure helpers ---- */
function blankCompanion() {
  return { soort: 'raaf', naam: '', rescued: false, fase: 'baby', bond: 8, kunstjes: [], meeOpMissie: false };
}
function blankRehab() { return { active: false, dier: null, reden: null, releasedCount: 0 }; }

function faseVoorBond(bond) {
  let f = 'baby';
  FASE_ORDER.forEach(k => { if (bond >= FASE_META[k].drempel) f = k; });
  return f;
}
function kunstjesVoorFase(soort, fase) {
  const cfg = COMPANION_SOORTEN[soort] || COMPANION_SOORTEN.raaf;
  const out = [];
  FASE_ORDER.forEach(f => {
    if (FASE_ORDER.indexOf(f) <= FASE_ORDER.indexOf(fase) && cfg.kunstjeBijFase[f]) out.push(cfg.kunstjeBijFase[f]);
  });
  return out;
}
function mergeCompanion(saved) {
  return { ...blankCompanion(), ...(saved && typeof saved === 'object' ? saved : {}) };
}
function mergeRehab(saved) {
  return { ...blankRehab(), ...(saved && typeof saved === 'object' ? saved : {}) };
}

/* ============================================================
   small presentational pieces
   ============================================================ */

/* care-action glyphs (simple shapes only) */
function CareIcon({ name, size = 26, color = '#fff' }) {
  const s = { width: size, height: size, display: 'block' };
  switch (name) {
    case 'flame': return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-2-.5-3 2 1.5 3.5 4 3.5 6a5 5 0 0 1-10 0c0-3.5 3-5 5-10z"/></svg>;
    case 'drop':  return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C7 9.5 9 7 12 3z"/></svg>;
    case 'moon':  return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/></svg>;
    case 'check': return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'wing':  return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16c5 1 9-1 12-5 2-2.5 4-3 6-3-1 4-3 7-6 8-3 1-7 1-12 0z"/></svg>;
    case 'heart': return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>;
    case 'eye':   return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case 'path':  return <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19l4-4 3 2 7-9"/><circle cx="5" cy="19" r="1.4" fill={color} stroke="none"/></svg>;
    default: return null;
  }
}

/* the companion itself — raven scaled + dressed by fase */
function CompanionSprite({ companion, size = 120, state = 'rust' }) {
  const fase = companion.fase || 'baby';
  const scale = fase === 'baby' ? 0.74 : fase === 'jong' ? 0.95 : 1.12;
  const px = size * scale;
  return (
    <div className={'companion-sprite fase-' + fase + ' st-' + state} style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }} aria-hidden="true">
      {fase === 'baby' && <span className="comp-nest" />}
      {state === 'koud' && <span className="comp-shiver-wrap" />}
      <div className={'comp-figure' + (state === 'blij' ? ' blij' : '') + (state === 'koud' ? ' koud' : '')}>
        <Raaf size={px} />
      </div>
      {state === 'blij' && (
        <span className="comp-hearts" aria-hidden="true"><i/><i/><i/></span>
      )}
    </div>
  );
}

/* bond meter — growth, never a "score" */
function BondMeter({ bond }) {
  const pct = Math.max(0, Math.min(100, bond));
  return (
    <div className="bond-meter" aria-label={'band ' + Math.round(pct)}>
      <span className="bm-heart"><CareIcon name="heart" size={16} color="#c94174" /></span>
      <div className="bm-track"><div className="bm-fill" style={{ width: pct + '%' }} /></div>
    </div>
  );
}

/* ============================================================
   CareRoutine — the EF-in-disguise care round (reused by cabin + rehab)
   Ordered steps (simon/werkgeheugen) + resist over-handling (dagnacht).
   Logs sessions to the skill records; reports misses via onComplete.
   ============================================================ */
function CareRoutine({ stappen, naam, onComplete }) {
  const { logSession } = useGame();
  const [done, setDone] = useState([]);
  const [msg, setMsg] = useState({ k: 'tip', t: 'Doe de zorg op volgorde.' });
  const orderMiss = useRef(0);
  const knuffelMiss = useRef(0);
  const finished = useRef(false);

  const nextNeed = stappen.find(s => !done.includes(s.id));
  const naamTxt = naam || 'hem';

  const tapStep = (s) => {
    if (finished.current || !nextNeed) return;
    if (s.id === nextNeed.id) {
      Sound.play('correct');
      const nd = [...done, s.id];
      setDone(nd);
      setMsg({ k: 'ok', t: s.zin });
      if (nd.length === stappen.length) {
        finished.current = true;
        Sound.play('found');
        const om = orderMiss.current > 0, km = knuffelMiss.current > 0;
        logSession('simon', { trials: 1, correct: om ? 0 : 1 });
        logSession('dagnacht', { trials: 1, correct: km ? 0 : 1 });
        setMsg({ k: 'ok', t: 'De zorg is klaar. Knap gedaan.' });
        setTimeout(() => onComplete({ orderMiss: orderMiss.current, knuffelMiss: knuffelMiss.current }), 1100);
      }
    } else {
      Sound.play('tryagain');
      orderMiss.current += 1;
      setMsg({ k: 'wait', t: 'Eerst: ' + nextNeed.label.toLowerCase() + '.' });
    }
  };

  const tapKnuffel = () => {
    if (finished.current) return;
    Sound.play('wait');
    knuffelMiss.current += 1;
    setMsg({ k: 'wait', t: 'Niet te veel knuffelen. Geef ' + naamTxt + ' rust.' });
  };

  return (
    <div className="care-routine">
      <div className="care-progress" aria-label={'stap ' + (done.length) + ' van ' + stappen.length}>
        {stappen.map(s => (
          <span key={s.id} className={'care-dot' + (done.includes(s.id) ? ' done' : (nextNeed && nextNeed.id === s.id ? ' next' : ''))} />
        ))}
      </div>

      <div className="care-grid">
        {stappen.map(s => {
          const isDone = done.includes(s.id);
          const isNext = nextNeed && nextNeed.id === s.id;
          return (
            <button key={s.id}
              className={'care-step' + (isDone ? ' done' : '') + (isNext ? ' next' : '')}
              onClick={() => tapStep(s)} disabled={isDone}>
              <span className="cs-ico"><CareIcon name={s.icon} size={24} /></span>
              <span className="cs-label">{s.label}</span>
              {isDone && <span className="cs-tick"><CareIcon name="check" size={16} color="#2f6b46" /></span>}
            </button>
          );
        })}
        {/* the tempting over-handling action (inhibition) */}
        <button className="care-step knuffel" onClick={tapKnuffel}>
          <span className="cs-ico"><CareIcon name="heart" size={24} /></span>
          <span className="cs-label">Knuffelen</span>
        </button>
      </div>

      <div className={'care-msg ' + msg.k}>{msg.t}</div>
    </div>
  );
}

Object.assign(window, {
  COMPANION_SOORTEN, FASE_ORDER, FASE_META, KUNSTJE_META, ZORG_STAPPEN, OPVANG_GASTEN,
  blankCompanion, blankRehab, mergeCompanion, mergeRehab,
  faseVoorBond, kunstjesVoorFase,
  CareIcon, CompanionSprite, BondMeter, CareRoutine,
});
