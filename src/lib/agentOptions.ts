// Platform-aware option lists for Customer-Self-Service agent configuration.
// Different platforms (ElevenLabs vs Retell AI) have different model IDs,
// language codes and TTS model names.
//
// IDs verified directly against each platform's validation endpoint
// where possible. Retell IDs come from their public docs.

export type Platform = 'elevenlabs' | 'retellai'

export type LanguageOption = {
  code: string
  name: string
}

export type ModelOption = {
  id: string
  name: string
  description: string
}

// ============================================================
// ElevenLabs
// ============================================================

export const LANGUAGES_ELEVENLABS: LanguageOption[] = [
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

export const TTS_MODELS_ELEVENLABS: ModelOption[] = [
  {
    id: 'eleven_v3_conversational',
    name: 'v3 Conversational (Alpha)',
    description: 'Neueste Generation, optimiert für Live-Anrufe.',
  },
  {
    id: 'eleven_v3',
    name: 'v3 (Alpha)',
    description: 'Maximale Ausdrucksstärke. Audio-Tags wie [lacht].',
  },
  {
    id: 'eleven_turbo_v2_5',
    name: 'Turbo v2.5',
    description: 'Schnellste Latenz, multilingual. Bewährter Standard.',
  },
  {
    id: 'eleven_flash_v2_5',
    name: 'Flash v2.5',
    description: 'Niedrigste Latenz (~75ms). Etwas reduzierte Qualität.',
  },
  {
    id: 'eleven_multilingual_v2',
    name: 'Multilingual v2',
    description: 'Höchste klassische Qualität, etwas langsamer.',
  },
]

export const LLM_MODELS_ELEVENLABS: ModelOption[] = [
  { id: 'gpt-5.5', name: 'GPT-5.5', description: 'OpenAIs neuestes Flagship (April 2026).' },
  { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Sehr starkes Reasoning, etwas schneller als 5.5.' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', description: 'Schnelle und günstige 5.4-Variante.' },
  { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Bewährt und stabil. Wird auch von Patricia genutzt.' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', description: 'Schneller GPT-5 für einfache Flows.' },
  { id: 'gpt-5-nano', name: 'GPT-5 nano', description: 'Kleinste GPT-5-Variante. Minimal-Kosten.' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Älteres Flagship, bewährt.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Sehr günstig.' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', description: 'Anthropics stärkstes Modell.' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Top-Balance Qualität/Speed.' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Stabile etwas ältere Variante.' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Sehr schnell.' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', description: 'Googles neuestes Flagship.' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', description: 'Schnelle 3er-Variante.' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Bewährt, stabil, schnell.' },
  { id: 'grok-beta', name: 'Grok (Beta)', description: 'xAIs Modell.' },
]

// ============================================================
// Retell AI
// ============================================================

// Retell uses locale codes (BCP-47) like "de-DE" instead of plain "de".
export const LANGUAGES_RETELL: LanguageOption[] = [
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'en-US', name: 'Englisch (US)' },
  { code: 'en-GB', name: 'Englisch (UK)' },
  { code: 'es-ES', name: 'Spanisch' },
  { code: 'es-419', name: 'Spanisch (Lateinamerika)' },
  { code: 'fr-FR', name: 'Französisch' },
  { code: 'fr-CA', name: 'Französisch (Kanada)' },
  { code: 'it-IT', name: 'Italienisch' },
  { code: 'pt-BR', name: 'Portugiesisch (Brasilien)' },
  { code: 'pt-PT', name: 'Portugiesisch (Portugal)' },
  { code: 'nl-NL', name: 'Niederländisch' },
  { code: 'pl-PL', name: 'Polnisch' },
  { code: 'hu-HU', name: 'Ungarisch' },
  { code: 'tr-TR', name: 'Türkisch' },
  { code: 'ru-RU', name: 'Russisch' },
  { code: 'ja-JP', name: 'Japanisch' },
  { code: 'zh-CN', name: 'Chinesisch' },
  { code: 'multi', name: 'Multilingual (Auto-Detect)' },
]

// In Retell the "voice_model" field overrides the default TTS engine for
// ElevenLabs-provided voices. For OpenAI/Deepgram/Play.ht/Cartesia voices
// the engine is implicit and this field is ignored.
export const TTS_MODELS_RETELL: ModelOption[] = [
  {
    id: 'eleven_turbo_v2_5',
    name: 'ElevenLabs Turbo v2.5',
    description: 'Schnell, multilingual. Standard für EL-Stimmen.',
  },
  {
    id: 'eleven_multilingual_v2',
    name: 'ElevenLabs Multilingual v2',
    description: 'Höhere Qualität, etwas langsamer.',
  },
  {
    id: 'eleven_flash_v2_5',
    name: 'ElevenLabs Flash v2.5',
    description: 'Niedrigste Latenz.',
  },
  {
    id: 'eleven_turbo_v2',
    name: 'ElevenLabs Turbo v2',
    description: 'Ältere stabile Turbo-Variante.',
  },
]

// Retell-supported LLMs (Retell LLM resource only — for Custom LLMs the
// model field is ignored).
export const LLM_MODELS_RETELL: ModelOption[] = [
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI Flagship.' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'Günstig und schnell.' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', description: 'Kleinste Variante.' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Bewährtes Multimodal-Modell.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Sehr günstig.' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Anthropics aktuelle Sonnet-Generation.' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Schnellste Anthropic-Variante.' },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', description: 'Vorgängergeneration, stabil.' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Bewährtes ältere Sonnet.' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', description: 'Sehr schnell und günstig.' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Googles schnelle Variante.' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Stabile schnelle Variante.' },
]

// ============================================================
// Platform dispatcher
// ============================================================

export function getOptionsForPlatform(platform: Platform | string | null | undefined) {
  if (platform === 'retellai') {
    return {
      languages: LANGUAGES_RETELL,
      ttsModels: TTS_MODELS_RETELL,
      llmModels: LLM_MODELS_RETELL,
    }
  }
  // ElevenLabs default
  return {
    languages: LANGUAGES_ELEVENLABS,
    ttsModels: TTS_MODELS_ELEVENLABS,
    llmModels: LLM_MODELS_ELEVENLABS,
  }
}

// Resolves a language code to a human-readable name across both platforms.
export function languageName(code: string | null | undefined): string {
  if (!code) return '—'
  const all = [...LANGUAGES_ELEVENLABS, ...LANGUAGES_RETELL]
  return all.find((l) => l.code === code)?.name ?? code.toUpperCase()
}

// Back-compat exports (existing code imports LANGUAGES/TTS_MODELS/LLM_MODELS).
// These default to ElevenLabs. New code should use getOptionsForPlatform.
export const LANGUAGES = LANGUAGES_ELEVENLABS
export const TTS_MODELS = TTS_MODELS_ELEVENLABS
export const LLM_MODELS = LLM_MODELS_ELEVENLABS
