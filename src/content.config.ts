import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const oefeningen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/oefeningen' }),
  schema: z.object({
    titel: z.string(),
    domein: z.array(z.enum([
      'technisch-lezen',
      'begrijpend-lezen',
      'spelling',
      'rekenen',
      'werkgeheugen',
      'aandacht-focus',
      'planning',
      'zelfbeeld-faalangst',
      'motoriek',
      'beweging',
      'emotieregulatie',
      'compenserend',
    ])),
    context: z.array(z.enum(['thuis', 'school', 'specialist'])),
    duur: z.enum(['kort-5min', 'gemiddeld-10-15min', 'lang-20min-plus', 'nvt']),
    kosten: z.enum(['gratis', 'onder-50', '50-200', 'meer-dan-200', 'abonnement', 'vergoed']),
    evidence: z.enum(['sterk', 'matig', 'zwak', 'praktijkclaim']),
    korte_omschrijving: z.string(),
    bronnen: z.array(z.object({
      tekst: z.string(),
      url: z.string().url().optional(),
    })).default([]),
  }),
});

const milestones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/milestones' }),
  schema: z.object({
    datum: z.coerce.date(),
    titel: z.string(),
    samenvatting: z.string(),
    tags: z.array(z.string()).default([]),
    oefeningen_actief: z.array(z.string()).default([]),
    open_onderzoek: z.boolean().default(false),
  }),
});

const vragen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/vragen' }),
  schema: z.object({
    titel: z.string(),
    voor: z.enum(['ons', 'school', 'alvah']),
    status: z.enum(['open', 'in-gesprek', 'beantwoord']).default('open'),
    urgentie: z.enum(['hoog', 'gemiddeld', 'laag']).default('gemiddeld'),
    waarom: z.string(),
    wie_beantwoordt: z.string().optional(),
    antwoord_milestone: z.string().optional(),
    gerelateerde_milestones: z.array(z.string()).default([]),
    gerelateerde_oefeningen: z.array(z.string()).default([]),
    aangemaakt: z.coerce.date(),
    beantwoord_op: z.coerce.date().optional(),
  }),
});

export const collections = { oefeningen, milestones, vragen };
