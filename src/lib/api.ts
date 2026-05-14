// Typed wrappers around our Supabase Edge Functions.
// Each function calls the corresponding deployed Edge Function with the
// current user's JWT (so the function can verify caller role).

import { supabase } from './supabase'

export type CreateCustomerInput = {
  name: string
  contact_email: string
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

export async function updateCustomerBusiness(input: UpdateBusinessInput) {
  const { data, error } = await supabase.functions.invoke('update-customer-business', { body: input })
  if (error) {
    // Supabase functions client folds non-2xx into error.message — bubble up so UI shows it
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
