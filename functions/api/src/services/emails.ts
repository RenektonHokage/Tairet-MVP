// Servicio de emails transaccionales con Resend
import { Resend } from "resend";
import QRCode from "qrcode";
import { logger } from "../utils/logger";

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
  contentId?: string; // Para inline CID
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

type ReservationEmailStatus = "pending" | "confirmed" | "cancelled";

interface ReservationEmailPayload {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
  reservationType?: string;
  cancelReason?: string;
}

interface ReservationTemplateInput extends ReservationEmailPayload {
  status: ReservationEmailStatus;
}

interface EmailShellInput {
  title: string;
  subtitle: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerText?: string;
}

const DEFAULT_B2C_BASE_URL = "https://tairet.com.py";

// Inicializar cliente Resend solo si hay API key
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReservationDate(date?: string): string {
  if (!date) return "Fecha por confirmar";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Fecha por confirmar";
  }

  return parsed.toLocaleDateString("es-PY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getB2cBaseUrl(): string {
  const baseUrl = process.env.B2C_BASE_URL?.trim();
  return baseUrl && baseUrl.length > 0 ? baseUrl : DEFAULT_B2C_BASE_URL;
}

function renderEmailShell(input: EmailShellInput): string {
  const safeTitle = escapeHtml(input.title);
  const safeSubtitle = escapeHtml(input.subtitle);
  const safeFooter = escapeHtml(input.footerText || "Este es un mensaje automático de Tairet.");
  const safeCtaLabel = input.ctaLabel ? escapeHtml(input.ctaLabel) : null;
  const safeCtaHref = input.ctaHref ? escapeHtml(input.ctaHref) : null;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #eef2f7;background:#0f172a;">
          <div style="font-size:12px;letter-spacing:0.16em;color:#94a3b8;font-weight:700;text-transform:uppercase;">Tairet</div>
          <div style="margin-top:8px;font-size:24px;font-weight:800;color:#ffffff;">${safeTitle}</div>
          <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">${safeSubtitle}</div>
        </div>
        <div style="padding:28px;">
          ${input.bodyHtml}
          ${
            safeCtaLabel && safeCtaHref
              ? `<div style="margin-top:22px;">
                   <a href="${safeCtaHref}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#8d1313;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                     ${safeCtaLabel}
                   </a>
                 </div>`
              : ""
          }
        </div>
        <div style="padding:16px 28px;border-top:1px solid #eef2f7;background:#ffffff;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">${safeFooter}</p>
        </div>
      </div>
    </div>
  `;
}

function getReservationStatusLabel(status: ReservationEmailStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmada";
    case "cancelled":
      return "Cancelada";
    default:
      return "En revisión";
  }
}

function getReservationSubject(status: ReservationEmailStatus, localName?: string): string {
  if (status === "cancelled") {
    return localName
      ? `Tu reserva en ${localName} fue cancelada`
      : "Tu reserva fue cancelada";
  }

  if (status === "confirmed") {
    return localName
      ? `Tu reserva en ${localName} fue confirmada`
      : "Tu reserva fue confirmada";
  }

  return localName
    ? `Recibimos tu reserva en ${localName}`
    : "Recibimos tu solicitud de reserva";
}

function getReservationHeadline(status: ReservationEmailStatus): string {
  switch (status) {
    case "confirmed":
      return "Tu reserva está confirmada";
    case "cancelled":
      return "Tu reserva fue cancelada por el local";
    default:
      return "Tu reserva está en revisión";
  }
}

function getReservationDescription(status: ReservationEmailStatus): string {
  switch (status) {
    case "confirmed":
      return "El local aprobó tu solicitud. Guardá este correo como constancia de tu reserva.";
    case "cancelled":
      return "El local no podrá recibirte en esta ocasión. Si querés, podés intentar con otro horario o elegir otra opción.";
    default:
      return "Recibimos tu solicitud y el local la está revisando. Te avisaremos cuando haya una actualización.";
  }
}

function getStatusBadgeStyles(status: ReservationEmailStatus): string {
  if (status === "confirmed") {
    return "display:inline-block;padding:6px 12px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;";
  }
  if (status === "cancelled") {
    return "display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:700;";
  }
  return "display:inline-block;padding:6px 12px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:700;";
}

function renderReservationEmail(input: ReservationTemplateInput): { subject: string; html: string } {
  const localName = input.localName?.trim() || "el local";
  const safeName = escapeHtml(input.name || "Cliente");
  const safeLocalName = escapeHtml(localName);
  const safeType = escapeHtml(input.reservationType || "Reserva");
  const safeDate = escapeHtml(formatReservationDate(input.date));
  const statusLabel = getReservationStatusLabel(input.status);
  const headline = getReservationHeadline(input.status);
  const description = getReservationDescription(input.status);
  const subject = getReservationSubject(input.status, input.localName?.trim());
  const safePeople =
    typeof input.people === "number" && Number.isFinite(input.people)
      ? escapeHtml(String(input.people))
      : "No informado";
  const cancelReason = input.cancelReason?.trim();
  const safeCancelReason = cancelReason ? escapeHtml(cancelReason) : "";
  const ctaUrl = getB2cBaseUrl();

  const bodyHtml = `
    <p style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">Hola ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#0f172a;">${headline}</p>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">${description}</p>

    <div style="margin:0 0 20px 0;">
      <span style="${getStatusBadgeStyles(input.status)}">${escapeHtml(statusLabel)}</span>
    </div>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
      <div style="display:grid;grid-template-columns:1fr;row-gap:10px;">
        <div style="font-size:13px;color:#64748b;"><strong style="color:#0f172a;">Local:</strong> ${safeLocalName}</div>
        <div style="font-size:13px;color:#64748b;"><strong style="color:#0f172a;">Fecha y hora:</strong> ${safeDate}</div>
        <div style="font-size:13px;color:#64748b;"><strong style="color:#0f172a;">Tipo:</strong> ${safeType}</div>
        <div style="font-size:13px;color:#64748b;"><strong style="color:#0f172a;">Personas:</strong> ${safePeople}</div>
        <div style="font-size:13px;color:#64748b;"><strong style="color:#0f172a;">Estado:</strong> ${escapeHtml(statusLabel)}</div>
      </div>
    </div>

    ${
      safeCancelReason
        ? `<div style="margin-top:16px;border-left:4px solid #f97316;background:#fff7ed;padding:12px 14px;font-size:13px;line-height:1.5;color:#7c2d12;">
             <strong>Motivo informado por el local:</strong><br/>${safeCancelReason}
           </div>`
        : ""
    }
  `;

  const html = renderEmailShell({
    title: "Actualización de reserva",
    subtitle: "Notificación automática de estado",
    bodyHtml,
    ctaLabel: "Explorar en Tairet",
    ctaHref: ctaUrl,
  });

  return { subject, html };
}

/**
 * Envía un email usando Resend.
 * Si EMAIL_ENABLED !== 'true' o no hay API key, solo loguea (stub).
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!resend || process.env.EMAIL_ENABLED !== "true") {
    logger.info("[EMAIL STUB]", { to: options.to, subject: options.subject });
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "noreply@example.com",
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    if (error) {
      logger.error("Error sending email via Resend", {
        to: options.to,
        subject: options.subject,
        error: error.message,
      });
      throw new Error(error.message);
    }

    logger.info("Email sent successfully", {
      to: options.to,
      subject: options.subject,
    });
  } catch (err) {
    logger.error("Failed to send email", {
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Email de confirmación de recepción de reserva
 */
export async function sendReservationReceivedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  const template = renderReservationEmail({
    ...payload,
    status: "pending",
    reservationType: "Reserva",
  });

  await sendEmail({
    to: payload.email,
    subject: template.subject,
    html: template.html,
  });
}

/**
 * Email de confirmación de reserva aprobada
 */
export async function sendReservationConfirmedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  const template = renderReservationEmail({
    ...payload,
    status: "confirmed",
    reservationType: "Reserva",
  });

  await sendEmail({
    to: payload.email,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendReservationCancelledEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
  cancelReason?: string;
}): Promise<void> {
  const template = renderReservationEmail({
    ...payload,
    status: "cancelled",
    reservationType: "Reserva",
  });

  await sendEmail({
    to: payload.email,
    subject: template.subject,
    html: template.html,
  });
}

/**
 * Email de confirmación de orden/compra con token de check-in y QR visual
 */
export async function sendOrderConfirmationEmail(data: {
  email: string;
  name: string;
  orderId: string;
  checkinToken: string;
  localName?: string;
  quantity?: number;
  totalAmount?: number;
}): Promise<void> {
  const isFreePass = data.totalAmount === 0 || data.totalAmount === undefined;
  const subject = isFreePass ? "Tu Free Pass está listo" : "Compra confirmada";
  const safeName = escapeHtml(data.name || "Cliente");
  const safeLocalName = data.localName?.trim() ? escapeHtml(data.localName.trim()) : null;
  const safeQuantity =
    typeof data.quantity === "number" && Number.isFinite(data.quantity)
      ? escapeHtml(String(data.quantity))
      : null;
  const safeTotalAmount =
    !isFreePass && typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount)
      ? escapeHtml(data.totalAmount.toLocaleString("es-PY"))
      : null;
  const safeCheckinToken = escapeHtml(data.checkinToken);

  // Generar QR como PNG (best-effort)
  let qrBase64: string | null = null;
  try {
    const qrBuffer = await QRCode.toBuffer(data.checkinToken, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 720,
    });
    qrBase64 = qrBuffer.toString("base64");
  } catch (err) {
    logger.warn("Failed to generate QR code for email", {
      orderId: data.orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Continuar sin QR - fallback a solo token texto
  }

  // HTML con QR si está disponible, siempre con token texto como fallback
  const qrHtml = qrBase64
    ? `
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
            Si el código no se lee bien, abrí el adjunto <strong>TAIRET-QR.png</strong> en pantalla completa.
          </p>
          <img src="cid:checkin-qr" alt="Código QR" style="width: 320px; max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>
      `
    : "";

  await sendEmail({
    to: data.email,
    subject,
    html: renderEmailShell({
      title: isFreePass ? "Tu Free Pass está listo" : "Compra confirmada",
      subtitle: "Notificación automática de entradas",
      bodyHtml: `
        <p style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">Hola ${safeName},</p>
        <p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:#0f172a;">
          ${isFreePass ? "Tu Free Pass está listo." : "Tu compra ha sido confirmada."}
        </p>

        ${
          safeLocalName
            ? `<p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Local:</strong> ${safeLocalName}</p>`
            : ""
        }
        ${
          safeQuantity
            ? `<p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Cantidad:</strong> ${safeQuantity} entrada(s)</p>`
            : ""
        }
        ${
          safeTotalAmount
            ? `<p style="margin:0 0 16px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Total:</strong> ${safeTotalAmount} PYG</p>`
            : ""
        }

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="margin-top: 0;">Tu código de entrada</h3>
          ${qrHtml}
          <p style="font-size: 11px; color: #333; word-break: break-all; font-family: monospace; background: white; padding: 15px; border-radius: 4px; border: 1px solid #ddd;">
            ${safeCheckinToken}
          </p>
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">
            ${qrBase64 ? "Escanea el QR o presenta" : "Presenta"} este código al llegar.
          </p>
        </div>
      `,
      ctaLabel: "Explorar en Tairet",
      ctaHref: getB2cBaseUrl(),
      footerText: "Este es un mensaje automático, por favor no respondas a este email.",
    }),
    attachments: qrBase64
      ? [
          {
            filename: "checkin-qr-inline.png",
            content: qrBase64,
            contentType: "image/png",
            contentId: "checkin-qr",
          },
          {
            filename: "TAIRET-QR.png",
            content: qrBase64,
            contentType: "image/png",
          },
        ]
      : undefined,
  });
}
