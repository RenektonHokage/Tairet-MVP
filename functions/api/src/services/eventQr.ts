import QRCode from "qrcode";

const DEFAULT_QR_BASE_URL = "https://tairet.com.py";

export function getEventQrBaseUrl(): string {
  const configuredBaseUrl = process.env.B2C_BASE_URL?.trim();
  return configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl.replace(/\/+$/, "")
    : DEFAULT_QR_BASE_URL;
}

export function buildEventEntryQrPayload(checkinToken: string): string {
  return `${getEventQrBaseUrl()}/events/checkin/${encodeURIComponent(checkinToken)}`;
}

export async function generateEventEntryQrPng(checkinToken: string): Promise<Buffer> {
  return QRCode.toBuffer(buildEventEntryQrPayload(checkinToken), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
