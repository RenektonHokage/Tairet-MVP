import QRCode from "qrcode";

const DEFAULT_QR_BASE_URL = "https://tairet.com.py";

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

export function buildAccessEntryQrPayload(checkinToken: string): string {
  const normalizedToken = normalizeCheckinToken(checkinToken);
  return `${getAccessQrBaseUrl()}/#/access/checkin/${encodeURIComponent(normalizedToken)}`;
}

export async function generateAccessEntryQrPng(checkinToken: string): Promise<Buffer> {
  return QRCode.toBuffer(buildAccessEntryQrPayload(checkinToken), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
