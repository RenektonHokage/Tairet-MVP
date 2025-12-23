import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQAccordion = () => {
  const faqs = [
    {
      question: "¿Qué es Tairet y para qué sirve?",
      answer: "Tairet es una plataforma que conecta a los usuarios con bares y discotecas de Paraguay. Podés ver fotos reales, horarios, ubicación, disponibilidad de mesas y promociones exclusivas, y reservar en segundos."
    },
    {
      question: "¿Cómo reservo una mesa?",
      answer: "Entrá a Tairet, elegí tu lugar, seleccioná la mesa disponible y confirmá tu reserva. Vas a recibir un correo con un código QR para mostrar en el ingreso."
    },
    {
      question: "¿Es gratis usar Tairet?",
      answer: "Sí, la plataforma es totalmente gratuita para los usuarios. Solo pagás el valor de la reserva según el local que elijas."
    },
    {
      question: "¿Qué es el código QR y para qué sirve?",
      answer: "Es tu comprobante digital de reserva. Lo mostrás en la entrada y el personal del local validará tu acceso."
    },
    {
      question: "¿Cómo sé que las fotos y reseñas son reales?",
      answer: "Solo mostramos fotos verificadas de los locales y reseñas de usuarios que hicieron reservas a través de Tairet."
    },
    {
      question: "¿Puedo cancelar mi reserva?",
      answer: "Sí, podés hacerlo desde tu perfil antes del horario de inicio de la reserva. El reembolso se hará según la política de cada local."
    },
    {
      question: "¿Qué pasa si llego tarde a mi reserva?",
      answer: "La mayoría de los locales mantiene tu mesa por un tiempo limitado (generalmente entre 15 y 20 minutos). Pasado ese tiempo, podrían asignarla a otro cliente."
    },
    {
      question: "¿Si soy menor de edad puedo reservar una mesa?",
      answer: "No, la plataforma está destinada exclusivamente a personas mayores de 18 años."
    },
    {
      question: "¿Puedo modificar mi reserva después de pagar?",
      answer: "No, una vez confirmada y pagada la reserva no es posible modificarla. Si necesitás cambiar algo, podés cancelar desde tu perfil antes del horario de inicio de la reserva y se te realizará el reembolso correspondiente según la política de cada local."
    },
    {
      question: "¿Qué métodos de pago están disponibles?",
      answer: "Todas las reservas se pagan directamente en Tairet a través de nuestras pasarelas oficiales: Bancard y Dinelco, compatibles con tarjetas de crédito y débito. De esta forma garantizamos pagos seguros y confirmación inmediata de tu mesa."
    },
    {
      question: "¿Qué pasa si mi pago falla?",
      answer: "Si el pago no se procesa correctamente, tu reserva no será confirmada. Podés volver a intentarlo o comunicarte con nuestro soporte para recibir asistencia."
    },
    {
      question: "¿Puedo unir varias mesas o personalizar el espacio?",
      answer: "Algunos locales ofrecen mesas grandes o zonas para grupos, pero eso depende totalmente del establecimiento. Tairet es el puente entre vos y el local: no podemos modificar la disposición del lugar, agregar muebles exclusivos o instalar mesas en ubicaciones especiales."
    },
    {
      question: "¿Qué pasa si el local cancela mi reserva?",
      answer: "En caso de que un local cancele mi reserva, recibirás un reembolso completo y una notificación por correo electrónico."
    },
    {
      question: "¿Cómo contacto al soporte de Tairet?",
      answer: "Podés escribirnos a soporte@tairet.com o usar el formulario de contacto en la web."
    }
  ];

  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem
          key={index}
          value={`item-${index}`}
          className="border-4 border-black mb-4 last:mb-0"
        >
          <AccordionTrigger className="px-6 py-4 text-left font-black text-lg hover:bg-black hover:text-white transition-colors [&[data-state=open]]:bg-black [&[data-state=open]]:text-white">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="px-6 py-4 bg-white text-black font-medium leading-relaxed">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default FAQAccordion;