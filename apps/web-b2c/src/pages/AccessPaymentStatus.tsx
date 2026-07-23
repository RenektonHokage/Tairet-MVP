import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Home,
  Mail,
  PackageCheck,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiBase } from "@/lib/api";
import {
  createAccessPublicStatusController,
  EMPTY_ACCESS_PUBLIC_STATUS_STATE,
  fetchAccessPublicStatus,
  type AccessPublicStatusController,
  type AccessPublicStatusControllerState,
  type AccessPublicStatusPrimaryState,
  type AccessPublicStatusWarning,
  type PublicAccessEmailStatus,
  type PublicAccessFulfillmentStatus,
  type PublicAccessOrderStatus,
} from "@/lib/accessPublicStatus";

interface PrimaryPresentation {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  surface: string;
}

interface DimensionPresentation {
  value: string;
  icon: LucideIcon;
  tone: string;
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

function primaryPresentation(
  primary: AccessPublicStatusPrimaryState | null,
  returnedCancelled: boolean,
): PrimaryPresentation {
  switch (primary) {
    case null:
      return {
        title: "Consultando el estado.",
        description: "Estamos verificando el pago y la entrega.",
        icon: RefreshCw,
        tone: "text-primary",
        surface: "bg-primary/10",
      };
    case "payment_pending":
      return {
        title: "Pago pendiente de confirmación.",
        description: returnedCancelled
          ? "Volviste sin completar el pago. Si pagaste, actualizá el estado para verificar la confirmación."
          : "Esperamos la confirmación del procesador.",
        icon: RefreshCw,
        tone: "text-primary",
        surface: "bg-primary/10",
      };
    case "payment_cancelled":
      return {
        title: "Pago cancelado o rechazado.",
        description: "La operación no quedó confirmada.",
        icon: XCircle,
        tone: "text-destructive",
        surface: "bg-destructive/10",
      };
    case "payment_expired":
      return {
        title: "El tiempo de pago se agotó.",
        description: "La operación ya no está disponible para confirmación.",
        icon: Clock3,
        tone: "text-muted-foreground",
        surface: "bg-muted",
      };
    case "payment_manual_review":
      return {
        title: "El pago requiere revisión.",
        description: "Estamos revisando la confirmación del pago.",
        icon: AlertCircle,
        tone: "text-amber-500",
        surface: "bg-amber-500/10",
      };
    case "fulfillment_pending":
      return {
        title: "Pago confirmado.",
        description: "La preparación de tus entradas está pendiente.",
        icon: RefreshCw,
        tone: "text-primary",
        surface: "bg-primary/10",
      };
    case "fulfillment_manual_review":
      return {
        title: "La preparación requiere revisión.",
        description: "El pago está confirmado y estamos revisando la preparación de tus entradas.",
        icon: AlertCircle,
        tone: "text-amber-500",
        surface: "bg-amber-500/10",
      };
    case "email_pending":
      return {
        title: "Entradas preparadas.",
        description: "El envío por correo está pendiente.",
        icon: RefreshCw,
        tone: "text-primary",
        surface: "bg-primary/10",
      };
    case "email_retry_scheduled":
      return {
        title: "Reintentaremos el envío.",
        description: "Las entradas están preparadas y el correo tiene un reintento programado.",
        icon: RefreshCw,
        tone: "text-amber-500",
        surface: "bg-amber-500/10",
      };
    case "email_sent":
      return {
        title: "Correo enviado.",
        description: "Enviamos las entradas al correo indicado.",
        icon: CheckCircle2,
        tone: "text-emerald-500",
        surface: "bg-emerald-500/10",
      };
    case "email_manual_review":
      return {
        title: "El envío requiere revisión.",
        description: "Las entradas están preparadas y estamos revisando el envío por correo.",
        icon: AlertCircle,
        tone: "text-amber-500",
        surface: "bg-amber-500/10",
      };
    case "not_found":
      return {
        title: "No encontramos esta referencia de pago.",
        description: "Revisá el enlace o intentá nuevamente desde tu compra.",
        icon: AlertCircle,
        tone: "text-muted-foreground",
        surface: "bg-muted",
      };
    case "initial_error":
      return {
        title: "No pudimos consultar el estado.",
        description: "Intentá actualizarlo nuevamente.",
        icon: AlertCircle,
        tone: "text-destructive",
        surface: "bg-destructive/10",
      };
    case "poll_timeout":
      return {
        title: "La verificación está tardando más de lo esperado.",
        description: "Actualizá el estado para volver a consultar.",
        icon: Clock3,
        tone: "text-muted-foreground",
        surface: "bg-muted",
      };
  }
}

function paymentPresentation(status: PublicAccessOrderStatus): DimensionPresentation {
  switch (status) {
    case "pending_payment":
      return { value: "Pendiente", icon: Clock3, tone: "text-primary" };
    case "paid":
      return { value: "Confirmado", icon: CheckCircle2, tone: "text-emerald-500" };
    case "cancelled":
      return { value: "Cancelado o rechazado", icon: XCircle, tone: "text-destructive" };
    case "manual_review":
      return { value: "Revisión manual", icon: AlertCircle, tone: "text-amber-500" };
    case "expired":
      return { value: "Vencido", icon: Clock3, tone: "text-muted-foreground" };
  }
}

function fulfillmentPresentation(status: PublicAccessFulfillmentStatus): DimensionPresentation {
  switch (status) {
    case "not_started":
      return { value: "No iniciada", icon: Clock3, tone: "text-muted-foreground" };
    case "pending":
      return { value: "En preparación", icon: Clock3, tone: "text-primary" };
    case "issued":
      return { value: "Preparadas", icon: PackageCheck, tone: "text-emerald-500" };
    case "manual_review":
      return { value: "Revisión manual", icon: AlertCircle, tone: "text-amber-500" };
  }
}

function emailPresentation(status: PublicAccessEmailStatus): DimensionPresentation {
  switch (status) {
    case "not_started":
      return { value: "No iniciado", icon: Clock3, tone: "text-muted-foreground" };
    case "pending":
      return { value: "Pendiente", icon: Clock3, tone: "text-primary" };
    case "retry_scheduled":
      return { value: "Reintento programado", icon: Clock3, tone: "text-amber-500" };
    case "sent":
      return { value: "Enviado", icon: Mail, tone: "text-emerald-500" };
    case "manual_review":
      return { value: "Revisión manual", icon: AlertCircle, tone: "text-amber-500" };
  }
}

function warningCopy(warning: AccessPublicStatusWarning | null): string | null {
  switch (warning) {
    case null:
      return null;
    case "poll_error":
      return "No pudimos actualizar automáticamente. Podés intentarlo nuevamente.";
    case "refresh_error":
      return "No pudimos actualizar el estado. Intentá nuevamente.";
    case "not_found_after_valid":
      return "La referencia dejó de estar disponible. Mostramos el último estado válido.";
    case "poll_timeout":
      return "La verificación automática terminó. Actualizá el estado para consultar de nuevo.";
  }
}

function StatusRow({
  label,
  presentation,
}: {
  label: string;
  presentation: DimensionPresentation;
}) {
  const StatusIcon = presentation.icon;

  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`flex items-center gap-2 text-right font-medium ${presentation.tone}`}>
        <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{presentation.value}</span>
      </dd>
    </div>
  );
}

const AccessPaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref")?.trim() ?? "";
  const returnedCancelled = searchParams.get("cancelled") === "1";
  const controllerRef = useRef<AccessPublicStatusController | null>(null);
  const [controllerState, setControllerState] =
    useState<AccessPublicStatusControllerState>(EMPTY_ACCESS_PUBLIC_STATUS_STATE);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const apiBase = getApiBase();
    const controller = createAccessPublicStatusController({
      fetchStatus: (currentRef, signal) =>
        fetchAccessPublicStatus(apiBase, currentRef, signal),
    });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setControllerState);

    controller.start(ref);

    return () => {
      unsubscribe();
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [ref]);

  const visibleState =
    controllerState.ref === ref
      ? controllerState
      : { ...EMPTY_ACCESS_PUBLIC_STATUS_STATE, ref };
  const view = primaryPresentation(visibleState.primary, returnedCancelled);
  const warning = warningCopy(visibleState.warning);
  const isManualRefreshing = visibleState.requestKind === "refresh";
  const isWorking = visibleState.requestKind !== null || visibleState.isAutoPolling;
  const StatusIcon = isWorking ? RefreshCw : view.icon;
  const order = visibleState.order;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 mt-16">
        <Card className="w-full max-w-lg">
          <CardContent className="px-6 pb-8 pt-10 text-center space-y-6" aria-live="polite">
            <div className="flex justify-center">
              <div className={`${view.surface} rounded-full p-5`}>
                <StatusIcon
                  className={`h-12 w-12 ${view.tone} ${isWorking ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{view.title}</h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                {view.description}
              </p>
            </div>

            {order ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-left text-sm">
                <dl className="space-y-3">
                  <StatusRow label="Pago" presentation={paymentPresentation(order.status)} />
                  <StatusRow
                    label="Preparación"
                    presentation={fulfillmentPresentation(order.fulfillment.status)}
                  />
                  <StatusRow label="Correo" presentation={emailPresentation(order.email.status)} />

                  <div className="border-t pt-3" />

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

            {warning ? (
              <div
                className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm text-foreground"
                role="status"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <p>{warning}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              {visibleState.primary !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => controllerRef.current?.refresh()}
                  disabled={!ref || visibleState.requestKind !== null}
                  aria-busy={isManualRefreshing}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isManualRefreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {isManualRefreshing ? "Actualizando estado…" : "Actualizar estado"}
                </Button>
              ) : null}

              <Button asChild className="w-full" size="lg">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Volver al inicio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavbar />
    </div>
  );
};

export default AccessPaymentStatus;
