// admin-create-kb-doc Edge Function
// Creates a text-based Knowledge Base document in ElevenLabs workspace.

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
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'admin_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const integration_id = (body.integration_id ?? '').toString().trim()
    const name = (body.name ?? '').toString().trim()
    const text = (body.text ?? '').toString()

    if (!integration_id) return json({ error: 'integration_id_required' }, 400)
    if (!name) return json({ error: 'name_required' }, 400)
    if (!text.trim()) return json({ error: 'text_required' }, 400)

    const { data: integration } = await supabaseAdmin
      .from('integrations').select('api_key, platform, region').eq('id', integration_id).maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)
    if (integration.platform !== 'elevenlabs') return json({ error: 'platform_not_yet_supported' }, 501)

    const base = elevenlabsBase(integration.region)
    const res = await fetch(`${base}/v1/convai/knowledge-base/text`, {
      method: 'POST',
      headers: {
        'xi-api-key': integration.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, text }),
    })
    if (!res.ok) {
      return json({ error: 'elevenlabs_kb_create_failed', detail: await res.text() }, res.status)
    }
    const created = await res.json()
    return json({
      ok: true,
      doc: { id: created.id, name: created.name, type: created.type ?? 'text' },
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
