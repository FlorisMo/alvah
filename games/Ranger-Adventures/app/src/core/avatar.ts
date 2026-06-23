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
  kleur: string; // the tint used for the 2D preview now + the 3D material later
}

/** Inclusive skin tones (lichtest→donkerst). First entry is the blank default. */
export const HUID_OPTIES: AvatarOptie[] = [
  { id: 'licht',  label: 'Licht',  kleur: '#f2c9a0' },
  { id: 'getint', label: 'Getint', kleur: '#d99a6c' },
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

export const IRIS_OPTIES: AvatarOptie[] = [
  { id: 'bruin', label: 'Bruin', kleur: '#6b4a2b' },
  { id: 'groen', label: 'Groen', kleur: '#4a7a4a' },
  { id: 'blauw', label: 'Blauw', kleur: '#3a6a9a' },
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

/** The tint for a chosen option (preview + 3D material). */
export function kleurVan(kenmerk: AvatarKenmerk, id: string): string {
  const opties = AVATAR_KENMERKEN[kenmerk];
  return (opties.find((o) => o.id === id) ?? opties[0]).kleur;
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
