import type { ClubBreakdown } from "@/lib/metricsBreakdown";

type DemoMetricsWindow = "7d" | "30d" | "90d";

const CLUB_BREAKDOWN_BY_WINDOW: Record<DemoMetricsWindow, ClubBreakdown> = {
  "7d": {
    window: "7d",
    tickets_top: [
      {
        ticket_type_id: "general",
        name: "General",
        sold_qty: 161,
        used_orders: 124,
        revenue: 9660000,
      },
      {
        ticket_type_id: "vip",
        name: "Free pass",
        sold_qty: 68,
        used_orders: 52,
        revenue: 0,
      },
      {
        ticket_type_id: "backstage",
        name: "Backstage",
        sold_qty: 40,
        used_orders: 30,
        revenue: 4600000,
      },
    ],
    tables_interest_top: [
      {
        table_type_id: "mesa-premium",
        name: "Mesa Premium",
        price: 4200000,
        interest_count: 128,
      },
      {
        table_type_id: "mesa-central",
        name: "Mesa Central",
        price: 3200000,
        interest_count: 102,
      },
      {
        table_type_id: "mesa-terraza",
        name: "Mesa Terraza",
        price: 2700000,
        interest_count: 76,
      },
      {
        table_type_id: "mesa-lounge",
        name: "Mesa Lounge",
        price: 2400000,
        interest_count: 59,
      },
      {
        table_type_id: "mesa-backstage",
        name: "Mesa Backstage",
        price: 3600000,
        interest_count: 44,
      },
      {
        table_type_id: "mesa-rooftop",
        name: "Mesa Rooftop",
        price: 2900000,
        interest_count: 31,
      },
    ],
  },
  "30d": {
    window: "30d",
    tickets_top: [
      {
        ticket_type_id: "general",
        name: "General",
        sold_qty: 519,
        used_orders: 366,
        revenue: 31140000,
      },
      {
        ticket_type_id: "vip",
        name: "Free pass",
        sold_qty: 224,
        used_orders: 161,
        revenue: 0,
      },
      {
        ticket_type_id: "backstage",
        name: "Backstage",
        sold_qty: 128,
        used_orders: 90,
        revenue: 14720000,
      },
    ],
    tables_interest_top: [
      {
        table_type_id: "mesa-premium",
        name: "Mesa Premium",
        price: 4200000,
        interest_count: 372,
      },
      {
        table_type_id: "mesa-central",
        name: "Mesa Central",
        price: 3200000,
        interest_count: 298,
      },
      {
        table_type_id: "mesa-terraza",
        name: "Mesa Terraza",
        price: 2700000,
        interest_count: 224,
      },
      {
        table_type_id: "mesa-lounge",
        name: "Mesa Lounge",
        price: 2400000,
        interest_count: 169,
      },
      {
        table_type_id: "mesa-backstage",
        name: "Mesa Backstage",
        price: 3600000,
        interest_count: 132,
      },
      {
        table_type_id: "mesa-rooftop",
        name: "Mesa Rooftop",
        price: 2900000,
        interest_count: 97,
      },
    ],
  },
  "90d": {
    window: "90d",
    tickets_top: [
      {
        ticket_type_id: "general",
        name: "General",
        sold_qty: 1223,
        used_orders: 865,
        revenue: 73380000,
      },
      {
        ticket_type_id: "vip",
        name: "Free pass",
        sold_qty: 541,
        used_orders: 369,
        revenue: 0,
      },
      {
        ticket_type_id: "backstage",
        name: "Backstage",
        sold_qty: 293,
        used_orders: 221,
        revenue: 33695000,
      },
    ],
    tables_interest_top: [
      {
        table_type_id: "mesa-premium",
        name: "Mesa Premium",
        price: 4200000,
        interest_count: 884,
      },
      {
        table_type_id: "mesa-central",
        name: "Mesa Central",
        price: 3200000,
        interest_count: 706,
      },
      {
        table_type_id: "mesa-terraza",
        name: "Mesa Terraza",
        price: 2700000,
        interest_count: 528,
      },
      {
        table_type_id: "mesa-lounge",
        name: "Mesa Lounge",
        price: 2400000,
        interest_count: 404,
      },
      {
        table_type_id: "mesa-backstage",
        name: "Mesa Backstage",
        price: 3600000,
        interest_count: 316,
      },
      {
        table_type_id: "mesa-rooftop",
        name: "Mesa Rooftop",
        price: 2900000,
        interest_count: 245,
      },
    ],
  },
};

export async function getPanelDemoClubBreakdown(
  window: DemoMetricsWindow = "30d"
): Promise<ClubBreakdown> {
  return CLUB_BREAKDOWN_BY_WINDOW[window];
}
