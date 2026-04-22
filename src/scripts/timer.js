// RT-meting via performance.now(). Pure module, geen DOM-koppeling.
// Paradigma-referentie: jsPsych timing (MIT). Onze implementatie is onafhankelijk geschreven.

export function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function rt(startMs) {
  return Math.round(now() - startMs);
}
