/* ============================================================================
   world3d.jsx — the REACT layer of the 3D-integration pass (HANDOFF §6.5/§12.9)
   ----------------------------------------------------------------------------
   One continuous world: Alvah free-roams the golden-hour Veluwe; walking up to
   an interactable shows the ONE consistent interact-prompt; pressing it eases
   the camera in and runs the *real* EF-engine (StepSpot/StepRoute/StepDanger)
   IN SITU — no separate puzzle screen, no route change. The engines, content,
   skill-logging, jargon and reduced-motion are reused 1:1; this file only adds
   the diegetic HUD + the "moment in the world" host. Talks to the Three.js
   world through window.V3D (world3d-bridge.js).

   Note: uses React.useX (no top-level `const {useState}` — that would collide
   with state.jsx's shared global-lexical binding, HANDOFF §1 rule 2).
   ============================================================================ */

const V3D_ENGINES = { zoeken: 'StepSpot', corsi: 'StepRoute', dagnacht: 'StepDanger', simon: 'StepSimon', wisselen: 'StepWissel' };

// world XZ → mini-map px (box is 132px, world radius ~14)
function mapXY(x, z) { return { x: 66 + (x / 14) * 58, y: 66 + (z / 14) * 58 }; }

function Veluwe3D() {
  const { settings, setSetting, logSession, state, findClue, resolveArc } = useGame();
  const [ready, setReady] = React.useState(false);
  const [nearId, setNearId] = React.useState(null);
  const [phase, setPhase] = React.useState('roam');      // roam | zoom | engine | celebrate | clue | board | finale
  const [activeId, setActiveId] = React.useState(null);
  const [progress, setProgress] = React.useState({ done: 0, total: 3 });
  const [clueBeat, setClueBeat] = React.useState(null);  // the clue just dropped (story beat card)

  // engine autonomy state (mirrors screen-world.jsx)
  const [ease, setEase] = React.useState(0);
  const [hint, setHint] = React.useState(0);
  const [misses, setMisses] = React.useState(0);

  const promptRef = React.useRef(null);
  const objRef = React.useRef(null);
  const dotRef = React.useRef(null);
  const foxRef = React.useRef(null);
  const disc = React.useRef({ nearId: null, done: -1 });
  const phaseRef = React.useRef('roam'); phaseRef.current = phase;

  // ── wire up to the 3D world once it's ready ──────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const start = (v) => {
      if (!alive) return;
      v.ready.then((vr) => {
      if (!alive) return;
      setReady(true);
      const loader = document.getElementById('loader'); if (loader) loader.style.display = 'none';
      vr.setReducedMotion(settings.reducedMotion);
      vr.onFrame((d) => {
        const roam = phaseRef.current === 'roam';
        // floating interact-prompt
        const pe = promptRef.current;
        if (pe) {
          if (d.prompt && roam) { pe.style.opacity = '1'; pe.style.pointerEvents = 'auto'; pe.style.transform = `translate(${d.prompt.x}px,${d.prompt.y}px) translate(-50%,-110%)`; }
          else { pe.style.opacity = '0'; pe.style.pointerEvents = 'none'; }
        }
        // objective marker
        const oe = objRef.current;
        if (oe) {
          if (d.objective && roam && !d.objective.behind) { oe.style.opacity = '1'; oe.style.transform = `translate(${d.objective.x}px,${d.objective.y}px) translate(-50%,-100%)`; const dd = oe.querySelector('.obj-dist'); if (dd) dd.textContent = Math.max(1, Math.round(d.objective.dist)) + ' m'; }
          else oe.style.opacity = '0';
        }
        // mini-map alvah dot
        const de = dotRef.current;
        if (de && d.alvahPos) { const p = mapXY(d.alvahPos[0], d.alvahPos[1]); de.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${-d.alvahRot}rad)`; }
        // mini-map fox dot (the second living species)
        const fe = foxRef.current;
        if (fe) { if (d.foxPos) { const p = mapXY(d.foxPos[0], d.foxPos[1]); fe.style.opacity = '1'; fe.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; } else fe.style.opacity = '0'; }
        // discrete → state (avoid per-frame re-render)
        const pid = (d.prompt && roam) ? d.prompt.id : null;
        if (pid !== disc.current.nearId) { disc.current.nearId = pid; setNearId(pid); }
        if (d.doneCount !== disc.current.done) { disc.current.done = d.doneCount; setProgress({ done: d.doneCount, total: d.total }); }
      });
      });
    };
    if (window.V3D) start(window.V3D);
    else { const iv = setInterval(() => { if (window.V3D) { clearInterval(iv); start(window.V3D); } }, 30); }
    return () => { alive = false; };
  }, []);

  // keep the world's reduced-motion in sync with the game setting
  React.useEffect(() => { if (ready) window.V3D.setReducedMotion(settings.reducedMotion); }, [settings.reducedMotion, ready]);

  // chapter-gating: lock story posts whose prerequisite clue isn't found yet, so
  // the mystery unfolds in order and the season only ever moves forward (§6.4).
  React.useEffect(() => {
    if (!ready) return;
    const found = (state.story && state.story.clues) || {};
    const locked = window.V3D.interactables
      .filter(it => it.naClue && found[it.naClue] !== 'found')
      .map(it => it.id);
    window.V3D.setLocks(locked);
  }, [ready, state.story && state.story.clues]);

  // ── driving (keyboard) — only while roaming ──────────────────────────────
  React.useEffect(() => {
    const drive = { f: 0, b: 0, l: 0, r: 0, run: false };
    const KEY = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    const down = (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { drive.run = true; window.V3D.setDriveInput(drive); return; }
      if ((e.code === 'Enter' || e.code === 'Space') && phaseRef.current === 'roam' && disc.current.nearId) { e.preventDefault(); doInteract(disc.current.nearId); return; }
      const k = KEY[e.code]; if (!k) return; e.preventDefault();
      if (phaseRef.current !== 'roam') return;
      drive[k] = 1; window.V3D.setDriveInput(drive);
    };
    const up = (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { drive.run = false; window.V3D.setDriveInput(drive); return; }
      const k = KEY[e.code]; if (!k) return; drive[k] = 0; window.V3D.setDriveInput(drive);
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [ready]);

  // reset engine autonomy state whenever a new moment starts
  React.useEffect(() => { setEase(0); setHint(0); setMisses(0); }, [activeId]);

  // ── the in-situ loop ─────────────────────────────────────────────────────
  function doInteract(id) {
    if (!id || phaseRef.current !== 'roam') return;
    const it = window.V3D.interactables.find(x => x.id === id);
    const isBoard = it && it.kind === 'caseboard';
    Sound.play('select');
    setActiveId(id); setNearId(null); setPhase('zoom');
    window.V3D.setDriveInput({ f: 0, b: 0, l: 0, r: 0, run: false });
    window.V3D.interact(id);
    const waitSettled = () => { if (!window.V3D.busy) setPhase(isBoard ? 'board' : 'engine'); else requestAnimationFrame(waitSettled); };
    requestAnimationFrame(waitSettled);
  }

  const activeIt = ready && activeId ? window.V3D.interactables.find(x => x.id === activeId) : null;
  const activeMissie = activeIt ? (activeIt.missie || 'frisling') : null;
  const cfg = activeIt ? Content.step('veluwe', activeMissie, activeIt.stepN) : null;
  const totaalStappen = activeMissie ? ((Content.mission('veluwe', activeMissie) || { stappen: [] }).stappen.length || 1) : 1;
  const engineName = cfg ? cfg.ef : null;
  const Engine = engineName ? window[V3D_ENGINES[engineName]] : null;
  const stepTitel = cfg ? (Content.pick(cfg.skin.copy.instructie, cfg.skin.copy.instructieKnap, settings.jargon) || Content.efTitel(cfg.ef)) : '';

  const onMiss = () => setMisses(m => { const n = m + 1; if (n >= 3 && settings.autoMoeilijk) setEase(e => e + 1); return n; });
  const makkelijker = () => { Sound.play('select'); setEase(e => e + 1); setMisses(0); };
  const geefHint = () => { Sound.play('hover'); setHint(h => h + 1); };

  function onEngineDone(summary) {
    if (summary && engineName) logSession(engineName, summary);
    Sound.play('reward');
    setPhase('celebrate');
    const it = activeIt;
    const clueRec = it && it.clue ? Content.clue('veluwe', it.clue) : null;
    setTimeout(() => {
      window.V3D.completeInteractable(activeId);
      window.V3D.endInteract();
      setActiveId(null);
      if (clueRec) {                       // a verhaalHaak mission → drop a clue; the season turns
        findClue(clueRec);
        Sound.play('found');
        setClueBeat(clueRec);
        setPhase('clue');
      } else {
        setPhase('roam');
      }
    }, 1500);
  }

  function dismissClue() { Sound.play('select'); setClueBeat(null); setPhase('roam'); }
  // case-board ontknoping finished → the hopeful winter ending
  function onArcResolved() { window.V3D.endInteract(); setActiveId(null); setPhase('finale'); }
  function closeBoard() { Sound.play('select'); window.V3D.endInteract(); setActiveId(null); setPhase('roam'); }

  function leaveMoment() {                       // calm escape hatch, never a failure
    Sound.play('select');
    window.V3D.endInteract(); setActiveId(null); setPhase('roam');
  }
  function closeFinale() { Sound.play('select'); setPhase('roam'); }

  const showHulp = (phase === 'engine') && misses >= 2;

  // ── season-arc surface state ──
  const seizoen = (state.story && state.story.seizoen) || 'lente';
  const seasonMeta = Content.seasonMeta(seizoen);
  const clueList = Content.clues('veluwe') || [];
  const foundMap = (state.story && state.story.clues) || {};
  const foundCount = clueList.filter(c => foundMap[c.id] === 'found').length;
  const allCluesFound = clueList.length > 0 && foundCount === clueList.length;
  const arcResolved = !!(state.story && state.story.antagonist && state.story.antagonist.reported);
  const nextObj = ready && window.V3D.nextObjective();

  return (
    <div className={'v3d-hud seizoen-' + seizoen + (settings.reducedMotion ? ' rm' : '')}>

      {/* gentle season color-grade over the whole 3D view (turns as clues drop) */}
      <div className="v3d-season" aria-hidden="true" />

      {/* objective beacon (projected over the active objective in the world) */}
      <div className="v3d-objective" ref={objRef}>
        <span className="obj-pin" aria-hidden="true" />
        <span className="obj-dist">— m</span>
      </div>

      {/* the ONE consistent interact prompt, floating at the interactable */}
      <button className="v3d-prompt" ref={promptRef} onClick={() => doInteract(nearId)}>
        <span className="ip-key">E</span>
        <span className="ip-label">{nearId && ready ? (window.V3D.interactables.find(x => x.id === nearId) || {}).label : 'Kijk'}</span>
      </button>

      {/* top-left: where am I + what's next (diegetic ranger log) */}
      <div className="v3d-topbar">
        <div className="vt-titlerow">
          <div className="vt-title">De Veluwe</div>
          <span className={'vt-season z-' + seizoen}>{seasonMeta.naam}</span>
        </div>
        <div className="vt-objective">
          {arcResolved
            ? <span>De Veluwe komt tot rust. Mooi werk, ranger.</span>
            : allCluesFound
              ? <span><b>Opdracht:</b> ga naar het prikbord bij het huisje</span>
              : nextObj
                ? <span><b>Opdracht:</b> {nextObj.label.toLowerCase()} {nextObj.korte}</span>
                : <span>Loop rond en ontdek de Veluwe</span>}
        </div>
        <div className="vt-notches" aria-label={'Voortgang ' + progress.done + ' van ' + progress.total}>
          {Array.from({ length: progress.total }).map((_, i) => <span key={i} className={'notch' + (i < progress.done ? ' on' : '')} />)}
        </div>
      </div>

      {/* mini-map: single corner map with pins + Alvah */}
      <div className="v3d-map" aria-hidden="true">
        {ready && window.V3D.interactables.filter(it => !(it.naClue && foundMap[it.naClue] !== 'found')).map(it => {
          const p = mapXY(it.pos[0], it.pos[2]);
          if (it.kind === 'caseboard') return <span key={it.id} className="mp-land board" style={{ left: p.x, top: p.y }} />;
          return <span key={it.id} className={'mp-pin' + (it.done ? ' done' : '')} style={{ left: p.x, top: p.y, '--c': it.color }} />;
        })}
        <span className="mp-land cabin" style={{ left: mapXY(-1.5, 9.5).x, top: mapXY(-1.5, 9.5).y }} />
        <span className="mp-land tower" style={{ left: mapXY(13, -10).x, top: mapXY(13, -10).y }} />
        <span className="mp-land den" style={{ left: mapXY(8.5, -4.6).x, top: mapXY(8.5, -4.6).y }} />
        <span className="mp-fox" ref={foxRef} />
        <span className="mp-alvah" ref={dotRef} />
      </div>

      {/* settings: comfort + sound (minimal, diegetic-ish) */}
      <div className="v3d-settings">
        <button className={'vs-btn' + (settings.reducedMotion ? ' on' : '')} onClick={() => setSetting({ reducedMotion: !settings.reducedMotion })} title="Rustige camera">
          <span className="vs-ico">◐</span> Rustig
        </button>
        <button className={'vs-btn' + (settings.geluid ? ' on' : '')} onClick={() => { setSetting({ geluid: !settings.geluid }); }} title="Geluid">
          <span className="vs-ico">{settings.geluid ? '♪' : '×'}</span> Geluid
        </button>
      </div>

      {/* touch d-pad (hidden on hover-capable pointers via CSS) */}
      <div className="v3d-dpad">
        <DpadBtn dir="f" glyph="▲" cls="up" />
        <div className="dp-mid">
          <DpadBtn dir="l" glyph="◀" cls="left" />
          <DpadBtn dir="r" glyph="▶" cls="right" />
        </div>
        <DpadBtn dir="b" glyph="▼" cls="down" />
      </div>

      {/* ── the IN-SITU moment: the real engine, framed as a viewfinder ── */}
      {(phase === 'engine' || phase === 'celebrate') && Engine && (
        <div className="v3d-moment">
          <div className="vm-frame">
            <div className="vm-head">
              <span className="vm-step">Stap {activeIt.stepN}/{totaalStappen}</span>
              <span className="vm-titel">{stepTitel}</span>
              <button className="vm-leave" onClick={leaveMoment} aria-label="Even weg">Later</button>
            </div>
            <div className="vm-stage">
              <Engine key={activeId + '-' + ease} cfg={cfg} jargon={settings.jargon}
                ease={ease} hint={hint} onMiss={onMiss} onDone={onEngineDone} />
            </div>
            {showHulp && (
              <div className="vm-hulp">
                <span>Lukt het niet? Dat geeft niks.</span>
                <button onClick={makkelijker}>Maak makkelijker</button>
                <button className="ghost" onClick={geefHint}>Hint</button>
              </div>
            )}
          </div>
          {phase === 'celebrate' && (
            <div className="vm-celebrate">
              <div className="vc-card">
                <div className="vc-mark">✓</div>
                <p>Goed gedaan, ranger.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* zoom curtain while the camera eases in */}
      {phase === 'zoom' && <div className="v3d-zoom"><span>…</span></div>}

      {/* the diegetic cabin case-board (season-arc clues + hopeful resolution) */}
      {phase === 'board' && <V3DCaseBoard onClose={closeBoard} onResolved={onArcResolved} />}

      {/* a clue just dropped: one calm story beat, then the season turns */}
      {phase === 'clue' && clueBeat && (
        <div className="v3d-clue" onClick={dismissClue}>
          <div className="vcl-card" onClick={e => e.stopPropagation()}>
            <span className="vcl-ico"><ClueGlyph soort={clueBeat.soort} size={28} /></span>
            <div className="vcl-eyebrow">Aanwijzing gevonden</div>
            <div className="vcl-title">{clueBeat.titel}</div>
            <p className="vcl-text">{clueBeat.tekst}</p>
            {clueBeat.seizoenNa && <p className="vcl-season">De {Content.seasonMeta(clueBeat.seizoenNa).naam.toLowerCase()} komt op de Veluwe.</p>}
            <button className="btn btn-primary" onClick={dismissClue}>Verder</button>
          </div>
        </div>
      )}

      {/* finale: the season's hopeful ending (reached via the case-board) */}
      {phase === 'finale' && (
        <div className="v3d-finale">
          <div className="vf-card">
            <div className="vf-art vf-duo">
              <Frisling size={104} mood="calm" />
              <Vos size={104} />
            </div>
            <h2>{arcResolved ? 'De Veluwe komt tot rust.' : 'Een rustige ochtend op de Veluwe.'}</h2>
            <p>{arcResolved
              ? 'De stroper is gestopt en gemeld bij de BOA. De heide en het ven groeien terug — een rustige winter. Je loste het zelf op, ranger.'
              : 'De big is terug bij de groep en de vos heb je gedag gezegd. Een gouden ochtend — je deed het zelf.'}</p>
            <button className="btn btn-primary" onClick={closeFinale}>Verder zwerven</button>
          </div>
        </div>
      )}

      {!ready && <div className="v3d-booting">De Veluwe laden…</div>}
    </div>
  );
}

/* simple, non-graphic clue glyphs (badges.jsx isn't loaded in the 3D shell) */
function ClueGlyph({ soort, size = 24, color = '#5a4326' }) {
  const s = { width: size, height: size, display: 'block' };
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (soort === 'camera') return (
    <svg viewBox="0 0 24 24" style={s}><rect x="3" y="7" width="18" height="12" rx="2" {...stroke} /><path d="M8 7l1.5-2h5L16 7" {...stroke} /><circle cx="12" cy="13" r="3.2" {...stroke} /></svg>
  );
  if (soort === 'band') return (
    <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="8.5" {...stroke} /><circle cx="12" cy="12" r="3" {...stroke} /></svg>
  );
  // spoor — a boot/track mark
  return (
    <svg viewBox="0 0 24 24" style={s}><path d="M9 4c-2 2-2.5 6-2 9 .3 2 1 4 3 4s2.7-2 2.7-5c0-3-.7-6-1.7-8z" {...stroke} /><circle cx="15.5" cy="8" r="1.6" {...stroke} /><circle cx="17.5" cy="12" r="1.4" {...stroke} /></svg>
  );
}

/* the diegetic cabin case-board, in the 3D HUD (mirrors screen-cabin's CaseBoard,
   HANDOFF §6.4). Renders the season clues + the hopeful, off-screen resolution. */
function V3DCaseBoard({ onClose, onResolved }) {
  const { state, resolveArc } = useGame();
  const story = state.story || {};
  const clues = Content.clues('veluwe') || [];
  const foundMap = story.clues || {};
  const found = clues.filter(c => foundMap[c.id] === 'found');
  const allFound = clues.length > 0 && found.length === clues.length;
  const vb = Content.verhaalboog('veluwe') || {};
  const ontknoping = vb.ontknoping || [];
  const resolved = !!(story.antagonist && story.antagonist.reported);
  const seasonMeta = Content.seasonMeta(story.seizoen || 'lente');
  const laatste = found.length ? found[found.length - 1] : null;
  const [stap, setStap] = React.useState(-1);   // ontknoping beat index (-1 = idle)

  const startOntknoping = () => { Sound.play('select'); setStap(0); };
  const volgende = () => {
    if (stap < ontknoping.length - 1) { Sound.play('hover'); setStap(stap + 1); }
    else { Sound.play('reward'); resolveArc(); setStap(-1); onResolved && onResolved(); }
  };

  return (
    <div className="v3d-board-overlay" onClick={onClose}>
      <div className="v3d-board case-board" onClick={e => e.stopPropagation()}>
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
                  <span className="cb-photo">{isf ? <ClueGlyph soort={c.soort} size={22} /> : <span className="cb-q">?</span>}</span>
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
        <button className="v3d-board-close" onClick={onClose}>Sluiten</button>

        {stap >= 0 && ontknoping[stap] && (
          <div className="cb-ontknoping-overlay" onClick={volgende}>
            <div className="cb-ontknoping" onClick={e => e.stopPropagation()}>
              <div className="cbo-eyebrow">{seasonMeta.naam} · stap {stap + 1}/{ontknoping.length}</div>
              <p className="cbo-text">{ontknoping[stap].tekst}</p>
              <button className="btn btn-primary" onClick={volgende}>{stap < ontknoping.length - 1 ? 'Verder' : 'Klaar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DpadBtn({ dir, glyph, cls }) {
  const press = (on) => (e) => { e.preventDefault(); const i = {}; i[dir] = on ? 1 : 0; window.V3D && window.V3D.setDriveInput(i); };
  return <button className={'dp-btn ' + cls} onPointerDown={press(true)} onPointerUp={press(false)} onPointerLeave={press(false)} aria-label={dir}>{glyph}</button>;
}

window.Veluwe3D = Veluwe3D;

/* ── bootstrap: reuse the whole game stack, present the 3D world ── */
(function mount3D() {
  const el = document.getElementById('hud');
  if (!el) return;
  Sound.setEnabled(true);
  ReactDOM.createRoot(el).render(
    <GameProvider>
      <Veluwe3D />
    </GameProvider>
  );
})();
