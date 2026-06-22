/* ============================================================
   badges.jsx — visible growth (HANDOFF §7.4 / plan §13.6)
   ------------------------------------------------------------
   Four collectible badge kinds, ALL framed as personal growth —
   never score, rank or comparison:
     1) 5 breinkracht-badges (one per EF engine, brons→zilver→goud,
        leveling with skill.best — never shows a drop)
     2) missie-badges (per completed mission)
     3) knap-woord-badges (optional jargon, picture + sound)
     4) (companion milestones land in a later thread)
   Rendered in the cabin / "Jouw logboek" as growth, never ranking.
   ============================================================ */

/* simple, on-theme glyph per breinkracht (simple shapes only) */
function BreinIcon({ engine, size = 30, color = '#fff' }) {
  const s = { width: size, height: size, display: 'block' };
  const c = color;
  switch (engine) {
    case 'zoeken': // a looking-glass
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" />
        </svg>
      );
    case 'corsi': // stepping-stones path
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18l5-5 4 3 7-8" /><circle cx="4" cy="18" r="1.6" fill={c} stroke="none" /><circle cx="9" cy="13" r="1.6" fill={c} stroke="none" /><circle cx="13" cy="16" r="1.6" fill={c} stroke="none" /><circle cx="20" cy="8" r="1.6" fill={c} stroke="none" />
        </svg>
      );
    case 'simon': // sound waves
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" fill={c} stroke="none" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" /><path d="M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15" opacity=".55" />
        </svg>
      );
    case 'dagnacht': // sun + moon (calm / inhibition)
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8.5" cy="12" r="3.2" /><path d="M19 8.4a4 4 0 1 0 0 7.2 5 5 0 0 1 0-7.2z" fill={c} stroke="none" />
        </svg>
      );
    case 'wisselen': // swap arrows
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h13l-3-3M20 16H7l3 3" />
        </svg>
      );
    default:
      return null;
  }
}

/* one breinkracht-badge: a tiered ring whose fill shows progress to next tier */
function BreinBadge({ engine, skill, size = 88 }) {
  const meta = SKILL_META[engine] || {};
  const rec = skill || blankSkill();
  const tier = tierFor(rec.best);
  const prog = badgeProgress(rec.best);
  const deg = Math.round(prog * 360);

  return (
    <div className="brein-badge" title={meta.naam}>
      <div className="bb-ring" style={{ width: size, height: size,
        background: `conic-gradient(${tier.kleur} ${deg}deg, rgba(0,0,0,.10) ${deg}deg)`,
        boxShadow: `0 0 0 1px rgba(0,0,0,.05), 0 6px 16px ${tier.glow}` }}>
        <div className="bb-core" style={{ background: meta.kleur }}>
          <BreinIcon engine={engine} size={size * 0.36} />
        </div>
      </div>
      <div className="bb-name">{meta.naam}</div>
      <div className="bb-tier" style={{ color: tier.kleur }}>{tier.naam}</div>
    </div>
  );
}

/* tiny mission-badge medallion (animal in a ring) */
function MissieMedal({ mission, size = 56 }) {
  const dier = mission.dier;
  const art = dier === 'ree' ? <Reekalf size={size * 0.5} />
    : dier === 'wildzwijn' ? <Frisling size={size * 0.5} mood="calm" />
    : <DierSprite id={dier} size={size * 0.5} />;
  return (
    <div className="missie-medal" style={{ width: size, height: size }}>
      <div className="mm-inner">{art}</div>
    </div>
  );
}

