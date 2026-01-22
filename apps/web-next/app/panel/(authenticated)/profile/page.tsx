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
  type CatalogTicket,
  type CatalogTable,
  BAR_GALLERY_KINDS,
  CLUB_GALLERY_KINDS,
  GALLERY_KIND_LABELS,
} from "@/lib/panel";

// Constantes de límites del catálogo
const MAX_TICKET_TYPES = 4;
const MAX_ACTIVE_TICKETS = 2;
import { getAttributesAllowlist, ZONES, MIN_AGES, CITIES } from "@/lib/constants/attributes";

// Helpers para arrays (sin dependencias)
const parseLines = (text: string): string[] =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

const toLines = (arr?: string[] | null): string =>
  (arr ?? []).join("\n");

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
    phone: "",
    whatsapp: "",
    hoursText: "",
    additionalInfoText: "",
  });

  // Estados del catálogo (solo clubs)
  const [catalogTickets, setCatalogTickets] = useState<CatalogTicket[]>([]);
  const [catalogTables, setCatalogTables] = useState<CatalogTable[]>([]);
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

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPanelLocalProfile();
      setProfile(data);
      setFormData({
        name: data.name || "",
        address: data.address || "",
        location: data.location || "",
        city: data.city || "",
        phone: data.phone || "",
        whatsapp: data.whatsapp || "",
        hoursText: toLines(data.hours),
        additionalInfoText: toLines(data.additional_info),
      });
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

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const hours = parseLines(formData.hoursText);
      const additional_info = parseLines(formData.additionalInfoText);

      const updated = await updatePanelLocalProfile({
        name: formData.name.trim(),
        address: formData.address.trim(),
        location: formData.location.trim(),
        city: formData.city.trim() || null,
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim(),
        hours,
        additional_info,
        attributes: selectedAttributes,
        min_age: minAge,
      });

      setProfile(updated);
      setSuccess(true);

      // Ocultar mensaje de exito despues de 3s
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar cambios");
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Perfil del Local</h1>
        <p className="text-gray-600 mt-2">
          Información que se muestra en tu página pública
        </p>
      </div>

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
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Galería del Local
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {context.local.type === "bar" 
            ? "Imágenes para tu perfil: portada y categorías (Comida, Carta, Tragos, Interior)."
            : "Imágenes para tu perfil: portada y carrusel."
          }
        </p>

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
        <div className="mb-8 p-4 border-2 border-blue-100 rounded-xl bg-blue-50/30">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">📸 Foto de Perfil</h3>
          <p className="text-sm text-gray-600 mb-4">
            Esta imagen aparece en las <strong>cards del listado</strong> (inicio, búsqueda, explorar). 
            Es lo primero que ven los usuarios al encontrar tu local.
          </p>
          
          {/* Restricciones de este tipo */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Formatos:</span> JPG, PNG, WebP · 
              <span className="font-medium"> Máximo:</span> {MAX_FILE_SIZE_MB}MB · 
              <span className="font-medium"> Mínimo:</span> {MIN_WIDTH}×{MIN_HEIGHT}px · 
              <span className="font-medium"> Recomendado:</span> {RECOMMENDED_SIZES.cover.label}
            </p>
          </div>
          
          {(() => {
            const coverImage = sortedGallery.find(g => g.kind === "cover");
            return (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Imagen actual o uploader */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Imagen actual</p>
                  {coverImage ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                      <img src={coverImage.url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteImage(coverImage.id)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
                          title="Eliminar foto de perfil"
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <label className="block w-full aspect-video rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white cursor-pointer flex flex-col items-center justify-center text-blue-500 hover:text-blue-600 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, "cover")}
                        disabled={uploading}
                      />
                      <span className="text-3xl mb-2">📷</span>
                      <span className="font-medium">Subir foto de perfil</span>
                      <span className="text-xs text-gray-400 mt-1">Hacé click o arrastrá una imagen</span>
                    </label>
                  ) : (
                    <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      Sin foto de perfil
                    </div>
                  )}
                </div>
                
                {/* Preview de cómo se ve en una card */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Vista previa en listado</p>
                  <div className="w-full max-w-xs bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                    {/* Header de card simulado */}
                    <div className="h-36 relative overflow-hidden bg-gray-200">
                      {coverImage ? (
                        <img 
                          src={coverImage.url} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    {/* Contenido simulado de card */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 text-sm truncate">{profile.name}</span>
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                          ⭐ 4.6
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">🕐 18:00 – 02:00</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 italic">
                    Así se verá tu local en el listado de {context.local.type === "bar" ? "bares" : "discotecas"}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ===== HERO (BAR y CLUB) ===== */}
        <div className="mb-8 p-4 border-2 border-purple-100 rounded-xl bg-purple-50/30">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">🖼️ Imagen Principal del Perfil (Hero)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Esta imagen aparece <strong>dentro del perfil</strong> de tu local como imagen destacada. 
            Es diferente a la Foto de Perfil que se ve en las cards del listado.
          </p>
            
            {/* Restricciones */}
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Formatos:</span> JPG, PNG, WebP · 
                <span className="font-medium"> Máximo:</span> {MAX_FILE_SIZE_MB}MB · 
                <span className="font-medium"> Mínimo:</span> {MIN_WIDTH}×{MIN_HEIGHT}px · 
                <span className="font-medium"> Recomendado:</span> 1600×900 (16:9)
              </p>
            </div>
            
            {(() => {
              const heroImage = sortedGallery.find(g => g.kind === "hero");
              const coverImage = sortedGallery.find(g => g.kind === "cover");
              const isDuplicate = heroImage && coverImage && heroImage.url === coverImage.url;
              
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
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Imagen actual o uploader */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Imagen actual</p>
                      {heroImage ? (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                          <img src={heroImage.url} alt="Imagen principal" className="w-full h-full object-cover" />
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteImage(heroImage.id)}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
                              title="Eliminar imagen principal"
                            >
                              🗑️ Eliminar
                            </button>
                          )}
                        </div>
                      ) : canEdit ? (
                        <label className="block w-full aspect-video rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-500 bg-white cursor-pointer flex flex-col items-center justify-center text-purple-500 hover:text-purple-600 transition-colors">
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
                        <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          Sin imagen principal
                        </div>
                      )}
                    </div>
                    
                    {/* Preview de cómo se ve en perfil */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Vista previa en perfil</p>
                      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                        <div className="h-32 relative overflow-hidden bg-gray-200">
                          {heroImage ? (
                            <img 
                              src={heroImage.url} 
                              alt="Preview hero" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                              Sin imagen
                            </div>
                          )}
                        </div>
                        {context.local.type === "bar" ? (
                          <div className="p-3 flex gap-2">
                            {["Comida", "Carta", "Tragos", "Interior"].map((cat) => (
                              <div key={cat} className="flex-1 aspect-square bg-gray-100 rounded text-xs flex items-center justify-center text-gray-400">
                                {cat}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3">
                            <div className="flex gap-2 overflow-hidden">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="w-16 h-12 bg-gray-100 rounded text-xs flex items-center justify-center text-gray-400 flex-shrink-0">
                                  Foto {i}
                                </div>
                              ))}
                              <div className="w-8 h-12 flex items-center text-gray-300">...</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 italic">
                        Así se verá la imagen principal en tu perfil
                      </p>
                    </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">🍽️ Galería por Categorías</h3>
              <p className="text-sm text-gray-600 mb-3">
                Subí varias imágenes por categoría. La <strong>primera</strong> de cada una se muestra en el tile del perfil.
                Al hacer click, los usuarios ven la galería completa de esa categoría.
              </p>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Formatos:</span> JPG, PNG, WebP · 
                  <span className="font-medium"> Máximo:</span> {MAX_FILE_SIZE_MB}MB · 
                  <span className="font-medium"> Mínimo:</span> {MIN_WIDTH}×{MIN_HEIGHT}px · 
                  <span className="font-medium"> Recomendado:</span> {RECOMMENDED_SIZES.food.label} (se recorta al centro si difiere)
                </p>
              </div>
            </div>
            {(["food", "menu", "drinks", "interior"] as const).map((kind) => {
              const kindImages = sortedGallery.filter(g => g.kind === kind);
              return (
                <div key={kind} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">{GALLERY_KIND_LABELS[kind]}</h4>
                    {canEdit && (
                      <label className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-blue-500 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
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
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {kindImages.map((item, idx) => (
                        <div key={item.id} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border">
                            <img src={item.url} alt={`${GALLERY_KIND_LABELS[kind]} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">
                              Principal
                            </span>
                          )}
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
                                className="p-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                title="Eliminar"
                              >
                                🗑️
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
        ) : (
          /* ===== CLUB: Carrusel ordenable ===== */
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🎠 Carrusel de Imágenes</h3>
            <p className="text-sm text-gray-600 mb-3">
              Estas imágenes aparecen en el carrusel horizontal de tu perfil. 
              Podés reordenarlas y agregar varias.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Formatos:</span> JPG, PNG, WebP · 
                <span className="font-medium"> Máximo:</span> {MAX_FILE_SIZE_MB}MB · 
                <span className="font-medium"> Mínimo:</span> {MIN_WIDTH}×{MIN_HEIGHT}px · 
                <span className="font-medium"> Recomendado:</span> {RECOMMENDED_SIZES.carousel.label}
              </p>
            </div>
            
            {/* Add carousel image */}
            {canEdit && (
              <label className="inline-flex items-center gap-2 px-4 py-2 mb-4 border-2 border-blue-500 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors font-medium">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "carousel")}
                  disabled={uploading}
                />
                <span>📷 Agregar imagen al carrusel</span>
              </label>
            )}

            {/* Carousel images grid */}
            {(() => {
              const carouselImages = sortedGallery.filter(g => g.kind === "carousel");
              return carouselImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {carouselImages.map((item, idx) => (
                    <div key={item.id} className="relative group">
                      <div className="aspect-video rounded-lg overflow-hidden border">
                        <img src={item.url} alt={`Carrusel ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded">
                        {idx + 1}
                      </span>
                      {canEdit && (
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <button
                              onClick={() => handleMoveImage(item.id, "up")}
                              className="p-1 bg-white rounded-full text-xs shadow hover:bg-gray-100"
                              title="Mover arriba"
                            >
                              ↑
                            </button>
                          )}
                          {idx < carouselImages.length - 1 && (
                            <button
                              onClick={() => handleMoveImage(item.id, "down")}
                              className="p-1 bg-white rounded-full text-xs shadow hover:bg-gray-100"
                              title="Mover abajo"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteImage(item.id)}
                            className="p-1 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-500 text-sm">
                  No hay imágenes en el carrusel
                </div>
              );
            })()}
          </div>
        )}

        {/* Size guidelines summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
              ℹ️ Ver todas las restricciones de imágenes
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1">
              <p><strong>Formatos aceptados:</strong> JPG, PNG, WebP</p>
              <p><strong>Peso máximo:</strong> {MAX_FILE_SIZE_MB}MB por imagen</p>
              <p><strong>Resolución mínima:</strong> {MIN_WIDTH}×{MIN_HEIGHT} píxeles</p>
              <p><strong>Cantidad máxima:</strong> 12 imágenes en total</p>
              <p className="pt-2 border-t border-gray-200 mt-2"><strong>Tamaños recomendados:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li>Foto de perfil / Carrusel: 1600×900 (16:9)</li>
                <li>Categorías (Comida, Carta, Tragos, Interior): 800×800 (1:1)</li>
              </ul>
            </div>
          </details>
        </div>
      </section>

      {/* =================================================================== */}
      {/* FORMULARIO DE DATOS */}
      {/* =================================================================== */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Información del Local
        </h2>

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Dirección
            </label>
            <input
              type="text"
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ej: Av. Mariscal López 1234"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dirección completa que aparece en la sección Ubicación.
            </p>
          </div>

          {/* Location (zona/barrio) */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Zona / Barrio
            </label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Seleccionar zona...</option>
              {ZONES.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Esta zona se muestra en tu perfil y cards del listado.
            </p>
          </div>

          {/* City (ciudad) */}
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Ciudad
            </label>
            <select
              id="city"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Seleccionar ciudad...</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Se usa para mostrar &quot;Zona • Ciudad&quot; y para que &quot;Cómo llegar&quot; sea exacto.
            </p>
          </div>

          {/* Edad Mínima */}
          <div>
            <label
              htmlFor="minAge"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Edad mínima
            </label>
            <select
              id="minAge"
              value={minAge === null ? "" : String(minAge)}
              onChange={(e) => {
                const val = e.target.value;
                setMinAge(val === "" ? null : parseInt(val, 10));
              }}
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Todo público (sin restricción)</option>
              {MIN_AGES.map((age) => (
                <option key={age} value={age}>+{age}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Si seleccionás &quot;Todo público&quot;, no se mostrará restricción de edad en la card.
            </p>
          </div>

          {/* Attributes / Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {context?.local.type === "bar" ? "Especialidades" : "Géneros musicales"}{" "}
              <span className="text-gray-400 font-normal">
                ({selectedAttributes.length}/3)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(context?.local.type ? getAttributesAllowlist(context.local.type as "bar" | "club") : []).map((attr) => {
                const isSelected = selectedAttributes.includes(attr);
                const isDisabled = !canEdit || saving || (!isSelected && selectedAttributes.length >= 3);

                return (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => {
                      if (!canEdit || saving) return;
                      if (isSelected) {
                        setSelectedAttributes(selectedAttributes.filter(a => a !== attr));
                      } else if (selectedAttributes.length < 3) {
                        setSelectedAttributes([...selectedAttributes, attr]);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : isDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {attr}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Seleccioná hasta 3 {context?.local.type === "bar" ? "especialidades" : "géneros"} que aparecerán en tu perfil y cards del listado.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Teléfono de contacto
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ej: (021) 123-456"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label
              htmlFor="whatsapp"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ej: 595981123456"
            />
            <p className="mt-1 text-xs text-gray-500">
              Número con código de país para el botón de WhatsApp.
            </p>
          </div>

          {/* Hours (textarea, 1 linea = 1 item) */}
          <div>
            <label
              htmlFor="hours"
              className="block text-sm font-medium text-gray-700 mb-1"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none font-mono text-sm"
              placeholder={`Lun - Jue: 18:00 - 02:00\nVie - Sáb: 18:00 - 03:00\nDom: Cerrado`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Una línea por cada horario (máx 14 líneas).
            </p>
          </div>

          {/* Additional Info (textarea, 1 linea = 1 bullet) */}
          <div>
            <label
              htmlFor="additionalInfo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Información adicional
            </label>
            <textarea
              id="additionalInfo"
              rows={5}
              value={formData.additionalInfoText}
              onChange={(e) =>
                setFormData({ ...formData, additionalInfoText: e.target.value })
              }
              disabled={!canEdit || saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none font-mono text-sm"
              placeholder={`Estacionamiento disponible\nWiFi gratuito\nAcepta tarjetas`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Una línea por cada item (máx 20 líneas). Aparecen como bullets.
            </p>
          </div>

          {/* Submit button */}
          {canEdit && (
            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* =================================================================== */}
      {/* CATÁLOGO (solo discotecas) */}
      {/* =================================================================== */}
      {context.local.type === "club" && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            🎟️ Catálogo de Entradas y Mesas
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Configurá tus tipos de entradas (máx 2) y mesas (máx 6). Los clientes podrán comprar entradas 
            y reservar mesas por WhatsApp desde tu perfil público.
          </p>

          {/* Catalog success/error banners */}
          {catalogSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">✓ {catalogSuccess}</p>
            </div>
          )}
          {catalogError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{catalogError}</p>
            </div>
          )}

          {catalogLoading ? (
            <div className="space-y-4">
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* ===== ENTRADAS ===== */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">🎫 Entradas</h3>
                    <p className="text-xs text-gray-500">
                      Creadas: {catalogTickets.length}/{MAX_TICKET_TYPES} · Activas: {activeTicketsCount}/{MAX_ACTIVE_TICKETS}
                    </p>
                  </div>
                  {canEdit && !showNewTicketForm && (
                    <button
                      onClick={() => setShowNewTicketForm(true)}
                      disabled={!canAddMoreTickets}
                      className={`px-3 py-1.5 text-sm border rounded-lg ${
                        canAddMoreTickets 
                          ? "border-blue-500 text-blue-600 hover:bg-blue-50" 
                          : "border-gray-300 text-gray-400 cursor-not-allowed"
                      }`}
                      title={canAddMoreTickets ? undefined : `Máximo ${MAX_TICKET_TYPES} entradas`}
                    >
                      + Nueva entrada
                    </button>
                  )}
                </div>

                {/* Lista de tickets */}
                {catalogTickets.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {catalogTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                          ticket.is_active ? "border-gray-200" : "border-orange-200 bg-orange-50"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{ticket.name}</span>
                            {!ticket.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                Desactivada
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {ticket.price === 0 ? (
                              <span className="text-green-600 font-medium">Gratis (Free Pass)</span>
                            ) : (
                              formatPYG(ticket.price)
                            )}
                            {ticket.description && (
                              <span className="text-gray-400 ml-2">· {ticket.description}</span>
                            )}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTicketActive(ticket)}
                              disabled={savingTicket || (!ticket.is_active && !canActivateMoreTickets)}
                              title={!ticket.is_active && !canActivateMoreTickets ? `Máximo ${MAX_ACTIVE_TICKETS} activas` : undefined}
                              className={`px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${
                                ticket.is_active
                                  ? "border border-orange-300 text-orange-600 hover:bg-orange-50"
                                  : canActivateMoreTickets
                                    ? "border border-green-300 text-green-600 hover:bg-green-50"
                                    : "border border-gray-300 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {ticket.is_active ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(ticket)}
                              disabled={savingTicket}
                              className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Eliminar entrada"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm bg-white rounded-lg border border-dashed mb-4">
                    No hay entradas configuradas
                  </div>
                )}

                {/* Formulario nueva entrada */}
                {showNewTicketForm && canEdit && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-gray-900 mb-3">Nueva entrada</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={newTicketData.name}
                          onChange={(e) => setNewTicketData({ ...newTicketData, name: e.target.value })}
                          placeholder="Ej: Entrada General"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Precio (Gs) *
                        </label>
                        <input
                          type="number"
                          value={newTicketData.price}
                          onChange={(e) => setNewTicketData({ ...newTicketData, price: e.target.value })}
                          placeholder="Ej: 50000 (0 = gratis)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          min="0"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Beneficios (1 por línea)
                        </label>
                        <textarea
                          rows={3}
                          value={newTicketData.description}
                          onChange={(e) => setNewTicketData({ ...newTicketData, description: e.target.value })}
                          placeholder={"Acceso a pista de baile\nIncluye 1 bebida\nServicio preferencial"}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none font-mono"
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-400 mt-1">Una línea por beneficio. Aparecerán como lista en el perfil.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateTicket}
                        disabled={savingTicket}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingTicket ? "Guardando..." : "Crear entrada"}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewTicketForm(false);
                          setNewTicketData({ name: "", price: "", description: "" });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== MESAS ===== */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">🪑 Mesas</h3>
                    <p className="text-xs text-gray-500">
                      {catalogTables.length}/6 tipos de mesa · Reserva por WhatsApp (no se cobran online)
                    </p>
                  </div>
                  {canEdit && catalogTables.length < 6 && !showNewTableForm && (
                    <button
                      onClick={() => setShowNewTableForm(true)}
                      className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50"
                    >
                      + Nueva mesa
                    </button>
                  )}
                </div>

                {/* Lista de mesas */}
                {catalogTables.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {catalogTables.map((table) => (
                      <div
                        key={table.id}
                        className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                          table.is_active ? "border-gray-200" : "border-orange-200 bg-orange-50"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{table.name}</span>
                            {table.capacity && (
                              <span className="text-xs text-gray-500">
                                👥 {table.capacity} personas
                              </span>
                            )}
                            {!table.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                Desactivada
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {table.price !== null && (
                              <span className="text-gray-500">{formatPYG(table.price)} (ref.)</span>
                            )}
                            {table.includes && (
                              <span className="text-gray-400 ml-2">· {table.includes}</span>
                            )}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTableActive(table)}
                              disabled={savingTable}
                              className={`px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${
                                table.is_active
                                  ? "border border-orange-300 text-orange-600 hover:bg-orange-50"
                                  : "border border-green-300 text-green-600 hover:bg-green-50"
                              }`}
                            >
                              {table.is_active ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              onClick={() => handleDeleteTable(table)}
                              disabled={savingTable}
                              className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Eliminar mesa"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm bg-white rounded-lg border border-dashed mb-4">
                    No hay mesas configuradas
                  </div>
                )}

                {/* Formulario nueva mesa */}
                {showNewTableForm && canEdit && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-gray-900 mb-3">Nueva mesa</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={newTableData.name}
                          onChange={(e) => setNewTableData({ ...newTableData, name: e.target.value })}
                          placeholder="Ej: Mesa VIP"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Capacidad
                        </label>
                        <input
                          type="number"
                          value={newTableData.capacity}
                          onChange={(e) => setNewTableData({ ...newTableData, capacity: e.target.value })}
                          placeholder="Ej: 10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          min="1"
                          max="50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Precio referencial (Gs)
                        </label>
                        <input
                          type="number"
                          value={newTableData.price}
                          onChange={(e) => setNewTableData({ ...newTableData, price: e.target.value })}
                          placeholder="Ej: 500000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          min="0"
                        />
                        <p className="text-xs text-gray-400 mt-1">No se cobra online, solo informativo</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          ¿Qué incluye? (1 por línea)
                        </label>
                        <textarea
                          rows={3}
                          value={newTableData.includes}
                          onChange={(e) => setNewTableData({ ...newTableData, includes: e.target.value })}
                          placeholder={"Botella de fernet\n6 mixers\nHielera y vasos\nServicio de mesero"}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none font-mono"
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-400 mt-1">Una línea por beneficio. Aparecerán como lista en el perfil.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateTable}
                        disabled={savingTable}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingTable ? "Guardando..." : "Crear mesa"}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewTableForm(false);
                          setNewTableData({ name: "", price: "", capacity: "", includes: "" });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Nota informativa */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Importante:</strong> Las entradas desactivadas no aparecerán en tu perfil público 
                  ni podrán ser compradas. El historial de ventas se mantiene intacto.
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
