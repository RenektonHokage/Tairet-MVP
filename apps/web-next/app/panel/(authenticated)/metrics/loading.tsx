export default function MetricsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-9 w-40 rounded-lg bg-neutral-200/70 animate-pulse" />
          <div className="h-4 w-72 max-w-full rounded bg-neutral-200/60 animate-pulse" />
        </div>
        <div className="h-9 w-44 rounded-full bg-neutral-200/70 animate-pulse" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`metrics-kpi-${index}`}
            className="h-[112px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-28 rounded bg-neutral-200/70 animate-pulse" />
            <div className="mt-4 h-8 w-20 rounded bg-neutral-200/70 animate-pulse" />
            <div className="mt-3 h-3 w-28 rounded bg-neutral-200/60 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-40 rounded bg-neutral-200/70 animate-pulse" />
          <div className="mt-4 h-[280px] rounded-2xl bg-neutral-200/60 animate-pulse" />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-40 rounded bg-neutral-200/70 animate-pulse" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`metrics-list-${index}`} className="h-11 rounded-lg bg-neutral-200/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
