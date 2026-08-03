-- ACCESS CORE POST_047 POST-COMMIT READ-ONLY VERIFIER V2
SELECT jsonb_build_object(
  'stage','POST_047','phase','post-commit','transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'database',current_database(),
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
