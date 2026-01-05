"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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

interface CheckinForbidden {
  error: "Forbidden: This order belongs to another local";
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
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const readerRef = useRef<import("@zxing/browser").BrowserQRCodeReader | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/panel/login");
          return;
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error checking session:", err);
        router.push("/panel/login");
      }
    };

    checkSession();
  }, [router]);

  // Limpiar cámara al desmontar
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Conectar stream al video cuando esté disponible
  useEffect(() => {
    if (cameraStatus === "active" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        // Ignorar errores de autoplay
      });
      startScanning();
    }
  }, [cameraStatus]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraStatus("requesting");

    try {
      // Verificar si hay dispositivos de video
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

      // Setear active DESPUÉS de tener el stream - el useEffect lo conectará al video
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
  }, []);

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
    if (!videoRef.current) return;

    scanningRef.current = true;

    // Importar ZXing dinámicamente
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

    // Esperar un poco a que el video tenga frames
    setTimeout(scanLoop, 500);
  }, [stopCamera]);

  const handleCheckin = async () => {
    if (!token.trim()) {
      return;
    }

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

  // Mostrar loading mientras se verifica la sesión
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold">Check-in en Puerta</h2>
          <Link
            href="/panel"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
          >
            ← Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Scanner de QR */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Escanear QR</h3>

        {/* Estado de la cámara (diagnóstico) */}
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
