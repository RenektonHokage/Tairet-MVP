begin;

create extension if not exists pgcrypto;

create table if not exists public.access_orders (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null default ('acc_' || encode(gen_random_bytes(16), 'hex')),
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  access_date date not null,
  buyer_name text not null,
  buyer_last_name text not null,
  buyer_email text not null,
  buyer_phone text not null,
  buyer_document text not null,
  amount_gs bigint not null default 0,
  currency text not null default 'PYG',
  payment_required boolean not null default true,
  status text not null default 'pending_payment',
  expires_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,
  expired_at timestamptz null,
  manual_review_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_orders_public_ref_unique
    unique (public_ref),
  constraint access_orders_id_access_date_unique
    unique (id, access_date),
  constraint access_orders_public_ref_non_empty_chk
    check (char_length(trim(public_ref)) > 0),
  constraint access_orders_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_orders_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_orders_buyer_name_non_empty_chk
    check (char_length(trim(buyer_name)) > 0),
  constraint access_orders_buyer_last_name_non_empty_chk
    check (char_length(trim(buyer_last_name)) > 0),
  constraint access_orders_buyer_email_non_empty_chk
    check (char_length(trim(buyer_email)) > 0),
  constraint access_orders_buyer_phone_non_empty_chk
    check (char_length(trim(buyer_phone)) > 0),
  constraint access_orders_buyer_document_non_empty_chk
    check (char_length(trim(buyer_document)) > 0),
  constraint access_orders_amount_gs_non_negative_chk
    check (amount_gs >= 0),
  constraint access_orders_currency_chk
    check (currency = 'PYG'),
  constraint access_orders_status_chk
    check (status in ('pending_payment', 'paid', 'cancelled', 'expired', 'manual_review')),
  constraint access_orders_payment_required_amount_chk
    check (payment_required = true or amount_gs = 0)
);

create index if not exists idx_access_orders_lower_buyer_email
  on public.access_orders(lower(trim(buyer_email)));

create index if not exists idx_access_orders_local_access_date_status
  on public.access_orders(local_id, access_date, status)
  where source_type = 'local';

create index if not exists idx_access_orders_event_access_date_status
  on public.access_orders(event_id, access_date, status)
  where source_type = 'event';

create index if not exists idx_access_orders_status_expires_at
  on public.access_orders(status, expires_at);

create table if not exists public.access_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.access_orders(id) on delete restrict,
  access_ticket_type_id uuid not null references public.access_ticket_types(id) on delete restrict,
  name_snapshot text not null,
  payment_kind text not null,
  unit_price_gs bigint not null,
  currency text not null default 'PYG',
  quantity integer not null,
  entries_per_unit integer not null,
  subtotal_gs bigint not null,
  created_at timestamptz not null default now(),
  constraint access_order_items_order_ticket_type_unique
    unique (order_id, access_ticket_type_id),
  constraint access_order_items_entry_alignment_unique
    unique (id, order_id, access_ticket_type_id),
  constraint access_order_items_name_snapshot_non_empty_chk
    check (char_length(trim(name_snapshot)) > 0),
  constraint access_order_items_payment_kind_chk
    check (payment_kind in ('paid', 'free_pass')),
  constraint access_order_items_payment_kind_price_chk
    check (
      (payment_kind = 'free_pass' and unit_price_gs = 0)
      or
      (payment_kind = 'paid' and unit_price_gs > 0)
    ),
  constraint access_order_items_unit_price_gs_non_negative_chk
    check (unit_price_gs >= 0),
  constraint access_order_items_currency_chk
    check (currency = 'PYG'),
  constraint access_order_items_quantity_positive_chk
    check (quantity > 0),
  constraint access_order_items_entries_per_unit_positive_chk
    check (entries_per_unit > 0),
  constraint access_order_items_subtotal_gs_chk
    check (subtotal_gs = unit_price_gs * quantity)
);

create index if not exists idx_access_order_items_order_id
  on public.access_order_items(order_id);

