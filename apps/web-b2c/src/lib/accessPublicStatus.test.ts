import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessPublicStatusFetchError,
  EMPTY_ACCESS_PUBLIC_STATUS_STATE,
  MAX_POLL_MS,
  POLL_INTERVAL_MS,
  createAccessPublicStatusController,
  deriveAccessPublicStatusPrimary,
  fetchAccessPublicStatus,
  parseAccessPublicStatus,
  shouldAutoPoll,
} from "./accessPublicStatus";
import type {
  AccessPublicStatusControllerDependencies,
  AccessPublicStatusFetchResult,
  AccessPublicStatusOrder,
  AccessPublicStatusScheduler,
  PublicAccessEmailStatus,
  PublicAccessFulfillmentStatus,
  PublicAccessOrderStatus,
} from "./accessPublicStatus";

const REF_A = `acc_${"a".repeat(32)}`;
const REF_B = `acc_${"b".repeat(32)}`;

interface OrderOptions {
  status?: PublicAccessOrderStatus;
  fulfillment?: PublicAccessFulfillmentStatus;
  email?: PublicAccessEmailStatus;
  ref?: string;
}

function order(options: OrderOptions = {}): AccessPublicStatusOrder {
  const status = options.status ?? "paid";
  const defaultFulfillment = status === "paid" ? "issued" : "not_started";
  const defaultEmail = status === "paid" ? "sent" : "not_started";
  return {
    ref: options.ref ?? REF_A,
    status,
    source_type: "local",
    access_date: "2026-08-01",
    amount_gs: 125_000,
    currency: "PYG",
    expires_at: null,
    fulfillment: { status: options.fulfillment ?? defaultFulfillment },
    email: { status: options.email ?? defaultEmail },
    venue_name: "Sala Central",
  };
}

function payload(options: OrderOptions = {}) {
  return {
    ok: true as const,
    order: order(options),
  };
}

function found(value: AccessPublicStatusOrder): AccessPublicStatusFetchResult {
  return { kind: "found", order: value };
}

function deferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

interface ScheduledTask {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
}

class FakeClock {
  nowMs = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, ScheduledTask>();

  readonly scheduler: AccessPublicStatusScheduler = {
    setTimeout: (callback, delayMs) => {
      const id = this.nextId++;
      this.tasks.set(id, {
        id,
        at: this.nowMs + Math.max(0, delayMs),
        callback,
      });
      return id;
    },
    clearTimeout: (handle) => {
      this.tasks.delete(Number(handle));
    },
  };

  now = () => this.nowMs;

  jumpTo(targetMs: number): void {
    this.nowMs = targetMs;
  }

  advanceBy(durationMs: number): void {
    const targetMs = this.nowMs + durationMs;
    while (true) {
      const next = [...this.tasks.values()]
        .filter((task) => task.at <= targetMs)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0];
      if (!next) break;
      this.tasks.delete(next.id);
      this.nowMs = next.at;
      next.callback();
    }
    this.nowMs = targetMs;
  }

  pendingDelays(): number[] {
    return [...this.tasks.values()]
      .map((task) => task.at - this.nowMs)
      .sort((left, right) => left - right);
  }
}

function controllerDependencies(
  clock: FakeClock,
  fetchStatus: AccessPublicStatusControllerDependencies["fetchStatus"],
  overrides: Partial<AccessPublicStatusControllerDependencies> = {},
): AccessPublicStatusControllerDependencies {
  return {
    fetchStatus,
    now: clock.now,
    scheduler: clock.scheduler,
    pollIntervalMs: 3,
    maxPollMs: 20,
    ...overrides,
  };
}

test("public parser preserves the complete closed response", () => {
  const input = payload();
  const parsed = parseAccessPublicStatus(input);
  assert.deepEqual(parsed, input);
  assert.deepEqual(Object.keys(parsed.order).sort(), [
    "access_date",
    "amount_gs",
    "currency",
    "email",
    "expires_at",
    "fulfillment",
    "ref",
    "source_type",
    "status",
    "venue_name",
  ]);
});

