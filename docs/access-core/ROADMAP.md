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
| `9E.5B3B4A` | `CLOSED` | Durable email worker state machine core |
| `9E.5B3B4B` | `CLOSED` | Runtime composition and lazy `WorkerMain` wiring |

The `9E.5B*` identifiers are internal sub-slices. They do not renumber or replace the public `B6` cutover and `B7` rollout stages below.

The latest closed checkpoint is [`9E.5B3B4B`](exec-plans/completed/9E.5B3B4B.md). It closes lazy runtime composition in `WorkerMain` while preserving activation, deployment, migration, and authority boundaries.

## Closed worker state-machine core

`9E.5B3B4A` is `CLOSED` (`VERIFIED_REPOSITORY`). It implements the injectable local worker capability, phased durable-email machine, correlated claim authority, bounded provider and settlement behavior, concurrency cancellation, accounting, and safe logging.

A did not compose the capability or startup wiring in `WorkerMain`; at its closure, the durable-email hard gate remained intact. B closes that separately bounded composition step without applying migrations remotely, deploying or activating durable email, disabling legacy delivery, or transferring operational authority.

## Closed runtime-composition slice

`9E.5B3B4B` is `CLOSED` (`VERIFIED_REPOSITORY`). Its product commit composes the closed durable-email capability lazily in `WorkerMain`, shares one Supabase client between RPC and the read-only reader, binds the canonical loader and builder, constructs one Resend provider per active process without sending during startup, and preserves fail-closed startup and signal cleanup.

No next product slice is declared by this closure. Any later slice must be named and authorized explicitly; no absent `9E.5B*` identifier is inferred.

Independent verification of remote migrations 046–049 remains a gate for deployment or activation that depends on those contracts. Composition is repository capability only and does not establish deployment, activation, or email authority.

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
| `9E.5B3B4A` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4B` | `CLOSED` | `VERIFIED_REPOSITORY` |
| Next product slice | `NONE_DECLARED`; not authorized | `REPORTED` |
| Remote application of migrations 046–049 | Not authorized | `REPORTED` |
| Worker/durable-email activation | Not authorized | `REPORTED` |
| `B6` cutover | Blocked and not authorized | `REPORTED` |
| `B7` rollout | Blocked and not authorized | `REPORTED` |

No product CODE is authorized by this closure. This file grants no remote action, deployment, activation, authority transfer, cutover, or rollout, and B leaves the `B6` and `B7` states and gates unchanged.

## Contextual stops

- `SCOPE_EXPANSION_REQUIRED`: an outcome needs a wider surface than the active instruction.
- `REPOSITORY_STATE_MISMATCH`: local base or protected artifacts do not match the plan.
- `REMOTE_ADVANCED`: remote-sensitive work no longer matches the reviewed remote base.
- `PRODUCTION_STATE_UNKNOWN`: a production assertion or mutation lacks required runtime evidence; local reversible work may continue if it does not depend on that fact.
- `TECHNICAL_DECISION_REQUIRED`: a safe next step requires a new stable decision.

## V1B documentation tooling

V1B may add reproducible cross-platform changeset hashing, migration verification, validation scripts, documentation CI, and local PostgreSQL automation. Those improvements do not automatically block local product work; each product task applies only the gates relevant to its outcome.
