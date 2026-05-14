# ARCHITECTURE.md — AleksaAI App Technical Deep-Dive

> Companion to `CLAUDE.md`. Has every Edge Function signature, every DB column with rationale, every external-API call pattern, every permission decision tree. Use as reference when extending.

---

## Database Schema

Supabase Project `puimwizupgkdvxpanlhy`. All public tables have RLS enabled. `service_role` (used inside Edge Functions) bypasses RLS.

### `auth.users` (Supabase built-in)

Owned by Supabase Auth. We never read/write directly. Magic Link sign-in creates rows; our trigger `handle_new_user` mirrors them into `profiles`.

### `profiles`

One-to-one with `auth.users`. Determines role + customer linkage.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK auth.users.id, cascade-delete |
| `role` | enum `user_role` | `'admin'` or `'customer_owner'` |
| `customer_id` | uuid (nullable) | FK customers.id. Null for admin |
| `created_at`, `updated_at` | timestamptz | |

**Triggers:** `on_auth_user_created` runs `handle_new_user()` AFTER INSERT on `auth.users` — inserts a profile with role='customer_owner', customer_id=null. The `link-invitation` Edge Function later sets customer_id once invitee accepts.

**RLS:**
- `users_read_own_profile`: `auth.uid() = id`
- `admin_full_access_profiles`: subquery role='admin' via helper `current_user_role()`

**Helper functions (security definer, set search_path = public):**
- `current_user_role()` → returns `profiles.role` for `auth.uid()`
- `current_user_customer_id()` → returns `profiles.customer_id` for `auth.uid()`

Used inside other tables' RLS to avoid recursive-RLS-on-profiles bugs.

### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `name` | text not null | Display + invoice name |
| `contact_email` | text not null | Where invitation lands |
| `stripe_customer_id` | text unique | Set by `admin-create-customer` |
| `has_payment_method` | boolean default false | Flipped by `webhook-stripe` on `setup_intent.succeeded` |
| `branding` | jsonb default '{}' | V2 whitelabel (logo, color) |
| `created_at`, `updated_at` | timestamptz | |

**Trigger:** `on_customer_created` runs `create_default_permissions()` AFTER INSERT — creates a `customer_permissions` row with all FALSE.

**RLS:**
- `admin_full_access_customers`: admin role
- `owner_read_own_customer`: `id = current_user_customer_id()`

### `customer_permissions`

5-toggle gate for what Customer-Owner can do in their dashboard. Default ALL FALSE.

| Column | Type | What it unlocks |
|---|---|---|
| `customer_id` | uuid PK | FK customers.id |
| `can_view_calls` | boolean | Calls list in Dashboard expanded view |
| `can_view_transcripts` | boolean | Transcript + summary in CallDetail |
| `can_view_audio` | boolean | Audio player in CallDetail (proxy fetch) |
| `can_edit_agent_config` | boolean | Prompt + First Message + Voice tabs in CustomerAgentDetail |
| `can_edit_kb` | boolean | Knowledge Base tab in CustomerAgentDetail |
| `created_at`, `updated_at` | timestamptz | |

**RLS:**
- `admin_full_access_customer_permissions`: admin
- `owner_read_own_permissions`: `customer_id = current_user_customer_id()` (read-only)

Admin sets these directly via supabase client from `CustomerDetail.tsx` (no Edge Function needed — RLS allows admin updates).

### `integrations`

Reusable provider-account connections (ElevenLabs/RetellAI/Vapi/OpenAI).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | User-chosen label, e.g. "Mein ElevenLabs EU" |
| `platform` | enum `integration_platform` | `elevenlabs`, `retellai`, `vapi`, `openai` |
| `api_key` | text not null | **Plaintext** but RLS-locked to admin only |
| `region` | enum `integration_region` (nullable) | `us` or `eu`. Only meaningful for elevenlabs. Stored honestly but backend always hits `api.elevenlabs.io` until ElevenLabs Enterprise upgrade |
| `vapi_public_key` | text (nullable) | Only for vapi platform |
| `active` | boolean default true | Soft-delete via flag |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** admin-only (api_key sensitive).

