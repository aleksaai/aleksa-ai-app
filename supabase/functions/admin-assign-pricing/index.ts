// admin-assign-pricing Edge Function
// Assigns a Pricing-Plan to a Voice-Agent and starts a Stripe Subscription.
//
// Subscription items per pricing-plan-type:
//   - hybrid    → 2 items: flat recurring + tiered metered
//   - per_minute → 1 item: metered
//   - one_time   → not supported here (use separate invoice flow)
//
// Pins Stripe-Version 2024-12-18.acacia to keep legacy metered-without-meter flow working.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const STRIPE_API_VERSION = '2024-12-18.acacia'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

async function stripeForm(path: string, key: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: new URLSearchParams(params),
  })
  if (!res.ok) {
    throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  })
  if (!res.ok) throw new Error(`Stripe GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'admin_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const voice_agent_id = (body.voice_agent_id ?? '').toString().trim()
    const pricing_plan_id = (body.pricing_plan_id ?? '').toString().trim()
    if (!voice_agent_id || !pricing_plan_id) {
      return json({ error: 'voice_agent_id_and_pricing_plan_id_required' }, 400)
    }

    // Load agent + customer + plan
    const { data: agent } = await supabaseAdmin
      .from('voice_agents')
      .select('*, customers(id, stripe_customer_id, has_payment_method)')
      .eq('id', voice_agent_id)
      .maybeSingle()
    if (!agent) return json({ error: 'agent_not_found' }, 404)

    const customer = (agent as any).customers
    if (!customer?.stripe_customer_id) return json({ error: 'no_stripe_customer' }, 400)
    if (!customer.has_payment_method) {
      return json({ error: 'no_payment_method', detail: 'Customer hat noch keine Karte hinterlegt' }, 400)
    }

    const { data: plan } = await supabaseAdmin
      .from('pricing_plans')
      .select('*')
      .eq('id', pricing_plan_id)
      .maybeSingle()
    if (!plan) return json({ error: 'plan_not_found' }, 404)
    if (plan.type === 'one_time') {
      return json({ error: 'one_time_not_supported_as_subscription' }, 400)
    }

    // Check there's no existing active subscription for this agent
    const { data: existing } = await supabaseAdmin
      .from('customer_subscriptions')
      .select('id, status')
      .eq('voice_agent_id', voice_agent_id)
      .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
      .maybeSingle()
    if (existing) {
      return json({ error: 'subscription_already_exists', detail: `status: ${existing.status}` }, 409)
    }

    // Build subscription items
    const items: Array<Record<string, string>> = []
    if (plan.type === 'hybrid') {
      if (!plan.stripe_flat_price_id || !plan.stripe_metered_price_id) {
        return json({ error: 'plan_missing_stripe_prices' }, 500)
      }
      items.push({ price: plan.stripe_flat_price_id })
      items.push({ price: plan.stripe_metered_price_id })
    } else if (plan.type === 'per_minute' || plan.type === 'flat') {
      const priceId = plan.stripe_metered_price_id ?? plan.stripe_flat_price_id
      if (!priceId) return json({ error: 'plan_missing_stripe_prices' }, 500)
      items.push({ price: priceId })
    }

    // Create Stripe Subscription
    const params: Record<string, string> = {
      customer: customer.stripe_customer_id,
      'metadata[source]': 'aleksa-ai-app',
      'metadata[voice_agent_id]': voice_agent_id,
      'metadata[pricing_plan_id]': pricing_plan_id,
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'automatic_tax[enabled]': 'true',
    }
    items.forEach((item, idx) => {
      params[`items[${idx}][price]`] = item.price
    })

    const subscription = await stripeForm('/subscriptions', STRIPE_SECRET_KEY, params)

    // Find the metered subscription_item_id (the one we'll post usage to)
    let metered_item_id: string | null = null
    for (const item of subscription.items?.data ?? []) {
      const price = item.price
      if (price?.recurring?.usage_type === 'metered') {
        metered_item_id = item.id
        break
      }
    }

    // Insert customer_subscription row
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from('customer_subscriptions')
      .insert({
        customer_id: customer.id,
        voice_agent_id,
        pricing_plan_id,
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: metered_item_id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .select()
      .single()
    if (subErr) return json({ error: 'subscription_insert_failed', detail: subErr.message }, 500)

    // Also link the voice_agent to the pricing_plan
    await supabaseAdmin
      .from('voice_agents')
      .update({ pricing_plan_id })
      .eq('id', voice_agent_id)

    return json({
      ok: true,
      customer_subscription: subRow,
      stripe_subscription_id: subscription.id,
      stripe_status: subscription.status,
      metered_item_id,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
