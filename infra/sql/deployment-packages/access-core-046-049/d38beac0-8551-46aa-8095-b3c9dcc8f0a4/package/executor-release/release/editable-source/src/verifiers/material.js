'use strict';

const { canonicalHash } = require('../hash/canonical');
const { lastRows } = require('../db/protocol-client');

const CATALOG_FINGERPRINT_SQL = `
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
`;

const STRUCTURE_SQL = `
SELECT jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'databaseId', current_database(),
  'fulfillmentTable', to_regclass('public.access_order_fulfillments') is not null,
  'deliveryAttemptTable', to_regclass('public.access_email_delivery_attempts') is not null,
  'markerColumn', exists(
    select 1 from information_schema.columns where table_schema='public'
      and table_name='access_order_fulfillments' and column_name='email_preclaim_terminal_request_hash'
  ),
  'terminalSha256', coalesce((
    select encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')
    from pg_proc p where p.oid=to_regprocedure('public.record_access_email_preclaim_terminal_failure(uuid,uuid,bigint,integer,text)')
  ),''),
  'claimSha256', coalesce((
    select encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')
    from pg_proc p where p.oid=to_regprocedure('public.claim_access_email_delivery(uuid,uuid,bigint,uuid[],text,text,text)')
  ),'')
)::text AS structure;
`;

class StageVerificationError extends Error {
  constructor(stage, mismatches) {
    super(`STAGE_VERIFICATION_FAILED ${stage}: ${mismatches.join(', ')}`);
    this.name = 'StageVerificationError';
    this.code = 'STAGE_VERIFICATION_FAILED';
    this.stage = stage;
    this.mismatches = mismatches;
  }
}

async function captureMaterial(client) {
  const fingerprintRows = lastRows(await client.simpleQuery(CATALOG_FINGERPRINT_SQL));
  const structureRows = lastRows(await client.simpleQuery(STRUCTURE_SQL));
  if (fingerprintRows.length !== 1 || structureRows.length !== 1) throw new Error('MATERIAL_CAPTURE_CARDINALITY_MISMATCH');
  const structure = JSON.parse(structureRows[0].structure);
  return { catalogFingerprint: fingerprintRows[0].catalog_fingerprint, ...structure };
}

function compareStage(stage, actual, contract) {
  const expected = contract.stages[stage];
  if (!expected) throw new StageVerificationError(stage, ['stage absent from frozen contract']);
  const comparisons = [
    ['catalogFingerprint', 'catalog_fingerprint'], ['fulfillmentTable', 'fulfillment_table'],
    ['deliveryAttemptTable', 'delivery_attempt_table'], ['markerColumn', 'marker_column'],
    ['terminalSha256', 'terminal_sha256'], ['claimSha256', 'claim_sha256'],
  ];
  const mismatches = comparisons.filter(([actualKey, expectedKey]) => actual[actualKey] !== expected[expectedKey]).map(([actualKey]) => actualKey);
  const evidence = { stage, expected, actual, mismatches, pass: mismatches.length === 0 };
  evidence.evidenceSha256 = canonicalHash(evidence);
  if (mismatches.length) throw new StageVerificationError(stage, mismatches);
  return evidence;
}

async function verifyMaterialStage(client, stage, contract) {
  return compareStage(stage, await captureMaterial(client), contract);
}

module.exports = { CATALOG_FINGERPRINT_SQL, STRUCTURE_SQL, StageVerificationError, captureMaterial, compareStage, verifyMaterialStage };
