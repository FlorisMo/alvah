/**
 * calls.ts — load the clean-licensed animal calls + ambience (fetched by
 * scripts/audio-fetch.mjs into public/audio/) and wire them into the spine.
 * Real recordings registered via Sound.registerCall() transparently replace the
 * synth motifs the simon engine falls back to — so the game is fully playable
 * with no audio files present (offline / before fetch), and richer once they are.
 *
 * Call once, from a user gesture (the Start tap) so the AudioContext is unlocked
 * on iOS. Best-effort: every failure is swallowed; audio is an enhancement.
 */

import { store } from './state';
import { Sound } from './sound';

interface AudioEntry { file: string; kind: 'call' | 'ambient'; license: string; attribution: string }

let loaded = false;
const ambientBuffers = new Map<string, AudioBuffer>();

/** Fetch + decode the staged audio, register calls, start the ambience bed. */
export async function loadGameAudio(): Promise<void> {
  if (loaded) { applyAmbient(); return; }
  loaded = true;
  let manifest: Record<string, AudioEntry>;
  try {
    const res = await fetch('/audio/manifest.json');
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return; // no audio staged — synth fallbacks carry the game
  }

  await Promise.all(
    Object.entries(manifest).map(async ([id, e]) => {
      const buf = await Sound.decode(`/audio/${e.file}`);
      if (!buf) return;
      if (e.kind === 'ambient') ambientBuffers.set(id, buf);
      else Sound.registerCall(id, buf);
    }),
  );

  applyAmbient();
}

/** Start/stop the ambience bed to match the current sound + ambient settings. */
export function applyAmbient(): void {
  const s = store.get().settings;
  if (!s.geluid || s.ambient <= 0) { Sound.stopAmbient(); return; }
  const bed = ambientBuffers.get('ambient-bos') ?? ambientBuffers.values().next().value;
  if (bed) Sound.startAmbient(bed, 0.22 * s.ambient);
}
