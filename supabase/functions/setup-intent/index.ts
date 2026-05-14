// setup-intent Edge Function
// Creates a Stripe SetupIntent for the calling customer-owner so they can
// attach a payment method via Stripe Elements on the frontend.

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

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    // Find the user's customer
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.customer_id) return json({ error: 'no_customer_linked' }, 400)

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', profile.customer_id)
      .maybeSingle()

    if (!customer?.stripe_customer_id) return json({ error: 'no_stripe_customer' }, 400)

    // Create SetupIntent
    const stripeRes = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customer.stripe_customer_id,
        'payment_method_types[]': 'card',
        usage: 'off_session',
        'metadata[source]': 'aleksa-ai-app',
      }),
    })
    if (!stripeRes.ok) {
      const detail = await stripeRes.text()
      return json({ error: 'setup_intent_creation_failed', detail }, 500)
    }
    const setupIntent = await stripeRes.json()

    return json({
      ok: true,
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
      publishable_key: Deno.env.get('STRIPE_PUBLISHABLE_KEY')!,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