### `voice_agents`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid not null | FK customers, cascade-delete |
| `integration_id` | uuid not null | FK integrations, restrict-delete |
| `platform_agent_id` | text not null | ElevenLabs agent_id / RetellAI agent_id / Vapi assistant_id |
| `platform_phone_number_id` | text (nullable) | Provider's phone-id (e.g. ElevenLabs `phnum_...`) |
| `display_name` | text (nullable) | UI label, falls back to platform_agent_id |
| `pricing_plan_id` | uuid (nullable) | Set by `admin-assign-pricing` when subscription starts |
| `active` | boolean default true | |
| `created_at`, `updated_at` | timestamptz | |

**Unique:** `(integration_id, platform_agent_id)` — one agent can only be registered once per integration.

**RLS:**
- `admin_full_access_voice_agents`: admin
- `owner_read_own_voice_agents`: `customer_id = current_user_customer_id()`

### `pricing_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | User-chosen, e.g. "Pay as you go" |
| `type` | enum `pricing_plan_type` | `per_minute`, `flat`, `hybrid`, `one_time` |
| `flat_amount_cents` | integer (nullable) | For flat/hybrid/one_time |
| `included_minutes` | integer (nullable) | For hybrid |
| `per_minute_overage_cents` | integer (nullable) | For per_minute/hybrid |
| `currency` | text default 'EUR' | EUR/USD/GBP/CHF |
| `billing_interval` | text default 'month' | `month`/`year`/`one_time`. CHECK constraint validates type↔interval combo |
| `stripe_product_id` | text (nullable) | Set by `admin-create-pricing-plan` |
| `stripe_flat_price_id` | text (nullable) | For flat/hybrid/one_time |
| `stripe_metered_price_id` | text (nullable) | For per_minute/hybrid (tiered metered Price) |
| `archived` | boolean default false | Soft-delete |
| `created_at`, `updated_at` | timestamptz | |

**Constraint** `pricing_plans_type_consistency`:
- per_minute: flat=null, overage=not-null, interval=month/year
- flat: flat=not-null, overage=null, interval=month/year
- hybrid: flat+included+overage all not-null, interval=month/year
- one_time: flat=not-null, overage=null, interval=one_time

**RLS:**
- `admin_full_access_pricing_plans`: admin
- `owner_read_pricing_plans`: read if customer has voice_agent linked to plan

### `customer_subscriptions`

One row per (customer, voice_agent, pricing_plan) binding. Mirror of Stripe Subscription state.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid not null | FK customers |
| `voice_agent_id` | uuid not null | FK voice_agents, cascade-delete |
| `pricing_plan_id` | uuid not null | FK pricing_plans, restrict-delete |
| `stripe_subscription_id` | text unique | Stripe `sub_...` ID. For one-time plans: stores `inv_...` (invoice ID) instead |
| `stripe_subscription_item_id` | text (nullable) | The metered item id — for posting usage_records. Null for one-time |
| `status` | enum `subscription_status` | `active`, `past_due`, `canceled`, `trialing`, `incomplete` |
| `current_period_start` | timestamptz | |
| `current_period_end` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

**RLS:**
- `admin_full_access_customer_subscriptions`: admin
- `owner_read_own_customer_subscriptions`: `customer_id = current_user_customer_id()`

### `calls`

The heart of the billing pipeline. Inserted by `webhook-elevenlabs`, aggregated by `cron-stripe-usage`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `voice_agent_id` | uuid not null | FK voice_agents, restrict-delete |
| `customer_id` | uuid not null | FK customers, restrict-delete |
| `elevenlabs_conversation_id` | text not null UNIQUE | **Idempotency key** — Stripe webhook retries are no-ops |
| `started_at` | timestamptz not null | From `metadata.start_time_unix_secs` |
| `duration_secs` | integer not null check ≥ 0 | From `metadata.call_duration_secs` |
| `elevenlabs_cost_credits` | integer (nullable) | ⚠️ **ElevenLabs Credits, NOT cents.** Renamed in migration 006 after first ingest mistake. Conversion to USD/EUR happens at display time per workspace tier |
| `termination_reason` | text (nullable) | "Call ended by remote party", etc. |
| `raw_payload` | jsonb (nullable) | Full webhook for debugging |
| `reported_to_stripe_at` | timestamptz (nullable) | Set by `cron-stripe-usage` when usage_record posted. Null = not yet billed |
| `created_at` | timestamptz | |

**Indexes:**
- `voice_agent_id` (for per-agent stats)
- `customer_id`
- `reported_to_stripe_at` WHERE NULL (partial — only unbilled rows, optimizes cron)
- `started_at DESC`

