import landingHero from "@/assets/tairet/landing-hero.webp";
import exp1 from "@/assets/tairet/exp-1.webp";
import exp2 from "@/assets/tairet/exp-2.webp";
import zoneAsuncion from "@/assets/tairet/zone-asuncion.webp";
import zoneSanBernardino from "@/assets/tairet/zone-san-bernardino.webp";
import zoneCiudadDelEste from "@/assets/tairet/zone-ciudad-del-este.webp";

export const images = {
  landing: {
    hero: landingHero,
    experiences: {
      promotions: exp1,
      events: exp2,
    },
  },
  zones: {
    asuncion: zoneAsuncion,
    sanBernardino: zoneSanBernardino,
    ciudadDelEste: zoneCiudadDelEste,
  },
} as const;
