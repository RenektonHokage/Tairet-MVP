import * as React from "react";
import { Info } from "lucide-react";

export interface InfoTipProps {
  /** Texto del tooltip que aparece en hover/focus */
  text: string;
  /** Clases CSS adicionales (opcional) */
  className?: string;
}

/**
 * Componente puro para mostrar un ícono de información con tooltip nativo.
 * Accesible con teclado (focusable).
 */
export function InfoTip({ text, className = "" }: InfoTipProps) {
  return (
    <span
      tabIndex={0}
      role="button"
      aria-label={text}
      title={text}
      className={`inline-flex cursor-help rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-1 ${className}`}
    >
      <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600" />
    </span>
  );
}
