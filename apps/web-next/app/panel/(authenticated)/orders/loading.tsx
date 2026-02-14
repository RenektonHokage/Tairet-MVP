export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-64 rounded-lg bg-neutral-200/70 animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-neutral-200/60 animate-pulse" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`orders-kpi-${index}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="h-8 w-20 rounded bg-neutral-200/70 animate-pulse" />
            <div className="mt-3 h-4 w-24 rounded bg-neutral-200/60 animate-pulse" />
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-7 w-44 rounded bg-neutral-200/70 animate-pulse" />
        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_200px_120px]">
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse" />
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse" />
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse" />
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-4 w-56 rounded bg-neutral-200/60 animate-pulse" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`orders-row-${index}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <div key={`orders-cell-${index}-${cellIndex}`} className="space-y-2">
                    <div className="h-3 w-16 rounded bg-neutral-200/60 animate-pulse" />
                    <div className="h-4 w-full rounded bg-neutral-200/70 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-neutral-200/60 animate-pulse" />
                <div className="h-8 rounded-lg bg-neutral-200/60 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
