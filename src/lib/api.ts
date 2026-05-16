// Typed wrappers around our Supabase Edge Functions.
// Each function calls the corresponding deployed Edge Function with the
// current user's JWT (so the function can verify caller role).

import { supabase } from './supabase'

// ─── admin-approve-as-agency (Multi-Tenant Phase I) ────────────

export async function adminApproveAsAgency(access_request_id: string): Promise<{
  ok: true
  access_request_id: string
  invite_link: string
  email_sent: boolean
  email_error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('admin-approve-as-agency', {
    body: { access_request_id },
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

// ─── agency-create-integration (Multi-Tenant Phase E voll) ─────

export type AgencyCreateIntegrationInput = CreateIntegrationInput

export async function agencyCreateIntegration(input: AgencyCreateIntegrationInput) {
  const { data, error } = await supabase.functions.invoke('agency-create-integration', { body: input })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; integration: { id: string; name: string; platform: string; region: string | null } }
}

// ─── agency-list-platform-agents ───────────────────────────────

export async function agencyListPlatformAgents(integration_id: string) {
  const { data, error } = await supabase.functions.invoke('agency-list-platform-agents', { body: { integration_id } })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; agents: ListedPlatformAgent[]; integration: { id: string; name: string; platform: string; region: string | null } }
}

// ─── agency-create-voice-agent ─────────────────────────────────

export async function agencyCreateVoiceAgent(input: CreateVoiceAgentInput) {
  const { data, error } = await supabase.functions.invoke('agency-create-voice-agent', { body: input })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; agent: { id: string } }
}

// ─── Stripe Connect (Multi-Tenant Phase G) ─────────────────────

