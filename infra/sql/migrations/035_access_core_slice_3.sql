begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_ticket_types'::regclass
      and conname = 'access_ticket_types_id_local_id_unique'
  ) then
    alter table public.access_ticket_types
      add constraint access_ticket_types_id_local_id_unique
      unique (id, local_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_ticket_types'::regclass
      and conname = 'access_ticket_types_id_event_id_unique'
  ) then
    alter table public.access_ticket_types
      add constraint access_ticket_types_id_event_id_unique
      unique (id, event_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_orders'::regclass
      and conname = 'access_orders_id_local_id_unique'
  ) then
    alter table public.access_orders
      add constraint access_orders_id_local_id_unique
      unique (id, local_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_orders'::regclass
      and conname = 'access_orders_id_event_id_unique'
  ) then
    alter table public.access_orders
      add constraint access_orders_id_event_id_unique
      unique (id, event_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.access_order_items'::regclass
      and conname = 'access_order_items_id_quantity_unique'
  ) then
    alter table public.access_order_items
      add constraint access_order_items_id_quantity_unique
      unique (id, quantity);
  end if;
end $$;

create table if not exists public.access_stock_limits (
  id uuid primary key default gen_random_uuid(),
  access_ticket_type_id uuid not null references public.access_ticket_types(id) on delete restrict,
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  access_date date not null,
  stock_mode text not null,
  capacity integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_stock_limits_ticket_type_date_unique
    unique (access_ticket_type_id, access_date),
  constraint access_stock_limits_ticket_type_local_alignment_fk
    foreign key (access_ticket_type_id, local_id)
    references public.access_ticket_types(id, local_id)
    on delete restrict,
  constraint access_stock_limits_ticket_type_event_alignment_fk
    foreign key (access_ticket_type_id, event_id)
    references public.access_ticket_types(id, event_id)
    on delete restrict,
  constraint access_stock_limits_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_stock_limits_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_stock_limits_stock_mode_chk
    check (stock_mode in ('unlimited', 'limited')),
  constraint access_stock_limits_capacity_chk
    check (
      (stock_mode = 'unlimited' and capacity is null)
      or
      (stock_mode = 'limited' and capacity is not null and capacity >= 0)
    )
);

create index if not exists idx_access_stock_limits_local_access_date
  on public.access_stock_limits(local_id, access_date)
  where source_type = 'local';

create index if not exists idx_access_stock_limits_event_access_date
  on public.access_stock_limits(event_id, access_date)
  where source_type = 'event';

create table if not exists public.access_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.access_orders(id) on delete restrict,
  order_item_id uuid not null references public.access_order_items(id) on delete restrict,
  access_ticket_type_id uuid not null references public.access_ticket_types(id) on delete restrict,
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  access_date date not null,
  quantity integer not null,
  status text not null default 'reserved',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz null,
  constraint access_stock_reservations_order_item_unique
    unique (order_item_id),
  constraint access_stock_reservations_order_item_alignment_fk
    foreign key (order_item_id, order_id, access_ticket_type_id)
    references public.access_order_items(id, order_id, access_ticket_type_id)
    on delete restrict,
  constraint access_stock_reservations_order_access_date_alignment_fk
    foreign key (order_id, access_date)
    references public.access_orders(id, access_date)
    on delete restrict,
  constraint access_stock_reservations_order_local_alignment_fk
    foreign key (order_id, local_id)
    references public.access_orders(id, local_id)
    on delete restrict,
  constraint access_stock_reservations_order_event_alignment_fk
    foreign key (order_id, event_id)
    references public.access_orders(id, event_id)
    on delete restrict,
  constraint access_stock_reservations_ticket_type_local_alignment_fk
    foreign key (access_ticket_type_id, local_id)
    references public.access_ticket_types(id, local_id)
    on delete restrict,
  constraint access_stock_reservations_ticket_type_event_alignment_fk
    foreign key (access_ticket_type_id, event_id)
    references public.access_ticket_types(id, event_id)
    on delete restrict,
  constraint access_stock_reservations_stock_limit_alignment_fk
    foreign key (access_ticket_type_id, access_date)
    references public.access_stock_limits(access_ticket_type_id, access_date)
    on delete restrict,
  constraint access_stock_reservations_order_item_quantity_fk
    foreign key (order_item_id, quantity)
    references public.access_order_items(id, quantity)
    on delete restrict,
  constraint access_stock_reservations_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_stock_reservations_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_stock_reservations_quantity_positive_chk
    check (quantity > 0),
  constraint access_stock_reservations_status_chk
    check (status in ('reserved', 'consumed', 'released', 'expired', 'manual_hold')),
  constraint access_stock_reservations_released_at_chk
    check (
      (status in ('released', 'expired') and released_at is not null)
      or
      (status in ('reserved', 'consumed', 'manual_hold') and released_at is null)
    ),
  constraint access_stock_reservations_expires_at_chk
    check (expires_at > created_at)
);

create index if not exists idx_access_stock_reservations_ticket_date_status_expires
  on public.access_stock_reservations(access_ticket_type_id, access_date, status, expires_at);

create index if not exists idx_access_stock_reservations_order_id
  on public.access_stock_reservations(order_id);

create index if not exists idx_access_stock_reservations_status_expires_at
  on public.access_stock_reservations(status, expires_at);

create index if not exists idx_access_stock_reservations_local_date_status
  on public.access_stock_reservations(local_id, access_date, status)
  where source_type = 'local';

create index if not exists idx_access_stock_reservations_event_date_status
  on public.access_stock_reservations(event_id, access_date, status)
  where source_type = 'event';

alter table public.access_stock_limits enable row level security;
alter table public.access_stock_reservations enable row level security;

revoke all privileges on table public.access_stock_limits from anon;
revoke all privileges on table public.access_stock_limits from authenticated;

revoke all privileges on table public.access_stock_reservations from anon;
revoke all privileges on table public.access_stock_reservations from authenticated;

grant select, insert, update, delete on table public.access_stock_limits to service_role;
grant select, insert, update, delete on table public.access_stock_reservations to service_role;

commit;
