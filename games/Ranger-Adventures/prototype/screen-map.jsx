/* ============================================================
   screen-map.jsx — [A] Gebied-overzicht
   Renders from the Content area-registry (window.AREAS), so new
   areas are DATA, not layout. Each pin opens that area's mission
   list; missions are inzoom scenes per area.
   ============================================================ */

function MapScreen() {
  const { go, set, state } = useGame();
  const voltooid = state.voltooid || {};
  const [hover, setHover] = useState(null);
  const [zooming, setZooming] = useState(false);
  const [shake, setShake] = useState(null);
  const [openArea, setOpenArea] = useState(null);
  const [logboek, setLogboek] = useState(false);

  const areas = Content.areas();
  const active = Content.activeArea();

  const clickPost = (a) => {
    Sound.unlock();
    if (a.status !== 'actief') {
      Sound.play('tryagain');
      setShake(a.id); setTimeout(() => setShake(null), 480);
      return;
    }
    Sound.play('select');
    setZooming(true);
    setTimeout(() => setOpenArea(a.id), 760);
  };

  const startMissie = (areaId, m) => {
    if (m.status !== 'actief') { Sound.play('tryagain'); return; }
    Sound.play('select');
    set({ gebied: areaId, missie: m.id, worldStep: 1, recentGroei: [] });
    go('transport');
  };

  const areaObj = openArea ? Content.area(openArea) : null;

  return (
    <div className="screen screen-enter map-screen vignette grain">
      <div className="map-sky" />
      <div className="ambient cloud-shadow cs1" />
      <div className="ambient cloud-shadow cs2" />
      <div className="ambient map-bird" />

      <div className={'map-world' + (zooming ? ' zoom-in' : '')}
           style={{ '--zx': active.mapPin.x + '%', '--zy': active.mapPin.y + '%' }}>
        <div className="terrain forest f1" />
        <div className="terrain forest f2" />
        <div className="terrain forest f3" />
        <div className="terrain sand s1" />
        <div className="terrain water w1" />
        <div className="terrain heath h1" />

        {areas.map(a => {
          const isActief = a.status === 'actief';
          const activeMissies = (a.missies || []).filter(m => m.status === 'actief');
          const missieN = activeMissies.length;
          const doneN = activeMissies.filter(m => voltooid[m.id]).length;
          const allDone = missieN > 0 && doneN === missieN;
          return (
            <button
              key={a.id}
              className={'post' + (isActief ? ' active' : ' locked')
                + (hover === a.id ? ' hovering' : '') + (shake === a.id ? ' shake' : '')}
              style={{ left: a.mapPin.x + '%', top: a.mapPin.y + '%' }}
              onMouseEnter={() => { setHover(a.id); Sound.play('hover'); }}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(a.id)}
              onBlur={() => setHover(null)}
              onClick={() => clickPost(a)}
              aria-label={a.naam + (isActief ? ', actief' : ', binnenkort')}
            >
              {isActief && <span className="post-halo ambient" />}
              <span className="post-pole" />
              <span className="post-sign"><span className="post-pin" /></span>
              <span className="post-card">
                <span className="post-name">{a.naam}</span>
                <span className="post-meta">
                  {isActief ? `${missieN} missie${missieN === 1 ? '' : 's'}` : 'Binnenkort'}
                </span>
                {isActief && <span className="post-notch">{doneN}/{missieN}{allDone ? ' ✓' : ''}</span>}
              </span>
              {isActief && allDone && <span className="post-done" aria-label="voltooid">✓</span>}
            </button>
          );
        })}
      </div>

      {!zooming && (
        <button className="huisje-knop" onClick={() => { Sound.play('hover'); go('cabin'); }} aria-label="Ga naar het huisje">
          <span className="hk-ico">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>
          </span>
          Het huisje
        </button>
      )}

      {!zooming && (
        <button className="logboek-knop" onClick={() => { Sound.play('hover'); setLogboek(true); }} aria-label="Open jouw logboek">
          <span className="lk-medal"><span className="lk-dot" /></span>
          Jouw logboek
        </button>
      )}

      {!zooming && (
        <div className="map-header">
          <h1 className="map-title">Kies een gebied</h1>
          <p className="map-sub">Jij bent ranger. Help de dieren.</p>
        </div>
      )}

      {areaObj && (
        <div className="start-overlay screen-enter">
          <div className="start-card area-card">
            <div className="start-eyebrow">{areaObj.naam} · {Content.seasonMeta((state.story || {}).seizoen).naam} · {Content.seasonMeta((state.story || {}).seizoen).kort}</div>
            <h2 className="start-title">Kies een missie</h2>
            <div className="missie-list">
              {areaObj.missies.map((m, i) => {
                const isActief = m.status === 'actief';
                const done = isActief && !!voltooid[m.id];
                return (
                  <button key={m.id}
                    className={'missie-row' + (isActief ? '' : ' locked')}
                    onClick={() => startMissie(areaObj.id, m)}
                    disabled={!isActief}
                  >
                    <span className="mr-index">{done ? '✓' : i + 1}</span>
                    <span className="mr-body">
                      <span className="mr-title">{m.titel}</span>
                      <span className="mr-kort">{m.kort}</span>
                    </span>
                    <span className="mr-tag">{isActief ? (done ? 'Opnieuw' : 'Start') : 'Binnenkort'}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-ghost start-back" onClick={() => { setZooming(false); setOpenArea(null); }}>Terug naar de kaart</button>
          </div>
        </div>
      )}
      {logboek && <Logboek onClose={() => setLogboek(false)} />}
    </div>
  );
}

window.MapScreen = MapScreen;
