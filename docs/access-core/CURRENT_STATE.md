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
| `state_as_of_product_commit` | `f0f04f49d138dc56d368dc6bf338ff4e45932c2f` | `VERIFIED_REPOSITORY` |
| `last_closed_product_slice` | `9E.5B3B4P` | `REPORTED`, correlated with repository commit history |
| `next_eligible_product_slice` | `9E.5B3B4A` | `REPORTED` |
| `next_product_slice_authorized` | `false` | `REPORTED` by the instruction that created this baseline |
| `actual_checkout_head` | `VERIFY_WITH_GIT` | Deliberately not stored as stable truth |

Eligibility is sequencing information, not authorization.

## Repository state

| Assertion | State | Evidence |
| --- | --- | --- |
| The durable fulfillment persistence and RPC capability defined by migration 046 is present in the repository cut | Present | `VERIFIED_REPOSITORY` |
| Migration 046 SHA-256 is `6f1b39fc66b53856e19475b20539de1377f20e29fe6ad99a79472c97dba2fe0c` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| The terminal pre-claim fence defined by migration 047 is present in the repository cut | Present | `VERIFIED_REPOSITORY` |
| Migration 047 SHA-256 is `6bebbe803cc5c85094352bbcbc261df5ce26780fb1ae38d956089f48b67f20b4` | Intact at the documented cut | `VERIFIED_REPOSITORY` |
| Worker, deterministic message, canonical loader, provider contract, and Resend adapter capabilities are present | Present | `VERIFIED_REPOSITORY` |

Repository presence proves capability only. It does not prove deployment, activation, or authority.

## Production and deployment state

| Surface | State | Evidence |
| --- | --- | --- |
| Migration 047 remote application | Reported not applied | `REPORTED` |
| Migration 047 independent runtime/ledger verification | Not performed in this cut | `UNKNOWN` |
| Migration 046 remote application | Not established by this documentation cut | `UNKNOWN` |
| Durable worker process deployed | Not independently established | `UNKNOWN` |
| Durable email composition deployed | Not independently established | `UNKNOWN` |
| Production modified by CONTEXT HARNESS V1A | No remote or production action is authorized by this baseline | Authorization fact; runtime state remains `UNKNOWN` unless verified |

Migration 047 being unapplied remotely does **not** block authorized local and reversible ASK/CODE for `9E.5B3B4A`. It blocks only activation, deployment, or rollout that depends on its remote schema/RPC state.

## Activation state

| Capability | Activation | Evidence |
| --- | --- | --- |
| Access fulfillment worker | OFF | `REPORTED`; repository defaults are also disabled (`VERIFIED_REPOSITORY`) |
| Durable email delivery | OFF | `REPORTED`; repository defaults are also disabled (`VERIFIED_REPOSITORY`) |
| Legacy direct email | ON in the reported operating mode | `REPORTED`; repository default is enabled (`VERIFIED_REPOSITORY`) |
| Durable email path in `WorkerMain` | Not composed; enabling it reaches an explicit capability gate | `VERIFIED_REPOSITORY` |

Repository defaults support the report but are not runtime verification.

## Operational authority

| Responsibility | Current authority | Evidence |
| --- | --- | --- |
| Access Core post-confirm email delivery | Legacy direct email path | `REPORTED`; direct callback invocation exists in repository (`VERIFIED_REPOSITORY`) |
| Durable email delivery | Not authority | `REPORTED` and consistent with repository gates |
| Worker reconciliation | No active production authority established | `REPORTED` OFF; independent runtime status `UNKNOWN` |
| Payment approval | Existing payment confirmation contract; unchanged by this baseline | `VERIFIED_REPOSITORY` for implementation, runtime authority `UNKNOWN` |

Authority changes require a separately authorized cutover. Capability, deployment, or a feature flag alone does not transfer authority.

## Authorization state

| Work | Authorization |
| --- | --- |
| CONTEXT HARNESS V1A documentation changeset | Authorized only within its explicit 21-path scope |
| Start or implement `9E.5B3B4A` | Not authorized by this baseline |
| Apply migration 047 remotely | Not authorized |
| Enable worker or durable email | Not authorized |
| Disable legacy direct email or transfer authority | Not authorized |
| Deploy, cut over, or roll out | Not authorized |

After this documentation changeset is closed, a new human instruction is required for product work. Production uncertainty stops only work that must assert or modify production; it does not automatically block authorized local, reversible work.

## Update triggers

Update this file when a product slice closes, a migration ledger is verified, deployment or activation changes, operational authority changes, or new work is authorized. Do not update it merely because a local documentation commit changes `HEAD`.