test("public parser accepts every closed public enum and scalar alternative", () => {
  const valid = payload();

  for (const sourceType of ["local", "event"] as const) {
    const parsed = parseAccessPublicStatus({
      ...valid,
      order: { ...valid.order, source_type: sourceType },
    });
    assert.equal(parsed.order.source_type, sourceType);
  }

  for (const expiresAt of [null, "2026-08-01T12:00:00.000Z"] as const) {
    const parsed = parseAccessPublicStatus({
      ...valid,
      order: { ...valid.order, expires_at: expiresAt },
    });
    assert.equal(parsed.order.expires_at, expiresAt);
  }

  for (const status of [
    "pending_payment",
    "paid",
    "cancelled",
    "manual_review",
    "expired",
  ] as const) {
    assert.equal(parseAccessPublicStatus(payload({ status })).order.status, status);
  }

  for (const fulfillment of ["not_started", "pending", "issued", "manual_review"] as const) {
    for (const email of [
      "not_started",
      "pending",
      "retry_scheduled",
      "sent",
      "manual_review",
    ] as const) {
      const parsed = parseAccessPublicStatus(payload({ fulfillment, email }));
      assert.equal(parsed.order.fulfillment.status, fulfillment);
      assert.equal(parsed.order.email.status, email);
    }
  }
});

test("public parser rejects missing, null, and legacy-incomplete dimensions", () => {
  const valid = payload();
  const withoutFulfillment = { ...valid, order: { ...valid.order } } as Record<string, unknown> & {
    order: Record<string, unknown>;
  };
  delete withoutFulfillment.order.fulfillment;
  const withoutEmail = { ...valid, order: { ...valid.order } } as Record<string, unknown> & {
    order: Record<string, unknown>;
  };
  delete withoutEmail.order.email;
  const legacyWithoutDimensions = {
    ...valid,
    order: { ...valid.order },
  } as Record<string, unknown> & { order: Record<string, unknown> };
  delete legacyWithoutDimensions.order.fulfillment;
  delete legacyWithoutDimensions.order.email;

  assert.throws(() => parseAccessPublicStatus(withoutFulfillment));
  assert.throws(() => parseAccessPublicStatus(withoutEmail));
  assert.throws(() => parseAccessPublicStatus(legacyWithoutDimensions));
  assert.throws(() =>
    parseAccessPublicStatus({
      ...valid,
      order: { ...valid.order, fulfillment: null },
    }),
  );
  assert.throws(() =>
    parseAccessPublicStatus({
      ...valid,
      order: { ...valid.order, email: null },
    }),
  );
});

test("public parser rejects unknown enums and invalid scalar shapes", () => {
  const valid = payload();
  for (const changed of [
    { ...valid.order, status: "refunded" },
    { ...valid.order, fulfillment: { status: "complete" } },
    { ...valid.order, email: { status: "delivered" } },
    { ...valid.order, amount_gs: 12.5 },
    { ...valid.order, ref: "acc_invalid" },
    { ...valid.order, expires_at: "not-a-timestamp" },
  ]) {
    assert.throws(() => parseAccessPublicStatus({ ok: true, order: changed }));
  }
});

test("public parser rejects unexpected public and internal-looking properties", () => {
  const valid = payload();
  assert.throws(() => parseAccessPublicStatus({ ...valid, extra: true }));
  assert.throws(() =>
    parseAccessPublicStatus({
      ...valid,
      order: { ...valid.order, invented: true },
    }),
  );
  assert.throws(() =>
    parseAccessPublicStatus({
      ...valid,
      order: {
        ...valid.order,
        fulfillment: { ...valid.order.fulfillment, provider_metadata: "negative fixture" },
      },
    }),
  );
  assert.throws(() =>
    parseAccessPublicStatus({
      ...valid,
      order: {
        ...valid.order,
        email: { ...valid.order.email, attempt_count: 1 },
      },
    }),
  );
});

test("public parser rejects a non-paid response that asserts downstream progress", () => {
  assert.throws(() =>
    parseAccessPublicStatus(
      payload({
        status: "pending_payment",
        fulfillment: "issued",
        email: "sent",
      }),
    ),
  );
});

test("fetcher sends one abortable GET and classifies 404 separately", async () => {
  const abortController = new AbortController();
  const calls: Array<{ input: string; signal: AbortSignal; method: string; accept: string }> = [];
  let jsonCalls = 0;
  const result = await fetchAccessPublicStatus(
    "https://api.example.test/",
    REF_A,
    abortController.signal,
    async (input, init) => {
      calls.push({
        input,
        signal: init.signal,
        method: init.method,
        accept: init.headers.Accept,
      });
      return {
        ok: false,
        status: 404,
        async json() {
          jsonCalls += 1;
          return null;
        },
      };
    },
  );

  assert.deepEqual(result, { kind: "not_found" });
  assert.equal(jsonCalls, 0);
  assert.deepEqual(calls, [
    {
      input: `https://api.example.test/payments/access/status?ref=${REF_A}`,
      signal: abortController.signal,
      method: "GET",
      accept: "application/json",
    },
  ]);
});

