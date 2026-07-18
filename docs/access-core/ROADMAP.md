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

The `9E.5B*` identifiers are internal sub-slices. They do not renumber or replace the public `B6` cutover and `B7` rollout stages below.

The corresponding commits and evidence are under [`exec-plans/completed/`](exec-plans/completed/9E.5B3B4P.md).

## Authorized function-only prerequisite

`9E.5B3B4Q` is the current explicitly authorized local prerequisite slice. Its scope is limited to additive function-only migration 048 and the two canonical documentation updates that materialize the terminal-preclaim-after-ambiguous decision.

This roadmap does not mark `9E.5B3B4Q` closed and does not assert or authorize remote migration application, deployment, activation, authority transfer, cutover, or rollout.

## Next worker state-machine slice

`9E.5B3B4A` remains the next worker state-machine slice after `9E.5B3B4Q` closes. It has not started and is not authorized by the `9E.5B3B4Q` instruction.

Its exact Goal, Read, Constraints, and Done when require a separate human instruction and execution scope.

Remote application of migrations 047 and 048 is not a prerequisite for separately authorized local, reversible ASK/CODE in `9E.5B3B4A`. It becomes a gate only for activation, deployment, or rollout that depends on their remote schema/RPC state.

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

| Work | State |
| --- | --- |
| CONTEXT HARNESS V1A documentation-only changeset | Authorized by its explicit prompt; no product authority |
| `9E.5B3B4Q` | Explicitly authorized only for its bounded local three-path changeset; not closed and no remote authority |
| `9E.5B3B4A` | Next after `9E.5B3B4Q`; not started and not authorized by that slice |
| Remote migration apply | Not authorized |
| Worker/durable-email activation | Not authorized |
| `B6` cutover | Blocked and not authorized |
| `B7` rollout | Blocked and not authorized |

The current human instruction authorizes only the bounded local `9E.5B3B4Q` changeset. No other product work, remote action, activation, cutover, or rollout is authorized.

## Contextual stops

- `SCOPE_EXPANSION_REQUIRED`: an outcome needs a wider surface than the active instruction.
- `REPOSITORY_STATE_MISMATCH`: local base or protected artifacts do not match the plan.
- `REMOTE_ADVANCED`: remote-sensitive work no longer matches the reviewed remote base.
- `PRODUCTION_STATE_UNKNOWN`: a production assertion or mutation lacks required runtime evidence; local reversible work may continue if it does not depend on that fact.
- `TECHNICAL_DECISION_REQUIRED`: a safe next step requires a new stable decision.

## V1B documentation tooling

V1B may add reproducible cross-platform changeset hashing, migration verification, validation scripts, documentation CI, and local PostgreSQL automation. Those improvements do not automatically block local product work; each product task applies only the gates relevant to its outcome.
