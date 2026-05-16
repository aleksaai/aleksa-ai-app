// agency-create-integration (Multi-Tenant Phase E voll)
// Partner adds their own provider account (ElevenLabs / Retell / Vapi / OpenAI).
// agency_id is auto-set from caller's profile.

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

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('role, agency_id').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'agency_owner') return json({ error: 'agency_owner_only' }, 403)
    if (!profile.agency_id) return json({ error: 'no_agency_assigned' }, 403)

    const body = await req.json().catch(() => ({}))
    const name = (body.name ?? '').toString().trim()
    const platform = (body.platform ?? '').toString().trim()
    const api_key = (body.api_key ?? '').toString().trim()
    const region = body.region ? body.region.toString().trim() : null
    const vapi_public_key = body.vapi_public_key ? body.vapi_public_key.toString().trim() : null

    if (!name) return json({ error: 'name_required' }, 400)
    if (!['elevenlabs', 'retellai', 'vapi', 'openai'].includes(platform)) {
      return json({ error: 'invalid_platform' }, 400)
    }
    if (!api_key) return json({ error: 'api_key_required' }, 400)
    if (platform === 'elevenlabs' && region && !['us', 'eu'].includes(region)) {
      return json({ error: 'invalid_region', detail: 'must be us or eu' }, 400)
    }
    if (platform === 'vapi' && !vapi_public_key) {
      return json({ error: 'vapi_public_key_required' }, 400)
    }

    const { data: integration, error: insErr } = await sbAdmin
      .from('integrations')
      .insert({
        name,
        platform,
        api_key,
        region: platform === 'elevenlabs' ? (region ?? 'us') : null,
        vapi_public_key: platform === 'vapi' ? vapi_public_key : null,
        agency_id: profile.agency_id,
        active: true,
      })
      .select('id, name, platform, region, active, created_at')
      .single()
    if (insErr) return json({ error: 'integration_insert_failed', detail: insErr.message }, 500)

    return json({ ok: true, integration })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
