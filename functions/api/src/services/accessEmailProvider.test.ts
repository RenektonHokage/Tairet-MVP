import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  AccessEmailProvider,
  AccessEmailProviderOutcome,
  AccessEmailProviderSendInput,
  AccessEmailProviderSendOptions,
} from "./accessEmailProvider";
import type { AccessEmailMessage } from "./accessEmailMessage";

type AcceptedOutcomeRequiresProviderMessageId = { kind: "accepted" } extends Extract<
  AccessEmailProviderOutcome,
  { kind: "accepted" }
>
  ? false
  : true;

const ACCEPTED_OUTCOME_REQUIRES_PROVIDER_MESSAGE_ID: AcceptedOutcomeRequiresProviderMessageId =
  true;

type TypesEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type ProviderFieldIsRequired<
  Key extends keyof AccessEmailProviderSendInput,
> = Record<string, never> extends Pick<AccessEmailProviderSendInput, Key>
  ? false
  : true;

type RequiredProviderFieldsStayRequired = [
  ProviderFieldIsRequired<"idempotencyKey">,
  ProviderFieldIsRequired<"requestPayloadHash">,
  ProviderFieldIsRequired<"templateVersion">,
  ProviderFieldIsRequired<"message">,
] extends [true, true, true, true]
  ? true
  : false;

type InputFieldsStayReadonly = TypesEqual<
  Pick<
    AccessEmailProviderSendInput,
    "idempotencyKey" | "requestPayloadHash" | "templateVersion" | "message"
  >,
  Readonly<
    Pick<
      AccessEmailProviderSendInput,
      "idempotencyKey" | "requestPayloadHash" | "templateVersion" | "message"
    >
  >
>;

type SignalStaysReadonly = TypesEqual<
  Pick<AccessEmailProviderSendOptions, "signal">,
  Readonly<Pick<AccessEmailProviderSendOptions, "signal">>
>;

type SendOptionsRemainOptional = Record<string, never> extends AccessEmailProviderSendOptions
  ? true
  : false;

const REQUIRED_PROVIDER_FIELDS_STAY_REQUIRED: RequiredProviderFieldsStayRequired = true;
const INPUT_FIELDS_STAY_READONLY: InputFieldsStayReadonly = true;
const SIGNAL_STAYS_READONLY: SignalStaysReadonly = true;
const SEND_OPTIONS_REMAIN_OPTIONAL: SendOptionsRemainOptional = true;

const MESSAGE: AccessEmailMessage = Object.freeze({
  from: "Tairet <access@example.test>",
  to: Object.freeze(["buyer@example.test"]),
  subject: "Tus entradas Tairet están listas",
  html: "<p>fixture</p>",
  attachments: Object.freeze([
    Object.freeze({
      filename: "entrada.png",
      content: "AQID",
      contentType: "image/png",
      contentId: "access-entry-qr-1",
    }),
  ]),
});

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
    assert.equal(REQUIRED_PROVIDER_FIELDS_STAY_REQUIRED, true);
    assert.equal(INPUT_FIELDS_STAY_READONLY, true);
    assert.equal(SIGNAL_STAYS_READONLY, true);
    assert.equal(SEND_OPTIONS_REMAIN_OPTIONAL, true);
    const outcomes: AccessEmailProviderOutcome[] = [
      { kind: "accepted", providerMessageId: "provider-message-1" },
      {
        kind: "failed_retryable",
        errorCode: "provider_retryable",
        retryAfterSeconds: 30,
      },
      { kind: "failed_terminal", errorCode: "provider_terminal" },
      { kind: "ambiguous", errorCode: "provider_ambiguous", retryAfterSeconds: 60 },
    ];

    assert.deepEqual(outcomes.map(disposition), [
      "accepted:provider-message-1",
      "retryable:provider_retryable",
      "terminal:provider_terminal",
      "ambiguous:provider_ambiguous",
    ]);
  });

  it("requires the durable request fields and forwards the optional signal", async () => {
    const controller = new AbortController();
    const provider: AccessEmailProvider = {
      async send(input, options) {
        assert.equal(
          input.idempotencyKey,
          "access-email-delivery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        );
        assert.equal(
          input.requestPayloadHash,
          "887f7a6f6b865ad97ccecec1403fe5248086a468ee8038029c349019c31ad666",
        );
        assert.equal(input.templateVersion, "access-entries-v1");
        assert.equal(input.message, MESSAGE);
        assert.equal(options?.signal, controller.signal);
        return { kind: "accepted", providerMessageId: "provider-message-1" };
      },
    };

    const outcome = await provider.send(
      {
        idempotencyKey:
          "access-email-delivery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestPayloadHash:
          "887f7a6f6b865ad97ccecec1403fe5248086a468ee8038029c349019c31ad666",
        templateVersion: "access-entries-v1",
        message: MESSAGE,
      },
      { signal: controller.signal },
    );

    assert.equal(outcome.kind, "accepted");
    if (outcome.kind === "accepted") {
      assert.equal(outcome.providerMessageId, "provider-message-1");
    }
  });
});
