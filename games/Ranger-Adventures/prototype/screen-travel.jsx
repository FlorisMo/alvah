/* ============================================================
   screen-travel.jsx — [C] Reis-mini-game  (sfeer + agency)
   Controllable, joyful, and NEVER a test: no game-over, no
   failure, no EF logging. Auto/motor = hop; helikopter = gentle
   hold-to-rise flight. Collect eikels; soft on-theme obstacles
   (tak/steen/plas + a dier dat oversteekt) give a gentle bonk,
   never a restart. One-button (tap/hold · Space/↑). ~12–18s.
   ============================================================ */

const VEH_CFG = {
  auto:  { vx: 250, floorY: 588, ceilY: 452, grav: 0.95, lift: -2.0, maxUp: 10, maxDown: 11, base: 4.6 },
  motor: { vx: 250, floorY: 588, ceilY: 444, grav: 0.95, lift: -2.1, maxUp: 11, maxDown: 11, base: 4.9 },
  heli:  { vx: 250, floorY: 558, ceilY: 156, grav: 0.52, lift: -1.28, maxUp: 7, maxDown: 7, base: 4.6 },
};
const TRAVEL_GOAL = 3600;
const OB_SUBS = ['tak', 'steen', 'plas', 'dier'];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* ---------- the playable run ---------- */
function GameTravel({ veh, attempt, onRepair }) {
  const { state, go, set, settings, damageVehicle, bankResources, setTeVoet } = useGame();
  const cfg = VEH_CFG[veh] || VEH_CFG.auto;
  const isHeli = veh === 'heli';

  // the chosen vehicle's CURRENT condition — damage persists across trips
  const voertuig = (state.voertuigen && state.voertuigen[veh]) || { durability: 100, schade: 0, disabled: false };
  const startDur = Math.max(0, voertuig.durability);
  // severity dial (§6.3): how much durability a hard collision costs. assist = 0 (soft bonk only)
  const HIT_LOSS = (GEVOLG_SCHADE[settings.gevolgErnst] != null ? GEVOLG_SCHADE[settings.gevolgErnst] : GEVOLG_SCHADE.stevig);
  const onderdelen = (state.resources && state.resources.onderdelen) || 0;

  const fieldRef = useRef(null);
  const gRef = useRef(null);
  const [r, setR] = useState({ vy: cfg.floorY, bonk: false, entities: [], tally: 0, progress: 0, dur: startDur });
  const [phase, setPhase] = useState(startDur <= 0 ? 'wrecked' : 'play'); // play | finish | wrecked
  const [finalTally, setFinalTally] = useState(0);
  const [count, setCount] = useState(0);
  const [schoonGereden, setSchoonGereden] = useState(false);  // clean run → banked a part

  // count-up on finish
  useEffect(() => {
    if (phase !== 'finish') return;
    let n = 0; setCount(0);
    if (finalTally <= 0) return;
    const stepMs = Math.max(40, Math.min(120, 800 / finalTally));
    const t = setInterval(() => {
      n++; setCount(n); Sound.play('step');
      if (n >= finalTally) clearInterval(t);
    }, stepMs);
    return () => clearInterval(t);
  }, [phase, finalTally]);

  useEffect(() => {
    Sound.unlock();
    if (startDur <= 0) return;   // vehicle already wrecked — show the radio overlay, no loop
    const g = gRef.current = {
      vy: cfg.floorY, vvel: 0, holding: false, entities: [], dist: 0,
      spawnAcc: 0, idc: 0, invuln: 0, bonkUntil: 0, finished: false, tally: 0,
      dur: startDur, hits: 0, last: performance.now(),
    };

    const press = () => { g.holding = true; };
    const release = () => { g.holding = false; };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); g.holding = true; } };
    const onKeyUp = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') g.holding = false; };

    const field = fieldRef.current;
    field.addEventListener('pointerdown', press);
    window.addEventListener('pointerup', release);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    const spawn = (now) => {
      const t = Math.random() < 0.56 ? 'eikel' : 'ob';
      let y = cfg.ceilY + 26 + Math.random() * (cfg.floorY - cfg.ceilY - 34);
      let sub = null;
      if (t === 'ob') {
        sub = OB_SUBS[(Math.random() * OB_SUBS.length) | 0];
        if (!isHeli && (sub === 'steen' || sub === 'plas')) y = cfg.floorY - 6; // ground hazards sit on the road
      }
      g.entities.push({ id: ++g.idc, type: t, sub, x: 1140, y, collected: false, hit: false, born: now });
    };

    const finish = () => {
      g.finished = true;
      Sound.play('reward');
      set({ eikels: (state.eikels || 0) + g.tally });
      // attentive driving (no hard hits) banks a repair part — ties consequence to progression (§6.3)
      if (g.hits === 0) { bankResources(1, 0); setSchoonGereden(true); }
      setFinalTally(g.tally);
      setPhase('finish');
    };

    let raf = 0;
    const tick = (now) => {
      let dt = (now - g.last) / 16.67; g.last = now; if (dt > 2.4) dt = 2.4; if (dt <= 0) dt = 1;

      // vertical control
      g.vvel += (g.holding ? cfg.lift : cfg.grav) * dt;
      g.vvel = clamp(g.vvel, -cfg.maxUp, cfg.maxDown);
      g.vy += g.vvel * dt;
      if (g.vy > cfg.floorY) { g.vy = cfg.floorY; g.vvel = 0; }
      if (g.vy < cfg.ceilY) { g.vy = cfg.ceilY; g.vvel = 0; }

      const spd = cfg.base * settings.reisSnelheid * dt;
      g.dist += spd;
      g.invuln = Math.max(0, g.invuln - dt * 16.67);

      for (const en of g.entities) {
        en.x -= spd;
        if (en.type === 'eikel' && settings.reisMagneet && !en.collected && en.x - cfg.vx < 240 && en.x > cfg.vx - 60) {
          en.y += (g.vy - en.y) * 0.07 * dt;
        }
        if (en.collected || en.hit) continue;
        const dx = Math.abs(en.x - cfg.vx), dy = Math.abs(en.y - g.vy);
        if (en.type === 'eikel') {
          if (dx < 62 && dy < 56) { en.collected = true; en.born = now; g.tally++; Sound.play('found'); }
        } else if (g.invuln <= 0 && dx < 56 && dy < 52) {
          en.hit = true; g.invuln = 950; g.bonkUntil = now + 520; Sound.play('tryagain');
          // real, fixable stakes: a hard hit costs durability (assist mode = 0)
          if (HIT_LOSS > 0) {
            g.hits++;
            g.dur = Math.max(0, g.dur - HIT_LOSS);
            damageVehicle(veh, HIT_LOSS);
            if (g.dur <= 0) {
              // disabled — pause the run, sober ranger-radio prompt (never a game-over)
              g.finished = true;
              set({ eikels: (state.eikels || 0) + g.tally });
              setFinalTally(g.tally);
              Sound.play('wait');
              setPhase('wrecked');
            }
          }
        }
      }
      g.entities = g.entities.filter(en => en.x > -90 && !(en.collected && now - en.born > 240));

      g.spawnAcc += dt * 16.67;
      const every = 760 / settings.reisDichtheid;
      if (g.dist < TRAVEL_GOAL - 280 && g.spawnAcc >= every) { g.spawnAcc = 0; spawn(now); }

      if (g.dist >= TRAVEL_GOAL && !g.finished) finish();

      setR({
        vy: g.vy, bonk: now < g.bonkUntil, tally: g.tally, dur: g.dur,
        progress: Math.min(1, g.dist / TRAVEL_GOAL),
        entities: g.entities.map(en => ({ id: en.id, type: en.type, sub: en.sub, x: en.x, y: en.y, collected: en.collected, hit: en.hit })),
      });

      if (!g.finished) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      field.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [attempt]); // eslint-disable-line

  const skip = () => {
    Sound.play('select');
    const g = gRef.current;
    if (g && !g.finished) set({ eikels: (state.eikels || 0) + g.tally });
    go('briefing');
  };

  // cosmetic damage tier (visible, persists until repair) + consequence handlers
  const schade = Math.max(0, Math.min(1, 1 - r.dur / 100));
  const schadeTier = schade > 0.66 ? 3 : schade > 0.33 ? 2 : schade > 0.05 ? 1 : 0;
  const kanRepareren = onderdelen >= REPAIR_KOST;
  const teVoetVerder = () => { Sound.play('select'); setTeVoet(true); go('briefing'); };
  const repareer = () => { if (!kanRepareren) return; Sound.play('reward'); onRepair && onRepair(); };

  return (
    <div className="travel-screen game">
      <div className="tv-sky" />
      <div className="tv-sun" />
      <div className="tv-layer tv-hills" />
      <div className="tv-layer tv-pines" />
      <div className="tv-layer tv-verge" />
      <div className="tv-road" />
      <div className="tv-layer tv-posts" />

      {/* play field (one-button: tap/hold anywhere) */}
      <div className="tv-field" ref={fieldRef}>
        {r.entities.map(en => (
          <div key={en.id}
            className={'tv-entity ' + (en.type === 'eikel' ? 'eikel' + (en.collected ? ' pop' : '') : 'ob ' + en.sub + (en.hit ? ' bonked' : ''))}
            style={{ left: en.x + 'px', top: en.y + 'px' }}>
            {en.type === 'eikel'
              ? <span className="acorn"><i className="acorn-cap" /><i className="acorn-nut" /></span>
              : en.sub === 'dier'
                ? <span className="ob-dier"><i className="od-ear" /><i className="od-ear r" /></span>
                : <span className={'ob-shape ' + en.sub} />}
          </div>
        ))}

        {/* the controllable vehicle (cosmetic damage shows + persists until repair) */}
        <div className={'tv-vehicle playing schade-' + schadeTier + (r.bonk ? ' tv-bonk' : '')}
          style={{ left: cfg.vx + 'px', top: r.vy + 'px' }}>
          {isHeli && <div className="heli-ground-shadow play-shadow" />}
          <div className="tv-vehicle-inner"><Vehicle id={veh} /></div>
          {schadeTier > 0 && <span className="veh-mud" aria-hidden="true" />}
        </div>
      </div>

      {/* HUD */}
      <div className="travel-hud">
        <div className="tally-pill">
          <span className="acorn sm"><i className="acorn-cap" /><i className="acorn-nut" /></span>
          <span className="tally-num">{r.tally}</span>
        </div>
        {/* soft vehicle-status: durability + repair parts (§6.5 — honest, low-key) */}
        <div className="veh-pill" aria-label={'voertuig ' + Math.round(r.dur) + '%'}>
          <svg className="veh-pill-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l2-5h11l3 5"/><path d="M3 13h17v4H3z"/><circle cx="7" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/></svg>
          <div className="veh-bar"><div className="veh-bar-fill" data-low={r.dur <= 34 ? '1' : '0'} style={{ width: Math.max(0, r.dur) + '%' }} /></div>
        </div>
        <div className="part-pill" aria-label={onderdelen + ' onderdelen'}><span className="part-ico" />{onderdelen}</div>
        <div className="reis-progress">
          <div className="rp-track"><div className="rp-fill" style={{ width: (r.progress * 100) + '%' }} /></div>
          <div className="rp-flag" aria-hidden="true">⌂</div>
        </div>
      </div>

      <div className="tv-hint">{isHeli ? 'Houd vast om te stijgen' : 'Tik om te springen'} · pak de eikels</div>
      <button className="skip" onClick={skip}>Overslaan ›</button>

      {phase === 'finish' && (
        <div className="finish-overlay">
          <div className="finish-card grain">
            <div className="finish-eyebrow">Bij de ranger-post</div>
            <div className="finish-art"><span className="acorn big"><i className="acorn-cap" /><i className="acorn-nut" /></span></div>
            <div className="finish-count">{count}</div>
            <p className="finish-text">{finalTally > 0 ? 'eikels verzameld!' : 'Goed gereden, ranger!'}</p>
            {schoonGereden && <p className="finish-bonus"><span className="part-ico" /> Netjes gereden! +1 onderdeel.</p>}
            <button className="btn btn-primary" onClick={() => { Sound.play('select'); go('briefing'); }}>Ga verder</button>
          </div>
        </div>
      )}

      {/* wrecked: sober ranger-radio prompt — a choice, never a game-over (§6.3) */}
      {phase === 'wrecked' && (
        <div className="finish-overlay">
          <div className="radio-card grain">
            <div className="radio-head"><span className="radio-dot" />Ranger-radio</div>
            <div className="radio-veh"><span className={'radio-veh-art schade-3'}><Vehicle id={veh} /></span></div>
            <p className="radio-line">Voertuig beschadigd.<br/>Te voet verder of terug voor reparatie?</p>
            <div className="radio-actions">
              <button className="btn btn-primary" onClick={teVoetVerder}>Te voet verder</button>
              <button className={'btn btn-green' + (kanRepareren ? '' : ' veh-off')} onClick={repareer} disabled={!kanRepareren}>
                Repareer · {REPAIR_KOST} <span className="part-ico" />
              </button>
            </div>
            <p className="radio-foot">{kanRepareren
              ? 'Reparatie kost onderdelen die je liever bewaart voor betere uitrusting.'
              : 'Te weinig onderdelen. Rij netjes om er te sparen — te voet kom je er ook.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- reduced-motion: gentle auto-arrival ---------- */
function ReducedTravel({ veh }) {
  const { state, go, set } = useGame();
  const isHeli = veh === 'heli';
  const gift = 6;
  useEffect(() => { Sound.unlock(); set({ eikels: (state.eikels || 0) + gift }); }, []); // eslint-disable-line
  return (
    <div className="travel-screen rm-travel">
      <div className="tv-sky" />
      <div className="tv-sun" />
      <div className="tv-layer tv-hills static" />
      <div className="tv-layer tv-pines static" />
      <div className="tv-layer tv-verge static" />
      <div className="tv-road" />
      <div className={'tv-vehicle playing'} style={{ left: '250px', top: isHeli ? '300px' : '588px' }}>
        {isHeli && <div className="heli-ground-shadow play-shadow" style={{ animation: 'none', opacity: .35 }} />}
        <div className="tv-vehicle-inner"><Vehicle id={veh} /></div>
      </div>
      <div className="tv-caption">Onderweg naar de Veluwe…</div>
      <div className="rm-arrival">
        <div className="rm-tally"><span className="acorn sm"><i className="acorn-cap" /><i className="acorn-nut" /></span> {gift} eikels onderweg</div>
        <button className="btn btn-primary" onClick={() => { Sound.play('select'); go('briefing'); }}>Ga verder</button>
      </div>
      <button className="skip" onClick={() => { Sound.play('select'); go('briefing'); }}>Overslaan ›</button>
    </div>
  );
}

function TravelScreen() {
  const { state, settings, repairVehicle } = useGame();
  const veh = state.gekozenVervoer || 'auto';
  const [attempt, setAttempt] = useState(0);
  // repair → bump attempt so the run remounts fresh on the now-fixed vehicle
  const onRepair = () => { repairVehicle(veh); setAttempt(a => a + 1); };
  return settings.reducedMotion
    ? <ReducedTravel veh={veh} />
    : <GameTravel key={veh + '-' + attempt} veh={veh} attempt={attempt} onRepair={onRepair} />;
}

Object.assign(window, { TravelScreen, GameTravel, ReducedTravel });
