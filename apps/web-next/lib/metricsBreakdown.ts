import { apiGetWithAuth } from "./api";

// ============================================================
// Types
// ============================================================

export interface TicketBreakdownItem {
  ticket_type_id: string | null;
  name: string;
  sold_qty: number;
  used_orders: number;
  revenue: number;
}

export interface TableInterestItem {
  table_type_id: string | null;
  name: string;
  price: number | null;
  interest_count: number;
}

export interface ClubBreakdown {
  window: string;
  tickets_top: TicketBreakdownItem[];
  tables_interest_top: TableInterestItem[];
}

// ============================================================
// API Functions
// ============================================================

/**
 * Obtiene métricas desglosadas por tipo para clubs
 * @param window - Ventana de tiempo: "7d", "30d", "90d" (default: "30d")
 */
export async function getClubBreakdown(window: string = "30d"): Promise<ClubBreakdown> {
  return apiGetWithAuth<ClubBreakdown>(`/metrics/club/breakdown?window=${window}`);
}
