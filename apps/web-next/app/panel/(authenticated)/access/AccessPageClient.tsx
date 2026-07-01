"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader, cn, panelUi } from "@/components/panel/ui";
import { ApiError } from "@/lib/api";
import {
  createAccessTicketType,
  getAccessStockLimits,
  getAccessTicketTypes,
  updateAccessTicketType,
  upsertAccessStockLimit,
  type AccessStockLimit,
  type AccessStockMode,
  type AccessTicketType,
} from "@/lib/accessConfig";
import { usePanelContext } from "@/lib/panelContext";

interface TicketFormState {
  name: string;
  description: string;
  priceGs: string;
  active: boolean;
}

type NoticeState = { type: "success" | "error"; message: string } | null;

const EMPTY_TICKET_FORM: TicketFormState = {
  name: "",
  description: "",
  priceGs: "",
  active: false,
};

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPYG(value: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function getStockStatusLabel(stockLimit: AccessStockLimit): string {
  if (stockLimit.status === "unconfigured") return "Sin stock configurado";
  if (stockLimit.stock_mode === "unlimited") return "Stock ilimitado";
  if (stockLimit.status === "sold_out") return "Agotado";
  return "Stock limitado";
}

function getStockStatusClass(stockLimit: AccessStockLimit): string {
  if (stockLimit.status === "unconfigured") return panelUi.badgeWarn;
  if (stockLimit.status === "sold_out") return panelUi.badgeDanger;
  return panelUi.badgeSuccess;
}

function getStockDetail(stockLimit: AccessStockLimit): string {
  if (stockLimit.status === "unconfigured") {
    return "El checkout no podrá vender esta entrada para esta fecha.";
  }

  if (stockLimit.stock_mode === "unlimited") {
    return `${stockLimit.sold_or_reserved_count} reservas o ventas bloqueadas.`;
  }

  return `${stockLimit.sold_or_reserved_count} de ${stockLimit.capacity ?? 0} lugares bloqueados. Disponibles: ${stockLimit.available_count ?? 0}.`;
}

export function AccessPageClient() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const canEdit = context?.role === "owner";
  const isClub = context?.local.type === "club";
  const [ticketTypes, setTicketTypes] = useState<AccessTicketType[]>([]);
  const [stockLimits, setStockLimits] = useState<AccessStockLimit[]>([]);
  const [stockDate, setStockDate] = useState(() => getDateKey(new Date()));
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [stockMode, setStockMode] = useState<AccessStockMode>("unlimited");
  const [capacity, setCapacity] = useState("");
  const [ticketForm, setTicketForm] = useState<TicketFormState>(EMPTY_TICKET_FORM);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const editingTicket = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === editingTicketId) ?? null,
    [editingTicketId, ticketTypes]
  );

  const selectedStockLimit = useMemo(
    () =>
      stockLimits.find(
        (stockLimit) => stockLimit.access_ticket_type_id === selectedTicketId
      ) ?? null,
    [selectedTicketId, stockLimits]
  );

  const reloadAccessConfig = useCallback(async (options?: { clearNotice?: boolean }) => {
    setLoading(true);
    if (options?.clearNotice !== false) {
      setNotice(null);
    }

    try {
      const [ticketTypesResponse, stockLimitsResponse] = await Promise.all([
        getAccessTicketTypes(),
        getAccessStockLimits({ date: stockDate }),
      ]);

      setTicketTypes(ticketTypesResponse.ticketTypes);
      setStockLimits(stockLimitsResponse.stockLimits);
      setSelectedTicketId((current) => {
        if (current && ticketTypesResponse.ticketTypes.some((ticket) => ticket.id === current)) {
          return current;
        }

        return ticketTypesResponse.ticketTypes[0]?.id ?? "";
      });
    } catch (error) {
      setTicketTypes([]);
      setStockLimits([]);
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos cargar la configuración."),
      });
    } finally {
      setLoading(false);
    }
  }, [stockDate]);

  useEffect(() => {
    if (contextLoading || !context || !isClub) return;
    void reloadAccessConfig();
  }, [context, contextLoading, isClub, reloadAccessConfig]);

  useEffect(() => {
    if (!selectedStockLimit) {
      setStockMode("unlimited");
      setCapacity("");
      return;
    }

    setStockMode(selectedStockLimit.stock_mode ?? "unlimited");
    setCapacity(
      selectedStockLimit.stock_mode === "limited" && selectedStockLimit.capacity !== null
        ? String(selectedStockLimit.capacity)
        : ""
    );
  }, [selectedStockLimit]);

  const resetTicketForm = () => {
    setEditingTicketId(null);
    setTicketForm(EMPTY_TICKET_FORM);
  };

  const startEditTicket = (ticketType: AccessTicketType) => {
    setEditingTicketId(ticketType.id);
    setTicketForm({
      name: ticketType.name,
      description: ticketType.description ?? "",
      priceGs: String(ticketType.price_gs),
      active: ticketType.active,
    });
    setNotice(null);
  };

  const handleSaveTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    const name = ticketForm.name.trim();
    const description = ticketForm.description.trim() || null;
    const priceGs = Number(ticketForm.priceGs);

    if (!name || name.length < 2) {
      setNotice({ type: "error", message: "El nombre debe tener al menos 2 caracteres." });
      return;
    }

    if (!Number.isInteger(priceGs) || priceGs <= 0) {
      setNotice({ type: "error", message: "El precio debe ser un entero mayor a 0." });
      return;
    }

    setSavingTicket(true);
    setNotice(null);

    try {
      if (editingTicket) {
        await updateAccessTicketType(editingTicket.id, {
          description,
          active: ticketForm.active,
          ...(editingTicket.has_sales ? {} : { name, price_gs: priceGs }),
        });
        setNotice({ type: "success", message: "Entrada actualizada." });
      } else {
        await createAccessTicketType({
          name,
          description,
          price_gs: priceGs,
          active: ticketForm.active,
        });
        setNotice({ type: "success", message: "Entrada creada." });
      }

      resetTicketForm();
      await reloadAccessConfig({ clearNotice: false });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos guardar la entrada."),
      });
    } finally {
      setSavingTicket(false);
    }
  };

  const handleToggleTicket = async (ticketType: AccessTicketType) => {
    if (!canEdit) return;

    setSavingTicket(true);
    setNotice(null);

    try {
      await updateAccessTicketType(ticketType.id, { active: !ticketType.active });
      setNotice({
        type: "success",
        message: ticketType.active ? "Entrada desactivada." : "Entrada activada.",
      });
      await reloadAccessConfig({ clearNotice: false });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos cambiar el estado de la entrada."),
      });
    } finally {
      setSavingTicket(false);
    }
  };

  const handleSaveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    if (!selectedTicketId) {
      setNotice({ type: "error", message: "Seleccioná una entrada para configurar stock." });
      return;
    }

    let parsedCapacity: number | null = null;
    if (stockMode === "limited") {
      const capacityValue = Number(capacity);
      if (!Number.isInteger(capacityValue) || capacityValue <= 0) {
        setNotice({
          type: "error",
          message: "La capacidad debe ser un entero mayor a 0 para stock limitado.",
        });
        return;
      }
      parsedCapacity = capacityValue;
    }

    setSavingStock(true);
    setNotice(null);

    try {
      await upsertAccessStockLimit({
        access_ticket_type_id: selectedTicketId,
        access_date: stockDate,
        stock_mode: stockMode,
        capacity: stockMode === "limited" ? parsedCapacity : null,
      });
      setNotice({ type: "success", message: "Stock guardado." });
      await reloadAccessConfig({ clearNotice: false });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos guardar el stock."),
      });
    } finally {
      setSavingStock(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className={panelUi.mutedText}>Cargando...</p>
      </div>
    );
  }

  if (contextError || !context) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-red-600">
          {contextError || "Error al cargar información del panel"}
        </p>
      </div>
    );
  }

  if (!isClub) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Entradas pagas / Stock"
          subtitle="Configuración disponible para discotecas."
        />
        <div className={cn(panelUi.card, "p-5")}>
          <p className={panelUi.mutedText}>
            Esta sección está disponible solo para locales de tipo discoteca.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas pagas / Stock"
        subtitle="Gestioná las entradas pagadas y el stock disponible por fecha."
      />

      {!canEdit ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Tu usuario puede consultar esta configuración, pero no modificarla.
          </p>
        </section>
      ) : null}

      {notice ? (
        <section
          className={cn(
            "rounded-2xl border px-4 py-3",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          <p className="text-sm">{notice.message}</p>
        </section>
      ) : null}

      <section className={cn(panelUi.card, "p-5")}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Tipos de entrada</h2>
            <p className={panelUi.mutedText}>
              Las entradas activas aparecen en el checkout público si tienen stock para la fecha.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reloadAccessConfig()}
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {loading && ticketTypes.length === 0 ? (
              <div className={panelUi.emptyWrap}>
                <p className={panelUi.mutedText}>Cargando entradas pagas...</p>
              </div>
            ) : null}

            {!loading && ticketTypes.length === 0 ? (
              <div className={panelUi.emptyWrap}>
                <p className={panelUi.mutedText}>Todavía no hay entradas pagas configuradas.</p>
              </div>
            ) : null}

            {ticketTypes.map((ticketType) => (
              <article
                key={ticketType.id}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-neutral-950">
                        {ticketType.name}
                      </h3>
                      <span
                        className={cn(
                          panelUi.badgeBase,
                          ticketType.active ? panelUi.badgeSuccess : panelUi.badgeNeutral
                        )}
                      >
                        {ticketType.active ? "Activa" : "Inactiva"}
                      </span>
                      {ticketType.has_sales ? (
                        <span className={cn(panelUi.badgeBase, panelUi.badgeWarn)}>
                          Con ventas
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatPYG(ticketType.price_gs)}
                    </p>
                    {ticketType.description ? (
                      <p className={panelUi.mutedText}>{ticketType.description}</p>
                    ) : (
                      <p className="text-sm text-neutral-400">Sin descripción.</p>
                    )}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditTicket(ticketType)}
                        className={cn(
                          "rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50",
                          panelUi.focusRing
                        )}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleTicket(ticketType)}
                        disabled={savingTicket}
                        className={cn(
                          "rounded-full px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
                          panelUi.focusRing,
                          ticketType.active
                            ? "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        )}
                      >
                        {ticketType.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <form className="rounded-2xl border border-neutral-200 bg-white p-4" onSubmit={handleSaveTicket}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-neutral-950">
                  {editingTicket ? "Editar entrada" : "Nueva entrada"}
                </h3>
                <p className="text-xs text-neutral-500">
                  {editingTicket?.has_sales
                    ? "Esta entrada ya tiene ventas. Solo podés cambiar descripción o estado."
                    : "Configuración comercial de entrada pagada."}
                </p>
              </div>
              {editingTicket ? (
                <button
                  type="button"
                  onClick={resetTicketForm}
                  className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={panelUi.labelText} htmlFor="access-ticket-name">
                  Nombre
                </label>
                <input
                  id="access-ticket-name"
                  type="text"
                  value={ticketForm.name}
                  onChange={(event) =>
                    setTicketForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={!canEdit || Boolean(editingTicket?.has_sales)}
                  className={cn(
                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                    panelUi.focusRing
                  )}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <label className={panelUi.labelText} htmlFor="access-ticket-price">
                  Precio Gs.
                </label>
                <input
                  id="access-ticket-price"
                  type="number"
                  min="1"
                  value={ticketForm.priceGs}
                  onChange={(event) =>
                    setTicketForm((current) => ({ ...current, priceGs: event.target.value }))
                  }
                  disabled={!canEdit || Boolean(editingTicket?.has_sales)}
                  className={cn(
                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                    panelUi.focusRing
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className={panelUi.labelText} htmlFor="access-ticket-description">
                  Descripción
                </label>
                <textarea
                  id="access-ticket-description"
                  value={ticketForm.description}
                  onChange={(event) =>
                    setTicketForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  disabled={!canEdit}
                  rows={4}
                  maxLength={500}
                  className={cn(
                    "min-h-[112px] w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                    panelUi.focusRing
                  )}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={ticketForm.active}
                  onChange={(event) =>
                    setTicketForm((current) => ({ ...current, active: event.target.checked }))
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Activa
              </label>

              {canEdit ? (
                <button
                  type="submit"
                  disabled={savingTicket}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                    panelUi.focusRing
                  )}
                >
                  {savingTicket ? "Guardando..." : editingTicket ? "Guardar entrada" : "Crear entrada"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section className={cn(panelUi.card, "p-5")}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Stock por fecha</h2>
            <p className={panelUi.mutedText}>
              Configurá disponibilidad por fecha antes de vender en el checkout público.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <label className={panelUi.labelText} htmlFor="access-stock-date">
              Fecha
            </label>
            <input
              id="access-stock-date"
              type="date"
              value={stockDate}
              onChange={(event) => setStockDate(event.target.value)}
              className={cn(
                "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 sm:w-[180px]",
                panelUi.focusRing
              )}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {stockLimits.length === 0 ? (
              <div className={panelUi.emptyWrap}>
                <p className={panelUi.mutedText}>Creá una entrada pagada para configurar stock.</p>
              </div>
            ) : null}

            {stockLimits.map((stockLimit) => (
              <article
                key={`${stockLimit.access_ticket_type_id}-${stockLimit.access_date}`}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-neutral-950">
                      {stockLimit.ticket_name}
                    </h3>
                    <p className={panelUi.mutedText}>{getStockDetail(stockLimit)}</p>
                  </div>
                  <span className={cn(panelUi.badgeBase, getStockStatusClass(stockLimit))}>
                    {getStockStatusLabel(stockLimit)}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <form className="rounded-2xl border border-neutral-200 bg-white p-4" onSubmit={handleSaveStock}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-neutral-950">Configurar stock</h3>
              <p className="text-xs text-neutral-500">
                El stock se guarda para la fecha seleccionada.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={panelUi.labelText} htmlFor="access-stock-ticket">
                  Entrada
                </label>
                <select
                  id="access-stock-ticket"
                  value={selectedTicketId}
                  onChange={(event) => setSelectedTicketId(event.target.value)}
                  disabled={!canEdit || ticketTypes.length === 0}
                  className={cn(
                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                    panelUi.focusRing
                  )}
                >
                  {ticketTypes.map((ticketType) => (
                    <option key={ticketType.id} value={ticketType.id}>
                      {ticketType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={panelUi.labelText} htmlFor="access-stock-mode">
                  Tipo de stock
                </label>
                <select
                  id="access-stock-mode"
                  value={stockMode}
                  onChange={(event) => setStockMode(event.target.value as AccessStockMode)}
                  disabled={!canEdit}
                  className={cn(
                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                    panelUi.focusRing
                  )}
                >
                  <option value="unlimited">Ilimitado</option>
                  <option value="limited">Limitado</option>
                </select>
              </div>

              {stockMode === "limited" ? (
                <div className="space-y-1.5">
                  <label className={panelUi.labelText} htmlFor="access-stock-capacity">
                    Capacidad
                  </label>
                  <input
                    id="access-stock-capacity"
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    disabled={!canEdit}
                    className={cn(
                      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                      panelUi.focusRing
                    )}
                  />
                </div>
              ) : null}

              {selectedStockLimit ? (
                <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  {getStockDetail(selectedStockLimit)}
                </p>
              ) : null}

              {canEdit ? (
                <button
                  type="submit"
                  disabled={savingStock || !selectedTicketId}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                    panelUi.focusRing
                  )}
                >
                  {savingStock ? "Guardando..." : "Guardar stock"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
