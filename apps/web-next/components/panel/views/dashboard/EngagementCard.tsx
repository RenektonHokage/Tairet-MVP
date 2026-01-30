import * as React from "react";
import { Eye, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui";
import { RangeToggle, type RangeValue } from "./RangeToggle";

export interface EngagementCardProps {
  range: RangeValue;
  onRangeChange?: (value: RangeValue) => void;
  whatsappClicks: number;
  topPromo?: {
    title: string;
    viewCount?: number;
  } | null;
  /** Si false, muestra el rango como label en vez de toggle (default: true si hay onRangeChange) */
  showToggle?: boolean;
}

export function EngagementCard({
  range,
  onRangeChange,
  whatsappClicks,
  topPromo,
  showToggle = true,
}: EngagementCardProps) {
  const rangeLabel = range === "7d" ? "Últimos 7 días" : "Últimos 30 días";

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Engagement</CardTitle>
        {showToggle && onRangeChange ? (
          <RangeToggle value={range} onChange={onRangeChange} />
        ) : (
          <span className="text-xs text-neutral-500">{rangeLabel}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* WhatsApp Clicks */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Clicks</span>
          </div>
          <div className="text-xs text-neutral-500">Total de interacciones</div>
          <div className="text-3xl font-bold text-neutral-950">
            {whatsappClicks}
          </div>
        </div>

        {/* Top Promo */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Eye className="h-4 w-4" />
            <span>Promo más vista</span>
          </div>
          <div className="text-xs text-neutral-500">Contenido destacado</div>
          <div className="text-lg font-semibold text-neutral-950">
            {topPromo?.title ?? "Sin datos"}
          </div>
          {topPromo?.viewCount != null && (
            <div className="text-xs text-neutral-500">
              {topPromo.viewCount} vistas
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
