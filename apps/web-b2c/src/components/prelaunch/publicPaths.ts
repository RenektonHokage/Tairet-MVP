// Public destinations linked by the October edition. Operational routes keep their HashRouter URLs.
export const linkedPaths = [
  "/asuncion", "/mapa", "/contacto", "/para-locales/bares", "/para-locales/discotecas", "/para-locales/organizadores",
] as const;

export const octoberPaths = [
  "/inicio", ...linkedPaths, "/halloween", "/zona/asuncion", "/eventos", "/informacion",
  "/sobre/que-es-tairet", "/sobre/como-funciona", "/sobre/preguntas-frecuentes",
  "/para-locales/publica-tu-local", "/para-locales/solicitud",
  "/legal/terminos-condiciones", "/legal/politica-privacidad", "/legal/cookies",
] as const;

const publicPaths = new Set<string>(octoberPaths);
const partyPath = /^\/halloween\/fiesta\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Resolve a public bookmark before the existing HashRouter reads the location. */
export function resolvePublicEntry({ pathname, search, hash }: { pathname: string; search: string; hash: string }): string | undefined {
  const path = pathname.replace(/\/(?:index\.html)?$/, "");
  if (!publicPaths.has(path) && !partyPath.test(path)) return;
  if (hash.startsWith("#/")) return "/" + search + hash;
  return "/#" + (path === "/inicio" ? "/" : path) + search + hash;
}
