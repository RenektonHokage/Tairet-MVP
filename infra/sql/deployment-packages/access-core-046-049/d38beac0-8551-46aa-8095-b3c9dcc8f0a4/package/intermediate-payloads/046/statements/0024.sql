do $$
declare
  v_checkout_oid oid := to_regprocedure(
    'public.create_access_paid_checkout(text,uuid,uuid,date,jsonb,jsonb,text,text,integer)'
  );
begin
  if v_checkout_oid is null
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_checkout_oid
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and pg_get_functiondef(pg_proc.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+public[.]access_order_items'
        and exists (
          select 1
          from unnest(coalesce(pg_proc.proconfig, array[]::text[])) as config(setting)
          where config.setting = 'search_path=public, pg_temp'
        )
    ) then
    raise exception
      'Migration 046 assertion failed: create_access_paid_checkout is not a safe postgres definer';
  end if;
end;
$$;