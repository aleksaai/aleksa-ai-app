// admin-get-voice Edge Function
// Fetches a single voice by ID. Platform-aware: ElevenLabs + Retell AI.

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
    const integration_id = (body.integration_id ?? '').toString().trim()
    const voice_id = (body.voice_id ?? '').toString().trim()
    if (!integration_id || !voice_id) {
      return json({ error: 'missing_params', detail: 'integration_id + voice_id required' }, 400)
    }

    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('id, api_key, platform, region')
      .eq('id', integration_id)
      .maybeSingle()
    if (!integration) return json({ error: 'integration_not_found' }, 404)

    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || !profile.customer_id) {
        return json({ error: 'forbidden' }, 403)
      }
      const { data: agent } = await supabaseAdmin
        .from('voice_agents')
        .select('id')
        .eq('customer_id', profile.customer_id)
        .eq('integration_id', integration_id)
        .limit(1)
        .maybeSingle()
      if (!agent) return json({ error: 'forbidden' }, 403)
    }

    // ─── ElevenLabs ─────────────────────────────────────────────
    if (integration.platform === 'elevenlabs') {
      const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voice_id)}`, {
        headers: { 'xi-api-key': integration.api_key },
      })
      if (!res.ok) {
        if (res.status === 404) {
          return json({ error: 'voice_not_found', detail: 'Diese Voice-ID existiert nicht in deinem Account.' }, 404)
        }
        return json({ error: 'elevenlabs_fetch_failed', detail: await res.text() }, res.status)
      }
      const v = await res.json()
      const labels: Record<string, string> = {}
      if (v.labels && typeof v.labels === 'object') {
        for (const [k, val] of Object.entries(v.labels)) {
          if (typeof val === 'string') labels[k] = val
        }
      }
      return json({
        ok: true,
        voice: {
          voice_id: v.voice_id,
          name: v.name ?? 'Unbenannte Stimme',
          labels,
          preview_url: v.preview_url ?? null,
          category: v.category ?? null,
        },
      })
    }

    // ─── Retell AI ──────────────────────────────────────────────
    // Retell has no GET-by-id endpoint for voices, so we list and filter.
    if (integration.platform === 'retellai') {
      const res = await fetch('https://api.retellai.com/list-voices', {
        headers: { Authorization: `Bearer ${integration.api_key}` },
      })
      if (!res.ok) return json({ error: 'retell_fetch_failed', detail: await res.text() }, res.status)
      const list = await res.json()
      const v = (Array.isArray(list) ? list : []).find((x: any) => x.voice_id === voice_id)
      if (!v) {
        return json({ error: 'voice_not_found', detail: 'Diese Voice-ID existiert nicht in der Retell-Liste.' }, 404)
      }
      return json({
        ok: true,
        voice: {
          voice_id: v.voice_id,
          name: v.voice_name ?? v.voice_id,
          labels: {
            ...(v.provider ? { provider: v.provider } : {}),
            ...(v.gender ? { gender: v.gender } : {}),
            ...(v.accent ? { accent: v.accent } : {}),
            ...(v.age ? { age: v.age } : {}),
          },
          preview_url: v.preview_audio_url ?? null,
          category: v.provider ?? null,
        },
      })
    }

    return json({ error: 'platform_not_supported', platform: integration.platform }, 501)
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
