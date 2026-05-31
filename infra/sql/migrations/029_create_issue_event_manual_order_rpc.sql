begin;

create or replace function public.issue_event_manual_order(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_buyer jsonb,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_email_pattern constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
  v_event_status text;
  v_buyer_name text;
  v_buyer_last_name text;
  v_buyer_email text;
  v_buyer_phone text;
  v_buyer_document text;
  v_ticket_ids uuid[] := array[]::uuid[];
  v_item jsonb;
  v_item_index integer := 0;
  v_item_ticket_type_id uuid;
  v_item_ticket_type_id_text text;
  v_item_quantity integer;
  v_item_quantity_text text;
  v_attendees jsonb;
  v_expected_attendees_count integer;
  v_attendee record;
  v_ticket record;
  v_locked_ticket_id uuid;
  v_issued_commercial_units integer;
  v_entry_unit_price_amount bigint;
  v_order_total_amount bigint := 0;
  v_order_id uuid;
  v_order_item_id uuid;
  v_entry_id uuid;
  v_items_response jsonb := '[]'::jsonb;
  v_entries_response jsonb := '[]'::jsonb;
begin
  if p_event_id is null
    or p_actor_auth_user_id is null
    or p_buyer is null
    or p_items is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_input',
        'message', 'Invalid manual issue input'
      )
    );
  end if;

  select events.status
  into v_event_status
  from public.events
  where events.id = p_event_id;

  if v_event_status is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'event_not_found',
        'message', 'Event not found'
      )
    );
  end if;

  if v_event_status not in ('draft', 'published') then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'event_not_operable',
        'message', 'Event is not open for manual issue'
      )
    );
  end if;

  if not exists (
    select 1
    from public.event_panel_users
    where event_panel_users.event_id = p_event_id
      and event_panel_users.auth_user_id = p_actor_auth_user_id
      and event_panel_users.role in ('owner', 'staff')
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'forbidden',
        'message', 'User not authorized for event manual issue'
      )
    );
  end if;

  if jsonb_typeof(p_buyer) <> 'object' then
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
    or v_buyer_email !~* v_email_pattern then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_buyer',
        'message', 'Invalid buyer'
      )
    );
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_items',
        'message', 'Invalid items'
      )
    );
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) with ordinality as items(value, ordinality)
    order by ordinality
  loop
    v_item_index := v_item_index + 1;

    if jsonb_typeof(v_item) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_items',
          'message', 'Invalid items'
        )
      );
    end if;

    v_item_ticket_type_id_text := nullif(trim(coalesce(v_item ->> 'ticket_type_id', '')), '');
    if v_item_ticket_type_id_text is null
      or v_item_ticket_type_id_text !~* v_uuid_pattern then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_items',
          'message', 'Invalid ticket type id'
        )
      );
    end if;

    v_item_ticket_type_id := v_item_ticket_type_id_text::uuid;

    if v_item_ticket_type_id = any(v_ticket_ids) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_items',
          'message', 'Duplicate ticket type in request'
        )
      );
    end if;
    v_ticket_ids := array_append(v_ticket_ids, v_item_ticket_type_id);

    v_item_quantity_text := nullif(trim(coalesce(v_item ->> 'quantity', '')), '');
    if v_item_quantity_text is null
      or v_item_quantity_text !~ '^[0-9]+$' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_quantity',
          'message', 'Invalid quantity'
        )
      );
    end if;

    v_item_quantity := v_item_quantity_text::integer;
    if v_item_quantity <= 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_quantity',
          'message', 'Invalid quantity'
        )
      );
    end if;

    if not (v_item ? 'attendees')
      or jsonb_typeof(v_item -> 'attendees') <> 'array' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_items',
          'message', 'Invalid attendees'
        )
      );
    end if;
  end loop;

  for v_locked_ticket_id in
    select event_ticket_types.id
    from public.event_ticket_types
    where event_ticket_types.event_id = p_event_id
      and event_ticket_types.id = any(v_ticket_ids)
    order by event_ticket_types.id
    for update
  loop
    null;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(p_items) with ordinality as items(value, ordinality)
    order by ordinality
  loop
    v_item_ticket_type_id := (v_item ->> 'ticket_type_id')::uuid;
    v_item_quantity := (v_item ->> 'quantity')::integer;
    v_attendees := v_item -> 'attendees';

    select
      event_ticket_types.id,
      event_ticket_types.name,
      event_ticket_types.price_amount,
      event_ticket_types.currency,
      event_ticket_types.stock,
      event_ticket_types.active,
      event_ticket_types.sales_unit_type,
      event_ticket_types.entries_per_unit
    into v_ticket
    from public.event_ticket_types
    where event_ticket_types.event_id = p_event_id
      and event_ticket_types.id = v_item_ticket_type_id;

    if v_ticket.id is null then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'ticket_type_not_found',
          'message', 'Ticket type not found'
        )
      );
    end if;

    if v_ticket.active is not true
      or v_ticket.currency <> 'PYG'
      or v_ticket.sales_unit_type not in ('single_entry', 'package')
      or v_ticket.entries_per_unit < 1 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'ticket_type_not_found',
          'message', 'Ticket type not available'
        )
      );
    end if;

    v_expected_attendees_count := v_item_quantity * v_ticket.entries_per_unit;
    if jsonb_array_length(v_attendees) <> v_expected_attendees_count then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_attendees_count',
          'message', 'Invalid attendees count'
        )
      );
    end if;

    if v_ticket.price_amount % v_ticket.entries_per_unit <> 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'non_divisible_package_price',
          'message', 'Package price is not divisible by entries per unit'
        )
      );
    end if;

    for v_attendee in
      select value
      from jsonb_array_elements(v_attendees) with ordinality as attendees(value, ordinality)
      order by ordinality
    loop
      if jsonb_typeof(v_attendee.value) <> 'object'
        or nullif(trim(coalesce(v_attendee.value ->> 'name', '')), '') is null
        or nullif(trim(coalesce(v_attendee.value ->> 'last_name', '')), '') is null
        or nullif(trim(coalesce(v_attendee.value ->> 'email', '')), '') is null
        or nullif(trim(coalesce(v_attendee.value ->> 'phone', '')), '') is null
        or nullif(trim(coalesce(v_attendee.value ->> 'document', '')), '') is null
        or lower(trim(coalesce(v_attendee.value ->> 'email', ''))) !~* v_email_pattern then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_attendee',
            'message', 'Invalid attendee'
          )
        );
      end if;
    end loop;

    select coalesce(sum(event_order_items.quantity), 0)::integer
    into v_issued_commercial_units
    from public.event_order_items
    where event_order_items.event_id = p_event_id
      and event_order_items.event_ticket_type_id = v_item_ticket_type_id;

    if v_issued_commercial_units + v_item_quantity > v_ticket.stock then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'insufficient_stock',
          'message', 'Insufficient stock'
        )
      );
    end if;

    v_order_total_amount := v_order_total_amount + (v_item_quantity * v_ticket.price_amount);
  end loop;

  insert into public.event_orders (
    event_id,
    source,
    payment_method,
    payment_status,
    total_amount,
    currency,
    created_by_auth_user_id,
    buyer_name,
    buyer_last_name,
    buyer_email,
    buyer_phone,
    buyer_document,
    notes
  )
  values (
    p_event_id,
    'manual_issue',
    'manual_transfer',
    'confirmed_externally',
    v_order_total_amount,
    'PYG',
    p_actor_auth_user_id,
    v_buyer_name,
    v_buyer_last_name,
    v_buyer_email,
    v_buyer_phone,
    v_buyer_document,
    p_notes
  )
  returning id into v_order_id;

  for v_item in
    select value
    from jsonb_array_elements(p_items) with ordinality as items(value, ordinality)
    order by ordinality
  loop
    v_item_ticket_type_id := (v_item ->> 'ticket_type_id')::uuid;
    v_item_quantity := (v_item ->> 'quantity')::integer;
    v_attendees := v_item -> 'attendees';

    select
      event_ticket_types.id,
      event_ticket_types.name,
      event_ticket_types.price_amount,
      event_ticket_types.currency,
      event_ticket_types.sales_unit_type,
      event_ticket_types.entries_per_unit
    into v_ticket
    from public.event_ticket_types
    where event_ticket_types.event_id = p_event_id
      and event_ticket_types.id = v_item_ticket_type_id;

    v_entry_unit_price_amount := v_ticket.price_amount / v_ticket.entries_per_unit;

    insert into public.event_order_items (
      event_id,
      event_order_id,
      event_ticket_type_id,
      ticket_name,
      sales_unit_type,
      quantity,
      unit_price_amount,
      currency,
      entries_per_unit,
      total_amount
    )
    values (
      p_event_id,
      v_order_id,
      v_item_ticket_type_id,
      v_ticket.name,
      v_ticket.sales_unit_type,
      v_item_quantity,
      v_ticket.price_amount,
      'PYG',
      v_ticket.entries_per_unit,
      v_item_quantity * v_ticket.price_amount
    )
    returning id into v_order_item_id;

    v_items_response := v_items_response || jsonb_build_array(
      jsonb_build_object(
        'id', v_order_item_id,
        'ticket_type_id', v_item_ticket_type_id,
        'ticket_name', v_ticket.name,
        'sales_unit_type', v_ticket.sales_unit_type,
        'quantity', v_item_quantity,
        'entries_per_unit', v_ticket.entries_per_unit,
        'unit_price_amount', v_ticket.price_amount,
        'total_amount', v_item_quantity * v_ticket.price_amount,
        'currency', 'PYG'
      )
    );

    for v_attendee in
      select value
      from jsonb_array_elements(v_attendees) with ordinality as attendees(value, ordinality)
      order by ordinality
    loop
      insert into public.event_order_entries (
        event_id,
        event_order_id,
        event_order_item_id,
        event_ticket_type_id,
        unit_price_amount,
        currency,
        attendee_name,
        attendee_last_name,
        attendee_email,
        attendee_phone,
        attendee_document,
        status,
        checkin_status,
        email_sent_at,
        used_at,
        used_by_auth_user_id
      )
      values (
        p_event_id,
        v_order_id,
        v_order_item_id,
        v_item_ticket_type_id,
        v_entry_unit_price_amount,
        'PYG',
        trim(v_attendee.value ->> 'name'),
        trim(v_attendee.value ->> 'last_name'),
        lower(trim(v_attendee.value ->> 'email')),
        trim(v_attendee.value ->> 'phone'),
        trim(v_attendee.value ->> 'document'),
        'issued',
        'unused',
        null,
        null,
        null
      )
      returning id into v_entry_id;

      v_entries_response := v_entries_response || jsonb_build_array(
        jsonb_build_object(
          'id', v_entry_id,
          'event_order_item_id', v_order_item_id,
          'ticket_type_id', v_item_ticket_type_id,
          'ticket_name', v_ticket.name,
          'attendee', jsonb_build_object(
            'name', trim(v_attendee.value ->> 'name'),
            'last_name', trim(v_attendee.value ->> 'last_name'),
            'document', trim(v_attendee.value ->> 'document')
          ),
          'status', 'issued',
          'checkin_status', 'unused',
          'unit_price_amount', v_entry_unit_price_amount,
          'currency', 'PYG',
          'qr_status', 'pending_qr_resource'
        )
      );
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'order', jsonb_build_object(
        'id', v_order_id,
        'total_amount', v_order_total_amount,
        'currency', 'PYG',
        'source', 'manual_issue',
        'payment_method', 'manual_transfer',
        'payment_status', 'confirmed_externally'
      ),
      'items', v_items_response,
      'entries', v_entries_response
    )
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'manual_issue_failed',
        'message', 'Manual issue failed'
      )
    );
end;
$$;

revoke execute on function public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text) from public;
revoke execute on function public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text) from anon;
revoke execute on function public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text) from authenticated;
grant execute on function public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text) to service_role;

commit;
