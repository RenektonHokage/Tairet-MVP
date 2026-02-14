export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-56 rounded-lg bg-neutral-200/70 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-neutral-200/60 animate-pulse" />
      </div>

      <div className="h-11 w-80 max-w-full rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
        <div className="grid h-full grid-cols-2 gap-1">
          <div className="rounded-lg bg-neutral-200/60 animate-pulse" />
          <div className="rounded-lg bg-neutral-200/60 animate-pulse" />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="h-7 w-44 rounded bg-neutral-200/70 animate-pulse" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-200/60 animate-pulse" />

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="h-4 w-28 rounded bg-neutral-200/60 animate-pulse" />
            <div className="aspect-video w-full rounded-xl bg-neutral-200/60 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-40 rounded bg-neutral-200/60 animate-pulse" />
            <div className="h-[340px] rounded-2xl bg-neutral-200/60 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`profile-section-${index}`} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-44 rounded bg-neutral-200/70 animate-pulse" />
            <div className="mt-4 h-48 rounded-xl bg-neutral-200/60 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
