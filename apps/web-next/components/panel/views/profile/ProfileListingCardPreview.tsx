import { Card, CardContent, CardHeader, CardTitle } from "@/components/panel/ui";

interface ProfileListingCardPreviewProps {
  localType: "bar" | "club";
  name: string;
  location: string;
  city: string;
  attributes: string[];
  minAge: number | null;
  coverImageUrl: string | null;
}

export function ProfileListingCardPreview({
  localType,
  name,
  location,
  city,
  attributes,
  minAge,
  coverImageUrl,
}: ProfileListingCardPreviewProps) {
  const chips = attributes.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview de card del listado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="relative aspect-[16/9] bg-neutral-100">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt={`Card de ${name}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                Sin foto de perfil
              </div>
            )}
            <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-neutral-700">
              ⭐ 4.6
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="space-y-1">
              <p className="truncate text-base font-semibold text-neutral-900">{name || "Nombre del local"}</p>
              <p className="text-sm text-neutral-600">
                {[location, city].filter(Boolean).join(" • ") || "Zona • Ciudad"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {chips.length > 0 ? (
                chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
                  >
                    {chip}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-500">
                  {localType === "bar" ? "Especialidad" : "Genero"}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <span>Abre 18:00</span>
              <span>{minAge ? `+${minAge}` : "Todo publico"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
