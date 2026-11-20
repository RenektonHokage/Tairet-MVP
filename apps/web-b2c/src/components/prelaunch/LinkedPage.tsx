import { PublicLayout } from "./PublicLayout";
import { CityView } from "./CityView";
import { BarOwnerPage, ClubOwnerPage, ContactPage, MapPage, OrganizerPage } from "./LinkedPages";
import "./approved-asuncion.css";

const linkedPages = {
  "/asuncion": { page: "asuncion", title: "Asunción", View: CityView },
  "/mapa": { page: "mapa", title: "Mapa", View: MapPage },
  "/contacto": { page: "contact", title: "Contacto", View: ContactPage },
  "/para-locales/bares": { page: "venue-bar", title: "Para bares", View: BarOwnerPage },
  "/para-locales/discotecas": { page: "venue-club", title: "Para discotecas", View: ClubOwnerPage },
  "/para-locales/organizadores": { page: "organizers", title: "Para organizadores", View: OrganizerPage },
} as const;

export default function LinkedPage({ path }: { path: keyof typeof linkedPages }) {
  const { View, page, title } = linkedPages[path];
  return <PublicLayout page={page} title={title}><View /></PublicLayout>;
}
