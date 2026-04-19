import type { Promo } from "@/lib/promos";
import type { DemoScenario } from "./runtime";

function buildPromoImageDataUrl(input: {
  eyebrow: string;
  title: string;
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
      <text x="94" y="436" fill="#d4d4d8" font-size="34" font-family="Arial, sans-serif">Promo demo para el panel Tairet</text>
      <rect x="92" y="610" rx="28" ry="28" width="322" height="104" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x="136" y="670" fill="#ffffff" font-size="34" font-family="Arial, sans-serif" font-weight="700">Disponible hoy</text>
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
      local_id: "demo-bar",
      title: "2x1 en gin tonic",
      description: "Promo destacada para after office y primeras rondas.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "HAPPY HOUR",
        title: "2x1 Gin Tonic",
        accentFrom: "#f59e0b",
        accentTo: "#ea580c",
        background: "#1f2937",
      }),
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-10T21:00:00.000Z",
      updated_at: "2026-03-10T21:00:00.000Z",
      view_count: 214,
    },
    {
      id: "demo-bar-promo-02",
      local_id: "demo-bar",
      title: "After office extendido",
      description: "Tragos seleccionados y cocina abierta hasta mas tarde.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "AFTER OFFICE",
        title: "After Office",
        accentFrom: "#06b6d4",
        accentTo: "#2563eb",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-11T20:15:00.000Z",
      updated_at: "2026-03-11T20:15:00.000Z",
      view_count: 163,
    },
    {
      id: "demo-bar-promo-03",
      local_id: "demo-bar",
      title: "Tabla + cerveza",
      description: "Combo pensado para grupos chicos y consumo rapido.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "COMBO",
        title: "Tabla + Cerveza",
        accentFrom: "#10b981",
        accentTo: "#059669",
        background: "#172554",
      }),
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-12T19:40:00.000Z",
      updated_at: "2026-03-12T19:40:00.000Z",
      view_count: 118,
    },
    {
      id: "demo-bar-promo-04",
      local_id: "demo-bar",
      title: "Noche acustica jueves",
      description: "Promo pausada para mostrar un ejemplo inactivo en demo.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "JUEVES",
        title: "Noche Acustica",
        accentFrom: "#8b5cf6",
        accentTo: "#7c3aed",
        background: "#111827",
      }),
      is_active: false,
      sort_order: 3,
      created_at: "2026-03-09T22:30:00.000Z",
      updated_at: "2026-03-09T22:30:00.000Z",
      view_count: 47,
    },
  ],
  discoteca: [
    {
      id: "demo-discoteca-promo-01",
      local_id: "demo-discoteca",
      title: "Ladies night VIP",
      description: "Visual fuerte para promo principal de discoteca en demo.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "VIERNES VIP",
        title: "Ladies Night",
        accentFrom: "#ec4899",
        accentTo: "#8b5cf6",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-13T23:00:00.000Z",
      updated_at: "2026-03-13T23:00:00.000Z",
      view_count: 328,
    },
    {
      id: "demo-discoteca-promo-02",
      local_id: "demo-discoteca",
      title: "Entradas anticipadas 2x1",
      description: "Promo de conversion para compras tempranas.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "PREVENTA",
        title: "2x1 Entradas",
        accentFrom: "#3b82f6",
        accentTo: "#06b6d4",
        background: "#0f172a",
      }),
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-12T23:30:00.000Z",
      updated_at: "2026-03-12T23:30:00.000Z",
      view_count: 279,
    },
    {
      id: "demo-discoteca-promo-03",
      local_id: "demo-discoteca",
      title: "Cabina invitada sabado",
      description: "Promo orientada a branding y awareness del evento.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "SATURDAY",
        title: "Cabina Invitada",
        accentFrom: "#22c55e",
        accentTo: "#14b8a6",
        background: "#111827",
      }),
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-14T00:10:00.000Z",
      updated_at: "2026-03-14T00:10:00.000Z",
      view_count: 241,
    },
    {
      id: "demo-discoteca-promo-04",
      local_id: "demo-discoteca",
      title: "After sunday session",
      description: "Ejemplo inactivo para completar la grilla demo.",
      image_url: buildPromoImageDataUrl({
        eyebrow: "SUNDAY",
        title: "After Session",
        accentFrom: "#f97316",
        accentTo: "#ef4444",
        background: "#1f2937",
      }),
      is_active: false,
      sort_order: 3,
      created_at: "2026-03-15T01:00:00.000Z",
      updated_at: "2026-03-15T01:00:00.000Z",
      view_count: 89,
    },
  ],
};

export function getPanelDemoPromos(scenario: DemoScenario): Promo[] {
  return DEMO_PROMOS[scenario].map(clonePromo);
}
