/**
 * reading-prefs.ts — the reading + accent Tweaks, realised as CSS custom
 * properties on the document root (BUILD-PLAN §3: M3/E3 reading, large text,
 * clean sans by default with Atkinson Hyperlegible as an alternate toggle —
 * NOT a "dyslexia font" default). The *computation* is pure + unit-tested
 * (`readingVars`); `applyReadingPrefs` only writes the result onto :root so the
 * whole copy surface (`--read-size`/`--read-leading`/`--font-read`) re-flows
 * live, no re-render. Called at boot from the saved Settings + on every Tweak.
 */

import type { Settings } from './state';

/** Slider ranges (the Tweaks panel + the clamp both read these). */
export const READ_SIZE = { min: 20, max: 40, step: 2 } as const;
export const LEADING = { min: 1.3, max: 2.1, step: 0.1 } as const;

// Default = a clean, legible sans (Lexend); the leesFont toggle swaps in
// Atkinson Hyperlegible (a legibility font, research-supported — distinct from
// OpenDyslexic, which research shows gives no benefit, BUILD-PLAN §3).
const SANS_STACK = "'Lexend', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const LEGIBLE_STACK = "'Atkinson Hyperlegible', 'Lexend', system-ui, -apple-system, sans-serif";

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Pure: the CSS custom properties that realise the reading + accent Tweaks. */
export function readingVars(s: Settings): Record<string, string> {
  return {
    '--read-size': `${clamp(Math.round(s.readSize), READ_SIZE.min, READ_SIZE.max)}px`,
    '--read-leading': clamp(s.leading, LEADING.min, LEADING.max).toFixed(2),
    '--font-read': s.leesFont ? LEGIBLE_STACK : SANS_STACK,
    '--spel-sun': s.accent,
  };
}

/** Apply the reading/accent prefs onto :root (SSR-safe, idempotent). */
export function applyReadingPrefs(s: Settings): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  const vars = readingVars(s);
  for (const k of Object.keys(vars)) root.style.setProperty(k, vars[k]);
}
