import type {
  Reservation,
  UpdateReservationStatusInput,
} from "@/lib/reservations";
import {
  getPanelDemoBarReservationDates,
  getPanelDemoBarReservationsDefaultDate as getPanelDemoBarReservationsAnchorDate,
} from "./time";

type DemoReservationsByDate = Record<string, Reservation[]>;

const PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY =
  "tairet.panel.demo.bar.reservations";

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate()
  )}`;
}

function parseDateOnly(dateOnly: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dateOnly.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildDateTime(date: Date, hours: number, minutes: number): string {
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return next.toISOString();
}

function cloneReservation(item: Reservation): Reservation {
  return {
    ...item,
  };
}

function cloneReservationsByDate(
  reservationsByDate: DemoReservationsByDate
): DemoReservationsByDate {
  return Object.fromEntries(
    Object.entries(reservationsByDate).map(([date, items]) => [
      date,
      items.map(cloneReservation),
    ])
  );
}

function createReservation(
  date: Date,
  sequence: number,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    guests: number;
    hour: number;
    minute: number;
    status: Reservation["status"];
    notes: string;
    tableNote: string | null;
    createdDayOffset: number;
  }
): Reservation {
  const reservationDate = buildDateTime(date, input.hour, input.minute);
  const createdAt = buildDateTime(
    addDays(date, input.createdDayOffset),
    Math.max(input.hour - 3, 10),
    input.minute
  );

  return {
    id: `demo-bar-res-${formatDateOnly(date)}-${sequence}`,
    local_id: "demo-bar",
    name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    date: reservationDate,
    guests: input.guests,
    status: input.status,
    notes: input.notes,
    table_note: input.tableNote,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

type BarReservationPlan = [
  hour: number,
  minute: number,
  guests: number,
  status: Reservation["status"],
  createdDayOffset: number,
];

const BAR_DEMO_CONTACTS = [
  ["Laura", "Diaz"],
  ["Juan", "Rodriguez"],
  ["Valeria", "Lopez"],
  ["Diego", "Martinez"],
  ["Camila", "Gomez"],
  ["Andrea", "Mendoza"],
  ["Tomas", "Garcia"],
  ["Sofia", "Rojas"],
  ["Marcos", "Silva"],
  ["Paula", "Benitez"],
  ["Bruno", "Acosta"],
  ["Lucia", "Vera"],
  ["Mateo", "Gimenez"],
  ["Ariana", "Alvarenga"],
  ["Nicolas", "Ferreira"],
  ["Micaela", "Ortiz"],
  ["Joaquin", "Paredes"],
  ["Valentina", "Lezcano"],
  ["Alan", "Riveros"],
  ["Emilia", "Pereira"],
  ["Julieta", "Franco"],
  ["Rocio", "Morinigo"],
  ["Federico", "Insfran"],
  ["Martina", "Ayala"],
];

const BAR_CONFIRMED_NOTES = [
  "After office con ronda de tragos y picadas.",
  "Brindis con amigos y mesa alta cerca de la barra.",
  "Cocktails de autor y tapeo despues de oficina.",
  "Reserva para sunset drinks en terraza.",
  "Grupo para primera ronda y cierre con gin tonic.",
];

const BAR_PENDING_NOTES = [
  "Consulta por mesa alta para after office extendido.",
  "Quiere confirmar terraza si baja un poco el viento.",
  "Grupo esperando espacio cerca de la barra principal.",
  "Piden confirmar mesa para ronda de cocktails y tapeo.",
];

const BAR_CANCELLED_NOTES = [
  "Reprogramaron el brindis para la semana que viene.",
  "Cancelaron por lluvia y pidieron nueva opcion en terraza.",
  "El grupo movio el after office para otra fecha.",
];

const BAR_CONFIRMED_TABLE_NOTES = [
  "Ubicar cerca de la barra y sugerir primera ronda.",
  "Mantener mesa alta lista con carta de cocktails.",
  "Preparar recepcion agil en terraza.",
  "Sugerir combo de picadas para compartir.",
];

const BAR_PENDING_TABLE_NOTES = [
  "Confirmar disponibilidad de mesa alta antes de las 20:00.",
  "Dejar opcion abierta entre barra y terraza.",
  "Avisar si se libera sector lounge para el grupo.",
];

const BAR_CANCELLED_TABLE_NOTES = [
  "Ofrecer nueva fecha de after office sin costo.",
  "Guardar preferencia para futura reserva en terraza.",
  "Recontactar para proponer mesa alta el proximo viernes.",
];

function createBarEmail(firstName: string, lastName: string, index: number): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@demo.ta`;
}

