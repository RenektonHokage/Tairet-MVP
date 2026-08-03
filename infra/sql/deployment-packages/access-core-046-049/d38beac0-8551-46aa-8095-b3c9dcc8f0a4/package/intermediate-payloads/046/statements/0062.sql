revoke all on function public.record_access_email_delivery_outcome(
  uuid, uuid, uuid, bigint, text, text, text, integer
)
  from public, anon, authenticated, service_role;