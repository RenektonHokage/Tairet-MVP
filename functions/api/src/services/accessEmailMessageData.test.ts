import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAccessEntriesEmailMessage } from "./accessEmailMessage";
import {
  loadAccessEmailMessageData,
  type AccessEmailEntryRow,
  type AccessEmailEventRow,
  type AccessEmailLocalRow,
  type AccessEmailMessageDataReader,
  type AccessEmailMessageDataReadResult,
  type AccessEmailOrderItemRow,
  type AccessEmailOrderRow,
} from "./accessEmailMessageData";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_A = "11111111-1111-4111-8111-111111111111";
const ITEM_B = "22222222-2222-4222-8222-222222222222";
const TICKET_A = "33333333-3333-4333-8333-333333333333";
const TICKET_B = "44444444-4444-4444-8444-444444444444";
const ENTRY_A1 = "50000000-0000-4000-8000-000000000001";
const ENTRY_A2 = "50000000-0000-4000-8000-000000000002";
const ENTRY_B1 = "50000000-0000-4000-8000-000000000003";
const TOKEN_A1 = "60000000-0000-4000-8000-000000000001";
const TOKEN_A2 = "60000000-0000-4000-8000-000000000002";
const TOKEN_B1 = "60000000-0000-4000-8000-000000000003";

function success<Value>(
  data: Value,
): AccessEmailMessageDataReadResult<Value> {
  return { kind: "success", data };
}

const TRANSPORT_ERROR = { kind: "transport_error" as const };
const INVALID_DATA = { kind: "invalid_data" as const };

function baseOrder(): AccessEmailOrderRow {
  return {
    id: ORDER_ID,
    public_ref: "ACC-42",
    source_type: "local",
    local_id: LOCAL_ID,
    event_id: null,
    access_date: "2026-08-10",
    buyer_name: "Mateo",
    buyer_last_name: "Test",
    buyer_email: "  BUYER@Example.Test ",
    status: "paid",
  };
}

function baseItems(): AccessEmailOrderItemRow[] {
  return [
    {
      id: ITEM_A,
      order_id: ORDER_ID,
      access_ticket_type_id: TICKET_A,
      name_snapshot: "VIP",
      quantity: 1,
      entries_per_unit: 2,
    },
    {
      id: ITEM_B,
      order_id: ORDER_ID,
      access_ticket_type_id: TICKET_B,
      name_snapshot: "General",
      quantity: 1,
      entries_per_unit: 1,
    },
  ];
}

function baseEntries(): AccessEmailEntryRow[] {
  return [
    {
      id: ENTRY_B1,
      order_id: ORDER_ID,
      order_item_id: ITEM_B,
      access_ticket_type_id: TICKET_B,
      unit_index: 1,
      checkin_token: TOKEN_B1,
      attendee_name: "Bruno",
      attendee_last_name: "Tres",
      access_date: "2026-08-10",
      status: "issued",
      checkin_status: "unused",
    },
    {
      id: ENTRY_A2,
      order_id: ORDER_ID,
      order_item_id: ITEM_A,
      access_ticket_type_id: TICKET_A,
      unit_index: 2,
      checkin_token: TOKEN_A2,
      attendee_name: "Ana",
      attendee_last_name: "Dos",
      access_date: "2026-08-10",
      status: "issued",
      checkin_status: "unused",
    },
    {
      id: ENTRY_A1,
      order_id: ORDER_ID,
      order_item_id: ITEM_A,
      access_ticket_type_id: TICKET_A,
      unit_index: 1,
      checkin_token: TOKEN_A1,
      attendee_name: "Ana",
      attendee_last_name: "Uno",
      access_date: "2026-08-10",
      status: "issued",
      checkin_status: "unused",
    },
  ];
}

