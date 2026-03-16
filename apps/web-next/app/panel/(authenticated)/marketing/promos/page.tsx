"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

import { usePanelContext } from "@/lib/panelContext";
import {
  createPromo,
  deletePromo,
  getPanelPromosByLocalId,
  reorderPromos,
  updatePromo,
  type CreatePromoInput,
  type Promo,
  type UpdatePromoInput,
} from "@/lib/promos";
import {
  uploadPromoImage,
  validateImageUrl,
  validatePromoImageFile,
} from "@/lib/uploads";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Toolbar,
  cn,
  panelUi,
} from "@/components/panel/ui";
import { KpiGrid, type KpiItem } from "@/components/panel/views/dashboard";

type StatusFilter = "all" | "active" | "inactive";
type SortMode = "priority" | "views" | "recent";
type ViewMode = "cards" | "compact";

const EMPTY_FORM: CreatePromoInput = {
  title: "",
  image_url: "",
  description: "",
};
const PROMO_IMAGE_GENERAL_HELPER_TEXT =
  "Recomendamos una imagen horizontal 4:3, con el foco principal centrado. En el perfil público se recorta automáticamente.";
const PROMO_IMAGE_FILE_HELPER_TEXT = "Archivo: JPG, PNG o WebP · máximo 5 MB";
const PROMO_IMAGE_URL_HELPER_TEXT =
  "URL pública: solo validamos que sea una URL http/https válida; no verificamos formato, peso ni dimensiones.";
const PROMO_IMAGE_RATIO_WARNING =
  "Esta imagen no es 4:3 y podría recortarse en el perfil público.";
const PROMO_TARGET_IMAGE_RATIO = 4 / 3;
const PROMO_RATIO_WARNING_TOLERANCE = 0.12;
// Temporary panel-only override for demo/video recordings.
const PROMO_VIDEO_VIEW_OVERRIDES = {
  "mckharthys-bar": [4981, 3420, 2870],
  dlirio: [5340, 4110, 3260],
} as const;

const numberFormatter = new Intl.NumberFormat("es-PY");
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50";

function formatPromoDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-PY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPromoViews(value?: number | null) {
  return `${numberFormatter.format(value ?? 0)} vistas`;
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return await new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);

      if (!width || !height) {
        resolve(null);
        return;
      }

      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function shouldWarnPromoImageRatio(width: number, height: number) {
  const ratio = width / height;
  return Math.abs(ratio - PROMO_TARGET_IMAGE_RATIO) > PROMO_RATIO_WARNING_TOLERANCE;
}

function getPromoVideoOverrideSlug(slug?: string | null) {
  const normalizedSlug = slug?.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  return normalizedSlug in PROMO_VIDEO_VIEW_OVERRIDES
    ? (normalizedSlug as keyof typeof PROMO_VIDEO_VIEW_OVERRIDES)
    : null;
}

function PromoStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "neutral"}>
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-neutral-400"
        )}
      />
      {isActive ? "Activa" : "Inactiva"}
    </Badge>
  );
}

function ToolbarSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          panelUi.focusRing,
          "min-w-[140px] appearance-none rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-neutral-700 shadow-sm transition hover:border-neutral-300"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

