"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, cn, panelSuccessTone, panelUi } from "@/components/panel/ui";
import { OperationalActivityHistory } from "@/components/panel/OperationalActivityHistory";
import { usePanelContext } from "@/lib/panelContext";
import { ApiError, getApiBase, getAuthHeaders } from "@/lib/api";
import {
  getAccessEntries,
  useAccessEntry,
  type AccessEntryCheckinStatusFilter,
  type AccessEntryListItem,
  type AccessEntryStatusFilter,
} from "@/lib/accessEntries";
import { downloadPanelReservationsClientsExcel } from "@/lib/panelExport";
import {
  getPanelDemoDiscotecaOrdersSummary,
  searchPanelDemoDiscotecaOrders,
} from "@/lib/panel-demo/orders";
import { getPanelDemoOrderActivityItems } from "@/lib/panel-demo/operationalActivity";
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
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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

interface ManualCheckinResponse {
  id: string;
  status: string;
  used_at: string | null;
  customer_name: string | null;
  customer_last_name: string | null;
  customer_document: string | null;
}

type SearchType = "email" | "document";
type OrdersTab = "free_pass" | "paid";
type EntryStateFilter = "all" | "used" | "pending" | "unused";
type EntryResolvedState = "used" | "pending" | "unused" | "other";
type PaidEntryStatusFilter = "all" | AccessEntryStatusFilter;
type PaidCheckinStatusFilter = "all" | AccessEntryCheckinStatusFilter;
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
const ORDERS_PAGE_SIZE = 20;
const PAID_ENTRIES_PAGE_SIZE = 25;
const ORDERS_AUTO_REFRESH_MS = 5000;

