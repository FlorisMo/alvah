/**
 * assets.ts — base-path-portable static-asset URLs.
 *
 * The app is served either at the site root `/` (standalone Vite dev/build,
 * the showroom) or under `/ranger/` once folded into alvah.nl (Phase 8). Vite's
 * `base` carries that prefix in `import.meta.env.BASE_URL`; routing every
 * runtime asset fetch (models / draco / audio manifests + files) through
 * `assetUrl()` makes the same source resolve correctly in both worlds with no
 * conditional paths.
 *
 * `joinBase` is the pure, node-testable core; `assetUrl` binds it to the live
 * Vite base. Absolute URLs (http(s):, data:, blob:, protocol-relative) pass
 * through untouched.
 */

/** Join a base prefix and an app-relative asset path, deduping the slash. */
export function joinBase(base: string, path: string): string {
  // Already-absolute URLs are returned verbatim — never re-prefixed.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const b = base.endsWith('/') ? base : base + '/';
  const p = path.startsWith('/') ? path.slice(1) : path;
  return b + p;
}

/** The live Vite base (`/` standalone, `/ranger/` under `--mode site`). */
export function assetBase(): string {
  // Guarded for non-Vite contexts (node unit tests): `import.meta.env` is
  // undefined there, so fall back to the site root.
  return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
}

/** Resolve an app-relative asset path against the live Vite base. */
export function assetUrl(path: string): string {
  return joinBase(assetBase(), path);
}
