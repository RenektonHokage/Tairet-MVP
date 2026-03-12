import type { ActivityItem, ActivityResponse } from "@/lib/activity";
import {
  getPanelDemoNow,
  getPanelDemoRange,
  type DemoMetricsPeriod,
} from "./time";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildTimestamp(
  scenario: "bar" | "discoteca",
  daysAgo: number,
  hours: number,
  minutes: number
): string {
  const base = addDays(getPanelDemoNow(scenario), -daysAgo);
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

function createDemoActivityItem(
  scenario: "bar" | "discoteca",
  type: ActivityItem["type"],
  label: string,
  daysAgo: number,
  hours: number,
  minutes: number
): ActivityItem {
  return {
    type,
    label,
    timestamp: buildTimestamp(scenario, daysAgo, hours, minutes),
  };
}

function buildBarActivityFeed(): ActivityItem[] {
  return [
    createDemoActivityItem("bar", "reservation_updated", "Reserva confirmada para brindis del viernes en terraza", 0, 19, 20),
    createDemoActivityItem("bar", "reservation_created", "Nuevo grupo reservado para after office en barra", 0, 18, 5),
    createDemoActivityItem("bar", "whatsapp_click", "WhatsApp abierto desde promo After Office Gin & Tapas", 0, 17, 10),
    createDemoActivityItem("bar", "promo_view", "Promo terrace drinks vista antes del pico del jueves", 1, 20, 5),
    createDemoActivityItem("bar", "reservation_created", "Reserva para primera ronda y picadas cerca de la barra", 1, 18, 40),
    createDemoActivityItem("bar", "profile_view", "Repunte de visitas del perfil desde reels del gastrobar", 2, 21, 30),
    createDemoActivityItem("bar", "reservation_created", "Mesa grupal creada para sabado de cocktails", 6, 20, 15),
    createDemoActivityItem("bar", "whatsapp_click", "WhatsApp abierto desde la carta de cocktails", 8, 18, 40),
    createDemoActivityItem("bar", "promo_view", "Promo Sunset Sessions compartida", 12, 19, 20),
    createDemoActivityItem("bar", "reservation_updated", "Nota operativa agregada a mesa alta", 18, 20, 35),
    createDemoActivityItem("bar", "profile_view", "Trafico organico fuerte desde Instagram", 24, 22, 0),
    createDemoActivityItem("bar", "reservation_created", "Reserva para aniversario con brindis", 33, 18, 10),
    createDemoActivityItem("bar", "promo_view", "Promo Signature Cocktails vista", 41, 19, 25),
    createDemoActivityItem("bar", "whatsapp_click", "WhatsApp abierto desde promo de terraza", 57, 12, 50),
    createDemoActivityItem("bar", "profile_view", "Visitas al perfil desde campana local", 76, 21, 5),
  ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

function buildClubActivityFeed(): ActivityItem[] {
  return [
    createDemoActivityItem("discoteca", "order_paid", "Orden general pagada para la noche flagship del sabado", 0, 23, 15),
    createDemoActivityItem("discoteca", "order_created", "Nueva compra grupal para pista principal", 0, 22, 20),
    createDemoActivityItem("discoteca", "order_used", "Lote VIP validado en acceso principal", 0, 1, 35),
    createDemoActivityItem("discoteca", "promo_view", "Promo Main Room + VIP Access vista antes del pico del sabado", 0, 18, 40),
    createDemoActivityItem("discoteca", "order_paid", "Mesa premium confirmada para viernes", 1, 23, 5),
    createDemoActivityItem("discoteca", "whatsapp_click", "WhatsApp abierto desde flyer del viernes", 1, 20, 30),
    createDemoActivityItem("discoteca", "profile_view", "Repunte de trafico del club por ventas del viernes", 1, 19, 50),
    createDemoActivityItem("discoteca", "order_created", "Preventa fuerte para jueves y VIP", 2, 19, 15),
    createDemoActivityItem("discoteca", "promo_view", "Promo Backstage Experience vista", 2, 18, 10),
    createDemoActivityItem("discoteca", "order_used", "Check-in completado para lote VIP", 8, 1, 25),
    createDemoActivityItem("discoteca", "profile_view", "Pico de trafico del perfil del club", 24, 23, 5),
    createDemoActivityItem("discoteca", "order_paid", "Orden general confirmada para closing set", 31, 22, 50),
    createDemoActivityItem("discoteca", "whatsapp_click", "WhatsApp abierto desde cartelera del finde", 46, 19, 10),
    createDemoActivityItem("discoteca", "order_created", "Preventa lanzada para Closing Weekend Festival", 68, 18, 35),
    createDemoActivityItem("discoteca", "promo_view", "Campana Closing Weekend Festival vista", 82, 21, 55),
  ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

export async function getPanelDemoBarActivity(
  period: DemoMetricsPeriod
): Promise<ActivityResponse> {
  const threshold = Date.parse(getPanelDemoRange("bar", period).from);
  const items = buildBarActivityFeed().filter((item) => Date.parse(item.timestamp) >= threshold);

  return {
    local_id: "demo-bar",
    items,
  };
}

export async function getPanelDemoClubActivity(
  period: DemoMetricsPeriod
): Promise<ActivityResponse> {
  const threshold = Date.parse(getPanelDemoRange("discoteca", period).from);
  const items = buildClubActivityFeed().filter((item) => Date.parse(item.timestamp) >= threshold);

  return {
    local_id: "demo-discoteca",
    items,
  };
}
