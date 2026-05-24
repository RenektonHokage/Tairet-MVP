begin;

create extension if not exists pgcrypto;

create table if not exists public.operational_activity_events (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  actor_type text not null,
  actor_user_id uuid null,
  actor_role text null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operational_activity_events_entity_type_chk
    check (entity_type in ('order', 'reservation')),
  constraint operational_activity_events_actor_type_chk
    check (actor_type in ('panel_user', 'customer', 'system')),
  constraint operational_activity_events_actor_role_chk
    check (actor_role is null or actor_role in ('owner', 'staff')),
  constraint operational_activity_events_event_type_non_empty_chk
    check (char_length(trim(event_type)) > 0),
  constraint operational_activity_events_message_non_empty_chk
    check (char_length(trim(message)) > 0)
);

create index if not exists idx_operational_activity_events_entity
  on public.operational_activity_events(local_id, entity_type, entity_id, created_at desc);

create index if not exists idx_operational_activity_events_local_created
  on public.operational_activity_events(local_id, created_at desc);

create index if not exists idx_operational_activity_events_type_created
  on public.operational_activity_events(local_id, event_type, created_at desc);

alter table public.operational_activity_events enable row level security;

revoke all privileges on table public.operational_activity_events from anon;
revoke all privileges on table public.operational_activity_events from authenticated;

commit;
