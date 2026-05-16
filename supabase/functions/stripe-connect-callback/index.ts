// stripe-connect-callback (Multi-Tenant Phase G)
//
// Called by the /agency/settings/stripe-callback page after Stripe redirects
// the partner back with ?code=&state=. Exchanges the code for a connected
// account ID, stores it on the agency, marks status='active', and returns
// the origin the partner came from so the page can bounce them home.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
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

    const body = await req.json().catch(() => ({}))
    const code = (body.code ?? '').toString().trim()
    const state = (body.state ?? '').toString().trim()
    if (!code || !state) return json({ error: 'code_and_state_required' }, 400)

    // Decode state, verify aid matches caller's agency_id
    let stateObj: { aid?: string; origin?: string; n?: string }
    try {
      stateObj = JSON.parse(atob(state))
    } catch {
      return json({ error: 'invalid_state' }, 400)
    }
    if (!stateObj.aid || stateObj.aid !== profile.agency_id) {
      return json({ error: 'state_agency_mismatch' }, 403)
    }

    // Exchange code for token
    const tokenResp = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_secret: STRIPE_SECRET_KEY,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokenBody = await tokenResp.json().catch(() => ({}))
    if (!tokenResp.ok) {
      return json({
        error: 'stripe_token_exchange_failed',
        detail: tokenBody?.error_description ?? tokenBody?.error ?? `HTTP ${tokenResp.status}`,
      }, 502)
    }

    const stripeUserId = tokenBody.stripe_user_id as string | undefined
    if (!stripeUserId) return json({ error: 'no_stripe_user_id_returned' }, 502)

    // Persist on agency
    const { error: updErr } = await sbAdmin
      .from('agencies')
      .update({
        stripe_connect_account_id: stripeUserId,
        stripe_connect_status: 'active',
      })
      .eq('id', profile.agency_id)
    if (updErr) return json({ error: 'agency_update_failed', detail: updErr.message }, 500)

    return json({
      ok: true,
      stripe_user_id: stripeUserId,
      origin: stateObj.origin ?? null,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
