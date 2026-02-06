"use client";

import { usePanelContext } from "@/lib/panelContext";
import { LineupBarView } from "@/components/panel/views/lineup/LineupBarView";
import { LineupClubView } from "@/components/panel/views/lineup/LineupClubView";

export default function MetricsPage() {
  const { data: context } = usePanelContext();

  if (context?.local.type === "bar") {
    return <LineupBarView />;
  }

  return <LineupClubView />;
}
