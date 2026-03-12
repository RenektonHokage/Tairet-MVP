"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, cn, panelUi } from "@/components/panel/ui";
import { usePanelContext } from "@/lib/panelContext";
import { getApiBase, getAuthHeaders } from "@/lib/api";
import { downloadPanelReservationsClientsCsv } from "@/lib/panelExport";
import {
  getPanelDemoDiscotecaOrdersSummary,
  searchPanelDemoDiscotecaOrders,
} from "@/lib/panel-demo/orders";
import { getPanelDemoNow } from "@/lib/panel-demo/time";

interface OrderItem {
  id: string;
  status: string;
  used_at: string | null;
  checkin_token: string | null;
  customer_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone?: string | null;
  customer_document: string | null;
  quantity?: number | null;
  created_at?: string;
  intended_date?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  checkin_state?: "used" | "pending" | "unused" | "other";
}

interface OrdersResponse {
  items: OrderItem[];
  count: number;
}

interface OrdersSummaryResponse {
  total_qty: number;
  used_qty: number;
  pending_qty: number;
  unused_qty: number;
  revenue_paid: number;
  latest_purchase_at: string | null;
  recent_sales_qty: number;
  recent_sales_window_label: string;
  total_count: number;
  used_count: number;
  pending_count: number;
  unused_count: number;
  current_window: {
    intended_date: string;
    valid_from: string;
    valid_to: string;
    window_key: string;
  } | null;
}

type SearchType = "email" | "document";
type EntryStateFilter = "all" | "used" | "pending" | "unused";
type EntryResolvedState = "used" | "pending" | "unused" | "other";
type OrdersTemporalContext = "future" | "today" | "past";
type SummaryCardKey =
  | EntryStateFilter
  | "revenue"
  | "recent_sales"
  | "latest_purchase";

interface OrdersSummaryCard {
  key: SummaryCardKey;
  label: string;
  value: string | number;
  accent: string;
  tone: "info" | "positive" | "warning" | "muted";
  interactive?: boolean;
}

type PanelTheme = "dark" | "light";

const PANEL_THEME_STORAGE_KEY = "tairet.panel.theme";
const PANEL_THEME_EVENT_NAME = "tairet:panel-theme-change";

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveTemporalContext(
  selectedDate: string,
  nowDate: Date
): OrdersTemporalContext {
  const referenceDateKey = getDateKey(nowDate);

  if (selectedDate > referenceDateKey) {
    return "future";
  }

  if (selectedDate < referenceDateKey) {
    return "past";
  }

  return "today";
}

function getAllowedStateFilters(
  temporalContext: OrdersTemporalContext
): EntryStateFilter[] {
  if (temporalContext === "today") {
    return ["all", "used", "pending"];
  }

  if (temporalContext === "past") {
    return ["all", "used", "unused"];
  }

  return ["all"];
}

function getEffectiveStateFilter(
  temporalContext: OrdersTemporalContext,
  currentFilter: EntryStateFilter
): EntryStateFilter {
  return getAllowedStateFilters(temporalContext).includes(currentFilter)
    ? currentFilter
    : "all";
}

