do $$
begin
  if exists (
    select 1
    from public.access_orders
    join public.access_order_items
      on access_order_items.order_id = access_orders.id
    where access_orders.status = 'paid'
      and exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = access_orders.id
          and payment_attempts.status = 'approved'
      )
    group by access_orders.id
    having sum(
      access_order_items.quantity::bigint
      * access_order_items.entries_per_unit::bigint
    ) > 2147483647
  ) then
    raise exception 'Migration 046 assertion failed: expected entry count overflow';
  end if;
end;
$$;