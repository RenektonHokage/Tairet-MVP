import type {
  MetricsSummaryWithSeries,
  ReservationDaypartMeta,
  ReservationDaypartRow,
  ReservationStatusHourMeta,
  ReservationStatusHourRow,
  ReservationStatusBucket,
  OrdersSoldUsedBucket,
  ProfileViewBucket,
  RevenuePaidBucket,
  TicketsSoldByTypeBucket,
  TicketTypeMeta,
} from "@/lib/metrics";
import { getPanelDemoIdentity } from "./identity";
import type { DemoScenario } from "./runtime";
import { getPanelDemoPreviousRange, getPanelDemoRange } from "./time";

type DemoRange = {
  from: string;
  to: string;
};

type BucketMode = "day" | "week";
type DemoMetricsPeriod = "7d" | "30d" | "90d";
type DemoRangeVariant = "current" | "previous" | "other";

const BAR_PREVIOUS_FACTORS: Record<DemoMetricsPeriod, number> = {
  "7d": 0.84,
  "30d": 0.9,
  "90d": 0.93,
};

const CLUB_PREVIOUS_FACTORS: Record<DemoMetricsPeriod, number> = {
  "7d": 0.79,
  "30d": 0.88,
  "90d": 0.92,
};

const BAR_PERIOD_KPIS: Record<
  DemoMetricsPeriod,
  {
    whatsappClicks: number;
    promoOpenCount: number;
    avgPartySizeConfirmed: number;
    topPromoTitle: string;
    topPromoViews: number;
  }
> = {
  "7d": {
    whatsappClicks: 88,
    promoOpenCount: 74,
    avgPartySizeConfirmed: 4.3,
    topPromoTitle: "3x2 en Chop",
    topPromoViews: 51,
  },
  "30d": {
    whatsappClicks: 344,
    promoOpenCount: 291,
    avgPartySizeConfirmed: 4.2,
    topPromoTitle: "3x2 en Chop",
    topPromoViews: 161,
  },
  "90d": {
    whatsappClicks: 826,
    promoOpenCount: 698,
    avgPartySizeConfirmed: 4.3,
    topPromoTitle: "3x2 en Chop",
    topPromoViews: 388,
  },
};

const CLUB_PERIOD_KPIS: Record<
  DemoMetricsPeriod,
  {
    ordersTotal: number;
    whatsappClicks: number;
    promoOpenCount: number;
    topPromoTitle: string;
    topPromoViews: number;
  }
> = {
  "7d": {
    ordersTotal: 243,
    whatsappClicks: 137,
    promoOpenCount: 230,
    topPromoTitle: "2x1 en Fernet",
    topPromoViews: 96,
  },
  "30d": {
    ordersTotal: 787,
    whatsappClicks: 494,
    promoOpenCount: 812,
    topPromoTitle: "2x1 en Fernet",
    topPromoViews: 338,
  },
  "90d": {
    ordersTotal: 1857,
    whatsappClicks: 1184,
    promoOpenCount: 1946,
    topPromoTitle: "2x1 en Fernet",
    topPromoViews: 815,
  },
};

const BAR_DAILY_RESERVATIONS = [
  { confirmed: 4, pending: 2, cancelled: 1 },
  { confirmed: 3, pending: 1, cancelled: 1 },
  { confirmed: 5, pending: 1, cancelled: 1 },
  { confirmed: 6, pending: 2, cancelled: 1 },
  { confirmed: 9, pending: 3, cancelled: 1 },
  { confirmed: 12, pending: 4, cancelled: 2 },
  { confirmed: 10, pending: 4, cancelled: 2 },
];

const BAR_30D_RESERVATIONS = [
  { confirmed: 27, pending: 10, cancelled: 5 },
  { confirmed: 31, pending: 12, cancelled: 5 },
  { confirmed: 36, pending: 13, cancelled: 6 },
  { confirmed: 40, pending: 14, cancelled: 7 },
  { confirmed: 49, pending: 17, cancelled: 9 },
];
const BAR_90D_RESERVATIONS = [
  { confirmed: 84, pending: 30, cancelled: 14 },
  { confirmed: 91, pending: 34, cancelled: 14 },
  { confirmed: 100, pending: 37, cancelled: 14 },
  { confirmed: 108, pending: 40, cancelled: 16 },
  { confirmed: 118, pending: 43, cancelled: 18 },
];

