"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelProvider, usePanelContext } from "@/lib/panelContext";
import { PanelShell } from "@/components/panel";
import { PanelLoadingState } from "./loading";

function PanelAccessBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessState, error } = usePanelContext();

  useEffect(() => {
    if (accessState === "unauthenticated") {
      router.replace("/panel/login");
    }
  }, [accessState, router]);

  if (accessState === "loading" || accessState === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PanelLoadingState />
        </div>
      </div>
    );
  }

  if (accessState === "unauthorized") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center">
          <div className="w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Acceso no autorizado</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {error || "Tu sesión no tiene acceso habilitado al panel."}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/panel/login")}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <PanelShell>{children}</PanelShell>;
}

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
      <PanelAccessBoundary>{children}</PanelAccessBoundary>
    </PanelProvider>
  );
}
