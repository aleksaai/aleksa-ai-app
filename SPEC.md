# SPEC.md — AleksaAI App (Voicedash) v0.1

**Status:** Spec approved 2026-05-03 by Aleksa
**Owner:** Marcus (Plan), Aleksa (Execute via Claude Code)
**Repo:** `aleksaai/aleksa-ai-app`
**Deployed:** `app.aleksa.ai` (subdomain of marketing site)

## 1. Was ist das?

Whitelabel-Plattform für Aleksas ElevenLabs-Voice-Agent-Reseller-Business. Ersetzt ChatDash (~106€/m). Customers bekommen ein gebrandetes Dashboard mit ihren Calls + Rechnungen, Aleksa bekommt Auto-Billing über Stripe Tiered Metered Billing. Drei Pricing-Modelle pro Customer×Agent zuweisbar.

## 2. User-Personas

| Persona | Wer | Was er kann |
|---|---|---|
| **Aleksa (Admin)** | Plattform-Owner | Customers anlegen, Voice-Agents zuordnen, Pricing-Pakete erstellen, Calls + Margins einsehen |
| **Customer Owner** | Aleksas Kunde (z.B. Vierroth/VV-Cars, später via Thomas Luderer Pipeline) | Login, Calls einsehen, Rechnungen, Voice-Agent-Settings ändern (V1) |
| **End-Caller** | Person die den Voice Agent anruft | Kennt die Plattform nicht, ruft nur an |

## 3. Kernfunktionen (in 3 Phasen)

### MVP — "ChatDash kündbar"
1. Aleksa lädt Customer per Email ein → Customer registriert sich → sieht Dashboard mit **Paywall-Overlay** ("Bitte Zahlungsmethode hinterlegen")
2. Customer hinterlegt Karte über Stripe Setup-Intent → Paywall verschwindet
3. Aleksa weist im Admin pro Voice-Agent ein Pricing-Paket zu → Stripe-Subscription wird sofort aktiv
4. ElevenLabs `post_call_webhook` feuert nach jedem Call → Edge Function trackt Customer-ID + Agent-ID + Sekunden + ElevenLabs-Cost in Supabase
5. Daily Cron-Job pusht aufsummierte Minuten als Stripe `usage_records` an die jeweilige Subscription
6. Stripe stellt monatlich automatisch Rechnung + bucht Karte ab → Customer kriegt Stripe-Customer-Portal-Link für Rechnungen/Zahlungsmethoden

**MVP Customer-View:** Paywall + nach Bezahlung leeres Dashboard "Hi, du bist live, Rechnungen kommen monatlich" + Link zu Stripe Customer Portal. Kein Selfservice am Voice Agent.

### V1.5 — "Vision-Sidebar im Admin" (Aleksas Vision 2026-05-14)

Admin-Panel mit Sidebar + 4 Top-Level-Tabs:

**Tab 1: Kunden**
- Liste (haben wir im MVP)
- Klick auf Kunde → Detail-Page mit Sub-Tabs:
  - **Übersicht** — Name, Dashboard-Sprache (DE/EN/HU), Stripe-Status, Branding
  - **Zugewiesene Agenten** — Liste der Agents die diesem Customer zugewiesen sind (aus Tab 2). Add/Remove. Pro Agent: aktive Subscription anzeigen
  - **Kundenzugriff** — Toggles pro Feature, was der Customer in seinem Dashboard sehen darf:
    - Gespräche (Calls-Log)
    - Transkripte
    - Audiodateien
    - Analysen (Anzahl Calls, Dauer, Kosten)
    - Wissensdatenbank-Editor (Read/Write)
    - Agenten-Konfiguration-Editor (System Prompt, First Message, LLM-Modell, Voice)

**Tab 2: Agenten**
- Liste eigener ElevenLabs + RetellAI Agents
- "Neuer Agent" → Form mit Platform-Switcher (ElevenLabs / RetellAI), Agent-ID, Display-Name, Region (US/EU für RetellAI)
- Klick auf Agent → Detail-Page mit Tabs:
  - **Übersicht** — Agent-ID, API-Platform, Region, eventuelle Phone-Number-ID, Verknüpfter Customer (oder "frei")
  - **Prompt + First Message** — Editor, schreibt direkt via ElevenLabs `patch_agent` / RetellAI `update_agent`
  - **Tools** (V2) — Editor für Webhook-Tools
  - **Webhook-Config** (RetellAI) — Post-Call-Webhook-URL anzeigen (read-only)

**Tab 3: Abrechnungen** (Sub-Tabs)
- **Produkte:** Liste aller Pricing-Pakete + "Neues Produkt" mit 3 Modi:
  1. **Grundabo + Nutzung** — flat_amount + included_minutes + per_minute_overage + currency + interval (month/year)
  2. **Nur Nutzungsbasiert** — per_minute + currency + interval (default: month)
  3. **Einmalig** — one_time_amount + currency
- **Abos:** Liste aller aktiven Subscriptions + "Neues Abo" mit Form:
  - Kunde wählen (dropdown)
  - Agent wählen (dropdown, gefiltert auf Customer-zugewiesene Agents)
  - Startdatum (default: heute)
  - Produkt wählen (dropdown)
  - → Erstellt Stripe-Subscription mit allen passenden Stripe Prices

**Tab 4: Einstellungen** — Account, API-Tokens, Resend-Verifikation, Webhook-URLs als Reference

### V2 — "Customer-Selfservice + Live-Sync"

**Customer-Dashboard** (was der eingeloggte Customer sieht):
- Beim Login: Liste der ihm zugewiesenen Agenten
- Klick auf Agent → Sidebar mit Items (gefiltert basiert auf Kundenzugriff-Permissions vom Admin):
  - **Analysen** — Total Calls, Total Minutes, durchschnittliche Dauer, Cost-pro-Periode
  - **Gespräche** — Liste der Calls mit Transkript-Snippet + Audio-Player (fetched von ElevenLabs/RetellAI API)
  - **Wissensdatenbank** — Editor: docs erstellen/editieren → wird an Agent über ElevenLabs `patch_agent` mit `knowledge_base` array gepatcht
  - **Agentenkonfiguration** — Editor für System Prompt, First Message, Voice, LLM-Modell → live-sync zu ElevenLabs/RetellAI
  - **Abo-Details**:
    - Abrechnungszeitraum (z.B. 27. April – 27. Mai 2026)
    - Aktuelle Gesamtkosten (live, basiert auf `calls.duration_secs * pricing_plan`)
    - Gesamtnutzung (z.B. 27:30 Min)
    - Kosten pro Minute (statisch aus Pricing-Plan)
    - Button "Abo verwalten" → öffnet Stripe Customer Portal in neuem Tab

**Whitelabel-Polish:**
- Pro Customer: eigene Subdomain (`<slug>.app.aleksa.ai`) oder Custom-Domain (`portal.vv-cars.de` → CNAME)
- Pro Customer: Logo + Primary-Color in `customers.branding` jsonb
- Email-Templates per Customer brandbar (optional)

## 4. Daten-Modell (Supabase: `puimwizupgkdvxpanlhy`)

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
