# SPEC.md — AleksaAI App

**Status:** Spec approved 2026-05-03 by Aleksa — **MVP + V1.5 + V2 (partial) LIVE on `app.aleksa.ai`**
**Owner:** Marcus (Plan), Aleksa (Execute via Claude Code)
**Repo:** [`aleksaai/aleksa-ai-app`](https://github.com/aleksaai/aleksa-ai-app)
**Deployed:** https://app.aleksa.ai (subdomain of marketing site)

> 📋 **For current state see `HANDOFF.md`. For what's next see `ROADMAP.md`. For tech details see `ARCHITECTURE.md`.**
> This file documents the original vision + what's implemented vs. open. Tick marks (✅) indicate shipped features.

## 1. Was ist das?

Whitelabel-Plattform für Aleksas ElevenLabs-Voice-Agent-Reseller-Business. Ersetzt ChatDash (~106€/m). Customers bekommen ein gebrandetes Dashboard mit ihren Calls + Rechnungen, Aleksa bekommt Auto-Billing über Stripe Tiered Metered Billing. Drei Pricing-Modelle pro Customer×Agent zuweisbar.

## 2. User-Personas

| Persona | Wer | Was er kann |
|---|---|---|
| **Aleksa (Admin)** | Plattform-Owner | Customers anlegen, Voice-Agents zuordnen, Pricing-Pakete erstellen, Calls + Margins einsehen |
| **Customer Owner** | Aleksas Kunde (z.B. Vierroth/VV-Cars, später via Thomas Luderer Pipeline) | Login, Calls einsehen, Rechnungen, Voice-Agent-Settings ändern (V1) |
| **End-Caller** | Person die den Voice Agent anruft | Kennt die Plattform nicht, ruft nur an |

## 3. Kernfunktionen (in 3 Phasen)

### MVP — "ChatDash kündbar" ✅ LIVE

1. ✅ Aleksa lädt Customer per Email ein → Customer registriert sich → sieht Dashboard mit **Paywall-Overlay**
2. ✅ Customer hinterlegt Karte über Stripe Setup-Intent → Paywall verschwindet
3. ✅ Aleksa weist im Admin pro Voice-Agent ein Pricing-Paket zu → Stripe-Subscription wird sofort aktiv
4. ✅ ElevenLabs `post_call_webhook` feuert nach jedem Call → Edge Function trackt Call in `calls` Tabelle
5. ✅ Daily Cron-Job (02:00 UTC) pusht aufsummierte Minuten als Stripe `usage_records`
6. ✅ Stripe stellt automatisch Rechnung + bucht Karte ab → Customer kriegt Stripe-Customer-Portal-Link

**MVP Customer-View:** ✅ Paywall + nach Bezahlung Dashboard mit Stats pro Voice-Agent + "Abo verwalten" → Stripe Portal.

### V1.5 — "Vision-Sidebar im Admin" (Aleksas Vision 2026-05-14) ✅ LIVE

Admin-Panel mit Sidebar + 4 Top-Level-Tabs:

**Tab 1: Kunden** ✅
- ✅ Liste (haben wir im MVP)
- ✅ Klick auf Kunde → Detail-Page:
  - ✅ **Übersicht** — Name, Status, Stripe-Customer-ID
  - ✅ **Zugewiesene Agenten** — Add/Remove. Pro Agent: aktive Subscription
  - ✅ **Kundenzugriff** — 5 Toggles (alle implementiert in `customer_permissions` table):
    - ✅ Gespräche (Calls-Log) → `can_view_calls`
    - ✅ Transkripte → `can_view_transcripts`
    - ✅ Audiodateien → `can_view_audio`
    - ⏳ Analysen — implizit über Dashboard Stats, kein dedicated toggle
    - ✅ Wissensdatenbank-Editor → `can_edit_kb`
    - ✅ Agenten-Konfiguration-Editor → `can_edit_agent_config`
  - ✅ "👁 Als Customer ansehen" Button → `/admin/customers/:id/view` Preview-Mode

**Tab 2: Agenten** ✅
- ✅ Liste eigener ElevenLabs Agents (RetellAI/Vapi/OpenAI Integrations-Layer ready aber Provider-API-Calls noch ElevenLabs-only)
- ✅ "Neuer Agent" via AddVoiceAgentDialog mit Integration-Dropdown + Provider-API-Agents-Liste (kein manuelles ID-Tippen mehr)
- ✅ Klick auf Agent → `/admin/agents/:id` Detail-Page mit 4 Tabs:
  - ✅ **Übersicht** — IDs + LLM + Voice + Phone + Customer + Integration
  - ✅ **Prompt + First Message** — Editor → PATCH zu ElevenLabs
  - ✅ **Stimme** — Voice-Picker mit ElevenLabs Voice-Library + Preview-Audio
  - ✅ **Wissensdatenbank** — Workspace-Docs + per-Agent-Assignment + RAG-Toggle + "+ Neuer Doc"-Modal
  - ⏳ **Tools** — Editor für Webhook-Tools (deferred; ElevenLabs PATCH API kann tools nicht modifizieren, braucht create_agent_full + rebuild — siehe Marcus' knowledge.md)

**Tab 3: Abrechnungen** ⏳ — Aktuell als flacher Tab "Pricing-Pakete". Geplant: Sub-Tabs Produkte + Abos
- ✅ **Produkte (= aktuell Pricing-Pakete):** alle 3 Modi (Grundabo+Nutzung, Nur Nutzungsbasiert, Einmalig) implementiert
- ⏳ **Abos:** Liste + "+ Neues Abo" Form (aktuell muss man durch Customer-Detail navigieren — in Roadmap)

**Tab 4: Einstellungen** ⏳ — Aktuell als "Integrationen" Tab. Geplant: zusätzliche Account-Settings (in Roadmap)

### V2 — "Customer-Selfservice + Live-Sync" ✅ PARTIAL LIVE

**Customer-Dashboard** (was der eingeloggte Customer sieht):
- ✅ Beim Login: Liste der ihm zugewiesenen Agenten
- ✅ Pro Agent: Stats-Card (Anrufe, Gesamt-Nutzung, Aufgerundet, Aktuelle Kosten projiziert)
- ✅ Abrechnungszeitraum aus `customer_subscriptions`
- ✅ "Abo verwalten" → Stripe Customer Portal (via `customer-billing-portal` Edge Function)
- ✅ "Agent konfigurieren →" Button wenn permissions gesetzt → `/dashboard/agents/:id` mit Tabs (filtered by permissions):
  - ✅ Übersicht (immer)
  - ✅ Prompt & Begrüßung (`can_edit_agent_config`)
  - ✅ Stimme (`can_edit_agent_config`)
  - ✅ Wissensdatenbank (`can_edit_kb`)
- ✅ Call-Detail-Page `/dashboard/calls/:id` (permission-gated):
  - ✅ Metadata immer
  - ✅ Transkript (Chat-Bubble-UI) wenn `can_view_transcripts`
  - ✅ Audio-Player wenn `can_view_audio` (proxied via `admin-get-call-audio` — API key bleibt server-side)
  - ✅ Zusammenfassung (ElevenLabs Analysis transcript_summary) wenn `can_view_transcripts`

**B2B-Steuer-Handling** ✅ LIVE (zusätzlich zur Vision):
- ✅ Onboarding fragt B2C/B2B → B2B-Mode zeigt Firmenname + USt-ID Felder
- ✅ Edge Function `update-customer-business` setzt Stripe Customer.name + tax_id (`type: eu_vat`)
- ✅ Stripe validiert VAT-ID gegen EU-VIES-Datenbank
- ✅ Stripe Tax wendet automatisch Reverse-Charge an für cross-border B2B (0% MwSt)

**Whitelabel-Polish:** ⏳ Roadmap — siehe `ROADMAP.md` § "Whitelabel V2"
- Pro Customer: eigene Subdomain (`<slug>.app.aleksa.ai`) oder Custom-Domain
- Pro Customer: Logo + Primary-Color in `customers.branding` jsonb (Schema bereit, UI fehlt)
- Email-Templates per Customer brandbar (optional)

## 4. Daten-Modell (Supabase: `puimwizupgkdvxpanlhy`)

> 📋 Live-Schema (8 Tables inkl. `integrations` + `customer_permissions` aus späteren Migrations) ist in **`ARCHITECTURE.md` § Database Schema** dokumentiert. Onten der Original-Spec — nicht das aktuelle Live-Schema.

```sql
-- Auth (Supabase built-in: auth.users)

profiles
  id           uuid PRIMARY KEY (FK auth.users.id)
  role         text CHECK IN ('admin', 'customer_owner')
  customer_id  uuid REFERENCES customers(id)  -- null for admin
  created_at   timestamptz DEFAULT now()

customers
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name                text NOT NULL
  contact_email       text NOT NULL
  stripe_customer_id  text UNIQUE
  has_payment_method  boolean DEFAULT false
  branding            jsonb DEFAULT '{}'  -- logo_url, primary_color (V2)
  created_at          timestamptz DEFAULT now()

voice_agents
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  customer_id                   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE
  elevenlabs_agent_id           text NOT NULL UNIQUE
  elevenlabs_phone_number_id    text
  display_name                  text
  pricing_plan_id               uuid REFERENCES pricing_plans(id)
  active                        boolean DEFAULT true
  created_at                    timestamptz DEFAULT now()

pricing_plans
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name                           text NOT NULL
  type                           text CHECK IN ('per_minute', 'flat', 'hybrid')
  flat_amount_cents              integer  -- e.g. 30000 = 300€
  included_minutes               integer  -- e.g. 100
  per_minute_overage_cents       integer  -- e.g. 30 = 30ct
  currency                       text DEFAULT 'EUR'
  stripe_product_id              text
  stripe_flat_price_id           text     -- recurring monthly flat
  stripe_metered_price_id        text     -- usage-based for overage
  archived                       boolean DEFAULT false
  created_at                     timestamptz DEFAULT now()

customer_subscriptions
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  customer_id                   uuid NOT NULL REFERENCES customers(id)
  voice_agent_id                uuid NOT NULL REFERENCES voice_agents(id)
  pricing_plan_id               uuid NOT NULL REFERENCES pricing_plans(id)
  stripe_subscription_id        text UNIQUE
  stripe_subscription_item_id   text  -- the metered item id, for usage_record posts
  status                        text CHECK IN ('active', 'past_due', 'canceled', 'trialing')
  current_period_start          timestamptz
  current_period_end            timestamptz
  created_at                    timestamptz DEFAULT now()

calls
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  voice_agent_id                uuid NOT NULL REFERENCES voice_agents(id)
  customer_id                   uuid NOT NULL REFERENCES customers(id)
  elevenlabs_conversation_id    text NOT NULL UNIQUE  -- IDEMPOTENCY KEY
  started_at                    timestamptz NOT NULL
  duration_secs                 integer NOT NULL
  elevenlabs_cost_cents         integer  -- our cost (for margin tracking)
  termination_reason            text
  raw_payload                   jsonb     -- full webhook for debugging
  reported_to_stripe_at         timestamptz  -- null = not yet billed
  created_at                    timestamptz DEFAULT now()

customer_invitations
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  customer_id   uuid NOT NULL REFERENCES customers(id)
  email         text NOT NULL
  token         text NOT NULL UNIQUE
  used_at       timestamptz
  expires_at    timestamptz NOT NULL
  created_at    timestamptz DEFAULT now()
```

**RLS-Policies:**
- `admin` role: SELECT/INSERT/UPDATE/DELETE auf alle Tables
- `customer_owner`: nur Rows wo `customer_id = (SELECT customer_id FROM profiles WHERE id = auth.uid())`
- Service Role (Edge Functions): bypasses RLS

## 5. Edge Functions

| Function | Trigger | Was sie tut |
|---|---|---|
| `webhook-elevenlabs` | ElevenLabs `post_call_webhook` POSTet | HMAC verify (Header `elevenlabs-signature`) → `agent_id` zu `voice_agent_id` mappen → Row in `calls` schreiben (idempotent über `conversation_id`) |
| `cron-stripe-usage` | pg_cron: täglich 02:00 UTC | Iteriert aktive Subscriptions → summiert `calls.duration_secs` seit `reported_to_stripe_at IS NULL` → pusht `usage_record` an Stripe → markiert Calls als reported |
| `webhook-stripe` | Stripe Events POSTen | `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid` etc. → updated `customers.has_payment_method`, `customer_subscriptions.status` |
| `admin-create-customer` | Admin-UI | Legt Customer in DB + Stripe-Customer an, generiert Invitation-Token, schickt Email via Resend |
| `accept-invitation` | Customer klickt Email-Link | Token validieren → Auth-User anlegen mit Magic-Link + customer_owner Profile |
| `setup-intent` | Customer im Onboarding | Stripe SetupIntent erstellen für Karten-Hinterlegung |
| `admin-create-pricing-plan` | Admin-UI | Stripe Product + Price(s) anlegen → Row in `pricing_plans` |
| `admin-assign-pricing` | Admin-UI | Erstellt Stripe Subscription mit Tiered Metered Pricing → Row in `customer_subscriptions` |
| `customer-update-agent` (V1) | Customer-UI | RLS-check → `elevenlabs-bridge → patch_agent` |

## 6. Frontend-Routen

```
/                          Public Login (Magic Link)
/admin                     Admin Dashboard (Customers + Agents + Pricing + Calls)
/admin/customers/new       New Customer Form
/admin/pricing-plans       Pricing Plans CRUD
/admin/calls               Global Calls Log (mit Margin-Spalte)
/dashboard                 Customer Dashboard (paywalled bis Karte)
/dashboard/billing         Link zu Stripe-Customer-Portal
/dashboard/agents          V1: Customer-Selfservice
/invite/:token             Invitation-Acceptance
/onboarding                Paywall-Screen mit Stripe-Setup-Intent
```

## 7. Externe APIs

- **Supabase** (`puimwizupgkdvxpanlhy`): Auth, DB, RLS, Edge Functions, pg_cron
- **Stripe** (Account 1 — `acct_1RlQZ6JH4KmjuYHx`, mit Metadata-Tag `source=aleksa-ai-app` für Lisa-Filterung): Tiered Metered Billing, Tax (an), Customer Portal, Webhooks
- **ElevenLabs:** `post_call_webhook` zeigt auf `webhook-elevenlabs`. `elevenlabs-bridge` (existiert in claude-team Supabase) für `patch_agent`
- **Resend:** Customer-Invitation-Mails (sender `noreply@projekt.aleksa.ai`)

## 8. Tech-Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite + TS + Tailwind |
| UI-Components | 21st Dev Magic + Motion |
| Auth/DB/Cron | Supabase |
| Backend | Supabase Edge Functions (Deno) |
| Payments | Stripe (Tiered Metered + Tax) |
| Hosting | Netlify (GitHub-Connect, Aleksa) |
| Email | Resend |
| Voice | ElevenLabs (über bestehende Bridge) |

## 9. Akzeptanz-Kriterien

**MVP fertig wenn:**
- [ ] Aleksa kann Customer per Email einladen, Customer registriert sich
- [ ] Customer sieht Paywall, hinterlegt Karte über Stripe-Setup-Intent
- [ ] Aleksa kann Pricing-Plan erstellen (alle 3 Modelle: per_minute, flat, hybrid)
- [ ] Aleksa weist Pricing-Plan einem `voice_agent` zu → Subscription startet
- [ ] Eingehender ElevenLabs-Webhook nach echtem Call landet in `calls`
- [ ] Daily Cron pusht Usage-Records erfolgreich an Stripe
- [ ] Stripe stellt Rechnung am Periodenende, Geld wird abgebucht
- [ ] **End-to-End-Test mit VV-Cars/Kati:** wir migrieren VV-Cars von ChatDash auf AleksaAI App, ein echter Anruf wird korrekt verrechnet, ChatDash-Abo kann gekündigt werden

**V1 fertig wenn:**
- [ ] Customer sieht Calls-Log mit Datum/Dauer/Kosten
- [ ] Customer kann System-Prompt + First Message + Voice eines Agents ändern → läuft live in ElevenLabs

**V2 fertig wenn:**
- [ ] Pro Customer eigene Subdomain
- [ ] Logo + Primary Color pro Customer applied

## 10. Was NICHT im Scope ist

- Multi-Currency (nur EUR)
- Mehrere Admins
- Customer-zu-Customer-Sharing (jeder Customer ist isoliert)
- Eigene Voice-Agent-Erstellung durch Customer
- Real-Time-Call-Streaming-View
- Eigene Call-Recording-Storage (ElevenLabs hostet das)
- iOS/Android-App
- Public API für Customers

## 11. Risiken + Unknowns

| Risiko | Mitigation |
|---|---|
| Stripe Tiered Metered Billing tricky | Step 3 + 6 isoliert testen mit Postman/Test-Mode |
| ElevenLabs Webhook könnte dupliziert feuern | UNIQUE-Constraint auf `calls.elevenlabs_conversation_id` |
| Cron verpasst einen Tag | `reported_to_stripe_at IS NULL` als Filter — selbstheilend |
| Karte fails mid-period | Stripe handled (`past_due` → Mahnungen → ggf. `canceled`); wir spiegeln Status in `customer_subscriptions.status` via Stripe-Webhook |
| ChatDash-Migration: ElevenLabs-Webhook-URL ändern könnte Calls verlieren | Migration-Window: 1 Wochentag zur ruhigen Zeit umschalten, beide Systeme parallel laufen lassen für 1 Woche zur Verifikation |

---

*Approved 2026-05-03. See `BUILD-PLAN.md` for the numbered MVP execution steps.*
