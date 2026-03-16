"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelLocalProfile,
  updatePanelLocalProfile,
  uploadGalleryImage,
  deleteGalleryImage,
  getCatalogTickets,
  createCatalogTicket,
  updateCatalogTicket,
  deleteCatalogTicket,
  getCatalogTables,
  createCatalogTable,
  updateCatalogTable,
  deleteCatalogTable,
  type LocalProfile,
  type LocalGalleryItem,
  type GalleryKind,
  type OpeningHoursV1,
  type OpeningHoursDayKey,
  type OpeningHoursRange,
  type CatalogTicket,
  type CatalogTable,
  OPENING_HOURS_DAY_KEYS,
  BAR_GALLERY_KINDS,
  CLUB_GALLERY_KINDS,
  GALLERY_KIND_LABELS,
} from "@/lib/panel";

// Constantes de límites del catálogo
const MAX_TICKET_TYPES = 4;
const MAX_ACTIVE_TICKETS = 2;
import { getAttributesAllowlist, ZONES, MIN_AGES, CITIES } from "@/lib/constants/attributes";
import { cn, panelUi } from "@/components/panel/ui";
import { ListingPreviewCard } from "@/components/panel/views/profile/ListingPreviewCard";
import { ClubHeroSurface } from "@/components/panel/views/profile/ClubHeroSurface";
import { ProfilePublicPreviewBar } from "@/components/panel/views/profile/ProfilePublicPreviewBar";
import { ProfilePublicPreviewClub } from "@/components/panel/views/profile/ProfilePublicPreviewClub";
import { getPanelPromosByLocalId, type Promo } from "@/lib/promos";
import {
  Armchair,
  ChevronDown,
  Ticket,
  Trash2,
  X,
} from "lucide-react";

// Helpers para arrays (sin dependencias)
const parseLines = (text: string): string[] =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

const toLines = (arr?: string[] | null): string =>
  (arr ?? []).join("\n");

const OPENING_HOURS_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const OPENING_HOURS_DEFAULT_RANGE: OpeningHoursRange = { start: "18:00", end: "23:00" };
const DELETE_BUTTON_DATA_ATTR = { "data-panel-delete-button": "true" } as const;
const PROFILE_EDIT_DARK_SCOPE_ATTR = { "data-profile-dark-scope": "true" } as const;
const PROFILE_PRIMARY_CTA_ATTR = { "data-profile-primary-cta": "true" } as const;
const PROFILE_ATTRIBUTE_CHIP_ATTR = { "data-profile-attribute-chip": "true" } as const;
const PROFILE_DISCLOSURE_ATTR = { "data-profile-disclosure": "true" } as const;
const PROFILE_DISCLOSURE_PANEL_ATTR = { "data-profile-disclosure-panel": "true" } as const;
const PROFILE_INLINE_DISCLOSURE_ATTR = { "data-profile-inline-disclosure": "true" } as const;
const PROFILE_INLINE_DISCLOSURE_PANEL_ATTR = {
  "data-profile-inline-disclosure-panel": "true",
} as const;
const PROFILE_SECTION_SHELL_CLASS = "rounded-[28px] border border-neutral-200 bg-white p-6 sm:p-8";
const LISTING_PREVIEW_REFERENCES = [
  { key: "desktop", label: "Desktop", widthClass: "w-[286px]" },
  { key: "mobile", label: "Mobile", widthClass: "w-[328px]" },
] as const;

const OPENING_HOURS_DAY_LABELS: Record<OpeningHoursDayKey, { short: string; full: string }> = {
  mon: { short: "Lun", full: "Lunes" },
  tue: { short: "Mar", full: "Martes" },
  wed: { short: "Mie", full: "Miercoles" },
  thu: { short: "Jue", full: "Jueves" },
  fri: { short: "Vie", full: "Viernes" },
  sat: { short: "Sab", full: "Sabado" },
  sun: { short: "Dom", full: "Domingo" },
};

const createDefaultOpeningHours = (): OpeningHoursV1 => ({
  version: 1,
  timezone: "America/Asuncion",
  days: OPENING_HOURS_DAY_KEYS.reduce((acc, dayKey) => {
    acc[dayKey] = { closed: true, ranges: [] };
    return acc;
  }, {} as OpeningHoursV1["days"]),
});

const normalizeOpeningHoursTime = (value: string): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (OPENING_HOURS_TIME_REGEX.test(trimmed)) return trimmed;

  const tolerant = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!tolerant) return null;

  const hour = Number(tolerant[1]);
  const minute = Number(tolerant[2] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const normalizeOpeningHoursRanges = (ranges: OpeningHoursRange[] | undefined): OpeningHoursRange[] =>
  (Array.isArray(ranges) ? ranges : [])
    .map((range) => {
      const start = normalizeOpeningHoursTime(range?.start ?? "");
      const end = normalizeOpeningHoursTime(range?.end ?? "");
      if (!start || !end || start === end) return null;
      return { start, end };
    })
    .filter((range): range is OpeningHoursRange => range !== null);

const normalizeOpeningHoursForEditor = (value: OpeningHoursV1 | null | undefined): OpeningHoursV1 => {
  const fallback = createDefaultOpeningHours();
  if (!value) return fallback;

  const normalizedDays = OPENING_HOURS_DAY_KEYS.reduce((acc, dayKey) => {
    const sourceDay = value.days?.[dayKey];
    const closed = Boolean(sourceDay?.closed);
    const normalizedRanges = normalizeOpeningHoursRanges(sourceDay?.ranges);
    acc[dayKey] = closed ? { closed: true, ranges: [] } : { closed: false, ranges: normalizedRanges };
    return acc;
  }, {} as OpeningHoursV1["days"]);

  return {
    version: 1,
    timezone: "America/Asuncion",
    days: normalizedDays,
  };
};

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

const formatLegacyRange = (start: string, end: string): string => `${start}-${end} hs`;

const buildDayHoursDisplay = (dayConfig: OpeningHoursV1["days"][OpeningHoursDayKey]): string => {
  if (dayConfig.closed || dayConfig.ranges.length === 0) {
    return "Cerrado";
  }

  const ranges = dayConfig.ranges
    .map((range) => {
      const start = normalizeOpeningHoursTime(range.start);
      const end = normalizeOpeningHoursTime(range.end);
      if (!start || !end || start === end) return null;
      return formatLegacyRange(start, end);
    })
    .filter((value): value is string => value !== null);

  return ranges.length > 0 ? ranges.join(" / ") : "Cerrado";
};

const clampLegacyLine = (line: string): string =>
  line.length <= 120 ? line : `${line.slice(0, 119)}…`;

type LegacyHoursFormatMode = "compact" | "expanded";

const deriveLegacyHoursCompact = (
  dayDisplays: Array<{ dayKey: OpeningHoursDayKey; display: string }>
): string[] => {
  const grouped: Array<{ startIndex: number; endIndex: number; display: string }> = [];
  for (let index = 0; index < dayDisplays.length; index += 1) {
    const currentDisplay = dayDisplays[index].display;
    const lastGroup = grouped[grouped.length - 1];
    if (!lastGroup || lastGroup.display !== currentDisplay || lastGroup.endIndex !== index - 1) {
      grouped.push({ startIndex: index, endIndex: index, display: currentDisplay });
    } else {
      lastGroup.endIndex = index;
    }
  }

  const lines: string[] = [];
  const addDayLine = (startIndex: number, endIndex: number, display: string) => {
    const startKey = OPENING_HOURS_DAY_KEYS[startIndex];
    const endKey = OPENING_HOURS_DAY_KEYS[endIndex];
    const startLabel = OPENING_HOURS_DAY_LABELS[startKey].short;
    const endLabel = OPENING_HOURS_DAY_LABELS[endKey].short;
    const dayLabel = startIndex === endIndex ? startLabel : `${startLabel}-${endLabel}`;
    lines.push(clampLegacyLine(`${dayLabel}: ${display}`));
  };

  grouped.forEach((group) => {
    const startKey = OPENING_HOURS_DAY_KEYS[group.startIndex];
    const endKey = OPENING_HOURS_DAY_KEYS[group.endIndex];
    const dayLabel =
      group.startIndex === group.endIndex
        ? OPENING_HOURS_DAY_LABELS[startKey].short
        : `${OPENING_HOURS_DAY_LABELS[startKey].short}-${OPENING_HOURS_DAY_LABELS[endKey].short}`;
    const singleLine = `${dayLabel}: ${group.display}`;

    if (singleLine.length <= 120) {
      lines.push(singleLine);
      return;
    }

    for (let dayIndex = group.startIndex; dayIndex <= group.endIndex; dayIndex += 1) {
      addDayLine(dayIndex, dayIndex, group.display);
    }
  });

  return lines.slice(0, 14).map(clampLegacyLine);
};

const deriveLegacyHoursExpanded = (
  dayDisplays: Array<{ dayKey: OpeningHoursDayKey; display: string }>
): string[] =>
  dayDisplays
    .map(({ dayKey, display }) => clampLegacyLine(`${OPENING_HOURS_DAY_LABELS[dayKey].full}: ${display}`))
    .slice(0, 14);

const deriveLegacyHours = (
  openingHours: OpeningHoursV1,
  mode: LegacyHoursFormatMode = "compact"
): string[] => {
  const normalized = normalizeOpeningHoursForEditor(openingHours);
  const dayDisplays = OPENING_HOURS_DAY_KEYS.map((dayKey) => ({
    dayKey,
    display: buildDayHoursDisplay(normalized.days[dayKey]),
  }));

  return mode === "expanded"
    ? deriveLegacyHoursExpanded(dayDisplays)
    : deriveLegacyHoursCompact(dayDisplays);
};

interface OpeningHoursValidationResult {
  normalized: OpeningHoursV1;
  errors: string[];
}

const validateOpeningHoursForSubmit = (openingHours: OpeningHoursV1): OpeningHoursValidationResult => {
  const normalized = createDefaultOpeningHours();
  const errors: string[] = [];

  OPENING_HOURS_DAY_KEYS.forEach((dayKey) => {
    const sourceDay = openingHours.days?.[dayKey];
    const dayLabel = OPENING_HOURS_DAY_LABELS[dayKey].full;
    const dayClosed = Boolean(sourceDay?.closed);
    const sourceRanges = Array.isArray(sourceDay?.ranges) ? sourceDay.ranges : [];

    if (dayClosed) {
      if (sourceRanges.length > 0) {
        errors.push(`${dayLabel}: si esta cerrado no puede tener rangos.`);
      }
      normalized.days[dayKey] = { closed: true, ranges: [] };
      return;
    }

    if (sourceRanges.length === 0) {
      errors.push(`${dayLabel}: agrega al menos un rango o marca Cerrado.`);
      normalized.days[dayKey] = { closed: false, ranges: [] };
      return;
    }

    const normalizedRanges: OpeningHoursRange[] = [];
    const intervals: Array<{ start: number; end: number; rangeIndex: number }> = [];
    sourceRanges.forEach((range, rangeIndex) => {
      const start = normalizeOpeningHoursTime(range.start);
      const end = normalizeOpeningHoursTime(range.end);
      if (!start || !end) {
        errors.push(`${dayLabel}: rango ${rangeIndex + 1} debe tener formato HH:mm.`);
        return;
      }

      if (start === end) {
        errors.push(`${dayLabel}: rango ${rangeIndex + 1} no puede tener inicio y fin iguales.`);
        return;
      }

      normalizedRanges.push({ start, end });

      const startMinutes = toMinutes(start);
      const endMinutes = toMinutes(end);
      if (startMinutes < endMinutes) {
        intervals.push({ start: startMinutes, end: endMinutes, rangeIndex });
      } else {
        intervals.push({ start: startMinutes, end: 24 * 60, rangeIndex });
        intervals.push({ start: 0, end: endMinutes, rangeIndex });
      }
    });

    const reportedPairs = new Set<string>();
    for (let i = 0; i < intervals.length; i += 1) {
      for (let j = i + 1; j < intervals.length; j += 1) {
        const first = intervals[i];
        const second = intervals[j];
        if (first.rangeIndex === second.rangeIndex) continue;

        const overlaps = first.start < second.end && second.start < first.end;
        if (!overlaps) continue;

        const a = Math.min(first.rangeIndex, second.rangeIndex) + 1;
        const b = Math.max(first.rangeIndex, second.rangeIndex) + 1;
        const pairKey = `${a}-${b}`;
        if (reportedPairs.has(pairKey)) continue;
        reportedPairs.add(pairKey);
        errors.push(`${dayLabel}: los rangos ${a} y ${b} se solapan.`);
      }
    }

    normalized.days[dayKey] = { closed: false, ranges: normalizedRanges };
  });

  return { normalized, errors };
};

type ParsedCoordinate = number | null | "invalid";
interface ParsedCoordinatePair {
  latitude: ParsedCoordinate;
  longitude: ParsedCoordinate;
  formatError: boolean;
}

const PARAGUAY_BOUNDS = {
  minLat: -27.7,
  maxLat: -19.0,
  minLng: -62.9,
  maxLng: -54.2,
};

const parseCoordinateInput = (value: string): ParsedCoordinate => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .replace(/latitud|latitude|lat|longitud|longitude|lng/gi, "")
    .replace(/[:=]/g, " ")
    .trim();

  const matches = cleaned.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length === 0) return "invalid";

  const normalized = matches[0].replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "invalid";
  return parsed;
};

