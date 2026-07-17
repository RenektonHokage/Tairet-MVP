begin;

-- Applying this migration acquires an ACCESS EXCLUSIVE DDL lock on
-- access_order_fulfillments. Apply only in a controlled maintenance window.
-- This migration does not invoke the new RPC or mutate existing business rows.

alter table public.access_order_fulfillments
  add column email_preclaim_terminal_request_hash text null;

comment on column
  public.access_order_fulfillments.email_preclaim_terminal_request_hash is
  'Provenance marker for a terminal pre-claim email failure. Contains the SHA-256 of the canonical request, never the plaintext lease token, and does not represent a provider delivery attempt. Any future reopen or generation change must clear this marker.';

alter table public.access_order_fulfillments
  add constraint access_order_fulfillments_email_preclaim_terminal_marker_chk
  check (
    email_preclaim_terminal_request_hash is null
    or (
      email_preclaim_terminal_request_hash ~ '^[0-9a-f]{64}$'
      and issuance_status = 'complete'
      and issuance_review_status = 'none'
      and email_status = 'manual_review'
      and email_next_attempt_at is null
      and email_sent_at is null
      and (
        email_last_error_code = 'order_invalid'
        or email_last_error_code = 'order_items_invalid'
        or email_last_error_code = 'entries_not_found'
        or email_last_error_code = 'entries_invalid'
        or email_last_error_code = 'entry_count_mismatch'
        or email_last_error_code = 'entry_not_deliverable'
        or email_last_error_code = 'source_invalid'
        or email_last_error_code = 'invalid_recipient'
      )
      and email_last_error_at is not null
      and email_provider_message_id is null
      and reconcile_lease_token is null
      and reconcile_lease_expires_at is null
      and reconcile_lease_epoch > 0
      and email_generation > 0
    )
  );

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
    and fulfillment.email_preclaim_terminal_request_hash is null
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

create or replace function public.record_access_email_preclaim_terminal_failure(
  p_order_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_email_generation integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_request_hash text;
  v_now timestamptz;
  v_has_processing boolean := false;
  v_has_ambiguous boolean := false;
  v_has_accepted boolean := false;
begin
  if p_order_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or p_email_generation is null
    or p_email_generation < 1
    or p_error_code is null
    or char_length(p_error_code) = 0
    or p_error_code ~ '[[:space:]]' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Invalid request'
      )
    );
  end if;

  if p_error_code not in (
    'order_invalid',
    'order_items_invalid',
    'entries_not_found',
    'entries_invalid',
    'entry_count_mismatch',
    'entry_not_deliverable',
    'source_invalid',
    'invalid_recipient'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_error_code',
        'message', 'Invalid error code'
      )
    );
  end if;

  v_request_hash := pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_array(
          'access-email-preclaim-terminal-v1',
          p_order_id,
          p_reconcile_lease_token,
          p_reconcile_lease_epoch,
          p_email_generation,
          p_error_code
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'order_not_found',
        'message', 'Order not found'
      )
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

  -- Lock every current-generation attempt in deterministic order before
  -- reading attempt state or the wall clock.
  perform 1
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
  order by
    access_email_delivery_attempts.created_at,
    access_email_delivery_attempts.id
  for update;

  select
    coalesce(bool_or(status = 'processing'), false),
    coalesce(bool_or(status = 'ambiguous'), false),
    coalesce(bool_or(status = 'accepted'), false)
  into
    v_has_processing,
    v_has_ambiguous,
    v_has_accepted
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation;

  v_now := clock_timestamp();

  if v_fulfillment.email_generation is distinct from p_email_generation then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'generation_mismatch',
        'message', 'Email generation mismatch'
      )
    );
  end if;

  -- Lost-response replay is intentionally evaluated before the active-lease
  -- fence. The canonical request hash proves the cleared lease token.
  if v_order.status = 'paid'
    and v_fulfillment.reconcile_lease_epoch = p_reconcile_lease_epoch
    and v_fulfillment.email_status = 'manual_review'
    and v_fulfillment.email_preclaim_terminal_request_hash is not null
    and v_fulfillment.email_preclaim_terminal_request_hash = v_request_hash
    and v_fulfillment.email_last_error_code = p_error_code
    and v_fulfillment.email_last_error_at is not null
    and v_fulfillment.email_next_attempt_at is null
    and v_fulfillment.email_sent_at is null
    and v_fulfillment.email_provider_message_id is null
    and v_fulfillment.reconcile_lease_token is null
    and v_fulfillment.reconcile_lease_expires_at is null
    and v_fulfillment.issuance_status = 'complete'
    and v_fulfillment.issuance_review_status = 'none'
    and v_fulfillment.updated_at = v_fulfillment.email_last_error_at
    and not v_has_processing
    and not v_has_ambiguous
    and not v_has_accepted then
    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'terminal', true,
      'order_id', v_order.id,
      'generation', v_fulfillment.email_generation,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'error_code', v_fulfillment.email_last_error_code,
      'idempotent', true
    );
  end if;

  if v_has_processing or v_has_ambiguous then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'provider_outcome_required',
        'message', 'Provider outcome is required'
      )
    );
  end if;

  if v_fulfillment.email_preclaim_terminal_request_hash is not null then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_has_accepted then
    if v_fulfillment.email_status = 'sent' then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'error', jsonb_build_object(
          'code', 'email_already_sent',
          'message', 'Email already sent'
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_fulfillment.email_status = 'sent' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'email_already_sent',
        'message', 'Email already sent'
      )
    );
  end if;

  if v_fulfillment.email_status = 'manual_review'
    or v_order.status <> 'paid' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'stale_lease',
        'message', 'Stale lease'
      )
    );
  end if;

  if v_fulfillment.issuance_status <> 'complete'
    or v_fulfillment.issuance_review_status <> 'none'
    or v_fulfillment.email_status not in ('pending', 'failed') then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  update public.access_order_fulfillments
  set
    email_status = 'manual_review',
    email_next_attempt_at = null,
    email_sent_at = null,
    email_last_error_code = p_error_code,
    email_last_error_at = v_now,
    email_provider_message_id = null,
    reconcile_lease_token = null,
    reconcile_lease_expires_at = null,
    email_preclaim_terminal_request_hash = v_request_hash,
    updated_at = v_now
  where order_id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'manual_review',
    'terminal', true,
    'order_id', v_order.id,
    'generation', p_email_generation,
    'epoch', p_reconcile_lease_epoch,
    'error_code', p_error_code,
    'idempotent', false
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
      'error', jsonb_build_object(
        'code', 'internal_error',
        'message', 'Internal error'
      )
    );
