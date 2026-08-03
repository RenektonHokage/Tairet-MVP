create or replace function public.guard_access_order_items_frozen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_status text;
  v_order_ids uuid[];
begin
  if session_user = 'postgres'
    and current_setting('app.access_core_allow_paid_item_cleanup', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
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
    select access_orders.status
    into v_order_status
    from public.access_orders
    where access_orders.id = v_order_id
    for update;

    if found and (
      v_order_status = 'paid'
      or exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = v_order_id
          and payment_attempts.status = 'approved'
      )
    ) then
      raise exception using
        errcode = '55000',
        message = 'Access order items are frozen after payment approval';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;