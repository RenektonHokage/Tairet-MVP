begin;
-- Applying this migration requires a quiesce/maintenance window: these locks
-- can block checkout, payment callbacks, issuance, and legacy email updates.
-- Lock source tables once, in deterministic order, before any source read or
-- trigger DDL. SHARE ROW EXCLUSIVE also avoids later trigger-lock upgrades.
lock table
  public.access_orders,
  public.payment_attempts,
  public.access_order_items,
  public.access_entries
in share row exclusive mode;


-- Access Core Slice 3B.2
-- Durable, recoverable entry issuance and email-delivery persistence.

create table public.access_order_fulfillments (
  order_id uuid primary key
    references public.access_orders(id) on delete restrict,
  approved_payment_attempt_id uuid not null,
  expected_entries integer not null,
  issued_entries integer not null,
  issuance_status text not null,
  issuance_attempt_count integer not null default 0,
  issuance_last_attempt_at timestamptz null,
  issuance_next_attempt_at timestamptz null,
  issuance_last_error_code text null,
  issuance_last_error_at timestamptz null,
  issuance_review_status text not null default 'none',
  issuance_review_error_code text null,
  issuance_review_error_at timestamptz null,
  email_status text not null,
  email_generation integer not null default 1,
  email_next_attempt_at timestamptz null,
  email_sent_at timestamptz null,
  email_last_error_code text null,
  email_last_error_at timestamptz null,
  email_provider_message_id text null,
  reconcile_lease_token uuid null,
  reconcile_lease_expires_at timestamptz null,
  reconcile_lease_epoch bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_order_fulfillments_attempt_order_fk
    foreign key (approved_payment_attempt_id, order_id)
    references public.payment_attempts(id, order_id)
    on delete restrict,
  constraint access_order_fulfillments_counts_chk
    check (
      expected_entries >= 0
      and issued_entries >= 0
      and issuance_attempt_count >= 0
      and email_generation > 0
    ),
  constraint access_order_fulfillments_issuance_status_chk
    check (issuance_status in ('pending', 'partial', 'complete', 'manual_review')),
  constraint access_order_fulfillments_email_status_chk
    check (email_status in ('pending', 'processing', 'failed', 'sent', 'manual_review')),
  constraint access_order_fulfillments_attempt_clock_chk
    check (
      (issuance_attempt_count = 0 and issuance_last_attempt_at is null)
      or (issuance_attempt_count > 0 and issuance_last_attempt_at is not null)
    ),
  constraint access_order_fulfillments_issuance_error_pair_chk
    check (
      (issuance_last_error_code is null and issuance_last_error_at is null)
      or (
        issuance_last_error_code is not null
        and char_length(trim(issuance_last_error_code)) > 0
        and issuance_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_issuance_review_status_chk
    check (issuance_review_status in ('none', 'manual_review')),
  constraint access_order_fulfillments_issuance_review_error_chk
    check (
      (
        issuance_review_status = 'none'
        and issuance_review_error_code is null
        and issuance_review_error_at is null
      )
      or (
        issuance_review_status = 'manual_review'
        and issuance_review_error_code is not null
        and char_length(trim(issuance_review_error_code)) > 0
        and issuance_review_error_at is not null
      )
    ),
  constraint access_order_fulfillments_issuance_review_relation_chk
    check (
      issuance_review_status = 'none'
      or (
        issuance_review_status = 'manual_review'
        and issuance_status = 'complete'
      )
    ),
  constraint access_order_fulfillments_email_error_pair_chk
    check (
      (email_last_error_code is null and email_last_error_at is null)
      or (
        email_last_error_code is not null
        and char_length(trim(email_last_error_code)) > 0
        and email_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_lease_pair_chk
    check (
      (reconcile_lease_token is null and reconcile_lease_expires_at is null)
      or (
        reconcile_lease_token is not null
        and reconcile_lease_expires_at is not null
        and reconcile_lease_epoch > 0
      )
    ),
  constraint access_order_fulfillments_lease_epoch_chk
    check (reconcile_lease_epoch >= 0),
  constraint access_order_fulfillments_provider_message_chk
    check (
      email_provider_message_id is null
      or char_length(trim(email_provider_message_id)) > 0
    ),
  constraint access_order_fulfillments_issuance_state_chk
    check (
      (
        issuance_status = 'pending'
        and expected_entries > 0
        and issued_entries = 0
        and issuance_next_attempt_at is not null
      )
      or (
        issuance_status = 'partial'
        and expected_entries > 0
        and issued_entries > 0
        and issued_entries < expected_entries
        and issuance_next_attempt_at is not null
      )
      or (
        issuance_status = 'complete'
        and expected_entries > 0
        and issuance_next_attempt_at is null
        and issuance_last_error_code is null
        and issuance_last_error_at is null
        and (
          (
            issuance_review_status = 'none'
            and issued_entries = expected_entries
          )
          or issuance_review_status = 'manual_review'
        )
      )
      or (
        issuance_status = 'manual_review'
        and issuance_next_attempt_at is null
        and issuance_last_error_code is not null
        and issuance_last_error_at is not null
      )
    ),
  constraint access_order_fulfillments_email_state_chk
    check (
      (
        issuance_status <> 'complete'
        and email_status = 'pending'
        and email_next_attempt_at is null
        and email_sent_at is null
        and email_last_error_code is null
        and email_last_error_at is null
        and email_provider_message_id is null
      )
      or (
        issuance_status = 'complete'
        and (
          (
            email_status = 'pending'
            and email_next_attempt_at is not null
            and email_sent_at is null
            and email_last_error_code is null
            and email_last_error_at is null
            and email_provider_message_id is null
          )
          or (
            email_status = 'processing'
            and reconcile_lease_token is not null
            and reconcile_lease_expires_at is not null
            and email_next_attempt_at is null
            and email_sent_at is null
            and email_last_error_code is null
            and email_last_error_at is null
            and email_provider_message_id is null
          )
          or (
            email_status = 'failed'
            and email_next_attempt_at is not null
            and email_sent_at is null
            and email_last_error_code is not null
            and email_last_error_at is not null
            and email_provider_message_id is null
          )
          or (
            email_status = 'sent'
            and email_next_attempt_at is null
            and email_sent_at is not null
            and email_last_error_code is null
            and email_last_error_at is null
            and reconcile_lease_token is null
            and reconcile_lease_expires_at is null
          )
          or (
            email_status = 'manual_review'
            and email_next_attempt_at is null
            and email_sent_at is null
            and email_last_error_code is not null
            and email_last_error_at is not null
            and email_provider_message_id is null
            and reconcile_lease_token is null
            and reconcile_lease_expires_at is null
          )
        )
      )
    ),
  constraint access_order_fulfillments_timestamps_chk
    check (updated_at >= created_at)
);

alter table public.access_order_fulfillments owner to postgres;

create index idx_access_order_fulfillments_approved_attempt
  on public.access_order_fulfillments(approved_payment_attempt_id);

create index idx_access_order_fulfillments_issuance_due
  on public.access_order_fulfillments(issuance_next_attempt_at, order_id)
  where issuance_status in ('pending', 'partial');

create index idx_access_order_fulfillments_email_due
  on public.access_order_fulfillments(email_next_attempt_at, order_id)
  where issuance_status = 'complete'
    and email_status in ('pending', 'failed');

create index idx_access_order_fulfillments_lease_expiry
  on public.access_order_fulfillments(reconcile_lease_expires_at, order_id)
  where reconcile_lease_token is not null;

create table public.access_email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.access_order_fulfillments(order_id) on delete cascade,
  generation integer not null,
  trigger_type text not null,
  status text not null,
  idempotency_key text not null,
  idempotency_expires_at timestamptz not null,
  provider text not null,
  entry_ids uuid[] not null,
  entry_count integer not null,
  entry_snapshot_hash text not null,
  request_payload_hash text not null,
  template_version text not null,
  provider_message_id text null,
  error_code text null,
  requested_by_auth_user_id uuid null,
  provider_call_count integer not null default 1,
  last_provider_call_at timestamptz not null,
  started_at timestamptz not null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint access_email_delivery_attempts_generation_chk
    check (generation > 0),
  constraint access_email_delivery_attempts_call_count_chk
    check (provider_call_count > 0),
  constraint access_email_delivery_attempts_trigger_type_chk
    check (trigger_type in ('automatic', 'manual')),
  constraint access_email_delivery_attempts_status_chk
    check (status in ('processing', 'accepted', 'failed', 'ambiguous')),
  constraint access_email_delivery_attempts_key_non_empty_chk
    check (char_length(trim(idempotency_key)) > 0),
  constraint access_email_delivery_attempts_provider_non_empty_chk
    check (char_length(trim(provider)) > 0),
  constraint access_email_delivery_attempts_entry_count_chk
    check (
      entry_count > 0
      and cardinality(entry_ids) = entry_count
      and array_ndims(entry_ids) = 1
      and array_position(entry_ids, null) is null
    ),
  constraint access_email_delivery_attempts_snapshot_hash_chk
    check (entry_snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint access_email_delivery_attempts_request_hash_chk
    check (request_payload_hash ~ '^[0-9a-f]{64}$'),
  constraint access_email_delivery_attempts_template_version_chk
    check (
      char_length(trim(template_version)) > 0
      and template_version = trim(template_version)
    ),
  constraint access_email_delivery_attempts_window_chk
    check (idempotency_expires_at > started_at),
  constraint access_email_delivery_attempts_actor_chk
    check (
      (trigger_type = 'automatic' and requested_by_auth_user_id is null)
      or (trigger_type = 'manual' and requested_by_auth_user_id is not null)
    ),
  constraint access_email_delivery_attempts_state_chk
    check (
      (
        status = 'processing'
        and provider_message_id is null
        and error_code is null
        and finished_at is null
      )
      or (
        status = 'accepted'
        and provider_message_id is not null
        and char_length(trim(provider_message_id)) > 0
        and error_code is null
        and finished_at is not null
      )
      or (
        status = 'failed'
        and provider_message_id is null
        and error_code is not null
        and char_length(trim(error_code)) > 0
        and finished_at is not null
      )
      or (
        status = 'ambiguous'
        and provider_message_id is null
        and error_code is not null
        and char_length(trim(error_code)) > 0
        and finished_at is null
      )
    )
);

alter table public.access_email_delivery_attempts owner to postgres;

create unique index access_email_delivery_attempts_idempotency_key_uidx
  on public.access_email_delivery_attempts(idempotency_key);

create unique index access_email_delivery_attempts_live_generation_uidx
  on public.access_email_delivery_attempts(order_id, generation)
  where status in ('processing', 'ambiguous', 'accepted');

create unique index access_email_delivery_attempts_provider_message_uidx
  on public.access_email_delivery_attempts(provider, provider_message_id)
  where provider_message_id is not null;

create index idx_access_email_delivery_attempts_order_generation_created
  on public.access_email_delivery_attempts(order_id, generation, created_at);

alter table public.access_order_fulfillments enable row level security;
alter table public.access_email_delivery_attempts enable row level security;

revoke all privileges on table public.access_order_fulfillments
  from public, anon, authenticated, service_role;
revoke all privileges on table public.access_email_delivery_attempts
  from public, anon, authenticated, service_role;

grant select on table public.access_order_fulfillments to service_role;
grant select on table public.access_email_delivery_attempts to service_role;
revoke all privileges on table public.access_order_items
  from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.access_order_items from service_role;

do $$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.access_order_items from service_role';
  end if;
end;
$$;

grant select on table public.access_order_items to service_role;

-- Runtime writes remain available through the existing privileged checkout RPC.
alter function public.create_access_paid_checkout(
  text, uuid, uuid, date, jsonb, jsonb, text, text, integer
)
  owner to postgres;

do $$
declare
  v_checkout_oid oid := to_regprocedure(
    'public.create_access_paid_checkout(text,uuid,uuid,date,jsonb,jsonb,text,text,integer)'
  );
begin
  if v_checkout_oid is null
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_checkout_oid
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and pg_get_functiondef(pg_proc.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+public[.]access_order_items'
        and exists (
          select 1
          from unnest(coalesce(pg_proc.proconfig, array[]::text[])) as config(setting)
          where config.setting = 'search_path=public, pg_temp'
        )
    ) then
    raise exception
      'Migration 046 assertion failed: create_access_paid_checkout is not a safe postgres definer';
  end if;
end;
$$;

create or replace function public.access_core_entry_snapshot(p_order_id uuid)
returns table (
  entry_ids uuid[],
  entry_count integer,
  entry_snapshot_hash text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with snapshot_material as (
    select
      coalesce(
        array_agg(
          access_entries.id
          order by
            access_entries.order_item_id,
            access_entries.unit_index,
            access_entries.id
        ),
        array[]::uuid[]
      ) as entry_ids,
      count(*)::integer as entry_count,
      coalesce(
        jsonb_agg(
          jsonb_build_array(
            access_entries.id,
            access_entries.order_item_id,
            access_entries.access_ticket_type_id,
            access_entries.unit_index,
            access_entries.checkin_token,
            access_entries.attendee_name,
            access_entries.attendee_last_name,
            access_entries.access_date,
            access_entries.status,
            access_order_items.name_snapshot
          )
          order by
            access_entries.order_item_id,
            access_entries.unit_index,
            access_entries.id
        ),
        '[]'::jsonb
      ) as material
    from public.access_entries
    join public.access_order_items
      on access_order_items.id = access_entries.order_item_id
      and access_order_items.order_id = access_entries.order_id
      and access_order_items.access_ticket_type_id
        = access_entries.access_ticket_type_id
    where access_entries.order_id = p_order_id
  )
  select
    snapshot_material.entry_ids,
    snapshot_material.entry_count,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(snapshot_material.material::text, 'UTF8')
      ),
      'hex'
    )
  from snapshot_material;
$$;

alter function public.access_core_entry_snapshot(uuid) owner to postgres;
revoke all on function public.access_core_entry_snapshot(uuid)
  from public, anon, authenticated, service_role;


create or replace function public.guard_access_order_items_frozen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_status text;
  v_order_ids uuid[];
begin
  if session_user = 'postgres'
    and current_setting('app.access_core_allow_paid_item_cleanup', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_order_ids := array[new.order_id];
  elsif tg_op = 'DELETE' then
    v_order_ids := array[old.order_id];
  elsif old.order_id = new.order_id then
    v_order_ids := array[old.order_id];
  else
    select array_agg(order_id order by order_id)
    into v_order_ids
    from (
      select old.order_id as order_id
      union
      select new.order_id as order_id
    ) as affected_orders;
  end if;

  foreach v_order_id in array v_order_ids
  loop
    select access_orders.status
    into v_order_status
    from public.access_orders
    where access_orders.id = v_order_id
    for update;

    if found and (
      v_order_status = 'paid'
      or exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = v_order_id
          and payment_attempts.status = 'approved'
      )
    ) then
      raise exception using
        errcode = '55000',
        message = 'Access order items are frozen after payment approval';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function public.guard_access_order_items_frozen() owner to postgres;
revoke all on function public.guard_access_order_items_frozen()
  from public, anon, authenticated, service_role;

-- UPDATE/DELETE row triggers can enter after PostgreSQL has locked the item
-- row and then lock the parent order here. Runtime service_role DML is revoked;
-- administrative cleanup retains a residual deadlock risk and should be quiesced.
create trigger access_order_items_freeze_after_approval
before insert or update or delete
on public.access_order_items
for each row
execute function public.guard_access_order_items_frozen();

create or replace function public.guard_access_entries_fulfilled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_ids uuid[];
  v_issuance_status text;
begin
  if session_user = 'postgres'
    and current_setting(
      'app.access_core_allow_fulfillment_cleanup',
      true
    ) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Operational status, check-in, void, and legacy email projection remain
  -- writable after issuance completes.
  if tg_op = 'UPDATE'
    and new.id is not distinct from old.id
    and new.order_id is not distinct from old.order_id
    and new.order_item_id is not distinct from old.order_item_id
    and new.access_ticket_type_id is not distinct from old.access_ticket_type_id
    and new.unit_index is not distinct from old.unit_index
    and new.checkin_token is not distinct from old.checkin_token
    and new.attendee_name is not distinct from old.attendee_name
    and new.attendee_last_name is not distinct from old.attendee_last_name
    and new.attendee_email is not distinct from old.attendee_email
    and new.attendee_phone is not distinct from old.attendee_phone
    and new.attendee_document is not distinct from old.attendee_document
    and new.access_date is not distinct from old.access_date
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_order_ids := array[new.order_id];
  elsif tg_op = 'DELETE' then
    v_order_ids := array[old.order_id];
  elsif old.order_id = new.order_id then
    v_order_ids := array[old.order_id];
  else
    select array_agg(order_id order by order_id)
    into v_order_ids
    from (
      select old.order_id as order_id
      union
      select new.order_id as order_id
    ) as affected_orders;
  end if;

  foreach v_order_id in array v_order_ids
  loop
    -- The parent lock closes the INSERT race against the final issuance update.
    perform 1
    from public.access_orders
    where access_orders.id = v_order_id
    for update;

    select access_order_fulfillments.issuance_status
    into v_issuance_status
    from public.access_order_fulfillments
    where access_order_fulfillments.order_id = v_order_id
    for update;

    if found and v_issuance_status = 'complete' then
      raise exception using
        errcode = '55000',
        message = 'Fulfilled access entry identity is immutable';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function public.guard_access_entries_fulfilled() owner to postgres;
revoke all on function public.guard_access_entries_fulfilled()
  from public, anon, authenticated, service_role;

create trigger access_entries_freeze_after_fulfillment
before insert or update or delete
on public.access_entries
for each row
execute function public.guard_access_entries_fulfilled();

create or replace function public.guard_access_email_delivery_attempts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'DELETE' then
    if session_user = 'postgres'
      and current_setting('app.access_core_allow_fulfillment_cleanup', true) = 'on' then
      return old;
    end if;

    raise exception using
      errcode = '55000',
      message = 'Access email delivery attempts are append-only';
  end if;

  if new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.generation is distinct from old.generation
    or new.trigger_type is distinct from old.trigger_type
    or new.idempotency_key is distinct from old.idempotency_key
    or new.idempotency_expires_at is distinct from old.idempotency_expires_at
    or new.provider is distinct from old.provider
    or new.entry_ids is distinct from old.entry_ids
    or new.entry_count is distinct from old.entry_count
    or new.entry_snapshot_hash is distinct from old.entry_snapshot_hash
    or new.request_payload_hash is distinct from old.request_payload_hash
    or new.template_version is distinct from old.template_version
    or new.requested_by_auth_user_id is distinct from old.requested_by_auth_user_id
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '55000',
      message = 'Immutable access email delivery attempt fields cannot change';
  end if;

  if old.status in ('accepted', 'failed') then
    raise exception using
      errcode = '55000',
      message = 'Terminal access email delivery attempts cannot change';
  end if;

  if old.status = 'processing' and new.status in ('accepted', 'failed', 'ambiguous') then
    if new.provider_call_count is distinct from old.provider_call_count
      or new.last_provider_call_at is distinct from old.last_provider_call_at then
      raise exception using
        errcode = '55000',
        message = 'Provider call counters cannot change while recording an outcome';
    end if;
    return new;
  end if;

  if old.status = 'ambiguous' and new.status = 'processing' then
    if v_now >= old.idempotency_expires_at then
      raise exception using
        errcode = '55000',
        message = 'Expired idempotency window cannot be retried';
    end if;

    if new.provider_call_count <> old.provider_call_count + 1
      or new.last_provider_call_at <= old.last_provider_call_at
      or new.last_provider_call_at > v_now + interval '1 second'
      or new.last_provider_call_at >= old.idempotency_expires_at
      or new.error_code is not null
      or new.provider_message_id is not null
      or new.finished_at is not null then
      raise exception using
        errcode = '55000',
        message = 'Invalid ambiguous delivery retry transition';
    end if;
    return new;
  end if;

  raise exception using
    errcode = '55000',
    message = 'Invalid access email delivery attempt transition';
end;
$$;

alter function public.guard_access_email_delivery_attempts() owner to postgres;
revoke all on function public.guard_access_email_delivery_attempts()
  from public, anon, authenticated, service_role;

create trigger access_email_delivery_attempts_append_only
before update or delete
on public.access_email_delivery_attempts
for each row
execute function public.guard_access_email_delivery_attempts();

-- Backfill one authoritative fulfillment summary for each paid order with at
-- least one approved payment attempt. Existing business rows remain unchanged.
do $$
begin
  if exists (
    select 1
    from public.access_orders
    join public.access_order_items
      on access_order_items.order_id = access_orders.id
    where access_orders.status = 'paid'
      and exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = access_orders.id
          and payment_attempts.status = 'approved'
      )
    group by access_orders.id
    having sum(
      access_order_items.quantity::bigint
      * access_order_items.entries_per_unit::bigint
    ) > 2147483647
  ) then
    raise exception 'Migration 046 assertion failed: expected entry count overflow';
  end if;
end;
$$;

with
backfill_clock as (
  select transaction_timestamp() as observed_at
),
approved_ranked as (
  select
    payment_attempts.order_id,
    payment_attempts.id as payment_attempt_id,
    payment_attempts.provider,
    payment_attempts.provider_operation,
    count(*) over (partition by payment_attempts.order_id)::integer as approved_count,
    row_number() over (
      partition by payment_attempts.order_id
      order by
        payment_attempts.confirmed_at asc nulls last,
        payment_attempts.attempt_number asc,
        payment_attempts.id asc
    ) as approved_rank
  from public.payment_attempts
  join public.access_orders
    on access_orders.id = payment_attempts.order_id
  where access_orders.status = 'paid'
    and payment_attempts.status = 'approved'
),
approved_selected as (
  select
    order_id, payment_attempt_id, approved_count, provider, provider_operation
  from approved_ranked
  where approved_rank = 1
),
item_totals as (
  select
    access_order_items.order_id,
    count(*)::integer as item_count,
    coalesce(sum(
      access_order_items.quantity::bigint
      * access_order_items.entries_per_unit::bigint
    ), 0)
      as expected_entries
  from public.access_order_items
  group by access_order_items.order_id
),
entry_totals as (
  select
    access_entries.order_id,
    count(*)::integer as issued_entries,
    count(*) filter (where access_entries.email_status = 'sent')::integer as sent_count,
    count(*) filter (
      where access_entries.email_status = 'sent'
        and access_entries.email_sent_at is not null
    )::integer as valid_sent_count,
    count(*) filter (where access_entries.email_status = 'not_sent')::integer as not_sent_count,
    count(*) filter (where access_entries.email_status = 'failed')::integer as failed_count,
    count(distinct access_entries.email_status)::integer as email_status_count,
    count(*) filter (
      where access_entries.unit_index::bigint
        > access_order_items.quantity::bigint * access_order_items.entries_per_unit::bigint
    )::integer
      as invalid_unit_count,
    max(access_entries.email_sent_at) as max_email_sent_at
  from public.access_entries
  join public.access_order_items
    on access_order_items.id
      = access_entries.order_item_id
  group by access_entries.order_id
),
classified as (
  select
    access_orders.id as order_id,
    approved_selected.payment_attempt_id,
    approved_selected.approved_count,
    coalesce(item_totals.item_count, 0) as item_count,
    coalesce(item_totals.expected_entries, 0) as expected_entries,
    coalesce(entry_totals.issued_entries, 0) as issued_entries,
    coalesce(entry_totals.sent_count, 0) as sent_count,
    coalesce(entry_totals.valid_sent_count, 0) as valid_sent_count,
    coalesce(entry_totals.not_sent_count, 0) as not_sent_count,
    coalesce(entry_totals.failed_count, 0) as failed_count,
    coalesce(entry_totals.email_status_count, 0) as email_status_count,
    coalesce(entry_totals.invalid_unit_count, 0)
      as invalid_unit_count,
    entry_totals.max_email_sent_at,
    backfill_clock.observed_at,
    case
      when approved_selected.approved_count > 1 then 'manual_review'
      when approved_selected.provider <> 'bancard'
        or approved_selected.provider_operation <> 'single_buy'
        then 'manual_review'
      when coalesce(item_totals.item_count, 0) = 0 then 'manual_review'
      when coalesce(entry_totals.invalid_unit_count, 0) > 0
        then 'manual_review'
      when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
        then 'manual_review'
      when coalesce(entry_totals.issued_entries, 0) = coalesce(item_totals.expected_entries, 0)
        and coalesce(item_totals.expected_entries, 0) > 0 then 'complete'
      when coalesce(entry_totals.issued_entries, 0) = 0 then 'pending'
      else 'partial'
    end as issuance_status,
    case
      when approved_selected.approved_count > 1 then 'multiple_approved_payment_attempts'
      when approved_selected.provider <> 'bancard'
        or approved_selected.provider_operation <> 'single_buy'
        then 'unsupported_approved_provider'
      when coalesce(item_totals.item_count, 0) = 0 then 'items_not_found'
      when coalesce(entry_totals.invalid_unit_count, 0) > 0
        then 'entries_count_mismatch'
      when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
        then 'entries_count_mismatch'
      when coalesce(entry_totals.issued_entries, 0) > 0
        and coalesce(entry_totals.issued_entries, 0) < coalesce(item_totals.expected_entries, 0)
        then 'backfill_partial_entries'
      else null
    end as issuance_error_code
  from public.access_orders
  join approved_selected on approved_selected.order_id = access_orders.id
  left join item_totals on item_totals.order_id = access_orders.id
  left join entry_totals on entry_totals.order_id = access_orders.id
  cross join backfill_clock
  where access_orders.status = 'paid'
)
insert into public.access_order_fulfillments (
  order_id,
  approved_payment_attempt_id,
  expected_entries,
  issued_entries,
  issuance_status,
  issuance_attempt_count,
  issuance_last_attempt_at,
  issuance_next_attempt_at,
  issuance_last_error_code,
  issuance_last_error_at,
  issuance_review_status,
  issuance_review_error_code,
  issuance_review_error_at,
  email_status,
  email_generation,
  email_next_attempt_at,
  email_sent_at,
  email_last_error_code,
  email_last_error_at,
  email_provider_message_id,
  reconcile_lease_token,
  reconcile_lease_expires_at,
  created_at,
  updated_at
)
select
  classified.order_id,
  classified.payment_attempt_id,
  classified.expected_entries::integer,
  classified.issued_entries,
  classified.issuance_status,
  0,
  null,
  case
    when classified.issuance_status in ('pending', 'partial') then classified.observed_at
    else null
  end,
  classified.issuance_error_code,
  case when classified.issuance_error_code is not null then classified.observed_at else null end,
  'none',
  null,
  null,
  case
    when classified.issuance_status <> 'complete' then 'pending'
    when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
      then 'manual_review'
    when classified.email_status_count > 1 then 'manual_review'
    when classified.sent_count = classified.issued_entries and classified.issued_entries > 0
      then 'sent'
    when classified.not_sent_count = classified.issued_entries and classified.issued_entries > 0
      then 'pending'
    when classified.failed_count > 0 then 'manual_review'
    else 'manual_review'
  end,
  1,
  case
    when classified.issuance_status = 'complete'
      and classified.not_sent_count = classified.issued_entries
      and classified.issued_entries > 0
      then classified.observed_at
    else null
  end,
  case
    when classified.issuance_status = 'complete'
      and classified.sent_count = classified.issued_entries
      and classified.valid_sent_count = classified.sent_count
      and classified.issued_entries > 0
      then classified.max_email_sent_at
    else null
  end,
  case
    when classified.issuance_status <> 'complete' then null
    when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
      then 'legacy_sent_without_timestamp'
    when classified.email_status_count > 1 then 'legacy_email_mixed_state'
    when classified.failed_count > 0 then 'legacy_email_failed_ambiguous'
    when classified.sent_count = classified.issued_entries
      or classified.not_sent_count = classified.issued_entries then null
    else 'legacy_email_mixed_state'
  end,
  case
    when classified.issuance_status = 'complete' and (
      (classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count)
      or classified.email_status_count > 1
      or classified.failed_count > 0
      or not (
        classified.sent_count = classified.issued_entries
        or classified.not_sent_count = classified.issued_entries
      )
    ) then classified.observed_at
    else null
  end,
  null,
  null,
  null,
  classified.observed_at,
  classified.observed_at
from classified;

do $$
begin
  if exists (
    select 1
    from public.access_order_fulfillments
    left join public.payment_attempts
      on payment_attempts.id = access_order_fulfillments.approved_payment_attempt_id
      and payment_attempts.order_id = access_order_fulfillments.order_id
      and payment_attempts.status = 'approved'
    where payment_attempts.id is null
  ) then
    raise exception 'Migration 046 assertion failed: invalid approved payment attempt';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where expected_entries < 0 or issued_entries < 0
  ) then
    raise exception 'Migration 046 assertion failed: negative fulfillment counts';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where not (
      (issuance_status = 'pending' and expected_entries > 0 and issued_entries = 0)
      or (
        issuance_status = 'partial'
        and expected_entries > 0
        and issued_entries > 0
        and issued_entries < expected_entries
      )
      or (
        issuance_status = 'complete'
        and expected_entries > 0
        and (
          (
            issuance_review_status = 'none'
            and issued_entries = expected_entries
          )
          or issuance_review_status = 'manual_review'
        )
      )
      or issuance_status = 'manual_review'
    )
  ) then
    raise exception 'Migration 046 assertion failed: incompatible fulfillment state';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where not (
      (
        issuance_review_status = 'none'
        and issuance_review_error_code is null
        and issuance_review_error_at is null
      )
      or (
        issuance_review_status = 'manual_review'
        and issuance_status = 'complete'
        and issuance_review_error_code is not null
        and char_length(trim(issuance_review_error_code)) > 0
        and issuance_review_error_at is not null
      )
    )
  ) then
    raise exception 'Migration 046 assertion failed: incompatible issuance review state';
  end if;

  if exists (
    select 1
    from public.access_orders
    where access_orders.status = 'paid'
      and exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = access_orders.id
          and payment_attempts.status = 'approved'
      )
      and not exists (
        select 1
        from public.access_order_fulfillments
        where access_order_fulfillments.order_id = access_orders.id
      )
  ) then
    raise exception 'Migration 046 assertion failed: eligible paid order missing fulfillment';
  end if;
