# Access Core — Invariants

## Purpose

These are stable decisions and safety properties. They do not describe current deployment, flags, authorization, or roadmap position.

## Evidence and state

1. Capability in the repository, deployment, activation, operational authority, and authorized work are separate facts.
2. Production is never inferred from `main`, a committed migration, an example environment file, or a passing local test.
3. Operational assertions use `VERIFIED_REPOSITORY`, `VERIFIED_RUNTIME`, `REPORTED`, or `UNKNOWN`.
4. `UNKNOWN` blocks only actions whose safety or truth depends on the missing evidence.
5. Eligibility in a roadmap is not authorization to start work.

## Domain separation

1. Commercial order, payment attempt, stock reservation, access entry, check-in, email delivery, and audit state remain separate concerns.
2. `access_entries` is the authority for validatable access units; email and frontend presentation are not.
3. Payment approval and stock consumption are not reversed because entry issuance or email delivery fails.
4. Email delivery cannot create, approve, reject, refund, or otherwise redefine a payment.
5. Legacy `orders`, event-specific tables, and Access Core tables are not silently mixed. Any adapter or migration between them requires explicit scope and contracts.

## Issuance and fulfillment

1. Entry issuance is idempotent by the closed database identity `(order_item_id, unit_index)`.
2. Fulfillment work must preserve lease token and epoch fencing. A stale or expired lease carries no mutation authority.
3. A late response after timeout, shutdown, or loss of lease cannot regain authority.
4. Ambiguous outcomes fail closed and are not reclassified from provider message text.
5. Reconciliation and delivery must remain recoverable without duplicating entries or provider sends.

## Durable email

1. Canonical message construction is deterministic for the same logical input.
2. Canonical entry ordering is independent of database return order.
3. The durable request hash covers the provider-visible payload and template version, not a secret or plaintext lease token.
4. A provider call may begin only after a conclusive SQL claim grants current mutation authority.
5. Delivery-attempt identity and state, email generation, idempotency key, request hash, and recorded outcome remain under fenced SQL authority; provider responses are evidence, never state authority.
6. The provider contract exposes only allowlisted outcomes: accepted, retryable failure, terminal failure, or ambiguous.
7. Provider message content is never classification authority.
8. A provider timeout or transport uncertainty after send start is ambiguous, not a safe retry conclusion.
9. A terminal pre-claim data failure occurs before a provider attempt and must not claim that a provider call happened.
10. Terminal pre-claim recording is fenced by order, generation, lease token, and epoch and has a closed error-code allowlist.
11. Legacy direct delivery and durable delivery cannot both hold email authority. Cutover must be explicit, gated, and reversible.

## Migrations and database boundaries

1. Closed migrations are immutable evidence. Corrections use a new migration rather than editing an applied migration.
2. Migration presence is `VERIFIED_REPOSITORY`; application requires migration-ledger or runtime evidence.
3. Security-definer RPCs retain a fixed safe search path and least-privilege execution grants.
4. Client roles do not gain direct write authority over durable fulfillment or delivery-attempt state.
5. Applying a migration that declares a maintenance/quiesce requirement must follow an explicitly authorized operational plan.

## Secrets, PII, and observability

1. Never persist or report private keys, API keys, bearer tokens, card data, CVV, full callback payloads, full buyer PII, or full access/check-in tokens.
2. Correlation identifiers and error codes are sanitized and allowlisted.
3. Logs are evidence, not state authority; database/runtime state remains authoritative for operational outcomes.
4. Observability failure cannot weaken fencing or change a business outcome.

## Work and review

1. ASK does not authorize CODE.
2. CODE changes only the explicitly authorized surface and does not reopen closed decisions without evidence.
3. Sensitive surfaces are handled one bounded slice at a time.
4. Focused validation runs during implementation; the complete applicable suite runs once per exact changeset version.
5. Review evidence binds to a base commit and exact ordered path/mode/content identity.
6. Any semantic or byte-level change after review invalidates reuse of that review identity.
7. Push, deployment, activation, cutover, and rollout are separate actions requiring their own authority and gates.
8. `B6` is the explicit authority cutover; `B7` is a separate production rollout and cannot precede a closed `B6`.
