"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePanelContext } from "@/lib/panelContext";
import { getApiBase, getAuthHeaders } from "@/lib/api";

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

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();

  const isClub = context?.local.type === "club";
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isClub) {
      setIntendedDate("");
      return;
    }
    const nextDate = searchParams.get("intended_date") ?? "";
    setIntendedDate(nextDate);
  }, [searchParams, isClub]);

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

    setSummaryLoading(true);
    setSummaryError(null);

    try {
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
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
      }

      const data: OrdersSummaryResponse = await response.json();
      setSummary(data);
      return data;
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Error al cargar resumen");
      return null;
    } finally {
      setSummaryLoading(false);
    }
  }, [isClub]);

  const loadEntries = useCallback(async () => {
    if (contextLoading || !context) {
      return;
    }

    if (isClub && !intendedDate) {
      return;
    }

    setEntriesLoading(true);
    setEntriesError(null);

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      const trimmedSearch = appliedSearchValue.trim();
      if (trimmedSearch) {
        params.set(searchType === "email" ? "email" : "document", trimmedSearch);
      }
      if (isClub && intendedDate) {
        params.set("intended_date", intendedDate);
      }
      if (isClub && stateFilter !== "all") {
        params.set("state", stateFilter);
      }
      params.set("limit", "20");

      const response = await fetch(`${getApiBase()}/panel/orders/search?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
      }

      const data: OrdersResponse = await response.json();
      setEntries(data.items ?? []);
      setEntriesCount(data.count ?? 0);
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : "Error al cargar entradas");
    } finally {
      setEntriesLoading(false);
    }
  }, [appliedSearchValue, context, contextLoading, intendedDate, isClub, searchType, stateFilter]);

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
        if (nextDate !== searchParams.get("intended_date")) {
          updateIntendedDateInUrl(nextDate);
        }
      }
    };

    void syncSummary();

    return () => {
      active = false;
    };
  }, [context, contextLoading, intendedDate, isClub, loadSummary, searchParams]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleSearch = () => {
    setAppliedSearchValue(searchValue.trim());
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

  const stateStyles: Record<EntryResolvedState, { label: string; badge: string; border: string; iconBg: string }> = {
    used: {
      label: "Usada",
      badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      border: "border-l-emerald-400",
      iconBg: "bg-emerald-100",
    },
    pending: {
      label: "Pendiente",
      badge: "bg-amber-50 text-amber-700 border border-amber-200",
      border: "border-l-amber-400",
      iconBg: "bg-amber-100",
    },
    unused: {
      label: "No usada",
      badge: "bg-slate-100 text-slate-700 border border-slate-200",
      border: "border-l-slate-400",
      iconBg: "bg-slate-200",
    },
    other: {
      label: "Sin estado",
      badge: "bg-slate-50 text-slate-600 border border-slate-200",
      border: "border-l-slate-300",
      iconBg: "bg-slate-100",
    },
  };

  const summaryCards = useMemo(() => {
    const source = summary ?? { total_qty: 0, used_qty: 0, pending_qty: 0, unused_qty: 0 };
    return [
      { key: "all" as EntryStateFilter, label: "Total entradas", value: source.total_qty, accent: "border-blue-500" },
      { key: "used" as EntryStateFilter, label: "Usadas", value: source.used_qty, accent: "border-emerald-500" },
      { key: "pending" as EntryStateFilter, label: "Pendientes", value: source.pending_qty, accent: "border-amber-500" },
      { key: "unused" as EntryStateFilter, label: "No usadas", value: source.unused_qty, accent: "border-slate-500" },
    ];
  }, [summary]);

  const renderEntryCard = (order: OrderItem) => {
    const resolvedState = resolveState(order);
    const stateStyle = stateStyles[resolvedState];
    const fullName = `${order.customer_name ?? ""} ${order.customer_last_name ?? ""}`.trim() || "-";
    const quantity = typeof order.quantity === "number" ? order.quantity : 0;

    return (
      <div
        key={order.id}
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${stateStyle.border}`}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center lg:gap-x-8">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[132px_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_90px] lg:gap-x-6">
            <div className="min-w-0">
              <span className={`inline-flex min-w-[118px] items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${stateStyle.badge}`}>
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
              <div className={`h-7 w-7 rounded-full ${stateStyle.iconBg}`} />
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">Entradas & Check-ins</h1>
        <p className="text-sm text-slate-600">Gestiona y consulta el estado de las entradas del evento.</p>
      </div>

      {isClub ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setStateFilter(card.key)}
              className={`rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-colors ${
                stateFilter === card.key
                  ? `${card.accent} ring-1 ring-slate-300`
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-3xl font-bold text-slate-900">{summaryLoading ? "..." : card.value}</p>
              <p className="text-sm text-slate-600">{card.label}</p>
            </button>
          ))}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Buscar Entradas</h2>
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
                onChange={(e) => updateIntendedDateInUrl(e.target.value)}
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
        <p className="text-sm text-slate-500">
          {showingFiltered
            ? `Mostrando ${entriesCount} resultado${entriesCount === 1 ? "" : "s"} de búsqueda`
            : "Mostrando las últimas 20 entradas"}
        </p>

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
