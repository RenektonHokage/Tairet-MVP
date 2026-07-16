import QRCode, { type QRCodeToBufferOptions } from "qrcode";

const DEFAULT_QR_BASE_URL = "https://tairet.com.py";

export const ACCESS_ENTRY_QR_PNG_OPTIONS = Object.freeze({
  type: "png",
  errorCorrectionLevel: "M",
  margin: 2,
  width: 512,
} satisfies QRCodeToBufferOptions);

export function getAccessQrBaseUrl(): string {
  const configuredBaseUrl = process.env.B2C_BASE_URL?.trim();
  return configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl.replace(/\/+$/, "")
    : DEFAULT_QR_BASE_URL;
}

function normalizeCheckinToken(checkinToken: string): string {
  const normalized = checkinToken.trim();

  if (!normalized) {
    throw new Error("Invalid check-in token");
  }

  return normalized;
}

function normalizeQrBaseUrl(qrBaseUrl: string): string {
  const normalized = qrBaseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("Invalid QR base URL");
  }

  return normalized;
}

export function buildAccessEntryQrPayloadForBaseUrl(
  checkinToken: string,
  qrBaseUrl: string,
): string {
  const normalizedToken = normalizeCheckinToken(checkinToken);
  const normalizedBaseUrl = normalizeQrBaseUrl(qrBaseUrl);
  return `${normalizedBaseUrl}/#/access/checkin/${encodeURIComponent(normalizedToken)}`;
}

export async function generateAccessEntryQrPngForBaseUrl(
  checkinToken: string,
  qrBaseUrl: string,
): Promise<Buffer> {
  return QRCode.toBuffer(
    buildAccessEntryQrPayloadForBaseUrl(checkinToken, qrBaseUrl),
    { ...ACCESS_ENTRY_QR_PNG_OPTIONS },
  );
}

export function buildAccessEntryQrPayload(checkinToken: string): string {
  const normalizedToken = normalizeCheckinToken(checkinToken);
  return `${getAccessQrBaseUrl()}/#/access/checkin/${encodeURIComponent(normalizedToken)}`;
}

export async function generateAccessEntryQrPng(checkinToken: string): Promise<Buffer> {
  return QRCode.toBuffer(
    buildAccessEntryQrPayload(checkinToken),
    { ...ACCESS_ENTRY_QR_PNG_OPTIONS },
  );
}
