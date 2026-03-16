import { getApiBase, getAuthHeaders } from "./api";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseFilenameFromContentDisposition(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = value.match(/filename=\"?([^\";]+)\"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return null;
}

function assertDateOnly(value: string, fieldName: "from" | "to") {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`La fecha ${fieldName} debe tener formato YYYY-MM-DD.`);
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadPanelReservationsClientsFile(params: {
  from: string;
  to: string;
}, format: "csv" | "xlsx"): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("La exportacion solo esta disponible en el navegador.");
  }

  const from = params.from.trim();
  const to = params.to.trim();

  assertDateOnly(from, "from");
  assertDateOnly(to, "to");

  const search = new URLSearchParams({ from, to });
  const headers = await getAuthHeaders();
  const endpoint = `${getApiBase()}/panel/exports/reservations-clients.${format}?${search.toString()}`;

  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Error ${response.status} exportando ${format.toUpperCase()}.`);
    }

    const text = await response.text().catch(() => "");
    throw new Error(text || `Error ${response.status} exportando ${format.toUpperCase()}.`);
  }

  const fileName =
    parseFilenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
    `tairet_reservas_clientes_${from}_a_${to}.${format}`;

  const blob = await response.blob();
  triggerBrowserDownload(blob, fileName);
}

export async function downloadPanelReservationsClientsCsv(params: {
  from: string;
  to: string;
}): Promise<void> {
  return downloadPanelReservationsClientsFile(params, "csv");
}

export async function downloadPanelReservationsClientsExcel(params: {
  from: string;
  to: string;
}): Promise<void> {
  return downloadPanelReservationsClientsFile(params, "xlsx");
}
