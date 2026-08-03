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