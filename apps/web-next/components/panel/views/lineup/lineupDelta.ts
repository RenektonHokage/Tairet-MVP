export type DeltaTone = "positive" | "negative" | "neutral";

import { panelSuccessTone } from "../../ui";

export const deltaToneClass: Record<DeltaTone, string> = {
  positive: panelSuccessTone.textClass,
  negative: "text-rose-600",
  neutral: "text-neutral-400",
};

const deltaComparisonTooltip =
  "Período anterior = el período inmediatamente anterior de la misma duración (7 días vs 7 anteriores, 30 días vs 30 anteriores). El porcentaje muestra la variación relativa: (actual - anterior) / anterior.";

const deltaNoDataTooltip =
  "Período anterior = el período inmediatamente anterior de la misma duración. Si no hay datos previos suficientes, no se calcula la variación porcentual.";

const deltaNoBaseTooltip =
  "Período anterior = el período inmediatamente anterior de la misma duración. Si el valor previo es 0, no existe una base sana para calcular una variación porcentual.";

interface DeltaPresentation {
  text: string;
  tone: DeltaTone;
  tooltip: string;
}

export function getPeriodDelta(
  current: number,
  previous?: number | null
): DeltaPresentation {
  if (previous == null || !Number.isFinite(previous) || previous < 0) {
    return {
      text: "Sin datos previos",
      tone: "neutral",
      tooltip: deltaNoDataTooltip,
    };
  }

  if (previous === 0) {
    return {
      text: "Sin base comparable",
      tone: "neutral",
      tooltip: deltaNoBaseTooltip,
    };
  }

  const pct = ((current - previous) / previous) * 100;
  const roundedPct = Math.round(pct);

  if (roundedPct === 0) {
    return {
      text: "0% vs período anterior",
      tone: "neutral",
      tooltip: deltaComparisonTooltip,
    };
  }

  return {
    text: `${roundedPct > 0 ? "+" : ""}${roundedPct}% vs período anterior`,
    tone: roundedPct > 0 ? "positive" : "negative",
    tooltip: deltaComparisonTooltip,
  };
}