end;
$$;

-- Recompute the backfill from its locked source tables. This verifies the
-- chosen approved attempt, counts, exact expected-unit set, and legacy email
-- projection rather than merely rechecking fulfillment CHECK constraints.
do $$
begin
  if exists (
    with
    approved_ranked as (
      select
        payment_attempts.order_id,
        payment_attempts.id as payment_attempt_id,
        payment_attempts.provider,
        payment_attempts.provider_operation,
        count(*) over (
          partition by payment_attempts.order_id
        )::integer as approved_count,
        row_number() over (
          partition by payment_attempts.order_id
          order by
            payment_attempts.confirmed_at asc nulls last,
            payment_attempts.attempt_number asc,
            payment_attempts.id asc
        ) as approved_rank
      from public.payment_attempts
      join public.access_orders
        on access_orders.id = payment_attempts.order_id
      where access_orders.status = 'paid'
        and payment_attempts.status = 'approved'
    ),
    approved_selected as (
      select *
      from approved_ranked
      where approved_rank = 1
    ),
    item_totals as (
      select
        access_order_items.order_id,
        count(*)::integer as item_count,
        coalesce(sum(
          access_order_items.quantity::bigint
          * access_order_items.entries_per_unit::bigint
        ), 0) as expected_entries
      from public.access_order_items
      group by access_order_items.order_id
    ),
    expected_units as (
      select
        access_order_items.order_id,
        count(*)::integer as expected_unit_count,
        count(*) filter (
          where not exists (
            select 1
            from public.access_entries
            where access_entries.order_item_id = access_order_items.id
              and access_entries.unit_index::bigint = generated_unit.unit_index
          )
        )::integer as missing_expected_unit_count
      from public.access_order_items
      cross join lateral generate_series(
        1::bigint,
        access_order_items.quantity::bigint
          * access_order_items.entries_per_unit::bigint
      ) as generated_unit(unit_index)
      group by access_order_items.order_id
    ),
    entry_totals as (
      select
        access_entries.order_id,
        count(*)::integer as issued_entries,
        count(*) filter (
          where access_entries.email_status = 'sent'
        )::integer as sent_count,
        count(*) filter (
          where access_entries.email_status = 'sent'
            and access_entries.email_sent_at is not null
        )::integer as valid_sent_count,
        count(*) filter (
          where access_entries.email_status = 'not_sent'
        )::integer as not_sent_count,
        count(*) filter (
          where access_entries.email_status = 'failed'
        )::integer as failed_count,
        count(distinct access_entries.email_status)::integer
          as email_status_count,
        count(*) filter (
          where access_entries.unit_index::bigint
            > access_order_items.quantity::bigint
              * access_order_items.entries_per_unit::bigint
        )::integer as invalid_unit_count,
        max(access_entries.email_sent_at) as max_email_sent_at
      from public.access_entries
      join public.access_order_items
        on access_order_items.id = access_entries.order_item_id
      group by access_entries.order_id
    ),
    source_state as (
      select
        access_orders.id as order_id,
        approved_selected.payment_attempt_id,
        approved_selected.provider,
        approved_selected.provider_operation,
        approved_selected.approved_count,
        coalesce(item_totals.item_count, 0) as item_count,
        coalesce(item_totals.expected_entries, 0) as expected_entries,
        coalesce(expected_units.expected_unit_count, 0)
          as expected_unit_count,
        coalesce(expected_units.missing_expected_unit_count, 0)
          as missing_expected_unit_count,
        coalesce(entry_totals.issued_entries, 0) as issued_entries,
        coalesce(entry_totals.sent_count, 0) as sent_count,
        coalesce(entry_totals.valid_sent_count, 0) as valid_sent_count,
        coalesce(entry_totals.not_sent_count, 0) as not_sent_count,
        coalesce(entry_totals.failed_count, 0) as failed_count,
        coalesce(entry_totals.email_status_count, 0)
          as email_status_count,
        coalesce(entry_totals.invalid_unit_count, 0)
          as invalid_unit_count,
        entry_totals.max_email_sent_at,
        transaction_timestamp() as observed_at
      from public.access_orders
      join approved_selected
        on approved_selected.order_id = access_orders.id
      left join item_totals
        on item_totals.order_id = access_orders.id
      left join expected_units
        on expected_units.order_id = access_orders.id
      left join entry_totals
        on entry_totals.order_id = access_orders.id
      where access_orders.status = 'paid'
    ),
    classified as (
      select
        source_state.*,
        case
          when approved_count > 1 then 'manual_review'
          when provider <> 'bancard'
            or provider_operation <> 'single_buy' then 'manual_review'
          when item_count = 0 then 'manual_review'
          when invalid_unit_count > 0 then 'manual_review'
          when issued_entries > expected_entries then 'manual_review'
          when issued_entries = expected_entries
            and expected_entries > 0 then 'complete'
          when issued_entries = 0 then 'pending'
          else 'partial'
        end as expected_issuance_status,
        case
          when approved_count > 1
            then 'multiple_approved_payment_attempts'
          when provider <> 'bancard'
            or provider_operation <> 'single_buy'
            then 'unsupported_approved_provider'
          when item_count = 0 then 'items_not_found'
          when invalid_unit_count > 0
            or issued_entries > expected_entries
            then 'entries_count_mismatch'
          when issued_entries > 0 and issued_entries < expected_entries
            then 'backfill_partial_entries'
          else null
        end as expected_issuance_error_code
      from source_state
    ),
    expected_state as (
      select
        classified.*,
        case
          when expected_issuance_status <> 'complete' then 'pending'
          when sent_count > 0 and valid_sent_count <> sent_count
            then 'manual_review'
          when email_status_count > 1 then 'manual_review'
          when sent_count = issued_entries and issued_entries > 0 then 'sent'
          when not_sent_count = issued_entries and issued_entries > 0
            then 'pending'
          when failed_count > 0 then 'manual_review'
          else 'manual_review'
        end as expected_email_status,
        case
          when expected_issuance_status <> 'complete' then null
          when sent_count > 0 and valid_sent_count <> sent_count
            then 'legacy_sent_without_timestamp'
          when email_status_count > 1 then 'legacy_email_mixed_state'
          when failed_count > 0 then 'legacy_email_failed_ambiguous'
          when sent_count = issued_entries
            or not_sent_count = issued_entries then null
          else 'legacy_email_mixed_state'
        end as expected_email_error_code
      from classified
    )
    select 1
    from expected_state
    full join public.access_order_fulfillments as fulfillment
      on fulfillment.order_id = expected_state.order_id
    where expected_state.order_id is null
      or fulfillment.order_id is null
      or fulfillment.approved_payment_attempt_id
        is distinct from expected_state.payment_attempt_id
      or fulfillment.expected_entries
        is distinct from expected_state.expected_entries::integer
      or fulfillment.issued_entries
        is distinct from expected_state.issued_entries
      or fulfillment.issuance_status
        is distinct from expected_state.expected_issuance_status
      or fulfillment.issuance_attempt_count is distinct from 0
      or fulfillment.issuance_last_attempt_at is not null
      or fulfillment.issuance_next_attempt_at is distinct from case
        when expected_state.expected_issuance_status in ('pending', 'partial')
          then expected_state.observed_at
        else null
      end
      or fulfillment.issuance_last_error_code
        is distinct from expected_state.expected_issuance_error_code
      or fulfillment.issuance_last_error_at is distinct from case
        when expected_state.expected_issuance_error_code is not null
          then expected_state.observed_at
        else null
      end
      or fulfillment.issuance_review_status is distinct from 'none'
      or fulfillment.issuance_review_error_code is not null
      or fulfillment.issuance_review_error_at is not null
      or fulfillment.email_status
        is distinct from expected_state.expected_email_status
      or fulfillment.email_generation is distinct from 1
      or fulfillment.email_next_attempt_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and expected_state.not_sent_count = expected_state.issued_entries
          and expected_state.issued_entries > 0
          then expected_state.observed_at
        else null
      end
      or fulfillment.email_sent_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and expected_state.sent_count = expected_state.issued_entries
          and expected_state.valid_sent_count = expected_state.sent_count
          and expected_state.issued_entries > 0
          then expected_state.max_email_sent_at
        else null
      end
      or fulfillment.email_last_error_code
        is distinct from expected_state.expected_email_error_code
      or fulfillment.email_last_error_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and (
            (
              expected_state.sent_count > 0
              and expected_state.valid_sent_count <> expected_state.sent_count
            )
            or expected_state.email_status_count > 1
            or expected_state.failed_count > 0
            or not (
              expected_state.sent_count = expected_state.issued_entries
              or expected_state.not_sent_count = expected_state.issued_entries
            )
          ) then expected_state.observed_at
        else null
      end
      or fulfillment.email_provider_message_id is not null
      or fulfillment.reconcile_lease_token is not null
      or fulfillment.reconcile_lease_expires_at is not null
      or fulfillment.reconcile_lease_epoch is distinct from 0
      or expected_state.expected_unit_count
        is distinct from expected_state.expected_entries::integer
      or (
        expected_state.expected_issuance_status = 'complete'
        and expected_state.missing_expected_unit_count <> 0
      )
  ) then
    raise exception
      'Migration 046 assertion failed: fulfillment backfill differs from source tables';
  end if;
