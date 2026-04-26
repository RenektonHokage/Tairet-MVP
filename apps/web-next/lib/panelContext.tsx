"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ApiError } from "./api";
import { getPanelUserInfo, type PanelUserInfo } from "./panel";
import {
  getStoredPanelDemoRuntime,
  type DemoScenario,
} from "./panel-demo/runtime";
import { getPanelDemoIdentity } from "./panel-demo/identity";

// Re-export PanelUserInfo for convenience
export type { PanelUserInfo } from "./panel";

export type PanelAccessState =
  | "loading"
  | "unauthenticated"
  | "unauthorized"
  | "authenticated-live";

export interface PanelContextValue {
  data: PanelUserInfo | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  demoScenario: DemoScenario | null;
  accessState: PanelAccessState;
}

const PanelContext = createContext<PanelContextValue | null>(null);
const PANEL_VIDEO_DISPLAY_OVERRIDES = {
  dlirio: {
    localName: "Boliche",
    email: "owner.boliche@tairet.com.py",
  },
  "mckharthys-bar": {
    localName: "Mckharthys Bar",
    email: "owner.bar@tairet.com.py",
  },
} as const;

function applyPanelVideoDisplayOverride(data: PanelUserInfo): PanelUserInfo {
  const normalizedSlug = data.local.slug.trim().toLowerCase();
  const override =
    normalizedSlug in PANEL_VIDEO_DISPLAY_OVERRIDES
      ? PANEL_VIDEO_DISPLAY_OVERRIDES[
          normalizedSlug as keyof typeof PANEL_VIDEO_DISPLAY_OVERRIDES
        ]
      : null;

  if (!override) {
    return data;
  }

  return {
    ...data,
    email: override.email,
    local: {
      ...data.local,
      name: override.localName,
    },
  };
}

/**
 * Provider que hace UN solo fetch de /panel/me y comparte el resultado
 * con todos los componentes hijos via Context.
 */
export function PanelProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PanelUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoScenario, setDemoScenario] = useState<DemoScenario | null>(null);
  const [accessState, setAccessState] = useState<PanelAccessState>("loading");

  useEffect(() => {
    let isMounted = true;

    const fetchContext = async () => {
      try {
        const demoRuntime = getStoredPanelDemoRuntime();
        if (demoRuntime) {
          if (isMounted) {
            setData(
              applyPanelVideoDisplayOverride(
                getPanelDemoIdentity(demoRuntime.scenario)
              )
            );
            setError(null);
            setIsDemo(true);
            setDemoScenario(demoRuntime.scenario);
            setAccessState("authenticated-live");
          }
          return;
        }

        const info = await getPanelUserInfo();
        if (isMounted) {
          setData(applyPanelVideoDisplayOverride(info));
          setError(null);
          setIsDemo(false);
          setDemoScenario(null);
          setAccessState("authenticated-live");
        }
      } catch (err) {
        if (isMounted) {
          setData(null);
          setIsDemo(false);
          setDemoScenario(null);

          if (err instanceof ApiError && err.status === 401) {
            setError(null);
            setAccessState("unauthenticated");
            return;
          }

          if (err instanceof ApiError && err.status === 403) {
            setError(err.message || "Tu sesión no tiene acceso autorizado al panel");
            setAccessState("unauthorized");
            return;
          }

          setError(err instanceof Error ? err.message : "Error al cargar contexto del panel");
          setAccessState("unauthorized");
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
    <PanelContext.Provider value={{ data, loading, error, isDemo, demoScenario, accessState }}>
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
