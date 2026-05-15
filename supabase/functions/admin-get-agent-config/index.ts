// admin-get-agent-config Edge Function
// Fetches the live ElevenLabs configuration for a voice_agent (prompt, first_message,
// voice_id, llm, etc.) using the stored integration API key (server-side).

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
  // Switch to api.eu.residency.elevenlabs.io once Enterprise upgrade happens.
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
    const voice_agent_id = (body.voice_agent_id ?? '').toString().trim()
    if (!voice_agent_id) return json({ error: 'voice_agent_id_required' }, 400)

    const { data: agent } = await supabaseAdmin
      .from('voice_agents')
      .select('*, integrations(api_key, platform, region)')
      .eq('id', voice_agent_id)
      .maybeSingle()
    if (!agent) return json({ error: 'agent_not_found' }, 404)

    // Admin can read any agent; customer_owner only their own (read is permission-free,
    // but they must own the agent)
    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || agent.customer_id !== profile.customer_id) {
        return json({ error: 'forbidden' }, 403)
      }
    }

    const integration = (agent as any).integrations
    if (!integration) return json({ error: 'no_integration' }, 400)
    if (integration.platform !== 'elevenlabs') {
      return json({ error: 'platform_not_yet_supported', platform: integration.platform }, 501)
    }

    const base = elevenlabsBase(integration.region)
    const res = await fetch(`${base}/v1/convai/agents/${agent.platform_agent_id}`, {
      headers: { 'xi-api-key': integration.api_key },
    })
    if (!res.ok) {
      return json({ error: 'elevenlabs_fetch_failed', detail: await res.text() }, 500)
    }
    const cfg = await res.json()

    // Return the bits we expose in the UI
    const agentCfg = cfg.conversation_config?.agent ?? {}
    const ttsCfg = cfg.conversation_config?.tts ?? {}
    const promptCfg = agentCfg.prompt ?? {}
    return json({
      ok: true,
      agent_id: agent.platform_agent_id,
      name: cfg.name,
      prompt: promptCfg.prompt ?? '',
      llm: promptCfg.llm ?? null,
      first_message: agentCfg.first_message ?? '',
      language: agentCfg.language ?? null,
      voice_id: ttsCfg.voice_id ?? null,
      tts_model: ttsCfg.model_id ?? null,
      stability: ttsCfg.stability ?? null,
      similarity_boost: ttsCfg.similarity_boost ?? null,
      // Multi-language
      language_presets: cfg.conversation_config?.language_presets ?? {},
      // Knowledge Base
      knowledge_base: promptCfg.knowledge_base ?? [],
      rag_enabled: promptCfg.rag?.enabled ?? false,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
