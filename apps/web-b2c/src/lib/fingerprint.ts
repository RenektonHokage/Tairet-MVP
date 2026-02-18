const STORAGE_KEY = "tairet_fp";

function createFallbackFingerprint() {
  return `fp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateFingerprint() {
  if (typeof window === "undefined") {
    return "server-fingerprint";
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : createFallbackFingerprint();

    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return createFallbackFingerprint();
  }
}
