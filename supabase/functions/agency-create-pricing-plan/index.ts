// agency-create-pricing-plan Edge Function (Multi-Tenant Phase 1c)
//
// Mirror of admin-create-pricing-plan but for agency_owner callers. Creates
// the Stripe Product + Price on the PARTNER's connected Stripe account using
// the `Stripe-Account` header — so the partner owns the resulting product and
// receives subscription revenue directly (NOT routed through the platform).
//
// Modes match the master: 'hybrid' | 'per_minute' | 'one_time'.
// Persisted plan row gets agency_id + stripe_account_id (= connected acct).

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
  currency: string
  billing_interval?: 'month' | 'year' | 'one_time'
  flat_amount_cents?: number
  included_minutes?: number
  per_minute_overage_cents?: number
}

const STRIPE_API_VERSION = '2024-12-18.acacia'

async function stripeForm(
  path: string,
  key: string,
  params: Record<string, string>,
  connectedAccount: string,
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
      'Stripe-Account': connectedAccount,
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

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('role, agency_id').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'agency_owner') return json({ error: 'agency_owner_only' }, 403)
    if (!profile.agency_id) return json({ error: 'no_agency_assigned' }, 403)

    // Need the connected Stripe account ID — without it, no product can be
    // created on the partner's behalf.
    const { data: agency } = await sbAdmin
      .from('agencies')
      .select('stripe_connect_account_id, stripe_connect_status')
      .eq('id', profile.agency_id)
      .maybeSingle()
    if (!agency?.stripe_connect_account_id || agency.stripe_connect_status !== 'active') {
      return json({
        error: 'stripe_not_connected',
        detail: 'Verbinde zuerst deinen Stripe-Account unter Einstellungen → Zahlungen.',
      }, 400)
    }
    const connectedAccount = agency.stripe_connect_account_id as string

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
    if (type === 'hybrid') {
      if (body.flat_amount_cents == null || body.included_minutes == null || body.per_minute_overage_cents == null) {
        return json({ error: 'hybrid_requires_flat_included_overage' }, 400)
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

    // 1. Stripe Product on the connected account
    const product = await stripeForm('/products', STRIPE_SECRET_KEY, {
      name,
      'metadata[source]': 'aleksa-ai-app',
      'metadata[type]': type,
      'metadata[agency_id]': profile.agency_id,
    }, connectedAccount)

    // 2. Stripe Price(s)
    let stripeFlatPriceId: string | null = null
    let stripeMeteredPriceId: string | null = null

    if (type === 'hybrid') {
      const flatPrice = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.flat_amount_cents!),
        currency,
        'recurring[interval]': billingInterval as string,
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'flat',
      }, connectedAccount)
      stripeFlatPriceId = flatPrice.id

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
      }, connectedAccount)
      stripeMeteredPriceId = meteredPrice.id
    } else if (type === 'per_minute') {
      const meteredPrice = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.per_minute_overage_cents!),
        currency,
        'recurring[interval]': billingInterval as string,
        'recurring[usage_type]': 'metered',
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'metered',
      }, connectedAccount)
      stripeMeteredPriceId = meteredPrice.id
    } else if (type === 'one_time') {
      const onceP = await stripeForm('/prices', STRIPE_SECRET_KEY, {
        product: product.id,
        unit_amount: String(body.flat_amount_cents!),
        currency,
        'metadata[source]': 'aleksa-ai-app',
        'metadata[kind]': 'one_time',
      }, connectedAccount)
      stripeFlatPriceId = onceP.id
    }

    // 3. Persist plan row scoped to agency
    const { data: plan, error: planErr } = await sbAdmin
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
        stripe_account_id: connectedAccount,
        agency_id: profile.agency_id,
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
