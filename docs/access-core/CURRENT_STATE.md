# Access Core — Current State

## Reading rule

This document records a stable evidence cut, not a permanent assertion about the current checkout. Always verify the actual repository root, branch, `HEAD`, worktree, and staging with Git before acting.

Evidence labels:

- `VERIFIED_REPOSITORY`: directly established from repository content or local Git objects.
- `VERIFIED_RUNTIME`: directly established from runtime or migration-ledger evidence.
- `REPORTED`: supplied by the current human operational context.
- `UNKNOWN`: not independently established.

## Stable documentation cut

| Field | Value | Evidence |
| --- | --- | --- |
| `documentation_baseline` | `CONTEXT_HARNESS_V1A` | `VERIFIED_REPOSITORY` after this documentation changeset is accepted |
| `state_as_of_product_commit` | `775de00486a6032e7ec94558ec0d0d6492647699` | `VERIFIED_REPOSITORY` |
| `last_closed_product_slice` | `9E.5B3B4R` | `VERIFIED_REPOSITORY` |
| `next_eligible_product_slice` | `9E.5B3B4A` | `VERIFIED_REPOSITORY` |
| `next_product_slice_authorized` | `false` | `REPORTED` |
| `actual_checkout_head` | `VERIFY_WITH_GIT` | `VERIFIED_REPOSITORY`; deliberately not stored as a checkout assertion |

Eligibility is sequencing information, not authorization.

## Repository state

| Assertion | State | Evidence |
| --- | --- | --- |
| The durable fulfillment persistence and RPC capability defined by migration 046 is present in the repository cut | Present | `VERIFIED_REPOSITORY` |
| Migration 046 SHA-256 is `6f1b39fc66b53856e19475b20539de1377f20e29fe6ad99a79472c97dba2fe0c` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| The terminal pre-claim fence defined by migration 047 is present in the repository cut | Present | `VERIFIED_REPOSITORY` |
| Migration 047 SHA-256 is `6bebbe803cc5c85094352bbcbc261df5ce26780fb1ae38d956089f48b67f20b4` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| Migration 048 is present and replaces only the existing terminal pre-claim RPC implementation | Present | `VERIFIED_REPOSITORY` |
| Migration 048 SHA-256 is `249a75c0da2f80a66e0d0717a88d8c4710cf51f210098078a375692fd4567532` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| The replacement allows terminal recording to coexist with exactly one preserved current-generation historical `ambiguous` attempt when email state is `failed` | Present | `VERIFIED_REPOSITORY` |
| Slice `9E.5B3B4Q` changes no TypeScript client contract | Unchanged | `VERIFIED_REPOSITORY` |
| Migration 049 is present and replaces only `claim_access_email_delivery` | Present | `VERIFIED_REPOSITORY` |
| Migration 049 SHA-256 is `cc3b71a988fafa3298344ec73731abc0ce8219c1dc35110e59916e5344f6d234` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| Migration 049 preserves the claim RPC's seven-argument signature, provider default, `jsonb` result, owner, security-definer search path, OID, and closed EXECUTE ACL | Preserved | `VERIFIED_REPOSITORY` |
| Every fresh, replayed, or reclaimed `processing` response adds exactly `entry_count`, `request_payload_hash`, and `idempotency_remaining_ms` | Present | `VERIFIED_REPOSITORY` |
| The claim parser accepts the complete legacy `processing` form and the strict correlated form; partial correlated forms are rejected | Present | `VERIFIED_REPOSITORY` |
| A null or omitted claim-error `delivery_attempt_id` is normalized to property absence; a valid UUID is preserved | Present | `VERIFIED_REPOSITORY` |
| Product commit `775de00486a6032e7ec94558ec0d0d6492647699` changes no worker or `WorkerMain` file | Unchanged | `VERIFIED_REPOSITORY` |
| The durable-email hard gate in `WorkerMain` remains intact | Present | `VERIFIED_REPOSITORY` |
| Worker, deterministic message, canonical loader, provider contract, and Resend adapter capabilities are present | Present | `VERIFIED_REPOSITORY` |

