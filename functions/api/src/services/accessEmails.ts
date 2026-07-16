import {
  AccessEmailMessageError,
  normalizeAccessEmailAddress,
  renderAccessEntriesEmailContent,
  type RenderedAccessEntriesEmailContent,
} from "./accessEmailMessage";
import { generateAccessEntryQrPng } from "./accessQr";
import { sendEmail } from "./emails";
import { supabase } from "./supabase";
import { logger } from "../utils/logger";

export { buildAccessEntriesEmailHtml } from "./accessEmailMessage";

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

function getEmailConfigErrorCode(): string | null {
  if (process.env.EMAIL_ENABLED !== "true") return "email_disabled";
  if (!process.env.RESEND_API_KEY?.trim()) return "resend_api_key_missing";
  if (!process.env.EMAIL_FROM_ADDRESS?.trim()) return "email_from_missing";
  return null;
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

  let buyerEmail: string;
  try {
    buyerEmail = normalizeAccessEmailAddress(order.buyer_email);
  } catch {
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
  const claimedEntryById = new Map(
    claimedEntries.map((entry) => [entry.id, entry]),
  );
  const legacyOrderedClaimedEntries = notSentEntries
    .map((entry) => claimedEntryById.get(entry.id))
    .filter((entry): entry is AccessEntryEmailRow => entry !== undefined);
  let renderedEmail: RenderedAccessEntriesEmailContent;

  try {
    renderedEmail = await renderAccessEntriesEmailContent(
      {
        buyerName:
          `${order.buyer_name} ${order.buyer_last_name}`.trim() || "Cliente",
        publicRef,
        sourceName,
        accessDate: order.access_date,
        entries: legacyOrderedClaimedEntries.map((entry) => {
          const item = itemById.get(entry.order_item_id);
          return {
            id: entry.id,
            orderItemId: entry.order_item_id,
            unitIndex: entry.unit_index,
            ticketName: item?.name_snapshot ?? "Entrada",
            attendeeName: entry.attendee_name,
            attendeeLastName: entry.attendee_last_name,
            checkinToken: entry.checkin_token,
          };
        }),
      },
      generateAccessEntryQrPng,
    );
  } catch (error) {
    const errorCode =
      error instanceof AccessEmailMessageError &&
      error.code === "qr_generation_failed"
        ? "qr_generation_failed"
        : "email_send_failed";
    logger.error(
      errorCode === "qr_generation_failed"
        ? "Failed to generate Access Core QR for email"
        : "Failed to build Access Core entries email",
      {
        publicRef,
        entriesClaimed: claimedEntries.length,
        emailStatus: "failed",
        errorCode,
        error:
          error instanceof AccessEmailMessageError
            ? error.code
            : "email_render_failed",
      },
    );
    await markAccessEntriesEmailFailed(order.id, publicRef, claimedIds);
    return result("failed", claimedEntries.length, 0, errorCode);
  }

  try {
    await sendEmail({
      to: buyerEmail,
      subject: renderedEmail.subject,
      html: renderedEmail.html,
      attachments: renderedEmail.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
      })),
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
