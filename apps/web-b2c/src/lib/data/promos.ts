// Centralized promo data for B2C
import type { ZonePromo, VenuePromo } from '../types';
import nightclubHero from '@/assets/nightclub-hero.jpg';
import djGuests from '@/assets/dj-guests.jpg';
import afterOffice from '@/assets/after-office.jpg';
import promotionsImg from '@/assets/promotions.jpg';
import reggaetonImg from '@/assets/reggaeton.jpg';
import asuncionCityscape from '@/assets/asuncion-cityscape.jpg';

// ===========================================
// ZONE PROMOS: ASUNCION (used in zona/Asuncion.tsx)
// ===========================================
export const promosAsuncion: ZonePromo[] = [
  {
    id: 1,
    title: "2x1 en tragos hasta las 01:00",
    text: "Válido de jueves a sábado. Cupos limitados.",
    img: promotionsImg,
    cta: "Reservar"
  },
  {
    id: 2,
    title: "Ladies Night",
    text: "Ingreso sin costo para ellas hasta medianoche.",
    img: nightclubHero,
    cta: "Reservar"
  },
  {
    id: 3,
    title: "Mesa con champagne",
    text: "Paquete VIP para 4 personas a precio promo.",
    img: djGuests,
    cta: "WhatsApp"
  },
  {
    id: 4,
    title: "After Office",
    text: "Happy hour extendido para grupos de 6+.",
    img: afterOffice,
    cta: "Ver más"
  },
  {
    id: 5,
    title: "Fiesta temática",
    text: "Dress code y sorpresas toda la noche.",
    img: reggaetonImg,
    cta: "Reservar"
  },
  {
    id: 6,
    title: "Sunset Rooftop",
    text: "Música chill y cocteles de autor.",
    img: asuncionCityscape,
    cta: "Ver más"
  }
];

// ===========================================
// VENUE PROMOS (used in experiencias/Promociones.tsx)
// ===========================================
export const venuePromos: VenuePromo[] = [
  { 
    id: 1,
    venueId: '1',
    venueType: 'bar',
    title: '2x1 en todos los tragos',
    image: '/images/bar.jpg',
  },
  { 
    id: 2,
    venueId: '1',
    venueType: 'club',
    title: '50% OFF en cervezas nacionales',
    image: '/images/bar.jpg',
  },
  { 
    id: 3,
    venueId: '2',
    venueType: 'club',
    title: 'Barra libre toda la noche',
    image: '/images/bar.jpg',
  },
  { 
    id: 4,
    venueId: '2',
    venueType: 'bar',
    title: 'Happy Hour especial',
    image: '/images/bar.jpg',
  },
];
