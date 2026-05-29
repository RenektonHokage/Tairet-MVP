begin;

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  description text null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  checkin_valid_from timestamptz not null,
  checkin_valid_to timestamptz not null,
  timezone text not null default 'America/Asuncion',
  location_name text not null,
  address text null,
  organizer_name text not null,
  local_id uuid null references public.locals(id) on delete set null,
  status text not null default 'draft',
  cover_image_url text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_non_empty_chk
    check (char_length(trim(title)) > 0),
  constraint events_slug_non_empty_chk
    check (char_length(trim(slug)) > 0),
  constraint events_location_name_non_empty_chk
    check (char_length(trim(location_name)) > 0),
  constraint events_organizer_name_non_empty_chk
    check (char_length(trim(organizer_name)) > 0),
  constraint events_timezone_non_empty_chk
    check (char_length(trim(timezone)) > 0),
  constraint events_status_chk
    check (status in ('draft', 'published', 'paused', 'finished')),
  constraint events_checkin_window_bounds_chk
    check (checkin_valid_from < checkin_valid_to),
  constraint events_datetime_bounds_chk
    check (ends_at is null or ends_at >= starts_at),
  constraint events_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null,
  description text null,
  price_amount bigint not null default 0,
  currency text not null default 'PYG',
  stock integer not null,
  active boolean not null default true,
  sales_start timestamptz null,
  sales_end timestamptz null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_ticket_types_id_event_id_key
    unique (id, event_id),
  constraint event_ticket_types_name_non_empty_chk
    check (char_length(trim(name)) > 0),
  constraint event_ticket_types_price_amount_non_negative_chk
    check (price_amount >= 0),
  constraint event_ticket_types_stock_non_negative_chk
    check (stock >= 0),
  constraint event_ticket_types_currency_chk
    check (currency = 'PYG'),
  constraint event_ticket_types_sales_window_chk
    check (sales_start is null or sales_end is null or sales_start < sales_end)
);

create table if not exists public.event_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  source text not null,
  payment_method text not null,
  payment_status text not null,
  total_amount bigint not null default 0,
  currency text not null default 'PYG',
  created_by_auth_user_id uuid null,
  buyer_name text not null,
  buyer_last_name text not null,
  buyer_email text not null,
  buyer_phone text not null,
  buyer_document text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_orders_id_event_id_key
    unique (id, event_id),
  constraint event_orders_source_chk
    check (source in ('manual_issue', 'online_checkout')),
  constraint event_orders_payment_method_chk
    check (payment_method in ('manual_transfer', 'bancard', 'dinelco', 'other')),
  constraint event_orders_payment_status_chk
    check (payment_status in ('confirmed_externally', 'paid', 'cancelled', 'refunded', 'pending')),
  constraint event_orders_total_amount_non_negative_chk
    check (total_amount >= 0),
  constraint event_orders_currency_chk
    check (currency = 'PYG'),
  constraint event_orders_buyer_name_non_empty_chk
    check (char_length(trim(buyer_name)) > 0),
  constraint event_orders_buyer_last_name_non_empty_chk
    check (char_length(trim(buyer_last_name)) > 0),
  constraint event_orders_buyer_email_non_empty_chk
    check (char_length(trim(buyer_email)) > 0),
  constraint event_orders_buyer_phone_non_empty_chk
    check (char_length(trim(buyer_phone)) > 0),
  constraint event_orders_buyer_document_non_empty_chk
    check (char_length(trim(buyer_document)) > 0)
);

