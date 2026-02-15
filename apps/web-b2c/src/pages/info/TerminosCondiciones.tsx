import InfoPageLayout from "@/components/layout/InfoPageLayout";

const TerminosCondiciones = () => {
  return (
    <InfoPageLayout 
      title="Términos y condiciones de uso"
      subtitle="Última actualización: Enero 2025"
    >
      <div className="space-y-8">
        {/* Introducción */}
        <section>
          <p className="text-muted-foreground leading-relaxed">
            Al utilizar Tairet (el sitio web), aceptás estos términos y condiciones de uso. 
            Este documento establece las reglas básicas para el uso de nuestra plataforma. 
            Tairet se reserva el derecho de actualizar estos términos en cualquier momento, 
            y la versión vigente será siempre la publicada en este sitio.
          </p>
        </section>

        {/* Sección 1 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            1. Qué es Tairet
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Tairet es una plataforma digital que conecta a usuarios con bares, boliches y 
            organizadores de eventos nocturnos en Paraguay. A través de Tairet podés explorar 
            locales, ver información sobre eventos, hacer reservas y comprar entradas.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong>Importante:</strong> Tairet no es el organizador de los eventos ni el dueño 
            de los locales. Actuamos como intermediario facilitando la conexión entre usuarios 
            y establecimientos.
          </p>
        </section>

        {/* Sección 2 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            2. Uso de la plataforma
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Al usar Tairet, te comprometés a:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Utilizar el sitio de manera responsable y legal</li>
            <li>No usar la plataforma para actividades ilegales, spam, fraude o cualquier acción que perjudique a otros usuarios o a Tairet</li>
            <li>Respetar los derechos de propiedad intelectual de Tairet y de los locales publicados</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            El contenido de la plataforma (textos, imágenes, precios, horarios) puede cambiar 
            sin previo aviso. Aunque nos esforzamos por mantener la información actualizada y 
            precisa, pueden existir errores puntuales.
          </p>
        </section>

        {/* Sección 3 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            3. Reservas en bares
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Las reservas de mesas se envían directamente al bar mediante un formulario web. 
            La confirmación final de tu reserva depende de la disponibilidad del local y será 
            comunicada por el establecimiento.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            <strong>Tairet no garantiza la disponibilidad</strong> hasta que el bar confirme tu reserva. 
            Es tu responsabilidad verificar que tus datos de contacto sean correctos para que el 
            local pueda comunicarse con vos.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            En caso de inconvenientes con tu reserva, deberás contactar directamente con el local. 
            Si el inconveniente es técnico de la plataforma, podrás contactar a Tairet.
          </p>
        </section>

        {/* Sección 4 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            4. Compra de entradas
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            La compra de entradas próximamente se realizará a través de una pasarela de pago externa segura. 
            Tairet no almacena datos completos de tu tarjeta de crédito o débito.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Las condiciones de cancelación dependen exclusivamente del local. 
            Una vez confirmada la compra, no se permiten cambios ni reembolsos.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Una vez confirmada la compra, recibirás tu entrada por correo electrónico.
          </p>
        </section>

        {/* Sección 5 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            5. Responsabilidades del usuario
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Como usuario de Tairet, sos responsable de:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Proveer datos reales y actualizados en tus reservas y compras</li>
            <li>Respetar las normas de cada establecimiento (edad mínima, dress code, políticas internas)</li>
            <li>No revender entradas de forma no autorizada o fraudulenta</li>
            <li>Mantener la confidencialidad de tu información de acceso si creás una cuenta</li>
          </ul>
        </section>

        {/* Sección 6 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            6. Limitación de responsabilidad de Tairet
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Tairet actúa como intermediario entre usuarios y locales/organizadores. Por lo tanto, 
            <strong> no nos hacemos responsables por</strong>:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Cambios en eventos, cancelaciones, retrasos o problemas internos de los locales</li>
            <li>La calidad del servicio, la atención o la experiencia dentro de los establecimientos</li>
            <li>Pérdidas, daños o situaciones que ocurran dentro o fuera del local durante tu visita</li>
            <li>Errores en la información publicada por los locales o disponibilidad no actualizada</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            Nos comprometemos a hacer nuestro mejor esfuerzo para que la información de la 
            plataforma sea correcta y actualizada, pero no podemos garantizar que esté libre 
            de errores en todo momento.
          </p>
        </section>

        {/* Sección 7 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            7. Modificaciones de los términos
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Tairet puede modificar estos términos y condiciones en cualquier momento. 
            Cualquier cambio será publicado en esta página y entrará en vigencia inmediatamente. 
            Te recomendamos revisar periódicamente esta sección para mantenerte informado.
          </p>
        </section>

        {/* Sección 8 */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            8. Contacto
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Si tenés dudas, consultas o comentarios sobre estos términos y condiciones, 
            podés contactar a nuestro equipo de soporte. Estamos disponibles para ayudarte 
            y resolver cualquier inquietud que tengas sobre el uso de Tairet.
          </p>
        </section>
      </div>
    </InfoPageLayout>
  );
};

export default TerminosCondiciones;