end;
$$;

create or replace function public.reconcile_access_order_fulfillment(
  p_order_id uuid,
  p_payment_attempt_id uuid,
  p_reconcile_lease_token uuid default null,
  p_reconcile_lease_epoch bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_now timestamptz;
  v_approved_count integer := 0;
  v_approved_attempt_id uuid;
  v_approved_provider text;
  v_approved_provider_operation text;
  v_item_count integer := 0;
  v_expected_entries_bigint bigint := 0;
  v_expected_entries integer := 0;
  v_reservation_count integer := 0;
  v_consumed_reservation_count integer := 0;
  v_existing_entries_before integer := 0;
  v_inserted_entries integer := 0;
  v_total_entries integer := 0;
  v_missing_expected_entries integer := 0;
  v_unexpected_entries integer := 0;
  v_sent_count integer := 0;
  v_valid_sent_count integer := 0;
  v_not_sent_count integer := 0;
  v_failed_count integer := 0;
  v_email_status_count integer := 0;
  v_max_email_sent_at timestamptz;
  v_was_initialized boolean := false;
  v_should_increment_attempt boolean := false;
  v_insert_failed boolean := false;
  v_was_complete boolean := false;
  v_release_owned_lease boolean := false;
  v_processing_delivery_found boolean := false;
  v_post_complete_review_error_code text;
  v_result_status text;
  v_result_error_code text;
begin
  if p_order_id is null
    or p_payment_attempt_id is null
    or ((p_reconcile_lease_token is null)
      <> (p_reconcile_lease_epoch is null))
    or (p_reconcile_lease_epoch is not null
      and p_reconcile_lease_epoch < 1) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'order_not_found', 'message', 'Order not found')
    );
  end if;
  if p_reconcile_lease_token is not null then
    select *
    into v_fulfillment
    from public.access_order_fulfillments
    where access_order_fulfillments.order_id = v_order.id
    for update;

    v_now := clock_timestamp();
    if not found
      or v_fulfillment.reconcile_lease_token
        is distinct from p_reconcile_lease_token
      or v_fulfillment.reconcile_lease_epoch
        is distinct from p_reconcile_lease_epoch
      or v_fulfillment.reconcile_lease_expires_at is null
      or v_fulfillment.reconcile_lease_expires_at <= v_now then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', p_payment_attempt_id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
      );
    end if;
  end if;


  if v_order.status <> 'paid' then
    if p_reconcile_lease_token is not null then
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object('code', 'order_not_paid', 'message', 'Order is not paid')
    );
  end if;
  perform 1
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
  order by payment_attempts.id
  for update;

  select count(*)::integer
  into v_approved_count
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
    and payment_attempts.status = 'approved';

  if v_approved_count = 1 then
    select
      payment_attempts.id,
      payment_attempts.provider,
      payment_attempts.provider_operation
    into
      v_approved_attempt_id,
      v_approved_provider,
      v_approved_provider_operation
    from public.payment_attempts
    where payment_attempts.order_id = v_order.id
      and payment_attempts.status = 'approved';
  end if;

  v_now := clock_timestamp();


  select *
  into v_attempt
  from public.payment_attempts
  where payment_attempts.id = p_payment_attempt_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'payment_attempt_not_found',
        'message', 'Payment attempt not found'
      )
    );
  end if;

  if v_attempt.order_id is distinct from v_order.id then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'payment_attempt_order_mismatch',
        'message', 'Payment attempt does not belong to order'
      )
    );
  end if;
  select *
  into v_fulfillment
  from public.access_order_fulfillments
  where access_order_fulfillments.order_id = v_order.id
  for update;

  if not found then
    if p_reconcile_lease_token is not null then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
      );
    end if;
    if v_approved_count = 0
      or (
        v_approved_count = 1
        and v_approved_attempt_id is distinct from v_attempt.id
      )
      or (
        v_approved_count > 1
        and v_attempt.status <> 'approved'
      ) then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object(
          'code', case
            when v_approved_count <> 1
              then 'multiple_approved_payment_attempts'
            else 'fulfillment_attempt_mismatch'
          end,
          'message', 'Approved payment attempt set is invalid'
        )
      );
    end if;


    select
      count(*)::integer,
      coalesce(sum(
        access_order_items.quantity::bigint
        * access_order_items.entries_per_unit::bigint
      ), 0)
    into v_item_count, v_expected_entries_bigint
    from public.access_order_items
    where access_order_items.order_id = v_order.id;

    if v_expected_entries_bigint > 2147483647 then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object(
          'code', 'entries_count_overflow',
          'message', 'Entries count overflow'
        )
      );
    end if;

    v_expected_entries := v_expected_entries_bigint::integer;

    select count(*)::integer
    into v_total_entries
    from public.access_entries
    where access_entries.order_id = v_order.id;

    insert into public.access_order_fulfillments (
      order_id,
      approved_payment_attempt_id,
      expected_entries,
      issued_entries,
      issuance_status,
      issuance_attempt_count,
      issuance_last_attempt_at,
      issuance_next_attempt_at,
      issuance_last_error_code,
      issuance_last_error_at,
      issuance_review_status,
      issuance_review_error_code,
      issuance_review_error_at,
      email_status,
      email_generation,
      email_next_attempt_at,
      email_sent_at,
      email_last_error_code,
      email_last_error_at,
      email_provider_message_id,
      created_at,
      updated_at
    )
    values (
      v_order.id,
      v_attempt.id,
      v_expected_entries,
      v_total_entries,
      case
        when v_item_count = 0 then 'manual_review'
        when v_total_entries > v_expected_entries then 'manual_review'
        when v_total_entries = v_expected_entries and v_expected_entries > 0 then 'complete'
        when v_total_entries = 0 then 'pending'
        else 'partial'
      end,
      1,
      v_now,
      case
        when v_item_count > 0 and v_total_entries < v_expected_entries then v_now
        else null
      end,
      case
        when v_item_count = 0 then 'items_not_found'
        when v_total_entries > v_expected_entries then 'entries_count_mismatch'
        else null
      end,
      case
        when v_item_count = 0 or v_total_entries > v_expected_entries then v_now
        else null
      end,
      'none',
      null,
      null,
      'pending',
      1,
      case
        when v_item_count > 0
          and v_total_entries = v_expected_entries
          and v_expected_entries > 0 then v_now
        else null
      end,
      null,
      null,
      null,
      null,
      v_now,
      v_now
    )
    on conflict (order_id) do nothing
    returning * into v_fulfillment;

    if found then
      v_was_initialized := true;
    else
      select *
      into v_fulfillment
      from public.access_order_fulfillments
      where access_order_fulfillments.order_id = v_order.id
      for update;

      if not found then
        return jsonb_build_object(
          'ok', false,
          'order_id', v_order.id,
          'payment_attempt_id', v_attempt.id,
          'public_ref', v_order.public_ref,
          'retryable', true,
          'error', jsonb_build_object(
            'code', 'concurrency_conflict',
            'message', 'Concurrency conflict'
          )
        );
      end if;
    end if;
  end if;
  v_now := clock_timestamp();

  if p_reconcile_lease_token is not null then
    if v_fulfillment.reconcile_lease_token
        is distinct from p_reconcile_lease_token
      or v_fulfillment.reconcile_lease_epoch
        is distinct from p_reconcile_lease_epoch
      or v_fulfillment.reconcile_lease_expires_at is null
      or v_fulfillment.reconcile_lease_expires_at <= v_now then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
      );
    end if;
    v_release_owned_lease := true;
  end if;

  v_was_complete := v_fulfillment.issuance_status = 'complete'
    and not v_was_initialized;

  if v_was_complete then
    perform 1
    from public.access_email_delivery_attempts
    where access_email_delivery_attempts.order_id = v_order.id
      and access_email_delivery_attempts.generation = v_fulfillment.email_generation
      and access_email_delivery_attempts.status = 'processing'
    order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
    limit 1
    for update;
    v_processing_delivery_found := found;
  end if;

  if v_approved_count <> 1 then
    if v_was_complete then
      v_post_complete_review_error_code := 'multiple_approved_payment_attempts';
    else
    update public.access_order_fulfillments
    set
      issuance_status = 'manual_review',
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'multiple_approved_payment_attempts',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null
        else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null
        else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'multiple_approved_payment_attempts',
        'message', 'Order does not have exactly one approved payment attempt'
      )
    );
    end if;
  end if;

  if v_approved_attempt_id is distinct from v_attempt.id
    or v_fulfillment.approved_payment_attempt_id
      is distinct from v_approved_attempt_id then
    if v_was_complete then
      if v_post_complete_review_error_code is null then
        v_post_complete_review_error_code := 'fulfillment_attempt_mismatch';
      end if;
    else
    update public.access_order_fulfillments
    set
      issuance_status = 'manual_review',
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'fulfillment_attempt_mismatch',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null
        else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null
        else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'fulfillment_attempt_mismatch',
        'message', 'Fulfillment payment attempt mismatch'
      )
    );
    end if;
  end if;

  if v_approved_provider <> 'bancard'
    or v_approved_provider_operation <> 'single_buy' then
    if v_was_complete then
      if v_post_complete_review_error_code is null then
        v_post_complete_review_error_code := 'unsupported_approved_provider';
      end if;
    else
    update public.access_order_fulfillments
    set
      issuance_status = 'manual_review',
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'unsupported_approved_provider',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null
        else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null
        else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'unsupported_approved_provider',
        'message', 'Approved payment provider is unsupported'
      )
    );
    end if;
  end if;

  if v_fulfillment.issuance_status = 'manual_review' and not v_was_initialized then
    if v_release_owned_lease then
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_fulfillment.expected_entries,
      'existing_entries_before', v_fulfillment.issued_entries,
      'inserted_entries', 0,
      'total_entries', v_fulfillment.issued_entries,
      'idempotent', true,
      'error', jsonb_build_object(
        'code', v_fulfillment.issuance_last_error_code,
        'message', 'Fulfillment requires manual review'
      )
    );
  end if;

  v_should_increment_attempt := not v_was_initialized
    and v_fulfillment.issuance_status in ('pending', 'partial');

  perform 1
  from public.access_order_items
  where access_order_items.order_id = v_order.id
  order by access_order_items.id
  for update;

  select
    count(*)::integer,
    coalesce(sum(
      access_order_items.quantity::bigint
      * access_order_items.entries_per_unit::bigint
    ), 0)
  into v_item_count, v_expected_entries_bigint
  from public.access_order_items
  where access_order_items.order_id = v_order.id;

  if v_expected_entries_bigint > 2147483647 then
    if v_was_complete then
      if v_post_complete_review_error_code is null then
        v_post_complete_review_error_code := 'entries_count_overflow';
      end if;
      v_expected_entries := v_fulfillment.expected_entries;
    else
    v_now := clock_timestamp();
    update public.access_order_fulfillments
    set
      issuance_status = 'manual_review',
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'entries_count_overflow',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null
        else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null
        else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'entries_count_overflow',
        'message', 'Entries count overflow'
      )
    );
    end if;
  else
    v_expected_entries := v_expected_entries_bigint::integer;
  end if;

  perform 1
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id
  order by
    access_stock_reservations.access_ticket_type_id,
    access_stock_reservations.access_date,
    access_stock_reservations.id
  for update;

  select
    count(*)::integer,
    count(*) filter (where access_stock_reservations.status = 'consumed')::integer
  into v_reservation_count, v_consumed_reservation_count
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id;

  perform 1
  from public.access_entries
  where access_entries.order_id = v_order.id
  order by access_entries.order_item_id, access_entries.unit_index, access_entries.id
  for update;
  v_now := clock_timestamp();

  if v_release_owned_lease and (
    v_fulfillment.reconcile_lease_token
      is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch
      is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now
  ) then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;


  select count(*)::integer
  into v_existing_entries_before
  from public.access_entries
  where access_entries.order_id = v_order.id;

  if v_expected_entries_bigint <= 2147483647 then
    select count(*)::integer
    into v_missing_expected_entries
    from public.access_order_items as order_items
    cross join lateral generate_series(
      1,
      order_items.quantity * order_items.entries_per_unit
    ) as generated_unit(unit_index)
    where order_items.order_id = v_order.id
      and not exists (
        select 1
        from public.access_entries
        where access_entries.order_item_id = order_items.id
          and access_entries.unit_index = generated_unit.unit_index
      );

  else
    v_missing_expected_entries := 0;
  end if;

  select count(*)::integer
  into v_unexpected_entries
  from public.access_entries as existing_entry
  where existing_entry.order_id = v_order.id
    and not exists (
      select 1
      from public.access_order_items as order_items
      where order_items.order_id = v_order.id
        and order_items.id = existing_entry.order_item_id
        and existing_entry.unit_index::bigint between 1
          and order_items.quantity::bigint * order_items.entries_per_unit::bigint
    );

  if v_fulfillment.issuance_review_status = 'manual_review' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_fulfillment.expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_existing_entries_before,
      'idempotent', true,
      'error', jsonb_build_object(
        'code', v_fulfillment.issuance_review_error_code,
        'message', 'Completed issuance requires manual review'
      )
    );
  end if;

  if v_was_complete then
    if v_post_complete_review_error_code is null then
      v_post_complete_review_error_code := case
        when v_item_count = 0 then 'items_not_found'
        when v_reservation_count > 0
          and v_consumed_reservation_count <> v_reservation_count
          then 'stock_not_consumed'
        when v_expected_entries <= 0
          or v_existing_entries_before <> v_expected_entries
          or v_missing_expected_entries <> 0
          or v_unexpected_entries <> 0
          or v_fulfillment.expected_entries <> v_expected_entries
          or v_fulfillment.issued_entries <> v_existing_entries_before
          then 'entries_count_mismatch'
        else null
      end;
    end if;

    if v_post_complete_review_error_code is not null then
      update public.access_order_fulfillments
      set
        expected_entries = case
          when v_item_count > 0 and v_expected_entries > 0 then v_expected_entries
          else expected_entries
        end,
        issued_entries = v_existing_entries_before,
        issuance_status = 'complete',
        issuance_next_attempt_at = null,
        issuance_last_error_code = null,
        issuance_last_error_at = null,
        issuance_review_status = 'manual_review',
        issuance_review_error_code = v_post_complete_review_error_code,
        issuance_review_error_at = v_now,
        reconcile_lease_token = case
          when v_release_owned_lease
            and not v_processing_delivery_found
            and v_fulfillment.email_status <> 'processing' then null
          else reconcile_lease_token
        end,
        reconcile_lease_expires_at = case
          when v_release_owned_lease
            and not v_processing_delivery_found
            and v_fulfillment.email_status <> 'processing' then null
          else reconcile_lease_expires_at
        end,
        updated_at = v_now
      where order_id = v_order.id;

      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'expected_entries', case
          when v_item_count > 0 and v_expected_entries > 0 then v_expected_entries
          else v_fulfillment.expected_entries
        end,
        'existing_entries_before', v_existing_entries_before,
        'inserted_entries', 0,
        'total_entries', v_existing_entries_before,
        'idempotent', true,
        'error', jsonb_build_object(
          'code', v_post_complete_review_error_code,
          'message', 'Completed issuance requires manual review'
        )
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'issued',
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_existing_entries_before,
      'idempotent', true
    );
  end if;

  if v_item_count = 0 then
    update public.access_order_fulfillments
    set
      expected_entries = 0,
      issued_entries = v_existing_entries_before,
      issuance_status = 'manual_review',
      issuance_attempt_count = issuance_attempt_count
        + case when v_should_increment_attempt then 1 else 0 end,
      issuance_last_attempt_at = case
        when v_should_increment_attempt then v_now else issuance_last_attempt_at
      end,
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'items_not_found',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', 0,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_existing_entries_before,
      'idempotent', true,
      'error', jsonb_build_object('code', 'items_not_found', 'message', 'Order items not found')
    );
  end if;

  if v_reservation_count > 0
    and v_consumed_reservation_count <> v_reservation_count then
    update public.access_order_fulfillments
    set
      expected_entries = v_expected_entries,
      issued_entries = v_existing_entries_before,
      issuance_status = 'manual_review',
      issuance_attempt_count = issuance_attempt_count
        + case when v_should_increment_attempt then 1 else 0 end,
      issuance_last_attempt_at = case
        when v_should_increment_attempt then v_now else issuance_last_attempt_at
      end,
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'stock_not_consumed',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_existing_entries_before,
      'idempotent', true,
      'error', jsonb_build_object('code', 'stock_not_consumed', 'message', 'Stock is not consumed')
    );
  end if;

  if v_existing_entries_before > v_expected_entries
    or v_unexpected_entries > 0 then
    update public.access_order_fulfillments
    set
      expected_entries = v_expected_entries,
      issued_entries = v_existing_entries_before,
      issuance_status = 'manual_review',
      issuance_attempt_count = issuance_attempt_count
        + case when v_should_increment_attempt then 1 else 0 end,
      issuance_last_attempt_at = case
        when v_should_increment_attempt then v_now else issuance_last_attempt_at
      end,
      issuance_next_attempt_at = null,
      issuance_last_error_code = 'entries_count_mismatch',
      issuance_last_error_at = v_now,
      email_status = 'pending',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      reconcile_lease_token = case
        when v_release_owned_lease then null else reconcile_lease_token
      end,
      reconcile_lease_expires_at = case
        when v_release_owned_lease then null else reconcile_lease_expires_at
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_existing_entries_before,
      'idempotent', true,
      'error', jsonb_build_object(
        'code', 'entries_count_mismatch',
        'message', 'Entries count mismatch'
      )
    );
  end if;

  begin
    insert into public.access_entries (
      order_id,
      order_item_id,
      access_ticket_type_id,
      unit_index,
      attendee_name,
      attendee_last_name,
      attendee_email,
      attendee_phone,
      attendee_document,
      access_date
    )
    select
      v_order.id,
      order_items.id,
      order_items.access_ticket_type_id,
      generated_unit.unit_index,
      v_order.buyer_name,
      v_order.buyer_last_name,
      v_order.buyer_email,
      v_order.buyer_phone,
      v_order.buyer_document,
      v_order.access_date
    from public.access_order_items as order_items
    cross join lateral generate_series(
      1,
      order_items.quantity * order_items.entries_per_unit
    ) as generated_unit(unit_index)
    where order_items.order_id = v_order.id
      and not exists (
        select 1
        from public.access_entries as existing_entry
        where existing_entry.order_item_id = order_items.id
          and existing_entry.unit_index = generated_unit.unit_index
      )
    on conflict (order_item_id, unit_index) do nothing;

    get diagnostics v_inserted_entries = row_count;
  exception
    when deadlock_detected or serialization_failure then
      raise;
    when others then
      v_insert_failed := true;
      v_inserted_entries := 0;
  end;

  select count(*)::integer
  into v_total_entries
  from public.access_entries
  where access_entries.order_id = v_order.id;

  select count(*)::integer
  into v_missing_expected_entries
  from public.access_order_items as order_items
  cross join lateral generate_series(
    1,
    order_items.quantity * order_items.entries_per_unit
  ) as generated_unit(unit_index)
  where order_items.order_id = v_order.id
    and not exists (
      select 1
      from public.access_entries
      where access_entries.order_item_id = order_items.id
        and access_entries.unit_index = generated_unit.unit_index
    );

  select count(*)::integer
  into v_unexpected_entries
  from public.access_entries as existing_entry
  where existing_entry.order_id = v_order.id
    and not exists (
      select 1
      from public.access_order_items as order_items
      where order_items.order_id = v_order.id
        and order_items.id = existing_entry.order_item_id
        and existing_entry.unit_index::bigint between 1
          and order_items.quantity::bigint * order_items.entries_per_unit::bigint
    );

  if v_missing_expected_entries > 0 or v_unexpected_entries > 0 then
    v_result_status := 'manual_review';
    v_result_error_code := 'entries_count_mismatch';
  elsif v_total_entries = v_expected_entries then
    v_result_status := 'complete';
    v_result_error_code := null;
  elsif v_total_entries = 0 then
    v_result_status := 'pending';
    v_result_error_code := case
      when v_insert_failed then 'entry_insert_failed' else 'entries_count_mismatch'
    end;
  elsif v_total_entries < v_expected_entries then
    v_result_status := 'partial';
    v_result_error_code := case
      when v_insert_failed then 'entry_insert_failed' else 'entries_count_mismatch'
    end;
  else
    v_result_status := 'manual_review';
    v_result_error_code := 'entries_count_mismatch';
  end if;

  if v_result_status = 'complete' and not v_was_complete then
    select
      count(*) filter (where access_entries.email_status = 'sent')::integer,
      count(*) filter (
        where access_entries.email_status = 'sent'
          and access_entries.email_sent_at is not null
      )::integer,
      count(*) filter (where access_entries.email_status = 'not_sent')::integer,
      count(*) filter (where access_entries.email_status = 'failed')::integer,
      count(distinct access_entries.email_status)::integer,
      max(access_entries.email_sent_at)
    into
      v_sent_count,
      v_valid_sent_count,
      v_not_sent_count,
      v_failed_count,
      v_email_status_count,
      v_max_email_sent_at
    from public.access_entries
    where access_entries.order_id = v_order.id;
  end if;

  update public.access_order_fulfillments
  set
    expected_entries = v_expected_entries,
    issued_entries = v_total_entries,
    issuance_status = v_result_status,
    issuance_attempt_count = issuance_attempt_count
      + case when v_should_increment_attempt then 1 else 0 end,
    issuance_last_attempt_at = case
      when v_should_increment_attempt then v_now else issuance_last_attempt_at
    end,
    issuance_next_attempt_at = case
      when v_result_status in ('pending', 'partial') then v_now
      else null
    end,
    issuance_last_error_code = case
      when v_result_status = 'complete' then null
      else v_result_error_code
    end,
    issuance_last_error_at = case
      when v_result_status = 'complete' then null
      else v_now
    end,
    email_status = case
      when v_result_status <> 'complete' then 'pending'
      when v_was_complete then email_status
      when p_reconcile_lease_token is null and not v_was_initialized then 'pending'
      when v_sent_count > 0 and v_valid_sent_count <> v_sent_count then 'manual_review'
      when v_email_status_count > 1 then 'manual_review'
      when v_sent_count = v_total_entries and v_total_entries > 0 then 'sent'
      when v_not_sent_count = v_total_entries and v_total_entries > 0 then 'pending'
      when v_failed_count > 0 then 'manual_review'
      else 'manual_review'
    end,
    email_next_attempt_at = case
      when v_result_status <> 'complete' then null
      when v_was_complete then email_next_attempt_at
      when p_reconcile_lease_token is null and not v_was_initialized then v_now
      when v_not_sent_count = v_total_entries and v_total_entries > 0 then v_now
      else null
    end,
    email_sent_at = case
      when v_result_status <> 'complete' then null
      when v_was_complete then email_sent_at
      when p_reconcile_lease_token is null and not v_was_initialized then null
      when v_sent_count = v_total_entries
        and v_valid_sent_count = v_sent_count
        and v_total_entries > 0 then v_max_email_sent_at
      else null
    end,
    email_last_error_code = case
      when v_result_status <> 'complete' then null
      when v_was_complete then email_last_error_code
      when p_reconcile_lease_token is null and not v_was_initialized then null
      when v_sent_count > 0 and v_valid_sent_count <> v_sent_count
        then 'legacy_sent_without_timestamp'
      when v_email_status_count > 1 then 'legacy_email_mixed_state'
      when v_failed_count > 0 then 'legacy_email_failed_ambiguous'
      when v_sent_count = v_total_entries or v_not_sent_count = v_total_entries then null
      else 'legacy_email_mixed_state'
    end,
    email_last_error_at = case
      when v_result_status <> 'complete' then null
      when v_was_complete then email_last_error_at
      when p_reconcile_lease_token is null and not v_was_initialized then null
      when (
        (v_sent_count > 0 and v_valid_sent_count <> v_sent_count)
        or v_email_status_count > 1
        or v_failed_count > 0
        or not (v_sent_count = v_total_entries or v_not_sent_count = v_total_entries)
      ) then v_now
      else null
    end,
    email_provider_message_id = case
      when v_result_status <> 'complete' then null
      when v_was_complete then email_provider_message_id
      when p_reconcile_lease_token is null and not v_was_initialized then null
      else null
    end,
    reconcile_lease_token = case
      when v_release_owned_lease then null else reconcile_lease_token
    end,
    reconcile_lease_expires_at = case
      when v_release_owned_lease then null else reconcile_lease_expires_at
    end,
    updated_at = v_now
  where order_id = v_order.id;

  if v_insert_failed then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', 0,
      'total_entries', v_total_entries,
      'idempotent', v_existing_entries_before = v_total_entries,
      'error', jsonb_build_object(
        'code', 'entry_insert_failed',
        'message', 'Access entry insert failed'
      )
    );
  end if;

  if v_result_status <> 'complete' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', v_inserted_entries,
      'total_entries', v_total_entries,
      'idempotent', v_inserted_entries = 0,
      'error', jsonb_build_object(
        'code', 'entries_count_mismatch',
        'message', 'Entries count mismatch'
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'issued',
    'order_id', v_order.id,
    'payment_attempt_id', v_attempt.id,
    'public_ref', v_order.public_ref,
    'expected_entries', v_expected_entries,
    'existing_entries_before', v_existing_entries_before,
    'inserted_entries', v_inserted_entries,
    'total_entries', v_total_entries,
    'idempotent', v_inserted_entries = 0
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.reconcile_access_order_fulfillment(uuid, uuid, uuid, bigint)
  owner to postgres;
revoke all on function public.reconcile_access_order_fulfillment(uuid, uuid, uuid, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_access_order_fulfillment(uuid, uuid, uuid, bigint)
  to service_role;

create or replace function public.issue_access_entries_for_paid_order(
  p_order_id uuid,
  p_payment_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.reconcile_access_order_fulfillment(
    p_order_id,
    p_payment_attempt_id,
    null,
    null
  );
end;
$$;

alter function public.issue_access_entries_for_paid_order(uuid, uuid)
  owner to postgres;
revoke all on function public.issue_access_entries_for_paid_order(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_access_entries_for_paid_order(uuid, uuid)
  to service_role;

create or replace function public.claim_access_fulfillment_batch(
  p_reconcile_lease_token uuid,
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_claim_clock timestamptz;
  v_claim_epoch bigint;
  v_claim_ids uuid[] := array[]::uuid[];
  v_stale record;
  v_processing public.access_email_delivery_attempts%rowtype;
  v_claim record;
  v_items jsonb := '[]'::jsonb;
  v_claimed_count integer := 0;
begin
  if p_reconcile_lease_token is null
    or p_limit is null or p_limit < 1 or p_limit > 100
    or p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;
  -- Serialize first claims and lost-response replays for the same token.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'access-fulfillment-batch:' || p_reconcile_lease_token::text,
      0
    )
  );

  -- Recover expired leases before discovery or selection. The wall clock is
  -- captured only after each fulfillment and processing attempt are locked.
  for v_stale in
    select
      fulfillment.order_id,
      fulfillment.issuance_status,
      fulfillment.email_status,
      fulfillment.email_generation,
      fulfillment.reconcile_lease_expires_at
    from public.access_order_fulfillments as fulfillment
    where fulfillment.reconcile_lease_token is not null
      and fulfillment.reconcile_lease_expires_at <= clock_timestamp()
    order by fulfillment.reconcile_lease_expires_at, fulfillment.order_id
    for update
  loop
    v_now := clock_timestamp();
    if v_stale.reconcile_lease_expires_at > v_now then
      continue;
    end if;

    select *
    into v_processing
    from public.access_email_delivery_attempts
    where access_email_delivery_attempts.order_id = v_stale.order_id
      and access_email_delivery_attempts.generation = v_stale.email_generation
      and access_email_delivery_attempts.status = 'processing'
    order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
    limit 1
    for update;

    v_now := clock_timestamp();
    if v_stale.reconcile_lease_expires_at > v_now then
      continue;
    end if;

    if found then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        error_code = 'worker_lease_expired',
        finished_at = null
      where id = v_processing.id;

      if v_now < v_processing.idempotency_expires_at then
        update public.access_order_fulfillments
        set
          email_status = 'failed',
          email_next_attempt_at = v_now,
          email_sent_at = null,
          email_last_error_code = 'worker_lease_expired',
          email_last_error_at = v_now,
          email_provider_message_id = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = v_now
        where order_id = v_stale.order_id;
      else
        update public.access_order_fulfillments
        set
          email_status = 'manual_review',
          email_next_attempt_at = null,
          email_sent_at = null,
          email_last_error_code = 'ambiguous_idempotency_window_expired',
          email_last_error_at = v_now,
          email_provider_message_id = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = v_now
        where order_id = v_stale.order_id;
      end if;
    elsif v_stale.email_status = 'processing' then
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'processing_attempt_missing',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_stale.order_id;
    else
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_stale.order_id;
    end if;
  end loop;

  v_now := clock_timestamp();


  if exists (
    select 1
    from public.access_orders
    where access_orders.status = 'paid'
      and exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = access_orders.id
          and payment_attempts.status = 'approved'
      )
      and (
        select coalesce(sum(
          access_order_items.quantity::bigint
          * access_order_items.entries_per_unit::bigint
        ), 0)
        from public.access_order_items
        where access_order_items.order_id = access_orders.id
      ) > 2147483647
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'entries_count_overflow',
        'message', 'Entries count overflow'
      )
    );
  end if;

  with
  approved_ranked as (
    select
      payment_attempts.order_id,
      payment_attempts.id as payment_attempt_id,
      payment_attempts.provider,
      payment_attempts.provider_operation,
      count(*) over (partition by payment_attempts.order_id)::integer as approved_count,
      row_number() over (
        partition by payment_attempts.order_id
        order by
          payment_attempts.confirmed_at asc nulls last,
          payment_attempts.attempt_number asc,
          payment_attempts.id asc
      ) as approved_rank
    from public.payment_attempts
    join public.access_orders
      on access_orders.id = payment_attempts.order_id
    where access_orders.status = 'paid'
      and payment_attempts.status = 'approved'
  ),
  approved_selected as (
    select
      order_id, payment_attempt_id, approved_count, provider, provider_operation
    from approved_ranked
    where approved_rank = 1
  ),
  item_totals as (
    select
      access_order_items.order_id,
      count(*)::integer as item_count,
      coalesce(sum(
        access_order_items.quantity::bigint
        * access_order_items.entries_per_unit::bigint
      ), 0) as expected_entries
    from public.access_order_items
    group by access_order_items.order_id
  ),
  entry_totals as (
    select
      access_entries.order_id,
      count(*)::integer as issued_entries,
      count(*) filter (where access_entries.email_status = 'sent')::integer as sent_count,
      count(*) filter (
        where access_entries.email_status = 'sent'
          and access_entries.email_sent_at is not null
      )::integer as valid_sent_count,
      count(*) filter (where access_entries.email_status = 'not_sent')::integer as not_sent_count,
      count(*) filter (where access_entries.email_status = 'failed')::integer as failed_count,
      count(distinct access_entries.email_status)::integer as email_status_count,
      count(*) filter (
        where access_entries.unit_index::bigint
          > access_order_items.quantity::bigint * access_order_items.entries_per_unit::bigint
      )::integer
        as invalid_unit_count,
      max(access_entries.email_sent_at) as max_email_sent_at
    from public.access_entries
    join public.access_order_items
      on access_order_items.id
        = access_entries.order_item_id
    group by access_entries.order_id
  ),
  classified as (
    select
      access_orders.id as order_id,
      approved_selected.payment_attempt_id,
      approved_selected.approved_count,
      coalesce(item_totals.item_count, 0) as item_count,
      coalesce(item_totals.expected_entries, 0) as expected_entries,
      coalesce(entry_totals.issued_entries, 0) as issued_entries,
      coalesce(entry_totals.sent_count, 0) as sent_count,
      coalesce(entry_totals.valid_sent_count, 0) as valid_sent_count,
      coalesce(entry_totals.not_sent_count, 0) as not_sent_count,
      coalesce(entry_totals.failed_count, 0) as failed_count,
      coalesce(entry_totals.email_status_count, 0) as email_status_count,
      coalesce(entry_totals.invalid_unit_count, 0)
        as invalid_unit_count,
      entry_totals.max_email_sent_at,
      case
        when approved_selected.approved_count > 1 then 'manual_review'
        when approved_selected.provider <> 'bancard'
          or approved_selected.provider_operation <> 'single_buy'
          then 'manual_review'
        when coalesce(item_totals.item_count, 0) = 0 then 'manual_review'
        when coalesce(entry_totals.invalid_unit_count, 0) > 0
          then 'manual_review'
        when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
          then 'manual_review'
        when coalesce(entry_totals.issued_entries, 0) = coalesce(item_totals.expected_entries, 0)
          and coalesce(item_totals.expected_entries, 0) > 0 then 'complete'
        when coalesce(entry_totals.issued_entries, 0) = 0 then 'pending'
        else 'partial'
      end as issuance_status,
      case
        when approved_selected.approved_count > 1 then 'multiple_approved_payment_attempts'
        when approved_selected.provider <> 'bancard'
          or approved_selected.provider_operation <> 'single_buy'
          then 'unsupported_approved_provider'
        when coalesce(item_totals.item_count, 0) = 0 then 'items_not_found'
        when coalesce(entry_totals.invalid_unit_count, 0) > 0
          then 'entries_count_mismatch'
        when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
          then 'entries_count_mismatch'
        when coalesce(entry_totals.issued_entries, 0) > 0
          and coalesce(entry_totals.issued_entries, 0) < coalesce(item_totals.expected_entries, 0)
          then 'backfill_partial_entries'
        else null
      end as issuance_error_code
    from public.access_orders
    join approved_selected on approved_selected.order_id = access_orders.id
    left join item_totals on item_totals.order_id = access_orders.id
    left join entry_totals on entry_totals.order_id = access_orders.id
    where access_orders.status = 'paid'
      and not exists (
        select 1
        from public.access_order_fulfillments
        where access_order_fulfillments.order_id = access_orders.id
      )
  )
  insert into public.access_order_fulfillments (
    order_id,
    approved_payment_attempt_id,
    expected_entries,
    issued_entries,
    issuance_status,
    issuance_attempt_count,
    issuance_last_attempt_at,
    issuance_next_attempt_at,
    issuance_last_error_code,
    issuance_last_error_at,
    issuance_review_status,
    issuance_review_error_code,
    issuance_review_error_at,
    email_status,
    email_generation,
    email_next_attempt_at,
    email_sent_at,
    email_last_error_code,
    email_last_error_at,
    email_provider_message_id,
    created_at,
    updated_at
  )
  select
    classified.order_id,
    classified.payment_attempt_id,
    classified.expected_entries::integer,
    classified.issued_entries,
    classified.issuance_status,
    0,
    null,
    case when classified.issuance_status in ('pending', 'partial') then v_now else null end,
    classified.issuance_error_code,
    case when classified.issuance_error_code is not null then v_now else null end,
    'none',
    null,
    null,
    case
      when classified.issuance_status <> 'complete' then 'pending'
      when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
        then 'manual_review'
      when classified.email_status_count > 1 then 'manual_review'
      when classified.sent_count = classified.issued_entries and classified.issued_entries > 0
        then 'sent'
      when classified.not_sent_count = classified.issued_entries and classified.issued_entries > 0
        then 'pending'
      when classified.failed_count > 0 then 'manual_review'
      else 'manual_review'
    end,
    1,
    case
      when classified.issuance_status = 'complete'
        and classified.not_sent_count = classified.issued_entries
        and classified.issued_entries > 0 then v_now
      else null
    end,
    case
      when classified.issuance_status = 'complete'
        and classified.sent_count = classified.issued_entries
        and classified.valid_sent_count = classified.sent_count
        and classified.issued_entries > 0 then classified.max_email_sent_at
      else null
    end,
    case
      when classified.issuance_status <> 'complete' then null
      when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
        then 'legacy_sent_without_timestamp'
      when classified.email_status_count > 1 then 'legacy_email_mixed_state'
      when classified.failed_count > 0 then 'legacy_email_failed_ambiguous'
      when classified.sent_count = classified.issued_entries
        or classified.not_sent_count = classified.issued_entries then null
      else 'legacy_email_mixed_state'
    end,
    case
      when classified.issuance_status = 'complete' and (
        (classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count)
        or classified.email_status_count > 1
        or classified.failed_count > 0
        or not (
          classified.sent_count = classified.issued_entries
          or classified.not_sent_count = classified.issued_entries
        )
      ) then v_now
      else null
    end,
    null,
    v_now,
    v_now
  from classified
  on conflict (order_id) do nothing;

  -- Synchronize only compatibility rows that have never entered the durable
  -- delivery-attempt protocol and have no active lease.
  with entry_state as (
    select
      access_entries.order_id,
      count(*)::integer as entry_count,
      count(*) filter (where access_entries.email_status = 'sent')::integer as sent_count,
      count(*) filter (
        where access_entries.email_status = 'sent'
          and access_entries.email_sent_at is not null
      )::integer as valid_sent_count,
      count(*) filter (where access_entries.email_status = 'not_sent')::integer as not_sent_count,
      count(*) filter (where access_entries.email_status = 'failed')::integer as failed_count,
      count(distinct access_entries.email_status)::integer as email_status_count,
      max(access_entries.email_sent_at) as max_email_sent_at
    from public.access_entries
    group by access_entries.order_id
  )
  update public.access_order_fulfillments as fulfillment
  set
    email_status = case
      when entry_state.sent_count > 0
        and entry_state.valid_sent_count <> entry_state.sent_count then 'manual_review'
      when entry_state.email_status_count > 1 then 'manual_review'
      when entry_state.sent_count = entry_state.entry_count then 'sent'
      when entry_state.not_sent_count = entry_state.entry_count then 'pending'
      when entry_state.failed_count > 0 then 'manual_review'
      else 'manual_review'
    end,
    email_next_attempt_at = case
      when entry_state.not_sent_count = entry_state.entry_count then v_now
      else null
    end,
    email_sent_at = case
      when entry_state.sent_count = entry_state.entry_count
        and entry_state.valid_sent_count = entry_state.sent_count
        then entry_state.max_email_sent_at
      else null
    end,
    email_last_error_code = case
      when entry_state.sent_count > 0
        and entry_state.valid_sent_count <> entry_state.sent_count
        then 'legacy_sent_without_timestamp'
      when entry_state.email_status_count > 1 then 'legacy_email_mixed_state'
      when entry_state.failed_count > 0 then 'legacy_email_failed_ambiguous'
      when entry_state.sent_count = entry_state.entry_count
        or entry_state.not_sent_count = entry_state.entry_count then null
      else 'legacy_email_mixed_state'
    end,
    email_last_error_at = case
      when entry_state.sent_count = entry_state.entry_count
        and entry_state.valid_sent_count = entry_state.sent_count then null
      when entry_state.not_sent_count = entry_state.entry_count then null
      else v_now
    end,
    email_provider_message_id = null,
    reconcile_lease_token = null,
    reconcile_lease_expires_at = null,
    updated_at = v_now
  from entry_state
  where fulfillment.order_id = entry_state.order_id
    and fulfillment.issuance_status = 'complete'
    and fulfillment.issuance_review_status = 'none'
    and fulfillment.email_status <> 'sent'
    and entry_state.entry_count > 0
    and fulfillment.reconcile_lease_token is null
    and not exists (
      select 1
      from public.access_email_delivery_attempts
      where access_email_delivery_attempts.order_id = fulfillment.order_id
    );
  -- Re-lock every row for this token after discovery. This catches a lease
  -- that expired while discovery waited and makes the replay set deterministic.
  for v_stale in
    select
      fulfillment.order_id,
      fulfillment.issuance_status,
      fulfillment.email_status,
      fulfillment.email_generation,
      fulfillment.reconcile_lease_expires_at
    from public.access_order_fulfillments as fulfillment
    where fulfillment.reconcile_lease_token = p_reconcile_lease_token
    order by fulfillment.order_id
    for update
  loop
    v_now := clock_timestamp();
    if v_stale.reconcile_lease_expires_at > v_now then
      continue;
    end if;

    select *
    into v_processing
    from public.access_email_delivery_attempts
    where access_email_delivery_attempts.order_id = v_stale.order_id
      and access_email_delivery_attempts.generation = v_stale.email_generation
      and access_email_delivery_attempts.status = 'processing'
    order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
    limit 1
    for update;

    v_now := clock_timestamp();
    if v_stale.reconcile_lease_expires_at > v_now then
      continue;
    end if;

    if found then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        error_code = 'worker_lease_expired',
        finished_at = null
      where id = v_processing.id;

      if v_now < v_processing.idempotency_expires_at then
        update public.access_order_fulfillments
        set
          email_status = 'failed',
          email_next_attempt_at = v_now,
          email_sent_at = null,
          email_last_error_code = 'worker_lease_expired',
          email_last_error_at = v_now,
          email_provider_message_id = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = v_now
        where order_id = v_stale.order_id;
      else
        update public.access_order_fulfillments
        set
          email_status = 'manual_review',
          email_next_attempt_at = null,
          email_sent_at = null,
          email_last_error_code = 'ambiguous_idempotency_window_expired',
          email_last_error_at = v_now,
          email_provider_message_id = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = v_now
        where order_id = v_stale.order_id;
      end if;
    elsif v_stale.email_status = 'processing' then
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'processing_attempt_missing',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_stale.order_id;
    else
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_stale.order_id;
    end if;
  end loop;
  v_now := clock_timestamp();

  -- A repeated, still-live token returns exactly its original rows and epochs.
  for v_claim in
    select
      fulfillment.order_id,
      fulfillment.approved_payment_attempt_id,
      fulfillment.issuance_status,
      fulfillment.email_status,
      fulfillment.expected_entries,
      fulfillment.issued_entries,
      fulfillment.email_generation,
      fulfillment.reconcile_lease_epoch,
      case
        when fulfillment.issuance_status in ('pending', 'partial') then 'issuance'
        else 'email'
      end as work_type
    from public.access_order_fulfillments as fulfillment
    where fulfillment.reconcile_lease_token = p_reconcile_lease_token
      and fulfillment.reconcile_lease_expires_at > v_now
    order by
      case
        when fulfillment.issuance_status in ('pending', 'partial')
          then fulfillment.issuance_next_attempt_at
        else fulfillment.email_next_attempt_at
      end,
      fulfillment.created_at,
      fulfillment.order_id
  loop
    v_claimed_count := v_claimed_count + 1;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'order_id', v_claim.order_id,
      'approved_payment_attempt_id', v_claim.approved_payment_attempt_id,
      'work_type', v_claim.work_type,
      'issuance_status', v_claim.issuance_status,
      'email_status', v_claim.email_status,
      'expected_entries', v_claim.expected_entries,
      'issued_entries', v_claim.issued_entries,
      'email_generation', v_claim.email_generation,
      'reconcile_lease_epoch', v_claim.reconcile_lease_epoch
    ));
  end loop;

  if v_claimed_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'claimed_count', v_claimed_count,
      'idempotent', true,
      'items', v_items
    );
  end if;

  v_items := '[]'::jsonb;
  v_claimed_count := 0;
  v_claim_clock := null;
  select coalesce(
    array_agg(
      locked.order_id
      order by locked.due_at, locked.created_at, locked.order_id
    ),
    array[]::uuid[]
  )
  into v_claim_ids
  from (
    select
      fulfillment.order_id,
      case
        when fulfillment.issuance_status in ('pending', 'partial')
          then fulfillment.issuance_next_attempt_at
        else fulfillment.email_next_attempt_at
      end as due_at,
      fulfillment.created_at
    from public.access_order_fulfillments as fulfillment
    where fulfillment.reconcile_lease_token is null
      and fulfillment.issuance_review_status = 'none'
      and (
        (
          fulfillment.issuance_status in ('pending', 'partial')
          and fulfillment.issuance_next_attempt_at <= clock_timestamp()
        )
        or (
          fulfillment.issuance_status = 'complete'
          and fulfillment.email_status in ('pending', 'failed')
          and fulfillment.email_next_attempt_at <= clock_timestamp()
        )
      )
    order by
      case
        when fulfillment.issuance_status in ('pending', 'partial')
          then fulfillment.issuance_next_attempt_at
        else fulfillment.email_next_attempt_at
      end,
      fulfillment.created_at,
      fulfillment.order_id
    limit p_limit
    for update skip locked
  ) as locked;

  -- All candidate rows are locked before the common lease wall clock is read.
  v_claim_clock := clock_timestamp();

  for v_claim in
    select
      fulfillment.order_id,
      fulfillment.approved_payment_attempt_id,
      fulfillment.issuance_status,
      fulfillment.email_status,
      fulfillment.expected_entries,
      fulfillment.issued_entries,
      fulfillment.email_generation,
      case
        when fulfillment.issuance_status in ('pending', 'partial') then 'issuance'
        else 'email'
      end as work_type
    from public.access_order_fulfillments as fulfillment
    where fulfillment.order_id = any(v_claim_ids)
    order by array_position(v_claim_ids, fulfillment.order_id)
  loop
    update public.access_order_fulfillments
    set
      reconcile_lease_epoch = reconcile_lease_epoch + 1,
      reconcile_lease_token = p_reconcile_lease_token,
      reconcile_lease_expires_at = v_claim_clock
        + make_interval(secs => p_lease_seconds),
      updated_at = v_claim_clock
    where order_id = v_claim.order_id
    returning reconcile_lease_epoch into v_claim_epoch;

    v_claimed_count := v_claimed_count + 1;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'order_id', v_claim.order_id,
      'approved_payment_attempt_id', v_claim.approved_payment_attempt_id,
      'work_type', v_claim.work_type,
      'issuance_status', v_claim.issuance_status,
      'email_status', v_claim.email_status,
      'expected_entries', v_claim.expected_entries,
      'issued_entries', v_claim.issued_entries,
      'email_generation', v_claim.email_generation,
      'reconcile_lease_epoch', v_claim_epoch
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'claimed_count', v_claimed_count,
    'idempotent', false,
    'items', v_items
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.claim_access_fulfillment_batch(uuid, integer, integer)
  owner to postgres;
