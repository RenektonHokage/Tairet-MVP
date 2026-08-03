create index idx_access_order_fulfillments_email_due
  on public.access_order_fulfillments(email_next_attempt_at, order_id)
  where issuance_status = 'complete'
    and email_status in ('pending', 'failed');