interface ReaderFixture {
  readonly order?: AccessEmailMessageDataReadResult<AccessEmailOrderRow | null>;
  readonly items?: AccessEmailMessageDataReadResult<
    readonly AccessEmailOrderItemRow[]
  >;
  readonly entries?: AccessEmailMessageDataReadResult<
    readonly AccessEmailEntryRow[]
  >;
  readonly local?: AccessEmailMessageDataReadResult<AccessEmailLocalRow | null>;
  readonly event?: AccessEmailMessageDataReadResult<AccessEmailEventRow | null>;
  readonly afterRead?: Partial<
    Record<"order" | "items" | "entries" | "local" | "event", () => void>
  >;
}

function fixtureReader(fixture: ReaderFixture = {}): {
  readonly reader: AccessEmailMessageDataReader;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const complete = <Value>(
    name: "order" | "items" | "entries" | "local" | "event",
    result: AccessEmailMessageDataReadResult<Value>,
  ): Promise<AccessEmailMessageDataReadResult<Value>> => {
    calls.push(name);
    fixture.afterRead?.[name]?.();
    return Promise.resolve(result);
  };
  return {
    calls,
    reader: {
      readOrder: () =>
        complete("order", fixture.order ?? success(baseOrder())),
      readOrderItems: () =>
        complete("items", fixture.items ?? success(baseItems())),
      readEntries: () =>
        complete("entries", fixture.entries ?? success(baseEntries())),
      readLocal: () =>
        complete("local", fixture.local ?? success({ name: "  Local Uno  " })),
      readEvent: () =>
        complete("event", fixture.event ?? success({ title: " Evento Uno " })),
    },
  };
}

async function loadFixture(fixture: ReaderFixture = {}) {
  const { reader, calls } = fixtureReader(fixture);
  return {
    result: await loadAccessEmailMessageData(reader, ORDER_ID),
    calls,
  };
}

