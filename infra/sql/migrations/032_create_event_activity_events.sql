begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_order_items'::regclass
      and conname = 'event_order_items_id_event_id_key'
  ) then
    alter table public.event_order_items
      add constraint event_order_items_id_event_id_key
      unique (id, event_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_order_entries'::regclass
      and conname = 'event_order_entries_id_event_id_key'
  ) then
    alter table public.event_order_entries
      add constraint event_order_entries_id_event_id_key
      unique (id, event_id);
  end if;
end $$;

-- Event activity is event_id scoped and intentionally separate from operational_activity_events.
-- Composite FKs use column-list SET NULL so event_id remains non-null.
create table if not exists public.event_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_order_id uuid null,
  event_order_item_id uuid null,
  event_order_entry_id uuid null,
  event_ticket_type_id uuid null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  source text null,
  actor_type text not null,
  actor_auth_user_id uuid null,
  actor_role text null,
  actor_display_name text null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_activity_events_order_event_fk
    foreign key (event_order_id, event_id)
    references public.event_orders(id, event_id)
    on delete set null (event_order_id),
  constraint event_activity_events_order_item_event_fk
    foreign key (event_order_item_id, event_id)
    references public.event_order_items(id, event_id)
    on delete set null (event_order_item_id),
  constraint event_activity_events_order_entry_event_fk
    foreign key (event_order_entry_id, event_id)
    references public.event_order_entries(id, event_id)
    on delete set null (event_order_entry_id),
  constraint event_activity_events_ticket_type_event_fk
    foreign key (event_ticket_type_id, event_id)
    references public.event_ticket_types(id, event_id)
    on delete set null (event_ticket_type_id),
  constraint event_activity_events_entity_type_chk
    check (entity_type in ('event_order', 'event_order_entry', 'event_email', 'event_checkin')),
  constraint event_activity_events_action_chk
    check (
      action in (
        'event_order_manual_issued',
        'event_entry_issued',
        'event_entry_email_sent',
        'event_entry_email_failed',
        'event_entry_checked_in',
        'event_entry_already_used_attempt',
        'event_entry_outside_window_attempt',
        'event_entry_voided_attempt',
        'event_entry_invalid_token_attempt'
      )
    ),
  constraint event_activity_events_actor_type_chk
    check (actor_type in ('event_panel_user', 'system')),
  constraint event_activity_events_actor_role_chk
    check (actor_role is null or actor_role in ('owner', 'staff')),
  constraint event_activity_events_source_chk
    check (source is null or source in ('qr', 'manual', 'automatic_email', 'manual_email', 'system')),
  constraint event_activity_events_entity_type_non_empty_chk
    check (char_length(trim(entity_type)) > 0),
  constraint event_activity_events_action_non_empty_chk
    check (char_length(trim(action)) > 0),
  constraint event_activity_events_actor_type_non_empty_chk
    check (char_length(trim(actor_type)) > 0),
  constraint event_activity_events_message_non_empty_chk
    check (char_length(trim(message)) > 0),
  constraint event_activity_events_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object'),
  constraint event_activity_events_actor_display_name_chk
    check (
      actor_display_name is null
      or char_length(trim(actor_display_name)) between 1 and 80
    ),
  constraint event_activity_events_actor_consistency_chk
    check (
      (
        actor_type = 'system'
        and actor_auth_user_id is null
        and actor_role is null
      )
      or (
        actor_type = 'event_panel_user'
        and actor_auth_user_id is not null
        and actor_role in ('owner', 'staff')
      )
    )
);

comment on table public.event_activity_events is
  'Event-scoped operational activity log. Intentionally separate from local operational_activity_events.';

comment on column public.event_activity_events.source is
  'Controlled operational source column. Do not duplicate source in metadata.';

comment on column public.event_activity_events.metadata is
  'Small sanitized JSON object. Do not store checkin tokens, QR payloads, raw requests, headers or PII.';

-- Source/action pairing remains enforced by the future TypeScript helper to avoid over-rigid MVP constraints.

create index if not exists idx_event_activity_events_event_created
  on public.event_activity_events(event_id, created_at desc);

create index if not exists idx_event_activity_events_entry_created
  on public.event_activity_events(event_id, event_order_entry_id, created_at desc);

create index if not exists idx_event_activity_events_order_created
  on public.event_activity_events(event_id, event_order_id, created_at desc);

create index if not exists idx_event_activity_events_action_created
  on public.event_activity_events(event_id, action, created_at desc);

create index if not exists idx_event_activity_events_entity_type_created
  on public.event_activity_events(event_id, entity_type, created_at desc);

create index if not exists idx_event_activity_events_source_created
  on public.event_activity_events(event_id, source, created_at desc);

create index if not exists idx_event_activity_events_ticket_type_created
  on public.event_activity_events(event_id, event_ticket_type_id, created_at desc);

alter table public.event_activity_events enable row level security;

revoke all privileges on table public.event_activity_events from public;
revoke all privileges on table public.event_activity_events from anon;
revoke all privileges on table public.event_activity_events from authenticated;

grant select, insert, update, delete on table public.event_activity_events to service_role;

commit;
