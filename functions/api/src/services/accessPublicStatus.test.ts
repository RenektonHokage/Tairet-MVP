import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_PUBLIC_STATUS_SELECT,
  createAccessPublicStatusReader,
  mapAccessPublicStatusSnapshot,
  type AccessPublicStatusReadResult,
  type AccessPublicStatusSupabaseClient,
} from "./accessPublicStatus";

const PUBLIC_REF = `acc_${"a".repeat(32)}`;
const OTHER_REF = `acc_${"b".repeat(32)}`;
const NOW_MS = Date.parse("2026-07-21T12:00:00.000Z");
const FUTURE = "2026-07-21T13:00:00.000Z";
const PAST = "2026-07-21T11:00:00.000Z";
const NEXT_ATTEMPT = "2026-07-21T12:01:00.000Z";
const SENT_AT = "2026-07-21T11:59:00.000Z";

function entry(
  emailStatus: "not_sent" | "sent" | "failed" = "not_sent",
  emailSentAt: string | null = emailStatus === "sent" ? SENT_AT : null,
) {
  return {
    email_status: emailStatus,
    email_sent_at: emailSentAt,
  };
}

function fulfillment(overrides: Record<string, unknown> = {}) {
  return {
    issuance_status: "complete",
    issuance_review_status: "none",
    expected_entries: 2,
    issued_entries: 2,
    email_status: "pending",
    email_next_attempt_at: NEXT_ATTEMPT,
    email_sent_at: null,
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    public_ref: PUBLIC_REF,
    status: "paid",
    source_type: "local",
    local_id: "11111111-1111-4111-8111-111111111111",
    event_id: null,
    access_date: "2026-08-10",
    amount_gs: "120000",
    currency: "PYG",
    expires_at: FUTURE,
    fulfillment: fulfillment(),
    entries: [entry(), entry()],
    ...overrides,
  };
}

function map(input: unknown): AccessPublicStatusReadResult {
  return mapAccessPublicStatusSnapshot(input, PUBLIC_REF, NOW_MS);
}

function publicStatuses(result: AccessPublicStatusReadResult) {
  assert.equal(result.kind, "found");
  if (result.kind !== "found") throw new Error("expected found");
  return {
    payment: result.order.status,
    fulfillment: result.order.fulfillment.status,
    email: result.order.email.status,
  };
}

function assertInvalid(input: unknown): void {
  assert.deepEqual(map(input), {
    kind: "invalid_snapshot",
    errorCode: "access_public_status_invalid_snapshot",
  });
}

function completeSnapshot(
  emailStatus: "pending" | "processing" | "failed" | "sent" | "manual_review",
  entries: unknown[],
  reviewStatus: "none" | "manual_review" = "none",
  overrides: Record<string, unknown> = {},
) {
  const timestampFields = {
    pending: { email_next_attempt_at: NEXT_ATTEMPT, email_sent_at: null },
    processing: { email_next_attempt_at: null, email_sent_at: null },
    failed: { email_next_attempt_at: NEXT_ATTEMPT, email_sent_at: null },
    sent: { email_next_attempt_at: null, email_sent_at: SENT_AT },
    manual_review: { email_next_attempt_at: null, email_sent_at: null },
  }[emailStatus];
  return snapshot({
    fulfillment: fulfillment({
      issuance_review_status: reviewStatus,
      email_status: emailStatus,
      ...timestampFields,
      ...overrides,
    }),
    entries,
  });
}

