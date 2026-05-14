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
