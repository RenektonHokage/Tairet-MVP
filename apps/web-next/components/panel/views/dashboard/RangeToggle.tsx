import * as React from "react";
import { cn, panelUi } from "../../ui";

export type RangeValue = "7d" | "30d";

export interface RangeToggleProps {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}

export function RangeToggle({ value, onChange }: RangeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("7d")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          panelUi.focusRing,
          value === "7d"
            ? "bg-neutral-100 text-neutral-900"
            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
        )}
      >
        7 días
      </button>
      <button
        type="button"
        onClick={() => onChange("30d")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          panelUi.focusRing,
          value === "30d"
            ? "bg-neutral-100 text-neutral-900"
            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
        )}
      >
        30 días
      </button>
    </div>
  );
}
