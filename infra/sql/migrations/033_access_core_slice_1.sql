begin;

create extension if not exists pgcrypto;

create table if not exists public.platform_admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  email text not null,
  role text not null default 'support',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admin_users_auth_user_id_unique
    unique (auth_user_id),
  constraint platform_admin_users_role_chk
    check (role in ('admin', 'support')),
  constraint platform_admin_users_email_non_empty_chk
    check (char_length(trim(email)) > 0)
);

create unique index if not exists idx_platform_admin_users_lower_email_unique
  on public.platform_admin_users(lower(trim(email)));

create index if not exists idx_platform_admin_users_active_role
  on public.platform_admin_users(active, role);

create table if not exists public.access_ticket_types (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  name text not null,
  description text null,
  price_gs bigint not null default 0,
  currency text not null default 'PYG',
  payment_kind text not null,
  entries_per_unit integer not null default 1,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_ticket_types_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_ticket_types_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_ticket_types_name_non_empty_chk
    check (char_length(trim(name)) > 0),
  constraint access_ticket_types_price_gs_non_negative_chk
    check (price_gs >= 0),
  constraint access_ticket_types_currency_chk
    check (currency = 'PYG'),
  constraint access_ticket_types_payment_kind_chk
    check (payment_kind in ('paid', 'free_pass')),
  constraint access_ticket_types_payment_kind_price_chk
    check (
      (payment_kind = 'free_pass' and price_gs = 0)
      or
      (payment_kind = 'paid' and price_gs > 0)
    ),
  constraint access_ticket_types_entries_per_unit_positive_chk
    check (entries_per_unit > 0)
);

create index if not exists idx_access_ticket_types_local_active_sort
  on public.access_ticket_types(local_id, active, sort_order)
  where source_type = 'local';

create index if not exists idx_access_ticket_types_event_active_sort
  on public.access_ticket_types(event_id, active, sort_order)
  where source_type = 'event';

create unique index if not exists idx_access_ticket_types_local_active_name_unique
  on public.access_ticket_types(local_id, lower(trim(name)))
  where source_type = 'local' and active = true;

create unique index if not exists idx_access_ticket_types_event_active_name_unique
  on public.access_ticket_types(event_id, lower(trim(name)))
  where source_type = 'event' and active = true;

alter table public.platform_admin_users enable row level security;
alter table public.access_ticket_types enable row level security;

revoke all privileges on table public.platform_admin_users from anon;
revoke all privileges on table public.platform_admin_users from authenticated;

revoke all privileges on table public.access_ticket_types from anon;
revoke all privileges on table public.access_ticket_types from authenticated;

grant select, insert, update, delete on table public.platform_admin_users to service_role;
grant select, insert, update, delete on table public.access_ticket_types to service_role;

commit;
