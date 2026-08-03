-- ACCESS CORE POST_048 IN-TRANSACTION VERIFIER V2
WITH material AS (
  SELECT 'schemas' AS k, coalesce(jsonb_agg(jsonb_build_object(
    'name', n.nspname, 'owner', pg_get_userbyid(n.nspowner),
    'acl', coalesce(n.nspacl::text,''),
    'comment', coalesce(obj_description(n.oid,'pg_namespace'),'')
  ) ORDER BY n.nspname),'[]'::jsonb) AS v
  FROM pg_namespace n WHERE n.nspname='public'
  UNION ALL
  SELECT 'relations', coalesce(jsonb_agg(jsonb_build_object(
    'name', c.relname, 'kind', c.relkind, 'persistence', c.relpersistence,
    'owner', pg_get_userbyid(c.relowner), 'acl', coalesce(c.relacl::text,''),
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'comment', coalesce(obj_description(c.oid,'pg_class'),'')
  ) ORDER BY c.relname,c.relkind),'[]'::jsonb)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
  UNION ALL
  SELECT 'columns', coalesce(jsonb_agg(jsonb_build_object(
    'relation', c.relname, 'ordinal', a.attnum, 'name', a.attname,
    'type', format_type(a.atttypid,a.atttypmod), 'not_null', a.attnotnull,
    'identity', a.attidentity, 'generated', a.attgenerated,
    'default', coalesce(pg_get_expr(d.adbin,d.adrelid,true),''),
    'collation', coalesce(coll.collname,''),
    'comment', coalesce(col_description(a.attrelid,a.attnum),'')
  ) ORDER BY c.relname,a.attnum),'[]'::jsonb)
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  LEFT JOIN pg_collation coll ON coll.oid=a.attcollation
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
    AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'constraints', coalesce(jsonb_agg(jsonb_build_object(
    'relation', c.relname, 'name', con.conname, 'type', con.contype,
    'definition', pg_get_constraintdef(con.oid,true),
    'validated', con.convalidated, 'deferrable', con.condeferrable,
    'deferred', con.condeferred
  ) ORDER BY c.relname,con.conname),'[]'::jsonb)
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN ('access_order_fulfillments','access_email_delivery_attempts')
  UNION ALL
  SELECT 'indexes', coalesce(jsonb_agg(jsonb_build_object(
    'relation', t.relname, 'name', i.relname,
    'definition', pg_get_indexdef(i.oid), 'valid', x.indisvalid,
    'ready', x.indisready
  ) ORDER BY t.relname,i.relname),'[]'::jsonb)
  FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
  JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public'
  UNION ALL
  SELECT 'triggers', coalesce(jsonb_agg(jsonb_build_object(
    'relation', c.relname, 'name', t.tgname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid,true)
  ) ORDER BY c.relname,t.tgname),'[]'::jsonb)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal
  UNION ALL
  SELECT 'policies', coalesce(jsonb_agg(jsonb_build_object(
    'relation', c.relname, 'name', p.polname, 'command', p.polcmd,
    'permissive', p.polpermissive,
    'roles', ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid=ANY(p.polroles) ORDER BY r.rolname),
    'using', coalesce(pg_get_expr(p.polqual,p.polrelid,true),''),
    'with_check', coalesce(pg_get_expr(p.polwithcheck,p.polrelid,true),'')
  ) ORDER BY c.relname,p.polname),'[]'::jsonb)
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  UNION ALL
  SELECT 'functions', coalesce(jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'result', pg_get_function_result(p.oid),
    'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
    'config', coalesce(to_jsonb(p.proconfig),'[]'::jsonb),
    'acl', coalesce(p.proacl::text,''), 'definition', pg_get_functiondef(p.oid),
    'comment', coalesce(obj_description(p.oid,'pg_proc'),'')
  ) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
  UNION ALL
  SELECT 'types', coalesce(jsonb_agg(jsonb_build_object(
    'name', t.typname, 'kind', t.typtype, 'category', t.typcategory,
    'owner', pg_get_userbyid(t.typowner), 'acl', coalesce(t.typacl::text,''),
    'not_null', t.typnotnull,
    'base', CASE WHEN t.typbasetype=0 THEN '' ELSE format_type(t.typbasetype,t.typtypmod) END,
    'enum_labels', coalesce((SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid),'[]'::jsonb),
    'comment', coalesce(obj_description(t.oid,'pg_type'),'')
  ) ORDER BY t.typname),'[]'::jsonb)
  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public' AND t.typtype IN ('e','d')
)
SELECT encode(sha256(convert_to(jsonb_object_agg(k,v ORDER BY k)::text,'UTF8')),'hex') AS catalog_fingerprint FROM material;
SELECT jsonb_build_object(
  'stage','POST_048','phase','in-transaction','transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'database',current_database(),
  'ledger',coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',to_jsonb(statements)) order by version) from supabase_migrations.schema_migrations),'[]'::jsonb),
  'source_relation_oids',(select jsonb_object_agg(c.relname,c.oid::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('access_orders','payment_attempts','access_ticket_types','access_order_items','access_entries')),
  'source_data',jsonb_build_object(
  'access_orders', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_orders x),'[]'::jsonb),
  'payment_attempts', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.payment_attempts x),'[]'::jsonb),
  'access_ticket_types', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_ticket_types x),'[]'::jsonb),
  'access_order_items', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_order_items x),'[]'::jsonb),
  'access_entries', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_entries x),'[]'::jsonb)
),
  'fulfillment_count',(select count(*) from public.access_order_fulfillments),
  'delivery_attempt_count',(select count(*) from public.access_email_delivery_attempts),
  'eligible_order_count',(select count(*) from public.access_orders o where o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved')),
  'orphan_fulfillment_count',(select count(*) from public.access_order_fulfillments f left join public.access_orders o on o.id=f.order_id where o.id is null),
  'eligible_without_fulfillment_count',(select count(*) from public.access_orders o where o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved') and not exists(select 1 from public.access_order_fulfillments f where f.order_id=o.id)),
  'fulfillment_without_eligible_count',(select count(*) from public.access_order_fulfillments f where not exists(select 1 from public.access_orders o where o.id=f.order_id and o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved')))
)::text AS verifier_snapshot;
