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
      answer: "El local debe confirmar la reserva. Una vez confirmada, te enviaremos un correo electrónico y ya estarás dentro de la lista."
    },
    {
      question: "¿Es gratis usar Tairet?",
      answer: "Sí, usar Tairet es gratis. Solo pagás el valor de la entrada cuando la compra de entradas esté habilitada."
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
      answer: "Sí. Podés solicitar la cancelación desde el correo de confirmación que te enviamos cuando el local aprueba tu reserva (respondiendo a ese email). La reserva no tiene costo, por lo que no hay reembolsos."
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
      question: "¿Puedo modificar mi entrada después de pagarla?",
      answer: "No. Una vez confirmada la compra, la entrada no se puede modificar. Esto ayuda a prevenir errores y fraudes. Si detectás un problema con tu compra, contactanos para revisar el caso."
    },
    {
      question: "¿Qué métodos de pago están disponibles?",
      answer: "Próximamente: Bancard."
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
      answer: "Si el local cancela tu reserva, te avisaremos por correo electrónico."
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
