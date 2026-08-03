create or replace function public.issue_access_entries_for_paid_order(
  p_order_id uuid,
  p_payment_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.reconcile_access_order_fulfillment(
    p_order_id,
    p_payment_attempt_id,
    null,
    null
  );
end;
$$;