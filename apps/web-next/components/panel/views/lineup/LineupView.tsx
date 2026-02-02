"use client";

import { usePanelContext } from "@/lib/panelContext";
import { LineupBarView } from "./LineupBarView";
import { LineupClubView } from "./LineupClubView";

export function LineupView() {
  const { data: context } = usePanelContext();

  if (context?.local.type === "bar") {
    return <LineupBarView />;
  }

  return <LineupClubView />;
}
