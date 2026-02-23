"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { usePanelContext } from "@/lib/panelContext";
import { NotAvailable } from "@/components/panel/NotAvailable";
import { getApiBase, getAuthHeaders } from "@/lib/api";

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
  | { type: "window_invalid"; code: string | null; message: string; validFrom: string | null; validTo: string | null; cutoffIso: string | null }
  | { type: "invalid_token"; message: string }
  | { type: "forbidden" }
  | { type: "error"; status: number; message: string; reason?: "timeout" | "network" | "server" | "unknown" };

type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "no_devices"
  | "permission_denied"
  | "error";

type OverlayTone = "success" | "warning" | "error";

interface OverlayState {
  tone: OverlayTone;
  title: string;
  message: string;
}

const TOKEN_DEDUPE_MS = 1400;
// Tuning operativo en puerta para evitar spam de lecturas consecutivas.
const GLOBAL_SCAN_COOLDOWN_MS = 1200;
const SAME_TOKEN_COOLDOWN_MS = 5000;
// Tuning operativo ZXing para lectura más estable en baja luz/movimiento moderado.
const ZXING_SUCCESS_DELAY_MS = 380;
const ZXING_SCAN_ATTEMPT_DELAY_MS = 110;
// Tuning operativo de red para puerta: timeout + retry acotado en errores transitorios.
const CHECKIN_REQUEST_TIMEOUT_MS = 5500;
const CHECKIN_RETRY_MAX = 1;
const CHECKIN_RETRY_BASE_MS = 450;

interface CheckinSessionStats {
  success: number;
  alreadyUsed: number;
  windowInvalid: number;
  invalidToken: number;
  forbidden: number;
  timeout: number;
  network: number;
  server: number;
  unknownError: number;
  retries: number;
}

const EMPTY_CHECKIN_STATS: CheckinSessionStats = {
  success: 0,
  alreadyUsed: 0,
  windowInvalid: 0,
  invalidToken: 0,
  forbidden: 0,
  timeout: 0,
  network: 0,
  server: 0,
  unknownError: 0,
  retries: 0,
};

interface CameraCapabilityState {
  torch: boolean;
  focusMode: boolean;
  zoom: boolean;
  exposure: boolean;
}

const EMPTY_CAMERA_CAPABILITIES: CameraCapabilityState = {
  torch: false,
  focusMode: false,
  zoom: false,
  exposure: false,
};

type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