const parseCoordinatePairInput = (value: string): ParsedCoordinatePair => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      latitude: null,
      longitude: null,
      formatError: false,
    };
  }

  const parts = trimmed.split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim().length === 0)) {
    return {
      latitude: "invalid",
      longitude: "invalid",
      formatError: true,
    };
  }

  return {
    latitude: parseCoordinateInput(parts[0]),
    longitude: parseCoordinateInput(parts[1]),
    formatError: false,
  };
};

const formatCoordinatePairInput = (latitude: string, longitude: string): string => {
  const trimmedLatitude = latitude.trim();
  const trimmedLongitude = longitude.trim();

  if (!trimmedLatitude && !trimmedLongitude) return "";
  if (trimmedLatitude && trimmedLongitude) return `${trimmedLatitude},${trimmedLongitude}`;
  return `${trimmedLatitude},${trimmedLongitude}`;
};

const isInRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

const isWithinParaguay = (lat: number, lng: number): boolean =>
  isInRange(lat, PARAGUAY_BOUNDS.minLat, PARAGUAY_BOUNDS.maxLat) &&
  isInRange(lng, PARAGUAY_BOUNDS.minLng, PARAGUAY_BOUNDS.maxLng);

const isLikelySwappedCoordinates = (lat: number, lng: number): boolean =>
  isInRange(lat, PARAGUAY_BOUNDS.minLng, PARAGUAY_BOUNDS.maxLng) &&
  isInRange(lng, PARAGUAY_BOUNDS.minLat, PARAGUAY_BOUNDS.maxLat);

// Constantes de validación de imagen
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Tamaños recomendados por tipo de imagen
const RECOMMENDED_SIZES: Record<string, { width: number; height: number; ratio: string; label: string }> = {
  cover: { width: 1600, height: 900, ratio: "16:9", label: "1600×900 (16:9)" },
  hero: { width: 1600, height: 900, ratio: "16:9", label: "1600×900 (16:9)" },
  carousel: { width: 1600, height: 900, ratio: "16:9", label: "1600×900 (16:9)" },
  food: { width: 800, height: 800, ratio: "1:1", label: "800×800 (cuadrado)" },
  menu: { width: 800, height: 800, ratio: "1:1", label: "800×800 (cuadrado)" },
  drinks: { width: 800, height: 800, ratio: "1:1", label: "800×800 (cuadrado)" },
  interior: { width: 800, height: 800, ratio: "1:1", label: "800×800 (cuadrado)" },
};

// Helper para formatear bytes
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Tipo para resultado de validación
interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  dimensions?: { width: number; height: number };
}

function FormatsDisclosure({ recommended }: { recommended: string }) {
  return (
    <details
      {...PROFILE_DISCLOSURE_ATTR}
      className="group mb-4 rounded-lg border border-gray-200 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <span>Formatos y restricciones</span>
        <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
      </summary>
      <div
        {...PROFILE_DISCLOSURE_PANEL_ATTR}
        className="border-t border-gray-200 px-4 py-3"
      >
        <div className="space-y-1.5 text-xs leading-relaxed text-gray-600">
          <p>{`JPG, PNG o WebP · máximo ${MAX_FILE_SIZE_MB} MB · mínimo ${MIN_WIDTH}×${MIN_HEIGHT} px`}</p>
          <p>{`Recomendado: ${recommended}`}</p>
          <p>Si la proporción difiere, se recortará al centro.</p>
        </div>
      </div>
    </details>
  );
}

