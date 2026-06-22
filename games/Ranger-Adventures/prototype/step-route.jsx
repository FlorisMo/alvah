/* ============================================================
   step-route.jsx — World Step 2: Onthoud het pad
   EF: visueel-ruimtelijk volgordegeheugen (Corsi)
   ============================================================ */

const PRINT_SPOTS = [
  { id: 0, x: 18, y: 72 }, { id: 1, x: 34, y: 46 }, { id: 2, x: 50, y: 66 },
  { id: 3, x: 60, y: 36 }, { id: 4, x: 74, y: 58 }, { id: 5, x: 86, y: 34 },
  { id: 6, x: 44, y: 24 },
];

function StepRoute({ cfg, jargon, ease, hint, onMiss, onDone }) {
  const { settings } = useGame();
  const diff = useEngineDifficulty('corsi', ease);
  const reduced = settings.reducedMotion;
  const copy = ((cfg && cfg.skin) || {}).copy || {};
  const N = Math.max(3, Math.min(diff.routeLengte, 6));
  const wrongCount = useRef(0);

  // pick a sequence (stable per mount)
  const sequence = React.useMemo(() => {
    const ids = [...PRINT_SPOTS.map(p => p.id)];
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, N);
  }, [N]);

  const [phase, setPhase] = useState('intro');      // intro | show | recall | done
  const [showIdx, setShowIdx] = useState(-1);        // which seq index is lighting up
  const [recallIdx, setRecallIdx] = useState(0);     // next expected
  const [frisAt, setFrisAt] = useState(null);        // print id frisling stands on
  const [wrong, setWrong] = useState(null);
  const [correctFlash, setCorrectFlash] = useState(null);
  const [trial, setTrial] = useState(0);

  // run the show sequence
  useEffect(() => {
    if (phase !== 'show') return;
    let i = 0; let alive = true;
    const stepDur = reduced ? 360 : 620;
    setShowIdx(-1);
    const tick = () => {
      if (!alive) return;
      if (i >= sequence.length) {
        setTimeout(() => { if (alive) { setShowIdx(-1); setPhase('recall'); setRecallIdx(0); } }, 420);
        return;
      }
      setShowIdx(i); Sound.play('step');
      i++; setTimeout(tick, stepDur);
    };
    const t = setTimeout(tick, 500);
    return () => { alive = false; clearTimeout(t); };
  }, [phase, trial, sequence, reduced]);

  const begin = () => { Sound.unlock(); setPhase('show'); };

  // hint: replay the route during recall
  useEffect(() => {
    if (!hint) return;
    if (phase === 'recall') { setRecallIdx(0); setFrisAt(null); setTrial(t => t + 1); setPhase('show'); }
  }, [hint]);

  const tapPrint = (id) => {
    if (phase !== 'recall') return;
    const expected = sequence[recallIdx];
    if (id === expected) {
      Sound.play('correct');
      setFrisAt(id); setCorrectFlash(id); setTimeout(() => setCorrectFlash(null), 420);
      const next = recallIdx + 1;
      if (next >= sequence.length) {
        setPhase('done'); Sound.play('found');
        const correct = wrongCount.current === 0 ? 1 : 0;
        setTimeout(() => onDone({ trials: 1, correct }), 1500);
      } else setRecallIdx(next);
    } else {
      Sound.play('tryagain');
      wrongCount.current += 1;
      onMiss && onMiss();
      setWrong(id); setTimeout(() => setWrong(null), 500);
      // replay the route
      setTimeout(() => { setRecallIdx(0); setFrisAt(null); setTrial(t => t + 1); setPhase('show'); }, 700);
    }
  };

  const fris = frisAt != null ? PRINT_SPOTS.find(p => p.id === frisAt) : null;
  const banner = phase === 'show' ? (copy.toon || 'Kijk goed welke weg de groep liep…')
    : phase === 'recall' ? (copy.terug || 'Wijs de weg terug.')
    : phase === 'done' ? (copy.goed || 'Precies de goede weg!') : '';

  return (
    <div className="route-field">
      <div className="grass-base heath" />

      {/* faint connecting trail of the full sequence during show */}
      <svg className="route-trail" viewBox="0 0 100 100" preserveAspectRatio="none">
        {phase !== 'intro' && sequence.slice(0, Math.max(showIdx + 1, phase==='recall'||phase==='done'?0:0)).map((id, i, arr) => {
          if (i === 0) return null;
          const a = PRINT_SPOTS.find(p => p.id === arr[i-1]); const b = PRINT_SPOTS.find(p => p.id === id);
          return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="trail-line" />;
        })}
      </svg>

      {PRINT_SPOTS.map(p => {
        const seqPos = sequence.indexOf(p.id);
        const lit = phase === 'show' && seqPos !== -1 && seqPos <= showIdx;
        const active = phase === 'show' && seqPos === showIdx;
        return (
          <button key={p.id}
            className={'print' + (lit ? ' lit' : '') + (active ? ' active' : '')
              + (wrong === p.id ? ' wrong' : '') + (correctFlash === p.id ? ' correct' : '')}
            style={{ left: p.x + '%', top: p.y + '%' }}
            onClick={() => tapPrint(p.id)}
            aria-label="voetstap">
            <span className="print-mark" />
            {reduced && phase === 'show' && seqPos !== -1 && <span className="print-num">{seqPos + 1}</span>}
          </button>
        );
      })}

      {/* frisling walking the path */}
      {fris && (
        <div className="route-frisling" style={{ left: fris.x + '%', top: fris.y + '%' }}>
          <Frisling size={56} mood="calm" />
        </div>
      )}

      <div className="route-banner">{banner}</div>

      {phase === 'intro' && (
        <div className="route-intro">
          <button className="btn btn-primary" onClick={begin}>Laat de weg zien</button>
        </div>
      )}
    </div>
  );
}

window.StepRoute = StepRoute;
