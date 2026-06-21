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
  v_attempt public.payment_attempts%rowtype;
  v_order public.access_orders%rowtype;
  v_reservation record;
  v_reservation_count integer := 0;
  v_reservation_active_count integer := 0;
  v_reservation_consumable_count integer := 0;
  v_reservation_consumed_count integer := 0;
  v_reservation_expired_reserved_count integer := 0;
  v_reservation_released_or_expired_count integer := 0;
  v_other_transaction_attempt_id uuid;
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

  select *
  into v_attempt
  from public.payment_attempts
  where payment_attempts.provider = 'bancard'
    and payment_attempts.provider_operation = 'single_buy'
    and payment_attempts.provider_attempt_ref = v_shop_process_id
  for update;

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
  where access_orders.id = v_attempt.order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'payment_attempt_id', v_attempt.id,
      'order_id', v_attempt.order_id,
      'error', jsonb_build_object(
        'code', 'order_not_found',
        'message', 'Order not found'
      )
    );
  end if;

  for v_reservation in
    select
      access_stock_reservations.status,
      access_stock_reservations.expires_at
    from public.access_stock_reservations
    where access_stock_reservations.order_id = v_attempt.order_id
    for update
  loop
    v_reservation_count := v_reservation_count + 1;

    if v_reservation.status in ('reserved', 'manual_hold') then
      v_reservation_active_count := v_reservation_active_count + 1;
    end if;

    if v_reservation.status = 'manual_hold' then
      v_reservation_consumable_count := v_reservation_consumable_count + 1;
    end if;

    if v_reservation.status = 'reserved' then
      if v_reservation.expires_at > v_now then
        v_reservation_consumable_count := v_reservation_consumable_count + 1;
      else
        v_reservation_expired_reserved_count := v_reservation_expired_reserved_count + 1;
      end if;
    end if;

    if v_reservation.status = 'consumed' then
      v_reservation_consumed_count := v_reservation_consumed_count + 1;
    end if;

    if v_reservation.status in ('released', 'expired') then
      v_reservation_released_or_expired_count := v_reservation_released_or_expired_count + 1;
    end if;
  end loop;

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
  elsif v_order.id is distinct from v_attempt.order_id then
    v_error_code := 'order_mismatch';
    v_manual_review_reason := 'Order mismatch';
  elsif v_reservation_count = 0 then
    v_error_code := 'stock_reservation_not_found';
    v_manual_review_reason := 'Stock reservation not found';
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
      limit 1
      for update;

      if found then
        v_error_code := 'provider_transaction_conflict';
        v_manual_review_reason := 'Provider transaction conflict';
      end if;
    end if;
  end if;

  if v_error_code is null then
    if v_attempt.status = 'approved' then
      if v_response_code = '00' then
        if v_order.status <> 'paid' then
          v_error_code := 'approved_order_status_mismatch';
          v_manual_review_reason := 'Approved payment order is not paid';
        elsif v_reservation_count = 0 then
          v_error_code := 'stock_reservation_not_found';
          v_manual_review_reason := 'Stock reservation not found';
        elsif v_reservation_consumed_count <> v_reservation_count then
          v_error_code := 'approved_stock_status_mismatch';
          v_manual_review_reason := 'Approved payment stock is not consumed';
        else
          return jsonb_build_object(
            'ok', true,
            'status', 'approved',
            'idempotent', true,
            'manual_review', false,
            'order_id', v_order.id,
            'payment_attempt_id', v_attempt.id,
            'public_ref', v_order.public_ref
          );
        end if;
      else
        v_error_code := 'approved_conflicting_callback';
        v_manual_review_reason := 'Approved payment received conflicting callback';
      end if;
    elsif v_attempt.status = 'rejected' then
      if v_response_code <> '00' then
        if v_order.status <> 'cancelled' then
          v_error_code := 'rejected_order_status_mismatch';
          v_manual_review_reason := 'Rejected payment order is not cancelled';
        elsif v_reservation_consumed_count > 0 then
          v_error_code := 'stock_already_consumed';
          v_manual_review_reason := 'Stock reservation is already consumed';
        elsif v_reservation_consumable_count > 0 or v_reservation_expired_reserved_count > 0 then
          v_error_code := 'rejected_stock_status_mismatch';
          v_manual_review_reason := 'Rejected payment stock is not released';
        else
          return jsonb_build_object(
            'ok', true,
            'status', 'rejected',
            'idempotent', true,
            'manual_review', false,
            'order_id', v_order.id,
            'payment_attempt_id', v_attempt.id,
            'public_ref', v_order.public_ref
          );
        end if;
      else
        v_error_code := 'rejected_conflicting_callback';
        v_manual_review_reason := 'Rejected payment received approved callback';
      end if;
    elsif v_attempt.status not in ('provider_ready', 'manual_review') then
      v_error_code := 'attempt_status_incompatible';
      v_manual_review_reason := 'Payment attempt status is incompatible';
    end if;
  end if;

  if v_error_code is null and v_response_code = '00' then
    if v_order.status not in ('pending_payment', 'manual_review') then
      v_error_code := 'order_status_incompatible';
      v_manual_review_reason := 'Order status is incompatible';
    elsif v_reservation_consumed_count > 0 then
      v_error_code := 'stock_already_consumed';
      v_manual_review_reason := 'Stock reservation is already consumed';
    elsif v_reservation_expired_reserved_count > 0 then
      v_error_code := 'stock_reservation_expired';
      v_manual_review_reason := 'Stock reservation is expired';
    elsif v_reservation_released_or_expired_count > 0
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

  if v_error_code is not null then
    if v_attempt.status = 'approved' then
      update public.payment_attempts
      set
        provider_status = v_response,
        provider_response_code = v_response_code,
        callback_payload = p_callback_payload,
        last_error = v_error_code,
        manual_review_reason = v_manual_review_reason,
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
        manual_review_reason = v_manual_review_reason,
        updated_at = v_now
      where access_orders.id = v_order.id;
    end if;

    update public.access_stock_reservations
    set
      status = 'manual_hold',
      released_at = null
    where access_stock_reservations.order_id = v_order.id
      and access_stock_reservations.status = 'reserved';

    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'idempotent', false,
      'manual_review', true,
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
        last_error = null,
        manual_review_reason = null,
        confirmed_at = v_now,
        updated_at = v_now
      where payment_attempts.id = v_attempt.id;
    exception
      when unique_violation then
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

        update public.access_stock_reservations
        set
          status = 'manual_hold',
          released_at = null
        where access_stock_reservations.order_id = v_order.id
          and access_stock_reservations.status = 'reserved';

        return jsonb_build_object(
          'ok', true,
          'status', 'manual_review',
          'idempotent', false,
          'manual_review', true,
          'order_id', v_order.id,
          'payment_attempt_id', v_attempt.id,
          'public_ref', v_order.public_ref,
          'error', jsonb_build_object(
            'code', 'provider_transaction_conflict',
            'message', 'Provider transaction conflict'
          )
        );
    end;

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
      'idempotent', false,
      'manual_review', false,
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

      update public.access_stock_reservations
      set
        status = 'manual_hold',
        released_at = null
      where access_stock_reservations.order_id = v_order.id
        and access_stock_reservations.status = 'reserved';

      return jsonb_build_object(
        'ok', true,
        'status', 'manual_review',
        'idempotent', false,
        'manual_review', true,
        'order_id', v_order.id,
        'payment_attempt_id', v_attempt.id,
        'public_ref', v_order.public_ref,
        'error', jsonb_build_object(
          'code', 'provider_transaction_conflict',
          'message', 'Provider transaction conflict'
        )
      );
  end;

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
    'idempotent', false,
    'manual_review', false,
    'order_id', v_order.id,
    'payment_attempt_id', v_attempt.id,
    'public_ref', v_order.public_ref
  );
end;
$$;

revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.confirm_bancard_access_payment(text, text, text, text, text, text, text, text, text, jsonb) to service_role;

commit;
