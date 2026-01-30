import * as React from "react";
import { cn, panelUi } from "../../ui";

export interface PrimaryActionBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  /** Tone visual: club = rojo, bar = azul */
  tone?: "club" | "bar";
  icon?: React.ReactNode;
}

const toneStyles = {
  club: {
    bg: "bg-gradient-to-br from-[#8d1313] to-[#6b0f0f]",
    button: "bg-white text-[#8d1313] hover:bg-neutral-100",
  },
  bar: {
    bg: "bg-gradient-to-br from-blue-600 to-blue-800",
    button: "bg-white text-blue-700 hover:bg-neutral-100",
  },
};

export function PrimaryActionBanner({
  title,
  subtitle,
  ctaLabel,
  onCta,
  tone = "club",
  icon,
}: PrimaryActionBannerProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-white shadow-lg",
        styles.bg
      )}
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-white/80">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-md transition-colors",
            styles.button,
            panelUi.focusRing
          )}
        >
          {icon}
          {ctaLabel}
        </button>
      </div>
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}
