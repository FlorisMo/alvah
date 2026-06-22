/* ============================================================
   step-danger.jsx — EF engine "dagnacht" (inhibitie / remmen, Stroop-achtig)
   Research-true skin: the tempting impulse (aai / pak / voer / recht-erdoor)
   must be inhibited in favour of the ranger rule. One encounter FLIPS
   (the safe action is to GO) so it stays a real inhibition task, not
   "always say no".

   A WRONG choice is no longer a no-op: it triggers a research-rooted
   consequence — the animal reacts (flees / rears / swarms), the ranger is
   knocked back, ground on "Terug naar de groep" is lost, and a few of the
   eikels you collected on the way spill. Recoverable, never a game-over.
   ============================================================ */

function Subject({ kind }) {
  if (kind === 'reekalf') return <div className="enc-figure"><Reekalf size={104} /></div>;
  if (kind === 'zwijn-honger') return <div className="enc-figure"><Boar size={104} /></div>;
  if (kind === 'adder') return (
    <div className="enc-figure hazard slang" aria-hidden="true">
      <span className="snake s1" /><span className="snake s2" /><span className="snake s3" /><span className="snake s4" /><span className="snake-head" />
      <span className="hazard-label">adder</span>
    </div>
  );
  if (kind === 'modderpoel') return (
    <div className="enc-figure hazard modder" aria-hidden="true">
      <span className="puddle" /><span className="bubble b1" /><span className="bubble b2" />
      <span className="hazard-label">modderpoel</span>
    </div>
  );
  // pad-veilig: an open way home
  return (
    <div className="enc-figure enc-gate" aria-hidden="true">
      <span className="gate-post gp-l" /><span className="gate-post gp-r" />
      <span className="gate-path" />
      <span className="hazard-label">vrij pad</span>
    </div>
  );
}

