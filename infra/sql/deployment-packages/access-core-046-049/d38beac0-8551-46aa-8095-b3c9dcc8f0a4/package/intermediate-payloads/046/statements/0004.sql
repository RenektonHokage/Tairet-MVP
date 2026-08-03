create index idx_access_order_fulfillments_issuance_due
  on public.access_order_fulfillments(issuance_next_attempt_at, order_id)
  where issuance_status in ('pending', 'partial');