create index if not exists idx_access_order_items_access_ticket_type_id
  on public.access_order_items(access_ticket_type_id);

create table if not exists public.access_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.access_orders(id) on delete restrict,
  order_item_id uuid not null,
  access_ticket_type_id uuid not null,
  unit_index integer not null,
  checkin_token uuid not null default gen_random_uuid(),
  attendee_name text not null,
  attendee_last_name text not null,
  attendee_email text not null,
  attendee_phone text not null,
  attendee_document text not null,
  status text not null default 'issued',
  checkin_status text not null default 'unused',
  access_date date not null,
  used_at timestamptz null,
  used_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  email_status text not null default 'not_sent',
  email_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint access_entries_order_item_alignment_fk
    foreign key (order_item_id, order_id, access_ticket_type_id)
    references public.access_order_items(id, order_id, access_ticket_type_id)
    on delete restrict,
  constraint access_entries_order_access_date_alignment_fk
    foreign key (order_id, access_date)
    references public.access_orders(id, access_date)
    on delete restrict,
  constraint access_entries_checkin_token_unique
    unique (checkin_token),
  constraint access_entries_order_item_unit_index_unique
    unique (order_item_id, unit_index),
  constraint access_entries_unit_index_positive_chk
    check (unit_index > 0),
  constraint access_entries_attendee_name_non_empty_chk
    check (char_length(trim(attendee_name)) > 0),
  constraint access_entries_attendee_last_name_non_empty_chk
    check (char_length(trim(attendee_last_name)) > 0),
  constraint access_entries_attendee_email_non_empty_chk
    check (char_length(trim(attendee_email)) > 0),
  constraint access_entries_attendee_phone_non_empty_chk
    check (char_length(trim(attendee_phone)) > 0),
  constraint access_entries_attendee_document_non_empty_chk
    check (char_length(trim(attendee_document)) > 0),
  constraint access_entries_status_chk
    check (status in ('issued', 'voided')),
  constraint access_entries_checkin_status_chk
    check (checkin_status in ('unused', 'used')),
  constraint access_entries_email_status_chk
    check (email_status in ('not_sent', 'sent', 'failed')),
  constraint access_entries_checkin_used_at_chk
    check (
      (checkin_status = 'used' and used_at is not null)
      or
      (checkin_status = 'unused' and used_at is null)
    ),
  constraint access_entries_voided_not_used_chk
    check (not (status = 'voided' and checkin_status = 'used')),
  constraint access_entries_voided_at_chk
    check (
      (status = 'voided' and voided_at is not null)
      or
      (status = 'issued' and voided_at is null)
    ),
  constraint access_entries_email_sent_at_chk
    check (email_status <> 'sent' or email_sent_at is not null)
);

create index if not exists idx_access_entries_order_id
  on public.access_entries(order_id);

create index if not exists idx_access_entries_order_item_id
  on public.access_entries(order_item_id);

create index if not exists idx_access_entries_ticket_type_access_date
  on public.access_entries(access_ticket_type_id, access_date);

create index if not exists idx_access_entries_access_date_status_checkin
  on public.access_entries(access_date, status, checkin_status);

create index if not exists idx_access_entries_lower_attendee_email
  on public.access_entries(lower(trim(attendee_email)));

alter table public.access_orders enable row level security;
alter table public.access_order_items enable row level security;
alter table public.access_entries enable row level security;

revoke all privileges on table public.access_orders from anon;
revoke all privileges on table public.access_orders from authenticated;

revoke all privileges on table public.access_order_items from anon;
revoke all privileges on table public.access_order_items from authenticated;

revoke all privileges on table public.access_entries from anon;
revoke all privileges on table public.access_entries from authenticated;

grant select, insert, update, delete on table public.access_orders to service_role;
grant select, insert, update, delete on table public.access_order_items to service_role;
grant select, insert, update, delete on table public.access_entries to service_role;

commit;
