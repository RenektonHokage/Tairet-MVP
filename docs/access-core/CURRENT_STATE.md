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
| `state_as_of_product_commit` | `aa0557d9fdc14b704a3578534ac39b464b8889d2` | `VERIFIED_REPOSITORY` |
| `last_closed_product_slice` | `9E.5B4A` | `VERIFIED_REPOSITORY` |
| `next_eligible_product_slice` | `NONE_DECLARED` | `VERIFIED_REPOSITORY` |
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
| Product commit `3ba88e82bd2686ba41c545712cebfd7f326a3c43` implements the local durable-email worker core in the worker and its test only | Present | `VERIFIED_REPOSITORY` |
| The worker accepts an injectable durable-email capability and validates it before use | Present | `VERIFIED_REPOSITORY` |
| Durable-email OFF preserves issuance/reconciliation behavior and defers durable delivery | Present | `VERIFIED_REPOSITORY` |
| Durable delivery is a phased machine covering terminal preclaim, correlated migration-049 claim, provider handoff, and post-provider settlement | Present | `VERIFIED_REPOSITORY` |
| Only correlated `processing` grants provider authority; legacy `processing` is preserved as ambiguous evidence, settled, and followed by a fatal stop | Present | `VERIFIED_REPOSITORY` |
| The provider starts at most once and its in-flight signal observes provider timeout, shutdown, and first fatal cancellation | Present | `VERIFIED_REPOSITORY` |
| Post-provider settlement is bounded and independent of global cancellation once the provider obligation has started | Present | `VERIFIED_REPOSITORY` |
| The worker exposes seven orthogonal email counters: accepted, retry scheduled, ambiguous, skipped sent, unsettled, manual review, and manual-review unknown | Present | `VERIFIED_REPOSITORY` |
| Worker logging uses sanitized allowlisted metadata without buyer PII, tokens, keys, or provider identifiers | Present | `VERIFIED_REPOSITORY` |
| Worker, deterministic message, canonical loader, provider contract, and Resend adapter capabilities are present | Present | `VERIFIED_REPOSITORY` |
| Product commit `dc261581eb1bafc8d1147ac1fea736d3ceb75edc` composes the durable-email capability lazily in `WorkerMain` | Present | `VERIFIED_REPOSITORY` |
| Invalid configuration fails before runtime dependencies are imported or constructed | Present | `VERIFIED_REPOSITORY` |
| Worker OFF and dry-run return before Supabase, the Resend-capable email runtime, provider construction, or signal-handler registration | Present | `VERIFIED_REPOSITORY` |
| Reconcile-only mode preserves its prior client path and constructs no durable reader, builder, or provider | Preserved | `VERIFIED_REPOSITORY` |
| Active durable composition shares one Supabase client between the RPC client and read-only message-data reader | Present | `VERIFIED_REPOSITORY` |
| The canonical loader and builder are bound to the reader, sender address, and QR base URL; one Resend provider instance per active process is passed in the exact worker capability | Present | `VERIFIED_REPOSITORY` |
| `provider.send` is not invoked during startup | Preserved | `VERIFIED_REPOSITORY` |
| Import, reader, builder, provider, and worker startup failures fail closed with sanitized logging, and registered signal handlers are cleaned up | Present | `VERIFIED_REPOSITORY` |
| The former `durable_email_capability_not_implemented` hard gate was removed | Removed | `VERIFIED_REPOSITORY` |
| Worker and durable-email defaults remain OFF, legacy direct email defaults ON, and legacy/durable mutual exclusion remains intact | Preserved | `VERIFIED_REPOSITORY` |
| Product commit `28690a936ddf9f7388066bde03aceeae7150408a` adds the HTTP legacy direct-email authority gate to the Bancard confirmation callback | Present | `VERIFIED_REPOSITORY` |
| `loadLegacyDirectEmailEnabled` reads only `ACCESS_LEGACY_DIRECT_EMAIL_ENABLED`: an omitted value defaults to `true`, explicit `"true"` and `"false"` are accepted, and every other value is invalid | Present | `VERIFIED_REPOSITORY` |
| After private-key and timing-safe token validation, the callback reads and captures the gate once per invocation before the first mutating RPC; invalid configuration fails before payment mutation | Present | `VERIFIED_REPOSITORY` |
| Gate `false` prevents both loading and invoking the legacy sender; default or explicit `true` preserves legacy delivery, with a lazy loader and invocation-bound dependencies rather than mutable global overrides | Present | `VERIFIED_REPOSITORY` |
| Payment confirmation, entry issuance, and the HTTP response contract are preserved; email failures after issuance remain non-blocking | Preserved | `VERIFIED_REPOSITORY` |
| Product commit `aa0557d9fdc14b704a3578534ac39b464b8889d2` closes the public post-payment fulfillment-status API contract | Present | `VERIFIED_REPOSITORY` |
| `GET /payments/access/status` preserves every previous public field, and `order.status` remains exclusively payment-level | Preserved | `VERIFIED_REPOSITORY` |
| Every successful response adds required non-null `fulfillment.status` (`not_started`, `pending`, `issued`, or `manual_review`) and `email.status` (`not_started`, `pending`, `retry_scheduled`, `sent`, or `manual_review`) | Present | `VERIFIED_REPOSITORY` |
| One embedded principal read obtains the order, fulfillment, and minimal entry projection; `venue_name` remains a separate non-authoritative lookup | Present | `VERIFIED_REPOSITORY` |
| Strict parsing, relationship cardinality, and mapping fail closed; impossible persisted shapes produce HTTP 500, and valid divergence is never degraded to `sent` | Preserved | `VERIFIED_REPOSITORY` |
| Legacy compatibility reports `sent` only from a complete coherent projection of sent entries | Preserved | `VERIFIED_REPOSITORY` |
| Terminal `issuance_status = manual_review` projects fulfillment `manual_review` and email `not_started`; completed issuance with `issuance_review_status = manual_review` preserves email as an independent evidence-based dimension | Present | `VERIFIED_REPOSITORY` |
| `items_not_found` with `expected_entries = 0` projects fulfillment `manual_review` and email `not_started` | Present | `VERIFIED_REPOSITORY` |
| The public result exposes no counts, retry timestamps, internal errors, attempts, leases, provider metadata, buyer or attendee PII, or access/check-in tokens | Preserved | `VERIFIED_REPOSITORY` |

