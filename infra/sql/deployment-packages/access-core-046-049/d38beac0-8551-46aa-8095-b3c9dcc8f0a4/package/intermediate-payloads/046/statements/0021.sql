do $$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.access_order_items from service_role';
  end if;
end;
$$;