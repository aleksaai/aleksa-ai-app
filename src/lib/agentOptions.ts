// Curated option lists for Customer-Self-Service agent configuration.
// These are kept narrow on purpose — we don't want customers picking obscure
// or expensive models. Admin can always patch to anything via raw API.

export type LanguageOption = {
  code: string // ISO 639-1
  name: string
}

// 18 most useful languages — all supported by eleven_turbo_v2_5
// and eleven_multilingual_v2.
export const LANGUAGES: LanguageOption[] = [
  { code: 'de', name: 'Deutsch' },
  { code: 'en', name: 'Englisch' },
  { code: 'es', name: 'Spanisch' },
  { code: 'fr', name: 'Französisch' },
  { code: 'it', name: 'Italienisch' },
  { code: 'pt', name: 'Portugiesisch' },
  { code: 'pl', name: 'Polnisch' },
  { code: 'nl', name: 'Niederländisch' },
  { code: 'hu', name: 'Ungarisch' },
  { code: 'cs', name: 'Tschechisch' },
  { code: 'ro', name: 'Rumänisch' },
  { code: 'tr', name: 'Türkisch' },
  { code: 'ru', name: 'Russisch' },
  { code: 'uk', name: 'Ukrainisch' },
  { code: 'sv', name: 'Schwedisch' },
  { code: 'da', name: 'Dänisch' },
  { code: 'no', name: 'Norwegisch' },
  { code: 'fi', name: 'Finnisch' },
]

export function languageName(code: string | null | undefined): string {
  if (!code) return '—'
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase()
}

// ElevenLabs TTS models — curated to the 3 most useful options.
export type TtsModelOption = {
  id: string
  name: string
  description: string
}

export const TTS_MODELS: TtsModelOption[] = [
  {
    id: 'eleven_turbo_v2_5',
    name: 'Turbo v2.5',
    description: 'Schnellste Latenz. Multilingual. Empfohlen für Live-Anrufe.',
  },
  {
    id: 'eleven_multilingual_v2',
    name: 'Multilingual v2',
    description: 'Höchste Qualität, etwas langsamer. Für Premium-Stimmen.',
  },
  {
    id: 'eleven_flash_v2_5',
    name: 'Flash v2.5',
    description: 'Niedrigste Latenz (75ms). Etwas reduzierte Qualität.',
  },
]

export function ttsModelName(id: string | null | undefined): string {
  if (!id) return '—'
  return TTS_MODELS.find((m) => m.id === id)?.name ?? id
}

// LLM models supported by ElevenLabs Conversational AI.
// Curated to 6 most relevant.
export type LlmModelOption = {
  id: string
  name: string
  description: string
}

export const LLM_MODELS: LlmModelOption[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'Schnell & günstig. Standard für die meisten Anrufe.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Höhere Qualität, etwas langsamer.',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Exzellent für komplexe Konversationen.',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Sehr schnell, gut für einfache Flows.',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Sehr schnell und multilingual.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Stabile, schnelle Variante von Google.',
  },
]

export function llmModelName(id: string | null | undefined): string {
  if (!id) return '—'
  return LLM_MODELS.find((m) => m.id === id)?.name ?? id
}
