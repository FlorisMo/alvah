/**
 * avatar.ts — the player-ranger identity (BUILD-PLAN §3 / plan §13.2).
 * Pure, framework-free, telemetry-free model: a name + four cosmetic kenmerken
 * (huid/haar/outfit/iris). The 3D ranger model tints from these later (Phase 4/5);
 * the meta copy + narrator already address the ranger BY NAME from here.
 *
 * Defaults to "Alvah" — the dossier's child — so an un-customised game still
 * speaks to her; Floris swaps in an exact-likeness preset later (the human tail).
 * This module holds only data + pure transitions, so state.ts wraps them and the
 * seeded test verifies the invariants (valid-option re-derivation, name cleanup).
 */

export interface AvatarOptie {
  id: string;
  label: string;
  kleur: string; // the swatch + 2D preview tint (and the 3D paint, unless `verf` says otherwise)
  /** The paint on the 3D ranger when the swatch colour would not read as itself there:
   *  the ranger's texture also glows (it lights its own paint), which washes a pale
   *  colour out to near-white. */
  verf?: string;
}

/** Inclusive skin tones (lichtest→donkerst). First entry is the blank default. */
export const HUID_OPTIES: AvatarOptie[] = [
  { id: 'licht',  label: 'Licht',  kleur: '#f2c9a0', verf: '#eba27c' },
  { id: 'getint', label: 'Getint', kleur: '#d99a6c', verf: '#cf8a5c' },
  { id: 'bruin',  label: 'Bruin',  kleur: '#a96b3c' },
  { id: 'donker', label: 'Donker', kleur: '#6d4226' },
];

export const HAAR_OPTIES: AvatarOptie[] = [
  { id: 'blond', label: 'Blond', kleur: '#e6b85c' },
  { id: 'bruin', label: 'Bruin', kleur: '#6b4423' },
  { id: 'zwart', label: 'Zwart', kleur: '#2b2320' },
  { id: 'rood',  label: 'Rood',  kleur: '#b5532a' },
];

/** Ranger-jas kleur (the outfit reads as the boswachter uniform). */
export const OUTFIT_OPTIES: AvatarOptie[] = [
  { id: 'groen',  label: 'Bosgroen',   kleur: '#3f6b3a' },
  { id: 'khaki',  label: 'Khaki',      kleur: '#9a8b5a' },
  { id: 'blauw',  label: 'Spijkerblauw', kleur: '#3a5a6b' },
  { id: 'oranje', label: 'Herfst',     kleur: '#a8553a' },
];

// Blauw is first → the shipped default (P1.6b): the real Alvah is blue-eyed
// (public/img/Alvah.jpg), mirroring how 'blond' already leads HAAR_OPTIES. Every
// option still works; `blankAvatar` just picks blue-eyed + blonde by default.
export const IRIS_OPTIES: AvatarOptie[] = [
  { id: 'blauw', label: 'Blauw', kleur: '#3a6a9a' },
  { id: 'bruin', label: 'Bruin', kleur: '#6b4a2b' },
  { id: 'groen', label: 'Groen', kleur: '#4a7a4a' },
  { id: 'grijs', label: 'Grijs', kleur: '#7a8a8a' },
];

/** kenmerk → option list. Drives the creator UI + validation generically. */
export const AVATAR_KENMERKEN = {
  huid: HUID_OPTIES,
  haar: HAAR_OPTIES,
  outfit: OUTFIT_OPTIES,
  iris: IRIS_OPTIES,
} as const;

export type AvatarKenmerk = keyof typeof AVATAR_KENMERKEN;

/** Friendly labels for the four kenmerk groups (UI headings + a11y). */
export const KENMERK_LABEL: Record<AvatarKenmerk, string> = {
  huid: 'Huid',
  haar: 'Haar',
  outfit: 'Ranger-jas',
  iris: 'Ogen',
};

export interface Avatar {
  naam: string;
  huid: string;
  haar: string;
  outfit: string;
  iris: string;
}

/** The default ranger name — the dossier child, so copy speaks to her by default. */
export const STANDAARD_NAAM = 'Alvah';

/** Tap-friendly name suggestions (typing is optional — see the creator UI). */
export const NAAM_SUGGESTIES = ['Alvah', 'Bo', 'Robin', 'Sam', 'Veer'];

export const MAX_NAAM = 16;

/** Trim, collapse whitespace, cap length. Empty stays empty (caller substitutes). */
export function schoonNaam(naam: string | undefined): string {
  return (naam ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAAM);
}

/** The name to address the ranger by — falls back to "Alvah" if unset. */
export function rangerNaam(av: Avatar | undefined): string {
  return schoonNaam(av?.naam) || STANDAARD_NAAM;
}

/** Coerce a possibly-junk option id to a valid one for its kenmerk (else default). */
export function geldigeOptie(kenmerk: AvatarKenmerk, id: unknown): string {
  const opties = AVATAR_KENMERKEN[kenmerk];
  return typeof id === 'string' && opties.some((o) => o.id === id) ? id : opties[0].id;
}

