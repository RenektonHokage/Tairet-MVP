import type {
  CatalogTable,
  CatalogTicket,
  LocalGalleryItem,
  LocalProfile,
  OpeningHoursV1,
} from "@/lib/panel";
import type { DemoScenario } from "./runtime";
import { demoBarAssets, demoClubAssets } from "./assets";
import { demoBar, demoClub } from "./variants";

export interface PanelDemoProfileData {
  profile: LocalProfile;
  tickets: CatalogTicket[];
  tables: CatalogTable[];
}

function buildSurfaceImageDataUrl(input: {
  eyebrow: string;
  title: string;
  accentFrom: string;
  accentTo: string;
  background: string;
}): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${input.title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${input.background}" />
          <stop offset="100%" stop-color="#09090b" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${input.accentFrom}" />
          <stop offset="100%" stop-color="${input.accentTo}" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <circle cx="230" cy="160" r="240" fill="${input.accentFrom}" opacity="0.16" />
      <circle cx="1400" cy="760" r="300" fill="${input.accentTo}" opacity="0.12" />
      <rect x="100" y="86" rx="30" ry="30" width="260" height="60" fill="url(#accent)" opacity="0.96" />
      <text x="138" y="125" fill="#ffffff" font-size="30" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.5">${input.eyebrow}</text>
      <text x="100" y="408" fill="#ffffff" font-size="112" font-family="Arial, sans-serif" font-weight="800">${input.title}</text>
      <text x="102" y="486" fill="#d4d4d8" font-size="38" font-family="Arial, sans-serif">Superficie demo para Perfil del Local</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createOpeningHours(days: Array<{
  key: keyof OpeningHoursV1["days"];
  ranges?: Array<{ start: string; end: string }>;
  closed?: boolean;
}>): OpeningHoursV1 {
  const base: OpeningHoursV1["days"] = {
    mon: { closed: true, ranges: [] },
    tue: { closed: true, ranges: [] },
    wed: { closed: true, ranges: [] },
    thu: { closed: true, ranges: [] },
    fri: { closed: true, ranges: [] },
    sat: { closed: true, ranges: [] },
    sun: { closed: true, ranges: [] },
  };

  days.forEach((day) => {
    base[day.key] = {
      closed: Boolean(day.closed),
      ranges: day.closed ? [] : (day.ranges ?? []),
    };
  });

  return {
    version: 1,
    timezone: "America/Asuncion",
    days: base,
  };
}

function cloneGallery(items: LocalGalleryItem[]): LocalGalleryItem[] {
  return items.map((item) => ({ ...item }));
}

function cloneTickets(items: CatalogTicket[]): CatalogTicket[] {
  return items.map((item) => ({ ...item }));
}

function cloneTables(items: CatalogTable[]): CatalogTable[] {
  return items.map((item) => ({ ...item }));
}

function cloneProfile(profile: LocalProfile): LocalProfile {
  return {
    ...profile,
    hours: [...profile.hours],
    additional_info: [...profile.additional_info],
    gallery: cloneGallery(profile.gallery),
    attributes: [...profile.attributes],
    opening_hours: profile.opening_hours
      ? {
          ...profile.opening_hours,
          days: Object.fromEntries(
            Object.entries(profile.opening_hours.days).map(([key, value]) => [
              key,
              { closed: value.closed, ranges: value.ranges.map((range) => ({ ...range })) },
            ])
          ) as OpeningHoursV1["days"],
        }
      : null,
  };
}

function createGalleryItem(
  localId: string,
  item: Omit<LocalGalleryItem, "local_id" | "path"> & { path?: string }
): LocalGalleryItem {
  return {
    ...item,
    path: item.path ?? `demo/${localId}/${item.kind}/${item.id}`,
  };
}

const BAR_GALLERY: LocalGalleryItem[] = [
  createGalleryItem("demo-bar", {
    id: "demo-bar-cover",
    kind: "cover",
    order: 0,
    url: demoBarAssets.profile.cover,
  }),
  createGalleryItem("demo-bar", {
    id: "demo-bar-hero",
    kind: "hero",
    order: 1,
    url: demoBarAssets.profile.hero ?? demoBarAssets.profile.cover,
  }),
  createGalleryItem("demo-bar", {
    id: "demo-bar-food",
    kind: "food",
    order: 2,
    url: demoBarAssets.profile.gallery[0] ?? demoBarAssets.profile.cover,
  }),
  createGalleryItem("demo-bar", {
    id: "demo-bar-menu",
    kind: "menu",
    order: 4,
    url: demoBarAssets.profile.gallery[1] ?? demoBarAssets.profile.cover,
  }),
  createGalleryItem("demo-bar", {
    id: "demo-bar-drinks",
    kind: "drinks",
    order: 5,
    url: demoBarAssets.profile.gallery[2] ?? demoBarAssets.profile.cover,
  }),
  createGalleryItem("demo-bar", {
    id: "demo-bar-interior",
    kind: "interior",
    order: 3,
    url: demoBarAssets.profile.gallery[3] ?? demoBarAssets.profile.cover,
  }),
];

const CLUB_GALLERY: LocalGalleryItem[] = [
  createGalleryItem("demo-discoteca", {
    id: "demo-club-cover",
    kind: "cover",
    order: 0,
    url: demoClubAssets.profile.cover,
  }),
  createGalleryItem("demo-discoteca", {
    id: "demo-club-hero",
    kind: "hero",
    order: 1,
    url: demoClubAssets.profile.hero ?? demoClubAssets.profile.cover,
  }),
  createGalleryItem("demo-discoteca", {
    id: "demo-club-carousel-01",
    kind: "carousel",
    order: 2,
    url: buildSurfaceImageDataUrl({
      eyebrow: "GALLERY",
      title: "Pista",
      accentFrom: "#22c55e",
      accentTo: "#14b8a6",
      background: "#111827",
    }),
  }),
  createGalleryItem("demo-discoteca", {
    id: "demo-club-carousel-02",
    kind: "carousel",
    order: 3,
    url: buildSurfaceImageDataUrl({
      eyebrow: "GALLERY",
      title: "VIP",
      accentFrom: "#f97316",
      accentTo: "#ef4444",
      background: "#1f2937",
    }),
  }),
  createGalleryItem("demo-discoteca", {
    id: "demo-club-carousel-03",
    kind: "carousel",
    order: 4,
    url: buildSurfaceImageDataUrl({
      eyebrow: "GALLERY",
      title: "Barra",
      accentFrom: "#f59e0b",
      accentTo: "#f97316",
      background: "#111827",
    }),
  }),
];

const BAR_PROFILE: LocalProfile = {
  id: demoBar.localId,
  name: demoBar.name,
  slug: demoBar.slug,
  type: demoBar.type,
  address: "Av. Demo 1234",
  location: "Villa Morra",
  city: "Asuncion",
  latitude: -25.294514,
  longitude: -57.575926,
  hours: [
    "Lun-Jue: 18:00-00:00 hs",
    "Vie-Sab: 18:00-02:00 hs",
    "Dom: Cerrado",
  ],
  opening_hours: createOpeningHours([
    { key: "mon", ranges: [{ start: "18:00", end: "00:00" }] },
    { key: "tue", ranges: [{ start: "18:00", end: "00:00" }] },
    { key: "wed", ranges: [{ start: "18:00", end: "00:00" }] },
    { key: "thu", ranges: [{ start: "18:00", end: "00:00" }] },
    { key: "fri", ranges: [{ start: "18:00", end: "02:00" }] },
    { key: "sat", ranges: [{ start: "18:00", end: "02:00" }] },
    { key: "sun", closed: true },
  ]),
  additional_info: [
    "Happy hour de 18:00 a 20:00 hs",
    "Reservas para grupos por WhatsApp",
    "Estacionamiento cercano",
  ],
  phone: "+595 981 111111",
  whatsapp: "+595 981 111111",
  gallery: BAR_GALLERY,
  attributes: ["Cervezas artesanales", "After Office", "Cocteles"],
  min_age: 18,
};

const CLUB_PROFILE: LocalProfile = {
  id: demoClub.localId,
  name: demoClub.name,
  slug: demoClub.slug,
  type: demoClub.type,
  address: "Av. Central 4321",
  location: "Carmelitas",
  city: "Asuncion",
  latitude: -25.286973,
  longitude: -57.571632,
  hours: [
    "Vie: 23:00-05:00 hs",
    "Sab: 23:00-06:00 hs",
    "Dom: 22:00-03:00 hs",
  ],
  opening_hours: createOpeningHours([
    { key: "fri", ranges: [{ start: "23:00", end: "05:00" }] },
    { key: "sat", ranges: [{ start: "23:00", end: "06:00" }] },
    { key: "sun", ranges: [{ start: "22:00", end: "03:00" }] },
    { key: "mon", closed: true },
    { key: "tue", closed: true },
    { key: "wed", closed: true },
    { key: "thu", closed: true },
  ]),
  additional_info: [
    "Cabina invitada cada sabado",
    "Ingreso por lista hasta 00:30 hs",
    "Consumo minimo en mesas VIP",
  ],
  phone: "+595 981 222222",
  whatsapp: "+595 981 222222",
  gallery: CLUB_GALLERY,
  attributes: ["Reggaeton", "Electronica", "Mix"],
  min_age: 21,
};

const CLUB_TICKETS: CatalogTicket[] = [
  {
    id: "demo-ticket-01",
    name: "General Early Bird",
    price: 45000,
    description: "Acceso general\nIngreso preferencial hasta 00:30 hs",
    is_active: true,
    sort_order: 0,
    created_at: "2026-03-01T03:00:00.000Z",
    updated_at: "2026-03-01T03:00:00.000Z",
  },
  {
    id: "demo-ticket-02",
    name: "VIP + Fast Pass",
    price: 80000,
    description: "Acceso por fila rapida\nPulsera VIP",
    is_active: true,
    sort_order: 1,
    created_at: "2026-03-02T03:00:00.000Z",
    updated_at: "2026-03-02T03:00:00.000Z",
  },
  {
    id: "demo-ticket-03",
    name: "Promo grupo",
    price: 120000,
    description: "Pack para 4 personas",
    is_active: false,
    sort_order: 2,
    created_at: "2026-03-03T03:00:00.000Z",
    updated_at: "2026-03-03T03:00:00.000Z",
  },
];

const CLUB_TABLES: CatalogTable[] = [
  {
    id: "demo-table-01",
    name: "Mesa VIP 6P",
    price: 950000,
    capacity: 6,
    includes: "1 whisky premium\n2 energizantes\nIngreso por acceso VIP",
    is_active: true,
    sort_order: 0,
    created_at: "2026-03-01T03:00:00.000Z",
    updated_at: "2026-03-01T03:00:00.000Z",
  },
  {
    id: "demo-table-02",
    name: "Mesa Premium 10P",
    price: 1500000,
    capacity: 10,
    includes: "2 botellas premium\nMixers incluidos\nHost dedicado",
    is_active: true,
    sort_order: 1,
    created_at: "2026-03-02T03:00:00.000Z",
    updated_at: "2026-03-02T03:00:00.000Z",
  },
  {
    id: "demo-table-03",
    name: "Mesa lateral 4P",
    price: 550000,
    capacity: 4,
    includes: "1 botella seleccionada",
    is_active: false,
    sort_order: 2,
    created_at: "2026-03-03T03:00:00.000Z",
    updated_at: "2026-03-03T03:00:00.000Z",
  },
];

const DEMO_PROFILE_DATA: Record<DemoScenario, PanelDemoProfileData> = {
  bar: {
    profile: BAR_PROFILE,
    tickets: [],
    tables: [],
  },
  discoteca: {
    profile: CLUB_PROFILE,
    tickets: CLUB_TICKETS,
    tables: CLUB_TABLES,
  },
};

export function getPanelDemoProfileData(scenario: DemoScenario): PanelDemoProfileData {
  const data = DEMO_PROFILE_DATA[scenario];
  return {
    profile: cloneProfile(data.profile),
    tickets: cloneTickets(data.tickets),
    tables: cloneTables(data.tables),
  };
}
