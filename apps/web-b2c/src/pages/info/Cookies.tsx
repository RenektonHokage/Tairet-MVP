import InfoPageLayout from '@/components/layout/InfoPageLayout';

const Cookies = () => {
  return (
    <InfoPageLayout 
      title="Uso de cookies"
      subtitle="Conocé cómo utilizamos las cookies en Tairet para mejorar tu experiencia"
    >
      {/* Introduction */}
      <div className="mb-8">
        <p className="text-muted-foreground leading-relaxed">
          En Tairet utilizamos cookies y tecnologías similares para que la plataforma funcione correctamente 
          y para entender mejor cómo se usa. Esta página te explica de forma simple qué son las cookies, 
          qué tipo de cookies usamos y cómo podés gestionarlas desde tu navegador.
        </p>
      </div>

      {/* Section 1: What are cookies */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          ¿Qué son las cookies?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Las cookies son pequeños archivos de texto que se guardan en tu navegador cuando visitás un sitio web. 
          Su función principal es recordar ciertas cosas: por ejemplo, si ya iniciaste sesión, qué preferencias 
          elegiste o qué secciones visitaste.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Las cookies hacen que tu experiencia en el sitio sea más fluida y personalizada, sin tener que 
          repetir la misma información cada vez que navegás.
        </p>
      </section>

      {/* Section 2: Types of cookies */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          ¿Qué tipos de cookies usamos?
        </h2>
        
        <div className="space-y-6">
          {/* Essential cookies */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Cookies esenciales o técnicas
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Son las cookies necesarias para que Tairet funcione correctamente. Por ejemplo, para mantener 
              tu sesión activa, recordar tus filtros de búsqueda o guardar temporalmente información que 
              ingresaste en un formulario. Sin estas cookies, algunas funciones del sitio no podrían operar 
              de forma adecuada.
            </p>
          </div>

          {/* Performance/Analytics cookies */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Cookies de rendimiento y analítica
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Estas cookies nos ayudan a entender cómo los usuarios interactúan con Tairet: qué secciones 
              visitan más, cuánto tiempo permanecen en cada página o qué contenido les resulta más útil. 
              Toda esta información se recopila de forma agregada y anónima, sin identificarte personalmente. 
              Nos permite mejorar la plataforma y hacerla más útil para vos.
            </p>
          </div>

          {/* Marketing cookies (future) */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Cookies de marketing (futuro)
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              En el futuro, podríamos utilizar cookies de marketing para mostrarte contenido, promociones 
              o campañas más relevantes según tus intereses. Si llegamos a implementarlas, nuestro objetivo 
              será siempre ofrecerte una experiencia personalizada sin resultar invasivos. Te informaremos 
              claramente si comenzamos a usar este tipo de cookies.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: How to manage cookies */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          ¿Cómo podés gestionar las cookies?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Tenés control total sobre las cookies que se guardan en tu navegador. Podés configurarlo para que 
          bloquee o elimine cookies automáticamente. La mayoría de los navegadores modernos (Chrome, Firefox, 
          Safari, Edge) tienen opciones sencillas en sus ajustes de privacidad para administrar este tipo de archivos.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Sin embargo, tené en cuenta que, si desactivás ciertas cookies esenciales, algunas funciones de Tairet 
          pueden dejar de funcionar correctamente. Por ejemplo, podrías tener problemas para mantener tu sesión 
          iniciada o para que se guarden tus preferencias de navegación.
        </p>
      </section>

      {/* Section 4: Changes to this policy */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Cambios en esta política de cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          A medida que Tairet evolucione, es posible que actualicemos la forma en que usamos cookies o que 
          agreguemos nuevos tipos. Si realizamos cambios significativos, actualizaremos esta página para que 
          siempre tengas información clara y actualizada. Te recomendamos revisarla de vez en cuando.
        </p>
      </section>

      {/* Section 5: Contact */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Contacto
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Si tenés dudas o consultas sobre cómo utilizamos las cookies en Tairet, no dudes en contactarte 
          con nuestro equipo de soporte. Estamos para ayudarte y brindarte toda la información que necesites 
          sobre tu privacidad y el uso de la plataforma.
        </p>
      </section>
    </InfoPageLayout>
  );
};

export default Cookies;