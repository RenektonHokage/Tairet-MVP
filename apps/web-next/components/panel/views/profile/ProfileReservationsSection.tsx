import { Calendar, MessageCircle } from "lucide-react";

export function ProfileReservationsSection() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-700">
            <Calendar className="h-4 w-4" />
            Reservas
          </p>
          <h3 className="text-3xl font-bold text-neutral-900">Reserva tu mesa</h3>
          <p className="text-base text-neutral-600">Asegura tu lugar y disfruta de la mejor experiencia</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 text-sm font-semibold text-white"
          >
            <Calendar className="h-4 w-4" />
            Reservar ahora
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-7 text-sm font-semibold text-neutral-800"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
        </div>
      </div>
    </section>
  );
}
