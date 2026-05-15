// Curated fallback voices from ElevenLabs' public Premade library.
// These voice IDs work with ANY ElevenLabs API key (no workspace cloning needed)
// and support all 29 languages via the multilingual_v2 model.
// Used as a fallback in the Customer voice picker when the admin's integration
// doesn't expose any workspace voices.

import type { Voice } from './api'

export const CURATED_VOICES: Voice[] = [
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    labels: { gender: 'female', accent: 'american', tone: 'ruhig' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    labels: { gender: 'male', accent: 'american', tone: 'tief' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    labels: { gender: 'female', accent: 'american', tone: 'sanft' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    labels: { gender: 'male', accent: 'american', tone: 'ausgewogen' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    labels: { gender: 'female', accent: 'american', tone: 'kraftvoll' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    labels: { gender: 'male', accent: 'american', tone: 'jugendlich' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    labels: { gender: 'female', accent: 'multilingual', tone: 'warm' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    labels: { gender: 'male', accent: 'british', tone: 'reif' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    labels: { gender: 'male', accent: 'british', tone: 'autoritär' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    labels: { gender: 'female', accent: 'british', tone: 'gefasst' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    labels: { gender: 'male', accent: 'american', tone: 'neutral' },
    preview_url: null,
    category: 'premade',
  },
  {
    voice_id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    labels: { gender: 'female', accent: 'american', tone: 'freundlich' },
    preview_url: null,
    category: 'premade',
  },
]
