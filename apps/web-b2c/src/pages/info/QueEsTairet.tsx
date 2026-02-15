import { Search, Info, Calendar, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/Footer';
import heroImage from '@/assets/hero-nightlife-main.webp';
const QueEsTairet = () => {
  const features = [{
    icon: Search,
    title: "Explorar bares y boliches",
    description: "Descubrí lugares nuevos según tu zona, estilo de música o tipo de ambiente."
  }, {
    icon: Info,
    title: "Ver información básica y promos",
    description: "Conocé horarios, ubicación, descripción del lugar y promociones."
  }, {
    icon: Calendar,
    title: "Reservar mesas en bares",
    description: "Completá un formulario simple y asegurá tu lugar sin llamadas ni esperas."
  }, {
    icon: Ticket,
    title: "Compra entradas",
    description: "Próximamente vas a poder comprar entradas con un checkout. Pagos integrados con Bancard: próximamente."
  }];
  return <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${heroImage})`
      }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Qué es Tairet
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-md">
            La forma más simple de vivir la noche en Paraguay
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
      {/* Sección 1: Tu guía para la vida nocturna */}
      <section className="mb-16">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 dark:from-primary/5 dark:via-transparent dark:to-primary/5 rounded-2xl blur-3xl -z-10" />
          <div className="bg-gradient-to-br from-background via-background to-primary/10 dark:to-primary/5 rounded-2xl p-8 md:p-10 border border-border/50 shadow-lg">
            <div className="gap-3 mb-6 flex items-start justify-center">
              
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Tu guía para la vida nocturna
              </h2>
            </div>
            <div className="space-y-4 pl-11">
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                Tairet es la plataforma digital que te ayuda a descubrir los mejores bares y boliches de Paraguay. 
                Ya sea que busques un after office relajado, un boliche con música electrónica o un rooftop para disfrutar 
                con amigos, Tairet te muestra qué pasa cada noche y te ayuda a encontrar el lugar ideal según tus gustos.
              </p>
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                Nuestro objetivo es hacer que salir de noche sea más fácil: desde descubrir nuevos lugares hasta reservar 
                tu mesa o comprar entradas, todo en un solo lugar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección 2: Qué podés hacer como usuario */}
      <section className="mb-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Qué podés hacer como usuario
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto" />
        </div>
        
        <div className="space-y-8 md:space-y-12">
          {features.map((feature, index) => {
              const Icon = feature.icon;
              const isEven = index % 2 === 0;
              return <div key={index} className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-6 md:gap-8 items-center group`}>
                {/* Icon side */}
                <div className={`flex-shrink-0 ${isEven ? 'md:ml-0' : 'md:mr-0'}`}>
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 dark:bg-primary/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500" />
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/40 dark:shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-10 h-10 md:w-12 md:h-12 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                {/* Content side */}
                <div className={`flex-1 ${isEven ? 'md:text-left' : 'md:text-right'} text-center`}>
                  <div className="relative bg-card/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                    <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>;
            })}
        </div>
      </section>

      {/* Sección 3: Para locales y organizadores */}
      <section className="mb-16">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 dark:from-accent/20 dark:via-primary/10 dark:to-accent/20 rounded-2xl blur-2xl -z-10" />
          <div className="bg-gradient-to-br from-muted/80 to-muted/40 backdrop-blur-sm rounded-2xl p-8 md:p-10 border-2 border-primary/20 shadow-xl">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent text-center">
              Para locales y organizadores
            </h2>
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Los bares, boliches y organizadores de eventos cuentan con un panel exclusivo donde pueden ver información y resultados de su presencia en Tairet —por ejemplo: vistas de perfil, reservas recibidas, entradas vendidas, promoción más vista y clics a WhatsApp—. Esto les permite entender mejor a su público y operar de forma más eficiente.
            </p>
          </div>
        </div>
      </section>

      {/* Sección 4: Visión */}
      <section className="mb-8">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/5 rounded-2xl blur-2xl" />
            <div className="relative text-center bg-gradient-to-b from-background/80 to-background rounded-2xl p-8 md:p-12 border border-border/30">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Nuestra visión
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-8" />
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed italic">
                Queremos ordenar la experiencia de salir de noche en Paraguay. Buscamos que descubrir lugares sea más fácil, 
                que reservar o comprar entradas no sea un problema, y que los locales puedan entender mejor a su audiencia. 
                Tairet está en constante evolución, construyendo el futuro de la vida nocturna de forma simple y accesible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mt-16 pt-12 border-t border-border">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-6">
            ¿Listo para explorar la vida nocturna?
          </p>
          <Link to="/" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/30">
            Empezar a explorar
          </Link>
        </div>
      </section>
        </div>
      </main>

      <Footer />
    </div>;
};
export default QueEsTairet;
