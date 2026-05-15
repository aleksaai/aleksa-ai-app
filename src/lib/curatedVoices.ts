// Curated voices for the customer voice picker.
// Selection is German-first because most of our customers operate in DACH.
// Each voice has an `optimal_languages` list so the language picker
// can filter accordingly.
//
// IDs verified against the ElevenLabs Shared Library on 2026-05-15.

import type { Voice } from './api'

export type CuratedVoice = Voice & {
  optimal_languages: string[]
  short_description?: string
}

export const CURATED_VOICES: CuratedVoice[] = [
  // ─── German (priority — most customers are DACH) ─────────────
  {
    voice_id: 'v3V1d2rk6528UrLKRuy8',
    name: 'Susi',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'sanft' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en', 'hu'],
    short_description: 'Sanfte, melodische Stimme. Standard für Kati & Patricia.',
  },
  {
    voice_id: '7eVMgwCnXydb3CikjV7a',
    name: 'Lea',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'klar' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en'],
    short_description: 'Klare, attraktive reife Frauenstimme. Perfekt für Dialogsysteme.',
  },
  {
    voice_id: 'FTNCalFNG5bRnkkaP5Ug',
    name: 'Otto',
    labels: { gender: 'männlich', accent: 'deutsch', tone: 'ruhig' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en'],
    short_description: 'Ruhige männliche Studio-Qualität. Sehr ausgewogen.',
  },
  {
    voice_id: 'K75lPKuh15SyVhQC1LrE',
    name: 'Carola',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'klar' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de'],
    short_description: 'Klare Nachrichtensprecher-Qualität. Sehr seriös.',
  },
  {
    voice_id: 'AnvlJBAqSLDzEevYr9Ap',
    name: 'Ava',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'jugendlich' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en'],
    short_description: 'Jugendlich und expressiv. Gut für moderne Brands.',
  },
  {
    voice_id: 'r8MyP4qUsq5WFFSkPdfV',
    name: 'Johannes',
    labels: { gender: 'männlich', accent: 'deutsch', tone: 'neutral' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de'],
    short_description: 'Klare neutrale Aussprache. Dokumentations-tauglich.',
  },
  {
    voice_id: 'ViKqgJNeCiWZlYgHiAOO',
    name: 'Annika',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'ruhig' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en'],
    short_description: 'Ruhig, selbstbewusst, angenehm. Premium-Feeling.',
  },
  {
    voice_id: 'ABvMrd8urrMUl3V6UZ3Y',
    name: 'Vincent',
    labels: { gender: 'männlich', accent: 'deutsch', tone: 'warm' },
    preview_url: null,
    category: 'shared',
    optimal_languages: ['de', 'en'],
    short_description: 'Warm und autoritativ. Gut für vertrauenswürdige Brands.',
  },

  // ─── Multilingual (8 languages) ──────────────────────────────
  {
    voice_id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    labels: { gender: 'weiblich', tone: 'warm' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl'],
    short_description: 'Sehr vielseitige multilinguale Stimme.',
  },

  // ─── English (US + UK) ───────────────────────────────────────
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    labels: { gender: 'weiblich', accent: 'amerikanisch', tone: 'ruhig' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Klassische ruhige US-Stimme.',
  },
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    labels: { gender: 'männlich', accent: 'amerikanisch', tone: 'tief' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Tiefe männliche US-Stimme. Klassiker.',
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    labels: { gender: 'männlich', accent: 'britisch', tone: 'reif' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Britischer Akzent. Reif und seriös.',
  },
]

export function optimalLanguagesForVoice(
  voiceId: string | null | undefined,
): string[] | null {
  if (!voiceId) return null
  const v = CURATED_VOICES.find((x) => x.voice_id === voiceId)
  return v ? v.optimal_languages : null
}
