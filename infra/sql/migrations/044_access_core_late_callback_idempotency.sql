begin;

create or replace function public.confirm_bancard_access_payment(
  p_shop_process_id text,
  p_amount text,
  p_currency text,
  p_response text,
  p_response_code text,
  p_response_details text,
  p_response_description text,
  p_authorization_number text,
  p_ticket_number text,
  p_callback_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unfulfilled_reason constant text := 'Provider approved payment but stock is unavailable';
  v_now timestamptz := now();
  v_shop_process_id text := nullif(trim(coalesce(p_shop_process_id, '')), '');
  v_amount text := nullif(trim(coalesce(p_amount, '')), '');
  v_currency text := nullif(trim(coalesce(p_currency, '')), '');
  v_response text := nullif(trim(coalesce(p_response, '')), '');
  v_response_code text := nullif(trim(coalesce(p_response_code, '')), '');
  v_response_details text := nullif(trim(coalesce(p_response_details, '')), '');
  v_response_description text := nullif(trim(coalesce(p_response_description, '')), '');
  v_authorization_number text := nullif(trim(coalesce(p_authorization_number, '')), '');
  v_ticket_number text := nullif(trim(coalesce(p_ticket_number, '')), '');
  v_lookup_attempt_id uuid;
  v_lookup_order_id uuid;
  v_attempt public.payment_attempts%rowtype;
  v_order public.access_orders%rowtype;
  v_stock record;
  v_capacity record;
  v_stock_keys_before text[] := array[]::text[];
  v_stock_keys_after text[] := array[]::text[];
  v_locked_stock_count integer := 0;
  v_reservation_count integer := 0;
  v_reservation_consumable_count integer := 0;
  v_reservation_consumed_count integer := 0;
  v_reservation_manual_hold_count integer := 0;
  v_reservation_nonblocking_count integer := 0;
  v_other_transaction_attempt_id uuid;
  v_other_blocked bigint := 0;
  v_own_quantity bigint := 0;
  v_capacity_fits boolean := true;
  v_legacy_late_manual_hold boolean := false;
  v_provider_transaction_conflict boolean := false;
  v_error_code text;
  v_manual_review_reason text;
begin
  if v_shop_process_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Invalid shop_process_id'
      )
    );
  end if;

  -- Resolve the order without taking a payment_attempt lock. The locked row is
  -- re-read and fully revalidated after the order lock has been acquired.
  select
    payment_attempts.id,
    payment_attempts.order_id
  into
    v_lookup_attempt_id,
    v_lookup_order_id
  from public.payment_attempts
  where payment_attempts.provider = 'bancard'
    and payment_attempts.provider_operation = 'single_buy'
    and payment_attempts.provider_attempt_ref = v_shop_process_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'payment_attempt_not_found',
        'message', 'Payment attempt not found'
      )
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = v_lookup_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'payment_attempt_id', v_lookup_attempt_id,
      'order_id', v_lookup_order_id,
      'error', jsonb_build_object(
        'code', 'order_not_found',
        'message', 'Order not found'
      )
    );
  end if;

  select *
  into v_attempt
  from public.payment_attempts
  where payment_attempts.id = v_lookup_attempt_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'payment_attempt_not_found',
        'message', 'Payment attempt not found'
      )
    );
  end if;

  if v_attempt.provider <> 'bancard'
    or v_attempt.provider_operation <> 'single_buy'
    or v_attempt.provider_attempt_ref is distinct from v_shop_process_id
    or v_attempt.order_id is distinct from v_order.id then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'order_mismatch',
        'message', 'Payment attempt does not match order'
      )
    );
  end if;

  select coalesce(array_agg(stock_keys.key_text order by stock_keys.key_text), array[]::text[])
  into v_stock_keys_before
  from (
    select distinct
      access_stock_reservations.access_ticket_type_id::text
      || '|'
      || access_stock_reservations.access_date::text as key_text
    from public.access_stock_reservations
    where access_stock_reservations.order_id = v_order.id
  ) as stock_keys;

  for v_stock in
    select stock_limits.*
    from public.access_stock_limits as stock_limits
    join (
      select distinct
        access_stock_reservations.access_ticket_type_id,
        access_stock_reservations.access_date
      from public.access_stock_reservations
      where access_stock_reservations.order_id = v_order.id
    ) as order_stock_keys
      on order_stock_keys.access_ticket_type_id = stock_limits.access_ticket_type_id
      and order_stock_keys.access_date = stock_limits.access_date
    order by
      stock_limits.access_ticket_type_id,
      stock_limits.access_date
    for update of stock_limits
  loop
    v_locked_stock_count := v_locked_stock_count + 1;
  end loop;

  perform 1
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id
  order by
    access_stock_reservations.access_ticket_type_id,
    access_stock_reservations.access_date,
    access_stock_reservations.id
  for update;

  select coalesce(array_agg(stock_keys.key_text order by stock_keys.key_text), array[]::text[])
  into v_stock_keys_after
  from (
    select distinct
      access_stock_reservations.access_ticket_type_id::text
      || '|'
      || access_stock_reservations.access_date::text as key_text
    from public.access_stock_reservations
    where access_stock_reservations.order_id = v_order.id
  ) as stock_keys;

  if v_stock_keys_before is distinct from v_stock_keys_after then
    raise exception using
      errcode = '40001',
      message = 'Reservation stock keys changed concurrently';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where access_stock_reservations.status in ('reserved', 'manual_hold')
    )::integer,
    count(*) filter (
      where access_stock_reservations.status = 'consumed'
    )::integer,
    count(*) filter (
      where access_stock_reservations.status = 'manual_hold'
    )::integer,
    count(*) filter (
      where access_stock_reservations.status in ('released', 'expired')
    )::integer
  into
    v_reservation_count,
    v_reservation_consumable_count,
    v_reservation_consumed_count,
    v_reservation_manual_hold_count,
    v_reservation_nonblocking_count
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id;

  v_legacy_late_manual_hold :=
    v_order.status = 'manual_review'
    and v_attempt.status = 'manual_review'
    and v_reservation_count > 0
    and v_reservation_manual_hold_count = v_reservation_count
    and (
      v_attempt.last_error = 'stock_reservation_expired'
      or v_attempt.manual_review_reason = 'Stock reservation is expired'
      or v_order.manual_review_reason = 'Stock reservation is expired'
    );

  if v_amount is null or v_amount !~ '^[0-9]+\.[0-9]{2}$' then
    v_error_code := 'amount_invalid';
    v_manual_review_reason := 'Invalid amount';
  elsif v_currency is null or v_currency <> 'PYG' then
    v_error_code := 'currency_invalid';
    v_manual_review_reason := 'Invalid currency';
  elsif v_response_code is null then
    v_error_code := 'response_code_invalid';
    v_manual_review_reason := 'Invalid response code';
  elsif v_amount <> v_attempt.provider_amount_text
    or v_amount <> (v_attempt.amount_gs::text || '.00') then
    v_error_code := 'amount_mismatch';
    v_manual_review_reason := 'Amount mismatch';
  elsif v_currency <> v_attempt.currency then
    v_error_code := 'currency_mismatch';
    v_manual_review_reason := 'Currency mismatch';
  elsif v_reservation_count = 0 then
    v_error_code := 'stock_reservation_not_found';
    v_manual_review_reason := 'Stock reservation not found';
  elsif v_locked_stock_count <> cardinality(v_stock_keys_after) then
    v_error_code := 'stock_unconfigured';
    v_manual_review_reason := 'Stock is unconfigured';
    v_capacity_fits := false;
  end if;

  if v_error_code is null and v_ticket_number is not null then
    if v_attempt.provider_transaction_id is not null
      and v_attempt.provider_transaction_id <> v_ticket_number then
      v_error_code := 'provider_transaction_mismatch';
      v_manual_review_reason := 'Provider transaction mismatch';
    else
      select payment_attempts.id
      into v_other_transaction_attempt_id
      from public.payment_attempts
      where payment_attempts.provider = 'bancard'
        and payment_attempts.provider_operation = 'single_buy'
        and payment_attempts.provider_transaction_id = v_ticket_number
        and payment_attempts.id <> v_attempt.id
      limit 1;

      if found then
        v_error_code := 'provider_transaction_conflict';
        v_manual_review_reason := 'Provider transaction conflict';
      end if;
    end if;
  end if;

  -- Only the legacy late-callback tuple may leave manual_review automatically.
  -- Any other manual review is terminal for this RPC, including a legacy-shaped
  -- tuple whose current callback fails approval or payload validation.
  if v_attempt.status = 'manual_review' then
    v_legacy_late_manual_hold :=
      v_legacy_late_manual_hold
      and v_response_code = '00'
      and v_error_code is null;

    if v_legacy_late_manual_hold is not true then
      return jsonb_build_object(
        'ok', true,
        'status', 'manual_review',
        'outcome', 'manual_review',
        'idempotent', true,
        'manual_review', true,
        'retryable', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object(
          'code', coalesce(v_attempt.last_error, 'manual_review'),
          'message', coalesce(
            v_attempt.manual_review_reason,
            v_order.manual_review_reason,
            'Payment requires manual review'
          )
        )
      );
    end if;
  end if;

  -- Terminal states are resolved before any mutation and before capacity is
  -- recalculated. approved_but_unfulfilled is deliberately sticky.
  if v_error_code is null and v_attempt.status = 'approved' then
    if v_response_code = '00' then
      if v_order.status = 'paid'
        and v_reservation_count > 0
        and v_reservation_consumed_count = v_reservation_count then
        return jsonb_build_object(
          'ok', true,
          'status', 'approved',
          'outcome', 'approved',
          'idempotent', true,
          'manual_review', false,
          'retryable', false,
          'order_id', v_order.id,
          'payment_attempt_id', v_attempt.id,
          'public_ref', v_order.public_ref
        );
      elsif v_order.status = 'manual_review'
        and v_attempt.last_error = 'approved_but_unfulfilled'
        and v_reservation_count > 0
        and v_reservation_nonblocking_count = v_reservation_count then
        return jsonb_build_object(
          'ok', true,
          'status', 'manual_review',
          'outcome', 'approved_but_unfulfilled',
          'idempotent', true,
          'manual_review', true,
          'retryable', false,
          'order_id', v_order.id,
          'payment_attempt_id', v_attempt.id,
          'public_ref', v_order.public_ref
        );
      elsif v_order.status <> 'paid' then
        v_error_code := 'approved_order_status_mismatch';
        v_manual_review_reason := 'Approved payment order is not paid';
      elsif v_reservation_consumed_count <> v_reservation_count then
        v_error_code := 'approved_stock_status_mismatch';
        v_manual_review_reason := 'Approved payment stock is not consumed';
      end if;
    else
      v_error_code := 'approved_conflicting_callback';
      v_manual_review_reason := 'Approved payment received conflicting callback';
    end if;
  elsif v_error_code is null and v_attempt.status = 'rejected' then
    if v_response_code <> '00' then
      if v_order.status = 'cancelled'
        and v_reservation_count > 0
        and v_reservation_nonblocking_count = v_reservation_count then
        return jsonb_build_object(
          'ok', true,
          'status', 'rejected',
          'outcome', 'rejected',
          'idempotent', true,
          'manual_review', false,
          'retryable', false,
          'order_id', v_order.id,
          'payment_attempt_id', v_attempt.id,
          'public_ref', v_order.public_ref
        );
      elsif v_order.status <> 'cancelled' then
        v_error_code := 'rejected_order_status_mismatch';
        v_manual_review_reason := 'Rejected payment order is not cancelled';
      elsif v_reservation_consumed_count > 0 then
        v_error_code := 'stock_already_consumed';
        v_manual_review_reason := 'Stock reservation is already consumed';
      else
        v_error_code := 'rejected_stock_status_mismatch';
        v_manual_review_reason := 'Rejected payment stock is not released';
      end if;
    else
      v_error_code := 'rejected_conflicting_callback';
      v_manual_review_reason := 'Rejected payment received approved callback';
    end if;
  elsif v_error_code is null and v_attempt.status = 'manual_review' then
    -- The terminal gate above proves this is the permitted legacy tuple.
    -- It now reaches the common approval path exactly once under stock locks.
    null;
  elsif v_error_code is null and v_attempt.status <> 'provider_ready' then
    v_error_code := 'attempt_status_incompatible';
    v_manual_review_reason := 'Payment attempt status is incompatible';
  end if;

  if v_error_code is null and v_response_code = '00' then
    if v_order.status not in ('pending_payment', 'manual_review') then
      v_error_code := 'order_status_incompatible';
      v_manual_review_reason := 'Order status is incompatible';
    elsif v_reservation_consumed_count > 0 then
      v_error_code := 'stock_already_consumed';
      v_manual_review_reason := 'Stock reservation is already consumed';
    elsif v_reservation_nonblocking_count > 0
      or v_reservation_consumable_count <> v_reservation_count then
      v_error_code := 'stock_reservation_not_consumable';
      v_manual_review_reason := 'Stock reservation is not consumable';
    end if;
  end if;

  if v_error_code is null and v_response_code <> '00' then
    if v_order.status = 'paid' then
      v_error_code := 'order_already_paid';
      v_manual_review_reason := 'Order is already paid';
    elsif v_reservation_consumed_count > 0 then
      v_error_code := 'stock_already_consumed';
      v_manual_review_reason := 'Stock reservation is already consumed';
    end if;
  end if;

  -- All stock rows are already locked. Exclude every reservation belonging to
  -- this order from other_blocked, then add own_quantity exactly once.
  if v_reservation_count > 0
    and v_locked_stock_count = cardinality(v_stock_keys_after) then
    for v_capacity in
      select
        own_reservations.access_ticket_type_id,
        own_reservations.access_date,
        stock_limits.stock_mode,
        stock_limits.capacity,
        own_reservations.own_quantity,
        coalesce((
          select sum(other_reservations.quantity)
          from public.access_stock_reservations as other_reservations
          where other_reservations.access_ticket_type_id = own_reservations.access_ticket_type_id
            and other_reservations.access_date = own_reservations.access_date
            and other_reservations.order_id <> v_order.id
            and (
              other_reservations.status in ('consumed', 'manual_hold')
              or (
                other_reservations.status = 'reserved'
                and other_reservations.expires_at > v_now
              )
            )
        ), 0)::bigint as other_blocked
      from (
        select
          access_stock_reservations.access_ticket_type_id,
          access_stock_reservations.access_date,
          sum(access_stock_reservations.quantity)::bigint as own_quantity
        from public.access_stock_reservations
        where access_stock_reservations.order_id = v_order.id
        group by
          access_stock_reservations.access_ticket_type_id,
          access_stock_reservations.access_date
      ) as own_reservations
      join public.access_stock_limits as stock_limits
        on stock_limits.access_ticket_type_id = own_reservations.access_ticket_type_id
        and stock_limits.access_date = own_reservations.access_date
      order by
        own_reservations.access_ticket_type_id,
        own_reservations.access_date
    loop
      v_own_quantity := v_capacity.own_quantity;
      v_other_blocked := v_capacity.other_blocked;

      if v_capacity.stock_mode = 'limited'
        and v_other_blocked + v_own_quantity > v_capacity.capacity::bigint then
        v_capacity_fits := false;
      end if;
    end loop;
  else
    v_capacity_fits := false;
  end if;

  if v_error_code is not null then
    if v_attempt.status = 'approved' then
      update public.payment_attempts
      set
        provider_status = v_response,
        provider_response_code = v_response_code,
        callback_payload = p_callback_payload,
        last_error = case
          when payment_attempts.last_error = 'approved_but_unfulfilled'
            then payment_attempts.last_error
          else v_error_code
        end,
        manual_review_reason = case
          when payment_attempts.last_error = 'approved_but_unfulfilled'
            then payment_attempts.manual_review_reason
          else v_manual_review_reason
        end,
        updated_at = v_now
      where payment_attempts.id = v_attempt.id;
    else
      update public.payment_attempts
      set
        status = 'manual_review',
        provider_status = v_response,
        provider_response_code = v_response_code,
        callback_payload = p_callback_payload,
        last_error = v_error_code,
        manual_review_reason = v_manual_review_reason,
        updated_at = v_now
      where payment_attempts.id = v_attempt.id;
    end if;

    if v_order.status <> 'paid' then
      update public.access_orders
      set
        status = 'manual_review',
        manual_review_reason = case
          when v_attempt.last_error = 'approved_but_unfulfilled'
            then access_orders.manual_review_reason
          else v_manual_review_reason
        end,
        updated_at = v_now
      where access_orders.id = v_order.id;
    end if;

    if v_capacity_fits then
      update public.access_stock_reservations
      set
        status = 'manual_hold',
        released_at = null
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status = 'reserved';
    else
      update public.access_stock_reservations
      set
        status = case
          when access_stock_reservations.expires_at <= v_now then 'expired'
          else 'released'
        end,
        released_at = v_now
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status in ('reserved', 'manual_hold');
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'outcome', 'manual_review',
      'idempotent', false,
      'manual_review', true,
      'retryable', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', v_error_code,
        'message', v_manual_review_reason
      )
    );
  end if;

  if v_response_code = '00' then
    begin
      update public.payment_attempts
      set
        status = 'approved',
        provider_transaction_id = coalesce(v_ticket_number, payment_attempts.provider_transaction_id),
        provider_status = v_response,
        provider_response_code = v_response_code,
        callback_payload = p_callback_payload,
        last_error = case
          when v_capacity_fits then null
          else 'approved_but_unfulfilled'
        end,
        manual_review_reason = case
          when v_capacity_fits then null
          else v_unfulfilled_reason
        end,
        confirmed_at = v_now,
        updated_at = v_now
      where payment_attempts.id = v_attempt.id;
    exception
      when unique_violation then
        v_provider_transaction_conflict := true;
    end;

    if v_provider_transaction_conflict then
      update public.payment_attempts
      set
        status = 'manual_review',
        provider_status = v_response,
        provider_response_code = v_response_code,
        callback_payload = p_callback_payload,
        last_error = 'provider_transaction_conflict',
        manual_review_reason = 'Provider transaction conflict',
        updated_at = v_now
      where payment_attempts.id = v_attempt.id;

      update public.access_orders
      set
        status = 'manual_review',
        manual_review_reason = 'Provider transaction conflict',
        updated_at = v_now
      where access_orders.id = v_order.id;

      if v_capacity_fits then
        update public.access_stock_reservations
        set
          status = 'manual_hold',
          released_at = null
        where access_stock_reservations.order_id = v_order.id
          and access_stock_reservations.status = 'reserved';
      else
        update public.access_stock_reservations
        set
          status = case
            when access_stock_reservations.expires_at <= v_now then 'expired'
            else 'released'
          end,
          released_at = v_now
        where access_stock_reservations.order_id = v_order.id
          and access_stock_reservations.status in ('reserved', 'manual_hold');
      end if;

      return jsonb_build_object(
        'ok', true,
        'status', 'manual_review',
        'outcome', 'manual_review',
        'idempotent', false,
        'manual_review', true,
        'retryable', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object(
          'code', 'provider_transaction_conflict',
          'message', 'Provider transaction conflict'
        )
      );
    end if;

    if v_capacity_fits then
      update public.access_orders
      set
        status = 'paid',
        paid_at = v_now,
        manual_review_reason = null,
        updated_at = v_now
      where access_orders.id = v_order.id;

      update public.access_stock_reservations
      set
        status = 'consumed',
        released_at = null
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status in ('reserved', 'manual_hold');

      return jsonb_build_object(
        'ok', true,
        'status', 'approved',
        'outcome', 'approved',
        'idempotent', false,
        'manual_review', false,
        'retryable', false,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref
      );
    end if;

    update public.access_orders
    set
      status = 'manual_review',
      manual_review_reason = v_unfulfilled_reason,
      updated_at = v_now
    where access_orders.id = v_order.id;

    update public.access_stock_reservations
    set
      status = case
        when access_stock_reservations.expires_at <= v_now then 'expired'
        else 'released'
      end,
      released_at = v_now
    where access_stock_reservations.order_id = v_order.id
      and access_stock_reservations.status in ('reserved', 'manual_hold');

    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'outcome', 'approved_but_unfulfilled',
      'idempotent', false,
      'manual_review', true,
      'retryable', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref
    );
  end if;

  begin
    update public.payment_attempts
    set
      status = 'rejected',
      provider_transaction_id = coalesce(v_ticket_number, payment_attempts.provider_transaction_id),
      provider_status = v_response,
      provider_response_code = v_response_code,
      callback_payload = p_callback_payload,
      last_error = null,
      manual_review_reason = null,
      rejected_at = v_now,
      updated_at = v_now
    where payment_attempts.id = v_attempt.id;
  exception
    when unique_violation then
      v_provider_transaction_conflict := true;
  end;

  if v_provider_transaction_conflict then
    update public.payment_attempts
    set
      status = 'manual_review',
      provider_status = v_response,
      provider_response_code = v_response_code,
      callback_payload = p_callback_payload,
      last_error = 'provider_transaction_conflict',
      manual_review_reason = 'Provider transaction conflict',
      updated_at = v_now
    where payment_attempts.id = v_attempt.id;

    if v_order.status <> 'paid' then
      update public.access_orders
      set
        status = 'manual_review',
        manual_review_reason = 'Provider transaction conflict',
        updated_at = v_now
      where access_orders.id = v_order.id;
    end if;

    if v_capacity_fits then
      update public.access_stock_reservations
      set
        status = 'manual_hold',
        released_at = null
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status = 'reserved';
    else
      update public.access_stock_reservations
      set
        status = case
          when access_stock_reservations.expires_at <= v_now then 'expired'
          else 'released'
        end,
        released_at = v_now
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status in ('reserved', 'manual_hold');
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'outcome', 'manual_review',
      'idempotent', false,
      'manual_review', true,
      'retryable', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'provider_transaction_conflict',
        'message', 'Provider transaction conflict'
      )
    );
  end if;

  update public.access_orders
  set
    status = 'cancelled',
    cancelled_at = v_now,
    manual_review_reason = null,
    updated_at = v_now
  where access_orders.id = v_order.id;

  update public.access_stock_reservations
  set
    status = 'released',
    released_at = v_now
  where access_stock_reservations.order_id = v_order.id
    and access_stock_reservations.status in ('reserved', 'manual_hold');

  return jsonb_build_object(
    'ok', true,
    'status', 'rejected',
    'outcome', 'rejected',
    'idempotent', false,
    'manual_review', false,
    'retryable', false,
    'order_id', v_order.id,
    'payment_attempt_id', v_attempt.id,
    'public_ref', v_order.public_ref
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
end;
$$;

revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) to service_role;

commit;
