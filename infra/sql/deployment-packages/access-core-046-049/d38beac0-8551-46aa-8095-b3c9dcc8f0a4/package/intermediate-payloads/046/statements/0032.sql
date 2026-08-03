create or replace function public.guard_access_entries_fulfilled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_ids uuid[];
  v_issuance_status text;
begin
  if session_user = 'postgres'
    and current_setting(
      'app.access_core_allow_fulfillment_cleanup',
      true
    ) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Operational status, check-in, void, and legacy email projection remain
  -- writable after issuance completes.
  if tg_op = 'UPDATE'
    and new.id is not distinct from old.id
    and new.order_id is not distinct from old.order_id
    and new.order_item_id is not distinct from old.order_item_id
    and new.access_ticket_type_id is not distinct from old.access_ticket_type_id
    and new.unit_index is not distinct from old.unit_index
    and new.checkin_token is not distinct from old.checkin_token
    and new.attendee_name is not distinct from old.attendee_name
    and new.attendee_last_name is not distinct from old.attendee_last_name
    and new.attendee_email is not distinct from old.attendee_email
    and new.attendee_phone is not distinct from old.attendee_phone
    and new.attendee_document is not distinct from old.attendee_document
    and new.access_date is not distinct from old.access_date
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_order_ids := array[new.order_id];
  elsif tg_op = 'DELETE' then
    v_order_ids := array[old.order_id];
  elsif old.order_id = new.order_id then
    v_order_ids := array[old.order_id];
  else
    select array_agg(order_id order by order_id)
    into v_order_ids
    from (
      select old.order_id as order_id
      union
      select new.order_id as order_id
    ) as affected_orders;
  end if;

  foreach v_order_id in array v_order_ids
  loop
    -- The parent lock closes the INSERT race against the final issuance update.
    perform 1
    from public.access_orders
    where access_orders.id = v_order_id
    for update;

    select access_order_fulfillments.issuance_status
    into v_issuance_status
    from public.access_order_fulfillments
    where access_order_fulfillments.order_id = v_order_id
    for update;

    if found and v_issuance_status = 'complete' then
      raise exception using
        errcode = '55000',
        message = 'Fulfilled access entry identity is immutable';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;