const BAR_DAILY_VISITS = [64, 42, 55, 78, 112, 168, 152];
const BAR_30D_VISITS = [438, 492, 528, 543, 691];
const BAR_90D_VISITS = [1230, 1358, 1479, 1546, 1691];

const CLUB_DAILY_ORDERS = [
  { sold: 6, used: 0, revenue: 355000 },
  { sold: 8, used: 0, revenue: 415000 },
  { sold: 12, used: 0, revenue: 650000 },
  { sold: 28, used: 18, revenue: 1480000 },
  { sold: 78, used: 70, revenue: 4140000 },
  { sold: 132, used: 118, revenue: 6925000 },
  { sold: 5, used: 0, revenue: 295000 },
];

const CLUB_30D_ORDERS = [
  { sold: 123, used: 84, revenue: 6510000 },
  { sold: 149, used: 104, revenue: 7870000 },
  { sold: 167, used: 118, revenue: 8760000 },
  { sold: 189, used: 139, revenue: 9940000 },
  { sold: 243, used: 172, revenue: 12780000 },
];
const CLUB_90D_ORDERS = [
  { sold: 321, used: 227, revenue: 16755000 },
  { sold: 356, used: 252, revenue: 18620000 },
  { sold: 401, used: 284, revenue: 20955000 },
  { sold: 461, used: 326, revenue: 23885000 },
  { sold: 518, used: 366, revenue: 26860000 },
];

const CLUB_DAILY_VISITS = [18, 22, 35, 88, 176, 294, 41];
const CLUB_30D_VISITS = [348, 402, 516, 700, 674];
const CLUB_90D_VISITS = [1098, 1244, 1368, 1480, 1620];
const CLUB_TICKET_TYPES_META: TicketTypeMeta[] = [
  { key: "general", name: "General" },
  { key: "vip", name: "Free pass" },
  { key: "backstage", name: "Backstage" },
];
const CLUB_DAILY_TICKETS_BY_TYPE = [
  { general: 4, vip: 1, backstage: 1 },
  { general: 5, vip: 2, backstage: 1 },
  { general: 7, vip: 3, backstage: 2 },
  { general: 17, vip: 7, backstage: 4 },
  { general: 46, vip: 20, backstage: 12 },
  { general: 79, vip: 34, backstage: 19 },
  { general: 3, vip: 1, backstage: 1 },
];
const CLUB_30D_TICKETS_BY_TYPE = [
  { general: 74, vip: 31, backstage: 18 },
  { general: 89, vip: 38, backstage: 22 },
  { general: 100, vip: 43, backstage: 24 },
  { general: 112, vip: 49, backstage: 28 },
  { general: 144, vip: 63, backstage: 36 },
];
const CLUB_90D_TICKETS_BY_TYPE = [
  { general: 192, vip: 84, backstage: 45 },
  { general: 211, vip: 93, backstage: 52 },
  { general: 238, vip: 105, backstage: 58 },
  { general: 274, vip: 122, backstage: 65 },
  { general: 308, vip: 137, backstage: 73 },
];

const BAR_RESERVATION_DAYPART_META: ReservationDaypartMeta[] = [
  { key: "18_20", label: "18:00-20:00" },
  { key: "20_22", label: "20:00-22:00" },
  { key: "22_00", label: "22:00-00:00" },
];
const BAR_RESERVATION_STATUS_HOUR_META: ReservationStatusHourMeta = {
  window_start_hour: 18,
  window_end_hour: 24,
};

const BAR_7D_RESERVATION_DAYPART: ReservationDaypartRow[] = [
  { day_key: "lun", values: { "18_20": 1, "20_22": 2, "22_00": 2 } },
  { day_key: "mar", values: { "18_20": 1, "20_22": 3, "22_00": 3 } },
  { day_key: "mie", values: { "18_20": 2, "20_22": 4, "22_00": 3 } },
  { day_key: "jue", values: { "18_20": 3, "20_22": 5, "22_00": 5 } },
  { day_key: "vie", values: { "18_20": 4, "20_22": 7, "22_00": 7 } },
  { day_key: "sab", values: { "18_20": 4, "20_22": 6, "22_00": 6 } },
  { day_key: "dom", values: { "18_20": 2, "20_22": 3, "22_00": 2 } },
];

