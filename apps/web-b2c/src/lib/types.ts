// Shared types for the application

// ===========================================
// B2C VENUE & EVENT TYPES
// ===========================================

export type VenueType = 'bar' | 'club' | 'boliche';

// Bar venue type (used in AllBars, BarsSection, experiencias, TestimonialsSection)
export interface Bar {
  id: number | string;
  name: string;
  type?: VenueType;
  dateTop?: string;
  dateBottom?: string;
  schedule: string;
  rating: string;
  specialties: string[];
  location?: string;
  image: string;
  slug?: string;
}

// Club/Discoteca venue type (used in AllClubs, zona pages)
export interface Club {
  id: number | string;
  name: string;
  dateTop: string;
  dateBottom: string;
  schedule: string;
  rating: string;
  genres: string[];
  customImage?: string;
}

// Featured venue type (used in TestimonialsSection)
export interface FeaturedVenue {
  id: number | string;
  name: string;
  image: string;
  dateTop: string;
  dateBottom: string;
  schedule: string;
  rating: string;
  specialties: string[];
  slug: string;
  type: VenueType;
}

// Event type (used in Eventos.tsx)
export interface Event {
  id: string;
  name: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  ageLimit: string;
  category: string;
  price: string;
  image: string;
  description: string;
  capacity: string;
  artist: string;
}

// Promo type for zona pages
export interface ZonePromo {
  id: number | string;
  title: string;
  text: string;
  img: string;
  cta: string;
}

// Promo type for experiencias/Promociones
export interface VenuePromo {
  id: number | string;
  venueId: string;
  venueType: 'bar' | 'club';
  title: string;
  image: string;
}

// Experience venue type (used in AfterOffice, Rooftop pages)
export interface ExperienceVenue {
  id: number;
  name: string;
  dateTop: string;
  dateBottom: string;
  schedule: string;
  rating: string;
  specialties: string[];
  location: string;
  image: string;
}

// Simple bar type for zona pages
export interface ZoneBar {
  id: number | string;
  name: string;
  ambiance: string;
  img: string;
}

// Review type (used in AllReviews.tsx)
export interface PageReview {
  id: number | string;
  author: string;
  avatar: string;
  initials: string;
  rating: number;
  date: string;
  venue: string;
  venueType: 'bar' | 'club';
  comment: string;
  helpful: number;
  verified: boolean;
  images: string[];
}

// ===========================================
// BASE INTERFACES (CHECKOUT/PURCHASE FLOW)
// ===========================================

export interface BasePlace {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  hours: string[];
  additionalInfo?: string[];
}

// Purchase-related types
export interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  benefits: string[];
}

export interface TableType {
  id: string;
  name: string;
  capacity: number;
  price: number;
  benefits?: string[];
  drinks?: string[];
}

// Selected items for checkout
export interface SelectedItem {
  item: TicketType | TableType;
  quantity: number;
  type: 'ticket' | 'table';
}

// Table selection specifically for clubs
export interface TableSelection {
  table: TableType;
  quantity: number;
}

// Promotion type (legacy - for club/bar profile pages)
export interface Promotion {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  validFrom?: string;
  validUntil?: string;
  discount?: number;
}

// API Promotion type (from /public/locals/by-slug/:slug response)
export interface ApiPromotion {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

// Place types (legacy - for profile pages)
export interface ClubProfile extends BasePlace {
  type: 'club';
  dressCode?: string;
  ageLimit?: number;
  tables: TableType[];
  promotions?: Promotion[];
}

export interface BarProfile extends BasePlace {
  type: 'bar';
  tables?: TableType[];
  promotions?: Promotion[];
}

export interface EventProfile {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  ageLimit?: number;
  description?: string;
  artists?: string[];
  images?: string[];
  tickets?: TicketType[];
  tables?: TableType[];
  location?: string;
  address?: string;
}

// Cart and checkout types
export interface CartItem {
  id: string;
  type: 'ticket' | 'table' | 'reservation';
  name: string;
  venue: string;
  localId?: string; // UUID del local para crear orders
  quantity: number;
  price: number;
  totalPrice: number;
  date?: string;
  time?: string;
}

// User and buyer information
export interface Buyer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age?: number;
}

// Payment information
export interface PaymentInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardName: string;
}

// Form schemas for validation
export interface CheckoutFormData extends Buyer {
  confirmEmail?: string;
  acceptTerms?: boolean;
}

// Reservation types
export interface Reservation {
  id: string;
  venue: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  items: CartItem[];
  totalAmount: number;
  buyer: Buyer;
}

// Component props interfaces
export interface PurchaseSelectorProps {
  tickets?: TicketType[];
  tables?: TableType[];
  onCheckout: (items: SelectedItem[]) => void;
  title?: string;
  subtitle?: string;
  mode?: 'tickets' | 'tables' | 'both';
  contactInfo?: import("./contact").ContactInfo | null;
  localId?: string; // Para tracking de whatsapp_click
}

// Map section props
export interface MapSectionProps {
  venue: string;
  location: string;
  address: string;
  hours: string[];
  phone: string;
  additionalInfo?: string[];
}