function normalizeToken(rawToken: string): string {
  return rawToken.trim();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function getWindowMessage(code: string | null, fallback: string): string {
  if (code === "not_yet_valid") {
    return "Entrada todavía no válida para check-in.";
  }
  if (code === "expired") {
    return "Entrada expirada para check-in.";
  }
  if (code === "legacy_not_allowed") {
    return "Entrada fuera de la ventana válida de check-in.";
  }
  return fallback || "Entrada fuera de ventana de check-in.";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function CheckinPage() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();

  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const inFlightTokenRef = useRef<string | null>(null);
  const autoScanInFlightRef = useRef(false);
  const checkinRequestInFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const latestAppliedSequenceRef = useRef(0);
  const lastProcessedTokenRef = useRef<string | null>(null);
  const lastProcessedAtRef = useRef<number>(0);
  const globalScanCooldownUntilRef = useRef<number>(0);
  const lastCompletedAutoTokenRef = useRef<string | null>(null);
  const sameTokenCooldownUntilRef = useRef<number>(0);
  const sessionStatsRef = useRef<CheckinSessionStats>({ ...EMPTY_CHECKIN_STATS });

  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [isCheckinProcessing, setIsCheckinProcessing] = useState(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchLoading, setTorchLoading] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilityState>(EMPTY_CAMERA_CAPABILITIES);

  const isBlocked = context?.local.type === "bar";

  const clearOverlayTimeout = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
  }, []);

  const readCameraPermissionState = useCallback(async (): Promise<CameraPermissionState> => {
    if (!("permissions" in navigator) || !navigator.permissions?.query) {
      return "unknown";
    }

    try {
      const permission = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (permission.state === "granted" || permission.state === "denied" || permission.state === "prompt") {
        return permission.state;
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }, []);

  const resetCameraEnhancements = useCallback(() => {
    setTorchSupported(false);
    setTorchEnabled(false);
    setTorchLoading(false);
    setTorchError(null);
    setCameraCapabilities(EMPTY_CAMERA_CAPABILITIES);
  }, []);

  const detectCameraCapabilities = useCallback((controls: IScannerControls | null) => {
    let capabilities: Record<string, unknown> = {};
    try {
      if (controls?.streamVideoCapabilitiesGet) {
        const capabilitiesGetter = controls.streamVideoCapabilitiesGet as unknown as (
          trackFilter: (track: MediaStreamTrack) => boolean
        ) => MediaTrackCapabilities;
        const rawCapabilities =
          capabilitiesGetter((track) => track.kind === "video") ??
          ({} as MediaTrackCapabilities);
        capabilities = rawCapabilities as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("[checkin] unable to inspect camera capabilities via controls", error);
    }

    if (Object.keys(capabilities).length === 0 && videoRef.current?.srcObject) {
      try {
        const mediaStream = videoRef.current.srcObject as MediaStream;
        const track = mediaStream.getVideoTracks()[0];
        if (track && "getCapabilities" in track) {
          capabilities = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
        }
      } catch (error) {
        console.warn("[checkin] unable to inspect camera capabilities via media track", error);
      }
    }

    try {
      const torchCapability = capabilities.torch;
      const hasTorchCapability = torchCapability === true || (Array.isArray(torchCapability) && torchCapability.includes(true));
      const hasTorchControl = Boolean(controls?.switchTorch || controls?.streamVideoConstraintsApply);
      const hasTorch = hasTorchCapability && hasTorchControl;
      const hasFocusMode = Object.prototype.hasOwnProperty.call(capabilities, "focusMode");
      const hasZoom = Object.prototype.hasOwnProperty.call(capabilities, "zoom");
      const hasExposure =
        Object.prototype.hasOwnProperty.call(capabilities, "brightness") ||
        Object.prototype.hasOwnProperty.call(capabilities, "exposureCompensation") ||
        Object.prototype.hasOwnProperty.call(capabilities, "exposureTime");

      console.info("[checkin] camera capabilities", {
        torchCapability,
        hasTorchControl,
        hasTorch,
        hasFocusMode,
        hasZoom,
        hasExposure,
      });

      setTorchSupported(hasTorch);
      setTorchEnabled(false);
      setTorchError(null);
      setCameraCapabilities({
        torch: hasTorch,
        focusMode: hasFocusMode,
        zoom: hasZoom,
        exposure: hasExposure,
      });
    } catch (error) {
      console.warn("[checkin] unable to inspect camera capabilities", error);
      resetCameraEnhancements();
    }
  }, [resetCameraEnhancements]);

  const toggleTorch = useCallback(async () => {
    const controls = scannerControlsRef.current;
    if (!controls?.switchTorch || !torchSupported) return;

    setTorchLoading(true);
    setTorchError(null);
    const nextTorchState = !torchEnabled;

    try {
      if (controls.switchTorch) {
        await controls.switchTorch(nextTorchState);
      } else if (controls.streamVideoConstraintsApply) {
        const torchConstraints = {
          advanced: [{ torch: nextTorchState }],
        } as unknown as MediaTrackConstraints;
        const maybePromise = (
          controls.streamVideoConstraintsApply as unknown as (
            constraints: MediaTrackConstraints,
            trackFilter?: (track: MediaStreamTrack) => boolean
          ) => Promise<void> | void
        )(torchConstraints, (track) => track.kind === "video");
        if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
          await maybePromise;
        }
      } else {
        throw new Error("Torch controls unavailable");
      }
      setTorchEnabled(nextTorchState);
    } catch (error) {
      console.error("[checkin] torch toggle failed", error);
      setTorchError("No se pudo cambiar la linterna en este dispositivo.");
    } finally {
      setTorchLoading(false);
    }
  }, [torchEnabled, torchSupported]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    autoScanInFlightRef.current = false;
    inFlightTokenRef.current = null;

    if (scannerControlsRef.current) {
      try {
        scannerControlsRef.current.stop();
      } catch {
        // noop
      }
      scannerControlsRef.current = null;
    }

    if (readerRef.current) {
      try {
        const maybeReset = (readerRef.current as unknown as { reset?: () => void }).reset;
        if (typeof maybeReset === "function") {
          maybeReset();
        }
      } catch {
        // noop
      }
      readerRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      mediaStream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setCameraStatus("idle");
    resetCameraEnhancements();
  }, [resetCameraEnhancements]);

  useEffect(() => {
    if (contextLoading || isBlocked) return;

    return () => {
      stopCamera();
      clearOverlayTimeout();
    };
  }, [clearOverlayTimeout, contextLoading, isBlocked, stopCamera]);

  useEffect(() => {
    if (isBlocked) {
      stopCamera();
    }
  }, [isBlocked, stopCamera]);

  const showOverlay = useCallback(
    (next: OverlayState, durationMs: number) => {
      clearOverlayTimeout();
      setOverlay(next);
      overlayTimeoutRef.current = setTimeout(() => {
        setOverlay(null);
        overlayTimeoutRef.current = null;
      }, durationMs);
    },
    [clearOverlayTimeout]
  );

  const updateSessionStats = useCallback((nextResult: CheckinResult) => {
    const stats = sessionStatsRef.current;
    switch (nextResult.type) {
      case "success":
        stats.success += 1;
        break;
      case "already_used":
        stats.alreadyUsed += 1;
        break;
      case "window_invalid":
        stats.windowInvalid += 1;
        break;
      case "invalid_token":
        stats.invalidToken += 1;
        break;
      case "forbidden":
        stats.forbidden += 1;
        break;
      case "error":
        if (nextResult.reason === "timeout") {
          stats.timeout += 1;
        } else if (nextResult.reason === "network") {
          stats.network += 1;
        } else if (nextResult.reason === "server") {
          stats.server += 1;
        } else {
          stats.unknownError += 1;
        }
        break;
      default:
        break;
    }

    console.info("[checkin][stats]", {
      ...stats,
      lastResultType: nextResult.type,
    });
  }, []);

  const pushResultFeedback = useCallback(
    (nextResult: CheckinResult) => {
      if (nextResult.type === "success") {
        showOverlay(
          {
            tone: "success",
            title: "Check-in realizado",
            message: "Entrada válida",
          },
          900
        );
        return;
      }

      if (nextResult.type === "already_used") {
        showOverlay(
          {
            tone: "warning",
            title: "Entrada ya utilizada",
            message: `Usada: ${formatDateTime(nextResult.usedAt)}`,
          },
          1200
        );
        return;
      }

      if (nextResult.type === "window_invalid") {
        showOverlay(
          {
            tone: "warning",
            title: "Check-in no disponible",
            message: nextResult.message,
          },
          1400
        );
        return;
      }

      if (nextResult.type === "invalid_token") {
        showOverlay(
          {
            tone: "error",
            title: "QR inválido",
            message: nextResult.message,
          },
          1200
        );
        return;
      }

      if (nextResult.type === "forbidden") {
        showOverlay(
          {
            tone: "error",
            title: "Token de otro local",
            message: "Este QR pertenece a otro establecimiento.",
          },
          1300
        );
        return;
      }

      showOverlay(
        {
          tone: "error",
          title: "Error de check-in",
          message: nextResult.message,
        },
        1500
      );
    },
    [showOverlay]
  );

  const applyCheckinResult = useCallback(
    (requestSequence: number, nextResult: CheckinResult, source: "manual" | "auto") => {
      if (requestSequence < latestAppliedSequenceRef.current) {
        console.info("[checkin] discarded stale response", {
          requestSequence,
          latestAppliedSequence: latestAppliedSequenceRef.current,
          source,
          resultType: nextResult.type,
        });
        return;
      }

      latestAppliedSequenceRef.current = requestSequence;
      setResult(nextResult);
      pushResultFeedback(nextResult);
      updateSessionStats(nextResult);
    },
    [pushResultFeedback, updateSessionStats]
  );

  const performCheckin = useCallback(
    async (rawToken: string, source: "manual" | "auto") => {
      const normalizedToken = normalizeToken(rawToken);
      if (!normalizedToken || isBlocked) return;

      if (checkinRequestInFlightRef.current) {
        console.info("[checkin] request ignored because another check-in is in flight", {
          source,
          token: normalizedToken,
        });
        return;
      }

      checkinRequestInFlightRef.current = true;
      setIsCheckinProcessing(true);

      if (source === "manual") {
        setLoading(true);
      }

      const requestSequence = ++requestSequenceRef.current;
      const maxAttempts = CHECKIN_RETRY_MAX + 1;

      try {
        const headers = await getAuthHeaders();

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CHECKIN_REQUEST_TIMEOUT_MS);

          try {
            const response = await fetch(`${getApiBase()}/panel/checkin/${encodeURIComponent(normalizedToken)}`, {
              method: "PATCH",
              credentials: "include",
              headers,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const payload = await response.json().catch(() => ({} as Record<string, unknown>));
            const errorText = typeof payload.error === "string" ? payload.error : "";

            if (response.status >= 500 && attempt < maxAttempts) {
              sessionStatsRef.current.retries += 1;
              console.warn("[checkin] transient server error, retrying", {
                source,
                token: normalizedToken,
                status: response.status,
                attempt,
                maxAttempts,
              });
              await wait(CHECKIN_RETRY_BASE_MS * attempt);
              continue;
            }

            let nextResult: CheckinResult;
            if (response.ok) {
              nextResult = { type: "success", data: payload as CheckinSuccess };
            } else if (response.status === 409) {
              const code = typeof payload.code === "string" ? payload.code : null;
              const usedAt = typeof payload.usedAt === "string" ? payload.usedAt : null;

              if (usedAt || errorText.toLowerCase().includes("already used")) {
                nextResult = {
                  type: "already_used",
                  usedAt: usedAt ?? "",
                };
              } else {
                const validFrom = typeof payload.valid_from === "string" ? payload.valid_from : null;
                const validTo = typeof payload.valid_to === "string" ? payload.valid_to : null;
                const cutoffIso = typeof payload.cutoff_iso === "string" ? payload.cutoff_iso : null;
                nextResult = {
                  type: "window_invalid",
                  code,
                  message: getWindowMessage(code, errorText),
                  validFrom,
                  validTo,
                  cutoffIso,
                };
              }
            } else if (response.status === 404) {
              nextResult = {
                type: "invalid_token",
                message: "No se encontró una entrada válida para ese QR.",
              };
            } else if (response.status === 403) {
              nextResult = { type: "forbidden" };
            } else if (response.status >= 500) {
              nextResult = {
                type: "error",
                status: response.status,
                reason: "server",
                message:
                  errorText || `Error temporal del servidor (${response.status}). Reintentá en unos segundos.`,
              };
            } else {
              nextResult = {
                type: "error",
                status: response.status,
                reason: "unknown",
                message: errorText || `Error ${response.status}`,
              };
            }

            console.info("[checkin] request settled", {
              source,
              token: normalizedToken,
              attempt,
              status: response.status,
              resultType: nextResult.type,
            });
            applyCheckinResult(requestSequence, nextResult, source);
            return;
          } catch (error) {
            clearTimeout(timeoutId);

            const castedError = error as Error;
            const isTimeout = castedError.name === "AbortError";
            const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
            const isNetworkError =
              isOffline ||
              castedError instanceof TypeError ||
              /network|fetch|connection|internet/i.test(castedError.message ?? "");
            const canRetry = attempt < maxAttempts && (isTimeout || isNetworkError);

            if (canRetry) {
              sessionStatsRef.current.retries += 1;
              console.warn("[checkin] transient network/timeout error, retrying", {
                source,
                token: normalizedToken,
                attempt,
                maxAttempts,
                errorName: castedError.name,
                message: castedError.message,
              });
              await wait(CHECKIN_RETRY_BASE_MS * attempt);
              continue;
            }

            const nextResult: CheckinResult = isTimeout
              ? {
                  type: "error",
                  status: 0,
                  reason: "timeout",
                  message: "Tiempo de espera agotado. Reintentá el check-in.",
                }
              : isNetworkError
                ? {
                    type: "error",
                    status: 0,
                    reason: "network",
                    message: isOffline
                      ? "Sin conexión. Verificá internet y reintentá."
                      : "Error de red. Reintentá el check-in.",
                  }
                : {
                    type: "error",
                    status: 0,
                    reason: "unknown",
                    message: castedError.message || "Error de conexión",
                  };

            console.error("[checkin] request failed", {
              source,
              token: normalizedToken,
              attempt,
              errorName: castedError.name,
              message: castedError.message,
              reason: nextResult.reason,
            });
            applyCheckinResult(requestSequence, nextResult, source);
            return;
          }
        }
      } catch (err) {
        const nextResult: CheckinResult = {
          type: "error",
          status: 0,
          reason: "unknown",
          message: err instanceof Error ? err.message : "Error de conexión",
        };
        console.error("[checkin] setup failure before request", {
          source,
          token: normalizedToken,
          message: err instanceof Error ? err.message : "unknown error",
        });
        applyCheckinResult(requestSequence, nextResult, source);
      } finally {
        checkinRequestInFlightRef.current = false;
        setIsCheckinProcessing(false);
        if (source === "manual") {
          setLoading(false);
        }
      }
    },
    [applyCheckinResult, isBlocked]
  );

  const handleScannedToken = useCallback(
    (rawToken: string) => {
      const normalizedToken = normalizeToken(rawToken);
      if (!normalizedToken) return;

      const now = Date.now();
      if (now < globalScanCooldownUntilRef.current) return;
      if (checkinRequestInFlightRef.current) return;
      if (autoScanInFlightRef.current || inFlightTokenRef.current) return;
      if (
        lastCompletedAutoTokenRef.current === normalizedToken &&
        now < sameTokenCooldownUntilRef.current
      ) {
        return;
      }
      if (
        lastProcessedTokenRef.current === normalizedToken &&
        now - lastProcessedAtRef.current < TOKEN_DEDUPE_MS
      ) {
        return;
      }

      setToken(normalizedToken);

      autoScanInFlightRef.current = true;
      inFlightTokenRef.current = normalizedToken;
      lastProcessedTokenRef.current = normalizedToken;
      lastProcessedAtRef.current = now;

      void performCheckin(normalizedToken, "auto").finally(() => {
        autoScanInFlightRef.current = false;
        if (inFlightTokenRef.current === normalizedToken) {
          inFlightTokenRef.current = null;
        }
        const completedAt = Date.now();
        globalScanCooldownUntilRef.current = completedAt + GLOBAL_SCAN_COOLDOWN_MS;
        lastCompletedAutoTokenRef.current = normalizedToken;
        sameTokenCooldownUntilRef.current = completedAt + SAME_TOKEN_COOLDOWN_MS;
      });
    },
    [performCheckin]
  );

  const waitForVideoElement = useCallback(async (): Promise<HTMLVideoElement> => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (videoRef.current) {
        return videoRef.current;
      }
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }

    throw new Error("Video preview element not ready");
  }, []);

  const startCamera = useCallback(async () => {
    if (isBlocked || scanningRef.current || scannerControlsRef.current) return;

    setCameraError(null);
    setTorchError(null);
    const permissionState = await readCameraPermissionState();
    if (permissionState === "denied") {
      setCameraStatus("permission_denied");
      setCameraError("Permiso de cámara bloqueado. Habilitalo en la configuración del sitio y reintentá.");
      return;
    }
    setCameraStatus("requesting");

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      if (videoDevices.length === 0) {
        setCameraStatus("no_devices");
        setCameraError("No se detectaron cámaras en este dispositivo.");
        return;
      }

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const readerHints = new Map<DecodeHintType, unknown>();
      readerHints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      readerHints.set(DecodeHintType.TRY_HARDER, true);
      const codeReader = new BrowserQRCodeReader(readerHints, {
        delayBetweenScanSuccess: ZXING_SUCCESS_DELAY_MS,
        delayBetweenScanAttempts: ZXING_SCAN_ATTEMPT_DELAY_MS,
      });
      readerRef.current = codeReader;
      scanningRef.current = true;
      const videoElement = await waitForVideoElement();

      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoElement,
        (scanResult, scanError) => {
          if (!scanningRef.current) return;

          if (scanResult) {
            handleScannedToken(scanResult.getText());
            return;
          }

          if (scanError) {
            const scanErrorName = (scanError as { name?: string }).name;
            if (
              scanErrorName === "NotFoundException" ||
              scanErrorName === "ChecksumException" ||
              scanErrorName === "FormatException"
            ) {
              return;
            }
          }
        }
      );

      scannerControlsRef.current = controls;
      detectCameraCapabilities(controls);
      setCameraStatus("active");
    } catch (err) {
      scanningRef.current = false;
      scannerControlsRef.current = null;
      readerRef.current = null;
      resetCameraEnhancements();

      const error = err as Error;
      console.error("[checkin] camera/scanner startup failed", err);
      if (error.name === "NotAllowedError") {
        setCameraStatus("permission_denied");
        setCameraError("Permiso de cámara denegado. Usa el input manual.");
      } else {
        setCameraStatus("error");
        const detail = error.message ? ` (${error.message})` : "";
        setCameraError(`No se pudo acceder a la cámara. Usa el input manual para pegar el token.${detail}`);
      }
    }
  }, [detectCameraCapabilities, handleScannedToken, isBlocked, readCameraPermissionState, resetCameraEnhancements, waitForVideoElement]);

  const handleCheckin = async () => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken || isBlocked) return;
    await performCheckin(normalizedToken, "manual");
  };

  const handleReset = () => {
    stopCamera();
    clearOverlayTimeout();
    setOverlay(null);
    setToken("");
    setResult(null);
    setCameraError(null);
    autoScanInFlightRef.current = false;
    inFlightTokenRef.current = null;
    lastProcessedTokenRef.current = null;
    lastProcessedAtRef.current = 0;
    globalScanCooldownUntilRef.current = 0;
    lastCompletedAutoTokenRef.current = null;
    sameTokenCooldownUntilRef.current = 0;
  };

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (contextError || !context) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">{contextError || "Error al cargar información del panel"}</p>
        </div>
      </div>
    );
  }

  if (context.local.type === "bar") {
    return (
      <NotAvailable
        localType="bar"
        feature="Check-in en Puerta"
        message="Los bares gestionan reservas en lugar de entradas con check-in."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Check-in en Puerta</h2>
      </div>

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
        {isCheckinProcessing && (
          <p className="text-xs text-blue-600 mb-2">Procesando check-in...</p>
        )}

        {cameraStatus === "requesting" || cameraStatus === "active" ? (
          <div className="space-y-4">
            <div className="relative max-w-md mx-auto">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-[4/3] sm:aspect-video object-cover bg-black rounded-lg border-2 border-blue-500"
              />

              {cameraStatus === "requesting" ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/60 rounded-lg">
                  <p className="text-sm font-medium text-white">Solicitando acceso a la cámara...</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[62%] h-[62%] min-w-[132px] min-h-[132px] max-w-[216px] max-h-[216px] border-[3px] sm:border-4 border-blue-500 rounded-xl animate-pulse" />
                </div>
              )}

              {overlay && (
                <div
                  className={[
                    "absolute left-3 right-3 top-3 rounded-md border px-3 py-2 shadow-sm",
                    overlay.tone === "success" && "border-green-300 bg-green-50",
                    overlay.tone === "warning" && "border-amber-300 bg-amber-50",
                    overlay.tone === "error" && "border-red-300 bg-red-50",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <p
                    className={[
                      "text-sm font-semibold",
                      overlay.tone === "success" && "text-green-800",
                      overlay.tone === "warning" && "text-amber-800",
                      overlay.tone === "error" && "text-red-800",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {overlay.title}
                  </p>
                  <p
                    className={[
                      "text-xs mt-0.5",
                      overlay.tone === "success" && "text-green-700",
                      overlay.tone === "warning" && "text-amber-700",
                      overlay.tone === "error" && "text-red-700",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {overlay.message}
                  </p>
                </div>
              )}
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              <p className="text-xs text-gray-600">Centrá el QR dentro del recuadro y mantenelo estable un instante.</p>
              {cameraStatus === "active" &&
                (torchSupported ? (
                  <p className="text-xs text-gray-600">
                    Baja luz detectada: podés activar la linterna para mejorar la lectura.
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">
                    Si hay poca luz, subí el brillo del QR en el celular o acercá la pantalla.
                  </p>
                ))}
              {cameraStatus === "active" &&
                (cameraCapabilities.focusMode || cameraCapabilities.zoom || cameraCapabilities.exposure) && (
                  <p className="text-[11px] text-gray-500">
                    Cámara compatible con ajuste
                    {cameraCapabilities.focusMode ? " de enfoque" : ""}
                    {cameraCapabilities.focusMode && cameraCapabilities.zoom ? " y" : ""}
                    {cameraCapabilities.zoom ? " de zoom" : ""}
                    {(cameraCapabilities.focusMode || cameraCapabilities.zoom) && cameraCapabilities.exposure
                      ? " y"
                      : ""}
                    {cameraCapabilities.exposure ? " de exposición" : ""}.
                  </p>
                )}
            </div>

            {cameraStatus === "active" && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    disabled={torchLoading}
                    className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {torchLoading ? "Aplicando..." : torchEnabled ? "🔦 Apagar Linterna" : "🔦 Activar Linterna"}
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Detener Cámara
                </button>
              </div>
            )}

            {cameraStatus === "active" && torchError && (
              <div className="max-w-md mx-auto p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-xs text-amber-800">{torchError}</p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {cameraStatus === "permission_denied" ? "🔁 Reintentar Cámara" : "📷 Activar Cámara"}
          </button>
        )}

        {cameraError && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">{cameraError}</p>
            {cameraStatus === "permission_denied" && (
              <p className="text-xs text-yellow-700 mt-1">
                Android/Chrome: tocá el candado en la barra del navegador y habilitá el acceso a Cámara.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Token Manual</h3>
        <p className="text-sm text-gray-500 mb-4">Pega el token del QR si la cámara no funciona:</p>

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
              disabled={loading || isCheckinProcessing || !token.trim()}
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

      {result && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Resultado</h3>

          {result.type === "success" && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <span className="text-lg font-semibold text-green-800">Check-in Exitoso</span>
              </div>
              <div className="space-y-1 text-sm text-green-900">
                <p>
                  <strong>Usado:</strong> {formatDateTime(result.data.used_at)}
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
                <span className="text-lg font-semibold text-yellow-800">Ya Usado</span>
              </div>
              <p className="text-sm text-yellow-900">
                Este ticket ya fue utilizado el <strong>{formatDateTime(result.usedAt)}</strong>
              </p>
            </div>
          )}

          {result.type === "window_invalid" && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🕒</span>
                <span className="text-lg font-semibold text-amber-800">Fuera de ventana</span>
              </div>
              <div className="space-y-1 text-sm text-amber-900">
                <p>{result.message}</p>
                {result.validFrom && (
                  <p>
                    <strong>Desde:</strong> {formatDateTime(result.validFrom)}
                  </p>
                )}
                {result.validTo && (
                  <p>
                    <strong>Hasta:</strong> {formatDateTime(result.validTo)}
                  </p>
                )}
              </div>
            </div>
          )}

          {result.type === "invalid_token" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">❌</span>
                <span className="text-lg font-semibold text-red-800">QR inválido</span>
              </div>
              <p className="text-sm text-red-900">{result.message}</p>
            </div>
          )}

          {result.type === "forbidden" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🚫</span>
                <span className="text-lg font-semibold text-red-800">Token de Otro Local</span>
              </div>
              <p className="text-sm text-red-900">Este token pertenece a otro establecimiento.</p>
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
