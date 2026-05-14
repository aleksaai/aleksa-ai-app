// update-customer-business Edge Function
// Sets a business name on the Stripe Customer + attaches an EU VAT ID for
// Reverse-Charge handling (0% MwSt on cross-border B2B).
//
// Called by Onboarding.tsx after the user fills out business details, BEFORE
// confirmSetup runs — so the tax_id is already on the customer when Stripe
// Tax later computes the rate for the first subscription invoice.

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

async function stripeForm(path: string, key: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Stripe ${path}: ${res.status}`)
  }
  return body
}

// Validate basic EU VAT ID shape (Stripe revalidates via VIES anyway, but
// catching obvious typos early gives the user a faster feedback loop).
function looksLikeEuVat(id: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(id)
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
      .from('profiles').select('customer_id, role').eq('id', user.id).maybeSingle()
    if (!profile?.customer_id && profile?.role !== 'admin') {
      return json({ error: 'no_customer_linked' }, 400)
    }
    const customer_id = profile.customer_id!
    const { data: customer } = await supabaseAdmin
      .from('customers').select('stripe_customer_id').eq('id', customer_id).maybeSingle()
    if (!customer?.stripe_customer_id) return json({ error: 'no_stripe_customer' }, 400)

    const body = await req.json().catch(() => ({}))
    const businessName = (body.business_name ?? '').toString().trim()
    const vatId = (body.vat_id ?? '').toString().trim().toUpperCase().replace(/\s+/g, '')

    if (!businessName && !vatId) {
      return json({ error: 'nothing_to_update' }, 400)
    }

    // 1. Set business name on Stripe Customer (replaces personal name)
    if (businessName) {
      await stripeForm(`/customers/${customer.stripe_customer_id}`, STRIPE_SECRET_KEY, {
        name: businessName,
      })
    }

    // 2. Attach EU VAT ID
    let vatId_result: { id: string; verification_status?: string } | null = null
    if (vatId) {
      if (!looksLikeEuVat(vatId)) {
        return json({ error: 'vat_id_invalid_format', detail: 'Erwartet z.B. DE123456789 (Ländercode + Zahlen)' }, 400)
      }
      try {
        const created = await stripeForm(`/customers/${customer.stripe_customer_id}/tax_ids`, STRIPE_SECRET_KEY, {
          type: 'eu_vat',
          value: vatId,
        })
        vatId_result = {
          id: created.id,
          verification_status: created.verification?.status,
        }
      } catch (e) {
        return json({
          error: 'vat_id_rejected_by_stripe',
          detail: e instanceof Error ? e.message : String(e),
        }, 400)
      }
    }

    return json({
      ok: true,
      business_name: businessName || null,
      vat_id: vatId_result,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
