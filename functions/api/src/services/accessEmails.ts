import { generateAccessEntryQrPng } from "./accessQr";
import { sendEmail, type EmailAttachment } from "./emails";
import { supabase } from "./supabase";
import { logger } from "../utils/logger";

type EmailDeliveryStatus =
  | "sent"
  | "skipped_already_sent"
  | "skipped_failed"
  | "failed"
  | "no_entries";

export interface AccessOrderEntriesEmailResult {
  ok: boolean;
  status: EmailDeliveryStatus;
  entriesClaimed: number;
  entriesSent: number;
  errorCode?: string;
}

interface SendAccessOrderEntriesEmailInput {
  orderId: string;
  publicRef?: string | null;
}

interface AccessOrderEmailRow {
  id: string;
  public_ref: string;
  source_type: "local" | "event";
  local_id: string | null;
  event_id: string | null;
  access_date: string;
  buyer_name: string;
  buyer_last_name: string;
  buyer_email: string;
  status: string;
}

interface AccessOrderItemEmailRow {
  id: string;
  name_snapshot: string;
  quantity: number;
  entries_per_unit: number;
}

interface AccessEntryEmailRow {
  id: string;
  order_item_id: string;
  unit_index: number;
  checkin_token: string;
  attendee_name: string;
  attendee_last_name: string;
  status: string;
  checkin_status: string;
  email_status: "not_sent" | "sent" | "failed";
}

interface AccessEntryEmailBundleEntry {
  ticketName: string;
  attendeeName: string;
  attendeeLastName: string;
  unitIndex: number;
  qrPngBuffer: Buffer;
  contentId: string;
}

interface AccessEntriesEmailHtmlInput {
  buyerName: string;
  publicRef: string;
  sourceName: string;
  accessDate: string;
  entries: AccessEntryEmailBundleEntry[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function result(
  status: EmailDeliveryStatus,
  entriesClaimed: number,
  entriesSent: number,
  errorCode?: string
): AccessOrderEntriesEmailResult {
  return {
    ok: status === "sent" || status === "skipped_already_sent" || status === "skipped_failed",
    status,
    entriesClaimed,
    entriesSent,
    ...(errorCode ? { errorCode } : {}),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEmailConfigErrorCode(): string | null {
  if (process.env.EMAIL_ENABLED !== "true") return "email_disabled";
  if (!process.env.RESEND_API_KEY?.trim()) return "resend_api_key_missing";
  if (!process.env.EMAIL_FROM_ADDRESS?.trim()) return "email_from_missing";
  return null;
}

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function formatAccessDate(accessDate: string): string {
  const [year, month, day] = accessDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return accessDate;

  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(parsedDate.getTime())) return accessDate;

  return parsedDate.toLocaleDateString("es-PY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function fetchSourceName(order: AccessOrderEmailRow): Promise<string | null> {
  if (order.source_type === "local" && order.local_id) {
    const { data, error } = await supabase
      .from("locals")
      .select("name")
      .eq("id", order.local_id)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to fetch Access Core local email context", {
        publicRef: order.public_ref,
        errorCode: "source_context_fetch_failed",
        error: error.message,
      });
      return null;
    }

    return readString((data as { name?: unknown } | null)?.name);
  }

  if (order.source_type === "event" && order.event_id) {
    const { data, error } = await supabase
      .from("events")
      .select("title")
      .eq("id", order.event_id)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to fetch Access Core event email context", {
        publicRef: order.public_ref,
        errorCode: "source_context_fetch_failed",
        error: error.message,
      });
      return null;
    }

    return readString((data as { title?: unknown } | null)?.title);
  }

  return null;
}

