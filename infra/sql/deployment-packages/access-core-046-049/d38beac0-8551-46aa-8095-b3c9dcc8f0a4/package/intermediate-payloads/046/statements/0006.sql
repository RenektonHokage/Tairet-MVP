create index idx_access_order_fulfillments_lease_expiry
  on public.access_order_fulfillments(reconcile_lease_expires_at, order_id)
  where reconcile_lease_token is not null;