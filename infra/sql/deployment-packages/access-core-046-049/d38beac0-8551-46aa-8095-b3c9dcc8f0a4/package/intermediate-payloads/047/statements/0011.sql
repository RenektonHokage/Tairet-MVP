do $$
declare
  v_column_count integer;
  v_constraint_definition text;
  v_constraint_fragment text;
  v_function text;
  v_function_oid oid;
  v_role text;
  v_expected boolean;
  v_actual boolean;
  v_batch_source text;
  v_batch_without_guard text;
  v_batch_normalized text;
  v_batch_guard constant text :=
    'and fulfillment.email_preclaim_terminal_request_hash is null';
  v_batch_default_expression text;
begin
  select count(*)
  into v_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'access_order_fulfillments'
    and column_name = 'email_preclaim_terminal_request_hash'
    and data_type = 'text'
    and is_nullable = 'YES'
    and column_default is null;

  if v_column_count <> 1 then
    raise exception
      'Migration 047 assertion failed: pre-claim marker column is missing or invalid';
  end if;

  if coalesce(
    col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ),
    ''
  ) not like '%SHA-256%'
    or col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ) not like '%plaintext lease token%'
    or col_description(
      'public.access_order_fulfillments'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.access_order_fulfillments'::regclass
          and attname = 'email_preclaim_terminal_request_hash'
          and not attisdropped
      )
    ) not like '%does not represent a provider delivery attempt%' then
    raise exception
      'Migration 047 assertion failed: pre-claim marker comment is invalid';
  end if;

  select lower(
    regexp_replace(
      pg_get_constraintdef(pg_constraint.oid),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
  into v_constraint_definition
  from pg_constraint
  where conrelid = 'public.access_order_fulfillments'::regclass
    and conname =
      'access_order_fulfillments_email_preclaim_terminal_marker_chk'
    and contype = 'c';

  if v_constraint_definition is null then
    raise exception
      'Migration 047 assertion failed: pre-claim marker constraint is missing';
  end if;

  foreach v_constraint_fragment in array array[
    'email_preclaim_terminal_request_hash is null',
    'email_preclaim_terminal_request_hash ~ ''^[0-9a-f]{64}$''',
    'issuance_status = ''complete''',
    'issuance_review_status = ''none''',
    'email_status = ''manual_review''',
    'email_next_attempt_at is null',
    'email_sent_at is null',
    'email_last_error_at is not null',
    'email_provider_message_id is null',
    'reconcile_lease_token is null',
    'reconcile_lease_expires_at is null',
    'reconcile_lease_epoch > 0',
    'email_generation > 0',
    'email_last_error_code = ''order_invalid''',
    'email_last_error_code = ''order_items_invalid''',
    'email_last_error_code = ''entries_not_found''',
    'email_last_error_code = ''entries_invalid''',
    'email_last_error_code = ''entry_count_mismatch''',
    'email_last_error_code = ''entry_not_deliverable''',
    'email_last_error_code = ''source_invalid''',
    'email_last_error_code = ''invalid_recipient'''
  ]
  loop
    if position(v_constraint_fragment in v_constraint_definition) = 0 then
      raise exception
        'Migration 047 assertion failed: pre-claim marker constraint projection is invalid';
    end if;
  end loop;

  if (
    length(v_constraint_definition)
      - length(replace(v_constraint_definition, 'email_last_error_code =', ''))
  ) / length('email_last_error_code =') <> 8 then
    raise exception
      'Migration 047 assertion failed: pre-claim marker allowlist is not closed';
  end if;

  v_function_oid := to_regprocedure(
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
  );

  if v_function_oid is null
    or (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname =
          'record_access_email_preclaim_terminal_failure'
    ) <> 1
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_function_oid
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 047 assertion failed: pre-claim RPC definition is invalid';
  end if;

  v_function_oid := to_regprocedure(
    'public.claim_access_fulfillment_batch(uuid,integer,integer)'
  );

  if v_function_oid is null
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_function_oid
        and pg_proc.pronargs = 3
        and pg_proc.pronargdefaults = 2
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, integer, integer'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 047 assertion failed: batch RPC signature or security drifted';
  end if;

  select
    pg_get_expr(pg_proc.proargdefaults, 0),
    pg_proc.prosrc
  into
    v_batch_default_expression,
    v_batch_source
  from pg_proc
  where pg_proc.oid = v_function_oid;

  if regexp_replace(v_batch_default_expression, '[[:space:]]+', '', 'g')
      <> '25,300' then
    raise exception
      'Migration 047 assertion failed: batch RPC defaults drifted';
  end if;

  if (
    length(v_batch_source)
      - length(replace(v_batch_source, v_batch_guard, ''))
  ) / length(v_batch_guard) <> 1 then
    raise exception
      'Migration 047 assertion failed: batch marker guard count is invalid';
  end if;

  v_batch_without_guard := replace(v_batch_source, v_batch_guard, '');
  v_batch_normalized := btrim(
    regexp_replace(v_batch_without_guard, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_batch_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'a9ef6b53db5890524de598fd3d4ea65eb1aa4bf6b9f3925b03887dfb55f37c20'
  then
    raise exception
      'Migration 047 assertion failed: batch function drifted beyond the marker guard';
  end if;

  foreach v_function in array array[
    'public.claim_access_fulfillment_batch(uuid,integer,integer)',
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
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
          'Migration 047 assertion failed: function EXECUTE privilege is invalid';
      end if;
    end loop;
  end loop;

  foreach v_role in array array[
    'service_role',
    'anon',
    'authenticated',
    'public'
  ]
  loop
    v_expected := v_role = 'service_role';

    v_actual := has_table_privilege(
      v_role,
      'public.access_order_fulfillments',
      'SELECT'
    );
    if v_actual is distinct from v_expected then
      raise exception
        'Migration 047 assertion failed: fulfillment SELECT privilege is invalid';
    end if;

    foreach v_function in array array[
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ]
    loop
      if has_table_privilege(
        v_role,
        'public.access_order_fulfillments',
        v_function
      ) then
        raise exception
          'Migration 047 assertion failed: fulfillment write privilege expanded';
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
        'access_email_delivery_attempts'
      )
      and not pg_class.relrowsecurity
  ) then
    raise exception 'Migration 047 assertion failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.access_order_fulfillments'::regclass,
      'public.access_email_delivery_attempts'::regclass
    )
  ) then
    raise exception 'Migration 047 assertion failed: unexpected client policy';
  end if;
end;
$$;