function createBarPhone(index: number): string {
  return `+59598${String(100000 + index).padStart(6, "0")}`;
}

function getBarReservationNote(
  status: Reservation["status"],
  index: number
): string {
  if (status === "confirmed") {
    return BAR_CONFIRMED_NOTES[index % BAR_CONFIRMED_NOTES.length];
  }
  if (status === "en_revision") {
    return BAR_PENDING_NOTES[index % BAR_PENDING_NOTES.length];
  }
  return BAR_CANCELLED_NOTES[index % BAR_CANCELLED_NOTES.length];
}

function getBarReservationTableNote(
  status: Reservation["status"],
  index: number
): string | null {
  if (status === "confirmed") {
    return BAR_CONFIRMED_TABLE_NOTES[index % BAR_CONFIRMED_TABLE_NOTES.length];
  }
  if (status === "en_revision") {
    return BAR_PENDING_TABLE_NOTES[index % BAR_PENDING_TABLE_NOTES.length];
  }
  return BAR_CANCELLED_TABLE_NOTES[index % BAR_CANCELLED_TABLE_NOTES.length];
}

function buildBarReservationsForDate(
  date: Date,
  plans: BarReservationPlan[],
  contactOffset: number
): Reservation[] {
  return plans.map(([hour, minute, guests, status, createdDayOffset], index) => {
    const contactIndex = contactOffset + index;
    const [firstName, lastName] =
      BAR_DEMO_CONTACTS[contactIndex % BAR_DEMO_CONTACTS.length];

    return createReservation(date, index + 1, {
      firstName,
      lastName,
      email: createBarEmail(firstName, lastName, contactIndex + 1),
      phone: createBarPhone(contactIndex + 1),
      guests,
      hour,
      minute,
      status,
      notes: getBarReservationNote(status, contactIndex),
      tableNote: getBarReservationTableNote(status, contactIndex),
      createdDayOffset,
    });
  });
}

function createInitialBarReservations(): DemoReservationsByDate {
  const [day0DateOnly, day1DateOnly, day2DateOnly] = getPanelDemoBarReservationDates();
  const day0 = parseDateOnly(day0DateOnly);
  const day1 = parseDateOnly(day1DateOnly);
  const day2 = parseDateOnly(day2DateOnly);

  const thursdayPlans: BarReservationPlan[] = [
    [18, 0, 2, "confirmed", -6],
    [18, 20, 4, "confirmed", -5],
    [18, 45, 3, "en_revision", -4],
    [19, 0, 5, "confirmed", -4],
    [19, 20, 2, "confirmed", -3],
    [19, 45, 6, "confirmed", -3],
    [20, 10, 4, "en_revision", -3],
    [20, 30, 3, "confirmed", -2],
    [21, 0, 7, "confirmed", -2],
    [21, 20, 2, "en_revision", -2],
    [21, 45, 5, "confirmed", -1],
    [22, 15, 4, "confirmed", -1],
    [22, 40, 6, "cancelled", -5],
  ];

  const fridayPlans: BarReservationPlan[] = [
    [18, 0, 2, "confirmed", -6],
    [18, 15, 4, "confirmed", -5],
    [18, 30, 3, "en_revision", -4],
    [18, 50, 5, "confirmed", -4],
    [19, 5, 2, "confirmed", -3],
    [19, 20, 6, "confirmed", -3],
    [19, 35, 4, "en_revision", -3],
    [19, 50, 3, "confirmed", -2],
    [20, 10, 7, "cancelled", -6],
    [20, 25, 2, "confirmed", -2],
    [20, 40, 5, "confirmed", -2],
    [20, 55, 6, "en_revision", -1],
    [21, 10, 4, "confirmed", -1],
    [21, 25, 3, "confirmed", -1],
    [21, 40, 8, "confirmed", -1],
    [22, 0, 5, "en_revision", -1],
    [22, 20, 4, "confirmed", -2],
    [22, 45, 6, "cancelled", -5],
  ];

  const saturdayPlans: BarReservationPlan[] = [
    [18, 15, 3, "confirmed", -5],
    [18, 35, 4, "confirmed", -4],
    [18, 50, 2, "en_revision", -4],
    [19, 5, 5, "confirmed", -3],
    [19, 20, 3, "confirmed", -3],
    [19, 40, 6, "confirmed", -3],
    [20, 0, 4, "en_revision", -2],
    [20, 20, 2, "confirmed", -2],
    [20, 40, 7, "cancelled", -5],
    [21, 0, 5, "confirmed", -2],
    [21, 20, 3, "en_revision", -1],
    [21, 40, 4, "confirmed", -1],
    [22, 0, 6, "cancelled", -4],
    [22, 20, 5, "confirmed", -1],
    [22, 40, 4, "en_revision", -1],
    [23, 0, 6, "confirmed", -2],
  ];

  return {
    [formatDateOnly(day0)]: buildBarReservationsForDate(day0, thursdayPlans, 0),
    [formatDateOnly(day1)]: buildBarReservationsForDate(day1, fridayPlans, 13),
    [formatDateOnly(day2)]: buildBarReservationsForDate(day2, saturdayPlans, 31),
  };
}

