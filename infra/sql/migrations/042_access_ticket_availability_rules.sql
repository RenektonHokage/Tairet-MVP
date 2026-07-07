begin;

create table if not exists public.access_ticket_availability_rules (
  id uuid primary key default gen_random_uuid(),
  access_ticket_type_id uuid not null references public.access_ticket_types(id) on delete restrict,
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  name text null,
  valid_from date not null,
  valid_to date not null,
  active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_ticket_availability_rules_ticket_type_local_alignment_fk
    foreign key (access_ticket_type_id, local_id)
    references public.access_ticket_types(id, local_id)
    on delete restrict,
  constraint access_ticket_availability_rules_ticket_type_event_alignment_fk
    foreign key (access_ticket_type_id, event_id)
    references public.access_ticket_types(id, event_id)
    on delete restrict,
  constraint access_ticket_availability_rules_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_ticket_availability_rules_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_ticket_availability_rules_date_range_chk
    check (valid_from <= valid_to)
);

create table if not exists public.access_ticket_availability_rule_weekdays (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.access_ticket_availability_rules(id) on delete cascade,
  iso_weekday integer not null,
  stock_mode text not null,
  capacity integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_ticket_availability_rule_weekdays_rule_weekday_unique
    unique (rule_id, iso_weekday),
  constraint access_ticket_availability_rule_weekdays_iso_weekday_chk
    check (iso_weekday between 1 and 7),
  constraint access_ticket_availability_rule_weekdays_stock_mode_chk
    check (stock_mode in ('unlimited', 'limited')),
  constraint access_ticket_availability_rule_weekdays_capacity_chk
    check (
      (stock_mode = 'unlimited' and capacity is null)
      or
      (stock_mode = 'limited' and capacity is not null and capacity > 0)
    )
);

create table if not exists public.access_ticket_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  access_ticket_type_id uuid not null references public.access_ticket_types(id) on delete restrict,
  source_type text not null,
  local_id uuid null references public.locals(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  access_date date not null,
  exception_mode text not null,
  capacity integer null,
  reason text null,
  active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_ticket_availability_exceptions_ticket_type_local_alignment_fk
    foreign key (access_ticket_type_id, local_id)
    references public.access_ticket_types(id, local_id)
    on delete restrict,
  constraint access_ticket_availability_exceptions_ticket_type_event_alignment_fk
    foreign key (access_ticket_type_id, event_id)
    references public.access_ticket_types(id, event_id)
    on delete restrict,
  constraint access_ticket_availability_exceptions_source_type_chk
    check (source_type in ('local', 'event')),
  constraint access_ticket_availability_exceptions_source_consistency_chk
    check (
      (source_type = 'local' and local_id is not null and event_id is null)
      or
      (source_type = 'event' and event_id is not null and local_id is null)
    ),
  constraint access_ticket_availability_exceptions_exception_mode_chk
    check (exception_mode in ('closed', 'limited', 'unlimited')),
  constraint access_ticket_availability_exceptions_capacity_chk
    check (
      (exception_mode in ('closed', 'unlimited') and capacity is null)
      or
      (exception_mode = 'limited' and capacity is not null and capacity > 0)
    )
);

create unique index if not exists idx_access_ticket_availability_rules_active_ticket_unique
  on public.access_ticket_availability_rules(access_ticket_type_id)
  where active = true and deleted_at is null;

create index if not exists idx_access_ticket_availability_rules_local_ticket_active_range
  on public.access_ticket_availability_rules(
    local_id,
    access_ticket_type_id,
    active,
    valid_from,
    valid_to
  )
  where source_type = 'local' and deleted_at is null;

create index if not exists idx_access_ticket_availability_rules_event_ticket_active_range
  on public.access_ticket_availability_rules(
    event_id,
    access_ticket_type_id,
    active,
    valid_from,
    valid_to
  )
  where source_type = 'event' and deleted_at is null;

create index if not exists idx_access_ticket_availability_rule_weekdays_rule_id
  on public.access_ticket_availability_rule_weekdays(rule_id);

create unique index if not exists idx_access_ticket_availability_exceptions_active_ticket_date_unique
  on public.access_ticket_availability_exceptions(access_ticket_type_id, access_date)
  where active = true and deleted_at is null;

create index if not exists idx_access_ticket_availability_exceptions_local_ticket_date
  on public.access_ticket_availability_exceptions(local_id, access_ticket_type_id, access_date)
  where source_type = 'local' and deleted_at is null;

create index if not exists idx_access_ticket_availability_exceptions_event_ticket_date
  on public.access_ticket_availability_exceptions(event_id, access_ticket_type_id, access_date)
  where source_type = 'event' and deleted_at is null;

comment on table public.access_ticket_availability_rules is
  'Durable Access Core availability rules. Backend materializes effective stock into access_stock_limits.';

comment on table public.access_ticket_availability_rule_weekdays is
  'Weekday stock settings for durable Access Core availability rules. ISO weekdays: 1 Monday through 7 Sunday.';

comment on table public.access_ticket_availability_exceptions is
  'Date-level overrides for Access Core availability. closed is materialized by backend as limited capacity 0 in access_stock_limits.';

alter table public.access_ticket_availability_rules enable row level security;
alter table public.access_ticket_availability_rule_weekdays enable row level security;
alter table public.access_ticket_availability_exceptions enable row level security;

revoke all privileges on table public.access_ticket_availability_rules from public;
revoke all privileges on table public.access_ticket_availability_rules from anon;
revoke all privileges on table public.access_ticket_availability_rules from authenticated;

revoke all privileges on table public.access_ticket_availability_rule_weekdays from public;
revoke all privileges on table public.access_ticket_availability_rule_weekdays from anon;
revoke all privileges on table public.access_ticket_availability_rule_weekdays from authenticated;

revoke all privileges on table public.access_ticket_availability_exceptions from public;
revoke all privileges on table public.access_ticket_availability_exceptions from anon;
revoke all privileges on table public.access_ticket_availability_exceptions from authenticated;

grant select, insert, update, delete on table public.access_ticket_availability_rules to service_role;
grant select, insert, update, delete on table public.access_ticket_availability_rule_weekdays to service_role;
grant select, insert, update, delete on table public.access_ticket_availability_exceptions to service_role;

commit;
