# Multi-Tenant Agency Tier — Phase 1 Spec

**Status:** In Progress (2026-05-16)
**Author:** Marcus
**Scope decision:** Full Phase 1 (Multi-Tenant + Stripe Connect + Custom Domain + Branding + Onboarding)

## Goal

Replace the interim `customers.customer_kind = 'platform_member'` workaround with a real multi-tenant architecture so OpenPenguin community members (Partners) get their own whitelabel platform under `{slug}.openpenguin.de` (or their own domain), can onboard + manage their own customers + voice agents, and bill via their own Stripe.

## Personas + roles

| Role (in `profiles.role`) | Who | Sees |
|---|---|---|
| `admin` (= platform_admin) | Aleksa | EVERYTHING — all agencies, all customers, all calls |
| `agency_owner` (NEW) | Partner — onboarded via `/signup` → admin approval → onboarding wizard | Only their own agency's customers, voice_agents, calls, integrations, pricing_plans |
| `customer_owner` (legacy unchanged) | End customer of either Aleksa directly OR an agency | Only their own customer-scoped data |

`admin` retains its name to avoid renaming the existing enum value mid-migration. Semantically it's the platform-admin tier.

## Data model

### New table: `agencies`

```sql
CREATE TABLE agencies (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  slug                        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$'),
  display_name                text NOT NULL,
  brand_color                 text NOT NULL DEFAULT '#66A4FF',
  logo_url                    text,
  favicon_url                 text,
  custom_domain               text UNIQUE,
  custom_domain_status        text NOT NULL DEFAULT 'none'
                              CHECK (custom_domain_status IN ('none','pending_dns','verified','failed')),
  custom_domain_verified_at   timestamptz,
  stripe_connect_account_id   text UNIQUE,
  stripe_connect_status       text NOT NULL DEFAULT 'none'
                              CHECK (stripe_connect_status IN ('none','pending','active','disconnected')),
  max_customers               integer NOT NULL DEFAULT 50,
  status                      text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended','deleted')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
```

`slug` constraint: 3-20 chars, lowercase a-z + digits + hyphens, must start + end with alphanumeric (prevents `--`, leading/trailing dashes).

### Schema changes on existing tables

