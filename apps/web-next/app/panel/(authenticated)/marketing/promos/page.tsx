"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelPromosByLocalId,
  createPromo,
  updatePromo,
  deletePromo,
  reorderPromos,
  type Promo,
  type CreatePromoInput,
  type UpdatePromoInput,
} from "@/lib/promos";
import {
  uploadPromoImage,
  validatePromoImageFile,
  validateImageUrl,
} from "@/lib/uploads";

export default function PromosPage() {
  const { data, loading: contextLoading } = usePanelContext();
  const isOwner = data?.role === "owner";
  const localId = data?.local?.id;

  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [formData, setFormData] = useState<CreatePromoInput>({
    title: "",
    image_url: "",
    description: "",
  });

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch promos
  useEffect(() => {
    if (!localId) return;

    const fetchPromos = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPanelPromosByLocalId(localId);
        setPromos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar promociones");
      } finally {
        setLoading(false);
      }
    };

    fetchPromos();
  }, [localId]);

  const showSuccessMessage = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Handle file selection
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validationError = validatePromoImageFile(file);
    if (validationError) {
      setUploadError(validationError.error);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const result = await uploadPromoImage(file);
      setFormData({ ...formData, image_url: result.imageUrl });
      setShowUrlInput(false);
      setUrlInputValue("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setIsUploading(false);
      // Reset input to allow re-selecting same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle URL paste (advanced)
  const handleUrlPaste = () => {
    const error = validateImageUrl(urlInputValue);
    if (error) {
      setUrlInputError(error);
      return;
    }
    setUrlInputError(null);
    setFormData({ ...formData, image_url: urlInputValue });
    setShowUrlInput(false);
  };

  // Create promo
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
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
      setPromos([...promos, newPromo]);
      resetForm();
      showSuccessMessage("Promoción creada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear promoción");
    } finally {
      setSaving(false);
    }
  };

  // Update promo
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!localId || !isOwner || !editingPromo) return;

    setSaving(true);
    setError(null);

    try {
      const input: UpdatePromoInput = {};
      if (formData.title.trim() !== editingPromo.title) {
        input.title = formData.title.trim();
      }
      if (formData.image_url.trim() !== editingPromo.image_url) {
        input.image_url = formData.image_url.trim();
      }
      if ((formData.description?.trim() || null) !== editingPromo.description) {
        input.description = formData.description?.trim() || null;
      }

      const updated = await updatePromo(localId, editingPromo.id, input);
      setPromos(promos.map((p) => (p.id === updated.id ? updated : p)));
      resetForm();
      showSuccessMessage("Promoción actualizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar promoción");
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (promo: Promo) => {
    if (!localId || !isOwner) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await updatePromo(localId, promo.id, {
        is_active: !promo.is_active,
      });
      setPromos(promos.map((p) => (p.id === updated.id ? updated : p)));
      showSuccessMessage(updated.is_active ? "Promoción activada" : "Promoción desactivada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar estado");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (promo: Promo) => {
    if (!localId || !isOwner) return;
    if (!window.confirm(`¿Eliminar "${promo.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deletePromo(localId, promo.id);
      setPromos(promos.filter((p) => p.id !== promo.id));
      showSuccessMessage("Promoción eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar promoción");
    } finally {
      setSaving(false);
    }
  };

  // Move up/down (swap with neighbor)
  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!localId || !isOwner) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= promos.length) return;

    setSaving(true);
    setError(null);

    try {
      const newOrder = [...promos];
      [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

      await reorderPromos(
        localId,
        newOrder.map((p) => p.id)
      );

      const updatedPromos = newOrder.map((p, i) => ({ ...p, sort_order: i }));
      setPromos(updatedPromos);
      showSuccessMessage("Orden actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reordenar");
    } finally {
      setSaving(false);
    }
  };

  // Edit form open
  const handleEditClick = (promo: Promo) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title,
      image_url: promo.image_url || "",
      description: promo.description || "",
    });
    setShowForm(true);
    setShowUrlInput(false);
    setUrlInputValue("");
    setUploadError(null);
    setUrlInputError(null);
  };

  // Reset form
  const resetForm = () => {
    setShowForm(false);
    setEditingPromo(null);
    setFormData({ title: "", image_url: "", description: "" });
    setError(null);
    setUploadError(null);
    setShowUrlInput(false);
    setUrlInputValue("");
    setUrlInputError(null);
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: "" });
  };

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="h-48 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promociones</h1>
          <p className="text-gray-600 mt-2">
            Gestiona tus promos visibles en el perfil público
          </p>
        </div>
        {isOwner && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Nueva promoción
          </button>
        )}
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">✓ {success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && isOwner && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingPromo ? "Editar promoción" : "Nueva promoción"}
          </h3>
          <form onSubmit={editingPromo ? handleUpdate : handleCreate} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Ladies Night - 2x1 en tragos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
                required
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Imagen *
              </label>

              {/* Preview (if image exists) */}
              {formData.image_url ? (
                <div className="mb-3">
                  <div className="relative inline-block">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-48 h-32 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600"
                      title="Eliminar imagen"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Imagen cargada correctamente
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Upload button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="promo-image-upload"
                    />
                    <label
                      htmlFor="promo-image-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        isUploading ? "opacity-50 cursor-wait" : ""
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Subiendo...
                        </>
                      ) : (
                        <>
                          📷 Subir imagen
                        </>
                      )}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG o WebP. Máximo 5MB. Aspecto 4:3 recomendado.
                    </p>
                  </div>

                  {/* Upload error */}
                  {uploadError && (
                    <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                      {uploadError}
                    </div>
                  )}

                  {/* Advanced: Paste URL */}
                  <details
                    open={showUrlInput}
                    onToggle={(e) => setShowUrlInput((e.target as HTMLDetailsElement).open)}
                    className="border-t border-gray-200 pt-3"
                  >
                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                      Avanzado: pegar URL pública
                    </summary>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="url"
                        value={urlInputValue}
                        onChange={(e) => {
                          setUrlInputValue(e.target.value);
                          setUrlInputError(null);
                        }}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleUrlPaste}
                        className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                      >
                        Usar URL
                      </button>
                    </div>
                    {urlInputError && (
                      <p className="text-sm text-red-600 mt-1">{urlInputError}</p>
                    )}
                  </details>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales de la promoción..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Form actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : editingPromo ? "Guardar cambios" : "Crear promoción"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Promos List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sin promociones
          </h3>
          <p className="text-gray-500 text-sm">
            {isOwner
              ? "Crea tu primera promoción para mostrarla en tu perfil público."
              : "No hay promociones configuradas todavía."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((promo, index) => (
            <div
              key={promo.id}
              className={`bg-white rounded-lg border p-4 ${
                promo.is_active ? "border-gray-200" : "border-orange-200 bg-orange-50"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="w-24 h-18 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {promo.image_url ? (
                    <img
                      src={promo.image_url}
                      alt={promo.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      🖼️
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {promo.title}
                    </h3>
                    {!promo.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {promo.description && (
                    <p className="text-sm text-gray-500 line-clamp-1">
                      {promo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>👁️ {promo.view_count ?? 0} vistas</span>
                    <span>
                      Creada: {new Date(promo.created_at).toLocaleDateString("es-PY")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {isOwner && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Move buttons */}
                    <button
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0 || saving}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(index, "down")}
                      disabled={index === promos.length - 1 || saving}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Bajar"
                    >
                      ↓
                    </button>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(promo)}
                      disabled={saving}
                      className={`px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${
                        promo.is_active
                          ? "border border-orange-300 text-orange-600 hover:bg-orange-50"
                          : "border border-green-300 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {promo.is_active ? "Desactivar" : "Activar"}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleEditClick(promo)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Editar
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(promo)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