const BAR_30D_RESERVATION_DAYPART: ReservationDaypartRow[] = [
  { day_key: "lun", values: { "18_20": 4, "20_22": 7, "22_00": 8 } },
  { day_key: "mar", values: { "18_20": 6, "20_22": 10, "22_00": 10 } },
  { day_key: "mie", values: { "18_20": 8, "20_22": 14, "22_00": 12 } },
  { day_key: "jue", values: { "18_20": 12, "20_22": 19, "22_00": 18 } },
  { day_key: "vie", values: { "18_20": 16, "20_22": 26, "22_00": 25 } },
  { day_key: "sab", values: { "18_20": 15, "20_22": 23, "22_00": 22 } },
  { day_key: "dom", values: { "18_20": 6, "20_22": 10, "22_00": 10 } },
];

const BAR_90D_RESERVATION_DAYPART: ReservationDaypartRow[] = [
  { day_key: "lun", values: { "18_20": 11, "20_22": 20, "22_00": 20 } },
  { day_key: "mar", values: { "18_20": 16, "20_22": 28, "22_00": 27 } },
  { day_key: "mie", values: { "18_20": 21, "20_22": 36, "22_00": 34 } },
  { day_key: "jue", values: { "18_20": 31, "20_22": 51, "22_00": 50 } },
  { day_key: "vie", values: { "18_20": 43, "20_22": 70, "22_00": 70 } },
  { day_key: "sab", values: { "18_20": 38, "20_22": 62, "22_00": 62 } },
  { day_key: "dom", values: { "18_20": 16, "20_22": 28, "22_00": 27 } },
];

const BAR_7D_RESERVATION_STATUS_HOUR_BY_DAY: ReservationStatusHourRow[] = [
  {
    day_key: "lun",
    confirmed_hour: 20.08,
    pending_hour: 21.1,
    cancelled_hour: 22.25,
    confirmed_count: 4,
    pending_count: 2,
    cancelled_count: 1,
  },
  {
    day_key: "mar",
    confirmed_hour: 20.18,
    pending_hour: 21.05,
    cancelled_hour: 22.2,
    confirmed_count: 3,
    pending_count: 1,
    cancelled_count: 1,
  },
  {
    day_key: "mie",
    confirmed_hour: 20.42,
    pending_hour: 21.2,
    cancelled_hour: 22.5,
    confirmed_count: 5,
    pending_count: 1,
    cancelled_count: 1,
  },
  {
    day_key: "jue",
    confirmed_hour: 20.85,
    pending_hour: 21.4,
    cancelled_hour: 22.7,
    confirmed_count: 6,
    pending_count: 2,
    cancelled_count: 1,
  },
  {
    day_key: "vie",
    confirmed_hour: 21.28,
    pending_hour: 21.95,
    cancelled_hour: 22.95,
    confirmed_count: 9,
    pending_count: 3,
    cancelled_count: 1,
  },
  {
    day_key: "sab",
    confirmed_hour: 21.12,
    pending_hour: 21.82,
    cancelled_hour: 22.88,
    confirmed_count: 12,
    pending_count: 4,
    cancelled_count: 2,
  },
  {
    day_key: "dom",
    confirmed_hour: 20.34,
    pending_hour: 21.06,
    cancelled_hour: 22.2,
    confirmed_count: 10,
    pending_count: 4,
    cancelled_count: 2,
  },
];

