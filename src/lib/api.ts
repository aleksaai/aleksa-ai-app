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
