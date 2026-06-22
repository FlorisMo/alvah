/* ============================================================
   screen-briefing.jsx — [D] Ranger-briefing (read-aloud karaoke)
   ============================================================ */

function BriefingScreen() {
  const { go, setStep, state, settings } = useGame();
  const mission = Content.mission(state.gebied, state.missie) || MISSIE_FRISLING;
  const BRIEF_LINES = Content.pick(mission.briefing.simpel, mission.briefing.knap, settings.jargon);
  const reader = Speech.useLineReader(BRIEF_LINES);

  useEffect(() => { Sound.unlock(); }, []);

  const start = () => {
    Sound.play('select'); reader.stop();
    setStep(1);
    go('world');
  };

  return (
    <div className="screen screen-enter briefing-screen">
      <Chrome title="Ranger van de Veluwe" instructie={BRIEF_LINES.join(' ')} onBack={() => go('transport')} />

      <div className="bf-card grain">
        <div className="bf-left">
          <ArtPlate label="illustratie: ranger" round={18} style={{ height: '100%' }}>
            <div className="bf-portrait"><Ranger size={150} /></div>
          </ArtPlate>
          <div className="bf-grass-frisling">
            <div className="bf-grass" />
            <div className="bf-frisling-wrap"><Frisling size={72} mood="scared" /></div>
            <div className="bf-grass bf-grass-front" />
          </div>
        </div>

        <div className="bf-right">
          <div className="bf-eyebrow">Ranger-briefing</div>
          <div className="bf-lines">
            {BRIEF_LINES.map((line, i) => (
              <p key={i}
                 className={'bf-line' + (reader.current === i ? ' reading' : '')
                   + (reader.active && reader.current > i ? ' read-done' : '')}>
                <span className="bf-line-text">{line}</span>
              </p>
            ))}
          </div>

          <div className="bf-actions">
            <button className="btn btn-primary" onClick={start}>Ik ga!</button>
            <button
              className={'btn btn-ghost bf-read' + (reader.active ? ' active' : '')}
              onClick={() => reader.active ? reader.stop() : reader.start()}
              aria-pressed={reader.active}
            >
              <span className="bf-wave" aria-hidden="true"><i/><i/><i/><i/></span>
              {reader.active ? 'Stop' : 'Lees voor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BriefingScreen = BriefingScreen;
