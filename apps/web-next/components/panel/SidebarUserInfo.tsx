"use client";

import { useRouter } from "next/navigation";
import { usePanelContext } from "@/lib/panelContext";

/**
 * Información del usuario en el sidebar: email, rol, y botón de logout.
 */
export function SidebarUserInfo() {
  const { data, loading } = usePanelContext();
  const router = useRouter();

  const handleLogout = () => {
    // Limpiar token y redirigir a login
    document.cookie = "panel_token=; path=/; max-age=0";
    router.push("/panel/login");
  };

  if (loading) {
    return (
      <div className="p-4 border-t space-y-2">
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const roleLabel = data.role === "owner" ? "Propietario" : "Staff";

  return (
    <div className="p-4 border-t">
      <p className="text-sm text-gray-900 truncate">{data.email}</p>
      <p className="text-xs text-gray-500">{roleLabel}</p>
      <button
        onClick={handleLogout}
        className="mt-3 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors text-left"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
