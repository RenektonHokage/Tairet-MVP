"use client";

import type { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkInEventEntryByToken,
  parseEventCheckinToken,
  type EventCheckinResponse,
} from "@/lib/eventCheckin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  panelUi,
} from "./ui";

type ScannerStatus =
  | "idle"
  | "requesting_permission"
  | "scanning"
  | "processing"
  | "paused_after_result"
  | "permission_denied"
  | "no_camera"
  | "scanner_error";

interface EventCheckinScannerProps {
  disabled?: boolean;
  eventId: string;
  onProcessingChange?: (isProcessing: boolean) => void;
  onResult: (result: EventCheckinResponse) => void;
}

const ZXING_SUCCESS_DELAY_MS = 700;
const ZXING_SCAN_ATTEMPT_DELAY_MS = 250;
const INVALID_QR_COOLDOWN_MS = 1200;
const SAME_TOKEN_COOLDOWN_MS = 2500;

function getScannerStatusLabel(status: ScannerStatus): string {
  switch (status) {
    case "idle":
      return "Cámara apagada.";
    case "requesting_permission":
      return "Solicitando permiso de cámara...";
    case "scanning":
      return "Cámara activa. Apuntá al QR de la entrada.";
    case "processing":
      return "Procesando validación...";
    case "paused_after_result":
      return "Scanner pausado. Revisá el resultado antes de escanear otro QR.";
    case "permission_denied":
      return "No se pudo acceder a la cámara. Podés usar el input manual o el fallback.";
    case "no_camera":
      return "No se detectó cámara disponible. Usá el input manual o el fallback.";
    case "scanner_error":
      return "No se pudo iniciar el scanner.";
  }
}

