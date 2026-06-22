/* ============================================================
   step-spot.jsx — EF engine "zoeken" (volgehouden aandacht + visueel zoeken)
   Renders a research-true skin: distractors are real Veluwe heath
   fauna (heideblauwtje, roodborsttapuit, nachtzwaluw) + struiken.
   The target "drukt zich" — lies dead-still, camouflaged.
   ============================================================ */

function StepSpot({ cfg, jargon, ease, hint, onMiss, onDone }) {
  const { settings } = useGame();
  const diff = useEngineDifficulty('zoeken', ease);
  const reduced = settings.reducedMotion;
  const skin = (cfg && cfg.skin) || {};
  const copy = skin.copy || {};
  const dier = Content.animal(skin.dier) || {};

  const [found, setFound] = useState(false);
  const [miss, setMiss] = useState(null);
  const [lens, setLens] = useState({ x: 50, y: 55, on: false });
  const [hintOn, setHintOn] = useState(false);
  const missCount = useRef(0);

  // hint: briefly reveal the target's tell-ring
  useEffect(() => {
    if (!hint) return;
    setHintOn(true);
    const t = setTimeout(() => setHintOn(false), 1600);
    return () => clearTimeout(t);
  }, [hint]);

  // distractor decoys come from the skin; difficulty trims the count
  const decoys = React.useMemo(() => {
    const base = (skin.distractors && skin.distractors.length)
      ? skin.distractors
      : [{ id: 'd1', x: 24, y: 44, k: 'bush', animal: 'struik' }];
    return base.slice(0, Math.max(3, Math.min(diff.afleiders + 2, base.length)));
  }, [skin.distractors, diff.afleiders]);

  const frislingPos = skin.doel || { x: 52, y: 58 };
  const hazeOp = 0.05 + diff.lensSterkte * 0.6;

  const label = (id) => (Content.animal(id) ? Content.animal(id).naam : (id || 'iets in het gras'));
  const doelMood = found ? 'calm' : 'scared';
  const isRee = skin.dier === 'ree';

  const onMove = (e) => {
    if (reduced || found) return;
    const r = e.currentTarget.getBoundingClientRect();
    setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, on: true });
  };

  const tapDecoy = (d) => {
    if (found) return;
    Sound.play('tryagain');
    missCount.current += 1;
    onMiss && onMiss();
    setMiss(d.id); setTimeout(() => setMiss(m => m === d.id ? null : m), 460);
  };
  const tapDoel = () => {
    if (found) return;
    Sound.play('found'); setFound(true);
    const correct = missCount.current === 0 ? 1 : 0;
    setTimeout(() => onDone({ trials: 1, correct }), 2000);
  };

  return (
    <div className="spot-field" onMouseMove={onMove} onMouseLeave={() => setLens(l => ({ ...l, on: false }))}>
      <div className="grass-base" />
      <div className="grass-tufts" />

      {decoys.map(d => (
        <button key={d.id}
          className={'decoy ' + d.k + (miss === d.id ? ' miss' : '')}
          style={{ left: d.x + '%', top: d.y + '%' }}
          onClick={() => tapDecoy(d)} aria-label={label(d.animal)}>
          {d.k === 'bush' && <span className="bush-shape" />}
          {d.k === 'butterfly' && <span className="butterfly"><i/><i/></span>}
          {d.k === 'bird' && <span className="bird-shape" />}
          {miss === d.id && <span className="decoy-name">{label(d.animal)}</span>}
        </button>
      ))}

      {/* the target, camouflaged by front grass — it "drukt zich" */}
      <button className={'frisling-target' + (found ? ' found' : '')}
        style={{ left: frislingPos.x + '%', top: frislingPos.y + '%' }}
        onClick={tapDoel} aria-label={dier.naam || 'dier'}>
        <span className={'tell-ring' + (found || hintOn ? ' show' : '')} />
        {isRee ? <Reekalf size={64} /> : <Frisling size={66} mood={doelMood} />}
        <span className="camo-grass" />
      </button>

      {!reduced && (
        <div className="lens-haze" style={{
          '--mx': lens.x + '%', '--my': lens.y + '%',
          opacity: lens.on ? 1 : 0.55,
          background: `radial-gradient(circle 120px at var(--mx) var(--my), transparent 0, transparent 78px, rgba(40,52,28,${hazeOp}) 150px)`
        }} />
      )}

      {found && (
        <div className="spot-closeup">
          <div className="closeup-card">
            <div className="closeup-art">{isRee ? <Reekalf size={130} /> : <Frisling size={140} mood="calm" />}</div>
            <p className="closeup-text">{copy.goed || 'Daar is hij! Goed gezocht.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

window.StepSpot = StepSpot;
