import { createHash } from "node:crypto";

import { generateAccessEntryQrPngForBaseUrl } from "./accessQr";

/**
 * Bump this version whenever any provider-bound field, rendering, or QR changes.
 */
export const ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION = "access-entries-v1";
export const ACCESS_ENTRIES_EMAIL_SUBJECT = "Tus entradas Tairet están listas";

export interface AccessEmailAttachment {
  readonly filename: string;
  readonly content: string;
  readonly contentType: string;
  readonly contentId?: string;
}

export interface AccessEmailMessage {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly attachments: readonly AccessEmailAttachment[];
}

export interface AccessEntriesEmailEntry {
  readonly id: string;
  readonly orderItemId: string;
  readonly unitIndex: number;
  readonly ticketName: string;
  readonly attendeeName: string;
  readonly attendeeLastName: string;
  readonly checkinToken: string;
}

export interface AccessEntriesEmailMessageInput {
  readonly from: string;
  readonly buyerEmail: string;
  readonly buyerName: string;
  readonly publicRef: string;
  readonly sourceName: string;
  readonly accessDate: string;
  readonly qrBaseUrl: string;
  readonly entries: readonly AccessEntriesEmailEntry[];
}

export interface AccessEntriesEmailRenderInput {
  readonly buyerName: string;
  readonly publicRef: string;
  readonly sourceName: string;
  readonly accessDate: string;
  readonly entries: readonly AccessEntriesEmailEntry[];
}

export type AccessEntryQrPngGenerator = (
  checkinToken: string,
) => Promise<Buffer>;

export interface RenderedAccessEntriesEmailContent {
  readonly subject: typeof ACCESS_ENTRIES_EMAIL_SUBJECT;
  readonly html: string;
  readonly attachments: readonly AccessEmailAttachment[];
}

export interface BuiltAccessEntriesEmailMessage {
  readonly templateVersion: typeof ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION;
  readonly entryIds: readonly string[];
  readonly message: AccessEmailMessage;
  readonly requestPayloadHash: string;
}

export type AccessEmailMessageErrorCode =
  | "duplicate_entry_id"
  | "invalid_entry"
  | "invalid_access_date"
  | "invalid_from"
  | "invalid_recipient"
  | "invalid_template_version"
  | "qr_generation_failed";

export class AccessEmailMessageError extends Error {
  constructor(readonly code: AccessEmailMessageErrorCode) {
    super(code);
    this.name = "AccessEmailMessageError";
  }
}

interface AccessEntriesEmailHtmlEntry {
  readonly ticketName: string;
  readonly attendeeName: string;
  readonly attendeeLastName: string;
  readonly contentId: string;
}

export interface AccessEntriesEmailHtmlInput {
  readonly buyerName: string;
  readonly publicRef: string;
  readonly sourceName: string;
  readonly accessDate: string;
  readonly entries: readonly AccessEntriesEmailHtmlEntry[];
}

