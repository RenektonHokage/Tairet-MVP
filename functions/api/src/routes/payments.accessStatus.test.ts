import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type {
  AccessPublicStatusReadResult,
  AccessPublicStatusReader,
  AccessPublicStatusVenueLookup,
  PublicAccessEmailStatus,
  PublicAccessFulfillmentStatus,
  PublicAccessStatusOrder,
} from "../services/accessPublicStatus";
import type {
  AccessStatusHandlerDependencies,
  AccessVenueSupabaseClient,
} from "./payments";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE ??= "test-service-role";

const PUBLIC_REF_A = `acc_${"a".repeat(32)}`;
const PUBLIC_REF_B = `acc_${"b".repeat(32)}`;

async function loadPaymentsModule() {
  return import("./payments");
}

function publicOrder(
  fulfillmentStatus: PublicAccessFulfillmentStatus = "issued",
  emailStatus: PublicAccessEmailStatus = "sent",
  ref = PUBLIC_REF_A,
): PublicAccessStatusOrder {
  return {
    ref,
    status: "paid",
    source_type: "local",
    access_date: "2026-08-01",
    amount_gs: 125_000,
    currency: "PYG",
    expires_at: null,
    fulfillment: { status: fulfillmentStatus },
    email: { status: emailStatus },
  };
}

function foundResult(
  order = publicOrder(),
  venue: AccessPublicStatusVenueLookup = { kind: "local", id: "local-1" },
): Extract<AccessPublicStatusReadResult, { kind: "found" }> {
  return { kind: "found", order, venue };
}

function constantReader(
  result: AccessPublicStatusReadResult,
  refs: string[] = [],
): AccessPublicStatusReader {
  return {
    async read(publicRef) {
      refs.push(publicRef);
      return result;
    },
  };
}

interface CapturedResponse {
  statusCode: number | null;
  body: unknown;
  nextError: unknown;
}