- `profiles.agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL` (nullable — admin + customer_owner of legacy direct customers have NULL)
- `customers.agency_id uuid REFERENCES agencies(id) ON DELETE RESTRICT` (nullable — Aleksa's legacy voice_customers have NULL = "owned by platform admin direct")
- `pricing_plans.agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE` (nullable for legacy + Aleksa-direct plans)
- `integrations.agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE` (nullable for legacy)
- `customer_invitations.agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE` (nullable for legacy)
- `access_requests` adds optional `intended_agency_slug text` — set by signup form if Partner already wants a specific slug
- `user_role` enum: add `'agency_owner'`

`voice_agents`, `calls`, `customer_subscriptions`, `customer_permissions` reach their agency_id transitively via `customer_id → customers.agency_id`. No direct column on them.

### Helper functions (`SECURITY DEFINER`, `STABLE`)

```sql
public.current_user_agency_id() returns uuid
  -- reads profiles.agency_id for auth.uid()
```

Existing `current_user_role()` + `current_user_customer_id()` are kept.

### RLS strategy

Pattern per customer-scoped table: **three policies**
1. `admin_full_access_*` — admin role bypass (existing)
2. `agency_owner_full_access_*` (NEW) — `agency_id = current_user_agency_id() OR (customer.agency_id = current_user_agency_id() via subquery for transitive tables)`
3. `customer_owner_read_*` — existing

Plus on `agencies` table itself:
- `admin_full_access_agencies`
- `agency_owner_reads_own_agency` (`id = current_user_agency_id()`)
- `agency_owner_updates_own_agency` (UPDATE only, `id = current_user_agency_id()`)

## Tenant detection (frontend)

React hook `useTenant()` runs on App mount:

```ts
const hostname = window.location.hostname
// Cases:
// 1. 'localhost' or 'platform.openpenguin.de' → tenant = null (platform admin view)
// 2. '{slug}.openpenguin.de' → lookup agencies WHERE slug = subdomain
// 3. anything else → lookup agencies WHERE custom_domain = hostname
```

Result is cached in React Context for the session. If agency found:
- Inject CSS vars: `--accent-500: {brand_color}` (and derived shades)
- Set `<title>` to `{agency.display_name}`
- Swap `<link rel="icon">` to `{agency.favicon_url}` if set
- Swap logo image source to `{agency.logo_url}` if set

If on agency subdomain but not authenticated, login page brands with the agency.
If on agency subdomain but authenticated as someone NOT belonging to that agency → redirect to `platform.openpenguin.de` (cross-tenant access denied).

## Stripe Connect

Standard model (recommended for Aleksa's case: Partners keep 100%, no platform fee).

**Flow:**
1. Partner clicks "Stripe verbinden" in `/agency/settings/payments`
2. Frontend POSTs `stripe-connect-start` Edge Function → returns Stripe OAuth URL
3. Partner authorizes on Stripe
4. Stripe redirects back to `{tenant-url}/agency/settings/payments/callback?code=...&state=...`
5. Frontend POSTs `stripe-connect-callback` with code → exchanges for `stripe_user_id` (= `acct_xxx`) → stores in `agencies.stripe_connect_account_id`, sets `stripe_connect_status = 'active'`
6. Agency now creates customers + subscriptions on their own Stripe account
7. Webhook `webhook-stripe` extended: for events from connected accounts (event has `account: acct_xxx`), look up agency by `stripe_connect_account_id`, route subscription/invoice events to that agency's customers

**Existing Aleksa-direct customers (`agency_id IS NULL`)** continue to use Aleksa's Stripe account as before. No change.

## Custom Domain

**Flow:**
1. Partner enters domain `app.kihelden.de` in `/agency/settings/whitelabel`
2. UI shows: "Add this CNAME at your DNS provider:
   - Type: CNAME
   - Name: app
   - Value: `{slug}.openpenguin.de`"
3. Partner adds CNAME at registrar (Cloudflare, etc.) — instant for some providers, slow for others
4. Partner clicks "Verifizieren" → Edge Function `verify-custom-domain`:
   - DNS lookup via `dig` or DoH (Cloudflare DNS-over-HTTPS API)
   - Check CNAME of `app.kihelden.de` resolves to `{slug}.openpenguin.de` or to a Netlify load balancer
   - If verified: call Netlify API to add domain alias to site
   - Update `agencies.custom_domain_status = 'verified'`
5. SSL provisions automatically via Netlify (~minutes)
6. Status visible in UI; auto-poll Netlify SSL status

**Netlify Free Plan capacity (corrected from previous "~5" estimate):**
Free Plan supports **~50 domain aliases** with per-alias Let's Encrypt SSL — Pro is **not** required for Aleksa's expected scale (1-10 community partners). The distinction that misled me earlier: *Wildcard SSL* is Pro, but *Wildcard DNS* (CNAME `*.openpenguin.de` at IONOS) is a DNS standard and free everywhere. We don't need Wildcard SSL — every partner subdomain gets its own Let's Encrypt cert auto-provisioned by Netlify when the alias is added via API.

ToS-Note: Reselling-Hosting on Free is gray-zone (officially Netlify requires Pro for reselling). For Aleksa's free Community-Perk model with 0-10 members this is fine; upgrade to Pro once the platform is monetized or partner count grows past ~30.

**Required setup before this works:**
- `NETLIFY_API_TOKEN` stored in Vault (Aleksa creates a Personal Access Token at https://app.netlify.com/user/applications)
- `NETLIFY_SITE_ID` for the openpenguin.de site stored in Vault
- Wildcard CNAME `*.openpenguin.de` at IONOS pointing to the Netlify site host (one-time DNS setup — free, no Pro needed for the DNS record itself)

Once the Vault secrets are in place, `agency-finalize-onboarding` Edge Function automatically POSTs to Netlify's `/sites/{id}` API to add the partner's `{slug}.openpenguin.de` as a domain alias on each successful wizard completion — no manual Aleksa-side click per partner.

## Onboarding wizard

When admin approves an access_request, instead of going straight to `admin-create-customer`, the new flow:

1. `admin-approve-access-request` Edge Function creates:
   - A `profiles` row with `role='agency_owner', agency_id=NULL` (agency not yet created)
   - Sends magic-link email pointing to `/onboarding-agency`
2. Partner clicks magic-link → lands on `/onboarding-agency`
3. Multi-step wizard:
   - Step 1: Pick slug → frontend checks uniqueness via Edge Function → reserve
   - Step 2: Pick `display_name` + brand color (color picker) + upload logo (drag-drop, Supabase Storage)
   - Step 3 (optional, skippable): Connect Stripe — opens Stripe Connect OAuth in new tab
   - Step 4 (optional, skippable): Add custom domain
   - Step 5: Confirm → Edge Function `agency-finalize-onboarding` creates the agencies row, sets profile.agency_id, redirects Partner to their tenant: `https://{slug}.openpenguin.de/agency`

## Platform-admin override

New routes at `/platform-admin/*`:
- `/platform-admin/agencies` — list of all agencies + key stats (customer count, active subscriptions, calls last 30d, status)
- `/platform-admin/agencies/:id` — detail view with action buttons: suspend, impersonate (logs into agency as read-only), force-disconnect Stripe, manually verify custom domain
- "Impersonate" loads the agency dashboard with a banner "Platform-Admin Preview — read-only"

Existing `/admin/*` routes are kept for legacy Aleksa-direct customers (voice_customer flow). Aleksa can still onboard new direct customers there.

## Edge Function changes

**New (8):**
- `agency-check-slug-availability`
- `agency-reserve-slug`
- `agency-finalize-onboarding`
- `agency-update-branding`
- `stripe-connect-start`
- `stripe-connect-callback`
- `verify-custom-domain`
- `admin-approve-access-request` (replaces inline approval logic)

**Modified (4):**
- `admin-create-customer` — accepts `agency_id` param (admin can create customer for any agency, agency_owner only for their own)
- `webhook-stripe` — detect connected-account events, route to correct agency
- `link-invitation` — sets `agency_id` on profile if invitation came from agency
- `admin-list-platform-agents` — agency-aware (admin sees all, agency_owner only their own integrations)

## Build phases

| Phase | Scope | Time |
|---|---|---|
| A | DB schema + RLS rewrites | 1-1.5h |
| B | Frontend tenant detection + branding | 1h |
| C | Agency-owner dashboard skeleton | 1h |
| D | Partner customer management | 1h |
| E | Partner voice-agent management | 1h |
| F | Whitelabel UI + Storage bucket | 1h |
| G | Stripe Connect | 2-3h |
| H | Custom Domain | 1.5-2h |
| I | Onboarding wizard | 1.5h |
| J | Platform-admin UI | 1h |
| **Total** | | **~12-15h** |

## Out of scope for Phase 1

- Per-agency email templates (Resend domain per agency) — Phase 2
- Agency-level analytics dashboards beyond basic stats — Phase 2
- Agency → sub-agency hierarchy (reseller-of-reseller) — never
- Marketplace / public agency directory — never
- Per-agency rate limiting beyond `max_customers` — Phase 2