export interface AccessEmailRequestPayloadHashInput {
  readonly templateVersion: string;
  readonly message: AccessEmailMessage;
}

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAMED_FROM_PATTERN = /^([^<>]+)<([^<>]+)>$/;
const ACCESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS_ES: readonly string[] = Object.freeze([
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
]);
const MONTHS_ES: readonly string[] = Object.freeze([
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeUuid(value: string): string {
  if (typeof value !== "string") {
    throw new AccessEmailMessageError("invalid_entry");
  }
  const normalized = value.trim().toLowerCase();
  if (!CANONICAL_UUID_PATTERN.test(normalized)) {
    throw new AccessEmailMessageError("invalid_entry");
  }
  return normalized;
}

function compareUuidBytes(left: string, right: string): number {
  const leftBytes = Buffer.from(left.replaceAll("-", ""), "hex");
  const rightBytes = Buffer.from(right.replaceAll("-", ""), "hex");
  return Buffer.compare(leftBytes, rightBytes);
}

function requireEntryString(value: string): string {
  if (typeof value !== "string") {
    throw new AccessEmailMessageError("invalid_entry");
  }
  return value;
}

export function normalizeAccessEmailAddress(value: string): string {
  if (typeof value !== "string") {
    throw new AccessEmailMessageError("invalid_recipient");
  }
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AccessEmailMessageError("invalid_recipient");
  }
  return normalized;
}

function normalizeAccessEmailFrom(value: string): string {
  if (typeof value !== "string") {
    throw new AccessEmailMessageError("invalid_from");
  }
  const normalized = value.trim();
  if (normalized.includes("\r") || normalized.includes("\n")) {
    throw new AccessEmailMessageError("invalid_from");
  }

  if (
    !normalized.includes("<") &&
    !normalized.includes(">") &&
    EMAIL_PATTERN.test(normalized)
  ) {
    return normalized;
  }

  const namedFrom = NAMED_FROM_PATTERN.exec(normalized);
  const displayName = namedFrom?.[1].trim();
  if (!namedFrom || !displayName) {
    throw new AccessEmailMessageError("invalid_from");
  }

  const address = namedFrom[2].trim();
  try {
    normalizeAccessEmailAddress(address);
    return `${displayName} <${address}>`;
  } catch {
    throw new AccessEmailMessageError("invalid_from");
  }
}

function normalizeAccessEntriesEmailEntries(
  entries: readonly AccessEntriesEmailEntry[],
): readonly AccessEntriesEmailEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AccessEmailMessageError("invalid_entry");
  }

  const seenEntryIds = new Set<string>();
  const normalizedEntries = entries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new AccessEmailMessageError("invalid_entry");
    }
    const id = normalizeUuid(entry.id);
    if (seenEntryIds.has(id)) {
      throw new AccessEmailMessageError("duplicate_entry_id");
    }
    seenEntryIds.add(id);

    if (!Number.isSafeInteger(entry.unitIndex) || entry.unitIndex <= 0) {
      throw new AccessEmailMessageError("invalid_entry");
    }

    const checkinToken = requireEntryString(entry.checkinToken).trim();
    if (!checkinToken) {
      throw new AccessEmailMessageError("invalid_entry");
    }

    return Object.freeze({
      id,
      orderItemId: normalizeUuid(entry.orderItemId),
      unitIndex: entry.unitIndex,
      ticketName: requireEntryString(entry.ticketName),
      attendeeName: requireEntryString(entry.attendeeName),
      attendeeLastName: requireEntryString(entry.attendeeLastName),
      checkinToken,
    });
  });

  return Object.freeze(normalizedEntries);
}

export function canonicalizeAccessEntriesEmailEntries(
  entries: readonly AccessEntriesEmailEntry[],
): readonly AccessEntriesEmailEntry[] {
  const normalizedEntries = normalizeAccessEntriesEmailEntries(entries);

  return Object.freeze([...normalizedEntries].sort((left, right) => {
    const orderItemComparison = compareUuidBytes(left.orderItemId, right.orderItemId);
    if (orderItemComparison !== 0) return orderItemComparison;

    const unitIndexComparison = left.unitIndex - right.unitIndex;
    if (unitIndexComparison !== 0) return unitIndexComparison;

    return compareUuidBytes(left.id, right.id);
  }));
}

interface ParsedAccessDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseAccessDate(accessDate: string): ParsedAccessDate | null {
  if (typeof accessDate !== "string") return null;
  const match = ACCESS_DATE_PATTERN.exec(accessDate);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (year < 1 || month < 1 || month > 12) return null;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  if (day < 1 || day > daysInMonth) return null;

  return Object.freeze({ year, month, day });
}

