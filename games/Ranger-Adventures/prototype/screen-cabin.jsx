/* ============================================================
   screen-cabin.jsx — "Het huisje" (the hub / home)
   Home of the metgezel: rescue → care → friend (HANDOFF §7.2).
   Also holds the opvang (rehab release loop) and an entry to the
   ranger-logboek. Warm, calm, owned — the no-shame safe place.
   ============================================================ */

/* ---- rescue intro (redden): a young raven found cold & alone ---- */
function RescueFlow({ onRescued }) {
  const { setCompanion } = useGame();
  const [stap, setStap] = useState('vinden');     // vinden → naam
  const [naam, setNaam] = useState(null);
  const soort = COMPANION_SOORTEN.raaf;

  const help = () => { Sound.unlock(); Sound.play('select'); setStap('naam'); };
  const kies = (n) => { Sound.play('hover'); setNaam(n); };
  const klaar = () => { Sound.play('reward'); Sound.call('raaf'); onRescued(naam || soort.namen[0]); };

  return (
    <div className="rescue-flow">
      <div className="rescue-art">
        <CompanionSprite companion={{ soort: 'raaf', fase: 'baby' }} size={150} state="koud" />
      </div>

      {stap === 'vinden' && (
        <div className="rescue-panel">
          <div className="rescue-eyebrow">Bij het huisje</div>
          <h2 className="rescue-title">Een jonge raaf</h2>
          <p className="rescue-text">Je vindt een jonge raaf bij het huisje.<br/>Hij is koud en bang. Hij heeft hulp nodig.</p>
          <button className="btn btn-green" onClick={help}>Help hem</button>
        </div>
      )}

      {stap === 'naam' && (
        <div className="rescue-panel">
          <div className="rescue-eyebrow">Jouw vriend</div>
          <h2 className="rescue-title">Hoe noem je hem?</h2>
          <div className="naam-rij">
            {soort.namen.map(n => (
              <button key={n} className={'naam-knop' + (naam === n ? ' gekozen' : '')} onClick={() => kies(n)}>{n}</button>
            ))}
          </div>
          <button className="btn btn-green" onClick={klaar} disabled={!naam}>
            {naam ? `Welkom, ${naam}` : 'Kies een naam'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---- the opvang (rehab): tend a guest, then RELEASE it ---- */
function OpvangKaart() {
  const { state, startRehab, releaseRehab } = useGame();
  const rehab = state.rehab || {};
  const companion = state.companion || {};
  const [caring, setCaring] = useState(false);
  const [verzorgd, setVerzorgd] = useState(false);
  const [vrij, setVrij] = useState(false);

  const gast = rehab.dier ? { dier: rehab.dier, reden: rehab.reden } : null;
  const gastNaam = gast ? (Content.animal(gast.dier) || {}).naam || gast.dier : '';

  const haalGast = () => {
    Sound.play('select');
    const opties = OPVANG_GASTEN;
    startRehab(opties[Math.floor(Math.random() * opties.length)]);
    setVerzorgd(false); setVrij(false);
  };
  const klaarMetZorg = () => { setCaring(false); setVerzorgd(true); Sound.play('found'); };
  const laatVrij = () => {
    Sound.play('reward');
    setVrij(true);
    setTimeout(() => { releaseRehab(); setVrij(false); setVerzorgd(false); }, 1700);
  };

  return (
    <div className="opvang-kaart">
      <div className="ok-head">
        <span className="ok-title">De opvang</span>
        {rehab.releasedCount > 0 && <span className="ok-count">{rehab.releasedCount} vrijgelaten</span>}
      </div>

      {!rehab.active && (
        <div className="ok-leeg">
          <p className="ok-text">Soms heeft een dier even hulp nodig. Je verzorgt het en laat het weer vrij.</p>
          <button className="btn btn-ghost" onClick={haalGast}>Kijk wie er is</button>
        </div>
      )}

      {rehab.active && !caring && !vrij && (
        <div className="ok-gast">
          <div className={'ok-gast-art' + (verzorgd ? ' beter' : '')}><DierSprite id={gast.dier} size={88} /></div>
          <div className="ok-gast-body">
            <div className="ok-gast-naam">{gastNaam}</div>
            <p className="ok-text">{verzorgd ? `${gastNaam} is weer sterk genoeg.` : `Een ${gastNaam} is ${gast.reden}.`}</p>
            {!verzorgd
              ? <button className="btn btn-green" onClick={() => { Sound.unlock(); setCaring(true); }}>Verzorg</button>
              : <button className="btn btn-green" onClick={laatVrij}>Laat vrij</button>}
          </div>
        </div>
      )}

      {rehab.active && caring && (
        <div className="ok-care">
          <p className="ok-text">Geef {gastNaam} de juiste zorg.</p>
          <CareRoutine stappen={ZORG_STAPPEN.baby} naam={gastNaam} onComplete={klaarMetZorg} />
        </div>
      )}

      {vrij && (
        <div className="ok-vrij">
          <div className="ok-vrij-art"><DierSprite id={gast ? gast.dier : 'raaf'} size={84} /></div>
          <p className="ok-text big">Hij vliegt weg. Vrij en sterk.</p>
        </div>
      )}
    </div>
  );
}

/* ---- the case-board (prikbord): season-arc clues + hopeful resolution (HANDOFF §6.4) ---- */
function CaseBoard() {
  const { state, resolveArc } = useGame();
  const story = state.story || {};
  const clues = Content.clues(state.gebied) || [];
  const foundMap = story.clues || {};
  const found = clues.filter(c => foundMap[c.id] === 'found');
  const allFound = clues.length > 0 && found.length === clues.length;
  const vb = Content.verhaalboog(state.gebied) || {};
  const ontknoping = vb.ontknoping || [];
  const resolved = !!(story.antagonist && story.antagonist.reported);
  const seasonMeta = Content.seasonMeta(story.seizoen || 'lente');
  const laatste = found.length ? found[found.length - 1] : null;
  const [stap, setStap] = useState(-1);   // ontknoping beat index (-1 = idle)

  const startOntknoping = () => { Sound.play('select'); setStap(0); };
  const volgende = () => {
    if (stap < ontknoping.length - 1) { Sound.play('hover'); setStap(stap + 1); }
    else { Sound.play('reward'); resolveArc(); setStap(-1); }
  };

  return (
    <div className="case-board">
      <div className="cb-head">
        <span className="cb-title">Het prikbord</span>
        <span className="cb-chapter">{seasonMeta.naam}{resolved ? '' : ` · ${found.length}/${clues.length}`}</span>
      </div>
      <div className="cb-cork">
        <span className="cb-string" aria-hidden="true" />
        <div className="cb-clues">
          {clues.map(c => {
            const isf = foundMap[c.id] === 'found';
            return (
              <div key={c.id} className={'cb-clue' + (isf ? ' found' : '')}>
                <span className="cb-pin" aria-hidden="true" />
                <span className="cb-photo">{isf ? <ClueIcon soort={c.soort} size={24} /> : <span className="cb-q">?</span>}</span>
                <span className="cb-clue-title">{isf ? c.titel : '???'}</span>
              </div>
            );
          })}
        </div>
      </div>
      {resolved
        ? <p className="cb-note ok">De stroper is gestopt. De heide en het ven groeien weer terug.</p>
        : laatste
          ? <p className="cb-note">{laatste.tekst}</p>
          : <p className="cb-note muted">Los missies op. Aanwijzingen komen hier te hangen.</p>}
      {allFound && !resolved && (
        <button className="btn btn-green cb-resolve" onClick={startOntknoping}>Volg het spoor</button>
      )}

      {stap >= 0 && ontknoping[stap] && (
        <div className="cb-ontknoping-overlay" onClick={volgende}>
          <div className="cb-ontknoping grain" onClick={e => e.stopPropagation()}>
            <div className="cbo-eyebrow">{seasonMeta.naam} · stap {stap + 1}/{ontknoping.length}</div>
            <p className="cbo-text">{ontknoping[stap].tekst}</p>
            <button className="btn btn-primary" onClick={volgende}>{stap < ontknoping.length - 1 ? 'Verder' : 'Klaar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- main cabin ---- */
function CabinScreen() {
  const { go, state, setCompanion, rescueCompanion, bondDelta, clearCompanionGroei } = useGame();
  const companion = state.companion || {};
  const [caring, setCaring] = useState(false);
  const [logboek, setLogboek] = useState(false);
  const [feest, setFeest] = useState(null);   // fase just reached

  const naam = companion.naam || 'je vriend';
  const fase = companion.fase || 'baby';
  const faseMeta = FASE_META[fase] || {};
  const stappen = ZORG_STAPPEN[fase] || ZORG_STAPPEN.baby;

  const onRescued = (n) => rescueCompanion(n);

  const onCareDone = (summary) => {
    setCaring(false);
    const straf = (summary.orderMiss || summary.knuffelMiss) ? 4 : 0;
    bondDelta(12 - straf);
  };

  // surface a fase-growth celebration once
  React.useEffect(() => {
    if (state.companionGroei) {
      setFeest(state.companionGroei);
      clearCompanionGroei();
    }
  }, [state.companionGroei]);

  const toggleMee = () => {
    Sound.play('select');
    setCompanion({ meeOpMissie: !companion.meeOpMissie });
  };

  return (
    <div className="screen screen-enter cabin-screen grain">
      <Chrome title="Het huisje" onBack={() => go('map')} />

      <div className="cabin-room">
        <div className="cabin-window" aria-hidden="true"><span className="cw-sun" /></div>
        <div className="cabin-beam b1" aria-hidden="true" />
        <div className="cabin-shelf" aria-hidden="true" />

        {!companion.rescued ? (
          <RescueFlow onRescued={onRescued} />
        ) : (
          <div className="cabin-main">
            {/* companion on the perch */}
            <div className="perch-area">
              <div className="perch" aria-hidden="true" />
              <CompanionSprite companion={companion} size={150} state={caring ? 'rust' : 'blij'} />
              <div className="comp-card">
                <div className="comp-naam">{naam}</div>
                <div className="comp-fase">{faseMeta.label} · {faseMeta.kort}</div>
                <BondMeter bond={companion.bond} />
                {companion.kunstjes && companion.kunstjes.length > 0 && (
                  <div className="comp-kunstjes">
                    {companion.kunstjes.map(k => (
                      <span key={k} className="kunstje-chip"><CareIcon name={(KUNSTJE_META[k] || {}).icon} size={14} color="#2f6b46" />{(KUNSTJE_META[k] || {}).naam}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* care + actions */}
            <div className="cabin-actions">
              {!caring ? (
                <>
                  <button className="btn btn-green big-care" onClick={() => { Sound.unlock(); setCaring(true); }}>Verzorg {naam}</button>
                  <p className="care-hint">Doe de zorg op volgorde. Niet te veel knuffelen — geef {naam} rust.</p>
                  {fase !== 'baby' && (
                    <button className={'mee-toggle' + (companion.meeOpMissie ? ' aan' : '')} onClick={toggleMee}>
                      <span className="mt-dot" />
                      {companion.meeOpMissie ? `${naam} gaat mee op missie` : `${naam} thuis laten`}
                    </button>
                  )}
                </>
              ) : (
                <CareRoutine stappen={stappen} naam={naam} onComplete={onCareDone} />
              )}
            </div>
          </div>
        )}

        {/* prikbord (case-board) + opvang + logboek */}
        {companion.rescued && (
          <div className="cabin-side">
            <CaseBoard />
            <OpvangKaart />
            <button className="cabin-logboek" onClick={() => { Sound.play('hover'); setLogboek(true); }}>
              <span className="cl-medal"><span className="cl-dot" /></span>
              Open je ranger-logboek
            </button>
          </div>
        )}
      </div>

      {feest && (
        <div className="feest-overlay" onClick={() => setFeest(null)}>
          <div className="feest-card" onClick={e => e.stopPropagation()}>
            <CompanionSprite companion={{ ...companion, fase: feest }} size={140} state="blij" />
            <div className="feest-eyebrow">{naam} groeide</div>
            <h2 className="feest-title">{(FASE_META[feest] || {}).label}</h2>
            <p className="feest-text">
              {feest === 'jong' ? `${naam} is sterker. Hij kan nu met je mee op missie en mee speuren.`
                : feest === 'zelfstandig' ? `${naam} is een vrije vriend. Hij vliegt met je mee en wijst je de weg.`
                : `${naam} groeit goed.`}
            </p>
            <button className="btn btn-green" onClick={() => setFeest(null)}>Fijn!</button>
          </div>
        </div>
      )}

      {logboek && <Logboek onClose={() => setLogboek(false)} />}
    </div>
  );
}

window.CabinScreen = CabinScreen;