const BAR_30D_RESERVATION_STATUS_HOUR_BY_DAY: ReservationStatusHourRow[] = [
  {
    day_key: "lun",
    confirmed_hour: 20.05,
    pending_hour: 20.98,
    cancelled_hour: 22.12,
    confirmed_count: 14,
    pending_count: 5,
    cancelled_count: 2,
  },
  {
    day_key: "mar",
    confirmed_hour: 20.18,
    pending_hour: 21.06,
    cancelled_hour: 22.2,
    confirmed_count: 17,
    pending_count: 6,
    cancelled_count: 2,
  },
  {
    day_key: "mie",
    confirmed_hour: 20.45,
    pending_hour: 21.22,
    cancelled_hour: 22.42,
    confirmed_count: 21,
    pending_count: 8,
    cancelled_count: 3,
  },
  {
    day_key: "jue",
    confirmed_hour: 20.88,
    pending_hour: 21.48,
    cancelled_hour: 22.7,
    confirmed_count: 27,
    pending_count: 10,
    cancelled_count: 4,
  },
  {
    day_key: "vie",
    confirmed_hour: 21.34,
    pending_hour: 21.96,
    cancelled_hour: 23.04,
    confirmed_count: 34,
    pending_count: 12,
    cancelled_count: 5,
  },
  {
    day_key: "sab",
    confirmed_hour: 21.2,
    pending_hour: 21.9,
    cancelled_hour: 22.96,
    confirmed_count: 31,
    pending_count: 12,
    cancelled_count: 5,
  },
  {
    day_key: "dom",
    confirmed_hour: 20.28,
    pending_hour: 21.02,
    cancelled_hour: 22.18,
    confirmed_count: 16,
    pending_count: 6,
    cancelled_count: 3,
  },
];

const BAR_90D_RESERVATION_STATUS_HOUR_BY_DAY: ReservationStatusHourRow[] = [
  {
    day_key: "lun",
    confirmed_hour: 20.04,
    pending_hour: 20.94,
    cancelled_hour: 22.08,
    confirmed_count: 42,
    pending_count: 15,
    cancelled_count: 5,
  },
  {
    day_key: "mar",
    confirmed_hour: 20.16,
    pending_hour: 21.02,
    cancelled_hour: 22.18,
    confirmed_count: 49,
    pending_count: 18,
    cancelled_count: 6,
  },
  {
    day_key: "mie",
    confirmed_hour: 20.4,
    pending_hour: 21.18,
    cancelled_hour: 22.38,
    confirmed_count: 58,
    pending_count: 22,
    cancelled_count: 7,
  },
  {
    day_key: "jue",
    confirmed_hour: 20.86,
    pending_hour: 21.46,
    cancelled_hour: 22.68,
    confirmed_count: 74,
    pending_count: 27,
    cancelled_count: 9,
  },
  {
    day_key: "vie",
    confirmed_hour: 21.36,
    pending_hour: 22.0,
    cancelled_hour: 23.06,
    confirmed_count: 92,
    pending_count: 34,
    cancelled_count: 11,
  },
  {
    day_key: "sab",
    confirmed_hour: 21.22,
    pending_hour: 21.92,
    cancelled_hour: 22.98,
    confirmed_count: 86,
    pending_count: 32,
    cancelled_count: 10,
  },
  {
    day_key: "dom",
    confirmed_hour: 20.26,
    pending_hour: 21.0,
    cancelled_hour: 22.14,
    confirmed_count: 43,
    pending_count: 16,
    cancelled_count: 6,
  },
];

function getDemoMode(range: DemoRange): BucketMode {
  return getDemoPeriod(range) === "7d" ? "day" : "week";
}

function getDemoPeriod(range: DemoRange): DemoMetricsPeriod {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return "7d";
  }

  const diffDays = Math.max(1, Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000)));
  if (diffDays <= 14) {
    return "7d";
  }
  if (diffDays <= 45) {
    return "30d";
  }
  return "90d";
}

function isSameRange(left: DemoRange, right: DemoRange): boolean {
  return left.from === right.from && left.to === right.to;
}

function getDemoRangeVariant(
  scenario: DemoScenario,
  period: DemoMetricsPeriod,
  range: DemoRange
): DemoRangeVariant {
  const currentRange = getPanelDemoRange(scenario, period);
  if (isSameRange(range, currentRange)) {
    return "current";
  }

  const previousRange = getPanelDemoPreviousRange(scenario, period);
  if (isSameRange(range, previousRange)) {
    return "previous";
  }

  return "other";
}

function scaleRounded(value: number, factor: number): number {
  return Math.max(0, Math.round(value * factor));
}

function scaleBarReservationValues(
  values: Array<{ confirmed: number; pending: number; cancelled: number }>,
  factor: number
): Array<{ confirmed: number; pending: number; cancelled: number }> {
  return values.map((value) => ({
    confirmed: scaleRounded(value.confirmed, factor),
    pending: scaleRounded(value.pending, factor),
    cancelled: scaleRounded(value.cancelled, factor),
  }));
}

