// agency-list-platform-agents (Multi-Tenant Phase E voll)
// Lists platform agents (from ElevenLabs/Retell API) for a given integration,
// scoped to integrations the partner has access to (own agency OR global).
// Forwards to existing admin-list-platform-agents internally — same logic,
// just with the agency_owner permission gate instead of admin-only.

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

type ListedAgent = {
  platform_agent_id: string
  name: string
  platform_phone_number_id?: string
  phone_number_e164?: string
}

async function listElevenLabsAgents(apiKey: string, region: string): Promise<ListedAgent[]> {
  const base = region === 'eu' ? 'https://api.eu.elevenlabs.io' : 'https://api.elevenlabs.io'
  const headers = { 'xi-api-key': apiKey }
  const [agentsRes, phonesRes] = await Promise.all([
    fetch(`${base}/v1/convai/agents`, { headers }),
    fetch(`${base}/v1/convai/phone-numbers`, { headers }),
  ])
  if (!agentsRes.ok) throw new Error(`elevenlabs_agents: ${agentsRes.status}`)
  const agentsBody = await agentsRes.json()
  const phonesBody = phonesRes.ok ? await phonesRes.json() : { phone_numbers: [] }
  const phoneByAgent: Record<string, { id: string; number: string }> = {}
  for (const p of phonesBody.phone_numbers ?? []) {
    if (p.assigned_agent?.agent_id) {
      phoneByAgent[p.assigned_agent.agent_id] = { id: p.phone_number_id, number: p.phone_number }
    }
  }
  return (agentsBody.agents ?? []).map((a: any) => ({
    platform_agent_id: a.agent_id,
    name: a.name ?? a.agent_id,
    platform_phone_number_id: phoneByAgent[a.agent_id]?.id,
    phone_number_e164: phoneByAgent[a.agent_id]?.number,
  }))
}

async function listRetellAgents(apiKey: string): Promise<ListedAgent[]> {
  const res = await fetch('https://api.retellai.com/list-agents', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`retell_agents: ${res.status}`)
  const body = await res.json()
  return (Array.isArray(body) ? body : body.agents ?? []).map((a: any) => ({
    platform_agent_id: a.agent_id,
    name: a.agent_name ?? a.name ?? a.agent_id,
  }))
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
    const integration_id = (body.integration_id ?? '').toString().trim()
    if (!integration_id) return json({ error: 'integration_id_required' }, 400)

    const { data: integration } = await sbAdmin
      .from('integrations')
      .select('id, name, platform, region, api_key, agency_id, active')
      .eq('id', integration_id)
      .maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (integration.agency_id !== null && integration.agency_id !== profile.agency_id) {
      return json({ error: 'integration_not_accessible' }, 403)
    }
    if (!integration.active) return json({ error: 'integration_inactive' }, 400)

    let agents: ListedAgent[] = []
    try {
      if (integration.platform === 'elevenlabs') {
        agents = await listElevenLabsAgents(integration.api_key, integration.region ?? 'us')
      } else if (integration.platform === 'retellai') {
        agents = await listRetellAgents(integration.api_key)
      } else {
        return json({ error: 'platform_not_supported_yet', detail: `${integration.platform} kommt später` }, 400)
      }
    } catch (e) {
      return json({ error: 'provider_call_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
    }

    return json({
      ok: true,
      agents,
      integration: { id: integration.id, name: integration.name, platform: integration.platform, region: integration.region },
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
