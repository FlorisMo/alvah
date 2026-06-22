/* ============================================================
   app.jsx — router + bootstrap
   ============================================================ */
const { useState: useStateApp } = React;

function Stub({ name, next, label = 'Volgende' }) {
  const { go } = useGame();
  return (
    <div className="screen screen-enter" style={{ display:'grid', placeItems:'center', background:'var(--green-soft)' }}>
      <Chrome title="Ranger van de Veluwe" onBack={() => go('map')} />
      <div style={{ textAlign:'center' }}>
        <div style={{ font:"500 13px/1 ui-monospace, monospace", letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-muted)', marginBottom: 14 }}>scherm: {name}</div>
        <div style={{ font:"600 30px/1 'Fraunces', serif", color:'var(--green-deep)', marginBottom: 24 }}>In aanbouw</div>
        <button className="btn btn-primary" onClick={() => go(next)}>{label}</button>
      </div>
    </div>
  );
}

function Router() {
  const { state } = useGame();
  switch (state.screen) {
    case 'map':       return <MapScreen />;
    case 'cabin':     return window.CabinScreen ? <CabinScreen /> : <Stub name="cabin" next="map" label="Naar de kaart" />;
    case 'transport': return <TransportScreen />;
    case 'travel':    return window.TravelScreen ? <TravelScreen /> : <Stub name="travel" next="briefing" />;
    case 'briefing':  return window.BriefingScreen ? <BriefingScreen /> : <Stub name="briefing" next="world" />;
    case 'world':     return window.WorldScreen ? <WorldScreen /> : <Stub name="world" next="reunion" />;
    case 'reunion':   return window.ReunionScreen ? <ReunionScreen /> : <Stub name="reunion" next="complete" />;
    case 'complete':  return window.CompleteScreen ? <CompleteScreen /> : <Stub name="complete" next="map" label="Naar de kaart" />;
    default:          return <MapScreen />;
  }
}

function App() {
  const { settings } = useGame();
  React.useEffect(() => { Sound.setEnabled(settings.geluid); }, [settings.geluid]);
  return (
    <>
      <Router />
      {window.RangerTweaks ? <RangerTweaks /> : null}
    </>
  );
}

function Root() {
  return (
    <GameProvider>
      <App />
    </GameProvider>
  );
}

ReactDOM.createRoot(document.getElementById('canvas')).render(<Root />);
