create unique index access_email_delivery_attempts_live_generation_uidx
  on public.access_email_delivery_attempts(order_id, generation)
  where status in ('processing', 'ambiguous', 'accepted');