export function EventCheckinScanner({
  disabled = false,
  eventId,
  onProcessingChange,
  onResult,
}: EventCheckinScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanningEnabledRef = useRef(false);
  const isProcessingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const isMountedRef = useRef(true);
  const invalidQrCooldownUntilRef = useRef(0);
  const lastProcessedTokenRef = useRef<string | null>(null);
  const lastProcessedAtRef = useRef(0);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearNoticeTimeout = useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);

  const clearTransientRefs = useCallback(() => {
    scanningEnabledRef.current = false;
    isProcessingRef.current = false;
    invalidQrCooldownUntilRef.current = 0;
    lastProcessedTokenRef.current = null;
    lastProcessedAtRef.current = 0;
  }, []);

  const cleanupCamera = useCallback(
    (nextStatus?: ScannerStatus) => {
      scanningEnabledRef.current = false;
      isProcessingRef.current = false;
      onProcessingChange?.(false);

      if (scannerControlsRef.current) {
        try {
          scannerControlsRef.current.stop();
        } catch {
          // Scanner cleanup must be best-effort.
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
          // Scanner cleanup must be best-effort.
        }
        readerRef.current = null;
      }

      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      clearNoticeTimeout();
      clearTransientRefs();

      if (nextStatus && isMountedRef.current) {
        setScannerStatus(nextStatus);
      }
    },
    [clearNoticeTimeout, clearTransientRefs, onProcessingChange]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupCamera();
    };
  }, [cleanupCamera]);

  const showScannerMessage = useCallback(
    (message: string, durationMs?: number) => {
      clearNoticeTimeout();
      setScannerMessage(message);

      if (durationMs) {
        noticeTimeoutRef.current = setTimeout(() => {
          setScannerMessage(null);
          noticeTimeoutRef.current = null;
        }, durationMs);
      }
    },
    [clearNoticeTimeout]
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

    throw new Error("video_not_ready");
  }, []);

  const handleDecodedText = useCallback(
    async (decodedText: string) => {
      if (!scanningEnabledRef.current || isProcessingRef.current || disabledRef.current) {
        return;
      }

      const now = Date.now();
      if (now < invalidQrCooldownUntilRef.current) {
        return;
      }

      const parsedToken = parseEventCheckinToken(decodedText);
      if (!parsedToken.ok) {
        invalidQrCooldownUntilRef.current = now + INVALID_QR_COOLDOWN_MS;
        showScannerMessage("QR inválido.", INVALID_QR_COOLDOWN_MS);
        return;
      }

      if (
        lastProcessedTokenRef.current === parsedToken.token &&
        now - lastProcessedAtRef.current < SAME_TOKEN_COOLDOWN_MS
      ) {
        return;
      }

      scanningEnabledRef.current = false;
      isProcessingRef.current = true;
      lastProcessedTokenRef.current = parsedToken.token;
      lastProcessedAtRef.current = now;
      setScannerStatus("processing");
      setScannerMessage(null);
      onProcessingChange?.(true);

      try {
        const response = await checkInEventEntryByToken({
          eventId,
          token: parsedToken.token,
        });

        onResult(response);
        setScannerStatus("paused_after_result");
      } catch {
        showScannerMessage("No se pudo validar la entrada.");
        setScannerStatus("paused_after_result");
      } finally {
        isProcessingRef.current = false;
        onProcessingChange?.(false);
      }
    },
    [eventId, onProcessingChange, onResult, showScannerMessage]
  );

  const startCamera = useCallback(async () => {
    if (
      disabled ||
      isProcessingRef.current ||
      scannerStatus === "requesting_permission" ||
      scannerStatus === "scanning" ||
      scannerStatus === "processing"
    ) {
      return;
    }

    if (!navigator.mediaDevices?.enumerateDevices) {
      setScannerStatus("no_camera");
      setScannerMessage("No se detectó cámara disponible. Usá el input manual o el fallback.");
      return;
    }

    cleanupCamera();
    setScannerStatus("requesting_permission");
    setScannerMessage(null);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some((device) => device.kind === "videoinput");
      if (!hasVideoInput) {
        setScannerStatus("no_camera");
        setScannerMessage("No se detectó cámara disponible. Usá el input manual o el fallback.");
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

      const videoElement = await waitForVideoElement();
      scanningEnabledRef.current = true;

      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoElement,
        (scanResult, scanError) => {
          if (!scanningEnabledRef.current || isProcessingRef.current) {
            return;
          }

          if (scanResult) {
            void handleDecodedText(scanResult.getText());
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
      setScannerStatus("scanning");
    } catch (error) {
      cleanupCamera();
      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        setScannerStatus("permission_denied");
        setScannerMessage("No se pudo acceder a la cámara. Podés usar el input manual o el fallback.");
        return;
      }

      setScannerStatus("scanner_error");
      setScannerMessage("No se pudo iniciar el scanner.");
    }
  }, [cleanupCamera, disabled, handleDecodedText, scannerStatus, waitForVideoElement]);

  const handleScanAnother = useCallback(() => {
    if (disabled || isProcessingRef.current || !scannerControlsRef.current) {
      return;
    }

    lastProcessedTokenRef.current = null;
    lastProcessedAtRef.current = 0;
    invalidQrCooldownUntilRef.current = 0;
    scanningEnabledRef.current = true;
    setScannerMessage(null);
    setScannerStatus("scanning");
  }, [disabled]);

  const handleStopCamera = useCallback(() => {
    setScannerMessage(null);
    cleanupCamera("idle");
  }, [cleanupCamera]);

  const canStartCamera =
    !disabled &&
    (scannerStatus === "idle" ||
      scannerStatus === "permission_denied" ||
      scannerStatus === "no_camera" ||
      scannerStatus === "scanner_error");
  const canStopCamera =
    scannerStatus === "requesting_permission" ||
    scannerStatus === "scanning" ||
    scannerStatus === "processing" ||
    scannerStatus === "paused_after_result";
  const canScanAnother =
    !disabled && scannerStatus === "paused_after_result" && Boolean(scannerControlsRef.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escanear QR</CardTitle>
        <CardDescription>Activá la cámara para validar entradas por QR.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-950 p-2">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video
              aria-label="Vista previa de cámara para escanear QR"
              autoPlay
              className={cn(
                "aspect-[4/3] w-full object-cover sm:aspect-video",
                scannerStatus === "idle" ||
                  scannerStatus === "permission_denied" ||
                  scannerStatus === "no_camera" ||
                  scannerStatus === "scanner_error"
                  ? "hidden"
                  : "block"
              )}
              muted
              playsInline
              ref={videoRef}
            />
            {scannerStatus === "idle" ||
            scannerStatus === "permission_denied" ||
            scannerStatus === "no_camera" ||
            scannerStatus === "scanner_error" ? (
              <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm text-neutral-300 sm:aspect-video">
                {getScannerStatusLabel(scannerStatus)}
              </div>
            ) : null}
            {scannerStatus === "requesting_permission" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/65 px-6 text-center text-sm font-medium text-white">
                Solicitando permiso de cámara...
              </div>
            ) : null}
            {scannerStatus === "scanning" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="aspect-square w-44 rounded-2xl border-4 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <p className={panelUi.mutedText}>{getScannerStatusLabel(scannerStatus)}</p>
          {scannerMessage ? (
            <p className="text-sm font-medium text-rose-700">{scannerMessage}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canStartCamera ? (
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                panelUi.focusRing
              )}
              disabled={!canStartCamera}
              onClick={() => void startCamera()}
              type="button"
            >
              Activar cámara
            </button>
          ) : null}

          {canStopCamera ? (
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60",
                panelUi.focusRing
              )}
              disabled={scannerStatus === "processing"}
              onClick={handleStopCamera}
              type="button"
            >
              Detener cámara
            </button>
          ) : null}

          {canScanAnother ? (
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                panelUi.focusRing
              )}
              disabled={!canScanAnother}
              onClick={handleScanAnother}
              type="button"
            >
              Escanear otro
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
