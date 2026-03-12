"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearPanelDemoRuntime,
  isDemoScenario,
  isPanelDemoEnabled,
  persistPanelDemoRuntime,
} from "@/lib/panel-demo/runtime";

function getScenarioLabel(value: string | undefined): string {
  if (value === "bar") {
    return "bar";
  }
  if (value === "discoteca") {
    return "discoteca";
  }
  if (value === "off") {
    return "off";
  }
  return "desconocido";
}

export default function PanelDemoScenarioPage() {
  const router = useRouter();
  const params = useParams<{ scenario: string }>();
  const rawScenario = Array.isArray(params?.scenario) ? params.scenario[0] : params?.scenario;

  useEffect(() => {
    if (!isPanelDemoEnabled()) {
      clearPanelDemoRuntime();
      router.replace("/panel/login");
      return;
    }

    if (rawScenario === "off") {
      clearPanelDemoRuntime();
      router.replace("/panel/login");
      return;
    }

    if (rawScenario && isDemoScenario(rawScenario)) {
      persistPanelDemoRuntime(rawScenario);
      router.replace("/panel");
      return;
    }

    clearPanelDemoRuntime();
    router.replace("/panel/login");
  }, [rawScenario, router]);

  const label = useMemo(() => getScenarioLabel(rawScenario), [rawScenario]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">Panel Demo</h1>
        <p className="text-sm text-gray-600">
          Preparando runtime demo para el escenario <strong>{label}</strong>.
        </p>
      </div>
    </div>
  );
}