/* the unified "ranger-logboek": breinkrachten + missie- + knap-woord-badges */
function Logboek({ onClose, highlight }) {
  const { state } = useGame();
  const skill = state.skill || blankSkillSet();
  const voltooid = state.voltooid || {};
  const knap = state.knapWoorden || {};
  const companion = state.companion || {};
  const groei = highlight && highlight.groei ? highlight.groei : [];

  // all missions across areas (data-driven) → which are earned
  const allMissions = [];
  (Content.areas() || []).forEach(a => (a.missies || []).forEach(m => {
    if (m.status === 'actief' && m.beloning) allMissions.push({ area: a, m });
  }));
  const earned = allMissions.filter(x => voltooid[x.m.id]);
  const knapList = Object.keys(knap).map(id => knap[id]);

  return (
    <div className="logboek-overlay screen-enter" onClick={onClose}>
      <div className="logboek grain" onClick={e => e.stopPropagation()}>
        <div className="lb-head">
          <span className="lb-eyebrow">Ranger-logboek</span>
          <h2 className="lb-title">Jouw breinkracht groeit</h2>
        </div>

        <div className="lb-section">
          <div className="lb-label">Breinkrachten</div>
          <div className="brein-grid">
            {EF_ENGINES.map(e => (
              <div key={e} className={'brein-cell' + (groei.includes(e) ? ' grew' : '')}>
                <BreinBadge engine={e} skill={skill[e]} />
                {groei.includes(e) && <span className="grew-tag">groeide!</span>}
              </div>
            ))}
          </div>
          <p className="lb-foot">Elke keer dat je oefent, wordt je breinkracht sterker. Brons → zilver → goud.</p>
        </div>

        <div className="lb-section">
          <div className="lb-label">Missie-badges</div>
          {earned.length > 0 ? (
            <div className="medal-row">
              {earned.map(x => (
                <div key={x.m.id} className="medal-item">
                  <MissieMedal mission={x.m} />
                  <span className="medal-name">{x.m.beloning.badgeNaam}</span>
                </div>
              ))}
            </div>
          ) : <p className="lb-empty">Rond een missie af om je eerste badge te verdienen.</p>}
        </div>

        <div className="lb-section">
          <div className="lb-label">Knappe woorden</div>
          {knapList.length > 0 ? (
            <div className="knap-row">
              {knapList.map((k, i) => (
                <span key={i} className="knap-chip"><span className="knap-star">✦</span>{k.naam}</span>
              ))}
            </div>
          ) : <p className="lb-empty">Zet „knappe woorden” aan om vaktermen te leren, zoals frisling en rotte.</p>}
        </div>

        <div className="lb-section">
          <div className="lb-label">Je metgezel</div>
          {companion.rescued ? (
            <div className="lb-metgezel">
              <div className="lbm-art"><CompanionSprite companion={companion} size={84} state="blij" /></div>
              <div className="lbm-body">
                <div className="lbm-naam">{companion.naam || 'Je raaf'}</div>
                <div className="lbm-fases">
                  {FASE_ORDER.map(f => {
                    const reached = FASE_ORDER.indexOf(companion.fase) >= FASE_ORDER.indexOf(f);
                    return <span key={f} className={'lbm-fase' + (reached ? ' reached' : '')}>{(FASE_META[f] || {}).label}</span>;
                  })}
                </div>
                {(state.rehab && state.rehab.releasedCount > 0) && (
                  <div className="lbm-rehab">{state.rehab.releasedCount} dier{state.rehab.releasedCount === 1 ? '' : 'en'} verzorgd en vrijgelaten</div>
                )}
              </div>
            </div>
          ) : <p className="lb-empty">Ga naar het huisje. Daar wacht een vriend op je.</p>}
        </div>

        <button className="btn btn-ghost lb-close" onClick={onClose}>Sluiten</button>
      </div>
    </div>
  );
}

/* clue glyphs for the case-board (HANDOFF §6.4) — simple shapes, non-graphic */
function ClueIcon({ soort, size = 26, color = '#5a4326' }) {
  const s = { width: size, height: size, display: 'block' };
  switch (soort) {
    case 'spoor': // a boot / track print
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4c2 0 3 2 3 6s1 6 0 8-5 2-6 0 0-4 0-7 1-7 3-7z" /><circle cx="16" cy="7" r="1.4" fill={color} stroke="none" /><circle cx="18" cy="11" r="1.4" fill={color} stroke="none" /><circle cx="17.5" cy="15" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    case 'camera': // a camera
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h4l2-2h6l2 2h4v11H3z" /><circle cx="12" cy="13" r="3.4" />
        </svg>
      );
    case 'band': // tyre tracks
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3v18M11 3v18" opacity=".9" /><path d="M5 6h4M5 11h4M5 16h4M9 8.5h4M9 13.5h4" opacity=".5" />
        </svg>
      );
    case 'boa': // ranger / BOA shield
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9a3 3 0 1 1 4 2.8c-1 .5-1 1.2-1 2.2" /><circle cx="12" cy="18" r="1" fill={color} stroke="none" />
        </svg>
      );
  }
}

Object.assign(window, { BreinIcon, BreinBadge, MissieMedal, Logboek, ClueIcon });
