// admin-list-platform-agents Edge Function
// Given an integration_id, fetches the list of voice-agents from the
// provider's API (using the integration's API key, server-side) and merges
// in any assigned phone numbers.
//
// Supported platforms (MVP):
//   - elevenlabs:  GET /v1/convai/agents  +  GET /v1/convai/phone-numbers
//
// Returns: { ok: true, agents: [{platform_agent_id, name, platform_phone_number_id?, phone_number_e164?}] }

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

// Frontend stores region per Aleksa's choice, but until we move to ElevenLabs
// Enterprise we always hit the US base URL.
function elevenlabsBase(_region: string | null): string {
  // To switch on Enterprise:
  //   return _region === 'eu' ? 'https://api.eu.residency.elevenlabs.io' : 'https://api.elevenlabs.io'
  return 'https://api.elevenlabs.io'
}

type ListedAgent = {
  platform_agent_id: string
  name: string
  platform_phone_number_id?: string
  phone_number_e164?: string
}

async function listElevenLabsAgents(apiKey: string, region: string | null): Promise<ListedAgent[]> {
  const base = elevenlabsBase(region)

  // List agents + phone numbers in parallel
  const [agentsRes, phonesRes] = await Promise.all([
    fetch(`${base}/v1/convai/agents`, { headers: { 'xi-api-key': apiKey } }),
    fetch(`${base}/v1/convai/phone-numbers`, { headers: { 'xi-api-key': apiKey } }),
  ])

  if (!agentsRes.ok) {
    throw new Error(`ElevenLabs list agents failed: ${agentsRes.status} ${await agentsRes.text()}`)
  }
  // Phone numbers endpoint can return 404 if account never had any — treat as empty
  const phoneList = phonesRes.ok ? (await phonesRes.json()) : []

  const agentsBody = await agentsRes.json()
  const rawAgents: any[] = agentsBody.agents ?? []

  // Build phone-number lookup keyed by assigned agent_id
  // ElevenLabs response shape: array of {phone_number_id, phone_number, assigned_agent: {agent_id, ...} | null}
  const phoneByAgent = new Map<string, { phone_number_id: string; phone_number: string }>()
  const phones: any[] = Array.isArray(phoneList) ? phoneList : (phoneList.phone_numbers ?? [])
  for (const p of phones) {
    const assignedId = p?.assigned_agent?.agent_id
    if (assignedId) {
      phoneByAgent.set(assignedId, {
        phone_number_id: p.phone_number_id,
        phone_number: p.phone_number,
      })
    }
  }

  return rawAgents.map((a) => {
    const phone = phoneByAgent.get(a.agent_id)
    return {
      platform_agent_id: a.agent_id,
      name: a.name ?? a.agent_id,
      platform_phone_number_id: phone?.phone_number_id,
      phone_number_e164: phone?.phone_number,
    }
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

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'admin_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const integration_id = (body.integration_id ?? '').toString().trim()
    if (!integration_id) return json({ error: 'integration_id_required' }, 400)

    const { data: integration } = await supabaseAdmin
      .from('integrations').select('*').eq('id', integration_id).maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (!integration.active) return json({ error: 'integration_inactive' }, 400)

    let agents: ListedAgent[] = []
    if (integration.platform === 'elevenlabs') {
      agents = await listElevenLabsAgents(integration.api_key, integration.region)
    } else {
      return json({ error: 'platform_not_yet_supported', platform: integration.platform }, 501)
    }

    return json({ ok: true, agents, integration: { id: integration.id, name: integration.name, platform: integration.platform, region: integration.region } })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