Repository presence proves capability only. It does not prove deployment, activation, or authority.

## Local isolated validation

| Surface | Result | Evidence |
| --- | --- | --- |
| Isolated PostgreSQL/Supabase 17.6 with `network=none` | Migrations 046 through 049 applied; 48 SQL cases/results, two concurrent races across four sessions, and zero deadlocks | `VERIFIED_RUNTIME` in an isolated local runtime; not production |
| Claim parser targeted validation | 29 of 29 tests passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| Complete API validation | 158 of 158 tests passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| TypeScript gates | Typecheck and build passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| Directed lint | Passed for the two changed TypeScript files | `VERIFIED_REPOSITORY` for the exact product changeset |
| Global API lint | Blocked before analysis by pre-existing lint infrastructure | `VERIFIED_REPOSITORY`; not a product regression |

The isolated runtime evidence is not production evidence. It does not verify a remote migration ledger, deployment, activation, or operational authority.

## Production and deployment state

| Surface | State | Evidence |
| --- | --- | --- |
| Migration 047 remote application | Reported not applied | `REPORTED` |
| Migration 048 remote application | Reported not applied during this closure | `REPORTED` |
| Migration 049 remote application | Reported not applied during this closure | `REPORTED` |
| Current independent remote migration-ledger state for migrations 047 through 049 | Not verified | `UNKNOWN` |
| Migration 046 remote application | Not established by this documentation cut | `UNKNOWN` |
| Durable worker process deployed | Not independently established | `UNKNOWN` |
| Durable email composition deployed | Not independently established | `UNKNOWN` |

No production state is inferred from the push of `775de00486a6032e7ec94558ec0d0d6492647699`. Reported non-application or unknown independent ledger state for migrations 047 through 049 does **not** block a future, separately authorized local and reversible ASK/CODE for `9E.5B3B4A`; verified target state is a gate for deployment, activation, or rollout that depends on those contracts.

## Activation state

| Capability | Activation | Evidence |
| --- | --- | --- |
| Access fulfillment worker | OFF | `REPORTED` |
| Durable email delivery | OFF | `REPORTED` |
| Legacy direct email | ON in the reported operating mode | `REPORTED` |
| Durable email path in `WorkerMain` | Not composed; enabling it reaches an explicit capability gate | `VERIFIED_REPOSITORY` |

Repository defaults are worker OFF, durable email OFF, and legacy direct email ON (`VERIFIED_REPOSITORY`). They support but do not independently verify the reported runtime activation state. The `WorkerMain` hard gate remains intact (`VERIFIED_REPOSITORY`).

## Operational authority

| Responsibility | Current authority | Evidence |
| --- | --- | --- |
| Access Core post-confirm email delivery | Legacy direct email path | `REPORTED` |
| Durable email delivery | No authority | `REPORTED` |
| Worker reconciliation | No active production authority established | `REPORTED` |
| Payment approval | Existing payment confirmation contract; unchanged by this slice | `VERIFIED_REPOSITORY` |

Slice `9E.5B3B4R` transfers no authority (`REPORTED`). Authority changes require a separately authorized cutover; capability, deployment, or a feature flag alone does not transfer authority.

## Authorization state

| Work | Authorization | Evidence |
| --- | --- | --- |
| `9E.5B3B4Q` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4R` | `CLOSED` | `VERIFIED_REPOSITORY` |
| Start or implement `9E.5B3B4A` | Eligible, but not authorized and not started | `REPORTED` |
| Apply migrations 047 through 049 remotely | Not authorized | `REPORTED` |
| Enable worker or durable email | Not authorized | `REPORTED` |
| Disable legacy direct email or transfer authority | Not authorized | `REPORTED` |
| Deploy, cut over, or roll out | Not authorized | `REPORTED` |

After this documentation changeset is closed, a new human instruction is required for product work. Production uncertainty stops only work that must assert or modify production; it does not automatically block authorized local, reversible work.

## Update triggers

Update this file when a product slice closes, a migration ledger is verified, deployment or activation changes, operational authority changes, or new work is authorized. Do not update it merely because a local documentation commit changes `HEAD`.
