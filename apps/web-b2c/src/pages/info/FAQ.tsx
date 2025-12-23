import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/Footer';
import FAQAccordion from '@/components/FAQAccordion';
import heroImage from '@/assets/hero-nightlife-main.webp';

const FAQ = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Preguntas frecuentes
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-md">
            Encontrá respuestas a las dudas más comunes sobre Tairet
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          {/* Intro text */}
          <div className="mb-12 text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              ¿Tenés alguna duda sobre cómo usar Tairet, hacer reservas o gestionar tu cuenta? 
              Acá encontrarás las respuestas más comunes. Si necesitás más ayuda, escribinos a{' '}
              <a href="mailto:soporte@tairet.com" className="text-primary hover:underline">
                soporte@tairet.com
              </a>
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/3 rounded-2xl blur-2xl -z-10" />
            <FAQAccordion />
          </div>

          {/* CTA Section */}
          <section className="mt-16 pt-12 border-t border-border">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                ¿No encontraste tu respuesta?
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Nuestro equipo está listo para ayudarte
              </p>
              <a 
                href="mailto:soporte@tairet.com" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/30"
              >
                Contactar soporte
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
