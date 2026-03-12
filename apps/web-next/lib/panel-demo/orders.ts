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
}

type DemoOrdersByDate = Record<string, PanelDemoOrderItem[]>;

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

function createInitialDiscotecaOrders(): DemoOrdersByDate {
  const [friday, saturday, sunday, nextFriday] = getPanelDemoDiscotecaOrderDates();

  const fridayPlans: DemoOrderPlan[] = [
    [14, "used", -8, 15, 30, 0, 55],
    [12, "used", -7, 16, 10, 1, 12],
    [10, "used", -6, 17, 45, 1, 36],
    [11, "used", -5, 18, 25, 1, 58],
    [9, "used", -4, 19, 40, 2, 14],
    [8, "used", -3, 20, 15, 2, 28],
    [6, "used", -2, 21, 0, 2, 52],
    [8, "unused", -1, 22, 5],
  ];

  const saturdayPlans: DemoOrderPlan[] = [
    [20, "used", -8, 16, 20, 0, 42],
    [18, "used", -7, 17, 10, 1, 5],
    [16, "used", -6, 18, 0, 1, 22],
    [15, "used", -5, 18, 45, 1, 46],
    [13, "used", -4, 19, 20, 2, 8],
    [10, "used", -3, 20, 10, 2, 34],
    [14, "used", -2, 20, 50, 2, 48],
    [12, "used", -1, 21, 30, 3, 6],
    [14, "unused", -1, 22, 15],
  ];

  const nextFridayPlans: DemoOrderPlan[] = [
    [8, "pending", -8, 15, 30],
    [7, "pending", -6, 17, 25],
    [6, "pending", -5, 18, 5],
    [5, "pending", -4, 18, 55],
    [4, "unused", -3, 20, 10],
    [6, "unused", -2, 21, 20],
  ];

  const sundayPlans: DemoOrderPlan[] = [
    [9, "pending", -6, 17, 10],
    [7, "pending", -4, 19, 35],
    [6, "pending", -2, 21, 25],
    [5, "pending", -1, 10, 40],
    [4, "pending", -1, 14, 10],
    [5, "pending", -1, 18, 20],
    [4, "pending", -1, 22, 5],
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

function getDiscotecaRevenueByDate(intendedDate: string): number {
  const [friday, saturday, sunday, nextFriday] = getPanelDemoDiscotecaOrderDates();
  const revenueByDate: Record<string, number> = {
    [friday]: 4_140_000,
    [saturday]: 6_925_000,
    [sunday]: 2_460_000,
    [nextFriday]: 1_980_000,
  };

  return revenueByDate[intendedDate] ?? 0;
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
  const orders = getDiscotecaOrdersByDate(selectedDate);
  const usedOrders = filterOrdersByState(orders, "used");
  const pendingOrders = filterOrdersByState(orders, "pending");
  const unusedOrders = filterOrdersByState(orders, "unused");
  const currentWindow = getNightWindow(selectedDate);
  const demoNow = getPanelDemoNow("discoteca");

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
  const limit = Math.min(input.limit ?? 20, 100);
  const normalizedSearch = input.searchValue?.trim() ?? "";

  let orders = filterOrdersByState(getDiscotecaOrdersByDate(input.intendedDate), state);

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

  const items = sortedOrders.slice(0, limit).map(cloneOrder);
  return {
    items,
    count: items.length,
  };
}