revoke all on function public.claim_access_fulfillment_batch(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_access_fulfillment_batch(uuid, integer, integer)
  to service_role;
create or replace function public.claim_access_email_delivery(
  p_order_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_entry_ids uuid[],
  p_request_payload_hash text,
  p_template_version text,
  p_provider text default 'resend'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_attempt public.access_email_delivery_attempts%rowtype;
  v_attempt_found boolean := false;
  v_now timestamptz;
  v_provider_call_at timestamptz;
  v_attempt_id uuid;
  v_idempotency_key text;
  v_provider text;
  v_approved_count integer := 0;
  v_approved_attempt public.payment_attempts%rowtype;
  v_entry_ids uuid[];
  v_entry_count integer;
  v_entry_snapshot_hash text;
begin
  if p_order_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or p_entry_ids is null
    or coalesce(array_ndims(p_entry_ids), 0) <> 1
    or cardinality(p_entry_ids) < 1
    or array_position(p_entry_ids, null) is not null
    or p_request_payload_hash is null
    or p_request_payload_hash !~ '^[0-9a-f]{64}$'
    or p_template_version is null
    or char_length(trim(p_template_version)) = 0
    or p_template_version <> trim(p_template_version)
    or p_provider is null
    or char_length(trim(p_provider)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  v_provider := lower(trim(p_provider));
  if v_provider <> 'resend' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_provider', 'message', 'Invalid provider')
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'order_not_found', 'message', 'Order not found')
    );
  end if;

  -- Lock every attempt, not only the rows currently approved, so a direct
  -- status flip cannot race the approved-count revalidation.
  perform 1
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
  order by payment_attempts.id
  for update;

  select count(*)::integer
  into v_approved_count
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
    and payment_attempts.status = 'approved';

  if v_approved_count = 1 then
    select *
    into v_approved_attempt
    from public.payment_attempts
    where payment_attempts.order_id = v_order.id
      and payment_attempts.status = 'approved';
  end if;

  select *
  into v_fulfillment
  from public.access_order_fulfillments
  where access_order_fulfillments.order_id = v_order.id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_not_found',
        'message', 'Fulfillment not found'
      )
    );
  end if;

  select *
  into v_attempt
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
    and access_email_delivery_attempts.status in ('processing', 'ambiguous')
  order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
  limit 1
  for update;
  v_attempt_found := found;

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  if v_fulfillment.issuance_review_status = 'manual_review' then
    if not (
      (v_attempt_found and v_attempt.status = 'processing')
      or v_fulfillment.email_status = 'processing'
    ) then
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'issuance_manual_review',
        'message', 'Completed issuance requires manual review'
      )
    );
  end if;

  if v_fulfillment.issuance_status <> 'complete' then
    update public.access_order_fulfillments
    set
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'issuance_not_complete',
        'message', 'Entry issuance is not complete'
      )
    );
  end if;

  -- Expiry is checked before every other processing/ambiguous return.
  if v_attempt_found and v_attempt.idempotency_expires_at <= v_now then
    if v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'ambiguous_idempotency_window_expired',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'ambiguous_idempotency_window_expired',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'ambiguous_idempotency_window_expired',
        'message', 'Idempotency window expired'
      )
    );
  end if;

  if v_approved_count <> 1 then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'multiple_approved_payment_attempts',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'multiple_approved_payment_attempts',
        'message', 'Order does not have exactly one approved payment attempt'
      )
    );
  end if;

  if v_approved_attempt.id
      is distinct from v_fulfillment.approved_payment_attempt_id then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'fulfillment_attempt_mismatch',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_attempt_mismatch',
        'message', 'Fulfillment payment attempt mismatch'
      )
    );
  end if;

  if v_approved_attempt.provider <> 'bancard'
    or v_approved_attempt.provider_operation <> 'single_buy' then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'unsupported_approved_provider',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'unsupported_approved_provider',
        'message', 'Approved payment provider is unsupported'
      )
    );
  end if;

  if v_order.status <> 'paid' then
    update public.access_order_fulfillments
    set
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'order_not_paid', 'message', 'Order is not paid')
    );
  end if;

  perform 1
  from public.access_order_items
  where access_order_items.order_id = v_order.id
  order by access_order_items.id
  for update;

  perform 1
  from public.access_entries
  where access_entries.order_id = v_order.id
  order by
    access_entries.order_item_id,
    access_entries.unit_index,
    access_entries.id
  for update;

  select entry_ids, entry_count, entry_snapshot_hash
  into v_entry_ids, v_entry_count, v_entry_snapshot_hash
  from public.access_core_entry_snapshot(v_order.id);

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  if v_attempt_found and v_attempt.idempotency_expires_at <= v_now then
    if v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'ambiguous_idempotency_window_expired',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'ambiguous_idempotency_window_expired',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'ambiguous_idempotency_window_expired',
        'message', 'Idempotency window expired'
      )
    );
  end if;

  if v_entry_count < 1
    or v_entry_count is distinct from v_fulfillment.issued_entries
    or p_entry_ids is distinct from v_entry_ids
    or (
      v_attempt_found
      and (
        v_attempt.provider is distinct from v_provider
        or v_attempt.entry_ids is distinct from p_entry_ids
        or v_attempt.entry_count is distinct from v_entry_count
        or v_attempt.entry_snapshot_hash is distinct from v_entry_snapshot_hash
        or v_attempt.request_payload_hash is distinct from p_request_payload_hash
        or v_attempt.template_version is distinct from p_template_version
      )
    ) then
    if v_attempt_found and v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'delivery_payload_drift',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'delivery_payload_drift',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', case
        when v_attempt_found then v_attempt.id
        else null
      end,
      'error', jsonb_build_object(
        'code', 'delivery_payload_drift',
        'message', 'Delivery payload no longer matches the entry snapshot'
      )
    );
  end if;

  if v_attempt_found then
    if v_attempt.status = 'processing' then
      return jsonb_build_object(
        'ok', true,
        'status', 'processing',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'generation', v_attempt.generation,
        'provider', v_attempt.provider,
        'idempotency_key', v_attempt.idempotency_key,
        'entry_ids', to_jsonb(v_attempt.entry_ids),
        'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
        'template_version', v_attempt.template_version,
        'epoch', v_fulfillment.reconcile_lease_epoch,
        'idempotent', true
      );
    end if;

    v_provider_call_at := greatest(
      clock_timestamp(),
      v_attempt.last_provider_call_at + interval '1 microsecond'
    );

    if v_provider_call_at >= v_attempt.idempotency_expires_at then
      v_now := clock_timestamp();
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'ambiguous_idempotency_window_expired',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;

      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'error', jsonb_build_object(
          'code', 'ambiguous_idempotency_window_expired',
          'message', 'Idempotency window expired'
        )
      );
    end if;

    update public.access_email_delivery_attempts
    set
      status = 'processing',
      error_code = null,
      provider_call_count = provider_call_count + 1,
      last_provider_call_at = v_provider_call_at,
      provider_message_id = null,
      finished_at = null
    where id = v_attempt.id
    returning * into v_attempt;

    update public.access_order_fulfillments
    set
      email_status = 'processing',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      updated_at = v_provider_call_at
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', true,
      'status', 'processing',
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'generation', v_attempt.generation,
      'provider', v_attempt.provider,
      'idempotency_key', v_attempt.idempotency_key,
      'entry_ids', to_jsonb(v_attempt.entry_ids),
      'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
      'template_version', v_attempt.template_version,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'idempotent', false
    );
  end if;

  if v_fulfillment.email_status = 'sent' then
    return jsonb_build_object(
      'ok', true,
      'status', 'skipped_sent',
      'order_id', v_order.id,
      'generation', v_fulfillment.email_generation,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'idempotent', true
    );
  end if;

  if v_fulfillment.email_status = 'manual_review' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'email_manual_review',
        'message', 'Email delivery requires manual review'
      )
    );
  end if;

  perform 1
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
    and access_email_delivery_attempts.status = 'accepted'
  for update;

  if found then
    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'delivery_state_conflict',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  v_now := clock_timestamp();
  v_attempt_id := gen_random_uuid();
  v_idempotency_key := 'access-email-delivery/' || v_attempt_id::text;

  insert into public.access_email_delivery_attempts (
    id,
    order_id,
    generation,
    trigger_type,
    status,
    idempotency_key,
    idempotency_expires_at,
    provider,
    entry_ids,
    entry_count,
    entry_snapshot_hash,
    request_payload_hash,
    template_version,
    provider_message_id,
    error_code,
    requested_by_auth_user_id,
    provider_call_count,
    last_provider_call_at,
    started_at,
    finished_at,
    created_at
  )
  values (
    v_attempt_id,
    v_order.id,
    v_fulfillment.email_generation,
    'automatic',
    'processing',
    v_idempotency_key,
    v_now + interval '24 hours',
    v_provider,
    v_entry_ids,
    v_entry_count,
    v_entry_snapshot_hash,
    p_request_payload_hash,
    p_template_version,
    null,
    null,
    null,
    1,
    v_now,
    v_now,
    null,
    v_now
  )
  returning * into v_attempt;

  update public.access_order_fulfillments
  set
    email_status = 'processing',
    email_next_attempt_at = null,
    email_sent_at = null,
    email_last_error_code = null,
    email_last_error_at = null,
    email_provider_message_id = null,
    updated_at = v_now
  where order_id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'processing',
    'order_id', v_order.id,
    'delivery_attempt_id', v_attempt.id,
    'generation', v_attempt.generation,
    'provider', v_attempt.provider,
    'idempotency_key', v_attempt.idempotency_key,
    'entry_ids', to_jsonb(v_attempt.entry_ids),
    'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
    'template_version', v_attempt.template_version,
    'epoch', v_fulfillment.reconcile_lease_epoch,
    'idempotent', false
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  owner to postgres;
revoke all on function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  to service_role;
create or replace function public.record_access_email_delivery_outcome(
  p_order_id uuid,
  p_delivery_attempt_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_retry_after_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_attempt public.access_email_delivery_attempts%rowtype;
  v_now timestamptz;
  v_outcome text;
  v_provider_message_id text;
  v_error_code text;
  v_entry_ids uuid[];
  v_entry_count integer;
  v_entry_snapshot_hash text;
  v_snapshot_drift boolean := false;
  v_projection_failed boolean := false;
  v_projected_count integer := 0;
begin
  if p_order_id is null
    or p_delivery_attempt_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or p_outcome is null
    or lower(trim(p_outcome)) not in ('accepted', 'failed', 'ambiguous')
    or (
      p_retry_after_seconds is not null
      and (p_retry_after_seconds < 0 or p_retry_after_seconds > 604800)
    ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  v_outcome := lower(trim(p_outcome));
  v_provider_message_id := nullif(trim(p_provider_message_id), '');
  v_error_code := nullif(trim(p_error_code), '');

  if v_outcome = 'accepted' and (
    v_provider_message_id is null or v_error_code is not null
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  if v_outcome in ('failed', 'ambiguous') and (
    v_error_code is null or v_provider_message_id is not null
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'order_not_found', 'message', 'Order not found')
    );
  end if;

  select *
  into v_fulfillment
  from public.access_order_fulfillments
  where access_order_fulfillments.order_id = v_order.id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_not_found',
        'message', 'Fulfillment not found'
      )
    );
  end if;

  select *
  into v_attempt
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.id = p_delivery_attempt_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_attempt_not_found',
        'message', 'Delivery attempt not found'
      )
    );
  end if;

  if v_attempt.order_id is distinct from v_order.id then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'delivery_attempt_mismatch',
        'message', 'Delivery attempt mismatch'
      )
    );
  end if;

  -- Identical terminal replays are recognized before checking the active lease.
  if v_attempt.status = 'accepted' then
    if v_outcome = 'accepted'
      and v_attempt.provider_message_id is not distinct from v_provider_message_id then
      return jsonb_build_object(
        'ok', true,
        'status', 'accepted',
        'accepted', true,
        'manual_review',
          v_fulfillment.email_status = 'manual_review'
          and v_fulfillment.email_last_error_code
            = 'delivery_entry_snapshot_drift',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'idempotent', true
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'outcome_conflict',
        'message', 'Delivery outcome conflict'
      )
    );
  end if;

  if v_attempt.status = 'failed' then
    if v_outcome = 'failed'
      and v_attempt.error_code is not distinct from v_error_code then
      return jsonb_build_object(
        'ok', true,
        'status', 'failed',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'idempotent', true
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'outcome_conflict',
        'message', 'Delivery outcome conflict'
      )
    );
  end if;

  if v_attempt.status = 'ambiguous' then
    if v_outcome = 'ambiguous'
      and v_attempt.error_code is not distinct from v_error_code then
      return jsonb_build_object(
        'ok', true,
        'status', 'ambiguous',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'idempotent', true
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'outcome_conflict',
        'message', 'Delivery outcome conflict'
      )
    );
  end if;

  if v_attempt.status <> 'processing'
    or v_attempt.generation is distinct from v_fulfillment.email_generation then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'outcome_conflict',
        'message', 'Delivery outcome conflict'
      )
    );
  end if;

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  perform 1
  from public.access_order_items
  where access_order_items.order_id = v_order.id
  order by access_order_items.id
  for update;

  perform 1
  from public.access_entries
  where access_entries.order_id = v_order.id
  order by
    access_entries.order_item_id,
    access_entries.unit_index,
    access_entries.id
  for update;

  select entry_ids, entry_count, entry_snapshot_hash
  into v_entry_ids, v_entry_count, v_entry_snapshot_hash
  from public.access_core_entry_snapshot(v_order.id);

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  v_snapshot_drift :=
    v_entry_ids is distinct from v_attempt.entry_ids
    or v_entry_count is distinct from v_attempt.entry_count
    or v_entry_snapshot_hash is distinct from v_attempt.entry_snapshot_hash;

  if v_outcome = 'accepted' then
    if exists (
      select 1
      from public.access_email_delivery_attempts
      where access_email_delivery_attempts.provider = v_attempt.provider
        and access_email_delivery_attempts.provider_message_id = v_provider_message_id
        and access_email_delivery_attempts.id <> v_attempt.id
    ) then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'error', jsonb_build_object(
          'code', 'provider_message_conflict',
          'message', 'Provider message conflict'
        )
      );
    end if;

    if not v_snapshot_drift then
      begin
        update public.access_entries
        set
          email_status = 'sent',
          email_sent_at = case
            when access_entries.email_status = 'sent'
              and access_entries.email_sent_at is not null
              then access_entries.email_sent_at
            else v_now
          end
        where access_entries.order_id = v_order.id
          and access_entries.id = any(v_attempt.entry_ids);

        get diagnostics v_projected_count = row_count;
        if v_projected_count <> v_attempt.entry_count then
          raise exception using
            errcode = 'P0001',
            message = 'Delivery projection row count mismatch';
        end if;
      exception
        when sqlstate 'P0001' then
          v_projection_failed := true;
      end;
    end if;

    v_snapshot_drift := v_snapshot_drift or v_projection_failed;

    update public.access_email_delivery_attempts
    set
      status = 'accepted',
      provider_message_id = v_provider_message_id,
      error_code = null,
      finished_at = v_now
    where id = v_attempt.id;

    if v_snapshot_drift then
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'delivery_entry_snapshot_drift',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    else
      update public.access_order_fulfillments
      set
        email_status = 'sent',
        email_next_attempt_at = null,
        email_sent_at = v_now,
        email_last_error_code = null,
        email_last_error_at = null,
        email_provider_message_id = v_provider_message_id,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'accepted',
      'accepted', true,
      'manual_review', v_snapshot_drift,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'idempotent', false
    );
  end if;

  if v_outcome = 'failed' then
    update public.access_email_delivery_attempts
    set
      status = 'failed',
      provider_message_id = null,
      error_code = v_error_code,
      finished_at = v_now
    where id = v_attempt.id;

    if v_snapshot_drift then
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'delivery_entry_snapshot_drift',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    else
      update public.access_order_fulfillments
      set
        email_status = case
          when p_retry_after_seconds is null then 'manual_review'
          else 'failed'
        end,
        email_next_attempt_at = case
          when p_retry_after_seconds is null then null
          else v_now + make_interval(secs => p_retry_after_seconds)
        end,
        email_sent_at = null,
        email_last_error_code = v_error_code,
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', case
        when v_snapshot_drift or p_retry_after_seconds is null
          then 'manual_review'
        else 'failed'
      end,
      'manual_review', v_snapshot_drift or p_retry_after_seconds is null,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'retryable', not v_snapshot_drift and p_retry_after_seconds is not null,
      'idempotent', false
    );
  end if;

  update public.access_email_delivery_attempts
  set
    status = 'ambiguous',
    provider_message_id = null,
    error_code = v_error_code,
    finished_at = null
  where id = v_attempt.id;

  if v_snapshot_drift then
    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'delivery_entry_snapshot_drift',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;
  else
    update public.access_order_fulfillments
    set
      email_status = case
        when v_now >= v_attempt.idempotency_expires_at then 'manual_review'
        else 'failed'
      end,
      email_next_attempt_at = case
        when v_now >= v_attempt.idempotency_expires_at then null
        when p_retry_after_seconds is null then v_now
        else v_now + make_interval(secs => p_retry_after_seconds)
      end,
      email_sent_at = null,
      email_last_error_code = case
        when v_now >= v_attempt.idempotency_expires_at
          then 'ambiguous_idempotency_window_expired'
        else v_error_code
      end,
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', case
      when v_snapshot_drift or v_now >= v_attempt.idempotency_expires_at
        then 'manual_review'
      else 'ambiguous'
    end,
    'manual_review', v_snapshot_drift or v_now >= v_attempt.idempotency_expires_at,
    'order_id', v_order.id,
    'delivery_attempt_id', v_attempt.id,
    'retryable',
      not v_snapshot_drift and v_now < v_attempt.idempotency_expires_at,
    'idempotent', false
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'provider_message_conflict',
        'message', 'Provider message conflict'
      )
    );
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.record_access_email_delivery_outcome(
  uuid, uuid, uuid, bigint, text, text, text, integer
)
  owner to postgres;
