/**
 * Reduced-motion: the motion-sensitive-child guardrail (BUILD-PLAN §1e / §3).
 * Dual-gated — the OS `prefers-reduced-motion` query AND an in-game toggle
 * (the `.rm` class on <body>). Render layers should read prefersReducedMotion()
 * to swap camera *moves* for cuts and to disable secondary motion.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

let manualOverride: boolean | null = null;

/** True when motion should be reduced (manual override wins over the OS setting). */
export function prefersReducedMotion(): boolean {
  if (manualOverride !== null) return manualOverride;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

/** Force reduced-motion on/off from the in-game toggle, or pass null to defer to the OS. */
export function setReducedMotionOverride(value: boolean | null): void {
  manualOverride = value;
  applyReducedMotionClass();
}

/** Mirror the current state onto <body class="rm"> so CSS transitions calm down too. */
export function applyReducedMotionClass(): void {
  document.body.classList.toggle('rm', prefersReducedMotion());
}

/** Keep the class in sync when the OS setting changes at runtime. */
export function watchReducedMotion(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  window.matchMedia(QUERY).addEventListener('change', () => applyReducedMotionClass());
}
