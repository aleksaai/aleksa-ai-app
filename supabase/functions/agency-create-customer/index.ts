// agency-create-customer Edge Function (Multi-Tenant Phase D)
//
// Called by a partner (role=agency_owner) to onboard a new customer under
// their agency. Sets customer.agency_id automatically. Skips Stripe customer
// creation (Phase G will wire Stripe Connect for partner-collected payments).
// Sends a magic-link invite via Resend (admin.openpenguin.de) → /onboarding.

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
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('role, agency_id').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'agency_owner') return json({ error: 'agency_owner_only' }, 403)
    if (!profile.agency_id) return json({ error: 'no_agency_assigned' }, 403)

    // Load agency for branding in email
    const { data: agency } = await sbAdmin
      .from('agencies')
      .select('display_name, slug, custom_domain, max_customers, brand_color, logo_url')
      .eq('id', profile.agency_id)
      .maybeSingle()
    if (!agency) return json({ error: 'agency_not_found' }, 404)

    // Enforce max_customers limit
    const { count: existingCount } = await sbAdmin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id)
    if (existingCount !== null && existingCount >= agency.max_customers) {
      return json({ error: 'max_customers_reached', limit: agency.max_customers }, 409)
    }

    const body = await req.json().catch(() => ({}))
    const name = (body.name ?? '').toString().trim()
    const contactEmail = (body.contact_email ?? '').toString().trim().toLowerCase()
    if (!name || !contactEmail) {
      return json({ error: 'name_and_contact_email_required' }, 400)
    }

    // Insert customer (agency_owner RLS policy permits this because agency_id matches)
    const { data: customer, error: custErr } = await sbAdmin
      .from('customers')
      .insert({
        name,
        contact_email: contactEmail,
        agency_id: profile.agency_id,
        // customer_kind defaults to 'voice_customer' but this is an agency customer;
        // we keep the value as voice_customer since agency_id=NOT NULL is the new tenant marker
      })
      .select()
      .single()
    if (custErr) return json({ error: 'customer_insert_failed', detail: custErr.message }, 500)

    // Invitation token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await sbAdmin.from('customer_invitations').insert({
      customer_id: customer.id,
      email: contactEmail,
      token,
      expires_at: expiresAt,
      agency_id: profile.agency_id,
    })

    // Build the tenant URL the partner uses (custom_domain wins over slug if set + verified).
    // The customer must land on the partner's domain so TenantProvider applies the
    // partner's branding (logo, brand color, title). APP_URL would route them to
    // platform.openpenguin.de and they'd see OpenPenguin's default branding.
    const tenantHost = agency.custom_domain ?? `${agency.slug}.openpenguin.de`
    const tenantUrl = `https://${tenantHost}`
    const onboardingUrl = `${tenantUrl}/onboarding?invitation_token=${token}`
    void APP_URL

    // Generate magic-link
    let magicLink: string | null = null
    let linkErrMsg: string | null = null
    const { data: invLink, error: invLinkErr } = await sbAdmin.auth.admin.generateLink({
      type: 'invite',
      email: contactEmail,
      options: { redirectTo: onboardingUrl, data: { invitation_token: token } },
    })
    if (invLinkErr) {
      const isExistsErr =
        invLinkErr.message?.toLowerCase().includes('already') ||
        (invLinkErr as any).code === 'email_exists' ||
        (invLinkErr as any).status === 422
      if (isExistsErr) {
        const { data: ml, error: mlErr } = await sbAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: contactEmail,
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
      return json({ error: 'magic_link_generation_failed', detail: linkErrMsg ?? '' }, 500)
    }

    // Send email (partner-branded subject + sender, but still using OpenPenguin's
    // verified domain admin.openpenguin.de in the From header).
    const brandColor = (agency as any).brand_color && /^#[0-9a-fA-F]{6}$/.test((agency as any).brand_color)
      ? (agency as any).brand_color
      : '#65A4FF'
    const logoUrl = (agency as any).logo_url as string | null
    const logoBlock = logoUrl
      ? `<img src="${logoUrl}" alt="${agency.display_name}" style="max-height: 48px; max-width: 200px; margin-bottom: 16px;" />`
      : ''
    let emailSent = false
    let emailError: string | null = null
    try {
      const resend = new Resend(RESEND_API_KEY)
      const r = await resend.emails.send({
        from: `${agency.display_name} <noreply@admin.openpenguin.de>`,
        to: contactEmail,
        subject: `Willkommen bei ${agency.display_name} — ${name}`,
        html: `
          <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            ${logoBlock}
            <h1 style="font-size: 24px; margin: 0 0 16px;">Hallo ${name},</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #475569;">
              du wurdest zu <strong>${agency.display_name}</strong> freigeschaltet — der Plattform für deine Voice-Agent-Verwaltung.
            </p>
            <p style="margin: 24px 0;">
              <a href="${magicLink}" style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Konto aktivieren &rarr;
              </a>
            </p>
            <p style="font-size: 14px; color: #64748b;">
              Ein Klick reicht — du wirst automatisch angemeldet und durchs Onboarding geführt.
              Deine Plattform läuft unter <a href="${tenantUrl}" style="color: ${brandColor};">${tenantHost}</a>.
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
              Der Link läuft in 7 Tagen ab. Falls Probleme, melde dich beim ${agency.display_name}-Team.
            </p>
          </div>
        `,
      })
      if (r.error) {
        emailError = `${r.error.name ?? 'ResendError'}: ${r.error.message ?? JSON.stringify(r.error)}`
      } else {
        emailSent = true
      }
    } catch (e) {
      emailError = `Exception: ${e instanceof Error ? e.message : String(e)}`
    }

    return json({
      ok: true,
      customer_id: customer.id,
      invitation_token: token,
      invite_link: magicLink,
      email_sent: emailSent,
      email_error: emailError,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
