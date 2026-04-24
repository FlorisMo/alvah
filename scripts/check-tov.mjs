#!/usr/bin/env node
// Tone-of-voice check — rapporteert, blokkeert niet.
// Scope: src/pages/** en src/content/**. Skip: src/pages/spelen/**.
// Categorieën uit docs/tone-of-voice-alvah-site-nl.md.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src/pages', 'src/content'];
const SKIP_PATHS = ['src/pages/spelen'];
const EXTENSIONS = ['.astro', '.md', '.mdx'];

function shouldSkip(path) {
  return SKIP_PATHS.some((p) => path.startsWith(p));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (shouldSkip(rel)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      yield full;
    }
  }
}

// Verwijder .astro code-blokken (<script>/<style>) en HTML-comments.
// Frontmatter blijft nu behouden — daarin staan vaak string-inhouden (bv. categorie-
// kader-teksten) die in de UI renderen en dus onder ToV vallen.
function stripCode(content, isAstro) {
  if (!isAstro) return content;
  let s = content;
  // <script>...</script>
  s = s.replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '));
  // <style>...</style>
  s = s.replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/[^\n]/g, ' '));
  // HTML-comments
  s = s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  return s;
}

// Categorieën — elk item: { name, test(line) -> match-string of null }
const WORD_HITS = (line, words) => {
  const lower = line.toLowerCase();
  for (const w of words) {
    const idx = lower.indexOf(w.toLowerCase());
    if (idx !== -1) {
      // woord-grens check voor korte woorden
      const before = idx === 0 ? ' ' : lower[idx - 1];
      const after = lower[idx + w.length] ?? ' ';
      const wordBoundary = /[^a-zA-Z0-9áéíóúäëïöü]/;
      if (w.includes(' ') || (wordBoundary.test(before) && wordBoundary.test(after))) {
        return w;
      }
    }
  }
  return null;
};

const VERBODEN_WOORDEN_NL = [
  'onvergetelijk',
  'mooie reis',
  'prachtige ontwikkeling',
  'wij als ouders',
  'als ouders',
  'dappere kleine vechter',
  'ons zonnetje',
  'ons mannetje',
  'ondanks zijn beperking',
  'laat zich door niets tegenhouden',
  'is een inspiratie voor iedereen',
  'zijn glimlach zegt alles',
  'op reis gaan',
  'volwaardig potentieel',
  'potentieel ontgrendelen',
  'empoweren',
  'kanjer',
  'kerninterventie',
  'goud waard',
  'onmisbaar',
  'game-changer',
  'krachtige tool',
  'krachtig instrument',
  'een held',
  'kleine held',
];

const AI_CLICHES = [
  'delve',
  'unlock',
  'game-changer',
  'empower',
  'transformative',
  "it's worth noting",
  'move the needle',
  'deep dive',
  'circle back',
  'elevate',
  'curate',
];

const VULLERS = ['eigenlijk', 'eerlijk gezegd', 'letterlijk'];

const GENDER_CONSTRUCTIES = ['hij of zij', 'hem of haar', 'zijn of haar'];

// Match patroon: string of RegExp
const CATEGORIES = [
  {
    name: 'em-streepje',
    test: (line) => (line.includes('—') ? '—' : null),
  },
  {
    name: 'uitroepteken',
    test: (line) => {
      // skip code-achtige patronen
      if (/!=|!important|!\s*=|<!--|\bclient:/.test(line)) return null;
      // skip JSX/attribuut-achtige
      if (/\w+\s*=\s*["{][^"}]*!/.test(line)) return null;
      // skip proper nouns die een ! in de naam hebben (BOUW!-programma)
      const stripped = line.replace(/\bBouw!/gi, 'Bouw');
      return stripped.includes('!') ? '!' : null;
    },
  },
  {
    name: 'verboden-woord',
    test: (line) => WORD_HITS(line, VERBODEN_WOORDEN_NL),
  },
  {
    name: 'ai-cliche',
    test: (line) => WORD_HITS(line, AI_CLICHES),
  },
  {
    name: 'vuller',
    test: (line) => WORD_HITS(line, VULLERS),
  },
  {
    name: 'gender',
    test: (line) => WORD_HITS(line, GENDER_CONSTRUCTIES),
  },
  {
    name: 'retorische-tag',
    test: (line) => {
      const m = line.match(/,\s*(toch|right)\s*\?/i);
      return m ? m[0] : null;
    },
  },
  {
    name: 'aandoening-eerst',
    test: (line) => {
      const m = line.match(/\b(dyslexie-?(kinderen|leerling|leerlingen|patiënt|kind)|PKU-kind(eren)?|dyslectische?\s+(kinderen|leerling|lezer))/i);
      return m ? m[0] : null;
    },
  },
];

const results = {};
for (const cat of CATEGORIES) results[cat.name] = [];

let filesScanned = 0;
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    filesScanned++;
    const rel = relative(ROOT, file);
    const isAstro = file.endsWith('.astro');
    const content = stripCode(readFileSync(file, 'utf8'), isAstro);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const cat of CATEGORIES) {
        const match = cat.test(line);
        if (match) {
          results[cat.name].push({ file: rel, line: i + 1, match, text: line.trim().slice(0, 120) });
        }
      }
    }
  }
}

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const filterCat = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

if (asJson) {
  console.log(JSON.stringify({ filesScanned, results }, null, 2));
  process.exit(0);
}

let totalHits = 0;
for (const cat of CATEGORIES) {
  if (filterCat && cat.name !== filterCat) continue;
  const hits = results[cat.name];
  totalHits += hits.length;
  console.log(`\n=== ${cat.name} — ${hits.length} hits ===`);
  for (const h of hits) {
    console.log(`  ${h.file}:${h.line}  [${h.match}]  ${h.text}`);
  }
}

console.log(`\n---\nFiles gescand: ${filesScanned}`);
console.log(`Totaal hits: ${totalHits}`);
console.log('(Informatief — exit 0.)');
process.exit(0);