type RefreshMode = "foreground" | "background";

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
  const canExport = context?.role === "owner";
  const [activeTab, setActiveTab] = useState<OrdersTab>("free_pass");
  const [searchType, setSearchType] = useState<SearchType>("email");
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearchValue, setAppliedSearchValue] = useState("");
  const [intendedDate, setIntendedDate] = useState("");
  const [stateFilter, setStateFilter] = useState<EntryStateFilter>("all");
  const [entriesOffset, setEntriesOffset] = useState(0);

  const [entries, setEntries] = useState<OrderItem[]>([]);
  const [entriesHasMore, setEntriesHasMore] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [paidDate, setPaidDate] = useState("");
  const [paidEntryStatus, setPaidEntryStatus] = useState<PaidEntryStatusFilter>("all");
  const [paidCheckinStatus, setPaidCheckinStatus] =
    useState<PaidCheckinStatusFilter>("all");
  const [paidSearchValue, setPaidSearchValue] = useState("");
  const [paidAppliedSearchValue, setPaidAppliedSearchValue] = useState("");
  const [paidEntriesOffset, setPaidEntriesOffset] = useState(0);
  const [paidEntries, setPaidEntries] = useState<AccessEntryListItem[]>([]);
  const [paidEntriesHasMore, setPaidEntriesHasMore] = useState(false);
  const [paidEntriesLoading, setPaidEntriesLoading] = useState(false);
  const [paidEntriesError, setPaidEntriesError] = useState<string | null>(null);
  const [paidEntriesNotice, setPaidEntriesNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [paidManualConfirmId, setPaidManualConfirmId] = useState<string | null>(null);
  const [paidManualLoadingId, setPaidManualLoadingId] = useState<string | null>(null);

  const [summary, setSummary] = useState<OrdersSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualCheckinConfirmId, setManualCheckinConfirmId] = useState<string | null>(null);
  const [manualCheckinLoadingId, setManualCheckinLoadingId] = useState<string | null>(null);
  const [manualCheckinNotice, setManualCheckinNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [panelTheme, setPanelTheme] = useState<PanelTheme>("dark");
  const summaryRequestIdRef = useRef(0);
  const entriesRequestIdRef = useRef(0);
  const paidEntriesRequestIdRef = useRef(0);
  const summaryInFlightRef = useRef(false);
  const entriesInFlightRef = useRef(false);
  const paidEntriesInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
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

  const loadSummary = useCallback(async (
    dateValue?: string,
    mode: RefreshMode = "foreground"
  ): Promise<OrdersSummaryResponse | null> => {
    if (activeTab !== "free_pass") {
      return null;
    }

    if (!isClub) {
      setSummary(null);
      setSummaryError(null);
      return null;
    }

    if (summaryInFlightRef.current) {
      return null;
    }

    const isBackground = mode === "background";
    const requestId = ++summaryRequestIdRef.current;
    summaryInFlightRef.current = true;
    if (!isBackground) {
      setSummaryLoading(true);
      setSummaryError(null);
    }

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
      if (isBackground) {
        throw error;
      }
      setSummaryError(error instanceof Error ? error.message : "Error al cargar resumen");
      return null;
    } finally {
      summaryInFlightRef.current = false;
      if (requestId === summaryRequestIdRef.current) {
        if (!isBackground) {
          setSummaryLoading(false);
        }
      }
    }
  }, [activeTab, isClub, isDemoDiscoteca]);

  const loadEntries = useCallback(async (
    mode: RefreshMode = "foreground"
  ) => {
    if (activeTab !== "free_pass") {
      return;
    }

    if (contextLoading || !context) {
      return;
    }

    if (isClub && !intendedDate) {
      return;
    }

    if (entriesInFlightRef.current) {
      return;
    }

    const isBackground = mode === "background";
    const requestId = ++entriesRequestIdRef.current;
    entriesInFlightRef.current = true;
    if (!isBackground) {
      setEntriesLoading(true);
      setEntriesError(null);
    }

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
            limit: ORDERS_PAGE_SIZE,
            offset: entriesOffset,
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
            params.set("limit", String(ORDERS_PAGE_SIZE));
            params.set("offset", String(entriesOffset));

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
      setEntriesHasMore(Boolean(data.hasMore));
      setLastRefreshAt(new Date());
      setRefreshError(null);
    } catch (error) {
      if (requestId !== entriesRequestIdRef.current) {
        return;
      }
      if (isBackground) {
        throw error;
      }
      setEntriesError(error instanceof Error ? error.message : "Error al cargar entradas");
      setEntriesHasMore(false);
    } finally {
      entriesInFlightRef.current = false;
      if (requestId === entriesRequestIdRef.current) {
        if (!isBackground) {
          setEntriesLoading(false);
        }
      }
    }
  }, [
    appliedSearchValue,
    activeTab,
    context,
    contextLoading,
    intendedDate,
    isClub,
    isDemoDiscoteca,
    entriesOffset,
    searchType,
    stateFilter,
  ]);

  const loadPaidEntries = useCallback(async () => {
    if (activeTab !== "paid" || contextLoading || !context) {
      return;
    }

    if (paidEntriesInFlightRef.current) {
      return;
    }

    const requestId = ++paidEntriesRequestIdRef.current;
    paidEntriesInFlightRef.current = true;
    setPaidEntriesLoading(true);
    setPaidEntriesError(null);

    try {
      const data = await getAccessEntries({
        date: paidDate || undefined,
        entryStatus: paidEntryStatus === "all" ? undefined : paidEntryStatus,
        checkinStatus: paidCheckinStatus === "all" ? undefined : paidCheckinStatus,
        q: paidAppliedSearchValue || undefined,
        limit: PAID_ENTRIES_PAGE_SIZE,
        offset: paidEntriesOffset,
      });

      if (requestId !== paidEntriesRequestIdRef.current) {
        return;
      }

      setPaidEntries(data.entries ?? []);
      setPaidEntriesHasMore(Boolean(data.pagination?.hasMore));
    } catch {
      if (requestId !== paidEntriesRequestIdRef.current) {
        return;
      }

      setPaidEntries([]);
      setPaidEntriesHasMore(false);
      setPaidEntriesError("No pudimos cargar las entradas pagadas.");
    } finally {
      paidEntriesInFlightRef.current = false;
      if (requestId === paidEntriesRequestIdRef.current) {
        setPaidEntriesLoading(false);
      }
    }
  }, [
    activeTab,
    context,
    contextLoading,
    paidAppliedSearchValue,
    paidCheckinStatus,
    paidDate,
    paidEntriesOffset,
    paidEntryStatus,
  ]);

  const refreshOrdersData = useCallback(async (
    mode: RefreshMode = "background"
  ) => {
    if (activeTab !== "free_pass") {
      return;
    }

    if (refreshInFlightRef.current || contextLoading || !context) {
      return;
    }

    if (isClub && !intendedDate) {
      return;
    }

    refreshInFlightRef.current = true;
    if (mode === "foreground") {
      setRefreshLoading(true);
    }

    try {
      const results = await Promise.allSettled([
        isClub
          ? loadSummary(intendedDate || undefined, mode)
          : Promise.resolve(null),
        loadEntries(mode),
      ]);

      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (failed) {
        throw failed.reason;
      }

      setRefreshError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar entradas.";
      setRefreshError(
        mode === "background"
          ? `No se pudo actualizar en segundo plano: ${message}`
          : message
      );
    } finally {
      refreshInFlightRef.current = false;
      if (mode === "foreground") {
        setRefreshLoading(false);
      }
    }
  }, [
    activeTab,
    context,
    contextLoading,
    intendedDate,
    isClub,
    loadEntries,
    loadSummary,
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

  useEffect(() => {
    void loadPaidEntries();
  }, [loadPaidEntries]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (contextLoading || !context || isDemo) {
      return;
    }

    if (isClub && !intendedDate) {
      return;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshOrdersData("background");
    };

    const intervalId = window.setInterval(
      refreshIfVisible,
      ORDERS_AUTO_REFRESH_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshOrdersData("background");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    context,
    contextLoading,
    intendedDate,
    isClub,
    isDemo,
    refreshOrdersData,
  ]);

  const handleSearch = () => {
    setEntriesOffset(0);
    setAppliedSearchValue(searchValue.trim());
  };

  const handleStateFilterChange = (nextFilter: EntryStateFilter) => {
    setEntriesOffset(0);
    setStateFilter(nextFilter);
  };

  const handlePaidSearch = () => {
    setPaidEntriesOffset(0);
    setPaidAppliedSearchValue(paidSearchValue.trim());
    setPaidEntriesNotice(null);
  };

  const handlePaidEntryStatusChange = (nextStatus: PaidEntryStatusFilter) => {
    setPaidEntriesOffset(0);
    setPaidEntryStatus(nextStatus);
    setPaidEntriesNotice(null);
  };

  const handlePaidCheckinStatusChange = (nextStatus: PaidCheckinStatusFilter) => {
    setPaidEntriesOffset(0);
    setPaidCheckinStatus(nextStatus);
    setPaidEntriesNotice(null);
  };

  const getPaidUseErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      const details = error.details;
      const code =
        details && typeof details === "object" && "code" in details
          ? (details as { code?: unknown }).code
          : null;

      if (code === "already_used") {
        return "La entrada ya fue usada.";
      }

      if (code === "voided") {
        return "La entrada está anulada.";
      }

      if (code === "not_paid") {
        return "El pago de esta entrada no está confirmado.";
      }

      if (error.status === 404) {
        return "No encontramos esta entrada para tu local.";
      }
    }

    return "No pudimos validar la entrada pagada.";
  };

  const handlePaidManualUse = async (entry: AccessEntryListItem) => {
    if (paidManualLoadingId) {
      return;
    }

    if (!canUsePaidEntry(entry)) {
      return;
    }

    setPaidManualLoadingId(entry.entry_id);
    setPaidEntriesNotice(null);

    try {
      const result = await useAccessEntry(entry.entry_id);
      setPaidEntries((current) =>
        current.map((currentEntry) =>
          currentEntry.entry_id === entry.entry_id ? result.entry : currentEntry
        )
      );
      setPaidManualConfirmId(null);
      setPaidEntriesNotice({
        type: "success",
        message: "Entrada validada correctamente.",
      });
    } catch (error) {
      setPaidEntriesNotice({
        type: "error",
        message: getPaidUseErrorMessage(error),
      });
      void loadPaidEntries();
    } finally {
      setPaidManualLoadingId(null);
    }
  };

  const handleExportExcel = async () => {
    if (!canExport || !exportFrom || !exportTo || exportLoading) {
      return;
    }

    if (isDemoDiscoteca) {
      setExportError("La exportacion Excel no esta disponible en modo demo.");
      return;
    }

    setExportError(null);
    setExportLoading(true);
    try {
      await downloadPanelReservationsClientsExcel({ from: exportFrom, to: exportTo });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Error al exportar Excel");
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

  const handleManualCheckin = async (order: OrderItem) => {
    if ((isDemo && !isDemoDiscoteca) || manualCheckinLoadingId) {
      return;
    }

    if (resolveState(order) !== "pending") {
      return;
    }

    setManualCheckinLoadingId(order.id);
    setManualCheckinNotice(null);

    try {
      if (isDemoDiscoteca) {
        const usedAt = getPanelDemoNow("discoteca").toISOString();
        const quantity = typeof order.quantity === "number" ? order.quantity : 0;

        setEntries((current) =>
          current.map((entry) =>
            entry.id === order.id
              ? {
                  ...entry,
                  used_at: usedAt,
                  checkin_state: "used",
                }
              : entry
          )
        );
        setSummary((current) =>
          current
            ? {
                ...current,
                used_qty: current.used_qty + quantity,
                pending_qty: Math.max(0, current.pending_qty - quantity),
                used_count: current.used_count + 1,
                pending_count: Math.max(0, current.pending_count - 1),
              }
            : current
        );
        setManualCheckinConfirmId(null);
        setManualCheckinNotice({
          type: "success",
          message: "Entrada validada.",
        });
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(
        `${getApiBase()}/panel/orders/${encodeURIComponent(order.id)}/use`,
        {
          method: "PATCH",
          credentials: "include",
          headers,
        }
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: unknown;
          usedAt?: unknown;
        };
        const rawMessage =
          typeof errorData.error === "string" ? errorData.error : "";
        const message =
          response.status === 409 && errorData.usedAt
            ? "La entrada ya fue usada."
            : response.status === 409
              ? "La entrada no está dentro de la ventana válida."
              : response.status === 403
                ? "No tenés permiso para validar esta entrada."
                : rawMessage || `Error ${response.status}`;

        throw new Error(message);
      }

      const updated = (await response.json()) as ManualCheckinResponse;

      setEntries((current) =>
        current.map((entry) =>
          entry.id === updated.id
            ? {
                ...entry,
                status: updated.status,
                used_at: updated.used_at,
                customer_name: updated.customer_name ?? entry.customer_name,
                customer_last_name:
                  updated.customer_last_name ?? entry.customer_last_name,
                customer_document:
                  updated.customer_document ?? entry.customer_document,
                checkin_state: "used",
              }
            : entry
        )
      );
      setManualCheckinConfirmId(null);
      setManualCheckinNotice({
        type: "success",
        message: "Entrada validada.",
      });
      void loadSummary(intendedDate || undefined);
      void loadEntries();
    } catch (error) {
      setManualCheckinNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo validar la entrada.",
      });
    } finally {
      setManualCheckinLoadingId(null);
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
              badge: "border",
              border: "border-l-transparent",
              iconBg: panelSuccessTone.solidBgClass,
              borderColor: panelSuccessTone.accentHex,
              badgeStyle: {
                color: panelSuccessTone.darkSoftTextHex,
                borderColor: panelSuccessTone.darkSoftBorderColor,
                backgroundColor: panelSuccessTone.darkSoftBgColor,
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
                "border text-[#E5E5E5]",
              border: "border-l-transparent",
              iconBg: "bg-[#A3A3A3]",
              borderColor: "#A3A3A3",
              badgeStyle: {
                borderColor: "rgba(163,163,163,0.34)",
                backgroundColor: "rgba(163,163,163,0.16)",
              },
            },
            other: {
              label: "Sin estado",
              badge:
                "border text-[#D4D4D4]",
              border: "border-l-transparent",
              iconBg: "bg-[rgba(115,115,115,0.28)]",
              borderColor: "#737373",
              badgeStyle: {
                borderColor: "rgba(115,115,115,0.28)",
                backgroundColor: "rgba(115,115,115,0.14)",
              },
            },
          }
        : {
            used: {
              label: "Usada",
              badge: `bg-emerald-50 border border-emerald-200 ${panelSuccessTone.textClass}`,
              border: "border-l-emerald-400",
              iconBg: panelSuccessTone.solidBgClass,
              borderColor: panelSuccessTone.accentHex,
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
      setEntriesOffset(0);
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

  const lastRefreshLabel = useMemo(() => {
    void refreshTick;

    if (!lastRefreshAt) {
      return "Actualizado: pendiente";
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - lastRefreshAt.getTime()) / 1000)
    );

    if (seconds < 5) {
      return "Actualizado recién";
    }

    if (seconds < 60) {
      return `Actualizado hace ${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    return `Actualizado hace ${minutes} min`;
  }, [lastRefreshAt, refreshTick]);

  const canRefreshOrders =
    Boolean(context) && !contextLoading && (!isClub || Boolean(intendedDate));

  const getSummaryCardShellClasses = (
    card: OrdersSummaryCard,
    active: boolean
  ) => {
    if (panelTheme !== "dark") {
      return active
        ? `${card.accent} ring-1 ring-slate-300`
        : "border-slate-200 hover:border-slate-300";
    }

    return "border-[#303030] hover:border-[#454545]";
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
        borderColor: "#303030",
        backgroundColor: "#141414",
      };
    }

    const toneBorderColors: Record<OrdersSummaryCard["tone"], string> = {
      info: "#60A5FA",
      positive: panelSuccessTone.accentHex,
      warning: "#FACC15",
      muted: "#A3A3A3",
    };

    return {
      backgroundColor: "#141414",
      borderColor: toneBorderColors[card.tone],
    };
  };

  const getSummaryValueClass = (card: OrdersSummaryCard) => {
    if (panelTheme !== "dark") {
      return "text-slate-900";
    }

    return "text-[#F5F5F5]";
  };

  const getSummaryLabelClass = (card: OrdersSummaryCard) => {
    if (panelTheme !== "dark") {
      return "text-slate-600";
    }

    return "text-[#D4D4D4]";
  };

  const getEntryCardStyle = (stateStyle: (typeof stateStyles)[EntryResolvedState]) => {
    if (panelTheme !== "dark") {
      return undefined;
    }

    return {
      backgroundColor: "#141414",
      borderColor: "#303030",
      borderLeftColor: stateStyle.borderColor,
    } satisfies CSSProperties;
  };

  const renderEntryCard = (order: OrderItem) => {
    const resolvedState = resolveState(order);
    const stateStyle = stateStyles[resolvedState];
    const fullName = `${order.customer_name ?? ""} ${order.customer_last_name ?? ""}`.trim() || "-";
    const quantity = typeof order.quantity === "number" ? order.quantity : 0;
    const canManualCheckin =
      resolvedState === "pending" &&
      (!isDemo || (isDemoDiscoteca && temporalContext === "today"));
    const isManualCheckinConfirming = manualCheckinConfirmId === order.id;
    const isManualCheckinLoading = manualCheckinLoadingId === order.id;

    return (
      <div
        key={order.id}
        data-orders-entry-card="true"
        data-orders-entry-state={resolvedState}
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${stateStyle.border}`}
        style={getEntryCardStyle(stateStyle)}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_248px] lg:items-center lg:gap-x-8">
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

          <div className="flex min-w-0 w-full flex-col items-stretch gap-2.5 lg:w-[248px]">
            <div
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5",
                panelTheme === "dark"
                  ? "border-[#303030] bg-[#1F1F1F]"
                  : "border-slate-200 bg-slate-50"
              )}
            >
              <div
                data-orders-entry-indicator="true"
                data-orders-entry-state={resolvedState}
                className={`h-7 w-7 rounded-full ${stateStyle.iconBg}`}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    panelTheme === "dark" ? "text-[#A3A3A3]" : "text-slate-500"
                  )}
                >
                  Día del evento
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    panelTheme === "dark" ? "text-[#F5F5F5]" : "text-slate-900"
                  )}
                >
                  {formatEventDate(order.intended_date)}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2",
                panelTheme === "dark"
                  ? "border-[#303030] bg-[#171717]"
                  : "border-slate-200 bg-white"
              )}
            >
              <code
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-2 py-1 text-xs font-medium",
                  panelTheme === "dark"
                    ? "bg-[#262626] text-[#E5E5E5]"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {formatTokenLabel(order.checkin_token)}
              </code>
              {order.checkin_token ? (
                <button
                  onClick={() => handleCopyToken(order.checkin_token!, order.id)}
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
                    panelTheme === "dark"
                      ? "border-[#3A3A3A] text-[#D4D4D4] hover:bg-[#262626]"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {copiedId === order.id ? "Copiado" : "Copiar"}
                </button>
              ) : null}
            </div>
            {resolvedState === "used" ? (
              <p
                className={cn(
                  "w-full text-xs",
                  panelTheme === "dark" ? "text-[#A3A3A3]" : "text-slate-500"
                )}
              >
                Usada: {formatDateTime(order.used_at)}
              </p>
            ) : null}
            {canManualCheckin ? (
              <div
                className={cn(
                  "w-full rounded-lg border p-2.5",
                  panelTheme === "dark"
                    ? "border-[#3A3320] bg-[#1C1710]"
                    : "border-amber-200 bg-amber-50"
                )}
              >
                {isManualCheckinConfirming ? (
                  <div className="space-y-2">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        panelTheme === "dark" ? "text-[#FDE68A]" : "text-amber-900"
                      )}
                    >
                      Esta acción marcará la entrada como usada.
                    </p>
                    {!isDemoDiscoteca ? (
                      <p
                        className={cn(
                          "text-[11px]",
                          panelTheme === "dark" ? "text-[#D6B85D]" : "text-amber-800"
                        )}
                      >
                        Método: validación manual.
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setManualCheckinConfirmId(null)}
                        disabled={isManualCheckinLoading}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60",
                          panelTheme === "dark"
                            ? "border-[#4A3A18] bg-[#141414] text-[#FDE68A] hover:bg-[#211B11]"
                            : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                        )}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleManualCheckin(order)}
                        disabled={isManualCheckinLoading}
                        className={cn(
                          "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                          panelTheme === "dark"
                            ? "bg-[#FACC15] text-[#171717] hover:bg-[#EAB308]"
                            : "bg-amber-600 text-white hover:bg-amber-700"
                        )}
                      >
                        {isManualCheckinLoading ? "Validando..." : "Confirmar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setManualCheckinNotice(null);
                      setManualCheckinConfirmId(order.id);
                    }}
                    disabled={manualCheckinLoadingId !== null}
                    aria-label="Validar manualmente esta entrada"
                    title="Validar manualmente esta entrada"
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                      panelTheme === "dark"
                        ? "bg-[#FACC15] text-[#171717] hover:bg-[#EAB308]"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    )}
                  >
                    Validar
                  </button>
                )}
              </div>
            ) : null}
            {!isDemo || isDemoDiscoteca ? (
              <OperationalActivityHistory
                entityType="order"
                entityId={order.id}
                tone={panelTheme}
                demoItems={
                  isDemoDiscoteca
                    ? getPanelDemoOrderActivityItems(order)
                    : undefined
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const canUsePaidEntry = (entry: AccessEntryListItem): boolean => {
    return (
      entry.order_status === "paid" &&
      entry.entry_status === "issued" &&
      entry.checkin_status === "unused"
    );
  };

  const getPaidOrderStatusLabel = (status: string): string => {
    return status === "paid" ? "Pago confirmado" : status;
  };

  const getPaidEntryStatusLabel = (status: string): string => {
    if (status === "issued") return "Emitida";
    if (status === "voided") return "Anulada";
    return status;
  };

  const getPaidCheckinStatusLabel = (status: string): string => {
    if (status === "unused") return "Sin usar";
    if (status === "used") return "Usada";
    return status;
  };

  const getPaidEmailStatusLabel = (status: string): string => {
    if (status === "sent") return "Enviado";
    if (status === "failed") return "Falló";
    if (status === "not_sent") return "No enviado";
    return status;
  };

  const getPaidBadgeClasses = (tone: "success" | "warning" | "danger" | "neutral") => {
    if (panelTheme === "dark") {
      switch (tone) {
        case "success":
          return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
        case "warning":
          return "border-amber-500/30 bg-amber-500/15 text-amber-200";
        case "danger":
          return "border-rose-500/30 bg-rose-500/15 text-rose-200";
        default:
          return "border-[#3A3A3A] bg-[#262626] text-[#D4D4D4]";
      }
    }

    switch (tone) {
      case "success":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "danger":
        return "border-rose-200 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  };

  const getPaidCheckinTone = (status: string): "success" | "warning" | "neutral" => {
    return status === "used" ? "success" : status === "unused" ? "warning" : "neutral";
  };

  const renderPaidBadge = (
    label: string,
    tone: "success" | "warning" | "danger" | "neutral"
  ) => (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        getPaidBadgeClasses(tone)
      )}
    >
      {label}
    </span>
  );

  const renderPaidField = (
    label: string,
    value: string | number | null,
    extraClassName?: string
  ) => (
    <div className={cn("min-w-0 text-sm", extraClassName)}>
      <p
        className={cn(
          "truncate font-medium",
          panelTheme === "dark" ? "text-[#F5F5F5]" : "text-slate-900"
        )}
      >
        {value ?? "-"}
      </p>
      <p className={panelTheme === "dark" ? "text-[#A3A3A3]" : "text-slate-500"}>
        {label}
      </p>
    </div>
  );

  const renderPaidEntryCard = (entry: AccessEntryListItem) => {
    const isConfirming = paidManualConfirmId === entry.entry_id;
    const isLoading = paidManualLoadingId === entry.entry_id;
    const canValidate = canUsePaidEntry(entry);

    return (
      <div
        key={entry.entry_id}
        className={cn(
          "rounded-xl border p-4 shadow-sm",
          panelTheme === "dark"
            ? "border-[#303030] bg-[#141414]"
            : "border-slate-200 bg-white"
        )}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_76px_minmax(0,0.9fr)]">
            {renderPaidField("Referencia", entry.public_ref)}
            {renderPaidField("Entrada", entry.ticket_name)}
            {renderPaidField("Asistente", entry.attendee_name || "-")}
            {renderPaidField("Unidad", entry.unit_index)}
            {renderPaidField("Fecha", formatEventDate(entry.access_date))}
            {renderPaidField("Monto", formatCurrency(entry.amount_gs))}
            <div className="min-w-0 text-sm">
              {renderPaidBadge(
                getPaidOrderStatusLabel(entry.order_status),
                entry.order_status === "paid" ? "success" : "neutral"
              )}
              <p className={panelTheme === "dark" ? "mt-1 text-[#A3A3A3]" : "mt-1 text-slate-500"}>
                Pago
              </p>
            </div>
            <div className="min-w-0 text-sm">
              {renderPaidBadge(
                getPaidEntryStatusLabel(entry.entry_status),
                entry.entry_status === "issued" ? "success" : "danger"
              )}
              <p className={panelTheme === "dark" ? "mt-1 text-[#A3A3A3]" : "mt-1 text-slate-500"}>
                Entrada
              </p>
            </div>
            <div className="min-w-0 text-sm">
              {renderPaidBadge(
                getPaidCheckinStatusLabel(entry.checkin_status),
                getPaidCheckinTone(entry.checkin_status)
              )}
              <p className={panelTheme === "dark" ? "mt-1 text-[#A3A3A3]" : "mt-1 text-slate-500"}>
                Check-in
              </p>
            </div>
            <div className="min-w-0 text-sm">
              {renderPaidBadge(
                getPaidEmailStatusLabel(entry.email_status),
                entry.email_status === "sent"
                  ? "success"
                  : entry.email_status === "failed"
                    ? "danger"
                    : "neutral"
              )}
              <p className={panelTheme === "dark" ? "mt-1 text-[#A3A3A3]" : "mt-1 text-slate-500"}>
                Email
              </p>
            </div>
            {renderPaidField("Usada en", formatDateTime(entry.used_at), "lg:col-span-2")}
          </div>

          <div className="space-y-2">
            {isConfirming ? (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  panelTheme === "dark"
                    ? "border-[#3A3320] bg-[#1C1710]"
                    : "border-amber-200 bg-amber-50"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold",
                    panelTheme === "dark" ? "text-[#FDE68A]" : "text-amber-900"
                  )}
                >
                  ¿Validar esta entrada?
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    panelTheme === "dark" ? "text-[#D6B85D]" : "text-amber-800"
                  )}
                >
                  Esta acción marcará la entrada como usada. Revisá los datos antes de continuar.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidManualConfirmId(null)}
                    disabled={isLoading}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60",
                      panelTheme === "dark"
                        ? "border-[#4A3A18] bg-[#141414] text-[#FDE68A] hover:bg-[#211B11]"
                        : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePaidManualUse(entry)}
                    disabled={isLoading}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                      panelTheme === "dark"
                        ? "bg-[#FACC15] text-[#171717] hover:bg-[#EAB308]"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    )}
                  >
                    {isLoading ? "Validando..." : "Validar entrada"}
                  </button>
                </div>
              </div>
            ) : canValidate ? (
              <button
                type="button"
                onClick={() => {
                  setPaidEntriesNotice(null);
                  setPaidManualConfirmId(entry.entry_id);
                }}
                disabled={paidManualLoadingId !== null}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  panelTheme === "dark"
                    ? "bg-[#FACC15] text-[#171717] hover:bg-[#EAB308]"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                )}
              >
                Validar manualmente
              </button>
            ) : (
              <p
                className={cn(
                  "rounded-lg border px-3 py-2 text-center text-sm font-semibold",
                  panelTheme === "dark"
                    ? "border-[#303030] bg-[#1F1F1F] text-[#D4D4D4]"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                )}
              >
                {entry.entry_status === "voided"
                  ? "Anulada"
                  : entry.checkin_status === "used"
                    ? "Ya usada"
                    : "Sin acción"}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPaidEntriesSection = () => (
    <>
      <section
        className={cn(
          "rounded-xl border px-4 py-3 shadow-sm",
          panelTheme === "dark"
            ? "border-[#303030] bg-[#171717]"
            : "border-sky-100 bg-sky-50"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn(
              "text-sm",
              panelTheme === "dark" ? "text-[#D4D4D4]" : "text-slate-700"
            )}
          >
            Entradas pagadas online emitidas por Access Core. También podés validarlas desde
            Check-in escaneando el QR.
          </p>
          <Link
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
              panelUi.focusRing,
              panelTheme === "dark"
                ? "bg-[#F5F5F5] text-[#171717] hover:bg-[#E5E5E5]"
                : "bg-slate-950 text-white hover:bg-slate-800"
            )}
            href="/panel/checkin"
          >
            Validar desde Check-in
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Buscar entradas pagadas</h2>
          <p className="text-sm text-slate-600">
            Filtrá por fecha, estado o referencia sin exponer tokens ni datos sensibles.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_1fr_120px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
            <input
              type="date"
              value={paidDate}
              onChange={(event) => {
                setPaidEntriesOffset(0);
                setPaidDate(event.target.value);
                setPaidEntriesNotice(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Entrada</label>
            <select
              value={paidEntryStatus}
              onChange={(event) =>
                handlePaidEntryStatusChange(event.target.value as PaidEntryStatusFilter)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">Todas</option>
              <option value="issued">Emitidas</option>
              <option value="voided">Anuladas</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Check-in</label>
            <select
              value={paidCheckinStatus}
              onChange={(event) =>
                handlePaidCheckinStatusChange(event.target.value as PaidCheckinStatusFilter)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">Todos</option>
              <option value="unused">Sin usar</option>
              <option value="used">Usadas</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Búsqueda</label>
            <input
              type="text"
              value={paidSearchValue}
              onChange={(event) => setPaidSearchValue(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handlePaidSearch()}
              placeholder="Referencia, asistente o entrada"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handlePaidSearch}
              disabled={paidEntriesLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paidEntriesLoading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {paidEntriesNotice ? (
          <div
            className={cn(
              "rounded-lg border p-3",
              paidEntriesNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            )}
          >
            <p
              className={cn(
                "text-sm",
                paidEntriesNotice.type === "success"
                  ? "text-emerald-700"
                  : "text-red-700"
              )}
            >
              {paidEntriesNotice.message}
            </p>
          </div>
        ) : null}

        {paidEntriesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{paidEntriesError}</p>
          </div>
        ) : null}

        {paidEntriesLoading && paidEntries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Cargando entradas pagadas...</p>
          </div>
        ) : null}

        {!paidEntriesLoading && paidEntries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Todavía no hay entradas pagadas para mostrar.
            </p>
          </div>
        ) : null}

        {paidEntries.map(renderPaidEntryCard)}

        {(paidEntriesOffset > 0 || paidEntriesHasMore) &&
          (paidEntries.length > 0 || paidEntriesOffset > 0) ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              {paidEntriesOffset > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setPaidEntriesOffset((current) =>
                      Math.max(current - PAID_ENTRIES_PAGE_SIZE, 0)
                    )
                  }
                  disabled={paidEntriesLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver anteriores
                </button>
              ) : null}
              {paidEntriesHasMore ? (
                <button
                  type="button"
                  onClick={() =>
                    setPaidEntriesOffset((current) => current + PAID_ENTRIES_PAGE_SIZE)
                  }
                  disabled={paidEntriesLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver siguientes
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );

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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas"
        actions={activeTab === "free_pass" && canExport ? (
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
                      void handleExportExcel();
                    }}
                    disabled={!exportFrom || !exportTo || exportLoading}
                    className={cn(
                      "inline-flex h-[38px] w-full items-center justify-center rounded-full bg-[#8d1313] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
                      panelUi.focusRing
                    )}
                  >
                    {exportLoading ? "Exportando..." : "Exportar Excel"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : undefined}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <button
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition",
              activeTab === "free_pass"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab("free_pass")}
            type="button"
          >
            Free pass
          </button>
          <button
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition",
              activeTab === "paid"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            )}
            onClick={() => {
              setActiveTab("paid");
              setPaidEntriesNotice(null);
            }}
            type="button"
          >
            Pagadas
          </button>
        </div>
      </section>

      {activeTab === "free_pass" ? (
        <>
      <section
        className={cn(
          "rounded-xl border px-4 py-3 shadow-sm",
          panelTheme === "dark"
            ? "border-[#303030] bg-[#171717]"
            : "border-sky-100 bg-sky-50"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2
              className={cn(
                "text-sm font-semibold",
                panelTheme === "dark" ? "text-[#F5F5F5]" : "text-slate-900"
              )}
            >
              Entradas del flujo anterior
            </h2>
            <p
              className={cn(
                "text-sm",
                panelTheme === "dark" ? "text-[#D4D4D4]" : "text-slate-700"
              )}
            >
              Este listado corresponde a entradas y free pass del flujo anterior. Las entradas pagas
              recibidas por correo con QR se validan desde Check-in &gt; Entradas pagas.
            </p>
          </div>
          <Link
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
              panelUi.focusRing,
              panelTheme === "dark"
                ? "bg-[#F5F5F5] text-[#171717] hover:bg-[#E5E5E5]"
                : "bg-slate-950 text-white hover:bg-slate-800"
            )}
            href="/panel/checkin"
          >
            Ir a Check-in
          </Link>
        </div>
      </section>

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
                onClick={() => handleStateFilterChange(card.key as EntryStateFilter)}
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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-medium text-slate-500">
              {lastRefreshLabel}
            </span>
            <button
              type="button"
              onClick={() => void refreshOrdersData("foreground")}
              disabled={!canRefreshOrders || refreshLoading}
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[220px_1fr_200px_120px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar por</label>
            <select
              value={searchType}
              onChange={(e) => {
                setEntriesOffset(0);
                setSearchType(e.target.value as SearchType);
              }}
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
                  setEntriesOffset(0);
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
        {refreshError ? (
          <p className="mt-3 text-xs text-amber-700">{refreshError}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        {manualCheckinNotice ? (
          <div
            className={cn(
              "rounded-lg border p-3",
              manualCheckinNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            )}
          >
            <p
              className={cn(
                "text-sm",
                manualCheckinNotice.type === "success"
                  ? "text-emerald-700"
                  : "text-red-700"
              )}
            >
              {manualCheckinNotice.message}
            </p>
          </div>
        ) : null}

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

        {(entriesOffset > 0 || entriesHasMore) && (entries.length > 0 || entriesOffset > 0) ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              {entriesOffset > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setEntriesOffset((current) =>
                      Math.max(current - ORDERS_PAGE_SIZE, 0)
                    )
                  }
                  disabled={entriesLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver anteriores
                </button>
              ) : null}
              {entriesHasMore ? (
                <button
                  type="button"
                  onClick={() => setEntriesOffset((current) => current + ORDERS_PAGE_SIZE)}
                  disabled={entriesLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver siguientes
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
        </>
      ) : (
        renderPaidEntriesSection()
      )}
    </div>
  );
}
