-- ============================================================================
-- AleksaAI App — Customer Permissions (V2 Self-Service)
-- ============================================================================
-- Per-customer toggle of what their Customer-Owners can do/see in their dashboard.
-- Default everything FALSE — admin opens features manually per customer.
-- ============================================================================

create table public.customer_permissions (
  customer_id           uuid primary key references public.customers(id) on delete cascade,
  can_view_calls        boolean not null default false,
  can_view_transcripts  boolean not null default false,
  can_view_audio        boolean not null default false,
  can_edit_agent_config boolean not null default false,
  can_edit_kb           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger set_updated_at_customer_permissions before update on public.customer_permissions
  for each row execute function public.set_updated_at();

alter table public.customer_permissions enable row level security;

create policy "admin_full_access_customer_permissions" on public.customer_permissions
  for all using (public.current_user_role() = 'admin');

create policy "owner_read_own_permissions" on public.customer_permissions
  for select using (customer_id = public.current_user_customer_id());

-- Auto-create a default-permissions row when a new customer is inserted
create or replace function public.create_default_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_permissions (customer_id) values (new.id)
    on conflict (customer_id) do nothing;
  return new;
end;
$$;

create trigger on_customer_created
  after insert on public.customers
  for each row
  execute function public.create_default_permissions();

-- Backfill: insert default permissions for existing customers
insert into public.customer_permissions (customer_id)
  select id from public.customers
  on conflict (customer_id) do nothing;
