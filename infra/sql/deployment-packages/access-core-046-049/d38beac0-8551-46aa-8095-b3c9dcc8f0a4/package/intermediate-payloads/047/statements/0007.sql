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