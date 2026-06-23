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
import { pickAmbientBed, type AmbientBiome } from './ambient';

interface AudioEntry { file: string; kind: 'call' | 'ambient'; license: string; attribution: string }

let loaded = false;
const ambientBuffers = new Map<string, AudioBuffer>();

// the biome/season the ambience bed should match — updated as the ranger crosses
// biomes (World.update) and on world-enter; defaults to the lodge clearing (heide).
let currentBiome: AmbientBiome = 'heide';
let currentSeason: string | undefined;
let playingBedId: string | null = null;        // the bed currently looping (for no-blip re-apply)

/** Point the ambience at a new biome (and optional season); re-applies the bed. */
export function setAmbientScene(biome: AmbientBiome, season?: string): void {
  currentBiome = biome;
  currentSeason = season;
  applyAmbient();
}

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
  if (!s.geluid || s.ambient <= 0) { Sound.stopAmbient(); playingBedId = null; return; }
  const id = pickAmbientBed(currentBiome, [...ambientBuffers.keys()], currentSeason);
  const bed = id ? ambientBuffers.get(id) : undefined;
  if (!bed) { Sound.stopAmbient(); playingBedId = null; return; }
  const gain = 0.22 * s.ambient;
  // crossing two biomes that resolve to the SAME bed (e.g. heide↔stuifzand), or a
  // volume tweak, must NOT restart the loop — that would be an audible blip. Only
  // (re)start when the chosen bed actually changes; otherwise just adjust the gain.
  if (id === playingBedId) { Sound.setAmbientGain(gain); return; }
  Sound.startAmbient(bed, gain);
  playingBedId = id;
}
