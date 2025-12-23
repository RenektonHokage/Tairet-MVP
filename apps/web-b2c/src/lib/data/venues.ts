// Centralized venue data for B2C
import type { Bar, Club, FeaturedVenue, ExperienceVenue, ZoneBar } from '../types';
import dlirioLogoCard from '@/assets/dlirio-logo-card.png';

// ===========================================
// ALL BARS (used in AllBars.tsx)
// ===========================================
export const allBars: Bar[] = [
  { 
    id: 1,
    name: 'Mckharthys Bar', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–02:00', 
    rating: '4.6',
    specialties: ['Cervezas artesanales', 'Cocteles'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 2,
    name: 'Killkenny Pub', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:00–01:00', 
    rating: '4.5',
    specialties: ['Cervezas artesanales', 'Terraza'],
    location: 'Villa Morra • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 3,
    name: 'Morgan Rooftop', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '19:00–03:00', 
    rating: '4.7',
    specialties: ['Cocteles', 'Terraza'],
    location: 'Carmelitas • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 4,
    name: 'Celavie Lounge', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '20:00–02:00', 
    rating: '4.8',
    specialties: ['Cocteles', 'After Office'],
    location: 'Las Mercedes • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 5,
    name: 'Bodega Urbana', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:30–01:30', 
    rating: '4.4',
    specialties: ['Vinos', 'Terraza'],
    location: 'Recoleta • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 6,
    name: 'Río Taproom', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:00–00:00', 
    rating: '4.6',
    specialties: ['Cervezas artesanales', 'After Office'],
    location: 'Costanera • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 7,
    name: 'Alameda Social', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '19:00–02:00', 
    rating: '4.5',
    specialties: ['After Office', 'Música en vivo'],
    location: 'Mburucuyá • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 8,
    name: 'El Arenal Bar', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–01:00', 
    rating: '4.3',
    specialties: ['Cocteles', 'Temáticas'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 9,
    name: 'Vista Panorama', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–02:30', 
    rating: '4.7',
    specialties: ['Terraza', 'Cocteles'],
    location: 'Manora • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 10,
    name: 'Craft Corner', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '16:00–00:00', 
    rating: '4.6',
    specialties: ['Cervezas artesanales', 'After Office'],
    location: 'San Lorenzo • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 11,
    name: 'Moonlight Bar', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '20:00–03:00', 
    rating: '4.4',
    specialties: ['Cocteles', 'Después de las 12 am'],
    location: 'Buceo • Asunción',
    image: '/images/bar.jpg' 
  },
  { 
    id: 12,
    name: 'The Patio', 
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:30–01:30', 
    rating: '4.5',
    specialties: ['Música en vivo', 'Terraza'],
    location: 'Las Carmelitas • Asunción',
    image: '/images/bar.jpg' 
  },
];

// ===========================================
// ALL CLUBS (used in AllClubs.tsx)
// ===========================================
export const allClubs: Club[] = [
  {
    id: 1,
    name: "morgan",
    dateTop: "Vie, 15",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Reggaeton", "Latino"],
    customImage: undefined
  },
  {
    id: 2,
    name: "celavie",
    dateTop: "Sab, 16",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Reggaeton", "Pop"],
    customImage: undefined
  },
  {
    id: 3,
    name: "Mckharthys",
    dateTop: "Vie, 22",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Mix", "Latino"],
    customImage: undefined
  },
  {
    id: 4,
    name: "Killkenny",
    dateTop: "Sab, 23",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Pop", "Mix"],
    customImage: undefined
  },
  {
    id: 5,
    name: "Morgan Rooftop",
    dateTop: "Vie, 29",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.7",
    genres: ["Electronica", "Mix"],
    customImage: undefined
  },
  {
    id: 6,
    name: "Celavie Lounge",
    dateTop: "Sab, 30",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.5",
    genres: ["Pop", "Latino"],
    customImage: undefined
  },
  {
    id: 7,
    name: "DLirio",
    dateTop: "Vie, 05",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Reggaeton", "Electronica"],
    customImage: dlirioLogoCard
  },
  {
    id: 8,
    name: "Triana Night",
    dateTop: "Sab, 06",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.8",
    genres: ["Electronica", "Mix"],
    customImage: undefined
  },
  {
    id: 9,
    name: "Pulse Club",
    dateTop: "Vie, 12",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.7",
    genres: ["Electronica", "Pop"],
    customImage: undefined
  },
  {
    id: 10,
    name: "Mirage",
    dateTop: "Sab, 13",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.5",
    genres: ["Pop", "Mix"],
    customImage: undefined
  },
  {
    id: 11,
    name: "Neon Nights",
    dateTop: "Vie, 19",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.6",
    genres: ["Reggaeton", "Latino"],
    customImage: undefined
  },
  {
    id: 12,
    name: "Sky Lounge",
    dateTop: "Sab, 20",
    dateBottom: "SEP",
    schedule: "23:59–07:00",
    rating: "4.8",
    genres: ["Electronica", "Latino"],
    customImage: undefined
  }
];

// ===========================================
// BARS SECTION VENUES (used in BarsSection.tsx)
// ===========================================
export const barsSectionVenues: Bar[] = [
  {
    id: 1,
    type: 'bar',
    name: 'Mckharthys Bar',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–02:00',
    rating: '4.6',
    specialties: ['Cervezas', 'Cocteles'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 2,
    type: 'bar',
    name: 'Killkenny Pub',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:00–01:00',
    rating: '4.5',
    specialties: ['Cerveza', 'Pub food'],
    location: 'Villa Morra • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 3,
    type: 'bar',
    name: 'Morgan Rooftop',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '19:00–03:00',
    rating: '4.7',
    specialties: ['Autor', 'Terraza'],
    location: 'Carmelitas • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 4,
    type: 'bar',
    name: 'Celavie Lounge',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '20:00–02:00',
    rating: '4.8',
    specialties: ['Lounge', 'Shisha'],
    location: 'Las Mercedes • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 5,
    type: 'bar',
    name: 'Bodega Urbana',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:30–01:30',
    rating: '4.4',
    specialties: ['Vinos', 'Tapas'],
    location: 'Recoleta • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 6,
    type: 'bar',
    name: 'Río Taproom',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:00–00:00',
    rating: '4.6',
    specialties: ['Craft Beer', 'Burgers'],
    location: 'Costanera • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 7,
    type: 'boliche',
    name: 'Alameda Social',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '19:00–02:00',
    rating: '4.5',
    specialties: ['Social', 'After office'],
    location: 'Mburucuyá • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 8,
    type: 'boliche',
    name: 'Pulse Club',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–01:00',
    rating: '4.3',
    specialties: ['Tragos', 'Karaoke'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg'
  }
];

// ===========================================
// FEATURED VENUES (used in TestimonialsSection.tsx)
// ===========================================
export const featuredVenues: FeaturedVenue[] = [
  {
    id: 1,
    name: "La Fernetería",
    image: "/images/bar.jpg",
    dateTop: "Abierto",
    dateBottom: "HOY",
    schedule: "18:00–02:00",
    rating: "4.6",
    specialties: ["Cervezas", "Terraza"],
    slug: "la-ferneteria",
    type: "bar"
  },
  {
    id: 2,
    name: "Negroni",
    image: "/images/bar.jpg",
    dateTop: "Abierto",
    dateBottom: "HOY",
    schedule: "17:00–01:00",
    rating: "4.5",
    specialties: ["Cocteles", "Rooftop"],
    slug: "negroni",
    type: "bar"
  },
  {
    id: 3,
    name: "Kilkenny",
    image: "/images/bar.jpg",
    dateTop: "Abierto",
    dateBottom: "HOY",
    schedule: "17:00–00:00",
    rating: "4.6",
    specialties: ["Cerveza artesanal", "Pub food"],
    slug: "kilkenny",
    type: "bar"
  },
  {
    id: 4,
    name: "Club Vertigo",
    image: "/images/bar.jpg",
    dateTop: "Vie, 15",
    dateBottom: "AGO",
    schedule: "23:59–07:00",
    rating: "4.8",
    specialties: ["Techno", "Electrónica"],
    slug: "vertigo",
    type: "club"
  },
  {
    id: 5,
    name: "Madero Lounge",
    image: "/images/bar.jpg",
    dateTop: "Sab, 16",
    dateBottom: "AGO",
    schedule: "23:00–06:00",
    rating: "4.7",
    specialties: ["House", "VIP Area"],
    slug: "madero-lounge",
    type: "club"
  },
  {
    id: 6,
    name: "Sky Bar",
    image: "/images/bar.jpg",
    dateTop: "Abierto",
    dateBottom: "HOY",
    schedule: "19:00–03:00",
    rating: "4.7",
    specialties: ["Autor", "Vista Panorámica"],
    slug: "sky-bar",
    type: "bar"
  }
];

// ===========================================
// ZONE: ASUNCION CLUBS (used in zona/Asuncion.tsx)
// ===========================================
export const discotecasAsuncion: Club[] = [
  { id: 1, name: "morgan", dateTop: "Vie, 15", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 2, name: "celavie", dateTop: "Sab, 16", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 3, name: "Mckharthys", dateTop: "Vie, 22", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 4, name: "Killkenny", dateTop: "Sab, 23", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 5, name: "Morgan Rooftop", dateTop: "Vie, 29", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.7", genres: ["Techno", "House"] },
  { id: 6, name: "Celavie Lounge", dateTop: "Sab, 30", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.5", genres: ["Comercial", "Pop"] },
  { id: 7, name: "Arenal Club", dateTop: "Vie, 05", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Electro"] },
  { id: 8, name: "Triana Night", dateTop: "Sab, 06", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.8", genres: ["Tech House", "Deep"] }
];

// ===========================================
// ZONE: CIUDAD DEL ESTE CLUBS
// ===========================================
export const discotecasCDE: Club[] = [
  { id: 1, name: "Morgan", dateTop: "Vie, 15", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 2, name: "Celavie", dateTop: "Sab, 16", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 3, name: "Mckharthys", dateTop: "Vie, 22", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 4, name: "Killkenny", dateTop: "Sab, 23", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 5, name: "Morgan Rooftop", dateTop: "Vie, 29", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.7", genres: ["Techno", "House"] },
  { id: 6, name: "Celavie Lounge", dateTop: "Sab, 30", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.5", genres: ["Comercial", "Pop"] },
  { id: 7, name: "Arenal Club", dateTop: "Vie, 05", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Electro"] },
  { id: 8, name: "Triana Night", dateTop: "Sab, 06", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.8", genres: ["Tech House", "Deep"] },
  { id: 9, name: "Puente Vibes", dateTop: "Vie, 12", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.7", genres: ["House", "Chill"] },
  { id: 10, name: "Río Monday", dateTop: "Sab, 13", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.5", genres: ["Comercial", "Pop"] },
  { id: 11, name: "Foz Club", dateTop: "Vie, 19", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Electro"] },
  { id: 12, name: "Parana Lounge", dateTop: "Sab, 20", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.8", genres: ["Deep", "Tech House"] }
];

// ===========================================
// ZONE: SAN BERNARDINO CLUBS
// ===========================================
export const discotecasSanBer: Club[] = [
  { id: 1, name: "Morgan", dateTop: "Vie, 15", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 2, name: "Celavie", dateTop: "Sab, 16", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 3, name: "Mckharthys", dateTop: "Vie, 22", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 4, name: "Killkenny", dateTop: "Sab, 23", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Comercial"] },
  { id: 5, name: "Morgan Rooftop", dateTop: "Vie, 29", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.7", genres: ["Techno", "House"] },
  { id: 6, name: "Celavie Lounge", dateTop: "Sab, 30", dateBottom: "AGO", schedule: "23:59–07:00", rating: "4.5", genres: ["Comercial", "Pop"] },
  { id: 7, name: "Arenal Club", dateTop: "Vie, 05", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Electro"] },
  { id: 8, name: "Triana Night", dateTop: "Sab, 06", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.8", genres: ["Tech House", "Deep"] },
  { id: 9, name: "Río Sunset", dateTop: "Vie, 12", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.7", genres: ["House", "Chill"] },
  { id: 10, name: "Laguna Club", dateTop: "Sab, 13", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.5", genres: ["Comercial", "Pop"] },
  { id: 11, name: "Sanber Vibes", dateTop: "Vie, 19", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.6", genres: ["Reggaeton", "Electro"] },
  { id: 12, name: "Bahía Lounge", dateTop: "Sab, 20", dateBottom: "SEP", schedule: "23:59–07:00", rating: "4.8", genres: ["Deep", "Tech House"] }
];

// ===========================================
// EXPERIENCE: AFTER OFFICE VENUES
// ===========================================
export const afterOfficeVenues: ExperienceVenue[] = [
  {
    id: 1,
    name: 'Alameda Social',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '17:00–01:00',
    rating: '4.5',
    specialties: ['After office', 'Happy hour'],
    location: 'Mburucuyá • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 2,
    name: 'Work & Wine',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '16:00–23:00',
    rating: '4.4',
    specialties: ['Vinos', 'Networking'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 3,
    name: 'Business Lounge',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–00:00',
    rating: '4.6',
    specialties: ['Ejecutivo', 'Cocteles'],
    location: 'Villa Morra • Asunción',
    image: '/images/bar.jpg'
  }
];

// ===========================================
// EXPERIENCE: ROOFTOP VENUES
// ===========================================
export const rooftopVenues: ExperienceVenue[] = [
  {
    id: 1,
    name: 'Morgan Rooftop',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '19:00–03:00',
    rating: '4.7',
    specialties: ['Autor', 'Terraza'],
    location: 'Carmelitas • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 2,
    name: 'Sky Lounge',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '20:00–02:00',
    rating: '4.8',
    specialties: ['Vista panorámica', 'Cocteles'],
    location: 'Centro • Asunción',
    image: '/images/bar.jpg'
  },
  {
    id: 3,
    name: 'Altitude Bar',
    dateTop: 'Abierto',
    dateBottom: 'HOY',
    schedule: '18:00–01:00',
    rating: '4.6',
    specialties: ['Rooftop', 'DJ'],
    location: 'Villa Morra • Asunción',
    image: '/images/bar.jpg'
  }
];

// ===========================================
// ZONE: ASUNCION SIMPLE BARS (generated)
// ===========================================
export const createZoneBars = (
  images: string[]
): ZoneBar[] => Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  name: `Bar ${i + 1}`,
  ambiance: i % 2 ? "Coctelería de autor" : "Cervezas artesanales",
  img: images[i % images.length]
}));
