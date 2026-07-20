# Access Core — Test and Review Matrix

## Policy

Focused validation runs while implementing. The complete applicable suite runs once for every exact changeset version submitted to review. A changed base, path, mode, or byte creates a new changeset version.

The entries below distinguish tools and tests that exist now from tooling planned for CONTEXT HARNESS V1B.

## AVAILABLE NOW

### Repository and scope gates

| Gate | Available evidence | Use |
| --- | --- | --- |
| Repository identity | `git rev-parse`, branch/ref inspection | Before every ASK/CODE that depends on a base |
| Tracked/staged state | `git status --porcelain`, `git diff --cached` | Before editing and before review |
| Exact changed paths | `git diff --name-only` plus untracked intended paths | Confirm current prompt scope |
| Patch whitespace | `git diff --check` | Every changeset |
| Closed migration bytes | SHA-256 and Git blob comparison | Before migration-dependent work |
| Documentation links | Relative Markdown target existence scan | Documentation changesets |
| Secrets/local paths | Focused content scan | Documentation and code changesets |

These are manual/review commands today; no tracked harness script is implied.

### Focused durable-fulfillment tests

| Contract | Existing test surface |
| --- | --- |
| Configuration modes and mutual exclusion | `functions/api/src/config/accessFulfillment.test.ts` |
| Abort/deadline semantics | `functions/api/src/services/abortDeadline.test.ts` |
| RPC schemas and sanitized transport | `functions/api/src/services/accessFulfillment.test.ts` |
| Deterministic canonical message/hash | `functions/api/src/services/accessEmailMessage.test.ts` |
| Canonical data validation/loading | `functions/api/src/services/accessEmailMessageData.test.ts` |
| Read-only Supabase adapter | `functions/api/src/services/accessEmailMessageDataSupabase.test.ts` |
| Provider-neutral outcomes | `functions/api/src/services/accessEmailProvider.test.ts` |
| Resend adapter classification/deadlines | `functions/api/src/services/accessEmailProviderResend.test.ts` |
| Issuance/reconcile regression; durable-OFF defer; capability validation; loader/builder orchestration; terminal preclaim; correlated delivery claim; provider outcomes; bounded settlement; deadline, shutdown, and fatal races; accounting; safe logging | `functions/api/src/workers/accessFulfillmentWorker.test.ts` |

Run only the focused files relevant to the implementation while iterating.

### Complete package gates

Available package-level gates include:

- `pnpm -C functions/api test`
- `pnpm -C functions/api typecheck`
- `pnpm -C functions/api build`

The global `functions/api` lint gate is currently blocked before analysis by pre-existing infrastructure. Recent slices used a temporary, reproducible directed lint invocation for their changed TypeScript files; that invocation is changeset-specific review evidence, not permanent available tooling.

Use the complete applicable suite once per changeset version. Documentation-only work does not require API tests, build, typecheck, or SQL execution unless its explicit prompt says otherwise.

### Runtime and migration evidence

Runtime checks and migration-ledger inspection are available only when the task explicitly authorizes and provides access to the relevant environment. Results must be labeled `VERIFIED_RUNTIME`. Repository migrations and tests alone remain `VERIFIED_REPOSITORY`.

## PLANNED FOR V1B

The following are requirements or proposals, not currently implemented tracked tooling:

| Planned capability | Intended result |
| --- | --- |
| Cross-platform `PRE_REVIEW_CHANGESET_SHA256` tool | Canonical base/path/mode/content manifest and reproducible digest |
| Closed-migration manifest verifier | Detect byte drift for migrations declared immutable |
| Documentation link and classification validator | Detect broken relative links and missing canonical banners |
| Documentation currentness/structure CI | Enforce required files and bounded instruction size |
| Local PostgreSQL migration automation | Apply migrations and run structural/security assertions without production |
| CI integration for the above | Reproduce review gates on the exact candidate changeset |

V1B design must define cross-platform path encoding, byte handling, file modes, new/deleted files, line-ending behavior, and base identity before tooling is treated as authoritative.

## Temporary V1A review identity

For V1A, calculate `PRE_REVIEW_CHANGESET_SHA256` outside tracked tooling from a canonical manifest containing:

1. a version marker;
2. the base commit;
3. each authorized path in ordinal sorted order;
4. its Git-style mode;
5. the lowercase SHA-256 of its exact bytes.

Serialize the manifest as UTF-8 with LF line endings and a final LF. Report both the serialization and resulting digest. This temporary convention is review evidence, not the completed V1B implementation.

## Review reuse

- Same base and same manifest digest: existing semantic review and applicable gates may be reused.
- Different base, path, mode, or content hash: new changeset identity; rerun applicable gates.
- Push is mechanical only after confirming the reviewed identity and remote base remain unchanged; an unchanged identity does not require a full semantic re-review merely to push.
