// Centralized event data for B2C
import type { Event } from '../types';
import nightlifeScene from '@/assets/nightlife-scene.jpg';
import techno from '@/assets/techno.jpg';
import reggaeton from '@/assets/reggaeton.jpg';
import afterOffice from '@/assets/after-office.jpg';

// ===========================================
// ALL EVENTS (used in Eventos.tsx)
// ===========================================
export const events: Event[] = [
  {
    id: "1",
    name: "Noche de Techno",
    venue: "Club Matrix",
    location: "Asunción",
    date: "2024-01-15",
    time: "23:00",
    ageLimit: "18+",
    category: "techno",
    price: "150.000 Gs",
    image: techno,
    description: "La mejor noche de techno underground con DJs internacionales",
    capacity: "500 personas",
    artist: "DJ Martinez & Guest"
  },
  {
    id: "2", 
    name: "Reggaeton Party",
    venue: "Fever Disco",
    location: "San Bernardino",
    date: "2024-01-20",
    time: "22:00",
    ageLimit: "21+",
    category: "reggaeton",
    price: "120.000 Gs",
    image: reggaeton,
    description: "Los mejores hits de reggaeton y música urbana",
    capacity: "300 personas",
    artist: "DJ Latino"
  },
  {
    id: "3",
    name: "After Office",
    venue: "Sky Bar",
    location: "Asunción",
    date: "2024-01-18",
    time: "18:00",
    ageLimit: "25+",
    category: "afterwork",
    price: "80.000 Gs",
    image: afterOffice,
    description: "Relájate después del trabajo con buena música y tragos",
    capacity: "150 personas",
    artist: "Acoustic Duo"
  },
  {
    id: "4",
    name: "Fiesta de Fin de Semana",
    venue: "Neon Club",
    location: "Ciudad del Este",
    date: "2024-01-22",
    time: "23:30",
    ageLimit: "18+",
    category: "mixto",
    price: "100.000 Gs",
    image: nightlifeScene,
    description: "Mix de géneros para cerrar el fin de semana",
    capacity: "400 personas",
    artist: "DJ Mix Master"
  }
];
