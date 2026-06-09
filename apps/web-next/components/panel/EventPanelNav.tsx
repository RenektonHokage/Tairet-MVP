"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, panelUi } from "./ui";

interface EventPanelNavProps {
  eventId: string;
  className?: string;
  variant?: "sidebar" | "mobile";
}

export function EventPanelNav({
  eventId,
  className,
  variant = "sidebar",
}: EventPanelNavProps) {
  const pathname = usePathname();
  const normalizedEventId = eventId.trim();
  const entriesHref = normalizedEventId
    ? `/panel/events/${encodeURIComponent(normalizedEventId)}/entries`
    : "#";
  const activityHref = normalizedEventId
    ? `/panel/events/${encodeURIComponent(normalizedEventId)}/activity`
    : "#";
  const navItems = [
    {
      href: entriesHref,
      label: "Entradas",
      icon: "🎟️",
    },
    {
      href: activityHref,
      label: "Actividad",
      icon: "📋",
    },
  ];

  if (variant === "mobile") {
    return (
      <nav className={cn("flex gap-2 overflow-x-auto", className)}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                panelUi.focusRing
              )}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={cn("space-y-4 p-4", className)}>
      <div>
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Evento
        </h3>
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  panelUi.focusRing
                )}
                key={item.href}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
