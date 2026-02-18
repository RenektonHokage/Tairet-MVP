import { useEffect, useMemo, useRef, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProgressiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading"> {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
  priority?: boolean;
  skeletonDelayMs?: number;
}

export default function ProgressiveImage({
  src,
  alt,
  className,
  imgClassName,
  skeletonClassName,
  fallbackSrc,
  priority = false,
  skeletonDelayMs = 150,
  onLoad,
  onError,
  ...imgProps
}: ProgressiveImageProps) {
  const normalizedSrc = typeof src === "string" && src.trim().length > 0 ? src.trim() : "";
  const normalizedFallback =
    typeof fallbackSrc === "string" && fallbackSrc.trim().length > 0 ? fallbackSrc.trim() : "";

  const initialSrc = useMemo(
    () => normalizedSrc || normalizedFallback || "",
    [normalizedFallback, normalizedSrc],
  );

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const skeletonTimerRef = useRef<number | null>(null);

  const clearSkeletonTimer = () => {
    if (skeletonTimerRef.current !== null) {
      window.clearTimeout(skeletonTimerRef.current);
      skeletonTimerRef.current = null;
    }
  };

  useEffect(() => {
    setCurrentSrc(initialSrc);
    setIsLoaded(false);
    setShowSkeleton(false);
  }, [initialSrc]);

  useEffect(() => {
    if (!currentSrc) {
      clearSkeletonTimer();
      setIsLoaded(true);
      setShowSkeleton(false);
      return;
    }

    const imageElement = imgRef.current;
    if (imageElement?.complete && imageElement.naturalWidth > 0) {
      clearSkeletonTimer();
      setIsLoaded(true);
      setShowSkeleton(false);
      return;
    }

    clearSkeletonTimer();
    setShowSkeleton(false);
    skeletonTimerRef.current = window.setTimeout(() => {
      setShowSkeleton(true);
    }, Math.max(0, skeletonDelayMs));

    return () => {
      clearSkeletonTimer();
    };
  }, [currentSrc, skeletonDelayMs]);

  const handleError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (event) => {
    if (normalizedFallback && currentSrc !== normalizedFallback) {
      clearSkeletonTimer();
      setCurrentSrc(normalizedFallback);
      setIsLoaded(false);
      setShowSkeleton(false);
      return;
    }
    clearSkeletonTimer();
    setIsLoaded(true);
    setShowSkeleton(false);
    onError?.(event);
  };

  const handleLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"] = (event) => {
    clearSkeletonTimer();
    setIsLoaded(true);
    setShowSkeleton(false);
    onLoad?.(event);
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {showSkeleton && !isLoaded && (
        <Skeleton
          aria-hidden="true"
          className={cn("absolute inset-0 rounded-none", skeletonClassName)}
        />
      )}
      {currentSrc && (
        <img
          ref={imgRef}
          {...imgProps}
          src={currentSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