revoke all on function public.record_access_email_delivery_outcome(
  uuid, uuid, uuid, bigint, text, text, text, integer
)
  from public, anon, authenticated, service_role;
grant execute on function public.record_access_email_delivery_outcome(
  uuid, uuid, uuid, bigint, text, text, text, integer
)
  to service_role;
create or replace function public.release_access_fulfillment_lease(
  p_order_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_retry_after_seconds integer default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_now timestamptz;
  v_error_code text := nullif(trim(p_error_code), '');
  v_processing_found boolean := false;
begin
  if p_order_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or (
      p_retry_after_seconds is not null
      and (p_retry_after_seconds < 0 or p_retry_after_seconds > 604800)
    ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'order_not_found', 'message', 'Order not found')
    );
  end if;

  select *
  into v_fulfillment
  from public.access_order_fulfillments
  where access_order_fulfillments.order_id = v_order.id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_not_found',
        'message', 'Fulfillment not found'
      )
    );
  end if;

  perform 1
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
    and access_email_delivery_attempts.status = 'processing'
  order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
  limit 1
  for update;
  v_processing_found := found;

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  if v_processing_found or v_fulfillment.email_status = 'processing' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'provider_outcome_required',
        'message', 'Provider outcome is required'
      )
    );
  end if;

  if v_fulfillment.issuance_status = 'manual_review'
    or v_fulfillment.issuance_review_status = 'manual_review'
    or v_fulfillment.email_status in ('sent', 'manual_review') then
    update public.access_order_fulfillments
    set
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', true,
      'status', 'released',
      'terminal', true,
      'order_id', v_order.id,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'retryable', false
    );
  end if;

  if v_fulfillment.issuance_status in ('pending', 'partial') then
    update public.access_order_fulfillments
    set
      issuance_next_attempt_at = v_now + make_interval(
        secs => coalesce(p_retry_after_seconds, 0)
      ),
      issuance_last_error_code = case
        when v_error_code is not null then v_error_code
        else issuance_last_error_code
      end,
      issuance_last_error_at = case
        when v_error_code is not null then v_now
        else issuance_last_error_at
      end,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;
  else
    update public.access_order_fulfillments
    set
      email_status = case
        when v_error_code is not null then 'failed'
        else email_status
      end,
      email_next_attempt_at = v_now + make_interval(
        secs => coalesce(p_retry_after_seconds, 0)
      ),
      email_last_error_code = case
        when v_error_code is not null then v_error_code
        else email_last_error_code
      end,
      email_last_error_at = case
        when v_error_code is not null then v_now
        else email_last_error_at
      end,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'released',
    'order_id', v_order.id,
    'epoch', v_fulfillment.reconcile_lease_epoch,
    'retryable', true
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.release_access_fulfillment_lease(
  uuid, uuid, bigint, integer, text
)
  owner to postgres;
