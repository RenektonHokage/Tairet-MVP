const prefetchedUrls = new Set<string>();
const inFlightUrls = new Set<string>();

function canPrefetch(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;

  return true;
}

function scheduleWhenIdle(callback: () => void): void {
  if (typeof window === "undefined") return;

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => callback(), { timeout: 400 });
    return;
  }

  window.setTimeout(callback, 120);
}

export function prefetchImages(urls: Array<string | null | undefined>, limit = 6): void {
  if (!canPrefetch()) return;
  if (!Array.isArray(urls) || urls.length === 0) return;

  const candidates = urls
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0)
    .filter((url) => !prefetchedUrls.has(url) && !inFlightUrls.has(url))
    .slice(0, Math.max(0, limit));

  if (candidates.length === 0) return;

  scheduleWhenIdle(() => {
    candidates.forEach((url) => {
      inFlightUrls.add(url);
      prefetchedUrls.add(url);

      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => {
        inFlightUrls.delete(url);
      };
      img.onerror = () => {
        inFlightUrls.delete(url);
      };
      img.src = url;
    });
  });
}
