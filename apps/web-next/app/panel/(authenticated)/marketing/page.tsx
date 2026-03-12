"use client";

import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Marketing</h1>
        <p className="text-gray-600 mt-2">Gestiona tu presencia y promociones</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/panel/marketing/promos"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🎯</span>
            <h3 className="text-xl font-semibold text-gray-900">Promociones</h3>
          </div>
          <p className="text-gray-600">
            Crea y gestiona promociones visibles en tu perfil público.
          </p>
        </Link>
      </div>
    </div>
  );
}