revoke all on function public.release_access_fulfillment_lease(
  uuid, uuid, bigint, integer, text
)
  from public, anon, authenticated, service_role;
grant execute on function public.release_access_fulfillment_lease(
  uuid, uuid, bigint, integer, text
)
  to service_role;
-- Assert effective table/function privileges, ownership, secure definers,
-- RLS, and absence of client policies. Any inherited PUBLIC access is included.
do $$
declare
  v_table text;
  v_function text;
  v_role text;
  v_privilege text;
  v_expected boolean;
  v_actual boolean;
  v_function_oid oid;
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_order_fulfillments'
      and (
        (
          column_name = 'issuance_review_status'
          and data_type = 'text'
          and is_nullable = 'NO'
          and column_default = '''none''::text'
        )
        or (
          column_name = 'issuance_review_error_code'
          and data_type = 'text'
          and is_nullable = 'YES'
        )
        or (
          column_name = 'issuance_review_error_at'
          and data_type = 'timestamp with time zone'
          and is_nullable = 'YES'
        )
      )
  ) <> 3 then
    raise exception
      'Migration 046 assertion failed: issuance review columns are missing or invalid';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.access_order_fulfillments'::regclass
      and conname in (
        'access_order_fulfillments_issuance_review_status_chk',
        'access_order_fulfillments_issuance_review_error_chk',
        'access_order_fulfillments_issuance_review_relation_chk'
      )
  ) <> 3 then
    raise exception
      'Migration 046 assertion failed: issuance review constraints are missing';
  end if;

  foreach v_table in array array[
    'public.access_order_fulfillments',
    'public.access_email_delivery_attempts',
    'public.access_order_items'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      ]
      loop
        v_expected := v_role = 'service_role' and v_privilege = 'SELECT';
        v_actual := has_table_privilege(v_role, v_table, v_privilege);
        if v_actual is distinct from v_expected then
          raise exception
            'Migration 046 assertion failed: % privilege % on % is %, expected %',
            v_role, v_privilege, v_table, v_actual, v_expected;
        end if;
      end loop;

      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'REFERENCES'
      ]
      loop
        v_expected := v_role = 'service_role' and v_privilege = 'SELECT';
        v_actual := has_any_column_privilege(v_role, v_table, v_privilege);
        if v_actual is distinct from v_expected then
          raise exception
            'Migration 046 assertion failed: % column privilege % on % is %, expected %',
            v_role, v_privilege, v_table, v_actual, v_expected;
        end if;
      end loop;

      if current_setting('server_version_num')::integer >= 170000 then
        v_actual := has_table_privilege(v_role, v_table, 'MAINTAIN');
        if v_actual then
          raise exception
            'Migration 046 assertion failed: % has MAINTAIN on %',
            v_role, v_table;
        end if;
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'access_order_fulfillments',
        'access_email_delivery_attempts',
        'access_order_items'
      )
      and not pg_class.relrowsecurity
  ) then
    raise exception 'Migration 046 assertion failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.access_order_fulfillments'::regclass,
      'public.access_email_delivery_attempts'::regclass
    )
  ) then
    raise exception 'Migration 046 assertion failed: unexpected client policy';
  end if;

  foreach v_function in array array[
    'public.reconcile_access_order_fulfillment(uuid,uuid,uuid,bigint)',
    'public.issue_access_entries_for_paid_order(uuid,uuid)',
    'public.claim_access_fulfillment_batch(uuid,integer,integer)',
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)',
    'public.record_access_email_delivery_outcome(uuid,uuid,uuid,bigint,text,text,text,integer)',
    'public.release_access_fulfillment_lease(uuid,uuid,bigint,integer,text)'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      v_expected := v_role = 'service_role';
      v_actual := has_function_privilege(v_role, v_function, 'EXECUTE');
      if v_actual is distinct from v_expected then
        raise exception
          'Migration 046 assertion failed: % EXECUTE on % is %, expected %',
          v_role, v_function, v_actual, v_expected;
      end if;
    end loop;

    v_function_oid := to_regprocedure(v_function);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc
        where pg_proc.oid = v_function_oid
          and pg_proc.prosecdef
          and pg_proc.proowner = 'postgres'::regrole
          and exists (
            select 1
            from unnest(coalesce(pg_proc.proconfig, array[]::text[]))
              as config(setting)
            where config.setting = 'search_path=public, pg_temp'
          )
      ) then
      raise exception
        'Migration 046 assertion failed: unsafe or missing RPC %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'public.access_core_entry_snapshot(uuid)',
    'public.guard_access_order_items_frozen()',
    'public.guard_access_entries_fulfilled()',
    'public.guard_access_email_delivery_attempts()'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception
          'Migration 046 assertion failed: internal function is executable by %: %',
          v_role, v_function;
      end if;
    end loop;

    v_function_oid := to_regprocedure(v_function);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc
        where pg_proc.oid = v_function_oid
          and pg_proc.prosecdef
          and pg_proc.proowner = 'postgres'::regrole
          and exists (
            select 1
            from unnest(coalesce(pg_proc.proconfig, array[]::text[]))
              as config(setting)
            where config.setting = 'search_path=public, pg_temp'
          )
      ) then
      raise exception
        'Migration 046 assertion failed: unsafe or missing internal function %',
        v_function;
    end if;
  end loop;
end;
$$;

commit;