export async function stripeConnectStart(origin?: string): Promise<{
  ok: true
  url: string
  redirect_uri: string
}> {
  const { data, error } = await supabase.functions.invoke('stripe-connect-start', {
    body: { origin: origin ?? window.location.origin },
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

export async function stripeConnectCallback(input: { code: string; state: string }): Promise<{
  ok: true
  stripe_user_id: string
  origin: string | null
}> {
  const { data, error } = await supabase.functions.invoke('stripe-connect-callback', { body: input })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

export async function stripeConnectDisconnect(): Promise<{
  ok: true
  stripe_revoke_error: string | null
  message?: string
}> {
  const { data, error } = await supabase.functions.invoke('stripe-connect-disconnect', { body: {} })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

// ─── verify-custom-domain (Multi-Tenant Phase H) ──────────────

export async function verifyCustomDomain(): Promise<{
  ok: boolean
  cname_found: string | null
  cname_expected: string
  netlify?: 'added' | 'skipped_no_secrets' | 'failed'
  netlify_error?: string | null
  note?: string
  error?: string
  detail?: string
}> {
  const { data, error } = await supabase.functions.invoke('verify-custom-domain', { body: {} })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        return body as any
      }
    } catch {}
    throw new Error(error.message)
  }
  return data as any
}

// ─── agency-create-customer (Multi-Tenant Phase D) ─────────────

export type AgencyCreateCustomerInput = {
  name: string
  contact_email: string
}

export async function agencyCreateCustomer(input: AgencyCreateCustomerInput): Promise<{
  ok: true
  customer_id: string
  invitation_token: string
  invite_link: string
  email_sent: boolean
  email_error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('agency-create-customer', {
    body: input,
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

// ─── agency-finalize-onboarding (Multi-Tenant Phase I) ─────────

export type AgencyFinalizeInput = {
  request_id?: string
  slug: string
  display_name: string
  brand_color: string
}

export async function agencyFinalizeOnboarding(input: AgencyFinalizeInput): Promise<{
  ok: true
  agency: { id: string; slug: string; display_name: string; brand_color: string }
}> {
  const { data, error } = await supabase.functions.invoke('agency-finalize-onboarding', {
    body: input,
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Unexpected response')
  return data as any
}

export type CreateCustomerInput = {
  name: string
  contact_email: string
  kind?: 'voice_customer' | 'platform_member'
}

export type CreateCustomerResult = {
  ok: true
  customer_id: string
  stripe_customer_id: string
  invitation_token: string
  invite_link: string
  email_sent: boolean
  email_error?: string | null
}

export async function adminCreateCustomer(
  input: CreateCustomerInput
): Promise<CreateCustomerResult> {
  const { data, error } = await supabase.functions.invoke<CreateCustomerResult>(
    'admin-create-customer',
    { body: input }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Unexpected response from server')
  return data
}

// ─── accept-invitation ─────────────────────────────────────────

export type InvitationInfo = {
  ok: true
  email: string
  customer_name: string
}

export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  const { data, error } = await supabase.functions.invoke<InvitationInfo>(
    'accept-invitation',
    { body: { token, action: 'info' } }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

export async function sendInvitationMagicLink(token: string): Promise<{ ok: true; sent_to: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; sent_to: string }>(
    'accept-invitation',
    { body: { token, action: 'send_magic_link' } }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// ─── link-invitation (post-auth, links profile.customer_id) ────

export async function linkInvitation(token: string): Promise<{ ok: true; customer_id: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; customer_id: string }>(
    'link-invitation',
    { body: { token } }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// ─── setup-intent ───────────────────────────────────────────────

export type SetupIntentResult = {
  ok: true
  client_secret: string
  setup_intent_id: string
  publishable_key: string
}

export async function getSetupIntent(): Promise<SetupIntentResult> {
  const { data, error } = await supabase.functions.invoke<SetupIntentResult>(
    'setup-intent',
    { body: {} }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// ─── admin-create-pricing-plan ──────────────────────────────────

export type PricingPlanInput =
  | {
      type: 'hybrid'
      name: string
      currency: string
      billing_interval: 'month' | 'year'
      flat_amount_cents: number
      included_minutes: number
      per_minute_overage_cents: number
    }
  | {
      type: 'per_minute'
      name: string
      currency: string
      billing_interval: 'month' | 'year'
      per_minute_overage_cents: number
    }
  | {
      type: 'one_time'
      name: string
      currency: string
      flat_amount_cents: number
    }

export type CreatePricingPlanResult = {
  ok: true
  plan: {
    id: string
    name: string
    type: string
    [k: string]: unknown
  }
  stripe_product_id: string
  stripe_flat_price_id: string | null
  stripe_metered_price_id: string | null
}

export async function adminCreatePricingPlan(
  input: PricingPlanInput
): Promise<CreatePricingPlanResult> {
  const { data, error } = await supabase.functions.invoke<CreatePricingPlanResult>(
    'admin-create-pricing-plan',
    { body: input }
  )
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// ─── admin-create-integration ──────────────────────────────────

export type CreateIntegrationInput =
  | { platform: 'elevenlabs'; name: string; api_key: string; region: 'us' | 'eu' }
  | { platform: 'retellai'; name: string; api_key: string }
  | { platform: 'vapi'; name: string; api_key: string; vapi_public_key: string }
  | { platform: 'openai'; name: string; api_key: string }

export async function adminCreateIntegration(input: CreateIntegrationInput) {
  const { data, error } = await supabase.functions.invoke('admin-create-integration', { body: input })
  if (error) throw new Error(error.message)
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; integration: { id: string; name: string; platform: string; region: string | null } }
}

// ─── admin-list-platform-agents ─────────────────────────────────

export type ListedPlatformAgent = {
  platform_agent_id: string
  name: string
  platform_phone_number_id?: string
  phone_number_e164?: string
}

export async function adminListPlatformAgents(integration_id: string) {
  const { data, error } = await supabase.functions.invoke('admin-list-platform-agents', { body: { integration_id } })
  if (error) throw new Error(error.message)
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; agents: ListedPlatformAgent[]; integration: { id: string; name: string; platform: string; region: string | null } }
}

// ─── admin-create-voice-agent ──────────────────────────────────

export type CreateVoiceAgentInput = {
  customer_id: string
  integration_id: string
  platform_agent_id: string
  display_name?: string
  platform_phone_number_id?: string
}

export async function adminCreateVoiceAgent(input: CreateVoiceAgentInput) {
  const { data, error } = await supabase.functions.invoke('admin-create-voice-agent', { body: input })
  if (error) throw new Error(error.message)
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as { ok: true; agent: { id: string } }
}

// ─── admin-assign-pricing ───────────────────────────────────────

export type AssignPricingInput = {
  voice_agent_id: string
  pricing_plan_id: string
}

export async function adminAssignPricing(input: AssignPricingInput) {
  const { data, error } = await supabase.functions.invoke('admin-assign-pricing', { body: input })
  if (error) throw new Error(error.message)
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data as {
    ok: true
    customer_subscription: { id: string; status: string }
    stripe_subscription_id: string
    stripe_status: string
    metered_item_id: string | null
  }
}

// ─── customer-billing-portal ────────────────────────────────────

export async function getCustomerBillingPortalUrl() {
  const { data, error } = await supabase.functions.invoke('customer-billing-portal', { body: {} })
  if (error) throw new Error(error.message)
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return (data as { ok: true; url: string }).url
}

// ─── update-customer-business (business name + EU VAT ID) ─────

export type UpdateBusinessInput = {
  business_name?: string
  vat_id?: string
}

// ─── admin-get-agent-config ─────────────────────────────────────

export type KBEntry = {
  id: string
  name: string
  type: 'text' | 'file' | 'url'
  usage_mode?: 'auto' | 'prompt'
}

export type AgentConfig = {
  ok: true
  platform: 'elevenlabs' | 'retellai'
  agent_id: string
  name: string | null
  prompt: string
  llm: string | null
  first_message: string
  language: string | null
  voice_id: string | null
  tts_model: string | null
  stability: number | null
  similarity_boost: number | null
  language_presets: Record<string, unknown>
  knowledge_base: KBEntry[]
  rag_enabled: boolean
  // Retell-only optional extras
  retell_llm_id?: string | null
  retell_response_engine_type?: string | null
}

export async function adminGetAgentConfig(voice_agent_id: string): Promise<AgentConfig> {
  const { data, error } = await supabase.functions.invoke<AgentConfig>('admin-get-agent-config', {
    body: { voice_agent_id },
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// ─── admin-update-agent-config ──────────────────────────────────

export type UpdateAgentConfigInput = {
  voice_agent_id: string
  prompt?: string
  first_message?: string
  voice_id?: string
  language?: string
  tts_model_id?: string
  llm_model_id?: string
  language_presets?: Record<string, unknown>
}

export async function adminUpdateAgentConfig(input: UpdateAgentConfigInput) {
  const { data, error } = await supabase.functions.invoke('admin-update-agent-config', { body: input })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data
}

// ─── admin-list-voices ──────────────────────────────────────────

export type Voice = {
  voice_id: string
  name: string
  labels: Record<string, string>
  preview_url: string | null
  category: string | null
}

export async function adminListVoices(integration_id: string): Promise<Voice[]> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; voices: Voice[] }>('admin-list-voices', {
    body: { integration_id },
  })
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data.voices
}

// ─── admin-get-voice ──────────────────────────────────────────
// Fetches a single voice by ID from ElevenLabs.
// Works for both workspace voices and shared/premade library voices.
export async function adminGetVoiceById(integration_id: string, voice_id: string): Promise<Voice> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; voice: Voice }>('admin-get-voice', {
    body: { integration_id, voice_id },
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data.voice
}

// ─── Knowledge Base ─────────────────────────────────────────────

export type KBDoc = {
  id: string
  name: string
  type: string
  access_level?: string | null
}

export async function adminListKbDocs(integration_id: string): Promise<KBDoc[]> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; docs: KBDoc[] }>('admin-list-kb-docs', {
    body: { integration_id },
  })
  if (error) throw new Error(error.message)
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data.docs
}

export async function adminCreateKbDoc(input: { integration_id: string; name: string; text: string }) {
  const { data, error } = await supabase.functions.invoke<{ ok: true; doc: KBDoc }>('admin-create-kb-doc', {
    body: input,
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data.doc
}

// ─── Call Detail ────────────────────────────────────────────────

export type TranscriptTurn = {
  role: 'user' | 'agent' | string
  message: string | null
  time_in_call_secs?: number
}

export type CallDetail = {
  ok: true
  id: string
  conversation_id: string
  started_at: string
  duration_secs: number
  cost_credits: number | null
  termination_reason: string | null
  agent_name: string | null
  customer_name: string | null
  transcript: TranscriptTurn[] | null
  transcript_summary: string | null
  audio_available: boolean
  permissions: {
    canViewCalls: boolean
    canViewTranscripts: boolean
    canViewAudio: boolean
  }
}

export async function adminGetCallDetail(call_id: string): Promise<CallDetail> {
  const { data, error } = await supabase.functions.invoke<CallDetail>('admin-get-call-detail', {
    body: { call_id },
  })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !('ok' in data)) throw new Error('Invalid response')
  return data
}

// Returns an authenticated blob URL for the call audio.
// Caller must URL.revokeObjectURL when done.
export async function fetchCallAudioBlobUrl(call_id: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) throw new Error('not_authenticated')
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-call-audio`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ call_id }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody.error ?? ''
    } catch {}
    throw new Error(`audio_fetch_failed: ${res.status} ${detail}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function adminUpdateAgentKb(input: {
  voice_agent_id: string
  knowledge_base: KBEntry[]
  rag_enabled?: boolean
}) {
  const { data, error } = await supabase.functions.invoke('admin-update-agent-kb', { body: input })
  if (error) {
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        throw new Error(`${body?.error ?? 'error'}${body?.detail ? ': ' + body.detail : ''}`)
      }
    } catch {}
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) throw new Error('Invalid response')
  return data
}

export async function updateCustomerBusiness(input: UpdateBusinessInput) {
  const { data, error } = await supabase.functions.invoke('update-customer-business', { body: input })
  if (error) {
    // supabase.functions.invoke on non-2xx returns error.message = generic
    // "Edge Function returned a non-2xx status code". The real body is on
    // error.context (a Response) — try to parse our {error, detail} from it.
    try {
      const ctx = (error as any).context
      if (ctx?.json) {
        const body = await ctx.json()
        const e = body?.error ?? 'unknown_error'
        const d = body?.detail ?? ''
        throw new Error(`${e}${d ? ': ' + d : ''}`)
      }
    } catch {
      // fall through to generic
    }
    throw new Error(error.message)
  }
  if (!data || !(data as any).ok) {
    const e = (data as any)?.error ?? 'unknown_error'
    const detail = (data as any)?.detail ?? ''
    throw new Error(`${e}${detail ? ': ' + detail : ''}`)
  }
  return data as {
    ok: true
    business_name: string | null
    vat_id: { id: string; verification_status?: string } | null
  }
}
