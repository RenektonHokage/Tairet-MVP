import * as React from "react";
import { cn, panelUi } from "../../ui";

export type RangeValue = "7d" | "30d";

export interface RangeToggleProps {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}

export function RangeToggle({ value, onChange }: RangeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1">
      <button
        type="button"
        onClick={() => onChange("7d")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          panelUi.focusRing,
          value === "7d"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
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
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        )}
      >
        30 días
      </button>
    </div>
  );
}
