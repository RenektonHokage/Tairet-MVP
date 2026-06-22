import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Home,
  RefreshCw,
  XCircle,
} from "lucide-react";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiBase } from "@/lib/api";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 60_000;

type PublicOrderStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "manual_review"
  | "expired";

type LoadState = "loading" | "ready" | "not_found" | "error";

interface AccessPaymentOrder {
  ref: string;
  status: PublicOrderStatus;
  source_type: "local" | "event";
  access_date: string;
  amount_gs: number;
  currency: string;
  expires_at: string | null;
  venue_name: string | null;
}

interface AccessPaymentStatusResponse {
  ok: true;
  order: AccessPaymentOrder;
}

type StatusFetchResult =
  | { kind: "found"; order: AccessPaymentOrder }
  | { kind: "not_found" };

function isAccessPaymentStatusResponse(value: unknown): value is AccessPaymentStatusResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || !payload.order || typeof payload.order !== "object") {
    return false;
  }

  const order = payload.order as Record<string, unknown>;
  return (
    typeof order.ref === "string" &&
    typeof order.status === "string" &&
    ["pending_payment", "paid", "cancelled", "manual_review", "expired"].includes(order.status) &&
    (order.source_type === "local" || order.source_type === "event") &&
    typeof order.access_date === "string" &&
    typeof order.amount_gs === "number" &&
    typeof order.currency === "string" &&
    (typeof order.expires_at === "string" || order.expires_at === null) &&
    (typeof order.venue_name === "string" || order.venue_name === null)
  );
}

async function fetchAccessPaymentStatus(ref: string): Promise<StatusFetchResult> {
  const response = await fetch(
    `${getApiBase()}/payments/access/status?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (response.status === 404) {
    return { kind: "not_found" };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !isAccessPaymentStatusResponse(payload)) {
    throw new Error("Invalid payment status response");
  }

  return {
    kind: "found",
    order: payload.order,
  };
}

function formatAmount(amountGs: number, currency: string): string {
  if (currency !== "PYG") {
    return `${amountGs.toLocaleString("es-PY")} ${currency}`;
  }

  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amountGs);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function statusView(
  status: PublicOrderStatus | "not_found" | "error",
  returnedCancelled: boolean
) {
  if (status === "paid") {
    return {
      title: "Pago confirmado.",
      description: "Tu pago fue confirmado correctamente.",
      icon: CheckCircle2,
      tone: "text-emerald-500",
      surface: "bg-emerald-500/10",
    };
  }

  if (status === "cancelled") {
    return {
      title: "Pago cancelado o rechazado.",
      description: "La operación no quedó confirmada.",
      icon: XCircle,
      tone: "text-destructive",
      surface: "bg-destructive/10",
    };
  }

  if (status === "manual_review") {
    return {
      title: "Estamos revisando tu pago.",
      description: "La confirmación requiere una revisión adicional.",
      icon: AlertCircle,
      tone: "text-amber-500",
      surface: "bg-amber-500/10",
    };
  }

  if (status === "expired") {
    return {
      title: "El tiempo de pago se agotó.",
      description: "La operación ya no está disponible para confirmación.",
      icon: Clock3,
      tone: "text-muted-foreground",
      surface: "bg-muted",
    };
  }

  if (status === "not_found") {
    return {
      title: "No encontramos esta referencia de pago.",
      description: "Revisá el enlace o intentá nuevamente desde tu compra.",
      icon: AlertCircle,
      tone: "text-muted-foreground",
      surface: "bg-muted",
    };
  }

  if (status === "error") {
    return {
      title: "No pudimos consultar el estado. Intentá nuevamente.",
      description: "Hubo un problema al consultar la confirmación.",
      icon: AlertCircle,
      tone: "text-destructive",
      surface: "bg-destructive/10",
    };
  }

  return {
    title: "Estamos verificando tu pago.",
    description: returnedCancelled
      ? "Volviste sin completar el pago. Si pagaste, estamos verificando la confirmación."
      : "Esto puede tardar unos segundos mientras recibimos la confirmación.",
    icon: RefreshCw,
    tone: "text-primary",
    surface: "bg-primary/10",
  };
}

const AccessPaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref")?.trim() ?? "";
  const returnedCancelled = searchParams.get("cancelled") === "1";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [order, setOrder] = useState<AccessPaymentOrder | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    let isMounted = true;
    const startedAt = Date.now();

    if (!ref) {
      setOrder(null);
      setLoadState("not_found");
      return () => undefined;
    }

    async function loadStatus() {
      try {
        const result = await fetchAccessPaymentStatus(ref);
        if (!isMounted) return;

        if (result.kind === "not_found") {
          setOrder(null);
          setLoadState("not_found");
          return;
        }

        setOrder(result.order);
        setLoadState("ready");

        if (result.order.status === "pending_payment" && Date.now() - startedAt < MAX_POLL_MS) {
          timeoutId = window.setTimeout(loadStatus, POLL_INTERVAL_MS);
        }
      } catch {
        if (!isMounted) return;
        setOrder(null);
        setLoadState("error");
      }
    }

    setLoadState("loading");
    setOrder(null);
    void loadStatus();

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [ref]);

  const visibleStatus = useMemo<PublicOrderStatus | "not_found" | "error">(() => {
    if (loadState === "not_found") return "not_found";
    if (loadState === "error") return "error";
    return order?.status ?? "pending_payment";
  }, [loadState, order?.status]);

  const view = statusView(visibleStatus, returnedCancelled);
  const StatusIcon = view.icon;
  const isPolling = order?.status === "pending_payment" && loadState === "ready";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 mt-16">
        <Card className="w-full max-w-lg">
          <CardContent className="px-6 pb-8 pt-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className={`${view.surface} rounded-full p-5`}>
                <StatusIcon
                  className={`h-12 w-12 ${view.tone} ${isPolling ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {loadState === "loading" ? "Estamos verificando tu pago." : view.title}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                {loadState === "loading"
                  ? "Esto puede tardar unos segundos mientras recibimos la confirmación."
                  : view.description}
              </p>
            </div>

            {order ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-left text-sm">
                <dl className="space-y-3">
                  {order.venue_name ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">Lugar</dt>
                      <dd className="text-right font-medium text-foreground">{order.venue_name}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Fecha</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatDate(order.access_date)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Monto</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatAmount(order.amount_gs, order.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <Button asChild className="w-full" size="lg">
              <Link to="/">
                <Home className="h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNavbar />
    </div>
  );
};

export default AccessPaymentStatus;
