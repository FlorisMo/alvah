/**
 * wildcamera.photos.ts — the camera trap's photographs (design run6-missions §4.3): each
 * one is a real picture of the world, taken from the camera on its pine (World.snapshot)
 * and "developed" the way a trail camera's are — in colour by day, in grey infrared by
 * night, a thin strip along the bottom with a sun or a moon and the time. A new photo
 * joins the strip at the top of the screen with a soft flash; an empty one shows a
 * moment ("Leeg") and goes. In the morning the ranger looks through them all on a card:
 * the animals he aimed for, one by one, and at the end the one he did not expect.
 */

import './wildcamera.css';
import { narrator } from '../../../core/narrator';
import { store } from '../../../core/state';

export interface Photo {
  url: string;
  /** what is on it (for the dev read and the words): an animal id, 'leeg', 'man' */
  what: string;
  time: 'dag' | 'nacht' | 'ochtend';
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** A small deterministic noise stream (the film grain is the same every time). */
function grainStream(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Develop a raw snapshot like a trail camera: by night an infrared picture (grey, a
 * little green, the near ground bright, soft grain), by day warm colour, in the early
 * morning a cool, pale light; a gentle vignette; along the bottom a dark strip with the
 * sun or the moon and the clock. Returns a JPEG data URL.
 */
export function develop(src: HTMLCanvasElement, time: Photo['time'], clock: string, seed = 1): string {
  const W = src.width, H = src.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const rnd = grainStream(seed);
  // the camera meters on the middle of the picture (where the animal is): a backlit
  // deer against a bright sky still comes out, never a black shape
  let sum = 0, cnt = 0;
  for (let y = Math.floor(H * 0.25); y < H * 0.75; y += 2) {
    for (let x = Math.floor(W * 0.3); x < W * 0.7; x += 2) {
      const i = (y * W + x) * 4;
      sum += (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      cnt++;
    }
  }
  const mean = cnt ? sum / cnt : 0.4;
  const gain = Math.min(2.6, Math.max(1, (time === 'nacht' ? 0.3 : 0.42) / Math.max(0.02, mean)));
  const K = 1.35 * gain, norm = 1 - Math.exp(-K);
  const expose = (v: number): number => (255 * (1 - Math.exp(-(v / 255) * K))) / norm;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = expose(d[i]), gg = expose(d[i + 1]), b = expose(d[i + 2]);
      const vx = (x / W - 0.5) * 2, vy = (y / H - 0.5) * 2;
      const vig = 1 - 0.28 * Math.min(1, (vx * vx + vy * vy) * 0.6);
      if (time === 'nacht') {
        // infrared: brightness only, lifted (the camera lights the near scene), grainy
        const l = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
        const k = Math.min(1, Math.pow(l, 0.55) * 1.35) * vig + (rnd() - 0.5) * 0.06;
        d[i] = Math.max(0, Math.min(255, k * 238));
        d[i + 1] = Math.max(0, Math.min(255, k * 246));
        d[i + 2] = Math.max(0, Math.min(255, k * 228));
      } else if (time === 'ochtend') {
        // first light: cool and pale, a touch of grain
        const l = (0.3 * r + 0.59 * gg + 0.11 * b);
        const mix = (v: number, t: number): number => v * 0.45 + l * 0.55 + t;
        d[i] = Math.max(0, Math.min(255, mix(r, -4) * vig * 1.05 + (rnd() - 0.5) * 8));
        d[i + 1] = Math.max(0, Math.min(255, mix(gg, 2) * vig * 1.05 + (rnd() - 0.5) * 8));
        d[i + 2] = Math.max(0, Math.min(255, mix(b, 12) * vig * 1.05 + (rnd() - 0.5) * 8));
      } else {
        d[i] = Math.min(255, r * vig * 1.02);
        d[i + 1] = Math.min(255, gg * vig);
        d[i + 2] = Math.min(255, b * vig * 0.96);
      }
    }
  }
  g.putImageData(img, 0, 0);
  // the camera's strip along the bottom: the sun or the moon, and the time
  const bar = Math.round(H * 0.13);
  g.fillStyle = 'rgba(12, 14, 12, 0.72)';
  g.fillRect(0, H - bar, W, bar);
  g.fillStyle = '#f2f2ea';
  g.font = `600 ${Math.round(bar * 0.62)}px "Inter Tight", system-ui, sans-serif`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(`${time === 'nacht' ? '🌙' : '☀️'}  ${clock}`, Math.round(bar * 0.4), H - bar / 2 + 1);
  g.textAlign = 'right';
  g.fillText('📷 1', W - Math.round(bar * 0.4), H - bar / 2 + 1);
  return c.toDataURL('image/jpeg', 0.86);
}

/** The strip of photographs at the top of the screen, and the morning's look through them. */
export class PhotoStrip {
  readonly photos: Photo[] = [];
  private readonly el: HTMLDivElement;
  private readonly row: HTMLDivElement;

