import { sendEmail } from "./emails";

type SendEventEntryQrEmailInput = {
  to: string;
  eventTitle: string;
  startsAt: string | null;
  timezone: string | null;
  locationName: string | null;
  ticketName: string;
  attendeeName: string;
  attendeeLastName: string;
  qrPngBuffer: Buffer;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEventDate(startsAt: string | null, timezone: string | null): string {
  if (!startsAt) return "Fecha por confirmar";

  const parsedDate = new Date(startsAt);
  if (Number.isNaN(parsedDate.getTime())) return "Fecha por confirmar";

  return parsedDate.toLocaleString("es-PY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || "America/Asuncion",
  });
}

function renderEventEntryQrEmail(input: Omit<SendEventEntryQrEmailInput, "to" | "qrPngBuffer">): string {
  const safeEventTitle = escapeHtml(input.eventTitle);
  const safeEventDate = escapeHtml(formatEventDate(input.startsAt, input.timezone));
  const safeLocationName = input.locationName?.trim()
    ? escapeHtml(input.locationName.trim())
    : "Lugar por confirmar";
  const safeTicketName = escapeHtml(input.ticketName);
  const attendeeFullName = `${input.attendeeName} ${input.attendeeLastName}`.trim();
  const safeAttendeeName = escapeHtml(attendeeFullName || "Asistente");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #eef2f7;background:#0f172a;">
          <div style="font-size:12px;letter-spacing:0.16em;color:#94a3b8;font-weight:700;text-transform:uppercase;">Tairet</div>
          <div style="margin-top:8px;font-size:24px;font-weight:800;color:#ffffff;">Tu entrada para ${safeEventTitle}</div>
          <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">Presenta este QR en la entrada del evento.</div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hola ${safeAttendeeName},</p>
          <p style="margin:0 0 18px 0;font-size:16px;color:#334155;">Tu entrada ya fue emitida. Guarda este email y presenta el QR al llegar.</p>

          <div style="margin:0 0 22px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Evento:</strong> ${safeEventTitle}</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Fecha:</strong> ${safeEventDate}</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Lugar:</strong> ${safeLocationName}</p>
            <p style="margin:0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Entrada:</strong> ${safeTicketName}</p>
          </div>

          <div style="text-align:center;margin:20px 0 18px 0;">
            <img src="cid:event-entry-qr" alt="Código QR de entrada" style="width:320px;max-width:100%;height:auto;display:block;margin:0 auto;" />
          </div>

          <p style="margin:0 0 8px 0;font-size:14px;color:#475569;">No compartas este QR; es único para tu acceso.</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Si el código no se lee bien, abre el adjunto PNG en pantalla completa.</p>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #eef2f7;background:#ffffff;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Este es un mensaje automático de Tairet.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendEventEntryQrEmail(input: SendEventEntryQrEmailInput): Promise<void> {
  const qrBase64 = input.qrPngBuffer.toString("base64");

  await sendEmail({
    to: input.to,
    subject: `Tu entrada para ${input.eventTitle} - Tairet`,
    html: renderEventEntryQrEmail(input),
    attachments: [
      {
        filename: "tairet-event-entry-qr-inline.png",
        content: qrBase64,
        contentType: "image/png",
        contentId: "event-entry-qr",
      },
      {
        filename: "tairet-event-entry-qr.png",
        content: qrBase64,
        contentType: "image/png",
      },
    ],
  });
}