describe("mapAccessPublicStatusSnapshot", () => {
  it("preserves all public payment states and derives expiration without starting fulfillment", () => {
    const cases = [
      {
        status: "pending_payment",
        expiresAt: FUTURE,
        expected: "pending_payment",
      },
      {
        status: "pending_payment",
        expiresAt: PAST,
        expected: "expired",
      },
      { status: "cancelled", expiresAt: FUTURE, expected: "cancelled" },
      {
        status: "manual_review",
        expiresAt: FUTURE,
        expected: "manual_review",
      },
      { status: "expired", expiresAt: PAST, expected: "expired" },
    ] as const;

    for (const testCase of cases) {
      const result = map(snapshot({
        status: testCase.status,
        expires_at: testCase.expiresAt,
        fulfillment: null,
        entries: [],
      }));
      assert.deepEqual(publicStatuses(result), {
        payment: testCase.expected,
        fulfillment: "not_started",
        email: "not_started",
      });
    }
  });

  it("maps paid without fulfillment only when no entries exist", () => {
    assert.deepEqual(
      publicStatuses(map(snapshot({ fulfillment: null, entries: [] }))),
      { payment: "paid", fulfillment: "pending", email: "not_started" },
    );
    assertInvalid(snapshot({ fulfillment: null, entries: [entry()] }));
  });

  it("rejects fulfillment or entry evidence for every non-paid order", () => {
    for (const status of [
      "pending_payment",
      "cancelled",
      "manual_review",
      "expired",
    ]) {
      assertInvalid(snapshot({ status, entries: [] }));
      assertInvalid(snapshot({ status, fulfillment: null, entries: [entry()] }));
    }
  });

  it("maps valid pending and rejects pending issuance with emitted evidence", () => {
    const valid = snapshot({
      fulfillment: fulfillment({
        issuance_status: "pending",
        expected_entries: 2,
        issued_entries: 0,
        email_status: "pending",
        email_next_attempt_at: null,
        email_sent_at: null,
      }),
      entries: [],
    });
    assert.deepEqual(publicStatuses(map(valid)), {
      payment: "paid",
      fulfillment: "pending",
      email: "not_started",
    });
    assertInvalid({ ...valid, entries: [entry()] });
  });

  it("maps valid partial and rejects count or projection inconsistencies", () => {
    const valid = snapshot({
      fulfillment: fulfillment({
        issuance_status: "partial",
        expected_entries: 2,
        issued_entries: 1,
        email_status: "pending",
        email_next_attempt_at: null,
        email_sent_at: null,
      }),
      entries: [entry()],
    });
    assert.deepEqual(publicStatuses(map(valid)), {
      payment: "paid",
      fulfillment: "pending",
      email: "not_started",
    });
    assertInvalid({
      ...valid,
      fulfillment: fulfillment({
        issuance_status: "partial",
        expected_entries: 2,
        issued_entries: 2,
        email_next_attempt_at: null,
      }),
    });
    assertInvalid({ ...valid, entries: [entry("failed")] });
  });

  it("maps complete issuance with and without its independent review marker", () => {
    assert.deepEqual(publicStatuses(map(snapshot())), {
      payment: "paid",
      fulfillment: "issued",
      email: "pending",
    });
    assert.deepEqual(
      publicStatuses(map(snapshot({
        fulfillment: fulfillment({
          issuance_review_status: "manual_review",
          expected_entries: 2,
          issued_entries: 1,
        }),
        entries: [entry()],
      }))),
      { payment: "paid", fulfillment: "manual_review", email: "pending" },
    );
  });

  it("maps terminal issuance review only with clean, not-started email evidence", () => {
    const valid = snapshot({
      fulfillment: fulfillment({
        issuance_status: "manual_review",
        issuance_review_status: "none",
        expected_entries: 2,
        issued_entries: 1,
        email_status: "pending",
        email_next_attempt_at: null,
        email_sent_at: null,
      }),
      entries: [entry()],
    });
    assert.deepEqual(publicStatuses(map(valid)), {
      payment: "paid",
      fulfillment: "manual_review",
      email: "not_started",
    });
    assert.deepEqual(
      publicStatuses(map(snapshot({
        fulfillment: fulfillment({
          issuance_status: "manual_review",
          issuance_review_status: "none",
          expected_entries: 0,
          issued_entries: 0,
          email_status: "pending",
          email_next_attempt_at: null,
          email_sent_at: null,
        }),
        entries: [],
      }))),
      {
        payment: "paid",
        fulfillment: "manual_review",
        email: "not_started",
      },
    );
  });

  it("maps every complete email aggregate fail-closed", () => {
    const cases = [
      {
        input: completeSnapshot("pending", [entry(), entry()]),
        expected: "pending",
      },
      {
        input: completeSnapshot("processing", [entry(), entry()]),
        expected: "pending",
      },
      {
        input: completeSnapshot("failed", [entry("failed"), entry()]),
        expected: "retry_scheduled",
      },
      {
        input: completeSnapshot("sent", [entry("sent"), entry("sent")]),
        expected: "sent",
      },
      {
        input: completeSnapshot("manual_review", [entry(), entry()]),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("pending", [entry("sent"), entry("sent")]),
        expected: "sent",
      },
      {
        input: completeSnapshot("sent", [entry(), entry()]),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("pending", [entry("failed"), entry()]),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("processing", [entry("sent"), entry("sent")]),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("failed", [entry("sent"), entry("sent")]),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("pending", [entry("sent"), entry()]),
        expected: "manual_review",
      },
    ] as const;
    for (const testCase of cases) {
      assert.equal(publicStatuses(map(testCase.input)).email, testCase.expected);
    }
  });

  it("rejects malformed enums, nulls, shapes, per-entry timestamps and aggregate timestamps", () => {
    assertInvalid(completeSnapshot("sent", [entry("sent", null), entry("sent")]));
    assertInvalid(completeSnapshot("pending", [entry("not_sent", SENT_AT), entry()]));
    assertInvalid(snapshot({ entries: [{ email_status: "unknown", email_sent_at: null }] }));
    assertInvalid(snapshot({ entries: null }));
    assertInvalid(snapshot({ fulfillment: [fulfillment()] }));
    assertInvalid(snapshot({ fulfillment: { ...fulfillment(), invented: true } }));
    assertInvalid(snapshot({ entries: [{ ...entry(), invented: true }, entry()] }));
    assertInvalid(completeSnapshot("pending", [entry(), entry()], "none", {
      email_next_attempt_at: null,
    }));
    assertInvalid(completeSnapshot("processing", [entry(), entry()], "none", {
      email_next_attempt_at: NEXT_ATTEMPT,
    }));
    assertInvalid(completeSnapshot("failed", [entry(), entry()], "none", {
      email_next_attempt_at: "not-a-timestamp",
    }));
    assertInvalid(completeSnapshot("sent", [entry("sent"), entry("sent")], "none", {
      email_sent_at: null,
    }));
    assertInvalid(snapshot({ amount_gs: "12.5" }));
    assertInvalid(snapshot({ public_ref: OTHER_REF }));
  });

  it("covers the mandatory terminal issuance manual-review matrix", () => {
    const base = {
      issuance_status: "manual_review",
      issuance_review_status: "none",
      expected_entries: 2,
      issued_entries: 1,
      email_next_attempt_at: null,
      email_sent_at: null,
    };
    const valid = snapshot({
      fulfillment: fulfillment({ ...base, email_status: "pending" }),
      entries: [entry()],
    });
    assert.deepEqual(publicStatuses(map(valid)), {
      payment: "paid",
      fulfillment: "manual_review",
      email: "not_started",
    });

    const invalidCases = [
      snapshot({
        fulfillment: fulfillment({ ...base, email_status: "processing" }),
        entries: [entry()],
      }),
      snapshot({
        fulfillment: fulfillment({
          ...base,
          email_status: "failed",
          email_next_attempt_at: NEXT_ATTEMPT,
        }),
        entries: [entry()],
      }),
      snapshot({
        fulfillment: fulfillment({
          ...base,
          email_status: "sent",
          email_sent_at: SENT_AT,
        }),
        entries: [entry()],
      }),
      snapshot({
        fulfillment: fulfillment({ ...base, email_status: "manual_review" }),
        entries: [entry()],
      }),
      snapshot({
        fulfillment: fulfillment({ ...base, email_status: "pending" }),
        entries: [entry("sent")],
      }),
      snapshot({
        fulfillment: fulfillment({ ...base, email_status: "pending" }),
        entries: [entry("failed")],
      }),
    ];
    for (const input of invalidCases) assertInvalid(input);
  });

  it("covers the independent complete issuance review-marker matrix", () => {
    const reviewCounts = { expected_entries: 2, issued_entries: 2 };
    const cases = [
      {
        input: completeSnapshot("pending", [entry(), entry()], "manual_review", reviewCounts),
        expected: "pending",
      },
      {
        input: completeSnapshot("failed", [entry("failed"), entry()], "manual_review", reviewCounts),
        expected: "retry_scheduled",
      },
      {
        input: completeSnapshot("sent", [entry("sent"), entry("sent")], "manual_review", reviewCounts),
        expected: "sent",
      },
      {
        input: completeSnapshot("pending", [entry("sent"), entry("sent")], "manual_review", reviewCounts),
        expected: "sent",
      },
      {
        input: completeSnapshot("manual_review", [entry(), entry()], "manual_review", reviewCounts),
        expected: "manual_review",
      },
      {
        input: completeSnapshot("sent", [entry(), entry()], "manual_review", reviewCounts),
        expected: "manual_review",
      },
    ] as const;
    for (const testCase of cases) {
      const statuses = publicStatuses(map(testCase.input));
      assert.equal(statuses.fulfillment, "manual_review");
      assert.equal(statuses.email, testCase.expected);
    }
  });

  it("allows an empty projection only for a complete review marker with zero issued entries", () => {
    const input = completeSnapshot("pending", [], "manual_review", {
      expected_entries: 2,
      issued_entries: 0,
    });
    assert.deepEqual(publicStatuses(map(input)), {
      payment: "paid",
      fulfillment: "manual_review",
      email: "pending",
    });
    assertInvalid(completeSnapshot("pending", [], "none", {
      expected_entries: 2,
      issued_entries: 0,
    }));
  });

  it("returns a closed public order without internal snapshot fields", () => {
    const result = map(snapshot());
    assert.equal(result.kind, "found");
    if (result.kind !== "found") throw new Error("expected found");
    assert.deepEqual(Object.keys(result.order).sort(), [
      "access_date",
      "amount_gs",
      "currency",
      "email",
      "expires_at",
      "fulfillment",
      "ref",
      "source_type",
      "status",
    ]);
    const serialized = JSON.stringify(result.order);
    for (const forbidden of [
      "local_id",
      "event_id",
      "expected_entries",
      "issued_entries",
      "email_next_attempt_at",
      "email_sent_at",
      "error_code",
      "generation",
      "lease",
      "provider",
      "entry_ids",
      "checkin_token",
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });
});

interface FakeResponse {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly throws?: unknown;
}

class FakeRequest implements PromiseLike<{ data: unknown; error: unknown }> {
  constructor(
    private readonly operations: string[],
    private readonly response: FakeResponse,
  ) {}

  eq(column: string, value: string): FakeRequest {
    this.operations.push(`eq:${column}:${value}`);
    return this;
  }

  limit(count: number): FakeRequest {
    this.operations.push(`limit:${count}`);
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.operations.push("await");
    const promise = this.response.throws === undefined
      ? Promise.resolve({
          data: this.response.data ?? null,
          error: this.response.error ?? null,
        })
      : Promise.reject(this.response.throws);
    return promise.then(onfulfilled, onrejected);
  }
}

function fakeClient(response: FakeResponse) {
  const operations: string[] = [];
  const client: AccessPublicStatusSupabaseClient = {
    from(table) {
      operations.push(`from:${table}`);
      return {
        select(columns) {
          operations.push(`select:${columns}`);
          return new FakeRequest(operations, response);
        },
      };
    },
  };
  return { client, operations };
}

describe("createAccessPublicStatusReader", () => {
  it("performs exactly one minimal embedded snapshot query for the same public ref", async () => {
    const fixture = fakeClient({ data: [snapshot()] });
    const result = await createAccessPublicStatusReader(
      fixture.client,
      () => NOW_MS,
    ).read(PUBLIC_REF);
    assert.equal(result.kind, "found");
    assert.deepEqual(fixture.operations, [
      "from:access_orders",
      `select:${ACCESS_PUBLIC_STATUS_SELECT}`,
      `eq:public_ref:${PUBLIC_REF}`,
      "limit:2",
      "await",
    ]);
    assert.equal(fixture.operations.filter((value) => value === "from:access_orders").length, 1);

    for (const required of [
      "public_ref",
      "access_order_fulfillments",
      "expected_entries",
      "issued_entries",
      "access_entries!access_entries_order_id_fkey",
      "email_status",
      "email_sent_at",
    ]) {
      assert.equal(ACCESS_PUBLIC_STATUS_SELECT.includes(required), true);
    }
    for (const forbidden of [
      "buyer_",
      "attendee_",
      "checkin_token",
      "approved_payment_attempt_id",
      "entry_ids",
      "provider",
      "lease",
      "generation",
      "error_code",
      "request_hash",
    ]) {
      assert.equal(ACCESS_PUBLIC_STATUS_SELECT.includes(forbidden), false);
    }
    assert.equal(
      /(?:^|[,(]\s*)order_id(?:\s*[,)]|$)/.test(ACCESS_PUBLIC_STATUS_SELECT),
      false,
    );
  });

  it("discriminates found, not_found, read_error and invalid_snapshot without raw errors", async () => {
    const foundResult = await createAccessPublicStatusReader(
      fakeClient({ data: [snapshot()] }).client,
      () => NOW_MS,
    ).read(PUBLIC_REF);
    const notFoundResult = await createAccessPublicStatusReader(
      fakeClient({ data: [] }).client,
      () => NOW_MS,
    ).read(PUBLIC_REF);
    const raw = "buyer@example.test secret PostgREST details";
    const readErrorResult = await createAccessPublicStatusReader(
      fakeClient({ data: [snapshot()], error: { message: raw } }).client,
      () => NOW_MS,
    ).read(PUBLIC_REF);
    const thrownResult = await createAccessPublicStatusReader(
      fakeClient({ throws: new Error(raw) }).client,
      () => NOW_MS,
    ).read(PUBLIC_REF);
    const invalidResult = await createAccessPublicStatusReader(
      fakeClient({ data: [{ ...snapshot(), entries: null }] }).client,
      () => NOW_MS,
    ).read(PUBLIC_REF);

    assert.equal(foundResult.kind, "found");
    assert.deepEqual(notFoundResult, { kind: "not_found" });
    assert.deepEqual(readErrorResult, {
      kind: "read_error",
      errorCode: "access_public_status_read_error",
    });
    assert.deepEqual(thrownResult, readErrorResult);
    assert.deepEqual(invalidResult, {
      kind: "invalid_snapshot",
      errorCode: "access_public_status_invalid_snapshot",
    });
    assert.equal(JSON.stringify(readErrorResult).includes(raw), false);
    assert.equal(JSON.stringify(thrownResult).includes(raw), false);
  });

  it("rejects unexpected top-level and relationship cardinality", async () => {
    for (const data of [
      null,
      snapshot(),
      [snapshot(), snapshot()],
      [{ ...snapshot(), fulfillment: [fulfillment()] }],
      [{ ...snapshot(), entries: { email_status: "not_sent", email_sent_at: null } }],
    ]) {
      const result = await createAccessPublicStatusReader(
        fakeClient({ data }).client,
        () => NOW_MS,
      ).read(PUBLIC_REF);
      assert.equal(result.kind, "invalid_snapshot");
    }
  });

  it("never classifies ambiguous or divergent evidence as sent", () => {
    const cases = [
      completeSnapshot("sent", [entry(), entry()]),
      completeSnapshot("pending", [entry("sent"), entry()]),
      completeSnapshot("pending", [entry("failed"), entry()]),
      completeSnapshot("processing", [entry("sent"), entry("sent")]),
      completeSnapshot("failed", [entry("sent"), entry("sent")]),
      completeSnapshot("sent", [entry("sent", null), entry("sent")]),
    ];
    for (const input of cases) {
      const result = map(input);
      if (result.kind === "found") {
        assert.notEqual(result.order.email.status, "sent");
      } else {
        assert.equal(result.kind, "invalid_snapshot");
      }
    }
  });
});
