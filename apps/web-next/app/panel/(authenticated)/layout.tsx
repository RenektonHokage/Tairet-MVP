"use client";

import { PanelProvider } from "@/lib/panelContext";
import { PanelShell } from "@/components/panel";

/**
 * Layout para páginas autenticadas del panel.
 * Provee el contexto del usuario/local y el shell con sidebar.
 */
export default function AuthenticatedPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelProvider>
      <PanelShell>{children}</PanelShell>
    </PanelProvider>
  );
}
