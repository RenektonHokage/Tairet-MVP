import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadAccessEmailMessageData } from "./accessEmailMessageData";
import {
  ACCESS_EMAIL_MESSAGE_DATA_SELECT,
  createAccessEmailMessageDataSupabaseReader,
  type AccessEmailMessageDataSupabaseClient,
} from "./accessEmailMessageDataSupabase";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const TICKET_ID = "22222222-2222-4222-8222-222222222222";
const ENTRY_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "44444444-4444-4444-8444-444444444444";
const EXPECTED_SELECT = Object.freeze({
  order:
    "id, public_ref, source_type, local_id, event_id, access_date, buyer_name, buyer_last_name, buyer_email, status",
  orderItems:
    "id, order_id, access_ticket_type_id, name_snapshot, quantity, entries_per_unit",
  entries:
    "id, order_id, order_item_id, access_ticket_type_id, unit_index, checkin_token, attendee_name, attendee_last_name, access_date, status, checkin_status",
  local: "name",
  event: "title",
});

interface FakeResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface FakeResponse {
  readonly result?: FakeResult;
  readonly throws?: unknown;
  readonly throwsAt?:
    | "from"
    | "select"
    | "eq"
    | "abortSignal"
    | "maybeSingle"
    | "await";
  readonly beforeResolve?: () => void;
}

interface FakeClientFixture {
  readonly client: AccessEmailMessageDataSupabaseClient;
  readonly operations: string[];
  readonly signals: AbortSignal[];
}

class FakeRequest implements PromiseLike<FakeResult> {
  constructor(
    private readonly operations: string[],
    private readonly signals: AbortSignal[],
    private readonly response: FakeResponse,
  ) {}

  eq(column: string, value: string): FakeRequest {
    this.operations.push("eq:" + column + ":" + value);
    this.throwAt("eq");
    return this;
  }

  abortSignal(signal: AbortSignal): FakeRequest {
    this.operations.push("abortSignal");
    this.signals.push(signal);
    this.throwAt("abortSignal");
    return this;
  }

  maybeSingle(): FakeRequest {
    this.operations.push("maybeSingle");
    this.throwAt("maybeSingle");
    return this;
  }

  private throwAt(phase: FakeResponse["throwsAt"]): void {
    if (this.response.throwsAt === phase) {
      throw this.response.throws ?? new Error("fake builder failure");
    }
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.operations.push("await");
    this.response.beforeResolve?.();
    this.throwAt("await");
    const promise =
      this.response.throws === undefined
        ? Promise.resolve(
            this.response.result ?? { data: null, error: null },
          )
        : Promise.reject(this.response.throws);
    return promise.then(onfulfilled, onrejected);
  }
}

function fakeClient(
  responseByTable: Readonly<Record<string, FakeResponse>>,
): FakeClientFixture {
  const operations: string[] = [];
  const signals: AbortSignal[] = [];
  const client: AccessEmailMessageDataSupabaseClient = {
    from(table) {
      operations.push("from:" + table);
      const response = responseByTable[table] ?? {};
      if (response.throwsAt === "from") {
        throw response.throws ?? new Error("fake from failure");
      }
      return {
        select(columns) {
          operations.push("select:" + columns);
          if (response.throwsAt === "select") {
            throw response.throws ?? new Error("fake select failure");
          }
          return new FakeRequest(
            operations,
            signals,
            response,
          );
        },
      };
    },
  };
  return { client, operations, signals };
}

function orderRow(sourceType: "local" | "event" = "local") {
  return {
    id: ORDER_ID,
    public_ref: "ACC-42",
    source_type: sourceType,
    local_id: sourceType === "local" ? LOCAL_ID : null,
    event_id: sourceType === "event" ? EVENT_ID : null,
    access_date: "2026-08-10",
    buyer_name: "Mateo",
    buyer_last_name: "Test",
    buyer_email: "buyer@example.test",
    status: "paid",
  };
}