function StepDanger({ cfg, jargon, ease, hint, onMiss, onDone }) {
  const { settings, state, set } = useGame();
  const diff = useEngineDifficulty('dagnacht', ease);
  const reduced = settings.reducedMotion;
  const slowmo = diff.slowmo && !reduced;
  const skin = (cfg && cfg.skin) || {};
  const encounters = (skin.encounters && skin.encounters.length) ? skin.encounters : [
    { id: 'x', subject: 'adder', vraag: 'Pas op. Blijf uit de buurt.',
      opties: [{ label: 'Nader', goed: false }, { label: 'Hou afstand', goed: true }],
      uitleg: 'Goed zo.', gevolg: 'De adder schrikt. Hou afstand.', reactie: 'rear' },
  ];
  const regels = skin.regels || [];
  const metgezel = skin.metgezel || 'frisling';

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('walk');     // walk | choose | feedback | done
  const [feedback, setFeedback] = useState(null);  // { kind:'ok'|'gevolg', text }
  const [order, setOrder] = useState([0, 1]);
  const [hintOn, setHintOn] = useState(false);
  const wrongSet = useRef(new Set());

  // hint: briefly mark the safe choice
  useEffect(() => {
    if (!hint || phase !== 'choose') return;
    setHintOn(true);
    const t = setTimeout(() => setHintOn(false), 1500);
    return () => clearTimeout(t);
  }, [hint]);

  // consequence state
  const [reactie, setReactie] = useState(null);    // 'flee'|'rear'|'swarm'|'mud'|'recede'
  const [knock, setKnock] = useState(false);       // ranger recoil
  const [terugSlag, setTerugSlag] = useState(0);    // lost ground (in encounter units)
  const eikelsRef = useRef(state.eikels || 0);
  const [eikels, setEikels] = useState(state.eikels || 0);
  const [eikelFlash, setEikelFlash] = useState(false);
  const [lostN, setLostN] = useState(0);

  const enc = encounters[idx];
  const done = phase === 'done' || idx >= encounters.length;
  const eff = Math.max(0, idx - terugSlag);                       // effective forward distance
  const progress = Math.round((done ? 1 : Math.min(1, eff / encounters.length)) * 100);
  const walkerLeft = (10 + (done ? 1 : Math.min(1, eff / encounters.length)) * 72) + '%';

  useEffect(() => {
    if (idx >= encounters.length) {
      setPhase('done'); Sound.play('found');
      const total = encounters.length;
      const correct = Math.max(0, total - wrongSet.current.size);
      setTimeout(() => onDone({ trials: total, correct }), 1400); return;
    }
    setPhase('walk');
    const t = setTimeout(() => {
      setOrder(Math.random() < 0.5 ? [0, 1] : [1, 0]);
      setPhase('choose');
    }, reduced ? 350 : 850);
    return () => clearTimeout(t);
  }, [idx, reduced, encounters, onDone]);

  const choose = (optIndex) => {
    if (phase !== 'choose') return;
    const opt = enc.opties[optIndex];
    if (opt.goed) {
      Sound.play('correct');
      setReactie(null); setKnock(false);
      setFeedback({ kind: 'ok', text: enc.uitleg || 'Rustig zo' });
      setPhase('feedback');
      setTimeout(() => { setFeedback(null); setIdx(i => i + 1); }, 1600);
    } else {
      // ---- the wrong choice now CLEARLY does something ----
      Sound.play('wait');
      wrongSet.current.add(idx);
      onMiss && onMiss();
      setReactie(enc.reactie || 'flee');
      setKnock(true);
      setTerugSlag(t => Math.min(1.6, t + (enc.terug != null ? enc.terug : 0.5)));

      const kost = enc.eikelKost != null ? enc.eikelKost : 2;
      const verlies = Math.min(kost, eikelsRef.current);
      if (verlies > 0) {
        const n = eikelsRef.current - verlies;
        eikelsRef.current = n;
        setEikels(n);
        setLostN(verlies);
        setEikelFlash(true);
        set({ eikels: n });
        setTimeout(() => setEikelFlash(false), 900);
      }

      setFeedback({ kind: 'gevolg', text: enc.gevolg || 'Wacht even. Probeer het anders.' });
      setPhase('feedback');
      setTimeout(() => {
        setReactie(null); setKnock(false); setFeedback(null); setPhase('choose');
      }, reduced ? 1500 : 2100);
    }
  };

  return (
    <div className={'danger-field' + (slowmo && phase === 'choose' ? ' slowmo' : '')}>
      <div className="grass-base path-bg" />

      <div className="danger-progress">
        <span className="dp-label">Terug naar de groep</span>
        <div className="dp-track"><div className="dp-fill" style={{ width: progress + '%' }} /></div>
      </div>

      {/* eikels you carry home — a wrong choice spills some */}
      <div className={'danger-eikels' + (eikelFlash ? ' lost' : '')} aria-label="eikels">
        <span className="acorn sm"><i className="acorn-cap" /><i className="acorn-nut" /></span>
        <span className="de-num">{eikels}</span>
        {eikelFlash && lostN > 0 && <span className="de-lost">-{lostN}</span>}
      </div>

      {/* persistent flagship ranger rules — a gentle reminder, not a scold */}
      {regels.length > 0 && !done && (
        <div className="enc-regels" aria-label="ranger-regels">
          {regels.map((r, i) => <span key={i} className="regel-chip">{r}</span>)}
        </div>
      )}

      {!done && (
        <div className={'rule-banner' + (enc.flip ? ' flip' : '')}>
          {enc.flip && phase === 'choose' && <span className="flip-cue">Nu mag het wél</span>}
          {enc.vraag}
        </div>
      )}

      {/* the whole rotte rushing in when you feed them */}
      {reactie === 'swarm' && !done && (
        <div className="swarm-extra" aria-hidden="true">
          <span className="swarm-boar b1"><Boar size={58} /></span>
          <span className="swarm-boar b2"><Boar size={46} /></span>
          <span className="swarm-boar b3"><Boar size={52} /></span>
        </div>
      )}

      {!done && (
        <div className="enc-stage enc-col">
          <div className={'enc-subject-wrap' + (reactie ? ' react-' + reactie : '')}>
            <Subject kind={enc.subject} />
          </div>
          <div className="enc-options">
            {order.map((optIndex, slot) => {
              const opt = enc.opties[optIndex];
              return (
                <button key={slot}
                  className={'choice-zone choice-opt' + (phase === 'choose' ? ' active' : '') + (hintOn && opt.goed ? ' hint' : '')}
                  onClick={() => choose(optIndex)} disabled={phase !== 'choose'}>
                  <span className="choice-halo" />
                  <span className="opt-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ranger + (optional) trailing companion walking home */}
      <div className={'danger-walker' + (knock ? ' knock' : '') + (reactie === 'mud' ? ' mud' : '')}
        style={{ left: walkerLeft }}>
        <div className="walker-ranger"><Ranger size={62} /></div>
        {metgezel !== 'geen' && (
          <div className="walker-fris">
            {metgezel === 'reekalf' ? <Reekalf size={46} /> : <Frisling size={46} mood="calm" />}
          </div>
        )}
      </div>

      {feedback && <div className={'feedback-toast ' + feedback.kind}>{feedback.text}</div>}
    </div>
  );
}

Object.assign(window, { StepDanger, Subject });
