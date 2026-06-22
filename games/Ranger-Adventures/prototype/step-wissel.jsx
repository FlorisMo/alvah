/* ============================================================
   step-wissel.jsx — EF engine "wisselen" (cognitieve flexibiliteit)
   Skin: DAG/NACHT SORTEREN. Day animals go to the open clearing,
   night animals to the den — but the signpost flips now and then
   ("Nu andersom!") and the child must switch the rule. Source-true
   (research Deel 4: das/zwijn/nachtzwaluw are night-active).

   Never punishing: a wrong tap wiggles and lets you try again, no
   penalty, no game-over. Difficulty knob (§6.1): settings.wisselFreq
   drives how often the rule flips; skin.trials sets the length.
   ============================================================ */

function StepWissel({ cfg, jargon, ease, hint, onMiss, onDone }) {
  const { settings } = useGame();
  const diff = useEngineDifficulty('wisselen', ease);
  const reduced = settings.reducedMotion;
  const skin = (cfg && cfg.skin) || {};
  const copy = skin.copy || {};
  const dag = (skin.dagDieren && skin.dagDieren.length) ? skin.dagDieren : ['edelhert', 'ree'];
  const nacht = (skin.nachtDieren && skin.nachtDieren.length) ? skin.nachtDieren : ['das', 'nachtzwaluw', 'wildzwijn'];
  const totaal = Math.max(4, skin.trials || 8);
  // higher wisselFreq → flips more often (every 2) ; lower → calmer (every 6)
  const flipEvery = Math.max(2, Math.round(2 + (1 - (diff.wisselFreq != null ? diff.wisselFreq : 0.4)) * 4));
  const wrongCount = useRef(0);

  // a queue of animals — half day, half night, shuffled (stable per mount)
  const queue = React.useMemo(() => {
    const pool = [];
    for (let i = 0; i < totaal; i++) {
      const fromDag = i % 2 === 0;
      const arr = fromDag ? dag : nacht;
      pool.push({ id: arr[Math.floor(Math.random() * arr.length)], dag: fromDag });
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool;
  }, [totaal]);

  const [phase, setPhase] = useState('intro');  // intro | sort | done
  const [idx, setIdx] = useState(0);
  const [andersom, setAndersom] = useState(false);
  const [sinceFlip, setSinceFlip] = useState(0);
  const [fly, setFly] = useState(null);          // bin the animal is flying to
  const [wrong, setWrong] = useState(false);
  const [showFlip, setShowFlip] = useState(false);
  const [hintBin, setHintBin] = useState(null);
  const timers = useRef([]);
  const push = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const cur = queue[idx];
  const naturalBin = cur ? (cur.dag ? 'open' : 'hol') : null;
  const correctBin = andersom ? (naturalBin === 'open' ? 'hol' : 'open') : naturalBin;

  const begin = () => { Sound.unlock(); setPhase('sort'); };

  // hint: briefly point to the correct bin
  useEffect(() => {
    if (!hint || phase !== 'sort') return;
    setHintBin(correctBin);
    const t = setTimeout(() => setHintBin(null), 1500);
    return () => clearTimeout(t);
  }, [hint]);

  const choose = (bin) => {
    if (phase !== 'sort' || !cur || fly) return;
    if (bin === correctBin) {
      Sound.play('correct'); setFly(bin);
      push(() => {
        setFly(null);
        const next = idx + 1;
        if (next >= queue.length) { setPhase('done'); Sound.play('found'); push(() => onDone({ trials: 1, correct: wrongCount.current === 0 ? 1 : 0 }), 1500); return; }
        const sf = sinceFlip + 1;
        if (sf >= flipEvery) {
          setAndersom(a => !a); setSinceFlip(0);
          setShowFlip(true); Sound.play('select');
          push(() => setShowFlip(false), reduced ? 700 : 1400);
        } else setSinceFlip(sf);
        setIdx(next);
      }, reduced ? 220 : 540);
    } else {
      Sound.play('tryagain');
      wrongCount.current += 1;
      onMiss && onMiss();
      setWrong(true); push(() => setWrong(false), 480);
    }
  };

  const done = phase === 'done';
  const ruleText = andersom
    ? (copy.regelOm || 'Nu andersom!')
    : (copy.regel || 'Dag-dier → open plek. Nacht-dier → het hol.');

  return (
    <div className={'wissel-field' + (andersom ? ' inverted' : '')}>
      <div className="grass-base night" />
      <div className="dusk-sky" aria-hidden="true">
        {!reduced && [14, 30, 48, 64, 80, 90, 22].map((x, i) => (
          <span key={i} className="star" style={{ left: x + '%', top: (6 + (i * 9) % 26) + '%', animationDelay: (i * 0.5) + 's' }} />
        ))}
      </div>

      {/* signpost: the current rule, with day/night icons that swap on flip */}
      <div className={'wissel-sign' + (showFlip ? ' flipping' : '')}>
        {showFlip && <span className="ws-flag">Bordje draait!</span>}
        <span className="ws-rule">{ruleText}</span>
      </div>

      {!done && (
        <div className="wissel-stage">
          {/* left bin — open clearing (day) */}
          <button className={'wissel-bin bin-open' + (fly === 'open' ? ' catch' : '') + (hintBin === 'open' ? ' hint' : '')}
            onClick={() => choose('open')} disabled={phase !== 'sort'} aria-label="open plek">
            <span className="bin-ico sun" aria-hidden="true"><i /></span>
            <span className="bin-label">open plek</span>
          </button>

          {/* the animal to sort */}
          <div className={'wissel-center' + (wrong ? ' wrong' : '') + (fly ? ' fly-' + fly : '')}>
            {cur && (
              <>
                <span className="wc-art"><DierSprite id={cur.id} size={96} /></span>
                <span className="wc-name">{(Content.animal(cur.id) || {}).naam || cur.id}</span>
              </>
            )}
          </div>

          {/* right bin — the den (night) */}
          <button className={'wissel-bin bin-hol' + (fly === 'hol' ? ' catch' : '') + (hintBin === 'hol' ? ' hint' : '')}
            onClick={() => choose('hol')} disabled={phase !== 'sort'} aria-label="het hol">
            <span className="bin-ico moon" aria-hidden="true"><i /></span>
            <span className="bin-label">het hol</span>
          </button>
        </div>
      )}

      {/* progress dots */}
      <div className="wissel-progress" aria-label={(idx) + ' van ' + queue.length}>
        {queue.map((_, i) => <span key={i} className={'wp-dot' + (i < idx ? ' done' : i === idx && !done ? ' current' : '')} />)}
      </div>

      {phase === 'intro' && (
        <div className="wissel-intro">
          <p className="wissel-hint">{copy.instructie || 'Breng elk dier naar de goede plek.'}</p>
          <button className="btn btn-primary" onClick={begin}>Begin</button>
        </div>
      )}

      {done && <div className="feedback-toast ok">{copy.goed || 'Alle dieren op de goede plek!'}</div>}
    </div>
  );
}

window.StepWissel = StepWissel;
