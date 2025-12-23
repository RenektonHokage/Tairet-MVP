import React from "react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

export type CoverflowItem = {
  src: string
  title: string
  alt?: string
}

interface CoverflowCarouselProps {
  items: CoverflowItem[]
}

const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({ items }) => {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [current, setCurrent] = React.useState(0)

  // Center to middle on init and keep index in sync
  React.useEffect(() => {
    if (!api) return

    const handleSelect = () => setCurrent(api.selectedScrollSnap())

    api.on("select", handleSelect)
    api.on("reInit", handleSelect)

    const middle = Math.floor(items.length / 2)
    try {
      api.scrollTo(middle, true)
    } catch {}
    handleSelect()

    return () => {
      api.off("select", handleSelect)
      api.off("reInit", handleSelect)
    }
  }, [api, items.length])

  // Offset helpers (no inline styles, just class names based on offset -2..2)
  const getOffset = (index: number) => {
    const raw = index - current
    return Math.max(-2, Math.min(2, raw))
  }

  const getCardClasses = (index: number) => {
    const off = getOffset(index)
    const abs = Math.abs(off)
    const isCenter = off === 0
    const rotate =
      off === 0 ? "" : off > 0 ? "[transform:rotateY(-12deg)]" : "[transform:rotateY(12deg)]"
    const scale = isCenter ? "scale-[1.04]" : abs === 1 ? "scale-[0.96]" : "scale-[0.90]"
    const depth = isCenter ? "shadow-2xl ring-1 ring-border/50" : "shadow-md ring-0"

    return [
      "relative aspect-[3/4] w-full select-none overflow-hidden rounded-2xl bg-muted/5",
      "transition-transform duration-300 ease-out transform-gpu will-change-transform [backface-visibility:hidden]",
      depth,
      rotate,
      scale,
    ].join(" ")
  }

  const getPillClasses = (index: number) => {
    const isCenter = getOffset(index) === 0
    return [
      "rounded-full px-3 py-1 text-sm md:text-base font-semibold text-foreground shadow-md",
      isCenter ? "bg-background/70 backdrop-blur-sm" : "bg-background/60",
    ].join(" ")
  }

  return (
    <section className="relative mx-auto w-full max-w-6xl">
      <div className="relative perspective-1000">
        <Carousel
          setApi={setApi}
          opts={{ 
            align: "center", 
            containScroll: "trimSnaps", 
            loop: false,
            dragFree: true,
            skipSnaps: false
          }}
          className="relative"
        >
          <CarouselContent className="transform-style-preserve-3d items-center gap-4 lg:gap-6 -ml-2 lg:-ml-4">
            {items.map((item, i) => (
              <CarouselItem
                key={`${item.title}-${i}`}
                className="basis-[70%] sm:basis-[55%] md:basis-[42%] lg:basis-[28%] xl:basis-[22%] pl-2 lg:pl-4"
              >
                <article className={getCardClasses(i)}>
                  <img
                    src={item.src}
                    alt={item.alt ?? item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover select-none"
                    draggable={false}
                  />

                  {/* Bottom gradient for title legibility */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />

                  {/* Title */}
                  <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                    <span className={getPillClasses(i)}>{item.title}</span>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Desktop arrows only */}
          <CarouselPrevious
            className="hidden lg:flex !left-2 md:!left-4 bg-background/70 backdrop-blur-sm border-border/50"
            aria-label="Anterior"
          />
          <CarouselNext
            className="hidden lg:flex !right-2 md:!right-4 bg-background/70 backdrop-blur-sm border-border/50"
            aria-label="Siguiente"
          />
        </Carousel>
      </div>
    </section>
  )
}

export default CoverflowCarousel