export default function OrdersPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    data: context,
    loading: contextLoading,
    error: contextError,
    isDemo,
    demoScenario,
  } = usePanelContext();

  const isClub = context?.local.type === "club";
  const isDemoDiscoteca =
    isDemo && demoScenario === "discoteca" && context?.local.type === "club";
  const [searchType, setSearchType] = useState<SearchType>("email");
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearchValue, setAppliedSearchValue] = useState("");
  const [intendedDate, setIntendedDate] = useState("");
  const [stateFilter, setStateFilter] = useState<EntryStateFilter>("all");

  const [entries, setEntries] = useState<OrderItem[]>([]);
  const [entriesCount, setEntriesCount] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [summary, setSummary] = useState<OrdersSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [panelTheme, setPanelTheme] = useState<PanelTheme>("dark");
  const summaryRequestIdRef = useRef(0);
  const entriesRequestIdRef = useRef(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncTheme = (nextTheme?: string | null) => {
      if (nextTheme === "dark" || nextTheme === "light") {
        setPanelTheme(nextTheme);
      }
    };

    try {
      syncTheme(window.localStorage.getItem(PANEL_THEME_STORAGE_KEY));
    } catch {
      // noop
    }

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<PanelTheme>;
      syncTheme(customEvent.detail);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PANEL_THEME_STORAGE_KEY) {
        syncTheme(event.newValue);
      }
    };

    window.addEventListener(PANEL_THEME_EVENT_NAME, handleThemeChange as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        PANEL_THEME_EVENT_NAME,
        handleThemeChange as EventListener
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isClub) {
      setIntendedDate("");
      setExportFrom("");
      setExportTo("");
      return;
    }
    const nextDate = searchParams.get("intended_date") ?? "";
    setIntendedDate(nextDate);
    if (nextDate) {
      setExportFrom((current) => current || nextDate);
      setExportTo((current) => current || nextDate);
    }
  }, [searchParams, isClub]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const updateIntendedDateInUrl = (value: string) => {
    if (!isClub) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("intended_date", value);
    } else {
      params.delete("intended_date");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const loadSummary = useCallback(async (dateValue?: string): Promise<OrdersSummaryResponse | null> => {
    if (!isClub) {
      setSummary(null);
      setSummaryError(null);
      return null;
    }

    const requestId = ++summaryRequestIdRef.current;
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const data: OrdersSummaryResponse = isDemoDiscoteca
        ? getPanelDemoDiscotecaOrdersSummary(dateValue)
        : await (async () => {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (dateValue) {
              params.set("intended_date", dateValue);
            }

            const query = params.toString();
            const url = `${getApiBase()}/panel/orders/summary${query ? `?${query}` : ""}`;
            const response = await fetch(url, {
              method: "GET",
              credentials: "include",
              headers,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Error ${response.status}`);
            }

            return (await response.json()) as OrdersSummaryResponse;
          })();

      if (requestId !== summaryRequestIdRef.current) {
        return null;
      }
      setSummary(data);
      return data;
    } catch (error) {
      if (requestId !== summaryRequestIdRef.current) {
        return null;
      }
      setSummaryError(error instanceof Error ? error.message : "Error al cargar resumen");
      return null;
    } finally {
      if (requestId === summaryRequestIdRef.current) {
        setSummaryLoading(false);
      }
    }
  }, [isClub, isDemoDiscoteca]);

  const loadEntries = useCallback(async () => {
    if (contextLoading || !context) {
      return;
    }

    if (isClub && !intendedDate) {
      return;
    }

    const requestId = ++entriesRequestIdRef.current;
    setEntriesLoading(true);
    setEntriesError(null);

    try {
      const referenceNow = isDemoDiscoteca ? getPanelDemoNow("discoteca") : new Date();
      const temporalContext =
        isClub && intendedDate
          ? resolveTemporalContext(intendedDate, referenceNow)
          : "future";
      const effectiveStateFilter = getEffectiveStateFilter(
        temporalContext,
        stateFilter
      );
      const trimmedSearch = appliedSearchValue.trim();
      const data: OrdersResponse = isDemoDiscoteca
        ? searchPanelDemoDiscotecaOrders({
            intendedDate,
            searchType,
            searchValue: trimmedSearch,
            state: effectiveStateFilter,
            limit: 20,
          })
        : await (async () => {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (trimmedSearch) {
              params.set(searchType === "email" ? "email" : "document", trimmedSearch);
            }
            if (isClub && intendedDate) {
              params.set("intended_date", intendedDate);
            }
            if (isClub && effectiveStateFilter !== "all") {
              params.set("state", effectiveStateFilter);
            }
            params.set("limit", "20");

            const response = await fetch(`${getApiBase()}/panel/orders/search?${params.toString()}`, {
              method: "GET",
              credentials: "include",
              headers,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Error ${response.status}`);
            }

            return (await response.json()) as OrdersResponse;
          })();

      if (requestId !== entriesRequestIdRef.current) {
        return;
      }
      setEntries(data.items ?? []);
      setEntriesCount(data.count ?? 0);
    } catch (error) {
      if (requestId !== entriesRequestIdRef.current) {
        return;
      }
      setEntriesError(error instanceof Error ? error.message : "Error al cargar entradas");
    } finally {
      if (requestId === entriesRequestIdRef.current) {
        setEntriesLoading(false);
      }
    }
  }, [
    appliedSearchValue,
    context,
    contextLoading,
    intendedDate,
    isClub,
    isDemoDiscoteca,
    searchType,
    stateFilter,
  ]);

  useEffect(() => {
    if (contextLoading || !context || !isClub) {
      return;
    }

    let active = true;

    const syncSummary = async () => {
      const data = await loadSummary(intendedDate || undefined);
      if (!active || !data) {
        return;
      }

      if (!intendedDate && data.current_window?.intended_date) {
        const nextDate = data.current_window.intended_date;
        if (nextDate !== intendedDate) {
          updateIntendedDateInUrl(nextDate);
        }
      }
    };

    void syncSummary();

    return () => {
      active = false;
    };
  }, [context, contextLoading, intendedDate, isClub, loadSummary]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleSearch = () => {
    setAppliedSearchValue(searchValue.trim());
  };

  const handleExportCsv = async () => {
    if (!exportFrom || !exportTo || exportLoading) {
      return;
    }

    if (isDemoDiscoteca) {
      setExportError("La exportacion CSV no esta disponible en modo demo.");
      return;
    }

    setExportError(null);
    setExportLoading(true);
    try {
      await downloadPanelReservationsClientsCsv({ from: exportFrom, to: exportTo });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Error al exportar CSV");
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyToken = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // noop
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatEventDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const formatSelectedDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Sin fecha seleccionada";
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return formatEventDate(dateStr);
    }
    return parsed.toLocaleDateString("es-PY", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRelativePurchaseTime = (
    dateStr: string | null,
    nowDate: Date
  ) => {
    if (!dateStr) {
      return "Sin compras";
    }

    const purchaseMs = Date.parse(dateStr);
    if (!Number.isFinite(purchaseMs)) {
      return "-";
    }

    const diffMs = nowDate.getTime() - purchaseMs;
    if (diffMs <= 60 * 1000) {
      return "Hace instantes";
    }

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) {
      return `Hace ${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `Hace ${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
  };

  const formatTokenLabel = (token: string | null) => {
    if (!token) return "-";
    return `TKN-${token.slice(0, 8).toUpperCase()}`;
  };

  const resolveState = (order: OrderItem): EntryResolvedState => {
    if (order.checkin_state) {
      return order.checkin_state;
    }

    if (order.used_at) {
      return "used";
    }

    const nowMs = Date.now();
    const validFromMs = order.valid_from ? Date.parse(order.valid_from) : NaN;
    const validToMs = order.valid_to ? Date.parse(order.valid_to) : NaN;
    const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;

    if (
      order.status === "paid" &&
      Number.isFinite(validFromMs) &&
      Number.isFinite(validToMs) &&
      validFromMs <= nowMs &&
      validToMs > nowMs
    ) {
      return "pending";
    }

    if (
      order.status === "paid" &&
      Number.isFinite(validToMs) &&
      validToMs >= thirtyDaysAgoMs &&
      validToMs <= nowMs
    ) {
      return "unused";
    }

    return "other";
  };

  const stateStyles = useMemo<
    Record<
      EntryResolvedState,
      {
        label: string;
        badge: string;
        border: string;
        iconBg: string;
        borderColor: string;
        badgeStyle?: CSSProperties;
      }
    >
  >(
    () =>
      panelTheme === "dark"
        ? {
            used: {
              label: "Usada",
              badge:
                "border text-[#86EFAC]",
              border: "border-l-transparent",
              iconBg: "bg-[#22C55E]",
              borderColor: "#22C55E",
              badgeStyle: {
                borderColor: "rgba(34,197,94,0.35)",
                backgroundColor: "rgba(34,197,94,0.14)",
              },
            },
            pending: {
              label: "Pendiente",
              badge:
                "border text-[#FDE047]",
              border: "border-l-transparent",
              iconBg: "bg-[#FACC15]",
              borderColor: "#FACC15",
              badgeStyle: {
                borderColor: "rgba(250,204,21,0.34)",
                backgroundColor: "rgba(250,204,21,0.14)",
              },
            },
            unused: {
              label: "No usada",
              badge:
                "border text-[#E2E8F0]",
              border: "border-l-transparent",
              iconBg: "bg-[#94A3B8]",
              borderColor: "#94A3B8",
              badgeStyle: {
                borderColor: "rgba(148,163,184,0.34)",
                backgroundColor: "rgba(148,163,184,0.16)",
              },
            },
            other: {
              label: "Sin estado",
              badge:
                "border text-[#CBD5E1]",
              border: "border-l-transparent",
              iconBg: "bg-[rgba(71,85,105,0.28)]",
              borderColor: "#64748B",
              badgeStyle: {
                borderColor: "rgba(148,163,184,0.28)",
                backgroundColor: "rgba(71,85,105,0.14)",
              },
            },
          }
        : {
            used: {
              label: "Usada",
              badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
              border: "border-l-emerald-400",
              iconBg: "bg-[#22C55E]",
              borderColor: "#4ade80",
            },
            pending: {
              label: "Pendiente",
              badge: "bg-amber-50 text-amber-700 border border-amber-200",
              border: "border-l-amber-400",
              iconBg: "bg-[#FACC15]",
              borderColor: "#facc15",
            },
            unused: {
              label: "No usada",
              badge: "bg-slate-100 text-slate-700 border border-slate-200",
              border: "border-l-slate-400",
              iconBg: "bg-[#94A3B8]",
              borderColor: "#94a3b8",
            },
            other: {
              label: "Sin estado",
              badge: "bg-slate-50 text-slate-600 border border-slate-200",
              border: "border-l-slate-300",
              iconBg: "bg-slate-100",
              borderColor: "#cbd5e1",
            },
          },
    [panelTheme]
  );

  const currentReferenceDate = isDemoDiscoteca
    ? getPanelDemoNow("discoteca")
    : new Date();
  const temporalContext: OrdersTemporalContext =
    isClub && intendedDate
      ? resolveTemporalContext(intendedDate, currentReferenceDate)
      : "future";
  const effectiveStateFilter = getEffectiveStateFilter(
    temporalContext,
    stateFilter
  );

  useEffect(() => {
    if (stateFilter !== effectiveStateFilter) {
      setStateFilter(effectiveStateFilter);
    }
  }, [effectiveStateFilter, stateFilter]);

  const summaryCards = useMemo<OrdersSummaryCard[]>(() => {
    const source = summary ?? {
      total_qty: 0,
      used_qty: 0,
      pending_qty: 0,
      unused_qty: 0,
      revenue_paid: 0,
      latest_purchase_at: null,
      recent_sales_qty: 0,
      recent_sales_window_label: "Últimas 24 h",
    };

    if (temporalContext === "future") {
      return [
        {
          key: "all",
          label: "Vendidas para esta fecha",
          value: source.total_qty,
          accent: "border-blue-500",
          tone: "info",
          interactive: true,
        },
        {
          key: "revenue",
          label: "Ingresos acumulados",
          value: formatCurrency(source.revenue_paid),
          accent: "border-emerald-500",
          tone: "positive",
          interactive: false,
        },
        {
          key: "recent_sales",
          label: `Ritmo reciente de venta · ${source.recent_sales_window_label}`,
          value: source.recent_sales_qty,
          accent: "border-violet-500",
          tone: "info",
          interactive: false,
        },
        {
          key: "latest_purchase",
          label: "Última compra",
          value: formatRelativePurchaseTime(
            source.latest_purchase_at,
            currentReferenceDate
          ),
          accent: "border-slate-400",
          tone: "muted",
          interactive: false,
        },
      ];
    }

    if (temporalContext === "today") {
      return [
        {
          key: "all",
          label: "Vendidas hoy",
          value: source.total_qty,
          accent: "border-blue-500",
          tone: "info",
          interactive: true,
        },
        {
          key: "used",
          label: "Usadas",
          value: source.used_qty,
          accent: "border-emerald-500",
          tone: "positive",
          interactive: true,
        },
        {
          key: "pending",
          label: "Pendientes",
          value: source.pending_qty,
          accent: "border-amber-500",
          tone: "warning",
          interactive: true,
        },
        {
          key: "revenue",
          label: "Ingresos de hoy",
          value: formatCurrency(source.revenue_paid),
          accent: "border-emerald-500",
          tone: "positive",
          interactive: false,
        },
      ];
    }

    return [
      {
        key: "all",
        label: "Vendidas ese día",
        value: source.total_qty,
        accent: "border-blue-500",
        tone: "info",
        interactive: true,
      },
      {
        key: "used",
        label: "Usadas",
        value: source.used_qty,
        accent: "border-emerald-500",
        tone: "positive",
        interactive: true,
      },
      {
        key: "unused",
        label: "No usadas",
        value: source.unused_qty,
        accent: "border-slate-500",
        tone: "muted",
        interactive: true,
      },
      {
        key: "revenue",
        label: "Ingresos de ese día",
        value: formatCurrency(source.revenue_paid),
        accent: "border-emerald-500",
        tone: "positive",
        interactive: false,
      },
    ];
  }, [currentReferenceDate, summary, temporalContext]);

  const getSummaryCardShellClasses = (
    card: OrdersSummaryCard,
    active: boolean
  ) => {
    if (panelTheme !== "dark") {
      return active
        ? `${card.accent} ring-1 ring-slate-300`
        : "border-slate-200 hover:border-slate-300";
    }

    return "border-[#1F2937] hover:border-[#374151]";
  };

  const getSummaryCardStyle = (
    card: OrdersSummaryCard,
    active: boolean
  ): CSSProperties | undefined => {
    if (panelTheme !== "dark") {
      return undefined;
    }

    if (!active) {
      return {
        borderColor: "#1F2937",
        backgroundColor: "#111827",
      };
    }

    const toneBorderColors: Record<OrdersSummaryCard["tone"], string> = {
      info: "#60A5FA",
      positive: "#22C55E",
      warning: "#FACC15",
      muted: "#94A3B8",
    };

    return {
      backgroundColor: "#111827",
      borderColor: toneBorderColors[card.tone],
    };
  };

  const getSummaryValueClass = (card: OrdersSummaryCard) => {
    if (panelTheme !== "dark") {
      return "text-slate-900";
    }

    return "text-[#F3F4F6]";
  };

  const getSummaryLabelClass = (card: OrdersSummaryCard) => {
    if (panelTheme !== "dark") {
      return "text-slate-600";
    }

    return "text-[#CBD5E1]";
  };

  const getEntryCardStyle = (stateStyle: (typeof stateStyles)[EntryResolvedState]) => {
    if (panelTheme !== "dark") {
      return undefined;
    }

    return {
      backgroundColor: "#111827",
      borderColor: "#1F2937",
      borderLeftColor: stateStyle.borderColor,
    } satisfies CSSProperties;
  };

  const renderEntryCard = (order: OrderItem) => {
    const resolvedState = resolveState(order);
    const stateStyle = stateStyles[resolvedState];
    const fullName = `${order.customer_name ?? ""} ${order.customer_last_name ?? ""}`.trim() || "-";
    const quantity = typeof order.quantity === "number" ? order.quantity : 0;

    return (
      <div
        key={order.id}
        data-orders-entry-card="true"
        data-orders-entry-state={resolvedState}
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${stateStyle.border}`}
        style={getEntryCardStyle(stateStyle)}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center lg:gap-x-8">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[132px_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_90px] lg:gap-x-6">
            <div className="min-w-0">
              <span
                data-orders-entry-chip="true"
                data-orders-entry-state={resolvedState}
                className={`inline-flex min-w-[118px] items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${stateStyle.badge}`}
                style={panelTheme === "dark" ? stateStyle.badgeStyle : undefined}
              >
                {stateStyle.label}
              </span>
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold text-slate-900">{fullName}</p>
              <p className="text-slate-500">Nombre</p>
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-slate-800">{order.customer_email || "-"}</p>
              <p className="text-slate-500">Email</p>
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-slate-800">{order.customer_phone || "-"}</p>
              <p className="text-slate-500">Teléfono</p>
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-slate-800">{order.customer_document || "-"}</p>
              <p className="text-slate-500">Documento</p>
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-800">{quantity}</p>
              <p className="text-slate-500">Entradas</p>
            </div>
          </div>

          <div className="flex min-w-0 w-full flex-col gap-2 lg:w-auto lg:items-end">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div
                data-orders-entry-indicator="true"
                data-orders-entry-state={resolvedState}
                className={`h-7 w-7 rounded-full ${stateStyle.iconBg}`}
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Día del evento</p>
                <p className="text-sm font-semibold text-slate-900">{formatEventDate(order.intended_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {formatTokenLabel(order.checkin_token)}
              </code>
              {order.checkin_token ? (
                <button
                  onClick={() => handleCopyToken(order.checkin_token!, order.id)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {copiedId === order.id ? "Copiado" : "Copiar"}
                </button>
              ) : null}
            </div>
            {resolvedState === "used" ? (
              <p className="text-xs text-slate-500">Usada: {formatDateTime(order.used_at)}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  if (contextLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-slate-600">Cargando...</p>
      </div>
    );
  }

  if (contextError || !context) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-red-600">{contextError || "Error al cargar información del panel"}</p>
      </div>
    );
  }

  const showingFiltered = Boolean(appliedSearchValue);
  const selectedDateLabel = formatSelectedDate(intendedDate);
  const contextualHeader =
    temporalContext === "today"
      ? {
          title: `Operación de hoy - ${selectedDateLabel}`,
          subtitle: "Seguimiento de ventas, usos y pendientes del día.",
        }
      : temporalContext === "past"
        ? {
            title: `Resultado operativo - ${selectedDateLabel}`,
            subtitle: "Resumen final de ventas y uso de esta fecha.",
          }
        : {
            title: `Preventa - ${selectedDateLabel}`,
            subtitle: "Seguimiento de ventas previas y actividad reciente.",
          };
  const listSummary = isClub
    ? showingFiltered
      ? `Mostrando ${entriesCount} resultado${entriesCount === 1 ? "" : "s"} para ${selectedDateLabel}`
      : intendedDate
        ? temporalContext === "future"
          ? `Mostrando las ultimas 20 operaciones de preventa para ${selectedDateLabel}`
          : temporalContext === "today"
            ? `Mostrando las ultimas 20 operaciones de ${selectedDateLabel}`
            : `Mostrando las ultimas 20 operaciones registradas para ${selectedDateLabel}`
        : "Selecciona una fecha para ver el estado operativo de las entradas."
    : showingFiltered
      ? `Mostrando ${entriesCount} resultado${entriesCount === 1 ? "" : "s"} de búsqueda`
      : "Mostrando las últimas 20 entradas";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas"
        actions={
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={isExportMenuOpen}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm",
                panelUi.focusRing
              )}
              onClick={() => setIsExportMenuOpen((current) => !current)}
            >
              Exportar
              <span className="text-xs text-neutral-500">▾</span>
            </button>

            {isExportMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs font-medium text-neutral-600"
                      htmlFor="orders-export-from-menu"
                    >
                      Desde
                    </label>
                    <input
                      id="orders-export-from-menu"
                      type="date"
                      value={exportFrom}
                      onChange={(event) => {
                        setExportError(null);
                        setExportFrom(event.target.value);
                      }}
                      className={cn(
                        "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900",
                        panelUi.focusRing
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs font-medium text-neutral-600"
                      htmlFor="orders-export-to-menu"
                    >
                      Hasta
                    </label>
                    <input
                      id="orders-export-to-menu"
                      type="date"
                      value={exportTo}
                      onChange={(event) => {
                        setExportError(null);
                        setExportTo(event.target.value);
                      }}
                      className={cn(
                        "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900",
                        panelUi.focusRing
                      )}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      void handleExportCsv();
                    }}
                    disabled={!exportFrom || !exportTo || exportLoading}
                    className={cn(
                      "inline-flex h-[38px] w-full items-center justify-center rounded-full bg-[#8d1313] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
                      panelUi.focusRing
                    )}
                  >
                    {exportLoading ? "Exportando..." : "Exportar CSV"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      {exportError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700">{exportError}</p>
        </div>
      ) : null}

      {isClub ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{contextualHeader.title}</h2>
            <p className="text-sm text-slate-600">
              {contextualHeader.subtitle}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => {
            const isActive = effectiveStateFilter === card.key;
            const content = (
              <>
                <p className={cn("text-3xl font-bold", getSummaryValueClass(card))}>
                  {summaryLoading ? "..." : card.value}
                </p>
                <p className={cn("text-sm", getSummaryLabelClass(card))}>{card.label}</p>
              </>
            );

            if (card.interactive === false) {
              return (
                <div
                  key={card.key}
                  data-orders-summary-card="true"
                  data-orders-tone={card.tone}
                  data-orders-active="false"
                  className={cn(
                    "rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-colors",
                    getSummaryCardShellClasses(card, false)
                  )}
                  style={getSummaryCardStyle(card, false)}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setStateFilter(card.key as EntryStateFilter)}
                data-orders-summary-card="true"
                data-orders-tone={card.tone}
                data-orders-active={isActive ? "true" : "false"}
                className={cn(
                  "rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-colors",
                  getSummaryCardShellClasses(card, isActive)
                )}
                style={getSummaryCardStyle(card, isActive)}
              >
                {content}
              </button>
            );
          })}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">
            {isClub
              ? temporalContext === "future"
                ? "Buscar preventa para esta fecha"
                : "Buscar entradas para esta fecha"
              : "Buscar Entradas"}
          </h2>
          {isClub ? (
            <p className="text-sm text-slate-600">
              {temporalContext === "future"
                ? "La fecha elegida define el estado de preventa y el listado operativo."
                : "La fecha elegida define el resumen superior y el listado operativo."}
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[220px_1fr_200px_120px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar por</label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as SearchType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="email">Email</option>
              <option value="document">Documento</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {searchType === "email" ? "Email" : "Documento"}
            </label>
            <input
              type={searchType === "email" ? "email" : "text"}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "email" ? "correo@ejemplo.com" : "12345678"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {isClub ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
              <input
                type="date"
                value={intendedDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setIntendedDate(nextDate);
                  if (nextDate) {
                    setExportFrom(nextDate);
                    setExportTo(nextDate);
                  }
                  updateIntendedDateInUrl(nextDate);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={entriesLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {entriesLoading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>

        {summaryError ? (
          <p className="mt-3 text-sm text-amber-700">{summaryError}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm text-slate-500">{listSummary}</p>

        {entriesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{entriesError}</p>
          </div>
        ) : null}

        {entriesLoading && entries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Cargando entradas...</p>
          </div>
        ) : null}

        {!entriesLoading && entries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">No se encontraron entradas.</p>
          </div>
        ) : null}

        {entries.map(renderEntryCard)}
      </section>
    </div>
  );
}