function scaleNumberSeries(values: number[], factor: number): number[] {
  return values.map((value) => scaleRounded(value, factor));
}

function scaleClubOrderValues(
  values: Array<{ sold: number; used: number; revenue: number }>,
  factor: number
): Array<{ sold: number; used: number; revenue: number }> {
  return values.map((value) => ({
    sold: scaleRounded(value.sold, factor),
    used: scaleRounded(value.used, factor),
    revenue: scaleRounded(value.revenue, factor),
  }));
}

function scaleTicketsByTypeValues(
  values: Array<Record<string, number>>,
  factor: number
): Array<Record<string, number>> {
  return values.map((value) =>
    Object.fromEntries(
      Object.entries(value).map(([key, qty]) => [key, scaleRounded(qty, factor)])
    )
  );
}

function buildBucketDates(range: DemoRange, mode: BucketMode, length: number): string[] {
  const toDate = Number.isFinite(Date.parse(range.to)) ? new Date(range.to) : new Date();
  const stepDays = mode === "day" ? 1 : 7;
  const buckets: string[] = [];

  for (let index = length - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(toDate);
    bucketDate.setUTCDate(bucketDate.getUTCDate() - index * stepDays);
    buckets.push(bucketDate.toISOString());
  }

  return buckets;
}

function buildProfileViewSeries(values: number[], bucketDates: string[]): ProfileViewBucket[] {
  return bucketDates.map((bucket, index) => ({
    bucket,
    value: values[index] ?? 0,
  }));
}

function buildReservationSeries(
  values: Array<{ confirmed: number; pending: number; cancelled: number }>,
  bucketDates: string[]
): ReservationStatusBucket[] {
  return bucketDates.map((bucket, index) => ({
    bucket,
    confirmed: values[index]?.confirmed ?? 0,
    pending: values[index]?.pending ?? 0,
    cancelled: values[index]?.cancelled ?? 0,
  }));
}

function buildOrdersSeries(
  values: Array<{ sold: number; used: number }>,
  bucketDates: string[]
): OrdersSoldUsedBucket[] {
  return bucketDates.map((bucket, index) => ({
    bucket,
    sold: values[index]?.sold ?? 0,
    used: values[index]?.used ?? 0,
  }));
}

function buildRevenueSeries(
  values: Array<{ revenue: number }>,
  bucketDates: string[]
): RevenuePaidBucket[] {
  return bucketDates.map((bucket, index) => ({
    bucket,
    value: values[index]?.revenue ?? 0,
  }));
}

function buildTicketsByTypeSeries(
  values: Array<Record<string, number>>,
  bucketDates: string[]
): TicketsSoldByTypeBucket[] {
  return bucketDates.map((bucket, index) => ({
    bucket,
    values: values[index] ?? {},
  }));
}

function cloneReservationDaypartRows(
  rows: ReservationDaypartRow[]
): ReservationDaypartRow[] {
  return rows.map((row) => ({
    day_key: row.day_key,
    values: { ...row.values },
  }));
}

function cloneReservationStatusHourRows(
  rows: ReservationStatusHourRow[]
): ReservationStatusHourRow[] {
  return rows.map((row) => ({ ...row }));
}

