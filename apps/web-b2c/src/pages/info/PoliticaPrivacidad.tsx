import InfoPageLayout from "@/components/layout/InfoPageLayout";

const PoliticaPrivacidad = () => {
  return (
    <InfoPageLayout 
      title="Política de privacidad"
      subtitle="Última actualización: Enero 2025"
    >
      <div className="space-y-8">
        {/* Introducción */}
        <section>
          <p className="text-muted-foreground leading-relaxed">
            En Tairet respetamos tu privacidad y queremos que sepas cómo tratamos tu información 
            personal. Esta política explica de forma clara y simple qué datos recopilamos cuando 
            usás nuestra plataforma web, para qué los usamos y cómo los cuidamos.
          </p>
        </section>

        {/* Sección 1 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            1. Qué datos recopilamos
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Recopilamos diferentes tipos de información según cómo uses Tairet:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>
              <strong>Datos que nos das directamente:</strong> cuando hacés una reserva o comprás 
              entradas, necesitamos tu nombre, email, número de teléfono, cantidad de personas 
              y fecha del evento o reserva.
            </li>
            <li>
              <strong>Datos de uso del sitio:</strong> información general sobre cómo navegás 
              por Tairet (páginas que visitás, clics básicos, tipo de dispositivo o navegador 
              que usás, dirección IP aproximada). Esto nos ayuda a mejorar la plataforma.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            <strong>Importante:</strong> No almacenamos los datos completos de tu tarjeta de 
            crédito o débito. Los pagos se procesarán a través de una pasarela de pago externa 
            segura que se encarga de gestionar esa información.
          </p>
        </section>

        {/* Sección 2 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            2. Para qué usamos tus datos
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Usamos tu información para:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Gestionar tus reservas en bares y enviar tu solicitud al establecimiento</li>
            <li>Procesar tus compras de entradas y enviarte la información de tu compra por email</li>
            <li>Responder tus consultas o brindarte soporte si lo necesitás</li>
            <li>Mejorar la plataforma a través de analítica básica del uso del sitio (sin intentar identificarte personalmente)</li>
          </ul>
        </section>

        {/* Sección 3 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            3. Con quién compartimos tu información
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Tairet no vende ni alquila tu información personal. Sin embargo, compartimos 
            algunos datos en estos casos:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>
              <strong>Con locales y organizadores:</strong> cuando hacés una reserva o comprás 
              una entrada, compartimos tu nombre, teléfono, email y detalles de la reserva/compra 
              con el bar, boliche u organizador del evento para que puedan gestionar tu solicitud.
            </li>
            <li>
              <strong>Con proveedores externos:</strong> usaremos servicios de pasarelas de pago 
              para procesar compras de forma segura. Estos proveedores tienen sus propias políticas 
              de privacidad y cumplen estándares de seguridad.
            </li>
            <li>
              <strong>Servicios de analítica:</strong> podemos usar herramientas externas 
              (como Google Analytics u otras) para entender cómo se usa el sitio de forma 
              general, sin identificarte personalmente.
            </li>
          </ul>
        </section>

        {/* Sección 4 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            4. Cookies y tecnologías similares
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Tairet utiliza cookies y tecnologías similares para:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Recordar algunas preferencias básicas durante tu navegación</li>
            <li>Medir el uso de la plataforma y entender qué partes son más visitadas</li>
            <li>Mejorar la experiencia general del sitio</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            Podés configurar tu navegador para bloquear o eliminar cookies, aunque esto podría 
            afectar algunas funcionalidades del sitio. Para más información sobre cookies, 
            consultá nuestra página específica de "Cookies".
          </p>
        </section>

        {/* Sección 5 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            5. Conservación de datos
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Conservamos tus datos personales durante el tiempo necesario para cumplir con los 
            fines descritos en esta política. Por ejemplo, mantenemos los datos de tus reservas 
            y compras de entradas para gestionar el servicio y cumplir con obligaciones 
            administrativas básicas. Si en algún momento dejás de usar Tairet, podemos eliminar 
            tus datos después de un tiempo prudencial, salvo que la ley nos obligue a conservarlos 
            por más tiempo.
          </p>
        </section>

        {/* Sección 6 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            6. Tus derechos
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Como usuario de Tairet, tenés derecho a:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acceder a tus datos personales y saber qué información tenemos sobre vos</li>
            <li>Solicitar que actualicemos o corrijamos tus datos si son incorrectos</li>
            <li>Pedir que eliminemos tus datos cuando sea razonable y legalmente posible hacerlo</li>
            <li>Retirar tu consentimiento para ciertos usos de tus datos, si aplica</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            Para ejercer cualquiera de estos derechos, podés contactarnos a través de nuestro 
            equipo de soporte.
          </p>
        </section>

        {/* Sección 7 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            7. Actualizaciones de esta política
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Tairet puede modificar esta política de privacidad de vez en cuando para reflejar 
            cambios en nuestras prácticas o en la ley. Cuando hagamos cambios, actualizaremos 
            la fecha al inicio de esta página. Te recomendamos revisar esta política 
            periódicamente para mantenerte informado sobre cómo protegemos tu información.
          </p>
        </section>

        {/* Sección 8 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            8. Contacto
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Si tenés dudas, consultas o comentarios sobre esta política de privacidad o sobre 
            cómo manejamos tus datos personales, no dudes en contactarnos. Nuestro equipo de 
            soporte está disponible para ayudarte y responder cualquier inquietud relacionada 
            con tu privacidad en Tairet.
          </p>
        </section>
      </div>
    </InfoPageLayout>
  );
};

export default PoliticaPrivacidad;
