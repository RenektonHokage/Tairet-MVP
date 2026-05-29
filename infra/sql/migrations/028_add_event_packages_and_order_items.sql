begin;

create extension if not exists pgcrypto;

alter table public.event_ticket_types
  add column if not exists sales_unit_type text not null default 'single_entry';

alter table public.event_ticket_types
  add column if not exists entries_per_unit integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_ticket_types'::regclass
      and conname = 'event_ticket_types_sales_unit_type_chk'
  ) then
    alter table public.event_ticket_types
      add constraint event_ticket_types_sales_unit_type_chk
      check (sales_unit_type in ('single_entry', 'package'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_ticket_types'::regclass
      and conname = 'event_ticket_types_entries_per_unit_positive_chk'
  ) then
    alter table public.event_ticket_types
      add constraint event_ticket_types_entries_per_unit_positive_chk
      check (entries_per_unit >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_ticket_types'::regclass
      and conname = 'event_ticket_types_sales_unit_entries_chk'
  ) then
    alter table public.event_ticket_types
      add constraint event_ticket_types_sales_unit_entries_chk
      check (
        (sales_unit_type = 'single_entry' and entries_per_unit = 1)
        or (sales_unit_type = 'package' and entries_per_unit > 1)
      );
  end if;
end $$;

create table if not exists public.event_order_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  event_order_id uuid not null,
  event_ticket_type_id uuid not null,
  ticket_name text not null,
  sales_unit_type text not null,
  quantity integer not null,
  unit_price_amount bigint not null,
  currency text not null default 'PYG',
  entries_per_unit integer not null,
  total_amount bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_order_items_order_event_fk
    foreign key (event_order_id, event_id)
    references public.event_orders(id, event_id)
    on delete restrict,
  constraint event_order_items_ticket_type_event_fk
    foreign key (event_ticket_type_id, event_id)
    references public.event_ticket_types(id, event_id)
    on delete restrict,
  constraint event_order_items_entry_alignment_key
    unique (id, event_id, event_order_id, event_ticket_type_id),
  constraint event_order_items_ticket_name_non_empty_chk
    check (char_length(trim(ticket_name)) > 0),
  constraint event_order_items_sales_unit_type_chk
    check (sales_unit_type in ('single_entry', 'package')),
  constraint event_order_items_quantity_positive_chk
    check (quantity > 0),
  constraint event_order_items_unit_price_non_negative_chk
    check (unit_price_amount >= 0),
  constraint event_order_items_currency_chk
    check (currency = 'PYG'),
  constraint event_order_items_entries_per_unit_positive_chk
    check (entries_per_unit >= 1),
  constraint event_order_items_total_amount_non_negative_chk
    check (total_amount >= 0),
  constraint event_order_items_total_amount_consistency_chk
    check (total_amount = quantity * unit_price_amount)
);

-- Event order items store the commercial line snapshot.
-- Event order entries remain the per-person QR/check-in units.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_order_items'::regclass
      and conname = 'event_order_items_sales_unit_entries_chk'
  ) then
    alter table public.event_order_items
      add constraint event_order_items_sales_unit_entries_chk
      check (
        (sales_unit_type = 'single_entry' and entries_per_unit = 1)
        or (sales_unit_type = 'package' and entries_per_unit > 1)
      );
  end if;
end $$;

alter table public.event_order_entries
  add column if not exists event_order_item_id uuid;

alter table public.event_order_entries
  alter column event_order_item_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_order_entries'::regclass
      and conname = 'event_order_entries_order_item_alignment_fk'
  ) then
    alter table public.event_order_entries
      add constraint event_order_entries_order_item_alignment_fk
      foreign key (
        event_order_item_id,
        event_id,
        event_order_id,
        event_ticket_type_id
      )
      references public.event_order_items (
        id,
        event_id,
        event_order_id,
        event_ticket_type_id
      )
      on delete restrict;
  end if;
end $$;

create index if not exists idx_event_order_items_event_order
  on public.event_order_items(event_id, event_order_id);

create index if not exists idx_event_order_items_event_ticket_type
  on public.event_order_items(event_id, event_ticket_type_id);

create index if not exists idx_event_order_items_event_created
  on public.event_order_items(event_id, created_at desc);

create index if not exists idx_event_ticket_types_event_sales_unit
  on public.event_ticket_types(event_id, sales_unit_type);

create index if not exists idx_event_order_entries_event_order_item
  on public.event_order_entries(event_id, event_order_item_id);

alter table public.event_order_items enable row level security;

revoke all privileges on table public.event_order_items from anon;
revoke all privileges on table public.event_order_items from authenticated;

commit;
