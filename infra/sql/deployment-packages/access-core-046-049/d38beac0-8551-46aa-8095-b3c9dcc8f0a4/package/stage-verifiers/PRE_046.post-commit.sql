-- ACCESS CORE PRE_046 READ-ONLY VERIFIER V2
SELECT jsonb_build_object(
  'stage','PRE_046','transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'database',current_database(),
  'ledger',coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',to_jsonb(statements)) order by version) from supabase_migrations.schema_migrations),'[]'::jsonb),
  'fulfillment_table',to_regclass('public.access_order_fulfillments') is not null,
  'delivery_attempt_table',to_regclass('public.access_email_delivery_attempts') is not null,
  'marker_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='access_order_fulfillments' and column_name='email_preclaim_terminal_request_hash'),
  'source_relation_oids',(select jsonb_object_agg(c.relname,c.oid::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('access_orders','payment_attempts','access_ticket_types','access_order_items','access_entries')),
  'source_data',jsonb_build_object(
  'access_orders', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_orders x),'[]'::jsonb),
  'payment_attempts', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.payment_attempts x),'[]'::jsonb),
  'access_ticket_types', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_ticket_types x),'[]'::jsonb),
  'access_order_items', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_order_items x),'[]'::jsonb),
  'access_entries', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_entries x),'[]'::jsonb)
)
)::text AS verifier_snapshot;