  constructor(host: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'wc-strip';
    el.setAttribute('aria-label', 'De foto’s van de camera');
    el.innerHTML = `<div class="wc-row"></div>`;
    host.appendChild(el);
    this.el = el;
    this.row = el.querySelector('.wc-row')!;
    this.el.hidden = true;
  }

  /** Show or hide the strip (it is up while the camera watches). */
  show(on: boolean): void { this.el.hidden = !on; }

  /** A new photo joins the strip, with a soft flash. */
  add(p: Photo): void {
    this.photos.push(p);
    const t = document.createElement('img');
    t.className = 'wc-thumb wc-new';
    t.src = p.url;
    t.alt = '';
    this.row.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.remove('wc-new')));
  }

  /** An empty photo: it shows a moment with "Leeg" over it, and goes again. */
  empty(p: Photo, label: string): void {
    const t = document.createElement('div');
    t.className = 'wc-thumb wc-empty wc-new';
    t.innerHTML = `<img src="${p.url}" alt=""><span>${esc(label)}</span>`;
    this.row.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.remove('wc-new')));
    window.setTimeout(() => { t.classList.add('wc-gone'); window.setTimeout(() => t.remove(), 600); }, 2200);
  }

  /**
   * The morning: a card over the world shows the photos one by one, the strip under
   * them lighting up the one shown, a calm ~1.5 s each; the last one waits with its
   * words (`last`) and the button. Resolves when he presses it.
   */
  review(title: string, last: string, button: string, signal: AbortSignal): Promise<void> {
    const voor = store.get().settings.voorlezen;
    const card = document.createElement('div');
    card.className = 'ra-overlay ra-scrim wc-review-wrap';
    card.innerHTML =
      `<div class="wc-review" role="dialog" aria-label="${esc(title)}">` +
      `<p class="wc-review-title">${esc(title)}</p>` +
      `<div class="wc-big"><img alt=""></div>` +
      `<div class="wc-review-row">${this.photos.map((p, i) => `<img class="wc-mini" data-i="${i}" src="${p.url}" alt="">`).join('')}</div>` +
      `<div class="wc-review-foot"><p class="wc-review-line" aria-live="polite"></p>` +
      `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `<button class="btn-start wc-verder" type="button" hidden>${esc(button)}</button></div>` +
      `</div>`;
    this.el.parentElement?.appendChild(card);
    const big = card.querySelector<HTMLImageElement>('.wc-big img')!;
    const line = card.querySelector<HTMLParagraphElement>('.wc-review-line')!;
    const btn = card.querySelector<HTMLButtonElement>('.wc-verder')!;
    const minis = [...card.querySelectorAll<HTMLImageElement>('.wc-mini')];
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(line.textContent || title));
    if (voor) narrator.speak(title);
    let i = 0;
    let timer = 0;
    const showAt = (n: number): void => {
      i = n;
      big.src = this.photos[n].url;
      big.parentElement!.classList.toggle('wc-last', n === this.photos.length - 1);
      minis.forEach((m, j) => m.classList.toggle('on', j === n));
      if (n === this.photos.length - 1) {
        line.textContent = last;
        btn.hidden = false;
        if (voor) narrator.queue(last);
      }
    };
    return new Promise<void>((resolve, reject) => {
      const end = (): void => { window.clearTimeout(timer); card.remove(); };
      const next = (): void => {
        if (i >= this.photos.length - 1) return;
        showAt(i + 1);
        if (i < this.photos.length - 1) timer = window.setTimeout(next, i === this.photos.length - 2 ? 1900 : 1500);
      };
      if (!this.photos.length) { end(); resolve(); return; }
      showAt(0);
      timer = window.setTimeout(next, 1800);
      btn.addEventListener('click', () => { end(); resolve(); }, { once: true });
      signal.addEventListener('abort', () => { end(); reject(new Error('stopped')); }, { once: true });
    });
  }

  dispose(): void {
    this.el.remove();
  }
}
