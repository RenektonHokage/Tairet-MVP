create unique index access_email_delivery_attempts_provider_message_uidx
  on public.access_email_delivery_attempts(provider, provider_message_id)
  where provider_message_id is not null;