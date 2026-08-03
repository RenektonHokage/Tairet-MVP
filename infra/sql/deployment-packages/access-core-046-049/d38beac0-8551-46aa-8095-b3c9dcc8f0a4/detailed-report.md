# Access Core 046–049 repository integration report

## Result

`ACCESS_CORE_046_049_REPOSITORY_INTEGRATION_READY_FOR_INDEPENDENT_REVIEW`

The independently approved package V2 was integrated into the authorized
repository path as a byte-exact, read-only 459-file copy. This checkpoint is
local-only: it creates repository capability and does not assert deployment,
activation, maintenance approval, writer quiescence, or production authority.

| Required field | Result |
| --- | --- |
| CLASSIFICATION | `ACCESS_CORE_046_049_REPOSITORY_INTEGRATION_READY_FOR_INDEPENDENT_REVIEW` |
| REPOSITORY | `C:\Importante\Python\tairet-mono-2` |
| STARTING_BRANCH | `main` |
| STARTING_HEAD | `715ad1cea644e45d688dca785de09c83e1956413` |
| PACKAGE_ID | `d38beac0-8551-46aa-8095-b3c9dcc8f0a4` |
| PACKAGE_REPOSITORY_PATH | `infra/sql/deployment-packages/access-core-046-049/d38beac0-8551-46aa-8095-b3c9dcc8f0a4/package` |
| AUTHORIZED_INPUT_INTEGRITY | `153/153 BYTE_EQUAL` |
| ACCESS_CORE_PACKAGE_REPOSITORY_INTEGRATION_INPUT_REVIEW_SHA256 | `8c24a14b4695f7bf55afc0658b2f43a42974c0db83e115dfa6c322534a1e1996` |
| ACCESS_CORE_PACKAGE_REPOSITORY_COPY_MANIFEST_SHA256 | `556effa96ba476b7b861a84abc8f6d12f6458453f47ea090051617e299edfeb6` |
| ACCESS_CORE_PACKAGE_REPOSITORY_INTEGRATION_MANIFEST_SHA256 | `4d989ef706e969847742ad55ebf1cd7a3a01ab38af4d831592071e66b609d17c` |
| ACCESS_CORE_PACKAGE_REPOSITORY_INTEGRATION_VALIDATION_SHA256 | `7649c2fb86cd3274ef064bc1526372311028439ac1ff6b53ee290f58b769d4ee` |
| SOURCE_FROZEN_PACKAGE_IDENTITY | `e76459033e407774cd7649da189235d94c786eadaf2ca07cf7a94ccd4e718398` |
| REPOSITORY_COPY_FROZEN_PACKAGE_IDENTITY | `e76459033e407774cd7649da189235d94c786eadaf2ca07cf7a94ccd4e718398` |
| COPIED_FILE_COUNT | `459` |
| MISSING_FILE_COUNT | `0` |
| UNEXPECTED_FILE_COUNT | `0` |
| COPY_HASH_MISMATCH_COUNT | `0` |
| VERSION_046 | `20260802015354` |
| VERSION_047 | `20260802015355` |
| VERSION_048 | `20260802015356` |
| VERSION_049 | `20260802015357` |
| OPERATIONAL_ELIGIBILITY | `PENDING_FINAL_PRODUCTION_LEDGER_GUARD` |
| MIGRATION_FILE_CHANGE_COUNT | `0` |
| APPLICATION_CODE_CHANGE_COUNT | `0` |
| CONFIGURATION_CHANGE_COUNT | `0` |
| UNRELATED_REPOSITORY_CHANGE_COUNT | `0` |
| GIT_STAGE_CHANGE_COUNT | `0` |
| GIT_COMMIT_COUNT | `0` |
| GIT_PUSH_COUNT | `0` |
| GIT_IGNORED_REQUIRED_PACKAGE_FILE_COUNT | `27` |
| SQL_EXECUTION_COUNT | `0` |
| DOCKER_COMMAND_COUNT | `0` |
| PRODUCTION_CONTACT | `0` |
| FINDINGS | `[]` |
| RESIDUAL_RISK | Production state, final ledger/PRE_046 guard, maintenance, writer quiescence, Railway proof, Git inclusion proof, and independent repository review remain pending. |
| NEXT_RECOMMENDED_ACTION | `NEW INDEPENDENT READ-ONLY REVIEW of the repository integration.` |

