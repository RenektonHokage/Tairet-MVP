import * as React from "react";
import { StatCard } from "../../ui";

export interface KpiItem {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { value: string; direction?: "up" | "down" | "flat" };
  icon?: React.ReactNode;
}

export interface KpiGridProps {
  items: KpiItem[];
  columns?: 2 | 3 | 4;
}

export function KpiGrid({ items, columns = 3 }: KpiGridProps) {
  const colClass =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
      ? "md:grid-cols-4"
      : "md:grid-cols-3";

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {items.map((item, index) => (
        <StatCard
          key={index}
          label={item.label}
          value={
            item.icon ? (
              <div className="flex items-center justify-between gap-3">
                <span>{item.value}</span>
                {item.icon}
              </div>
            ) : (
              item.value
            )
          }
          hint={item.hint}
          trend={item.trend}
        />
      ))}
    </div>
  );
}
