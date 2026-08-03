revoke all on function public.release_access_fulfillment_lease(
  uuid, uuid, bigint, integer, text
)
  from public, anon, authenticated, service_role;