// confirm-setup-intent Edge Function
//
// Called by the customer's frontend right after Stripe Elements has confirmed
// the SetupIntent client-side. Does the server-side work that the platform
// webhook would normally handle, but works for BOTH platform customers AND
// connected-account customers (the latter don't emit events to our
// "Your account" webhook destination).
//
// Verifies the SetupIntent really succeeded, sets the resulting payment
// method as the customer's default, and flips customers.has_payment_method.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_auth' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const setupIntentId = (body.setup_intent_id ?? '').toString().trim()
    if (!setupIntentId) return json({ error: 'setup_intent_id_required' }, 400)

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('customer_id').eq('id', user.id).maybeSingle()
    if (!profile?.customer_id) return json({ error: 'no_customer_linked' }, 400)

    const { data: customer } = await sbAdmin
      .from('customers')
      .select('stripe_customer_id, stripe_account_id')
      .eq('id', profile.customer_id)
      .maybeSingle()
    if (!customer?.stripe_customer_id) return json({ error: 'no_stripe_customer' }, 400)

    const stripeHeaders: Record<string, string> = {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (customer.stripe_account_id) {
      stripeHeaders['Stripe-Account'] = customer.stripe_account_id as string
    }

    // 1. Retrieve SetupIntent — confirms it actually succeeded and belongs to
    //    our customer (defence against a caller forging an unrelated ID).
    const siRes = await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntentId}`, {
      method: 'GET',
      headers: stripeHeaders,
    })
    if (!siRes.ok) {
      return json({ error: 'setup_intent_fetch_failed', detail: await siRes.text() }, 502)
    }
    const si = await siRes.json()
    if (si.status !== 'succeeded') {
      return json({ error: 'setup_intent_not_succeeded', status: si.status }, 400)
    }
    if (si.customer !== customer.stripe_customer_id) {
      return json({ error: 'setup_intent_customer_mismatch' }, 403)
    }

    // 2. Set the new payment method as default for future invoices.
    const paymentMethodId = si.payment_method as string | null
    if (paymentMethodId) {
      await fetch(`https://api.stripe.com/v1/customers/${customer.stripe_customer_id}`, {
        method: 'POST',
        headers: stripeHeaders,
        body: new URLSearchParams({
          'invoice_settings[default_payment_method]': paymentMethodId,
        }),
      })
    }

    // 3. Flip our DB flag.
    await sbAdmin
      .from('customers')
      .update({ has_payment_method: true })
      .eq('id', profile.customer_id)

    return json({ ok: true })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
