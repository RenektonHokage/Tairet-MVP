do $$
declare
  v_table text;
  v_function text;
  v_role text;
  v_privilege text;
  v_expected boolean;
  v_actual boolean;
  v_function_oid oid;
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_order_fulfillments'
      and (
        (
          column_name = 'issuance_review_status'
          and data_type = 'text'
          and is_nullable = 'NO'
          and column_default = '''none''::text'
        )
        or (
          column_name = 'issuance_review_error_code'
          and data_type = 'text'
          and is_nullable = 'YES'
        )
        or (
          column_name = 'issuance_review_error_at'
          and data_type = 'timestamp with time zone'
          and is_nullable = 'YES'
        )
      )
  ) <> 3 then
    raise exception
      'Migration 046 assertion failed: issuance review columns are missing or invalid';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.access_order_fulfillments'::regclass
      and conname in (
        'access_order_fulfillments_issuance_review_status_chk',
        'access_order_fulfillments_issuance_review_error_chk',
        'access_order_fulfillments_issuance_review_relation_chk'
      )
  ) <> 3 then
    raise exception
      'Migration 046 assertion failed: issuance review constraints are missing';
  end if;

  foreach v_table in array array[
    'public.access_order_fulfillments',
    'public.access_email_delivery_attempts',
    'public.access_order_items'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      ]
      loop
        v_expected := v_role = 'service_role' and v_privilege = 'SELECT';
        v_actual := has_table_privilege(v_role, v_table, v_privilege);
        if v_actual is distinct from v_expected then
          raise exception
            'Migration 046 assertion failed: % privilege % on % is %, expected %',
            v_role, v_privilege, v_table, v_actual, v_expected;
        end if;
      end loop;

      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'REFERENCES'
      ]
      loop
        v_expected := v_role = 'service_role' and v_privilege = 'SELECT';
        v_actual := has_any_column_privilege(v_role, v_table, v_privilege);
        if v_actual is distinct from v_expected then
          raise exception
            'Migration 046 assertion failed: % column privilege % on % is %, expected %',
            v_role, v_privilege, v_table, v_actual, v_expected;
        end if;
      end loop;

      if current_setting('server_version_num')::integer >= 170000 then
        v_actual := has_table_privilege(v_role, v_table, 'MAINTAIN');
        if v_actual then
          raise exception
            'Migration 046 assertion failed: % has MAINTAIN on %',
            v_role, v_table;
        end if;
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'access_order_fulfillments',
        'access_email_delivery_attempts',
        'access_order_items'
      )
      and not pg_class.relrowsecurity
  ) then
    raise exception 'Migration 046 assertion failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.access_order_fulfillments'::regclass,
      'public.access_email_delivery_attempts'::regclass
    )
  ) then
    raise exception 'Migration 046 assertion failed: unexpected client policy';
  end if;

  foreach v_function in array array[
    'public.reconcile_access_order_fulfillment(uuid,uuid,uuid,bigint)',
    'public.issue_access_entries_for_paid_order(uuid,uuid)',
    'public.claim_access_fulfillment_batch(uuid,integer,integer)',
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)',
    'public.record_access_email_delivery_outcome(uuid,uuid,uuid,bigint,text,text,text,integer)',
    'public.release_access_fulfillment_lease(uuid,uuid,bigint,integer,text)'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      v_expected := v_role = 'service_role';
      v_actual := has_function_privilege(v_role, v_function, 'EXECUTE');
      if v_actual is distinct from v_expected then
        raise exception
          'Migration 046 assertion failed: % EXECUTE on % is %, expected %',
          v_role, v_function, v_actual, v_expected;
      end if;
    end loop;

    v_function_oid := to_regprocedure(v_function);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc
        where pg_proc.oid = v_function_oid
          and pg_proc.prosecdef
          and pg_proc.proowner = 'postgres'::regrole
          and exists (
            select 1
            from unnest(coalesce(pg_proc.proconfig, array[]::text[]))
              as config(setting)
            where config.setting = 'search_path=public, pg_temp'
          )
      ) then
      raise exception
        'Migration 046 assertion failed: unsafe or missing RPC %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'public.access_core_entry_snapshot(uuid)',
    'public.guard_access_order_items_frozen()',
    'public.guard_access_entries_fulfilled()',
    'public.guard_access_email_delivery_attempts()'
  ]
  loop
    foreach v_role in array array[
      'service_role',
      'anon',
      'authenticated',
      'public'
    ]
    loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception
          'Migration 046 assertion failed: internal function is executable by %: %',
          v_role, v_function;
      end if;
    end loop;

    v_function_oid := to_regprocedure(v_function);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc
        where pg_proc.oid = v_function_oid
          and pg_proc.prosecdef
          and pg_proc.proowner = 'postgres'::regrole
          and exists (
            select 1
            from unnest(coalesce(pg_proc.proconfig, array[]::text[]))
              as config(setting)
            where config.setting = 'search_path=public, pg_temp'
          )
      ) then
      raise exception
        'Migration 046 assertion failed: unsafe or missing internal function %',
        v_function;
    end if;
  end loop;
end;
$$;