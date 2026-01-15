"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getPanelUserInfo, type PanelUserInfo } from "./panel";

// Re-export PanelUserInfo for convenience
export type { PanelUserInfo } from "./panel";

export interface PanelContextValue {
  data: PanelUserInfo | null;
  loading: boolean;
  error: string | null;
}

const PanelContext = createContext<PanelContextValue | null>(null);

/**
 * Provider que hace UN solo fetch de /panel/me y comparte el resultado
 * con todos los componentes hijos via Context.
 */
export function PanelProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PanelUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchContext = async () => {
      try {
        const info = await getPanelUserInfo();
        if (isMounted) {
          setData(info);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error al cargar contexto del panel");
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchContext();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PanelContext.Provider value={{ data, loading, error }}>
      {children}
    </PanelContext.Provider>
  );
}

/**
 * Hook para consumir el contexto del panel.
 * DEBE usarse dentro de un PanelProvider.
 */
export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanelContext must be used within a PanelProvider");
  }
  return context;
}
