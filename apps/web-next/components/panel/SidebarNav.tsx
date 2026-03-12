"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { usePanelContext } from "@/lib/panelContext";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarNavProps {
  onNavigate?: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

/**
 * Navegación del sidebar con links dinámicos según el tipo de local.
 * Agrupados en secciones con gating por tipo.
 */
export function SidebarNav({ onNavigate, theme, onToggleTheme }: SidebarNavProps) {
  const { data, loading } = usePanelContext();
  const pathname = usePathname();

  if (loading) {
    return (
      <nav className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </nav>
    );
  }

  if (!data) return null;

  // Grupos de navegación según tipo de local
  const navGroups: NavGroup[] =
    data.local.type === "club"
      ? [
          {
            title: "Dashboard",
            items: [{ href: "/panel", label: "Dashboard", icon: "📊" }],
          },
          {
            title: "Operación",
            items: [
              { href: "/panel/checkin", label: "Check-in", icon: "✓" },
              { href: "/panel/orders", label: "Entradas", icon: "📋" },
            ],
          },
          {
            title: "Calendario",
            items: [{ href: "/panel/calendar", label: "Calendario", icon: "📅" }],
          },
          {
            title: "Marketing",
            items: [{ href: "/panel/marketing/promos", label: "Promociones", icon: "🎯" }],
          },
          {
            title: "Métricas",
            items: [{ href: "/panel/metrics", label: "Métricas", icon: "📈" }],
          },
          {
            title: "Perfil",
            items: [{ href: "/panel/profile", label: "Perfil del Local", icon: "🏢" }],
          },
          {
            title: "Soporte",
            items: [{ href: "/panel/settings", label: "Soporte", icon: "🛟" }],
          },
        ]
      : [
          {
            title: "Dashboard",
            items: [{ href: "/panel", label: "Dashboard", icon: "📊" }],
          },
          {
            title: "Operación",
            items: [{ href: "/panel/reservations", label: "Reservas", icon: "📋" }],
          },
          {
            title: "Calendario",
            items: [{ href: "/panel/calendar", label: "Calendario", icon: "📅" }],
          },
          {
            title: "Marketing",
            items: [{ href: "/panel/marketing/promos", label: "Promociones", icon: "🎯" }],
          },
          {
            title: "Métricas",
            items: [{ href: "/panel/metrics", label: "Métricas", icon: "📈" }],
          },
          {
            title: "Perfil",
            items: [{ href: "/panel/profile", label: "Perfil del Local", icon: "🏢" }],
          },
          {
            title: "Soporte",
            items: [{ href: "/panel/settings", label: "Soporte", icon: "🛟" }],
          },
        ];

  return (
    <nav className="p-4 space-y-4">
      {navGroups.map((group) => (
        <div key={group.title}>
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {group.title}
          </h3>
          <div className="space-y-1">
            {group.items.map((item) => {
              // Active link logic: exact match para /panel, startsWith para el resto
              const isActive =
                item.href === "/panel"
                  ? pathname === "/panel"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {theme && onToggleTheme ? (
        <div className="pt-2">
          <div className="mx-3 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onToggleTheme}
              title="Cambiar tema"
              aria-label={theme === "dark" ? "Cambiar a light mode" : "Cambiar a dark mode"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
