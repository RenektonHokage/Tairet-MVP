"use client";

import Link from "next/link";

interface NotAvailableProps {
  localType: "bar" | "club";
  feature: string;
  message: string;
}

/**
 * Componente para mostrar pantalla de "No disponible" con gating por tipo de local.
 * Usa clases Tailwind estáticas (no dinámicas) para evitar problemas en producción.
 */
export function NotAvailable({ localType, feature, message }: NotAvailableProps) {
  const emoji = localType === "bar" ? "🍸" : "🎵";

  // Mapping estático de clases Tailwind por tipo
  const styles =
    localType === "bar"
      ? {
          containerClass: "bg-amber-50 border-2 border-amber-200",
          titleClass: "text-amber-900",
          textClass: "text-amber-800",
          btnClass: "bg-amber-600 text-white hover:bg-amber-700",
          typeLabel: "bares",
        }
      : {
          containerClass: "bg-purple-50 border-2 border-purple-200",
          titleClass: "text-purple-900",
          textClass: "text-purple-800",
          btnClass: "bg-purple-600 text-white hover:bg-purple-700",
          typeLabel: "discotecas",
        };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">{feature}</h2>
      <div className={`${styles.containerClass} rounded-lg p-8 text-center`}>
        <div className="text-6xl mb-4">{emoji}</div>
        <h3 className={`text-2xl font-bold ${styles.titleClass} mb-2`}>
          No disponible para {styles.typeLabel}
        </h3>
        <p className={`${styles.textClass} mb-6`}>{message}</p>
        <Link
          href="/panel"
          className={`inline-block px-6 py-3 ${styles.btnClass} font-semibold rounded-md transition-colors`}
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
