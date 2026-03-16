import {
  getPanelDemoDiscotecaOrderDates,
  getPanelDemoDiscotecaOrdersDefaultDate as getPanelDemoDiscotecaOrdersAnchorDate,
  getPanelDemoNow,
} from "./time";

export type DemoOrderSearchType = "email" | "document";
export type DemoOrderStateFilter = "all" | "used" | "pending" | "unused";
export type DemoOrderResolvedState = "used" | "pending" | "unused" | "other";

export interface PanelDemoOrderItem {
  id: string;
  status: string;
  used_at: string | null;
  checkin_token: string | null;
  customer_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  quantity: number | null;
  created_at: string;
  intended_date: string;
  valid_from: string;
  valid_to: string;
  checkin_state: DemoOrderResolvedState;
}

export interface PanelDemoOrdersResponse {
  items: PanelDemoOrderItem[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PanelDemoOrdersSummaryResponse {
  total_qty: number;
  used_qty: number;
  pending_qty: number;
  unused_qty: number;
  revenue_paid: number;
  latest_purchase_at: string | null;
  recent_sales_qty: number;
  recent_sales_window_label: string;
  total_count: number;
  used_count: number;
  pending_count: number;
  unused_count: number;
  current_window: {
    intended_date: string;
    valid_from: string;
    valid_to: string;
    window_key: string;
  } | null;
}

export interface SearchPanelDemoDiscotecaOrdersInput {
  intendedDate: string;
  searchType: DemoOrderSearchType;
  searchValue?: string;
  state?: DemoOrderStateFilter;
  limit?: number;
  offset?: number;
}

type DemoOrdersByDate = Record<string, PanelDemoOrderItem[]>;
type DemoOrdersTemporalContext = "past" | "today" | "future";

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate()
  )}`;
}

function buildIsoDateTime(
  dateOnly: string,
  hours: number,
  minutes: number,
  dayOffset = 0
): string {
  const [yearRaw, monthRaw, dayRaw] = dateOnly.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  return new Date(year, month - 1, day + dayOffset, hours, minutes, 0, 0).toISOString();
}

function getNightWindow(dateOnly: string) {
  return {
    intended_date: dateOnly,
    valid_from: buildIsoDateTime(dateOnly, 22, 0),
    valid_to: buildIsoDateTime(dateOnly, 6, 0, 1),
    window_key: `demo-discoteca-${dateOnly}`,
  };
}

function cloneOrder(order: PanelDemoOrderItem): PanelDemoOrderItem {
  return {
    ...order,
  };
}

function createDemoOrder(
  intendedDate: string,
  sequence: number,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    document: string;
    quantity: number;
    state: Exclude<DemoOrderResolvedState, "other">;
    createdDayOffset: number;
    createdHour: number;
    createdMinute: number;
    usedHour?: number;
    usedMinute?: number;
  }
): PanelDemoOrderItem {
  const window = getNightWindow(intendedDate);
  const tokenSuffix = `${intendedDate.replace(/-/g, "")}${padNumber(sequence)}`;

  return {
    id: `demo-discoteca-order-${intendedDate}-${sequence}`,
    status: "paid",
    used_at:
      input.state === "used"
        ? buildIsoDateTime(
            intendedDate,
            input.usedHour ?? 1,
            input.usedMinute ?? 20,
            1
          )
        : null,
    checkin_token: `dsc-${tokenSuffix}`,
    customer_name: input.firstName,
    customer_last_name: input.lastName,
    customer_email: input.email,
    customer_phone: input.phone,
    customer_document: input.document,
    quantity: input.quantity,
    created_at: buildIsoDateTime(
      intendedDate,
      input.createdHour,
      input.createdMinute,
      input.createdDayOffset
    ),
    intended_date: intendedDate,
    valid_from: window.valid_from,
    valid_to: window.valid_to,
    checkin_state: input.state,
  };
}

type DemoOrderPlan = [
  quantity: number,
  state: Exclude<DemoOrderResolvedState, "other">,
  createdDayOffset: number,
  createdHour: number,
  createdMinute: number,
  usedHour?: number,
  usedMinute?: number,
];
type DemoQuantityDistribution = Array<readonly [quantity: 1 | 2 | 3 | 4, count: number]>;

const DEMO_ORDER_CONTACTS = [
  ["Nadia", "Maidana"],
  ["Bruno", "Acosta"],
  ["Lucia", "Vera"],
  ["Mateo", "Benitez"],
  ["Camila", "Rojas"],
  ["Joaquin", "Ferreira"],
  ["Paula", "Insfran"],
  ["Diego", "Morinigo"],
  ["Valentina", "Lezcano"],
  ["Alan", "Riveros"],
  ["Sofia", "Pereira"],
  ["Emilia", "Gimenez"],
  ["Thiago", "Caballero"],
  ["Martina", "Aguero"],
  ["Nicolas", "Paredes"],
  ["Julieta", "Franco"],
  ["Ariana", "Sosa"],
  ["Federico", "Cardozo"],
  ["Mia", "Lopez"],
  ["Gael", "Ramirez"],
  ["Renata", "Ayala"],
  ["Tobias", "Ortiz"],
  ["Bianca", "Galeano"],
];

function createDiscotecaEmail(
  firstName: string,
  lastName: string,
  index: number
): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@demo.ta`;
}

