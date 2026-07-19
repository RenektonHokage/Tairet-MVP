# Access Core — Roadmap and Authorization Gates

## Purpose

This file records sequence and gates. It does not authorize work by itself and does not duplicate implementation plans.

## Closed durable-fulfillment sequence

| Slice | State | Closure |
| --- | --- | --- |
| `9E.5B2H` | `CLOSED` | Reconcile-only worker deadlines and lease-safety hardening |
| `9E.5B3B1` | `CLOSED` | Deterministic canonical email message and payload hash |
| `9E.5B3B2` | `CLOSED` | Canonical read-only message data loader |
| `9E.5B3B3` | `CLOSED` | Provider-neutral contract and durable Resend adapter |
| `9E.5B3B4P` | `CLOSED` | Terminal pre-claim persistence fence and RPC contract |
| `9E.5B3B4Q` | `CLOSED` | Terminal preclaim after preserved ambiguous attempt |
| `9E.5B3B4R` | `CLOSED` | Delivery-claim correlation response and compatible parser |

The `9E.5B*` identifiers are internal sub-slices. They do not renumber or replace the public `B6` cutover and `B7` rollout stages below.

The latest closed checkpoint is [`9E.5B3B4R`](exec-plans/completed/9E.5B3B4R.md). Migration 049 is a function-only replacement of the delivery-claim RPC with the same signature, provider default, security boundary, and ACL. Its fresh, replay, and reclaim `processing` responses add `entry_count`, `request_payload_hash`, and PostgreSQL-authoritative `idempotency_remaining_ms`; the compatible parser accepts complete legacy and strict correlated forms and normalizes a null or omitted drift attempt ID to absence.

## Closed correlation prerequisite

`9E.5B3B4R` is `CLOSED` (`VERIFIED_REPOSITORY`). It closes the correlation prerequisite for the future worker state machine without modifying worker code or `WorkerMain`, applying a migration remotely, deploying or activating durable email, or transferring operational authority.

PostgreSQL remains the authority for the returned remaining duration. A future Node worker must discount that duration only with monotonic elapsed time; the fixed 1000 ms stage margin is not clock-skew allowance. These rules are closed invariants, while their worker implementation remains outside R.

## Next worker state-machine slice

`9E.5B3B4A` is `NEXT ELIGIBLE`, `NOT STARTED`, and `NOT AUTHORIZED` (`REPORTED`). R does not authorize it.

After R's documentation closure, a brief delta ASK must reconfirm the two-file scope—`functions/api/src/workers/accessFulfillmentWorker.ts` and `functions/api/src/workers/accessFulfillmentWorker.test.ts`—before any separate human authorization for B3B4A CODE. Its exact Goal, Read, Constraints, and Done when remain subject to that discovery and instruction.

Remote application of migrations 047–049 is not a prerequisite for separately authorized local, reversible ASK/CODE in `9E.5B3B4A`. It becomes a gate only for deployment, activation, or rollout that depends on their remote schema/RPC state.

## Gates after local composition

Intermediate product slices must be named and authorized explicitly; this document does not infer missing slice definitions.

Before any authority transfer, evidence must establish at least:

- exact local contract and complete applicable test suite;
- migration compatibility for the target environment;
- no double-send authority between legacy and durable paths;
- deterministic idempotency and ambiguous-outcome behavior;
- observability and rollback/stop conditions;
- current production and migration-ledger state when the action depends on production.

## B6 — Cutover

`B6` is the authority-cutover stage. It is **blocked and unauthorized** until a dedicated plan closes all cutover gates.

Required categories:

- `VERIFIED_RUNTIME` migration and deployment prerequisites for the target environment;
- explicit old-authority/new-authority mapping;
- mutually exclusive flag configuration;
- controlled stop, rollback, and manual-review behavior;
- complete validation bound to the exact changeset and deployment candidate;
- explicit human authorization for authority transfer.

Cutover must not be inferred from a successful deploy or enabled capability.

## B7 — Rollout

`B7` is the production rollout stage. It is **blocked and unauthorized** until B6 is closed and a separate rollout plan is approved.

Required categories:

- verified production baseline and migration ledger;
- rollout cohort/rate and observation window;
- measurable success, pause, and rollback criteria;
- operator ownership and incident path;
- confirmation that legacy authority is retained or retired exactly as the B6 decision requires.

## Authorization ledger

| Work | State | Evidence |
| --- | --- | --- |
| `9E.5B3B4Q` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4R` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4A` | `NEXT ELIGIBLE`; `NOT STARTED`; `NOT AUTHORIZED` | `REPORTED` |
| Remote application of migrations 047–049 | Not authorized | `REPORTED` |
| Worker/durable-email activation | Not authorized | `REPORTED` |
| `B6` cutover | Blocked and not authorized | `REPORTED` |
| `B7` rollout | Blocked and not authorized | `REPORTED` |

No product CODE is authorized by this closure. This file grants no remote action, deployment, activation, authority transfer, cutover, or rollout, and R leaves the `B6` and `B7` states and gates unchanged.

## Contextual stops

- `SCOPE_EXPANSION_REQUIRED`: an outcome needs a wider surface than the active instruction.
- `REPOSITORY_STATE_MISMATCH`: local base or protected artifacts do not match the plan.
- `REMOTE_ADVANCED`: remote-sensitive work no longer matches the reviewed remote base.
- `PRODUCTION_STATE_UNKNOWN`: a production assertion or mutation lacks required runtime evidence; local reversible work may continue if it does not depend on that fact.
- `TECHNICAL_DECISION_REQUIRED`: a safe next step requires a new stable decision.

## V1B documentation tooling

V1B may add reproducible cross-platform changeset hashing, migration verification, validation scripts, documentation CI, and local PostgreSQL automation. Those improvements do not automatically block local product work; each product task applies only the gates relevant to its outcome.
