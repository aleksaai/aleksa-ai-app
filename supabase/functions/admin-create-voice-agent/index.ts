// admin-create-voice-agent Edge Function
// Adds a Voice Agent (ElevenLabs or RetellAI) to a customer.
// MVP: just persists the reference. Live sync to ElevenLabs/RetellAI API
// (prompt editing etc.) is V1.5+ material.

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
    const customer_id = (body.customer_id ?? '').toString().trim()
    const integration_id = (body.integration_id ?? '').toString().trim()
    const platform_agent_id = (body.platform_agent_id ?? '').toString().trim()
    const platform_phone_number_id = body.platform_phone_number_id?.toString().trim() || null
    const display_name = body.display_name?.toString().trim() || null

    if (!customer_id) return json({ error: 'customer_id_required' }, 400)
    if (!integration_id) return json({ error: 'integration_id_required' }, 400)
    if (!platform_agent_id) return json({ error: 'platform_agent_id_required' }, 400)

    // Verify customer + integration exist
    const { data: customer } = await supabaseAdmin
      .from('customers').select('id').eq('id', customer_id).maybeSingle()
    if (!customer) return json({ error: 'customer_not_found' }, 404)

    const { data: integration } = await supabaseAdmin
      .from('integrations').select('id, active').eq('id', integration_id).maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (!integration.active) return json({ error: 'integration_inactive' }, 400)

    // Insert voice_agent
    const { data: agent, error: agentErr } = await supabaseAdmin
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
        return json({ error: 'agent_already_registered', detail: 'dieser Agent ist bereits in dieser Integration registriert' }, 409)
      }
      return json({ error: 'agent_insert_failed', detail: agentErr.message }, 500)
    }

    return json({ ok: true, agent })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