create table if not exists public.event_order_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  event_order_id uuid not null,
  event_ticket_type_id uuid not null,
  unit_price_amount bigint not null default 0,
  currency text not null default 'PYG',
  attendee_name text not null,
  attendee_last_name text not null,
  attendee_email text not null,
  attendee_phone text not null,
  attendee_document text not null,
  status text not null default 'issued',
  checkin_status text not null default 'unused',
  checkin_token uuid not null default gen_random_uuid(),
  used_at timestamptz null,
  used_by_auth_user_id uuid null,
  email_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_order_entries_order_event_fk
    foreign key (event_order_id, event_id)
    references public.event_orders(id, event_id)
    on delete restrict,
  constraint event_order_entries_ticket_type_event_fk
    foreign key (event_ticket_type_id, event_id)
    references public.event_ticket_types(id, event_id)
    on delete restrict,
  constraint event_order_entries_status_chk
    check (status in ('issued', 'voided')),
  constraint event_order_entries_checkin_status_chk
    check (checkin_status in ('unused', 'used')),
  constraint event_order_entries_unit_price_amount_non_negative_chk
    check (unit_price_amount >= 0),
  constraint event_order_entries_currency_chk
    check (currency = 'PYG'),
  constraint event_order_entries_attendee_name_non_empty_chk
    check (char_length(trim(attendee_name)) > 0),
  constraint event_order_entries_attendee_last_name_non_empty_chk
    check (char_length(trim(attendee_last_name)) > 0),
  constraint event_order_entries_attendee_email_non_empty_chk
    check (char_length(trim(attendee_email)) > 0),
  constraint event_order_entries_attendee_phone_non_empty_chk
    check (char_length(trim(attendee_phone)) > 0),
  constraint event_order_entries_attendee_document_non_empty_chk
    check (char_length(trim(attendee_document)) > 0),
  constraint event_order_entries_used_at_consistency_chk
    check (
      (checkin_status = 'used' and used_at is not null)
      or (checkin_status = 'unused' and used_at is null)
    ),
  constraint event_order_entries_used_actor_consistency_chk
    check (
      (checkin_status = 'used' and used_by_auth_user_id is not null)
      or (checkin_status = 'unused' and used_by_auth_user_id is null)
    ),
  constraint event_order_entries_voided_not_used_chk
    check (status <> 'voided' or checkin_status = 'unused')
);

create table if not exists public.event_panel_users (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid not null,
  role text not null,
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_panel_users_role_chk
    check (role in ('owner', 'staff')),
  constraint event_panel_users_display_name_chk
    check (
      display_name is null
      or char_length(trim(display_name)) between 1 and 80
    )
);

-- Ibiza Slice 1B intentionally does not create FK references to auth.users.
-- Event auth is handled by future eventPanelAuth via auth_user_id lookups.
-- Composite FKs above keep entry.event_id aligned with its order and ticket type.

create unique index if not exists idx_events_slug_unique
  on public.events(lower(trim(slug)));

create index if not exists idx_event_ticket_types_event_id
  on public.event_ticket_types(event_id);

create unique index if not exists idx_event_ticket_types_event_lower_name_unique
  on public.event_ticket_types(event_id, lower(trim(name)));

create index if not exists idx_event_orders_event_created
  on public.event_orders(event_id, created_at desc);

create index if not exists idx_event_order_entries_event_checkin_status
  on public.event_order_entries(event_id, checkin_status);

create index if not exists idx_event_order_entries_event_ticket_type
  on public.event_order_entries(event_id, event_ticket_type_id);

create unique index if not exists idx_event_order_entries_checkin_token_unique
  on public.event_order_entries(checkin_token);

create unique index if not exists idx_event_panel_users_event_auth_user_unique
  on public.event_panel_users(event_id, auth_user_id);

create index if not exists idx_event_order_entries_event_attendee_email
  on public.event_order_entries(event_id, lower(trim(attendee_email)));

create index if not exists idx_event_order_entries_event_attendee_document
  on public.event_order_entries(event_id, trim(attendee_document));

alter table public.events enable row level security;
alter table public.event_ticket_types enable row level security;
alter table public.event_orders enable row level security;
alter table public.event_order_entries enable row level security;
alter table public.event_panel_users enable row level security;

revoke all privileges on table public.events from anon;
revoke all privileges on table public.events from authenticated;

revoke all privileges on table public.event_ticket_types from anon;
revoke all privileges on table public.event_ticket_types from authenticated;

revoke all privileges on table public.event_orders from anon;
revoke all privileges on table public.event_orders from authenticated;

revoke all privileges on table public.event_order_entries from anon;
revoke all privileges on table public.event_order_entries from authenticated;

revoke all privileges on table public.event_panel_users from anon;
revoke all privileges on table public.event_panel_users from authenticated;

commit;
