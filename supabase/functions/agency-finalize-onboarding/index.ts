// agency-finalize-onboarding Edge Function
//
// Called by the partner from the /agency-onboarding wizard final step.
// Validates the slug, creates the agency row, upgrades their profile to
// role='agency_owner', sets profile.agency_id, and marks the access_request
// as fully consumed.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
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

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const requestId = (body.request_id ?? '').toString().trim()
    const slug = (body.slug ?? '').toString().trim().toLowerCase()
    const displayName = (body.display_name ?? '').toString().trim()
    const brandColor = (body.brand_color ?? '#66A4FF').toString().trim()

    if (!slug || !displayName) {
      return json({ error: 'slug_and_display_name_required' }, 400)
    }
    if (!/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/.test(slug)) {
      return json({ error: 'invalid_slug', detail: 'slug muss 3-20 Zeichen sein, lowercase, alphanumerisch + bindestrich' }, 400)
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return json({ error: 'invalid_brand_color', detail: 'erwartet 6-stelliger Hex z.B. #66A4FF' }, 400)
    }

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify caller's profile + ensure they don't already have an agency
    const { data: profile } = await sbAdmin
      .from('profiles').select('role, agency_id').eq('id', user.id).maybeSingle()
    if (profile?.agency_id) {
      return json({ error: 'already_has_agency', agency_id: profile.agency_id }, 409)
    }

    // Validate the access_request: must exist, be approved, and match caller email
    if (requestId) {
      const { data: accessReq } = await sbAdmin
        .from('access_requests')
        .select('status, email')
        .eq('id', requestId)
        .maybeSingle()
      if (!accessReq) return json({ error: 'access_request_not_found' }, 404)
      if (accessReq.status !== 'approved') {
        return json({ error: 'request_not_approved', status: accessReq.status }, 403)
      }
      if (accessReq.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
        return json({ error: 'email_mismatch' }, 403)
      }
    }

    // Slug availability check (reuses the public RPC)
    const { data: slugAvail, error: slugErr } = await sbAdmin
      .rpc('check_slug_availability', { p_slug: slug })
    if (slugErr) return json({ error: 'slug_check_failed', detail: slugErr.message }, 500)
    if (!slugAvail) return json({ error: 'slug_unavailable' }, 409)

    // Create agency
    const { data: agency, error: agencyErr } = await sbAdmin
      .from('agencies')
      .insert({
        owner_user_id: user.id,
        slug,
        display_name: displayName,
        brand_color: brandColor,
      })
      .select()
      .single()
    if (agencyErr || !agency) {
      return json({ error: 'agency_creation_failed', detail: agencyErr?.message }, 500)
    }

    // Upgrade profile to agency_owner + set agency_id
    const { error: profileErr } = await sbAdmin
      .from('profiles')
      .update({ role: 'agency_owner', agency_id: agency.id })
      .eq('id', user.id)
    if (profileErr) {
      // Roll back: delete agency
      await sbAdmin.from('agencies').delete().eq('id', agency.id)
      return json({ error: 'profile_update_failed', detail: profileErr.message }, 500)
    }

    return json({
      ok: true,
      agency: {
        id: agency.id,
        slug: agency.slug,
        display_name: agency.display_name,
        brand_color: agency.brand_color,
      },
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
