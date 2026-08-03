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
  v_response_now timestamptz;
  v_idempotency_remaining_ms bigint;
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
      v_response_now := clock_timestamp();
      v_idempotency_remaining_ms := greatest(
        0::bigint,
        floor(
          extract(
            epoch from (
              v_attempt.idempotency_expires_at - v_response_now
            )
          ) * 1000
        )::bigint
      );

      return jsonb_build_object(
        'ok', true,
        'status', 'processing',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'generation', v_attempt.generation,
        'provider', v_attempt.provider,
        'idempotency_key', v_attempt.idempotency_key,
        'entry_ids', to_jsonb(v_attempt.entry_ids),
        'entry_count', v_attempt.entry_count,
        'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
        'request_payload_hash', v_attempt.request_payload_hash,
        'template_version', v_attempt.template_version,
        'idempotency_remaining_ms', v_idempotency_remaining_ms,
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

    v_response_now := clock_timestamp();
    v_idempotency_remaining_ms := greatest(
      0::bigint,
      floor(
        extract(
          epoch from (
            v_attempt.idempotency_expires_at - v_response_now
          )
        ) * 1000
      )::bigint
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'processing',
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'generation', v_attempt.generation,
      'provider', v_attempt.provider,
      'idempotency_key', v_attempt.idempotency_key,
      'entry_ids', to_jsonb(v_attempt.entry_ids),
      'entry_count', v_attempt.entry_count,
      'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
      'request_payload_hash', v_attempt.request_payload_hash,
      'template_version', v_attempt.template_version,
      'idempotency_remaining_ms', v_idempotency_remaining_ms,
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

  v_response_now := clock_timestamp();
  v_idempotency_remaining_ms := greatest(
    0::bigint,
    floor(
      extract(
        epoch from (
          v_attempt.idempotency_expires_at - v_response_now
        )
      ) * 1000
    )::bigint
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'processing',
    'order_id', v_order.id,
    'delivery_attempt_id', v_attempt.id,
    'generation', v_attempt.generation,
    'provider', v_attempt.provider,
    'idempotency_key', v_attempt.idempotency_key,
    'entry_ids', to_jsonb(v_attempt.entry_ids),
    'entry_count', v_attempt.entry_count,
    'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
    'request_payload_hash', v_attempt.request_payload_hash,
    'template_version', v_attempt.template_version,
    'idempotency_remaining_ms', v_idempotency_remaining_ms,
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