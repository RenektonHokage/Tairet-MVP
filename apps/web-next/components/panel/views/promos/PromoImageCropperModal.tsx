"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Move, ZoomIn, ZoomOut } from "lucide-react";

import { cn, panelUi } from "@/components/panel/ui";
import {
  clampPromoCropOffset,
  createPromoCroppedFile,
  type PromoCropOffset,
  type PromoCropSize,
  type PromoImageSize,
} from "@/lib/promoImageCrop";

const DEFAULT_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;

interface PromoImageCropperModalProps {
  open: boolean;
  file: File | null;
  imageSrc: string | null;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => Promise<void> | void;
}

export function PromoImageCropperModal({
  open,
  file,
  imageSrc,
  isSubmitting,
  error,
  onCancel,
  onConfirm,
}: PromoImageCropperModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffset: PromoCropOffset;
  } | null>(null);

  const [cropSize, setCropSize] = useState<PromoCropSize>({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<PromoImageSize | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [offset, setOffset] = useState<PromoCropOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setZoom(DEFAULT_ZOOM);
    setOffset({ x: 0, y: 0 });
    setImageSize(null);
    setIsDragging(false);
    setLocalError(null);
  }, [imageSrc, open]);

  useEffect(() => {
    if (!open || !frameRef.current) {
      return;
    }

    const element = frameRef.current;
    const updateSize = () => {
      setCropSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    return () => observer.disconnect();
  }, [open]);

  const clampedOffset = useMemo(() => {
    if (!imageSize || !cropSize.width || !cropSize.height) {
      return offset;
    }

    return clampPromoCropOffset({
      cropSize,
      imageSize,
      offset,
      zoom,
    });
  }, [cropSize, imageSize, offset, zoom]);

  useEffect(() => {
    if (clampedOffset.x === offset.x && clampedOffset.y === offset.y) {
      return;
    }

    setOffset(clampedOffset);
  }, [clampedOffset, offset.x, offset.y]);

  const coverScale = useMemo(() => {
    if (!imageSize || !cropSize.width || !cropSize.height) {
      return 1;
    }

    return Math.max(cropSize.width / imageSize.width, cropSize.height / imageSize.height);
  }, [cropSize, imageSize]);

  const renderedImageSize = useMemo(() => {
    if (!imageSize) {
      return null;
    }

    return {
      width: imageSize.width * coverScale * zoom,
      height: imageSize.height * coverScale * zoom,
    };
  }, [coverScale, imageSize, zoom]);

  if (!open || !imageSrc || !file) {
    return null;
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize || !renderedImageSize) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originOffset: offset,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !imageSize) {
      return;
    }

    const nextOffset = clampPromoCropOffset({
      cropSize,
      imageSize,
      zoom,
      offset: {
        x: dragState.originOffset.x + (event.clientX - dragState.startX),
        y: dragState.originOffset.y + (event.clientY - dragState.startY),
      },
    });

    setOffset(nextOffset);
  };

  const releaseDrag = (
    event: React.PointerEvent<HTMLDivElement> | React.PointerEvent<HTMLButtonElement>
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setLocalError(null);
  };

  const handleConfirm = async () => {
    if (!imageSize || !cropSize.width || !cropSize.height) {
      setLocalError("Esperá a que la imagen termine de cargar para ajustar el recorte.");
      return;
    }

    setLocalError(null);

    try {
      const croppedFile = await createPromoCroppedFile({
        imageSrc,
        fileName: file.name,
        fileType: file.type,
        cropSize,
        imageSize,
        offset,
        zoom,
      });

      await onConfirm(croppedFile);
    } catch (cropError) {
      setLocalError(
        cropError instanceof Error
          ? cropError.message
          : "No se pudo recortar la imagen seleccionada."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Cerrar ajuste de imagen"
        onClick={isSubmitting ? undefined : onCancel}
        className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px]"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
              Ajustar imagen 4:3
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Arrastra y ajusta el zoom para definir exactamente el encuadre que verá el cliente en el perfil público.
            </p>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div
              ref={frameRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={releaseDrag}
              onPointerCancel={releaseDrag}
              className={cn(
                "relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-950/5 touch-none select-none",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              {renderedImageSize ? (
                <img
                  src={imageSrc}
                  alt="Ajuste de promoción"
                  draggable={false}
                  onLoad={(event) => {
                    setImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: renderedImageSize.width,
                    height: renderedImageSize.height,
                    transform: `translate(calc(-50% + ${clampedOffset.x}px), calc(-50% + ${clampedOffset.y}px))`,
                  }}
                />
              ) : (
                <img
                  src={imageSrc}
                  alt="Ajuste de promoción"
                  draggable={false}
                  onLoad={(event) => {
                    setImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none opacity-0"
                />
              )}

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[size:33.333%_33.333%]" />
              <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/70" />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900">
                  <Move className="h-4 w-4 text-neutral-500" />
                  Ajuste visual 4:3
                </div>
                <p className="text-sm text-neutral-500">
                  El recorte final se guarda listo para la promo y replica el marco visible en B2C.
                </p>
              </div>

              <div className="flex min-w-0 items-center gap-3 md:w-[320px]">
                <button
                  type="button"
                  onClick={() => handleZoomChange(Math.max(DEFAULT_ZOOM, zoom - ZOOM_STEP))}
                  className={cn(
                    panelUi.focusRing,
                    "rounded-xl border border-neutral-200 bg-white p-2 text-neutral-600 transition hover:bg-neutral-100"
                  )}
                  aria-label="Alejar imagen"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min={DEFAULT_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  className="h-2 w-full accent-neutral-900"
                  aria-label="Zoom de imagen"
                />
                <button
                  type="button"
                  onClick={() => handleZoomChange(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
                  className={cn(
                    panelUi.focusRing,
                    "rounded-xl border border-neutral-200 bg-white p-2 text-neutral-600 transition hover:bg-neutral-100"
                  )}
                  aria-label="Acercar imagen"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
            </div>

            {localError || error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {localError || error}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className={cn(
                panelUi.focusRing,
                "rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !imageSize}
              className={cn(
                panelUi.focusRing,
                "inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar recorte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
