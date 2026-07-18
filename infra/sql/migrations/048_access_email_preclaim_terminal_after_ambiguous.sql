begin;

-- Fail closed unless the database is exactly on the immutable migration 047
-- function and batch baselines expected by this additive replacement.
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

create or replace function public.record_access_email_preclaim_terminal_failure(
  p_order_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_email_generation integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_request_hash text;
  v_now timestamptz;
  v_processing_count integer := 0;
  v_ambiguous_count integer := 0;
  v_accepted_count integer := 0;
begin
  if p_order_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or p_email_generation is null
    or p_email_generation < 1
    or p_error_code is null
    or char_length(p_error_code) = 0
    or p_error_code ~ '[[:space:]]' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Invalid request'
      )
    );
  end if;

  if p_error_code not in (
    'order_invalid',
    'order_items_invalid',
    'entries_not_found',
    'entries_invalid',
    'entry_count_mismatch',
    'entry_not_deliverable',
    'source_invalid',
    'invalid_recipient'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_error_code',
        'message', 'Invalid error code'
      )
    );
  end if;

  v_request_hash := pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_array(
          'access-email-preclaim-terminal-v1',
          p_order_id,
          p_reconcile_lease_token,
          p_reconcile_lease_epoch,
          p_email_generation,
          p_error_code
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'order_not_found',
        'message', 'Order not found'
      )
    );
  end if;

  select *
  into v_fulfillment
  from public.access_order_fulfillments
  where access_order_fulfillments.order_id = v_order.id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_not_found',
        'message', 'Fulfillment not found'
      )
    );
  end if;

  -- Lock every current-generation attempt in deterministic order before
  -- reading attempt state or the wall clock.
  perform 1
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
  order by
    access_email_delivery_attempts.created_at,
    access_email_delivery_attempts.id
  for update;

  select
    count(*) filter (where status = 'processing')::integer,
    count(*) filter (where status = 'ambiguous')::integer,
    count(*) filter (where status = 'accepted')::integer
  into
    v_processing_count,
    v_ambiguous_count,
    v_accepted_count
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation;

  v_now := clock_timestamp();

  if v_fulfillment.email_generation is distinct from p_email_generation then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'generation_mismatch',
        'message', 'Email generation mismatch'
      )
    );
  end if;

  -- Lost-response replay is intentionally evaluated before the active-lease
  -- fence. The canonical request hash proves the cleared lease token, while
  -- the locked attempt snapshot preserves any prior ambiguous evidence.
  if v_order.status = 'paid'
    and v_fulfillment.reconcile_lease_epoch = p_reconcile_lease_epoch
    and v_fulfillment.email_status = 'manual_review'
    and v_fulfillment.email_preclaim_terminal_request_hash is not null
    and v_fulfillment.email_preclaim_terminal_request_hash = v_request_hash
    and v_fulfillment.email_last_error_code = p_error_code
    and v_fulfillment.email_last_error_at is not null
    and v_fulfillment.email_next_attempt_at is null
    and v_fulfillment.email_sent_at is null
    and v_fulfillment.email_provider_message_id is null
    and v_fulfillment.reconcile_lease_token is null
    and v_fulfillment.reconcile_lease_expires_at is null
    and v_fulfillment.issuance_status = 'complete'
    and v_fulfillment.issuance_review_status = 'none'
    and v_fulfillment.updated_at = v_fulfillment.email_last_error_at
    and v_processing_count = 0
    and v_accepted_count = 0
    and v_ambiguous_count in (0, 1) then
    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'terminal', true,
      'order_id', v_order.id,
      'generation', v_fulfillment.email_generation,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'error_code', v_fulfillment.email_last_error_code,
      'idempotent', true
    );
  end if;

  if v_processing_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'provider_outcome_required',
        'message', 'Provider outcome is required'
      )
    );
  end if;

  if v_fulfillment.email_preclaim_terminal_request_hash is not null then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_accepted_count > 0 then
    if v_fulfillment.email_status = 'sent' then
      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'error', jsonb_build_object(
          'code', 'email_already_sent',
          'message', 'Email already sent'
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_fulfillment.email_status = 'sent' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'email_already_sent',
        'message', 'Email already sent'
      )
    );
  end if;

  if v_fulfillment.email_status = 'manual_review'
    or v_order.status <> 'paid' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'stale_lease',
        'message', 'Stale lease'
      )
    );
  end if;

  if v_fulfillment.issuance_status <> 'complete'
    or v_fulfillment.issuance_review_status <> 'none'
    or v_fulfillment.email_status not in ('pending', 'failed') then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  if v_ambiguous_count > 1
    or (
      v_ambiguous_count = 1
      and v_fulfillment.email_status <> 'failed'
    ) then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  update public.access_order_fulfillments
  set
    email_status = 'manual_review',
    email_next_attempt_at = null,
    email_sent_at = null,
    email_last_error_code = p_error_code,
    email_last_error_at = v_now,
    email_provider_message_id = null,
    reconcile_lease_token = null,
    reconcile_lease_expires_at = null,
    email_preclaim_terminal_request_hash = v_request_hash,
    updated_at = v_now
  where order_id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'manual_review',
    'terminal', true,
    'order_id', v_order.id,
    'generation', p_email_generation,
    'epoch', p_reconcile_lease_epoch,
    'error_code', p_error_code,
    'idempotent', false
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'internal_error',
        'message', 'Internal error'
      )
    );
end;
$$;

alter function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  owner to postgres;
revoke all on function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  from public, anon, authenticated, service_role;
grant execute on function public.record_access_email_preclaim_terminal_failure(
  uuid, uuid, bigint, integer, text
)
  to service_role;

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

commit;