Repository presence proves capability only. It does not prove deployment, activation, or authority.

## Local isolated validation

| Surface | Result | Evidence |
| --- | --- | --- |
| Isolated PostgreSQL/Supabase 17.6 with `network=none` | Migrations 046 through 049 applied; 48 SQL cases/results, two concurrent races across four sessions, and zero deadlocks | `VERIFIED_RUNTIME` in an isolated local runtime; not production |
| Worker targeted validation | 102 of 102 tests passed | `VERIFIED_REPOSITORY` for product changeset `65f330660ff88201fa1d57ffec3d8370e33691c21648d442de460852f3b35702` |
| Complete API validation | 214 of 214 tests passed | `VERIFIED_REPOSITORY` for product changeset `65f330660ff88201fa1d57ffec3d8370e33691c21648d442de460852f3b35702` |
| TypeScript gates | Typecheck and build passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| Directed lint | Passed for the two changed TypeScript files | `VERIFIED_REPOSITORY` for the exact product changeset |
| Global API lint | Blocked before analysis by pre-existing lint infrastructure | `VERIFIED_REPOSITORY`; not a product regression |
| `9E.5B3B4C` configuration validation | 14 of 14 tests passed | `VERIFIED_REPOSITORY` for product changeset `6f57277487dde74c975ce4a867a3146738d8b04545e0764ddefdb213764a368f` |
| `9E.5B3B4C` Bancard callback validation | 17 of 17 tests passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B3B4C` complete API validation | 235 of 235 tests passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B3B4C` TypeScript gates | Typecheck and build passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B3B4C` directed lint | Passed for the changed TypeScript surface | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B3B4C` global API lint | Blocked before analysis by pre-existing lint infrastructure | `VERIFIED_REPOSITORY`; not a product regression |
| `9E.5B3B4C` final semantic review | High 0, Medium 0, Low 0 | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B4A` focused public-status validation | 26 of 26 tests passed | `VERIFIED_REPOSITORY` for product changeset `89b3ba24dfe463b2e934eb683549d4f521282f599435a7a725eb5fc4642c08d6` |
| `9E.5B4A` complete API validation | Passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B4A` TypeScript gates | Typecheck and build passed | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B4A` directed lint | Passed for the changed TypeScript surface | `VERIFIED_REPOSITORY` for the exact product changeset |
| `9E.5B4A` final review | The Medium `items_not_found` finding was corrected before the final commit; High 0, Medium 0, Low 0 remained | `VERIFIED_REPOSITORY` for the exact product changeset |

The isolated runtime evidence is not production evidence. It does not verify a remote migration ledger, deployment, activation, or operational authority.

## Production and deployment state

| Surface | State | Evidence |
| --- | --- | --- |
| Migration 046 remote application | Not established by this documentation cut | `UNKNOWN` |
| Migration 047 remote application | Not established by this documentation cut | `UNKNOWN` |
| Migration 048 remote application | Not established by this documentation cut | `UNKNOWN` |
| Migration 049 remote application | Not established by this documentation cut | `UNKNOWN` |
| Current independent remote migration-ledger state for migrations 046 through 049 | Not verified | `UNKNOWN` |
| Durable worker process deployed | Not independently established | `UNKNOWN` |
| Durable email composition deployed | Not independently established | `UNKNOWN` |

No production state is inferred from the push of `aa0557d9fdc14b704a3578534ac39b464b8889d2`. Independent verification of migrations 046 through 049 remains a gate for deployment, activation, or rollout that depends on those contracts.

## Activation state

| Capability | Activation | Evidence |
| --- | --- | --- |
| Access fulfillment worker | OFF | `REPORTED` |
| Durable email delivery | OFF | `REPORTED` |
| Legacy direct email | ON in the reported operating mode | `REPORTED` |
| Durable email path in `WorkerMain` | Composed as repository capability; not reported active | `VERIFIED_REPOSITORY` for composition; activation remains `REPORTED` OFF |

Repository defaults are worker OFF, durable email OFF, and legacy direct email ON (`VERIFIED_REPOSITORY`). They support but do not independently verify the reported runtime activation state. Composition does not establish deployment, activation, or authority.

## Operational authority

| Responsibility | Current authority | Evidence |
| --- | --- | --- |
| Access Core post-confirm email delivery | Legacy direct email path | `REPORTED` |
| Durable email delivery | No authority | `REPORTED` |
| Worker reconciliation | No active production authority established | `REPORTED` |
| Payment approval | Existing payment confirmation contract; unchanged by this slice | `VERIFIED_REPOSITORY` |

Slice `9E.5B4A` transfers no authority (`REPORTED`). The reported legacy runtime authority remains unchanged. Authority changes require a separately authorized cutover; capability, deployment, or a feature flag alone does not transfer authority.

## Authorization state

| Work | Authorization | Evidence |
| --- | --- | --- |
| `9E.5B3B4Q` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4R` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4A` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4B` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B3B4C` | `CLOSED` | `VERIFIED_REPOSITORY` |
| `9E.5B4A` | `CLOSED` | `VERIFIED_REPOSITORY` |
| Start another product slice | No next slice declared; requires an explicit name and authorization | `REPORTED` |
| Apply migrations 046 through 049 remotely | Not authorized | `REPORTED` |
| Enable worker or durable email | Not authorized | `REPORTED` |
| Disable legacy direct email or transfer authority | Not authorized | `REPORTED` |
| Deploy, cut over, or roll out | Not authorized | `REPORTED` |

After this documentation changeset is closed, a new human instruction is required for product work. Production uncertainty stops only work that must assert or modify production; it does not automatically block authorized local, reversible work.

## Update triggers

Update this file when a product slice closes, a migration ledger is verified, deployment or activation changes, operational authority changes, or new work is authorized. Do not update it merely because a local documentation commit changes `HEAD`.
