"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelContext } from "@/lib/panelContext";
import { NotAvailable } from "@/components/panel/NotAvailable";
import { getApiBase, getAuthHeaders } from "@/lib/api";

// Tipos para la respuesta del endpoint
interface CheckinSuccess {
  id: string;
  local_id: string;
  status: string;
  used_at: string;
  customer_name?: string;
  customer_last_name?: string;
  customer_document?: string;
}

interface CheckinAlreadyUsed {
  error: "Order already used";
  usedAt: string;
}

type CheckinResult =
  | { type: "success"; data: CheckinSuccess }
  | { type: "already_used"; usedAt: string }
  | { type: "forbidden" }
  | { type: "error"; status: number; message: string };

type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "no_devices"
  | "permission_denied"
  | "error";

export default function CheckinPage() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const readerRef = useRef<import("@zxing/browser").BrowserQRCodeReader | null>(null);

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ==================================================
  // GATING TEMPRANO: Determinar si página está bloqueada
  // ==================================================
  const isBlocked = context?.local.type === "bar";

  // Limpiar cámara al desmontar
  useEffect(() => {
    // GUARD: No ejecutar si contexto aún cargando o bloqueado
    if (contextLoading || isBlocked) return;

    return () => {
      scanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [contextLoading, isBlocked]);

  // Conectar stream al video cuando esté disponible
  useEffect(() => {
    // GUARD: No ejecutar si contexto aún cargando o bloqueado
    if (contextLoading || isBlocked) return;

    if (cameraStatus === "active" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        // Ignorar errores de autoplay
      });
      startScanning();
    }
  }, [cameraStatus, contextLoading, isBlocked]);

  const startCamera = useCallback(async () => {
    // GUARD extra (aunque no debería llegar aquí si está bloqueado)
    if (isBlocked) return;

    setCameraError(null);
    setCameraStatus("requesting");

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      if (videoDevices.length === 0) {
        setCameraStatus("no_devices");
        setCameraError("No se detectaron cámaras en este dispositivo.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setCameraStatus("active");
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        setCameraStatus("permission_denied");
        setCameraError("Permiso de cámara denegado. Usa el input manual.");
      } else {
        setCameraStatus("error");
        setCameraError(
          "No se pudo acceder a la cámara. Usa el input manual para pegar el token."
        );
      }
    }
  }, [isBlocked]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    readerRef.current = null;
    setCameraStatus("idle");
  }, []);

  const startScanning = useCallback(async () => {
    if (!videoRef.current || isBlocked) return;

    scanningRef.current = true;

    const { BrowserQRCodeReader } = await import("@zxing/browser");
    const codeReader = new BrowserQRCodeReader();
    readerRef.current = codeReader;

    const scanLoop = async () => {
      if (!videoRef.current || !scanningRef.current) return;

      try {
        const result = await codeReader.decodeOnceFromVideoElement(
          videoRef.current
        );
        if (result && scanningRef.current) {
          const scannedText = result.getText();
          setToken(scannedText);
          stopCamera();
          return;
        }
      } catch {
        // No QR found, continue scanning
      }

      if (scanningRef.current) {
        setTimeout(scanLoop, 300);
      }
    };

    setTimeout(scanLoop, 500);
  }, [stopCamera, isBlocked]);

  const handleCheckin = async () => {
    if (!token.trim() || isBlocked) return;

    setLoading(true);
    setResult(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${getApiBase()}/panel/checkin/${encodeURIComponent(token.trim())}`,
        {
          method: "PATCH",
          credentials: "include",
          headers,
        }
      );

      if (response.ok) {
        const data: CheckinSuccess = await response.json();
        setResult({ type: "success", data });
      } else if (response.status === 409) {
        const data: CheckinAlreadyUsed = await response.json();
        setResult({ type: "already_used", usedAt: data.usedAt });
      } else if (response.status === 403) {
        setResult({ type: "forbidden" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setResult({
          type: "error",
          status: response.status,
          message: errorData.error || `Error ${response.status}`,
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        status: 0,
        message: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    stopCamera();
    setToken("");
    setResult(null);
    setCameraError(null);
  };

  // ==================================================
  // RENDERS TEMPRANOS (antes de cualquier UI compleja)
  // ==================================================

  // GATING 1: Loading del contexto
  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // GATING 2: Error en contexto
  if (contextError || !context) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">{contextError || "Error al cargar información del panel"}</p>
        </div>
      </div>
    );
  }

  // GATING 3: Tipo de local bloqueado (ANTES de cualquier render complejo)
  if (context.local.type === "bar") {
    return (
      <NotAvailable
        localType="bar"
        feature="Check-in en Puerta"
        message="Los bares gestionan reservas en lugar de entradas con check-in."
      />
    );
  }

  // ==================================================
  // RENDER PRINCIPAL (solo para clubs)
  // ==================================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Check-in en Puerta</h2>
      </div>

      {/* Scanner de QR */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Escanear QR</h3>

        <p className="text-xs text-gray-500 mb-2">
          Cámara:{" "}
          {cameraStatus === "idle" && "lista"}
          {cameraStatus === "requesting" && "solicitando permiso..."}
          {cameraStatus === "active" && "activa ✓"}
          {cameraStatus === "no_devices" && "sin dispositivos"}
          {cameraStatus === "permission_denied" && "permiso denegado"}
          {cameraStatus === "error" && "error"}
        </p>

        {cameraStatus === "requesting" ? (
          <p className="text-sm text-gray-600">Solicitando acceso a la cámara...</p>
        ) : cameraStatus === "active" ? (
          <div className="space-y-4">
            <div className="relative max-w-md mx-auto">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video bg-black rounded-lg border-2 border-blue-500"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-blue-500 rounded-lg animate-pulse" />
              </div>
            </div>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Detener Cámara
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            📷 Activar Cámara
          </button>
        )}

        {cameraError && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Input Manual */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Token Manual</h3>
        <p className="text-sm text-gray-500 mb-4">
          Pega el token del QR si la cámara no funciona:
        </p>

        <div className="space-y-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Pega el token aquí (UUID)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex gap-2">
            <button
              onClick={handleCheckin}
              disabled={loading || !token.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "✓ Check-in"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Resultado</h3>

          {result.type === "success" && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <span className="text-lg font-semibold text-green-800">
                  Check-in Exitoso
                </span>
              </div>
              <div className="space-y-1 text-sm text-green-900">
                <p>
                  <strong>Usado:</strong>{" "}
                  {new Date(result.data.used_at).toLocaleString()}
                </p>
                {result.data.customer_name && (
                  <p>
                    <strong>Nombre:</strong> {result.data.customer_name}
                  </p>
                )}
                {result.data.customer_last_name && (
                  <p>
                    <strong>Apellido:</strong> {result.data.customer_last_name}
                  </p>
                )}
                {result.data.customer_document && (
                  <p>
                    <strong>Documento:</strong> {result.data.customer_document}
                  </p>
                )}
              </div>
            </div>
          )}

          {result.type === "already_used" && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚠️</span>
                <span className="text-lg font-semibold text-yellow-800">
                  Ya Usado
                </span>
              </div>
              <p className="text-sm text-yellow-900">
                Este ticket ya fue utilizado el{" "}
                <strong>{new Date(result.usedAt).toLocaleString()}</strong>
              </p>
            </div>
          )}

          {result.type === "forbidden" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🚫</span>
                <span className="text-lg font-semibold text-red-800">
                  Token de Otro Local
                </span>
              </div>
              <p className="text-sm text-red-900">
                Este token pertenece a otro establecimiento.
              </p>
            </div>
          )}

          {result.type === "error" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">❌</span>
                <span className="text-lg font-semibold text-red-800">Error</span>
              </div>
              <p className="text-sm text-red-900">
                {result.message}
                {result.status > 0 && ` (Status: ${result.status})`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
