/**
 * Feature flags para ocultar módulos no-MVP
 */
export const flags = {
  // MVP activo
  mvp: {
    orders: true,
    reservations: true,
    promos: true,
    metrics: true,
    checkin: true,
  },
  // Features futuras (ocultas en MVP)
  v2: {
    qrCheckin: false, // MVP usa check-in manual
    refunds: false, // No reembolsos en MVP
    analyticsAdvanced: false,
  },
} as const;

