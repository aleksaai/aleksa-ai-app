// admin-update-agent-config Edge Function
// Patches agent configuration. Platform-aware: ElevenLabs + Retell AI.
//
// Common body fields (all optional):
//   - prompt              → ElevenLabs: agent.prompt.prompt
//                           Retell:     retell-llm.general_prompt (separate PATCH)
//   - first_message       → ElevenLabs: agent.first_message
//                           Retell:     agent.begin_message
//   - voice_id            → ElevenLabs: tts.voice_id
//                           Retell:     agent.voice_id
//   - language            → ElevenLabs: agent.language (e.g. "de")
//                           Retell:     agent.language  (e.g. "de-DE")
//   - tts_model_id        → ElevenLabs: tts.model_id
//                           Retell:     agent.voice_model
//   - llm_model_id        → ElevenLabs: agent.prompt.llm
//                           Retell:     retell-llm.model (separate PATCH)
//   - language_presets    → ElevenLabs only

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

    // ─── ElevenLabs ─────────────────────────────────────────────
    if (integration.platform === 'elevenlabs') {
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
      if (language_presets !== undefined) conversationConfig.language_presets = language_presets

      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${agent.platform_agent_id}`,
        {
          method: 'PATCH',
          headers: {
            'xi-api-key': integration.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversation_config: conversationConfig }),
        },
      )
      if (!res.ok) return json({ error: 'elevenlabs_patch_failed', detail: await res.text() }, res.status)
      const updated = await res.json()
      return json({ ok: true, platform: 'elevenlabs', agent_id: agent.platform_agent_id, updated_at: updated.metadata?.updated_at_unix_secs ?? null })
    }

    // ─── Retell AI ──────────────────────────────────────────────
    if (integration.platform === 'retellai') {
      const errors: string[] = []

      // Agent-level fields
      const agentPatch: any = {}
      if (voice_id !== undefined) agentPatch.voice_id = voice_id
      if (tts_model_id !== undefined) agentPatch.voice_model = tts_model_id
      if (language !== undefined) agentPatch.language = language
      if (first_message !== undefined) agentPatch.begin_message = first_message

      if (Object.keys(agentPatch).length > 0) {
        const res = await fetch(
          `https://api.retellai.com/update-agent/${agent.platform_agent_id}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${integration.api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentPatch),
          },
        )
        if (!res.ok) errors.push(`agent: ${await res.text()}`)
      }

      // LLM-level fields (prompt + model) — only if the agent uses retell-llm
      if (prompt !== undefined || llm_model_id !== undefined) {
        const aRes = await fetch(
          `https://api.retellai.com/get-agent/${agent.platform_agent_id}`,
          { headers: { Authorization: `Bearer ${integration.api_key}` } },
        )
        if (!aRes.ok) {
          errors.push(`agent_lookup_for_llm: ${await aRes.text()}`)
        } else {
          const ag = await aRes.json()
          const re = ag.response_engine ?? {}
          if (re.type === 'retell-llm' && re.llm_id) {
            const llmPatch: any = {}
            if (prompt !== undefined) llmPatch.general_prompt = prompt
            if (llm_model_id !== undefined) llmPatch.model = llm_model_id
            const lRes = await fetch(
              `https://api.retellai.com/update-retell-llm/${re.llm_id}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${integration.api_key}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(llmPatch),
              },
            )
            if (!lRes.ok) errors.push(`retell_llm: ${await lRes.text()}`)
          } else {
            errors.push('retell_llm_not_used: prompt/model cannot be patched via Retell because this agent uses a custom external LLM.')
          }
        }
      }

      if (language_presets !== undefined) {
        // Not supported on Retell — just ignore silently rather than failing.
      }

      if (errors.length > 0) {
        return json({ error: 'retell_patch_partial_or_failed', detail: errors.join(' | ') }, 500)
      }
      return json({ ok: true, platform: 'retellai', agent_id: agent.platform_agent_id })
    }

    return json({ error: 'platform_not_supported', platform: integration.platform }, 501)
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
