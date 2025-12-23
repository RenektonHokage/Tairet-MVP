import { useState, UIEvent } from "react";

const TairetInfoSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const infoBlocks = [
    {
      icon: "📌",
      title: "Reservá tu mesa",
      description: "Reserva tu mesa en los mejores bares y boliches de tu ciudad."
    },
    {
      icon: "🎫",
      title: "Compra tus entradas",
      description: "Comprá tus entradas en segundos, sin filas, todo 100% online."
    },
    {
      icon: "🗣",
      title: "Tu voz cuenta",
      description: "Compartí tu experiencia y ayudá a otros a encontrar su próximo lugar favorito."
    }
  ];

  const InfoCard = ({ block }: { block: typeof infoBlocks[0] }) => (
    <div className="text-center p-6 rounded-lg bg-card border border-border hover:shadow-lg transition-shadow duration-200">
      <div className="text-4xl mb-4">{block.icon}</div>
      <h3 className="text-xl font-semibold mb-3 text-card-foreground">
        {block.title}
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        {block.description}
      </p>
    </div>
  );

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const cardWidth = el.clientWidth;
    if (!cardWidth) return;
    const newIndex = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(newIndex);
  };

  return (
    <section className="py-10 md:py-12 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Mobile: carrusel simple con scroll nativo */}
        <div className="md:hidden">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]"
            onScroll={handleScroll}
          >
            {infoBlocks.map((block, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-full snap-center px-4"
              >
                <div className="max-w-sm mx-auto">
                  <InfoCard block={block} />
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {infoBlocks.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tablet/Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 px-4">
          {infoBlocks.map((block, index) => (
            <InfoCard key={index} block={block} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TairetInfoSection;
