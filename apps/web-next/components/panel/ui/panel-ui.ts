export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

export const panelUi = {
  pageTitle: "text-2xl font-semibold tracking-tight text-neutral-950",
  pageSubtitle: "text-sm text-neutral-600",
  breadcrumb: "text-xs text-neutral-500 hover:text-neutral-700",
  card: "rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
  cardHeader: "flex flex-col gap-1.5 p-5",
  cardContent: "p-5 pt-0",
  cardFooter: "p-5 pt-0",
  mutedText: "text-sm text-neutral-600",
  labelText: "text-xs font-medium uppercase tracking-wide text-neutral-500",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d1313]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  tableHead:
    "bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500",
  tableRow: "border-b border-neutral-100 last:border-0",
  tableCell: "py-3 px-4 text-sm text-neutral-800",
  tableRowHover: "hover:bg-neutral-50/70",
  badgeBase:
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  badgeNeutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
  badgeSuccess: "border-emerald-200 bg-emerald-50 text-emerald-700",
  badgeWarn: "border-amber-200 bg-amber-50 text-amber-800",
  badgeDanger: "border-rose-200 bg-rose-50 text-rose-700",
  accentText: "text-[#8d1313]",
  accentBgSoft: "bg-[#8d1313]/10 text-[#8d1313]",
  toolbar: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
  emptyWrap:
    "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center",
  statValue: "text-2xl font-semibold text-neutral-950",
  statHint: "text-xs text-neutral-500",
  skeleton: "animate-pulse rounded-md bg-neutral-200/70",
};