test("fetcher rejects non-404 HTTP errors, invalid bodies, and mismatched refs", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    fetchAccessPublicStatus("https://api.example.test", REF_A, signal, async () => ({
      ok: false,
      status: 500,
      async json() {
        return null;
      },
    })),
    (error: unknown) =>
      error instanceof AccessPublicStatusFetchError && error.code === "http_error",
  );
  await assert.rejects(
    fetchAccessPublicStatus("https://api.example.test", REF_A, signal, async () => ({
      ok: true,
      status: 200,
      async json() {
        return { ok: true, order: { status: "paid" } };
      },
    })),
    (error: unknown) =>
      error instanceof AccessPublicStatusFetchError && error.code === "invalid_response",
  );
  await assert.rejects(
    fetchAccessPublicStatus("https://api.example.test", REF_A, signal, async () => ({
      ok: true,
      status: 200,
      async json() {
        return payload({ ref: REF_B });
      },
    })),
    (error: unknown) =>
      error instanceof AccessPublicStatusFetchError && error.code === "invalid_response",
  );
});

test("visual derivation covers every closed precedence branch", () => {
  const cases: Array<[OrderOptions, ReturnType<typeof deriveAccessPublicStatusPrimary>]> = [
    [{ status: "pending_payment" }, "payment_pending"],
    [{ status: "cancelled" }, "payment_cancelled"],
    [{ status: "expired" }, "payment_expired"],
    [{ status: "manual_review" }, "payment_manual_review"],
    [{ fulfillment: "not_started", email: "not_started" }, "fulfillment_pending"],
    [{ fulfillment: "pending", email: "not_started" }, "fulfillment_pending"],
    [{ fulfillment: "manual_review", email: "not_started" }, "fulfillment_manual_review"],
    [{ fulfillment: "issued", email: "not_started" }, "email_pending"],
    [{ fulfillment: "issued", email: "pending" }, "email_pending"],
    [{ fulfillment: "issued", email: "retry_scheduled" }, "email_retry_scheduled"],
    [{ fulfillment: "issued", email: "sent" }, "email_sent"],
    [{ fulfillment: "issued", email: "manual_review" }, "email_manual_review"],
  ];

  for (const [options, expected] of cases) {
    assert.equal(deriveAccessPublicStatusPrimary(order(options)), expected);
  }
});

test("fulfillment review dominates, preserves email evidence, and stops polling", () => {
  for (const email of ["pending", "retry_scheduled", "sent", "manual_review"] as const) {
    const value = order({ fulfillment: "manual_review", email });
    assert.equal(deriveAccessPublicStatusPrimary(value), "fulfillment_manual_review");
    assert.equal(value.email.status, email);
    assert.equal(shouldAutoPoll(value), false);
  }
});

test("auto-poll continuation and stop rules are exhaustive", () => {
  const continuing: OrderOptions[] = [
    { status: "pending_payment" },
    { fulfillment: "not_started", email: "not_started" },
    { fulfillment: "pending", email: "not_started" },
    { fulfillment: "issued", email: "not_started" },
    { fulfillment: "issued", email: "pending" },
    { fulfillment: "issued", email: "retry_scheduled" },
  ];
  const stopping: OrderOptions[] = [
    { status: "cancelled" },
    { status: "expired" },
    { status: "manual_review" },
    { fulfillment: "manual_review", email: "sent" },
    { fulfillment: "issued", email: "sent" },
    { fulfillment: "issued", email: "manual_review" },
  ];

  for (const options of continuing) assert.equal(shouldAutoPoll(order(options)), true);
  for (const options of stopping) assert.equal(shouldAutoPoll(order(options)), false);
  assert.equal(POLL_INTERVAL_MS, 3_000);
  assert.equal(MAX_POLL_MS, 60_000);
});