export default function PromosPage() {
  const { data, loading: contextLoading } = usePanelContext();
  const isOwner = data?.role === "owner";
  const localId = data?.local?.id;
  const localSlug = data?.local?.slug;

  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [formData, setFormData] = useState<CreatePromoInput>(EMPTY_FORM);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageRatioWarning, setImageRatioWarning] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [viewMode] = useState<ViewMode>("cards");
  const [draggedPromoId, setDraggedPromoId] = useState<string | null>(null);
  const [dragOverPromoId, setDragOverPromoId] = useState<string | null>(null);

  useEffect(() => {
    if (!localId) return;

    const fetchPromos = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPanelPromosByLocalId(localId);
        setPromos(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Error al cargar promociones"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPromos();
  }, [localId]);

  const showSuccessMessage = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 3000);
  };

  const resetForm = () => {
    setIsDrawerOpen(false);
    setEditingPromo(null);
    setFormData(EMPTY_FORM);
    setUploadError(null);
    setImageRatioWarning(null);
    setShowUrlInput(false);
    setUrlInputValue("");
    setUrlInputError(null);
  };

  const openCreateDrawer = () => {
    setError(null);
    setEditingPromo(null);
    setFormData(EMPTY_FORM);
    setUploadError(null);
    setImageRatioWarning(null);
    setShowUrlInput(false);
    setUrlInputValue("");
    setUrlInputError(null);
    setIsDrawerOpen(true);
  };

  const handleEditClick = (promo: Promo) => {
    setError(null);
    setEditingPromo(promo);
    setFormData({
      title: promo.title,
      image_url: promo.image_url || "",
      description: promo.description || "",
    });
    setUploadError(null);
    setImageRatioWarning(null);
    setShowUrlInput(false);
    setUrlInputValue("");
    setUrlInputError(null);
    setIsDrawerOpen(true);
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validatePromoImageFile(file);
    if (validationError) {
      setUploadError(validationError.error);
      setImageRatioWarning(null);
      return;
    }

    setUploadError(null);
    setImageRatioWarning(null);
    setIsUploading(true);

    try {
      const dimensions = await getImageDimensions(file);
      if (
        dimensions &&
        shouldWarnPromoImageRatio(dimensions.width, dimensions.height)
      ) {
        setImageRatioWarning(PROMO_IMAGE_RATIO_WARNING);
      }

      const result = await uploadPromoImage(file);
      setFormData((current) => ({ ...current, image_url: result.imageUrl }));
      setShowUrlInput(false);
      setUrlInputValue("");
    } catch (uploadingError) {
      setUploadError(
        uploadingError instanceof Error
          ? uploadingError.message
          : "Error al subir imagen"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlPaste = () => {
    const validationError = validateImageUrl(urlInputValue);
    if (validationError) {
      setUrlInputError(validationError);
      return;
    }

    setUrlInputError(null);
    setImageRatioWarning(null);
    setFormData((current) => ({ ...current, image_url: urlInputValue }));
    setShowUrlInput(false);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!localId || !isOwner) return;

    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }

    if (!formData.image_url.trim()) {
      setError("Subí una imagen para la promo");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newPromo = await createPromo(localId, {
        title: formData.title.trim(),
        image_url: formData.image_url.trim(),
        description: formData.description?.trim() || undefined,
      });
      setPromos((current) => [...current, newPromo]);
      resetForm();
      showSuccessMessage("Promoción creada");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al crear promoción"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!localId || !isOwner || !editingPromo) return;

    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }

    if (!formData.image_url.trim()) {
      setError("Subí una imagen para la promo");
      return;
    }

    const input: UpdatePromoInput = {};
    if (formData.title.trim() !== editingPromo.title) {
      input.title = formData.title.trim();
    }
    if (formData.image_url.trim() !== (editingPromo.image_url || "")) {
      input.image_url = formData.image_url.trim();
    }
    if ((formData.description?.trim() || null) !== editingPromo.description) {
      input.description = formData.description?.trim() || null;
    }

    if (Object.keys(input).length === 0) {
      resetForm();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedPromo = await updatePromo(localId, editingPromo.id, input);
      setPromos((current) =>
        current.map((promo) => (promo.id === updatedPromo.id ? updatedPromo : promo))
      );
      resetForm();
      showSuccessMessage("Promoción actualizada");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al actualizar promoción"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: Promo) => {
    if (!localId || !isOwner) return;

    setSaving(true);
    setError(null);

    try {
      const updatedPromo = await updatePromo(localId, promo.id, {
        is_active: !promo.is_active,
      });
      setPromos((current) =>
        current.map((item) => (item.id === updatedPromo.id ? updatedPromo : item))
      );
      showSuccessMessage(
        updatedPromo.is_active ? "Promoción activada" : "Promoción desactivada"
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al cambiar estado"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo: Promo) => {
    if (!localId || !isOwner) return;
    if (!window.confirm(`¿Eliminar "${promo.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deletePromo(localId, promo.id);
      setPromos((current) => current.filter((item) => item.id !== promo.id));
      showSuccessMessage("Promoción eliminada");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al eliminar promoción"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((current) => ({ ...current, image_url: "" }));
    setImageRatioWarning(null);
  };

  const orderedPromos = useMemo(
    () => [...promos].sort((left, right) => left.sort_order - right.sort_order),
    [promos]
  );

  const activePromos = useMemo(
    () => orderedPromos.filter((promo) => promo.is_active),
    [orderedPromos]
  );

  const inactivePromos = useMemo(
    () => orderedPromos.filter((promo) => !promo.is_active),
    [orderedPromos]
  );

  const promoVideoOverrideSlug = useMemo(
    () => getPromoVideoOverrideSlug(localSlug),
    [localSlug]
  );

  const promoViewOverrides = useMemo(() => {
    if (!promoVideoOverrideSlug) {
      return new Map<string, number>();
    }

    const overrideValues = PROMO_VIDEO_VIEW_OVERRIDES[promoVideoOverrideSlug];
    return new Map(
      activePromos
        .slice(0, overrideValues.length)
        .map((promo, index) => [promo.id, overrideValues[index] ?? 0] as const)
    );
  }, [activePromos, promoVideoOverrideSlug]);

  const getPromoDisplayViews = (promo: Promo) =>
    promoViewOverrides.get(promo.id) ?? promo.view_count ?? 0;

  const metrics = useMemo(() => {
    const active = promos.filter((promo) => promo.is_active);
    const inactive = promos.filter((promo) => !promo.is_active);

    if (promoVideoOverrideSlug) {
      const mostViewed = activePromos[0] ?? null;
      const totalViews = Array.from(promoViewOverrides.values()).reduce(
        (sum, value) => sum + value,
        0
      );

      return {
        activeCount: active.length,
        inactiveCount: inactive.length,
        totalViews,
        mostViewed,
        mostViewedViews: mostViewed ? getPromoDisplayViews(mostViewed) : 0,
      };
    }

    const totalViews = promos.reduce((sum, promo) => sum + (promo.view_count ?? 0), 0);
    const mostViewed = promos.reduce<Promo | null>((current, promo) => {
      if (!current) return promo;
      return (promo.view_count ?? 0) > (current.view_count ?? 0) ? promo : current;
    }, null);

    return {
      activeCount: active.length,
      inactiveCount: inactive.length,
      totalViews,
      mostViewed,
      mostViewedViews: mostViewed?.view_count ?? 0,
    };
  }, [activePromos, promoVideoOverrideSlug, promoViewOverrides, promos]);

  const profileOrderMap = useMemo(
    () =>
      new Map(activePromos.map((promo, index) => [promo.id, index + 1])),
    [activePromos]
  );

  const promoKpis = useMemo<KpiItem[]>(
    () => [
      {
        label: "Activas",
        value: numberFormatter.format(metrics.activeCount),
        hint: "Promos visibles actualmente",
        icon: (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </span>
        ),
      },
      {
        label: "Inactivas",
        value: numberFormatter.format(metrics.inactiveCount),
        hint: "Promos ocultas del perfil",
        icon: (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
            <CircleOff className="h-5 w-5 text-neutral-500" />
          </span>
        ),
      },
      {
        label: "Total vistas",
        value: numberFormatter.format(metrics.totalViews),
        hint: "Aperturas acumuladas",
        icon: (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
            <Eye className="h-5 w-5 text-sky-600" />
          </span>
        ),
      },
      {
        label: "Más vista",
        value: numberFormatter.format(metrics.mostViewedViews),
        hint: metrics.mostViewed?.title || "Sin datos todavía",
        icon: (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
            <TrendingUp className="h-5 w-5 text-amber-700" />
          </span>
        ),
      },
    ],
    [metrics]
  );

  const filteredPromos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = promos.filter((promo) => {
      if (statusFilter === "active" && !promo.is_active) return false;
      if (statusFilter === "inactive" && promo.is_active) return false;
      if (!query) return true;

      const haystack = [promo.title, promo.description || "", promo.image_url || ""]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    const sorted = [...filtered];

    if (sortMode === "views") {
      sorted.sort((left, right) => {
        const leftViews = getPromoDisplayViews(left);
        const rightViews = getPromoDisplayViews(right);
        if (rightViews !== leftViews) return rightViews - leftViews;
        return left.sort_order - right.sort_order;
      });
    } else if (sortMode === "recent") {
      sorted.sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );
    } else {
      sorted.sort((left, right) => left.sort_order - right.sort_order);
    }

    return sorted;
  }, [promos, searchQuery, sortMode, statusFilter, promoViewOverrides]);

  const persistPromoOrder = async (nextActiveIds: string[]) => {
    if (!localId || !isOwner) return;

    const orderedIds = [...nextActiveIds, ...inactivePromos.map((promo) => promo.id)];
    const previousPromos = promos;

    setPromos(() => {
      const promoMap = new Map(previousPromos.map((promo) => [promo.id, promo]));
      return orderedIds
        .map((id, index) => {
          const promo = promoMap.get(id);
          return promo ? { ...promo, sort_order: index } : null;
        })
        .filter((promo): promo is Promo => promo !== null);
    });

    setSaving(true);
    setError(null);

    try {
      await reorderPromos(localId, orderedIds);
      showSuccessMessage("Orden de aparición actualizado");
    } catch (requestError) {
      setPromos(previousPromos);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al guardar el orden"
      );
    } finally {
      setSaving(false);
      setDraggedPromoId(null);
      setDragOverPromoId(null);
    }
  };

  const handleOrderDragStart = (promoId: string) => {
    if (!isOwner || saving) return;
    setDraggedPromoId(promoId);
    setDragOverPromoId(promoId);
  };

  const handleOrderDragEnd = () => {
    setDraggedPromoId(null);
    setDragOverPromoId(null);
  };

  const handleOrderDrop = async (targetPromoId: string) => {
    if (!draggedPromoId || draggedPromoId === targetPromoId) {
      setDraggedPromoId(null);
      setDragOverPromoId(null);
      return;
    }

    const activeIds = activePromos.map((promo) => promo.id);
    const fromIndex = activeIds.indexOf(draggedPromoId);
    const toIndex = activeIds.indexOf(targetPromoId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedPromoId(null);
      setDragOverPromoId(null);
      return;
    }

    const nextActiveIds = [...activeIds];
    const [movedId] = nextActiveIds.splice(fromIndex, 1);
    nextActiveIds.splice(toIndex, 0, movedId);

    await persistPromoOrder(nextActiveIds);
  };

  const renderPromoCard = (promo: Promo) => {
    const profilePosition = profileOrderMap.get(promo.id);

    return (
      <Card
        key={promo.id}
        className={cn(
          "border-neutral-200/80 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
          !promo.is_active && "bg-neutral-50/80"
        )}
      >
        <CardContent
          className={cn(
            "flex flex-col gap-4 p-5 md:grid md:grid-cols-[108px_minmax(0,1fr)_56px] md:items-center md:gap-5 md:p-6",
            viewMode === "compact" &&
              "gap-3.5 p-4 md:grid-cols-[96px_minmax(0,1fr)_52px] md:gap-4 md:p-5"
          )}
        >
          <div className="flex items-center md:justify-center">
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100",
                viewMode === "compact" ? "h-[72px] w-24" : "h-[84px] w-[108px]"
              )}
            >
              {promo.image_url ? (
                <img
                  src={promo.image_url}
                  alt={promo.title}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 self-stretch">
            <div className="flex min-h-[72px] flex-col justify-center gap-2.5 md:min-h-[84px]">
              <h3 className="truncate text-[1.05rem] font-semibold leading-tight text-neutral-950 md:text-[1.1rem]">
                {promo.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-neutral-500">
                <PromoStatusBadge isActive={promo.is_active} />
                {typeof profilePosition === "number" ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    #{profilePosition} en perfil
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {formatPromoViews(getPromoDisplayViews(promo))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatPromoDate(promo.created_at)}
                </span>
              </div>
            </div>
          </div>

          {isOwner ? (
            <div className="flex items-center justify-end gap-1.5 md:h-full md:w-14 md:flex-col md:justify-center">
              <button
                type="button"
                onClick={() => handleToggleActive(promo)}
                disabled={saving}
                title={promo.is_active ? "Desactivar promoción" : "Activar promoción"}
                aria-label={promo.is_active ? "Desactivar promoción" : "Activar promoción"}
                className={cn(
                  panelUi.focusRing,
                  "rounded-xl border border-transparent p-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {promo.is_active ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleEditClick(promo)}
                disabled={saving}
                title="Editar promoción"
                aria-label="Editar promoción"
                className={cn(
                  panelUi.focusRing,
                  "rounded-xl border border-transparent p-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Pencil className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(promo)}
                disabled={saving}
                title="Eliminar promoción"
                aria-label="Eliminar promoción"
                data-panel-delete-button="true"
                className={cn(
                  panelUi.focusRing,
                  panelUi.destructiveOutline,
                  "rounded-xl p-2"
                )}
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const renderProfileOrderBoard = () => (
    <Card className="overflow-hidden border-neutral-200/80">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-neutral-200 px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-neutral-950">
              Orden de aparición en el perfil
            </h2>
            <p className="text-sm text-neutral-600">
              Arrastra las promociones activas para definir el orden en que aparecen en el carrusel público.
            </p>
          </div>

          {activePromos.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
              Activa promociones para ordenarlas y mostrarlas en el perfil público.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {activePromos.map((promo, index) => {
                const isDragging = draggedPromoId === promo.id;
                const isDropTarget = dragOverPromoId === promo.id && draggedPromoId !== promo.id;

                return (
                  <div
                    key={promo.id}
                    draggable={isOwner && !saving}
                    onDragStart={() => handleOrderDragStart(promo.id)}
                    onDragEnd={handleOrderDragEnd}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!saving) setDragOverPromoId(promo.id);
                    }}
                    onDrop={async (event) => {
                      event.preventDefault();
                      await handleOrderDrop(promo.id);
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 transition",
                      isOwner && !saving && "cursor-move",
                      isDragging && "opacity-60",
                      isDropTarget && "border-blue-500 ring-2 ring-blue-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-neutral-400" />
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                        {promo.image_url ? (
                          <img
                            src={promo.image_url}
                            alt={promo.title}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              (event.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-400">
                            <ImagePlus className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-neutral-950">{promo.title}</div>
                      <div className="text-sm text-neutral-500">
                        Posición {index + 1} en el carrusel público
                      </div>
                    </div>

                    <span className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-800">
                      #{index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div data-promos-preview="true" className="bg-neutral-50/70 px-5 py-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <Smartphone className="h-4 w-4" />
            Vista en perfil
          </div>

          <div
            data-promos-preview-device="true"
            className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-200" />
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="h-3 w-20 rounded-full bg-neutral-100" />
                <div className="h-2.5 w-28 rounded-full bg-neutral-100" />
              </div>

              <div
                data-promos-preview-rail="true"
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2"
              >
                <div className="text-[11px] font-medium text-neutral-500">Promociones</div>
                {activePromos.length > 0 ? (
                  <div className="mt-2 flex gap-2 overflow-hidden">
                    {activePromos.slice(0, 3).map((promo, index) => (
                      <div
                        key={promo.id}
                        className={cn(
                          "relative w-[84px] flex-shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950",
                          index === 0 ? "shadow-sm" : "opacity-75"
                        )}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                          {promo.image_url ? (
                            <img
                              src={promo.image_url}
                              alt={promo.title}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                (event.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-400">
                              <ImagePlus className="h-4 w-4" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                          <div className="absolute inset-x-2 bottom-2">
                            <div className="truncate text-[10px] font-medium text-white">
                              {promo.title}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    data-promos-preview-empty="true"
                    className="mt-2 rounded-xl bg-white px-3 py-6 text-center text-xs text-neutral-400"
                  >
                    Sin promos activas
                  </div>
                )}

                <div className="mt-3 flex justify-center gap-1">
                  {activePromos.slice(0, 3).map((promo, index) => (
                    <span
                      key={promo.id}
                      className={cn(
                        "h-1.5 rounded-full",
                        index === 0 ? "w-4 bg-amber-400" : "w-1.5 bg-neutral-300"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-500">
            Así verán tus clientes el carrusel en el perfil público.
          </p>
        </div>
      </div>
    </Card>
  );

  const renderPromoDrawer = () => {
    if (!isDrawerOpen || !isOwner) return null;

    return (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Cerrar formulario de promoción"
          onClick={resetForm}
          className="absolute inset-0 bg-neutral-950/30 backdrop-blur-[1px]"
        />

        <aside className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col border-l border-neutral-200 bg-white shadow-[-16px_0_40px_rgba(15,23,42,0.12)]">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {editingPromo ? "Editar promoción" : "Nueva promoción"}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Completa los datos y guarda.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className={cn(
                panelUi.focusRing,
                "rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              )}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={editingPromo ? handleUpdate : handleCreate}
            className="flex h-full flex-col"
          >
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Imagen
                </label>

                {formData.image_url ? (
                  <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                    <div className="relative flex h-52 items-center justify-center overflow-hidden bg-neutral-100 px-4 py-4">
                      <img
                        src={formData.image_url}
                        alt="Vista previa de promoción"
                        className="max-h-full w-auto max-w-full rounded-xl object-contain"
                        onError={(event) => {
                          (event.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        data-panel-delete-button="true"
                        className={cn(
                          panelUi.focusRing,
                          panelUi.destructiveOutline,
                          "absolute right-3 top-3 rounded-full p-2"
                        )}
                        aria-label="Quitar imagen"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
                      <div className="text-sm text-neutral-600">
                        Imagen cargada correctamente
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          panelUi.focusRing,
                          "text-sm font-medium text-blue-600 transition hover:text-blue-700"
                        )}
                      >
                        Cambiar imagen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={cn(
                      panelUi.focusRing,
                      "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-60"
                    )}
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-neutral-400" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-neutral-800">
                        {isUploading ? "Subiendo imagen..." : "Arrastra o haz clic para subir"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {PROMO_IMAGE_FILE_HELPER_TEXT}
                      </div>
                    </div>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-sm leading-relaxed text-neutral-600">
                    {PROMO_IMAGE_GENERAL_HELPER_TEXT}
                  </p>
                </div>

                {uploadError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {uploadError}
                  </div>
                ) : null}

                {imageRatioWarning ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {imageRatioWarning}
                  </div>
                ) : null}

                <details
                  open={showUrlInput}
                  onToggle={(event) =>
                    setShowUrlInput((event.target as HTMLDetailsElement).open)
                  }
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-neutral-700">
                    Usar URL pública de imagen
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm leading-relaxed text-neutral-500">
                      {PROMO_IMAGE_URL_HELPER_TEXT}
                    </p>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="url"
                        value={urlInputValue}
                        onChange={(event) => {
                          setUrlInputValue(event.target.value);
                          setUrlInputError(null);
                        }}
                        placeholder="https://ejemplo.com/promo.jpg"
                        className={cn(
                          panelUi.focusRing,
                          "w-full rounded-xl border border-neutral-200 bg-white px-10 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleUrlPaste}
                      className={cn(
                        panelUi.focusRing,
                        "inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                      )}
                    >
                      <Link2 className="h-4 w-4" />
                      Usar esta URL
                    </button>
                    {urlInputError ? (
                      <p className="text-sm text-rose-700">{urlInputError}</p>
                    ) : null}
                  </div>
                </details>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Ej. Open Bar Viernes"
                  className={cn(
                    panelUi.focusRing,
                    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400"
                  )}
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Vigencia <span className="normal-case text-neutral-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Ej.: Todos los viernes, Viernes y sábados, Hasta las 00:30"
                  className={cn(
                    panelUi.focusRing,
                    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400"
                  )}
                  maxLength={120}
                />
                <p className="text-sm text-neutral-500">
                  Ej.: Todos los viernes, Viernes y sábados, Hasta las 00:30
                </p>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
              <button
                type="button"
                onClick={resetForm}
                className={cn(
                  panelUi.focusRing,
                  "rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                )}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || isUploading}
                className={cn(
                  panelUi.focusRing,
                  PRIMARY_BUTTON_CLASS,
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingPromo ? "Guardar cambios" : "Guardar promoción"}
              </button>
            </div>
          </form>
        </aside>
      </div>
    );
  };

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-52 rounded-lg bg-neutral-200/70 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
        <div className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 rounded-2xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-6">
        <PageHeader
          title="Promociones"
          subtitle="Gestiona tus promos visibles en el perfil público"
          actions={
            isOwner ? (
              <button
                type="button"
                onClick={openCreateDrawer}
                className={cn(
                  panelUi.focusRing,
                  PRIMARY_BUTTON_CLASS
                )}
              >
                <Plus className="h-4 w-4" />
                Nueva promoción
              </button>
            ) : null
          }
        />

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <KpiGrid items={promoKpis} columns={4} />

        <Card className="border-neutral-200/80">
          <CardContent className="p-4 md:p-5">
            <Toolbar
              left={
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar promociones..."
                    className={cn(
                      panelUi.focusRing,
                      "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-10 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                    )}
                  />
                </div>
              }
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <ToolbarSelect
                    ariaLabel="Filtrar promociones por estado"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as StatusFilter)}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "active", label: "Activas" },
                      { value: "inactive", label: "Inactivas" },
                    ]}
                  />
                  <ToolbarSelect
                    ariaLabel="Ordenar promociones"
                    value={sortMode}
                    onChange={(value) => setSortMode(value as SortMode)}
                    options={[
                      { value: "priority", label: "Prioridad" },
                      { value: "views", label: "Más vistas" },
                      { value: "recent", label: "Más recientes" },
                    ]}
                  />
                </div>
              }
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="h-[280px] rounded-2xl bg-neutral-100 animate-pulse" />
        ) : promos.length > 0 ? (
          renderProfileOrderBoard()
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <EmptyState
            title="Sin promociones todavía"
            description={
              isOwner
                ? "Crea tu primera promoción para mostrarla en el perfil público."
                : "No hay promociones configuradas por el momento."
            }
            icon={<ImagePlus className="h-5 w-5" />}
            action={
              isOwner ? (
                <button
                  type="button"
                  onClick={openCreateDrawer}
                  className={cn(
                    panelUi.focusRing,
                    PRIMARY_BUTTON_CLASS
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Nueva promoción
                </button>
              ) : null
            }
          />
        ) : filteredPromos.length === 0 ? (
          <EmptyState
            title="No hay resultados para esos filtros"
            description="Ajusta la búsqueda o cambia los filtros para ver otras promociones."
            icon={<Search className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-4">
            <div className={cn("space-y-4", viewMode === "compact" && "space-y-3")}>
              {filteredPromos.map(renderPromoCard)}
            </div>
            <p className="text-center text-sm text-neutral-500">
              Mostrando {filteredPromos.length} de {promos.length} promociones
            </p>
          </div>
        )}
      </div>
      {renderPromoDrawer()}
    </>
  );
}
