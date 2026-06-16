begin;

create or replace function public.create_access_paid_checkout(
  p_source_type text,
  p_local_id uuid,
  p_event_id uuid,
  p_access_date date,
  p_buyer jsonb,
  p_items jsonb,
  p_provider text,
  p_provider_operation text,
  p_reservation_ttl_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_source_type text := lower(nullif(trim(coalesce(p_source_type, '')), ''));
  v_provider text := lower(nullif(trim(coalesce(p_provider, '')), ''));
  v_provider_operation text := lower(nullif(trim(coalesce(p_provider_operation, '')), ''));
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_buyer_name text;
  v_buyer_last_name text;
  v_buyer_email text;
  v_buyer_phone text;
  v_buyer_document text;
  v_item jsonb;
  v_item_ticket_type_id_text text;
  v_item_ticket_type_id uuid;
  v_item_quantity_text text;
  v_item_quantity integer;
  v_ticket_ids uuid[] := array[]::uuid[];
  v_expected_count integer;
  v_found_count integer := 0;
  v_ticket record;
  v_stock record;
  v_blocked_quantity bigint;
  v_available_quantity bigint;
  v_total_amount_gs bigint := 0;
  v_provider_amount_text text;
  v_order_id uuid;
  v_public_ref text;
  v_order_status text;
  v_order_item_id uuid;
  v_reservation_id uuid;
  v_payment_attempt_id uuid;
  v_items_response jsonb := '[]'::jsonb;
  v_reservations_response jsonb := '[]'::jsonb;
begin
  if v_source_type is null or v_source_type not in ('local', 'event') then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_source',
        'message', 'Invalid source'
      )
    );
  end if;

  if (v_source_type = 'local' and (p_local_id is null or p_event_id is not null))
    or (v_source_type = 'event' and (p_event_id is null or p_local_id is not null))
    or p_access_date is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_source',
        'message', 'Invalid source'
      )
    );
  end if;

  if v_provider is null or v_provider_operation is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'provider_invalid',
        'message', 'Invalid provider'
      )
    );
  end if;

  if p_reservation_ttl_seconds is null
    or p_reservation_ttl_seconds < 60
    or p_reservation_ttl_seconds > 1800 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_item',
        'message', 'Invalid reservation ttl'
      )
    );
  end if;

  v_expires_at := v_now + make_interval(secs => p_reservation_ttl_seconds);

  if v_source_type = 'local' then
    if not exists (
      select 1
      from public.locals
      where locals.id = p_local_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_source',
          'message', 'Invalid source'
        )
      );
    end if;
  end if;

  if v_source_type = 'event' then
    if not exists (
      select 1
      from public.events
      where events.id = p_event_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'event_not_available',
          'message', 'Event is not available'
        )
      );
    end if;
  end if;

  if p_buyer is null or jsonb_typeof(p_buyer) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_buyer',
        'message', 'Invalid buyer'
      )
    );
  end if;

  v_buyer_name := nullif(trim(coalesce(p_buyer ->> 'name', '')), '');
  v_buyer_last_name := nullif(trim(coalesce(p_buyer ->> 'last_name', '')), '');
  v_buyer_email := lower(nullif(trim(coalesce(p_buyer ->> 'email', '')), ''));
  v_buyer_phone := nullif(trim(coalesce(p_buyer ->> 'phone', '')), '');
  v_buyer_document := nullif(trim(coalesce(p_buyer ->> 'document', '')), '');

  if v_buyer_name is null
    or v_buyer_last_name is null
    or v_buyer_email is null
    or v_buyer_phone is null
    or v_buyer_document is null
    or position('@' in v_buyer_email) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_buyer',
        'message', 'Invalid buyer'
      )
    );
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_item',
        'message', 'Invalid item'
      )
    );
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as items(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_item',
          'message', 'Invalid item'
        )
      );
    end if;

    v_item_ticket_type_id_text := nullif(trim(coalesce(v_item ->> 'access_ticket_type_id', '')), '');

    if v_item_ticket_type_id_text is null or v_item_ticket_type_id_text !~* v_uuid_pattern then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_item',
          'message', 'Invalid item'
        )
      );
    end if;

    v_item_ticket_type_id := v_item_ticket_type_id_text::uuid;

    if v_item_ticket_type_id = any(v_ticket_ids) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'duplicate_item',
          'message', 'Duplicate item'
        )
      );
    end if;

    v_item_quantity_text := nullif(trim(coalesce(v_item ->> 'quantity', '')), '');

    if v_item_quantity_text is null or v_item_quantity_text !~ '^[0-9]+$' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_item',
          'message', 'Invalid item'
        )
      );
    end if;

    v_item_quantity := v_item_quantity_text::integer;

    if v_item_quantity <= 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_item',
          'message', 'Invalid item'
        )
      );
    end if;

    v_ticket_ids := array_append(v_ticket_ids, v_item_ticket_type_id);
  end loop;

  v_expected_count := array_length(v_ticket_ids, 1);

  select count(*)::integer
  into v_found_count
  from public.access_ticket_types
  where access_ticket_types.id = any(v_ticket_ids);

  if v_found_count <> v_expected_count then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ticket_type_not_found',
        'message', 'Ticket type not found'
      )
    );
  end if;

  for v_ticket in
    select *
    from public.access_ticket_types
    where access_ticket_types.id = any(v_ticket_ids)
    order by access_ticket_types.id
    for update
  loop
    if v_ticket.source_type <> v_source_type
      or (v_source_type = 'local' and v_ticket.local_id is distinct from p_local_id)
      or (v_source_type = 'event' and v_ticket.event_id is distinct from p_event_id) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_item',
          'message', 'Invalid item'
        )
      );
    end if;

    if v_ticket.active is not true then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'ticket_type_inactive',
          'message', 'Ticket type is inactive'
        )
      );
    end if;

    if v_ticket.payment_kind <> 'paid' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'ticket_type_not_paid',
          'message', 'Ticket type is not paid'
        )
      );
    end if;

    if v_ticket.price_gs <= 0 or v_ticket.currency <> 'PYG' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'amount_mismatch',
          'message', 'Amount mismatch'
        )
      );
    end if;
  end loop;

  v_found_count := 0;

  for v_stock in
    select *
    from public.access_stock_limits
    where access_stock_limits.access_ticket_type_id = any(v_ticket_ids)
      and access_stock_limits.access_date = p_access_date
    order by access_stock_limits.access_ticket_type_id
    for update
  loop
    v_found_count := v_found_count + 1;

    if v_stock.source_type <> v_source_type
      or (v_source_type = 'local' and v_stock.local_id is distinct from p_local_id)
      or (v_source_type = 'event' and v_stock.event_id is distinct from p_event_id) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'stock_unconfigured',
          'message', 'Stock is unconfigured'
        )
      );
    end if;
  end loop;

  if v_found_count <> v_expected_count then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'stock_unconfigured',
        'message', 'Stock is unconfigured'
      )
    );
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as items(value)
  loop
    v_item_ticket_type_id := (v_item ->> 'access_ticket_type_id')::uuid;
    v_item_quantity := (v_item ->> 'quantity')::integer;

    select *
    into v_ticket
    from public.access_ticket_types
    where access_ticket_types.id = v_item_ticket_type_id;

    select *
    into v_stock
    from public.access_stock_limits
    where access_stock_limits.access_ticket_type_id = v_item_ticket_type_id
      and access_stock_limits.access_date = p_access_date;

    if v_stock.stock_mode = 'limited' then
      select coalesce(sum(access_stock_reservations.quantity), 0)
      into v_blocked_quantity
      from public.access_stock_reservations
      where access_stock_reservations.access_ticket_type_id = v_item_ticket_type_id
        and access_stock_reservations.access_date = p_access_date
        and (
          access_stock_reservations.status in ('consumed', 'manual_hold')
          or (
            access_stock_reservations.status = 'reserved'
            and access_stock_reservations.expires_at > v_now
          )
        );

      v_available_quantity := v_stock.capacity::bigint - v_blocked_quantity;

      if v_available_quantity < v_item_quantity then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'sold_out',
            'message', 'Sold out'
          )
        );
      end if;
    end if;

    v_total_amount_gs := v_total_amount_gs + (v_ticket.price_gs * v_item_quantity);
  end loop;

  if v_total_amount_gs <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'amount_mismatch',
        'message', 'Amount mismatch'
      )
    );
  end if;

  v_provider_amount_text := v_total_amount_gs::text || '.00';

  insert into public.access_orders (
    source_type,
    local_id,
    event_id,
    access_date,
    buyer_name,
    buyer_last_name,
    buyer_email,
    buyer_phone,
    buyer_document,
    amount_gs,
    currency,
    payment_required,
    status,
    expires_at
  )
  values (
    v_source_type,
    p_local_id,
    p_event_id,
    p_access_date,
    v_buyer_name,
    v_buyer_last_name,
    v_buyer_email,
    v_buyer_phone,
    v_buyer_document,
    v_total_amount_gs,
    'PYG',
    true,
    'pending_payment',
    v_expires_at
  )
  returning id, public_ref, status
  into v_order_id, v_public_ref, v_order_status;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as items(value)
  loop
    v_item_ticket_type_id := (v_item ->> 'access_ticket_type_id')::uuid;
    v_item_quantity := (v_item ->> 'quantity')::integer;

    select *
    into v_ticket
    from public.access_ticket_types
    where access_ticket_types.id = v_item_ticket_type_id;

    insert into public.access_order_items (
      order_id,
      access_ticket_type_id,
      name_snapshot,
      payment_kind,
      unit_price_gs,
      currency,
      quantity,
      entries_per_unit,
      subtotal_gs
    )
    values (
      v_order_id,
      v_item_ticket_type_id,
      v_ticket.name,
      'paid',
      v_ticket.price_gs,
      'PYG',
      v_item_quantity,
      v_ticket.entries_per_unit,
      v_ticket.price_gs * v_item_quantity
    )
    returning id into v_order_item_id;

    insert into public.access_stock_reservations (
      order_id,
      order_item_id,
      access_ticket_type_id,
      source_type,
      local_id,
      event_id,
      access_date,
      quantity,
      status,
      expires_at
    )
    values (
      v_order_id,
      v_order_item_id,
      v_item_ticket_type_id,
      v_source_type,
      p_local_id,
      p_event_id,
      p_access_date,
      v_item_quantity,
      'reserved',
      v_expires_at
    )
    returning id into v_reservation_id;

    v_items_response := v_items_response || jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'access_ticket_type_id', v_item_ticket_type_id,
        'name_snapshot', v_ticket.name,
        'quantity', v_item_quantity,
        'unit_price_gs', v_ticket.price_gs,
        'subtotal_gs', v_ticket.price_gs * v_item_quantity,
        'currency', 'PYG'
      )
    );

    v_reservations_response := v_reservations_response || jsonb_build_array(
      jsonb_build_object(
        'reservation_id', v_reservation_id,
        'order_item_id', v_order_item_id,
        'access_ticket_type_id', v_item_ticket_type_id,
        'quantity', v_item_quantity,
        'status', 'reserved',
        'expires_at', v_expires_at
      )
    );
  end loop;

  insert into public.payment_attempts (
    order_id,
    source_type,
    local_id,
    event_id,
    access_date,
    attempt_number,
    provider,
    provider_operation,
    provider_attempt_ref,
    provider_transaction_id,
    amount_gs,
    currency,
    provider_amount_text,
    status,
    expires_at
  )
  values (
    v_order_id,
    v_source_type,
    p_local_id,
    p_event_id,
    p_access_date,
    1,
    v_provider,
    v_provider_operation,
    null,
    null,
    v_total_amount_gs,
    'PYG',
    v_provider_amount_text,
    'created',
    v_expires_at
  )
  returning id into v_payment_attempt_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'public_ref', v_public_ref,
    'status', v_order_status,
    'expires_at', v_expires_at,
    'payment_attempt_id', v_payment_attempt_id,
    'provider', v_provider,
    'provider_operation', v_provider_operation,
    'amount_gs', v_total_amount_gs,
    'currency', 'PYG',
    'provider_amount_text', v_provider_amount_text,
    'items', v_items_response,
    'reservations', v_reservations_response
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'stock_conflict',
        'message', 'Stock conflict'
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

revoke all on function public.create_access_paid_checkout(text, uuid, uuid, date, jsonb, jsonb, text, text, integer) from public;
revoke all on function public.create_access_paid_checkout(text, uuid, uuid, date, jsonb, jsonb, text, text, integer) from anon;
revoke all on function public.create_access_paid_checkout(text, uuid, uuid, date, jsonb, jsonb, text, text, integer) from authenticated;
grant execute on function public.create_access_paid_checkout(text, uuid, uuid, date, jsonb, jsonb, text, text, integer) to service_role;

commit;
