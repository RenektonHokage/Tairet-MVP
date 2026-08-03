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