**RLS:**
- `admin_full_access_calls`: admin
- `owner_read_own_calls`: `customer_id = current_user_customer_id()`

### `customer_invitations`

7-day-expiring tokens.

| Column | Type |
|---|---|
| `id`, `customer_id`, `email`, `token` UNIQUE, `used_at`, `expires_at`, `created_at` | (standard) |

**RLS:** admin-only (no customer_owner access — invitations only matter pre-signup).

---

## Edge Functions

22 deployed Functions in `supabase/functions/`. All `verify_jwt: true` unless marked otherwise. All use Service Role for DB writes (bypassing RLS), then enforce auth manually via the `Authorization` header + profile lookup.

### Auth pattern (shared across all functions)

```ts
const supabaseAuth = createClient(URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
const { data: { user } } = await supabaseAuth.auth.getUser()

const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY)
const { data: profile } = await supabaseAdmin.from('profiles').select('role, customer_id').eq('id', user.id).maybeSingle()

if (profile.role === 'admin') {
  // ✅ Full access
} else if (profile.role === 'customer_owner') {
  // 1. Verify ownership (e.g. voice_agent.customer_id === profile.customer_id)
  // 2. Check required permission in customer_permissions
}
```

### Function reference

| Slug | verify_jwt | Auth | Purpose |
|---|---|---|---|
| **admin-create-customer** | true | admin only | Stripe Customer + DB row + 7-day invitation token + Resend email |
| **accept-invitation** | **false** | token-based | `action: info` returns invitation details (public). `action: send_magic_link` triggers Supabase OTP with `user_metadata.invitation_token` |
| **link-invitation** | true | authenticated user | Validates user.email = invitation.email, sets `profiles.customer_id`, marks invitation `used_at` |
| **setup-intent** | true | customer_owner with linked customer | Stripe `SetupIntent` for card collection. Returns client_secret + publishable_key |
| **update-customer-business** | true | customer_owner of own customer | Sets Stripe Customer.name (business name) + creates tax_id (`type: eu_vat`). Pre-validates regex `^[A-Z]{2}[A-Z0-9]{8,12}$` |
| **customer-billing-portal** | true | customer_owner of own customer | Creates Stripe Billing Portal session, returns URL |
| **admin-create-integration** | true | admin only | Inserts integration row with API key. Validates platform-specific fields (region for ElevenLabs, public_key for Vapi) |
| **admin-list-platform-agents** | true | admin only | Fetches ElevenLabs agents + phone-numbers, merges (agent→phone via `assigned_agent.agent_id`). For Voice-Agent dropdown |
| **admin-create-voice-agent** | true | admin only | Inserts voice_agents row. 409 if `(integration_id, platform_agent_id)` already exists |
| **admin-create-pricing-plan** | true | admin only | Stripe Product + Price(s) per mode (hybrid=2, per_minute=1 metered, one_time=1 non-recurring). **Pins Stripe-Version 2024-12-18.acacia** for legacy metered flow |
| **admin-assign-pricing** | true | admin only | For recurring: `POST /v1/subscriptions` with items array + automatic_tax + metadata. For one_time: `invoiceitems + invoices + finalize`. Persists `stripe_subscription_item_id` for usage_records |
| **admin-get-agent-config** | true | admin OR customer_owner-of-agent | GETs ElevenLabs agent config. Returns prompt, first_message, voice_id, llm, language, knowledge_base, rag_enabled |
| **admin-update-agent-config** | true | admin OR customer_owner-of-agent + can_edit_agent_config | PATCHes ElevenLabs `/v1/convai/agents/{id}` with `conversation_config` diff. Cannot modify tools (ElevenLabs PATCH limit) |
| **admin-list-voices** | true | admin OR customer_owner + can_edit_agent_config + owns agent on integration | GETs ElevenLabs `/v1/voices`. Returns id+name+labels+preview_url |
| **admin-list-kb-docs** | true | admin OR customer_owner + can_edit_kb + owns agent on integration | GETs ElevenLabs `/v1/convai/knowledge-base?page_size=100` |
| **admin-create-kb-doc** | true | same as list-kb | POSTs `/v1/convai/knowledge-base/text` with `{name, text}` |
| **admin-update-agent-kb** | true | admin OR customer_owner-of-agent + can_edit_kb | PATCHes agent's `prompt.knowledge_base` array + `prompt.rag.enabled` (with default RAG settings: e5_mistral_7b_instruct, max 20 chunks, distance 0.6, max 50k chars) |
| **admin-get-call-detail** | true | admin OR customer_owner-of-call + can_view_calls | GETs ElevenLabs `/v1/convai/conversations/{id}`. Permission-filtered output (transcript needs can_view_transcripts, audio_available needs can_view_audio) |
| **admin-get-call-audio** | true | admin OR customer_owner-of-call + can_view_audio | Streams binary audio from ElevenLabs `/v1/convai/conversations/{id}/audio` back to browser. Keeps API key server-side |
| **webhook-elevenlabs** | **false** | HMAC `elevenlabs-signature` | Verifies HMAC (timestamp-based, 30min replay protection) → parses `post_call_transcription` → inserts into `calls` (idempotent on conversation_id UNIQUE). Returns 200 even for unregistered agents so ElevenLabs stops retrying |
| **webhook-stripe** | **false** | HMAC `Stripe-Signature` | Stripe SDK constructEventAsync. Handles `setup_intent.succeeded` (sets `has_payment_method` + Stripe customer's `invoice_settings.default_payment_method`), `customer.subscription.{created,updated,deleted}` (status + period sync), `invoice.{paid,payment_failed}` (logged) |
| **cron-stripe-usage** | **false** | `x-cron-secret` header vs `CRON_SECRET` env | For each active subscription with metered item: SUM(duration_secs) WHERE reported_to_stripe_at IS NULL → POST `subscription_items/{id}/usage_records` with Idempotency-Key `${sub.id}_${run_id}` → mark calls reported. Triggered by pg_cron daily 02:00 UTC |

---

## Critical Integration Patterns

### Stripe API Version Pin

All Stripe-using Functions set `Stripe-Version: 2024-12-18.acacia` header. Reason: Stripe `2025-03-31.basil` (Account 1 default) requires metered prices to be backed by Meters (new Meters API). We use the legacy `recurring.usage_type: metered` + `usage_records` flow → need pre-Meters API spec. Migration to Meters API is future work (cleaner long-term).

Functions affected: `admin-create-pricing-plan`, `admin-assign-pricing`, `cron-stripe-usage`.

### Stripe Tax (Reverse-Charge for EU B2B)

Setup chain (ALL must be present before subscription create):
1. Stripe Tax enabled on Account 1 (admin step, one-time)
2. Customer has address — set via Stripe AddressElement during Onboarding
3. (B2B only) Customer has EU VAT ID — set via `update-customer-business` Edge Function pre-confirmSetup
4. Customer has default_payment_method — set by `webhook-stripe` on `setup_intent.succeeded`
5. Subscription created with `automatic_tax[enabled]=true`

Result: HU → DE B2C = 19% DE-MwSt; HU → DE B2B with VAT = 0% Reverse-Charge; HU → HU = 27% HU-MwSt (Inland).

### ElevenLabs Webhook HMAC

Format `t=<unix>,v0=<hex>`. Signed payload = `${timestamp}.${rawBody}`. HMAC-SHA256 with `ELEVENLABS_WEBHOOK_SECRET`. 30-minute replay window. Configured per workspace at https://elevenlabs.io/app/conversational-ai/settings → Webhooks.

### ElevenLabs Cost Unit

`metadata.cost` is in **ElevenLabs Credits**, NOT USD. Conversion to USD varies per tier:
- Creator: ~0.00022 USD/credit
- Pro: ~0.00018 USD/credit
- Scale/Enterprise: custom

We persist Credits raw in `calls.elevenlabs_cost_credits` and convert at display time (currently only Admin sees this value).

### Stripe Tiered Metered Pricing (Hybrid plans)

For "300€/Mo + 100 Min frei + 30ct/Min danach":
- 1 recurring flat price (300€ EUR/month)
- 1 metered price: `billing_scheme=tiered`, `tiers_mode=graduated`, tier[0]=up_to:100/flat_amount:0, tier[1]=up_to:inf/unit_amount:30. `recurring.usage_type=metered`.

Subscription has 2 items. Cron pushes `usage_records` only to the metered item.

### One-Time Pricing (no Subscription)

Stripe Subscriptions are recurring-only. For one-time charges:
1. `POST /invoiceitems` with the price_id + customer
2. `POST /invoices` with `collection_method=charge_automatically + auto_advance=true + automatic_tax[enabled]=true`
3. `POST /invoices/{id}/finalize` → Stripe charges saved card immediately

We persist in `customer_subscriptions` for record-keeping (status='active', stripe_subscription_id stores the invoice_id).

### Audio Proxy

Audio playback for Call-Detail bypasses `supabase.functions.invoke` (which JSON-parses responses) — uses raw `fetch` with Authorization header → blob → `URL.createObjectURL` for the `<audio>` element. Edge Function `admin-get-call-audio` streams ElevenLabs audio bytes through with the original Content-Type.

---

## Edge Function Deploy Pattern (no CLI)

Aleksa's MacBook has no Supabase CLI. All deploys via Management API:

```bash
PAT=$(cat ~/.../SUPABASE_PERSONAL_ACCESS_TOKEN)  # scoped to this project
curl -sS -X POST "https://api.supabase.com/v1/projects/puimwizupgkdvxpanlhy/functions/deploy?slug=<slug>" \
  -H "Authorization: Bearer $PAT" \
  -F 'metadata={"name":"<slug>","verify_jwt":true,"entrypoint_path":"index.ts"};type=application/json' \
  -F 'file=@<slug>/index.ts;filename=index.ts;type=application/typescript'
```

For SQL: `POST /v1/projects/{ref}/database/query` with `{query: "..."}` body. See Marcus' `knowledge.md` § "Supabase DDL/DML ohne psql + ohne CLI ausführen".

---

## Frontend Build Pipeline

| Step | Where |
|---|---|
| Local dev | NOT supported on Aleksa's MacBook (no Node) |
| Build trigger | `git push` to main |
| Build runs | Netlify (Node 22, set in `netlify.toml`) reads `.env.production` (committed) |
| Deploy | Netlify auto-publishes to `app.aleksa.ai` after ~90s |
| Custom domain | `app.aleksa.ai` via Netlify DNS |
| SPA routing | `netlify.toml` + `public/_redirects` fall back to `/index.html` |
| Security headers | `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, etc. via `netlify.toml` |

---

## Cron Schedule

`pg_cron` + `pg_net` extensions enabled. One job:

```sql
SELECT cron.schedule(
  'stripe-usage-daily',
  '0 2 * * *',  -- 02:00 UTC daily
  $$SELECT net.http_post(
    url := 'https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/cron-stripe-usage',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )$$
);
```

CRON_SECRET stored in Supabase Secrets + hardcoded in this SQL. If rotating: update both.

---

## Common Operations

### Check what's in the `calls` table

```bash
PAT="$SUPABASE_PERSONAL_ACCESS_TOKEN" curl -sS -X POST \
  "https://api.supabase.com/v1/projects/puimwizupgkdvxpanlhy/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"query":"select id, started_at, duration_secs, reported_to_stripe_at from calls order by started_at desc limit 20"}'
```

### Trigger cron-stripe-usage manually

```bash
curl -sS -X POST "https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/cron-stripe-usage" \
  -H "x-cron-secret: $CRON_SECRET"
```

### Promote a user to admin (after first sign-in)

```sql
UPDATE profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
```

### Reset Customer's onboarding (admin emergency)

```sql
UPDATE customers SET has_payment_method = false WHERE id = '<customer_id>';
UPDATE profiles SET customer_id = null WHERE customer_id = '<customer_id>';
```

(Customer will hit Paywall again on next login.)

---

## Migration to ElevenLabs Enterprise (EU Residency)

When Aleksa upgrades:
1. Switch `elevenlabsBase(region)` helper in ALL relevant Edge Functions from `return 'https://api.elevenlabs.io'` to `return region === 'eu' ? 'https://api.eu.residency.elevenlabs.io' : 'https://api.elevenlabs.io'`
2. Affected Functions: `admin-get-agent-config`, `admin-update-agent-config`, `admin-list-voices`, `admin-list-kb-docs`, `admin-create-kb-doc`, `admin-update-agent-kb`, `admin-list-platform-agents`, `admin-get-call-detail`, `admin-get-call-audio`
3. Existing integrations with `region='eu'` start routing to EU base; `region='us'` stays on US.
4. No DB migration needed — `integrations.region` already stored.
