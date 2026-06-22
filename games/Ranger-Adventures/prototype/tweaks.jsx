/* ============================================================
   tweaks.jsx — Ranger Tweaks (drives game settings + test jumps)
   Uses the starter <TweaksPanel> shell (host-protocol wiring).
   ============================================================ */

function RangerTweaks() {
  const { settings, setSetting, go, setStep, set, reset, resetSkill, bumpSkill, bondDelta, setCompanion,
    state, damageVehicle, bankResources, findClue, resolveArc, resetStory } = useGame();
  const Shell = window.__TweaksShell; // starter shell, captured before overwrite

  const jump = (screen, step) => { if (step) setStep(step); go(screen); };
  // touching a difficulty slider switches to manual mode so the change sticks
  const manueel = (patch) => setSetting({ ...patch, autoMoeilijk: false });

  return (
    <Shell title="Tweaks">
      <TweakSection label="Leestekst" />
      <TweakToggle label="Dyslexie-lettertype" value={settings.leesFont}
        onChange={v => setSetting({ leesFont: v })} />
      <TweakToggle label="Knappe woorden (frisling, rotte)" value={settings.jargon}
        onChange={v => setSetting({ jargon: v })} />
      <TweakSlider label="Tekstgrootte" value={settings.readSize} min={22} max={36} step={1} unit="px"
        onChange={v => setSetting({ readSize: v })} />
      <TweakSlider label="Regelafstand" value={settings.leading} min={1.4} max={2.1} step={0.1}
        onChange={v => setSetting({ leading: v })} />

      <TweakSection label="Geluid & beweging" />
      <TweakToggle label="Geluid" value={settings.geluid} onChange={v => setSetting({ geluid: v })} />
      <TweakToggle label="Rustige beweging" value={settings.reducedMotion}
        onChange={v => setSetting({ reducedMotion: v })} />
      <TweakSlider label="Sfeer (ambient)" value={Math.round(settings.ambient * 100)} min={0} max={100} step={5} unit="%"
        onChange={v => setSetting({ ambient: v / 100 })} />

      <TweakSection label="Moeilijkheid" />
      <TweakToggle label="Past zich vanzelf aan" value={settings.autoMoeilijk}
        onChange={v => setSetting({ autoMoeilijk: v })} />
      <TweakSlider label="Zoekhulp (lens)" value={Math.round(settings.lensSterkte * 100)} min={0} max={100} step={10} unit="%"
        onChange={v => manueel({ lensSterkte: v / 100 })} />
      <TweakSlider label="Afleiders" value={settings.afleiders} min={2} max={6} step={1}
        onChange={v => manueel({ afleiders: v })} />
      <TweakSlider label="Route-lengte" value={settings.routeLengte} min={3} max={6} step={1}
        onChange={v => manueel({ routeLengte: v })} />
      <TweakToggle label="Slow-motion (gevaar)" value={settings.slowmo}
        onChange={v => manueel({ slowmo: v })} />
      <TweakSlider label="Geluid-reeks (Simon)" value={settings.simonLengte} min={2} max={6} step={1}
        onChange={v => manueel({ simonLengte: v })} />
      <TweakSlider label="Regel-wissels (Wisselen)" value={Math.round(settings.wisselFreq * 100)} min={0} max={100} step={10} unit="%"
        onChange={v => manueel({ wisselFreq: v / 100 })} />

      <TweakSection label="Reis-spel" />
      <TweakRadio label="Gevolg bij botsen" value={settings.gevolgErnst}
        options={[{ value: 'stevig', label: 'Stevig' }, { value: 'mild', label: 'Mild' }, { value: 'assist', label: 'Assist' }]}
        onChange={v => setSetting({ gevolgErnst: v })} />
      <TweakSlider label="Snelheid" value={Math.round(settings.reisSnelheid * 100)} min={60} max={160} step={10} unit="%"
        onChange={v => setSetting({ reisSnelheid: v / 100 })} />
      <TweakSlider label="Hoeveelheid" value={Math.round(settings.reisDichtheid * 100)} min={50} max={180} step={10} unit="%"
        onChange={v => setSetting({ reisDichtheid: v / 100 })} />
      <TweakToggle label="Eikel-magneet (hulp)" value={settings.reisMagneet}
        onChange={v => setSetting({ reisMagneet: v })} />

      <TweakSection label="Sfeer-kleur" />
      <TweakColor label="Accent" value={settings.accent}
        options={['#f5c23b', '#ef7a1f', '#2b5fb8', '#c94174']}
        onChange={v => setSetting({ accent: v })} />

      <TweakSection label="Spring naar (testen)" />
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <TweakButton label="Kaart" secondary onClick={() => jump('map')} />
        <TweakButton label="Het huisje" secondary onClick={() => jump('cabin')} />
        <TweakButton label="Vervoer" secondary onClick={() => jump('transport')} />
        <TweakButton label="Briefing" secondary onClick={() => jump('briefing')} />
        <TweakButton label="Stap 1" secondary onClick={() => jump('world', 1)} />
        <TweakButton label="Stap 2" secondary onClick={() => jump('world', 2)} />
        <TweakButton label="Stap 3" secondary onClick={() => jump('world', 3)} />
        <TweakButton label="Hereniging" secondary onClick={() => jump('reunion')} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop: 8 }}>
        <TweakButton label="Nachtronde · geluid-echo" secondary
          onClick={() => { Sound.unlock(); set({ gebied: 'veluwe', missie: 'nachtronde', worldStep: 1 }); go('world'); }} />
        <TweakButton label="Nachtronde · sorteren" secondary
          onClick={() => { Sound.unlock(); set({ gebied: 'veluwe', missie: 'nachtronde', worldStep: 2 }); go('world'); }} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop: 8 }}>
        <TweakButton label="Wildcamera" secondary
          onClick={() => { Sound.unlock(); set({ gebied: 'veluwe', missie: 'wildcamera', worldStep: 1 }); go('briefing'); }} />
        <TweakButton label="Oversteek (ecoduct)" secondary
          onClick={() => { Sound.unlock(); set({ gebied: 'veluwe', missie: 'ecoduct', worldStep: 1 }); go('briefing'); }} />
        <TweakButton label="Nootjes (eekhoorn)" secondary
          onClick={() => { Sound.unlock(); set({ gebied: 'veluwe', missie: 'eekhoorn', worldStep: 1 }); go('briefing'); }} />
      </div>

      <TweakSection label="Voertuig & gevolgen (testen)" />
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <TweakButton label="Beschadig voertuig" secondary onClick={() => damageVehicle(state.gekozenVervoer || 'auto', 70)} />
        <TweakButton label="Voertuigen herstellen" secondary onClick={() => set({ voertuigen: blankVoertuigen() })} />
        <TweakButton label="+3 onderdelen" secondary onClick={() => bankResources(3, 0)} />
      </div>

      <TweakSection label="Verhaal (testen)" />
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <TweakButton label="Clue: spoor" secondary onClick={() => findClue(Content.clue('veluwe', 'spoor'))} />
        <TweakButton label="Clue: camera" secondary onClick={() => findClue(Content.clue('veluwe', 'camera'))} />
        <TweakButton label="Clue: band" secondary onClick={() => findClue(Content.clue('veluwe', 'band'))} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop: 8 }}>
        <TweakButton label="Verhaal afronden" secondary onClick={() => resolveArc()} />
        <TweakButton label="Reset verhaal" secondary onClick={() => resetStory()} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop: 8 }}>
        <TweakButton label="Breinkracht +" secondary onClick={() => bumpSkill(0.8)} />
        <TweakButton label="Reset breinkracht" secondary onClick={() => resetSkill()} />
        <TweakButton label="Metgezel band +" secondary onClick={() => bondDelta(20)} />
        <TweakButton label="Reset metgezel" secondary onClick={() => setCompanion({ rescued:false, fase:'baby', bond:8, kunstjes:[], meeOpMissie:false, naam:'' })} />
      </div>
      <div style={{ marginTop: 8 }}>
        <TweakButton label="Begin opnieuw" onClick={() => { set({ missieKlaar: false, badgeVerdiend: false }); reset(); go('map'); }} />
      </div>
    </Shell>
  );
}

// capture starter shell, then expose our wrapper as the thing App renders
window.__TweaksShell = window.TweaksPanel;
window.RangerTweaks = RangerTweaks;
