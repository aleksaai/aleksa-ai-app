// Minimal hand-rolled DB types for the MVP.
// (Auto-generated `supabase gen types` would be nicer — bring back when local CLI is available.)

export type Customer = {
  id: string
  name: string
  contact_email: string
  stripe_customer_id: string | null
  has_payment_method: boolean
  branding: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  role: 'admin' | 'customer_owner'
  customer_id: string | null
  created_at: string
  updated_at: string
}

export type PricingPlanType = 'per_minute' | 'flat' | 'hybrid' | 'one_time'

export type BillingInterval = 'month' | 'year' | 'one_time'

export type PricingPlan = {
  id: string
  name: string
  type: PricingPlanType
  flat_amount_cents: number | null
  included_minutes: number | null
  per_minute_overage_cents: number | null
  currency: string
  billing_interval: BillingInterval
  stripe_product_id: string | null
  stripe_flat_price_id: string | null
  stripe_metered_price_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export type IntegrationPlatform = 'elevenlabs' | 'retellai' | 'vapi' | 'openai'
export type IntegrationRegion = 'us' | 'eu'

export type Integration = {
  id: string
  name: string
  platform: IntegrationPlatform
  region: IntegrationRegion | null
  active: boolean
  created_at: string
  updated_at: string
  // api_key + vapi_public_key are server-side only — not selected on the client
}

export type VoiceAgent = {
  id: string
  customer_id: string
  integration_id: string
  platform_agent_id: string
  platform_phone_number_id: string | null
  display_name: string | null
  pricing_plan_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CustomerInvitation = {
  id: string
  customer_id: string
  email: string
  token: string
  used_at: string | null
  expires_at: string
  created_at: string
}

export type CustomerPermissions = {
  customer_id: string
  can_view_calls: boolean
  can_view_transcripts: boolean
  can_view_audio: boolean
  can_edit_agent_config: boolean
  can_edit_kb: boolean
  created_at: string
  updated_at: string
}
