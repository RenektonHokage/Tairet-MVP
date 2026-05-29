"use client";

import * as React from "react";

import {
  getPanelEntityActivity,
  type OperationalActivityEntityType,
  type OperationalActivityItem,
} from "@/lib/activity";
import { cn, panelUi } from "./ui";

type ActivityHistoryTone = "light" | "dark";

interface OperationalActivityHistoryProps {
  entityType: OperationalActivityEntityType;
  entityId: string;
  tone?: ActivityHistoryTone;
  demoItems?: OperationalActivityItem[];
}

function getActorLabel(item: OperationalActivityItem): string {
  const actorLabel = item.actor_label?.trim();

  if (actorLabel) {
    return actorLabel;
  }

  if (item.actor_type === "customer") {
    return "Cliente";
  }

  if (item.actor_type === "system") {
    return "Sistema";
  }

  if (item.actor_role === "owner") {
    return "Owner";
  }

  if (item.actor_role === "staff") {
    return "Staff";
  }

  return "Panel";
}

function formatActivityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OperationalActivityHistory({
  entityType,
  entityId,
  tone = "light",
  demoItems,
}: OperationalActivityHistoryProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [items, setItems] = React.useState<OperationalActivityItem[]>([]);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);

  const isDark = tone === "dark";
  const isDemoHistory = Array.isArray(demoItems);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadHistory = React.useCallback(async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isDemoHistory) {
        setItems(demoItems ?? []);
        setHasLoaded(true);
        return;
      }

      const response = await getPanelEntityActivity({ entityType, entityId });
      if (!mountedRef.current) {
        return;
      }
      setItems(response.items ?? []);
      setHasLoaded(true);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [demoItems, entityId, entityType, isDemoHistory, loading]);

  React.useEffect(() => {
    if (isDemoHistory && hasLoaded) {
      setItems(demoItems ?? []);
    }
  }, [demoItems, hasLoaded, isDemoHistory]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && !hasLoaded) {
      void loadHistory();
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border",
        isDark ? "border-[#303030] bg-[#171717]" : "border-neutral-200 bg-white"
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold",
          panelUi.focusRing,
          isDark
            ? "text-[#E5E5E5] hover:bg-[#1F1F1F]"
            : "text-neutral-700 hover:bg-neutral-50"
        )}
      >
        <span>Historial</span>
        <span
          className={cn(
            "text-[11px] font-medium",
            isDark ? "text-[#A3A3A3]" : "text-neutral-500"
          )}
        >
          {isOpen ? "Ocultar" : "Ver"}
        </span>
      </button>

      {isOpen ? (
        <div
          className={cn(
            "space-y-2 border-t px-3 py-3",
            isDark ? "border-[#303030]" : "border-neutral-200"
          )}
        >
          {loading ? (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-[#A3A3A3]" : "text-neutral-500"
              )}
            >
              Cargando historial...
            </p>
          ) : null}

          {!loading && error ? (
            <div className="space-y-2">
              <p className="text-xs text-rose-600">
                No se pudo cargar el historial.
              </p>
              <button
                type="button"
                onClick={() => void loadHistory()}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  panelUi.focusRing,
                  isDark
                    ? "border-[#3A3A3A] text-[#D4D4D4] hover:bg-[#262626]"
                    : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                )}
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-[#A3A3A3]" : "text-neutral-500"
              )}
            >
              Sin actividad registrada todavía.
            </p>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    isDark
                      ? "border-[#303030] bg-[#1F1F1F]"
                      : "border-neutral-200 bg-neutral-50"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isDark ? "text-[#F5F5F5]" : "text-neutral-900"
                    )}
                  >
                    {formatActivityDate(item.created_at)} - {item.message}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      isDark ? "text-[#A3A3A3]" : "text-neutral-500"
                    )}
                  >
                    Actor: {getActorLabel(item)}
                  </p>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={loading}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  panelUi.focusRing,
                  isDark
                    ? "border-[#3A3A3A] text-[#D4D4D4] hover:bg-[#262626]"
                    : "border-neutral-200 text-neutral-700 hover:bg-white"
                )}
              >
                Actualizar historial
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
