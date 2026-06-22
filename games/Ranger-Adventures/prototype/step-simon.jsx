/* ============================================================
   step-simon.jsx — EF engine "simon" (werkgeheugen, audio-visueel)
   Skin: GELUID-ECHO. The animals call a growing sequence in the
   dusk; the child "answers the animals" by tapping them back in
   order. Audio working memory + you learn the real calls
   (burlen / blaf / knor / kroa / ratel). The visual light-up
   carries the sequence too, so it plays with sound muted.

   Never punishing: a wrong tap just replays the same sequence,
   no shortening, no game-over. Difficulty knobs (§6.1):
   settings.simonLengte (target length) + reduced-motion tempo.
   ============================================================ */

function StepSimon({ cfg, jargon, ease, hint, onMiss, onDone }) {
  const { settings } = useGame();
  const diff = useEngineDifficulty('simon', ease);
  const reduced = settings.reducedMotion;
  const skin = (cfg && cfg.skin) || {};
  const copy = skin.copy || {};
  const dieren = (skin.dieren && skin.dieren.length) ? skin.dieren
    : ['edelhert', 'ree', 'wildzwijn', 'raaf'];
  const target = Math.max(2, Math.min(diff.simonLengte || 3, 6));
  const wrongCount = useRef(0);

  const [seq, setSeq] = useState([]);        // current sequence to echo
  const [phase, setPhase] = useState('intro'); // intro | listen | echo | pause | done
  const [active, setActive] = useState(null);  // animal id currently calling
  const [pos, setPos] = useState(0);           // next expected echo index
  const [tap, setTap] = useState(null);        // animal just tapped (visual)
  const [msg, setMsg] = useState(null);        // { kind, text } gentle feedback
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const rand = () => dieren[Math.floor(Math.random() * dieren.length)];

  const begin = () => {
    Sound.unlock();
    setSeq([rand(), rand()]);
    setPhase('listen');
  };

  // (re)play the sequence whenever we enter 'listen'
  useEffect(() => {
    if (phase !== 'listen' || !seq.length) return;
    clearTimers();
    setActive(null); setPos(0);
    const gap = reduced ? 380 : 250;
    let t = 480;
    seq.forEach((id) => {
      timers.current.push(setTimeout(() => { setActive(id); Sound.call(id); }, t));
      const dur = Sound.callDur(id) * 1000;
      timers.current.push(setTimeout(() => setActive(null), t + dur));
      t += dur + gap;
    });
    timers.current.push(setTimeout(() => { setActive(null); setPhase('echo'); }, t));
    return clearTimers;
  }, [phase, seq, reduced]);

  useEffect(() => clearTimers, []);

  // hint: replay the current sequence
  useEffect(() => {
    if (!hint) return;
    if (phase === 'echo' || phase === 'listen') { setMsg(null); setPos(0); setPhase('listen'); }
  }, [hint]);

  const tapDier = (id) => {
    if (phase !== 'echo') return;
    setTap(id); Sound.call(id);
    setTimeout(() => setTap(t => (t === id ? null : t)), 240);

    if (id === seq[pos]) {
      const next = pos + 1;
      if (next < seq.length) { setPos(next); return; }
      // round complete
      if (seq.length >= target) {
        setPhase('done'); Sound.play('found');
        setMsg({ kind: 'ok', text: copy.goed || 'Knap onthouden!' });
        const correct = wrongCount.current === 0 ? 1 : 0;
        timers.current.push(setTimeout(() => onDone({ trials: 1, correct }), 1600));
      } else {
        Sound.play('correct');
        setMsg({ kind: 'ok', text: 'Goed onthouden!' });
        setPhase('pause');
        timers.current.push(setTimeout(() => {
          setMsg(null); setSeq(s => [...s, rand()]); setPhase('listen');
        }, 1100));
      }
    } else {
      // gentle — replay the same sequence, no penalty
      Sound.play('tryagain');
      wrongCount.current += 1;
      onMiss && onMiss();
      setMsg({ kind: 'wait', text: 'Luister nog een keer.' });
      setPhase('pause');
      timers.current.push(setTimeout(() => {
        setMsg(null); setPos(0); setPhase('listen');
      }, 1300));
    }
  };

  const banner =
    phase === 'listen' ? (copy.luister || 'Luister naar de dieren…') :
    phase === 'echo'   ? (copy.echo || 'Doe ze na. Tik de dieren.') :
    phase === 'done'   ? (copy.goed || 'Knap onthouden!') :
                         (copy.instructie || 'Antwoord de dieren.');

  return (
    <div className="simon-field">
      <div className="grass-base night" />
      <div className="dusk-sky" aria-hidden="true">
        {!reduced && [12, 26, 40, 58, 72, 84, 33, 66].map((x, i) => (
          <span key={i} className="star" style={{ left: x + '%', top: (8 + (i * 7) % 30) + '%', animationDelay: (i * 0.4) + 's' }} />
        ))}
        <span className="dusk-moon" />
      </div>

      {/* progress: how far into this round + how long the round is */}
      <div className="simon-progress" aria-label={'reeks ' + seq.length}>
        <span className="sp-label">Reeks</span>
        <span className="sp-dots">
          {seq.map((_, i) => (
            <span key={i} className={'sp-dot' + (i < pos ? ' done' : '') + (phase === 'echo' && i === pos ? ' next' : '')} />
          ))}
        </span>
      </div>

      <div className={'simon-banner' + (phase === 'listen' ? ' listening' : '')}>{banner}</div>

      <div className="simon-row">
        {dieren.map((id) => {
          const a = Content.animal(id) || {};
          return (
            <button key={id}
              className={'simon-dier' + (active === id ? ' calling' : '') + (tap === id ? ' tapped' : '')}
              onClick={() => tapDier(id)} disabled={phase !== 'echo'}
              aria-label={a.naam || id}>
              <span className="sd-glow" />
              <span className="sd-art"><DierSprite id={id} size={82} /></span>
              <span className="sd-name">{a.naam || id}</span>
              {active === id && <span className="sd-wave" aria-hidden="true"><i /><i /><i /></span>}
            </button>
          );
        })}
      </div>

      {phase === 'intro' && (
        <div className="simon-intro">
          <p className="simon-hint">{copy.instructie || 'De dieren roepen. Doe ze na.'}</p>
          <button className="btn btn-primary" onClick={begin}>Luister</button>
        </div>
      )}

      {msg && <div className={'feedback-toast ' + msg.kind}>{msg.text}</div>}
    </div>
  );
}

window.StepSimon = StepSimon;
