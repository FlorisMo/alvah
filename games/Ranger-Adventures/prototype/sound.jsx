/* ============================================================
   sound.jsx — soft WebAudio tones + speech (read-aloud)
   Warm, acoustic, restrained. Success sings; failure is quiet.
   ============================================================ */

const Sound = (() => {
  let ctx = null;
  let enabled = true;
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // a soft mallet/marimba-ish note
  function note(freq, t0, dur, gain = 0.16, type = 'triangle') {
    const ac = ensure(); if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const tones = {
    hover:    () => note(660, 0, 0.10, 0.05),
    select:   () => note(523.25, 0, 0.18, 0.12),
    step:     () => note(392, 0, 0.16, 0.10),
    correct:  () => { note(587.33, 0, 0.16, 0.12); note(880, 0.08, 0.22, 0.12); },
    tryagain: () => note(196, 0, 0.22, 0.09, 'sine'),
    found:    () => { note(659.25, 0, 0.18, 0.12); note(987.77, 0.10, 0.30, 0.10); },
    wait:     () => note(174.61, 0, 0.26, 0.08, 'sine'),
    reward:   () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.06, 1.1, 0.10));
    },
    bloom:    () => { note(783.99, 0, 0.5, 0.06); note(1174.66, 0.12, 0.7, 0.05); },
  };

  // ---- animal calls (for the Simon sound-echo engine) ----
  // A note that can glide its pitch (for growls / rasps).
  function glide(freq, t0, dur, gain, type, to) {
    const ac = ensure(); if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime + t0;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.04);
  }
  // A short filtered-noise burst (for snuffles / churr texture).
  function noiseBurst(t0, dur, gain, freq, q) {
    const ac = ensure(); if (!ac) return;
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 1000; bp.Q.value = q || 0.9;
    const g = ac.createGain();
    src.connect(bp); bp.connect(g); g.connect(ac.destination);
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.03);
  }

  // Each call is a tiny, recognisable, source-true sketch — never harsh.
  const calls = {
    edelhert:    () => { glide(150, 0, 0.8, 0.16, 'sawtooth', 82); glide(300, 0, 0.8, 0.04, 'sine', 168); },   // burlen (deep roar)
    ree:         () => { glide(360, 0, 0.11, 0.15, 'square', 300); glide(340, 0.2, 0.11, 0.13, 'square', 280); }, // blaf (sharp bark)
    wildzwijn:   () => { [0, 0.16, 0.32].forEach(o => glide(122, o, 0.1, 0.16, 'sawtooth', 92)); },              // knor (grunts)
    raaf:        () => { glide(232, 0, 0.2, 0.13, 'sawtooth', 178); glide(220, 0.28, 0.24, 0.12, 'sawtooth', 158); }, // kroa-kroa
    nachtzwaluw: () => { for (let i = 0; i < 16; i++) glide(540, i * 0.045, 0.035, 0.075, 'square', 520); },     // ratel (churr)
    das:         () => { noiseBurst(0, 0.16, 0.13, 820, 1.1); noiseBurst(0.2, 0.14, 0.11, 640, 1.1); },          // snuif
    eekhoorn:    () => { [0, 0.13, 0.26].forEach(o => glide(1320, o, 0.06, 0.10, 'square', 1180)); },             // tjik-tjik-tjik
    vos:         () => { glide(700, 0, 0.09, 0.12, 'square', 540); glide(720, 0.17, 0.09, 0.12, 'square', 560); glide(660, 0.34, 0.10, 0.11, 'square', 500); }, // gekef (sharp yip-yip)
  };
  // How long each call occupies the sequence timeline (seconds).
  const CALL_DUR = { edelhert: 0.9, ree: 0.4, wildzwijn: 0.48, raaf: 0.6, nachtzwaluw: 0.78, das: 0.42, eekhoorn: 0.42, vos: 0.5 };

  return {
    setEnabled(v) { enabled = v; },
    play(name) { if (enabled && tones[name]) tones[name](); },
    // Play an animal's call; ALWAYS returns its duration so the engine can
    // time the sequence even when sound is muted (the visual cue carries it).
    call(id) { if (enabled && calls[id]) calls[id](); return CALL_DUR[id] || 0.5; },
    callDur(id) { return CALL_DUR[id] || 0.5; },
    unlock() { ensure(); },
  };
})();

/* ---- Speech / read-aloud ---- */
const Speech = (() => {
  const synth = window.speechSynthesis || null;
  let nlVoice = null;
  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices();
    nlVoice = vs.find(v => /nl[-_]/i.test(v.lang)) || vs.find(v => /^nl/i.test(v.lang)) || null;
    return nlVoice;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  function cancel() { if (synth) synth.cancel(); }

  function speak(text, { rate = 0.92, onEnd } = {}) {
    if (!synth) {
      // fallback stub: estimate duration from word count
      const words = text.trim().split(/\s+/).length;
      const ms = Math.max(700, words * 380);
      const id = setTimeout(() => onEnd && onEnd(), ms);
      return () => clearTimeout(id);
    }
    const u = new SpeechSynthesisUtterance(text);
    if (nlVoice) u.voice = nlVoice;
    u.lang = 'nl-NL'; u.rate = rate; u.pitch = 1.02;
    if (onEnd) u.onend = onEnd;
    synth.speak(u);
    return () => synth.cancel();
  }

  // simple full-text toggle hook (used by Chrome)
  function useReadAloud() {
    const [active, setActive] = useState(false);
    const stopRef = useRef(null);
    const toggle = useCallback((text) => {
      if (active) { cancel(); stopRef.current && stopRef.current(); setActive(false); return; }
      setActive(true);
      stopRef.current = speak(text, { onEnd: () => setActive(false) });
    }, [active]);
    useEffect(() => () => cancel(), []);
    return { active, toggle };
  }

  // line-by-line karaoke reader (used by briefing)
  function useLineReader(lines) {
    const [active, setActive] = useState(false);
    const [current, setCurrent] = useState(-1);
    const idxRef = useRef(0);
    const aliveRef = useRef(false);

    const stop = useCallback(() => {
      aliveRef.current = false; cancel(); setActive(false); setCurrent(-1);
    }, []);

    const start = useCallback(() => {
      if (aliveRef.current) { stop(); return; }
      aliveRef.current = true; setActive(true); idxRef.current = 0;
      const next = () => {
        if (!aliveRef.current) return;
        const i = idxRef.current;
        if (i >= lines.length) { aliveRef.current = false; setActive(false); setCurrent(-1); return; }
        setCurrent(i);
        speak(lines[i], { onEnd: () => {
          idxRef.current = i + 1;
          setTimeout(next, 240);
        }});
      };
      next();
    }, [lines, stop]);

    useEffect(() => () => { aliveRef.current = false; cancel(); }, []);
    return { active, current, start, stop };
  }

  return { speak, cancel, useReadAloud, useLineReader };
})();

Object.assign(window, { Sound, Speech });
