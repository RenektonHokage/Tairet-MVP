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
4. A provider call may begin only after a conclusive correlated `processing` response grants current SQL mutation authority.
5. Delivery-attempt identity and state, email generation, idempotency key, request hash, and recorded outcome remain under fenced SQL authority; provider responses are evidence, never state authority.
6. PostgreSQL is the authority for the remaining idempotency-window duration. The correlated public `processing` contract exposes the nonnegative duration `idempotency_remaining_ms`; it exposes neither `idempotency_expires_at` nor `database_now`.
7. Node must not compare an absolute PostgreSQL timestamp with `Date.now()` or another local wall clock. It discounts the SQL duration only by monotonic local elapsed time measured from the start of the RPC attempt that produced the conclusive `processing` response: `elapsedSinceConclusiveClaimAttemptStartedMs = monotonicNow - conclusiveClaimAttemptStartedAt`; `conservativeIdempotencyRemainingMs = max(0, sqlIdempotencyRemainingMs - elapsedSinceConclusiveClaimAttemptStartedMs)`.
8. A provider may start only when `conservativeIdempotencyRemainingMs >= effectiveProviderTimeoutMs + 1000`. `MIN_STAGE_WINDOW_MS = 1000` is not clock-skew allowance; it covers only local jitter, quantization, and the synchronous interval between the final guard and `provider.send`, with no intervening `await`.
9. After a conclusive `processing` response, insufficient margin requires `providerCalls = 0`, `releaseCalls = 0`, and `newClaimCalls = 0`; `record_access_email_delivery_outcome` records a retryable `failed` outcome with `errorCode = worker_email_idempotency_window_insufficient`, `retryAfterSeconds = 60`, and `providerMessageId = null`, without manual review.
10. A legacy `processing` response grants no provider authority. It is preserved as ambiguous evidence, receives bounded settlement, and causes a fatal worker stop; it is never silently downgraded or retried through a new claim.
11. A provider may start at most once for a delivery obligation, after the final authority and timing guard.
12. An in-flight provider call observes provider timeout, shutdown, and the first fatal cancellation signal. Any abort or transport uncertainty after provider start is ambiguous, not a safe retry conclusion.
13. Once provider work starts, post-provider settlement is bounded and independent of global cancellation so already-started obligations are not discarded.
14. After any `processing` response, release and a new delivery claim are prohibited, including when settlement exhausts its bounded attempts.
15. Terminal preclaim, delivery claim, and outcome settlement each have at most two exact attempts; no phase has an implicit third attempt.
16. The selected provider outcome tuple is immutable across settlement attempts and cannot be reclassified from provider message content.
17. The first fatal condition wins process outcome and cancellation authority without discarding provider or settlement obligations that already started.
18. Email accounting is seven orthogonal dimensions: accepted, retry scheduled, ambiguous, skipped sent, unsettled, manual review, and manual-review unknown. Incrementing one dimension does not infer another.
19. The provider contract exposes only allowlisted outcomes: accepted, retryable failure, terminal failure, or ambiguous.
20. “Pre-claim” means before starting a new delivery claim or provider call; it does not assert that the current generation has no historical provider activity.
21. Terminal pre-claim recording is fenced by order, generation, lease token, and epoch and has a closed error-code allowlist.
22. A terminal pre-claim failure may coexist with exactly one earlier current-generation `ambiguous` attempt only when no `processing` or `accepted` attempt exists; the ambiguous attempt remains intact as the authoritative historical provider evidence, no new claim, provider call, or provider outcome is created or implied, and the marker identifies only the exact terminal request.
23. Legacy direct delivery and durable delivery cannot both hold email authority. Cutover must be explicit, gated, and reversible.

## Legacy HTTP direct email

1. The Bancard callback decides `ACCESS_LEGACY_DIRECT_EMAIL_ENABLED` once per invocation, after token validation and before the first mutating RPC: an invalid value fails closed before payment mutation, `false` prevents loading or invoking the legacy sender, and the omitted/default `true` preserves legacy compatibility. The decision uses no mutable global override, and disabling the legacy sender does not by itself activate durable email or transfer authority.

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
5. Logs must not contain buyer PII, access or lease tokens, idempotency keys, provider keys, or provider identifiers.

## Work and review

1. ASK does not authorize CODE.
2. CODE changes only the explicitly authorized surface and does not reopen closed decisions without evidence.
3. Sensitive surfaces are handled one bounded slice at a time.
4. Focused validation runs during implementation; the complete applicable suite runs once per exact changeset version.
5. Review evidence binds to a base commit and exact ordered path/mode/content identity.
6. Any semantic or byte-level change after review invalidates reuse of that review identity.
7. Push, deployment, activation, cutover, and rollout are separate actions requiring their own authority and gates.
8. `B6` is the explicit authority cutover; `B7` is a separate production rollout and cannot precede a closed `B6`.
