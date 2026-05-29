import type { Promo } from "@/lib/promos";
import { demoBarAssets, demoClubAssets } from "./assets";
import type { DemoScenario } from "./runtime";
import { demoBar, demoClub } from "./variants";

function clonePromo(item: Promo): Promo {
  return {
    ...item,
  };
}

const barPromoImages = {
  afterOffice: demoBarAssets.promos[0] ?? demoBarAssets.cover,
  groupTable: demoBarAssets.promos[1] ?? demoBarAssets.cover,
  terrace: demoBarAssets.promos[2] ?? demoBarAssets.cover,
};

const clubPromoImages = {
  freePass: demoClubAssets.promos[0] ?? demoClubAssets.cover,
  vipTable: demoClubAssets.promos[1] ?? demoClubAssets.cover,
  birthdayGroup: demoClubAssets.promos[2] ?? demoClubAssets.cover,
};

const DEMO_PROMOS: Record<DemoScenario, Promo[]> = {
  bar: [
    {
      id: "demo-bar-promo-01",
      local_id: demoBar.localId,
      title: "Combo de birra + picada",
      description: "Cerveza bien fria y picada para compartir en mesas de grupo.",
      image_url: barPromoImages.afterOffice,
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-10T21:00:00.000Z",
      updated_at: "2026-03-10T21:00:00.000Z",
      view_count: 482,
    },
    {
      id: "demo-bar-promo-02",
      local_id: demoBar.localId,
      title: "2x1 en mojito",
      description: "Mojitos seleccionados al 2x1 para arrancar la noche en barra.",
      image_url: barPromoImages.groupTable,
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-11T20:15:00.000Z",
      updated_at: "2026-03-11T20:15:00.000Z",
      view_count: 356,
    },
    {
      id: "demo-bar-promo-03",
      local_id: demoBar.localId,
      title: "2x1 en fernet",
      description: "Fernet al 2x1 para reservas confirmadas y grupos de amigos.",
      image_url: barPromoImages.terrace,
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-12T19:40:00.000Z",
      updated_at: "2026-03-12T19:40:00.000Z",
      view_count: 291,
    },
  ],
  discoteca: [
    {
      id: "demo-discoteca-promo-01",
      local_id: demoClub.localId,
      title: "KOALA JACK NIGHT",
      description: "Acceso sin costo para lista confirmada antes de las 00:00.",
      image_url: clubPromoImages.freePass,
      is_active: true,
      sort_order: 0,
      created_at: "2026-03-13T23:00:00.000Z",
      updated_at: "2026-03-13T23:00:00.000Z",
      view_count: 684,
    },
    {
      id: "demo-discoteca-promo-02",
      local_id: demoClub.localId,
      title: "SUMMER SESSIONS",
      description: "Mesa para 8 personas con acceso preferencial y ubicacion junto a pista.",
      image_url: clubPromoImages.vipTable,
      is_active: true,
      sort_order: 1,
      created_at: "2026-03-12T23:30:00.000Z",
      updated_at: "2026-03-12T23:30:00.000Z",
      view_count: 531,
    },
    {
      id: "demo-discoteca-promo-03",
      local_id: demoClub.localId,
      title: "2X1 EN BOTELLAS",
      description: "Beneficio para grupos de 6 o mas con mesa confirmada antes del viernes.",
      image_url: clubPromoImages.birthdayGroup,
      is_active: true,
      sort_order: 2,
      created_at: "2026-03-14T00:10:00.000Z",
      updated_at: "2026-03-14T00:10:00.000Z",
      view_count: 417,
    },
  ],
};

export function getPanelDemoPromos(scenario: DemoScenario): Promo[] {
  return DEMO_PROMOS[scenario].map(clonePromo);
}
