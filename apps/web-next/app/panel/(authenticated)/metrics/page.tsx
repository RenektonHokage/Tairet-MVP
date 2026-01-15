"use client";

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
        <p className="text-gray-600 mt-2">Análisis detallado de tu local</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Próximamente</h3>
        <p className="text-blue-800 text-sm">
          Visualizaciones avanzadas, gráficos de tendencias y reportes personalizados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Visitas por Día</h4>
          <p className="text-gray-400 text-sm">Gráfico en desarrollo</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Conversión</h4>
          <p className="text-gray-400 text-sm">Gráfico en desarrollo</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Ingresos</h4>
          <p className="text-gray-400 text-sm">Gráfico en desarrollo</p>
        </div>
      </div>
    </div>
  );
}
