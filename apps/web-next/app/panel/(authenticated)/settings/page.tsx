"use client";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-gray-600 mt-2">Configuración e integraciones</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Próximamente</h3>
        <p className="text-blue-800 text-sm">
          Gestiona webhooks, integraciones de pago, notificaciones y más.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-semibold mb-4">Integraciones</h4>
        <p className="text-gray-500 text-sm">
          Aquí podrás configurar integraciones con servicios externos.
        </p>
      </div>
    </div>
  );
}
