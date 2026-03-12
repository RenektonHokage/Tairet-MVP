import type { PanelUserInfo } from "@/lib/panel";
import type { DemoScenario } from "./runtime";

const DEMO_IDENTITIES: Record<DemoScenario, PanelUserInfo> = {
  bar: {
    role: "owner",
    email: "demo.bar@tairet.test",
    local: {
      id: "demo-bar",
      name: "Demo Bar Tairet",
      slug: "demo-bar",
      type: "bar",
    },
  },
  discoteca: {
    role: "owner",
    email: "demo.discoteca@tairet.test",
    local: {
      id: "demo-discoteca",
      name: "Demo Discoteca Tairet",
      slug: "demo-discoteca",
      type: "club",
    },
  },
};

export function getPanelDemoIdentity(scenario: DemoScenario): PanelUserInfo {
  const identity = DEMO_IDENTITIES[scenario];
  return {
    ...identity,
    local: {
      ...identity.local,
    },
  };
}
