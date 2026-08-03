do $migration_048_preflight$
declare
  v_column_count integer;
  v_constraint_count integer;
  v_function_oid oid;
  v_function_source text;
  v_function_normalized text;
  v_batch_oid oid;
  v_batch_source text;
  v_batch_without_guard text;
  v_batch_normalized text;
  v_batch_guard constant text :=
    'and fulfillment.email_preclaim_terminal_request_hash is null';
  v_batch_default_expression text;
  v_public_function_count integer;
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
      'Migration 048 preflight failed: pre-claim marker column is missing or invalid';
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
      'Migration 048 preflight failed: pre-claim marker constraint is missing';
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
    ) <> 1 then
    raise exception
      'Migration 048 preflight failed: migration 047 RPC signature drifted';
  end if;

  select pg_proc.prosrc
  into v_function_source
  from pg_proc
  where pg_proc.oid = v_function_oid;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> '8de3d46cfa1108cc6f3b29c0cb4c1d08539edca2c6f564dc144fcbede921c7d5'
  then
    raise exception
      'Migration 048 preflight failed: migration 047 RPC body drifted';
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
      'Migration 048 preflight failed: batch RPC signature or security drifted';
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
      'Migration 048 preflight failed: batch RPC defaults drifted';
  end if;

  if (
    length(v_batch_source)
      - length(replace(v_batch_source, v_batch_guard, ''))
  ) / length(v_batch_guard) <> 1 then
    raise exception
      'Migration 048 preflight failed: batch marker guard count is invalid';
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
      'Migration 048 preflight failed: migration 047 batch RPC body drifted';
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
      'Migration 048 preflight failed: batch RPC drifted beyond the marker guard';
  end if;

  select count(*)::integer
  into v_public_function_count
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public';

  perform set_config(
    'app.migration_048_public_function_count',
    v_public_function_count::text,
    true
  );
end;
$migration_048_preflight$;