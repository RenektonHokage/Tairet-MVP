import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { describe, it } from "node:test";

import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
  type Response as ResendResponse,
} from "resend";

import type {
  AccessEmailProvider,
  AccessEmailProviderOutcome,
  AccessEmailProviderSendInput,
  AccessEmailProviderSendOptions,
} from "./accessEmailProvider";
import type { AccessEmailMessage } from "./accessEmailMessage";
import type { AbortDeadlineScheduler } from "./abortDeadline";
import {
  classifyResendError,
  createResendAccessEmailProvider,
  type ResendAccessEmailClient,
} from "./accessEmailProviderResend";

const IDEMPOTENCY_KEY =
  "access-email-delivery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQUEST_PAYLOAD_HASH =
  "887f7a6f6b865ad97ccecec1403fe5248086a468ee8038029c349019c31ad666";
const TEMPLATE_VERSION = "access-entries-v1";
const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");

const MESSAGE: AccessEmailMessage = Object.freeze({
  from: "Tairet <access@example.test>",
  to: Object.freeze(["buyer@example.test"]),
  subject: "Tus entradas Tairet están listas",
  html: "<p>fixture</p>",
  attachments: Object.freeze([
    Object.freeze({
      filename: "entrada-1.png",
      content: "AQID",
      contentType: "image/png",
      contentId: "access-entry-qr-1",
    }),
    Object.freeze({
      filename: "entrada-2.png",
      content: "BAUG",
      contentType: "image/png",
      contentId: "access-entry-qr-2",
    }),
  ]),
});

const VALID_INPUT: AccessEmailProviderSendInput = Object.freeze({
  idempotencyKey: IDEMPOTENCY_KEY,
  requestPayloadHash: REQUEST_PAYLOAD_HASH,
  templateVersion: TEMPLATE_VERSION,
  message: MESSAGE,
});

interface ScheduledDeadline {
  readonly callback: () => void;
  readonly timeoutMs: number;
  cancelled: boolean;
}

class ManualScheduler {
  readonly deadlines: ScheduledDeadline[] = [];
  cancelCount = 0;

  readonly schedule: AbortDeadlineScheduler = (callback, timeoutMs) => {
    const deadline: ScheduledDeadline = {
      callback,
      timeoutMs,
      cancelled: false,
    };
    this.deadlines.push(deadline);
    return () => {
      if (!deadline.cancelled) {
        deadline.cancelled = true;
        this.cancelCount += 1;
      }
    };
  };