function buildBarMetrics(range: DemoRange): MetricsSummaryWithSeries {
  const identity = getPanelDemoIdentity("bar");
  const demoPeriod = getDemoPeriod(range);
  const bucketMode = getDemoMode(range);
  const rangeVariant = getDemoRangeVariant("bar", demoPeriod, range);
  const previousFactor = BAR_PREVIOUS_FACTORS[demoPeriod];
  const periodKpisBase = BAR_PERIOD_KPIS[demoPeriod];
  const reservationValuesBase =
    demoPeriod === "7d"
      ? BAR_DAILY_RESERVATIONS
      : demoPeriod === "30d"
      ? BAR_30D_RESERVATIONS
      : BAR_90D_RESERVATIONS;
  const visitValuesBase =
    demoPeriod === "7d"
      ? BAR_DAILY_VISITS
      : demoPeriod === "30d"
      ? BAR_30D_VISITS
      : BAR_90D_VISITS;
  const reservationDaypartValues =
    demoPeriod === "7d"
      ? BAR_7D_RESERVATION_DAYPART
      : demoPeriod === "30d"
      ? BAR_30D_RESERVATION_DAYPART
      : BAR_90D_RESERVATION_DAYPART;
  const reservationStatusHourValues =
    demoPeriod === "7d"
      ? BAR_7D_RESERVATION_STATUS_HOUR_BY_DAY
      : demoPeriod === "30d"
      ? BAR_30D_RESERVATION_STATUS_HOUR_BY_DAY
      : BAR_90D_RESERVATION_STATUS_HOUR_BY_DAY;
  const periodKpis =
    rangeVariant === "previous"
      ? {
          whatsappClicks: scaleRounded(periodKpisBase.whatsappClicks, previousFactor),
          promoOpenCount: scaleRounded(periodKpisBase.promoOpenCount, previousFactor),
          avgPartySizeConfirmed: Math.max(
            2.5,
            Number((periodKpisBase.avgPartySizeConfirmed - 0.1).toFixed(1))
          ),
          topPromoTitle: periodKpisBase.topPromoTitle,
          topPromoViews: scaleRounded(periodKpisBase.topPromoViews, previousFactor),
        }
      : periodKpisBase;
  const reservationValues =
    rangeVariant === "previous"
      ? scaleBarReservationValues(reservationValuesBase, previousFactor)
      : reservationValuesBase;
  const visitValues =
    rangeVariant === "previous"
      ? scaleNumberSeries(visitValuesBase, previousFactor)
      : visitValuesBase;
  const bucketDates = buildBucketDates(range, bucketMode, reservationValues.length);

  const reservationsTotal = reservationValues.reduce(
    (total, bucket) => total + bucket.confirmed + bucket.pending + bucket.cancelled,
    0
  );
  const reservationsConfirmed = reservationValues.reduce(
    (total, bucket) => total + bucket.confirmed,
    0
  );
  const reservationsPending = reservationValues.reduce(
    (total, bucket) => total + bucket.pending,
    0
  );
  const reservationsCancelled = reservationValues.reduce(
    (total, bucket) => total + bucket.cancelled,
    0
  );
  const profileViews = visitValues.reduce((total, value) => total + value, 0);

  return {
    local_id: identity.local.id,
    range,
    kpis: {
      whatsapp_clicks: periodKpis.whatsappClicks,
      profile_views: profileViews,
      promo_open_count: periodKpis.promoOpenCount,
      reservations_total: reservationsTotal,
      reservations_en_revision: reservationsPending,
      reservations_confirmed: reservationsConfirmed,
      reservations_cancelled: reservationsCancelled,
      orders_total: 0,
      tickets_sold: 0,
      tickets_used: 0,
      revenue_paid: 0,
      top_promo: {
        id: "promo-bar-demo",
        title: periodKpis.topPromoTitle,
        view_count: periodKpis.topPromoViews,
      },
    },
    kpis_range: {
      tickets_sold: 0,
      tickets_used: 0,
      avg_party_size_confirmed: periodKpis.avgPartySizeConfirmed,
      revenue_paid: 0,
    },
    series: {
      bucket_mode: bucketMode,
      profile_views: buildProfileViewSeries(visitValues, bucketDates),
      reservations_by_status: buildReservationSeries(reservationValues, bucketDates),
      reservations_by_daypart: cloneReservationDaypartRows(reservationDaypartValues),
      reservation_daypart_meta: BAR_RESERVATION_DAYPART_META,
      reservations_status_hour_by_day: cloneReservationStatusHourRows(
        reservationStatusHourValues
      ),
      reservation_status_hour_meta: { ...BAR_RESERVATION_STATUS_HOUR_META },
      orders_sold_used: buildOrdersSeries(
        reservationValues.map((bucket) => ({
          sold: bucket.confirmed + bucket.pending,
          used: 0,
        })),
        bucketDates
      ),
    },
  };
}

