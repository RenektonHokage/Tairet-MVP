'use strict';

const path = require('path');

const PACKAGE_ID = 'd38beac0-8551-46aa-8095-b3c9dcc8f0a4';
const PACKAGE_SUFFIX = 'fac55618';
const HOST_PACKAGE_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-deployment-package-v2-fac55618';
const REPOSITORY_ROOT = 'C:\\Importante\\Python\\tairet-mono-2';
const FAILED_PACKAGE_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-deployment-package-1f2c969e';
const EXECUTOR_V3_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v3-81648269';
const EXECUTOR_RELEASE_SOURCE = path.join(EXECUTOR_V3_ROOT, 'frozen-release', 'release');
const EXECUTOR_REVIEW_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v3-review-a6f31c8d';
const PRIOR_REHEARSAL_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\migration-046-049-ledger-neutral-rehearsal-v2-87d175c4';
const PRIOR_REVIEW_ROOT = 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\migration-046-049-ledger-neutral-review-v2-e3375454';

const EXPECTED_EXECUTOR_RELEASE_IDENTITY = '700cb1c385bcdb1c64d4d4a69fec585af4b769090aa72de2c1059da8d8e01da1';
const EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256 = '811b43b868585f4ce9b8ef77a893d9c466e398b4269869f1bf8971b941814a83';
const EXPECTED_EXECUTOR_STRUCTURED_RESULT_SHA256 = 'dd4f441b75a30a4173e152e5dde73fcb516455c6816d36b7348c2c44e8f9b704';
const EXPECTED_EXECUTOR_REVIEW = Object.freeze({
  'independent-v3-executor-review.md': '844d51099da3535496a20a855e0ee785053f737340f70890c29362c6caaf6abb',
  'independent-structured-result.json': '2ea4bfe1267a6e1aba504a0dad59ad70162bf9cb9bf572da7080e0f817eab9c2',
  'independent-evidence-manifest.json': '635c4ed7e66b4ebf07c7bea52313d037f54d67c070425e88ae3f949236e29cb7',
  'independent-artifact-hash-manifest.json': 'eaa641b20dee459383577c24f3da9950150606a355249bb1942fe505477f88a0',
});

const MIGRATIONS = Object.freeze([
  Object.freeze({ logical: '046', filename: '046_access_core_recoverable_fulfillment.sql', name: 'access_core_recoverable_fulfillment', size: 163792, sha256: '6f1b39fc66b53856e19475b20539de1377f20e29fe6ad99a79472c97dba2fe0c', payloadSize: 163777, payloadSha256: 'bc86b500ad4b01248edc1a20677bdeb49c8a39360215350b26b71d987b50f9bf', preStage: 'PRE_046', postStage: 'POST_046', testVersion: 'TEST_ONLY_00000046' }),
  Object.freeze({ logical: '047', filename: '047_access_email_preclaim_terminal_failure.sql', name: 'access_email_preclaim_terminal_failure', size: 46349, sha256: '6bebbe803cc5c85094352bbcbc261df5ce26780fb1ae38d956089f48b67f20b4', payloadSize: 46334, payloadSha256: 'e2400dd0bd191b097bbd5097557522f6a30949528f4d98214974a328c679afcf', preStage: 'POST_046', postStage: 'POST_047', testVersion: 'TEST_ONLY_00000047' }),
  Object.freeze({ logical: '048', filename: '048_access_email_preclaim_terminal_after_ambiguous.sql', name: 'access_email_preclaim_terminal_after_ambiguous', size: 24852, sha256: '249a75c0da2f80a66e0d0717a88d8c4710cf51f210098078a375692fd4567532', payloadSize: 24837, payloadSha256: '0238e401a59b7dc3943e077ff49f087629bdcf096e8c08a9e5a0b30c8f03fb64', preStage: 'POST_047', postStage: 'POST_048', testVersion: 'TEST_ONLY_00000048' }),
  Object.freeze({ logical: '049', filename: '049_access_email_delivery_claim_correlation.sql', name: 'access_email_delivery_claim_correlation', size: 55698, sha256: 'cc3b71a988fafa3298344ec73731abc0ce8219c1dc35110e59916e5344f6d234', payloadSize: 55683, payloadSha256: 'e367fe2c3bd96df4ae0b72ea9348a1f2fb139e723123dc43bf566ecd9d9ae3d3', preStage: 'POST_048', postStage: 'POST_049', testVersion: 'TEST_ONLY_00000049' }),
]);

const FAILED_PACKAGE = Object.freeze({
  package_id: 'f290261c-96e0-4bcc-a982-37093e47e28d',
  classification: 'ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_FINDINGS',
  packaging_event_utc: '2026-08-01T23:51:30Z',
  versions: Object.freeze(['20260801235130', '20260801235131', '20260801235132', '20260801235133']),
  identities: Object.freeze({
    packaging_event: 'b14b81faa131d5b5daecb6eba71e2c4c069a97d923861619ef134c8294d3beaa',
    version_assignment: '10ce675d603145cb2520e032f7f6ec6b3173338470aa7500dbec6fd85b850f40',
    eligibility_policy: '980291b98e2ad9549fdb5411205823e8dbd2ae27d250bb87109e3622ecbd6cb9',
    input_manifest: '2efd4832c37a65342c948337aca1a52bd4a4de95b7775a01e655396d5dbc1669',
    statement_manifest: '34983dbb84068214178f4f3b7d0977b7abd33ba87e12850ae65dc75fe6b9c305',
    verifier_manifest: '3afa220cdfae81fdad92f7b2dc2d7af7a64a407ccf8b289ae332f140b2abe6a2',
    preflight_binding: 'ad2313b38a35118318cbbb3a7eb8e44e658ef66e894c9f013457c8eae44f44a3',
    deployment_manifest: 'ef5be8d334ffce33460d373b3c77067192189208d09b0245dd2a1fae8afa1f8f',
  }),
});

const PREDECESSOR = Object.freeze({
  version: '20260711062758',
  name: '045_access_core_paid_checkin_operational_window',
  localStatements: Object.freeze(['LOCAL_PACKAGE_SYNTHETIC_PREDECESSOR_STATEMENT']),
});

const POSTGRES_IMAGE = Object.freeze({ reference: 'public.ecr.aws/supabase/postgres:17.6.1.143', id: 'sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453' });
const CLIENT_IMAGE = Object.freeze({ reference: 'mcr.microsoft.com/devcontainers/javascript-node:22', id: 'sha256:25a1f18c8f075b597b309c6fc7c09657353fd353b6bf912b48158b2af72b2b9c' });

module.exports = {
  PACKAGE_ID,
  PACKAGE_SUFFIX,
  HOST_PACKAGE_ROOT,
  REPOSITORY_ROOT,
  FAILED_PACKAGE_ROOT,
  EXECUTOR_V3_ROOT,
  EXECUTOR_RELEASE_SOURCE,
  EXECUTOR_REVIEW_ROOT,
  PRIOR_REHEARSAL_ROOT,
  PRIOR_REVIEW_ROOT,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
  EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256,
  EXPECTED_EXECUTOR_STRUCTURED_RESULT_SHA256,
  EXPECTED_EXECUTOR_REVIEW,
  MIGRATIONS,
  FAILED_PACKAGE,
  PREDECESSOR,
  POSTGRES_IMAGE,
  CLIENT_IMAGE,
};