end;
$$;

alter function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  owner to postgres;
revoke all on function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  from public, anon, authenticated, service_role;
grant execute on function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  to service_role;

-- Structural, security, and immutable-batch-baseline assertions. The normalized
-- batch baseline is derived from immutable migration 046 SHA-256
-- 6F1B39FC66B53856E19475B20539DE1377F20E29FE6AD99A79472C97DBA2FE0C.
do $$
declare
  v_column_count integer;
  v_constraint_definition text;
  v_constraint_fragment text;
  v_function text;
  v_function_oid oid;
  v_role text;
  v_expected boolean;
  v_actual boolean;
  v_batch_source text;
  v_batch_without_guard text;
  v_batch_normalized text;
  v_batch_guard constant text :=
    'and fulfillment.email_preclaim_terminal_request_hash is null';
  v_batch_default_expression text;
begin
  select count(*)
  into v_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'access_order_fulfillments'
    and column_name = 'email_preclaim_terminal_request_hash'
    and data_type = 'text'
    and is_nullable = 'YES'
    and column_default is null;

  if v_column_count <> 1 then
    raise exception
      'Migration 047 assertion failed: pre-claim marker column is missing or invalid';
  end if;

  if coalesce(
    col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ),
    ''
  ) not like '%SHA-256%'
    or col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ) not like '%plaintext lease token%'
    or col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ) not like '%does not represent a provider delivery attempt%' then
    raise exception
      'Migration 047 assertion failed: pre-claim marker comment is invalid';
  end if;

  select lower(
    regexp_replace(
      pg_get_constraintdef(pg_constraint.oid),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
  into v_constraint_definition
  from pg_constraint
  where conrelid = 'public.access_order_fulfillments'::regclass
    and conname =
      'access_order_fulfillments_email_preclaim_terminal_marker_chk'
    and contype = 'c';

  if v_constraint_definition is null then
    raise exception
      'Migration 047 assertion failed: pre-claim marker constraint is missing';
  end if;

  foreach v_constraint_fragment in array array[
    'email_preclaim_terminal_request_hash is null',
    'email_preclaim_terminal_request_hash ~ ''^[0-9a-f]{64}$''',
    'issuance_status = ''complete''',
    'issuance_review_status = ''none''',
    'email_status = ''manual_review''',
    'email_next_attempt_at is null',
    'email_sent_at is null',
    'email_last_error_at is not null',
    'email_provider_message_id is null',
    'reconcile_lease_token is null',
    'reconcile_lease_expires_at is null',
    'reconcile_lease_epoch > 0',
    'email_generation > 0',
    'email_last_error_code = ''order_invalid''',
    'email_last_error_code = ''order_items_invalid''',
    'email_last_error_code = ''entries_not_found''',
    'email_last_error_code = ''entries_invalid''',
    'email_last_error_code = ''entry_count_mismatch''',
    'email_last_error_code = ''entry_not_deliverable''',
    'email_last_error_code = ''source_invalid''',
    'email_last_error_code = ''invalid_recipient'''
  ]
  loop
    if position(v_constraint_fragment in v_constraint_definition) = 0 then
      raise exception
        'Migration 047 assertion failed: pre-claim marker constraint projection is invalid';
    end if;
  end loop;

  if (
    length(v_constraint_definition)
      - length(replace(v_constraint_definition, 'email_last_error_code =', ''))
  ) / length('email_last_error_code =') <> 8 then
    raise exception
      'Migration 047 assertion failed: pre-claim marker allowlist is not closed';
  end if;

  v_function_oid := to_regprocedure(
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
  );

  if v_function_oid is null
    or (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname =
          'record_access_email_preclaim_terminal_failure'
    ) <> 1
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_function_oid
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 047 assertion failed: pre-claim RPC definition is invalid';
  end if;

  v_function_oid := to_regprocedure(
    'public.claim_access_fulfillment_batch(uuid,integer,integer)'
  );

  if v_function_oid is null
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_function_oid
        and pg_proc.pronargs = 3
        and pg_proc.pronargdefaults = 2
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, integer, integer'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 047 assertion failed: batch RPC signature or security drifted';
  end if;

  select
    pg_get_expr(pg_proc.proargdefaults, 0),
    pg_proc.prosrc
  into
    v_batch_default_expression,
    v_batch_source
  from pg_proc
  where pg_proc.oid = v_function_oid;

  if regexp_replace(v_batch_default_expression, '[[:space:]]+', '', 'g')
      <> '25,300' then
    raise exception
      'Migration 047 assertion failed: batch RPC defaults drifted';
  end if;

  if (
    length(v_batch_source)
      - length(replace(v_batch_source, v_batch_guard, ''))
  ) / length(v_batch_guard) <> 1 then
    raise exception
      'Migration 047 assertion failed: batch marker guard count is invalid';
  end if;

  v_batch_without_guard := replace(v_batch_source, v_batch_guard, '');
  v_batch_normalized := btrim(
    regexp_replace(v_batch_without_guard, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_batch_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'a9ef6b53db5890524de598fd3d4ea65eb1aa4bf6b9f3925b03887dfb55f37c20'
  then
    raise exception
      'Migration 047 assertion failed: batch function drifted beyond the marker guard';
  end if;

  foreach v_function in array array[
    'public.claim_access_fulfillment_batch(uuid,integer,integer)',
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
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
          'Migration 047 assertion failed: function EXECUTE privilege is invalid';
      end if;
    end loop;
  end loop;

  foreach v_role in array array[
    'service_role',
    'anon',
    'authenticated',
    'public'
  ]
  loop
    v_expected := v_role = 'service_role';

    v_actual := has_table_privilege(
      v_role,
      'public.access_order_fulfillments',
      'SELECT'
    );
    if v_actual is distinct from v_expected then
      raise exception
        'Migration 047 assertion failed: fulfillment SELECT privilege is invalid';
    end if;

    foreach v_function in array array[
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ]
    loop
      if has_table_privilege(
        v_role,
        'public.access_order_fulfillments',
        v_function
      ) then
        raise exception
          'Migration 047 assertion failed: fulfillment write privilege expanded';
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
        'access_email_delivery_attempts'
      )
      and not pg_class.relrowsecurity
  ) then
    raise exception 'Migration 047 assertion failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.access_order_fulfillments'::regclass,
      'public.access_email_delivery_attempts'::regclass
    )
  ) then
    raise exception 'Migration 047 assertion failed: unexpected client policy';
  end if;
end;
$$;

commit;