test("controller waits for completion before starting the next poll interval", async () => {
  const clock = new FakeClock();
  const first = deferred<AccessPublicStatusFetchResult>();
  const calls: string[] = [];
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, (ref) => {
      calls.push(ref);
      if (calls.length === 1) return first.promise;
      return Promise.resolve(found(order({ status: "cancelled" })));
    }),
  );

  controller.start(REF_A);
  assert.deepEqual(calls, [REF_A]);
  clock.advanceBy(5);
  assert.deepEqual(calls, [REF_A]);

  first.resolve(found(order({ status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().isAutoPolling, true);
  assert.deepEqual(clock.pendingDelays(), [3, 15]);

  clock.advanceBy(2);
  assert.equal(calls.length, 1);
  clock.advanceBy(1);
  assert.equal(calls.length, 2);
  await flushPromises();
  assert.equal(controller.getState().primary, "payment_cancelled");
  assert.equal(controller.getState().isAutoPolling, false);
  controller.dispose();
});

test("controller permits only one request in flight", () => {
  const clock = new FakeClock();
  const pending = deferred<AccessPublicStatusFetchResult>();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, () => {
      calls += 1;
      return pending.promise;
    }),
  );

  controller.start(REF_A);
  assert.equal(controller.refresh(), false);
  clock.advanceBy(3);
  assert.equal(calls, 1);
  assert.equal(controller.getState().requestKind, "initial");
  controller.dispose();
});

test("changing refs aborts the old request and ignores its late response", async () => {
  const clock = new FakeClock();
  const first = deferred<AccessPublicStatusFetchResult>();
  const second = deferred<AccessPublicStatusFetchResult>();
  const signals: AbortSignal[] = [];
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, (ref, signal) => {
      signals.push(signal);
      return ref === REF_A ? first.promise : second.promise;
    }),
  );

  controller.start(REF_A);
  controller.start(REF_B);
  assert.equal(signals[0]?.aborted, true);
  assert.equal(signals[1]?.aborted, false);

  second.resolve(found(order({ ref: REF_B, fulfillment: "issued", email: "sent" })));
  await flushPromises();
  assert.equal(controller.getState().ref, REF_B);
  assert.equal(controller.getState().primary, "email_sent");

  first.resolve(found(order({ ref: REF_A, status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().ref, REF_B);
  assert.equal(controller.getState().order?.ref, REF_B);
  assert.equal(controller.getState().primary, "email_sent");
  controller.dispose();
});

test("dispose aborts a pending request and prevents late state or timer work", async () => {
  const clock = new FakeClock();
  const pending = deferred<AccessPublicStatusFetchResult>();
  let calls = 0;
  let requestSignal: AbortSignal | undefined;
  let publications = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, (_ref, signal) => {
      calls += 1;
      requestSignal = signal;
      return pending.promise;
    }),
  );
  controller.subscribe(() => {
    publications += 1;
  });

  controller.start(REF_A);
  assert.equal(calls, 1);
  assert.equal(requestSignal?.aborted, false);
  assert.deepEqual(clock.pendingDelays(), [20]);
  const stateAtDispose = controller.getState();
  const publicationsAtDispose = publications;

  controller.dispose();
  assert.equal(requestSignal?.aborted, true);
  assert.deepEqual(clock.pendingDelays(), []);

  pending.resolve(found(order({ fulfillment: "issued", email: "sent" })));
  await flushPromises();
  clock.advanceBy(100);
  await flushPromises();

  assert.equal(calls, 1);
  assert.equal(publications, publicationsAtDispose);
  assert.deepEqual(controller.getState(), stateAtDispose);
  assert.deepEqual(clock.pendingDelays(), []);
});

test("deadline before the initial request yields timeout without a GET", () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(
      clock,
      async () => {
        calls += 1;
        return found(order());
      },
      { maxPollMs: 0 },
    ),
  );

  controller.start(REF_A);
  assert.equal(calls, 0);
  assert.equal(controller.getState().primary, "poll_timeout");
  assert.equal(controller.getState().order, null);
  controller.dispose();
});

