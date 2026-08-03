revoke all on function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  from public, anon, authenticated, service_role;