function buildClubMetrics(range: DemoRange): MetricsSummaryWithSeries {
  const identity = getPanelDemoIdentity("discoteca");
  const demoPeriod = getDemoPeriod(range);
  const bucketMode = getDemoMode(range);
  const rangeVariant = getDemoRangeVariant("discoteca", demoPeriod, range);
  const previousFactor = CLUB_PREVIOUS_FACTORS[demoPeriod];
  const periodKpisBase = CLUB_PERIOD_KPIS[demoPeriod];
  const orderValuesBase =
    demoPeriod === "7d"
      ? CLUB_DAILY_ORDERS
      : demoPeriod === "30d"
      ? CLUB_30D_ORDERS
      : CLUB_90D_ORDERS;
  const visitValuesBase =
    demoPeriod === "7d"
      ? CLUB_DAILY_VISITS
      : demoPeriod === "30d"
      ? CLUB_30D_VISITS
      : CLUB_90D_VISITS;
  const ticketTypeValuesBase =
    demoPeriod === "7d"
      ? CLUB_DAILY_TICKETS_BY_TYPE
      : demoPeriod === "30d"
      ? CLUB_30D_TICKETS_BY_TYPE
      : CLUB_90D_TICKETS_BY_TYPE;
  const periodKpis =
    rangeVariant === "previous"
      ? {
          ordersTotal: scaleRounded(periodKpisBase.ordersTotal, previousFactor),
          whatsappClicks: scaleRounded(periodKpisBase.whatsappClicks, previousFactor),
          promoOpenCount: scaleRounded(periodKpisBase.promoOpenCount, previousFactor),
          topPromoTitle: periodKpisBase.topPromoTitle,
          topPromoViews: scaleRounded(periodKpisBase.topPromoViews, previousFactor),
        }
      : periodKpisBase;
  const orderValues =
    rangeVariant === "previous"
      ? scaleClubOrderValues(orderValuesBase, previousFactor)
      : orderValuesBase;
  const visitValues =
    rangeVariant === "previous"
      ? scaleNumberSeries(visitValuesBase, previousFactor)
      : visitValuesBase;
  const ticketTypeValues =
    rangeVariant === "previous"
      ? scaleTicketsByTypeValues(ticketTypeValuesBase, previousFactor)
      : ticketTypeValuesBase;
  const bucketDates = buildBucketDates(range, bucketMode, orderValues.length);

  const ticketsSold = orderValues.reduce((total, bucket) => total + bucket.sold, 0);
  const ticketsUsed = orderValues.reduce((total, bucket) => total + bucket.used, 0);
  const revenuePaid = orderValues.reduce((total, bucket) => total + bucket.revenue, 0);
  const profileViews = visitValues.reduce((total, value) => total + value, 0);

  return {
    local_id: identity.local.id,
    range,
    kpis: {
      whatsapp_clicks: periodKpis.whatsappClicks,
      profile_views: profileViews,
      promo_open_count: periodKpis.promoOpenCount,
      reservations_total: 0,
      reservations_en_revision: 0,
      reservations_confirmed: 0,
      reservations_cancelled: 0,
      orders_total: periodKpis.ordersTotal,
      tickets_sold: ticketsSold,
      tickets_used: ticketsUsed,
      revenue_paid: revenuePaid,
      top_promo: {
        id: "promo-club-demo",
        title: periodKpis.topPromoTitle,
        view_count: periodKpis.topPromoViews,
      },
    },
    kpis_range: {
      tickets_sold: ticketsSold,
      tickets_used: ticketsUsed,
      revenue_paid: revenuePaid,
    },
    series: {
      bucket_mode: bucketMode,
      profile_views: buildProfileViewSeries(visitValues, bucketDates),
      reservations_by_status: buildReservationSeries(
        orderValues.map((bucket) => ({
          confirmed: 0,
          pending: Math.max(bucket.sold - bucket.used, 0),
          cancelled: 0,
        })),
        bucketDates
      ),
      orders_sold_used: buildOrdersSeries(orderValues, bucketDates),
      tickets_sold_by_type: buildTicketsByTypeSeries(ticketTypeValues, bucketDates),
      ticket_types_meta: CLUB_TICKET_TYPES_META,
      revenue_paid: buildRevenueSeries(orderValues, bucketDates),
    },
  };
}

export async function getPanelDemoMetricsSummaryWithSeries(
  scenario: DemoScenario,
  range: DemoRange
): Promise<MetricsSummaryWithSeries> {
  return scenario === "bar" ? buildBarMetrics(range) : buildClubMetrics(range);
}
