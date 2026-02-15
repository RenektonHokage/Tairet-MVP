import { Search, Calendar, CreditCard, QrCode, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/Footer';
import heroImage from '@/assets/hero-nightlife-main.webp';

const ComoFunciona = () => {
  const steps = [
    {
      icon: Search,
      title: "Explorá lugares",
      description: "Buscá bares y boliches por zona, estilo de música o ambiente. Mirá fotos reales, horarios y promociones."
    },
    {
      icon: Calendar,
      title: "Reservá tu mesa",
      description: "Seleccioná el día, horario y cantidad de personas. Completá el formulario y listo."
    },
    {
      icon: CreditCard,
      title: "Pagos integrados (próximamente)",
      description: "Próximamente vas a poder confirmar tus compras con pagos integrados mediante Bancard."
    },
    {
      icon: QrCode,
      title: "Recibí tu código QR",
      description: "Te enviamos un correo con tu código QR. Mostralo en la entrada del local y disfrutá."
    },
    {
      icon: Star,
      title: "Dejá tu reseña",
      description: "Compartí tu experiencia y ayudá a otros usuarios a descubrir los mejores lugares."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Cómo funciona Tairet
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-md">
            Reservá tu mesa en 6 pasos simples
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          {/* Intro Section */}
          <section className="mb-16">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 dark:from-primary/5 dark:via-transparent dark:to-primary/5 rounded-2xl blur-3xl -z-10" />
              <div className="bg-gradient-to-br from-background via-background to-primary/10 dark:to-primary/5 rounded-2xl p-8 md:p-10 border border-border/50 shadow-lg">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
                  De la búsqueda a la experiencia
                </h2>
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed text-center max-w-3xl mx-auto">
                  Tairet simplifica tu salida nocturna. Desde descubrir el lugar perfecto hasta confirmar tu reserva, 
                  todo en una sola plataforma. Seguí estos pasos y asegurá tu lugar en los mejores bares y boliches de Paraguay.
                </p>
              </div>
            </div>
          </section>

          {/* Steps Section */}
          <section className="mb-16">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Pasos para reservar
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto" />
            </div>
            
            <div className="space-y-8 md:space-y-12">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isEven = index % 2 === 0;
                
                return (
                  <div 
                    key={index}
                    className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-6 md:gap-8 items-center group`}
                  >
                    {/* Icon side */}
                    <div className={`flex-shrink-0 ${isEven ? 'md:ml-0' : 'md:mr-0'}`}>
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 dark:bg-primary/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500" />
                        <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/40 dark:shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                          <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <Icon className="w-10 h-10 md:w-12 md:h-12 text-primary-foreground" />
                        </div>
                      </div>
                    </div>

                    {/* Content side */}
                    <div className={`flex-1 ${isEven ? 'md:text-left' : 'md:text-right'} text-center`}>
                      <div className="relative bg-card/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Additional Info Section */}
          <section className="mb-16">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 dark:from-accent/20 dark:via-primary/10 dark:to-accent/20 rounded-2xl blur-2xl -z-10" />
              <div className="bg-gradient-to-br from-muted/80 to-muted/40 backdrop-blur-sm rounded-2xl p-8 md:p-10 border-2 border-primary/20 shadow-xl">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent text-center">
                  Seguridad y confianza
                </h2>
                <div className="space-y-4">
                  <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                    Todos los pagos serán procesados a través de Bancard, pasarela de pago oficial y segura. Tu información está protegida y tu compra de la entrada se confirma de forma inmediata.
                  </p>
                  <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                    Las fotos y reseñas que ves en Tairet son verificadas. Solo mostramos contenido real de usuarios que reservaron a través de nuestra plataforma.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="mt-16 pt-12 border-t border-border">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-6">
                ¿Listo para reservar tu próxima salida?
              </p>
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/30"
              >
                Empezar a explorar
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ComoFunciona;
