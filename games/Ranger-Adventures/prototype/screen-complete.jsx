/* ============================================================
   screen-complete.jsx — [G] Missie-afsluiting
   ============================================================ */

function CompleteScreen() {
  const { go, set, setStep, state, settings, bumpSkill, clearGroei, findClue } = useGame();
  const [logboek, setLogboek] = useState(false);
  const [steviger, setSteviger] = useState(false);
  const mission = Content.mission(state.gebied, state.missie) || MISSIE_FRISLING;
  const beloning = mission.beloning || { badgeNaam: 'Ranger-badge' };
  const area = Content.area(state.gebied) || { naam: 'Veluwe' };
  const isRee = mission.dier === 'ree';
  const isCustom = !!mission.reunion && !isRee;
  const vakterm = settings.jargon && beloning.vaktermBadge;
  const voltooid = state.voltooid || {};
  const groei = state.recentGroei || [];
  // story clue this mission drops (HANDOFF §6.4) — shown as a hopeful beat
  const clue = mission.verhaalHaak ? Content.clue(state.gebied, mission.verhaalHaak) : null;
  const story = state.story || {};
  const clueNieuw = clue && (story.clues || {})[clue.id] !== 'found';
  const next = (area.missies || []).find(m => m.status === 'actief' && m.id !== mission.id && !voltooid[m.id]);

  const toMap = () => {
    Sound.play('select');
    const knap = { ...(state.knapWoorden || {}) };
    if (vakterm) knap[vakterm.id] = { naam: vakterm.naam };
    set({
      missieKlaar: true,
      voltooid: { ...voltooid, [mission.id]: true },
      knapWoorden: knap,
      recentGroei: [],
    });
    setStep(1);
    if (clue) findClue(clue);   // drop the season clue onto the case-board (idempotent)
    go('map');
  };

  const lastiger = () => { Sound.play('reward'); bumpSkill(0.6); setSteviger(true); };

  return (
    <div className="screen screen-enter complete-screen">
      <Chrome title="Ranger van de Veluwe" onBack={toMap} />

      <div className="cp-card">
        <div className="cp-badge">
          <div className="badge-ring" style={{ width: 96, height: 96 }}>
            <div className="badge-inner" style={{ width: 72, height: 72 }}>
              {isRee ? <Reekalf size={36} /> : isCustom ? <DierSprite id={mission.dier} size={34} /> : <Frisling size={34} mood="calm" />}
            </div>
          </div>
        </div>
        <div className="cp-eyebrow">Missie klaar</div>
        <h1 className="cp-title">Goed bezig, ranger.</h1>
        <p className="cp-text">Je hebt de missie afgerond.<br/>Je verdiende de badge „{beloning.badgeNaam}”.</p>

        {groei.length > 0 && (
          <div className="groei-banner">
            <div className="groei-mini">
              {groei.slice(0, 3).map(e => (
                <BreinBadge key={e} engine={e} skill={(state.skill || {})[e]} size={44} />
              ))}
            </div>
            <div className="groei-text">
              Je breinkracht groeide vandaag. Knap gedaan, ranger.
            </div>
          </div>
        )}

        {clueNieuw && (
          <div className="clue-beat">
            <span className="clue-beat-ico"><ClueIcon soort={clue.soort} size={22} /></span>
            <div className="clue-beat-body">
              <div className="clue-beat-title">{clue.titel}</div>
              <p className="clue-beat-text">{clue.tekst}</p>
              <p className="clue-beat-foot">Het hangt nu op je prikbord in het huisje.</p>
            </div>
          </div>
        )}

        <div className="cp-actions">
          <button className="btn btn-green" onClick={toMap}>Naar de kaart</button>
          <button className="btn btn-ghost" onClick={() => { Sound.play('hover'); setLogboek(true); }}>Jouw logboek</button>
        </div>

        {settings.autoMoeilijk && !steviger ? (
          <button className="btn btn-ghost cp-lastiger" onClick={lastiger}>Klaar voor een lastiger spoor?</button>
        ) : steviger ? (
          <p className="cp-lastiger-ok">Top — het volgende spoor wordt een tikkeltje pittiger.</p>
        ) : null}
      </div>

      {logboek && <Logboek onClose={() => setLogboek(false)} highlight={{ groei }} />}
    </div>
  );
}

window.CompleteScreen = CompleteScreen;