function normalizeStoredReservations(
  value: unknown
): DemoReservationsByDate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value);
  const normalizedEntries: Array<[string, Reservation[]]> = [];

  for (const [date, items] of entries) {
    if (!Array.isArray(items)) {
      return null;
    }

    const normalizedItems = items.filter(
      (item): item is Reservation =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "name" in item &&
            "date" in item &&
            "status" in item
        )
    );

    normalizedEntries.push([date, normalizedItems.map(cloneReservation)]);
  }

  return Object.fromEntries(normalizedEntries);
}

function getMergedBarReservations(): DemoReservationsByDate {
  const initial = createInitialBarReservations();

  if (typeof window === "undefined") {
    return initial;
  }

  try {
    const rawValue = window.localStorage.getItem(
      PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY
    );

    if (!rawValue) {
      window.localStorage.setItem(
        PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY,
        JSON.stringify(initial)
      );
      return initial;
    }

    const parsed = normalizeStoredReservations(JSON.parse(rawValue));
    if (!parsed) {
      window.localStorage.setItem(
        PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY,
        JSON.stringify(initial)
      );
      return initial;
    }

    const merged = {
      ...initial,
      ...parsed,
    };
    window.localStorage.setItem(
      PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY,
      JSON.stringify(merged)
    );
    return merged;
  } catch {
    return initial;
  }
}

function persistBarReservations(reservationsByDate: DemoReservationsByDate): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PANEL_DEMO_BAR_RESERVATIONS_STORAGE_KEY,
    JSON.stringify(reservationsByDate)
  );
}

export function getPanelDemoBarReservationsDefaultDate(): string {
  return getPanelDemoBarReservationsAnchorDate();
}

export function getPanelDemoBarReservationsByDate(
  date: string
): Reservation[] {
  const reservationsByDate = getMergedBarReservations();
  return reservationsByDate[date]?.map(cloneReservation) ?? [];
}

export function updatePanelDemoBarReservation(
  date: string,
  reservationId: string,
  input: UpdateReservationStatusInput
): Reservation[] {
  const reservationsByDate = getMergedBarReservations();
  const currentReservations = reservationsByDate[date] ?? [];
  const updatedAt = new Date().toISOString();

  const nextReservations = currentReservations.map((item) =>
    item.id === reservationId
      ? {
          ...item,
          status: input.status ?? item.status,
          table_note:
            input.table_note !== undefined ? input.table_note : item.table_note,
          updated_at: updatedAt,
        }
      : item
  );

  const nextByDate = {
    ...reservationsByDate,
    [date]: nextReservations,
  };

  persistBarReservations(nextByDate);
  return nextReservations.map(cloneReservation);
}
