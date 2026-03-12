"use client";

import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav } from "./SidebarNav";
import { SidebarUserInfo } from "./SidebarUserInfo";

type PanelTheme = "dark" | "light";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: PanelTheme;
  onToggleTheme: () => void;
}

/**
 * Drawer overlay para navegación mobile.
 * Se muestra sobre el contenido con backdrop oscuro.
 */
export function MobileDrawer({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
}: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col">
        <SidebarHeader />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            onNavigate={onClose}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        </div>
        <SidebarUserInfo />
      </div>
    </div>
  );
}
