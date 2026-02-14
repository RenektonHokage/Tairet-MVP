export default function ReservationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-44 rounded-lg bg-neutral-200/70 animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded bg-neutral-200/60 animate-pulse" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`reservations-kpi-${index}`}
            className="h-[112px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-neutral-200/70 animate-pulse" />
            <div className="mt-4 h-8 w-16 rounded bg-neutral-200/70 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-10 rounded-full bg-neutral-200/60 animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-10 rounded-full bg-neutral-200/60 animate-pulse" />
            <div className="h-10 rounded-full bg-neutral-200/60 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`reservations-card-${index}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-6 w-36 rounded bg-neutral-200/70 animate-pulse" />
                <div className="h-4 w-24 rounded bg-neutral-200/60 animate-pulse" />
              </div>
              <div className="h-7 w-24 rounded-full bg-neutral-200/60 animate-pulse" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((__, cellIndex) => (
                <div key={`reservations-cell-${index}-${cellIndex}`} className="space-y-2">
                  <div className="h-3 w-14 rounded bg-neutral-200/60 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-neutral-200/70 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="mt-4 h-20 rounded-xl bg-neutral-200/60 animate-pulse" />
            <div className="mt-3 h-16 rounded-xl bg-neutral-200/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
