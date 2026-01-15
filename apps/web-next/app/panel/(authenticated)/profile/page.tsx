"use client";

import { usePanelContext } from "@/lib/panelContext";

export default function ProfilePage() {
  const { data: context, loading } = usePanelContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Perfil del Local</h1>
        <p className="text-gray-600 mt-2">
          Información pública de {context?.local.name}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Próximamente</h3>
        <p className="text-blue-800 text-sm">
          Edita la información pública, fotos, horarios y descripción de tu local.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-semibold mb-4">Información Básica</h4>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600">Nombre</label>
            <p className="text-gray-900">{context?.local.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Tipo</label>
            <p className="text-gray-900">
              {context?.local.type === "club" ? "Discoteca" : "Bar"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Slug</label>
            <p className="text-gray-900">{context?.local.slug}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
