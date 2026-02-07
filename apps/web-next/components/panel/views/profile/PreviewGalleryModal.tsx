import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface PreviewGalleryImage {
  src: string;
  alt: string;
}

interface PreviewGalleryModalProps {
  open: boolean;
  title: string;
  images: PreviewGalleryImage[];
  emptyMessage?: string;
  onClose: () => void;
}

export function PreviewGalleryModal({ open, title, images, emptyMessage = "Sin imagenes", onClose }: PreviewGalleryModalProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setActiveIndex(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const hasImages = images.length > 0;
  const selectedImage = useMemo(() => {
    if (activeIndex == null || !hasImages) return null;
    return images[activeIndex] ?? null;
  }, [activeIndex, hasImages, images]);

  const goPrev = () => {
    if (activeIndex == null || !hasImages) return;
    setActiveIndex((activeIndex - 1 + images.length) % images.length);
  };

  const goNext = () => {
    if (activeIndex == null || !hasImages) return;
    setActiveIndex((activeIndex + 1) % images.length);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h3 className="text-xl font-semibold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 p-1.5 text-neutral-600 transition hover:text-neutral-900"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-74px)] overflow-y-auto p-6">
          {!hasImages ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
              {emptyMessage}
            </div>
          ) : selectedImage ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Volver a la galeria
              </button>
              <div className="relative overflow-hidden rounded-xl bg-neutral-100">
                <img src={selectedImage.src} alt={selectedImage.alt} className="mx-auto max-h-[70vh] w-full object-contain" />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="aspect-[4/3] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 text-left"
                >
                  <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