describe("loadAccessEmailMessageData", () => {
  it("loads local data, preserves buyer email and uses B3B1 canonicalization", async () => {
    const { result, calls } = await loadFixture();
    assert.equal(result.kind, "success");
    if (result.kind !== "success") return;
    assert.deepEqual(calls, ["order", "items", "entries", "local"]);
    assert.deepEqual(result.data, {
      buyerEmail: "  BUYER@Example.Test ",
      buyerName: "Mateo Test",
      publicRef: "ACC-42",
      sourceName: "Local Uno",
      accessDate: "2026-08-10",
      entries: [
        {
          id: ENTRY_A1,
          orderItemId: ITEM_A,
          unitIndex: 1,
          ticketName: "VIP",
          attendeeName: "Ana",
          attendeeLastName: "Uno",
          checkinToken: TOKEN_A1,
        },
        {
          id: ENTRY_A2,
          orderItemId: ITEM_A,
          unitIndex: 2,
          ticketName: "VIP",
          attendeeName: "Ana",
          attendeeLastName: "Dos",
          checkinToken: TOKEN_A2,
        },
        {
          id: ENTRY_B1,
          orderItemId: ITEM_B,
          unitIndex: 1,
          ticketName: "General",
          attendeeName: "Bruno",
          attendeeLastName: "Tres",
          checkinToken: TOKEN_B1,
        },
      ],
    });
  });

  it("loads only the event source for event orders", async () => {
    const order = {
      ...baseOrder(),
      source_type: "event" as const,
      local_id: null,
      event_id: EVENT_ID,
    };
    const { result, calls } = await loadFixture({ order: success(order) });
    assert.equal(result.kind, "success");
    assert.deepEqual(calls, ["order", "items", "entries", "event"]);
    if (result.kind === "success") {
      assert.equal(result.data.sourceName, "Evento Uno");
    }
  });

  it("uses the stable source fallback for missing and blank names", async () => {
    for (const local of [null, { name: "   " }]) {
      const { result } = await loadFixture({
        local: success(local),
      });
      assert.equal(result.kind, "success");
      if (result.kind === "success") {
        assert.equal(result.data.sourceName, "Tairet");
      }
    }
  });

  it("classifies transport failures as retryable with stable codes", async () => {
    const cases: readonly [
      ReaderFixture,
      string,
      readonly string[],
    ][] = [
      [{ order: TRANSPORT_ERROR }, "order_read_failed", ["order"]],
      [
        { items: TRANSPORT_ERROR },
        "order_items_read_failed",
        ["order", "items"],
      ],
      [
        { entries: TRANSPORT_ERROR },
        "entries_read_failed",
        ["order", "items", "entries"],
      ],
      [
        { local: TRANSPORT_ERROR },
        "source_read_failed",
        ["order", "items", "entries", "local"],
      ],
    ];
    for (const [fixture, errorCode, expectedCalls] of cases) {
      const { result, calls } = await loadFixture(fixture);
      assert.deepEqual(result, { kind: "retryable_error", errorCode });
      assert.deepEqual(calls, expectedCalls);
    }
  });

  it("rejects missing, unpaid, malformed and source-invalid orders", async () => {
    const cases: readonly [ReaderFixture, string][] = [
      [{ order: success(null) }, "order_not_found"],
      [
        { order: success({ ...baseOrder(), status: "cancelled" }) },
        "order_not_paid",
      ],
      [
        { order: success({ ...baseOrder(), id: LOCAL_ID }) },
        "order_invalid",
      ],
      [
        { order: success({ ...baseOrder(), buyer_name: "   " }) },
        "order_invalid",
      ],
      [
        { order: success({ ...baseOrder(), access_date: "2026-02-30" }) },
        "order_invalid",
      ],
      [
        { order: success({ ...baseOrder(), access_date: "0000-01-01" }) },
        "order_invalid",
      ],
      [
        {
          order: success({
            ...baseOrder(),
            local_id: null,
            event_id: EVENT_ID,
          }),
        },
        "order_invalid",
      ],
      [
        {
          order: success({
            ...baseOrder(),
            source_type: "event",
            local_id: LOCAL_ID,
            event_id: EVENT_ID,
          }),
        },
        "order_invalid",
      ],
    ];
    for (const [fixture, errorCode] of cases) {
      const { result, calls } = await loadFixture(fixture);
      assert.deepEqual(result, { kind: "terminal_error", errorCode });
      assert.deepEqual(calls, ["order"]);
    }
  });

  it("rejects empty, invalid and overflowing order items", async () => {
    const invalidItems = [
      [],
      [{ ...baseItems()[0], quantity: 0 }],
      [
        {
          ...baseItems()[0],
          quantity: Number.MAX_SAFE_INTEGER,
          entries_per_unit: 2,
        },
      ],
      [
        {
          ...baseItems()[0],
          quantity: Number.MAX_SAFE_INTEGER,
          entries_per_unit: 1,
        },
        {
          ...baseItems()[1],
          quantity: Number.MAX_SAFE_INTEGER,
          entries_per_unit: 1,
        },
      ],
      [
        baseItems()[0],
        { ...baseItems()[1], id: ITEM_A },
      ],
      [
        baseItems()[0],
        { ...baseItems()[1], access_ticket_type_id: TICKET_A },
      ],
    ];
    for (const items of invalidItems) {
      const { result } = await loadFixture({ items: success(items) });
      assert.deepEqual(result, {
        kind: "terminal_error",
        errorCode: "order_items_invalid",
      });
    }
  });

  it("rejects absent, mismatched, non-deliverable and duplicate entries", async () => {
    const entries = baseEntries();
    const cases: readonly [readonly AccessEmailEntryRow[], string][] = [
      [[], "entries_not_found"],
      [entries.slice(0, 2), "entry_count_mismatch"],
      [[{ ...entries[0], order_id: LOCAL_ID }, entries[1], entries[2]], "entries_invalid"],
      [[{ ...entries[0], order_item_id: LOCAL_ID }, entries[1], entries[2]], "entries_invalid"],
      [[{ ...entries[0], access_ticket_type_id: TICKET_A }, entries[1], entries[2]], "entries_invalid"],
      [[{ ...entries[0], access_date: "2026-08-11" }, entries[1], entries[2]], "entries_invalid"],
      [[{ ...entries[0], access_date: "2026-02-30" }, entries[1], entries[2]], "entries_invalid"],
      [[{ ...entries[0], status: "voided" }, entries[1], entries[2]], "entry_not_deliverable"],
      [[{ ...entries[0], checkin_status: "used" }, entries[1], entries[2]], "entry_not_deliverable"],
      [[entries[0], entries[1], { ...entries[2], id: ENTRY_A2 }], "entries_invalid"],
      [[entries[0], entries[1], { ...entries[2], checkin_token: TOKEN_A2 }], "entries_invalid"],
      [[entries[0], { ...entries[1], unit_index: 0 }, entries[2]], "entries_invalid"],
      [[entries[0], { ...entries[1], unit_index: -1 }, entries[2]], "entries_invalid"],
      [[entries[0], { ...entries[1], unit_index: 1 }, entries[2]], "entries_invalid"],
      [[entries[0], { ...entries[1], unit_index: 3 }, entries[2]], "entry_count_mismatch"],
      [
        [
          entries[0],
          {
            ...entries[1],
            order_item_id: ITEM_B,
            access_ticket_type_id: TICKET_B,
            unit_index: 2,
          },
          entries[2],
        ],
        "entry_count_mismatch",
      ],
      [
        [
          ...entries,
          {
            ...entries[1],
            id: LOCAL_ID,
            checkin_token: EVENT_ID,
            unit_index: 3,
          },
        ],
        "entry_count_mismatch",
      ],
    ];
    for (const [rows, errorCode] of cases) {
      const { result } = await loadFixture({ entries: success(rows) });
      assert.deepEqual(result, { kind: "terminal_error", errorCode });
    }
  });

  it("does not hide malformed source rows behind the fallback", async () => {
    const { result, calls } = await loadFixture({ local: INVALID_DATA });
    assert.deepEqual(result, {
      kind: "terminal_error",
      errorCode: "source_invalid",
    });
    assert.deepEqual(calls, ["order", "items", "entries", "local"]);
  });

  it("produces identical canonical data and B3B1 hashes for shuffled rows", async () => {
    const first = await loadFixture();
    const second = await loadFixture({
      entries: success([...baseEntries()].reverse()),
    });
    assert.equal(first.result.kind, "success");
    assert.equal(second.result.kind, "success");
    if (
      first.result.kind !== "success" ||
      second.result.kind !== "success"
    ) {
      return;
    }
    assert.deepEqual(first.result.data, second.result.data);
    const input = {
      from: "access@example.test",
      qrBaseUrl: "https://tickets.example.test/",
    };
    const firstMessage = await buildAccessEntriesEmailMessage({
      ...input,
      ...first.result.data,
    });
    const secondMessage = await buildAccessEntriesEmailMessage({
      ...input,
      ...second.result.data,
    });
    assert.deepEqual(firstMessage.entryIds, [ENTRY_A1, ENTRY_A2, ENTRY_B1]);
    assert.deepEqual(firstMessage, secondMessage);
    assert.match(firstMessage.requestPayloadHash, /^[a-f0-9]{64}$/);
  });

  it("does not mutate inputs and deeply freezes successful output", async () => {
    const order = baseOrder();
    const items = baseItems();
    const entries = baseEntries();
    const before = JSON.stringify({ order, items, entries });
    const { result } = await loadFixture({
      order: success(order),
      items: success(items),
      entries: success(entries),
    });
    assert.equal(JSON.stringify({ order, items, entries }), before);
    assert.equal(result.kind, "success");
    if (result.kind !== "success") return;
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.data));
    assert.ok(Object.isFrozen(result.data.entries));
    assert.ok(result.data.entries.every((entry) => Object.isFrozen(entry)));
    const firstEntry = result.data.entries[0];
    assert.throws(
      () => Array.prototype.push.call(result.data.entries, firstEntry),
      TypeError,
    );
    assert.equal(Reflect.set(firstEntry, "ticketName", "Changed"), false);
    assert.equal(Reflect.set(result.data, "sourceName", "Changed"), false);
    assert.equal(result.data.entries.length, 3);
    assert.equal(firstEntry.ticketName, "VIP");
    assert.equal(result.data.sourceName, "Local Uno");
    assert.equal("email_status" in result.data, false);
  });

  it("aborts at every read boundary without continuing", async () => {
    const before = new AbortController();
    before.abort();
    const firstFixture = fixtureReader();
    const beforeResult = await loadAccessEmailMessageData(
      firstFixture.reader,
      ORDER_ID,
      { signal: before.signal },
    );
    assert.deepEqual(beforeResult, {
      kind: "aborted",
      errorCode: "email_message_data_load_aborted",
    });
    assert.deepEqual(firstFixture.calls, []);

    const boundaries = [
      { after: "order", calls: ["order"] },
      { after: "items", calls: ["order", "items"] },
      { after: "entries", calls: ["order", "items", "entries"] },
      {
        after: "local",
        calls: ["order", "items", "entries", "local"],
      },
    ] as const;
    for (const boundary of boundaries) {
      const controller = new AbortController();
      const fixture = fixtureReader({
        afterRead: {
          [boundary.after]: () => controller.abort(),
        },
      });
      const result = await loadAccessEmailMessageData(
        fixture.reader,
        ORDER_ID,
        { signal: controller.signal },
      );
      assert.deepEqual(result, {
        kind: "aborted",
        errorCode: "email_message_data_load_aborted",
      });
      assert.deepEqual(fixture.calls, boundary.calls);
    }
  });

  it("gives abort precedence over read errors and invalid data", async () => {
    const races: readonly Readonly<{
      after: "order" | "items" | "entries" | "local";
      fixture: ReaderFixture;
      calls: readonly string[];
    }>[] = [
      {
        after: "order",
        fixture: { order: TRANSPORT_ERROR },
        calls: ["order"],
      },
      {
        after: "items",
        fixture: { items: INVALID_DATA },
        calls: ["order", "items"],
      },
      {
        after: "entries",
        fixture: { entries: TRANSPORT_ERROR },
        calls: ["order", "items", "entries"],
      },
      {
        after: "local",
        fixture: { local: INVALID_DATA },
        calls: ["order", "items", "entries", "local"],
      },
    ];
    for (const race of races) {
      const controller = new AbortController();
      const fixture = fixtureReader({
        ...race.fixture,
        afterRead: { [race.after]: () => controller.abort() },
      });
      const result = await loadAccessEmailMessageData(
        fixture.reader,
        ORDER_ID,
        { signal: controller.signal },
      );
      assert.deepEqual(result, {
        kind: "aborted",
        errorCode: "email_message_data_load_aborted",
      });
      assert.deepEqual(fixture.calls, race.calls);
    }
  });

  it("checks abort again immediately before returning success", async () => {
    const controller = new AbortController();
    const local: AccessEmailLocalRow = {
      get name() {
        controller.abort();
        return "Local Uno";
      },
    };
    const fixture = fixtureReader({ local: success(local) });
    const result = await loadAccessEmailMessageData(
      fixture.reader,
      ORDER_ID,
      { signal: controller.signal },
    );
    assert.deepEqual(result, {
      kind: "aborted",
      errorCode: "email_message_data_load_aborted",
    });
    assert.deepEqual(fixture.calls, [
      "order",
      "items",
      "entries",
      "local",
    ]);
  });

  it("never returns PII, tokens or raw transport details in errors", async () => {
    const pii = "BUYER@Example.Test";
    const token = TOKEN_A1;
    const cases = [
      await loadFixture({ order: TRANSPORT_ERROR }),
      await loadFixture({
        entries: success([
          { ...baseEntries()[0], checkin_token: "invalid" },
          ...baseEntries().slice(1),
        ]),
      }),
    ];
    for (const { result } of cases) {
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes(pii), false);
      assert.equal(serialized.includes(token), false);
      assert.equal(serialized.includes("PostgREST"), false);
    }
  });
});
