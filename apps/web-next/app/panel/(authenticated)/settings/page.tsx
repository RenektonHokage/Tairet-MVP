"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useEffect, useCallback } from "react";
import { usePanelContext } from "@/lib/panelContext";
import { getApiBase } from "@/lib/api";
import {
  getSupportStatus,
  getPanelAccess,
  type SupportStatus,
  type PanelAccessItem,
} from "@/lib/support";

// Env vars para contacto de soporte (leídas en cliente)
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const SENTRY_SMOKE_TEST_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SENTRY_TEST === "true";
const HAS_SENTRY_CLIENT_DSN = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
const SENTRY_SMOKE_TEST_MESSAGE = "Tairet panel Sentry smoke test";
const SENTRY_SMOKE_TEST_FLUSH_TIMEOUT_MS = 3000;

type SentrySmokeTestStatus = "idle" | "sending" | "sent" | "error";

type SentrySmokeTestFeedback = {
  status: SentrySmokeTestStatus;
  eventId: string | null;
  flushResult: boolean | null;
  timestamp: string | null;
  error: string | null;
};

export default function SupportPage() {
  const { data: panelData, loading: panelLoading } = usePanelContext();

  // Estado del fetch de status
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Estado del fetch de accesos (solo owner)
  const [accessItems, setAccessItems] = useState<PanelAccessItem[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Estado del botón copiar
  const [copied, setCopied] = useState(false);
  const [sentrySmokeTestFeedback, setSentrySmokeTestFeedback] =
    useState<SentrySmokeTestFeedback>({
      status: "idle",
      eventId: null,
      flushResult: null,
      timestamp: null,
      error: null,
    });

  const isOwner = panelData?.role === "owner";
  const localType = panelData?.local.type ?? "bar";
  const canShowSentrySmokeTest =
    isOwner && SENTRY_SMOKE_TEST_ENABLED && HAS_SENTRY_CLIENT_DSN;
  const sentrySmokeTestStatus = sentrySmokeTestFeedback.status;

  // Fetch status
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await getSupportStatus();
      setStatus(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Error al cargar estado");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Fetch accesos (solo owner)
  const fetchAccess = useCallback(async () => {
    if (!isOwner) return;
    setAccessLoading(true);
    setAccessError(null);
    try {
      const data = await getPanelAccess();
      setAccessItems(data.items);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Error al cargar accesos");
    } finally {
      setAccessLoading(false);
    }
  }, [isOwner]);

  // Cargar datos al montar
  useEffect(() => {
    if (!panelLoading && panelData) {
      fetchStatus();
      if (isOwner) {
        fetchAccess();
      }
    }
  }, [panelLoading, panelData, isOwner, fetchStatus, fetchAccess]);

  // Copiar diagnóstico al clipboard
  const handleCopyDiagnostic = async () => {
    const diagnostic = [
      "Soporte Tairet - Diagnóstico",
      `now=${status?.now ?? new Date().toISOString()}`,
      `local_id=${status?.tenant.local_id ?? panelData?.local.id ?? "N/A"}`,
      `local_slug=${status?.tenant.local_slug ?? panelData?.local.slug ?? "N/A"}`,
      `local_type=${status?.tenant.local_type ?? localType}`,
      `email_enabled=${status?.email.enabled ?? "N/A"}`,
      `rate_limit_panel=${status?.rateLimit.panelEnabled ?? "N/A"}`,
      `trust_proxy_hops=${status?.rateLimit.trustProxyHops ?? "N/A"}`,
      `api_ok=${status?.ok ?? false}`,
      `panel_user_role=${panelData?.role ?? "N/A"}`,
      `api_base_url=${getApiBase()}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = diagnostic;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendSentrySmokeTest = async () => {
    setSentrySmokeTestFeedback({
      status: "sending",
      eventId: null,
      flushResult: null,
      timestamp: new Date().toISOString(),
      error: null,
    });

    try {
      const eventId = Sentry.captureException(
        new Error(SENTRY_SMOKE_TEST_MESSAGE)
      );
      const flushResult = await Sentry.flush(SENTRY_SMOKE_TEST_FLUSH_TIMEOUT_MS);

      setSentrySmokeTestFeedback({
        status: flushResult ? "sent" : "error",
        eventId: eventId || null,
        flushResult,
        timestamp: new Date().toISOString(),
        error: flushResult
          ? null
          : "Sentry.flush(3000) no confirmó el envío del evento.",
      });
    } catch (err) {
      setSentrySmokeTestFeedback({
        status: "error",
        eventId: null,
        flushResult: null,
        timestamp: new Date().toISOString(),
        error:
          err instanceof Error
            ? err.message
            : "Error desconocido al disparar la prueba de Sentry.",
      });
    }
  };

  if (panelLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-6 bg-gray-200 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!panelData) {
    return null;
  }

  const hasSupportContact = SUPPORT_WHATSAPP || SUPPORT_EMAIL;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Soporte</h1>
        <p className="text-gray-600 mt-2">Estado del sistema y guía rápida</p>
      </div>

      {/* Sección A: Estado */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Estado del Sistema</h2>
          <div className="flex items-center gap-2">
            {statusError && (
              <button
                onClick={fetchStatus}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Reintentar
              </button>
            )}
            {/* Botón Copiar diagnóstico (visible en header) */}
            <button
              onClick={handleCopyDiagnostic}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "Copiado" : "Copiar diagnóstico"}
            </button>
            {canShowSentrySmokeTest && (
              <button
                onClick={handleSendSentrySmokeTest}
                disabled={sentrySmokeTestStatus === "sending"}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  sentrySmokeTestStatus === "sent"
                    ? "bg-green-600 text-white"
                    : sentrySmokeTestStatus === "error"
                      ? "bg-red-600 text-white"
                      : sentrySmokeTestStatus === "sending"
                        ? "bg-gray-400 text-white cursor-wait"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {sentrySmokeTestStatus === "sent"
                  ? "Prueba enviada"
                  : sentrySmokeTestStatus === "error"
                    ? "Error Sentry"
                    : sentrySmokeTestStatus === "sending"
                      ? "Enviando..."
                    : "Enviar prueba a Sentry"}
              </button>
            )}
          </div>
        </div>

        {canShowSentrySmokeTest && sentrySmokeTestStatus !== "idle" && (
          <div
            className={`mb-4 rounded-md border p-3 text-sm ${
              sentrySmokeTestStatus === "sent"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {sentrySmokeTestStatus === "sent"
              ? "Prueba disparada. Confirmar recepción en Sentry antes de marcar B7 como PASS."
              : sentrySmokeTestStatus === "sending"
                ? "Disparando prueba de Sentry y esperando flush(3000)..."
                : "No se pudo confirmar el envío de la prueba de Sentry desde el panel."}
            <dl className="mt-2 grid gap-1 text-xs">
              <div>
                <dt className="inline font-medium">eventId: </dt>
                <dd className="inline">
                  {sentrySmokeTestFeedback.eventId ?? "ausente"}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">flush: </dt>
                <dd className="inline">
                  {sentrySmokeTestFeedback.flushResult === null
                    ? "pendiente"
                    : String(sentrySmokeTestFeedback.flushResult)}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">timestamp: </dt>
                <dd className="inline">
                  {sentrySmokeTestFeedback.timestamp ?? "N/A"}
                </dd>
              </div>
              {sentrySmokeTestFeedback.error && (
                <div>
                  <dt className="inline font-medium">error: </dt>
                  <dd className="inline">{sentrySmokeTestFeedback.error}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {statusLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : statusError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{statusError}</p>
            <button
              onClick={fetchStatus}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        ) : status ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* API Status */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">API</div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    status.ok ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="font-medium text-gray-900">
                  {status.ok ? "OK" : "ERROR"}
                </span>
              </div>
            </div>

            {/* Email Status */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Email (notificaciones)</div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    status.email.enabled ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                <span className="font-medium text-gray-900">
                  {status.email.enabled ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            {/* Rate Limit Status */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Rate Limit Panel</div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    status.rateLimit.panelEnabled ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="font-medium text-gray-900">
                  {status.rateLimit.panelEnabled ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            {/* Tenant Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Local</div>
              <div className="font-medium text-gray-900 truncate">
                {status.tenant.local_slug}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    status.tenant.local_type === "club"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {status.tenant.local_type === "club" ? "Discoteca" : "Bar"}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate">
                ID: {status.tenant.local_id}
              </div>
            </div>
          </div>
        ) : null}

        {/* Timestamp */}
        {status && (
          <div className="mt-4 text-xs text-gray-400">
            Última actualización: {new Date(status.now).toLocaleString("es-PY")}
          </div>
        )}
      </div>

      {/* Sección B: Guía rápida */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Guía Rápida</h2>

        <div className="space-y-3">
          {localType === "club" ? (
            <>
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-purple-600 mt-0.5">1.</span>
                <div>
                  <div className="font-medium text-purple-900">
                    Check-in: si falla la cámara
                  </div>
                  <div className="text-sm text-purple-700 mt-1">
                    Usar Entradas (buscar por email o documento del cliente)
                  </div>
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="font-medium text-purple-900 mb-3">
                  2. Plan B (si falla el escáner)
                </div>
                <div className="space-y-2 text-sm text-purple-700">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-purple-800">a)</span>
                    <span>Ir a <strong>Entradas</strong> en el menú</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-purple-800">b)</span>
                    <span>Buscar por email o documento del cliente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-purple-800">c)</span>
                    <span>Verificar que el estado sea <strong>Pagada</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-purple-800">d)</span>
                    <span>Hacer check-in manual desde la orden</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-blue-600 mt-0.5">1.</span>
              <div>
                <div className="font-medium text-blue-900">
                  Reservas: buscar cliente
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  Buscar por email, teléfono o nombre en la lista de reservas
                </div>
              </div>
            </div>
          )}

          {/* Común para ambos */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-gray-600 mt-0.5">
              {localType === "club" ? "3." : "2."}
            </span>
            <div>
              <div className="font-medium text-gray-900">Si algo no carga</div>
              <div className="text-sm text-gray-600 mt-1">
                Refrescar la página. Si persiste, copiar el diagnóstico y enviarlo
                al soporte.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección: Contacto de Soporte */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contacto de Soporte</h2>

        {hasSupportContact ? (
          <div className="flex flex-wrap gap-4">
            {SUPPORT_WHATSAPP && (
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
              >
                <span className="text-xl">💬</span>
                <div>
                  <div className="font-medium text-green-900">WhatsApp</div>
                  <div className="text-sm text-green-700">Mensaje directo</div>
                </div>
              </a>
            )}
            {SUPPORT_EMAIL && (
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <span className="text-xl">✉️</span>
                <div>
                  <div className="font-medium text-blue-900">Email</div>
                  <div className="text-sm text-blue-700">{SUPPORT_EMAIL}</div>
                </div>
              </a>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm">
              Contacto de soporte no configurado.
            </p>
          </div>
        )}
      </div>

      {/* Sección: Accesos (owner-only) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accesos del Panel</h2>

        {!isOwner ? (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm">
              Solo el owner puede ver la lista de accesos.
            </p>
          </div>
        ) : accessLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : accessError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{accessError}</p>
            <button
              onClick={fetchAccess}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        ) : accessItems.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm">No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    Email
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    Rol
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    Creado
                  </th>
                </tr>
              </thead>
              <tbody>
                {accessItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3 text-gray-900">{item.email}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.role === "owner"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {item.role}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {new Date(item.created_at).toLocaleDateString("es-PY")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