function createDiscotecaPhone(index: number): string {
  return `+59597${String(100000 + index).padStart(6, "0")}`;
}

function createDiscotecaDocument(index: number): string {
  return String(4100000 + index);
}

function buildDemoOrdersForDate(
  intendedDate: string,
  plans: DemoOrderPlan[],
  contactOffset: number
): PanelDemoOrderItem[] {
  return plans.map(
    (
      [quantity, state, createdDayOffset, createdHour, createdMinute, usedHour, usedMinute],
      index
    ) => {
      const contactIndex = contactOffset + index;
      const [firstName, lastName] =
        DEMO_ORDER_CONTACTS[contactIndex % DEMO_ORDER_CONTACTS.length];

      return createDemoOrder(intendedDate, index + 1, {
        firstName,
        lastName,
        email: createDiscotecaEmail(firstName, lastName, contactIndex + 1),
        phone: createDiscotecaPhone(contactIndex + 1),
        document: createDiscotecaDocument(contactIndex + 1),
        quantity,
        state,
        createdDayOffset,
        createdHour,
        createdMinute,
        usedHour,
        usedMinute,
      });
    }
  );
}

function buildQuantitySequence(distribution: DemoQuantityDistribution): number[] {
  const remaining = distribution.map(([quantity, count]) => ({ quantity, count }));
  const quantities: number[] = [];

  while (remaining.some((item) => item.count > 0)) {
    for (const item of remaining) {
      if (item.count > 0) {
        quantities.push(item.quantity);
        item.count -= 1;
      }
    }
  }

  return quantities;
}

function buildPlansFromDistribution(
  distribution: DemoQuantityDistribution,
  state: Exclude<DemoOrderResolvedState, "other">,
  config: {
    startDayOffset: number;
    ordersPerDay: number;
    startHour: number;
    startMinute: number;
    minuteStep: number;
    usedStartHour?: number;
    usedMinuteSlots?: number[];
  }
): DemoOrderPlan[] {
  const quantities = buildQuantitySequence(distribution);
  const usedMinuteSlots = config.usedMinuteSlots ?? [5, 10, 15, 20, 25, 30, 35, 40, 45];

  return quantities.map((quantity, index) => {
    const createdDayOffset =
      config.startDayOffset + Math.floor(index / Math.max(config.ordersPerDay, 1));
    const slotWithinDay = index % Math.max(config.ordersPerDay, 1);
    const createdHour = Math.min(config.startHour + slotWithinDay, 23);
    const createdMinute = (config.startMinute + slotWithinDay * config.minuteStep) % 60;

    if (state === "used") {
      const usedHour =
        (config.usedStartHour ?? 0) + Math.floor(index / usedMinuteSlots.length);
      const usedMinute = usedMinuteSlots[index % usedMinuteSlots.length];

      return [
        quantity,
        state,
        createdDayOffset,
        createdHour,
        createdMinute,
        usedHour,
        usedMinute,
      ];
    }

    return [quantity, state, createdDayOffset, createdHour, createdMinute];
  });
}

