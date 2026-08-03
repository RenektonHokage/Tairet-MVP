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