/** The tint for a chosen option (swatch + 2D preview). */
export function kleurVan(kenmerk: AvatarKenmerk, id: string): string {
  const opties = AVATAR_KENMERKEN[kenmerk];
  return (opties.find((o) => o.id === id) ?? opties[0]).kleur;
}

/** The paint for a chosen option on the 3D ranger (its `verf`, else its swatch colour). */
export function verfVan(kenmerk: AvatarKenmerk, id: string): string {
  const opties: readonly AvatarOptie[] = AVATAR_KENMERKEN[kenmerk];
  const o = opties.find((x) => x.id === id) ?? opties[0];
  return o.verf ?? o.kleur;
}

export function blankAvatar(): Avatar {
  return {
    naam: STANDAARD_NAAM,
    huid: HUID_OPTIES[0].id,
    haar: HAAR_OPTIES[0].id,
    outfit: OUTFIT_OPTIES[0].id,
    iris: IRIS_OPTIES[0].id,
  };
}

/** Tolerate a hand-edited / stale save: re-derive valid options, clean the name. */
export function mergeAvatar(saved: unknown): Avatar {
  const base = blankAvatar();
  if (saved && typeof saved === 'object') {
    const s = saved as Partial<Avatar>;
    base.naam = schoonNaam(s.naam) || STANDAARD_NAAM;
    base.huid = geldigeOptie('huid', s.huid);
    base.haar = geldigeOptie('haar', s.haar);
    base.outfit = geldigeOptie('outfit', s.outfit);
    base.iris = geldigeOptie('iris', s.iris);
  }
  return base;
}

/** Pure setter: apply a partial change, validating every field that's present. */
export function applyAvatar(prev: Avatar | undefined, patch: Partial<Avatar>): Avatar {
  const base: Avatar = { ...(prev ?? blankAvatar()) };
  if (patch.naam !== undefined) base.naam = schoonNaam(patch.naam) || STANDAARD_NAAM;
  if (patch.huid !== undefined) base.huid = geldigeOptie('huid', patch.huid);
  if (patch.haar !== undefined) base.haar = geldigeOptie('haar', patch.haar);
  if (patch.outfit !== undefined) base.outfit = geldigeOptie('outfit', patch.outfit);
  if (patch.iris !== undefined) base.iris = geldigeOptie('iris', patch.iris);
  return base;
}

/* ------------------------------------------------------- the 3D ranger look -- */
/*
 * The ranger GLB is one mesh with one painted texture atlas, so the creator's
 * choices reach the 3D ranger by repainting that atlas (render3d/RangerLook.ts does
 * the pixels). The rule for which texel is what lives here, pure and tested: the
 * atlas is painted in a handful of flat colours (a k-means over it, wave 2), and the
 * body height a texel is drawn at (from the mesh, 0 = soles, 1 = top of the hair)
 * tells the cream of the hair from the cream on the soles.
 */

/** The painted parts the creator recolours (the kenmerk that drives each). */
export type LookPart = 'haar' | 'outfit' | 'huid' | 'iris';

/** The atlas palette: each measured paint colour and the part it belongs to (null =
 *  left as painted: the shorts, boots, soles, the yellow shirt). */
const RANGER_PAINT: readonly (readonly [number, number, number, LookPart | null])[] = [
  [104, 125, 66, 'outfit'], [83, 104, 53, 'outfit'],                      // the green jacket
  [203, 188, 146, 'haar'], [217, 204, 173, 'haar'], [195, 175, 122, 'haar'], // white-blond hair
  [248, 159, 116, 'huid'],                                                // skin
  [187, 136, 86, null], [101, 55, 38, null], [61, 49, 37, null], [238, 178, 23, null],
];

/**
 * Which recolourable part a texel of the ranger atlas is: its painted colour (the
 * nearest palette entry) and where on the body it is drawn (`h` = height 0..1 of the
 * triangle it sits in, negative = not on the mesh). A clear blue in the head is the
 * iris. Pure.
 */
export function lookPart(r: number, g: number, b: number, h: number): LookPart | null {
  if (h < 0) return null;
  if (h >= 0.6 && b > r + 25 && b > g + 5) return 'iris';
  let best: LookPart | null = null;
  let bd = Infinity;
  for (const [pr, pg, pb, part] of RANGER_PAINT) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bd) { bd = d; best = part; }
  }
  if (best === 'haar' && h < 0.66) return null;                 // cream on the soles, not hair
  if (best === 'outfit' && (h < 0.38 || h > 0.86)) return null;  // green bits on the boots
  return best;
}

/** Perceived brightness of an sRGB colour (0..255). */
export function paintLum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Repaint one texel toward the chosen colour, keeping its painted light and shade:
 * a texel as bright as its part's average becomes exactly `target`, a brighter or
 * darker brush stroke stays that much brighter or darker. Pure, clamped to 0..255.
 */
export function repaint(r: number, g: number, b: number, target: readonly [number, number, number], partLum: number): [number, number, number] {
  const k = partLum > 0 ? paintLum(r, g, b) / partLum : 1;
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return [c(target[0]), c(target[1]), c(target[2])];
}

/** '#rrggbb' → [r, g, b]. */
export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
