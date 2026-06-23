import { defineConfig } from 'vite';

/**
 * Standalone Vite app for "Ranger van de Veluwe".
 *
 * `base` is the one knob the Astro re-wrap (Phase 8 / RUN-LEDGER 113) needs:
 * - default (`vite build` / `vite dev`) → served at the site root `/`, exactly
 *   as before — no behaviour change for the standalone app or the showroom.
 * - `--mode site` → served under `/ranger/` so every emitted asset URL (the
 *   bundled entry, `import`ed CSS) and every runtime fetch routed through
 *   `core/assets.ts#assetUrl` (models/draco/audio) resolves under that prefix.
 *
 * `import.meta.env.BASE_URL` carries this base into the code, so the same
 * source runs at `/` (standalone) or `/ranger/` (folded into alvah.nl) with no
 * conditional paths.
 *
 * Under `--mode site` the build also: emits **fixed-name** output (`app.js` +
 * `app.css`, no content hash) so `src/pages/ranger/index.astro` can reference a
 * stable bundle; writes into the site's `public/ranger/` (Astro copies it to
 * `dist/ranger/` verbatim); and the publicDir (`models/`, `audio/`, `draco/`)
 * lands under that same `/ranger/` prefix. `public/ranger/` is git-ignored — a
 * generated artifact the root build (and the deploy Action) regenerates.
 */
export default defineConfig(({ mode }) => {
  const site = mode === 'site';
  return {
    base: site ? '/ranger/' : '/',
    ...(site && {
      build: {
        // Stage straight into the Astro site's public dir (repo-root
        // `public/ranger/`); Astro copies it verbatim into `dist/ranger/`.
        outDir: '../../../public/ranger',
        // The dir lives outside the Vite root, so opt in to emptying it.
        emptyOutDir: true,
        rollupOptions: {
          // Only the game (`index.html`) ships to the site; `showroom.html`
          // stays a dev-only standalone surface (it isn't a default entry).
          input: 'index.html',
          output: {
            // Fixed names — the Astro page hardcodes `/ranger/app.{js,css}`.
            entryFileNames: 'app.js',
            chunkFileNames: 'chunks/[name].js',
            assetFileNames: 'app.[ext]',
          },
        },
      },
    }),
  };
});
