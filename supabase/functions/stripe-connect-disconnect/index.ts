// stripe-connect-disconnect (Multi-Tenant Phase G)
//
// Partner-initiated revoke. Calls Stripe Connect OAuth deauthorize endpoint
// with the platform's STRIPE_SECRET_KEY + STRIPE_CONNECT_CLIENT_ID + the
// agency's stripe_connect_account_id, then clears the fields on the agency.

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

    const { data: agency } = await sbAdmin
      .from('agencies')
      .select('stripe_connect_account_id')
      .eq('id', profile.agency_id)
      .maybeSingle()
    if (!agency?.stripe_connect_account_id) {
      // Nothing to disconnect — just mark status
      await sbAdmin
        .from('agencies')
        .update({ stripe_connect_status: 'disconnected' })
        .eq('id', profile.agency_id)
      return json({ ok: true, message: 'no_connection_to_revoke' })
    }

    const clientId = Deno.env.get('STRIPE_CONNECT_CLIENT_ID')
    let stripeRevokeError: string | null = null
    if (clientId) {
      const r = await fetch('https://connect.stripe.com/oauth/deauthorize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          stripe_user_id: agency.stripe_connect_account_id,
        }),
      })
      if (!r.ok) {
        const detail = await r.text()
        stripeRevokeError = `${r.status}: ${detail.slice(0, 200)}`
        // Continue anyway — we still clear our local record. Partner can clean
        // up the lingering authorization in their Stripe Dashboard manually.
      }
    } else {
      stripeRevokeError = 'STRIPE_CONNECT_CLIENT_ID missing in Edge Function env — local record cleared but Stripe-side authorization may still exist'
    }

    await sbAdmin
      .from('agencies')
      .update({
        stripe_connect_account_id: null,
        stripe_connect_status: 'disconnected',
      })
      .eq('id', profile.agency_id)

    return json({
      ok: true,
      stripe_revoke_error: stripeRevokeError,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