function createInitialDiscotecaOrders(): DemoOrdersByDate {
  const [friday, saturday, sunday, nextFriday] = getPanelDemoDiscotecaOrderDates();

  const fridayPlans: DemoOrderPlan[] = [
    ...buildPlansFromDistribution(
      [
        [1, 24],
        [2, 10],
        [3, 5],
        [4, 3],
      ],
      "used",
      {
        startDayOffset: -11,
        ordersPerDay: 4,
        startHour: 15,
        startMinute: 10,
        minuteStep: 11,
        usedStartHour: 0,
      }
    ),
    ...buildPlansFromDistribution(
      [
        [1, 3],
        [2, 2],
      ],
      "unused",
      {
        startDayOffset: -1,
        ordersPerDay: 5,
        startHour: 20,
        startMinute: 5,
        minuteStep: 13,
      }
    ),
  ];

  const saturdayPlans: DemoOrderPlan[] = [
    ...buildPlansFromDistribution(
      [
        [1, 24],
        [2, 14],
        [3, 6],
        [4, 1],
      ],
      "used",
      {
        startDayOffset: -9,
        ordersPerDay: 5,
        startHour: 15,
        startMinute: 0,
        minuteStep: 9,
        usedStartHour: 0,
      }
    ),
    ...buildPlansFromDistribution(
      [
        [1, 20],
        [2, 12],
        [3, 4],
        [4, 2],
      ],
      "pending",
      {
        startDayOffset: -6,
        ordersPerDay: 6,
        startHour: 17,
        startMinute: 5,
        minuteStep: 8,
      }
    ),
  ];

  const nextFridayPlans: DemoOrderPlan[] = buildPlansFromDistribution(
    [
      [1, 12],
      [2, 7],
      [3, 2],
      [4, 1],
    ],
    "pending",
    {
      startDayOffset: -10,
      ordersPerDay: 4,
      startHour: 15,
      startMinute: 20,
      minuteStep: 10,
    }
  );

  const sundayPlans: DemoOrderPlan[] = [
    ...buildPlansFromDistribution(
      [
        [1, 17],
        [2, 6],
        [3, 2],
      ],
      "pending",
      {
        startDayOffset: -8,
        ordersPerDay: 4,
        startHour: 16,
        startMinute: 15,
        minuteStep: 10,
      }
    ),
    [1, "pending", -1, 14, 5],
    [2, "pending", -1, 16, 20],
    [1, "pending", -1, 18, 10],
    [2, "pending", -1, 20, 25],
    [2, "pending", -1, 22, 14],
    [4, "pending", -1, 23, 9],
  ];

  return {
    [friday]: buildDemoOrdersForDate(friday, fridayPlans, 0),
    [saturday]: buildDemoOrdersForDate(saturday, saturdayPlans, 8),
    [sunday]: buildDemoOrdersForDate(sunday, sundayPlans, 17),
    [nextFriday]: buildDemoOrdersForDate(nextFriday, nextFridayPlans, 24),
  };
}

function getDiscotecaOrdersByDate(intendedDate: string): PanelDemoOrderItem[] {
  const ordersByDate = createInitialDiscotecaOrders();
  return (ordersByDate[intendedDate] ?? []).map(cloneOrder);
}

function resolveDemoTemporalContext(
  intendedDate: string,
  nowDate: Date
): DemoOrdersTemporalContext {
  const referenceDateKey = formatDateOnly(nowDate);

  if (intendedDate > referenceDateKey) {
    return "future";
  }

  if (intendedDate < referenceDateKey) {
    return "past";
  }

  return "today";
}

function normalizeDemoDiscotecaOrderForDate(
  order: PanelDemoOrderItem,
  temporalContext: DemoOrdersTemporalContext
): PanelDemoOrderItem {
  if (temporalContext !== "past" && order.checkin_state === "unused") {
    return {
      ...order,
      checkin_state: "pending",
    };
  }

  return order;
}

function getNormalizedDiscotecaOrdersByDate(
  intendedDate: string,
  nowDate = getPanelDemoNow("discoteca")
): PanelDemoOrderItem[] {
  const temporalContext = resolveDemoTemporalContext(intendedDate, nowDate);

  return getDiscotecaOrdersByDate(intendedDate).map((order) =>
    normalizeDemoDiscotecaOrderForDate(order, temporalContext)
  );
}

function getDiscotecaRevenueByDate(intendedDate: string): number {
  const [friday, saturday, sunday, nextFriday] = getPanelDemoDiscotecaOrderDates();
  const unitPriceByDate: Record<string, number> = {
    [friday]: 58_000,
    [saturday]: 64_000,
    [sunday]: 59_000,
    [nextFriday]: 61_000,
  };

  const orders = getNormalizedDiscotecaOrdersByDate(intendedDate);
  return sumOrderQuantity(orders) * (unitPriceByDate[intendedDate] ?? 0);
}