async function fetchOrder(orderId: string, publicRefForLog: string | null): Promise<AccessOrderEmailRow | null> {
  const { data, error } = await supabase
    .from("access_orders")
    .select(
      "id, public_ref, source_type, local_id, event_id, access_date, buyer_name, buyer_last_name, buyer_email, status"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to fetch Access Core order for email", {
      publicRef: publicRefForLog ?? "unknown",
      errorCode: "order_fetch_failed",
      error: error.message,
    });
    return null;
  }

  return data as AccessOrderEmailRow | null;
}

async function fetchOrderItems(orderId: string, publicRef: string): Promise<AccessOrderItemEmailRow[] | null> {
  const { data, error } = await supabase
    .from("access_order_items")
    .select("id, name_snapshot, quantity, entries_per_unit")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Failed to fetch Access Core order items for email", {
      publicRef,
      errorCode: "order_items_fetch_failed",
      error: error.message,
    });
    return null;
  }

  return (data ?? []) as AccessOrderItemEmailRow[];
}

async function fetchEntries(orderId: string, publicRef: string): Promise<AccessEntryEmailRow[] | null> {
  const { data, error } = await supabase
    .from("access_entries")
    .select("id, order_item_id, unit_index, checkin_token, attendee_name, attendee_last_name, status, checkin_status, email_status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Failed to fetch Access Core entries for email", {
      publicRef,
      errorCode: "entries_fetch_failed",
      error: error.message,
    });
    return null;
  }

  return (data ?? []) as AccessEntryEmailRow[];
}