test("deadline during a slow request aborts and ignores the late response", async () => {
  const clock = new FakeClock();
  const pending = deferred<AccessPublicStatusFetchResult>();
  let signal: AbortSignal | undefined;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, (_ref, requestSignal) => {
      signal = requestSignal;
      return pending.promise;
    }),
  );

  controller.start(REF_A);
  clock.advanceBy(20);
  assert.equal(signal?.aborted, true);
  assert.equal(controller.getState().primary, "poll_timeout");
  assert.equal(controller.getState().order, null);

  pending.resolve(found(order({ status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().primary, "poll_timeout");
  assert.equal(controller.getState().order, null);
  controller.dispose();
});

test("post-request deadline check wins even if the deadline callback has not run", async () => {
  const clock = new FakeClock();
  const pending = deferred<AccessPublicStatusFetchResult>();
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, () => pending.promise),
  );

  controller.start(REF_A);
  clock.jumpTo(20);
  pending.resolve(found(order({ status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().primary, "poll_timeout");
  assert.equal(controller.getState().order, null);
  assert.deepEqual(clock.pendingDelays(), []);
  controller.dispose();
});

test("timeout preserves the last valid state and publishes a warning", async () => {
  const clock = new FakeClock();
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => found(order({ status: "pending_payment" }))),
  );

  controller.start(REF_A);
  await flushPromises();
  clock.advanceBy(20);
  assert.equal(controller.getState().order?.status, "pending_payment");
  assert.equal(controller.getState().primary, "payment_pending");
  assert.equal(controller.getState().warning, "poll_timeout");
  assert.equal(controller.getState().isAutoPolling, false);
  controller.dispose();
});

test("manual refresh performs exactly one non-concurrent GET and never restarts stopped polling", async () => {
  const clock = new FakeClock();
  const refreshResult = deferred<AccessPublicStatusFetchResult>();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => {
      calls += 1;
      if (calls === 1) return found(order({ email: "sent" }));
      return refreshResult.promise;
    }),
  );

  controller.start(REF_A);
  await flushPromises();
  assert.equal(controller.getState().isAutoPolling, false);
  assert.equal(controller.refresh(), true);
  assert.equal(controller.refresh(), false);
  assert.equal(calls, 2);

  refreshResult.resolve(found(order({ status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().primary, "payment_pending");
  assert.equal(controller.getState().isAutoPolling, false);
  assert.deepEqual(clock.pendingDelays(), []);
  clock.advanceBy(100);
  assert.equal(calls, 2);
  controller.dispose();
});

test("refresh between automatic polls is single-flight and preserves the original deadline", async () => {
  const clock = new FakeClock();
  const refreshResult = deferred<AccessPublicStatusFetchResult>();
  const laterPoll = deferred<AccessPublicStatusFetchResult>();
  const signals: AbortSignal[] = [];
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, (_ref, signal) => {
      calls += 1;
      signals.push(signal);
      if (calls === 1) return Promise.resolve(found(order({ status: "pending_payment" })));
      if (calls === 2) return refreshResult.promise;
      return laterPoll.promise;
    }),
  );

  controller.start(REF_A);
  await flushPromises();
  assert.equal(calls, 1);
  assert.equal(controller.getState().isAutoPolling, true);
  clock.advanceBy(1);
  assert.deepEqual(clock.pendingDelays(), [2, 19]);

  assert.equal(controller.refresh(), true);
  assert.equal(controller.refresh(), false);
  assert.equal(calls, 2);
  assert.equal(controller.getState().requestKind, "refresh");
  assert.deepEqual(clock.pendingDelays(), [19]);

  clock.advanceBy(4);
  assert.equal(calls, 2);
  refreshResult.resolve(found(order({ status: "pending_payment" })));
  await flushPromises();
  assert.equal(controller.getState().isAutoPolling, true);
  assert.deepEqual(clock.pendingDelays(), [3, 15]);

  clock.advanceBy(3);
  assert.equal(calls, 3);
  assert.equal(controller.getState().requestKind, "poll");
  assert.equal(signals[2]?.aborted, false);

  clock.advanceBy(12);
  assert.equal(signals[2]?.aborted, true);
  assert.equal(controller.getState().warning, "poll_timeout");
  assert.equal(controller.getState().isAutoPolling, false);
  assert.deepEqual(clock.pendingDelays(), []);

  laterPoll.resolve(found(order({ fulfillment: "issued", email: "sent" })));
  await flushPromises();
  clock.advanceBy(100);
  assert.equal(calls, 3);
  assert.equal(controller.getState().warning, "poll_timeout");
  controller.dispose();
});

