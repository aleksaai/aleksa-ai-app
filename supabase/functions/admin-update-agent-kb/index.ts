// admin-update-agent-kb Edge Function
// Patches an ElevenLabs agent's knowledge_base array + rag.enabled flag.
// Replaces the full list (not append) — frontend computes the desired final state.

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

type KBEntry = {
  id: string
  name: string
  type: 'text' | 'file' | 'url'
  usage_mode?: 'auto' | 'prompt'
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
    const kb_entries = body.knowledge_base as KBEntry[] | undefined
    const rag_enabled = body.rag_enabled as boolean | undefined

    if (!voice_agent_id) return json({ error: 'voice_agent_id_required' }, 400)
    if (!Array.isArray(kb_entries)) return json({ error: 'knowledge_base_must_be_array' }, 400)

    const { data: agent } = await supabaseAdmin
      .from('voice_agents')
      .select('customer_id, platform_agent_id, integrations(api_key, platform, region)')
      .eq('id', voice_agent_id)
      .maybeSingle()
    if (!agent) return json({ error: 'agent_not_found' }, 404)

    // Admin OR (customer_owner of agent + can_edit_kb)
    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || agent.customer_id !== profile.customer_id) {
        return json({ error: 'forbidden' }, 403)
      }
      const { data: perms } = await supabaseAdmin
        .from('customer_permissions').select('can_edit_kb').eq('customer_id', profile.customer_id).maybeSingle()
      if (!perms?.can_edit_kb) return json({ error: 'permission_denied' }, 403)
    }

    const integration = (agent as any).integrations
    if (!integration) return json({ error: 'no_integration' }, 400)
    if (integration.platform !== 'elevenlabs') return json({ error: 'platform_not_yet_supported' }, 501)

    // Normalize entries: ensure usage_mode set
    const normalized = kb_entries.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type ?? 'text',
      usage_mode: e.usage_mode ?? 'auto',
    }))

    // Build patch — replaces the whole prompt.knowledge_base + sets rag.enabled
    const promptPatch: any = { knowledge_base: normalized }
    if (rag_enabled !== undefined) {
      // ElevenLabs RAG config: use default embedding for now
      promptPatch.rag = rag_enabled
        ? { enabled: true, embedding_model: 'e5_mistral_7b_instruct', max_documents_length: 50000, max_vector_distance: 0.6, max_retrieved_rag_chunks_count: 20 }
        : { enabled: false }
    }

    const base = elevenlabsBase(integration.region)
    const res = await fetch(`${base}/v1/convai/agents/${agent.platform_agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': integration.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_config: {
          agent: { prompt: promptPatch },
        },
      }),
    })
    if (!res.ok) {
      return json({ error: 'elevenlabs_patch_failed', detail: await res.text() }, res.status)
    }
    return json({ ok: true, knowledge_base: normalized, rag_enabled: rag_enabled ?? null })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
