// Web Audio helper voor spel-tonen. Respecteert de `sound`-preference.
// Geen mp3's, geen assets — puur synthese via OscillatorNode.
// Alleen in de browser; veilig idempotent bij meermaals laden.

import { getPreferences } from './storage.js';

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    return ctx;
  } catch (_) {
    return null;
  }
}

function soundOn() {
  try {
    const p = getPreferences();
    return p && p.sound !== false;
  } catch (_) {
    return true;
  }
}

// Speelt één sine-toon af. freq in Hz, durationMs, gain 0..1.
export function tone(freq, durationMs = 300, gain = 0.2) {
  if (!soundOn()) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g).connect(audio.destination);
  const t0 = audio.currentTime;
  const attack = 0.015;
  const release = 0.06;
  const dur = durationMs / 1000;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Speelt meerdere oscillators tegelijk af als één akkoord. Gebruikt voor
// mijlpaal-celebratie (predictable, hetzelfde elke keer per dier).
export function playChord(freqs, durationMs = 900, gain = 0.16) {
  if (!soundOn()) return;
  if (!Array.isArray(freqs) || freqs.length === 0) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  const t0 = audio.currentTime;
  const dur = durationMs / 1000;
  const attack = 0.04;
  const release = 0.30;
  // Per-stem gain iets lager bij dichte akkoorden om clipping te voorkomen.
  const perVoice = gain / Math.sqrt(freqs.length);
  for (const freq of freqs) {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g).connect(audio.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(perVoice, t0 + attack);
    g.gain.setValueAtTime(perVoice, t0 + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}

// Nederlandse TTS via speechSynthesis. Fallback stil als unsupported.
export function say(text) {
  if (!soundOn()) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'nl-NL';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (_) {
    // stil falen
  }
}

export function stopSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch (_) {}
}
