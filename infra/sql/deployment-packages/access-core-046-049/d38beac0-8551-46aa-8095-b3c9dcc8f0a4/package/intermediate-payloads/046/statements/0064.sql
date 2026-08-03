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