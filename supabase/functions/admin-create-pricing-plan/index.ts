// admin-create-pricing-plan Edge Function
// Creates a Stripe Product + Price(s) for one of the three pricing modes,
// then inserts a pricing_plans row.
//
// Three modes:
//   1. "hybrid"     — flat recurring + tiered metered overage (z.B. 200€/m + 100 min frei + 30ct/min)
//   2. "per_minute" — pure metered (z.B. 18ct/min, billed monthly)
//   3. "one_time"   — single charge (z.B. 300€ einmalig)
//
// All resulting Stripe products + prices get metadata.source = "aleksa-ai-app"
// so Lisa can filter them from KI-Schule charges in Account 1.

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

type Mode = 'hybrid' | 'per_minute' | 'one_time'

type CreateInput = {
  name: string
  type: Mode
  currency: string // 'EUR' | 'USD' | ...
  billing_interval?: 'month' | 'year' | 'one_time'
  flat_amount_cents?: number
  included_minutes?: number
  per_minute_overage_cents?: number
}

// Pin Stripe API version to pre-Meters-Era to keep the legacy
// `recurring.usage_type: metered` + usage_records flow working.
// Migration to the new Meters API is V1 material (see SPEC.md V1.5).
const STRIPE_API_VERSION = '2024-12-18.acacia'

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

    // Verify admin
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

    // Parse input
    const body = (await req.json().catch(() => ({}))) as Partial<CreateInput>
    const name = (body.name ?? '').toString().trim()
    const type = body.type as Mode
    const currency = (body.currency ?? 'EUR').toString().toLowerCase()
    const billingInterval =
      body.billing_interval ?? (type === 'one_time' ? 'one_time' : 'month')

    if (!name) return json({ error: 'name_required' }, 400)
    if (!['hybrid', 'per_minute', 'one_time'].includes(type)) {
      return json({ error: 'invalid_type' }, 400)
    }

    // Mode-specific validation
    if (type === 'hybrid') {
      if (
        body.flat_amount_cents == null ||
        body.included_minutes == null ||
        body.per_minute_overage_cents == null
      ) {
        return json(
          { error: 'hybrid_requires_flat_included_overage' },
          400
        )
      }
    } else if (type === 'per_minute') {
      if (body.per_minute_overage_cents == null) {
        return json({ error: 'per_minute_requires_per_minute_overage_cents' }, 400)
      }
    } else if (type === 'one_time') {
      if (body.flat_amount_cents == null) {
        return json({ error: 'one_time_requires_flat_amount' }, 400)
      }
    }

    // 1. Create Stripe Product
    const product = await stripeForm('/products', STRIPE_SECRET_KEY, {
      name,
      'metadata[source]': 'aleksa-ai-app',
      'metadata[type]': type,
    })

    // 2. Create Stripe Price(s) per mode
    let stripeFlatPriceId: string | null = null
    let stripeMeteredPriceId: string | null = null

    if (type === 'hybrid') {
      // Flat recurring price
      const flatPrice = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.flat_amount_cents!),
        currency,
        'recurring[interval]': billingInterval as string,
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'flat',
      })
      stripeFlatPriceId = flatPrice.id

      // Tiered metered price: tier 1 = up to included_minutes free, tier 2 = per_minute_overage
      const meteredPrice = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        currency,
        billing_scheme: 'tiered',
        tiers_mode: 'graduated',
        'tiers[0][up_to]': String(body.included_minutes!),
        'tiers[0][flat_amount]': '0',
        'tiers[1][up_to]': 'inf',
        'tiers[1][unit_amount]': String(body.per_minute_overage_cents!),
        'recurring[interval]': billingInterval as string,
        'recurring[usage_type]': 'metered',
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'metered',
      })
      stripeMeteredPriceId = meteredPrice.id
    } else if (type === 'per_minute') {
      // Pure metered, no tier — just per-unit pricing
      const meteredPrice = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.per_minute_overage_cents!),
        currency,
        'recurring[interval]': billingInterval as string,
        'recurring[usage_type]': 'metered',
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'metered',
      })
      stripeMeteredPriceId = meteredPrice.id
    } else if (type === 'one_time') {
      const onceP = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.flat_amount_cents!),
        currency,
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'one_time',
      })
      stripeFlatPriceId = onceP.id
    }

    // 3. Insert pricing_plans row
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('pricing_plans')
      .insert({
        name,
        type,
        flat_amount_cents: body.flat_amount_cents ?? null,
        included_minutes: body.included_minutes ?? null,
        per_minute_overage_cents: body.per_minute_overage_cents ?? null,
        currency: currency.toUpperCase(),
        billing_interval: billingInterval,
        stripe_product_id: product.id,
        stripe_flat_price_id: stripeFlatPriceId,
        stripe_metered_price_id: stripeMeteredPriceId,
      })
      .select()
      .single()
    if (planErr) return json({ error: 'plan_insert_failed', detail: planErr.message }, 500)

    return json({
      ok: true,
      plan,
      stripe_product_id: product.id,
      stripe_flat_price_id: stripeFlatPriceId,
      stripe_metered_price_id: stripeMeteredPriceId,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
