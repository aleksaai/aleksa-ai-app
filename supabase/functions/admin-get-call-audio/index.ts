// admin-get-call-audio Edge Function
// Proxies the audio file of a Conversational AI call from ElevenLabs.
// Streams the bytes back so the frontend <audio> tag can play directly
// (without exposing the ElevenLabs API key client-side).
//
// Permissions: admin OR customer_owner of the call's customer + can_view_audio.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonErr(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

function elevenlabsBase(_region: string | null): string {
  return 'https://api.elevenlabs.io'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonErr({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr({ error: 'missing_auth' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return jsonErr({ error: 'unauthorized' }, 401)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role, customer_id').eq('id', user.id).maybeSingle()
    if (!profile) return jsonErr({ error: 'no_profile' }, 403)

    const body = await req.json().catch(() => ({}))
    const call_id = (body.call_id ?? '').toString().trim()
    if (!call_id) return jsonErr({ error: 'call_id_required' }, 400)

    const { data: call } = await supabaseAdmin
      .from('calls')
      .select('elevenlabs_conversation_id, customer_id, voice_agents(integrations(api_key, platform, region))')
      .eq('id', call_id)
      .maybeSingle()
    if (!call) return jsonErr({ error: 'call_not_found' }, 404)

    // Permission check
    if (profile.role !== 'admin') {
      if (profile.role !== 'customer_owner' || call.customer_id !== profile.customer_id) {
        return jsonErr({ error: 'forbidden' }, 403)
      }
      const { data: perms } = await supabaseAdmin
        .from('customer_permissions').select('can_view_audio').eq('customer_id', profile.customer_id).maybeSingle()
      if (!perms?.can_view_audio) return jsonErr({ error: 'permission_denied' }, 403)
    }

    const integration = (call as any).voice_agents?.integrations
    if (!integration || integration.platform !== 'elevenlabs') {
      return jsonErr({ error: 'platform_not_yet_supported' }, 501)
    }

    const base = elevenlabsBase(integration.region)
    const audioRes = await fetch(`${base}/v1/convai/conversations/${call.elevenlabs_conversation_id}/audio`, {
      headers: { 'xi-api-key': integration.api_key },
    })
    if (!audioRes.ok) {
      return jsonErr({ error: 'elevenlabs_audio_failed', detail: `${audioRes.status} ${await audioRes.text()}` }, audioRes.status)
    }

    // Stream the audio bytes back. ElevenLabs returns audio/wav or audio/mpeg.
    return new Response(audioRes.body, {
      status: 200,
      headers: {
        'Content-Type': audioRes.headers.get('Content-Type') ?? 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
        ...cors,
      },
    })
  } catch (e) {
    return jsonErr({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
