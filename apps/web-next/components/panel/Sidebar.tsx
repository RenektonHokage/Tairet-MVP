"use client";

import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav } from "./SidebarNav";
import { SidebarUserInfo } from "./SidebarUserInfo";

/**
 * Sidebar fijo del panel. En desktop siempre visible (w-64).
 * En mobile se oculta y se usa el drawer.
 */
export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r">
      <SidebarHeader />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <SidebarUserInfo />
    </aside>
  );
}