function filterOrdersByState(
  orders: PanelDemoOrderItem[],
  state: DemoOrderStateFilter
): PanelDemoOrderItem[] {
  if (state === "all") {
    return orders;
  }

  return orders.filter((order) => order.checkin_state === state);
}

function sumOrderQuantity(orders: PanelDemoOrderItem[]): number {
  return orders.reduce((total, order) => total + (order.quantity ?? 0), 0);
}

function getDiscotecaLatestPurchaseAt(
  orders: PanelDemoOrderItem[],
  nowDate: Date
): string | null {
  const nowMs = nowDate.getTime();
  let latestCreatedAt: string | null = null;
  let latestCreatedAtMs = Number.NEGATIVE_INFINITY;

  for (const order of orders) {
    const createdAtMs = Date.parse(order.created_at);
    if (!Number.isFinite(createdAtMs) || createdAtMs > nowMs) {
      continue;
    }

    if (createdAtMs > latestCreatedAtMs) {
      latestCreatedAt = order.created_at;
      latestCreatedAtMs = createdAtMs;
    }
  }

  return latestCreatedAt;
}

function getDiscotecaRecentSalesQty(
  orders: PanelDemoOrderItem[],
  nowDate: Date
): number {
  const nowMs = nowDate.getTime();
  const startMs = nowMs - 24 * 60 * 60 * 1000;

  return orders.reduce((total, order) => {
    const createdAtMs = Date.parse(order.created_at);
    if (!Number.isFinite(createdAtMs) || createdAtMs < startMs || createdAtMs > nowMs) {
      return total;
    }

    return total + (order.quantity ?? 0);
  }, 0);
}

export function getPanelDemoDiscotecaOrdersDefaultDate(): string {
  return getPanelDemoDiscotecaOrdersAnchorDate();
}

export function getPanelDemoDiscotecaOrdersSummary(
  intendedDate?: string
): PanelDemoOrdersSummaryResponse {
  const selectedDate = intendedDate || getPanelDemoDiscotecaOrdersDefaultDate();
  const demoNow = getPanelDemoNow("discoteca");
  const orders = getNormalizedDiscotecaOrdersByDate(selectedDate, demoNow);
  const usedOrders = filterOrdersByState(orders, "used");
  const pendingOrders = filterOrdersByState(orders, "pending");
  const unusedOrders = filterOrdersByState(orders, "unused");
  const currentWindow = getNightWindow(selectedDate);

  return {
    total_qty:
      sumOrderQuantity(usedOrders) +
      sumOrderQuantity(pendingOrders) +
      sumOrderQuantity(unusedOrders),
    used_qty: sumOrderQuantity(usedOrders),
    pending_qty: sumOrderQuantity(pendingOrders),
    unused_qty: sumOrderQuantity(unusedOrders),
    revenue_paid: getDiscotecaRevenueByDate(selectedDate),
    latest_purchase_at: getDiscotecaLatestPurchaseAt(orders, demoNow),
    recent_sales_qty: getDiscotecaRecentSalesQty(orders, demoNow),
    recent_sales_window_label: "Últimas 24 h",
    total_count: usedOrders.length + pendingOrders.length + unusedOrders.length,
    used_count: usedOrders.length,
    pending_count: pendingOrders.length,
    unused_count: unusedOrders.length,
    current_window: currentWindow,
  };
}

export function searchPanelDemoDiscotecaOrders(
  input: SearchPanelDemoDiscotecaOrdersInput
): PanelDemoOrdersResponse {
  const state = input.state ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const normalizedSearch = input.searchValue?.trim() ?? "";

  let orders = filterOrdersByState(
    getNormalizedDiscotecaOrdersByDate(input.intendedDate),
    state
  );

  if (normalizedSearch) {
    if (input.searchType === "email") {
      const emailQuery = normalizedSearch.toLowerCase();
      orders = orders.filter(
        (order) => order.customer_email?.toLowerCase() === emailQuery
      );
    } else {
      orders = orders.filter(
        (order) => order.customer_document?.trim() === normalizedSearch
      );
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    const aCreatedAt = Date.parse(a.created_at);
    const bCreatedAt = Date.parse(b.created_at);

    if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt)) {
      return bCreatedAt - aCreatedAt;
    }

    return 0;
  });

  const total = sortedOrders.length;
  const items = sortedOrders.slice(offset, offset + limit).map(cloneOrder);
  return {
    items,
    count: items.length,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}