export default function ProfilePage() {
  const { data: context, loading: contextLoading } = usePanelContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados principales
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Estados de galería
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<GalleryKind>("carousel");
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryWarning, setGalleryWarning] = useState<string | null>(null);

  // Estado de atributos
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  // Estado de edad mínima
  const [minAge, setMinAge] = useState<number | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    location: "",
    city: "",
    latitude: "",
    longitude: "",
    phone: "",
    whatsapp: "",
    hoursText: "",
    additionalInfoText: "",
  });
  const [coordinatesInput, setCoordinatesInput] = useState("");
  const [openingHoursDraft, setOpeningHoursDraft] = useState<OpeningHoursV1>(createDefaultOpeningHours);
  const [useStructuredHours, setUseStructuredHours] = useState(false);
  const [openingHoursErrors, setOpeningHoursErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [previewPromos, setPreviewPromos] = useState<Promo[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promosError, setPromosError] = useState<string | null>(null);
  const [showClubGalleryManager, setShowClubGalleryManager] = useState(false);
  const promosCacheRef = useRef<Map<string, Promo[]>>(new Map());

  // Estados del catálogo (solo clubs)
  const [catalogTickets, setCatalogTickets] = useState<CatalogTicket[]>([]);
  const [catalogTables, setCatalogTables] = useState<CatalogTable[]>([]);
  const [openTicketBenefits, setOpenTicketBenefits] = useState<Record<string, boolean>>(
    {},
  );
  const [openTableIncludes, setOpenTableIncludes] = useState<Record<string, boolean>>(
    {},
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState<string | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);
  const [savingTable, setSavingTable] = useState(false);

  // Estados para formularios de nuevo ticket/mesa
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [showNewTableForm, setShowNewTableForm] = useState(false);
  const [newTicketData, setNewTicketData] = useState({ name: "", price: "", description: "" });
  const [newTableData, setNewTableData] = useState({ name: "", price: "", capacity: "", includes: "" });
  const closeNewTicketModal = () => {
    setShowNewTicketForm(false);
    setNewTicketData({ name: "", price: "", description: "" });
  };
  const closeNewTableModal = () => {
    setShowNewTableForm(false);
    setNewTableData({ name: "", price: "", capacity: "", includes: "" });
  };

  // Determinar si el usuario puede editar (solo owner)
  const canEdit = context?.role === "owner";

  // Cargar perfil al montar
  useEffect(() => {
    if (contextLoading) return;
    if (!context) return;

    loadProfile();
    
    // Si es club, cargar catálogo
    if (context.local.type === "club") {
      loadCatalog();
    }
  }, [contextLoading, context]);

  useEffect(() => {
    if (activeTab !== "preview") return;

    const localId = context?.local?.id;
    if (!localId) return;

    const cachedPromos = promosCacheRef.current.get(localId);
    if (cachedPromos) {
      setPreviewPromos(cachedPromos);
      setPromosLoading(false);
      setPromosError(null);
      return;
    }

    let cancelled = false;
    setPromosLoading(true);
    setPromosError(null);
    setPreviewPromos([]);

    getPanelPromosByLocalId(localId, false)
      .then((items) => {
        if (cancelled) return;
        promosCacheRef.current.set(localId, items);
        setPreviewPromos(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setPromosError(err instanceof Error ? err.message : "Error al cargar promociones");
        setPreviewPromos([]);
      })
      .finally(() => {
        if (cancelled) return;
        setPromosLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, context?.local?.id]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPanelLocalProfile();
      const normalizedOpeningHours = normalizeOpeningHoursForEditor(data.opening_hours);
      setProfile(data);
      setFormData({
        name: data.name || "",
        address: data.address || "",
        location: data.location || "",
        city: data.city || "",
        latitude: data.latitude != null ? String(data.latitude) : "",
        longitude: data.longitude != null ? String(data.longitude) : "",
        phone: data.phone || "",
        whatsapp: data.whatsapp || "",
        hoursText: toLines(data.hours),
        additionalInfoText: toLines(data.additional_info),
      });
      setCoordinatesInput(
        formatCoordinatePairInput(
          data.latitude != null ? String(data.latitude) : "",
          data.longitude != null ? String(data.longitude) : "",
        ),
      );
      setOpeningHoursDraft(normalizedOpeningHours);
      setUseStructuredHours(Boolean(data.opening_hours));
      setOpeningHoursErrors([]);
      setSelectedAttributes(Array.isArray(data.attributes) ? data.attributes : []);
      setMinAge(typeof data.min_age === "number" ? data.min_age : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // Catalog Handlers (solo clubs)
  // ==========================================================================

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError(null);

    try {
      const [tickets, tables] = await Promise.all([
        getCatalogTickets(),
        getCatalogTables(),
      ]);
      setCatalogTickets(tickets);
      setCatalogTables(tables);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al cargar catálogo");
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!canEdit) return;

    const name = newTicketData.name.trim();
    const priceNum = parseFloat(newTicketData.price);

    if (!name || name.length < 2) {
      setCatalogError("El nombre de la entrada debe tener al menos 2 caracteres");
      return;
    }

    if (isNaN(priceNum) || priceNum < 0) {
      setCatalogError("El precio debe ser un número mayor o igual a 0");
      return;
    }

    setSavingTicket(true);
    setCatalogError(null);

    try {
      const newTicket = await createCatalogTicket({
        name,
        price: priceNum,
        description: newTicketData.description.trim() || undefined,
      });
      setCatalogTickets([...catalogTickets, newTicket]);
      setNewTicketData({ name: "", price: "", description: "" });
      setShowNewTicketForm(false);
      setCatalogSuccess("Entrada creada correctamente");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al crear entrada");
    } finally {
      setSavingTicket(false);
    }
  };

  const handleToggleTicketActive = async (ticket: CatalogTicket) => {
    if (!canEdit) return;

    setSavingTicket(true);
    setCatalogError(null);

    try {
      const updated = await updateCatalogTicket(ticket.id, { is_active: !ticket.is_active });
      setCatalogTickets(catalogTickets.map((t) => (t.id === ticket.id ? updated : t)));
      setCatalogSuccess(updated.is_active ? "Entrada activada" : "Entrada desactivada");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al actualizar entrada");
    } finally {
      setSavingTicket(false);
    }
  };

  const handleCreateTable = async () => {
    if (!canEdit) return;

    const name = newTableData.name.trim();

    if (!name || name.length < 2) {
      setCatalogError("El nombre de la mesa debe tener al menos 2 caracteres");
      return;
    }

    let priceNum: number | null = null;
    if (newTableData.price.trim()) {
      priceNum = parseFloat(newTableData.price);
      if (isNaN(priceNum) || priceNum < 0) {
        setCatalogError("El precio referencial debe ser un número mayor o igual a 0");
        return;
      }
    }

    let capacityNum: number | null = null;
    if (newTableData.capacity.trim()) {
      capacityNum = parseInt(newTableData.capacity, 10);
      if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 50) {
        setCatalogError("La capacidad debe ser un número entre 1 y 50");
        return;
      }
    }

    setSavingTable(true);
    setCatalogError(null);

    try {
      const newTable = await createCatalogTable({
        name,
        price: priceNum,
        capacity: capacityNum,
        includes: newTableData.includes.trim() || undefined,
      });
      setCatalogTables([...catalogTables, newTable]);
      setNewTableData({ name: "", price: "", capacity: "", includes: "" });
      setShowNewTableForm(false);
      setCatalogSuccess("Mesa creada correctamente");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al crear mesa");
    } finally {
      setSavingTable(false);
    }
  };

  const handleToggleTableActive = async (table: CatalogTable) => {
    if (!canEdit) return;

    setSavingTable(true);
    setCatalogError(null);

    try {
      const updated = await updateCatalogTable(table.id, { is_active: !table.is_active });
      setCatalogTables(catalogTables.map((t) => (t.id === table.id ? updated : t)));
      setCatalogSuccess(updated.is_active ? "Mesa activada" : "Mesa desactivada");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al actualizar mesa");
    } finally {
      setSavingTable(false);
    }
  };

  const handleDeleteTicket = async (ticket: CatalogTicket) => {
    if (!canEdit) return;
    if (!window.confirm(`¿Eliminar la entrada "${ticket.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setSavingTicket(true);
    setCatalogError(null);

    try {
      await deleteCatalogTicket(ticket.id);
      setCatalogTickets(catalogTickets.filter((t) => t.id !== ticket.id));
      setCatalogSuccess("Entrada eliminada");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al eliminar entrada");
    } finally {
      setSavingTicket(false);
    }
  };

  const handleDeleteTable = async (table: CatalogTable) => {
    if (!canEdit) return;
    if (!window.confirm(`¿Eliminar la mesa "${table.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setSavingTable(true);
    setCatalogError(null);

    try {
      await deleteCatalogTable(table.id);
      setCatalogTables(catalogTables.filter((t) => t.id !== table.id));
      setCatalogSuccess("Mesa eliminada");
      setTimeout(() => setCatalogSuccess(null), 3000);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al eliminar mesa");
    } finally {
      setSavingTable(false);
    }
  };

  // Computed: contadores para tickets
  const activeTicketsCount = catalogTickets.filter((t) => t.is_active).length;
  const activeTablesCount = catalogTables.filter((t) => t.is_active).length;
  const canAddMoreTickets = catalogTickets.length < MAX_TICKET_TYPES;
  const canActivateMoreTickets = activeTicketsCount < MAX_ACTIVE_TICKETS;

  // Helper para formatear precio
  const formatPYG = (price: number): string => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleStructuredHoursToggle = (enabled: boolean) => {
    setUseStructuredHours(enabled);
    setOpeningHoursErrors([]);
    setError(null);
  };

  const handleDayClosedToggle = (dayKey: OpeningHoursDayKey, closed: boolean) => {
    setOpeningHoursDraft((prev) => {
      const currentDay = prev.days[dayKey];
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: closed
            ? { closed: true, ranges: [] }
            : {
                closed: false,
                ranges: currentDay.ranges.length > 0 ? currentDay.ranges : [{ ...OPENING_HOURS_DEFAULT_RANGE }],
              },
        },
      };
    });
    setOpeningHoursErrors([]);
    setError(null);
  };

  const handleRangeChange = (
    dayKey: OpeningHoursDayKey,
    rangeIndex: number,
    field: "start" | "end",
    value: string,
  ) => {
    setOpeningHoursDraft((prev) => {
      const dayConfig = prev.days[dayKey];
      const updatedRanges = dayConfig.ranges.map((range, index) =>
        index === rangeIndex ? { ...range, [field]: value } : range
      );
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: { ...dayConfig, ranges: updatedRanges },
        },
      };
    });
    setOpeningHoursErrors([]);
    setError(null);
  };

  const handleAddRange = (dayKey: OpeningHoursDayKey) => {
    setOpeningHoursDraft((prev) => {
      const dayConfig = prev.days[dayKey];
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            closed: false,
            ranges: [...dayConfig.ranges, { ...OPENING_HOURS_DEFAULT_RANGE }],
          },
        },
      };
    });
    setOpeningHoursErrors([]);
    setError(null);
  };

  const handleRemoveRange = (dayKey: OpeningHoursDayKey, rangeIndex: number) => {
    setOpeningHoursDraft((prev) => {
      const dayConfig = prev.days[dayKey];
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            ...dayConfig,
            ranges: dayConfig.ranges.filter((_, index) => index !== rangeIndex),
          },
        },
      };
    });
    setOpeningHoursErrors([]);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canEdit) return;

    // Validacion basica
    if (formData.name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    if (formData.location.trim().length > 80) {
      setError("La ubicacion no puede superar 80 caracteres");
      return;
    }

    const parsedCoordinates = parseCoordinatePairInput(coordinatesInput);
    if (parsedCoordinates.formatError) {
      setError("Coordenadas inválidas. Usa el formato lat,lng.");
      return;
    }

    const parsedLatitude = parsedCoordinates.latitude;
    if (parsedLatitude === "invalid" || (parsedLatitude !== null && (parsedLatitude < -90 || parsedLatitude > 90))) {
      setError("Latitud inválida. Debe estar entre -90 y 90.");
      return;
    }

    const parsedLongitude = parsedCoordinates.longitude;
    if (parsedLongitude === "invalid" || (parsedLongitude !== null && (parsedLongitude < -180 || parsedLongitude > 180))) {
      setError("Longitud inválida. Debe estar entre -180 y 180.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    setOpeningHoursErrors([]);

    try {
      let hours: string[] = [];
      let openingHoursPayload: OpeningHoursV1 | undefined;

      if (useStructuredHours) {
        const validation = validateOpeningHoursForSubmit(openingHoursDraft);
        if (validation.errors.length > 0) {
          setOpeningHoursErrors(validation.errors);
          setError("Corregí los horarios estructurados antes de guardar.");
          return;
        }
        openingHoursPayload = validation.normalized;
        hours = deriveLegacyHours(validation.normalized, "expanded");
      } else {
        hours = parseLines(formData.hoursText);
      }

      const additional_info = parseLines(formData.additionalInfoText);

      const updated = await updatePanelLocalProfile({
        name: formData.name.trim(),
        address: formData.address.trim(),
        location: formData.location.trim(),
        city: formData.city.trim() || null,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim(),
        hours,
        ...(useStructuredHours ? { opening_hours: openingHoursPayload ?? null } : {}),
        additional_info,
        attributes: selectedAttributes,
        min_age: minAge,
      });

      setProfile(updated);
      setOpeningHoursDraft(normalizeOpeningHoursForEditor(updated.opening_hours));
      setUseStructuredHours(Boolean(updated.opening_hours) || useStructuredHours);
      setFormData((prev) => ({
        ...prev,
        latitude: updated.latitude != null ? String(updated.latitude) : "",
        longitude: updated.longitude != null ? String(updated.longitude) : "",
        hoursText: toLines(updated.hours),
        additionalInfoText: toLines(updated.additional_info),
      }));
      setCoordinatesInput(
        formatCoordinatePairInput(
          updated.latitude != null ? String(updated.latitude) : "",
          updated.longitude != null ? String(updated.longitude) : "",
        ),
      );
      setSuccess(true);

      // Ocultar mensaje de exito despues de 3s
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleSwapCoordinates = () => {
    if (typeof parsedLatitudeInput !== "number" || typeof parsedLongitudeInput !== "number") return;
    setFormData((prev) => ({
      ...prev,
      latitude: String(parsedLongitudeInput),
      longitude: String(parsedLatitudeInput),
    }));
    setCoordinatesInput(`${parsedLongitudeInput},${parsedLatitudeInput}`);
  };

  const handleCoordinatesInputChange = (value: string) => {
    setCoordinatesInput(value);

    const parsedCoordinates = parseCoordinatePairInput(value);
    if (!value.trim()) {
      setFormData((prev) => ({
        ...prev,
        latitude: "",
        longitude: "",
      }));
      return;
    }

    if (
      !parsedCoordinates.formatError &&
      parsedCoordinates.latitude !== "invalid" &&
      parsedCoordinates.longitude !== "invalid"
    ) {
      setFormData((prev) => ({
        ...prev,
        latitude:
          typeof parsedCoordinates.latitude === "number"
            ? String(parsedCoordinates.latitude)
            : "",
        longitude:
          typeof parsedCoordinates.longitude === "number"
            ? String(parsedCoordinates.longitude)
            : "",
      }));
    }
  };

  // ==========================================================================
  // Gallery Handlers
  // ==========================================================================

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>, kindOverride?: GalleryKind) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit || !profile) return;

    const kind = kindOverride || uploadKind;
    setGalleryError(null);
    setGalleryWarning(null);

    // Usar validación mejorada
    const validation = await validateImageFile(file, kind);

    if (!validation.valid) {
      setGalleryError(validation.error || "Error de validación");
      e.target.value = "";
      return;
    }

    // Mostrar warning si existe (no bloquea)
    if (validation.warning) {
      setGalleryWarning(validation.warning);
    }

    // Validar cantidad máxima
    if (profile.gallery.length >= 12) {
      setGalleryError("Máximo 12 imágenes en la galería. Eliminá alguna primero.");
      e.target.value = "";
      return;
    }

    // Validar solo 1 cover (si estamos subiendo cover)
    if (kind === "cover" && profile.gallery.some(g => g.kind === "cover")) {
      setGalleryError("Ya existe una foto de perfil. Eliminá la actual primero para subir una nueva.");
      e.target.value = "";
      return;
    }

    setUploading(true);

    try {
      // Upload via signed URL (evita límite 100KB)
      const newItem = await uploadGalleryImage(file, kind);

      // Agregar a gallery via PATCH
      const updatedGallery = [...profile.gallery, newItem];
      const updated = await updatePanelLocalProfile({ gallery: updatedGallery });
      setProfile(updated);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Reset any slot-specific file input
      e.target.value = "";

      // Limpiar warning después de subir exitosamente
      setTimeout(() => setGalleryWarning(null), 5000);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!canEdit || !profile) return;

    if (!confirm("¿Eliminar esta imagen?")) return;

    setGalleryError(null);

    try {
      const result = await deleteGalleryImage(imageId);
      // Update local state with returned gallery
      setProfile({ ...profile, gallery: result.gallery });
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Error al eliminar imagen");
    }
  };

  const handleSetCover = async (imageId: string) => {
    if (!canEdit || !profile) return;

    setGalleryError(null);

    try {
      // Change kind to cover, remove cover from others
      const updatedGallery = profile.gallery.map(g => ({
        ...g,
        kind: g.id === imageId ? "cover" as GalleryKind : (g.kind === "cover" ? "carousel" as GalleryKind : g.kind),
      }));

      const updated = await updatePanelLocalProfile({ gallery: updatedGallery });
      setProfile(updated);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Error al cambiar portada");
    }
  };

  const handleMoveImage = async (imageId: string, direction: "up" | "down") => {
    if (!canEdit || !profile) return;

    const idx = profile.gallery.findIndex(g => g.id === imageId);
    if (idx === -1) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= profile.gallery.length) return;

    setGalleryError(null);

    try {
      // Swap items
      const updatedGallery = [...profile.gallery];
      [updatedGallery[idx], updatedGallery[newIdx]] = [updatedGallery[newIdx], updatedGallery[idx]];

      // Normalize order
      updatedGallery.forEach((g, i) => {
        g.order = i;
      });

      const updated = await updatePanelLocalProfile({ gallery: updatedGallery });
      setProfile(updated);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Error al reordenar");
    }
  };

  // Reordenar imagen dentro de su categoría (kind)
  const handleMoveImageInKind = async (imageId: string, kind: GalleryKind, direction: "up" | "down") => {
    if (!canEdit || !profile) return;

    // Obtener solo imágenes de ese kind, ordenadas
    const kindImages = profile.gallery
      .filter(g => g.kind === kind)
      .sort((a, b) => a.order - b.order);
    
    const idx = kindImages.findIndex(g => g.id === imageId);
    if (idx === -1) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= kindImages.length) return;

    setGalleryError(null);

    try {
      // Swap orders entre los dos items
      const item1 = kindImages[idx];
      const item2 = kindImages[newIdx];

      const updatedGallery = profile.gallery.map(g => {
        if (g.id === item1.id) return { ...g, order: item2.order };
        if (g.id === item2.id) return { ...g, order: item1.order };
        return g;
      });

      const updated = await updatePanelLocalProfile({ gallery: updatedGallery });
      setProfile(updated);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Error al reordenar");
    }
  };

  // ==========================================================================
  // Helpers
  // ==========================================================================

  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error("Error cargando imagen"));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Valida un archivo de imagen con mensajes claros en español.
   * Retorna error (bloquea) o warning (no bloquea, solo avisa).
   */
  async function validateImageFile(file: File, kind: GalleryKind): Promise<ImageValidationResult> {
    // 1. Validar tipo MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      const extension = file.name.split(".").pop()?.toUpperCase() || "desconocido";
      return {
        valid: false,
        error: `Formato "${extension}" no permitido. Usá JPG, PNG o WebP.`,
      };
    }

    // 2. Validar tamaño
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `La imagen pesa ${formatBytes(file.size)}, pero el máximo es ${MAX_FILE_SIZE_MB}MB. Reducí el tamaño o calidad.`,
      };
    }

    // 3. Validar dimensiones mínimas
    let dimensions: { width: number; height: number };
    try {
      dimensions = await getImageDimensions(file);
    } catch {
      return {
        valid: false,
        error: "No se pudo leer la imagen. Verificá que el archivo no esté corrupto.",
      };
    }

    if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
      return {
        valid: false,
        error: `La imagen es muy pequeña (${dimensions.width}×${dimensions.height}). Mínimo requerido: ${MIN_WIDTH}×${MIN_HEIGHT}px.`,
        dimensions,
      };
    }

    // 4. Verificar ratio recomendado (warning, no bloquea)
    const recommended = RECOMMENDED_SIZES[kind];
    let warning: string | undefined;

    if (recommended) {
      const actualRatio = dimensions.width / dimensions.height;
      const expectedRatio = recommended.width / recommended.height;
      const ratioDiff = Math.abs(actualRatio - expectedRatio);

      // Si difiere más de 10% del ratio esperado, avisar
      if (ratioDiff > 0.1) {
        warning = `El ratio de tu imagen no es ${recommended.ratio}. Se recortará al centro para ajustar.`;
      }
    }

    return {
      valid: true,
      warning,
      dimensions,
    };
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  // Loading state
  if (contextLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!context || !profile) {
    return (
      <div className="text-red-600">Error al cargar informacion del perfil</div>
    );
  }

  const sortedGallery = [...profile.gallery].sort((a, b) => a.order - b.order);
  const previewName = formData.name.trim() || profile.name;
  const previewAddress = formData.address.trim();
  const previewLocation = formData.location.trim();
  const previewCity = formData.city.trim();
  const parsedCoordinateInput = parseCoordinatePairInput(coordinatesInput);
  const parsedLatitudeInput = parsedCoordinateInput.latitude;
  const parsedLongitudeInput = parsedCoordinateInput.longitude;
  const coordinateInlineError = parsedCoordinateInput.formatError
    ? "Usa el formato lat,lng."
    : parsedLatitudeInput === "invalid"
      ? "Latitud inválida."
      : typeof parsedLatitudeInput === "number" && !isInRange(parsedLatitudeInput, -90, 90)
        ? "Latitud fuera de rango (-90 a 90)."
        : parsedLongitudeInput === "invalid"
          ? "Longitud inválida."
          : typeof parsedLongitudeInput === "number" &&
              !isInRange(parsedLongitudeInput, -180, 180)
            ? "Longitud fuera de rango (-180 a 180)."
            : null;
  const hasValidCoordinatePair =
    typeof parsedLatitudeInput === "number" &&
    typeof parsedLongitudeInput === "number" &&
    !coordinateInlineError;
  const likelySwappedCoordinates =
    hasValidCoordinatePair && isLikelySwappedCoordinates(parsedLatitudeInput, parsedLongitudeInput);
  const outsideParaguayBounds =
    hasValidCoordinatePair &&
    !isWithinParaguay(parsedLatitudeInput, parsedLongitudeInput);
  const mapsPreviewUrl = hasValidCoordinatePair
    ? `https://www.google.com/maps?q=${parsedLatitudeInput},${parsedLongitudeInput}`
    : null;
  const hasPersistedOpeningHours = Boolean(profile?.opening_hours);
  const derivedLegacyHoursExpanded = deriveLegacyHours(openingHoursDraft, "expanded");
  const previewPhone = formData.phone.trim();
  const previewWhatsapp = formData.whatsapp.trim();
  const previewHours = useStructuredHours
    ? derivedLegacyHoursExpanded
    : parseLines(formData.hoursText);
  const previewAdditionalInfo = parseLines(formData.additionalInfoText);
  const renderListingPreviewReferences = (imageUrl: string | null) => (
    <div className="flex flex-wrap justify-center gap-6">
      {LISTING_PREVIEW_REFERENCES.map((reference) => (
        <div key={reference.key} className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {reference.label}
          </p>
          <div className={cn("max-w-full", reference.widthClass)}>
            <ListingPreviewCard
              localType={context.local.type}
              name={previewName}
              imageUrl={imageUrl}
              location={previewLocation}
              city={previewCity}
              attributes={previewAttributes}
              minAge={minAge}
              hours={previewHours}
              className={cn("max-w-full", reference.widthClass)}
            />
          </div>
        </div>
      ))}
    </div>
  );
  const previewAttributes = selectedAttributes.slice(0, 3);
  const previewCoverImage = sortedGallery.find((item) => item.kind === "cover")?.url ?? null;
  const previewHeroImage = sortedGallery.find((item) => item.kind === "hero")?.url ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Perfil del Local</h1>
        <p className="text-gray-600 mt-2">
          Información que se muestra en tu página pública
        </p>
      </div>

      <div className="inline-flex w-full max-w-sm rounded-xl border border-neutral-200 bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "edit"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "preview"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Vista previa
        </button>
      </div>

      {activeTab === "edit" ? (
        <div {...PROFILE_EDIT_DARK_SCOPE_ATTR} className="space-y-8">
          {/* Mensaje de permisos */}
          {!canEdit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Solo el propietario (owner) puede editar el perfil del local.
              </p>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">
                Cambios guardados correctamente
              </p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* =================================================================== */}
          {/* GALERÍA DEL LOCAL */}
          {/* =================================================================== */}
      <section
        data-profile-module="gallery"
        className={PROFILE_SECTION_SHELL_CLASS}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Galería del Local
        </h2>

        {/* Gallery error */}
        {galleryError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{galleryError}</p>
          </div>
        )}

        {/* Gallery warning (no bloquea, solo avisa) */}
        {galleryWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">⚠️ {galleryWarning}</p>
          </div>
        )}

        {uploading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">Subiendo imagen...</p>
          </div>
        )}

        {/* ===== FOTO DE PERFIL (cover) ===== */}
        <div
          data-profile-accent-surface="true"
          className="pb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Foto de Perfil</h3>
          <p className="text-sm text-gray-600 mb-4">
            Esta imagen aparecerá en la foto de perfil del local.
          </p>

          <FormatsDisclosure recommended={RECOMMENDED_SIZES.cover.label} />
          
          {(() => {
            const coverImage = sortedGallery.find(g => g.kind === "cover");
            return (
              <div className="flex min-w-0 flex-col items-center gap-4 overflow-x-hidden">
                <div className="w-full">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide text-center">Preview de card del listado</p>
                  {renderListingPreviewReferences(coverImage?.url ?? previewHeroImage)}
                </div>

                {canEdit ? (
                  coverImage ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <label
                        data-profile-soft-action="true"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, "cover")}
                          disabled={uploading}
                        />
                        <span>Cambiar foto</span>
                      </label>
                      <button
                        onClick={() => handleDeleteImage(coverImage.id)}
                        {...DELETE_BUTTON_DATA_ATTR}
                        className={cn(
                          panelUi.destructiveOutline,
                          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                        )}
                        title="Eliminar foto de perfil"
                      >
                        <span>Eliminar</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex max-w-[360px] flex-col items-center gap-3 text-center">
                      <p className="text-sm text-gray-500">
                        No hay foto de perfil cargada. Subila y la verás aplicada directamente en la card del listado.
                      </p>
                      <label
                        data-profile-soft-action="true"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, "cover")}
                          disabled={uploading}
                        />
                        <span>Subir foto de perfil</span>
                      </label>
                    </div>
                  )
                ) : null}
              </div>
            );
          })()}
        </div>

        <div
          id="profile-gallery-divider-lightmode-01"
          aria-hidden="true"
          className="border-t border-neutral-200 pt-8"
        />

        {/* ===== HERO (BAR y CLUB) ===== */}
        <div
          data-profile-accent-surface="true"
          className="mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {context.local.type === "bar" ? "Imagen Principal del Perfil" : "Imagen principal del perfil"}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Esta imagen aparece dentro del perfil de tu local como imagen principal. Es diferente a la Foto de Perfil.
          </p>

            <FormatsDisclosure recommended={RECOMMENDED_SIZES.hero.label} />
            
            {(() => {
              const heroImage = sortedGallery.find(g => g.kind === "hero");
              const coverImage = sortedGallery.find(g => g.kind === "cover");
              const isDuplicate = heroImage && coverImage && heroImage.url === coverImage.url;
              const isBarLocal = context.local.type === "bar";
              const heroPreviewImage = heroImage ?? coverImage;
              const carouselImages = sortedGallery.filter((item) => item.kind === "carousel");
              const barPreviewTiles = (["food", "menu", "drinks", "interior"] as const).map((kind) => ({
                kind,
                label: GALLERY_KIND_LABELS[kind],
                image: sortedGallery.find((item) => item.kind === kind),
              }));
              
              return (
                <>
                  {/* Warning de duplicación */}
                  {isDuplicate && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        ⚠️ Estás usando la misma imagen para Foto de perfil (cover) e Imagen principal (hero). Se verá repetida.
                      </p>
                    </div>
                  )}
                  
                  <div
                    className={
                      isBarLocal
                        ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]"
                        : "grid grid-cols-1 gap-6"
                    }
                  >
                    {isBarLocal && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Imagen actual</p>
                        {heroImage ? (
                          <div className="relative w-full max-w-[560px] aspect-video max-h-[280px] rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                            <img src={heroImage.url} alt="Imagen principal" className="w-full h-full object-cover" />
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteImage(heroImage.id)}
                                {...DELETE_BUTTON_DATA_ATTR}
                                className={cn(
                                  panelUi.destructiveOutline,
                                  "absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
                                )}
                                title="Eliminar imagen principal"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        ) : canEdit ? (
                          <label
                            data-profile-soft-action="true"
                            className="block w-full max-w-[560px] aspect-video max-h-[280px] rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-500 bg-white cursor-pointer flex flex-col items-center justify-center text-purple-500 hover:text-purple-600 transition-colors"
                          >
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, "hero")}
                              disabled={uploading}
                            />
                            <span className="text-3xl mb-2">🖼️</span>
                            <span className="font-medium">Subir imagen principal</span>
                            <span className="text-xs text-gray-400 mt-1">Esta se ve dentro del perfil</span>
                          </label>
                        ) : (
                          <div className="w-full max-w-[560px] aspect-video max-h-[280px] rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                            Sin imagen principal
                          </div>
                        )}
                      </div>
                    )}
                    {isBarLocal && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Vista previa pública (Bar)</p>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:auto-rows-[118px]">
                            <div className="relative col-span-2 aspect-video rounded-lg overflow-hidden border bg-gray-100 lg:row-span-2 lg:aspect-auto">
                              {heroPreviewImage ? (
                                <img
                                  src={heroPreviewImage.url}
                                  alt="Preview Hero Bar"
                                  className="absolute inset-0 h-full w-full object-cover object-center"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                  Sin imagen
                                </div>
                              )}
                            </div>
                            {barPreviewTiles.map((tile) => (
                              <div key={tile.kind} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 lg:aspect-auto">
                                {tile.image ? (
                                  <img
                                    src={tile.image.url}
                                    alt={tile.label}
                                    className="absolute inset-0 h-full w-full object-cover object-center"
                                  />
                                ) : null}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5">
                                  <span className="text-xs font-medium text-white">{tile.label}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {!isBarLocal && (
                      <div className="w-full space-y-4">
                        <ClubHeroSurface
                          name={previewName || "Nombre de la discoteca"}
                          heroImageUrl={heroImage?.url ?? null}
                          showPublicMeta={false}
                          showHeroTextContent={false}
                          emptyTitle="Todavia no cargaste una imagen principal"
                          emptyDescription="Esta superficie muestra la portada visual del perfil de tu discoteca."
                          emptyAction={
                            canEdit ? (
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => handleFileSelect(e, "hero")}
                                  disabled={uploading}
                                />
                                <span>Subir imagen principal</span>
                              </label>
                            ) : null
                          }
                          onOpenGallery={() => setShowClubGalleryManager(true)}
                        />

                        <div
                          data-profile-soft-surface="true"
                          className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm text-gray-500">
                                {carouselImages.length > 0
                                  ? `${carouselImages.length} imagen(es) disponibles en la galeria del perfil.`
                                  : "Todavia no cargaste imagenes para la galeria del perfil."}
                              </p>
                            </div>

                            {canEdit && (
                              <div className="flex flex-wrap gap-2">
                                <label
                                  data-profile-soft-action="true"
                                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                                >
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e, "hero")}
                                    disabled={uploading}
                                  />
                                  <span>{heroImage ? "Cambiar imagen principal" : "Subir hero"}</span>
                                </label>
                                {heroImage && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteImage(heroImage.id)}
                                    {...DELETE_BUTTON_DATA_ATTR}
                                    className={cn(
                                      panelUi.destructiveOutline,
                                      "rounded-lg px-3 py-2 text-sm font-medium"
                                    )}
                                  >
                                    Eliminar
                                  </button>
                                )}
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e, "carousel")}
                                    disabled={uploading}
                                  />
                                  <span>Agregar imagen a galeria</span>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {showClubGalleryManager && (
                          <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
                            onClick={() => setShowClubGalleryManager(false)}
                            role="dialog"
                            aria-modal="true"
                          >
                            <div
                              className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900">Galeria del perfil</h4>
                                  <p className="mt-1 text-sm text-gray-500">
                                    Gestiona aca las imagenes que acompanian la experiencia movil del perfil.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowClubGalleryManager(false)}
                                  className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                                >
                                  Cerrar
                                </button>
                              </div>

                              <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-6">
                                <div className="mb-5 space-y-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">Imagenes de galeria / carrusel</p>
                                      <p className="mt-1 text-xs text-gray-500">
                                        Se muestran cuando el usuario abre la galeria del perfil.
                                      </p>
                                    </div>
                                    {canEdit && (
                                      <label
                                        data-profile-soft-action="true"
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                                      >
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          className="hidden"
                                          onChange={(e) => handleFileSelect(e, "carousel")}
                                          disabled={uploading}
                                        />
                                        <span>Agregar imagen</span>
                                      </label>
                                    )}
                                  </div>
                                  <FormatsDisclosure
                                    recommended={RECOMMENDED_SIZES.carousel.label}
                                  />
                                </div>

                                {carouselImages.length > 0 ? (
                                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {carouselImages.map((item, idx) => (
                                      <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                        <div className="relative aspect-[4/3] bg-gray-100">
                                          <img
                                            src={item.url}
                                            alt={`Galeria ${idx + 1}`}
                                            className="h-full w-full object-cover"
                                          />
                                          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-900 shadow-sm">
                                            #{idx + 1}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                                          <div className="min-w-0">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Orden</p>
                                            <p className="truncate text-sm font-semibold text-gray-900">#{idx + 1}</p>
                                          </div>
                                          {canEdit && (
                                            <div className="flex gap-2">
                                              {idx > 0 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveImage(item.id, "up")}
                                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                                                  title="Mover antes"
                                                >
                                                  ↑
                                                </button>
                                              )}
                                              {idx < carouselImages.length - 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveImage(item.id, "down")}
                                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                                                  title="Mover despues"
                                                >
                                                  ↓
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteImage(item.id)}
                                                {...DELETE_BUTTON_DATA_ATTR}
                                                className={cn(
                                                  panelUi.destructiveOutline,
                                                  "rounded-md px-2.5 py-1 text-xs font-medium"
                                                )}
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center">
                                    <div className="space-y-3">
                                      <div className="text-4xl">🖼️</div>
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-gray-700">Todavia no cargaste imagenes de galeria</p>
                                        <p className="text-xs text-gray-500">
                                          Agregalas aca para completar la galeria del perfil.
                                        </p>
                                      </div>
                                      {canEdit && (
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100">
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={(e) => handleFileSelect(e, "carousel")}
                                            disabled={uploading}
                                          />
                                          <span>Agregar imagenes</span>
                                        </label>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

        {/* ===== UI ESPECÍFICA POR TIPO ===== */}
        {context.local.type === "bar" ? (
          /* ===== BAR: Galería por categoría (múltiples imágenes) ===== */
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Galería por Categorías</h3>
              <p className="text-sm text-gray-600 mb-3">
                Subí varias imágenes por categoría. La primera de cada una se muestra como foto de su respectivo apartado. Al hacer clic, los usuarios ven la galería completa de esa categoría.
              </p>
              <FormatsDisclosure
                recommended={RECOMMENDED_SIZES.food.label}
              />
            </div>
            {(["food", "menu", "drinks", "interior"] as const).map((kind) => {
              const kindImages = sortedGallery.filter(g => g.kind === kind);
              return (
                <div
                  key={kind}
                  data-profile-soft-surface="true"
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">{GALLERY_KIND_LABELS[kind]}</h4>
                    {canEdit && (
                      <label
                        data-profile-soft-action="true"
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-blue-500 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, kind)}
                          disabled={uploading}
                        />
                        <span>+ Agregar</span>
                      </label>
                    )}
                  </div>
                  {kindImages.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {kindImages.map((item, idx) => (
                        <div key={item.id} className="relative group w-[96px] sm:w-[112px] md:w-[128px]">
                          <div className="aspect-square rounded-lg overflow-hidden border">
                            <img src={item.url} alt={`${GALLERY_KIND_LABELS[kind]} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          {canEdit && (
                            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {idx > 0 && (
                                <button
                                  onClick={() => handleMoveImageInKind(item.id, kind, "up")}
                                  className="p-1 bg-white rounded text-xs shadow hover:bg-gray-100"
                                  title="Mover a la izquierda"
                                >
                                  ←
                                </button>
                              )}
                              {idx < kindImages.length - 1 && (
                                <button
                                  onClick={() => handleMoveImageInKind(item.id, kind, "down")}
                                  className="p-1 bg-white rounded text-xs shadow hover:bg-gray-100"
                                  title="Mover a la derecha"
                                >
                                  →
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteImage(item.id)}
                                {...DELETE_BUTTON_DATA_ATTR}
                                className={cn(
                                  panelUi.destructiveOutline,
                                  "inline-flex items-center justify-center rounded-md p-1.5"
                                )}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-lg border border-dashed">
                      Sin imágenes en esta categoría
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

      </section>

      {/* =================================================================== */}
      {/* FORMULARIO DE DATOS */}
      {/* =================================================================== */}
      <form
        id="profile-edit-form"
        data-profile-edit-form="true"
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        <div className="space-y-8">
          <section
            data-profile-module="local-info"
            className={PROFILE_SECTION_SHELL_CLASS}
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                Informacion del Local
              </h2>
              <p className="text-base text-neutral-500">
                Datos principales que se muestran en el perfil publico
              </p>
            </div>

            <div className="mt-8 space-y-8">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
                    Nombre del local *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="block text-sm font-medium text-neutral-700">
                    Direccion
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    placeholder="Ej: Av. Mariscal Lopez 1234"
                  />
                  <p className="text-sm text-neutral-500">
                    Direccion completa para el boton de &quot;Como llegar&quot;.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="location" className="block text-sm font-medium text-neutral-700">
                    Zona / Barrio
                  </label>
                  <select
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                  >
                    <option value="">Seleccionar zona...</option>
                    {ZONES.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="city" className="block text-sm font-medium text-neutral-700">
                    Ciudad
                  </label>
                  <select
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                  >
                    <option value="">Seleccionar ciudad...</option>
                    {CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="minAge" className="block text-sm font-medium text-neutral-700">
                    Edad minima
                  </label>
                  <select
                    id="minAge"
                    value={minAge === null ? "" : String(minAge)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMinAge(val === "" ? null : parseInt(val, 10));
                    }}
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                  >
                    <option value="">Todo publico (sin restriccion)</option>
                    {MIN_AGES.map((age) => (
                      <option key={age} value={age}>+{age}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="coordinates" className="block text-sm font-medium text-neutral-700">
                  Coordenadas
                </label>
                <input
                  type="text"
                  id="coordinates"
                  value={coordinatesInput}
                  onChange={(e) => handleCoordinatesInputChange(e.target.value)}
                  disabled={!canEdit || saving}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                  placeholder="-25.2912657246182,-57.5743895830327"
                />
                {coordinateInlineError ? (
                  <p className="text-sm text-red-600">{coordinateInlineError}</p>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Pega las coordenadas en formato lat,lng.
                  </p>
                )}
              </div>

              <div
                data-profile-location-help="true"
                className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4"
              >
                <p className="text-sm font-medium text-neutral-700">
                  Ubicacion exacta recomendada
                </p>
                <details {...PROFILE_DISCLOSURE_ATTR} className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
                    <span>Como verificar las coordenadas</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div
                    {...PROFILE_DISCLOSURE_PANEL_ATTR}
                    className="mt-3 space-y-1 text-sm text-neutral-500"
                  >
                    <p>
                      Te recomendamos abrir la ubicacion del local en Google Maps y copiar
                      la latitud y longitud.
                    </p>
                    <p>
                      Luego clickear el texto en azul que dice "Ver en google Maps" y
                      deberia llevarte a la ubicacion exacta.
                    </p>
                    <p>
                      Si no es la ubicacion exacta, revisa el orden en el que pegaste la
                      latitud y longitud.
                    </p>
                    {mapsPreviewUrl ? (
                      <a
                        href={mapsPreviewUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex pt-1 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Ver en Google Maps
                      </a>
                    ) : null}
                  </div>
                </details>
                {outsideParaguayBounds ? (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p>
                      {likelySwappedCoordinates
                        ? "Las coordenadas parecen invertidas (lat/lng)."
                        : "Las coordenadas estan fuera de Paraguay y podrian generar un pin incorrecto."}
                    </p>
                    {likelySwappedCoordinates ? (
                      <button
                        type="button"
                        onClick={handleSwapCoordinates}
                        className="mt-2 inline-flex rounded-md border border-amber-400 px-2 py-1 font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Intercambiar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
                    Telefono de contacto
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    placeholder="Ej: (021) 123-456"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="whatsapp" className="block text-sm font-medium text-neutral-700">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp: e.target.value })
                    }
                    disabled={!canEdit || saving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    placeholder="Ej: 595981123456"
                  />
                  <p className="text-sm text-neutral-500">
                    Numero con codigo de pais para el boton de WhatsApp.
                  </p>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-950">
                      {context?.local.type === "bar" ? "Especialidades" : "Generos musicales"}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Selecciona los {context?.local.type === "bar" ? "atributos principales" : "generos principales"} de tu local.
                    </p>
                  </div>
                  <span className="inline-flex h-9 items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-600">
                    {selectedAttributes.length}/3
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {(context?.local.type ? getAttributesAllowlist(context.local.type as "bar" | "club") : []).map((attr) => {
                    const isSelected = selectedAttributes.includes(attr);
                    const isDisabled = !canEdit || saving || (!isSelected && selectedAttributes.length >= 3);

                    return (
                      <button
                        key={attr}
                        type="button"
                        {...PROFILE_ATTRIBUTE_CHIP_ATTR}
                        data-active={isSelected ? "true" : "false"}
                        onClick={() => {
                          if (!canEdit || saving) return;
                          if (isSelected) {
                            setSelectedAttributes(selectedAttributes.filter(a => a !== attr));
                          } else if (selectedAttributes.length < 3) {
                            setSelectedAttributes([...selectedAttributes, attr]);
                          }
                        }}
                        disabled={isDisabled}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : isDisabled
                              ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                              : "border-neutral-300 bg-white text-neutral-700 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {attr}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 text-sm text-neutral-500">
                  Selecciona hasta 3 {context?.local.type === "bar" ? "especialidades" : "generos"} que apareceran en tu perfil y cards del listado.
                </p>
              </div>
            </div>
          </section>

          {/* Opening hours v1 + legacy compatibility */}
          <section
            data-profile-module="hours"
            className={PROFILE_SECTION_SHELL_CLASS}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                  Horarios
                </h3>
                <p className="text-base text-neutral-500">
                  Configura los horarios de apertura para cada dia de la semana
                </p>
              </div>

              {!hasPersistedOpeningHours && (
                <button
                  type="button"
                  onClick={() => handleStructuredHoursToggle(!useStructuredHours)}
                  disabled={!canEdit || saving}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {useStructuredHours ? "Usar modo legacy" : "Usar editor estructurado"}
                </button>
              )}
            </div>

            {useStructuredHours ? (
              <div className="mt-8 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
                {OPENING_HOURS_DAY_KEYS.map((dayKey, index) => {
                  const dayConfig = openingHoursDraft.days[dayKey];
                  const dayLabel = OPENING_HOURS_DAY_LABELS[dayKey];
                  const isClosed = dayConfig.closed;

                  return (
                    <div
                      key={dayKey}
                      className={`px-4 py-4 sm:px-5 ${index !== OPENING_HOURS_DAY_KEYS.length - 1 ? "border-b border-neutral-200" : ""}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={!isClosed}
                              onChange={(event) => handleDayClosedToggle(dayKey, !event.target.checked)}
                              disabled={!canEdit || saving}
                              className="peer sr-only"
                            />
                            <span className="h-6 w-11 rounded-full bg-neutral-200 transition-colors peer-checked:bg-slate-700 peer-disabled:opacity-50" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                          </label>

                          <p className="text-sm font-semibold text-neutral-900">{dayLabel.full}</p>
                          <span className={`text-sm ${isClosed ? "italic text-neutral-500" : "font-medium text-slate-700"}`}>
                            {isClosed ? "Cerrado" : "Abierto"}
                          </span>
                        </div>

                        {!isClosed && (
                          <div className="flex-1 lg:max-w-[820px]">
                            <div className="space-y-3">
                              {dayConfig.ranges.length === 0 ? (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                  Este dia esta abierto pero sin rangos. Agrega al menos un rango horario.
                                </p>
                              ) : null}

                              {dayConfig.ranges.map((range, index) => (
                                <div
                                  key={`${dayKey}-${index}`}
                                  className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                                >
                                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                    <div className="flex items-center gap-3">
                                      <span className="w-12 text-sm text-neutral-500">Desde</span>
                                      <input
                                        type="time"
                                        value={range.start}
                                        onChange={(event) =>
                                          handleRangeChange(dayKey, index, "start", event.target.value)
                                        }
                                        disabled={!canEdit || saving}
                                        className="w-full min-w-[112px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                                      />
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="w-12 text-sm text-neutral-500">Hasta</span>
                                      <input
                                        type="time"
                                        value={range.end}
                                        onChange={(event) =>
                                          handleRangeChange(dayKey, index, "end", event.target.value)
                                        }
                                        disabled={!canEdit || saving}
                                        className="w-full min-w-[112px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRange(dayKey, index)}
                                      disabled={!canEdit || saving}
                                      {...DELETE_BUTTON_DATA_ATTR}
                                      className={cn(
                                        panelUi.destructiveOutline,
                                        "xl:ml-auto rounded-xl px-3 py-2 text-xs font-medium"
                                      )}
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => handleAddRange(dayKey)}
                                disabled={!canEdit || saving}
                                className="inline-flex items-center px-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                + Agregar rango
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {openingHoursErrors.length > 0 && (
                  <div className="border-t border-neutral-200 bg-red-50/80 px-4 py-4 sm:px-5">
                    <p className="mb-1 text-sm font-medium text-red-700">Errores de horarios</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-red-700">
                      {openingHoursErrors.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                Si no tenes opening_hours cargado, podes seguir usando el campo legacy de abajo.
              </div>
            )}

            {!useStructuredHours && (
              <div className="mt-6 space-y-2">
                <label
                  htmlFor="hours"
                  className="block text-sm font-medium text-neutral-700"
                >
                  Horarios
                </label>
                <textarea
                  id="hours"
                  rows={5}
                  value={formData.hoursText}
                  onChange={(e) =>
                    setFormData({ ...formData, hoursText: e.target.value })
                  }
                  disabled={!canEdit || saving}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100 resize-none font-mono"
                  placeholder={`Lunes - Jueves: 18:00 - 02:00\nViernes - Sabado: 18:00 - 03:00\nDomingo: Cerrado`}
                />
                <p className="text-sm text-neutral-500">
                  Una linea por cada horario (max 14 lineas).
                </p>
              </div>
            )}
          </section>

          {/* Additional Info (textarea, 1 linea = 1 bullet) */}
          <section
            data-profile-module="additional-info"
            className={PROFILE_SECTION_SHELL_CLASS}
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                Informacion adicional
              </h3>
              <p className="text-base text-neutral-500">
                Informacion complementaria visible en el perfil del local
              </p>
            </div>

            <div className="mt-8 space-y-2">
              <label
                htmlFor="additionalInfo"
                className="block text-sm font-medium text-neutral-700"
              >
                Detalles del local
              </label>
              <textarea
                id="additionalInfo"
                rows={5}
                value={formData.additionalInfoText}
                onChange={(e) =>
                  setFormData({ ...formData, additionalInfoText: e.target.value })
                }
                disabled={!canEdit || saving}
                className="min-h-[160px] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100 resize-none"
                placeholder={`Estacionamiento disponible\nWiFi gratuito\nAcepta tarjetas`}
              />
              <p className="text-sm text-neutral-500">
                Informacion complementaria visible en el perfil (estacionamiento, facilidades, etc.). Una linea por item.
              </p>
            </div>
          </section>

        </div>
      </form>

      {/* =================================================================== */}
      {/* CATÁLOGO (solo discotecas) */}
      {/* =================================================================== */}
      {context.local.type === "club" && (
        <>
        <section
          data-profile-module="catalog"
          className={PROFILE_SECTION_SHELL_CLASS}
        >
          <div className="flex flex-col gap-6">
            <div className="border-b border-neutral-200 pb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                  Catálogo de Entradas y Mesas
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-neutral-600">
                  Gestioná las opciones de acceso y reservas disponibles para tu
                  local con acciones visibles y una lectura más clara del
                  catálogo activo.
                </p>
              </div>
            </div>

          {/* Catalog success/error banners */}
          {catalogSuccess && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm text-green-800">✓ {catalogSuccess}</p>
            </div>
          )}
          {catalogError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-800">{catalogError}</p>
            </div>
          )}

          {catalogLoading ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* ===== ENTRADAS ===== */}
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-950">
                        Entradas
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {catalogTickets.length}/{MAX_TICKET_TYPES} creadas ·{" "}
                        {activeTicketsCount}/{MAX_ACTIVE_TICKETS} activas
                      </p>
                    </div>
                  </div>
                  {canEdit && !showNewTicketForm && (
                    <button
                      onClick={() => {
                        setShowNewTableForm(false);
                        setShowNewTicketForm(true);
                      }}
                      disabled={!canAddMoreTickets}
                      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                        canAddMoreTickets
                          ? "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50"
                          : "cursor-not-allowed border-neutral-300 bg-neutral-100 text-neutral-400"
                      }`}
                      title={
                        canAddMoreTickets
                          ? undefined
                          : `Máximo ${MAX_TICKET_TYPES} entradas`
                      }
                    >
                      + Nueva entrada
                    </button>
                  )}
                </div>

                {/* Lista de tickets */}
                {catalogTickets.length > 0 ? (
                  <div className="space-y-3">
                    {catalogTickets.map((ticket) => {
                      const isBenefitsOpen = Boolean(
                        openTicketBenefits[ticket.id],
                      );
                      const benefitLines =
                        ticket.description
                          ?.split(/\r?\n/)
                          .map((line) => line.trim())
                          .filter(Boolean) ?? [];

                      return (
                        <article
                          key={ticket.id}
                          className={`rounded-3xl border px-5 py-4 shadow-sm ${
                            ticket.is_active
                              ? "border-neutral-200 bg-white"
                              : "border-neutral-200 bg-neutral-50"
                          }`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-base font-semibold text-neutral-950">
                                    {ticket.name}
                                  </span>
                                  {!ticket.is_active && (
                                    <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                                      Desactivada
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
                                  <span className="font-medium text-neutral-900">
                                    {ticket.price === 0
                                      ? "Gratis"
                                      : formatPYG(ticket.price)}
                                  </span>
                                </div>
                                {benefitLines.length > 0 && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenTicketBenefits((previous) => ({
                                          ...previous,
                                          [ticket.id]: !previous[ticket.id],
                                        }))
                                      }
                                      {...PROFILE_INLINE_DISCLOSURE_ATTR}
                                      className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 transition hover:text-neutral-900"
                                    >
                                      Ver beneficios
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${
                                          isBenefitsOpen ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>
                                    {isBenefitsOpen && (
                                      <div
                                        {...PROFILE_INLINE_DISCLOSURE_PANEL_ATTR}
                                        className="mt-3 rounded-xl bg-neutral-50 p-3"
                                      >
                                        <ul className="space-y-1.5 text-sm text-neutral-600">
                                          {benefitLines.map((line, index) => (
                                            <li
                                              key={`${ticket.id}-benefit-${index}`}
                                              className="flex gap-2"
                                            >
                                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                                              <span>{line}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            {canEdit && (
                              <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
                                <button
                                  onClick={() => handleToggleTicketActive(ticket)}
                                  disabled={
                                    savingTicket ||
                                    (!ticket.is_active &&
                                      !canActivateMoreTickets)
                                  }
                                  title={
                                    !ticket.is_active && !canActivateMoreTickets
                                      ? `Máximo ${MAX_ACTIVE_TICKETS} activas`
                                      : undefined
                                  }
                                  className={`rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                                    ticket.is_active
                                      ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                      : canActivateMoreTickets
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        : "cursor-not-allowed border border-neutral-300 bg-neutral-100 text-neutral-400"
                                  }`}
                                >
                                  {ticket.is_active ? "Desactivar" : "Activar"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTicket(ticket)}
                                  disabled={savingTicket}
                                  {...DELETE_BUTTON_DATA_ATTR}
                                  className={cn(
                                    panelUi.destructiveOutline,
                                    "rounded-xl px-3.5 py-2 text-sm font-medium"
                                  )}
                                  title="Eliminar entrada"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
                    No hay entradas configuradas
                  </div>
                )}

              </div>

              {/* ===== MESAS ===== */}
              <div className="space-y-5 border-t border-neutral-200 pt-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
                      <Armchair className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-950">
                        Mesas
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {catalogTables.length}/6 tipos de mesa ·{" "}
                        {activeTablesCount}/{catalogTables.length} activas
                      </p>
                    </div>
                  </div>
                  {canEdit && catalogTables.length < 6 && !showNewTableForm && (
                    <button
                      onClick={() => {
                        setShowNewTicketForm(false);
                        setShowNewTableForm(true);
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      + Nueva mesa
                    </button>
                  )}
                </div>

                {/* Lista de mesas */}
                {catalogTables.length > 0 ? (
                  <div className="space-y-3">
                    {catalogTables.map((table) => {
                      const isIncludesOpen = Boolean(
                        openTableIncludes[table.id],
                      );
                      const includeLines =
                        table.includes
                          ?.split(/\r?\n/)
                          .map((line) => line.trim())
                          .filter(Boolean) ?? [];

                      return (
                        <article
                          key={table.id}
                          className={`rounded-3xl border px-5 py-4 shadow-sm ${
                            table.is_active
                              ? "border-neutral-200 bg-white"
                              : "border-neutral-200 bg-neutral-50"
                          }`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-base font-semibold text-neutral-950">
                                    {table.name}
                                  </span>
                                  {!table.is_active && (
                                    <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                                      Desactivada
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
                                  {table.capacity && (
                                    <span>{table.capacity} personas</span>
                                  )}
                                  {table.price !== null && (
                                    <span className="font-medium text-neutral-900">
                                      {formatPYG(table.price)}
                                    </span>
                                  )}
                                </div>

                                {includeLines.length > 0 && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenTableIncludes((previous) => ({
                                          ...previous,
                                          [table.id]: !previous[table.id],
                                        }))
                                      }
                                      {...PROFILE_INLINE_DISCLOSURE_ATTR}
                                      className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 transition hover:text-neutral-900"
                                    >
                                      Ver qué incluye
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${
                                          isIncludesOpen ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>
                                    {isIncludesOpen && (
                                      <div
                                        {...PROFILE_INLINE_DISCLOSURE_PANEL_ATTR}
                                        className="mt-3 rounded-xl bg-neutral-50 p-3"
                                      >
                                        <ul className="space-y-1.5 text-sm text-neutral-600">
                                          {includeLines.map((line, index) => (
                                            <li
                                              key={`${table.id}-include-${index}`}
                                              className="flex gap-2"
                                            >
                                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                                              <span>{line}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                            {canEdit && (
                              <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
                                <button
                                  onClick={() => handleToggleTableActive(table)}
                                  disabled={savingTable}
                                  className={`rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                                    table.is_active
                                      ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {table.is_active ? "Desactivar" : "Activar"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTable(table)}
                                  disabled={savingTable}
                                  {...DELETE_BUTTON_DATA_ATTR}
                                  className={cn(
                                    panelUi.destructiveOutline,
                                    "rounded-xl px-3.5 py-2 text-sm font-medium"
                                  )}
                                  title="Eliminar mesa"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
                    No hay mesas configuradas
                  </div>
                )}

              </div>

              {/* Nota informativa */}
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-500">
                Las entradas y mesas activas aparecerán en el perfil público
                del local. Podés desactivar cualquier opción sin borrarla
                definitivamente.
              </div>
            </div>
          )}
          </div>
        </section>
        </>
      )}

      {canEdit && (
        <section
          data-profile-module="edit-actions"
          className={PROFILE_SECTION_SHELL_CLASS}
        >
          <div className="flex flex-col gap-4 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500">
              Los cambios se aplican a todo el perfil del local.
            </p>
            <button
              type="submit"
              form="profile-edit-form"
              {...PROFILE_PRIMARY_CTA_ATTR}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </section>
      )}

      {showNewTicketForm && canEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4">
            <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                    Nueva entrada
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Configurá un nuevo tipo de entrada para tu local.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeNewTicketModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Cerrar modal de nueva entrada"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newTicketData.name}
                    onChange={(e) =>
                      setNewTicketData({
                        ...newTicketData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Ej: Entrada General"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    Precio (Gs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newTicketData.price}
                    onChange={(e) =>
                      setNewTicketData({
                        ...newTicketData,
                        price: e.target.value,
                      })
                    }
                    placeholder="Ej: 50000"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    Beneficios (1 por línea)
                  </label>
                  <textarea
                    rows={4}
                    value={newTicketData.description}
                    onChange={(e) =>
                      setNewTicketData({
                        ...newTicketData,
                        description: e.target.value,
                      })
                    }
                    placeholder={"Acceso general\nBebida de bienvenida\nAcceso antes de la 1:00 AM"}
                    className="min-h-[120px] w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                    maxLength={500}
                  />
                  <p className="text-xs text-neutral-500">
                    Una línea por beneficio. Aparecerán como lista en el
                    perfil.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
                <button
                  type="button"
                  onClick={closeNewTicketModal}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateTicket}
                  disabled={savingTicket}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingTicket ? "Guardando..." : "Crear entrada"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showNewTableForm && canEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4">
            <div className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                    Nueva mesa
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Configurá una nueva mesa o zona VIP para reservas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeNewTableModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Cerrar modal de nueva mesa"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newTableData.name}
                    onChange={(e) =>
                      setNewTableData({
                        ...newTableData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Ej: Mesa VIP"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                    maxLength={100}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-900">
                      Capacidad
                    </label>
                    <input
                      type="number"
                      value={newTableData.capacity}
                      onChange={(e) =>
                        setNewTableData({
                          ...newTableData,
                          capacity: e.target.value,
                        })
                      }
                      placeholder="Ej: 6-8 personas"
                      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      min="1"
                      max="50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-900">
                      Precio referencial (Gs)
                    </label>
                    <input
                      type="number"
                      value={newTableData.price}
                      onChange={(e) =>
                        setNewTableData({
                          ...newTableData,
                          price: e.target.value,
                        })
                      }
                      placeholder="Ej: 1500000"
                      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      min="0"
                    />
                    <p className="text-xs text-neutral-500">
                      No se cobra online, solo informativo.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    ¿Qué incluye? (1 por línea)
                  </label>
                  <textarea
                    rows={4}
                    value={newTableData.includes}
                    onChange={(e) =>
                      setNewTableData({
                        ...newTableData,
                        includes: e.target.value,
                      })
                    }
                    placeholder={"Ubicación VIP\nServicio de mesero\nBotella de cortesía"}
                    className="min-h-[120px] w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                    maxLength={500}
                  />
                  <p className="text-xs text-neutral-500">
                    Una línea por beneficio. Aparecerán como lista en el
                    perfil.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
                <button
                  type="button"
                  onClick={closeNewTableModal}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateTable}
                  disabled={savingTable}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingTable ? "Guardando..." : "Crear mesa"}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900">Preview de card del listado</h3>
            <div className="mt-5">
              {renderListingPreviewReferences(previewCoverImage ?? previewHeroImage)}
            </div>
          </section>
          {context.local.type === "bar" ? (
            <ProfilePublicPreviewBar
              name={previewName}
              heroImageUrl={previewHeroImage ?? previewCoverImage}
              gallery={sortedGallery}
              address={previewAddress}
              location={previewLocation}
              city={previewCity}
              hours={previewHours}
              additionalInfo={previewAdditionalInfo}
              phone={previewPhone}
              whatsapp={previewWhatsapp}
              promos={previewPromos}
              promosLoading={promosLoading}
              promosError={promosError}
            />
          ) : (
            <ProfilePublicPreviewClub
              name={previewName}
              heroImageUrl={previewHeroImage ?? previewCoverImage}
              gallery={sortedGallery}
              address={previewAddress}
              location={previewLocation}
              city={previewCity}
              hours={previewHours}
              additionalInfo={previewAdditionalInfo}
              minAge={minAge}
              attributes={previewAttributes}
              phone={previewPhone}
              whatsapp={previewWhatsapp}
              tickets={catalogTickets}
              tables={catalogTables}
              promos={previewPromos}
              promosLoading={promosLoading}
              promosError={promosError}
            />
          )}
        </div>
      )}
    </div>
  );
}