  fire(index = 0): void {
    const deadline = this.deadlines[index];
    assert.ok(deadline, `missing scheduled deadline ${index}`);
    if (!deadline.cancelled) {
      deadline.callback();
    }
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  assert.ok(resolvePromise);
  assert.ok(rejectPromise);
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

interface CapturedCall {
  readonly payload: CreateEmailOptions;
  readonly options: CreateEmailRequestOptions | undefined;
}

type FakeSendHandler = (
  payload: CreateEmailOptions,
  options: CreateEmailRequestOptions | undefined,
) => unknown;

function createFakeClient(handler: FakeSendHandler): {
  readonly client: ResendAccessEmailClient;
  readonly calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const client: ResendAccessEmailClient = {
    emails: {
      send(payload, options) {
        calls.push({ payload, options });
        return handler(payload, options) as Promise<CreateEmailResponse>;
      },
    },
  };
  return { client, calls };
}

function successResponse(id: unknown): unknown {
  return { data: { id }, error: null, headers: {} };
}

function errorResponse(
  name: string,
  statusCode: number | null,
  headers: unknown = {},
  message = "provider detail that must not escape",
): unknown {
  return {
    data: null,
    error: { name, statusCode, message },
    headers,
  };
}

function createHarness(
  handler: FakeSendHandler,
  options: {
    readonly scheduler?: ManualScheduler;
    readonly now?: () => number;
  } = {},
): {
  readonly provider: AccessEmailProvider;
  readonly calls: CapturedCall[];
  readonly scheduler: ManualScheduler;
} {
  const scheduler = options.scheduler ?? new ManualScheduler();
  const { client, calls } = createFakeClient(handler);
  return {
    provider: createResendAccessEmailProvider({
      apiKey: "re_test_b3b3",
      timeoutMs: 1_000,
      client,
      scheduler: scheduler.schedule,
      now: options.now ?? (() => NOW_MS),
    }),
    calls,
    scheduler,
  };
}

function withInput(
  overrides: Partial<AccessEmailProviderSendInput>,
): AccessEmailProviderSendInput {
  return { ...VALID_INPUT, ...overrides };
}

function asInput(value: unknown): AccessEmailProviderSendInput {
  return value as AccessEmailProviderSendInput;
}

type RequestOptionsWithSignal = CreateEmailRequestOptions & {
  readonly signal: AbortSignal;
};

function requestOptionsWithSignal(
  options: CreateEmailRequestOptions | undefined,
): RequestOptionsWithSignal {
  assert.ok(options);
  const privateOptions = options as RequestOptionsWithSignal;
  assert.ok(privateOptions.signal instanceof AbortSignal);
  return privateOptions;
}

function classify(
  name: string,
  statusCode: number | null,
  headers: unknown = {},
  message = "provider detail",
): AccessEmailProviderOutcome {
  return classifyResendError({
    error: { name, statusCode, message },
    headers,
    nowMs: NOW_MS,
  });
}

describe("createResendAccessEmailProvider", () => {
  it("is lazy and performs no client call or scheduling during construction", () => {
    const scheduler = new ManualScheduler();
    const { client, calls } = createFakeClient(() => successResponse("unused"));
    let clientFactoryCalls = 0;

    const provider = createResendAccessEmailProvider({
      apiKey: "re_test_lazy",
      timeoutMs: 1_000,
      clientFactory() {
        clientFactoryCalls += 1;
        return client;
      },
      scheduler: scheduler.schedule,
    });

    assert.ok(provider);
    assert.equal(clientFactoryCalls, 0);
    assert.equal(calls.length, 0);
    assert.equal(scheduler.deadlines.length, 0);
  });

  it("maps the exact message, attachment order, key, and composed signal", async () => {
    let htmlReads = 0;
    const accessorBackedMessage: AccessEmailMessage = {
      from: MESSAGE.from,
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      get html() {
        htmlReads += 1;
        return htmlReads === 1 ? MESSAGE.html : "<p>unhashed drift</p>";
      },
      attachments: MESSAGE.attachments,
    };
    const harness = createHarness(() => successResponse("message-1"));
    const outcomePromise = harness.provider.send(
      withInput({ message: accessorBackedMessage }),
      {},
    );
    const requestOptions = requestOptionsWithSignal(harness.calls[0]?.options);
    assert.equal(getEventListeners(requestOptions.signal, "abort").length, 1);
    const outcome = await outcomePromise;

    assert.deepEqual(outcome, {
      kind: "accepted",
      providerMessageId: "message-1",
    });
    assert.equal(harness.calls.length, 1);
    assert.deepEqual(harness.calls[0]?.payload, {
      from: MESSAGE.from,
      to: ["buyer@example.test"],
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      attachments: [
        {
          filename: "entrada-1.png",
          content: "AQID",
          contentType: "image/png",
          contentId: "access-entry-qr-1",
        },
        {
          filename: "entrada-2.png",
          content: "BAUG",
          contentType: "image/png",
          contentId: "access-entry-qr-2",
        },
      ],
    });
    assert.equal(requestOptions.idempotencyKey, IDEMPOTENCY_KEY);
    assert.equal(requestOptions.signal.aborted, false);
    assert.equal(getEventListeners(requestOptions.signal, "abort").length, 0);
    assert.equal(htmlReads, 1);
    assert.equal(harness.scheduler.deadlines[0]?.timeoutMs, 1_000);
    assert.equal(harness.scheduler.cancelCount, 1);
  });

  it("rejects every malformed durable idempotency key before scheduling or SDK use", async () => {
    const invalidKeys = [
      "email/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "ACCESS-email-delivery/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "access-email-delivery/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "access-email-delivery/not-a-uuid",
      `${IDEMPOTENCY_KEY} `,
    ];

    for (const idempotencyKey of invalidKeys) {
      const harness = createHarness(() => successResponse("must-not-run"));
      assert.deepEqual(
        await harness.provider.send(withInput({ idempotencyKey })),
        {
          kind: "failed_terminal",
          errorCode: "provider_idempotency_key_invalid",
        },
      );
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.scheduler.deadlines.length, 0);
    }
  });

  it("distinguishes malformed hashes from a valid lowercase hash mismatch", async () => {
    const malformedHashes = [
      "not-a-hash",
      REQUEST_PAYLOAD_HASH.toUpperCase(),
      `${REQUEST_PAYLOAD_HASH}0`,
    ];

    for (const requestPayloadHash of malformedHashes) {
      const harness = createHarness(() => successResponse("must-not-run"));
      assert.deepEqual(
        await harness.provider.send(withInput({ requestPayloadHash })),
        { kind: "failed_terminal", errorCode: "provider_invalid_input" },
      );
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.scheduler.deadlines.length, 0);
    }

    const mismatchHarness = createHarness(() => successResponse("must-not-run"));
    assert.deepEqual(
      await mismatchHarness.provider.send(
        withInput({ requestPayloadHash: "0".repeat(64) }),
      ),
      {
        kind: "failed_terminal",
        errorCode: "provider_payload_hash_mismatch",
      },
    );
    assert.equal(mismatchHarness.calls.length, 0);
    assert.equal(mismatchHarness.scheduler.deadlines.length, 0);
  });

  it("rejects unsupported templates before recalculation reaches the provider", async () => {
    const harness = createHarness(() => successResponse("must-not-run"));
    assert.deepEqual(
      await harness.provider.send(withInput({ templateVersion: "access-entries-v2" })),
      {
        kind: "failed_terminal",
        errorCode: "provider_template_unsupported",
      },
    );
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.scheduler.deadlines.length, 0);
  });

