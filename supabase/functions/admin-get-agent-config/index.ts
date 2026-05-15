// admin-get-agent-config Edge Function
// Returns the live agent configuration (prompt, voice, language, models, …)
// normalised across ElevenLabs and Retell AI.

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

    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || agent.customer_id !== profile.customer_id) {
        return json({ error: 'forbidden' }, 403)
      }
    }

    const integration = (agent as any).integrations
    if (!integration) return json({ error: 'no_integration' }, 400)

    // ─── ElevenLabs ─────────────────────────────────────────────
    if (integration.platform === 'elevenlabs') {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${agent.platform_agent_id}`,
        { headers: { 'xi-api-key': integration.api_key } },
      )
      if (!res.ok) return json({ error: 'elevenlabs_fetch_failed', detail: await res.text() }, 500)
      const cfg = await res.json()
      const agentCfg = cfg.conversation_config?.agent ?? {}
      const ttsCfg = cfg.conversation_config?.tts ?? {}
      const promptCfg = agentCfg.prompt ?? {}
      return json({
        ok: true,
        platform: 'elevenlabs',
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
        language_presets: cfg.conversation_config?.language_presets ?? {},
        knowledge_base: promptCfg.knowledge_base ?? [],
        rag_enabled: promptCfg.rag?.enabled ?? false,
      })
    }

    // ─── Retell AI ──────────────────────────────────────────────
    if (integration.platform === 'retellai') {
      // 1. Get the agent
      const aRes = await fetch(
        `https://api.retellai.com/get-agent/${agent.platform_agent_id}`,
        { headers: { Authorization: `Bearer ${integration.api_key}` } },
      )
      if (!aRes.ok) return json({ error: 'retell_agent_fetch_failed', detail: await aRes.text() }, 500)
      const ag = await aRes.json()

      // 2. If the agent uses a Retell LLM (not a custom external LLM),
      //    fetch the LLM resource to expose prompt + model.
      let llmModel: string | null = null
      let llmPrompt = ''
      let llmId: string | null = null
      const respEngine = ag.response_engine ?? {}
      if (respEngine.type === 'retell-llm' && respEngine.llm_id) {
        llmId = respEngine.llm_id
        const lRes = await fetch(
          `https://api.retellai.com/get-retell-llm/${respEngine.llm_id}`,
          { headers: { Authorization: `Bearer ${integration.api_key}` } },
        )
        if (lRes.ok) {
          const ll = await lRes.json()
          llmModel = ll.model ?? null
          llmPrompt = ll.general_prompt ?? ''
        }
      }

      return json({
        ok: true,
        platform: 'retellai',
        agent_id: agent.platform_agent_id,
        name: ag.agent_name ?? null,
        prompt: llmPrompt,
        llm: llmModel,
        first_message: ag.begin_message ?? '',
        language: ag.language ?? null,
        voice_id: ag.voice_id ?? null,
        tts_model: ag.voice_model ?? null,
        stability: null,
        similarity_boost: ag.voice_temperature ?? null,
        language_presets: {},
        knowledge_base: [],
        rag_enabled: false,
        // Retell-specific extras so the frontend can patch back correctly
        retell_llm_id: llmId,
        retell_response_engine_type: respEngine.type ?? null,
      })
    }

    return json({ error: 'platform_not_supported', platform: integration.platform }, 501)
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
