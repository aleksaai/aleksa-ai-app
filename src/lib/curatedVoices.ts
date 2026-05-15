// Curated fallback voices.
// Mix of ElevenLabs Premade voices (work with any API key) and voices
// already cloned into the AleksaAI workspace (e.g. Susi).
// Each voice has an `optimal_languages` list — these are the languages
// the voice sounds natural in. The UI filters the language picker
// based on the currently selected voice.

import type { Voice } from './api'

export type CuratedVoice = Voice & {
  optimal_languages: string[]
  short_description?: string
}

export const CURATED_VOICES: CuratedVoice[] = [
  // ─── German-native (priority for our market) ─────────────────
  {
    voice_id: 'v3V1d2rk6528UrLKRuy8',
    name: 'Susi',
    labels: { gender: 'weiblich', accent: 'deutsch', tone: 'freundlich' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['de', 'en', 'hu'],
    short_description: 'Klare deutsche Stimme, warm und professionell. Standard für Kati & Patricia.',
  },

  // ─── Multilingual (8+ Sprachen) ──────────────────────────────
  {
    voice_id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    labels: { gender: 'weiblich', tone: 'warm' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl'],
    short_description: 'Sehr vielseitige multilinguale Stimme. Gute Wahl für mehrsprachige Agenten.',
  },

  // ─── British English ─────────────────────────────────────────
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    labels: { gender: 'männlich', accent: 'britisch', tone: 'reif' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Britischer Akzent. Reif und seriös.',
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    labels: { gender: 'männlich', accent: 'britisch', tone: 'autoritär' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Britisch, autoritativ. Gut für Premium-Brands.',
  },
  {
    voice_id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    labels: { gender: 'weiblich', accent: 'britisch', tone: 'gefasst' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Britische Stimme, ruhig und kompetent.',
  },

  // ─── American English ────────────────────────────────────────
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    labels: { gender: 'weiblich', accent: 'amerikanisch', tone: 'ruhig' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Klassische ruhige US-Stimme. Beliebtester Default.',
  },
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    labels: { gender: 'männlich', accent: 'amerikanisch', tone: 'tief' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Tiefe männliche US-Stimme. Bewährter Klassiker.',
  },
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    labels: { gender: 'weiblich', accent: 'amerikanisch', tone: 'sanft' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Sanft und freundlich.',
  },
  {
    voice_id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    labels: { gender: 'männlich', accent: 'amerikanisch', tone: 'ausgewogen' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Ausgewogen, professionell.',
  },
  {
    voice_id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    labels: { gender: 'weiblich', accent: 'amerikanisch', tone: 'kraftvoll' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Kraftvoll und energiegeladen.',
  },
  {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    labels: { gender: 'männlich', accent: 'amerikanisch', tone: 'jugendlich' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Jung und sympathisch.',
  },
  {
    voice_id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    labels: { gender: 'männlich', accent: 'amerikanisch', tone: 'neutral' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Neutral und klar.',
  },
  {
    voice_id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    labels: { gender: 'weiblich', accent: 'amerikanisch', tone: 'freundlich' },
    preview_url: null,
    category: 'premade',
    optimal_languages: ['en'],
    short_description: 'Freundlich und warm.',
  },
]

// Map voice_id → optimal_languages. Used by ConfigView language picker.
export function optimalLanguagesForVoice(
  voiceId: string | null | undefined,
): string[] | null {
  if (!voiceId) return null
  const v = CURATED_VOICES.find((x) => x.voice_id === voiceId)
  return v ? v.optimal_languages : null
}
