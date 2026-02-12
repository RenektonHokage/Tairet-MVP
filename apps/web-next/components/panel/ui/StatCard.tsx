import * as React from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn, panelUi } from "./panel-ui";
import { Card, CardContent } from "./Card";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { value: string; direction?: "up" | "down" | "flat" };
}

const trendStyles = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-neutral-500",
};

export function StatCard({ label, value, hint, trend }: StatCardProps) {
  const direction = trend?.direction ?? "flat";
  const TrendIcon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <Card className="h-full">
      <CardContent className="flex min-h-[112px] flex-col justify-between gap-3 px-4 py-4 md:px-5 md:py-5">
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="text-3xl font-semibold leading-tight text-neutral-950">{value}</div>
        </div>
        {(hint || trend) ? (
          <div className="flex items-center justify-between gap-3 text-xs">
            {hint ? <span className={panelUi.statHint}>{hint}</span> : <span />}
            {trend ? (
              <span className={cn("flex items-center gap-1 font-medium", trendStyles[direction])}>
                <TrendIcon className="h-4 w-4" />
                {trend.value}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
