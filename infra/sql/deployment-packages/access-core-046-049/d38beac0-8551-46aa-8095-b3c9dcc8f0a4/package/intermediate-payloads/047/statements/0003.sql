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