import React, {
  PropsWithChildren,
  forwardRef,
  useImperativeHandle,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import { cn } from "@/lib/utils";

export interface BaseCarouselHandle {
  embla: EmblaCarouselType | null;
}

interface BaseCarouselProps extends PropsWithChildren {
  className?: string;          // viewport
  containerClassName?: string; // inner flex row
  options?: EmblaOptionsType;
}

export const BaseCarousel = forwardRef<BaseCarouselHandle, BaseCarouselProps>(
  ({ children, className, containerClassName, options }, ref) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({
      dragFree: true,
      containScroll: "trimSnaps",
      skipSnaps: false,
      ...options,
    });

    useImperativeHandle(
      ref,
      () => ({
        embla: emblaApi ?? null,
      }),
      [emblaApi]
    );

    return (
      <div
        ref={emblaRef}
        className={cn(
          "overflow-hidden touch-pan-y",
          className
        )}
      >
        <div className={cn("flex", containerClassName)}>
          {React.Children.map(children, (child, index) => (
            <div key={index} className="flex-[0_0_auto]">
              {child}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

BaseCarousel.displayName = "BaseCarousel";
