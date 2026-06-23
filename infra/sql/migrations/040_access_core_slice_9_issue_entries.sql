begin;

create or replace function public.issue_access_entries_for_paid_order(
  p_order_id uuid,
  p_payment_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_item_count integer := 0;
  v_reservation_count integer := 0;
  v_consumed_reservation_count integer := 0;
  v_expected_entries integer := 0;
  v_existing_entries_before integer := 0;
  v_inserted_entries integer := 0;
  v_total_entries integer := 0;
begin
  if p_order_id is null or p_payment_attempt_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Invalid request'
      )
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
      'error', jsonb_build_object(
        'code', 'order_not_found',
        'message', 'Order not found'
      )
    );
  end if;

  if v_order.status <> 'paid' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'order_not_paid',
        'message', 'Order is not paid'
      )
    );
  end if;

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

  if v_attempt.status <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'payment_attempt_not_approved',
        'message', 'Payment attempt is not approved'
      )
    );
  end if;

  if v_attempt.provider <> 'bancard'
    or v_attempt.provider_operation <> 'single_buy' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'invalid_provider',
        'message', 'Invalid provider'
      )
    );
  end if;

  perform 1
  from public.access_order_items
  where access_order_items.order_id = v_order.id
  for update;

  select
    count(*)::integer,
    coalesce(sum(access_order_items.quantity * access_order_items.entries_per_unit), 0)::integer
  into
    v_item_count,
    v_expected_entries
  from public.access_order_items
  where access_order_items.order_id = v_order.id;

  if v_item_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'items_not_found',
        'message', 'Order items not found'
      )
    );
  end if;

  perform 1
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id
  for update;

  select
    count(*)::integer,
    count(*) filter (where access_stock_reservations.status = 'consumed')::integer
  into
    v_reservation_count,
    v_consumed_reservation_count
  from public.access_stock_reservations
  where access_stock_reservations.order_id = v_order.id;

  if v_reservation_count > 0
    and v_consumed_reservation_count <> v_reservation_count then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'error', jsonb_build_object(
        'code', 'stock_not_consumed',
        'message', 'Stock is not consumed'
      )
    );
  end if;

  select count(*)::integer
  into v_existing_entries_before
  from public.access_entries
  where access_entries.order_id = v_order.id;

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
  on conflict (order_item_id, unit_index) do nothing;

  get diagnostics v_inserted_entries = row_count;

  select count(*)::integer
  into v_total_entries
  from public.access_entries
  where access_entries.order_id = v_order.id;

  if v_total_entries <> v_expected_entries then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'payment_attempt_id', v_attempt.id,
      'public_ref', v_order.public_ref,
      'expected_entries', v_expected_entries,
      'existing_entries_before', v_existing_entries_before,
      'inserted_entries', v_inserted_entries,
      'total_entries', v_total_entries,
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

revoke all on function public.issue_access_entries_for_paid_order(uuid, uuid) from public;
revoke all on function public.issue_access_entries_for_paid_order(uuid, uuid) from anon;
revoke all on function public.issue_access_entries_for_paid_order(uuid, uuid) from authenticated;
grant execute on function public.issue_access_entries_for_paid_order(uuid, uuid) to service_role;

commit;
