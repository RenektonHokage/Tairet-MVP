import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  AccessEmailProvider,
  AccessEmailProviderOutcome,
} from "./accessEmailProvider";

type AcceptedOutcomeRequiresProviderMessageId = { kind: "accepted" } extends Extract<
  AccessEmailProviderOutcome,
  { kind: "accepted" }
>
  ? false
  : true;

const ACCEPTED_OUTCOME_REQUIRES_PROVIDER_MESSAGE_ID: AcceptedOutcomeRequiresProviderMessageId =
  true;

function assertNever(value: never): never {
  throw new Error(`Unhandled provider outcome: ${JSON.stringify(value)}`);
}

function disposition(outcome: AccessEmailProviderOutcome): string {
  switch (outcome.kind) {
    case "accepted":
      return `accepted:${outcome.providerMessageId}`;
    case "failed_retryable":
      return `retryable:${outcome.errorCode}`;
    case "failed_terminal":
      return `terminal:${outcome.errorCode}`;
    case "ambiguous":
      return `ambiguous:${outcome.errorCode}`;
    default:
      return assertNever(outcome);
  }
}

describe("AccessEmailProvider contracts", () => {
  it("keeps every provider outcome exhaustive and provider-neutral", () => {
    assert.equal(ACCEPTED_OUTCOME_REQUIRES_PROVIDER_MESSAGE_ID, true);
    const outcomes: AccessEmailProviderOutcome[] = [
      { kind: "accepted", providerMessageId: "provider-message-1" },
      { kind: "failed_retryable", errorCode: "temporary", retryAfterSeconds: 30 },
      { kind: "failed_terminal", errorCode: "rejected" },
      { kind: "ambiguous", errorCode: "timeout", retryAfterSeconds: 60 },
    ];

    assert.deepEqual(outcomes.map(disposition), [
      "accepted:provider-message-1",
      "retryable:temporary",
      "terminal:rejected",
      "ambiguous:timeout",
    ]);
  });

  it("requires an idempotency key on every provider call", async () => {
    const provider: AccessEmailProvider = {
      async send(input) {
        assert.equal(input.idempotencyKey, "fulfillment/idempotency/1");
        return { kind: "accepted", providerMessageId: "provider-message-1" };
      },
    };

    const outcome = await provider.send({
      idempotencyKey: "fulfillment/idempotency/1",
      requestPayloadHash: "sha256:test",
      templateVersion: "access-v1",
    });

    assert.equal(outcome.kind, "accepted");
    if (outcome.kind === "accepted") {
      assert.equal(outcome.providerMessageId, "provider-message-1");
    }
  });
});
