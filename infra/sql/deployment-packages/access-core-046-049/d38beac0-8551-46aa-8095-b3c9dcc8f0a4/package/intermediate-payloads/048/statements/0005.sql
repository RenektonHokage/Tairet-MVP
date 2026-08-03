do $migration_048_assertions$
declare
  v_column_count integer;
  v_constraint_count integer;
  v_function_oid oid;
  v_function_source text;
  v_function_normalized text;
  v_function_definition text;
  v_function_definition_normalized text;
  v_function_fragment text;
  v_allowlist constant text :=
    'if p_error_code not in ( ''order_invalid'', ''order_items_invalid'', '
    || '''entries_not_found'', ''entries_invalid'', ''entry_count_mismatch'', '
    || '''entry_not_deliverable'', ''source_invalid'', ''invalid_recipient'' ) then';
  v_batch_oid oid;
  v_batch_source text;
  v_batch_without_guard text;
  v_batch_normalized text;
  v_batch_guard constant text :=
    'and fulfillment.email_preclaim_terminal_request_hash is null';
  v_batch_default_expression text;
  v_role text;
  v_table text;
  v_privilege text;
  v_expected boolean;
  v_actual boolean;
  v_preflight_public_function_count integer;
  v_post_public_function_count integer;
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
      'Migration 048 assertion failed: pre-claim marker column is missing or invalid';
  end if;

  select count(*)
  into v_constraint_count
  from pg_constraint
  where conrelid = 'public.access_order_fulfillments'::regclass
    and conname =
      'access_order_fulfillments_email_preclaim_terminal_marker_chk'
    and contype = 'c';

  if v_constraint_count <> 1 then
    raise exception
      'Migration 048 assertion failed: pre-claim marker constraint is missing';
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
        and pg_proc.pronargs = 5
        and pg_proc.pronargdefaults = 0
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, uuid, bigint, integer, text'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 048 assertion failed: RPC signature or security drifted';
  end if;

  select
    pg_proc.prosrc,
    pg_get_functiondef(pg_proc.oid)
  into
    v_function_source,
    v_function_definition
  from pg_proc
  where pg_proc.oid = v_function_oid;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );
  v_function_definition_normalized := btrim(
    regexp_replace(v_function_definition, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'd725a12249ebad5606994e8a6cb8dc1670dd1211f882b689f7db523b8befabc4'
  then
    raise exception
      'Migration 048 assertion failed: RPC body drifted';
  end if;

  if position(v_allowlist in v_function_normalized) = 0
    or (
      length(v_function_normalized)
        - length(replace(v_function_normalized, 'if p_error_code not in (', ''))
    ) / length('if p_error_code not in (') <> 1 then
    raise exception
      'Migration 048 assertion failed: error-code allowlist drifted';
  end if;

  foreach v_function_fragment in array array[
    'access-email-preclaim-terminal-v1',
    'pg_catalog.jsonb_build_array(',
    'pg_catalog.convert_to(',
    '''UTF8''',
    'pg_catalog.sha256(',
    '''hex''',
    'v_processing_count = 0',
    'v_accepted_count = 0',
    'v_ambiguous_count in (0, 1)',
    'if v_processing_count > 0 then',
    'v_ambiguous_count > 1',
    'v_ambiguous_count = 1',
    'v_fulfillment.email_status <> ''failed'''
  ]
  loop
    if position(v_function_fragment in v_function_normalized) = 0 then
      raise exception
        'Migration 048 assertion failed: RPC semantic fragment is missing';
    end if;
  end loop;

  if v_function_definition_normalized ~
      '(insert into|update|delete from) public\.access_email_delivery_attempts'
    or position('v_has_processing' in v_function_normalized) > 0
    or position('v_has_ambiguous' in v_function_normalized) > 0
    or position('v_has_accepted' in v_function_normalized) > 0 then
    raise exception
      'Migration 048 assertion failed: attempt DML or legacy boolean state remains';
  end if;

  v_batch_oid := to_regprocedure(
    'public.claim_access_fulfillment_batch(uuid,integer,integer)'
  );

  if v_batch_oid is null
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_batch_oid
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
      'Migration 048 assertion failed: batch RPC signature or security drifted';
  end if;

  select
    pg_get_expr(pg_proc.proargdefaults, 0),
    pg_proc.prosrc
  into
    v_batch_default_expression,
    v_batch_source
  from pg_proc
  where pg_proc.oid = v_batch_oid;

  if regexp_replace(v_batch_default_expression, '[[:space:]]+', '', 'g')
      <> '25,300' then
    raise exception
      'Migration 048 assertion failed: batch RPC defaults drifted';
  end if;

  if (
    length(v_batch_source)
      - length(replace(v_batch_source, v_batch_guard, ''))
  ) / length(v_batch_guard) <> 1 then
    raise exception
      'Migration 048 assertion failed: batch marker guard count is invalid';
  end if;

  v_batch_without_guard := replace(v_batch_source, v_batch_guard, '');
  v_batch_normalized := btrim(
    regexp_replace(v_batch_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_batch_normalized, 'UTF8')
    ),
    'hex'
  ) <> '05886c258a2636348ff76341371a02ef84b950f0ef678a1e938085913a5faab0'
  then
    raise exception
      'Migration 048 assertion failed: batch RPC body changed';
  end if;

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
      'Migration 048 assertion failed: batch RPC changed';
  end if;

  v_preflight_public_function_count := nullif(
    current_setting('app.migration_048_public_function_count', true),
    ''
  )::integer;

  select count(*)::integer
  into v_post_public_function_count
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public';

  if v_preflight_public_function_count is null
    or v_post_public_function_count <> v_preflight_public_function_count then
    raise exception
      'Migration 048 assertion failed: public function count changed';
  end if;

  foreach v_role in array array[
    'service_role',
    'anon',
    'authenticated',
    'public'
  ]
  loop
    v_expected := v_role = 'service_role';
    v_actual := has_function_privilege(
      v_role,
      'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)',
      'EXECUTE'
    );

    if v_actual is distinct from v_expected then
      raise exception
        'Migration 048 assertion failed: function EXECUTE privilege is invalid';
    end if;
  end loop;

  foreach v_table in array array[
    'public.access_order_fulfillments',
    'public.access_email_delivery_attempts'
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
      v_actual := has_table_privilege(v_role, v_table, 'SELECT');

      if v_actual is distinct from v_expected then
        raise exception
          'Migration 048 assertion failed: table SELECT privilege is invalid';
      end if;

      foreach v_privilege in array array[
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      ]
      loop
        if has_table_privilege(v_role, v_table, v_privilege) then
          raise exception
            'Migration 048 assertion failed: table write privilege expanded';
        end if;
      end loop;
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
    raise exception 'Migration 048 assertion failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.access_order_fulfillments'::regclass,
      'public.access_email_delivery_attempts'::regclass
    )
  ) then
    raise exception 'Migration 048 assertion failed: unexpected client policy';
  end if;
end;
$migration_048_assertions$;