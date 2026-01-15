"use client";

export default function PromosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Promociones</h1>
        <p className="text-gray-600 mt-2">Gestiona tus promos y ofertas</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Próximamente</h3>
        <p className="text-blue-800 text-sm">
          Crea, edita y publica promociones visibles en tu perfil público.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Promociones Activas</h4>
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md cursor-not-allowed"
            disabled
          >
            + Nueva Promo
          </button>
        </div>
        <p className="text-gray-500 text-sm">Sin promociones publicadas</p>
      </div>
    </div>
  );
}
