export function selectionUrl(ids: readonly string[], validIds: readonly string[], origin: string): string {
  const safe = [...new Set(ids)].filter(id => validIds.includes(id)).slice(0, 30);
  return new URL("/#/halloween", origin).href + (safe.length ? "?seleccion=" + safe.join(",") : "");
}

export function selectedIds(value: string): string[] {
  if (value.startsWith("TAIRET-HW:")) return value.slice(10).split(",");
  const url = new URL(value);
  return (new URLSearchParams(url.hash.startsWith("#/") ? url.hash.split("?")[1] ?? "" : url.search).get("seleccion") ?? "").split(",");
}
