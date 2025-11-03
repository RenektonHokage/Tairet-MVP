export default function PanelPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: WhatsApp clicks */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">WhatsApp Clicks</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con métricas</p>
        </div>

        {/* KPI: Reservas web (bares) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Reservas Web</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con API</p>
        </div>

        {/* KPI: Entradas vendidas/usadas */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Entradas Vendidas</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con orders</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Entradas Usadas</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con orders (used_at)</p>
        </div>

        {/* KPI: Ingresos estimados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Ingresos Estimados</h3>
          <p className="text-3xl font-bold mt-2">PYG 0</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Sumar de orders pagadas</p>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">TODO: Listar eventos recientes</p>
          <ul className="list-disc list-inside text-sm text-gray-600">
            <li>Reservas creadas</li>
            <li>Entradas vendidas</li>
            <li>Check-ins realizados</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

