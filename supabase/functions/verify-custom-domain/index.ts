// verify-custom-domain Edge Function (Multi-Tenant Phase H)
//
// Called by the partner to verify that their custom domain's CNAME points to
// {slug}.openpenguin.de. If verified, updates agency.custom_domain_status='verified'
// and (if NETLIFY_API_TOKEN + NETLIFY_SITE_ID are present in Vault) adds the
// domain as a Netlify domain alias.
//
// Caller invariant: caller is the agency_owner of the agency being verified.

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

const BASE_DOMAIN = 'openpenguin.de'
const NETLIFY_KNOWN_HOSTS = ['netlify.app', 'netlify.com'] // CNAMEs to Netlify are also acceptable

async function lookupCname(domain: string): Promise<string | null> {
  // Cloudflare DoH — free, no auth needed
  const resp = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`, {
    headers: { Accept: 'application/dns-json' },
  })
  if (!resp.ok) return null
  const body = await resp.json()
  const answer = (body.Answer ?? []).find((a: any) => a.type === 5) // 5 = CNAME
  if (!answer) return null
  const target = (answer.data ?? '').toString().replace(/\.$/, '').toLowerCase()
  return target || null
}

async function addToAuthAllowlist(
  pat: string,
  projectRef: string,
  domain: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  // GET current auth config to read existing uri_allow_list
  const getResp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${pat}` },
  })
  if (!getResp.ok) {
    return { ok: false, error: `mgmt_get_auth_failed: ${getResp.status}` }
  }
  const cfg = await getResp.json()
  const current = (cfg.uri_allow_list ?? '').toString()
  const entries = current.split(',').map((s: string) => s.trim()).filter(Boolean)
  const newEntry = `https://${domain}/**`
  if (entries.includes(newEntry)) {
    return { ok: true, already: true }
  }
  entries.push(newEntry)
  const patchResp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri_allow_list: entries.join(',') }),
  })
  if (!patchResp.ok) {
    const t = await patchResp.text()
    return { ok: false, error: `mgmt_patch_failed: ${patchResp.status} ${t.slice(0, 200)}` }
  }
  return { ok: true, already: false }
}

async function addNetlifyDomainAlias(
  netlifyToken: string,
  netlifySiteId: string,
  domain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // GET current site to read existing domain_aliases
  const siteResp = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
    headers: { Authorization: `Bearer ${netlifyToken}` },
  })
  if (!siteResp.ok) {
    return { ok: false, error: `netlify_get_site_failed: ${siteResp.status}` }
  }
  const site = await siteResp.json()
  const existing = Array.isArray(site.domain_aliases) ? site.domain_aliases : []
  if (existing.includes(domain)) {
    return { ok: true } // already added, idempotent
  }
  const updated = [...existing, domain]
  const patchResp = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domain_aliases: updated }),
  })
  if (!patchResp.ok) {
    const t = await patchResp.text()
    return { ok: false, error: `netlify_patch_failed: ${patchResp.status} ${t.slice(0, 200)}` }
  }
  return { ok: true }
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

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await sbAdmin
      .from('profiles').select('role, agency_id').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'agency_owner') return json({ error: 'agency_owner_only' }, 403)
    if (!profile.agency_id) return json({ error: 'no_agency_assigned' }, 403)

    const { data: agency } = await sbAdmin
      .from('agencies')
      .select('slug, custom_domain, custom_domain_status')
      .eq('id', profile.agency_id)
      .maybeSingle()
    if (!agency) return json({ error: 'agency_not_found' }, 404)
    if (!agency.custom_domain) {
      return json({ error: 'no_custom_domain_set' }, 400)
    }

    const target = await lookupCname(agency.custom_domain)
    const expected = `${agency.slug}.${BASE_DOMAIN}`.toLowerCase()
    const isNetlifyHost = target ? NETLIFY_KNOWN_HOSTS.some((h) => target.endsWith(h)) : false
    const matches = target && (target === expected || isNetlifyHost)

    if (!matches) {
      await sbAdmin
        .from('agencies')
        .update({ custom_domain_status: 'failed' })
        .eq('id', profile.agency_id)
      return json({
        ok: false,
        error: 'cname_mismatch',
        detail: target
          ? `CNAME zeigt auf "${target}" — sollte auf "${expected}" zeigen.`
          : `Kein CNAME-Record für ${agency.custom_domain} gefunden. DNS-Propagation kann bis zu 60 Min dauern.`,
        cname_found: target,
        cname_expected: expected,
      })
    }

    // Try to add Netlify domain alias if credentials are available
    let netlifyResult: 'added' | 'skipped_no_secrets' | 'failed' = 'skipped_no_secrets'
    let netlifyError: string | null = null
    // Read from Edge Function env (canonical) — Vault was used here in an
    // earlier draft but Aleksa stores his ops secrets in the standard
    // Edge Function Secrets dashboard, so we read from Deno.env directly.
    const netlifyToken = Deno.env.get('NETLIFY_API_TOKEN')
    const netlifySiteId = Deno.env.get('NETLIFY_SITE_ID')
    if (netlifyToken && netlifySiteId) {
      const r = await addNetlifyDomainAlias(netlifyToken, netlifySiteId, agency.custom_domain)
      if (r.ok) netlifyResult = 'added'
      else {
        netlifyResult = 'failed'
        netlifyError = r.error
      }
    }

    // Also add the custom domain to Supabase Auth redirect allowlist so magic-link
    // and OAuth redirects to https://<custom-domain>/** are accepted. Without this,
    // Supabase silently falls back to site_url (=platform.openpenguin.de) and
    // partner-customers end up on the platform domain, seeing OpenPenguin branding.
    let authAllowlistResult: 'added' | 'already_present' | 'skipped_no_pat' | 'failed' = 'skipped_no_pat'
    let authAllowlistError: string | null = null
    const mgmtPat = Deno.env.get('MGMT_API_PAT')
    const projectRef = (SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) ?? [])[1]
    if (mgmtPat && projectRef) {
      const r = await addToAuthAllowlist(mgmtPat, projectRef, agency.custom_domain)
      if (r.ok) authAllowlistResult = r.already ? 'already_present' : 'added'
      else {
        authAllowlistResult = 'failed'
        authAllowlistError = r.error
      }
    }

    await sbAdmin
      .from('agencies')
      .update({
        custom_domain_status: 'verified',
        custom_domain_verified_at: new Date().toISOString(),
      })
      .eq('id', profile.agency_id)

    return json({
      ok: true,
      cname_found: target,
      cname_expected: expected,
      netlify: netlifyResult,
      netlify_error: netlifyError,
      auth_allowlist: authAllowlistResult,
      auth_allowlist_error: authAllowlistError,
      note: netlifyResult === 'skipped_no_secrets'
        ? 'DNS verifiziert. Aleksa muss die Domain als Netlify Domain-Alias manuell hinzufügen (oder NETLIFY_API_TOKEN + NETLIFY_SITE_ID in Vault setzen für Auto-Add).'
        : netlifyResult === 'added'
        ? 'DNS verifiziert + Domain als Netlify-Alias hinzugefügt. SSL provisioniert in ~5 Min.'
        : 'DNS verifiziert, aber Netlify-Alias-Add fehlgeschlagen. Aleksa muss manuell nachhelfen.',
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