function formatAccessDate(accessDate: string): string {
  const parsed = parseAccessDate(accessDate);
  if (!parsed) return accessDate;

  const { year, month, day } = parsed;
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const weekdayYear = month < 3 ? year - 1 : year;
  const weekday =
    (weekdayYear +
      Math.floor(weekdayYear / 4) -
      Math.floor(weekdayYear / 100) +
      Math.floor(weekdayYear / 400) +
      monthOffsets[month - 1] +
      day) %
    7;

  return `${WEEKDAYS_ES[weekday]}, ${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

function validateAccessDate(accessDate: string): void {
  if (!parseAccessDate(accessDate)) {
    throw new AccessEmailMessageError("invalid_access_date");
  }
}

export function buildAccessEntriesEmailHtml(input: AccessEntriesEmailHtmlInput): string {
  const safeBuyerName = escapeHtml(input.buyerName || "Cliente");
  const safePublicRef = escapeHtml(input.publicRef);
  const safeSourceName = escapeHtml(input.sourceName);
  const safeAccessDate = escapeHtml(formatAccessDate(input.accessDate));
  const totalEntries = input.entries.length;
  const ticketNames = Array.from(
    new Set(input.entries.map((entry) => entry.ticketName.trim()).filter(Boolean)),
  );
  const safeTicketSummary =
    ticketNames.length > 0 ? escapeHtml(ticketNames.join(", ")) : "Entradas emitidas";

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

export function buildAccessEmailCanonicalRequestPayload(
  input: AccessEmailRequestPayloadHashInput,
): readonly unknown[] {
  if (
    !input.templateVersion ||
    input.templateVersion.trim() !== input.templateVersion
  ) {
    throw new AccessEmailMessageError("invalid_template_version");
  }

  return [
    ["templateVersion", input.templateVersion],
    ["from", input.message.from],
    ["to", [...input.message.to]],
    ["subject", input.message.subject],
    ["html", input.message.html],
    [
      "attachments",
      input.message.attachments.map((attachment) => [
        attachment.filename,
        attachment.content,
        attachment.contentType,
        attachment.contentId ?? null,
      ]),
    ],
  ];
}

export function calculateAccessEmailRequestPayloadHash(
  input: AccessEmailRequestPayloadHashInput,
): string {
  const canonicalPayload = buildAccessEmailCanonicalRequestPayload(input);
  return createHash("sha256")
    .update(JSON.stringify(canonicalPayload), "utf8")
    .digest("hex");
}

function copyAccessEntriesEmailEntriesForRendering(
  entries: readonly AccessEntriesEmailEntry[],
): readonly AccessEntriesEmailEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AccessEmailMessageError("invalid_entry");
  }

  return Object.freeze(entries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new AccessEmailMessageError("invalid_entry");
    }

    return Object.freeze({
      id: entry.id,
      orderItemId: entry.orderItemId,
      unitIndex: entry.unitIndex,
      ticketName: requireEntryString(entry.ticketName),
      attendeeName: requireEntryString(entry.attendeeName),
      attendeeLastName: requireEntryString(entry.attendeeLastName),
      checkinToken: entry.checkinToken,
    });
  }));
}

export async function renderAccessEntriesEmailContent(
  input: AccessEntriesEmailRenderInput,
  generateEntryQrPng: AccessEntryQrPngGenerator,
): Promise<RenderedAccessEntriesEmailContent> {
  const entries = copyAccessEntriesEmailEntriesForRendering(input.entries);
  const attachments: AccessEmailAttachment[] = [];
  const htmlEntries: AccessEntriesEmailHtmlEntry[] = [];

  for (const [index, entry] of entries.entries()) {
    const contentId = `access-entry-qr-${index + 1}`;
    let qrPngBuffer: Buffer;
    try {
      qrPngBuffer = await generateEntryQrPng(entry.checkinToken);
    } catch {
      throw new AccessEmailMessageError("qr_generation_failed");
    }

    attachments.push({
      filename: `entrada-${index + 1}.png`,
      content: qrPngBuffer.toString("base64"),
      contentType: "image/png",
      contentId,
    });
    htmlEntries.push({
      ticketName: entry.ticketName,
      attendeeName: entry.attendeeName,
      attendeeLastName: entry.attendeeLastName,
      contentId,
    });
  }

  const frozenAttachments = Object.freeze(
    attachments.map((attachment) => Object.freeze({ ...attachment })),
  );
  return Object.freeze({
    subject: ACCESS_ENTRIES_EMAIL_SUBJECT,
    html: buildAccessEntriesEmailHtml({
      buyerName: input.buyerName,
      publicRef: input.publicRef,
      sourceName: input.sourceName,
      accessDate: input.accessDate,
      entries: htmlEntries,
    }),
    attachments: frozenAttachments,
  });
}

function freezeAccessEmailMessage(message: AccessEmailMessage): AccessEmailMessage {
  const attachments = Object.freeze(
    message.attachments.map((attachment) => Object.freeze({ ...attachment })),
  );
  return Object.freeze({
    from: message.from,
    to: Object.freeze([...message.to]),
    subject: message.subject,
    html: message.html,
    attachments,
  });
}

export async function buildAccessEntriesEmailMessage(
  input: AccessEntriesEmailMessageInput,
): Promise<BuiltAccessEntriesEmailMessage> {
  const from = normalizeAccessEmailFrom(input.from);
  const recipient = normalizeAccessEmailAddress(input.buyerEmail);
  validateAccessDate(input.accessDate);
  const entries = canonicalizeAccessEntriesEmailEntries(input.entries);
  const rendered = await renderAccessEntriesEmailContent(
    {
      buyerName: input.buyerName,
      publicRef: input.publicRef,
      sourceName: input.sourceName,
      accessDate: input.accessDate,
      entries,
    },
    (checkinToken) =>
      generateAccessEntryQrPngForBaseUrl(checkinToken, input.qrBaseUrl),
  );
  const message = freezeAccessEmailMessage({
    from,
    to: [recipient],
    subject: rendered.subject,
    html: rendered.html,
    attachments: rendered.attachments,
  });
  const requestPayloadHash = calculateAccessEmailRequestPayloadHash({
    templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
    message,
  });

  return Object.freeze({
    templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
    entryIds: Object.freeze(entries.map((entry) => entry.id)),
    message,
    requestPayloadHash,
  });
}