## Verified authorities

Before the first repository write, the following were verified:

- repository root, `main`, starting HEAD, empty tracked diff and empty staging;
- the complete 735-file tracked inventory and the two pre-existing untracked
  files, preserved in `repository-integration-input-review.json`;
- all four canonical migration sizes and SHA-256 identities;
- package classification, ID, packaging event and four assigned versions;
- deployment-manifest canonical identity
  `eb07ac82de3f024bcc65281cd8e7d171b544980d29da5584d04e7adc79b0f7b3`;
- frozen-package canonical identity
  `e76459033e407774cd7649da189235d94c786eadaf2ca07cf7a94ccd4e718398`;
- all 459 frozen-manifest entries and all 16 package artifact-manifest entries;
- all 153 input records, including 143 runtime-required records;
- contract tests 15/15, development rehearsal 19/19, final rehearsal 12/12,
  final execution count 1, rerun count 0, and runtime verifier count 35;
- independent review classification
  `INDEPENDENT_ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2_PASSED`, its four
  required raw hashes, canonical body seal, and zero High/Medium/Low findings.

The complete source-package inventory remained 945 files with identity
`fa669713c8522dc131bf22bcf91ed41145a1c907d8be9457611a643c19767527`.
The complete four-file review inventory remained
`8684d6bd4471cbffbf81665abf4b23537d249b2622ce937964289ecb9701d23f`.

## Byte-exact repository copy

The source selected from the approved freeze manifest was exactly
`frozen-package\package`. No sibling mutable source, cache, temporary directory,
Docker log, failed-package tree, or post-freeze evidence directory was copied.
The selected root itself explicitly enumerates its 15 frozen surfaces,
including the evidence surfaces that are members of the approved 459-file
identity.

The repository copy independently reproduced frozen tree identity
`a8f97119afcf3f7c28c2a21debb505edc12b36e963ae737461428197faada61d`.
Every manifest entry has the same relative path, size, SHA-256 and bytes at the
destination. Missing files, unexpected files, hash mismatches and byte
inequalities are all zero. All 459 files are marked read-only on this
filesystem.

One preliminary copy-manifest sealing attempt stopped before writing that
manifest because a locally sorted inventory did not preserve the original
manifest entry order. The package copy was not modified. The successful,
single written copy manifest uses the original frozen-manifest order and
reproduces both the tree identity and approved frozen-package identity.

## Repository scope and immutability

Only the authorized package integration directory was added. The pre-existing
`.sigsegv-forensics/` and `tmp-bancard/` files retained their original sizes and
SHA-256 identities. Migrations 046–049, all tracked application code, and all
tracked configuration remained unchanged. Staging remained empty and HEAD did
not move.

The source package and external review remained unchanged. Package versions
were not changed. Failed versions `20260801235130` through `20260801235133`
were not reused. The authoritative deployment manifest was not edited.
Migrations 046–049 remained byte-exact. No file was staged, committed, or
pushed.

The unchanged repository rule `.gitignore:11:dist/` filters 27 required files
under the frozen executor's vendored `dist` directory from ordinary Git
untracked discovery. All 27 remain physically present, read-only, and covered
by the 459-file byte validation. No ignore configuration was changed in this
checkpoint. A future authorized staging or commit checkpoint must prove that
all 459 frozen files are included; ordinary `git add` visibility alone is not
sufficient.

No package executor, SQL, Docker, Supabase, Railway, Vercel, network, or
production action occurred. There was no package installation, branch change,
stash, environment change, subagent, or use of `C:\tmp`.

## Residual risk

- Production state is `UNKNOWN`.
- The final production ledger, assigned-version collision, unexpected-later-
  migration, predecessor-statement and exact `PRE_046` structural guards remain
  mandatory.
- Maintenance approval and continuous writer quiescence remain pending.
- Railway pause/resume capability and proof remain a separate checkpoint.
- The existing `dist/` ignore rule hides 27 required frozen files from ordinary
  Git discovery; their inclusion must be proven before any future commit.
- Editing, reformatting, rebuilding or renumbering the package invalidates it
  and requires a new package identity.
- This repository integration still requires an independent read-only review
  before any commit decision.

## Next recommended action

`NEW INDEPENDENT READ-ONLY REVIEW of the repository integration.`

Do not commit, push, resolve Railway scaling, approve maintenance, or execute
the package in the same authorization.