  it("rejects malformed messages and structural input without provider side effects", async () => {
    let recipientLengthReads = 0;
    const disappearingRecipients = new Proxy(["buyer@example.test"], {
      get(target, property, receiver) {
        if (property === "length") {
          recipientLengthReads += 1;
          return recipientLengthReads === 1 ? 1 : 0;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    let attachmentLengthReads = 0;
    const disappearingAttachments = new Proxy([...MESSAGE.attachments], {
      get(target, property, receiver) {
        if (property === "length") {
          attachmentLengthReads += 1;
          return attachmentLengthReads === 1 ? 1 : 0;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const malformedMessages: unknown[] = [
      null,
      { ...MESSAGE, to: [] },
      { ...MESSAGE, to: disappearingRecipients },
      { ...MESSAGE, to: ["not-an-email"] },
      { ...MESSAGE, html: "  " },
      { ...MESSAGE, attachments: [] },
      { ...MESSAGE, attachments: disappearingAttachments },
      {
        ...MESSAGE,
        attachments: [{ ...MESSAGE.attachments[0], content: "not base64!" }],
      },
      { ...MESSAGE, unexpected: "field" },
    ];

    for (const message of malformedMessages) {
      const harness = createHarness(() => successResponse("must-not-run"));
      assert.deepEqual(
        await harness.provider.send(asInput({ ...VALID_INPUT, message })),
        { kind: "failed_terminal", errorCode: "provider_invalid_input" },
      );
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.scheduler.deadlines.length, 0);
    }

    const structuralHarness = createHarness(() => successResponse("must-not-run"));
    assert.deepEqual(
      await structuralHarness.provider.send(
        asInput({ ...VALID_INPUT, unexpected: "field" }),
      ),
      { kind: "failed_terminal", errorCode: "provider_invalid_input" },
    );
    assert.equal(structuralHarness.calls.length, 0);
  });

  it("returns retryable without a timer or SDK call for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createHarness(() => successResponse("must-not-run"));
    let signalReads = 0;
    const signalOptions = Object.defineProperty({}, "signal", {
      enumerable: true,
      get() {
        signalReads += 1;
        return signalReads === 1
          ? controller.signal
          : new AbortController().signal;
      },
    }) as AccessEmailProviderSendOptions;

    assert.deepEqual(
      await harness.provider.send(VALID_INPUT, signalOptions),
      {
        kind: "failed_retryable",
        errorCode: "provider_call_not_started_aborted",
      },
    );
    assert.equal(signalReads, 1);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.scheduler.deadlines.length, 0);
  });

  it("proves the Resend 6.6.0 signal seam at fetchRequest without network or global patching", async () => {
    class CapturingResend extends Resend {
      path: string | undefined;
      requestOptions: unknown;

      override fetchRequest<T>(
        path: string,
        options: NonNullable<unknown> = {},
      ): Promise<ResendResponse<T>> {
        this.path = path;
        this.requestOptions = options;
        return new Promise<ResendResponse<T>>(() => undefined);
      }
    }

    const originalFetch = globalThis.fetch;
    const client = new CapturingResend("re_test_sdk_contract");
    const scheduler = new ManualScheduler();
    const provider = createResendAccessEmailProvider({
      apiKey: "re_test_sdk_contract",
      timeoutMs: 1_000,
      client,
      scheduler: scheduler.schedule,
    });

    const outcomePromise = provider.send(VALID_INPUT);
    assert.equal(client.path, "/emails");
    assert.ok(isRequestInit(client.requestOptions));
    const requestInit = client.requestOptions;
    assert.equal(requestInit.method, "POST");
    assert.ok(requestInit.signal instanceof AbortSignal);
    assert.equal(requestInit.signal.aborted, false);
    assert.equal(
      new Headers(requestInit.headers).get("Idempotency-Key"),
      IDEMPOTENCY_KEY,
    );
    assert.equal(typeof requestInit.body, "string");
    const wirePayload: unknown = JSON.parse(requestInit.body);
    assert.deepEqual(wirePayload, {
      from: MESSAGE.from,
      to: ["buyer@example.test"],
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      attachments: [
        {
          filename: "entrada-1.png",
          content: "AQID",
          content_type: "image/png",
          content_id: "access-entry-qr-1",
        },
        {
          filename: "entrada-2.png",
          content: "BAUG",
          content_type: "image/png",
          content_id: "access-entry-qr-2",
        },
      ],
    });

    scheduler.fire();
    assert.deepEqual(await outcomePromise, {
      kind: "ambiguous",
      errorCode: "resend_timeout",
    });
    assert.equal(requestInit.signal.aborted, true);
    assert.equal(globalThis.fetch, originalFetch);
  });

  it("accepts only nonempty provider IDs and trims the conclusive ID", async () => {
    for (const [providerId, expectedId] of [
      ["message-1", "message-1"],
      ["  message-2  ", "message-2"],
    ] as const) {
      const harness = createHarness(() => successResponse(providerId));
      assert.deepEqual(await harness.provider.send(VALID_INPUT), {
        kind: "accepted",
        providerMessageId: expectedId,
      });
    }

    let providerIdReads = 0;
    const accessorData = Object.defineProperty({}, "id", {
      enumerable: true,
      get() {
        providerIdReads += 1;
        return providerIdReads === 1 ? "message-accessor" : " ";
      },
    });
    const accessorHarness = createHarness(() => ({
      data: accessorData,
      error: null,
      headers: {},
    }));
    assert.deepEqual(await accessorHarness.provider.send(VALID_INPUT), {
      kind: "accepted",
      providerMessageId: "message-accessor",
    });
    assert.equal(providerIdReads, 1);
  });

  it("maps every malformed or conflicting success shape to ambiguous", async () => {
    const malformedResponses: unknown[] = [
      null,
      {},
      { data: null, error: null, headers: {} },
      successResponse(undefined),
      successResponse(null),
      successResponse(123),
      successResponse("   "),
      {
        data: { id: "message-conflict" },
        error: { name: "validation_error", statusCode: 400, message: "conflict" },
        headers: {},
      },
      {
        error: { name: "validation_error", statusCode: 400, message: "missing data" },
        headers: {},
      },
      {
        data: { id: "message-with-unknown-field", extra: true },
        error: null,
        headers: {},
      },
      {
        data: null,
        error: {
          name: "validation_error",
          statusCode: 400,
          message: "extra error shape",
          extra: true,
        },
        headers: {},
      },
      {
        data: { id: "message-with-top-level-extra" },
        error: null,
        headers: {},
        extra: true,
      },
      Object.assign(
        Object.create({
          error: {
            name: "validation_error",
            statusCode: 400,
            message: "inherited error",
          },
          headers: { "retry-after": "1" },
        }),
        { data: null },
      ),
    ];

    for (const response of malformedResponses) {
      const harness = createHarness(() => response);
      assert.deepEqual(await harness.provider.send(VALID_INPUT), {
        kind: "ambiguous",
        errorCode: "resend_malformed_response",
      });
    }
  });

  it("never uses provider messages as classification authority", () => {
    const first = classify(
      "validation_error",
      400,
      {},
      "recipient is invalid",
    );
    const second = classify(
      "validation_error",
      400,
      {},
      "rate limit timeout API key secret",
    );
    assert.deepEqual(first, second);
    assert.deepEqual(
      classify("future_error", 400, {}, "rate limit exceeded"),
      { kind: "ambiguous", errorCode: "resend_unknown_error" },
    );

    let nameReads = 0;
    const driftingError = Object.defineProperties({}, {
      name: {
        enumerable: true,
        get() {
          nameReads += 1;
          return nameReads === 1 ? "future_error" : "validation_error";
        },
      },
      statusCode: { enumerable: true, value: 400 },
      message: { enumerable: true, value: "must not influence classification" },
    });
    assert.deepEqual(
      classifyResendError({
        error: driftingError,
        headers: {},
        nowMs: NOW_MS,
      }),
      { kind: "ambiguous", errorCode: "resend_unknown_error" },
    );
    assert.equal(nameReads, 1);
  });

  it("classifies all declared definitive Resend 6.6.0 rejections as terminal", () => {
    const terminalCases = [
      ["invalid_idempotency_key", 400],
      ["validation_error", 400],
      ["missing_api_key", 401],
      ["restricted_api_key", 401],
      ["invalid_api_key", 403],
      ["not_found", 404],
      ["method_not_allowed", 405],
      ["invalid_idempotent_request", 409],
      ["invalid_attachment", 422],
      ["invalid_from_address", 422],
      ["invalid_access", 422],
      ["invalid_parameter", 422],
      ["invalid_region", 422],
      ["missing_required_field", 422],
      ["monthly_quota_exceeded", 422],
      ["daily_quota_exceeded", 429],
      ["security_error", 451],
    ] as const;

    for (const [name, statusCode] of terminalCases) {
      assert.deepEqual(classify(name, statusCode, { "retry-after": "10" }), {
        kind: "failed_terminal",
        errorCode: "resend_request_rejected",
      });
    }
  });

  it("classifies verified rate-limit shapes as retryable with the safe default", async () => {
    assert.deepEqual(classify("rate_limit_exceeded", 429), {
      kind: "failed_retryable",
      errorCode: "resend_rate_limited",
      retryAfterSeconds: 60,
    });
    assert.deepEqual(classify("application_error", 429), {
      kind: "failed_retryable",
      errorCode: "resend_rate_limited",
      retryAfterSeconds: 60,
    });

    const harness = createHarness(() =>
      errorResponse("rate_limit_exceeded", 429),
    );
    assert.deepEqual(await harness.provider.send(VALID_INPUT), {
      kind: "failed_retryable",
      errorCode: "resend_rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("parses integer Retry-After values with defaulting and clamping", () => {
    const cases = [
      [undefined, 60],
      ["1", 1],
      ["90", 90],
      ["0", 1],
      ["3601", 3_600],
      ["999999", 3_600],
      ["-1", 60],
      ["NaN", 60],
      ["Infinity", 60],
      ["9007199254740992", 60],
    ] as const;

    for (const [retryAfter, expected] of cases) {
      const headers =
        retryAfter === undefined ? {} : { "Retry-After": retryAfter };
      assert.deepEqual(classify("rate_limit_exceeded", 429, headers), {
        kind: "failed_retryable",
        errorCode: "resend_rate_limited",
        retryAfterSeconds: expected,
      });
    }

    const throwingHeaders = new Proxy<Record<string, string>>(
      {},
      {
        ownKeys() {
          throw new Error("raw header failure");
        },
      },
    );
    assert.deepEqual(classify("rate_limit_exceeded", 429, throwingHeaders), {
      kind: "failed_retryable",
      errorCode: "resend_rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("parses Retry-After HTTP dates against an injected clock", () => {
    const cases = [
      ["Thu, 16 Jul 2026 12:00:45 GMT", 45],
      ["Thu, 16 Jul 2026 11:59:00 GMT", 1],
      ["Thu, 16 Jul 2026 14:00:00 GMT", 3_600],
      ["Mon, 31 Feb 2026 12:00:00 GMT", 60],
      ["not-a-date", 60],
    ] as const;

    for (const [retryAfter, expected] of cases) {
      assert.deepEqual(
        classify("rate_limit_exceeded", 429, { "retry-after": retryAfter }),
        {
          kind: "failed_retryable",
          errorCode: "resend_rate_limited",
          retryAfterSeconds: expected,
        },
      );
    }
  });

  it("fails closed for concurrent, server, network, unknown, and incompatible errors", () => {
    const cases: readonly [string, number | null, AccessEmailProviderOutcome][] = [
      [
        "concurrent_idempotent_requests",
        409,
        { kind: "ambiguous", errorCode: "resend_concurrent_request" },
      ],
      [
        "application_error",
        null,
        { kind: "ambiguous", errorCode: "resend_transport_ambiguous" },
      ],
      [
        "internal_server_error",
        null,
        { kind: "ambiguous", errorCode: "resend_transport_ambiguous" },
      ],
      [
        "rate_limit_exceeded",
        400,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "invalid_api_key",
        401,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "restricted_api_key",
        403,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "validation_error",
        422,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "invalid_access",
        403,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "invalid_parameter",
        400,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "missing_required_field",
        400,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "monthly_quota_exceeded",
        429,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "security_error",
        403,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "invalid_parameter",
        408,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "monthly_quota_exceeded",
        408,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "missing_api_key",
        418,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "future_error",
        499,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
    ];

    for (const [name, statusCode, expected] of cases) {
      assert.deepEqual(classify(name, statusCode), expected);
    }

    for (const statusCode of [500, 502, 503, 504]) {
      assert.deepEqual(classify("application_error", statusCode), {
        kind: "ambiguous",
        errorCode: "resend_server_error",
      });
    }
  });

  it("keeps every required contradictory name and status pair ambiguous", () => {
    const cases: readonly [string, number | null, AccessEmailProviderOutcome][] = [
      [
        "invalid_api_key",
        503,
        { kind: "ambiguous", errorCode: "resend_server_error" },
      ],
      [
        "rate_limit_exceeded",
        401,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "validation_error",
        500,
        { kind: "ambiguous", errorCode: "resend_server_error" },
      ],
      [
        "future_error",
        429,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
      [
        "invalid_api_key",
        null,
        { kind: "ambiguous", errorCode: "resend_unknown_error" },
      ],
    ];

    for (const [name, statusCode, expected] of cases) {
      assert.deepEqual(classify(name, statusCode), expected);
    }
  });

  it("aborts the exact SDK signal and returns ambiguous on internal timeout", async () => {
    const operation = deferred<CreateEmailResponse>();
    const harness = createHarness(() => operation.promise);

    const outcomePromise = harness.provider.send(VALID_INPUT);
    assert.equal(harness.calls.length, 1);
    const signal = requestOptionsWithSignal(harness.calls[0]?.options).signal;
    assert.equal(signal.aborted, false);
    assert.equal(getEventListeners(signal, "abort").length, 1);
    harness.scheduler.fire();

    assert.deepEqual(await outcomePromise, {
      kind: "ambiguous",
      errorCode: "resend_timeout",
    });
    assert.equal(signal.aborted, true);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(harness.scheduler.cancelCount, 1);
  });

  it("composes external abort after provider start as an ambiguous cancellation", async () => {
    const operation = deferred<CreateEmailResponse>();
    const controller = new AbortController();
    const harness = createHarness(() => operation.promise);

    const outcomePromise = harness.provider.send(VALID_INPUT, {
      signal: controller.signal,
    });
    const signal = requestOptionsWithSignal(harness.calls[0]?.options).signal;
    assert.notEqual(signal, controller.signal);
    assert.equal(getEventListeners(controller.signal, "abort").length, 1);
    assert.equal(getEventListeners(signal, "abort").length, 1);
    controller.abort();

    assert.deepEqual(await outcomePromise, {
      kind: "ambiguous",
      errorCode: "resend_external_abort",
    });
    assert.equal(signal.aborted, true);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(harness.scheduler.cancelCount, 1);
  });

  it("preserves conclusive responses that settle before later abort attempts", async () => {
    const cases: readonly [unknown, AccessEmailProviderOutcome][] = [
      [
        successResponse("message-before-abort"),
        { kind: "accepted", providerMessageId: "message-before-abort" },
      ],
      [
        errorResponse("validation_error", 400),
        { kind: "failed_terminal", errorCode: "resend_request_rejected" },
      ],
      [
        errorResponse("rate_limit_exceeded", 429),
        {
          kind: "failed_retryable",
          errorCode: "resend_rate_limited",
          retryAfterSeconds: 60,
        },
      ],
    ];

    for (const [response, expected] of cases) {
      const controller = new AbortController();
      const harness = createHarness(() => response);
      const outcome = await harness.provider.send(VALID_INPUT, {
        signal: controller.signal,
      });
      controller.abort();
      harness.scheduler.fire();
      assert.deepEqual(outcome, expected);
      assert.equal(harness.scheduler.cancelCount, 1);
    }

    for (const [response, expected] of cases) {
      const responseFirstOperation = deferred<CreateEmailResponse>();
      const responseFirstController = new AbortController();
      const responseFirstHarness = createHarness(
        () => responseFirstOperation.promise,
      );
      const responseFirstOutcome = responseFirstHarness.provider.send(
        VALID_INPUT,
        { signal: responseFirstController.signal },
      );
      responseFirstOperation.resolve(response as CreateEmailResponse);
      responseFirstController.abort();
      assert.deepEqual(await responseFirstOutcome, expected);

      const abortFirstOperation = deferred<CreateEmailResponse>();
      const abortFirstController = new AbortController();
      const abortFirstHarness = createHarness(() => abortFirstOperation.promise);
      const abortFirstOutcome = abortFirstHarness.provider.send(VALID_INPUT, {
        signal: abortFirstController.signal,
      });
      abortFirstController.abort();
      abortFirstOperation.resolve(response as CreateEmailResponse);
      assert.deepEqual(await abortFirstOutcome, {
        kind: "ambiguous",
        errorCode: "resend_external_abort",
      });
    }
  });

  it("orders same-turn timeout and response races by the first event", async () => {
    const responseFirstOperation = deferred<CreateEmailResponse>();
    const responseFirstHarness = createHarness(
      () => responseFirstOperation.promise,
    );
    const responseFirstOutcome =
      responseFirstHarness.provider.send(VALID_INPUT);
    responseFirstOperation.resolve(
      successResponse("message-before-timeout") as CreateEmailResponse,
    );
    responseFirstHarness.scheduler.fire();
    assert.deepEqual(await responseFirstOutcome, {
      kind: "accepted",
      providerMessageId: "message-before-timeout",
    });

    const timeoutFirstOperation = deferred<CreateEmailResponse>();
    const timeoutFirstHarness = createHarness(
      () => timeoutFirstOperation.promise,
    );
    const timeoutFirstOutcome = timeoutFirstHarness.provider.send(VALID_INPUT);
    timeoutFirstHarness.scheduler.fire();
    timeoutFirstOperation.resolve(
      successResponse("message-after-timeout") as CreateEmailResponse,
    );
    assert.deepEqual(await timeoutFirstOutcome, {
      kind: "ambiguous",
      errorCode: "resend_timeout",
    });
    await Promise.resolve();
  });

  it("keeps a late provider resolution inert after returning timeout", async () => {
    const operation = deferred<CreateEmailResponse>();
    const harness = createHarness(() => operation.promise);
    const outcomePromise = harness.provider.send(VALID_INPUT);
    harness.scheduler.fire();
    const outcome = await outcomePromise;
    const serializedBefore = JSON.stringify(outcome);

    operation.resolve(successResponse("late-message") as CreateEmailResponse);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(Object.isFrozen(outcome), true);
    assert.equal(JSON.stringify(outcome), serializedBefore);
    assert.deepEqual(outcome, {
      kind: "ambiguous",
      errorCode: "resend_timeout",
    });
  });

  it("consumes late rejection after timeout without unhandledRejection", async () => {
    const operation = deferred<CreateEmailResponse>();
    const harness = createHarness(() => operation.promise);
    const observed: unknown[] = [];
    const listener = (reason: unknown): void => {
      observed.push(reason);
    };
    process.on("unhandledRejection", listener);

    try {
      const outcomePromise = harness.provider.send(VALID_INPUT);
      harness.scheduler.fire();
      assert.deepEqual(await outcomePromise, {
        kind: "ambiguous",
        errorCode: "resend_timeout",
      });
      operation.reject(new Error("buyer@example.test re_secret raw stack"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(observed, []);
    } finally {
      process.removeListener("unhandledRejection", listener);
    }
  });

  it("uses the first abort cause in timeout and external-abort races", async () => {
    const timeoutOperation = deferred<CreateEmailResponse>();
    const timeoutController = new AbortController();
    const timeoutHarness = createHarness(() => timeoutOperation.promise);
    const timeoutOutcome = timeoutHarness.provider.send(VALID_INPUT, {
      signal: timeoutController.signal,
    });
    timeoutHarness.scheduler.fire();
    timeoutController.abort();
    assert.deepEqual(await timeoutOutcome, {
      kind: "ambiguous",
      errorCode: "resend_timeout",
    });

    const abortOperation = deferred<CreateEmailResponse>();
    const abortController = new AbortController();
    const abortHarness = createHarness(() => abortOperation.promise);
    const abortOutcome = abortHarness.provider.send(VALID_INPUT, {
      signal: abortController.signal,
    });
    abortController.abort();
    abortHarness.scheduler.fire();
    assert.deepEqual(await abortOutcome, {
      kind: "ambiguous",
      errorCode: "resend_external_abort",
    });
  });

  it("sanitizes synchronous throws and promise rejections after provider start", async () => {
    const rawErrors = [
      () => {
        throw new Error("buyer@example.test re_secret full payload");
      },
      () => Promise.reject(new Error("buyer@example.test re_secret full payload")),
    ];

    for (const handler of rawErrors) {
      const harness = createHarness(handler);
      const outcome = await harness.provider.send(VALID_INPUT);
      assert.deepEqual(outcome, {
        kind: "ambiguous",
        errorCode: "resend_transport_ambiguous",
      });
      assert.equal(JSON.stringify(outcome).includes("buyer@example.test"), false);
      assert.equal(JSON.stringify(outcome).includes("re_secret"), false);
    }
  });

  it("sanitizes deadline setup failure before the provider-start boundary", async () => {
    let calls = 0;
    const { client } = createFakeClient(() => {
      calls += 1;
      return successResponse("must-not-run");
    });
    const provider = createResendAccessEmailProvider({
      apiKey: "re_test_scheduler",
      timeoutMs: 1_000,
      client,
      scheduler() {
        throw new Error("scheduler secret");
      },
    });

    assert.deepEqual(await provider.send(VALID_INPUT), {
      kind: "failed_retryable",
      errorCode: "provider_call_not_started_failed",
    });
    assert.equal(calls, 0);
  });

  it("sanitizes client factory failure before the provider-start boundary", async () => {
    const scheduler = new ManualScheduler();
    const { client, calls } = createFakeClient(() =>
      successResponse("must-not-run"),
    );
    let clientFactoryCalls = 0;
    const provider = createResendAccessEmailProvider({
      apiKey: "re_test_client_factory",
      timeoutMs: 1_000,
      clientFactory() {
        clientFactoryCalls += 1;
        if (clientFactoryCalls === 1) {
          throw new Error("client factory secret");
        }
        return client;
      },
      scheduler: scheduler.schedule,
    });

    assert.deepEqual(await provider.send(VALID_INPUT), {
      kind: "failed_retryable",
      errorCode: "provider_call_not_started_failed",
    });
    assert.equal(clientFactoryCalls, 1);
    assert.equal(calls.length, 0);
    assert.equal(scheduler.deadlines.length, 1);
    assert.equal(scheduler.cancelCount, 1);
  });

  it("returns only frozen allowlisted fields and never leaks provider or payload data", async () => {
    const apiKey = "re_test_secret_api_key";
    const rawMessage =
      "buyer@example.test Tairet <access@example.test> <p>fixture</p> AQID raw stack";
    const { client } = createFakeClient(() =>
      errorResponse("future_error", 418, { "x-secret": rawMessage }, rawMessage),
    );
    const scheduler = new ManualScheduler();
    const provider = createResendAccessEmailProvider({
      apiKey,
      timeoutMs: 1_000,
      client,
      scheduler: scheduler.schedule,
    });

    const outcome = await provider.send(VALID_INPUT);
    assert.deepEqual(Object.keys(outcome).sort(), ["errorCode", "kind"]);
    assert.equal(Object.isFrozen(outcome), true);
    const serialized = JSON.stringify(outcome);
    for (const forbidden of [
      apiKey,
      "buyer@example.test",
      "access@example.test",
      "<p>fixture</p>",
      "AQID",
      IDEMPOTENCY_KEY,
      REQUEST_PAYLOAD_HASH,
      "future_error",
      "x-secret",
      "raw stack",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    assert.deepEqual(outcome, {
      kind: "ambiguous",
      errorCode: "resend_unknown_error",
    });

    assert.throws(
      () =>
        createResendAccessEmailProvider({
          apiKey: ` ${apiKey}`,
          timeoutMs: 1_000,
          client,
        }),
      (error: unknown) =>
        error instanceof Error && !error.message.includes(apiKey),
    );
  });
});

function isRequestInit(value: unknown): value is RequestInit & { body: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "body" in value &&
    typeof value.body === "string"
  );
}
