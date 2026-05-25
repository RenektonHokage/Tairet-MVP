import type { Promo } from "@/lib/promos";
import type { DemoScenario } from "./runtime";
import { demoBar, demoClub } from "./variants";

function buildPromoImageDataUrl(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  accentFrom: string;
  accentTo: string;
  background: string;
}): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${input.title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${input.background}" />
          <stop offset="100%" stop-color="#0b0f14" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${input.accentFrom}" />
          <stop offset="100%" stop-color="${input.accentTo}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#bg)" />
      <circle cx="180" cy="180" r="210" fill="${input.accentFrom}" opacity="0.18" />
      <circle cx="1040" cy="760" r="260" fill="${input.accentTo}" opacity="0.14" />
      <rect x="74" y="82" rx="26" ry="26" width="220" height="52" fill="url(#accent)" opacity="0.92" />
      <text x="112" y="116" fill="#ffffff" font-size="28" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5">${input.eyebrow}</text>
      <text x="92" y="368" fill="#ffffff" font-size="96" font-family="Arial, sans-serif" font-weight="800">${input.title}</text>
      <text x="94" y="436" fill="#d4d4d8" font-size="34" font-family="Arial, sans-serif">${input.subtitle}</text>
      <rect x="92" y="610" rx="28" ry="28" width="322" height="104" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x="136" y="670" fill="#ffffff" font-size="34" font-family="Arial, sans-serif" font-weight="700">${input.cta}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function clonePromo(item: Promo): Promo {
  return {
    ...item,
  };
}

const DEMO_PROMOS: Record<DemoScenario, Promo[]> = {
  bar: [
    {
      id: "demo-bar-promo-01",
      local_id: demoBar.localId,
      title: "After office 2x1",
      description: "Cocteles seleccionados de 18:00 a 20:00 para reservas de grupo.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "HAPPY HOUR",
        title: "2x1 Cocteles",
        subtitle: `${demoBar.name} - 18:00 a 20:00`,
        cta: "Reservar mesa",
        accentFrom: "#f59e0b",
        accentTo: "#ea580c",
        background: "#1f2937",
      }),
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-10T21:00:00.000Z",
      updated_at: "2026-03-10T21:00:00.000Z",
      view_count: 482,
    },
    {
      id: "demo-bar-promo-02",
      local_id: demoBar.localId,
      title: "Picada para 4",
      description: "Tabla compartida y jarra de cerveza para mesas confirmadas antes de las 21:00.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "MESA GRUPAL",
        title: "Picada + Jarra",
        subtitle: `${demoBar.name} - mesas de 4 personas`,
        cta: "Beneficio activo",
        accentFrom: "#06b6d4",
        accentTo: "#2563eb",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-11T20:15:00.000Z",
      updated_at: "2026-03-11T20:15:00.000Z",
      view_count: 356,
    },
    {
      id: "demo-bar-promo-03",
      local_id: demoBar.localId,
      title: "Jueves de terraza",
      description: "Primera ronda bonificada para reservas en terraza con musica en vivo.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "TERRAZA",
        title: "Jueves Terraza",
        subtitle: `${demoBar.name} - noche de cocteles`,
        cta: "Cupos medibles",
        accentFrom: "#10b981",
        accentTo: "#059669",
        background: "#172554",
      }),
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-12T19:40:00.000Z",
      updated_at: "2026-03-12T19:40:00.000Z",
      view_count: 291,
    },
    {
      id: "demo-bar-promo-04",
      local_id: demoBar.localId,
      title: "Cocteles de autor",
      description: "Propuesta pausada para carta de temporada y mesas de arranque temprano.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "CARTA NUEVA",
        title: "Autor Night",
        subtitle: `${demoBar.name} - menu de temporada`,
        cta: "Pausada",
        accentFrom: "#8b5cf6",
        accentTo: "#7c3aed",
        background: "#111827",
      }),
      is_active: false,
      sort_order: 3,
      created_at: "2026-03-09T22:30:00.000Z",
      updated_at: "2026-03-09T22:30:00.000Z",
      view_count: 132,
    },
  ],
  discoteca: [
    {
      id: "demo-discoteca-promo-01",
      local_id: demoClub.localId,
      title: "Free pass hasta medianoche",
      description: "Acceso sin costo para lista confirmada antes de las 00:00.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "LISTA TAIRET",
        title: "Free Pass",
        subtitle: `${demoClub.name} - ingreso hasta 00:00`,
        cta: "Lista abierta",
        accentFrom: "#ec4899",
        accentTo: "#8b5cf6",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-13T23:00:00.000Z",
      updated_at: "2026-03-13T23:00:00.000Z",
      view_count: 684,
    },
    {
      id: "demo-discoteca-promo-02",
      local_id: demoClub.localId,
      title: "Mesa VIP preferencial",
      description: "Mesa para 8 personas con acceso preferencial y ubicacion junto a pista.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "VIP",
        title: "Mesa VIP",
        subtitle: `${demoClub.name} - atencion preferencial`,
        cta: "Reservar mesa",
        accentFrom: "#3b82f6",
        accentTo: "#06b6d4",
        background: "#0f172a",
      }),
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-12T23:30:00.000Z",
      updated_at: "2026-03-12T23:30:00.000Z",
      view_count: 531,
    },
    {
      id: "demo-discoteca-promo-03",
      local_id: demoClub.localId,
      title: "Cumpleaños en grupo",
      description: "Beneficio para grupos de 6 o mas con mesa confirmada antes del viernes.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "GRUPOS",
        title: "Cumple VIP",
        subtitle: `${demoClub.name} - acceso + mesa`,
        cta: "Coordinar grupo",
        accentFrom: "#22c55e",
        accentTo: "#14b8a6",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-14T00:10:00.000Z",
      updated_at: "2026-03-14T00:10:00.000Z",
      view_count: 417,
    },
    {
      id: "demo-discoteca-promo-04",
      local_id: demoClub.localId,
      title: "Noche urbana",
      description: "Campaña pausada para mostrar lineup urbano y preventa de acceso anticipado.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "URBANO",
        title: "Noche Urbana",
        subtitle: `${demoClub.name} - preventa controlada`,
        cta: "Pausada",
        accentFrom: "#f97316",
        accentTo: "#ef4444",
        background: "#1f2937",
      }),
      is_active: false,
      sort_order: 3,
      created_at: "2026-03-15T01:00:00.000Z",
      updated_at: "2026-03-15T01:00:00.000Z",
      view_count: 204,
    },
  ],
};

export function getPanelDemoPromos(scenario: DemoScenario): Promo[] {
  return DEMO_PROMOS[scenario].map(clonePromo);
}
