begin;

-- Fail closed unless migrations 047 and 048 and the immutable delivery-claim
-- baseline are exactly compatible with this function-only replacement.
do $migration_049_preflight$
declare
  v_marker_column_count integer;
  v_marker_constraint_definition text;
  v_marker_constraint_fragment text;
  v_terminal_oid oid;
  v_claim_oid oid;
  v_function_source text;
  v_function_normalized text;
  v_default_expression text;
  v_function_identity text;
  v_role text;
  v_expected boolean;
  v_actual boolean;
  v_catalog_counts text;
  v_catalog_fingerprint text;
begin
  select count(*)
  into v_marker_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'access_order_fulfillments'
    and column_name = 'email_preclaim_terminal_request_hash'
    and data_type = 'text'
    and is_nullable = 'YES'
    and column_default is null;

  if v_marker_column_count <> 1 then
    raise exception
      'Migration 049 preflight failed: pre-claim marker column is missing or invalid';
  end if;

  select btrim(
    lower(
      regexp_replace(
        pg_get_constraintdef(pg_constraint.oid),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  )
  into v_marker_constraint_definition
  from pg_constraint
  where conrelid = 'public.access_order_fulfillments'::regclass
    and conname =
      'access_order_fulfillments_email_preclaim_terminal_marker_chk'
    and contype = 'c'
    and convalidated;

  if v_marker_constraint_definition is null then
    raise exception
      'Migration 049 preflight failed: pre-claim marker constraint is missing';
  end if;

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_marker_constraint_definition, 'UTF8')
    ),
    'hex'
  ) <> '2c2f48520cbcf085f50f8280ee24c60b6532ece72eaf429cceb0f46481eecaa7'
  then
    raise exception
      'Migration 049 preflight failed: pre-claim marker constraint definition drifted';
  end if;

  foreach v_marker_constraint_fragment in array array[
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
    if position(
      v_marker_constraint_fragment in v_marker_constraint_definition
    ) = 0 then
      raise exception
        'Migration 049 preflight failed: pre-claim marker constraint drifted';
    end if;
  end loop;

  if (
    length(v_marker_constraint_definition)
      - length(replace(
          v_marker_constraint_definition,
          'email_last_error_code =',
          ''
        ))
  ) / length('email_last_error_code =') <> 8 then
    raise exception
      'Migration 049 preflight failed: pre-claim marker allowlist drifted';
  end if;

  v_terminal_oid := to_regprocedure(
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
  );

  if v_terminal_oid is null
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
      where pg_proc.oid = v_terminal_oid
        and pg_proc.pronargs = 5
        and pg_proc.pronargdefaults = 0
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, uuid, bigint, integer, text'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prolang = (
          select pg_language.oid
          from pg_language
          where pg_language.lanname = 'plpgsql'
        )
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 049 preflight failed: migration 048 RPC signature or security drifted';
  end if;

  select pg_proc.prosrc
  into v_function_source
  from pg_proc
  where pg_proc.oid = v_terminal_oid;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'd725a12249ebad5606994e8a6cb8dc1670dd1211f882b689f7db523b8befabc4'
  then
    raise exception
      'Migration 049 preflight failed: migration 048 RPC body drifted';
  end if;

  v_claim_oid := to_regprocedure(
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)'
  );

  if v_claim_oid is null
    or (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'claim_access_email_delivery'
    ) <> 1
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_claim_oid
        and pg_proc.pronargs = 7
        and pg_proc.pronargdefaults = 1
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, uuid, bigint, uuid[], text, text, text'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prolang = (
          select pg_language.oid
          from pg_language
          where pg_language.lanname = 'plpgsql'
        )
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 049 preflight failed: delivery claim signature or security drifted';
  end if;

  select
    pg_get_expr(pg_proc.proargdefaults, 0),
    pg_proc.prosrc
  into
    v_default_expression,
    v_function_source
  from pg_proc
  where pg_proc.oid = v_claim_oid;

  if regexp_replace(v_default_expression, '[[:space:]]+', '', 'g')
      <> '''resend''::text' then
    raise exception
      'Migration 049 preflight failed: delivery claim default drifted';
  end if;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> '0eed47f60a2fe2c85052e502936cfbffef5e0888f15a1c594636379daa26a78f'
  then
    raise exception
      'Migration 049 preflight failed: delivery claim body drifted';
  end if;

  foreach v_function_identity in array array[
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)',
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)'
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
      v_actual := has_function_privilege(
        v_role,
        v_function_identity,
        'EXECUTE'
      );

      if v_actual is distinct from v_expected then
        raise exception
          'Migration 049 preflight failed: function EXECUTE privilege drifted';
      end if;
    end loop;

    if exists (
      select 1
      from pg_proc
      cross join lateral aclexplode(
        coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))
      ) as function_acl
      where pg_proc.oid = to_regprocedure(v_function_identity)
        and (
          function_acl.privilege_type <> 'EXECUTE'
          or function_acl.grantor <> pg_proc.proowner
          or function_acl.grantee not in (
            pg_proc.proowner,
            'service_role'::regrole
          )
          or (
            function_acl.grantee = 'service_role'::regrole
            and function_acl.is_grantable
          )
        )
    )
      or not exists (
        select 1
        from pg_proc
        cross join lateral aclexplode(
          coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))
        ) as function_acl
        where pg_proc.oid = to_regprocedure(v_function_identity)
          and function_acl.grantee = 'service_role'::regrole
          and function_acl.privilege_type = 'EXECUTE'
          and not function_acl.is_grantable
      ) then
      raise exception
        'Migration 049 preflight failed: function ACL is not closed';
    end if;
  end loop;

  select format(
    'relations=%s|tables=%s|columns=%s|constraints=%s|indexes=%s|triggers=%s|policies=%s|functions=%s',
    (
      select count(*)
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind in ('r', 'p')
    ),
    (
      select count(*)
      from pg_attribute
      join pg_class on pg_class.oid = pg_attribute.attrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_attribute.attnum > 0
        and not pg_attribute.attisdropped
    ),
    (
      select count(*)
      from pg_constraint
      join pg_namespace on pg_namespace.oid = pg_constraint.connamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_index
      join pg_class as indexed_relation
        on indexed_relation.oid = pg_index.indrelid
      join pg_namespace
        on pg_namespace.oid = indexed_relation.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_trigger
      join pg_class on pg_class.oid = pg_trigger.tgrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_policy
      join pg_class on pg_class.oid = pg_policy.polrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
    )
  )
  into v_catalog_counts;

  with catalog_rows(row_data) as (
    select jsonb_build_array(
      'relation',
      pg_class.oid,
      pg_class.relname,
      pg_class.relkind,
      pg_class.relpersistence,
      pg_get_userbyid(pg_class.relowner),
      pg_class.relrowsecurity,
      pg_class.relforcerowsecurity,
      pg_class.relacl,
      case
        when pg_class.relkind in ('v', 'm')
          then pg_get_viewdef(pg_class.oid, true)
        else null
      end
    )::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'column',
      pg_attribute.attrelid,
      pg_attribute.attnum,
      pg_attribute.attname,
      format_type(pg_attribute.atttypid, pg_attribute.atttypmod),
      pg_attribute.attnotnull,
      pg_attribute.attidentity,
      pg_attribute.attgenerated,
      pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid),
      pg_attribute.attacl
    )::text
    from pg_attribute
    join pg_class on pg_class.oid = pg_attribute.attrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    left join pg_attrdef
      on pg_attrdef.adrelid = pg_attribute.attrelid
      and pg_attrdef.adnum = pg_attribute.attnum
    where pg_namespace.nspname = 'public'
      and pg_attribute.attnum > 0
      and not pg_attribute.attisdropped

    union all

    select jsonb_build_array(
      'constraint',
      pg_constraint.oid,
      pg_constraint.conname,
      pg_constraint.contype,
      pg_constraint.conrelid,
      pg_constraint.confrelid,
      pg_constraint.conindid,
      pg_constraint.condeferrable,
      pg_constraint.condeferred,
      pg_constraint.convalidated,
      pg_get_constraintdef(pg_constraint.oid, true)
    )::text
    from pg_constraint
    join pg_namespace on pg_namespace.oid = pg_constraint.connamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'index',
      pg_index.indexrelid,
      pg_index.indrelid,
      pg_index.indisunique,
      pg_index.indisprimary,
      pg_index.indisexclusion,
      pg_index.indimmediate,
      pg_index.indisvalid,
      pg_index.indisready,
      pg_get_indexdef(pg_index.indexrelid)
    )::text
    from pg_index
    join pg_class as indexed_relation
      on indexed_relation.oid = pg_index.indrelid
    join pg_namespace
      on pg_namespace.oid = indexed_relation.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'trigger',
      pg_trigger.oid,
      pg_trigger.tgrelid,
      pg_trigger.tgname,
      pg_trigger.tgfoid,
      pg_trigger.tgenabled,
      pg_trigger.tgisinternal,
      pg_get_triggerdef(pg_trigger.oid, true)
    )::text
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'policy',
      pg_policy.oid,
      pg_policy.polrelid,
      pg_policy.polname,
      pg_policy.polcmd,
      pg_policy.polpermissive,
      pg_policy.polroles,
      pg_get_expr(pg_policy.polqual, pg_policy.polrelid),
      pg_get_expr(pg_policy.polwithcheck, pg_policy.polrelid)
    )::text
    from pg_policy
    join pg_class on pg_class.oid = pg_policy.polrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'function',
      pg_proc.oid,
      pg_proc.proname,
      pg_proc.prokind,
      pg_get_function_identity_arguments(pg_proc.oid),
      pg_get_function_result(pg_proc.oid),
      pg_language.lanname,
      pg_get_userbyid(pg_proc.proowner),
      pg_proc.prosecdef,
      pg_proc.proleakproof,
      pg_proc.proisstrict,
      pg_proc.provolatile,
      pg_proc.proparallel,
      pg_proc.pronargdefaults,
      pg_get_expr(pg_proc.proargdefaults, 0),
      pg_proc.proconfig,
      pg_proc.proacl,
      pg_proc.prosrc
    )::text
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    join pg_language on pg_language.oid = pg_proc.prolang
    where pg_namespace.nspname = 'public'
      and pg_proc.oid <> v_claim_oid

    union all

    select jsonb_build_array(
      'schema_acl',
      pg_namespace.oid,
      pg_namespace.nspacl
    )::text
    from pg_namespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'relation_acl',
      pg_class.oid,
      pg_class.relacl
    )::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'column_acl',
      pg_attribute.attrelid,
      pg_attribute.attnum,
      pg_attribute.attacl
    )::text
    from pg_attribute
    join pg_class on pg_class.oid = pg_attribute.attrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_attribute.attnum > 0
      and not pg_attribute.attisdropped

    union all

    select jsonb_build_array(
      'function_acl',
      pg_proc.oid,
      pg_proc.proacl
    )::text
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.oid <> v_claim_oid
  )
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        coalesce(string_agg(row_data, E'\n' order by row_data), ''),
        'UTF8'
      )
    ),
    'hex'
  )
  into v_catalog_fingerprint
  from catalog_rows;

  perform set_config(
    'app.migration_049_claim_oid',
    v_claim_oid::text,
    true
  );
  perform set_config(
    'app.migration_049_catalog_counts',
    v_catalog_counts,
    true
  );
  perform set_config(
    'app.migration_049_catalog_fingerprint',
    v_catalog_fingerprint,
    true
  );
end;
$migration_049_preflight$;

create or replace function public.claim_access_email_delivery(
  p_order_id uuid,
  p_reconcile_lease_token uuid,
  p_reconcile_lease_epoch bigint,
  p_entry_ids uuid[],
  p_request_payload_hash text,
  p_template_version text,
  p_provider text default 'resend'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.access_orders%rowtype;
  v_fulfillment public.access_order_fulfillments%rowtype;
  v_attempt public.access_email_delivery_attempts%rowtype;
  v_attempt_found boolean := false;
  v_now timestamptz;
  v_provider_call_at timestamptz;
  v_attempt_id uuid;
  v_idempotency_key text;
  v_provider text;
  v_approved_count integer := 0;
  v_approved_attempt public.payment_attempts%rowtype;
  v_entry_ids uuid[];
  v_entry_count integer;
  v_entry_snapshot_hash text;
  v_response_now timestamptz;
  v_idempotency_remaining_ms bigint;
begin
  if p_order_id is null
    or p_reconcile_lease_token is null
    or p_reconcile_lease_epoch is null
    or p_reconcile_lease_epoch < 1
    or p_entry_ids is null
    or coalesce(array_ndims(p_entry_ids), 0) <> 1
    or cardinality(p_entry_ids) < 1
    or array_position(p_entry_ids, null) is not null
    or p_request_payload_hash is null
    or p_request_payload_hash !~ '^[0-9a-f]{64}$'
    or p_template_version is null
    or char_length(trim(p_template_version)) = 0
    or p_template_version <> trim(p_template_version)
    or p_provider is null
    or char_length(trim(p_provider)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Invalid request')
    );
  end if;

  v_provider := lower(trim(p_provider));
  if v_provider <> 'resend' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'invalid_provider', 'message', 'Invalid provider')
    );
  end if;

  select *
  into v_order
  from public.access_orders
  where access_orders.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'order_not_found', 'message', 'Order not found')
    );
  end if;

  -- Lock every attempt, not only the rows currently approved, so a direct
  -- status flip cannot race the approved-count revalidation.
  perform 1
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
  order by payment_attempts.id
  for update;

  select count(*)::integer
  into v_approved_count
  from public.payment_attempts
  where payment_attempts.order_id = v_order.id
    and payment_attempts.status = 'approved';

  if v_approved_count = 1 then
    select *
    into v_approved_attempt
    from public.payment_attempts
    where payment_attempts.order_id = v_order.id
      and payment_attempts.status = 'approved';
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

  select *
  into v_attempt
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
    and access_email_delivery_attempts.status in ('processing', 'ambiguous')
  order by access_email_delivery_attempts.created_at, access_email_delivery_attempts.id
  limit 1
  for update;
  v_attempt_found := found;

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  if v_fulfillment.issuance_review_status = 'manual_review' then
    if not (
      (v_attempt_found and v_attempt.status = 'processing')
      or v_fulfillment.email_status = 'processing'
    ) then
      update public.access_order_fulfillments
      set
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'issuance_manual_review',
        'message', 'Completed issuance requires manual review'
      )
    );
  end if;

  if v_fulfillment.issuance_status <> 'complete' then
    update public.access_order_fulfillments
    set
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'issuance_not_complete',
        'message', 'Entry issuance is not complete'
      )
    );
  end if;

  -- Expiry is checked before every other processing/ambiguous return.
  if v_attempt_found and v_attempt.idempotency_expires_at <= v_now then
    if v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'ambiguous_idempotency_window_expired',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'ambiguous_idempotency_window_expired',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'ambiguous_idempotency_window_expired',
        'message', 'Idempotency window expired'
      )
    );
  end if;

  if v_approved_count <> 1 then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'multiple_approved_payment_attempts',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'multiple_approved_payment_attempts',
        'message', 'Order does not have exactly one approved payment attempt'
      )
    );
  end if;

  if v_approved_attempt.id
      is distinct from v_fulfillment.approved_payment_attempt_id then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'fulfillment_attempt_mismatch',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'fulfillment_attempt_mismatch',
        'message', 'Fulfillment payment attempt mismatch'
      )
    );
  end if;

  if v_approved_attempt.provider <> 'bancard'
    or v_approved_attempt.provider_operation <> 'single_buy' then
    update public.access_order_fulfillments
    set
      issuance_review_status = 'manual_review',
      issuance_review_error_code = 'unsupported_approved_provider',
      issuance_review_error_at = v_now,
      reconcile_lease_token = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_token
        else null
      end,
      reconcile_lease_expires_at = case
        when (v_attempt_found and v_attempt.status = 'processing')
          or v_fulfillment.email_status = 'processing'
          then reconcile_lease_expires_at
        else null
      end,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'unsupported_approved_provider',
        'message', 'Approved payment provider is unsupported'
      )
    );
  end if;

  if v_order.status <> 'paid' then
    update public.access_order_fulfillments
    set
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'order_not_paid', 'message', 'Order is not paid')
    );
  end if;

  perform 1
  from public.access_order_items
  where access_order_items.order_id = v_order.id
  order by access_order_items.id
  for update;

  perform 1
  from public.access_entries
  where access_entries.order_id = v_order.id
  order by
    access_entries.order_item_id,
    access_entries.unit_index,
    access_entries.id
  for update;

  select entry_ids, entry_count, entry_snapshot_hash
  into v_entry_ids, v_entry_count, v_entry_snapshot_hash
  from public.access_core_entry_snapshot(v_order.id);

  v_now := clock_timestamp();

  if v_fulfillment.reconcile_lease_token is distinct from p_reconcile_lease_token
    or v_fulfillment.reconcile_lease_epoch is distinct from p_reconcile_lease_epoch
    or v_fulfillment.reconcile_lease_expires_at is null
    or v_fulfillment.reconcile_lease_expires_at <= v_now then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object('code', 'stale_lease', 'message', 'Stale lease')
    );
  end if;

  if v_attempt_found and v_attempt.idempotency_expires_at <= v_now then
    if v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'ambiguous_idempotency_window_expired',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'ambiguous_idempotency_window_expired',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'error', jsonb_build_object(
        'code', 'ambiguous_idempotency_window_expired',
        'message', 'Idempotency window expired'
      )
    );
  end if;

  if v_entry_count < 1
    or v_entry_count is distinct from v_fulfillment.issued_entries
    or p_entry_ids is distinct from v_entry_ids
    or (
      v_attempt_found
      and (
        v_attempt.provider is distinct from v_provider
        or v_attempt.entry_ids is distinct from p_entry_ids
        or v_attempt.entry_count is distinct from v_entry_count
        or v_attempt.entry_snapshot_hash is distinct from v_entry_snapshot_hash
        or v_attempt.request_payload_hash is distinct from p_request_payload_hash
        or v_attempt.template_version is distinct from p_template_version
      )
    ) then
    if v_attempt_found and v_attempt.status = 'processing' then
      update public.access_email_delivery_attempts
      set
        status = 'ambiguous',
        provider_message_id = null,
        error_code = 'delivery_payload_drift',
        finished_at = null
      where id = v_attempt.id;
    end if;

    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'delivery_payload_drift',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'delivery_attempt_id', case
        when v_attempt_found then v_attempt.id
        else null
      end,
      'error', jsonb_build_object(
        'code', 'delivery_payload_drift',
        'message', 'Delivery payload no longer matches the entry snapshot'
      )
    );
  end if;

  if v_attempt_found then
    if v_attempt.status = 'processing' then
      v_response_now := clock_timestamp();
      v_idempotency_remaining_ms := greatest(
        0::bigint,
        floor(
          extract(
            epoch from (
              v_attempt.idempotency_expires_at - v_response_now
            )
          ) * 1000
        )::bigint
      );

      return jsonb_build_object(
        'ok', true,
        'status', 'processing',
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'generation', v_attempt.generation,
        'provider', v_attempt.provider,
        'idempotency_key', v_attempt.idempotency_key,
        'entry_ids', to_jsonb(v_attempt.entry_ids),
        'entry_count', v_attempt.entry_count,
        'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
        'request_payload_hash', v_attempt.request_payload_hash,
        'template_version', v_attempt.template_version,
        'idempotency_remaining_ms', v_idempotency_remaining_ms,
        'epoch', v_fulfillment.reconcile_lease_epoch,
        'idempotent', true
      );
    end if;

    v_provider_call_at := greatest(
      clock_timestamp(),
      v_attempt.last_provider_call_at + interval '1 microsecond'
    );

    if v_provider_call_at >= v_attempt.idempotency_expires_at then
      v_now := clock_timestamp();
      update public.access_order_fulfillments
      set
        email_status = 'manual_review',
        email_next_attempt_at = null,
        email_sent_at = null,
        email_last_error_code = 'ambiguous_idempotency_window_expired',
        email_last_error_at = v_now,
        email_provider_message_id = null,
        reconcile_lease_token = null,
        reconcile_lease_expires_at = null,
        updated_at = v_now
      where order_id = v_order.id;

      return jsonb_build_object(
        'ok', false,
        'order_id', v_order.id,
        'delivery_attempt_id', v_attempt.id,
        'error', jsonb_build_object(
          'code', 'ambiguous_idempotency_window_expired',
          'message', 'Idempotency window expired'
        )
      );
    end if;

    update public.access_email_delivery_attempts
    set
      status = 'processing',
      error_code = null,
      provider_call_count = provider_call_count + 1,
      last_provider_call_at = v_provider_call_at,
      provider_message_id = null,
      finished_at = null
    where id = v_attempt.id
    returning * into v_attempt;

    update public.access_order_fulfillments
    set
      email_status = 'processing',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = null,
      email_last_error_at = null,
      email_provider_message_id = null,
      updated_at = v_provider_call_at
    where order_id = v_order.id;

    v_response_now := clock_timestamp();
    v_idempotency_remaining_ms := greatest(
      0::bigint,
      floor(
        extract(
          epoch from (
            v_attempt.idempotency_expires_at - v_response_now
          )
        ) * 1000
      )::bigint
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'processing',
      'order_id', v_order.id,
      'delivery_attempt_id', v_attempt.id,
      'generation', v_attempt.generation,
      'provider', v_attempt.provider,
      'idempotency_key', v_attempt.idempotency_key,
      'entry_ids', to_jsonb(v_attempt.entry_ids),
      'entry_count', v_attempt.entry_count,
      'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
      'request_payload_hash', v_attempt.request_payload_hash,
      'template_version', v_attempt.template_version,
      'idempotency_remaining_ms', v_idempotency_remaining_ms,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'idempotent', false
    );
  end if;

  if v_fulfillment.email_status = 'sent' then
    return jsonb_build_object(
      'ok', true,
      'status', 'skipped_sent',
      'order_id', v_order.id,
      'generation', v_fulfillment.email_generation,
      'epoch', v_fulfillment.reconcile_lease_epoch,
      'idempotent', true
    );
  end if;

  if v_fulfillment.email_status = 'manual_review' then
    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'email_manual_review',
        'message', 'Email delivery requires manual review'
      )
    );
  end if;

  perform 1
  from public.access_email_delivery_attempts
  where access_email_delivery_attempts.order_id = v_order.id
    and access_email_delivery_attempts.generation = v_fulfillment.email_generation
    and access_email_delivery_attempts.status = 'accepted'
  for update;

  if found then
    update public.access_order_fulfillments
    set
      email_status = 'manual_review',
      email_next_attempt_at = null,
      email_sent_at = null,
      email_last_error_code = 'delivery_state_conflict',
      email_last_error_at = v_now,
      email_provider_message_id = null,
      reconcile_lease_token = null,
      reconcile_lease_expires_at = null,
      updated_at = v_now
    where order_id = v_order.id;

    return jsonb_build_object(
      'ok', false,
      'order_id', v_order.id,
      'error', jsonb_build_object(
        'code', 'delivery_state_conflict',
        'message', 'Delivery state conflict'
      )
    );
  end if;

  v_now := clock_timestamp();
  v_attempt_id := gen_random_uuid();
  v_idempotency_key := 'access-email-delivery/' || v_attempt_id::text;

  insert into public.access_email_delivery_attempts (
    id,
    order_id,
    generation,
    trigger_type,
    status,
    idempotency_key,
    idempotency_expires_at,
    provider,
    entry_ids,
    entry_count,
    entry_snapshot_hash,
    request_payload_hash,
    template_version,
    provider_message_id,
    error_code,
    requested_by_auth_user_id,
    provider_call_count,
    last_provider_call_at,
    started_at,
    finished_at,
    created_at
  )
  values (
    v_attempt_id,
    v_order.id,
    v_fulfillment.email_generation,
    'automatic',
    'processing',
    v_idempotency_key,
    v_now + interval '24 hours',
    v_provider,
    v_entry_ids,
    v_entry_count,
    v_entry_snapshot_hash,
    p_request_payload_hash,
    p_template_version,
    null,
    null,
    null,
    1,
    v_now,
    v_now,
    null,
    v_now
  )
  returning * into v_attempt;

  update public.access_order_fulfillments
  set
    email_status = 'processing',
    email_next_attempt_at = null,
    email_sent_at = null,
    email_last_error_code = null,
    email_last_error_at = null,
    email_provider_message_id = null,
    updated_at = v_now
  where order_id = v_order.id;

  v_response_now := clock_timestamp();
  v_idempotency_remaining_ms := greatest(
    0::bigint,
    floor(
      extract(
        epoch from (
          v_attempt.idempotency_expires_at - v_response_now
        )
      ) * 1000
    )::bigint
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'processing',
    'order_id', v_order.id,
    'delivery_attempt_id', v_attempt.id,
    'generation', v_attempt.generation,
    'provider', v_attempt.provider,
    'idempotency_key', v_attempt.idempotency_key,
    'entry_ids', to_jsonb(v_attempt.entry_ids),
    'entry_count', v_attempt.entry_count,
    'entry_snapshot_hash', v_attempt.entry_snapshot_hash,
    'request_payload_hash', v_attempt.request_payload_hash,
    'template_version', v_attempt.template_version,
    'idempotency_remaining_ms', v_idempotency_remaining_ms,
    'epoch', v_fulfillment.reconcile_lease_epoch,
    'idempotent', false
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'retryable', true,
      'error', jsonb_build_object(
        'code', 'concurrency_conflict',
        'message', 'Concurrency conflict'
      )
    );
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
      'error', jsonb_build_object('code', 'internal_error', 'message', 'Internal error')
    );
end;
$$;

alter function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  owner to postgres;
revoke all on function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_access_email_delivery(
  uuid, uuid, bigint, uuid[], text, text, text
)
  to service_role;

do $migration_049_assertions$
declare
  v_terminal_oid oid;
  v_claim_oid oid;
  v_preflight_claim_oid oid;
  v_function_source text;
  v_function_normalized text;
  v_default_expression text;
  v_function_identity text;
  v_role text;
  v_expected boolean;
  v_actual boolean;
  v_fragment text;
  v_actual_occurrences integer;
  v_preflight_catalog_counts text;
  v_post_catalog_counts text;
  v_preflight_catalog_fingerprint text;
  v_post_catalog_fingerprint text;
begin
  v_terminal_oid := to_regprocedure(
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)'
  );

  if v_terminal_oid is null
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
      where pg_proc.oid = v_terminal_oid
        and pg_proc.pronargs = 5
        and pg_proc.pronargdefaults = 0
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, uuid, bigint, integer, text'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prolang = (
          select pg_language.oid
          from pg_language
          where pg_language.lanname = 'plpgsql'
        )
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 049 assertion failed: migration 048 RPC signature or security drifted';
  end if;

  select pg_proc.prosrc
  into v_function_source
  from pg_proc
  where pg_proc.oid = v_terminal_oid;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'd725a12249ebad5606994e8a6cb8dc1670dd1211f882b689f7db523b8befabc4'
  then
    raise exception
      'Migration 049 assertion failed: migration 048 RPC body changed';
  end if;

  v_claim_oid := to_regprocedure(
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)'
  );
  v_preflight_claim_oid := nullif(
    current_setting('app.migration_049_claim_oid', true),
    ''
  )::oid;

  if v_claim_oid is null
    or v_preflight_claim_oid is null
    or v_claim_oid <> v_preflight_claim_oid
    or (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'claim_access_email_delivery'
    ) <> 1
    or not exists (
      select 1
      from pg_proc
      where pg_proc.oid = v_claim_oid
        and pg_proc.pronargs = 7
        and pg_proc.pronargdefaults = 1
        and pg_catalog.oidvectortypes(pg_proc.proargtypes)
          = 'uuid, uuid, bigint, uuid[], text, text, text'
        and pg_proc.prorettype = 'jsonb'::regtype
        and pg_proc.prolang = (
          select pg_language.oid
          from pg_language
          where pg_language.lanname = 'plpgsql'
        )
        and pg_proc.prosecdef
        and pg_proc.proowner = 'postgres'::regrole
        and coalesce(pg_proc.proconfig, array[]::text[])
          = array['search_path=public, pg_temp']::text[]
    ) then
    raise exception
      'Migration 049 assertion failed: delivery claim identity or security drifted';
  end if;

  select
    pg_get_expr(pg_proc.proargdefaults, 0),
    pg_proc.prosrc
  into
    v_default_expression,
    v_function_source
  from pg_proc
  where pg_proc.oid = v_claim_oid;

  if regexp_replace(v_default_expression, '[[:space:]]+', '', 'g')
      <> '''resend''::text' then
    raise exception
      'Migration 049 assertion failed: delivery claim default drifted';
  end if;

  v_function_normalized := btrim(
    regexp_replace(v_function_source, '[[:space:]]+', ' ', 'g')
  );

  if pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_function_normalized, 'UTF8')
    ),
    'hex'
  ) <> 'bdfba3af34357decbc07794ee09c4cb85d3b62f1d2760a1996e1b81023aab324'
  then
    raise exception
      'Migration 049 assertion failed: delivery claim body drifted';
  end if;

  foreach v_fragment in array array[
    '''status'', ''processing''',
    '''entry_count'', v_attempt.entry_count',
    '''request_payload_hash'', v_attempt.request_payload_hash',
    '''idempotency_remaining_ms'', v_idempotency_remaining_ms',
    'v_response_now := clock_timestamp();',
    'v_attempt.idempotency_expires_at - v_response_now',
    'greatest( 0::bigint, floor('
  ]
  loop
    v_actual_occurrences := (
      length(v_function_normalized)
        - length(replace(v_function_normalized, v_fragment, ''))
    ) / length(v_fragment);

    if v_actual_occurrences <> 3 then
      raise exception
        'Migration 049 assertion failed: processing projection drifted';
    end if;
  end loop;

  if position('''idempotency_expires_at'',' in v_function_normalized) > 0
    or position('''database_now'',' in v_function_normalized) > 0
    or position('''contract_version'',' in v_function_normalized) > 0
    or position('''claim_mode'',' in v_function_normalized) > 0
    or position('''attempt_reused'',' in v_function_normalized) > 0
    or position('''provider_call_count'',' in v_function_normalized) > 0 then
    raise exception
      'Migration 049 assertion failed: forbidden public claim field is present';
  end if;

  if (
    length(v_function_normalized)
      - length(replace(
          v_function_normalized,
          '''status'', ''skipped_sent''',
          ''
        ))
  ) / length('''status'', ''skipped_sent''') <> 1
    or position(
      '''delivery_attempt_id'', case when v_attempt_found then v_attempt.id else null end'
      in v_function_normalized
    ) = 0 then
    raise exception
      'Migration 049 assertion failed: skipped or drift-null response changed';
  end if;

  foreach v_function_identity in array array[
    'public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)',
    'public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)'
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
      v_actual := has_function_privilege(
        v_role,
        v_function_identity,
        'EXECUTE'
      );

      if v_actual is distinct from v_expected then
        raise exception
          'Migration 049 assertion failed: function EXECUTE privilege drifted';
      end if;
    end loop;

    if exists (
      select 1
      from pg_proc
      cross join lateral aclexplode(
        coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))
      ) as function_acl
      where pg_proc.oid = to_regprocedure(v_function_identity)
        and (
          function_acl.privilege_type <> 'EXECUTE'
          or function_acl.grantor <> pg_proc.proowner
          or function_acl.grantee not in (
            pg_proc.proowner,
            'service_role'::regrole
          )
          or (
            function_acl.grantee = 'service_role'::regrole
            and function_acl.is_grantable
          )
        )
    )
      or not exists (
        select 1
        from pg_proc
        cross join lateral aclexplode(
          coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))
        ) as function_acl
        where pg_proc.oid = to_regprocedure(v_function_identity)
          and function_acl.grantee = 'service_role'::regrole
          and function_acl.privilege_type = 'EXECUTE'
          and not function_acl.is_grantable
      ) then
      raise exception
        'Migration 049 assertion failed: function ACL is not closed';
    end if;
  end loop;

  v_preflight_catalog_counts := nullif(
    current_setting('app.migration_049_catalog_counts', true),
    ''
  );
  v_preflight_catalog_fingerprint := nullif(
    current_setting('app.migration_049_catalog_fingerprint', true),
    ''
  );

  select format(
    'relations=%s|tables=%s|columns=%s|constraints=%s|indexes=%s|triggers=%s|policies=%s|functions=%s',
    (
      select count(*)
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind in ('r', 'p')
    ),
    (
      select count(*)
      from pg_attribute
      join pg_class on pg_class.oid = pg_attribute.attrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_attribute.attnum > 0
        and not pg_attribute.attisdropped
    ),
    (
      select count(*)
      from pg_constraint
      join pg_namespace on pg_namespace.oid = pg_constraint.connamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_index
      join pg_class as indexed_relation
        on indexed_relation.oid = pg_index.indrelid
      join pg_namespace
        on pg_namespace.oid = indexed_relation.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_trigger
      join pg_class on pg_class.oid = pg_trigger.tgrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_policy
      join pg_class on pg_class.oid = pg_policy.polrelid
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
    ),
    (
      select count(*)
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
    )
  )
  into v_post_catalog_counts;

  with catalog_rows(row_data) as (
    select jsonb_build_array(
      'relation',
      pg_class.oid,
      pg_class.relname,
      pg_class.relkind,
      pg_class.relpersistence,
      pg_get_userbyid(pg_class.relowner),
      pg_class.relrowsecurity,
      pg_class.relforcerowsecurity,
      pg_class.relacl,
      case
        when pg_class.relkind in ('v', 'm')
          then pg_get_viewdef(pg_class.oid, true)
        else null
      end
    )::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'column',
      pg_attribute.attrelid,
      pg_attribute.attnum,
      pg_attribute.attname,
      format_type(pg_attribute.atttypid, pg_attribute.atttypmod),
      pg_attribute.attnotnull,
      pg_attribute.attidentity,
      pg_attribute.attgenerated,
      pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid),
      pg_attribute.attacl
    )::text
    from pg_attribute
    join pg_class on pg_class.oid = pg_attribute.attrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    left join pg_attrdef
      on pg_attrdef.adrelid = pg_attribute.attrelid
      and pg_attrdef.adnum = pg_attribute.attnum
    where pg_namespace.nspname = 'public'
      and pg_attribute.attnum > 0
      and not pg_attribute.attisdropped

    union all

    select jsonb_build_array(
      'constraint',
      pg_constraint.oid,
      pg_constraint.conname,
      pg_constraint.contype,
      pg_constraint.conrelid,
      pg_constraint.confrelid,
      pg_constraint.conindid,
      pg_constraint.condeferrable,
      pg_constraint.condeferred,
      pg_constraint.convalidated,
      pg_get_constraintdef(pg_constraint.oid, true)
    )::text
    from pg_constraint
    join pg_namespace on pg_namespace.oid = pg_constraint.connamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'index',
      pg_index.indexrelid,
      pg_index.indrelid,
      pg_index.indisunique,
      pg_index.indisprimary,
      pg_index.indisexclusion,
      pg_index.indimmediate,
      pg_index.indisvalid,
      pg_index.indisready,
      pg_get_indexdef(pg_index.indexrelid)
    )::text
    from pg_index
    join pg_class as indexed_relation
      on indexed_relation.oid = pg_index.indrelid
    join pg_namespace
      on pg_namespace.oid = indexed_relation.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'trigger',
      pg_trigger.oid,
      pg_trigger.tgrelid,
      pg_trigger.tgname,
      pg_trigger.tgfoid,
      pg_trigger.tgenabled,
      pg_trigger.tgisinternal,
      pg_get_triggerdef(pg_trigger.oid, true)
    )::text
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'policy',
      pg_policy.oid,
      pg_policy.polrelid,
      pg_policy.polname,
      pg_policy.polcmd,
      pg_policy.polpermissive,
      pg_policy.polroles,
      pg_get_expr(pg_policy.polqual, pg_policy.polrelid),
      pg_get_expr(pg_policy.polwithcheck, pg_policy.polrelid)
    )::text
    from pg_policy
    join pg_class on pg_class.oid = pg_policy.polrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'function',
      pg_proc.oid,
      pg_proc.proname,
      pg_proc.prokind,
      pg_get_function_identity_arguments(pg_proc.oid),
      pg_get_function_result(pg_proc.oid),
      pg_language.lanname,
      pg_get_userbyid(pg_proc.proowner),
      pg_proc.prosecdef,
      pg_proc.proleakproof,
      pg_proc.proisstrict,
      pg_proc.provolatile,
      pg_proc.proparallel,
      pg_proc.pronargdefaults,
      pg_get_expr(pg_proc.proargdefaults, 0),
      pg_proc.proconfig,
      pg_proc.proacl,
      pg_proc.prosrc
    )::text
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    join pg_language on pg_language.oid = pg_proc.prolang
    where pg_namespace.nspname = 'public'
      and pg_proc.oid <> v_claim_oid

    union all

    select jsonb_build_array(
      'schema_acl',
      pg_namespace.oid,
      pg_namespace.nspacl
    )::text
    from pg_namespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'relation_acl',
      pg_class.oid,
      pg_class.relacl
    )::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'

    union all

    select jsonb_build_array(
      'column_acl',
      pg_attribute.attrelid,
      pg_attribute.attnum,
      pg_attribute.attacl
    )::text
    from pg_attribute
    join pg_class on pg_class.oid = pg_attribute.attrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_attribute.attnum > 0
      and not pg_attribute.attisdropped

    union all

    select jsonb_build_array(
      'function_acl',
      pg_proc.oid,
      pg_proc.proacl
    )::text
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.oid <> v_claim_oid
  )
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        coalesce(string_agg(row_data, E'\n' order by row_data), ''),
        'UTF8'
      )
    ),
    'hex'
  )
  into v_post_catalog_fingerprint
  from catalog_rows;

  if v_preflight_catalog_counts is null
    or v_post_catalog_counts <> v_preflight_catalog_counts
    or v_preflight_catalog_fingerprint is null
    or v_post_catalog_fingerprint <> v_preflight_catalog_fingerprint then
    raise exception
      'Migration 049 assertion failed: schema catalog or unrelated RPC drifted';
  end if;
end;
$migration_049_assertions$;

commit;
