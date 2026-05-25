import type { PanelUserInfo } from "@/lib/panel";
import type { DemoScenario } from "./runtime";
import { getPanelDemoVariant } from "./variants";

export function getPanelDemoIdentity(scenario: DemoScenario): PanelUserInfo {
  const variant = getPanelDemoVariant(scenario);
  return {
    role: "owner",
    email: variant.email,
    local: {
      id: variant.localId,
      name: variant.name,
      slug: variant.slug,
      type: variant.type,
    },
  };
}
