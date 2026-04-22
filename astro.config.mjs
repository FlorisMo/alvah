import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://alvah.nl',
  build: { format: 'directory' },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
