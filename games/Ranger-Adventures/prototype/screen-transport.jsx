/* ============================================================
   screen-transport.jsx — [B] Vervoerkeuze
   ============================================================ */

const VEHICLES = [
  { id: 'auto',  label: 'Auto',       hint: 'Rustig over de weg' },
  { id: 'motor', label: 'Motor',      hint: 'Snel en stoer' },
  { id: 'heli',  label: 'Helikopter', hint: 'Hoog door de lucht' },
];

function TransportScreen() {
  const { state, set, go, repairVehicle } = useGame();
  const [picked, setPicked] = useState(null);
  const voertuigen = state.voertuigen || {};
  const onderdelen = (state.resources || {}).onderdelen || 0;

  const choose = (id) => {
    if (picked) return;
    Sound.unlock(); Sound.play('select');
    setPicked(id);
    set({ gekozenVervoer: id, teVoet: false });
    setTimeout(() => go('travel'), 760);
  };

  const repareer = (id, e) => {
    e.stopPropagation();
    if (onderdelen < REPAIR_KOST) return;
    Sound.play('reward');
    repairVehicle(id);
  };

  return (
    <div className="screen screen-enter transport-screen vignette">
      <Chrome title="Ranger van de Veluwe" onBack={() => go('map')} />
      <div className="tp-sky" />
      <div className="tp-head">
        <h1 className="tp-title">Hoe ga je erheen?</h1>
        <p className="tp-sub">Kies jouw voertuig.</p>
      </div>

      <div className="tp-resources" aria-label={onderdelen + ' onderdelen'}>
        <span className="part-ico" /> {onderdelen} <span className="tp-res-lbl">onderdelen</span>
      </div>

      <div className="tp-grid">
        {VEHICLES.map(v => {
          const cond = voertuigen[v.id] || { durability: 100, schade: 0, disabled: false };
          const dur = Math.round(cond.durability);
          const beschadigd = cond.schade > 0 || dur < 100;
          return (
          <button
            key={v.id}
            className={'tp-card' + (picked === v.id ? ' chosen' : '') + (picked && picked !== v.id ? ' dimmed' : '') + (cond.disabled ? ' kapot' : '')}
            onMouseEnter={() => !picked && Sound.play('hover')}
            onClick={() => choose(v.id)}
            aria-label={v.label}
          >
            <div className="tp-diorama">
              <div className="tp-ground" />
              <div className={'tp-veh-wrap schade-' + (cond.schade > 0.66 ? 3 : cond.schade > 0.33 ? 2 : cond.schade > 0.05 ? 1 : 0)}>
                <Vehicle id={v.id} />
              </div>
              {beschadigd && (
                <div className="tp-condition" aria-hidden="true">
                  <div className="tp-cond-bar"><div className="tp-cond-fill" data-low={dur <= 34 ? '1' : '0'} style={{ width: Math.max(0, dur) + '%' }} /></div>
                  <span className="tp-cond-num">{cond.disabled ? 'kapot' : dur + '%'}</span>
                </div>
              )}
            </div>
            <div className="tp-label">{v.label}</div>
            <div className="tp-hint">{cond.disabled ? 'Beschadigd — repareer of ga te voet' : v.hint}</div>
            {beschadigd && (
              <span className={'tp-repair' + (onderdelen < REPAIR_KOST ? ' off' : '')}
                role="button" tabIndex={0}
                onClick={(e) => repareer(v.id, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') repareer(v.id, e); }}>
                Repareer · {REPAIR_KOST} <span className="part-ico" />
              </span>
            )}
            {picked === v.id && (
              <div className="tp-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              </div>
            )}
          </button>
          );
        })}
      </div>
    </div>
  );
}

function Vehicle({ id }) {
  if (id === 'auto') return (
    <div className="veh auto" aria-hidden="true">
      <div className="veh-exhaust" />
      <div className="auto-body" />
      <div className="auto-cabin" />
      <div className="auto-window" />
      <div className="wheel w-l" /><div className="wheel w-r" />
    </div>
  );
  if (id === 'motor') return (
    <div className="veh motor" aria-hidden="true">
      <div className="moto-wheel m-l" /><div className="moto-wheel m-r" />
      <div className="moto-body" />
      <div className="moto-seat" />
      <div className="moto-bar" />
    </div>
  );
  return (
    <div className="veh heli" aria-hidden="true">
      <div className="heli-rotor" />
      <div className="heli-mast" />
      <div className="heli-body" />
      <div className="heli-window" />
      <div className="heli-tail" />
      <div className="heli-tailrotor" />
      <div className="heli-skid" />
    </div>
  );
}

Object.assign(window, { TransportScreen, Vehicle });