async function claimAccessEntriesForEmail(
  orderId: string,
  publicRef: string,
  entryIds: string[]
): Promise<AccessEntryEmailRow[] | null> {
  if (entryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("access_entries")
    .update({
      email_status: "failed",
      email_sent_at: null,
    })
    .eq("order_id", orderId)
    .eq("email_status", "not_sent")
    .in("id", entryIds)
    .select("id, order_item_id, unit_index, checkin_token, attendee_name, attendee_last_name, status, checkin_status, email_status");

  if (error) {
    logger.error("Failed to claim Access Core entries for email", {
      publicRef,
      errorCode: "entries_claim_failed",
      error: error.message,
    });
    return null;
  }

  return (data ?? []) as AccessEntryEmailRow[];
}

async function markAccessEntriesEmailSent(
  orderId: string,
  publicRef: string,
  entryIds: string[],
  sentAt: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("access_entries")
    .update({
      email_status: "sent",
      email_sent_at: sentAt,
    })
    .eq("order_id", orderId)
    .eq("email_status", "failed")
    .in("id", entryIds)
    .select("id");

  if (error) {
    logger.error("Failed to mark Access Core entries email sent", {
      publicRef,
      errorCode: "email_sent_update_failed",
      error: error.message,
    });
    return null;
  }

  return data?.length ?? 0;
}

async function markAccessEntriesEmailFailed(
  orderId: string,
  publicRef: string,
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return;

  const { error } = await supabase
    .from("access_entries")
    .update({
      email_status: "failed",
      email_sent_at: null,
    })
    .eq("order_id", orderId)
    .in("id", entryIds);

  if (error) {
    logger.error("Failed to mark Access Core entries email failed", {
      publicRef,
      errorCode: "email_failed_update_failed",
      error: error.message,
    });
  }
}

export function buildAccessEntriesEmailHtml(input: AccessEntriesEmailHtmlInput): string {
  const safeBuyerName = escapeHtml(input.buyerName || "Cliente");
  const safePublicRef = escapeHtml(input.publicRef);
  const safeSourceName = escapeHtml(input.sourceName);
  const safeAccessDate = escapeHtml(formatAccessDate(input.accessDate));
  const totalEntries = input.entries.length;
  const ticketNames = Array.from(
    new Set(input.entries.map((entry) => entry.ticketName.trim()).filter(Boolean))
  );
  const safeTicketSummary = ticketNames.length > 0
    ? escapeHtml(ticketNames.join(", "))
    : "Entradas emitidas";

  const entrySections = input.entries
    .map((entry, index) => {
      const attendeeFullName = `${entry.attendeeName} ${entry.attendeeLastName}`.trim();
      const safeAttendeeName = escapeHtml(attendeeFullName || "Asistente");
      const safeTicketName = escapeHtml(entry.ticketName || "Entrada");
      const safeContentId = escapeHtml(entry.contentId);

      return `
        <div style="margin:0 0 22px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
          <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Entrada ${index + 1} de ${totalEntries}</p>
          <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;"><strong>Tipo:</strong> ${safeTicketName}</p>
          <p style="margin:0 0 14px 0;font-size:15px;color:#0f172a;"><strong>Asistente:</strong> ${safeAttendeeName}</p>
          <div style="text-align:center;margin:12px 0 4px 0;">
            <img src="cid:${safeContentId}" alt="Código QR de entrada ${index + 1}" style="width:260px;max-width:100%;height:auto;display:block;margin:0 auto;" />
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #eef2f7;background:#0f172a;">
          <div style="font-size:12px;letter-spacing:0.16em;color:#94a3b8;font-weight:700;text-transform:uppercase;">Tairet</div>
          <div style="margin-top:8px;font-size:24px;font-weight:800;color:#ffffff;">Tus entradas están listas</div>
          <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">Guardá este email y presentá cada QR en puerta.</div>
        </div>
        <div style="padding:28px;background:#ffffff;">
          <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hola ${safeBuyerName},</p>
          <p style="margin:0 0 18px 0;font-size:16px;color:#334155;">Tu pago fue confirmado y tus entradas ya fueron emitidas.</p>

          <div style="margin:0 0 24px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Referencia:</strong> ${safePublicRef}</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Lugar o evento:</strong> ${safeSourceName}</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Fecha:</strong> ${safeAccessDate}</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Cantidad de entradas:</strong> ${totalEntries}</p>
            <p style="margin:0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Tipos:</strong> ${safeTicketSummary}</p>
          </div>

          ${entrySections}

          <p style="margin:0 0 8px 0;font-size:14px;color:#475569;">No compartas estos QR; cada código es único para un acceso.</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Si algún código no se lee bien, abrí la imagen PNG correspondiente en pantalla completa.</p>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #eef2f7;background:#ffffff;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Este es un mensaje automático de Tairet.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendAccessOrderEntriesEmail(
  input: SendAccessOrderEntriesEmailInput
): Promise<AccessOrderEntriesEmailResult> {
  const order = await fetchOrder(input.orderId, input.publicRef ?? null);
  const publicRef = order?.public_ref ?? input.publicRef ?? "unknown";

  if (!order) {
    return result("failed", 0, 0, "order_not_found");
  }

  if (order.status !== "paid") {
    return result("failed", 0, 0, "order_not_paid");
  }

  const entries = await fetchEntries(order.id, publicRef);
  if (!entries) {
    return result("failed", 0, 0, "entries_fetch_failed");
  }

  if (entries.length === 0) {
    return result("no_entries", 0, 0, "entries_not_found");
  }

  const notSentEntries = entries.filter((entry) => entry.email_status === "not_sent");
  if (notSentEntries.length === 0) {
    if (entries.every((entry) => entry.email_status === "sent")) {
      return result("skipped_already_sent", 0, 0);
    }

    return result("skipped_failed", 0, 0, "entries_previously_failed");
  }

  const claimedEntries = await claimAccessEntriesForEmail(
    order.id,
    publicRef,
    notSentEntries.map((entry) => entry.id)
  );

  if (!claimedEntries) {
    return result("failed", 0, 0, "entries_claim_failed");
  }

  if (claimedEntries.length === 0) {
    const refreshedEntries = await fetchEntries(order.id, publicRef);
    if (refreshedEntries?.every((entry) => entry.email_status === "sent")) {
      return result("skipped_already_sent", 0, 0);
    }

    return result("skipped_failed", 0, 0, "entries_claimed_elsewhere");
  }

  const claimedIds = claimedEntries.map((entry) => entry.id);
  const configErrorCode = getEmailConfigErrorCode();
  if (configErrorCode) {
    logger.warn("Access Core email configuration missing", {
      publicRef,
      entriesClaimed: claimedEntries.length,
      emailStatus: "failed",
      errorCode: configErrorCode,
    });
    return result("failed", claimedEntries.length, 0, configErrorCode);
  }

  const buyerEmail = normalizeEmail(order.buyer_email);
  if (!buyerEmail) {
    return result("failed", claimedEntries.length, 0, "buyer_email_invalid");
  }

  if (claimedEntries.some((entry) => entry.status !== "issued" || entry.checkin_status !== "unused")) {
    return result("failed", claimedEntries.length, 0, "entry_not_issuable");
  }

  const orderItems = await fetchOrderItems(order.id, publicRef);
  if (!orderItems) {
    return result("failed", claimedEntries.length, 0, "order_items_fetch_failed");
  }

  const itemById = new Map(orderItems.map((item) => [item.id, item]));
  const sourceName = (await fetchSourceName(order)) ?? "Tairet";
  const emailEntries: AccessEntryEmailBundleEntry[] = [];

  try {
    for (const [index, entry] of claimedEntries.entries()) {
      const item = itemById.get(entry.order_item_id);
      emailEntries.push({
        ticketName: item?.name_snapshot ?? "Entrada",
        attendeeName: entry.attendee_name,
        attendeeLastName: entry.attendee_last_name,
        unitIndex: entry.unit_index,
        qrPngBuffer: await generateAccessEntryQrPng(entry.checkin_token),
        contentId: `access-entry-qr-${index + 1}`,
      });
    }
  } catch (error) {
    logger.error("Failed to generate Access Core QR for email", {
      publicRef,
      entriesClaimed: claimedEntries.length,
      emailStatus: "failed",
      errorCode: "qr_generation_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    await markAccessEntriesEmailFailed(order.id, publicRef, claimedIds);
    return result("failed", claimedEntries.length, 0, "qr_generation_failed");
  }

  const attachments: EmailAttachment[] = emailEntries.map((entry, index) => ({
    filename: `entrada-${index + 1}.png`,
    content: entry.qrPngBuffer.toString("base64"),
    contentType: "image/png",
    contentId: entry.contentId,
  }));

  try {
    await sendEmail({
      to: buyerEmail,
      subject: "Tus entradas Tairet están listas",
      html: buildAccessEntriesEmailHtml({
        buyerName: `${order.buyer_name} ${order.buyer_last_name}`.trim() || "Cliente",
        publicRef,
        sourceName,
        accessDate: order.access_date,
        entries: emailEntries,
      }),
      attachments,
    });
  } catch (error) {
    logger.error("Failed to send Access Core entries email", {
      publicRef,
      entriesClaimed: claimedEntries.length,
      emailStatus: "failed",
      errorCode: "email_send_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    await markAccessEntriesEmailFailed(order.id, publicRef, claimedIds);
    return result("failed", claimedEntries.length, 0, "email_send_failed");
  }

  const sentAt = new Date().toISOString();
  const updatedCount = await markAccessEntriesEmailSent(order.id, publicRef, claimedIds, sentAt);
  if (updatedCount !== claimedEntries.length) {
    const errorCode = updatedCount === null
      ? "email_sent_update_failed"
      : "email_sent_partial_update_failed";

    logger.error("Access Core entries email sent but status update failed", {
      publicRef,
      entriesClaimed: claimedEntries.length,
      entriesSent: updatedCount ?? 0,
      emailStatus: "failed",
      errorCode,
    });

    return result(
      "failed",
      claimedEntries.length,
      updatedCount ?? 0,
      errorCode
    );
  }

  return result("sent", claimedEntries.length, updatedCount);
}