async function invoke(
  handler: RequestHandler,
  query: Record<string, unknown>,
): Promise<CapturedResponse> {
  const captured: CapturedResponse = {
    statusCode: null,
    body: undefined,
    nextError: undefined,
  };
  const response = {
    status(statusCode: number) {
      captured.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as unknown as Response;
  const next: NextFunction = (error?: unknown) => {
    captured.nextError = error;
  };

  await handler(
    { query } as unknown as Request,
    response,
    next,
  );
  return captured;
}

interface LogEntry {
  readonly level: "error" | "warn";
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}

function recordingLogger(entries: LogEntry[]) {
  return {
    error(message: string, meta?: Record<string, unknown>) {
      entries.push({ level: "error", message, meta });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      entries.push({ level: "warn", message, meta });
    },
  };
}

function dependencies(
  result: AccessPublicStatusReadResult,
  options: {
    readonly venueResult?:
      | Readonly<{ kind: "resolved"; venueName: string | null }>
      | Readonly<{ kind: "read_error" }>;
    readonly logs?: LogEntry[];
    readonly refs?: string[];
  } = {},
): AccessStatusHandlerDependencies {
  return {
    reader: constantReader(result, options.refs),
    resolveVenueName: async () =>
      options.venueResult ?? { kind: "resolved", venueName: "Sala Central" },
    logger: recordingLogger(options.logs ?? []),
  };
}

interface VenueQueryCall {
  table: string;
  columns: string;
  column: string | null;
  value: string | null;
}

function venueClient(
  resultFor: (table: string) => Readonly<{ data: unknown; error: unknown }>,
): { client: AccessVenueSupabaseClient; calls: VenueQueryCall[] } {
  const calls: VenueQueryCall[] = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const call: VenueQueryCall = {
            table,
            columns,
            column: null,
            value: null,
          };
          calls.push(call);
          const request = {
            eq(column: string, value: string) {
              call.column = column;
              call.value = value;
              return request;
            },
            maybeSingle() {
              return Promise.resolve(resultFor(table));
            },
            then<TResult1 = Readonly<{ data: unknown; error: unknown }>, TResult2 = never>(
              onfulfilled?:
                | ((
                    value: Readonly<{ data: unknown; error: unknown }>,
                  ) => TResult1 | PromiseLike<TResult1>)
                | null,
              onrejected?:
                | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
                | null,
            ) {
              return Promise.resolve(resultFor(table)).then(
                onfulfilled,
                onrejected,
              );
            },
          };
          return request;
        },
      };
    },
  };
  return {
    client: client as unknown as AccessVenueSupabaseClient,
    calls,
  };
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("GET /payments/access/status handler", () => {
  it("returns the stable 400 contract and does not read for every invalid ref shape", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const refs: string[] = [];
    const handler = createAccessStatusHandler(
      dependencies({ kind: "not_found" }, { refs }),
    );

    for (const ref of [
      undefined,
      null,
      "",
      "acc_1234",
      `acc_${"A".repeat(32)}`,
      [PUBLIC_REF_A],
    ]) {
      const response = await invoke(handler, { ref });
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        ok: false,
        error: {
          code: "invalid_ref",
          message: "Invalid reference",
        },
      });
      assert.equal(response.nextError, undefined);
    }
    assert.deepEqual(refs, []);
  });

  it("returns the stable 404 contract for a valid unknown ref", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const refs: string[] = [];
    const response = await invoke(
      createAccessStatusHandler(
        dependencies({ kind: "not_found" }, { refs }),
      ),
      { ref: PUBLIC_REF_A },
    );

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
      ok: false,
      error: {
        code: "not_found",
        message: "Payment status not found",
      },
    });
    assert.deepEqual(refs, [PUBLIC_REF_A]);
    assert.equal(response.nextError, undefined);
  });

  it("returns the stable 500 contract for read and snapshot failures with sanitized logs", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();

    for (const result of [
      {
        kind: "read_error",
        errorCode: "access_public_status_read_error",
      },
      {
        kind: "invalid_snapshot",
        errorCode: "access_public_status_invalid_snapshot",
      },
    ] as const) {
      const logs: LogEntry[] = [];
      const response = await invoke(
        createAccessStatusHandler(dependencies(result, { logs })),
        { ref: PUBLIC_REF_A },
      );

      assert.equal(response.statusCode, 500);
      assert.deepEqual(response.body, {
        ok: false,
        error: {
          code: "internal_error",
          message: "Internal error",
        },
      });
      assert.deepEqual(logs, [
        {
          level: "error",
          message: "Failed to fetch Access Core public status",
          meta: {
            publicRef: PUBLIC_REF_A,
            errorCode: result.errorCode,
          },
        },
      ]);
      assert.equal(response.nextError, undefined);
    }
  });

  it("preserves every legacy success field and always adds both closed nested statuses", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const response = await invoke(
      createAccessStatusHandler(dependencies(foundResult())),
      { ref: PUBLIC_REF_A },
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      order: {
        ref: PUBLIC_REF_A,
        status: "paid",
        source_type: "local",
        access_date: "2026-08-01",
        amount_gs: 125_000,
        currency: "PYG",
        expires_at: null,
        fulfillment: { status: "issued" },
        email: { status: "sent" },
        venue_name: "Sala Central",
      },
    });
    assert.equal(response.nextError, undefined);
  });

  it("passes through every closed fulfillment and email enum without exposing internal evidence", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const fulfillmentStatuses: PublicAccessFulfillmentStatus[] = [
      "not_started",
      "pending",
      "issued",
      "manual_review",
    ];
    const emailStatuses: PublicAccessEmailStatus[] = [
      "not_started",
      "pending",
      "retry_scheduled",
      "sent",
      "manual_review",
    ];

    for (const fulfillmentStatus of fulfillmentStatuses) {
      for (const emailStatus of emailStatuses) {
        const response = await invoke(
          createAccessStatusHandler(
            dependencies(
              foundResult(publicOrder(fulfillmentStatus, emailStatus)),
            ),
          ),
          { ref: PUBLIC_REF_A },
        );
        assert.equal(response.statusCode, 200);
        const json = JSON.stringify(response.body);
        assert.equal(
          json.includes(`"fulfillment":{"status":"${fulfillmentStatus}"}`),
          true,
        );
        assert.equal(
          json.includes(`"email":{"status":"${emailStatus}"}`),
          true,
        );
        for (const forbidden of [
          "issuance_status",
          "issuance_review_status",
          "expected_entries",
          "issued_entries",
          "email_next_attempt_at",
          "email_sent_at",
          "local_id",
          "event_id",
          "entry_ids",
          "checkin_token",
          "buyer_",
          "attendee_",
        ]) {
          assert.equal(json.includes(forbidden), false);
        }
      }
    }
  });

  it("resolves local, event and null venues with the narrow read-only resolver", async () => {
    const { createAccessVenueNameResolver } = await loadPaymentsModule();
    const fake = venueClient((table) =>
      table === "locals"
        ? { data: { name: "Local Norte" }, error: null }
        : { data: { title: "Festival Sur" }, error: null },
    );
    const resolver = createAccessVenueNameResolver(fake.client);

    assert.deepEqual(
      await resolver({ kind: "local", id: "local-7" }),
      { kind: "resolved", venueName: "Local Norte" },
    );
    assert.deepEqual(
      await resolver({ kind: "event", id: "event-8" }),
      { kind: "resolved", venueName: "Festival Sur" },
    );
    assert.deepEqual(
      await resolver({ kind: "event", id: null }),
      { kind: "resolved", venueName: null },
    );
    assert.deepEqual(fake.calls, [
      {
        table: "locals",
        columns: "name",
        column: "id",
        value: "local-7",
      },
      {
        table: "events",
        columns: "title",
        column: "id",
        value: "event-8",
      },
    ]);
  });

  it("classifies venue data, query and thrown failures without exposing raw provider details", async () => {
    const { createAccessStatusHandler, createAccessVenueNameResolver } =
      await loadPaymentsModule();
    const rawProviderDetail =
      "buyer@example.test checkin_token=secret PostgREST detail";
    const failedClient = venueClient(() => ({
      data: null,
      error: { message: rawProviderDetail },
    }));
    const malformedClient = venueClient(() => ({
      data: { title: 42 },
      error: null,
    }));

    assert.deepEqual(
      await createAccessVenueNameResolver(failedClient.client)({
        kind: "local",
        id: "local-1",
      }),
      { kind: "read_error" },
    );
    assert.deepEqual(
      await createAccessVenueNameResolver(malformedClient.client)({
        kind: "event",
        id: "event-1",
      }),
      { kind: "resolved", venueName: null },
    );

    for (const resolveVenueName of [
      async () => ({ kind: "read_error" as const }),
      async () => {
        throw new Error(rawProviderDetail);
      },
    ]) {
      const logs: LogEntry[] = [];
      const response = await invoke(
        createAccessStatusHandler({
          reader: constantReader(foundResult()),
          resolveVenueName,
          logger: recordingLogger(logs),
        }),
        { ref: PUBLIC_REF_A },
      );
      assert.equal(response.statusCode, 200);
      assert.equal(
        (
          response.body as {
            order: { venue_name: string | null };
          }
        ).order.venue_name,
        null,
      );
      assert.deepEqual(logs, [
        {
          level: "warn",
          message: "Failed to resolve Access Core venue name",
          meta: {
            publicRef: PUBLIC_REF_A,
            errorCode: "access_public_status_venue_read_error",
          },
        },
      ]);
      assert.equal(JSON.stringify(logs).includes(rawProviderDetail), false);
    }
  });

  it("keeps invocation-scoped dependencies isolated under concurrent requests", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const gateA = deferred<AccessPublicStatusReadResult>();
    const gateB = deferred<AccessPublicStatusReadResult>();
    const refsA: string[] = [];
    const refsB: string[] = [];
    const handlerA = createAccessStatusHandler({
      reader: {
        async read(publicRef) {
          refsA.push(publicRef);
          return gateA.promise;
        },
      },
      resolveVenueName: async () => ({
        kind: "resolved",
        venueName: "Venue A",
      }),
      logger: recordingLogger([]),
    });
    const handlerB = createAccessStatusHandler({
      reader: {
        async read(publicRef) {
          refsB.push(publicRef);
          return gateB.promise;
        },
      },
      resolveVenueName: async () => ({
        kind: "resolved",
        venueName: "Venue B",
      }),
      logger: recordingLogger([]),
    });

    const responseAPromise = invoke(handlerA, { ref: PUBLIC_REF_A });
    const responseBPromise = invoke(handlerB, { ref: PUBLIC_REF_B });
    gateB.resolve(
      foundResult(
        publicOrder("issued", "sent", PUBLIC_REF_B),
        { kind: "event", id: "event-b" },
      ),
    );
    const responseB = await responseBPromise;
    gateA.resolve(foundResult());
    const responseA = await responseAPromise;

    assert.deepEqual(refsA, [PUBLIC_REF_A]);
    assert.deepEqual(refsB, [PUBLIC_REF_B]);
    assert.equal(
      (responseA.body as { order: { ref: string; venue_name: string } }).order
        .ref,
      PUBLIC_REF_A,
    );
    assert.equal(
      (responseA.body as { order: { ref: string; venue_name: string } }).order
        .venue_name,
      "Venue A",
    );
    assert.equal(
      (responseB.body as { order: { ref: string; venue_name: string } }).order
        .ref,
      PUBLIC_REF_B,
    );
    assert.equal(
      (responseB.body as { order: { ref: string; venue_name: string } }).order
        .venue_name,
      "Venue B",
    );
  });

  it("delegates unexpected dependency rejection to Express next", async () => {
    const { createAccessStatusHandler } = await loadPaymentsModule();
    const unexpected = new Error("unexpected");
    const handler = createAccessStatusHandler({
      reader: {
        async read() {
          throw unexpected;
        },
      },
      resolveVenueName: async () => ({
        kind: "resolved",
        venueName: null,
      }),
      logger: recordingLogger([]),
    });

    const response = await invoke(handler, { ref: PUBLIC_REF_A });
    assert.equal(response.statusCode, null);
    assert.equal(response.body, undefined);
    assert.equal(response.nextError, unexpected);
  });
});
