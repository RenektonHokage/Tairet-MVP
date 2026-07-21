# Access Core — Test and Review Matrix

## Policy

Focused validation runs while implementing. The complete applicable suite runs once for every exact changeset version submitted to review. A changed base, path, mode, or byte creates a new changeset version.

The entries below distinguish tools and tests that exist now from tooling planned for CONTEXT HARNESS V1B.

## FAST_SAFE_V1 workflow and evidence reuse

### Risk table

| Risk | Typical surfaces | Default flow |
| --- | --- | --- |
| HIGH | SQL, payments, idempotency, authority, concurrency, callbacks, providers, production/deploy/cutover | ASK only if decisions are open → CODE+gates → independent review+commit → mechanical push → docs closure |
| MEDIUM | WorkerMain wiring, dependency composition, startup/config gates, bounded runtime refactors, agent-process governance | Focused read → CODE+gates → independent review when sensitive → mechanical push → compact docs closure |
| LOW | Non-authoritative docs, isolated lint/tests, messages, internal scripts, reviewed immutable pushes | Implement+validate+review+commit → separate mechanical push |

Risk follows the affected surface, not the edited file type. A test, document, script, or configuration that affects a HIGH surface is HIGH.

### ASK policy

- Use ASK only when safe implementation requires an unresolved technical decision.
- When code, tests, and canonical documentation already close the contract, begin with focused reading and CODE.
- A focused read may stop with `TECHNICAL_DECISION_REQUIRED` without modifying files.

### Independent review

- HIGH requires independent review.
- MEDIUM requires independent review when it involves concurrency, authority, security, a remote effect, or another sensitive boundary.
- LOW does not automatically require a second independent review.
- No risk level permits skipping applicable technical gates.

### LOW documentation

- LOW documentation may be implemented, validated, reviewed, selectively staged, and committed in one turn.
- The push remains separate.
- Documentation that changes a decision or authoritative contract is not LOW.

### Small findings

- Fix an isolated finding in one bounded turn.
- Repeat only the affected gates and recalculate the changeset identity.
- Do not generate a new ASK unless a real decision emerges.

### Compact reports

The default report uses:

`CLASSIFICATION`, `FILES`, `CHANGES`, `GATES`, `FINDINGS`, `IDENTITY`, `GIT_STATE`, `RESIDUAL_RISK`, and `NEXT_AUTHORIZED_ACTION`.

Reserve longer explanations for findings, new decisions, scope expansion, material residual risks, and sensitive remote actions.

### Evidence reuse

When base, paths, modes, and bytes are identical, reuse deterministic tests, build, typecheck, lint, and semantic review. Repeat only identity, scope, diff-check, and the applicable mechanical gate.

When any base, path, mode, or byte changes, create a new changeset identity and repeat the affected gates; evidence from the prior candidate is not assumed to remain closed.

### Risk escalation and volatile evidence

- Classification depends on the affected surface, not only on file extension or location. A test, document, script, or configuration that changes a HIGH surface is HIGH.
- LOW covers only tasks with no effect on product behavior, authoritative contracts, runtime, deployment, activation, or authority.
- Byte-exact identity permits reuse only of deterministic candidate evidence.
- Remote refs, runtime, migration ledger, deployment, production, and external availability are volatile evidence and must be reverified whenever they condition the task, even when the candidate remains byte-identical.

### Mechanical push

A mechanical push contains only:

- repository and branch;
- commit and expected parent;
- expected paths or tree;
- clean worktree and staging;
- fetch;
- `origin/main` exactly at the parent;
- fast-forward check;
- push without force;
- post-push verification;
- contextual stops.

It does not repeat architecture, complete test matrices, closed decisions, semantic review, or slice history.

A push is mechanical only when the commit is reviewed and immutable, worktree and staging are clean, fetch confirms `origin/main` exactly at the expected parent, and the fast-forward check passes.

### Controls preserved

FAST_SAFE_V1 does not remove exact scope, selective staging, applicable tests, typecheck, build, lint, diff-check, evidence-binding manifests, risk-sensitive independent review, fast-forward-only pushes, fail-closed stops, separation of capability/deployment/activation/authority, or human authorization for production and cutover.

### CONTEXT HARNESS V1B

- CONTEXT HARNESS V1B remains **PLANNED**; this changeset implements no V1B tooling.
- `PRE_REVIEW_CHANGESET_SHA256` remains a temporary V1A convention.
- No scripts, CI, or automation are added, and planned tooling is not presented as available.
- The V1B capabilities listed below remain intact.

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
| `WorkerMain` invalid config; OFF/dry-run side-effect boundaries; reconcile-only; lazy Supabase/email-runtime loading; shared-client ownership; capability wiring; provider creation without startup send; startup failures; signal cleanup; safe logging | `functions/api/src/workers/accessFulfillmentWorker.test.ts` |
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
