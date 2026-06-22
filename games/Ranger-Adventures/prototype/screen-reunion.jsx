/* ============================================================
   screen-reunion.jsx — [F] Hereniging + beloning
   ============================================================ */

function ReunionScreen() {
  const { go, set, state, settings } = useGame();
  const reduced = settings.reducedMotion;
  const mission = Content.mission(state.gebied, state.missie) || MISSIE_FRISLING;
  const beloning = mission.beloning || { badgeNaam: 'Ranger-badge' };
  const dier = Content.animal(mission.dier) || {};
  const isRee = mission.dier === 'ree';
  const custom = mission.reunion;
  const isCustom = !!custom && !isRee;
  const terugWoord = Content.pick(dier.simpelWoord || 'frisling',
    (dier.vaktermen && dier.vaktermen.jong) || 'frisling', settings.jargon);
  const [phase, setPhase] = useState(reduced ? 'badge' : 'zoom'); // zoom→run→bloom→badge

  useEffect(() => {
    Sound.unlock();
    if (reduced) { Sound.play('reward'); set({ badgeVerdiend: true }); return; }
    const t1 = setTimeout(() => setPhase('run'), 700);
    const t2 = setTimeout(() => { setPhase('bloom'); Sound.play('bloom'); }, 2100);
    const t3 = setTimeout(() => { setPhase('badge'); Sound.play('reward'); set({ badgeVerdiend: true }); }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduced, set]);

  return (
    <div className={'screen screen-enter reunion-screen ' + phase + (isRee ? ' ree' : '')}>
      <div className="ru-sky" />
      <div className="ru-sun" />
      <div className="ru-hills" />
      <div className="ru-ground" />

      <ArtPlate label="illustratie: hereniging op de heide" round={0}
        style={{ position:'absolute', inset:0, border:'none', background:'transparent' }}>
        <div className="ru-scene">
          {isRee ? (
            <>
              {/* the kalf stays put in the grass — you did NOT take it */}
              <div className="ru-kalf"><Reekalf size={72} /></div>
              {/* the mother returns because you left it alone */}
              <div className={'ru-mother-ree' + (phase !== 'zoom' ? ' approach' : '')}>
                <Ree size={134} />
              </div>
            </>
          ) : isCustom ? (
            <div className="ru-hert"><DierSprite id={custom.sprite} size={150} /></div>
          ) : (
            <>
              {/* mother + rotte on the right */}
              <div className="ru-rotte">
                <div className="ru-boar-extra"><Boar size={84} /></div>
                <div className="ru-mother"><Boar size={128} /></div>
              </div>
              {/* frisling runs in */}
              <div className={'ru-frisling' + (phase !== 'zoom' ? ' run' : '')}>
                <Frisling size={70} mood="calm" />
              </div>
            </>
          )}
          {/* blooming plant */}
          <div className={'ru-plant' + (phase === 'bloom' || phase === 'badge' ? ' grown' : '')}>
            <span className="plant-stem" />
            <span className="plant-leaf l-l" /><span className="plant-leaf l-r" />
            <span className="plant-flower">
              {[0,1,2,3,4,5].map(i => <span key={i} className="petal" style={{ transform:`rotate(${i*60}deg) translateY(-13px)` }} />)}
              <span className="petal-core" />
            </span>
          </div>
          {/* drifting petals */}
          {(phase === 'bloom' || phase === 'badge') && !reduced && [0,1,2,3,4].map(i => (
            <span key={i} className="drift-petal" style={{ left: (38 + i*6) + '%', animationDelay: (i*0.3) + 's' }} />
          ))}
        </div>
      </ArtPlate>

      <div className="ru-text">{isRee ? 'De moeder kwam terug.' : isCustom ? custom.tekst : 'Je bracht de ' + terugWoord + ' terug.'}</div>

      {phase === 'badge' && (
        <div className="ru-badge-wrap screen-enter">
          <div className="ranger-badge">
            <div className="badge-ring">
              <div className="badge-inner">
                {isRee ? <Reekalf size={50} /> : isCustom ? <DierSprite id={custom.sprite} size={48} /> : <Frisling size={50} mood="calm" />}
              </div>
            </div>
            <div className="badge-glint" />
          </div>
          <div className="badge-name">{beloning.badgeNaam}</div>
          <div className="badge-sub">Nieuwe ranger-badge</div>
          <button className="btn btn-primary ru-next" onClick={() => { Sound.play('select'); go('complete'); }}>Verder</button>
        </div>
      )}
    </div>
  );
}

window.ReunionScreen = ReunionScreen;
