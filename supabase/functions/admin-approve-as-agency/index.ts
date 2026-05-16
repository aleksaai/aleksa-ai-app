// admin-approve-as-agency Edge Function
//
// Replaces the legacy "approve as platform_member" flow.
// Approves an access_request, generates a Supabase magic-link pointing to
// /agency-onboarding?request_id=…, sends the partner a branded email via
// Resend (admin.openpenguin.de). The agency row + profile.role upgrade
// happen later when the partner completes the wizard.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'
import { Resend } from 'https://esm.sh/resend@4.0.1'

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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized', detail: authErr?.message }, 401)

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'admin_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const requestId = (body.access_request_id ?? '').toString()
    if (!requestId) return json({ error: 'access_request_id_required' }, 400)

    const { data: accessReq, error: reqErr } = await sbAdmin
      .from('access_requests').select('*').eq('id', requestId).maybeSingle()
    if (reqErr || !accessReq) return json({ error: 'request_not_found' }, 404)
    if (accessReq.status !== 'pending') {
      return json({ error: 'already_processed', status: accessReq.status }, 409)
    }

    // Mark approved (wizard uses this status when validating)
    const { error: updateErr } = await sbAdmin
      .from('access_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .eq('id', requestId)
    if (updateErr) return json({ error: 'request_update_failed', detail: updateErr.message }, 500)

    // Generate magic-link → /agency-onboarding
    const onboardingUrl = `${APP_URL}/agency-onboarding?request_id=${requestId}`
    let magicLink: string | null = null
    let linkErrMsg: string | null = null

    const { data: invLink, error: invLinkErr } = await sbAdmin.auth.admin.generateLink({
      type: 'invite',
      email: accessReq.email,
      options: { redirectTo: onboardingUrl, data: { access_request_id: requestId } },
    })
    if (invLinkErr) {
      const isExistsErr =
        invLinkErr.message?.toLowerCase().includes('already') ||
        (invLinkErr as any).code === 'email_exists' ||
        (invLinkErr as any).status === 422
      if (isExistsErr) {
        const { data: ml, error: mlErr } = await sbAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: accessReq.email,
          options: { redirectTo: onboardingUrl },
        })
        if (mlErr) linkErrMsg = `magiclink: ${mlErr.message}`
        else magicLink = (ml as any)?.properties?.action_link ?? null
      } else {
        linkErrMsg = `invite: ${invLinkErr.message}`
      }
    } else {
      magicLink = (invLink as any)?.properties?.action_link ?? null
    }

    if (!magicLink) {
      return json({ error: 'magic_link_generation_failed', detail: linkErrMsg ?? 'no link returned' }, 500)
    }

    // Send branded email
    let emailSent = false
    let emailError: string | null = null
    try {
      const resend = new Resend(RESEND_API_KEY)
      const r = await resend.emails.send({
        from: 'OpenPenguin Voice <noreply@admin.openpenguin.de>',
        to: accessReq.email,
        subject: `Willkommen bei OpenPenguin Voice — dein Partner-Zugang ist freigeschaltet`,
        html: `
          <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h1 style="font-size: 24px; margin: 0 0 16px;">Hallo ${accessReq.name},</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #475569;">
              dein Partner-Zugang zu <strong>OpenPenguin Voice</strong> ist freigeschaltet.
              Mit einem Klick richtest du dein eigenes Whitelabel-Dashboard ein.
            </p>
            <p style="margin: 24px 0;">
              <a href="${magicLink}" style="display: inline-block; background: #65A4FF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Dashboard einrichten &rarr;
              </a>
            </p>
            <p style="font-size: 14px; color: #64748b;">
              Du wirst durch ein kurzes Setup geführt — Subdomain wählen, Brand-Farbe, Anzeigename.
              Danach kannst du deine eigenen Kunden anlegen und ihnen Voice-Agents vergeben.
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
              Der Link läuft in 24 Stunden ab. Falls Probleme melde dich bei Aleksa.
            </p>
          </div>
        `,
      })
      if (r.error) {
        emailError = `${r.error.name ?? 'ResendError'}: ${r.error.message ?? JSON.stringify(r.error)}`
        console.error('Resend returned error:', JSON.stringify(r.error))
      } else {
        emailSent = true
      }
    } catch (e) {
      emailError = `Exception: ${e instanceof Error ? e.message : String(e)}`
    }

    return json({
      ok: true,
      access_request_id: requestId,
      invite_link: magicLink,
      email_sent: emailSent,
      email_error: emailError,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
