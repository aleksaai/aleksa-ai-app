// Curated option lists for Customer-Self-Service agent configuration.
// IDs verified directly against ElevenLabs Convai validation endpoint
// on 2026-05-15 — these are the actually-supported strings.

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

// ElevenLabs TTS models — verified IDs from the Convai validation endpoint.
// Ordered newest → oldest, conversational-optimised first.
export type TtsModelOption = {
  id: string
  name: string
  description: string
}

export const TTS_MODELS: TtsModelOption[] = [
  {
    id: 'eleven_v3_conversational',
    name: 'v3 Conversational (Alpha)',
    description: 'Neueste Generation, optimiert für Live-Anrufe. Expressiv und natürlich.',
  },
  {
    id: 'eleven_v3',
    name: 'v3 (Alpha)',
    description: 'Maximale Ausdrucksstärke. Unterstützt Audio-Tags wie [lacht]. Etwas höhere Latenz.',
  },
  {
    id: 'eleven_turbo_v2_5',
    name: 'Turbo v2.5',
    description: 'Schnellste Latenz, multilingual. Bewährter Standard für Live-Calls.',
  },
  {
    id: 'eleven_flash_v2_5',
    name: 'Flash v2.5',
    description: 'Niedrigste Latenz (~75ms). Etwas reduzierte Qualität.',
  },
  {
    id: 'eleven_multilingual_v2',
    name: 'Multilingual v2',
    description: 'Höchste klassische Qualität, etwas langsamer. Für Premium-Stimmen.',
  },
]

export function ttsModelName(id: string | null | undefined): string {
  if (!id) return '—'
  return TTS_MODELS.find((m) => m.id === id)?.name ?? id
}

// LLM models — verified IDs from ElevenLabs Convai validation endpoint.
// Curated to the most relevant 14 across providers.
export type LlmModelOption = {
  id: string
  name: string
  description: string
}

export const LLM_MODELS: LlmModelOption[] = [
  // ─── OpenAI (newest first) ─────────────────────────────────────
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    description: 'OpenAIs neuestes Flagship-Modell (April 2026). Höchste Qualität.',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: 'Sehr starkes Reasoning, etwas schneller als 5.5.',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: 'Schnelle und günstige 5.4-Variante. Guter Allrounder.',
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Bewährt und stabil. Wird auch in unserem Telefon-Agenten Patricia verwendet.',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: 'Schneller GPT-5 für einfache Flows. Sehr günstig pro Anruf.',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    description: 'Kleinste GPT-5-Variante. Minimal-Kosten bei einfachen Aufgaben.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Älteres Flagship, bewährt, gute Multimodal-Fähigkeiten.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'Sehr günstig. Akzeptabel für simple Q&A.',
  },
  // ─── Anthropic ─────────────────────────────────────────────────
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: 'Anthropics stärkstes Modell. Exzellent für komplexe Konversationen.',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Top-Balance zwischen Qualität und Geschwindigkeit.',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Stabile etwas ältere Sonnet-Variante.',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Sehr schnelles Claude für einfache Flows.',
  },
  // ─── Google ────────────────────────────────────────────────────
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Googles neuestes Flagship. Sehr starke Multilingualität.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Schnelle 3er-Variante. Niedrige Latenz.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Bewährt, stabil, schnell. Gute Default-Wahl bei Google.',
  },
  // ─── xAI ───────────────────────────────────────────────────────
  {
    id: 'grok-beta',
    name: 'Grok (Beta)',
    description: 'xAIs Modell. Etwas eigenwilliger Ton.',
  },
]

export function llmModelName(id: string | null | undefined): string {
  if (!id) return '—'
  return LLM_MODELS.find((m) => m.id === id)?.name ?? id
}
