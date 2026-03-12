"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";

interface PanelShellProps {
  children: React.ReactNode;
}

type PanelTheme = "dark" | "light";

const PANEL_THEME_STORAGE_KEY = "tairet.panel.theme";
const PANEL_THEME_EVENT_NAME = "tairet:panel-theme-change";

/**
 * Shell del panel: sidebar fijo en desktop, drawer en mobile.
 * Envuelve el contenido de las páginas del panel.
 */
export function PanelShell({ children }: PanelShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<PanelTheme>("dark");

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(PANEL_THEME_STORAGE_KEY);
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, theme);
    } catch {
      // noop
    }

    document.documentElement.style.colorScheme = theme;
    window.dispatchEvent(
      new CustomEvent(PANEL_THEME_EVENT_NAME, {
        detail: theme,
      })
    );
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`panel-theme-root min-h-screen ${
        theme === "dark" ? "panel-theme-dark bg-[#0B0F14]" : "panel-theme-light bg-gray-50"
      }`}
    >
      {/* Sidebar desktop */}
      <Sidebar theme={theme} onToggleTheme={handleToggleTheme} />

      {/* Mobile drawer */}
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Mobile header con hamburguesa */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          aria-label="Abrir menú"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Panel Tairet</h1>
      </div>

      {/* Contenido principal */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 pt-20 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
