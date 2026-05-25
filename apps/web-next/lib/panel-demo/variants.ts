import type { DemoScenario } from "./runtime";

export interface PanelDemoVariant {
  scenario: DemoScenario;
  localId: string;
  name: string;
  slug: string;
  type: "bar" | "club";
  email: string;
}

export const demoBar: PanelDemoVariant = {
  scenario: "bar",
  localId: "demo-bar",
  name: "Tairet Bar",
  slug: "demo-bar",
  type: "bar",
  email: "demo.tairet-bar@tairet.test",
};

export const demoClub: PanelDemoVariant = {
  scenario: "discoteca",
  localId: "demo-discoteca",
  name: "Koala Jack",
  slug: "demo-discoteca",
  type: "club",
  email: "demo.koala-jack@tairet.test",
};

export const PANEL_DEMO_VARIANTS: Record<DemoScenario, PanelDemoVariant> = {
  bar: demoBar,
  discoteca: demoClub,
};

export function getPanelDemoVariant(scenario: DemoScenario): PanelDemoVariant {
  return PANEL_DEMO_VARIANTS[scenario];
}
