import { useEffect, useMemo, useState } from "react";
import { getLocalBySlug, type LocalInfo, type OpeningHoursV1 } from "@/lib/locals";

const localBySlugCache = new Map<string, LocalInfo | null>();
const localBySlugRequestCache = new Map<string, Promise<LocalInfo | null>>();

function normalizeSlug(slug: string | null | undefined): string | null {
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchLocalCached(slug: string): Promise<LocalInfo | null> {
  if (localBySlugCache.has(slug)) {
    return localBySlugCache.get(slug) ?? null;
  }

  const inFlight = localBySlugRequestCache.get(slug);
  if (inFlight) {
    return inFlight;
  }

  const request = getLocalBySlug(slug)
    .then((local) => {
      const resolved = local ?? null;
      localBySlugCache.set(slug, resolved);
      return resolved;
    })
    .catch(() => {
      localBySlugCache.set(slug, null);
      return null;
    })
    .finally(() => {
      localBySlugRequestCache.delete(slug);
    });

  localBySlugRequestCache.set(slug, request);
  return request;
}

export function useLocalOpeningHoursBySlug(
  slug: string | null | undefined,
  enabled: boolean = true,
): {
  local: LocalInfo | null | undefined;
  openingHours: OpeningHoursV1 | null | undefined;
  isLoading: boolean;
} {
  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug]);
  const [local, setLocal] = useState<LocalInfo | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    if (!normalizedSlug) {
      setLocal(null);
      setIsLoading(false);
      return;
    }

    const cached = localBySlugCache.get(normalizedSlug);
    if (cached !== undefined) {
      setLocal(cached);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    fetchLocalCached(normalizedSlug)
      .then((nextLocal) => {
        if (!active) return;
        setLocal(nextLocal);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, normalizedSlug]);

  return {
    local,
    openingHours: local?.opening_hours ?? null,
    isLoading,
  };
}