function itemRows() {
  return [
    {
      id: ITEM_ID,
      order_id: ORDER_ID,
      access_ticket_type_id: TICKET_ID,
      name_snapshot: "General",
      quantity: 1,
      entries_per_unit: 1,
    },
  ];
}

function entryRows() {
  return [
    {
      id: ENTRY_ID,
      order_id: ORDER_ID,
      order_item_id: ITEM_ID,
      access_ticket_type_id: TICKET_ID,
      unit_index: 1,
      checkin_token: TOKEN,
      attendee_name: "Mateo",
      attendee_last_name: "Test",
      access_date: "2026-08-10",
      status: "issued",
      checkin_status: "unused",
    },
  ];
}

describe("createAccessEmailMessageDataSupabaseReader", () => {
  it("uses exact read-only tables, literal selects, filters, signals and maybeSingle policy", async () => {
    assert.deepEqual(ACCESS_EMAIL_MESSAGE_DATA_SELECT, EXPECTED_SELECT);
    const cases = [
      {
        invoke: "order",
        table: "access_orders",
        select: EXPECTED_SELECT.order,
        filter: "eq:id:" + ORDER_ID,
        maybeSingle: true,
        data: orderRow(),
      },
      {
        invoke: "items",
        table: "access_order_items",
        select: EXPECTED_SELECT.orderItems,
        filter: "eq:order_id:" + ORDER_ID,
        maybeSingle: false,
        data: itemRows(),
      },
      {
        invoke: "entries",
        table: "access_entries",
        select: EXPECTED_SELECT.entries,
        filter: "eq:order_id:" + ORDER_ID,
        maybeSingle: false,
        data: entryRows(),
      },
      {
        invoke: "local",
        table: "locals",
        select: EXPECTED_SELECT.local,
        filter: "eq:id:" + LOCAL_ID,
        maybeSingle: true,
        data: { name: "Local Uno" },
      },
      {
        invoke: "event",
        table: "events",
        select: EXPECTED_SELECT.event,
        filter: "eq:id:" + EVENT_ID,
        maybeSingle: true,
        data: { title: "Evento Uno" },
      },
    ] as const;

    for (const testCase of cases) {
      const fixture = fakeClient({
        [testCase.table]: {
          result: { data: testCase.data, error: null },
        },
      });
      const reader = createAccessEmailMessageDataSupabaseReader(
        fixture.client,
      );
      const controller = new AbortController();
      if (testCase.invoke === "order") {
        await reader.readOrder(ORDER_ID, { signal: controller.signal });
      } else if (testCase.invoke === "items") {
        await reader.readOrderItems(ORDER_ID, {
          signal: controller.signal,
        });
      } else if (testCase.invoke === "entries") {
        await reader.readEntries(ORDER_ID, { signal: controller.signal });
      } else if (testCase.invoke === "local") {
        await reader.readLocal(LOCAL_ID, { signal: controller.signal });
      } else {
        await reader.readEvent(EVENT_ID, { signal: controller.signal });
      }
      const expected = [
        "from:" + testCase.table,
        "select:" + testCase.select,
        testCase.filter,
        "abortSignal",
        ...(testCase.maybeSingle ? ["maybeSingle"] : []),
        "await",
      ];
      assert.deepEqual(fixture.operations, expected);
      assert.deepEqual(fixture.signals, [controller.signal]);
      assert.equal(fixture.operations.join("|").includes("email_status"), false);
      assert.equal(fixture.operations.join("|").includes("email_sent_at"), false);
      assert.equal(fixture.operations.join("|").includes("insert"), false);
      assert.equal(fixture.operations.join("|").includes("update"), false);
      assert.equal(fixture.operations.join("|").includes("delete"), false);
      assert.equal(fixture.operations.join("|").includes("upsert"), false);
      assert.equal(fixture.operations.join("|").includes("rpc"), false);
    }
  });

  it("does not construct a PostgREST query for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fixture = fakeClient({
      access_orders: { result: { data: orderRow(), error: null } },
    });
    const reader = createAccessEmailMessageDataSupabaseReader(fixture.client);
    const result = await reader.readOrder(ORDER_ID, {
      signal: controller.signal,
    });
    assert.deepEqual(result, { kind: "aborted" });
    assert.deepEqual(fixture.operations, []);
    assert.deepEqual(fixture.signals, []);
  });

  it("returns parsed success and legitimate maybeSingle null", async () => {
    const fixture = fakeClient({
      access_orders: { result: { data: orderRow(), error: null } },
      locals: { result: { data: null, error: null } },
    });
    const reader = createAccessEmailMessageDataSupabaseReader(fixture.client);
    const order = await reader.readOrder(ORDER_ID);
    const local = await reader.readLocal(LOCAL_ID);
    assert.deepEqual(order, { kind: "success", data: orderRow() });
    assert.deepEqual(local, { kind: "success", data: null });
    assert.ok(
      order.kind === "success" && Object.isFrozen(order.data),
    );
  });

  it("rejects malformed rows and arrays before returning them", async () => {
    const malformedOrder = fakeClient({
      access_orders: {
        result: {
          data: { ...orderRow(), invented: true },
          error: null,
        },
      },
    });
    const malformedItems = fakeClient({
      access_order_items: {
        result: { data: null, error: null },
      },
    });
    const malformedEntries = fakeClient({
      access_entries: {
        result: { data: { not: "an array" }, error: null },
      },
    });
    const malformedLocal = fakeClient({
      locals: {
        result: { data: { name: 42 }, error: null },
      },
    });
    const malformedEvent = fakeClient({
      events: {
        result: {
          data: { title: "Evento", invented: true },
          error: null,
        },
      },
    });
    const orderReader = createAccessEmailMessageDataSupabaseReader(
      malformedOrder.client,
    );
    const itemsReader = createAccessEmailMessageDataSupabaseReader(
      malformedItems.client,
    );
    const entriesReader = createAccessEmailMessageDataSupabaseReader(
      malformedEntries.client,
    );
    const localReader = createAccessEmailMessageDataSupabaseReader(
      malformedLocal.client,
    );
    const eventReader = createAccessEmailMessageDataSupabaseReader(
      malformedEvent.client,
    );
    assert.deepEqual(await orderReader.readOrder(ORDER_ID), {
      kind: "invalid_data",
    });
    assert.deepEqual(await itemsReader.readOrderItems(ORDER_ID), {
      kind: "invalid_data",
    });
    assert.deepEqual(await entriesReader.readEntries(ORDER_ID), {
      kind: "invalid_data",
    });
    assert.deepEqual(await localReader.readLocal(LOCAL_ID), {
      kind: "invalid_data",
    });
    assert.deepEqual(await eventReader.readEvent(EVENT_ID), {
      kind: "invalid_data",
    });
  });

  it("sanitizes PostgREST errors and thrown transport failures", async () => {
    const raw = "buyer@example.test SQL access_orders";
    const rawError = {
      message: raw,
      details: "secret details",
      hint: "secret hint",
      code: "PGRST999",
      url: "https://database.example.test",
      headers: { authorization: "secret" },
    };
    const errorFixture = fakeClient({
      access_orders: {
        result: { data: orderRow(), error: rawError },
      },
    });
    const thrownFixture = fakeClient({
      access_orders: { throws: new Error(raw) },
    });
    const errorResult =
      await createAccessEmailMessageDataSupabaseReader(
        errorFixture.client,
      ).readOrder(ORDER_ID);
    const thrownResult =
      await createAccessEmailMessageDataSupabaseReader(
        thrownFixture.client,
      ).readOrder(ORDER_ID);
    assert.deepEqual(errorResult, { kind: "transport_error" });
    assert.deepEqual(thrownResult, { kind: "transport_error" });
    assert.equal(JSON.stringify(errorResult).includes(raw), false);
    assert.equal(JSON.stringify(thrownResult).includes(raw), false);
    for (const secret of [
      rawError.details,
      rawError.hint,
      rawError.code,
      rawError.url,
      rawError.headers.authorization,
    ]) {
      assert.equal(JSON.stringify(errorResult).includes(secret), false);
      assert.equal(JSON.stringify(thrownResult).includes(secret), false);
    }
  });

  it("sanitizes synchronous failures from every query-builder phase", async () => {
    const raw = "builder leaked buyer@example.test";
    const phases: readonly NonNullable<FakeResponse["throwsAt"]>[] = [
      "from",
      "select",
      "eq",
      "abortSignal",
      "maybeSingle",
      "await",
    ];
    for (const phase of phases) {
      const fixture = fakeClient({
        access_orders: {
          throwsAt: phase,
          throws: new Error(raw),
        },
      });
      const controller = new AbortController();
      const result =
        await createAccessEmailMessageDataSupabaseReader(
          fixture.client,
        ).readOrder(ORDER_ID, { signal: controller.signal });
      assert.deepEqual(result, { kind: "transport_error" });
      assert.equal(JSON.stringify(result).includes(raw), false);
    }
  });

  it("gives abort precedence before inspecting PostgREST data or errors", async () => {
    const controller = new AbortController();
    const unreadableResult: FakeResult = {
      get data() {
        throw new Error("data must not be inspected after abort");
      },
      get error() {
        throw new Error("error must not be inspected after abort");
      },
    };
    const fixture = fakeClient({
      access_orders: {
        result: unreadableResult,
        beforeResolve: () => controller.abort(),
      },
    });
    const result =
      await createAccessEmailMessageDataSupabaseReader(
        fixture.client,
      ).readOrder(ORDER_ID, { signal: controller.signal });
    assert.deepEqual(result, { kind: "aborted" });
    assert.deepEqual(fixture.signals, [controller.signal]);
  });

  it("queries only the source selected by the order", async () => {
    for (const sourceType of ["local", "event"] as const) {
      const fixture = fakeClient({
        access_orders: {
          result: { data: orderRow(sourceType), error: null },
        },
        access_order_items: {
          result: { data: itemRows(), error: null },
        },
        access_entries: {
          result: { data: entryRows(), error: null },
        },
        locals: {
          result: { data: { name: "Local Uno" }, error: null },
        },
        events: {
          result: { data: { title: "Evento Uno" }, error: null },
        },
      });
      const reader = createAccessEmailMessageDataSupabaseReader(
        fixture.client,
      );
      const result = await loadAccessEmailMessageData(reader, ORDER_ID);
      assert.equal(result.kind, "success");
      const fromOperations = fixture.operations.filter((operation) =>
        operation.startsWith("from:"),
      );
      assert.deepEqual(fromOperations, [
        "from:access_orders",
        "from:access_order_items",
        "from:access_entries",
        sourceType === "local" ? "from:locals" : "from:events",
      ]);
    }
  });

  it("does not start later queries when abort occurs after an adapter await", async () => {
    const controller = new AbortController();
    const fixture = fakeClient({
      access_orders: {
        result: { data: orderRow(), error: null },
      },
      access_order_items: {
        result: {
          data: itemRows(),
          error: { message: "raw PostgREST failure" },
        },
        beforeResolve: () => controller.abort(),
      },
      access_entries: {
        result: { data: entryRows(), error: null },
      },
    });
    const reader = createAccessEmailMessageDataSupabaseReader(fixture.client);
    const result = await loadAccessEmailMessageData(reader, ORDER_ID, {
      signal: controller.signal,
    });
    assert.deepEqual(result, {
      kind: "aborted",
      errorCode: "email_message_data_load_aborted",
    });
    assert.deepEqual(
      fixture.operations.filter((operation) => operation.startsWith("from:")),
      ["from:access_orders", "from:access_order_items"],
    );
    assert.deepEqual(fixture.signals, [
      controller.signal,
      controller.signal,
    ]);
  });
});
