# Access Core 046–049 deployment package V2 — repository integration

This directory is a local repository integration of approved package
`d38beac0-8551-46aa-8095-b3c9dcc8f0a4`. It establishes repository capability
only. It does not establish production deployment, activation, maintenance
approval, writer quiescence, or authority to execute the package.

## Frozen package

- Repository path: `infra/sql/deployment-packages/access-core-046-049/d38beac0-8551-46aa-8095-b3c9dcc8f0a4/package`
- Frozen package identity: `e76459033e407774cd7649da189235d94c786eadaf2ca07cf7a94ccd4e718398`
- Frozen tree identity: `a8f97119afcf3f7c28c2a21debb505edc12b36e963ae737461428197faada61d`
- Deployment-manifest identity: `eb07ac82de3f024bcc65281cd8e7d171b544980d29da5584d04e7adc79b0f7b3`
- Executor V3 frozen-release identity: `700cb1c385bcdb1c64d4d4a69fec585af4b769090aa72de2c1059da8d8e01da1`
- Packaging event: `2026-08-02T01:53:54Z`

The `package` directory contains the exact 459-file root enumerated by the
approved frozen-package manifest. Every copied path, size, SHA-256 and byte
comparison is recorded in `repository-copy-manifest.json`. Files in the copied
package are marked read-only where supported by this filesystem.

Do not edit, reformat, rebuild, renumber, or partially replace this package. An
invalidating change requires a new package identity. The authoritative
deployment manifest inside `package` must remain byte-exact.

## Assigned migrations

| Logical migration | Version | Name | Canonical SHA-256 |
| --- | --- | --- | --- |
| 046 | `20260802015354` | `access_core_recoverable_fulfillment` | `6f1b39fc66b53856e19475b20539de1377f20e29fe6ad99a79472c97dba2fe0c` |
| 047 | `20260802015355` | `access_email_preclaim_terminal_failure` | `6bebbe803cc5c85094352bbcbc261df5ce26780fb1ae38d956089f48b67f20b4` |
| 048 | `20260802015356` | `access_email_preclaim_terminal_after_ambiguous` | `249a75c0da2f80a66e0d0717a88d8c4710cf51f210098078a375692fd4567532` |
| 049 | `20260802015357` | `access_email_delivery_claim_correlation` | `cc3b71a988fafa3298344ec73731abc0ce8219c1dc35110e59916e5344f6d234` |

The repository migrations and their package copies were verified byte-exact.
Their presence does not mean that they have been applied.

The failed-package versions `20260801235130`, `20260801235131`,
`20260801235132`, and `20260801235133` remain permanently reserved and must
never be reused.

## Independent approval

The external package review is classified
`INDEPENDENT_ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2_PASSED`, with zero High,
Medium, or Low findings. Its verified artifact hashes are bound in
`integration-manifest.json`; the review itself was not inserted into or used to
modify the frozen package.

## Invalidation conditions

The package is invalidated by any of the following:

- input manifest schema or parser change;
- canonical migration identity change;
- intermediate payload identity change;
- executor frozen identity change;
- verifier identity change;
- deployment manifest change;
- version/name pair change;
- stage order change;
- target identity change;
- predecessor ledger mismatch;
- assigned version collision;
- unexpected later Access Core migration;
- production structural state not exact `PRE_046`.

If any condition occurs: `DO_NOT_EDIT_OR_RENUMBER; CREATE_A_NEW_PACKAGE_IDENTITY`.

## Remaining operational gates

Operational eligibility remains `PENDING_FINAL_PRODUCTION_LEDGER_GUARD`.
Production state is `UNKNOWN`. Before any execution, a separately authorized
checkpoint must establish the exact production ledger and predecessor
`20260711062758 / 045_access_core_paid_checkin_operational_window`, absence of
the four assigned versions, absence of an unexpected later Access Core
migration, exact `PRE_046` structure, the approved final quiesced preflight,
maintenance approval, and continuous writer quiescence.

Railway pause/resume capability and proof remain a separate checkpoint. This
integration contains no guessed Railway commands. Required proof is limited to
the writer pause before the final guard and execution, continued quiescence
through the window, separately authorized resume after final verification or
approved recovery, and the resulting writer state.

Package execution remains unauthorized. No SQL, Docker, Supabase, Railway,
Vercel, network, or production action is part of this integration.

## Integration evidence

- `repository-integration-input-review.json` preserves the pre-write repository
  inventory and all input authorities.
- `repository-copy-manifest.json` records all 459 byte comparisons.
- `integration-manifest.json` is the external integration record. It is not the
  authoritative deployment manifest.
- `repository-integration-validation.json` records local static validation.
- `structured-result.json`, `detailed-report.md`, and
  `artifact-hash-manifest.json` report this local integration checkpoint.

The next allowed action is a new independent read-only review of this
repository integration. Do not combine that review with commit, push, Railway
scaling, maintenance approval, or package execution.
