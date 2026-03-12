export type DemoScenario = "bar" | "discoteca";

export interface PanelDemoRuntime {
  scenario: DemoScenario;
}

const PANEL_DEMO_STORAGE_KEY = "tairet.panel.demo";
const DEMO_SCENARIOS: DemoScenario[] = ["bar", "discoteca"];

export function isPanelDemoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PANEL_DEMO === "true";
}

export function isDemoScenario(value: string): value is DemoScenario {
  return DEMO_SCENARIOS.includes(value as DemoScenario);
}

export function getStoredPanelDemoRuntime(): PanelDemoRuntime | null {
  if (!isPanelDemoEnabled() || typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(PANEL_DEMO_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PanelDemoRuntime>;
    if (!parsed.scenario || !isDemoScenario(parsed.scenario)) {
      return null;
    }

    return { scenario: parsed.scenario };
  } catch {
    return null;
  }
}

export function persistPanelDemoRuntime(scenario: DemoScenario): void {
  if (!isPanelDemoEnabled() || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PANEL_DEMO_STORAGE_KEY,
    JSON.stringify({ scenario } satisfies PanelDemoRuntime)
  );
}

export function clearPanelDemoRuntime(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PANEL_DEMO_STORAGE_KEY);
}
