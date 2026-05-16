// stripe-connect-start (Multi-Tenant Phase G)
//
// Returns the Stripe Connect OAuth URL the partner needs to be redirected to.
// State carries agency_id + original origin (so callback page can bounce the
// partner back to their tenant subdomain after success).
//
// STRIPE_CONNECT_CLIENT_ID (the platform's ca_… ID from Stripe Connect
// settings) is read from Postgres Vault. If missing, returns a clear
// `vault_missing_stripe_connect_client_id` error so the UI can guide Aleksa.

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
    const APP_URL = Deno.env.get('APP_URL') ?? 'https://platform.openpenguin.de'

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

    const clientId = Deno.env.get('STRIPE_CONNECT_CLIENT_ID')
    if (!clientId) {
      return json({
        error: 'missing_stripe_connect_client_id',
        detail: 'STRIPE_CONNECT_CLIENT_ID muss als Edge Function Secret hinterlegt sein. Aleksa: Supabase Dashboard → Edge Functions → Secrets → New Secret. Name: STRIPE_CONNECT_CLIENT_ID, Value: ca_... aus Stripe Dashboard → Connect → Onboarding-Einstellungen.',
      }, 500)
    }
    if (!clientId.startsWith('ca_')) {
      return json({ error: 'invalid_stripe_connect_client_id', detail: 'Erwartet "ca_..." Format' }, 500)
    }

    // Optional: caller can pass the origin they're on (subdomain) so we redirect
    // them back after success.
    const body = await req.json().catch(() => ({}))
    const callerOrigin = (body.origin ?? '').toString().trim() || APP_URL

    // State carries agency_id + return origin
    const stateObj = { aid: profile.agency_id, origin: callerOrigin, n: crypto.randomUUID().slice(0, 8) }
    const state = btoa(JSON.stringify(stateObj))

    // Redirect target — fixed to platform host so it works regardless of tenant
    const redirectUri = `${APP_URL}/agency/settings/stripe-callback`

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: redirectUri,
      state,
    })
    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`

    return json({ ok: true, url, redirect_uri: redirectUri })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
