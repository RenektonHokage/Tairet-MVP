do $$
begin
  if exists (
    select 1
    from public.access_order_fulfillments
    left join public.payment_attempts
      on payment_attempts.id = access_order_fulfillments.approved_payment_attempt_id
      and payment_attempts.order_id = access_order_fulfillments.order_id
      and payment_attempts.status = 'approved'
    where payment_attempts.id is null
  ) then
    raise exception 'Migration 046 assertion failed: invalid approved payment attempt';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where expected_entries < 0 or issued_entries < 0
  ) then
    raise exception 'Migration 046 assertion failed: negative fulfillment counts';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where not (
      (issuance_status = 'pending' and expected_entries > 0 and issued_entries = 0)
      or (
        issuance_status = 'partial'
        and expected_entries > 0
        and issued_entries > 0
        and issued_entries < expected_entries
      )
      or (
        issuance_status = 'complete'
        and expected_entries > 0
        and (
          (
            issuance_review_status = 'none'
            and issued_entries = expected_entries
          )
          or issuance_review_status = 'manual_review'
        )
      )
      or issuance_status = 'manual_review'
    )
  ) then
    raise exception 'Migration 046 assertion failed: incompatible fulfillment state';
  end if;

  if exists (
    select 1
    from public.access_order_fulfillments
    where not (
      (
        issuance_review_status = 'none'
        and issuance_review_error_code is null
        and issuance_review_error_at is null
      )
      or (
        issuance_review_status = 'manual_review'
        and issuance_status = 'complete'
        and issuance_review_error_code is not null
        and char_length(trim(issuance_review_error_code)) > 0
        and issuance_review_error_at is not null
      )
    )
  ) then
    raise exception 'Migration 046 assertion failed: incompatible issuance review state';
  end if;

  if exists (
    select 1
    from public.access_orders
    where access_orders.status = 'paid'
      and exists (
        select 1
        from public.payment_attempts
        where payment_attempts.order_id = access_orders.id
          and payment_attempts.status = 'approved'
      )
      and not exists (
        select 1
        from public.access_order_fulfillments
        where access_order_fulfillments.order_id = access_orders.id
      )
  ) then
    raise exception 'Migration 046 assertion failed: eligible paid order missing fulfillment';
  end if;
end;
$$;