/* ============================================================
   screen-world.jsx — [E] World frame (missie-balk + step routing)
   Reads the active mission from Content and renders each step's
   EF-engine (zoeken/corsi/dagnacht) by `ef`, handing it the
   research-true skin. A light "wist-je-dat" fact card appears
   between steps (research Deel 5).
   ============================================================ */

/* small creature for the fact card */
function FactSprite({ dier }) {
  if (dier === 'ree') return <Reekalf size={92} />;
  if (dier === 'adder') return <div className="fact-adder" aria-hidden="true"><span /><span /><span /><span /></div>;
  if (dier && dier !== 'wildzwijn') return <DierSprite id={dier} size={92} />;
  return <Frisling size={92} mood="calm" />;
}

function FactCard({ feit, dier, onClose }) {
  const animal = Content.animal(dier);
  return (
    <div className="fact-overlay screen-enter">
      <div className="fact-card grain">
        <div className="fact-eyebrow">Wist je dat?</div>
        <div className="fact-art"><FactSprite dier={dier} /></div>
        <p className="fact-text">{feit}</p>
        {animal && <div className="fact-credit">{animal.naam}</div>}
        <button className="btn btn-primary fact-next" onClick={onClose}>Verder</button>
      </div>
    </div>
  );
}

function WorldScreen() {
  const { state, setStep, go, settings, logSession, easeEngine } = useGame();
  const step = state.worldStep;
  const mission = Content.mission(state.gebied, state.missie) || MISSIE_FRISLING;
  const cfg = mission.stappen[step - 1] || mission.stappen[0];
  const jargon = settings.jargon;
  const engine = cfg.ef;

  const [fact, setFact] = useState(null);
  const [ease, setEase] = useState(0);     // softening for THIS attempt (child / frustration)
  const [hint, setHint] = useState(0);     // bumped each time a hint is asked
  const [misses, setMisses] = useState(0); // misses in the current step

  // fresh helper state whenever the step (or mission) changes
  useEffect(() => { setEase(0); setHint(0); setMisses(0); }, [step, mission.id]);

  // a miss happened in the engine: count it; auto-ease silently on frustration
  const onMiss = () => {
    setMisses(m => {
      const n = m + 1;
      if (n >= 3 && settings.autoMoeilijk) { setEase(e => e + 1); easeEngine(engine); }
      return n;
    });
  };
  const makkelijker = () => { Sound.play('select'); setEase(e => e + 1); easeEngine(engine); setMisses(0); };
  const geefHint = () => { Sound.play('hover'); setHint(h => h + 1); };

  // metgezel along on the mission? its kunstje powers the hint (autonomy hook §6.1)
  const companion = state.companion || {};
  const metgezelMee = companion.rescued && companion.meeOpMissie && (companion.kunstjes || []).length > 0;
  const metNaam = companion.naam || 'je vriend';

  const titel = Content.pick(cfg.skin.copy.instructie, cfg.skin.copy.instructieKnap, jargon)
    || Content.efTitel(cfg.ef);

  const advance = () => {
    if (step < mission.stappen.length) setStep(step + 1);
    else go('reunion');
  };

  // a step finished: feed the skill record, then show its fact card (if any) or advance
  const onStepDone = (summary) => {
    if (summary) logSession(engine, summary);
    if (cfg.skin.feit && step < mission.stappen.length) {
      setFact({ feit: cfg.skin.feit, dier: cfg.skin.feitDier });
    } else {
      advance();
    }
  };
  const closeFact = () => { Sound.play('select'); setFact(null); advance(); };

  const Engine = { zoeken: StepSpot, corsi: StepRoute, dagnacht: StepDanger, simon: StepSimon, wisselen: StepWissel }[cfg.ef] || StepSpot;

  return (
    <div className="screen screen-enter world-screen">
      <Chrome title={mission.titel} instructie={titel} onBack={() => go('briefing')} />

      <div className="missie-balk">
        <div className="step-dots" aria-label={'Stap ' + step + ' van ' + mission.stappen.length}>
          {mission.stappen.map((_, i) => {
            const n = i + 1;
            return <span key={n} className={'dot' + (n < step ? ' done' : n === step ? ' current' : '')} />;
          })}
        </div>
        <div className="step-titel">{titel}</div>
        <div className="step-num">Stap {step}/{mission.stappen.length}</div>
      </div>

      <div className="world-stage">
        <Engine key={mission.id + '-' + step + '-' + ease} cfg={cfg} jargon={jargon}
          ease={ease} hint={hint} onMiss={onMiss} onDone={onStepDone} />
      </div>

      {/* child keeps the regie: a calm "easier / hint" offer once they struggle (§6.1) */}
      {misses >= 2 && !fact && (
        <div className="hulp-balk" role="group" aria-label="hulp">
          <span className="hulp-tekst">Lukt het niet? Dat geeft niks.</span>
          <button className="hulp-btn" onClick={makkelijker}>Maak makkelijker</button>
          <button className="hulp-btn ghost" onClick={geefHint}>{metgezelMee ? `Vraag ${metNaam}` : 'Hint'}</button>
        </div>
      )}

      {/* the metgezel flies along; tap to let it scout (a friendly hint) */}
      {metgezelMee && !fact && (
        <button className="world-metgezel" onClick={geefHint} aria-label={`Vraag ${metNaam} om hulp`}>
          <span className="wm-sprite"><Raaf size={52} /></span>
          <span className="wm-tip">{metNaam} kan speuren</span>
        </button>
      )}

      {fact && <FactCard feit={fact.feit} dier={fact.dier} onClose={closeFact} />}
    </div>
  );
}

Object.assign(window, { WorldScreen, FactCard, FactSprite });
