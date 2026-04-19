import React from "react"
import { Link } from "react-router-dom"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

export type CoverflowItem = {
  src: string
  title: string
  alt?: string
  href?: string
}

interface CoverflowCarouselProps {
  items: CoverflowItem[]
  initialIndex?: number
}

const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({
  items,
  initialIndex = 0,
}) => {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [current, setCurrent] = React.useState(initialIndex)

  React.useEffect(() => {
    if (!api) return

    const handleSelect = () => setCurrent(api.selectedScrollSnap())

    api.on("select", handleSelect)
    api.on("reInit", handleSelect)
    handleSelect()

    return () => {
      api.off("select", handleSelect)
      api.off("reInit", handleSelect)
    }
  }, [api])

  const scrollTo = (index: number) => {
    api?.scrollTo(index)
  }

  const getOffset = (index: number) => {
    const raw = index - current
    return Math.max(-2, Math.min(2, raw))
  }

  const getCardClasses = (index: number) => {
    const isCenter = getOffset(index) === 0

    return cn(
      "group relative block h-full select-none overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 text-left",
      "transition-[opacity,box-shadow,filter,transform] duration-300 ease-out",
      isCenter
        ? "z-20 scale-[0.985] md:scale-[1.01] opacity-100 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.7)] saturate-100"
        : "z-10 scale-[0.955] md:scale-[0.97] opacity-56 shadow-[0_16px_42px_-28px_rgba(0,0,0,0.55)] saturate-90"
    )
  }

  return (
    <section className="relative mx-auto w-full max-w-6xl">
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          containScroll: "trimSnaps",
          loop: false,
          dragFree: false,
          skipSnaps: false,
          slidesToScroll: 1,
          duration: 28,
          startIndex: initialIndex,
          breakpoints: {
            "(min-width: 768px)": {
              containScroll: "keepSnaps",
              duration: 34,
            },
          },
        }}
        className="relative"
      >
        <CarouselContent className="items-stretch gap-4 sm:gap-6 md:gap-8 -ml-2 md:-ml-4">
          {items.map((item, index) => {
            const isCenter = current === index
            const CardWrapper = item.href ? Link : "div"

            return (
              <CarouselItem
                key={`${item.title}-${index}`}
                className="basis-[82%] sm:basis-[70%] md:basis-[58%] lg:basis-[42%] xl:basis-[34%] pl-2 md:pl-4"
              >
                <CardWrapper
                  {...(item.href ? { to: item.href } : {})}
                  className={getCardClasses(index)}
                >
                  <article className="relative aspect-[3/4] h-full w-full">
                    <img
                      src={item.src}
                      alt={item.alt ?? item.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover select-none"
                      draggable={false}
                    />

                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-t to-transparent transition-opacity duration-300",
                        isCenter ? "from-black/78 via-black/26 opacity-100" : "from-black/88 via-black/42 opacity-100"
                      )}
                    />
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 ring-1 ring-inset transition-opacity duration-300",
                        isCenter ? "opacity-100 ring-white/12" : "opacity-0 ring-transparent"
                      )}
                    />

                    <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                      <h3
                        className={cn(
                          "text-center text-lg font-bold text-white drop-shadow-lg transition-[opacity,transform] duration-300 sm:text-xl",
                          isCenter ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-78"
                        )}
                      >
                        {item.title}
                      </h3>
                    </div>
                  </article>
                </CardWrapper>
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <CarouselPrevious
          className="!left-3 hidden h-9 w-9 border-white/10 bg-background/72 text-foreground/90 shadow-md backdrop-blur-sm disabled:opacity-25 md:inline-flex lg:!left-4"
          aria-label="Anterior"
        />
        <CarouselNext
          className="!right-3 hidden h-9 w-9 border-white/10 bg-background/72 text-foreground/90 shadow-md backdrop-blur-sm disabled:opacity-25 md:inline-flex lg:!right-4"
          aria-label="Siguiente"
        />
      </Carousel>

      <div className="mt-6 flex items-center justify-center gap-2">
        {items.map((item, index) => {
          const isActive = current === index

          return (
            <button
              key={`${item.title}-dot`}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`Ir a ${item.title}`}
              aria-pressed={isActive}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                isActive ? "w-7 bg-foreground" : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/55"
              )}
            />
          )
        })}
      </div>
    </section>
  )
}

export default CoverflowCarousel
