// admin-update-agent-config Edge Function
// Patches ElevenLabs agent config for a voice_agent.
// Supported fields (all optional):
//   - prompt              → conversation_config.agent.prompt.prompt
//   - first_message       → conversation_config.agent.first_message
//   - voice_id            → conversation_config.tts.voice_id
//   - language            → conversation_config.agent.language
//   - tts_model_id        → conversation_config.tts.model_id
//   - llm_model_id        → conversation_config.agent.prompt.llm
//   - language_presets    → conversation_config.language_presets  (full replace)
//
// Uses PATCH /v1/convai/agents/{id} with the stored integration API key.

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
    const voice_agent_id = (body.voice_agent_id ?? '').toString().trim()
    if (!voice_agent_id) return json({ error: 'voice_agent_id_required' }, 400)

    const prompt = body.prompt as string | undefined
    const first_message = body.first_message as string | undefined
    const voice_id = body.voice_id as string | undefined
    const language = body.language as string | undefined
    const tts_model_id = body.tts_model_id as string | undefined
    const llm_model_id = body.llm_model_id as string | undefined
    const language_presets = body.language_presets as Record<string, unknown> | undefined

    const hasAny =
      prompt !== undefined ||
      first_message !== undefined ||
      voice_id !== undefined ||
      language !== undefined ||
      tts_model_id !== undefined ||
      llm_model_id !== undefined ||
      language_presets !== undefined
    if (!hasAny) return json({ error: 'nothing_to_update' }, 400)

    const { data: agent } = await supabaseAdmin
      .from('voice_agents')
      .select('customer_id, platform_agent_id, integrations(api_key, platform, region)')
      .eq('id', voice_agent_id)
      .maybeSingle()
    if (!agent) return json({ error: 'agent_not_found' }, 404)

    // Admin: full access. Customer-Owner: must own agent + have can_edit_agent_config permission.
    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || agent.customer_id !== profile.customer_id) {
        return json({ error: 'forbidden' }, 403)
      }
      const { data: perms } = await supabaseAdmin
        .from('customer_permissions').select('can_edit_agent_config').eq('customer_id', profile.customer_id).maybeSingle()
      if (!perms?.can_edit_agent_config) return json({ error: 'permission_denied', detail: 'can_edit_agent_config' }, 403)
    }

    const integration = (agent as any).integrations
    if (!integration) return json({ error: 'no_integration' }, 400)
    if (integration.platform !== 'elevenlabs') {
      return json({ error: 'platform_not_yet_supported', platform: integration.platform }, 501)
    }

    // Build conversation_config patch
    const conversationConfig: any = {}
    const agentSub: any = {}
    const promptSub: any = {}
    const ttsSub: any = {}

    if (prompt !== undefined) promptSub.prompt = prompt
    if (llm_model_id !== undefined) promptSub.llm = llm_model_id
    if (Object.keys(promptSub).length > 0) agentSub.prompt = promptSub

    if (first_message !== undefined) agentSub.first_message = first_message
    if (language !== undefined) agentSub.language = language

    if (Object.keys(agentSub).length > 0) conversationConfig.agent = agentSub

    if (voice_id !== undefined) ttsSub.voice_id = voice_id
    if (tts_model_id !== undefined) ttsSub.model_id = tts_model_id
    if (Object.keys(ttsSub).length > 0) conversationConfig.tts = ttsSub

    if (language_presets !== undefined) {
      conversationConfig.language_presets = language_presets
    }

    const base = elevenlabsBase(integration.region)
    const res = await fetch(`${base}/v1/convai/agents/${agent.platform_agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': integration.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation_config: conversationConfig }),
    })

    if (!res.ok) {
      return json({ error: 'elevenlabs_patch_failed', detail: await res.text() }, res.status)
    }
    const updated = await res.json()
    return json({ ok: true, agent_id: agent.platform_agent_id, updated_at: updated.metadata?.updated_at_unix_secs ?? null })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
