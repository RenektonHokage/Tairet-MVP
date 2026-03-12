"use client";

import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav } from "./SidebarNav";
import { SidebarUserInfo } from "./SidebarUserInfo";

type PanelTheme = "dark" | "light";

/**
 * Sidebar fijo del panel. En desktop siempre visible (w-64).
 * En mobile se oculta y se usa el drawer.
 */
interface SidebarProps {
  theme: PanelTheme;
  onToggleTheme: () => void;
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r">
      <SidebarHeader />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav theme={theme} onToggleTheme={onToggleTheme} />
      </div>
      <SidebarUserInfo />
    </aside>
  );
}
