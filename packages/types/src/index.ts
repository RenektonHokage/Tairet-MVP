import { z } from "zod";

// Re-export attributes constants and helpers
export {
  BAR_SPECIALTIES,
  CLUB_GENRES,
  getAttributesAllowlist,
  validateAttributes,
  type BarSpecialty,
  type ClubGenre
} from "./attributes";

// Re-export zones and age constants
export {
  ZONES,
  MIN_AGES,
  isValidZone,
  isValidMinAge,
  type Zone,
  type MinAge
} from "./zones";

// Re-export cities constants
export {
  CITIES,
  isValidCity,
  type City
} from "./cities";

// Venue (Local)
export const VenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  ticketPrice: z.number(), // Precio fijo por local (PYG)
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Venue = z.infer<typeof VenueSchema>;

// Promo
export const PromoSchema = z.object({
  id: z.string().uuid(),
  localId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Promo = z.infer<typeof PromoSchema>;

// Event (simple, para tracking)
export const EventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["profile_view", "whatsapp_click", "promo_open", "reservation_created", "checkout_started", "order_paid", "order_used"]),
  localId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;

// Ticket (precio fijo por local)
export const TicketSchema = z.object({
  id: z.string().uuid(),
  localId: z.string().uuid(),
  price: z.number(), // PYG
  currency: z.literal("PYG"),
});

export type Ticket = z.infer<typeof TicketSchema>;

// Order
export const OrderSchema = z.object({
  id: z.string().uuid(),
  localId: z.string().uuid(),
  quantity: z.number().int().min(1),
  totalAmount: z.number(),
  currency: z.literal("PYG"),
  status: z.enum(["pending", "paid", "failed", "cancelled"]),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  usedAt: z.string().datetime().nullable(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Order = z.infer<typeof OrderSchema>;

// Reservation
export const ReservationSchema = z.object({
  id: z.string().uuid(),
  localId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  date: z.string().datetime(),
  guests: z.number().int().min(1),
  status: z.enum(["en_revision", "confirmed", "cancelled"]),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

// MetricsSummary
export const MetricsSummarySchema = z.object({
  localId: z.string().uuid(),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  profileViews: z.number().int().min(0),
  whatsappClicks: z.number().int().min(0),
  reservationsCreated: z.number().int().min(0),
  ticketsSold: z.number().int().min(0),
  ticketsUsed: z.number().int().min(0),
  estimatedRevenue: z.number().min(0), // PYG
});

export type MetricsSummary = z.infer<typeof MetricsSummarySchema>;

