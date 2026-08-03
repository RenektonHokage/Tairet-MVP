'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sha256File } = require('../src/hash/canonical');

const toolRoot = path.resolve(__dirname, '..', '..');
const v1Release = process.env.V1_FROZEN_RELEASE_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v1-008a2f38\\frozen-release\\release';

const specs = [
  ['identity model', 'editable-source/src/identity/model.js', 'editable-source/src/identity/model.js', 'BYTE_EXACT_REUSE', ['static:C046-C049', 'atomicity:A001-A025']],
  ['envelope validator', 'editable-source/src/envelope/validator.js', 'editable-source/src/envelope/validator.js', 'BYTE_EXACT_REUSE', ['static:E001-E007', 'mutations:SM-01,SM-10,SM-11']],
  ['statement scanner', 'editable-source/src/parser/statementScanner.js', 'editable-source/src/parser/statementScanner.js', 'BYTE_EXACT_REUSE', ['parser:36/36']],
  ['parser acceptance suite', 'editable-source/tests/static-suite.js', 'editable-source/tests/static-suite.js', 'REVIEWED_REUSE', ['static:61/61', 'parser:36/36', 'recovery:10/10']],
  ['deployment manifest schema', 'editable-source/src/manifest/deployment-manifest.schema.json', 'editable-source/src/manifest/deployment-manifest.schema.json', 'BYTE_EXACT_REUSE', ['static:M001-M014']],
  ['manifest validator', 'editable-source/src/manifest/validator.js', 'editable-source/src/manifest/validator.js', 'BYTE_EXACT_REUSE', ['static:M001-M014', 'mutations:SM-12']],
  ['transaction executor', 'editable-source/src/executor/atomic-stage.js', 'editable-source/src/executor/atomic-stage.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025']],
  ['in-transaction verifier', 'editable-source/src/verifiers/in-transaction.js', 'editable-source/src/verifiers/in-transaction.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025']],
  ['post-commit verifier', 'editable-source/src/verifiers/post-commit.js', 'editable-source/src/verifiers/post-commit.js', 'BYTE_EXACT_REUSE', ['atomicity:A001,A002,A009-A011']],
  ['material verifier', 'editable-source/src/verifiers/material.js', 'editable-source/src/verifiers/material.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025', 'mutations:SM-04']],
  ['recovery classifier', 'editable-source/src/recovery/classifier.js', 'editable-source/src/recovery/classifier.js', 'BYTE_EXACT_REUSE', ['recovery:R001-R010', 'mutations:SM-13']],
  ['invariant guard', 'editable-source/src/executor/invariant-guard.js', 'editable-source/src/executor/invariant-guard.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025', 'mutations:SM-02,SM-03,SM-05-SM-09,SM-14']],
  ['PostgreSQL protocol client', 'editable-source/src/db/protocol-client.js', 'editable-source/src/db/protocol-client.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025']],
  ['SCRAM implementation', 'editable-source/src/db/scram.js', 'editable-source/src/db/scram.js', 'BYTE_EXACT_REUSE', ['atomicity:A001-A025']],
  ['release verifier', 'editable-source/src/identity/release.js', 'editable-source/src/identity/release.js', 'MODIFIED_FOR_V2', ['static:F001', 'cleanup:frozen-release-identity']],
  ['semantic mutation suite', 'editable-source/tests/mutation-suite.js', 'editable-source/tests/mutation-suite.js', 'MODIFIED_FOR_V2', ['mutations:SM-01-SM-14', 'path:P001-P004,N001-N012']],
  ['path authority', null, 'editable-source/src/path/authority.js', 'MODIFIED_FOR_V2', ['path:P001-P004,N001-N012']],
  ['mutation workspace allocator', null, 'editable-source/src/path/mutation-workspace.js', 'MODIFIED_FOR_V2', ['path:P001-P004,N011-N012', 'mutations:SM-01-SM-14']],
];

const components = specs.map(([name, v1Relative, v2Relative, action, coveringV2Tests]) => {
  const v1Path = v1Relative ? path.join(v1Release, ...v1Relative.split('/')) : null;
  const v2Path = path.join(toolRoot, ...v2Relative.split('/'));
  if (v1Path && !fs.existsSync(v1Path)) throw new Error(`V1_COMPONENT_MISSING: ${name}`);
  if (!fs.existsSync(v2Path)) throw new Error(`V2_COMPONENT_MISSING: ${name}`);
  const v1Sha256 = v1Path ? sha256File(v1Path) : null;
  const v2Sha256 = sha256File(v2Path);
  if (action === 'BYTE_EXACT_REUSE' && v1Sha256 !== v2Sha256) throw new Error(`BYTE_EXACT_REUSE_MISMATCH: ${name}`);
  return { name, v1Path: v1Relative, v1Sha256, v2Path: v2Relative, v2Sha256, action, coveringV2Tests };
});

const body = {
  schema: 'tairet-executor-v2-reuse-and-change-manifest',
  v1FrozenReleaseSha256: '0bd295e131ecfdd0a2337c1fe7bb9be610dbf64be13ce254b13b46d5e04ec322',
  components,
  v1FinalPassCountersTrustedAsV2Evidence: false,
};
const result = { ...body, manifestSha256: canonicalHash(body) };
fs.writeFileSync(path.join(toolRoot, 'manifests', 'reuse-and-change-manifest.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ componentCount: components.length, byteExactCount: components.filter((row) => row.action === 'BYTE_EXACT_REUSE').length, manifestSha256: result.manifestSha256 })}\n`);
