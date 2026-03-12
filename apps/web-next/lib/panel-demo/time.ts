import type { DemoScenario } from "./runtime";

export type DemoMetricsPeriod = "7d" | "30d" | "90d";
export type DemoRange = { from: string; to: string };

type DemoAnchorConfig = {
  now: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  defaultOperationalDate: string;
  operationalDates: string[];
};

const PANEL_DEMO_TIME_CONFIG: Record<DemoScenario, DemoAnchorConfig> = {
  bar: {
    now: {
      year: 2026,
      month: 3,
      day: 20,
      hour: 23,
      minute: 30,
    },
    defaultOperationalDate: "2026-03-20",
    operationalDates: ["2026-03-19", "2026-03-20", "2026-03-21"],
  },
  discoteca: {
    now: {
      year: 2026,
      month: 3,
      day: 21,
      hour: 23,
      minute: 45,
    },
    defaultOperationalDate: "2026-03-21",
    operationalDates: ["2026-03-20", "2026-03-21", "2026-03-22", "2026-03-27"],
  },
};

function createLocalDate(input: DemoAnchorConfig["now"]): Date {
  return new Date(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0
  );
}

function getPeriodDays(period: DemoMetricsPeriod): number {
  if (period === "7d") {
    return 7;
  }
  if (period === "30d") {
    return 30;
  }
  return 90;
}

export function getPanelDemoNow(scenario: DemoScenario): Date {
  return createLocalDate(PANEL_DEMO_TIME_CONFIG[scenario].now);
}

export function getPanelDemoRange(
  scenario: DemoScenario,
  period: DemoMetricsPeriod
): DemoRange {
  const to = getPanelDemoNow(scenario);
  const from = new Date(to.getTime() - getPeriodDays(period) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function getPanelDemoPreviousRange(
  scenario: DemoScenario,
  period: DemoMetricsPeriod
): DemoRange {
  const current = getPanelDemoRange(scenario, period);
  const fromMs = Date.parse(current.from);
  const toMs = Date.parse(current.to);
  const durationMs = Math.max(0, toMs - fromMs);
  return {
    from: new Date(fromMs - durationMs).toISOString(),
    to: new Date(fromMs).toISOString(),
  };
}

export function getPanelDemoDashboardRange(
  scenario: DemoScenario,
  rangeDays: 7 | 30
): DemoRange {
  return getPanelDemoRange(scenario, rangeDays === 7 ? "7d" : "30d");
}

export function getPanelDemoBarReservationsDefaultDate(): string {
  return PANEL_DEMO_TIME_CONFIG.bar.defaultOperationalDate;
}

export function getPanelDemoBarReservationDates(): string[] {
  return [...PANEL_DEMO_TIME_CONFIG.bar.operationalDates];
}

export function getPanelDemoDiscotecaOrdersDefaultDate(): string {
  return PANEL_DEMO_TIME_CONFIG.discoteca.defaultOperationalDate;
}

export function getPanelDemoDiscotecaOrderDates(): string[] {
  return [...PANEL_DEMO_TIME_CONFIG.discoteca.operationalDates];
}
