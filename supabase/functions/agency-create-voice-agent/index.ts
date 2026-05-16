// agency-create-voice-agent (Multi-Tenant Phase E voll)
// Partner assigns an existing platform agent (ElevenLabs/Retell) to one of
// their customers. Both customer and integration must be scoped to the
// partner's agency (verified via agency_id checks).

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
    const customer_id = (body.customer_id ?? '').toString().trim()
    const integration_id = (body.integration_id ?? '').toString().trim()
    const platform_agent_id = (body.platform_agent_id ?? '').toString().trim()
    const platform_phone_number_id = body.platform_phone_number_id?.toString().trim() || null
    const display_name = body.display_name?.toString().trim() || null

    if (!customer_id) return json({ error: 'customer_id_required' }, 400)
    if (!integration_id) return json({ error: 'integration_id_required' }, 400)
    if (!platform_agent_id) return json({ error: 'platform_agent_id_required' }, 400)

    // Verify customer belongs to partner's agency
    const { data: customer } = await sbAdmin
      .from('customers').select('id, agency_id').eq('id', customer_id).maybeSingle()
    if (!customer) return json({ error: 'customer_not_found' }, 404)
    if (customer.agency_id !== profile.agency_id) return json({ error: 'customer_not_in_your_agency' }, 403)

    // Verify integration is accessible: either belongs to partner's agency or is global (agency_id=NULL platform-wide)
    const { data: integration } = await sbAdmin
      .from('integrations').select('id, active, agency_id').eq('id', integration_id).maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (!integration.active) return json({ error: 'integration_inactive' }, 400)
    if (integration.agency_id !== null && integration.agency_id !== profile.agency_id) {
      return json({ error: 'integration_not_accessible' }, 403)
    }

    const { data: agent, error: agentErr } = await sbAdmin
      .from('voice_agents')
      .insert({
        customer_id,
        integration_id,
        platform_agent_id,
        platform_phone_number_id,
        display_name,
        active: true,
      })
      .select()
      .single()
    if (agentErr) {
      if (agentErr.code === '23505') {
        return json({ error: 'agent_already_registered' }, 409)
      }
      return json({ error: 'agent_insert_failed', detail: agentErr.message }, 500)
    }

    return json({ ok: true, agent })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