test("manual refresh observes sent email after fulfillment review without restarting polling", async () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => {
      calls += 1;
      return calls === 1
        ? found(order({ fulfillment: "manual_review", email: "retry_scheduled" }))
        : found(order({ fulfillment: "manual_review", email: "sent" }));
    }),
  );

  controller.start(REF_A);
  await flushPromises();
  assert.equal(controller.getState().primary, "fulfillment_manual_review");
  assert.equal(controller.getState().order?.email.status, "retry_scheduled");
  assert.equal(controller.getState().isAutoPolling, false);
  assert.deepEqual(clock.pendingDelays(), []);

  assert.equal(controller.refresh(), true);
  await flushPromises();
  assert.equal(calls, 2);
  assert.equal(controller.getState().primary, "fulfillment_manual_review");
  assert.equal(controller.getState().order?.email.status, "sent");
  assert.equal(controller.getState().isAutoPolling, false);
  assert.deepEqual(clock.pendingDelays(), []);
  clock.advanceBy(100);
  assert.equal(calls, 2);
  controller.dispose();
});

test("initial and later non-404 errors are classified without erasing valid state", async () => {
  const initialClock = new FakeClock();
  const initial = createAccessPublicStatusController(
    controllerDependencies(initialClock, async () => {
      throw new Error("unavailable");
    }),
  );
  initial.start(REF_A);
  await flushPromises();
  assert.equal(initial.getState().primary, "initial_error");
  assert.equal(initial.getState().order, null);
  initial.dispose();

  const pollClock = new FakeClock();
  let calls = 0;
  const polling = createAccessPublicStatusController(
    controllerDependencies(pollClock, async () => {
      calls += 1;
      if (calls === 1) return found(order({ status: "pending_payment" }));
      throw new Error("poll failed");
    }),
  );
  polling.start(REF_A);
  await flushPromises();
  pollClock.advanceBy(3);
  await flushPromises();
  assert.equal(polling.getState().order?.status, "pending_payment");
  assert.equal(polling.getState().primary, "payment_pending");
  assert.equal(polling.getState().warning, "poll_error");
  assert.equal(polling.getState().isAutoPolling, false);
  polling.dispose();
});

test("initial and later 404 responses are classified without erasing valid state", async () => {
  const initialClock = new FakeClock();
  const initial = createAccessPublicStatusController(
    controllerDependencies(initialClock, async () => ({ kind: "not_found" })),
  );
  initial.start(REF_A);
  await flushPromises();
  assert.equal(initial.getState().primary, "not_found");
  assert.equal(initial.getState().order, null);
  initial.dispose();

  const pollClock = new FakeClock();
  let calls = 0;
  const polling = createAccessPublicStatusController(
    controllerDependencies(pollClock, async () => {
      calls += 1;
      return calls === 1
        ? found(order({ status: "pending_payment" }))
        : { kind: "not_found" };
    }),
  );
  polling.start(REF_A);
  await flushPromises();
  pollClock.advanceBy(3);
  await flushPromises();
  assert.equal(polling.getState().order?.status, "pending_payment");
  assert.equal(polling.getState().warning, "not_found_after_valid");
  assert.equal(polling.getState().isAutoPolling, false);
  polling.dispose();
});

test("refresh errors preserve the last valid state and use refresh_error", async () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => {
      calls += 1;
      if (calls === 1) return found(order({ email: "sent" }));
      throw new Error("refresh failed");
    }),
  );

  controller.start(REF_A);
  await flushPromises();
  assert.equal(controller.refresh(), true);
  await flushPromises();
  assert.equal(controller.getState().order?.email.status, "sent");
  assert.equal(controller.getState().primary, "email_sent");
  assert.equal(controller.getState().warning, "refresh_error");
  controller.dispose();
});

test("refresh after timeout updates state but does not reactivate auto-polling", async () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => {
      calls += 1;
      return found(order({ status: "pending_payment" }));
    }),
  );

  controller.start(REF_A);
  await flushPromises();
  clock.advanceBy(20);
  assert.equal(controller.getState().warning, "poll_timeout");
  assert.equal(controller.refresh(), true);
  await flushPromises();
  assert.equal(calls >= 2, true);
  assert.equal(controller.getState().warning, null);
  assert.equal(controller.getState().primary, "payment_pending");
  assert.equal(controller.getState().isAutoPolling, false);
  assert.deepEqual(clock.pendingDelays(), []);
  controller.dispose();
});

test("empty ref is not-found without a request and empty state is inert", () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = createAccessPublicStatusController(
    controllerDependencies(clock, async () => {
      calls += 1;
      return found(order());
    }),
  );

  assert.deepEqual(controller.getState(), EMPTY_ACCESS_PUBLIC_STATUS_STATE);
  controller.start("   ");
  assert.equal(calls, 0);
  assert.equal(controller.getState().primary, "not_found");
  assert.equal(controller.refresh(), false);
  controller.dispose();
});
