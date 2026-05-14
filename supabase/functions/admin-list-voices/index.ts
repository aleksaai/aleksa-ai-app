// admin-list-voices Edge Function
// Lists available ElevenLabs voices for a given integration. Used by the
// Voice-Picker UI in the agent detail page.

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

function elevenlabsBase(_region: string | null): string {
  return 'https://api.elevenlabs.io'
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
      .from('profiles').select('role, customer_id').eq('id', user.id).maybeSingle()
    if (!profile) return json({ error: 'no_profile' }, 403)

    const body = await req.json().catch(() => ({}))
    const integration_id = (body.integration_id ?? '').toString().trim()
    if (!integration_id) return json({ error: 'integration_id_required' }, 400)

    // Customer-Owner: needs can_edit_agent_config AND must own a voice_agent using this integration
    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner') return json({ error: 'forbidden' }, 403)
      const { data: perms } = await supabaseAdmin
        .from('customer_permissions').select('can_edit_agent_config').eq('customer_id', profile.customer_id).maybeSingle()
      if (!perms?.can_edit_agent_config) return json({ error: 'permission_denied' }, 403)
      const { data: ownsAgent } = await supabaseAdmin
        .from('voice_agents').select('id').eq('integration_id', integration_id).eq('customer_id', profile.customer_id).limit(1)
      if (!ownsAgent || ownsAgent.length === 0) return json({ error: 'no_agent_using_integration' }, 403)
    }

    const { data: integration } = await supabaseAdmin
      .from('integrations').select('api_key, platform, region').eq('id', integration_id).maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (integration.platform !== 'elevenlabs') {
      return json({ error: 'platform_not_yet_supported' }, 501)
    }

    const base = elevenlabsBase(integration.region)
    const res = await fetch(`${base}/v1/voices`, {
      headers: { 'xi-api-key': integration.api_key },
    })
    if (!res.ok) {
      return json({ error: 'elevenlabs_voices_fetch_failed', detail: await res.text() }, 500)
    }
    const voicesBody = await res.json()
    const voices = (voicesBody.voices ?? []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels ?? {},
      preview_url: v.preview_url ?? null,
      category: v.category ?? null,
    }))
    return json({ ok: true, voices })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
