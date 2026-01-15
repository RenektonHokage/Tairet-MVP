"use client";

import { usePanelContext } from "@/lib/panelContext";

/**
 * Header del sidebar: muestra "Panel Tairet" y el nombre del local.
 */
export function SidebarHeader() {
  const { data, loading } = usePanelContext();

  return (
    <div className="p-4 border-b">
      <h1 className="text-xl font-semibold text-gray-900">Panel Tairet</h1>
      {loading ? (
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-1" />
      ) : data ? (
        <p className="text-sm text-gray-600 mt-1 truncate">{data.local.name}</p>
      ) : null}
    </div>
  );
}
